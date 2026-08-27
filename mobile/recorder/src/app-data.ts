import type { Connection } from './credentials';
import * as Crypto from 'expo-crypto';
import { loadConnection } from './credentials';
import { activeSession, getSessionSummary, readAppCache, totalQueuedMusicObservationCount, writeAppCache } from './storage';
import type { ApiMusicProvider } from './music-preferences';
import { getCurrentUser } from './auth';
import { coordinateAtRecordedTime, type TimedRouteSample } from './route-moments';

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
    soundtrack,
    songCount: Math.max(remote.songCount, soundtrack.length),
    route: localPointCount >= remotePointCount ? local.route : remote.route,
  };
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

export type MemoriesCatalog = { memories: JourneyMemory[]; collections: JourneyCollection[] };

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
  const collections = new Map(remote.collections.map(item => [item.id, item]));
  local.collections.forEach(item => {
    const remoteItem = collections.get(item.id);
    const winner = !remoteItem || Date.parse(item.updatedAtUtc) >= Date.parse(remoteItem.updatedAtUtc) ? item : remoteItem;
    collections.set(item.id, { ...winner, photos: cachedCollections.get(item.id)?.photos ?? remoteItem?.photos ?? [] });
  });
  const memories = new Map(remote.memories.map(item => [item.id, item]));
  local.memories.forEach(item => {
    const cachedItem = cachedMemories.get(item.id);
    const remoteItem = memories.get(item.id);
    const winner = !remoteItem || Date.parse(item.updatedAtUtc) >= Date.parse(remoteItem.updatedAtUtc) ? item : remoteItem;
    memories.set(item.id, { ...winner, coverPhotoId: winner.coverPhotoId ?? cachedItem?.coverPhotoId ?? remoteItem?.coverPhotoId ?? null, photos: cachedItem?.photos ?? remoteItem?.photos ?? [] });
  });
  return {
    collections: [...collections.values()].sort((a, b) => Date.parse(b.updatedAtUtc) - Date.parse(a.updatedAtUtc)),
    memories: [...memories.values()].sort((a, b) => Date.parse(b.updatedAtUtc) - Date.parse(a.updatedAtUtc)),
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

type VehicleIntelligenceCache = { data: VehicleIntelligenceData; preferencesDirty: boolean };

function emptyVehicleIntelligence(): VehicleIntelligenceData {
  return {
    generatedAt: new Date().toISOString(),
    preferences: { electricityRatePerKwh: 0.14, favoriteChargingLocationKeys: [], placeOverrides: [], placeMerges: [] },
    chargingSummary30Days: { sessions: 0, energyAddedKwh: 0, batteryGainedPercent: 0, durationMinutes: 0, cost: 0 },
    chargingSessions: [], chargingLocations: [], places: [], duplicateCandidates: [], routeComparisons: [],
  };
}

function localVehicleIntelligence(userId: string): VehicleIntelligenceData {
  const localPage = localAtlasClient.journeys(userId, 50);
  const journeys = localPage.items.length ? localPage.items : (readAppCache<{ items: JourneySummary[] }>(JOURNEYS_CACHE_KEY)?.items ?? []);
  const places = new Map<string, SavedPlaceIntelligence>();
  const placeId = (label: string) => {
    let hash = 2166136261;
    for (const character of label.trim().toLocaleLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `place_local_${(hash >>> 0).toString(16).padStart(8, '0')}`;
  };
  const addPlace = (labelValue: string | null, journey: JourneySummary, arrival: boolean) => {
    const label = labelValue?.trim(); if (!label) return;
    const id = placeId(label), existing = places.get(id);
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
  return { ...local, places: [...places.values()].sort((a, b) => b.visitCount - a.visitCount || b.lastSeenAt.localeCompare(a.lastSeenAt)) };
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

function localRecorderHealth(connected: boolean): LocalRecorderHealth {
  const session = activeSession();
  const summary = session ? getSessionSummary(session.id) : null;
  return {
    connected,
    state: !summary || summary.status === 'completed' ? 'ready' : summary.status,
    queuedPoints: summary?.queuedCount ?? 0,
    queuedMusic: totalQueuedMusicObservationCount(),
    capturedPoints: summary?.pointCount ?? 0,
  };
}

async function request<T>(connection: Connection, path: string, init?: RequestInit, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${connection.serverUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${connection.token}`,
        'content-type': 'application/json',
        ...init?.headers,
      },
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || `JourneyDeck returned ${response.status}.`);
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('JourneyDeck took too long to respond.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
  async dashboard(): Promise<AppDashboard> {
    const connection = await loadConnection();
    const cachedWeekly = readAppCache<JourneySummary[]>(WEEKLY_JOURNEYS_CACHE_KEY) ?? [];
    if (!connection) {
      const local = localAtlasClient.dashboard(getCurrentUser().id);
      return local.summary.allTime.journeyCount > 0
        ? local
        : { ...(readAppCache<DashboardData>(DASHBOARD_CACHE_KEY) ?? emptyDashboard()), recorder: localRecorderHealth(false), weeklyJourneys: journeysInsideWeeklyWindow(cachedWeekly) };
    }
    const [dashboard, weeklyJourneys] = await Promise.all([
      request<DashboardData>(connection, `/api/recorder/dashboard?deviceId=${encodeURIComponent(connection.deviceId)}`),
      loadWeeklyJourneys(connection).catch(() => journeysInsideWeeklyWindow(cachedWeekly)),
    ]);
    writeAppCache(DASHBOARD_CACHE_KEY, dashboard);
    return { ...dashboard, recorder: localRecorderHealth(true), weeklyJourneys };
  },

  async localDashboard(): Promise<AppDashboard> {
    const connection = await loadConnection();
    const weeklyJourneys = journeysInsideWeeklyWindow(readAppCache<JourneySummary[]>(WEEKLY_JOURNEYS_CACHE_KEY) ?? []);
    return { ...(readAppCache<DashboardData>(DASHBOARD_CACHE_KEY) ?? emptyDashboard()), recorder: localRecorderHealth(Boolean(connection)), weeklyJourneys };
  },

  async journeys(limit = 25, cursor?: string): Promise<{ items: JourneySummary[]; nextCursor: string | null }> {
    const connection = await loadConnection();
    if (!connection) {
      const local = localAtlasClient.journeys(getCurrentUser().id, limit, cursor);
      if (local.items.length || cursor) return local;
      return readAppCache<{ items: JourneySummary[]; nextCursor: string | null }>(JOURNEYS_CACHE_KEY) ?? local;
    }
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set('cursor', cursor);
    try {
      const page = await request<{ items: JourneySummary[]; nextCursor: string | null }>(connection, `/api/recorder/journeys?${query.toString()}`);
      if (!cursor) writeAppCache(JOURNEYS_CACHE_KEY, page);
      return page;
    } catch (error) {
      const cached = !cursor ? readAppCache<{ items: JourneySummary[]; nextCursor: string | null }>(JOURNEYS_CACHE_KEY) : null;
      if (cached) return cached;
      throw error;
    }
  },

  async journey(id: string): Promise<JourneyDetail> {
    const connection = await loadConnection();
    if (!connection) {
      const local = localAtlasClient.journey(getCurrentUser().id, id);
      if (local) return local;
      const cached = readAppCache<JourneyDetail>(journeyCacheKey(id));
      if (cached) return cached;
      throw new Error('Connect this iPhone to JourneyDeck to load journey details.');
    }
    try {
      const detail = await request<JourneyDetail>(connection, `/api/recorder/journeys/${encodeURIComponent(id)}`);
      const merged = mergeJourneyWithLocalDetail(detail, localAtlasClient.journey(getCurrentUser().id, id));
      writeAppCache(journeyCacheKey(id), merged);
      return merged;
    } catch (error) {
      const cached = readAppCache<JourneyDetail>(journeyCacheKey(id));
      if (cached) return mergeJourneyWithLocalDetail(cached, localAtlasClient.journey(getCurrentUser().id, id));
      throw error;
    }
  },

  localOrCachedJourney(id: string): JourneyDetail | null {
    const local = localAtlasClient.journey(getCurrentUser().id, id);
    const cached = readAppCache<JourneyDetail>(journeyCacheKey(id));
    return local && cached ? mergeJourneyWithLocalDetail(cached, local) : (local ?? cached);
  },

  async vehicleIntelligence(): Promise<VehicleIntelligenceData> {
    const userId = getCurrentUser().id, cacheKey = vehicleIntelligenceCacheKey(userId);
    const cached = readAppCache<VehicleIntelligenceCache>(cacheKey);
    const connection = await loadConnection();
    if (!connection) return cached?.data ?? emptyVehicleIntelligence();
    try {
      if (cached?.preferencesDirty) {
        await request<VehicleIntelligencePreferences>(connection, '/api/recorder/vehicle-intelligence/preferences', {
          method: 'PUT', body: JSON.stringify(cached.data.preferences),
        });
      }
      const offset = new Date().getTimezoneOffset();
      const data = await request<VehicleIntelligenceData>(connection, `/api/recorder/vehicle-intelligence?timezoneOffsetMinutes=${encodeURIComponent(String(offset))}`, undefined, 20_000);
      writeAppCache(cacheKey, { data, preferencesDirty: false } satisfies VehicleIntelligenceCache);
      return data;
    } catch (error) {
      if (cached) return cached.data;
      const local = localVehicleIntelligence(userId);
      writeAppCache(cacheKey, { data: local, preferencesDirty: false } satisfies VehicleIntelligenceCache);
      return local;
    }
  },

  async saveVehicleIntelligencePreferences(preferences: VehicleIntelligencePreferences): Promise<VehicleIntelligenceData> {
    const userId = getCurrentUser().id, cacheKey = vehicleIntelligenceCacheKey(userId);
    const cached = readAppCache<VehicleIntelligenceCache>(cacheKey);
    const local = applyVehiclePreferences(cached?.data ?? emptyVehicleIntelligence(), preferences);
    writeAppCache(cacheKey, { data: local, preferencesDirty: true } satisfies VehicleIntelligenceCache);
    const connection = await loadConnection();
    if (!connection) return local;
    try {
      const saved = await request<VehicleIntelligencePreferences>(connection, '/api/recorder/vehicle-intelligence/preferences', {
        method: 'PUT', body: JSON.stringify(preferences),
      });
      const synchronized = applyVehiclePreferences(local, saved);
      writeAppCache(cacheKey, { data: synchronized, preferencesDirty: false } satisfies VehicleIntelligenceCache);
      return synchronized;
    } catch {
      return local;
    }
  },

  async savePlaceAlias(location: string, label: string): Promise<{ location: string; label: string; removed: boolean }> {
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck before naming a location.');
    return request(connection, '/api/recorder/places/alias', {
      method: 'PUT',
      body: JSON.stringify({ location, label: label.trim() }),
    });
  },

  async memories(): Promise<MemoriesCatalog> {
    const local = localAtlasClient.memories(getCurrentUser().id);
    const connection = await loadConnection();
    const cached = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY);
    if (!connection) {
      return local.memories.length || local.collections.length ? local : (cached ?? local);
    }
    try {
      const remote = await request<MemoriesCatalog>(connection, '/api/recorder/memories');
      const catalog = mergeMemoriesCatalog(remote, local, cached);
      writeAppCache(MEMORIES_CACHE_KEY, catalog);
      return catalog;
    } catch (error) {
      if (local.memories.length || local.collections.length) return mergeMemoriesCatalog(cached ?? local, local, cached);
      if (cached) return cached;
      throw error;
    }
  },

  async musicDashboard(): Promise<MusicDashboardData> {
    const connection = await loadConnection();
    const cached = readAppCache<MusicDashboardData>(MUSIC_DASHBOARD_CACHE_KEY);
    if (!connection) {
      const local = localAtlasClient.musicDashboard(getCurrentUser().id);
      if (local.recentSelections.length || local.metrics.songsOnRoad > 0) return local;
      if (cached) return cached;
      return local;
    }
    try {
      const offset = new Date().getTimezoneOffset();
      const data = await request<MusicDashboardData>(connection, `/api/recorder/music-dashboard?timezoneOffsetMinutes=${encodeURIComponent(String(offset))}`);
      writeAppCache(MUSIC_DASHBOARD_CACHE_KEY, data);
      return data;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  },

  async saveCollection(input: { id?: string | null; name: string; description?: string | null; driveIds: string[] }): Promise<JourneyCollection> {
    const userId = getCurrentUser().id;
    const id = input.id ?? `collection_${Crypto.randomUUID()}`;
    const existing = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY)?.collections.find(item => item.id === id);
    const timestamp = new Date().toISOString();
    const local: JourneyCollection = { id, name: input.name.trim(), description: input.description?.trim() ?? '', driveIds: [...new Set(input.driveIds)], createdAtUtc: existing?.createdAtUtc ?? timestamp, updatedAtUtc: timestamp, photos: existing?.photos ?? [] };
    upsertCollection({ id, userId, name: local.name, description: local.description, journeyIds: JSON.stringify(local.driveIds) });
    cacheCollection(local);
    const connection = await loadConnection();
    if (!connection) return local;
    try {
      const saved = await request<JourneyCollection>(connection, '/api/recorder/collections', { method: 'PUT', body: JSON.stringify({ ...input, id }) });
      upsertCollection({ id: saved.id, userId, name: saved.name, description: saved.description, journeyIds: JSON.stringify(saved.driveIds) }, { syncedToCloud: 1, createdAt: saved.createdAtUtc, updatedAt: saved.updatedAtUtc });
      cacheCollection(saved);
      return saved;
    } catch { return local; }
  },

  async saveMemory(input: { id?: string | null; name: string; notes?: string | null; artworkKey?: string | null; coverPhotoId?: string | null; collectionIds: string[] }): Promise<JourneyMemory> {
    const userId = getCurrentUser().id;
    const id = input.id ?? `memory_${Crypto.randomUUID()}`;
    const existing = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY)?.memories.find(item => item.id === id);
    const timestamp = new Date().toISOString();
    const local: JourneyMemory = { id, name: input.name.trim(), notes: input.notes?.trim() ?? '', artworkKey: input.artworkKey ?? 'road-trips', coverPhotoId: input.coverPhotoId ?? null, photos: existing?.photos ?? [], collectionIds: [...new Set(input.collectionIds)], createdAtUtc: existing?.createdAtUtc ?? timestamp, updatedAtUtc: timestamp };
    upsertMemory({ id, userId, name: local.name, notes: local.notes, artworkKey: local.artworkKey, coverPhotoLocalPath: null, collectionIds: JSON.stringify(local.collectionIds) });
    cacheMemory(local);
    const connection = await loadConnection();
    if (!connection) return local;
    try {
      const saved = await request<JourneyMemory>(connection, '/api/recorder/memories', { method: 'PUT', body: JSON.stringify({ ...input, id }) });
      upsertMemory({ id: saved.id, userId, name: saved.name, notes: saved.notes, artworkKey: saved.artworkKey, coverPhotoLocalPath: null, collectionIds: JSON.stringify(saved.collectionIds) }, { syncedToCloud: 1, createdAt: saved.createdAtUtc, updatedAt: saved.updatedAtUtc });
      cacheMemory(saved);
      return saved;
    } catch { return local; }
  },

  async uploadCollectionPhoto(collectionId: string, input: { fileName: string; contentType: JourneyPhoto['contentType']; dataBase64: string }): Promise<JourneyPhoto> {
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck before uploading a photo.');
    return request(connection, `/api/recorder/collections/${encodeURIComponent(collectionId)}/photos`, { method: 'POST', body: JSON.stringify(input) }, 35_000);
  },

  async uploadMemoryPhoto(memoryId: string, input: { fileName: string; contentType: JourneyPhoto['contentType']; dataBase64: string }): Promise<JourneyPhoto> {
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck before uploading a photo.');
    return request(connection, `/api/recorder/memories/${encodeURIComponent(memoryId)}/photos`, { method: 'POST', body: JSON.stringify(input) }, 35_000);
  },

  async photoDataUrl(photo: JourneyPhoto): Promise<string> {
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
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck before removing a photo.');
    await request(connection, `/api/recorder/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' });
  },

  async providerPreferences(): Promise<ProviderPreferences | null> {
    const connection = await loadConnection();
    if (!connection) return null;
    return request(connection, `/api/recorder/preferences/${encodeURIComponent(connection.deviceId)}`);
  },

  async updateProviderPreferences(input: Pick<ProviderPreferences, 'musicProvider' | 'onboardingCompleted' | 'connections'>): Promise<ProviderPreferences | null> {
    const connection = await loadConnection();
    if (!connection) return null;
    return request(connection, `/api/recorder/preferences/${encodeURIComponent(connection.deviceId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async connectionCapabilities(): Promise<ConnectionCapabilities> {
    const connection = await loadConnection();
    if (!connection) return { lastFmConfigured: false, tessieConfigured: false };
    return request(connection, '/api/recorder/connections/status');
  },

  async syncLastFm(sessionId: string, username: string): Promise<{ synced: number; total: number }> {
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck before syncing Last.fm.');
    return request(connection, `/api/recorder/sessions/${encodeURIComponent(sessionId)}/lastfm/sync`, {
      method: 'POST',
      body: JSON.stringify({ deviceId: connection.deviceId, username: username.trim() }),
    }, 35_000);
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
  upsertCollection,
  upsertMemory,
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

/** How stale a cached Atlas snapshot can be before we rebuild it (5 minutes). */
const ATLAS_STALE_MS = 5 * 60_000;

function localJourneyToSummary(j: import('./local-store').LocalJourney): JourneySummary {
  return {
    id: j.id,
    legacyDriveId: j.legacyDriveId,
    provider: j.provider,
    vehicleName: j.vehicleName,
    startedAt: j.startedAt,
    endedAt: j.endedAt,
    durationMinutes: j.durationMinutes,
    miles: j.miles,
    startingLocation: j.startPlaceId ?? null,
    endingLocation: j.endPlaceId ?? null,
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
      cities: [],        // requires geocoding — populated in Phase 3 via Cloudflare/Nominatim
      daily: [],         // requires historical daily aggregation — Phase 1.5
      week: { total: last7.songCount, changePercent: null },
    };
  },

  /**
   * Returns the local MemoriesCatalog (collections + memories) from on-device SQLite.
   */
  memories(userId: LocalUserId): MemoriesCatalog {
    initializeLocalStore();
    const collections = listCollections(userId).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      driveIds: JSON.parse(c.journeyIds) as string[],
      createdAtUtc: c.createdAt,
      updatedAtUtc: c.updatedAt,
      photos: [] as JourneyPhoto[],
    } satisfies JourneyCollection));

    const memories = listMemories(userId).map(m => ({
      id: m.id,
      name: m.name,
      notes: m.notes ?? '',
      artworkKey: m.artworkKey ?? '',
      coverPhotoId: null,
      photos: [] as JourneyPhoto[],
      collectionIds: JSON.parse(m.collectionIds) as string[],
      createdAtUtc: m.createdAt,
      updatedAtUtc: m.updatedAt,
    } satisfies JourneyMemory));

    return { memories, collections };
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
