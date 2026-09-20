import Constants from 'expo-constants';
import { cityGridCoordinate, nearestRecordedCoordinate, summarizeCitySongs, type CitySongLocation } from './city-summary';
import { getJourneyRouteSamples, listMusicEntries, type LocalUserId } from './local-store';
import { requestPrivacyEdgeJson } from './network-request';
import { readAppCache, writeAppCache } from './storage';

type CityLabelCache = {
  labels: Record<string, { label: string; expiresAt: string }>;
  summary: { label: string; songs: number }[];
  builtAt: string | null;
};
type EdgeCityResponse = { city?: string; state?: string; country?: string; label?: string; attribution?: string };
export type MusicCityJourneyDetail = {
  id: string;
  startedAt: string;
  endedAt: string;
  soundtrack: { playedAt: string | null; track: string; artist: string; mapCoordinate?: [number, number] | null }[];
  route: { coordinates: [number, number][]; points?: { recordedAt: string; coordinate: [number, number] }[] } | null;
};

const CACHE_DAYS = 30;
const MAX_LOOKUPS_PER_REFRESH = 4;
const LOOKUP_SPACING_MS = 1_050;

function cacheKey(userId: LocalUserId) { return `privacy-edge.city-labels.${userId}.v2`; }

function configuredEdgeUrl() {
  const edge = Constants.expoConfig?.extra?.edge as { url?: unknown } | undefined;
  return typeof edge?.url === 'string' && /^https:\/\//.test(edge.url) ? edge.url : null;
}

function trackKey(track: { playedAt: string | null; track: string; artist: string }) {
  return `${track.playedAt ?? ''}\0${track.track.toLocaleLowerCase()}\0${track.artist.toLocaleLowerCase()}`;
}

function cachedTrackCoordinate(detail: MusicCityJourneyDetail, track: MusicCityJourneyDetail['soundtrack'][number]) {
  if (track.mapCoordinate) return track.mapCoordinate;
  if (track.playedAt && detail.route?.points?.length) return nearestRecordedCoordinate(detail.route.points, track.playedAt);
  const coordinates = detail.route?.coordinates ?? [];
  if (!coordinates.length) return null;
  const played = track.playedAt ? Date.parse(track.playedAt) : NaN;
  const started = Date.parse(detail.startedAt), ended = Date.parse(detail.endedAt);
  if (!Number.isFinite(played) || !Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return coordinates[0];
  const progress = Math.max(0, Math.min(1, (played - started) / (ended - started)));
  return coordinates[Math.round(progress * (coordinates.length - 1))] ?? coordinates[0];
}

function musicLocations(userId: LocalUserId, details: MusicCityJourneyDetail[]): CitySongLocation[] {
  const samplesByJourney = new Map<string, ReturnType<typeof getJourneyRouteSamples>>();
  const locations: CitySongLocation[] = [];
  const seen = new Set<string>();
  for (const entry of listMusicEntries(userId, 500)) {
    if (!entry.journeyId) continue;
    let samples = samplesByJourney.get(entry.journeyId);
    if (!samples) {
      samples = getJourneyRouteSamples(userId, entry.journeyId);
      samplesByJourney.set(entry.journeyId, samples);
    }
    const coordinate = nearestRecordedCoordinate(samples, entry.playedAt);
    if (coordinate) {
      locations.push({ coordinate, songs: 1 });
      seen.add(trackKey(entry));
    }
  }
  for (const detail of details) {
    for (const track of detail.soundtrack) {
      const key = trackKey(track);
      if (seen.has(key)) continue;
      const coordinate = cachedTrackCoordinate(detail, track);
      if (!coordinate) continue;
      locations.push({ coordinate, songs: 1 });
      seen.add(key);
    }
  }
  return locations;
}

function delay(milliseconds: number) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }

export async function loadCityLabelForCoordinate(userId: LocalUserId, coordinate: [number, number] | null | undefined): Promise<string | null> {
  const grid = coordinate ? cityGridCoordinate(coordinate) : null;
  if (!grid) return null;
  const stored = readAppCache<CityLabelCache>(cacheKey(userId)) ?? { labels: {}, summary: [], builtAt: null };
  const cached = stored.labels[grid.key];
  const now = Date.now();
  if (cached && Date.parse(cached.expiresAt) > now) return cached.label;
  const edgeUrl = configuredEdgeUrl();
  if (!edgeUrl) return cached?.label ?? null;
  try {
    const result = await requestPrivacyEdgeJson<EdgeCityResponse>(edgeUrl, '/api/places/reverse', { lat: grid.latitude, lng: grid.longitude });
    if (!result.label) return cached?.label ?? null;
    stored.labels[grid.key] = { label: result.label, expiresAt: new Date(now + CACHE_DAYS * 86_400_000).toISOString() };
    writeAppCache(cacheKey(userId), stored);
    return result.label;
  } catch {
    return cached?.label ?? null;
  }
}

export async function loadMusicCitySummary(userId: LocalUserId, refresh = false, details: MusicCityJourneyDetail[] = []): Promise<{ label: string; songs: number }[]> {
  const stored = readAppCache<CityLabelCache>(cacheKey(userId)) ?? { labels: {}, summary: [], builtAt: null };
  if (!refresh) return stored.summary;
  const locations = musicLocations(userId, details);
  const labels = Object.fromEntries(Object.entries(stored.labels).map(([key, value]) => [key, value.label]));
  if (!locations.length) {
    writeAppCache(cacheKey(userId), { ...stored, summary: [], builtAt: new Date().toISOString() });
    return [];
  }

  const edgeUrl = configuredEdgeUrl();
  if (!edgeUrl) return summarizeCitySongs(locations, labels);
  const now = Date.now();
  const gridCounts = new Map<string, { grid: NonNullable<ReturnType<typeof cityGridCoordinate>>; songs: number }>();
  for (const location of locations) {
    const grid = cityGridCoordinate(location.coordinate);
    if (!grid) continue;
    const existing = gridCounts.get(grid.key);
    gridCounts.set(grid.key, { grid, songs: (existing?.songs ?? 0) + location.songs });
  }
  const grids = [...gridCounts.values()].sort((left, right) => right.songs - left.songs).map(value => value.grid);
  const pending = grids.filter(grid => !stored.labels[grid.key] || Date.parse(stored.labels[grid.key].expiresAt) <= now).slice(0, MAX_LOOKUPS_PER_REFRESH);
  for (let index = 0; index < pending.length; index += 1) {
    const grid = pending[index];
    try {
      const result = await requestPrivacyEdgeJson<EdgeCityResponse>(edgeUrl, '/api/places/reverse', { lat: grid.latitude, lng: grid.longitude });
      if (result.label) {
        stored.labels[grid.key] = { label: result.label, expiresAt: new Date(now + CACHE_DAYS * 86_400_000).toISOString() };
        labels[grid.key] = result.label;
      }
    } catch {
      // Existing labels remain available; a later deliberate refresh retries.
    }
    if (index < pending.length - 1) await delay(LOOKUP_SPACING_MS);
  }
  const summary = summarizeCitySongs(locations, labels);
  writeAppCache(cacheKey(userId), { ...stored, summary, builtAt: new Date().toISOString() });
  return summary;
}
