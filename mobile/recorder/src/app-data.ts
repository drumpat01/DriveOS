import type { Connection } from './credentials';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { loadConnection } from './credentials';
import { activeSession, getSessionSummary, readAppCache, totalQueuedMusicObservationCount, totalQueuedPointCount, writeAppCache } from './storage';
import type { ApiMusicProvider } from './music-preferences';
import { getCurrentUser } from './auth';
import { coordinateAtRecordedTime, type TimedRouteSample } from './route-moments';
import { requestJourneyDeckJson } from './network-request';
import { syncTessieDirect, tessieDirectStatus, type TessieSnapshot } from './tessie-direct';
import { refreshAllAppleMusicArtwork } from './music-capture';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';
import {
  coordinateFromPlaceAliasIdentity,
  coordinatePlaceAliasIdentity,
  GEOCODED_PLACE_MATCH_RADIUS_METERS,
  SAVED_PLACE_MATCH_RADIUS_METERS,
} from './place-matching';
import { notifyLocalArchiveChanged } from './local-archive-events';

export type ConnectionHealth = 'not_connected' | 'connected' | 'needs_attention';
export type ShazamHealth = 'not_enabled' | 'enabled' | 'permission_denied';

export type ProviderPreferences = {
  deviceId: string;
  musicProvider: ApiMusicProvider | null;
  onboardingCompleted: boolean;
  connections: {
    appleMusic: ConnectionHealth;
    shazam: ShazamHealth;
    lastFm: ConnectionHealth;
    tessie: ConnectionHealth;
  };
  updatedAt: string | null;
};

export type SoundtrackTrack = {
  playedAt: string | null;
  track: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  externalUrl: string | null;
  source: string;
  confidence: number | null;
  mapCoordinate?: [number, number] | null;
};

export type JourneySummary = {
  id: string;
  legacyDriveId: string | null;
  provider: string | null;
  vehicleName: string | null;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  miles: number;
  startingLocation: string | null;
  endingLocation: string | null;
  rawStartingLocation?: string;
  rawEndingLocation?: string;
  startingLocationKey?: string;
  endingLocationKey?: string;
  averageSpeedMph: number | null;
  maxSpeedMph: number | null;
  songCount: number;
  soundtrackPreview: SoundtrackTrack[];
};

export type JourneyDetail = JourneySummary & {
  startingBatteryPercent: number | null;
  endingBatteryPercent: number | null;
  energyUsedKwh: number | null;
  tessieTag: string | null;
  driverProfile: string | null;
  soundtrack: SoundtrackTrack[];
  route: { type: 'LineString'; coordinates: [number, number][]; points?: TimedRouteSample[] } | null;
};

export type DashboardData = {
  generatedAt: string;
  summary: {
    allTime: { journeyCount: number; miles: number; minutes: number };
    last7Days: { journeyCount: number; miles: number; minutes: number; songCount: number };
  };
  latestJourney: JourneySummary | null;
  recentJourneys: JourneySummary[];
  providerPreferences: ProviderPreferences | null;
};

export type LocalRecorderHealth = {
  connected: boolean;
  state: 'ready' | 'recording' | 'paused' | 'finishing';
  queuedPoints: number;
  queuedMusic: number;
  capturedPoints: number;
};

export type AppDashboard = DashboardData & {
  recorder: LocalRecorderHealth;
  weeklyJourneys: JourneySummary[];
};

export type MusicDashboardData = {
  generatedAt: string;
  metrics: { milesWithMusic: number; listeningHours: number; songsOnRoad: number; currentStreak: number };
  recentSelections: SoundtrackTrack[];
  topArtists: { artist: string; plays: number; artworkUrl: string | null }[];
  tour: { miles: number; changePercent: number | null };
  mood: { label: string; count: number; percent: number }[];
  cities: { label: string; songs: number }[];
  daily: { date: string; label: string; count: number; minutes: number }[];
  week: { total: number; changePercent: number | null };
};

function soundtrackKey(track: Pick<SoundtrackTrack, 'playedAt' | 'track' | 'artist'>) {
  return `${track.playedAt ?? ''}\0${track.track.toLocaleLowerCase()}\0${track.artist.toLocaleLowerCase()}`;
}

function localPlaceAliasKey(location: string) {
  let hash = 2166136261;
  for (const character of location.trim().toLocaleLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `place.alias.${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function savedPlaceAliasId(userId: string, location: string) {
  return `saved-${localPlaceAliasKey(`${userId}\0${location}`).slice('place.alias.'.length)}`;
}

function primeCoordinatePlaceAlias(
  userId: string,
  location: string,
  label: string | null | undefined,
  coordinate?: { latitude: number; longitude: number } | null,
  forceRename = false,
) {
  const resolved = coordinate ?? coordinateFromPlaceAliasIdentity(location);
  if (!resolved || !label?.trim()) return;
  // Old builds stored a separate preference for each journey endpoint. Once a
  // canonical place exists those legacy aliases must never rename it while a
  // list is merely being read; only an explicit user save may change it.
  if (!forceRename && findNamedPlace(userId, resolved.latitude, resolved.longitude)) return;
  upsertPlace({
    id: savedPlaceAliasId(userId, location), userId, kind: 'custom', label: label.trim(), lat: resolved.latitude, lng: resolved.longitude,
    radiusMeters: SAVED_PLACE_MATCH_RADIUS_METERS, foursquareId: null, osmId: null, cachedUntil: null,
  });
}

function primeSavedPlaceAliases(journeys: JourneySummary[]) {
  const userId = getCurrentUser().id;
  for (const journey of journeys) {
    const startKey = journey.startingLocationKey || journey.rawStartingLocation || journey.startingLocation || `journey:${journey.id}:start`;
    const endKey = journey.endingLocationKey || journey.rawEndingLocation || journey.endingLocation || `journey:${journey.id}:end`;
    primeCoordinatePlaceAlias(userId, startKey, getPrivatePreference<string>(userId, localPlaceAliasKey(startKey)));
    primeCoordinatePlaceAlias(userId, endKey, getPrivatePreference<string>(userId, localPlaceAliasKey(endKey)));
  }
}

function applyLocalPlaceAliasesToJourneys<T extends JourneySummary>(journeys: T[]) {
  primeSavedPlaceAliases(journeys);
  return journeys.map(applyLocalPlaceAliases);
}

function routeEndpointCoordinate(journey: JourneySummary, endpoint: 'start' | 'end') {
  const route = 'route' in journey ? (journey as JourneyDetail).route : null;
  const pair = endpoint === 'start' ? route?.coordinates[0] : route?.coordinates[route.coordinates.length - 1];
  return pair && Number.isFinite(pair[0]) && Number.isFinite(pair[1])
    ? { latitude: pair[1], longitude: pair[0] }
    : null;
}

function applyLocalPlaceAliases<T extends JourneySummary>(journey: T): T {
  const userId = getCurrentUser().id;
  const rawStartingLocation = journey.rawStartingLocation || journey.startingLocation || 'Recorded start';
  const rawEndingLocation = journey.rawEndingLocation || journey.endingLocation || 'Recorded destination';
  const startKey = journey.startingLocationKey || journey.rawStartingLocation || journey.startingLocation || `journey:${journey.id}:start`;
  const endKey = journey.endingLocationKey || journey.rawEndingLocation || journey.endingLocation || `journey:${journey.id}:end`;
  const exactStart = getPrivatePreference<string>(userId, localPlaceAliasKey(startKey));
  const exactEnd = getPrivatePreference<string>(userId, localPlaceAliasKey(endKey));
  const startCoordinate = coordinateFromPlaceAliasIdentity(startKey) ?? routeEndpointCoordinate(journey, 'start');
  const endCoordinate = coordinateFromPlaceAliasIdentity(endKey) ?? routeEndpointCoordinate(journey, 'end');
  primeCoordinatePlaceAlias(userId, startKey, exactStart, startCoordinate);
  primeCoordinatePlaceAlias(userId, endKey, exactEnd, endCoordinate);
  const start = startCoordinate
    ? findNamedPlace(userId, startCoordinate.latitude, startCoordinate.longitude)?.label
      ?? exactStart
      ?? findCachedPlace(userId, startCoordinate.latitude, startCoordinate.longitude, GEOCODED_PLACE_MATCH_RADIUS_METERS)?.label
    : exactStart;
  const end = endCoordinate
    ? findNamedPlace(userId, endCoordinate.latitude, endCoordinate.longitude)?.label
      ?? exactEnd
      ?? findCachedPlace(userId, endCoordinate.latitude, endCoordinate.longitude, GEOCODED_PLACE_MATCH_RADIUS_METERS)?.label
    : exactEnd;
  return {
    ...journey,
    rawStartingLocation,
    rawEndingLocation,
    startingLocationKey: startKey,
    endingLocationKey: endKey,
    startingLocation: start || journey.startingLocation,
    endingLocation: end || journey.endingLocation,
  };
}

function mergeJourneyWithLocalDetail(remote: JourneyDetail, local: JourneyDetail | null): JourneyDetail {
  if (!local) return remote;
  const localTracks = new Map(local.soundtrack.map(track => [soundtrackKey(track), track]));
  const soundtrack = remote.soundtrack.map(track => {
    const localTrack = localTracks.get(soundtrackKey(track));
    if (localTrack) localTracks.delete(soundtrackKey(track));
    return localTrack?.mapCoordinate ? { ...track, mapCoordinate: localTrack.mapCoordinate } : track;
  }).concat([...localTracks.values()]);
  const localPointCount = local.route?.coordinates.length ?? 0;
  const remotePointCount = remote.route?.coordinates.length ?? 0;
  return {
    ...remote,
    startingLocation: remote.startingLocation ?? local.startingLocation,
    endingLocation: remote.endingLocation ?? local.endingLocation,
    rawStartingLocation: remote.rawStartingLocation ?? remote.startingLocation ?? local.rawStartingLocation,
    rawEndingLocation: remote.rawEndingLocation ?? remote.endingLocation ?? local.rawEndingLocation,
    startingLocationKey: local.startingLocationKey ?? remote.startingLocationKey,
    endingLocationKey: local.endingLocationKey ?? remote.endingLocationKey,
    soundtrack,
    songCount: Math.max(remote.songCount, soundtrack.length),
    route: localPointCount >= remotePointCount ? local.route : remote.route,
  };
}

function mergeLocalJourneyPage(
  local: { items: JourneySummary[]; nextCursor: string | null },
  cached: { items: JourneySummary[]; nextCursor: string | null } | null,
  limit: number,
) {
  if (!cached) return local;
  const cachedByIdentity = new Map<string, JourneySummary>();
  for (const journey of cached.items) {
    cachedByIdentity.set(journey.id, journey);
    if (journey.legacyDriveId) cachedByIdentity.set(journey.legacyDriveId, journey);
  }
  const represented = new Set<string>();
  const merged = local.items.map(journey => {
    const remote = cachedByIdentity.get(journey.id) ?? (journey.legacyDriveId ? cachedByIdentity.get(journey.legacyDriveId) : undefined);
    if (!remote) return journey;
    represented.add(remote.id);
    return {
      ...remote,
      ...journey,
      startingLocation: journey.startingLocation ?? remote.startingLocation,
      endingLocation: journey.endingLocation ?? remote.endingLocation,
      rawStartingLocation: remote.rawStartingLocation ?? remote.startingLocation ?? journey.rawStartingLocation,
      rawEndingLocation: remote.rawEndingLocation ?? remote.endingLocation ?? journey.rawEndingLocation,
      startingLocationKey: journey.startingLocationKey ?? remote.startingLocationKey,
      endingLocationKey: journey.endingLocationKey ?? remote.endingLocationKey,
      soundtrackPreview: journey.soundtrackPreview.length ? journey.soundtrackPreview : remote.soundtrackPreview,
    };
  });
  for (const journey of cached.items) if (!represented.has(journey.id)) merged.push(journey);
  merged.sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  return { items: merged.slice(0, limit), nextCursor: local.nextCursor ?? cached.nextCursor };
}

export type ConnectionCapabilities = {
  lastFmConfigured: boolean;
  tessieConfigured: boolean;
};

export type JourneyCollection = {
  id: string;
  name: string;
  description: string;
  driveIds: string[];
  createdAtUtc: string;
  updatedAtUtc: string;
  photos: JourneyPhoto[];
};

export type JourneyPhoto = {
  id: string;
  fileName: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteLength: number;
  createdAtUtc: string;
  source: 'collection' | 'memory';
  collectionId: string | null;
  memoryId: string | null;
};

export type JourneyMemory = {
  id: string;
  name: string;
  notes: string;
  artworkKey: string;
  coverPhotoId: string | null;
  photos: JourneyPhoto[];
  collectionIds: string[];
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type MemoriesCatalog = {
  memories: JourneyMemory[];
  collections: JourneyCollection[];
  deletedMemoryIds?: string[];
  deletedCollectionIds?: string[];
  deletedPhotoIds?: string[];
};

export type SavedPlaceCategory = 'home' | 'work' | 'school' | 'favorite' | 'custom';
export type VehicleIntelligencePreferences = {
  electricityRatePerKwh: number;
  favoriteChargingLocationKeys: string[];
  placeOverrides: { placeId: string; name: string; category: SavedPlaceCategory }[];
  placeMerges: { sourcePlaceId: string; targetPlaceId: string }[];
};
export type ChargingSessionSummary = {
  id: string; locationKey: string; location: string; vehicleName: string | null; provider: string; startedAt: string; endedAt: string;
  durationMinutes: number; isSupercharger: boolean; energyAddedKwh: number; energyUsedKwh: number; milesAdded: number;
  startingBatteryPercent: number | null; endingBatteryPercent: number | null; batteryGainedPercent: number | null; cost: number; costSource: 'recorded' | 'estimated';
};
export type SavedPlaceIntelligence = {
  id: string; name: string; category: SavedPlaceCategory; latitude: number | null; longitude: number | null; visitCount: number; arrivals: number; departures: number;
  firstSeenAt: string; lastSeenAt: string; timeOfDay: { label: string; visits: number }[];
  relatedJourneys: { id: string; startedAt: string; startingLocation: string; endingLocation: string; miles: number; energyUsedKwh: number | null }[];
  soundtrack: { track: string; artist: string; plays: number; artworkUrl: string | null }[];
  foursquareSuggestion: { name: string; category: string | null; address: string | null } | null;
};
export type VehicleIntelligenceData = {
  generatedAt: string;
  preferences: VehicleIntelligencePreferences;
  vehicles: { vehicleKey: string; name: string; status: string; batteryPercent: number | null; rangeMiles: number | null; chargingState: string | null; odometerMiles: number | null; updatedAt: string | null }[];
  chargingSummary30Days: { sessions: number; energyAddedKwh: number; batteryGainedPercent: number; durationMinutes: number; cost: number };
  chargingSessions: ChargingSessionSummary[];
  chargingLocations: { locationKey: string; name: string; sessions: number; energyAddedKwh: number; cost: number; lastChargedAt: string; isFavorite: boolean }[];
  places: SavedPlaceIntelligence[];
  duplicateCandidates: { sourcePlaceId: string; targetPlaceId: string; reason: string }[];
  routeComparisons: { startPlaceId: string; endPlaceId: string; startLabel: string; endLabel: string; trips: number; miles: number; energyKwh: number; cost: number; averageWhPerMile: number; bestWhPerMile: number; worstWhPerMile: number }[];
};

const emptyDashboard = (): DashboardData => ({
  generatedAt: new Date().toISOString(),
  summary: {
    allTime: { journeyCount: 0, miles: 0, minutes: 0 },
    last7Days: { journeyCount: 0, miles: 0, minutes: 0, songCount: 0 },
  },
  latestJourney: null,
  recentJourneys: [],
  providerPreferences: null,
});

const DASHBOARD_CACHE_KEY = 'app.dashboard.v1';
const JOURNEYS_CACHE_KEY = 'app.journeys.v1';
const WEEKLY_JOURNEYS_CACHE_KEY = 'app.weekly-journeys.v1';
const MEMORIES_CACHE_KEY = 'app.memories.v1';
const MUSIC_DASHBOARD_CACHE_KEY = 'app.music-dashboard.v1';

function mergeMemoriesCatalog(remote: MemoriesCatalog, local: MemoriesCatalog, cached?: MemoriesCatalog | null): MemoriesCatalog {
  const cachedCollections = new Map((cached?.collections ?? []).map(item => [item.id, item]));
  const cachedMemories = new Map((cached?.memories ?? []).map(item => [item.id, item]));
  const deletedCollections = new Set(local.deletedCollectionIds ?? []), deletedMemories = new Set(local.deletedMemoryIds ?? []), deletedPhotos = new Set(local.deletedPhotoIds ?? []);
  const cleanPhotos = (photos: JourneyPhoto[]) => photos.filter(photo => !deletedPhotos.has(photo.id));
  const collections = new Map(remote.collections.filter(item => !deletedCollections.has(item.id)).map(item => [item.id, { ...item, photos: cleanPhotos(item.photos) }]));
  local.collections.forEach(item => {
    const remoteItem = collections.get(item.id);
    const winner = !remoteItem || Date.parse(item.updatedAtUtc) >= Date.parse(remoteItem.updatedAtUtc) ? item : remoteItem;
    const inherited = [...item.photos, ...(cachedCollections.get(item.id)?.photos ?? []), ...(remoteItem?.photos ?? [])];
    collections.set(item.id, { ...winner, photos: cleanPhotos(inherited.filter((photo, index) => inherited.findIndex(candidate => candidate.id === photo.id) === index)) });
  });
  const memories = new Map(remote.memories.filter(item => !deletedMemories.has(item.id)).map(item => [item.id, { ...item, photos: cleanPhotos(item.photos) }]));
  local.memories.forEach(item => {
    const cachedItem = cachedMemories.get(item.id);
    const remoteItem = memories.get(item.id);
    const winner = !remoteItem || Date.parse(item.updatedAtUtc) >= Date.parse(remoteItem.updatedAtUtc) ? item : remoteItem;
    const inherited = [...item.photos, ...(cachedItem?.photos ?? []), ...(remoteItem?.photos ?? [])];
    const photos = cleanPhotos(inherited.filter((photo, index) => inherited.findIndex(candidate => candidate.id === photo.id) === index));
    const requestedCover = winner.coverPhotoId ?? cachedItem?.coverPhotoId ?? remoteItem?.coverPhotoId ?? null;
    memories.set(item.id, { ...winner, coverPhotoId: requestedCover && photos.some(photo => photo.id === requestedCover) ? requestedCover : null, photos });
  });
  return {
    collections: [...collections.values()].filter(item => !deletedCollections.has(item.id)).sort((a, b) => Date.parse(b.updatedAtUtc) - Date.parse(a.updatedAtUtc)),
    memories: [...memories.values()].filter(item => !deletedMemories.has(item.id)).sort((a, b) => Date.parse(b.updatedAtUtc) - Date.parse(a.updatedAtUtc)),
    deletedCollectionIds: [...deletedCollections], deletedMemoryIds: [...deletedMemories], deletedPhotoIds: [...deletedPhotos],
  };
}

function cacheCollection(collection: JourneyCollection) {
  const current = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY) ?? { memories: [], collections: [] };
  writeAppCache(MEMORIES_CACHE_KEY, { ...current, collections: [collection, ...current.collections.filter(item => item.id !== collection.id)] });
}

function cacheMemory(memory: JourneyMemory) {
  const current = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY) ?? { memories: [], collections: [] };
  writeAppCache(MEMORIES_CACHE_KEY, { ...current, memories: [memory, ...current.memories.filter(item => item.id !== memory.id)] });
}
const vehicleIntelligenceCacheKey = (userId: string) => `app.vehicle-intelligence.${userId}.v1`;
const journeyCacheKey = (id: string) => `app.journey.${id}.v1`;
const photoCacheKey = (id: string) => `app.photo.${id}.v1`;

async function savePrivatePhoto(source: JourneyPhoto['source'], ownerId: string, input: { fileName: string; contentType: JourneyPhoto['contentType']; dataBase64: string }): Promise<JourneyPhoto> {
  const userId = getCurrentUser().id, base = FileSystem.documentDirectory;
  if (!base) throw new Error('JourneyDeck cannot access its private photo folder on this device.');
  const byteLength = Math.ceil(input.dataBase64.length * 0.75);
  if (!byteLength || byteLength > 1_572_864) throw new Error('Choose a photo smaller than 1.5 MB after compression.');
  const id = `local_${Crypto.randomUUID()}`, directory = `${base}journeydeck-private-photos/${encodeURIComponent(userId)}/`;
  const extension = input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg';
  const localUri = `${directory}${id}.${extension}`, createdAtUtc = new Date().toISOString();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.writeAsStringAsync(localUri, input.dataBase64, { encoding: FileSystem.EncodingType.Base64 });
  try {
    upsertPhoto({
      id, userId, source, collectionId: source === 'collection' ? ownerId : null, memoryId: source === 'memory' ? ownerId : null,
      fileName: input.fileName, contentType: input.contentType, byteLength, localUri,
    });
  } catch (error) {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
  const photo: JourneyPhoto = { id, fileName: input.fileName, contentType: input.contentType, byteLength, createdAtUtc, source, collectionId: source === 'collection' ? ownerId : null, memoryId: source === 'memory' ? ownerId : null };
  const cached = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY) ?? { memories: [], collections: [] };
  if (source === 'collection') {
    cached.collections = cached.collections.map(item => item.id === ownerId ? { ...item, photos: [...item.photos.filter(existing => existing.id !== id), photo] } : item);
  } else {
    cached.memories = cached.memories.map(item => item.id === ownerId ? { ...item, photos: [...item.photos.filter(existing => existing.id !== id), photo] } : item);
  }
  writeAppCache(MEMORIES_CACHE_KEY, cached);
  return photo;
}

function removeCachedPhoto(photoId: string): void {
  const cached = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY);
  if (!cached) return;
  writeAppCache(MEMORIES_CACHE_KEY, {
    ...cached,
    collections: cached.collections.map(item => ({ ...item, photos: item.photos.filter(photo => photo.id !== photoId) })),
    memories: cached.memories.map(item => ({ ...item, coverPhotoId: item.coverPhotoId === photoId ? null : item.coverPhotoId, photos: item.photos.filter(photo => photo.id !== photoId) })),
    deletedPhotoIds: [...new Set([...(cached.deletedPhotoIds ?? []), photoId])],
  });
}

type VehicleIntelligenceCache = { data: VehicleIntelligenceData; preferencesDirty: boolean };

function emptyVehicleIntelligence(): VehicleIntelligenceData {
  return {
    generatedAt: new Date().toISOString(),
    preferences: { electricityRatePerKwh: 0.14, favoriteChargingLocationKeys: [], placeOverrides: [], placeMerges: [] },
    chargingSummary30Days: { sessions: 0, energyAddedKwh: 0, batteryGainedPercent: 0, durationMinutes: 0, cost: 0 },
    vehicles: [], chargingSessions: [], chargingLocations: [], places: [], duplicateCandidates: [], routeComparisons: [],
  };
}

function localPlaceId(label: string) {
  let hash = 2166136261;
  for (const character of label.trim().toLocaleLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `place_local_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function localVehicleIntelligence(userId: string): VehicleIntelligenceData {
  const localPage = localAtlasClient.journeys(userId, 50);
  const journeys = localPage.items.length ? localPage.items : (readAppCache<{ items: JourneySummary[] }>(JOURNEYS_CACHE_KEY)?.items ?? []);
  const places = new Map<string, SavedPlaceIntelligence>();
  const addPlace = (labelValue: string | null, journey: JourneySummary, arrival: boolean) => {
    const label = labelValue?.trim(); if (!label) return;
    const id = localPlaceId(label), existing = places.get(id);
    const category: SavedPlaceCategory = /^home$/i.test(label) ? 'home' : /^work$/i.test(label) ? 'work' : /school/i.test(label) ? 'school' : 'custom';
    const related = { id: journey.id, startedAt: journey.startedAt, startingLocation: journey.startingLocation || 'Unknown start', endingLocation: journey.endingLocation || 'Unknown destination', miles: journey.miles, energyUsedKwh: null };
    if (existing) {
      existing.arrivals += Number(arrival); existing.departures += Number(!arrival); existing.visitCount = existing.arrivals || existing.departures;
      if (!existing.relatedJourneys.some(item => item.id === journey.id)) existing.relatedJourneys.push(related);
      if (journey.startedAt < existing.firstSeenAt) existing.firstSeenAt = journey.startedAt;
      if (journey.endedAt > existing.lastSeenAt) existing.lastSeenAt = journey.endedAt;
      return;
    }
    places.set(id, {
      id, name: label, category, latitude: null, longitude: null, visitCount: 1, arrivals: Number(arrival), departures: Number(!arrival),
      firstSeenAt: journey.startedAt, lastSeenAt: journey.endedAt, timeOfDay: [], relatedJourneys: [related],
      soundtrack: journey.soundtrackPreview.map(track => ({ track: track.track, artist: track.artist, plays: 1, artworkUrl: track.artworkUrl })), foursquareSuggestion: null,
    });
  };
  for (const journey of journeys) { addPlace(journey.startingLocation, journey, false); addPlace(journey.endingLocation, journey, true); }
  const local = emptyVehicleIntelligence();
  const data = { ...local, places: [...places.values()].sort((a, b) => b.visitCount - a.visitCount || b.lastSeenAt.localeCompare(a.lastSeenAt)) };
  return applyVehiclePreferences(data, getPrivatePreference<VehicleIntelligencePreferences>(userId, 'vehicle.preferences') ?? data.preferences);
}

function applyVehiclePreferences(data: VehicleIntelligenceData, preferences: VehicleIntelligencePreferences): VehicleIntelligenceData {
  const overrides = new Map(preferences.placeOverrides.map(item => [item.placeId, item]));
  const mergedSources = new Set(preferences.placeMerges.map(item => item.sourcePlaceId));
  const favoriteKeys = new Set(preferences.favoriteChargingLocationKeys);
  const chargingSessions = data.chargingSessions.map(session => session.costSource === 'estimated'
    ? { ...session, cost: Math.round(session.energyAddedKwh * preferences.electricityRatePerKwh * 100) / 100 }
    : session);
  const recentCutoff = Date.now() - 30 * 86_400_000;
  const recent = chargingSessions.filter(session => Date.parse(session.startedAt) >= recentCutoff);
  return {
    ...data,
    preferences,
    chargingSessions,
    chargingSummary30Days: { ...data.chargingSummary30Days, cost: Math.round(recent.reduce((sum, session) => sum + session.cost, 0) * 100) / 100 },
    chargingLocations: data.chargingLocations.map(location => ({ ...location, isFavorite: favoriteKeys.has(location.locationKey) })),
    places: data.places.filter(place => !mergedSources.has(place.id)).map(place => {
      const override = overrides.get(place.id);
      return override ? { ...place, name: override.name, category: override.category } : place;
    }),
    routeComparisons: data.routeComparisons.map(route => ({ ...route, cost: Math.round(route.energyKwh * preferences.electricityRatePerKwh * 100) / 100 })),
  };
}

function vehicleIntelligenceFromTessie(snapshot: TessieSnapshot, base: VehicleIntelligenceData): VehicleIntelligenceData {
  const preferences = base.preferences;
  const chargingSessions: ChargingSessionSummary[] = snapshot.charges.map((charge): ChargingSessionSummary => {
    const recorded = charge.recordedCost != null && charge.recordedCost > 0;
    return {
      id: charge.id, locationKey: charge.locationKey, location: charge.location, vehicleName: charge.vehicleName || null, provider: 'tessie',
      startedAt: charge.startedAt, endedAt: charge.endedAt,
      durationMinutes: Math.max(0, Math.round((Date.parse(charge.endedAt) - Date.parse(charge.startedAt)) / 60_000)),
      isSupercharger: charge.isSupercharger, energyAddedKwh: charge.energyAddedKwh, energyUsedKwh: charge.energyUsedKwh, milesAdded: charge.milesAdded,
      startingBatteryPercent: charge.startingBatteryPercent, endingBatteryPercent: charge.endingBatteryPercent,
      batteryGainedPercent: charge.startingBatteryPercent != null && charge.endingBatteryPercent != null ? Math.max(0, charge.endingBatteryPercent - charge.startingBatteryPercent) : null,
      cost: recorded ? charge.recordedCost! : Math.round(charge.energyAddedKwh * preferences.electricityRatePerKwh * 100) / 100,
      costSource: recorded ? 'recorded' : 'estimated',
    };
  }).sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  const locations = new Map<string, VehicleIntelligenceData['chargingLocations'][number]>();
  for (const session of chargingSessions) {
    const current = locations.get(session.locationKey);
    if (current) {
      current.sessions += 1; current.energyAddedKwh += session.energyAddedKwh; current.cost += session.cost;
      if (session.startedAt > current.lastChargedAt) current.lastChargedAt = session.startedAt;
    } else locations.set(session.locationKey, {
      locationKey: session.locationKey, name: session.location, sessions: 1, energyAddedKwh: session.energyAddedKwh, cost: session.cost,
      lastChargedAt: session.startedAt, isFavorite: preferences.favoriteChargingLocationKeys.includes(session.locationKey),
    });
  }
  const routeGroups = new Map<string, { startLabel: string; endLabel: string; miles: number; energy: number; efficiencies: number[]; trips: number }>();
  for (const drive of snapshot.drives) {
    if (drive.miles <= 0 || drive.energyUsedKwh < 0) continue;
    const key = `${drive.startingLocation.trim().toLocaleLowerCase()}\u001f${drive.endingLocation.trim().toLocaleLowerCase()}`;
    const current = routeGroups.get(key) ?? { startLabel: drive.startingLocation, endLabel: drive.endingLocation, miles: 0, energy: 0, efficiencies: [], trips: 0 };
    current.trips += 1; current.miles += drive.miles; current.energy += drive.energyUsedKwh;
    if (drive.energyUsedKwh > 0) current.efficiencies.push(drive.energyUsedKwh * 1_000 / drive.miles);
    routeGroups.set(key, current);
  }
  const routeComparisons = [...routeGroups.values()].map(route => {
    const efficiencies = route.efficiencies.length ? route.efficiencies : [0];
    return {
      startPlaceId: localPlaceId(route.startLabel), endPlaceId: localPlaceId(route.endLabel), startLabel: route.startLabel, endLabel: route.endLabel,
      trips: route.trips, miles: route.miles, energyKwh: route.energy, cost: Math.round(route.energy * preferences.electricityRatePerKwh * 100) / 100,
      averageWhPerMile: route.miles ? route.energy * 1_000 / route.miles : 0, bestWhPerMile: Math.min(...efficiencies), worstWhPerMile: Math.max(...efficiencies),
    };
  }).sort((left, right) => right.trips - left.trips || right.miles - left.miles);
  const recentCutoff = Date.now() - 30 * 86_400_000;
  const recent = chargingSessions.filter(session => Date.parse(session.startedAt) >= recentCutoff);
  return applyVehiclePreferences({
    ...base, generatedAt: snapshot.generatedAt, vehicles: snapshot.vehicles, chargingSessions,
    chargingSummary30Days: {
      sessions: recent.length, energyAddedKwh: recent.reduce((sum, item) => sum + item.energyAddedKwh, 0),
      batteryGainedPercent: recent.reduce((sum, item) => sum + (item.batteryGainedPercent ?? 0), 0),
      durationMinutes: recent.reduce((sum, item) => sum + item.durationMinutes, 0), cost: recent.reduce((sum, item) => sum + item.cost, 0),
    },
    chargingLocations: [...locations.values()].sort((left, right) => right.sessions - left.sessions || right.lastChargedAt.localeCompare(left.lastChargedAt)),
    routeComparisons,
  }, preferences);
}

async function refreshVehicleIntelligenceFromTessie(userId: string) {
  const cacheKey = vehicleIntelligenceCacheKey(userId);
  const cached = readAppCache<VehicleIntelligenceCache>(cacheKey);
  const data = vehicleIntelligenceFromTessie(await syncTessieDirect(), cached?.data ?? localVehicleIntelligence(userId));
  writeAppCache(cacheKey, { data, preferencesDirty: false } satisfies VehicleIntelligenceCache);
  return data;
}

function weeklyCutoff() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);
  return cutoff.getTime();
}

function journeysInsideWeeklyWindow(journeys: JourneySummary[]) {
  const cutoff = weeklyCutoff();
  return journeys.filter(journey => {
    const startedAt = Date.parse(journey.startedAt);
    return Number.isFinite(startedAt) && startedAt >= cutoff;
  });
}

function localRecorderHealth(_ownerBackupConnected: boolean): LocalRecorderHealth {
  const session = activeSession();
  const summary = session ? getSessionSummary(session.id) : null;
  return {
    connected: true,
    state: !summary || summary.status === 'completed' ? 'ready' : summary.status,
    queuedPoints: totalQueuedPointCount(),
    queuedMusic: totalQueuedMusicObservationCount(),
    capturedPoints: summary?.pointCount ?? 0,
  };
}

async function request<T>(connection: Connection, path: string, init?: RequestInit, timeoutMs = 12_000): Promise<T> {
  return requestJourneyDeckJson<T>(connection, path, init, { timeoutMs, timeoutMessage: 'JourneyDeck took too long to respond.' });
}

function localDashboardWithCachedContext(connected: boolean): AppDashboard {
  const local = localAtlasClient.dashboard(getCurrentUser().id);
  const cached = readAppCache<DashboardData>(DASHBOARD_CACHE_KEY);
  const privatePreferences = getPrivatePreference<ProviderPreferences>(getCurrentUser().id, 'provider.preferences');
  const cachedWeekly = journeysInsideWeeklyWindow(readAppCache<JourneySummary[]>(WEEKLY_JOURNEYS_CACHE_KEY) ?? []);
  if (local.summary.allTime.journeyCount > 0) {
    return {
      ...local,
      providerPreferences: privatePreferences ?? cached?.providerPreferences ?? local.providerPreferences,
      recorder: localRecorderHealth(connected),
    };
  }
  return { ...(cached ?? emptyDashboard()), providerPreferences: privatePreferences ?? cached?.providerPreferences ?? null,
    recorder: localRecorderHealth(connected), weeklyJourneys: cachedWeekly };
}

async function loadWeeklyJourneys(connection: Connection): Promise<JourneySummary[]> {
  const journeys: JourneySummary[] = [];
  let cursor: string | undefined;
  const cutoff = weeklyCutoff();

  // A busy week may contain more journeys than the dashboard preview. Follow the
  // existing history cursor until the first journey outside the visible week.
  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('cursor', cursor);
    const page = await request<{ items: JourneySummary[]; nextCursor: string | null }>(connection, `/api/recorder/journeys?${query.toString()}`);
    journeys.push(...page.items);
    const oldest = page.items.at(-1);
    if (!page.nextCursor || !oldest || Date.parse(oldest.startedAt) < cutoff) break;
    cursor = page.nextCursor;
  }

  const weekly = journeysInsideWeeklyWindow(journeys);
  writeAppCache(WEEKLY_JOURNEYS_CACHE_KEY, weekly);
  return weekly;
}

export const appDataClient = {
  async dashboard(_refreshRemote = false): Promise<AppDashboard> {
    const connection = await loadConnection();
    const dashboard = localDashboardWithCachedContext(Boolean(connection));
    primeSavedPlaceAliases([...(dashboard.latestJourney ? [dashboard.latestJourney] : []), ...dashboard.recentJourneys, ...dashboard.weeklyJourneys]);
    return { ...dashboard, latestJourney: dashboard.latestJourney ? applyLocalPlaceAliases(dashboard.latestJourney) : null,
      recentJourneys: applyLocalPlaceAliasesToJourneys(dashboard.recentJourneys), weeklyJourneys: applyLocalPlaceAliasesToJourneys(dashboard.weeklyJourneys) };
  },

  async localDashboard(): Promise<AppDashboard> {
    const connection = await loadConnection();
    const dashboard = localDashboardWithCachedContext(Boolean(connection));
    primeSavedPlaceAliases([...(dashboard.latestJourney ? [dashboard.latestJourney] : []), ...dashboard.recentJourneys, ...dashboard.weeklyJourneys]);
    return {
      ...dashboard,
      latestJourney: dashboard.latestJourney ? applyLocalPlaceAliases(dashboard.latestJourney) : null,
      recentJourneys: applyLocalPlaceAliasesToJourneys(dashboard.recentJourneys),
      weeklyJourneys: applyLocalPlaceAliasesToJourneys(dashboard.weeklyJourneys),
    };
  },

  async journeys(limit = 25, cursor?: string, _refreshRemote = false): Promise<{ items: JourneySummary[]; nextCursor: string | null }> {
    const local = localAtlasClient.journeys(getCurrentUser().id, limit, cursor);
    const cached = !cursor ? readAppCache<{ items: JourneySummary[]; nextCursor: string | null }>(JOURNEYS_CACHE_KEY) : null;
    const page = local.items.length || cached ? mergeLocalJourneyPage(local, cached, limit) : local;
    return { ...page, items: applyLocalPlaceAliasesToJourneys(page.items) };
  },

  async journey(id: string, _refreshRemote = false): Promise<JourneyDetail> {
    const local = localAtlasClient.journey(getCurrentUser().id, id);
    const cached = readAppCache<JourneyDetail>(journeyCacheKey(id));
    if (local && cached) return applyLocalPlaceAliases(mergeJourneyWithLocalDetail(cached, local));
    if (local) return applyLocalPlaceAliases(local);
    if (cached) return applyLocalPlaceAliases(cached);
    throw new Error('This journey is not in this profile’s on-device archive.');
  },

  localOrCachedJourney(id: string): JourneyDetail | null {
    const local = localAtlasClient.journey(getCurrentUser().id, id);
    const cached = readAppCache<JourneyDetail>(journeyCacheKey(id));
    const detail = local && cached ? mergeJourneyWithLocalDetail(cached, local) : (local ?? cached);
    return detail ? applyLocalPlaceAliases(detail) : null;
  },

  async vehicleIntelligence(refreshRemote = false): Promise<VehicleIntelligenceData> {
    const userId = getCurrentUser().id, cacheKey = vehicleIntelligenceCacheKey(userId);
    if (!TESSIE_INTEGRATION_ENABLED) return localVehicleIntelligence(userId);
    const cached = readAppCache<VehicleIntelligenceCache>(cacheKey);
    if (!refreshRemote) return cached?.data ?? localVehicleIntelligence(userId);
    try {
      return await refreshVehicleIntelligenceFromTessie(userId);
    } catch {
      if (cached) return cached.data;
      const local = localVehicleIntelligence(userId);
      writeAppCache(cacheKey, { data: local, preferencesDirty: false } satisfies VehicleIntelligenceCache);
      return local;
    }
  },

  async syncVehicleIntelligence(): Promise<VehicleIntelligenceData> {
    if (!TESSIE_INTEGRATION_ENABLED) return localVehicleIntelligence(getCurrentUser().id);
    return refreshVehicleIntelligenceFromTessie(getCurrentUser().id);
  },

  async saveVehicleIntelligencePreferences(preferences: VehicleIntelligencePreferences): Promise<VehicleIntelligenceData> {
    const userId = getCurrentUser().id, cacheKey = vehicleIntelligenceCacheKey(userId);
    const cached = readAppCache<VehicleIntelligenceCache>(cacheKey);
    const local = applyVehiclePreferences(cached?.data ?? emptyVehicleIntelligence(), preferences);
    writeAppCache(cacheKey, { data: local, preferencesDirty: false } satisfies VehicleIntelligenceCache);
    upsertPrivatePreference(userId, 'vehicle.preferences', preferences);
    return local;
  },

  async savePlaceAlias(location: string, label: string, coordinate?: { latitude: number; longitude: number } | null): Promise<{ location: string; label: string; removed: boolean }> {
    const normalized = label.trim();
    const userId = getCurrentUser().id;
    upsertPrivatePreference(userId, localPlaceAliasKey(location), normalized);
    if (normalized) primeCoordinatePlaceAlias(userId, location, normalized, coordinate, true);
    else {
      deletePlace(userId, savedPlaceAliasId(userId, location));
      const resolved = coordinate ?? coordinateFromPlaceAliasIdentity(location);
      const nearby = resolved ? findNamedPlace(userId, resolved.latitude, resolved.longitude) : null;
      if (nearby?.kind === 'custom') deletePlace(userId, nearby.id);
    }
    notifyLocalArchiveChanged();
    return { location, label: normalized, removed: !normalized };
  },

  async memories(_refreshRemote = false): Promise<MemoriesCatalog> {
    const local = localAtlasClient.memories(getCurrentUser().id);
    const cached = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY);
    return local.memories.length || local.collections.length ? mergeMemoriesCatalog(cached ?? local, local, cached) : (cached ?? local);
  },

  async musicDashboard(refreshRemote = false, details: JourneyDetail[] = []): Promise<MusicDashboardData> {
    const userId = getCurrentUser().id;
    if (refreshRemote) await refreshAllAppleMusicArtwork();
    const local = localAtlasClient.musicDashboard(userId);
    const cities = await loadMusicCitySummary(userId, refreshRemote, details);
    const data = { ...local, cities };
    writeAppCache(MUSIC_DASHBOARD_CACHE_KEY, data);
    return data;
  },

  async saveCollection(input: { id?: string | null; name: string; description?: string | null; driveIds: string[] }): Promise<JourneyCollection> {
    const userId = getCurrentUser().id;
    const id = input.id ?? `collection_${Crypto.randomUUID()}`;
    const existing = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY)?.collections.find(item => item.id === id);
    const localExisting = getCollectionIncludingDeleted(userId, id);
    const timestamp = new Date().toISOString();
    const local: JourneyCollection = { id, name: input.name.trim(), description: input.description?.trim() ?? '', driveIds: [...new Set(input.driveIds)], createdAtUtc: existing?.createdAtUtc ?? localExisting?.createdAt ?? timestamp, updatedAtUtc: timestamp, photos: existing?.photos ?? [] };
    upsertCollection({ id, userId, name: local.name, description: local.description, journeyIds: JSON.stringify(local.driveIds) });
    cacheCollection(local);
    return local;
  },

  async saveMemory(input: { id?: string | null; name: string; notes?: string | null; artworkKey?: string | null; coverPhotoId?: string | null; collectionIds: string[] }): Promise<JourneyMemory> {
    const userId = getCurrentUser().id;
    const id = input.id ?? `memory_${Crypto.randomUUID()}`;
    const existing = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY)?.memories.find(item => item.id === id);
    const localExisting = getMemoryIncludingDeleted(userId, id);
    const timestamp = new Date().toISOString();
    const local: JourneyMemory = { id, name: input.name.trim(), notes: input.notes?.trim() ?? '', artworkKey: input.artworkKey ?? 'road-trips', coverPhotoId: input.coverPhotoId ?? null, photos: existing?.photos ?? [], collectionIds: [...new Set(input.collectionIds)], createdAtUtc: existing?.createdAtUtc ?? localExisting?.createdAt ?? timestamp, updatedAtUtc: timestamp };
    upsertMemory({ id, userId, name: local.name, notes: local.notes, artworkKey: local.artworkKey, coverPhotoId: local.coverPhotoId, coverPhotoLocalPath: null, collectionIds: JSON.stringify(local.collectionIds) });
    cacheMemory(local);
    return local;
  },

  async uploadCollectionPhoto(collectionId: string, input: { fileName: string; contentType: JourneyPhoto['contentType']; dataBase64: string }): Promise<JourneyPhoto> {
    return savePrivatePhoto('collection', collectionId, input);
  },

  async uploadMemoryPhoto(memoryId: string, input: { fileName: string; contentType: JourneyPhoto['contentType']; dataBase64: string }): Promise<JourneyPhoto> {
    return savePrivatePhoto('memory', memoryId, input);
  },

  async photoDataUrl(photo: JourneyPhoto): Promise<string> {
    const local = getPhotoIncludingDeleted(getCurrentUser().id, photo.id);
    if (local && !local.deletedAt) return local.localUri;
    const cached = readAppCache<string>(photoCacheKey(photo.id));
    if (cached) return cached;
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck to load this photo.');
    const loaded = await request<JourneyPhoto & { dataBase64: string }>(connection, `/api/recorder/photos/${encodeURIComponent(photo.id)}`);
    const dataUrl = `data:${loaded.contentType};base64,${loaded.dataBase64}`;
    writeAppCache(photoCacheKey(photo.id), dataUrl);
    return dataUrl;
  },

  async removePhoto(photoId: string): Promise<void> {
    const userId = getCurrentUser().id;
    if (getPhotoIncludingDeleted(userId, photoId)) {
      softDeletePhoto(userId, photoId);
      removeCachedPhoto(photoId);
      return;
    }
    const connection = await loadConnection();
    if (!connection) throw new Error('That legacy server photo is not available while JourneyDeck is offline.');
    await request(connection, `/api/recorder/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' });
    removeCachedPhoto(photoId);
  },

  async deleteCollection(collectionId: string): Promise<void> {
    const userId = getCurrentUser().id;
    softDeleteCollection(userId, collectionId);
    const cached = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY) ?? { memories: [], collections: [] };
    writeAppCache(MEMORIES_CACHE_KEY, { ...cached, collections: cached.collections.filter(item => item.id !== collectionId), deletedCollectionIds: [...new Set([...(cached.deletedCollectionIds ?? []), collectionId])] });
  },

  async deleteMemory(memoryId: string): Promise<void> {
    const userId = getCurrentUser().id;
    softDeleteMemory(userId, memoryId);
    const cached = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY) ?? { memories: [], collections: [] };
    writeAppCache(MEMORIES_CACHE_KEY, { ...cached, memories: cached.memories.filter(item => item.id !== memoryId), deletedMemoryIds: [...new Set([...(cached.deletedMemoryIds ?? []), memoryId])] });
  },

  async providerPreferences(): Promise<ProviderPreferences | null> {
    return getPrivatePreference<ProviderPreferences>(getCurrentUser().id, 'provider.preferences');
  },

  async updateProviderPreferences(input: Pick<ProviderPreferences, 'musicProvider' | 'onboardingCompleted' | 'connections'>): Promise<ProviderPreferences | null> {
    const userId = getCurrentUser().id;
    const local: ProviderPreferences = { deviceId: 'this-iphone', ...input, updatedAt: new Date().toISOString() };
    upsertPrivatePreference(userId, 'provider.preferences', local);
    return local;
  },

  /** Explicit owner-only bridge for importing the retained legacy JourneyDeck archive. */
  async importLegacyOwnerArchive(): Promise<{ journeys: number; memories: number; collections: number }> {
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect the optional owner backup before importing legacy data.');
    const [dashboard, weeklyJourneys, journeyPage, remoteMemories] = await Promise.all([
      request<DashboardData>(connection, `/api/recorder/dashboard?deviceId=${encodeURIComponent(connection.deviceId)}`),
      loadWeeklyJourneys(connection),
      request<{ items: JourneySummary[]; nextCursor: string | null }>(connection, '/api/recorder/journeys?limit=50'),
      request<MemoriesCatalog>(connection, '/api/recorder/memories'),
    ]);
    writeAppCache(DASHBOARD_CACHE_KEY, dashboard);
    writeAppCache(WEEKLY_JOURNEYS_CACHE_KEY, weeklyJourneys);
    writeAppCache(JOURNEYS_CACHE_KEY, journeyPage);
    writeAppCache(MEMORIES_CACHE_KEY, remoteMemories);
    return { journeys: journeyPage.items.length, memories: remoteMemories.memories.length, collections: remoteMemories.collections.length };
  },

  async connectionCapabilities(): Promise<ConnectionCapabilities> {
    const edge = Constants.expoConfig?.extra?.edge as { url?: unknown } | undefined;
    const lastFmConfigured = typeof edge?.url === 'string' && /^https:\/\//.test(edge.url);
    return { lastFmConfigured, tessieConfigured: TESSIE_INTEGRATION_ENABLED && await tessieDirectStatus() === 'connected' };
  },
};

// =============================================================================
// localAtlasClient — Phase 1.4: On-Device Local-First Data Client
//
// Reads ALL data from the on-device SQLite master store (local-store.ts) and
// the on-device Atlas analytics engine (local-atlas.ts). Zero network calls.
// Works 100% offline. Used as the primary data source when:
//   1. The user has no server connection configured (pure local-first mode).
//   2. The app is offline and the server is unreachable.
//   3. The client requests a fast, synchronous dashboard (no network latency).
//
// The server-side appDataClient above remains available for hybrid mode where
// the local store is backed up by server sync.
// =============================================================================

import {
  initializeLocalStore,
  ensureLocalUser,
  listJourneys,
  getJourney,
  getJourneyByLegacyDriveId,
  getJourneyRoute,
  getJourneyRouteSamples,
  listMusicEntries,
  listMusicEntriesForJourney,
  listCollections,
  listMemories,
  listCollectionsIncludingDeleted,
  listMemoriesIncludingDeleted,
  listPhotos,
  listPhotosIncludingDeleted,
  getPhotoIncludingDeleted,
  getCollectionIncludingDeleted,
  getMemoryIncludingDeleted,
  upsertCollection,
  upsertMemory,
  upsertPhoto,
  softDeleteCollection,
  softDeleteMemory,
  softDeletePhoto,
  upsertPlace,
  findCachedPlace,
  findNamedPlace,
  getPlace,
  deletePlace,
  getPrivatePreference,
  upsertPrivatePreference,
  readAtlasSnapshot,
  localStoreDiagnostics,
} from './local-store';
import type { LocalUserId } from './local-store';
import {
  rebuildAtlasSnapshot,
  computeAllTime,
  computeLast7Days,
  computeWeeklyTour,
  computeDrivingStreak,
  computeMusicMetrics,
  computeTopArtists,
  computeMoodBreakdown,
} from './local-atlas';
import { loadMusicCitySummary } from './music-city-summary';

/** How stale a cached Atlas snapshot can be before we rebuild it (5 minutes). */
const ATLAS_STALE_MS = 5 * 60_000;

function localJourneyToSummary(j: import('./local-store').LocalJourney): JourneySummary {
  const startingLocationKey = j.startPlaceId ?? coordinatePlaceAliasIdentity(j.startLat, j.startLng) ?? `journey:${j.id}:start`;
  const endingLocationKey = j.endPlaceId ?? coordinatePlaceAliasIdentity(j.endLat, j.endLng) ?? `journey:${j.id}:end`;
  const startingPlace = j.startPlaceId ? getPlace(j.userId, j.startPlaceId) : null;
  const endingPlace = j.endPlaceId ? getPlace(j.userId, j.endPlaceId) : null;
  return {
    id: j.id,
    legacyDriveId: j.legacyDriveId,
    provider: j.provider,
    vehicleName: j.vehicleName,
    startedAt: j.startedAt,
    endedAt: j.endedAt,
    durationMinutes: j.durationMinutes,
    miles: j.miles,
    startingLocation: startingPlace?.label ?? null,
    endingLocation: endingPlace?.label ?? null,
    rawStartingLocation: startingPlace?.label ?? 'Recorded start',
    rawEndingLocation: endingPlace?.label ?? 'Recorded destination',
    startingLocationKey,
    endingLocationKey,
    averageSpeedMph: j.averageSpeedMph,
    maxSpeedMph: j.maxSpeedMph,
    songCount: j.songCount,
    soundtrackPreview: [],
  };
}

export const localAtlasClient = {
  /**
   * Ensures a local user record exists (creates one if needed).
   * Pass an Apple subject ID once Sign in with Apple is implemented;
   * until then, pass undefined to use or create an anonymous device user.
   */
  ensureUser(appleSubject?: string): import('./local-store').LocalUser {
    initializeLocalStore();
    return ensureLocalUser({ appleSubject });
  },

  /**
   * Returns a fully local AppDashboard built from on-device SQLite.
   * Never makes a network request. Safe to call while offline.
   */
  dashboard(userId: LocalUserId): AppDashboard {
    initializeLocalStore();

    // Rebuild Atlas snapshot if stale or missing
    // rebuildAtlasSnapshot always writes + returns a valid snapshot, so the
    // result is never null -- use ?? to give TS the non-null guarantee.
    const freshSnapshot = readAtlasSnapshot(userId) ?? rebuildAtlasSnapshot(userId);
    const isStale = (Date.now() - Date.parse(freshSnapshot.generatedAt)) > ATLAS_STALE_MS;
    const snapshot = isStale ? rebuildAtlasSnapshot(userId) : freshSnapshot;

    const { items: recentJourneys } = listJourneys(userId, { limit: 10 });
    const latestJourney = recentJourneys[0] ?? null;
    const weeklyJourneys = recentJourneys.filter(j => {
      const t = Date.parse(j.startedAt);
      const cutoff = Date.now() - 7 * 24 * 60 * 60_000;
      return Number.isFinite(t) && t >= cutoff;
    });

    const dashboard: DashboardData = {
      generatedAt: snapshot.generatedAt,
      summary: {
        allTime: {
          journeyCount: snapshot.allTimeJourneyCount,
          miles: snapshot.allTimeMiles,
          minutes: snapshot.allTimeMinutes,
        },
        last7Days: {
          journeyCount: snapshot.last7DaysJourneyCount,
          miles: snapshot.last7DaysMiles,
          minutes: snapshot.last7DaysMinutes,
          songCount: snapshot.last7DaysSongCount,
        },
      },
      latestJourney: latestJourney ? localJourneyToSummary(latestJourney) : null,
      recentJourneys: recentJourneys.map(localJourneyToSummary),
      providerPreferences: null,
    };

    return {
      ...dashboard,
      recorder: localRecorderHealth(false),
      weeklyJourneys: weeklyJourneys.map(localJourneyToSummary),
    };
  },

  /**
   * Returns a paginated list of journeys from the local store.
   */
  journeys(userId: LocalUserId, limit = 25, cursor?: string): { items: JourneySummary[]; nextCursor: string | null } {
    initializeLocalStore();
    const result = listJourneys(userId, { limit, cursor });
    return {
      items: result.items.map(localJourneyToSummary),
      nextCursor: result.nextCursor,
    };
  },

  /**
   * Returns a single journey detail from the local store.
   */
  journey(userId: LocalUserId, journeyId: string): JourneyDetail | null {
    initializeLocalStore();
    const j = getJourney(userId, journeyId) ?? getJourneyByLegacyDriveId(userId, journeyId);
    if (!j) return null;
    const route = getJourneyRoute(userId, j.id);
    const samples = getJourneyRouteSamples(userId, j.id);
    const soundtrack = listMusicEntriesForJourney(userId, j.id).map(entry => ({
      playedAt: entry.playedAt,
      track: entry.track,
      artist: entry.artist,
      album: entry.album ?? null,
      durationMs: entry.durationMs ?? null,
      artworkUrl: entry.artworkUrl ?? null,
      externalUrl: entry.externalUrl ?? null,
      source: entry.source,
      confidence: entry.confidence ?? null,
      mapCoordinate: coordinateAtRecordedTime(samples, entry.playedAt),
    }));
    return {
      ...localJourneyToSummary(j),
      songCount: soundtrack.length,
      startingBatteryPercent: null,
      endingBatteryPercent: null,
      energyUsedKwh: null,
      tessieTag: null,
      driverProfile: null,
      soundtrack,
      route: route ? { ...route, points: samples } : null,
    };
  },

  /**
   * Returns the local MusicDashboardData built entirely from on-device SQLite.
   * All metrics are pre-computed by the Atlas engine.
   */
  musicDashboard(userId: LocalUserId): MusicDashboardData {
    initializeLocalStore();

    // Use fresh Atlas computation for music dashboard
    const allTime  = computeAllTime(userId);
    const last7    = computeLast7Days(userId);
    const tour     = computeWeeklyTour(userId);
    const streak   = computeDrivingStreak(userId);
    const music    = computeMusicMetrics(userId);
    const artists  = computeTopArtists(userId, 10);
    const mood     = computeMoodBreakdown(userId);
    const recent   = listMusicEntries(userId, 20);

    const recentSelections: SoundtrackTrack[] = recent.map(e => ({
      playedAt: e.playedAt,
      track: e.track,
      artist: e.artist,
      album: e.album ?? null,
      durationMs: e.durationMs ?? null,
      artworkUrl: e.artworkUrl ?? null,
      externalUrl: e.externalUrl ?? null,
      source: e.source,
      confidence: e.confidence ?? null,
    }));

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        milesWithMusic: last7.miles,
        listeningHours: music.listeningHours,
        songsOnRoad: music.songsOnRoad,
        currentStreak: streak,
      },
      recentSelections,
      topArtists: artists,
      tour: { miles: tour.miles, changePercent: tour.changePercent },
      mood,
      cities: [],        // enriched from privacy-reduced coordinates on deliberate refresh
      daily: [],         // requires historical daily aggregation — Phase 1.5
      week: { total: last7.songCount, changePercent: null },
    };
  },

  /**
   * Returns the local MemoriesCatalog (collections + memories) from on-device SQLite.
   */
  memories(userId: LocalUserId): MemoriesCatalog {
    initializeLocalStore();
    const localPhotos = listPhotos(userId);
    const toPhoto = (photo: import('./local-store').LocalPhoto): JourneyPhoto => ({
      id: photo.id, fileName: photo.fileName, contentType: photo.contentType, byteLength: photo.byteLength,
      createdAtUtc: photo.createdAt, source: photo.source, collectionId: photo.collectionId, memoryId: photo.memoryId,
    });
    const collections = listCollections(userId).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      driveIds: JSON.parse(c.journeyIds) as string[],
      createdAtUtc: c.createdAt,
      updatedAtUtc: c.updatedAt,
      photos: localPhotos.filter(photo => photo.collectionId === c.id).map(toPhoto),
    } satisfies JourneyCollection));

    const memories = listMemories(userId).map(m => {
      const collectionIds = JSON.parse(m.collectionIds) as string[];
      const photos = localPhotos.filter(photo => photo.memoryId === m.id || (photo.collectionId && collectionIds.includes(photo.collectionId))).map(toPhoto)
        .filter((photo, index, all) => all.findIndex(candidate => candidate.id === photo.id) === index);
      return {
        id: m.id, name: m.name, notes: m.notes ?? '', artworkKey: m.artworkKey ?? '',
        coverPhotoId: m.coverPhotoId && photos.some(photo => photo.id === m.coverPhotoId) ? m.coverPhotoId : null,
        photos, collectionIds, createdAtUtc: m.createdAt, updatedAtUtc: m.updatedAt,
      } satisfies JourneyMemory;
    });

    return {
      memories, collections,
      deletedCollectionIds: listCollectionsIncludingDeleted(userId).filter(item => item.deletedAt).map(item => item.id),
      deletedMemoryIds: listMemoriesIncludingDeleted(userId).filter(item => item.deletedAt).map(item => item.id),
      deletedPhotoIds: listPhotosIncludingDeleted(userId).filter(item => item.deletedAt).map(item => item.id),
    };
  },

  /**
   * Diagnostic snapshot for debugging / settings screen.
   */
  diagnostics(userId: LocalUserId) {
    return localStoreDiagnostics(userId);
  },

  /**
   * Force-rebuilds the Atlas snapshot (call after ingesting new journeys or music).
   */
  rebuildAtlas(userId: LocalUserId) {
    return rebuildAtlasSnapshot(userId);
  },
};
