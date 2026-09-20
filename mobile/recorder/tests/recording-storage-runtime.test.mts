import * as markerModel from '../src/journey-marker-model.ts';
import { JOURNEY_MARKER_SCHEMA_SQL, JOURNEY_MARKER_SYNC_SCHEMA_SQL } from '../src/journey-marker-schema.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { RECORDER_DATABASE_HARDENING_SQL, SQLITE_CONNECTION_HARDENING_SQL, UNIFIED_DATABASE_SCHEMA_SQL } from '../src/database-hardening.ts';
import * as inboxModel from '../src/native-recorder-inbox-model.ts';
import { evaluateManualRecordingFailsafe } from '../src/manual-recording-failsafe.ts';
import type { NativeRecorderInboxSession } from '../modules/journeydeck-recorder/src/JourneyDeckRecorder.types.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE local_users(id TEXT PRIMARY KEY); INSERT INTO local_users VALUES('owner');
    CREATE TABLE local_places(id TEXT PRIMARY KEY,user_id TEXT,created_at TEXT);`);
  database.exec(UNIFIED_DATABASE_SCHEMA_SQL.slice(UNIFIED_DATABASE_SCHEMA_SQL.indexOf('CREATE TABLE IF NOT EXISTS local_migration_state')));
  database.exec(RECORDER_DATABASE_HARDENING_SQL);
  database.exec(JOURNEY_MARKER_SCHEMA_SQL);
  database.exec(JOURNEY_MARKER_SYNC_SCHEMA_SQL);
  const db = {
    execSync: (sql: string) => database.exec(sql),
    runSync: (sql: string, ...params: any[]) => database.prepare(sql).run(...params),
    getFirstSync: (sql: string, ...params: any[]) => database.prepare(sql).get(...params) ?? null,
    getAllSync: (sql: string, ...params: any[]) => database.prepare(sql).all(...params),
    withTransactionSync(work: () => void) {
      database.exec('BEGIN IMMEDIATE');
      try { work(); database.exec('COMMIT'); } catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
  const archive = new Map();
  const dependencies: Record<string, any> = {
    'expo-crypto': { randomUUID },
    './auth': { getCurrentUser: () => ({ id: 'owner' }) },
    './database-owner': { getRecorderDatabase: () => db },
    './local-store': { initializeLocalStore() {}, upsertJourney: (value: any) => archive.set(value.id, value),
      insertGpsPoints() {}, listMusicEntriesForJourney: () => [], refreshJourneySongCount() {}, upsertMusicEntry() {} },
    './local-atlas': { rebuildAtlasSnapshot() {} },
    './local-archive-events': { notifyLocalArchiveChanged() {} },
    './database-hardening': { SQLITE_CONNECTION_HARDENING_SQL },
    './unified-data-migration': { migrateLegacyRecorderIntoUnifiedDatabase() {} },
    './native-recorder-inbox-model': inboxModel,
    './journey-marker-model': markerModel,
    './music-observations': { normalizeMusicObservation: (value: any) => value },
    './music-playback-dedupe': { findDuplicatePlayback: () => null },
  };
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(name in dependencies, `unexpected dependency: ${name}`);
    return dependencies[name];
  }, console, Date, Math, JSON });
  exports.initializeDatabase();
  return { storage: exports, database, archive };
}

function nativeSession(id: string, status: NativeRecorderInboxSession['status'] = 'recording', sequences = [0, 1, 2]): NativeRecorderInboxSession {
  return { id: `native_recording_manual_${id}`, ownerUserId: 'owner', deviceId: 'phone', status,
    startedAt: '2026-09-07T12:00:00.000Z', endedAt: status === 'completed' ? '2026-09-07T12:10:00.000Z' : null,
    createdAt: '2026-09-07T12:00:00.000Z', updatedAt: '2026-09-07T12:10:00.000Z', nextSequence: 3,
    points: sequences.map(sequence => ({ sequence, recordedAt: `2026-09-07T12:00:0${sequence}.000Z`,
      latitude: 0, longitude: 0, accuracyMeters: 5, altitudeMeters: null, headingDegrees: null, speedMps: 0 })) };
}

const capturedMarker = { id: `marker_${randomUUID()}`, capturedAt: '2026-09-07T12:00:03.000Z',
  locationAt: '2026-09-07T12:00:02.000Z', latitude: 0, longitude: 0, accuracyMeters: 5 };

test('native markers import exactly once, preserve notes, and survive completion acknowledgement', () => {
  const { storage, database } = fixture();
  try {
    const session = { ...nativeSession('markers'), markers: [capturedMarker] };
    storage.importNativeRecorderInbox({ sessions: [session], errorCode: null });
    database.prepare('UPDATE local_journey_markers SET notes=? WHERE id=?').run('Remember this', capturedMarker.id);
    storage.importNativeRecorderInbox({ sessions: [session], errorCode: null });
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM local_journey_markers').get()?.n, 1);
    assert.equal(database.prepare('SELECT notes FROM local_journey_markers').get()?.notes, 'Remember this');
    const ack = storage.importNativeRecorderInbox({ sessions: [{ ...session, status: 'completed', endedAt: '2026-09-07T12:10:00.000Z' }], errorCode: null });
    assert.deepEqual(Array.from(ack), [session.id]);
    assert.equal(database.prepare('SELECT root_journey_id FROM local_journey_markers').get()?.root_journey_id, `local_${session.id}`);
  } finally { database.close(); }
});

test('marker write failure rolls back the route import so native data cannot be acknowledged', () => {
  const { storage, database } = fixture();
  try {
    database.exec("CREATE TRIGGER fail_marker BEFORE INSERT ON local_journey_markers BEGIN SELECT RAISE(ABORT,'disk full'); END;");
    const session = { ...nativeSession('failed', 'completed'), markers: [capturedMarker] };
    assert.throws(() => storage.importNativeRecorderInbox({ sessions: [session], errorCode: null }), /disk full/);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM recording_sessions').get()?.n, 0);
    database.exec('DROP TRIGGER fail_marker');
    assert.equal(storage.importNativeRecorderInbox({ sessions: [session], errorCode: null }).length, 1);
  } finally { database.close(); }
});

test('foreign-profile and malformed markers are never imported', () => {
  const { storage, database } = fixture();
  try {
    const session = { ...nativeSession('foreign'), ownerUserId: 'other', markers: [capturedMarker] };
    assert.equal(storage.importNativeRecorderInbox({ sessions: [session], errorCode: null }).length, 0);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM local_journey_markers').get()?.n, 0);
    assert.throws(() => storage.importNativeRecorderInbox({ sessions: [{ ...session, ownerUserId: 'owner', markers: [{ ...capturedMarker, latitude: 100 }] }], errorCode: null }), /Invalid native marker/);
  } finally { database.close(); }
});

test('failsafe reads ten minutes of dense GPS even when the UI tail is only 500 points', () => {
  const { storage, database } = fixture();
  try {
    const session = storage.beginLocalSession('phone');
    const start = Date.parse(session.started_at);
    const insert = database.prepare(`INSERT INTO recording_points(session_id,sequence,recorded_at,latitude,longitude,accuracy_meters,speed_mps)
      VALUES(?,?,?,0,0,5,0)`);
    for (let i = 0; i <= 1200; i++) insert.run(session.id, i, new Date(start + i * 1000).toISOString());
    const evaluatedAtMs = start + 1200_000;
    assert.equal(evaluateManualRecordingFailsafe({ ...storage.getLiveRecorderSnapshot(), evaluatedAtMs }).shouldFinish, false);
    const snapshot = storage.getManualRecordingFailsafeSnapshot(evaluatedAtMs);
    assert.equal(snapshot.route.length, 901);
    assert.equal(evaluateManualRecordingFailsafe({ ...snapshot, evaluatedAtMs }).shouldFinish, true);
    assert.equal(storage.claimManualSessionForFailsafeFinish(session.id), true);
    assert.equal(storage.claimManualSessionForFailsafeFinish(session.id), false);
    storage.completeSessionLocally(session.id, false);
    assert.equal(storage.activeSession(), null);
  } finally { database.close(); }
});

test('Watch stop A then start B imports the completed route before the new active mirror', () => {
  const { storage, database } = fixture();
  try {
    const first = nativeSession('first');
    storage.importNativeRecorderInbox({ sessions: [first], errorCode: null });
    const second = nativeSession('second');
    const acknowledged = storage.importNativeRecorderInbox({ sessions: [second, { ...first, status: 'completed', endedAt: '2026-09-07T12:10:00.000Z' }], errorCode: null });
    assert.deepEqual(Array.from(acknowledged), [first.id]);
    assert.equal(storage.activeSession().id, second.id);
    assert.equal(storage.getSession(first.id).status, 'completed');
  } finally { database.close(); }
});

test('completed native backlog does not block location updates for a currently mirrored journey', () => {
  const { storage, database } = fixture();
  try {
    const active = nativeSession('active');
    storage.importNativeRecorderInbox({ sessions: [active], errorCode: null });
    const backlog = nativeSession('backlog', 'completed');
    assert.deepEqual(Array.from(storage.importNativeRecorderInbox({ sessions: [active, backlog], errorCode: null })), []);
    assert.equal(storage.activeSession().id, active.id);
    assert.equal(storage.getSession(backlog.id), null, 'unimported route stays in native inbox for a subsequent pass');
    assert.deepEqual(Array.from(storage.importNativeRecorderInbox({ sessions: [{ ...active, status: 'completed', endedAt: backlog.endedAt }, backlog], errorCode: null })), [active.id, backlog.id]);
  } finally { database.close(); }
});

test('a missing interior route point is replayed and acknowledged only after repair', () => {
  const { storage, database } = fixture();
  try {
    const incomplete = nativeSession('gap', 'completed', [0, 2]);
    assert.deepEqual(Array.from(storage.importNativeRecorderInbox({ sessions: [incomplete], errorCode: null })), []);
    assert.equal(storage.nativeRecorderInboxCursors()[incomplete.id], 0);
    assert.equal(storage.getSession(incomplete.id).status, 'finishing');
    assert.deepEqual(Array.from(storage.importNativeRecorderInbox({ sessions: [nativeSession('gap', 'completed')], errorCode: null })), [incomplete.id]);
    assert.equal(storage.nativeRecorderInboxCursors()[incomplete.id], 3);
  } finally { database.close(); }
});

test('a repeated native completion after an acknowledgement failure preserves an active worker lease', () => {
  const { storage, database } = fixture();
  try {
    const complete = nativeSession('retry', 'completed');
    storage.importNativeRecorderInbox({ sessions: [complete], errorCode: null });
    const job = storage.claimNextCompletionJob({ sessionId: complete.id });
    assert.ok(job);
    storage.importNativeRecorderInbox({ sessions: [complete], errorCode: null });
    const current = database.prepare('SELECT status,lease_expires_at FROM recording_jobs WHERE id=?').get(job.id);
    assert.equal(current?.status, 'running');
    assert.equal(current?.lease_expires_at, job.leaseExpiresAt);
    assert.equal(storage.claimNextCompletionJob({ sessionId: complete.id }), null);
  } finally { database.close(); }
});

test('a long recorded route archives without spreading every sample onto the JavaScript call stack', () => {
  const { storage, database, archive } = fixture();
  try {
    const session = storage.beginLocalSession('phone');
    database.prepare(`WITH RECURSIVE samples(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM samples WHERE n<149999)
      INSERT INTO recording_points(session_id,sequence,recorded_at,latitude,longitude,speed_mps)
      SELECT ?,n,'2026-09-07T12:00:00.000Z',0,0,CASE WHEN n=149999 THEN 30 ELSE 10 END FROM samples`).run(session.id);
    assert.equal(storage.completeSessionLocally(session.id, false), true);
    assert.equal(archive.get(`local_${session.id}`).maxSpeedMph, 30 * 2.2369362921);
  } finally { database.close(); }
});

test('a late worker cannot complete or retry a job after its expired lease was reclaimed', () => {
  const { storage, database } = fixture();
  try {
    const complete = nativeSession('lease', 'completed');
    storage.importNativeRecorderInbox({ sessions: [complete], errorCode: null });
    const first = storage.claimNextCompletionJob({ sessionId: complete.id });
    database.prepare("UPDATE recording_jobs SET lease_expires_at='2026-01-01T00:00:00.000Z' WHERE id=?").run(first.id);
    const second = storage.claimNextCompletionJob({ sessionId: complete.id });
    assert.equal(second.attemptCount, first.attemptCount + 1);
    storage.markCompletionJobSucceeded(first.id, first);
    assert.equal(database.prepare('SELECT status FROM recording_jobs WHERE id=?').get(first.id)?.status, 'running');
    storage.markCompletionJobForRetry(first.id, 'late_failure', first.attemptCount, 0, first);
    assert.equal(database.prepare('SELECT status FROM recording_jobs WHERE id=?').get(first.id)?.status, 'running');
    storage.markCompletionJobSucceeded(second.id, second);
    assert.equal(database.prepare('SELECT status FROM recording_jobs WHERE id=?').get(first.id)?.status, 'completed');
  } finally { database.close(); }
});
