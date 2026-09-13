import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { RECORDER_DATABASE_HARDENING_SQL, SQLITE_CONNECTION_HARDENING_SQL, UNIFIED_DATABASE_SCHEMA_SQL } from '../../src/database-hardening.ts';
import * as inboxModel from '../../src/native-recorder-inbox-model.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync(new URL('../../src/storage.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

export function fixture(path = ':memory:') {
  const database = new DatabaseSync(path);
  database.exec(`CREATE TABLE IF NOT EXISTS local_users(id TEXT PRIMARY KEY);
    INSERT OR IGNORE INTO local_users VALUES('owner');
    CREATE TABLE IF NOT EXISTS local_places(id TEXT PRIMARY KEY,user_id TEXT,created_at TEXT);`);
  database.exec(UNIFIED_DATABASE_SCHEMA_SQL.slice(UNIFIED_DATABASE_SCHEMA_SQL.indexOf('CREATE TABLE IF NOT EXISTS local_migration_state')));
  database.exec(RECORDER_DATABASE_HARDENING_SQL);
  const hooks = { before: (_sql: string) => {}, after: (_sql: string) => {}, archive: () => {} };
  const db = {
    execSync: (sql: string) => database.exec(sql),
    runSync: (sql: string, ...params: any[]) => {
      hooks.before(sql); const result = database.prepare(sql).run(...params); hooks.after(sql); return result;
    },
    getFirstSync: (sql: string, ...params: any[]) => database.prepare(sql).get(...params) ?? null,
    getAllSync: (sql: string, ...params: any[]) => database.prepare(sql).all(...params),
    withTransactionSync(work: () => void) {
      hooks.before('BEGIN IMMEDIATE'); database.exec('BEGIN IMMEDIATE'); hooks.after('BEGIN IMMEDIATE');
      try {
        work(); hooks.before('COMMIT'); database.exec('COMMIT'); hooks.after('COMMIT');
      } catch (error) {
        // SQLITE_FULL can cause SQLite itself to roll back the transaction.
        // Preserve the original failure in that case, as Expo's wrapper does.
        try { database.exec('ROLLBACK'); } catch {}
        throw error;
      }
    },
  };
  const archive = new Map();
  const dependencies: Record<string, any> = {
    'expo-crypto': { randomUUID }, './auth': { getCurrentUser: () => ({ id: 'owner' }) },
    './database-owner': { getRecorderDatabase: () => db },
    './local-store': { initializeLocalStore() {}, upsertJourney: (value: any) => { hooks.archive(); archive.set(value.id, value); },
      insertGpsPoints() {}, listMusicEntriesForJourney: () => [], refreshJourneySongCount() {}, upsertMusicEntry() {} },
    './local-atlas': { rebuildAtlasSnapshot() {} }, './local-archive-events': { notifyLocalArchiveChanged() {} },
    './database-hardening': { SQLITE_CONNECTION_HARDENING_SQL },
    './unified-data-migration': { migrateLegacyRecorderIntoUnifiedDatabase() {} },
    './native-recorder-inbox-model': inboxModel,
    './music-observations': { normalizeMusicObservation: (value: any) => value },
    './music-playback-dedupe': { findDuplicatePlayback: () => null },
  };
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(name in dependencies, `unexpected dependency: ${name}`); return dependencies[name];
  }, console, Date, Math, JSON });
  exports.initializeDatabase();
  return { storage: exports, database, archive, hooks };
}

export function location(timestamp: number, latitude = 0) {
  return { timestamp, coords: { latitude, longitude: 0, accuracy: 5, altitude: null, heading: null, speed: 0 } };
}

export function seedLegacy(h: ReturnType<typeof fixture>) {
  const session = h.storage.beginLocalSession('test-phone', Date.now() - 60_000);
  const start = Date.parse(session.started_at);
  h.storage.recordLocations([location(start), location(start + 1000)]);
  return session;
}

export function completedNative() {
  const startedAt = '2026-09-12T12:00:00.000Z';
  return { sessions: [{ id: 'native_recording_manual_test', ownerUserId: 'owner', deviceId: 'test-phone',
    status: 'completed', startedAt, endedAt: '2026-09-12T12:10:00.000Z', createdAt: startedAt,
    updatedAt: '2026-09-12T12:10:00.000Z', nextSequence: 3,
    points: [0, 1, 2].map(sequence => ({ sequence, recordedAt: new Date(Date.parse(startedAt) + sequence * 1000).toISOString(),
      latitude: 0, longitude: 0, accuracyMeters: 5, altitudeMeters: null, headingDegrees: null, speedMps: 0 })) }], errorCode: null };
}
