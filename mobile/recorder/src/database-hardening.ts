/**
 * Additive SQLite hardening shared by the runtime and executable schema tests.
 *
 * Keep this file free of Expo imports so Node's built-in SQLite can execute the
 * exact same trigger and index definitions during CI. These migrations never
 * rebuild, drop, rename, or rewrite user tables.
 */

export const MASTER_DATABASE_APPLICATION_ID = 0x4a444c31; // "JDL1"
export const MASTER_DATABASE_SCHEMA_VERSION = 6;
export const RECORDER_DATABASE_APPLICATION_ID = 0x4a445231; // "JDR1"
export const RECORDER_DATABASE_SCHEMA_VERSION = 2;

export const SQLITE_CONNECTION_HARDENING_SQL = `
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA secure_delete = FAST;
  PRAGMA journal_size_limit = 8388608;
  PRAGMA wal_autocheckpoint = 1000;
`;

/**
 * Phase 2 moves every active runtime table into journeydeck-local.db. The
 * recording_* names remain operational queues, not a second journey archive.
 * The old journeydeck-recorder.db file is imported once and then retained as
 * an inert rollback source.
 */
export const UNIFIED_DATABASE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS local_artworks (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    remote_url TEXT,
    cache_key TEXT,
    cache_status TEXT NOT NULL DEFAULT 'pending' CHECK(cache_status IN ('pending','cached','failed')),
    content_type TEXT,
    byte_length INTEGER,
    width INTEGER,
    height INTEGER,
    cached_at TEXT,
    last_accessed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, remote_url)
  );
  CREATE INDEX IF NOT EXISTS ix_local_artworks_user_cache
    ON local_artworks(user_id, cache_status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS local_albums (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    normalized_artist TEXT NOT NULL,
    artwork_id TEXT REFERENCES local_artworks(id) ON DELETE SET NULL,
    external_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, normalized_title, normalized_artist)
  );
  CREATE INDEX IF NOT EXISTS ix_local_albums_user_artist
    ON local_albums(user_id, normalized_artist, normalized_title);

  CREATE TABLE IF NOT EXISTS local_songs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    normalized_artist TEXT NOT NULL,
    album_id TEXT REFERENCES local_albums(id) ON DELETE SET NULL,
    artwork_id TEXT REFERENCES local_artworks(id) ON DELETE SET NULL,
    duration_ms INTEGER,
    external_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, normalized_title, normalized_artist)
  );
  CREATE INDEX IF NOT EXISTS ix_local_songs_user_artist
    ON local_songs(user_id, normalized_artist, normalized_title);

  ALTER TABLE local_music_entries ADD COLUMN song_id TEXT REFERENCES local_songs(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS ix_local_music_song ON local_music_entries(user_id, song_id, played_at DESC);

  CREATE TABLE IF NOT EXISTS local_place_aliases (
    alias_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    canonical_place_id TEXT NOT NULL REFERENCES local_places(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, alias_id)
  );
  CREATE INDEX IF NOT EXISTS ix_local_place_alias_canonical
    ON local_place_aliases(user_id, canonical_place_id);
  INSERT OR IGNORE INTO local_place_aliases(alias_id,user_id,canonical_place_id,created_at)
    SELECT id,user_id,id,created_at FROM local_places;

  CREATE TABLE IF NOT EXISTS local_migration_state (
    key TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('completed','failed')),
    source_application_id INTEGER,
    source_schema_version INTEGER,
    source_counts_json TEXT NOT NULL DEFAULT '{}',
    migrated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recording_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    owner_user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('recording','paused','finishing','completed')),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    next_sequence INTEGER NOT NULL DEFAULT 0,
    remote_created INTEGER NOT NULL DEFAULT 0,
    remote_completed INTEGER NOT NULL DEFAULT 0,
    drive_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_recording_sessions_owner
    ON recording_sessions(owner_user_id,status,created_at);

  CREATE TABLE IF NOT EXISTS recording_points (
    session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy_meters REAL,
    altitude_meters REAL,
    heading_degrees REAL,
    speed_mps REAL,
    uploaded INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(session_id, sequence)
  );
  CREATE INDEX IF NOT EXISTS ix_recording_points_queue
    ON recording_points(session_id, uploaded, sequence);

  CREATE TABLE IF NOT EXISTS recording_music_observations (
    session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
    observation_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('apple_music','shazam','lastfm')),
    played_at TEXT NOT NULL,
    track TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    duration_ms INTEGER,
    artwork_url TEXT,
    external_url TEXT,
    confidence REAL,
    uploaded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    PRIMARY KEY(session_id, observation_id)
  );
  CREATE INDEX IF NOT EXISTS ix_recording_music_queue
    ON recording_music_observations(session_id, uploaded, played_at);

  CREATE TABLE IF NOT EXISTS recording_lastfm_sync (
    session_id TEXT PRIMARY KEY NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','synced')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    last_attempt_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_recording_lastfm_pending
    ON recording_lastfm_sync(status, next_attempt_at);

  CREATE TABLE IF NOT EXISTS recording_app_cache (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const UNIFIED_DATABASE_HARDENING_SQL = `
  CREATE TRIGGER IF NOT EXISTS guard_local_artworks_insert
  BEFORE INSERT ON local_artworks
  WHEN trim(NEW.id)='' OR trim(NEW.user_id)='' OR NEW.cache_status NOT IN ('pending','cached','failed')
    OR (NEW.remote_url IS NOT NULL AND lower(substr(NEW.remote_url,1,8))<>'https://')
    OR (NEW.byte_length IS NOT NULL AND NEW.byte_length<0)
    OR (NEW.width IS NOT NULL AND NEW.width<1) OR (NEW.height IS NOT NULL AND NEW.height<1)
    OR julianday(NEW.created_at) IS NULL OR julianday(NEW.updated_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid canonical artwork'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_artworks_update
  BEFORE UPDATE ON local_artworks
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.cache_status NOT IN ('pending','cached','failed')
    OR (NEW.remote_url IS NOT NULL AND lower(substr(NEW.remote_url,1,8))<>'https://')
    OR (NEW.byte_length IS NOT NULL AND NEW.byte_length<0)
    OR (NEW.width IS NOT NULL AND NEW.width<1) OR (NEW.height IS NOT NULL AND NEW.height<1)
    OR julianday(NEW.updated_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid canonical artwork update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_albums_insert
  BEFORE INSERT ON local_albums
  WHEN trim(NEW.id)='' OR trim(NEW.title)='' OR trim(NEW.artist)=''
    OR trim(NEW.normalized_title)='' OR trim(NEW.normalized_artist)=''
    OR (NEW.artwork_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_artworks a WHERE a.id=NEW.artwork_id AND a.user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid canonical album'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_albums_update
  BEFORE UPDATE ON local_albums
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR trim(NEW.title)='' OR trim(NEW.artist)=''
    OR trim(NEW.normalized_title)='' OR trim(NEW.normalized_artist)=''
    OR (NEW.artwork_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_artworks a WHERE a.id=NEW.artwork_id AND a.user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid canonical album update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_songs_insert
  BEFORE INSERT ON local_songs
  WHEN trim(NEW.id)='' OR trim(NEW.title)='' OR trim(NEW.artist)=''
    OR trim(NEW.normalized_title)='' OR trim(NEW.normalized_artist)=''
    OR (NEW.duration_ms IS NOT NULL AND NEW.duration_ms<0)
    OR (NEW.album_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_albums a WHERE a.id=NEW.album_id AND a.user_id=NEW.user_id))
    OR (NEW.artwork_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_artworks a WHERE a.id=NEW.artwork_id AND a.user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid canonical song'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_songs_update
  BEFORE UPDATE ON local_songs
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR trim(NEW.title)='' OR trim(NEW.artist)=''
    OR trim(NEW.normalized_title)='' OR trim(NEW.normalized_artist)=''
    OR (NEW.duration_ms IS NOT NULL AND NEW.duration_ms<0)
    OR (NEW.album_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_albums a WHERE a.id=NEW.album_id AND a.user_id=NEW.user_id))
    OR (NEW.artwork_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_artworks a WHERE a.id=NEW.artwork_id AND a.user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid canonical song update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_music_song_insert
  BEFORE INSERT ON local_music_entries
  WHEN NEW.song_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM local_songs s WHERE s.id=NEW.song_id AND s.user_id=NEW.user_id)
  BEGIN SELECT RAISE(ABORT, 'music entry song belongs to another profile'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_music_song_update
  BEFORE UPDATE OF song_id,user_id ON local_music_entries
  WHEN NEW.song_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM local_songs s WHERE s.id=NEW.song_id AND s.user_id=NEW.user_id)
  BEGIN SELECT RAISE(ABORT, 'music entry song belongs to another profile'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_place_alias_insert
  BEFORE INSERT ON local_place_aliases
  WHEN trim(NEW.alias_id)='' OR NOT EXISTS(
    SELECT 1 FROM local_places p WHERE p.id=NEW.canonical_place_id AND p.user_id=NEW.user_id)
  BEGIN SELECT RAISE(ABORT, 'invalid canonical place alias'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_place_alias_update
  BEFORE UPDATE ON local_place_aliases
  WHEN NEW.alias_id<>OLD.alias_id OR NEW.user_id<>OLD.user_id OR NOT EXISTS(
    SELECT 1 FROM local_places p WHERE p.id=NEW.canonical_place_id AND p.user_id=NEW.user_id)
  BEGIN SELECT RAISE(ABORT, 'invalid canonical place alias update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_canonical_journey_place_insert
  BEFORE INSERT ON local_journeys
  WHEN (NEW.start_place_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.start_place_id AND user_id=NEW.user_id))
    OR (NEW.end_place_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.end_place_id AND user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'journey references an unknown canonical place'); END;

  CREATE TRIGGER IF NOT EXISTS guard_canonical_journey_place_update
  BEFORE UPDATE OF start_place_id,end_place_id,user_id ON local_journeys
  WHEN (NEW.start_place_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.start_place_id AND user_id=NEW.user_id))
    OR (NEW.end_place_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.end_place_id AND user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'journey references an unknown canonical place'); END;
`;

export const MASTER_DATABASE_HARDENING_SQL = `
  CREATE INDEX IF NOT EXISTS ix_lj_user_legacy
    ON local_journeys(user_id, legacy_drive_id)
    WHERE legacy_drive_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS ix_lp_user_geo
    ON local_places(user_id, lat, lng, cached_until);

  CREATE TRIGGER IF NOT EXISTS guard_local_preferences_insert
  BEFORE INSERT ON local_preferences
  WHEN trim(NEW.key)='' OR julianday(NEW.updated_at) IS NULL
    OR (NEW.key='active_user_id' AND NOT EXISTS(SELECT 1 FROM local_users WHERE id=NEW.value))
  BEGIN SELECT RAISE(ABORT, 'invalid local preference'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_preferences_update
  BEFORE UPDATE ON local_preferences
  WHEN NEW.key<>OLD.key OR julianday(NEW.updated_at) IS NULL
    OR (NEW.key='active_user_id' AND NOT EXISTS(SELECT 1 FROM local_users WHERE id=NEW.value))
  BEGIN SELECT RAISE(ABORT, 'invalid local preference update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_journeys_insert
  BEFORE INSERT ON local_journeys
  WHEN trim(NEW.id)='' OR trim(NEW.user_id)=''
    OR julianday(NEW.started_at) IS NULL OR julianday(NEW.ended_at) IS NULL
    OR julianday(NEW.ended_at) < julianday(NEW.started_at)
    OR NEW.duration_minutes < 0 OR NEW.miles < 0 OR NEW.song_count < 0
    OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.route_synced_to_cloud NOT IN (0,1)
    OR NEW.route_sync_revision < 1
    OR ((NEW.start_lat IS NULL) <> (NEW.start_lng IS NULL))
    OR ((NEW.end_lat IS NULL) <> (NEW.end_lng IS NULL))
    OR (NEW.start_lat IS NOT NULL AND (NEW.start_lat < -90 OR NEW.start_lat > 90))
    OR (NEW.start_lng IS NOT NULL AND (NEW.start_lng < -180 OR NEW.start_lng > 180))
    OR (NEW.end_lat IS NOT NULL AND (NEW.end_lat < -90 OR NEW.end_lat > 90))
    OR (NEW.end_lng IS NOT NULL AND (NEW.end_lng < -180 OR NEW.end_lng > 180))
    OR (NEW.average_speed_mph IS NOT NULL AND (NEW.average_speed_mph < 0 OR NEW.average_speed_mph > 300))
    OR (NEW.max_speed_mph IS NOT NULL AND (NEW.max_speed_mph < 0 OR NEW.max_speed_mph > 300))
  BEGIN SELECT RAISE(ABORT, 'invalid local journey'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_journeys_update
  BEFORE UPDATE ON local_journeys
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id
    OR julianday(NEW.started_at) IS NULL OR julianday(NEW.ended_at) IS NULL
    OR julianday(NEW.ended_at) < julianday(NEW.started_at)
    OR NEW.duration_minutes < 0 OR NEW.miles < 0 OR NEW.song_count < 0
    OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.route_synced_to_cloud NOT IN (0,1)
    OR NEW.route_sync_revision < 1
    OR ((NEW.start_lat IS NULL) <> (NEW.start_lng IS NULL))
    OR ((NEW.end_lat IS NULL) <> (NEW.end_lng IS NULL))
    OR (NEW.start_lat IS NOT NULL AND (NEW.start_lat < -90 OR NEW.start_lat > 90))
    OR (NEW.start_lng IS NOT NULL AND (NEW.start_lng < -180 OR NEW.start_lng > 180))
    OR (NEW.end_lat IS NOT NULL AND (NEW.end_lat < -90 OR NEW.end_lat > 90))
    OR (NEW.end_lng IS NOT NULL AND (NEW.end_lng < -180 OR NEW.end_lng > 180))
    OR (NEW.average_speed_mph IS NOT NULL AND (NEW.average_speed_mph < 0 OR NEW.average_speed_mph > 300))
    OR (NEW.max_speed_mph IS NOT NULL AND (NEW.max_speed_mph < 0 OR NEW.max_speed_mph > 300))
  BEGIN SELECT RAISE(ABORT, 'invalid local journey update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_journey_place_insert
  BEFORE INSERT ON local_journeys
  WHEN (NEW.start_place_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.start_place_id AND user_id<>NEW.user_id))
    OR (NEW.end_place_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.end_place_id AND user_id<>NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'journey place belongs to another profile'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_journey_place_update
  BEFORE UPDATE OF start_place_id,end_place_id,user_id ON local_journeys
  WHEN (NEW.start_place_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.start_place_id AND user_id<>NEW.user_id))
    OR (NEW.end_place_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_places WHERE id=NEW.end_place_id AND user_id<>NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'journey place belongs to another profile'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_gps_insert
  BEFORE INSERT ON local_gps_points
  WHEN NEW.sequence < 0 OR julianday(NEW.recorded_at) IS NULL
    OR NEW.latitude < -90 OR NEW.latitude > 90
    OR NEW.longitude < -180 OR NEW.longitude > 180
    OR (NEW.accuracy_meters IS NOT NULL AND (NEW.accuracy_meters < 0 OR NEW.accuracy_meters > 10000))
    OR (NEW.altitude_meters IS NOT NULL AND (NEW.altitude_meters < -1000 OR NEW.altitude_meters > 100000))
    OR (NEW.heading_degrees IS NOT NULL AND (NEW.heading_degrees < 0 OR NEW.heading_degrees > 360))
    OR (NEW.speed_mps IS NOT NULL AND (NEW.speed_mps < 0 OR NEW.speed_mps > 150))
  BEGIN SELECT RAISE(ABORT, 'invalid local GPS point'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_gps_update
  BEFORE UPDATE ON local_gps_points
  WHEN NEW.journey_id<>OLD.journey_id OR NEW.sequence<>OLD.sequence
    OR julianday(NEW.recorded_at) IS NULL
    OR NEW.latitude < -90 OR NEW.latitude > 90
    OR NEW.longitude < -180 OR NEW.longitude > 180
    OR (NEW.accuracy_meters IS NOT NULL AND (NEW.accuracy_meters < 0 OR NEW.accuracy_meters > 10000))
    OR (NEW.altitude_meters IS NOT NULL AND (NEW.altitude_meters < -1000 OR NEW.altitude_meters > 100000))
    OR (NEW.heading_degrees IS NOT NULL AND (NEW.heading_degrees < 0 OR NEW.heading_degrees > 360))
    OR (NEW.speed_mps IS NOT NULL AND (NEW.speed_mps < 0 OR NEW.speed_mps > 150))
  BEGIN SELECT RAISE(ABORT, 'invalid local GPS point update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_music_insert
  BEFORE INSERT ON local_music_entries
  WHEN trim(NEW.track)='' OR trim(NEW.artist)='' OR julianday(NEW.played_at) IS NULL
    OR NEW.synced_to_cloud NOT IN (0,1)
    OR (NEW.duration_ms IS NOT NULL AND NEW.duration_ms < 0)
    OR (NEW.confidence IS NOT NULL AND (NEW.confidence < 0 OR NEW.confidence > 1))
    OR (NEW.journey_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_journeys WHERE id=NEW.journey_id AND user_id<>NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid local music entry'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_music_update
  BEFORE UPDATE ON local_music_entries
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id
    OR trim(NEW.track)='' OR trim(NEW.artist)='' OR julianday(NEW.played_at) IS NULL
    OR NEW.synced_to_cloud NOT IN (0,1)
    OR (NEW.duration_ms IS NOT NULL AND NEW.duration_ms < 0)
    OR (NEW.confidence IS NOT NULL AND (NEW.confidence < 0 OR NEW.confidence > 1))
    OR (NEW.journey_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_journeys WHERE id=NEW.journey_id AND user_id<>NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid local music entry update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_places_insert
  BEFORE INSERT ON local_places
  WHEN trim(NEW.label)='' OR NEW.lat < -90 OR NEW.lat > 90
    OR NEW.lng < -180 OR NEW.lng > 180
    OR NEW.radius_meters <= 0 OR NEW.radius_meters > 50000
  BEGIN SELECT RAISE(ABORT, 'invalid local place'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_places_update
  BEFORE UPDATE ON local_places
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR trim(NEW.label)=''
    OR NEW.lat < -90 OR NEW.lat > 90 OR NEW.lng < -180 OR NEW.lng > 180
    OR NEW.radius_meters <= 0 OR NEW.radius_meters > 50000
  BEGIN SELECT RAISE(ABORT, 'invalid local place update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_collections_insert
  BEFORE INSERT ON local_collections
  WHEN trim(NEW.name)='' OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision < 1
    OR json_valid(NEW.journey_ids)=0 OR json_type(NEW.journey_ids)<>'array'
    OR EXISTS(SELECT 1 FROM json_each(NEW.journey_ids) WHERE type<>'text' OR trim(value)='')
    OR EXISTS(SELECT 1 FROM json_each(NEW.journey_ids) ids JOIN local_journeys j ON j.id=ids.value WHERE j.user_id<>NEW.user_id)
  BEGIN SELECT RAISE(ABORT, 'invalid local collection'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_collections_update
  BEFORE UPDATE ON local_collections
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR trim(NEW.name)=''
    OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision < 1
    OR json_valid(NEW.journey_ids)=0 OR json_type(NEW.journey_ids)<>'array'
    OR EXISTS(SELECT 1 FROM json_each(NEW.journey_ids) WHERE type<>'text' OR trim(value)='')
    OR EXISTS(SELECT 1 FROM json_each(NEW.journey_ids) ids JOIN local_journeys j ON j.id=ids.value WHERE j.user_id<>NEW.user_id)
  BEGIN SELECT RAISE(ABORT, 'invalid local collection update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_memories_insert
  BEFORE INSERT ON local_memories
  WHEN trim(NEW.name)='' OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision < 1
    OR json_valid(NEW.collection_ids)=0 OR json_type(NEW.collection_ids)<>'array'
    OR EXISTS(SELECT 1 FROM json_each(NEW.collection_ids) WHERE type<>'text' OR trim(value)='')
    OR EXISTS(SELECT 1 FROM json_each(NEW.collection_ids) ids JOIN local_collections c ON c.id=ids.value WHERE c.user_id<>NEW.user_id)
    OR (NEW.cover_photo_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_photos WHERE id=NEW.cover_photo_id AND user_id<>NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid local memory'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_memories_update
  BEFORE UPDATE ON local_memories
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR trim(NEW.name)=''
    OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision < 1
    OR json_valid(NEW.collection_ids)=0 OR json_type(NEW.collection_ids)<>'array'
    OR EXISTS(SELECT 1 FROM json_each(NEW.collection_ids) WHERE type<>'text' OR trim(value)='')
    OR EXISTS(SELECT 1 FROM json_each(NEW.collection_ids) ids JOIN local_collections c ON c.id=ids.value WHERE c.user_id<>NEW.user_id)
    OR (NEW.cover_photo_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM local_photos WHERE id=NEW.cover_photo_id AND user_id<>NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid local memory update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_photos_insert
  BEFORE INSERT ON local_photos
  WHEN trim(NEW.file_name)='' OR (NEW.deleted_at IS NULL AND trim(NEW.local_uri)='') OR NEW.byte_length < 0
    OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision < 1
    OR (NEW.collection_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_collections WHERE id=NEW.collection_id AND user_id=NEW.user_id))
    OR (NEW.memory_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_memories WHERE id=NEW.memory_id AND user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid local photo ownership'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_photos_update
  BEFORE UPDATE ON local_photos
  WHEN NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR trim(NEW.file_name)=''
    OR (NEW.deleted_at IS NULL AND trim(NEW.local_uri)='')
    OR NEW.byte_length < 0 OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision < 1
    OR (NEW.collection_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_collections WHERE id=NEW.collection_id AND user_id=NEW.user_id))
    OR (NEW.memory_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM local_memories WHERE id=NEW.memory_id AND user_id=NEW.user_id))
  BEGIN SELECT RAISE(ABORT, 'invalid local photo ownership update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_private_preferences_insert
  BEFORE INSERT ON local_private_preferences
  WHEN length(NEW.key)<1 OR length(NEW.key)>64 OR json_valid(NEW.value_json)=0
    OR length(NEW.value_json)>65536 OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision<1
  BEGIN SELECT RAISE(ABORT, 'invalid private preference'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_private_preferences_update
  BEFORE UPDATE ON local_private_preferences
  WHEN NEW.user_id<>OLD.user_id OR NEW.key<>OLD.key OR json_valid(NEW.value_json)=0
    OR length(NEW.value_json)>65536 OR NEW.synced_to_cloud NOT IN (0,1) OR NEW.sync_revision<1
  BEGIN SELECT RAISE(ABORT, 'invalid private preference update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_atlas_insert
  BEFORE INSERT ON local_atlas_snapshots
  WHEN julianday(NEW.generated_at) IS NULL OR NEW.all_time_journey_count<0 OR NEW.all_time_miles<0 OR NEW.all_time_minutes<0
    OR NEW.last7_journey_count<0 OR NEW.last7_miles<0 OR NEW.last7_minutes<0
    OR NEW.last7_song_count<0 OR NEW.listening_hours<0 OR NEW.songs_on_road<0
    OR NEW.current_streak_days<0 OR NEW.weekly_tour_miles<0
    OR json_valid(NEW.top_artists_json)=0 OR json_type(NEW.top_artists_json)<>'array'
    OR json_valid(NEW.mood_json)=0 OR json_type(NEW.mood_json)<>'array'
  BEGIN SELECT RAISE(ABORT, 'invalid local atlas snapshot'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_atlas_update
  BEFORE UPDATE ON local_atlas_snapshots
  WHEN NEW.user_id<>OLD.user_id OR julianday(NEW.generated_at) IS NULL
    OR NEW.all_time_journey_count<0 OR NEW.all_time_miles<0
    OR NEW.all_time_minutes<0 OR NEW.last7_journey_count<0 OR NEW.last7_miles<0
    OR NEW.last7_minutes<0 OR NEW.last7_song_count<0 OR NEW.listening_hours<0
    OR NEW.songs_on_road<0 OR NEW.current_streak_days<0 OR NEW.weekly_tour_miles<0
    OR json_valid(NEW.top_artists_json)=0 OR json_type(NEW.top_artists_json)<>'array'
    OR json_valid(NEW.mood_json)=0 OR json_type(NEW.mood_json)<>'array'
  BEGIN SELECT RAISE(ABORT, 'invalid local atlas snapshot update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_quarantine_insert
  BEFORE INSERT ON local_cloud_deletion_quarantine
  WHEN trim(NEW.record_name)='' OR julianday(NEW.observed_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid cloud deletion quarantine row'); END;

  CREATE TRIGGER IF NOT EXISTS guard_local_quarantine_update
  BEFORE UPDATE ON local_cloud_deletion_quarantine
  WHEN NEW.user_id<>OLD.user_id OR NEW.record_name<>OLD.record_name OR julianday(NEW.observed_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid cloud deletion quarantine update'); END;
`;

export const RECORDER_DATABASE_HARDENING_SQL = `
  CREATE TABLE IF NOT EXISTS recording_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    owner_user_id TEXT NOT NULL,
    session_id TEXT NOT NULL REFERENCES recording_sessions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('archive_mirror','apple_music_history','private_cloud_sync','remote_completion')),
    status TEXT NOT NULL CHECK(status IN ('pending','running','retry','completed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    lease_expires_at TEXT,
    last_error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE(owner_user_id, session_id, kind)
  );
  CREATE INDEX IF NOT EXISTS ix_recording_jobs_ready
    ON recording_jobs(owner_user_id, status, next_attempt_at, created_at);

  CREATE INDEX IF NOT EXISTS ix_recording_sessions_completion
    ON recording_sessions(owner_user_id, status, ended_at DESC);

  CREATE TRIGGER IF NOT EXISTS guard_recording_sessions_insert
  BEFORE INSERT ON recording_sessions
  WHEN NEW.owner_user_id IS NULL OR trim(NEW.owner_user_id)=''
    OR trim(NEW.id)='' OR trim(NEW.device_id)='' OR julianday(NEW.started_at) IS NULL
    OR NEW.next_sequence<0 OR NEW.remote_created NOT IN (0,1) OR NEW.remote_completed NOT IN (0,1)
    OR (NEW.ended_at IS NOT NULL AND julianday(NEW.ended_at) IS NULL)
    OR (NEW.ended_at IS NOT NULL AND julianday(NEW.ended_at)<julianday(NEW.started_at))
    OR (NEW.status='completed' AND NEW.ended_at IS NULL)
    OR (NEW.status<>'completed' AND EXISTS(
      SELECT 1 FROM recording_sessions
      WHERE owner_user_id=NEW.owner_user_id AND status<>'completed' AND id<>NEW.id))
  BEGIN SELECT RAISE(ABORT, 'invalid or duplicate active recording session'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_sessions_update
  BEFORE UPDATE ON recording_sessions
  WHEN NEW.id<>OLD.id OR NEW.owner_user_id<>OLD.owner_user_id
    OR trim(NEW.device_id)='' OR julianday(NEW.started_at) IS NULL OR NEW.next_sequence<0
    OR NEW.remote_created NOT IN (0,1) OR NEW.remote_completed NOT IN (0,1)
    OR (NEW.ended_at IS NOT NULL AND julianday(NEW.ended_at) IS NULL)
    OR (NEW.ended_at IS NOT NULL AND julianday(NEW.ended_at)<julianday(NEW.started_at))
    OR (NEW.status='completed' AND NEW.ended_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'invalid recording session update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_points_insert
  BEFORE INSERT ON recording_points
  WHEN NEW.sequence<0 OR julianday(NEW.recorded_at) IS NULL
    OR NEW.latitude < -90 OR NEW.latitude > 90 OR NEW.longitude < -180 OR NEW.longitude > 180
    OR (NEW.accuracy_meters IS NOT NULL AND (NEW.accuracy_meters<0 OR NEW.accuracy_meters>10000))
    OR (NEW.altitude_meters IS NOT NULL AND (NEW.altitude_meters< -1000 OR NEW.altitude_meters>100000))
    OR (NEW.heading_degrees IS NOT NULL AND (NEW.heading_degrees<0 OR NEW.heading_degrees>360))
    OR (NEW.speed_mps IS NOT NULL AND (NEW.speed_mps<0 OR NEW.speed_mps>150))
    OR NEW.uploaded NOT IN (0,1)
  BEGIN SELECT RAISE(ABORT, 'invalid recording point'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_points_update
  BEFORE UPDATE ON recording_points
  WHEN NEW.session_id<>OLD.session_id OR NEW.sequence<>OLD.sequence OR julianday(NEW.recorded_at) IS NULL
    OR NEW.latitude < -90 OR NEW.latitude > 90 OR NEW.longitude < -180 OR NEW.longitude > 180
    OR (NEW.accuracy_meters IS NOT NULL AND (NEW.accuracy_meters<0 OR NEW.accuracy_meters>10000))
    OR (NEW.altitude_meters IS NOT NULL AND (NEW.altitude_meters< -1000 OR NEW.altitude_meters>100000))
    OR (NEW.heading_degrees IS NOT NULL AND (NEW.heading_degrees<0 OR NEW.heading_degrees>360))
    OR (NEW.speed_mps IS NOT NULL AND (NEW.speed_mps<0 OR NEW.speed_mps>150))
    OR NEW.uploaded NOT IN (0,1)
  BEGIN SELECT RAISE(ABORT, 'invalid recording point update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_music_insert
  BEFORE INSERT ON recording_music_observations
  WHEN trim(NEW.observation_id)='' OR trim(NEW.track)='' OR trim(NEW.artist)=''
    OR julianday(NEW.played_at) IS NULL OR NEW.uploaded NOT IN (0,1)
    OR (NEW.duration_ms IS NOT NULL AND (NEW.duration_ms<0 OR NEW.duration_ms>3600000))
    OR (NEW.confidence IS NOT NULL AND (NEW.confidence<0 OR NEW.confidence>1))
  BEGIN SELECT RAISE(ABORT, 'invalid recording music observation'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_music_update
  BEFORE UPDATE ON recording_music_observations
  WHEN NEW.session_id<>OLD.session_id OR NEW.observation_id<>OLD.observation_id
    OR trim(NEW.track)='' OR trim(NEW.artist)='' OR julianday(NEW.played_at) IS NULL
    OR NEW.uploaded NOT IN (0,1)
    OR (NEW.duration_ms IS NOT NULL AND (NEW.duration_ms<0 OR NEW.duration_ms>3600000))
    OR (NEW.confidence IS NOT NULL AND (NEW.confidence<0 OR NEW.confidence>1))
  BEGIN SELECT RAISE(ABORT, 'invalid recording music observation update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_lastfm_insert
  BEFORE INSERT ON recording_lastfm_sync
  WHEN length(trim(NEW.username))<1 OR length(NEW.username)>32
    OR NEW.attempt_count<0 OR NEW.success_count<0 OR NEW.success_count>NEW.attempt_count
    OR julianday(NEW.next_attempt_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid Last.fm sync state'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_lastfm_update
  BEFORE UPDATE ON recording_lastfm_sync
  WHEN NEW.session_id<>OLD.session_id OR length(trim(NEW.username))<1 OR length(NEW.username)>32
    OR NEW.attempt_count<0 OR NEW.success_count<0 OR NEW.success_count>NEW.attempt_count
    OR julianday(NEW.next_attempt_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid Last.fm sync state update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_cache_insert
  BEFORE INSERT ON recording_app_cache
  WHEN length(NEW.key)<1 OR length(NEW.key)>256 OR length(NEW.value_json)>4194304
    OR json_valid(NEW.value_json)=0 OR julianday(NEW.updated_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid recorder cache entry'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_cache_update
  BEFORE UPDATE ON recording_app_cache
  WHEN NEW.key<>OLD.key OR length(NEW.value_json)>4194304
    OR json_valid(NEW.value_json)=0 OR julianday(NEW.updated_at) IS NULL
  BEGIN SELECT RAISE(ABORT, 'invalid recorder cache entry update'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_jobs_insert
  BEFORE INSERT ON recording_jobs
  WHEN trim(NEW.id)='' OR trim(NEW.owner_user_id)=''
    OR NOT EXISTS(SELECT 1 FROM recording_sessions s
      WHERE s.id=NEW.session_id AND s.owner_user_id=NEW.owner_user_id AND s.status='completed')
    OR NEW.attempt_count<0 OR julianday(NEW.next_attempt_at) IS NULL
    OR julianday(NEW.created_at) IS NULL OR julianday(NEW.updated_at) IS NULL
    OR (NEW.status='running' AND julianday(NEW.lease_expires_at) IS NULL)
    OR (NEW.status<>'running' AND NEW.lease_expires_at IS NOT NULL)
    OR (NEW.status='completed' AND julianday(NEW.completed_at) IS NULL)
    OR (NEW.status<>'completed' AND NEW.completed_at IS NOT NULL)
    OR (NEW.last_error_code IS NOT NULL AND length(NEW.last_error_code)>64)
  BEGIN SELECT RAISE(ABORT, 'invalid recorder completion job'); END;

  CREATE TRIGGER IF NOT EXISTS guard_recording_jobs_update
  BEFORE UPDATE ON recording_jobs
  WHEN NEW.id<>OLD.id OR NEW.owner_user_id<>OLD.owner_user_id
    OR NEW.session_id<>OLD.session_id OR NEW.kind<>OLD.kind
    OR NOT EXISTS(SELECT 1 FROM recording_sessions s
      WHERE s.id=NEW.session_id AND s.owner_user_id=NEW.owner_user_id AND s.status='completed')
    OR NEW.attempt_count<OLD.attempt_count OR julianday(NEW.next_attempt_at) IS NULL
    OR julianday(NEW.created_at) IS NULL OR julianday(NEW.updated_at) IS NULL
    OR (NEW.status='running' AND julianday(NEW.lease_expires_at) IS NULL)
    OR (NEW.status<>'running' AND NEW.lease_expires_at IS NOT NULL)
    OR (NEW.status='completed' AND julianday(NEW.completed_at) IS NULL)
    OR (NEW.status<>'completed' AND NEW.completed_at IS NOT NULL)
    OR (NEW.last_error_code IS NOT NULL AND length(NEW.last_error_code)>64)
  BEGIN SELECT RAISE(ABORT, 'invalid recorder completion job update'); END;
`;
