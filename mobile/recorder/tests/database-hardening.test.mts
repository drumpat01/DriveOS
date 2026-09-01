import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  MASTER_DATABASE_APPLICATION_ID,
  MASTER_DATABASE_HARDENING_SQL,
  MASTER_DATABASE_SCHEMA_VERSION,
  RECORDER_DATABASE_APPLICATION_ID,
  RECORDER_DATABASE_HARDENING_SQL,
  RECORDER_DATABASE_SCHEMA_VERSION,
} from '../src/database-hardening.ts';

function masterDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE local_users(id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT);
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
  `);
  db.exec(MASTER_DATABASE_HARDENING_SQL);
  return db;
}

function insertUser(db: DatabaseSync, id: string) {
  db.prepare('INSERT INTO local_users VALUES(?,?,?)').run(id, '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z');
}

function insertJourney(db: DatabaseSync, id: string, userId: string, placeId: string | null = null) {
  db.prepare(`INSERT INTO local_journeys(id,user_id,started_at,ended_at,duration_minutes,miles,start_lat,start_lng,end_lat,end_lng,start_place_id,song_count,synced_to_cloud,created_at,updated_at,route_synced_to_cloud,route_sync_revision)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, userId, '2026-08-31T12:00:00.000Z', '2026-08-31T12:10:00.000Z', 10, 4.2, 32.8, -97.2, 32.9, -97.1, placeId, 0, 0, '2026-08-31T12:10:00.000Z', '2026-08-31T12:10:00.000Z', 0, 1);
}

test('database identities and migration versions remain distinct and explicit', () => {
  assert.equal(MASTER_DATABASE_SCHEMA_VERSION, 5);
  assert.equal(RECORDER_DATABASE_SCHEMA_VERSION, 2);
  assert.notEqual(MASTER_DATABASE_APPLICATION_ID, RECORDER_DATABASE_APPLICATION_ID);
});

test('master database hardening enforces values and profile ownership', () => {
  const db = masterDatabase();
  insertUser(db, 'user-a');
  insertUser(db, 'user-b');
  assert.throws(() => db.prepare('INSERT INTO local_preferences VALUES(?,?,?)').run('active_user_id', 'missing-user', '2026-08-31T12:00:00.000Z'), /invalid local preference/);
  db.prepare('INSERT INTO local_preferences VALUES(?,?,?)').run('active_user_id', 'user-a', '2026-08-31T12:00:00.000Z');
  db.prepare(`INSERT INTO local_places VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('place-b', 'user-b', 'custom', 'Other profile', 32.8, -97.2, 150, null, null, null, '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z');
  assert.throws(() => insertJourney(db, 'journey-cross-place', 'user-a', 'place-b'), /another profile/);

  insertJourney(db, 'journey-a', 'user-a');
  insertJourney(db, 'journey-b', 'user-b');
  assert.throws(() => db.prepare(`INSERT INTO local_gps_points VALUES(?,?,?,?,?,?,?,?,?)`).run('journey-a', 0, '2026-08-31T12:01:00.000Z', 95, -97, null, null, null, null), /invalid local GPS/);
  assert.throws(() => db.prepare(`INSERT INTO local_music_entries(id,user_id,journey_id,source,played_at,track,artist,synced_to_cloud,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).run('music-cross', 'user-a', 'journey-b', 'apple_music', '2026-08-31T12:01:00.000Z', 'Song', 'Artist', 0, '2026-08-31T12:01:00.000Z'), /invalid local music/);
  assert.throws(() => db.prepare(`INSERT INTO local_collections(id,user_id,name,journey_ids,synced_to_cloud,sync_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).run('bad-json', 'user-a', 'Trips', '{}', 0, 1, '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z'), /invalid local collection/);

  db.prepare(`INSERT INTO local_collections(id,user_id,name,journey_ids,synced_to_cloud,sync_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).run('collection-b', 'user-b', 'Trips', '[]', 0, 1, '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z');
  assert.throws(() => db.prepare(`INSERT INTO local_photos(id,user_id,source,collection_id,file_name,content_type,byte_length,local_uri,synced_to_cloud,sync_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('photo-cross', 'user-a', 'collection', 'collection-b', 'photo.jpg', 'image/jpeg', 100, '/private/photo.jpg', 0, 1, '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z'), /ownership/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

function recorderDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE recording_sessions(id TEXT PRIMARY KEY,owner_user_id TEXT,device_id TEXT,status TEXT,started_at TEXT,ended_at TEXT,next_sequence INTEGER,remote_created INTEGER,remote_completed INTEGER,drive_id TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE recording_points(session_id TEXT REFERENCES recording_sessions(id),sequence INTEGER,recorded_at TEXT,latitude REAL,longitude REAL,accuracy_meters REAL,altitude_meters REAL,heading_degrees REAL,speed_mps REAL,uploaded INTEGER DEFAULT 0,PRIMARY KEY(session_id,sequence));
    CREATE TABLE recording_music_observations(session_id TEXT REFERENCES recording_sessions(id),observation_id TEXT,source TEXT,played_at TEXT,track TEXT,artist TEXT,album TEXT,duration_ms INTEGER,artwork_url TEXT,external_url TEXT,confidence REAL,uploaded INTEGER DEFAULT 0,created_at TEXT,PRIMARY KEY(session_id,observation_id));
    CREATE TABLE recording_lastfm_sync(session_id TEXT PRIMARY KEY REFERENCES recording_sessions(id),username TEXT,status TEXT,attempt_count INTEGER,success_count INTEGER,next_attempt_at TEXT,last_attempt_at TEXT,updated_at TEXT);
    CREATE TABLE recording_app_cache(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
  `);
  db.exec(RECORDER_DATABASE_HARDENING_SQL);
  return db;
}

function insertSession(db: DatabaseSync, id: string, owner: string) {
  db.prepare(`INSERT INTO recording_sessions(id,owner_user_id,device_id,status,started_at,ended_at,next_sequence,remote_created,remote_completed,created_at,updated_at)
    VALUES(?,?,?,'recording',?,NULL,0,0,0,?,?)`).run(id, owner, 'device-1', '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z', '2026-08-31T12:00:00.000Z');
}

test('recorder hardening prevents duplicate active sessions and malformed queue rows', () => {
  const db = recorderDatabase();
  insertSession(db, 'session-a', 'user-a');
  assert.throws(() => insertSession(db, 'session-b', 'user-a'), /duplicate active/);
  assert.throws(() => db.prepare(`INSERT INTO recording_points(session_id,sequence,recorded_at,latitude,longitude,uploaded) VALUES(?,?,?,?,?,0)`).run('session-a', 0, '2026-08-31T12:01:00.000Z', 32.8, -197), /invalid recording point/);
  assert.throws(() => db.prepare(`INSERT INTO recording_app_cache VALUES(?,?,?)`).run('user:user-a:test', '{broken', '2026-08-31T12:00:00.000Z'), /invalid recorder cache/);

  db.prepare(`UPDATE recording_sessions SET status='completed',ended_at=? WHERE id=?`).run('2026-08-31T12:10:00.000Z', 'session-a');
  insertSession(db, 'session-b', 'user-a');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('completion jobs are profile-owned, leased, and durable after a session finishes', () => {
  const db = recorderDatabase();
  insertSession(db, 'session-a', 'user-a');
  db.prepare(`UPDATE recording_sessions SET status='completed',ended_at=? WHERE id=?`)
    .run('2026-08-31T12:10:00.000Z', 'session-a');
  const insert = db.prepare(`INSERT INTO recording_jobs(
    id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,
    lease_expires_at,last_error_code,created_at,updated_at,completed_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
  assert.throws(() => insert.run(
    'bad-owner', 'user-b', 'session-a', 'archive_mirror', 'pending', 0,
    '2026-08-31T12:10:00.000Z', null, null,
    '2026-08-31T12:10:00.000Z', '2026-08-31T12:10:00.000Z', null,
  ), /invalid recorder completion job/);
  insert.run(
    'job-a', 'user-a', 'session-a', 'archive_mirror', 'pending', 0,
    '2026-08-31T12:10:00.000Z', null, null,
    '2026-08-31T12:10:00.000Z', '2026-08-31T12:10:00.000Z', null,
  );
  db.prepare(`UPDATE recording_jobs SET status='running',attempt_count=1,lease_expires_at=?,updated_at=? WHERE id=?`)
    .run('2026-08-31T12:12:00.000Z', '2026-08-31T12:10:01.000Z', 'job-a');
  assert.throws(() => db.prepare(`UPDATE recording_jobs SET status='completed',lease_expires_at=NULL,updated_at=? WHERE id=?`)
    .run('2026-08-31T12:10:02.000Z', 'job-a'), /invalid recorder completion job update/);
  db.prepare(`UPDATE recording_jobs SET status='completed',lease_expires_at=NULL,completed_at=?,updated_at=? WHERE id=?`)
    .run('2026-08-31T12:10:03.000Z', '2026-08-31T12:10:03.000Z', 'job-a');
  assert.equal(db.prepare(`SELECT status FROM recording_jobs WHERE id='job-a'`).get()?.status, 'completed');
});
