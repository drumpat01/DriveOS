import type { Connection } from './credentials';
import { getSession, markPointsUploaded, markRemoteCreated, queuedPoints } from './storage';

type RecorderSession = { id: string; driveId?: string | null };

export type JourneySong = {
  track: string;
  artist: string | null;
  album: string | null;
  albumImage: string | null;
  playedAt: string | null;
};

export type JourneyCoordinate = { latitude: number; longitude: number };

export type CompanionJourney = {
  id: string;
  internalId: string;
  provider: string;
  sourceLabel: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  startingLocation: string;
  endingLocation: string;
  startingCoordinate: JourneyCoordinate | null;
  endingCoordinate: JourneyCoordinate | null;
  distanceMiles: number;
  energyUsedKwh: number | null;
  averageSpeedMph: number | null;
  maxSpeedMph: number | null;
  startingBattery: number | null;
  endingBattery: number | null;
  tag: string | null;
  driverProfile: string | null;
  songCount: number;
  songs: JourneySong[];
};

export type CompanionSnapshot = { generatedAt: string; journeys: CompanionJourney[] };
export type JourneyRoute = {
  driveId: string;
  provider: string;
  routePoints: JourneyCoordinate[];
  startMarker: JourneyCoordinate | null;
  endMarker: JourneyCoordinate | null;
  stateCount: number;
  approximate: boolean;
};

async function request<T>(connection: Pick<Connection, 'serverUrl' | 'token'>, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${connection.serverUrl}${path}`, { ...init, signal: controller.signal,
      headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json', ...init?.headers } });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || `JourneyDeck returned ${response.status}.`);
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('JourneyDeck did not respond. Your points remain safely queued.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function pingRecorder(connection: Pick<Connection, 'serverUrl' | 'token'>) { return request<{ ready: boolean }>(connection, '/api/recorder/status'); }
export async function fetchCompanion(connection: Pick<Connection, 'serverUrl' | 'token'>, limit = 50) {
  return request<CompanionSnapshot>(connection, `/api/recorder/companion?limit=${Math.max(1, Math.min(100, Math.trunc(limit) || 50))}`);
}
export async function fetchJourneyRoute(connection: Pick<Connection, 'serverUrl' | 'token'>, journeyId: string) {
  return request<JourneyRoute>(connection, `/api/recorder/journeys/${encodeURIComponent(journeyId)}/route`);
}

async function ensureRemoteSession(connection: Connection, sessionId: string) {
  const session = getSession(sessionId);
  if (!session) throw new Error('The local recording could not be found.');
  if (session.remote_created) return;
  await request<RecorderSession>(connection, '/api/recorder/sessions', { method: 'POST', body: JSON.stringify({ id: session.id, deviceId: connection.deviceId, startedAt: session.started_at }) });
  markRemoteCreated(sessionId);
}

export async function flushRecording(connection: Connection, sessionId: string) {
  await ensureRemoteSession(connection, sessionId);
  let batch = queuedPoints(sessionId);
  while (batch.length) {
    await request<RecorderSession>(connection, `/api/recorder/sessions/${encodeURIComponent(sessionId)}/points`, { method: 'POST', body: JSON.stringify({ deviceId: connection.deviceId, points: batch }) });
    markPointsUploaded(sessionId, batch.map(point => point.sequence));
    batch = queuedPoints(sessionId);
  }
}

export async function setRemoteState(connection: Connection, sessionId: string, status: 'recording' | 'paused') {
  await ensureRemoteSession(connection, sessionId);
  return request<RecorderSession>(connection, `/api/recorder/sessions/${encodeURIComponent(sessionId)}/state`, { method: 'POST', body: JSON.stringify({ deviceId: connection.deviceId, status }) });
}

export async function completeRecording(connection: Connection, sessionId: string) {
  await flushRecording(connection, sessionId);
  const session = getSession(sessionId);
  if (!session) throw new Error('The local recording could not be found.');
  return request<RecorderSession>(connection, `/api/recorder/sessions/${encodeURIComponent(sessionId)}/complete`, { method: 'POST', body: JSON.stringify({ deviceId: connection.deviceId, endedAt: session.ended_at || new Date().toISOString() }) });
}
