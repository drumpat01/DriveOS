import * as Crypto from 'expo-crypto';
import type { LocationObject } from 'expo-location';
import { normalizeMusicObservation, type MusicObservation } from './music-observations';
import { getCurrentUser } from './auth';
import { insertGpsPoints, listMusicEntriesForJourney, refreshJourneySongCount, upsertJourney, upsertMusicEntry } from './local-store';
import { rebuildAtlasSnapshot } from './local-atlas';
import { notifyLocalArchiveChanged } from './local-archive-events';
import {
  RECORDER_DATABASE_APPLICATION_ID,
  RECORDER_DATABASE_HARDENING_SQL,
  RECORDER_DATABASE_SCHEMA_VERSION,
  SQLITE_CONNECTION_HARDENING_SQL,
} from './database-hardening';
import { getRecorderDatabase } from './database-owner';

const db = getRecorderDatabase();
let initialized = false;
export type LocalSessionStatus = 'recording' | 'paused' | 'finishing' | 'completed';
export type SessionRow = { id: string; owner_user_id: string; device_id: string; status: LocalSessionStatus; started_at: string; ended_at: string | null; next_sequence: number; remote_created: number; remote_completed: number; drive_id: string | null };
export type SessionSummary = { id: string; deviceId: string; status: LocalSessionStatus; startedAt: string; endedAt: string | null; pointCount: number; queuedCount: number; musicQueuedCount: number; remoteCreated: boolean; remoteCompleted: boolean; driveId: string | null; lastAccuracyMeters: number | null };
export type QueuedPoint = { sequence: number; recordedAt: string; latitude: number; longitude: number; accuracyMeters: number | null; altitudeMeters: number | null; headingDegrees: number | null; speedMps: number | null };
export type LiveRecorderSnapshot = {
  session: SessionSummary | null;
  route: QueuedPoint[];
  music: MusicObservation[];
  lastPoint: QueuedPoint | null;
};
export type LastFmSyncRow = { sessionId: string; username: string; status: 'pending' | 'synced'; attemptCount: number; successCount: number; nextAttemptAt: string; lastAttemptAt: string | null };
export type ImportedMusicTrack = { playedAt: string; track: string; artist: string; album: string | null; durationMs?: number | null; artworkUrl?: string | null; externalUrl?: string | null };
export type CompletionJobKind = 'archive_mirror' | 'apple_music_history' | 'private_cloud_sync' | 'remote_completion';
export type CompletionJobStatus = 'pending' | 'running' | 'retry' | 'completed';
export type CompletionJob = {
  id: string;
  sessionId: string;
  kind: CompletionJobKind;
  status: CompletionJobStatus;
  attemptCount: number;
  nextAttemptAt: string;
  leaseExpiresAt: string | null;
  lastErrorCode: string | null;
};
export type { MusicObservation } from './music-observations';

const completionJobId = (sessionId: string, kind: CompletionJobKind) => `${sessionId}:${kind}`;

export function initializeDatabase() {
  if (initialized) return;
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS recording_sessions (
      id TEXT PRIMARY KEY NOT NULL, owner_user_id TEXT, device_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('recording','paused','finishing','completed')),
      started_at TEXT NOT NULL, ended_at TEXT, next_sequence INTEGER NOT NULL DEFAULT 0,
      remote_created INTEGER NOT NULL DEFAULT 0, remote_completed INTEGER NOT NULL DEFAULT 0,
      drive_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
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
  db.execSync(SQLITE_CONNECTION_HARDENING_SQL);
  const applicationId = Number(db.getFirstSync<{ application_id: number }>('PRAGMA application_id;')?.application_id ?? 0);
  if (applicationId === 0) db.execSync(`PRAGMA application_id = ${RECORDER_DATABASE_APPLICATION_ID};`);
  else if (applicationId !== RECORDER_DATABASE_APPLICATION_ID) throw new Error('JourneyDeck recorder queue has an unexpected SQLite application id.');
  const current = Number(db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version ?? 0);
  if (current > RECORDER_DATABASE_SCHEMA_VERSION) {
    throw new Error(`JourneyDeck recorder queue schema ${current} is newer than this app supports.`);
  }
  const sessionColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(recording_sessions);');
  if (!sessionColumns.some(column => column.name === 'remote_completed')) {
    db.execSync('ALTER TABLE recording_sessions ADD COLUMN remote_completed INTEGER NOT NULL DEFAULT 0;');
  }
  if (!sessionColumns.some(column => column.name === 'owner_user_id')) {
    db.execSync('ALTER TABLE recording_sessions ADD COLUMN owner_user_id TEXT;');
  }
  db.runSync('UPDATE recording_sessions SET owner_user_id=? WHERE owner_user_id IS NULL;', getCurrentUser().id);
  db.execSync('CREATE INDEX IF NOT EXISTS ix_recording_sessions_owner ON recording_sessions(owner_user_id,status,created_at);');
  db.runSync('UPDATE recording_sessions SET remote_completed=1 WHERE drive_id IS NOT NULL AND remote_completed=0;');
  if (current < RECORDER_DATABASE_SCHEMA_VERSION) {
    db.withTransactionSync(() => {
      db.execSync(RECORDER_DATABASE_HARDENING_SQL);
      db.execSync(`PRAGMA user_version = ${RECORDER_DATABASE_SCHEMA_VERSION};`);
    });
  }
  // Schema v2 makes the cross-database archive handoff durable. Any completed
  // legacy row receives an idempotent mirror job so an interrupted older build
  // is repaired on the next runner pass.
  db.execSync(`
    INSERT OR IGNORE INTO recording_jobs(
      id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,
      lease_expires_at,last_error_code,created_at,updated_at,completed_at
    )
    SELECT id || ':archive_mirror',owner_user_id,id,'archive_mirror','pending',0,
      COALESCE(ended_at,updated_at),NULL,NULL,COALESCE(ended_at,updated_at),updated_at,NULL
    FROM recording_sessions
    WHERE status='completed' AND ended_at IS NOT NULL;
    INSERT OR IGNORE INTO recording_jobs(
      id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,
      lease_expires_at,last_error_code,created_at,updated_at,completed_at
    )
    SELECT id || ':apple_music_history',owner_user_id,id,'apple_music_history','pending',0,
      COALESCE(ended_at,updated_at),NULL,NULL,COALESCE(ended_at,updated_at),updated_at,NULL
    FROM recording_sessions
    WHERE status='completed' AND ended_at IS NOT NULL;
    INSERT OR IGNORE INTO recording_jobs(
      id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,
      lease_expires_at,last_error_code,created_at,updated_at,completed_at
    )
    SELECT id || ':private_cloud_sync',owner_user_id,id,'private_cloud_sync','pending',0,
      COALESCE(ended_at,updated_at),NULL,NULL,COALESCE(ended_at,updated_at),updated_at,NULL
    FROM recording_sessions
    WHERE status='completed' AND ended_at IS NOT NULL;
    INSERT OR IGNORE INTO recording_jobs(
      id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,
      lease_expires_at,last_error_code,created_at,updated_at,completed_at
    )
    SELECT id || ':remote_completion',owner_user_id,id,'remote_completion','pending',0,
      COALESCE(ended_at,updated_at),NULL,NULL,COALESCE(ended_at,updated_at),updated_at,NULL
    FROM recording_sessions
    WHERE status='completed' AND ended_at IS NOT NULL AND remote_completed=0;
  `);
  const quickCheck = db.getFirstSync<Record<string, unknown>>('PRAGMA quick_check(1);');
  if (String(Object.values(quickCheck ?? {})[0] ?? '').toLowerCase() !== 'ok') {
    throw new Error('JourneyDeck recorder queue failed SQLite quick_check.');
  }
  initialized = true;
}

export function activeSession() { initializeDatabase(); return db.getFirstSync<SessionRow>("SELECT * FROM recording_sessions WHERE owner_user_id=? AND status!='completed' ORDER BY created_at DESC LIMIT 1;", getCurrentUser().id); }

export function archivedJourneyIdForSession(sessionId: string): string {
  return `local_${sessionId}`;
}

export function beginLocalSession(deviceId: string) {
  initializeDatabase();
  const existing = activeSession();
  if (existing) return existing;
  const id = `recording_${Crypto.randomUUID()}`, now = new Date().toISOString();
  db.runSync("INSERT INTO recording_sessions(id,owner_user_id,device_id,status,started_at,created_at,updated_at) VALUES(?,?,?,'recording',?,?,?);", id, getCurrentUser().id, deviceId, now, now, now);
  return getSession(id)!;
}

function valid(value: number | null, minimum: number, maximum: number) { return value !== null && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null; }

function insertLocationsForSession(session: SessionRow, locations: LocationObject[]): number {
  let inserted = 0;
  db.withTransactionSync(() => {
    let sequence = db.getFirstSync<{ next_sequence: number }>('SELECT next_sequence FROM recording_sessions WHERE id=?;', session.id)?.next_sequence ?? 0;
    for (const location of locations) {
      const { coords } = location;
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)
        || coords.latitude < -90 || coords.latitude > 90 || coords.longitude < -180 || coords.longitude > 180
        || sequence > 10_000_000 || location.timestamp < Date.parse(session.started_at)) continue;
      const result = db.runSync(
        'INSERT OR IGNORE INTO recording_points(session_id,sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps) VALUES(?,?,?,?,?,?,?,?,?);',
        session.id, sequence, new Date(Math.min(location.timestamp, Date.now())).toISOString(), coords.latitude, coords.longitude,
        valid(coords.accuracy, 0, 10_000), valid(coords.altitude, -1000, 100_000), valid(coords.heading, 0, 360), valid(coords.speed, 0, 150),
      );
      sequence += 1; inserted += result.changes;
    }
    db.runSync('UPDATE recording_sessions SET next_sequence=?,updated_at=? WHERE id=?;', sequence, new Date().toISOString(), session.id);
  });
  return inserted;
}

export function recordLocations(locations: LocationObject[]) {
  initializeDatabase();
  const session = activeSession();
  if (!session || session.status !== 'recording') return 0;
  return insertLocationsForSession(session, locations);
}

/** Saves only the terminal fix after the session has entered its finishing fence. */
export function recordFinishingLocation(sessionId: string, location: LocationObject): number {
  initializeDatabase();
  const session = getSession(sessionId);
  if (!session || session.status !== 'finishing') return 0;
  return insertLocationsForSession(session, [location]);
}

export function getSession(sessionId: string) { initializeDatabase(); return db.getFirstSync<SessionRow>('SELECT * FROM recording_sessions WHERE id=? AND owner_user_id=?;', sessionId, getCurrentUser().id); }

export function getSessionSummary(sessionId: string): SessionSummary | null {
  initializeDatabase();
  const row = db.getFirstSync<SessionRow & { point_count: number; queued_count: number; music_queued_count: number; last_accuracy: number | null }>(`
    SELECT s.*, COUNT(p.sequence) AS point_count, COALESCE(SUM(CASE WHEN p.uploaded=0 THEN 1 ELSE 0 END),0) AS queued_count,
      (SELECT COUNT(*) FROM recording_music_observations m WHERE m.session_id=s.id AND m.uploaded=0) AS music_queued_count,
      (SELECT accuracy_meters FROM recording_points WHERE session_id=s.id ORDER BY sequence DESC LIMIT 1) AS last_accuracy
    FROM recording_sessions s LEFT JOIN recording_points p ON p.session_id=s.id WHERE s.id=? AND s.owner_user_id=? GROUP BY s.id;
  `, sessionId, getCurrentUser().id);
  return row ? { id: row.id, deviceId: row.device_id, status: row.status, startedAt: row.started_at, endedAt: row.ended_at,
    pointCount: Number(row.point_count), queuedCount: Number(row.queued_count), musicQueuedCount: Number(row.music_queued_count), remoteCreated: Boolean(row.remote_created), remoteCompleted: Boolean(row.remote_completed), driveId: row.drive_id, lastAccuracyMeters: row.last_accuracy } : null;
}

export function sessionsPendingRemoteCompletion(limit = 5) {
  initializeDatabase();
  return db.getAllSync<{ sessionId: string }>(`
    SELECT s.id AS sessionId FROM recording_sessions s
    WHERE s.owner_user_id=? AND s.status='completed' AND s.remote_completed=0 AND s.ended_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM recording_points p WHERE p.session_id=s.id)
    ORDER BY s.ended_at LIMIT ?;
  `, getCurrentUser().id, Math.max(1, Math.min(20, Math.trunc(limit)))).map(row => row.sessionId);
}

export function queuedPoints(sessionId: string, limit = 250) {
  initializeDatabase();
  if (!getSession(sessionId)) return [];
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
  const recent = db.getAllSync<{ observation_id: string; track: string; artist: string; played_at: string; album: string | null; duration_ms: number | null; artwork_url: string | null; external_url: string | null; confidence: number | null }>(`
    SELECT observation_id,track,artist,played_at,album,duration_ms,artwork_url,external_url,confidence FROM recording_music_observations
    WHERE session_id=? AND source=? ORDER BY played_at DESC LIMIT 8;
  `, sessionId, observation.source);
  const playedAt = Date.parse(observation.playedAt);
  const duplicate = recent.find(row => row.track.toLowerCase() === observation.track.toLowerCase()
    && row.artist.toLowerCase() === observation.artist.toLowerCase()
    && Math.abs(Date.parse(row.played_at) - playedAt) <= 45_000);
  if (duplicate) {
    // The live Apple Music / Tessie sample arrives first without artwork. When
    // MusicKit history returns the richer catalog row, enrich the original
    // playback instead of discarding it as a duplicate.
    const addsMetadata = (observation.album !== null && duplicate.album === null)
      || (observation.durationMs !== null && duplicate.duration_ms === null)
      || (observation.artworkUrl !== null && duplicate.artwork_url === null)
      || (observation.externalUrl !== null && duplicate.external_url === null)
      || (observation.confidence !== null && duplicate.confidence === null);
    if (!addsMetadata) return false;
    const result = db.runSync(`UPDATE recording_music_observations SET
      album=COALESCE(?,album),duration_ms=COALESCE(?,duration_ms),
      artwork_url=COALESCE(?,artwork_url),external_url=COALESCE(?,external_url),
      confidence=COALESCE(?,confidence),uploaded=0
      WHERE session_id=? AND observation_id=?;`,
    observation.album, observation.durationMs, observation.artworkUrl, observation.externalUrl,
    observation.confidence, sessionId, duplicate.observation_id);
    const changed = result.changes > 0;
    if (changed) notifyLocalArchiveChanged();
    return changed;
  }

  const result = db.runSync(`
    INSERT OR IGNORE INTO recording_music_observations(
      session_id,observation_id,source,played_at,track,artist,album,duration_ms,
      artwork_url,external_url,confidence,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?);
  `, sessionId, observation.observationId, observation.source, observation.playedAt,
  observation.track, observation.artist, observation.album, observation.durationMs,
  observation.artworkUrl, observation.externalUrl, observation.confidence, new Date().toISOString());
  const changed = result.changes > 0;
  if (changed) notifyLocalArchiveChanged();
  return changed;
}

export function queuedMusicObservations(sessionId: string, limit = 100) {
  initializeDatabase();
  if (!getSession(sessionId)) return [];
  return db.getAllSync<MusicObservation>(`
    SELECT observation_id AS observationId,source,played_at AS playedAt,track,artist,album,
      duration_ms AS durationMs,artwork_url AS artworkUrl,external_url AS externalUrl,confidence
    FROM recording_music_observations
    WHERE session_id=? AND uploaded=0 ORDER BY played_at,observation_id LIMIT ?;
  `, sessionId, Math.max(1, Math.min(100, Math.trunc(limit))));
}

export function markMusicObservationsUploaded(sessionId: string, observationIds: string[]) {
  initializeDatabase();
  if (!observationIds.length || !getSession(sessionId)) return;
  db.runSync(`UPDATE recording_music_observations SET uploaded=1
    WHERE session_id=? AND observation_id IN (${observationIds.map(() => '?').join(',')});`, sessionId, ...observationIds);
}

export function sessionsWithQueuedMusic(limit = 20) {
  initializeDatabase();
  return db.getAllSync<{ sessionId: string }>(`
    SELECT m.session_id AS sessionId FROM recording_music_observations m
    JOIN recording_sessions s ON s.id=m.session_id
    WHERE s.owner_user_id=? AND m.uploaded=0 GROUP BY m.session_id ORDER BY MIN(m.played_at) LIMIT ?;
  `, getCurrentUser().id, Math.max(1, Math.min(100, Math.trunc(limit)))).map(row => row.sessionId);
}

export function queuedMusicObservationCount(sessionId: string) {
  initializeDatabase();
  if (!getSession(sessionId)) return 0;
  return Number(db.getFirstSync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM recording_music_observations WHERE session_id=? AND uploaded=0;', sessionId,
  )?.total || 0);
}

export function totalQueuedMusicObservationCount() {
  initializeDatabase();
  return Number(db.getFirstSync<{ total: number }>('SELECT COUNT(*) AS total FROM recording_music_observations m JOIN recording_sessions s ON s.id=m.session_id WHERE s.owner_user_id=? AND m.uploaded=0;', getCurrentUser().id)?.total || 0);
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
    SELECT id FROM recording_sessions WHERE owner_user_id=? AND status='completed'
    ORDER BY COALESCE(ended_at,updated_at) DESC LIMIT ?;
  `, getCurrentUser().id, Math.max(1, Math.min(10, Math.trunc(limit))));
  return rows.reduce((count, row) => count + Number(queueLastFmSync(row.id, username)), 0);
}

export function pendingLastFmSyncs(options: { force?: boolean; limit?: number } = {}) {
  initializeDatabase();
  const limit = Math.max(1, Math.min(10, Math.trunc(options.limit ?? 5)));
  const rows = options.force
    ? db.getAllSync<Record<string, unknown>>(`SELECT f.* FROM recording_lastfm_sync f JOIN recording_sessions s ON s.id=f.session_id WHERE s.owner_user_id=? ORDER BY f.updated_at DESC LIMIT ?;`, getCurrentUser().id, limit)
    : db.getAllSync<Record<string, unknown>>(`SELECT f.* FROM recording_lastfm_sync f JOIN recording_sessions s ON s.id=f.session_id WHERE s.owner_user_id=? AND f.status='pending' AND f.next_attempt_at<=? ORDER BY f.next_attempt_at LIMIT ?;`, getCurrentUser().id, new Date().toISOString(), limit);
  return rows.map(row => ({
    sessionId: String(row.session_id), username: String(row.username), status: row.status === 'synced' ? 'synced' : 'pending',
    attemptCount: Number(row.attempt_count) || 0, successCount: Number(row.success_count) || 0,
    nextAttemptAt: String(row.next_attempt_at), lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
  } satisfies LastFmSyncRow));
}

export function markLastFmSyncResult(sessionId: string, success: boolean) {
  initializeDatabase();
  if (!getSession(sessionId)) return;
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
  const scopedKey = `user:${getCurrentUser().id}:${key}`;
  let row = db.getFirstSync<{ value_json: string }>('SELECT value_json FROM recording_app_cache WHERE key=?;', scopedKey);
  if (!row) {
    const ownerKey = '__legacy_cache_owner_v1';
    const owner = db.getFirstSync<{ value_json: string }>('SELECT value_json FROM recording_app_cache WHERE key=?;', ownerKey);
    let ownerId = getCurrentUser().id;
    try { if (owner) ownerId = JSON.parse(owner.value_json) as string; } catch { ownerId = ''; }
    if (!owner) db.runSync('INSERT INTO recording_app_cache(key,value_json,updated_at) VALUES(?,?,?);', ownerKey, JSON.stringify(ownerId), new Date().toISOString());
    if (ownerId === getCurrentUser().id) row = db.getFirstSync<{ value_json: string }>('SELECT value_json FROM recording_app_cache WHERE key=?;', key);
  }
  if (!row) return null;
  try { return JSON.parse(row.value_json) as T; }
  catch { return null; }
}

export function writeAppCache(key: string, value: unknown) {
  initializeDatabase();
  const scopedKey = `user:${getCurrentUser().id}:${key}`;
  const now = new Date().toISOString();
  const valueJson = JSON.stringify(value);
  if (!key || key.length > 200 || typeof valueJson !== 'string' || valueJson.length > 4_194_304) {
    throw new Error('JourneyDeck recorder cache value is invalid or too large.');
  }
  db.runSync(`INSERT INTO recording_app_cache(key,value_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;`, scopedKey, valueJson, now);
}

/** Hard deletion is reserved for the explicit, confirmed account-deletion flow. */
export function deleteCurrentProfileRecorderData(): void {
  initializeDatabase();
  const userId = getCurrentUser().id;
  const prefix = `user:${userId}:`;
  const legacyOwner = db.getFirstSync<{ value_json: string }>("SELECT value_json FROM recording_app_cache WHERE key='__legacy_cache_owner_v1';");
  let ownsLegacyCache = false;
  try { ownsLegacyCache = Boolean(legacyOwner && JSON.parse(legacyOwner.value_json) === userId); } catch { ownsLegacyCache = false; }
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM recording_sessions WHERE owner_user_id=?;', userId);
    db.runSync('DELETE FROM recording_app_cache WHERE substr(key,1,?)=?;', prefix.length, prefix);
    if (ownsLegacyCache) db.runSync("DELETE FROM recording_app_cache WHERE key NOT LIKE 'user:%';");
  });
}

export function markRemoteCreated(sessionId: string) { initializeDatabase(); db.runSync('UPDATE recording_sessions SET remote_created=1,updated_at=? WHERE id=? AND owner_user_id=?;', new Date().toISOString(), sessionId, getCurrentUser().id); }
export function markPointsUploaded(sessionId: string, sequences: number[]) {
  initializeDatabase();
  if (!sequences.length || !getSession(sessionId)) return;
  db.runSync(`UPDATE recording_points SET uploaded=1 WHERE session_id=? AND sequence IN (${sequences.map(() => '?').join(',')});`, sessionId, ...sequences);
}
export function setLocalStatus(sessionId: string, status: Exclude<LocalSessionStatus, 'completed'>) {
  initializeDatabase();
  const endedAt = status === 'finishing' ? new Date().toISOString() : null;
  db.runSync('UPDATE recording_sessions SET status=?,ended_at=COALESCE(?,ended_at),updated_at=? WHERE id=? AND owner_user_id=?;', status, endedAt, new Date().toISOString(), sessionId, getCurrentUser().id);
}

export function recentCompletedSessionIds(limit = 5) {
  initializeDatabase();
  return db.getAllSync<{ id: string }>(`SELECT id FROM recording_sessions WHERE owner_user_id=? AND status='completed' ORDER BY COALESCE(ended_at,updated_at) DESC LIMIT ?;`,
    getCurrentUser().id, Math.max(1, Math.min(10, Math.trunc(limit)))).map(row => row.id);
}

function enqueueCompletionJobInTransaction(
  sessionId: string,
  ownerUserId: string,
  kind: CompletionJobKind,
  now: string,
): void {
  db.runSync(`INSERT INTO recording_jobs(
      id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,
      lease_expires_at,last_error_code,created_at,updated_at,completed_at
    ) VALUES(?,?,?,?, 'pending',0,?,NULL,NULL,?,?,NULL)
    ON CONFLICT(owner_user_id,session_id,kind) DO UPDATE SET
      status=CASE WHEN recording_jobs.status='completed' THEN 'completed' ELSE 'pending' END,
      next_attempt_at=CASE WHEN recording_jobs.status='completed' THEN recording_jobs.next_attempt_at ELSE excluded.next_attempt_at END,
      lease_expires_at=NULL,
      last_error_code=CASE WHEN recording_jobs.status='completed' THEN recording_jobs.last_error_code ELSE NULL END,
      updated_at=excluded.updated_at;`,
  completionJobId(sessionId, kind), ownerUserId, sessionId, kind, now, now, now);
}

function completionJobFromRow(row: Record<string, unknown>): CompletionJob {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    kind: String(row.kind) as CompletionJobKind,
    status: String(row.status) as CompletionJobStatus,
    attemptCount: Number(row.attempt_count) || 0,
    nextAttemptAt: String(row.next_attempt_at),
    leaseExpiresAt: row.lease_expires_at ? String(row.lease_expires_at) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
  };
}

/**
 * Atomically leases one ready completion job. Expired leases are recovered
 * first, which makes app termination during enrichment harmless.
 */
export function claimNextCompletionJob(options: { sessionId?: string; leaseMs?: number; includeRemote?: boolean } = {}): CompletionJob | null {
  initializeDatabase();
  const userId = getCurrentUser().id;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const leaseExpiresAt = new Date(nowDate.getTime() + Math.max(30_000, Math.min(10 * 60_000, options.leaseMs ?? 2 * 60_000))).toISOString();
  let claimed: CompletionJob | null = null;
  db.withTransactionSync(() => {
    db.runSync(`UPDATE recording_jobs SET status='retry',lease_expires_at=NULL,
      last_error_code='lease_expired',next_attempt_at=?,updated_at=?
      WHERE owner_user_id=? AND status='running' AND lease_expires_at<=?;`, now, now, userId, now);
    const sessionClause = options.sessionId ? 'AND j.session_id=?' : '';
    const parameters: (string | number)[] = [userId, now, Number(options.includeRemote ?? false)];
    if (options.sessionId) parameters.push(options.sessionId);
    const row = db.getFirstSync<Record<string, unknown>>(`
      SELECT j.* FROM recording_jobs j
      WHERE j.owner_user_id=? AND j.status IN ('pending','retry') AND j.next_attempt_at<=?
        AND (?=1 OR j.kind<>'remote_completion')
        ${sessionClause}
        AND (
          j.kind='archive_mirror'
          OR (j.kind='apple_music_history' AND EXISTS(
            SELECT 1 FROM recording_jobs dependency
            WHERE dependency.owner_user_id=j.owner_user_id AND dependency.session_id=j.session_id
              AND dependency.kind='archive_mirror' AND dependency.status='completed'))
          OR (j.kind IN ('private_cloud_sync','remote_completion') AND EXISTS(
            SELECT 1 FROM recording_jobs dependency
            WHERE dependency.owner_user_id=j.owner_user_id AND dependency.session_id=j.session_id
              AND dependency.kind='archive_mirror' AND dependency.status='completed') AND EXISTS(
            SELECT 1 FROM recording_jobs enrichment
            WHERE enrichment.owner_user_id=j.owner_user_id AND enrichment.session_id=j.session_id
              AND enrichment.kind='apple_music_history' AND enrichment.status='completed'))
        )
      ORDER BY CASE j.kind
        WHEN 'archive_mirror' THEN 1 WHEN 'apple_music_history' THEN 2
        WHEN 'private_cloud_sync' THEN 3 ELSE 4 END,
        j.created_at,j.id
      LIMIT 1;
    `, ...parameters);
    if (!row) return;
    const result = db.runSync(`UPDATE recording_jobs SET status='running',attempt_count=attempt_count+1,
      lease_expires_at=?,last_error_code=NULL,updated_at=?
      WHERE id=? AND owner_user_id=? AND status IN ('pending','retry');`, leaseExpiresAt, now, String(row.id), userId);
    if (result.changes > 0) {
      claimed = completionJobFromRow({ ...row, status: 'running', attempt_count: Number(row.attempt_count) + 1, lease_expires_at: leaseExpiresAt, last_error_code: null });
    }
  });
  return claimed;
}

export function markCompletionJobSucceeded(jobId: string): void {
  initializeDatabase();
  const now = new Date().toISOString();
  db.runSync(`UPDATE recording_jobs SET status='completed',lease_expires_at=NULL,last_error_code=NULL,
    completed_at=?,next_attempt_at=?,updated_at=? WHERE id=? AND owner_user_id=?;`,
  now, now, now, jobId, getCurrentUser().id);
}

export function markCompletionJobForRetry(jobId: string, errorCode: string, attemptCount: number): void {
  initializeDatabase();
  const nowDate = new Date();
  const exponent = Math.max(0, Math.min(10, Math.trunc(attemptCount) - 1));
  const delayMs = Math.min(6 * 60 * 60_000, 15_000 * (2 ** exponent));
  const code = /^[a-z0-9_]{1,64}$/.test(errorCode) ? errorCode : 'completion_job_failed';
  db.runSync(`UPDATE recording_jobs SET status='retry',lease_expires_at=NULL,last_error_code=?,
    completed_at=NULL,next_attempt_at=?,updated_at=? WHERE id=? AND owner_user_id=?;`,
  code, new Date(nowDate.getTime() + delayMs).toISOString(), nowDate.toISOString(), jobId, getCurrentUser().id);
}

export function pendingCompletionJobCount(): number {
  initializeDatabase();
  return Number(db.getFirstSync<{ total: number }>(`SELECT COUNT(*) AS total FROM recording_jobs
    WHERE owner_user_id=? AND status<>'completed';`, getCurrentUser().id)?.total ?? 0);
}

export function totalQueuedPointCount() {
  initializeDatabase();
  return Number(db.getFirstSync<{ total: number }>('SELECT COUNT(*) AS total FROM recording_points p JOIN recording_sessions s ON s.id=p.session_id WHERE s.owner_user_id=? AND p.uploaded=0;', getCurrentUser().id)?.total || 0);
}

export type RecorderDatabaseIntegrityReport = {
  database: 'journeydeck-recorder.db';
  applicationId: number;
  schemaVersion: number;
  quickCheck: 'ok' | 'failed';
  foreignKeyViolationCount: number;
  duplicateActiveOwnerCount: number;
  invalidValueCount: number;
  pendingCompletionJobCount: number;
  expiredCompletionLeaseCount: number;
  ok: boolean;
};

/** Read-only structural and logical audit for the recorder queue database. */
export function recorderDatabaseIntegrityReport(): RecorderDatabaseIntegrityReport {
  initializeDatabase();
  const quickRow = db.getFirstSync<Record<string, unknown>>('PRAGMA quick_check(1);');
  const quickCheck = String(Object.values(quickRow ?? {})[0] ?? '').toLowerCase() === 'ok' ? 'ok' : 'failed';
  const foreignKeyViolationCount = db.getAllSync<Record<string, unknown>>('PRAGMA foreign_key_check;').length;
  const duplicateActiveOwnerCount = Number(db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM (
    SELECT owner_user_id FROM recording_sessions WHERE status<>'completed'
    GROUP BY owner_user_id HAVING COUNT(*)>1
  );`)?.n ?? 0);
  const invalidValueCount = Number(db.getFirstSync<{ n: number }>(`SELECT
    (SELECT COUNT(*) FROM recording_sessions WHERE owner_user_id IS NULL OR trim(owner_user_id)=''
      OR next_sequence<0 OR remote_created NOT IN (0,1) OR remote_completed NOT IN (0,1)) +
    (SELECT COUNT(*) FROM recording_points WHERE sequence<0 OR latitude NOT BETWEEN -90 AND 90
      OR longitude NOT BETWEEN -180 AND 180 OR uploaded NOT IN (0,1)) +
    (SELECT COUNT(*) FROM recording_music_observations WHERE trim(track)='' OR trim(artist)=''
      OR uploaded NOT IN (0,1)) +
    (SELECT COUNT(*) FROM recording_app_cache WHERE json_valid(value_json)=0) +
    (SELECT COUNT(*) FROM recording_jobs WHERE attempt_count<0 OR julianday(next_attempt_at) IS NULL
      OR (status='running' AND julianday(lease_expires_at) IS NULL)
      OR (status<>'running' AND lease_expires_at IS NOT NULL)
      OR (status='completed' AND julianday(completed_at) IS NULL))
    AS n;`)?.n ?? 0);
  const pendingCompletionJobCount = Number(db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n
    FROM recording_jobs WHERE owner_user_id=? AND status<>'completed';`, getCurrentUser().id)?.n ?? 0);
  const expiredCompletionLeaseCount = Number(db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n
    FROM recording_jobs WHERE owner_user_id=? AND status='running' AND lease_expires_at<=?;`,
  getCurrentUser().id, new Date().toISOString())?.n ?? 0);
  const ok = quickCheck === 'ok' && foreignKeyViolationCount === 0
    && duplicateActiveOwnerCount === 0 && invalidValueCount === 0;
  return {
    database: 'journeydeck-recorder.db',
    applicationId: Number(db.getFirstSync<{ application_id: number }>('PRAGMA application_id;')?.application_id ?? 0),
    schemaVersion: Number(db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version ?? 0),
    quickCheck,
    foreignKeyViolationCount,
    duplicateActiveOwnerCount,
    invalidValueCount,
    pendingCompletionJobCount,
    expiredCompletionLeaseCount,
    ok,
  };
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

function stableImportHash(value: string) {
  let first = 0x811c9dc5, second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

function mirrorCompletedSessionToLocalStore(sessionId: string): void {
  const session = getSession(sessionId);
  if (!session?.ended_at) return;
  const user = getCurrentUser();
  const points = db.getAllSync<QueuedPoint>(`SELECT sequence,recorded_at AS recordedAt,latitude,longitude,
    accuracy_meters AS accuracyMeters,altitude_meters AS altitudeMeters,
    heading_degrees AS headingDegrees,speed_mps AS speedMps
    FROM recording_points WHERE session_id=? ORDER BY sequence;`, sessionId).filter(point =>
    Number.isInteger(point.sequence) && point.sequence >= 0 && Number.isFinite(Date.parse(point.recordedAt))
      && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
      && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180);
  const music = db.getAllSync<MusicObservation>(`SELECT observation_id AS observationId,source,
    played_at AS playedAt,track,artist,album,duration_ms AS durationMs,
    artwork_url AS artworkUrl,external_url AS externalUrl,confidence
    FROM recording_music_observations WHERE session_id=? ORDER BY played_at,observation_id;`, sessionId)
    .map(observation => normalizeMusicObservation(observation)).filter((observation): observation is MusicObservation => observation !== null);
  const durationMinutes = Math.max(0, (Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000);
  const meters = points.slice(1).reduce((total, point, index) => total + distanceMeters(points[index]!, point), 0);
  const miles = meters / 1609.344;
  const speedMph = points.map(point => point.speedMps == null ? 0 : point.speedMps * 2.2369362921);
  const journeyId = archivedJourneyIdForSession(session.id);

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
  refreshJourneySongCount(user.id, journeyId);
  rebuildAtlasSnapshot(user.id);
  notifyLocalArchiveChanged();
}

export function saveImportedMusicForCompletedSession(sessionId: string, source: 'lastfm' | 'spotify', tracks: ImportedMusicTrack[]) {
  initializeDatabase();
  const session = getSession(sessionId);
  if (!session?.ended_at || session.status !== 'completed') throw new Error('That journey is not ready for music matching.');
  mirrorCompletedSessionToLocalStore(sessionId);
  const user = getCurrentUser(), journeyId = archivedJourneyIdForSession(sessionId);
  const before = listMusicEntriesForJourney(user.id, journeyId).length;
  const start = Date.parse(session.started_at) - 120_000, end = Date.parse(session.ended_at) + 120_000;
  for (const track of tracks) {
    const playedAt = Date.parse(track.playedAt);
    if (!Number.isFinite(playedAt) || playedAt < start || playedAt > end) continue;
    const identity = `${source}\0${track.track.toLowerCase()}\0${track.artist.toLowerCase()}\0${Math.round(playedAt / 30_000)}`;
    upsertMusicEntry({
      id: `${journeyId}_import_${source}_${stableImportHash(identity)}`, userId: user.id, journeyId, source,
      playedAt: new Date(playedAt).toISOString(), track: track.track, artist: track.artist, album: track.album,
      durationMs: track.durationMs ?? null, artworkUrl: track.artworkUrl ?? null, externalUrl: track.externalUrl ?? null, confidence: null,
    });
  }
  const total = refreshJourneySongCount(user.id, journeyId);
  rebuildAtlasSnapshot(user.id);
  notifyLocalArchiveChanged();
  return Math.max(0, total - before);
}

export function completeSessionLocally(sessionId: string, queueRemote = true) {
  initializeDatabase();
  const session = getSession(sessionId);
  if (!session) return false;
  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    db.runSync("UPDATE recording_sessions SET status='completed',remote_completed=CASE WHEN ? THEN remote_completed ELSE 1 END,ended_at=COALESCE(ended_at,?),updated_at=? WHERE id=? AND owner_user_id=?;", Number(queueRemote), now, now, sessionId, session.owner_user_id);
    enqueueCompletionJobInTransaction(sessionId, session.owner_user_id, 'archive_mirror', now);
    enqueueCompletionJobInTransaction(sessionId, session.owner_user_id, 'apple_music_history', now);
    enqueueCompletionJobInTransaction(sessionId, session.owner_user_id, 'private_cloud_sync', now);
    if (queueRemote) enqueueCompletionJobInTransaction(sessionId, session.owner_user_id, 'remote_completion', now);
  });
  return refreshCompletedSessionLocalMirror(sessionId);
}

export function refreshCompletedSessionLocalMirror(sessionId: string): boolean {
  initializeDatabase();
  const jobId = completionJobId(sessionId, 'archive_mirror');
  try {
    mirrorCompletedSessionToLocalStore(sessionId);
    markCompletionJobSucceeded(jobId);
    return true;
  } catch {
    markCompletionJobForRetry(jobId, 'archive_mirror_failed', 1);
    return false;
  }
}

/** Removes a start attempt that never became a valid journey. */
export function abandonLocalSession(sessionId: string): void {
  initializeDatabase();
  db.runSync(`DELETE FROM recording_sessions WHERE id=? AND owner_user_id=? AND status<>'completed';`,
    sessionId, getCurrentUser().id);
}

export function markSessionRemoteCompleted(sessionId: string, driveId: string | null) {
  initializeDatabase();
  if (!getSession(sessionId)) return;
  const now = new Date().toISOString();
  db.runSync("UPDATE recording_sessions SET status='completed',remote_created=1,remote_completed=1,drive_id=COALESCE(?,drive_id),ended_at=COALESCE(ended_at,?),updated_at=? WHERE id=? AND owner_user_id=?;", driveId, now, now, sessionId, getCurrentUser().id);
  refreshCompletedSessionLocalMirror(sessionId);
  markCompletionJobSucceeded(completionJobId(sessionId, 'remote_completion'));
}
