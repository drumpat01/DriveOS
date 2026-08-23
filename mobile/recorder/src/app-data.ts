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

export type AppDashboard = DashboardData & { recorder: LocalRecorderHealth };

export type ConnectionCapabilities = {
  lastFmConfigured: boolean;
  tessieConfigured: boolean;
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
const journeyCacheKey = (id: string) => `app.journey.${id}.v1`;

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

export const appDataClient = {
  async dashboard(): Promise<AppDashboard> {
    const connection = await loadConnection();
    if (!connection) return { ...(readAppCache<DashboardData>(DASHBOARD_CACHE_KEY) ?? emptyDashboard()), recorder: localRecorderHealth(false) };
    const dashboard = await request<DashboardData>(connection, `/api/recorder/dashboard?deviceId=${encodeURIComponent(connection.deviceId)}`);
    writeAppCache(DASHBOARD_CACHE_KEY, dashboard);
    return { ...dashboard, recorder: localRecorderHealth(true) };
  },

  async localDashboard(): Promise<AppDashboard> {
    const connection = await loadConnection();
    return { ...(readAppCache<DashboardData>(DASHBOARD_CACHE_KEY) ?? emptyDashboard()), recorder: localRecorderHealth(Boolean(connection)) };
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
