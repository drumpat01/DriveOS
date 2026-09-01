import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  RECORDER_DATABASE_HARDENING_SQL,
  UNIFIED_DATABASE_SCHEMA_SQL,
} from '../src/database-hardening.ts';
import { legacyRecorderImportSql } from '../src/legacy-recorder-import.ts';

test('legacy recorder data copies into the unified schema without changing the source', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journeydeck-unified-'));
  const legacyPath = join(directory, 'journeydeck-recorder.db');
  const legacy = new DatabaseSync(legacyPath);
  legacy.exec(`PRAGMA application_id=1245991473; PRAGMA user_version=2; PRAGMA foreign_keys=ON;
    CREATE TABLE recording_sessions(id TEXT PRIMARY KEY,owner_user_id TEXT,device_id TEXT,status TEXT,started_at TEXT,ended_at TEXT,next_sequence INTEGER,remote_created INTEGER,remote_completed INTEGER,drive_id TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE recording_points(session_id TEXT,sequence INTEGER,recorded_at TEXT,latitude REAL,longitude REAL,accuracy_meters REAL,altitude_meters REAL,heading_degrees REAL,speed_mps REAL,uploaded INTEGER,PRIMARY KEY(session_id,sequence));
    CREATE TABLE recording_music_observations(session_id TEXT,observation_id TEXT,source TEXT,played_at TEXT,track TEXT,artist TEXT,album TEXT,duration_ms INTEGER,artwork_url TEXT,external_url TEXT,confidence REAL,uploaded INTEGER,created_at TEXT,PRIMARY KEY(session_id,observation_id));
    CREATE TABLE recording_lastfm_sync(session_id TEXT PRIMARY KEY,username TEXT,status TEXT,attempt_count INTEGER,success_count INTEGER,next_attempt_at TEXT,last_attempt_at TEXT,updated_at TEXT);
    CREATE TABLE recording_app_cache(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
    CREATE TABLE recording_jobs(id TEXT PRIMARY KEY,owner_user_id TEXT,session_id TEXT,kind TEXT,status TEXT,attempt_count INTEGER,next_attempt_at TEXT,lease_expires_at TEXT,last_error_code TEXT,created_at TEXT,updated_at TEXT,completed_at TEXT);
    INSERT INTO recording_sessions VALUES('session-a','user-a','phone','completed','2026-08-31T12:00:00.000Z','2026-08-31T12:10:00.000Z',1,1,0,NULL,'2026-08-31T12:00:00.000Z','2026-08-31T12:10:00.000Z');
    INSERT INTO recording_points VALUES('session-a',0,'2026-08-31T12:01:00.000Z',32.8,-97.2,5,NULL,90,10,0);
    INSERT INTO recording_music_observations VALUES('session-a','song-a','apple_music','2026-08-31T12:02:00.000Z','Song','Artist','Album',180000,'https://example.com/cover.jpg',NULL,1,0,'2026-08-31T12:02:00.000Z');
    INSERT INTO recording_lastfm_sync VALUES('session-a','listener','pending',1,0,'2026-08-31T12:11:00.000Z',NULL,'2026-08-31T12:10:00.000Z');
    INSERT INTO recording_app_cache VALUES('user:user-a:test','{"safe":true}','2026-08-31T12:10:00.000Z');
    INSERT INTO recording_jobs VALUES('job-a','user-a','session-a','archive_mirror','running',1,'2026-08-31T12:10:00.000Z','2026-08-31T12:20:00.000Z',NULL,'2026-08-31T12:10:00.000Z','2026-08-31T12:10:00.000Z',NULL);
  `);
  legacy.close();

  const master = new DatabaseSync(':memory:');
  master.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE local_users(id TEXT PRIMARY KEY);
    CREATE TABLE local_places(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,created_at TEXT);
    CREATE TABLE local_music_entries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,played_at TEXT NOT NULL);
    INSERT INTO local_users VALUES('user-a');
  `);
  master.exec(UNIFIED_DATABASE_SCHEMA_SQL);
  master.exec(RECORDER_DATABASE_HARDENING_SQL);
  const escapedPath = legacyPath.replaceAll('\\', '/').replaceAll("'", "''");
  master.exec(`ATTACH DATABASE '${escapedPath}' AS legacy_recorder;`);
  const tables = new Set<string>([
    'recording_sessions', 'recording_points', 'recording_music_observations',
    'recording_lastfm_sync', 'recording_app_cache', 'recording_jobs',
  ]);
  master.exec(legacyRecorderImportSql(tables));

  assert.equal(master.prepare('SELECT COUNT(*) AS n FROM recording_sessions').get()?.n, 1);
  assert.equal(master.prepare('SELECT COUNT(*) AS n FROM recording_points').get()?.n, 1);
  assert.equal(master.prepare('SELECT COUNT(*) AS n FROM recording_music_observations').get()?.n, 1);
  assert.equal(master.prepare(`SELECT status FROM recording_jobs WHERE id='job-a'`).get()?.status, 'retry');
  assert.equal(master.prepare(`SELECT lease_expires_at FROM recording_jobs WHERE id='job-a'`).get()?.lease_expires_at, null);
  master.exec('DETACH DATABASE legacy_recorder;');
  master.close();

  const preserved = new DatabaseSync(legacyPath, { readOnly: true });
  assert.equal(preserved.prepare('SELECT COUNT(*) AS n FROM recording_sessions').get()?.n, 1);
  assert.equal(preserved.prepare(`SELECT status FROM recording_jobs WHERE id='job-a'`).get()?.status, 'running');
  assert.equal(preserved.prepare(`SELECT value_json FROM recording_app_cache WHERE key='user:user-a:test'`).get()?.value_json, '{"safe":true}');
  preserved.close();
  rmSync(directory, { recursive: true, force: true });
});
