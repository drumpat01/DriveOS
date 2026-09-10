import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { RECORDER_DATABASE_HARDENING_SQL, SQLITE_CONNECTION_HARDENING_SQL, UNIFIED_DATABASE_SCHEMA_SQL } from '../src/database-hardening.ts';
import * as inboxModel from '../src/native-recorder-inbox-model.ts';
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
