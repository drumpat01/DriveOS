import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  MASTER_DATABASE_APPLICATION_ID, MASTER_DATABASE_HARDENING_SQL, RECORDER_DATABASE_HARDENING_SQL,
  UNIFIED_DATABASE_HARDENING_SQL, UNIFIED_DATABASE_SCHEMA_SQL,
} from '../src/database-hardening.ts';
import { legacyRecorderImportSql } from '../src/legacy-recorder-import.ts';

const source = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('Build 11 owns automatic recording in Swift and retires the Build 10 JavaScript detector', () => {
  const config = JSON.parse(source('app.json'));
  const moduleConfig = JSON.parse(source('modules/journeydeck-recorder/expo-module.config.json'));
  const swift = source('modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift');
  const subscriber = source('modules/journeydeck-recorder/ios/JourneyDeckRecorderAppDelegateSubscriber.swift');
  const app = source('App.tsx');
  const manualTask = source('src/location-task.ts');

  assert.equal(config.expo.version, '1.9.0');
  assert.deepEqual(config.expo.runtimeVersion, { policy: 'appVersion' });
  assert.deepEqual(moduleConfig.apple.modules, ['JourneyDeckRecorderModule']);
  assert.deepEqual(moduleConfig.apple.appDelegateSubscribers, ['JourneyDeckRecorderAppDelegateSubscriber']);
  assert.match(subscriber, /didFinishLaunchingWithOptions/);
  assert.match(subscriber, /JourneyDeckNativeRecorder\.shared\.bootstrap/);
  assert.match(swift, /startMonitoringSignificantLocationChanges/);
  assert.match(swift, /startUpdatingLocation/);
  assert.match(swift, /allowsBackgroundLocationUpdates = true/);
  assert.match(swift, /journeydeck-local\.db/);
  assert.match(swift, /BEGIN IMMEDIATE/);
  assert.match(swift, /native_recording_/);
  assert.match(swift, /archive_mirror.*apple_music_history.*private_cloud_sync.*remote_completion/s);
  const configureBridge = swift.slice(swift.indexOf('AsyncFunction("configureAsync")'), swift.indexOf('AsyncFunction("getStatusAsync")'));
  assert.doesNotMatch(configureBridge, /runOnQueue/, 'Expo async bridge functions cannot use the synchronous queue modifier');
  assert.match(app, /stopAutomaticDetection[\s\S]*configureNativeAutomaticRecorder/);
  assert.doesNotMatch(manualTask, /processAutomaticDriveLocations/);
});

test('CloudKit transport stages tokens, preserves assets atomically, and reports bounded retry metadata', () => {
  const swift = source('modules/journeydeck-cloudkit/ios/JourneyDeckCloudKitModule.swift');
  const orchestration = source('src/icloud-sync.ts');
  const engine = source('src/cloudkit-sync.ts');

  assert.match(swift, /savePendingToken/);
  assert.match(swift, /commitPendingToken/);
  assert.match(swift, /changeTokenExpired/);
  assert.match(swift, /retrying<T>/);
  assert.match(swift, /CKErrorRetryAfterKey/);
  assert.match(swift, /replaceItemAt/);
  assert.match(swift, /failedRecords/);
  assert.match(orchestration, /retryAfterSeconds/);
  assert.match(orchestration, /engine\.setSyncCompleted\(\)/);
  assert.match(engine, /public setSyncCompleted/);
});

test('an existing Build 10 archive and split recorder upgrade without losing either data set', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journeydeck-build10-upgrade-'));
  const legacyPath = join(directory, 'journeydeck-recorder.db');
  try {
    const master = new DatabaseSync(':memory:');
    master.exec(`PRAGMA foreign_keys=ON; PRAGMA application_id=${MASTER_DATABASE_APPLICATION_ID}; PRAGMA user_version=5;
      CREATE TABLE local_users(id TEXT PRIMARY KEY,created_at TEXT,updated_at TEXT);
      CREATE TABLE local_preferences(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
      CREATE TABLE local_places(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES local_users(id),kind TEXT,label TEXT,lat REAL,lng REAL,radius_meters REAL,foursquare_id TEXT,osm_id TEXT,cached_until TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE local_journeys(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES local_users(id),legacy_drive_id TEXT,started_at TEXT,ended_at TEXT,duration_minutes REAL,miles REAL,start_lat REAL,start_lng REAL,end_lat REAL,end_lng REAL,start_place_id TEXT,end_place_id TEXT,average_speed_mph REAL,max_speed_mph REAL,song_count INTEGER,vehicle_name TEXT,provider TEXT,synced_to_cloud INTEGER,created_at TEXT,updated_at TEXT,route_synced_to_cloud INTEGER,route_sync_revision INTEGER,route_updated_at TEXT);
      CREATE TABLE local_gps_points(journey_id TEXT REFERENCES local_journeys(id),sequence INTEGER,recorded_at TEXT,latitude REAL,longitude REAL,accuracy_meters REAL,altitude_meters REAL,heading_degrees REAL,speed_mps REAL,PRIMARY KEY(journey_id,sequence));
      CREATE TABLE local_music_entries(id TEXT PRIMARY KEY,user_id TEXT REFERENCES local_users(id),journey_id TEXT REFERENCES local_journeys(id),source TEXT,played_at TEXT,track TEXT,artist TEXT,album TEXT,duration_ms INTEGER,artwork_url TEXT,external_url TEXT,confidence REAL,synced_to_cloud INTEGER,created_at TEXT);
      CREATE TABLE local_collections(id TEXT PRIMARY KEY,user_id TEXT REFERENCES local_users(id),name TEXT,description TEXT,journey_ids TEXT,synced_to_cloud INTEGER,deleted_at TEXT,sync_revision INTEGER,created_at TEXT,updated_at TEXT);
      CREATE TABLE local_memories(id TEXT PRIMARY KEY,user_id TEXT REFERENCES local_users(id),name TEXT,notes TEXT,artwork_key TEXT,cover_photo_id TEXT,cover_photo_local_path TEXT,collection_ids TEXT,synced_to_cloud INTEGER,deleted_at TEXT,sync_revision INTEGER,created_at TEXT,updated_at TEXT);
      CREATE TABLE local_photos(id TEXT PRIMARY KEY,user_id TEXT REFERENCES local_users(id),source TEXT,collection_id TEXT REFERENCES local_collections(id),memory_id TEXT REFERENCES local_memories(id),file_name TEXT,content_type TEXT,byte_length INTEGER,local_uri TEXT,synced_to_cloud INTEGER,deleted_at TEXT,sync_revision INTEGER,created_at TEXT,updated_at TEXT);
      CREATE TABLE local_private_preferences(user_id TEXT REFERENCES local_users(id),key TEXT,value_json TEXT,synced_to_cloud INTEGER,deleted_at TEXT,sync_revision INTEGER,created_at TEXT,updated_at TEXT,PRIMARY KEY(user_id,key));
      CREATE TABLE local_cloud_deletion_quarantine(user_id TEXT REFERENCES local_users(id),record_name TEXT,observed_at TEXT,PRIMARY KEY(user_id,record_name));
      CREATE TABLE local_atlas_snapshots(user_id TEXT PRIMARY KEY REFERENCES local_users(id),generated_at TEXT,all_time_journey_count INTEGER,all_time_miles REAL,all_time_minutes REAL,last7_journey_count INTEGER,last7_miles REAL,last7_minutes REAL,last7_song_count INTEGER,listening_hours REAL,songs_on_road INTEGER,current_streak_days INTEGER,top_artists_json TEXT,mood_json TEXT,weekly_tour_miles REAL,weekly_tour_change_percent REAL);
      INSERT INTO local_users VALUES('user-build10','2026-08-31T10:00:00.000Z','2026-08-31T10:00:00.000Z');
      INSERT INTO local_journeys(id,user_id,started_at,ended_at,duration_minutes,miles,song_count,synced_to_cloud,created_at,updated_at,route_synced_to_cloud,route_sync_revision,route_updated_at)
        VALUES('journey-build10','user-build10','2026-08-30T10:00:00.000Z','2026-08-30T10:20:00.000Z',20,8.4,1,0,'2026-08-30T10:00:00.000Z','2026-08-30T10:20:00.000Z',0,1,'2026-08-30T10:20:00.000Z');
      INSERT INTO local_collections(id,user_id,name,journey_ids,synced_to_cloud,sync_revision,created_at,updated_at)
        VALUES('collection-build10','user-build10','Commutes','["journey-build10"]',0,1,'2026-08-30T10:20:00.000Z','2026-08-30T10:20:00.000Z');
      INSERT INTO local_memories(id,user_id,name,collection_ids,synced_to_cloud,sync_revision,created_at,updated_at)
        VALUES('memory-build10','user-build10','First week','["collection-build10"]',0,1,'2026-08-30T10:20:00.000Z','2026-08-30T10:20:00.000Z');
    `);

    const legacy = new DatabaseSync(legacyPath);
    legacy.exec(`PRAGMA application_id=1245991473; PRAGMA user_version=2;
      CREATE TABLE recording_sessions(id TEXT PRIMARY KEY,owner_user_id TEXT,device_id TEXT,status TEXT,started_at TEXT,ended_at TEXT,next_sequence INTEGER,remote_created INTEGER,remote_completed INTEGER,drive_id TEXT,created_at TEXT,updated_at TEXT);
      CREATE TABLE recording_points(session_id TEXT,sequence INTEGER,recorded_at TEXT,latitude REAL,longitude REAL,accuracy_meters REAL,altitude_meters REAL,heading_degrees REAL,speed_mps REAL,uploaded INTEGER,PRIMARY KEY(session_id,sequence));
      CREATE TABLE recording_music_observations(session_id TEXT,observation_id TEXT,source TEXT,played_at TEXT,track TEXT,artist TEXT,album TEXT,duration_ms INTEGER,artwork_url TEXT,external_url TEXT,confidence REAL,uploaded INTEGER,created_at TEXT,PRIMARY KEY(session_id,observation_id));
      CREATE TABLE recording_lastfm_sync(session_id TEXT PRIMARY KEY,username TEXT,status TEXT,attempt_count INTEGER,success_count INTEGER,next_attempt_at TEXT,last_attempt_at TEXT,updated_at TEXT);
      CREATE TABLE recording_app_cache(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
      CREATE TABLE recording_jobs(id TEXT PRIMARY KEY,owner_user_id TEXT,session_id TEXT,kind TEXT,status TEXT,attempt_count INTEGER,next_attempt_at TEXT,lease_expires_at TEXT,last_error_code TEXT,created_at TEXT,updated_at TEXT,completed_at TEXT);
      INSERT INTO recording_sessions VALUES('recording-build10','user-build10','iphone','recording','2026-08-31T12:00:00.000Z',NULL,1,0,0,NULL,'2026-08-31T12:00:00.000Z','2026-08-31T12:00:00.000Z');
      INSERT INTO recording_points VALUES('recording-build10',0,'2026-08-31T12:01:00.000Z',32.8,-97.2,5,NULL,90,12,0);
    `);
    legacy.close();

    master.exec(MASTER_DATABASE_HARDENING_SQL);
    master.exec(UNIFIED_DATABASE_SCHEMA_SQL);
    master.exec(RECORDER_DATABASE_HARDENING_SQL);
    master.exec(UNIFIED_DATABASE_HARDENING_SQL);
    const escaped = legacyPath.replaceAll('\\', '/').replaceAll("'", "''");
    master.exec(`ATTACH DATABASE '${escaped}' AS legacy_recorder;`);
    master.exec(legacyRecorderImportSql(new Set([
      'recording_sessions', 'recording_points', 'recording_music_observations',
      'recording_lastfm_sync', 'recording_app_cache', 'recording_jobs',
    ])));
    master.exec('DETACH DATABASE legacy_recorder; PRAGMA user_version=6;');

    assert.equal(master.prepare(`SELECT name FROM local_memories WHERE id='memory-build10'`).get()?.name, 'First week');
    assert.equal(master.prepare(`SELECT name FROM local_collections WHERE id='collection-build10'`).get()?.name, 'Commutes');
    assert.equal(master.prepare(`SELECT miles FROM local_journeys WHERE id='journey-build10'`).get()?.miles, 8.4);
    assert.equal(master.prepare(`SELECT status FROM recording_sessions WHERE id='recording-build10'`).get()?.status, 'recording');
    assert.equal(master.prepare(`SELECT COUNT(*) AS n FROM recording_points WHERE session_id='recording-build10'`).get()?.n, 1);
    assert.deepEqual(master.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(master.prepare('PRAGMA quick_check').get()?.quick_check, 'ok');
    master.close();

    const preserved = new DatabaseSync(legacyPath, { readOnly: true });
    assert.equal(preserved.prepare(`SELECT status FROM recording_sessions WHERE id='recording-build10'`).get()?.status, 'recording');
    assert.equal(preserved.prepare('SELECT COUNT(*) AS n FROM recording_points').get()?.n, 1);
    preserved.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
