import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { LocationObject } from 'expo-location';
import { normalizeMusicObservation, type MusicObservation } from './music-observations';
import { getCurrentUser } from './auth';
import { insertGpsPoints, upsertJourney, upsertMusicEntry } from './local-store';

const db = SQLite.openDatabaseSync('journeydeck-recorder.db');
let initialized = false;
export type LocalSessionStatus = 'recording' | 'paused' | 'finishing' | 'completed';
export type SessionRow = { id: string; device_id: string; status: LocalSessionStatus; started_at: string; ended_at: string | null; next_sequence: number; remote_created: number; drive_id: string | null };
export type SessionSummary = { id: string; deviceId: string; status: LocalSessionStatus; startedAt: string; endedAt: string | null; pointCount: number; queuedCount: number; musicQueuedCount: number; remoteCreated: boolean; driveId: string | null; lastAccuracyMeters: number | null };
export type QueuedPoint = { sequence: number; recordedAt: string; latitude: number; longitude: number; accuracyMeters: number | null; altitudeMeters: number | null; headingDegrees: number | null; speedMps: number | null };
export type LiveRecorderSnapshot = {
  session: SessionSummary | null;
  route: QueuedPoint[];
  music: MusicObservation[];
  lastPoint: QueuedPoint | null;
};
export type LastFmSyncRow = { sessionId: string; username: string; status: 'pending' | 'synced'; attemptCount: number; successCount: number; nextAttemptAt: string; lastAttemptAt: string | null };
export type { MusicObservation } from './music-observations';

export function initializeDatabase() {
  if (initialized) return;
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS recording_sessions (
      id TEXT PRIMARY KEY NOT NULL, device_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('recording','paused','finishing','completed')),
      started_at TEXT NOT NULL, ended_at TEXT, next_sequence INTEGER NOT NULL DEFAULT 0,
      remote_created INTEGER NOT NULL DEFAULT 0, drive_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recording_points (
      session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE, sequence INTEGER NOT NULL,
      recorded_at TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy_meters REAL,
      altitude_meters REAL, heading_degrees REAL, speed_mps REAL, uploaded INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(session_id, sequence)
    );
    CREATE INDEX IF NOT EXISTS ix_recording_points_queue ON recording_points(session_id, uploaded, sequence);
    CREATE TABLE IF NOT EXISTS recording_music_observations (
      session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
      observation_id TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('apple_music','shazam','lastfm')),
      played_at TEXT NOT NULL, track TEXT NOT NULL, artist TEXT NOT NULL, album TEXT,
      duration_ms INTEGER, artwork_url TEXT, external_url TEXT, confidence REAL,
      uploaded INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      PRIMARY KEY(session_id, observation_id)
    );
    CREATE INDEX IF NOT EXISTS ix_recording_music_queue
      ON recording_music_observations(session_id, uploaded, played_at);
    CREATE TABLE IF NOT EXISTS recording_lastfm_sync (
      session_id TEXT PRIMARY KEY NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
      username TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','synced')),
      attempt_count INTEGER NOT NULL DEFAULT 0, success_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, last_attempt_at TEXT, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_recording_lastfm_pending
      ON recording_lastfm_sync(status, next_attempt_at);
    CREATE TABLE IF NOT EXISTS recording_app_cache (
      key TEXT PRIMARY KEY NOT NULL, value_json TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  initialized = true;
}

export function activeSession() { initializeDatabase(); return db.getFirstSync<SessionRow>("SELECT * FROM recording_sessions WHERE status!='completed' ORDER BY created_at DESC LIMIT 1;"); }

export function beginLocalSession(deviceId: string) {
  initializeDatabase();
  const existing = activeSession();
  if (existing) return existing;
  const id = `recording_${Crypto.randomUUID()}`, now = new Date().toISOString();
  db.runSync("INSERT INTO recording_sessions(id,device_id,status,started_at,created_at,updated_at) VALUES(?,?,'recording',?,?,?);", id, deviceId, now, now, now);
  return db.getFirstSync<SessionRow>('SELECT * FROM recording_sessions WHERE id=?;', id)!;
}

function valid(value: number | null, minimum: number, maximum: number) { return value !== null && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null; }

export function recordLocations(locations: LocationObject[]) {
  initializeDatabase();
  const session = activeSession();
  if (!session || session.status !== 'recording') return 0;
  let inserted = 0;
  db.withTransactionSync(() => {
    let sequence = db.getFirstSync<{ next_sequence: number }>('SELECT next_sequence FROM recording_sessions WHERE id=?;', session.id)?.next_sequence ?? 0;
    for (const location of locations) {
      const { coords } = location;
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) || sequence > 10_000_000 || location.timestamp < Date.parse(session.started_at)) continue;
      db.runSync(
        'INSERT OR IGNORE INTO recording_points(session_id,sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps) VALUES(?,?,?,?,?,?,?,?,?);',
        session.id, sequence, new Date(Math.min(location.timestamp, Date.now())).toISOString(), coords.latitude, coords.longitude,
        valid(coords.accuracy, 0, 10_000), valid(coords.altitude, -1000, 100_000), valid(coords.heading, 0, 360), valid(coords.speed, 0, 150),
      );
      sequence += 1; inserted += 1;
    }
    db.runSync('UPDATE recording_sessions SET next_sequence=?,updated_at=? WHERE id=?;', sequence, new Date().toISOString(), session.id);
  });
  return inserted;
}

export function getSession(sessionId: string) { initializeDatabase(); return db.getFirstSync<SessionRow>('SELECT * FROM recording_sessions WHERE id=?;', sessionId); }

export function getSessionSummary(sessionId: string): SessionSummary | null {
  initializeDatabase();
  const row = db.getFirstSync<SessionRow & { point_count: number; queued_count: number; music_queued_count: number; last_accuracy: number | null }>(`
    SELECT s.*, COUNT(p.sequence) AS point_count, COALESCE(SUM(CASE WHEN p.uploaded=0 THEN 1 ELSE 0 END),0) AS queued_count,
      (SELECT COUNT(*) FROM recording_music_observations m WHERE m.session_id=s.id AND m.uploaded=0) AS music_queued_count,
      (SELECT accuracy_meters FROM recording_points WHERE session_id=s.id ORDER BY sequence DESC LIMIT 1) AS last_accuracy
    FROM recording_sessions s LEFT JOIN recording_points p ON p.session_id=s.id WHERE s.id=? GROUP BY s.id;
  `, sessionId);
  return row ? { id: row.id, deviceId: row.device_id, status: row.status, startedAt: row.started_at, endedAt: row.ended_at,
    pointCount: Number(row.point_count), queuedCount: Number(row.queued_count), musicQueuedCount: Number(row.music_queued_count), remoteCreated: Boolean(row.remote_created), driveId: row.drive_id, lastAccuracyMeters: row.last_accuracy } : null;
}

export function queuedPoints(sessionId: string, limit = 250) {
  initializeDatabase();
  return db.getAllSync<QueuedPoint>(`SELECT sequence,recorded_at AS recordedAt,latitude,longitude,accuracy_meters AS accuracyMeters,
    altitude_meters AS altitudeMeters,heading_degrees AS headingDegrees,speed_mps AS speedMps
    FROM recording_points WHERE session_id=? AND uploaded=0 ORDER BY sequence LIMIT ?;`, sessionId, limit);
}

export function queueMusicObservation(sessionId: string, value: MusicObservation) {
  initializeDatabase();
  const observation = normalizeMusicObservation(value);
  if (!observation || !getSession(sessionId)) return false;

  // Native playback clocks can drift by a second or two between samples. Keep one
  // metadata row for the same song in the same short playback window.
  const recent = db.getAllSync<{ track: string; artist: string; played_at: string }>(`
    SELECT track,artist,played_at FROM recording_music_observations
    WHERE session_id=? AND source=? ORDER BY played_at DESC LIMIT 8;
  `, sessionId, observation.source);
  const playedAt = Date.parse(observation.playedAt);
  if (recent.some(row => row.track.toLowerCase() === observation.track.toLowerCase()
    && row.artist.toLowerCase() === observation.artist.toLowerCase()
    && Math.abs(Date.parse(row.played_at) - playedAt) <= 45_000)) return false;

  const result = db.runSync(`
    INSERT OR IGNORE INTO recording_music_observations(
      session_id,observation_id,source,played_at,track,artist,album,duration_ms,
      artwork_url,external_url,confidence,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?);
  `, sessionId, observation.observationId, observation.source, observation.playedAt,
  observation.track, observation.artist, observation.album, observation.durationMs,
  observation.artworkUrl, observation.externalUrl, observation.confidence, new Date().toISOString());
  return result.changes > 0;
}

export function queuedMusicObservations(sessionId: string, limit = 100) {
  initializeDatabase();
  return db.getAllSync<MusicObservation>(`
    SELECT observation_id AS observationId,source,played_at AS playedAt,track,artist,album,
      duration_ms AS durationMs,artwork_url AS artworkUrl,external_url AS externalUrl,confidence
    FROM recording_music_observations
    WHERE session_id=? AND uploaded=0 ORDER BY played_at,observation_id LIMIT ?;
  `, sessionId, Math.max(1, Math.min(100, Math.trunc(limit))));
}

export function markMusicObservationsUploaded(sessionId: string, observationIds: string[]) {
  initializeDatabase();
  if (!observationIds.length) return;
  db.runSync(`UPDATE recording_music_observations SET uploaded=1
    WHERE session_id=? AND observation_id IN (${observationIds.map(() => '?').join(',')});`, sessionId, ...observationIds);
}

export function sessionsWithQueuedMusic(limit = 20) {
  initializeDatabase();
  return db.getAllSync<{ sessionId: string }>(`
    SELECT session_id AS sessionId FROM recording_music_observations
    WHERE uploaded=0 GROUP BY session_id ORDER BY MIN(played_at) LIMIT ?;
  `, Math.max(1, Math.min(100, Math.trunc(limit)))).map(row => row.sessionId);
}

export function queuedMusicObservationCount(sessionId: string) {
  initializeDatabase();
  return Number(db.getFirstSync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM recording_music_observations WHERE session_id=? AND uploaded=0;', sessionId,
  )?.total || 0);
}

export function totalQueuedMusicObservationCount() {
  initializeDatabase();
  return Number(db.getFirstSync<{ total: number }>('SELECT COUNT(*) AS total FROM recording_music_observations WHERE uploaded=0;')?.total || 0);
}

export function queueLastFmSync(sessionId: string, username: string) {
  initializeDatabase();
  const normalized = username.trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(normalized) || !getSession(sessionId)) return false;
  const now = new Date().toISOString();
  db.runSync(`
    INSERT INTO recording_lastfm_sync(session_id,username,status,next_attempt_at,updated_at)
    VALUES(?,?,'pending',?,?)
    ON CONFLICT(session_id) DO UPDATE SET
      username=excluded.username,
      status=CASE WHEN recording_lastfm_sync.username=excluded.username THEN recording_lastfm_sync.status ELSE 'pending' END,
      attempt_count=CASE WHEN recording_lastfm_sync.username=excluded.username THEN recording_lastfm_sync.attempt_count ELSE 0 END,
      success_count=CASE WHEN recording_lastfm_sync.username=excluded.username THEN recording_lastfm_sync.success_count ELSE 0 END,
      next_attempt_at=CASE WHEN recording_lastfm_sync.username=excluded.username THEN recording_lastfm_sync.next_attempt_at ELSE excluded.next_attempt_at END,
      updated_at=excluded.updated_at;
  `, sessionId, normalized, now, now);
  return true;
}

export function queueRecentCompletedLastFmSyncs(username: string, limit = 5) {
  initializeDatabase();
  const rows = db.getAllSync<{ id: string }>(`
    SELECT id FROM recording_sessions WHERE status='completed'
    ORDER BY COALESCE(ended_at,updated_at) DESC LIMIT ?;
  `, Math.max(1, Math.min(10, Math.trunc(limit))));
  return rows.reduce((count, row) => count + Number(queueLastFmSync(row.id, username)), 0);
}

export function pendingLastFmSyncs(options: { force?: boolean; limit?: number } = {}) {
  initializeDatabase();
  const limit = Math.max(1, Math.min(10, Math.trunc(options.limit ?? 5)));
  const rows = options.force
    ? db.getAllSync<Record<string, unknown>>(`SELECT * FROM recording_lastfm_sync ORDER BY updated_at DESC LIMIT ?;`, limit)
    : db.getAllSync<Record<string, unknown>>(`SELECT * FROM recording_lastfm_sync WHERE status='pending' AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT ?;`, new Date().toISOString(), limit);
  return rows.map(row => ({
    sessionId: String(row.session_id), username: String(row.username), status: row.status === 'synced' ? 'synced' : 'pending',
    attemptCount: Number(row.attempt_count) || 0, successCount: Number(row.success_count) || 0,
    nextAttemptAt: String(row.next_attempt_at), lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
  } satisfies LastFmSyncRow));
}

export function markLastFmSyncResult(sessionId: string, success: boolean) {
  initializeDatabase();
  const row = db.getFirstSync<{ success_count: number }>('SELECT success_count FROM recording_lastfm_sync WHERE session_id=?;', sessionId);
  if (!row) return;
  const now = new Date(), successCount = Number(row.success_count) + Number(success);
  const complete = successCount >= 3;
  const retryDelayMs = successCount >= 2 ? 10 * 60_000 : 2 * 60_000;
  db.runSync(`UPDATE recording_lastfm_sync SET status=?,attempt_count=attempt_count+1,success_count=?,
    next_attempt_at=?,last_attempt_at=?,updated_at=? WHERE session_id=?;`,
  complete ? 'synced' : 'pending', successCount, new Date(now.getTime() + retryDelayMs).toISOString(), now.toISOString(), now.toISOString(), sessionId);
}

export function readAppCache<T>(key: string): T | null {
  initializeDatabase();
  const row = db.getFirstSync<{ value_json: string }>('SELECT value_json FROM recording_app_cache WHERE key=?;', key);
  if (!row) return null;
  try { return JSON.parse(row.value_json) as T; }
  catch { return null; }
}

export function writeAppCache(key: string, value: unknown) {
  initializeDatabase();
  const now = new Date().toISOString();
  db.runSync(`INSERT INTO recording_app_cache(key,value_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;`, key, JSON.stringify(value), now);
}

export function markRemoteCreated(sessionId: string) { initializeDatabase(); db.runSync('UPDATE recording_sessions SET remote_created=1,updated_at=? WHERE id=?;', new Date().toISOString(), sessionId); }
export function markPointsUploaded(sessionId: string, sequences: number[]) {
  initializeDatabase();
  if (!sequences.length) return;
  db.runSync(`UPDATE recording_points SET uploaded=1 WHERE session_id=? AND sequence IN (${sequences.map(() => '?').join(',')});`, sessionId, ...sequences);
}
export function setLocalStatus(sessionId: string, status: Exclude<LocalSessionStatus, 'completed'>) {
  initializeDatabase();
  const endedAt = status === 'finishing' ? new Date().toISOString() : null;
  db.runSync('UPDATE recording_sessions SET status=?,ended_at=COALESCE(?,ended_at),updated_at=? WHERE id=?;', status, endedAt, new Date().toISOString(), sessionId);
}

/** Reads the active drive directly from this iPhone, including points already uploaded. */
export function getLiveRecorderSnapshot(limit = 500): LiveRecorderSnapshot {
  initializeDatabase();
  const session = activeSession();
  if (!session) return { session: null, route: [], music: [], lastPoint: null };
  const boundedLimit = Math.max(2, Math.min(2_000, Math.trunc(limit)));
  const route = db.getAllSync<QueuedPoint>(`SELECT sequence,recorded_at AS recordedAt,latitude,longitude,
    accuracy_meters AS accuracyMeters,altitude_meters AS altitudeMeters,
    heading_degrees AS headingDegrees,speed_mps AS speedMps
    FROM recording_points WHERE session_id=? ORDER BY sequence DESC LIMIT ?;`, session.id, boundedLimit).reverse();
  const music = db.getAllSync<MusicObservation>(`SELECT observation_id AS observationId,source,
    played_at AS playedAt,track,artist,album,duration_ms AS durationMs,
    artwork_url AS artworkUrl,external_url AS externalUrl,confidence
    FROM recording_music_observations WHERE session_id=? ORDER BY played_at DESC LIMIT 20;`, session.id).reverse();
  return { session: getSessionSummary(session.id), route, music, lastPoint: route.at(-1) ?? null };
}

function distanceMeters(a: QueuedPoint, b: QueuedPoint): number {
  const earthRadius = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const chord = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(chord));
}

function mirrorCompletedSessionToLocalStore(sessionId: string): void {
  const session = getSession(sessionId);
  if (!session?.ended_at) return;
  const user = getCurrentUser();
  const points = db.getAllSync<QueuedPoint>(`SELECT sequence,recorded_at AS recordedAt,latitude,longitude,
    accuracy_meters AS accuracyMeters,altitude_meters AS altitudeMeters,
    heading_degrees AS headingDegrees,speed_mps AS speedMps
    FROM recording_points WHERE session_id=? ORDER BY sequence;`, sessionId);
  const music = db.getAllSync<MusicObservation>(`SELECT observation_id AS observationId,source,
    played_at AS playedAt,track,artist,album,duration_ms AS durationMs,
    artwork_url AS artworkUrl,external_url AS externalUrl,confidence
    FROM recording_music_observations WHERE session_id=? ORDER BY played_at,observation_id;`, sessionId);
  const durationMinutes = Math.max(0, (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000);
  const meters = points.slice(1).reduce((total, point, index) => total + distanceMeters(points[index]!, point), 0);
  const miles = meters / 1609.344;
  const speedMph = points.map(point => point.speedMps == null ? 0 : point.speedMps * 2.2369362921);
  const journeyId = `local_${session.id}`;

  upsertJourney({
    id: journeyId,
    userId: user.id,
    legacyDriveId: session.drive_id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationMinutes,
    miles,
    startLat: points[0]?.latitude ?? null,
    startLng: points[0]?.longitude ?? null,
    endLat: points.at(-1)?.latitude ?? null,
    endLng: points.at(-1)?.longitude ?? null,
    startPlaceId: null,
    endPlaceId: null,
    averageSpeedMph: durationMinutes > 0 ? miles / (durationMinutes / 60) : null,
    maxSpeedMph: speedMph.length ? Math.max(...speedMph) : null,
    songCount: music.length,
    vehicleName: null,
    provider: 'native_recorder',
  });
  insertGpsPoints(user.id, journeyId, points);
  for (const observation of music) {
    upsertMusicEntry({
      id: `${journeyId}_${observation.observationId}`,
      userId: user.id,
      journeyId,
      source: observation.source,
      playedAt: observation.playedAt,
      track: observation.track,
      artist: observation.artist,
      album: observation.album,
      durationMs: observation.durationMs,
      artworkUrl: observation.artworkUrl,
      externalUrl: observation.externalUrl,
      confidence: observation.confidence,
    });
  }
}

export function markSessionCompleted(sessionId: string, driveId: string | null) {
  initializeDatabase();
  const now = new Date().toISOString();
  db.runSync("UPDATE recording_sessions SET status='completed',drive_id=?,ended_at=COALESCE(ended_at,?),updated_at=? WHERE id=?;", driveId, now, now, sessionId);
  mirrorCompletedSessionToLocalStore(sessionId);
}
