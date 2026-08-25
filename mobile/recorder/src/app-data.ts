import type { Connection } from './credentials';
import { loadConnection } from './credentials';
import { activeSession, getSessionSummary, readAppCache, totalQueuedMusicObservationCount, writeAppCache } from './storage';
import type { ApiMusicProvider } from './music-preferences';

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
  route: { type: 'LineString'; coordinates: [number, number][] } | null;
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
const journeyCacheKey = (id: string) => `app.journey.${id}.v1`;
const photoCacheKey = (id: string) => `app.photo.${id}.v1`;

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
    if (!connection) return { ...(readAppCache<DashboardData>(DASHBOARD_CACHE_KEY) ?? emptyDashboard()), recorder: localRecorderHealth(false), weeklyJourneys: journeysInsideWeeklyWindow(cachedWeekly) };
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
    if (!connection) return cursor ? { items: [], nextCursor: null } : (readAppCache<{ items: JourneySummary[]; nextCursor: string | null }>(JOURNEYS_CACHE_KEY) ?? { items: [], nextCursor: null });
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
      const cached = readAppCache<JourneyDetail>(journeyCacheKey(id));
      if (cached) return cached;
      throw new Error('Connect this iPhone to JourneyDeck to load journey details.');
    }
    try {
      const detail = await request<JourneyDetail>(connection, `/api/recorder/journeys/${encodeURIComponent(id)}`);
      writeAppCache(journeyCacheKey(id), detail);
      return detail;
    } catch (error) {
      const cached = readAppCache<JourneyDetail>(journeyCacheKey(id));
      if (cached) return cached;
      throw error;
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
    const connection = await loadConnection();
    const cached = readAppCache<MemoriesCatalog>(MEMORIES_CACHE_KEY);
    if (!connection) return cached ?? { memories: [], collections: [] };
    try {
      const catalog = await request<MemoriesCatalog>(connection, '/api/recorder/memories');
      writeAppCache(MEMORIES_CACHE_KEY, catalog);
      return catalog;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  },

  async musicDashboard(): Promise<MusicDashboardData> {
    const connection = await loadConnection();
    const cached = readAppCache<MusicDashboardData>(MUSIC_DASHBOARD_CACHE_KEY);
    if (!connection) {
      if (cached) return cached;
      throw new Error('Connect this iPhone to JourneyDeck to load your music archive.');
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
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck before changing a collection.');
    return request(connection, '/api/recorder/collections', { method: 'PUT', body: JSON.stringify(input) });
  },

  async saveMemory(input: { id?: string | null; name: string; notes?: string | null; artworkKey?: string | null; coverPhotoId?: string | null; collectionIds: string[] }): Promise<JourneyMemory> {
    const connection = await loadConnection();
    if (!connection) throw new Error('Connect this iPhone to JourneyDeck before changing a memory.');
    return request(connection, '/api/recorder/memories', { method: 'PUT', body: JSON.stringify(input) });
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
