import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { LocationObject } from 'expo-location';

const db = SQLite.openDatabaseSync('journeydeck-recorder.db');
let initialized = false;
export type LocalSessionStatus = 'recording' | 'paused' | 'finishing' | 'completed';
export type SessionRow = { id: string; device_id: string; status: LocalSessionStatus; started_at: string; ended_at: string | null; next_sequence: number; remote_created: number; drive_id: string | null };
export type SessionSummary = { id: string; deviceId: string; status: LocalSessionStatus; startedAt: string; endedAt: string | null; pointCount: number; queuedCount: number; remoteCreated: boolean; driveId: string | null; lastAccuracyMeters: number | null };
export type QueuedPoint = { sequence: number; recordedAt: string; latitude: number; longitude: number; accuracyMeters: number | null; altitudeMeters: number | null; headingDegrees: number | null; speedMps: number | null };

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
  const row = db.getFirstSync<SessionRow & { point_count: number; queued_count: number; last_accuracy: number | null }>(`
    SELECT s.*, COUNT(p.sequence) AS point_count, COALESCE(SUM(CASE WHEN p.uploaded=0 THEN 1 ELSE 0 END),0) AS queued_count,
      (SELECT accuracy_meters FROM recording_points WHERE session_id=s.id ORDER BY sequence DESC LIMIT 1) AS last_accuracy
    FROM recording_sessions s LEFT JOIN recording_points p ON p.session_id=s.id WHERE s.id=? GROUP BY s.id;
  `, sessionId);
  return row ? { id: row.id, deviceId: row.device_id, status: row.status, startedAt: row.started_at, endedAt: row.ended_at,
    pointCount: Number(row.point_count), queuedCount: Number(row.queued_count), remoteCreated: Boolean(row.remote_created), driveId: row.drive_id, lastAccuracyMeters: row.last_accuracy } : null;
}

export function queuedPoints(sessionId: string, limit = 250) {
  initializeDatabase();
  return db.getAllSync<QueuedPoint>(`SELECT sequence,recorded_at AS recordedAt,latitude,longitude,accuracy_meters AS accuracyMeters,
    altitude_meters AS altitudeMeters,heading_degrees AS headingDegrees,speed_mps AS speedMps
    FROM recording_points WHERE session_id=? AND uploaded=0 ORDER BY sequence LIMIT ?;`, sessionId, limit);
}

export function markRemoteCreated(sessionId: string) { db.runSync('UPDATE recording_sessions SET remote_created=1,updated_at=? WHERE id=?;', new Date().toISOString(), sessionId); }
export function markPointsUploaded(sessionId: string, sequences: number[]) {
  if (!sequences.length) return;
  db.runSync(`UPDATE recording_points SET uploaded=1 WHERE session_id=? AND sequence IN (${sequences.map(() => '?').join(',')});`, sessionId, ...sequences);
}
export function setLocalStatus(sessionId: string, status: Exclude<LocalSessionStatus, 'completed'>) {
  const endedAt = status === 'finishing' ? new Date().toISOString() : null;
  db.runSync('UPDATE recording_sessions SET status=?,ended_at=COALESCE(?,ended_at),updated_at=? WHERE id=?;', status, endedAt, new Date().toISOString(), sessionId);
}
export function markSessionCompleted(sessionId: string, driveId: string | null) {
  const now = new Date().toISOString();
  db.runSync("UPDATE recording_sessions SET status='completed',drive_id=?,ended_at=COALESCE(ended_at,?),updated_at=? WHERE id=?;", driveId, now, now, sessionId);
}
