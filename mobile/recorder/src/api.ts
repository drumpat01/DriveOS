import type { Connection } from './credentials';
import {
  getSession, markMusicObservationsUploaded, markPointsUploaded, markRemoteCreated,
  queuedMusicObservations, queuedPoints, sessionsWithQueuedMusic,
} from './storage';

type RecorderSession = { id: string; driveId?: string | null };
const musicFlushes = new Map<string, Promise<number>>();

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
  // Music is an additive enrichment. Start its independent queue flush only
  // after GPS is safe, and never let it delay or fail recording completion.
  void flushMusicObservationsBestEffort(connection, sessionId);
}

async function runMusicObservationFlush(connection: Connection, sessionId: string) {
  await ensureRemoteSession(connection, sessionId);
  let uploaded = 0;
  let batch = queuedMusicObservations(sessionId);
  while (batch.length) {
    await request<{ accepted: number; total: number; updatedAt: string }>(
      connection,
      `/api/recorder/sessions/${encodeURIComponent(sessionId)}/music`,
      { method: 'POST', body: JSON.stringify({ deviceId: connection.deviceId, observations: batch }) },
    );
    markMusicObservationsUploaded(sessionId, batch.map(observation => observation.observationId));
    uploaded += batch.length;
    batch = queuedMusicObservations(sessionId);
  }
  return uploaded;
}

export function flushMusicObservations(connection: Connection, sessionId: string) {
  const existing = musicFlushes.get(sessionId);
  if (existing) return existing;
  const pending = runMusicObservationFlush(connection, sessionId)
    .finally(() => { if (musicFlushes.get(sessionId) === pending) musicFlushes.delete(sessionId); });
  musicFlushes.set(sessionId, pending);
  return pending;
}

export async function flushMusicObservationsBestEffort(connection: Connection, sessionId: string) {
  try { return await flushMusicObservations(connection, sessionId); }
  catch { return 0; }
}

export async function flushAllQueuedMusicBestEffort(connection: Connection) {
  let uploaded = 0;
  for (const sessionId of sessionsWithQueuedMusic()) {
    uploaded += await flushMusicObservationsBestEffort(connection, sessionId);
  }
  return uploaded;
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
