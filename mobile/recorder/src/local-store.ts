/**
 * local-store.ts
 *
 * On-device master SQLite store for the Local-First JourneyDeck architecture.
 *
 * DESIGN PRINCIPLES
 * -----------------
 * - Single source of truth lives on the user's device (expo-sqlite WAL mode).
 * - Multi-user ready: every row carries a user_id so multiple Apple IDs can
 *   coexist on the same device without data leakage between accounts.
 * - Additive-only migrations via PRAGMA user_version. Columns are NEVER dropped
 *   or renamed -- new columns are added with sensible defaults.
 * - Privacy by design: raw home/work coordinates are stored only in the iOS
 *   application sandbox. They never cross the JourneyDeck application server.
 * - Exact GPS points leave the device only as private CloudKit route assets;
 *   they never cross the JourneyDeck application server or privacy edge.
 */

import * as Crypto from 'expo-crypto';
import { canonicalMusicText } from './apple-artwork-match';
import { distanceBetweenCoordinatesMeters, SAVED_PLACE_MATCH_RADIUS_METERS } from './place-matching';
import {
  buildRetentionPreview, DEFAULT_RETENTION_DAYS, type LocalRetentionPreview, type RetentionJourneyCandidate,
} from './retention-preview';
import {
  MASTER_DATABASE_APPLICATION_ID,
  MASTER_DATABASE_HARDENING_SQL,
  MASTER_DATABASE_SCHEMA_VERSION,
  SQLITE_CONNECTION_HARDENING_SQL,
  UNIFIED_DATABASE_HARDENING_SQL,
  UNIFIED_DATABASE_SCHEMA_SQL,
  RECORDER_DATABASE_HARDENING_SQL,
} from './database-hardening';
import { findDuplicatePlayback, partitionDuplicatePlaybacks } from './music-playback-dedupe';
import { getMasterDatabase } from './database-owner';

// --- Database handle (single shared connection, WAL mode) --------------------

const db = getMasterDatabase();
let schemaVersion = 0;
let initialized = false;

// --- Public types ------------------------------------------------------------

export type LocalUserId = string; // Apple Subject identifier or generated UUID

export type LocalUser = {
  id: LocalUserId;
  displayName: string | null;
  email: string | null;
  appleSubject: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalJourney = {
  id: string;
  userId: LocalUserId;
  legacyDriveId: string | null;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  miles: number;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  startPlaceId: string | null;
  endPlaceId: string | null;
  averageSpeedMph: number | null;
  maxSpeedMph: number | null;
  songCount: number;
  vehicleName: string | null;
  provider: string | null;
  syncedToCloud: number;
  createdAt: string;
  updatedAt: string;
};

export type LocalGpsPoint = {
  journeyId: string;
  sequence: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  headingDegrees: number | null;
  speedMps: number | null;
};

export type LocalMusicEntry = {
  id: string;
  userId: LocalUserId;
  journeyId: string | null;
  source: 'apple_music' | 'shazam' | 'lastfm' | 'spotify';
  playedAt: string;
  track: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  externalUrl: string | null;
  confidence: number | null;
  syncedToCloud: number;
  createdAt: string;
};

export type LocalArtwork = {
  id: string;
  userId: LocalUserId;
  remoteUrl: string | null;
  cacheKey: string | null;
  cacheStatus: 'pending' | 'cached' | 'failed';
  byteLength: number | null;
  width: number | null;
  height: number | null;
  cachedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalAlbum = {
  id: string;
  userId: LocalUserId;
  title: string;
  artist: string;
  artworkId: string | null;
  externalUrl: string | null;
};

export type LocalSong = {
  id: string;
  userId: LocalUserId;
  title: string;
  artist: string;
  albumId: string | null;
  artworkId: string | null;
  durationMs: number | null;
  externalUrl: string | null;
};

export type PlaceKind = 'home' | 'work' | 'custom' | 'geocoded';

export type LocalPlace = {
  id: string;
  userId: LocalUserId;
  kind: PlaceKind;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  foursquareId: string | null;
  osmId: string | null;
  cachedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalCollection = {
  id: string;
  userId: LocalUserId;
  name: string;
  description: string | null;
  journeyIds: string;
  syncedToCloud: number;
  deletedAt: string | null;
  syncRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type LocalMemory = {
  id: string;
  userId: LocalUserId;
  name: string;
  notes: string | null;
  artworkKey: string | null;
  coverPhotoId: string | null;
  coverPhotoLocalPath: string | null;
  /** JSON array of Journey IDs. The SQLite column keeps its legacy name for additive-schema safety. */
  journeyIds: string;
  syncedToCloud: number;
  deletedAt: string | null;
  syncRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type LocalPhoto = {
  id: string;
  userId: LocalUserId;
  source: 'collection' | 'memory';
  collectionId: string | null;
  memoryId: string | null;
  fileName: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteLength: number;
  localUri: string;
  syncedToCloud: number;
  deletedAt: string | null;
  syncRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type LocalPrivatePreference = {
  userId: LocalUserId;
  key: string;
  valueJson: string;
  syncedToCloud: number;
  deletedAt: string | null;
  syncRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type QuarantinedCloudDeletion = {
  userId: LocalUserId;
  recordName: string;
  observedAt: string;
};

export type LocalRouteArchive = {
  journeyId: string;
  userId: LocalUserId;
  syncRevision: number;
  syncedToCloud: number;
  updatedAt: string;
  pointCount: number;
};

export type LocalAtlasSnapshot = {
  userId: LocalUserId;
  generatedAt: string;
  allTimeJourneyCount: number;
  allTimeMiles: number;
  allTimeMinutes: number;
  last7DaysJourneyCount: number;
  last7DaysMiles: number;
  last7DaysMinutes: number;
  last7DaysSongCount: number;
  listeningHours: number;
  songsOnRoad: number;
  currentStreakDays: number;
  topArtistsJson: string;
  moodJson: string;
  weeklyTourMiles: number;
  weeklyTourChangePercent: number | null;
};

// --- Migration system --------------------------------------------------------

const MIGRATIONS: Array<() => void> = [
  // Migration 1 -- initial schema
  () => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS local_users (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT,
        email TEXT,
        apple_subject TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_journeys (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        legacy_drive_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_minutes REAL NOT NULL DEFAULT 0,
        miles REAL NOT NULL DEFAULT 0,
        start_lat REAL,
        start_lng REAL,
        end_lat REAL,
        end_lng REAL,
        start_place_id TEXT,
        end_place_id TEXT,
        average_speed_mph REAL,
        max_speed_mph REAL,
        song_count INTEGER NOT NULL DEFAULT 0,
        vehicle_name TEXT,
        provider TEXT,
        synced_to_cloud INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_lj_user_started ON local_journeys(user_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS ix_lj_user_cloud   ON local_journeys(user_id, synced_to_cloud);

      CREATE TABLE IF NOT EXISTS local_gps_points (
        journey_id TEXT NOT NULL REFERENCES local_journeys(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy_meters REAL,
        altitude_meters REAL,
        heading_degrees REAL,
        speed_mps REAL,
        PRIMARY KEY (journey_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS ix_lgps_journey ON local_gps_points(journey_id, sequence);

      CREATE TABLE IF NOT EXISTS local_music_entries (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        journey_id TEXT REFERENCES local_journeys(id) ON DELETE SET NULL,
        source TEXT NOT NULL CHECK(source IN ('apple_music','shazam','lastfm','spotify')),
        played_at TEXT NOT NULL,
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        duration_ms INTEGER,
        artwork_url TEXT,
        external_url TEXT,
        confidence REAL,
        synced_to_cloud INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_lme_user_played ON local_music_entries(user_id, played_at DESC);
      CREATE INDEX IF NOT EXISTS ix_lme_journey      ON local_music_entries(journey_id, played_at);
      CREATE INDEX IF NOT EXISTS ix_lme_artist       ON local_music_entries(user_id, artist);

      CREATE TABLE IF NOT EXISTS local_places (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('home','work','custom','geocoded')),
        label TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        radius_meters REAL NOT NULL DEFAULT 150,
        foursquare_id TEXT,
        osm_id TEXT,
        cached_until TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_lp_user_kind ON local_places(user_id, kind);

      CREATE TABLE IF NOT EXISTS local_collections (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        journey_ids TEXT NOT NULL DEFAULT '[]',
        synced_to_cloud INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_lcol_user ON local_collections(user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS local_memories (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        notes TEXT,
        artwork_key TEXT,
        cover_photo_local_path TEXT,
        collection_ids TEXT NOT NULL DEFAULT '[]',
        synced_to_cloud INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_lmem_user ON local_memories(user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS local_atlas_snapshots (
        user_id TEXT PRIMARY KEY NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        generated_at TEXT NOT NULL,
        all_time_journey_count INTEGER NOT NULL DEFAULT 0,
        all_time_miles REAL NOT NULL DEFAULT 0,
        all_time_minutes REAL NOT NULL DEFAULT 0,
        last7_journey_count INTEGER NOT NULL DEFAULT 0,
        last7_miles REAL NOT NULL DEFAULT 0,
        last7_minutes REAL NOT NULL DEFAULT 0,
        last7_song_count INTEGER NOT NULL DEFAULT 0,
        listening_hours REAL NOT NULL DEFAULT 0,
        songs_on_road INTEGER NOT NULL DEFAULT 0,
        current_streak_days INTEGER NOT NULL DEFAULT 0,
        top_artists_json TEXT NOT NULL DEFAULT '[]',
        mood_json TEXT NOT NULL DEFAULT '[]',
        weekly_tour_miles REAL NOT NULL DEFAULT 0,
        weekly_tour_change_percent REAL
      );
    `);
  },
  // Migration 2 -- persisted device-local profile selection
  () => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS local_preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
  // Migration 3 -- Phase 3.5 private content, recoverable deletion, and revision-safe sync
  () => {
    db.execSync(`
      ALTER TABLE local_collections ADD COLUMN deleted_at TEXT;
      ALTER TABLE local_collections ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE local_memories ADD COLUMN cover_photo_id TEXT;
      ALTER TABLE local_memories ADD COLUMN deleted_at TEXT;
      ALTER TABLE local_memories ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 1;

      CREATE INDEX IF NOT EXISTS ix_lcol_user_cloud ON local_collections(user_id, synced_to_cloud, deleted_at);
      CREATE INDEX IF NOT EXISTS ix_lmem_user_cloud ON local_memories(user_id, synced_to_cloud, deleted_at);

      CREATE TABLE IF NOT EXISTS local_photos (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK(source IN ('collection','memory')),
        collection_id TEXT REFERENCES local_collections(id) ON DELETE SET NULL,
        memory_id TEXT REFERENCES local_memories(id) ON DELETE SET NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
        byte_length INTEGER NOT NULL CHECK(byte_length >= 0),
        local_uri TEXT NOT NULL,
        synced_to_cloud INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        sync_revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK((source='collection' AND collection_id IS NOT NULL AND memory_id IS NULL) OR
              (source='memory' AND memory_id IS NOT NULL AND collection_id IS NULL))
      );
      CREATE INDEX IF NOT EXISTS ix_lphoto_user_owner ON local_photos(user_id, collection_id, memory_id, deleted_at);
      CREATE INDEX IF NOT EXISTS ix_lphoto_user_cloud ON local_photos(user_id, synced_to_cloud, deleted_at);

      CREATE TABLE IF NOT EXISTS local_private_preferences (
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        synced_to_cloud INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        sync_revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(user_id, key)
      );
      CREATE INDEX IF NOT EXISTS ix_lpref_user_cloud ON local_private_preferences(user_id, synced_to_cloud, deleted_at);

      CREATE TABLE IF NOT EXISTS local_cloud_deletion_quarantine (
        user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
        record_name TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        PRIMARY KEY(user_id, record_name)
      );
    `);
  },
  // Migration 4 -- exact private route-asset backup metadata
  () => {
    db.execSync(`
      ALTER TABLE local_journeys ADD COLUMN route_synced_to_cloud INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE local_journeys ADD COLUMN route_sync_revision INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE local_journeys ADD COLUMN route_updated_at TEXT;
      UPDATE local_journeys SET route_updated_at=updated_at WHERE route_updated_at IS NULL;
      CREATE INDEX IF NOT EXISTS ix_lj_user_route_cloud ON local_journeys(user_id,route_synced_to_cloud,route_updated_at);
    `);
  },
  // Migration 5 -- database-enforced ownership, value invariants, and query indexes
  () => {
    db.execSync(MASTER_DATABASE_HARDENING_SQL);
  },
  // Migration 6 -- Phase 2 unified recorder/archive plus canonical places and music
  () => {
    db.execSync(UNIFIED_DATABASE_SCHEMA_SQL);
    db.execSync(RECORDER_DATABASE_HARDENING_SQL);
    db.execSync(UNIFIED_DATABASE_HARDENING_SQL);
    backfillCanonicalMusicRecords();
    backfillJourneyPlaceLinks();
  },
];

const PLAYBACK_DEDUPE_REPAIR_KEY = 'repair.music-playback-dedupe.v1';

type DuplicateRepairRow = {
  id: string;
  contextId: string;
  parentId: string;
  source: string;
  playedAt: string;
  track: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  externalUrl: string | null;
  confidence: number | null;
  songId: string | null;
  uploaded?: number;
};

function groupedDuplicatePairs(rows: DuplicateRepairRow[]) {
  const groups = new Map<string, DuplicateRepairRow[]>();
  rows.forEach(row => groups.set(row.contextId, [...(groups.get(row.contextId) ?? []), row]));
  return [...groups.values()].flatMap(group => partitionDuplicatePlaybacks(group).duplicates);
}

function repairDuplicateMusicPlaybacksOnce() {
  const state = db.getFirstSync<{ status: string }>('SELECT status FROM local_migration_state WHERE key=?;', PLAYBACK_DEDUPE_REPAIR_KEY);
  if (state?.status === 'completed') return;
  try {
    db.withTransactionSync(() => {
      const localRows = db.getAllSync<DuplicateRepairRow>(`SELECT id,user_id || ':' || journey_id || ':' || source AS contextId,journey_id AS parentId,
        source,played_at AS playedAt,track,artist,album,duration_ms AS durationMs,artwork_url AS artworkUrl,
        external_url AS externalUrl,confidence,song_id AS songId
        FROM local_music_entries WHERE journey_id IS NOT NULL ORDER BY user_id,journey_id,source,played_at,id;`);
      const affectedJourneys = new Set<string>();
      for (const { keep, remove } of groupedDuplicatePairs(localRows)) {
        db.runSync(`UPDATE local_music_entries SET
          album=COALESCE(album,?),duration_ms=COALESCE(duration_ms,?),artwork_url=COALESCE(artwork_url,?),
          external_url=COALESCE(external_url,?),confidence=COALESCE(confidence,?),song_id=COALESCE(song_id,?),synced_to_cloud=0
          WHERE id=?;`, remove.album, remove.durationMs, remove.artworkUrl, remove.externalUrl, remove.confidence, remove.songId, keep.id);
        affectedJourneys.add(remove.parentId);
        db.runSync('DELETE FROM local_music_entries WHERE id=?;', remove.id);
      }

      const recorderRows = db.getAllSync<DuplicateRepairRow>(`SELECT observation_id AS id,session_id || ':' || source AS contextId,session_id AS parentId,
        source,played_at AS playedAt,track,artist,album,duration_ms AS durationMs,artwork_url AS artworkUrl,
        external_url AS externalUrl,confidence,NULL AS songId,uploaded
        FROM recording_music_observations ORDER BY session_id,source,played_at,observation_id;`);
      for (const { keep, remove } of groupedDuplicatePairs(recorderRows)) {
        db.runSync(`UPDATE recording_music_observations SET
          album=COALESCE(album,?),duration_ms=COALESCE(duration_ms,?),artwork_url=COALESCE(artwork_url,?),
          external_url=COALESCE(external_url,?),confidence=COALESCE(confidence,?),uploaded=MIN(uploaded,?)
          WHERE session_id=? AND observation_id=?;`, remove.album, remove.durationMs, remove.artworkUrl, remove.externalUrl,
        remove.confidence, remove.uploaded ?? 0, keep.parentId, keep.id);
        db.runSync('DELETE FROM recording_music_observations WHERE session_id=? AND observation_id=?;', remove.parentId, remove.id);
      }

      for (const journeyId of affectedJourneys) {
        db.runSync(`UPDATE local_journeys SET song_count=(SELECT COUNT(*) FROM local_music_entries WHERE journey_id=?),
          synced_to_cloud=0,updated_at=? WHERE id=?;`, journeyId, now(), journeyId);
      }
      db.runSync(`INSERT OR REPLACE INTO local_migration_state(
        key,status,source_application_id,source_schema_version,source_counts_json,migrated_at
      ) VALUES(?,?,?,?,?,?);`, PLAYBACK_DEDUPE_REPAIR_KEY, 'completed', MASTER_DATABASE_APPLICATION_ID,
      MASTER_DATABASE_SCHEMA_VERSION, JSON.stringify({ scanned: localRows.length + recorderRows.length }), now());
    });
  } catch {
    // Duplicate repair is defensive. A malformed legacy row must not prevent
    // the owner from opening the rest of their local JourneyDeck archive.
  }
}

// --- Initialisation ----------------------------------------------------------

export function initializeLocalStore(): void {
  if (initialized) return;
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync(SQLITE_CONNECTION_HARDENING_SQL);
  const applicationId = Number(db.getFirstSync<{ application_id: number }>('PRAGMA application_id;')?.application_id ?? 0);
  if (applicationId === 0) db.execSync(`PRAGMA application_id = ${MASTER_DATABASE_APPLICATION_ID};`);
  else if (applicationId !== MASTER_DATABASE_APPLICATION_ID) throw new Error('JourneyDeck local archive has an unexpected SQLite application id.');
  const current = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version ?? 0;
  if (current > MASTER_DATABASE_SCHEMA_VERSION || current > MIGRATIONS.length) {
    throw new Error(`JourneyDeck local archive schema ${current} is newer than this app supports.`);
  }
  schemaVersion = current;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.withTransactionSync(() => {
      MIGRATIONS[i]!();
      db.execSync(`PRAGMA user_version = ${i + 1};`);
    });
    schemaVersion = i + 1;
  }
  repairDuplicateMusicPlaybacksOnce();
  const quickCheck = db.getFirstSync<Record<string, unknown>>('PRAGMA quick_check(1);');
  if (String(Object.values(quickCheck ?? {})[0] ?? '').toLowerCase() !== 'ok') {
    throw new Error('JourneyDeck local archive failed SQLite quick_check.');
  }
  initialized = true;
}

// --- Helpers -----------------------------------------------------------------

function now() { return new Date().toISOString(); }
function guard(value: number | null | undefined, min: number, max: number): number | null {
  return value != null && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

type UserOwnedTable = 'local_journeys' | 'local_music_entries' | 'local_places' | 'local_collections' | 'local_memories' | 'local_photos';

function assertRowOwnership(table: UserOwnedTable, id: string, userId: LocalUserId): void {
  const existing = db.getFirstSync<{ user_id: string }>(`SELECT user_id FROM ${table} WHERE id=?;`, id);
  if (existing && existing.user_id !== userId) {
    throw new Error(`Refusing to modify ${table} row owned by another local user.`);
  }
}

function stableCanonicalId(prefix: 'artwork' | 'album' | 'song', identity: string): string {
  let first = 0x811c9dc5, second = 0x9e3779b9;
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${prefix}_${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

function safeArtworkUrl(value: string | null | undefined): string | null {
  if (!value?.startsWith('https://')) return null;
  try { return new URL(value).protocol === 'https:' ? value : null; }
  catch { return null; }
}

type CanonicalMusicInput = {
  userId: LocalUserId;
  track: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  externalUrl: string | null;
};

/** Creates or enriches the one shared song/album/artwork graph for a playback. */
function ensureCanonicalMusicRecords(input: CanonicalMusicInput): string {
  const normalizedTrack = canonicalMusicText(input.track) || input.track.trim().toLocaleLowerCase();
  const normalizedArtist = canonicalMusicText(input.artist) || input.artist.trim().toLocaleLowerCase();
  const normalizedAlbum = canonicalMusicText(input.album);
  const t = now();
  const artworkUrl = safeArtworkUrl(input.artworkUrl);
  let artworkId: string | null = null;
  if (artworkUrl) {
    artworkId = db.getFirstSync<{ id: string }>(
      'SELECT id FROM local_artworks WHERE user_id=? AND remote_url=?;', input.userId, artworkUrl,
    )?.id ?? stableCanonicalId('artwork', `${input.userId}\0${artworkUrl}`);
    db.runSync(`INSERT INTO local_artworks(
        id,user_id,remote_url,cache_key,cache_status,created_at,updated_at
      ) VALUES(?,?,?,?, 'pending',?,?)
      ON CONFLICT(user_id,remote_url) DO UPDATE SET
        cache_key=COALESCE(local_artworks.cache_key,excluded.cache_key),updated_at=excluded.updated_at;`,
    artworkId, input.userId, artworkUrl, artworkUrl, t, t);
  }

  let albumId: string | null = null;
  if (input.album?.trim() && normalizedAlbum) {
    albumId = db.getFirstSync<{ id: string }>(
      'SELECT id FROM local_albums WHERE user_id=? AND normalized_title=? AND normalized_artist=?;',
      input.userId, normalizedAlbum, normalizedArtist,
    )?.id ?? stableCanonicalId('album', `${input.userId}\0${normalizedAlbum}\0${normalizedArtist}`);
    db.runSync(`INSERT INTO local_albums(
        id,user_id,title,artist,normalized_title,normalized_artist,artwork_id,external_url,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,normalized_title,normalized_artist) DO UPDATE SET
        title=excluded.title,artist=excluded.artist,
        artwork_id=COALESCE(excluded.artwork_id,local_albums.artwork_id),
        external_url=COALESCE(excluded.external_url,local_albums.external_url),updated_at=excluded.updated_at;`,
    albumId, input.userId, input.album.trim(), input.artist.trim(), normalizedAlbum, normalizedArtist,
    artworkId, input.externalUrl ?? null, t, t);
  }

  const existingSong = db.getFirstSync<{ id: string }>(
    'SELECT id FROM local_songs WHERE user_id=? AND normalized_title=? AND normalized_artist=?;',
    input.userId, normalizedTrack, normalizedArtist,
  );
  const songId = existingSong?.id ?? stableCanonicalId('song', `${input.userId}\0${normalizedTrack}\0${normalizedArtist}`);
  db.runSync(`INSERT INTO local_songs(
      id,user_id,title,artist,normalized_title,normalized_artist,album_id,artwork_id,duration_ms,external_url,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,normalized_title,normalized_artist) DO UPDATE SET
      title=excluded.title,artist=excluded.artist,
      album_id=COALESCE(excluded.album_id,local_songs.album_id),
      artwork_id=COALESCE(excluded.artwork_id,local_songs.artwork_id),
      duration_ms=COALESCE(excluded.duration_ms,local_songs.duration_ms),
      external_url=COALESCE(excluded.external_url,local_songs.external_url),updated_at=excluded.updated_at;`,
  songId, input.userId, input.track.trim(), input.artist.trim(), normalizedTrack, normalizedArtist,
  albumId, artworkId, input.durationMs ?? null, input.externalUrl ?? null, t, t);
  return songId;
}

function backfillCanonicalMusicRecords(): void {
  const entries = db.getAllSync<Record<string, unknown>>(`SELECT id,user_id,track,artist,album,duration_ms,artwork_url,external_url
    FROM local_music_entries ORDER BY created_at,id;`);
  for (const entry of entries) {
    const songId = ensureCanonicalMusicRecords({
      userId: String(entry.user_id), track: String(entry.track), artist: String(entry.artist),
      album: entry.album ? String(entry.album) : null,
      durationMs: entry.duration_ms == null ? null : Number(entry.duration_ms),
      artworkUrl: entry.artwork_url ? String(entry.artwork_url) : null,
      externalUrl: entry.external_url ? String(entry.external_url) : null,
    });
    db.runSync('UPDATE local_music_entries SET song_id=? WHERE id=? AND user_id=?;',
      songId, String(entry.id), String(entry.user_id));
  }
}

function chooseEndpointPlace(
  places: LocalPlace[],
  latitude: number | null,
  longitude: number | null,
): LocalPlace | null {
  if (latitude == null || longitude == null) return null;
  return places
    .map(place => ({ place, distance: placeDistanceMeters(latitude, longitude, place) }))
    .filter(candidate => candidate.distance <= candidate.place.radiusMeters)
    .sort((left, right) => {
      const leftNamed = left.place.kind === 'geocoded' ? 1 : 0;
      const rightNamed = right.place.kind === 'geocoded' ? 1 : 0;
      return leftNamed - rightNamed || left.distance - right.distance;
    })[0]?.place ?? null;
}

/** Backfills every archived endpoint to a canonical place without changing coordinates. */
function backfillJourneyPlaceLinks(userId?: LocalUserId): void {
  const users = userId ? [userId] : db.getAllSync<{ id: string }>('SELECT id FROM local_users;').map(row => row.id);
  for (const ownerId of users) {
    const places = db.getAllSync<LocalPlace>(`SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,
      foursquare_id AS foursquareId,osm_id AS osmId,cached_until AS cachedUntil,created_at AS createdAt,updated_at AS updatedAt
      FROM local_places WHERE user_id=?;`, ownerId);
    const journeys = db.getAllSync<{ id: string; start_lat: number | null; start_lng: number | null; end_lat: number | null; end_lng: number | null }>(
      'SELECT id,start_lat,start_lng,end_lat,end_lng FROM local_journeys WHERE user_id=?;', ownerId,
    );
    for (const journey of journeys) {
      const start = chooseEndpointPlace(places, journey.start_lat, journey.start_lng);
      const end = chooseEndpointPlace(places, journey.end_lat, journey.end_lng);
      db.runSync('UPDATE local_journeys SET start_place_id=?,end_place_id=? WHERE id=? AND user_id=?;',
        start?.id ?? null, end?.id ?? null, journey.id, ownerId);
    }
  }
}

// --- User management ---------------------------------------------------------

export function ensureLocalUser(input: { appleSubject?: string; displayName?: string; email?: string }): LocalUser {
  initializeLocalStore();
  const t = now();
  if (input.appleSubject) {
    const existing = db.getFirstSync<LocalUser>(
      'SELECT id,display_name AS displayName,email,apple_subject AS appleSubject,created_at AS createdAt,updated_at AS updatedAt FROM local_users WHERE apple_subject=?;',
      input.appleSubject,
    );
    if (existing) return existing;
  }
  const id = `user_${Crypto.randomUUID()}`;
  db.runSync(
    'INSERT INTO local_users(id,display_name,email,apple_subject,created_at,updated_at) VALUES(?,?,?,?,?,?);',
    id, input.displayName ?? null, input.email ?? null, input.appleSubject ?? null, t, t,
  );
  return db.getFirstSync<LocalUser>(
    'SELECT id,display_name AS displayName,email,apple_subject AS appleSubject,created_at AS createdAt,updated_at AS updatedAt FROM local_users WHERE id=?;',
    id,
  )!;
}

export function listLocalUsers(): LocalUser[] {
  initializeLocalStore();
  return db.getAllSync<LocalUser>(
    'SELECT id,display_name AS displayName,email,apple_subject AS appleSubject,created_at AS createdAt,updated_at AS updatedAt FROM local_users ORDER BY created_at;',
  );
}

/** Hard deletion is reserved for the explicit, confirmed account-deletion flow. */
export function deleteLocalUserData(userId: LocalUserId): void {
  initializeLocalStore();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM local_users WHERE id=?;', userId);
    db.runSync("DELETE FROM local_preferences WHERE key='active_user_id' AND value=?;", userId);
  });
}

export function linkLocalUserToAppleIdentity(userId: LocalUserId, input: { appleSubject: string; displayName?: string; email?: string }): LocalUser {
  initializeLocalStore();
  const existingIdentity = db.getFirstSync<LocalUser>(
    'SELECT id,display_name AS displayName,email,apple_subject AS appleSubject,created_at AS createdAt,updated_at AS updatedAt FROM local_users WHERE apple_subject=?;',
    input.appleSubject,
  );
  if (existingIdentity && existingIdentity.id !== userId) return existingIdentity;

  const localUser = db.getFirstSync<{ id: string; appleSubject: string | null }>('SELECT id,apple_subject AS appleSubject FROM local_users WHERE id=?;', userId);
  if (!localUser) throw new Error('Cannot link Apple identity to an unknown local user.');
  db.withTransactionSync(() => {
    db.runSync(
      `UPDATE local_users SET apple_subject=?,display_name=COALESCE(?,display_name),email=COALESCE(?,email),updated_at=? WHERE id=?;`,
      input.appleSubject, input.displayName ?? null, input.email ?? null, now(), userId,
    );
    if (localUser.appleSubject !== input.appleSubject) {
      db.runSync('UPDATE local_journeys SET synced_to_cloud=0,route_synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_music_entries SET synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_collections SET synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_memories SET synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_photos SET synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_private_preferences SET synced_to_cloud=0 WHERE user_id=?;', userId);
    }
  });
  return db.getFirstSync<LocalUser>(
    'SELECT id,display_name AS displayName,email,apple_subject AS appleSubject,created_at AS createdAt,updated_at AS updatedAt FROM local_users WHERE id=?;',
    userId,
  )!;
}

export function getActiveLocalUserId(): LocalUserId | null {
  initializeLocalStore();
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM local_preferences WHERE key='active_user_id';");
  if (!row) return null;
  const user = db.getFirstSync<{ id: string }>('SELECT id FROM local_users WHERE id=?;', row.value);
  return user?.id ?? null;
}

export function setActiveLocalUserId(userId: LocalUserId): void {
  initializeLocalStore();
  const user = db.getFirstSync<{ id: string }>('SELECT id FROM local_users WHERE id=?;', userId);
  if (!user) throw new Error('Cannot activate an unknown local user.');
  db.runSync(`INSERT INTO local_preferences(key,value,updated_at) VALUES('active_user_id',?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;`, userId, now());
}

// --- Journey management ------------------------------------------------------

export type UpsertJourneyInput = Omit<LocalJourney, 'syncedToCloud' | 'createdAt' | 'updatedAt'>;
export type UpsertJourneyOptions = {
  syncedToCloud?: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
};

export function upsertJourney(input: UpsertJourneyInput, options: UpsertJourneyOptions = {}): void {
  initializeLocalStore();
  assertRowOwnership('local_journeys', input.id, input.userId);
  const t = now();
  const createdAt = options.createdAt ?? t;
  const updatedAt = options.updatedAt ?? t;
  const syncedToCloud = options.syncedToCloud ?? 0;
  db.runSync(`
    INSERT INTO local_journeys(id,user_id,legacy_drive_id,started_at,ended_at,duration_minutes,miles,
      start_lat,start_lng,end_lat,end_lng,start_place_id,end_place_id,
      average_speed_mph,max_speed_mph,song_count,vehicle_name,provider,
      synced_to_cloud,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      legacy_drive_id=excluded.legacy_drive_id, started_at=excluded.started_at, ended_at=excluded.ended_at,
      duration_minutes=excluded.duration_minutes, miles=excluded.miles,
      start_lat=COALESCE(excluded.start_lat,local_journeys.start_lat),
      start_lng=COALESCE(excluded.start_lng,local_journeys.start_lng),
      end_lat=COALESCE(excluded.end_lat,local_journeys.end_lat),
      end_lng=COALESCE(excluded.end_lng,local_journeys.end_lng),
      start_place_id=excluded.start_place_id, end_place_id=excluded.end_place_id,
      average_speed_mph=excluded.average_speed_mph, max_speed_mph=excluded.max_speed_mph,
      song_count=excluded.song_count, vehicle_name=excluded.vehicle_name,
      provider=excluded.provider, synced_to_cloud=excluded.synced_to_cloud, updated_at=excluded.updated_at;
  `,
    input.id, input.userId, input.legacyDriveId ?? null,
    input.startedAt, input.endedAt, input.durationMinutes, input.miles,
    guard(input.startLat, -90, 90), guard(input.startLng, -180, 180),
    guard(input.endLat, -90, 90), guard(input.endLng, -180, 180),
    input.startPlaceId ?? null, input.endPlaceId ?? null,
    guard(input.averageSpeedMph, 0, 300), guard(input.maxSpeedMph, 0, 300),
    Math.max(0, Math.trunc(input.songCount)), input.vehicleName ?? null, input.provider ?? null,
    syncedToCloud, createdAt, updatedAt,
  );
}

export function listJourneys(userId: LocalUserId, options: { limit?: number; cursor?: string } = {}): { items: LocalJourney[]; nextCursor: string | null } {
  initializeLocalStore();
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 25)));
  const rows = options.cursor
    ? db.getAllSync<Record<string, unknown>>('SELECT * FROM local_journeys WHERE user_id=? AND started_at < ? ORDER BY started_at DESC LIMIT ?;', userId, options.cursor, limit + 1)
    : db.getAllSync<Record<string, unknown>>('SELECT * FROM local_journeys WHERE user_id=? ORDER BY started_at DESC LIMIT ?;', userId, limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(rowToJourney);
  return { items, nextCursor: hasMore ? (items.at(-1)?.startedAt ?? null) : null };
}

function rowToJourney(row: Record<string, unknown>): LocalJourney {
  return {
    id: String(row.id), userId: String(row.user_id), legacyDriveId: row.legacy_drive_id ? String(row.legacy_drive_id) : null,
    startedAt: String(row.started_at), endedAt: String(row.ended_at),
    durationMinutes: Number(row.duration_minutes), miles: Number(row.miles),
    startLat: row.start_lat != null ? Number(row.start_lat) : null, startLng: row.start_lng != null ? Number(row.start_lng) : null,
    endLat: row.end_lat != null ? Number(row.end_lat) : null, endLng: row.end_lng != null ? Number(row.end_lng) : null,
    startPlaceId: row.start_place_id ? String(row.start_place_id) : null, endPlaceId: row.end_place_id ? String(row.end_place_id) : null,
    averageSpeedMph: row.average_speed_mph != null ? Number(row.average_speed_mph) : null,
    maxSpeedMph: row.max_speed_mph != null ? Number(row.max_speed_mph) : null,
    songCount: Number(row.song_count), vehicleName: row.vehicle_name ? String(row.vehicle_name) : null,
    provider: row.provider ? String(row.provider) : null, syncedToCloud: Number(row.synced_to_cloud),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export function getJourney(userId: LocalUserId, journeyId: string): LocalJourney | null {
  initializeLocalStore();
  const row = db.getFirstSync<Record<string, unknown>>('SELECT * FROM local_journeys WHERE id=? AND user_id=?;', journeyId, userId);
  return row ? rowToJourney(row) : null;
}

export function getJourneyByLegacyDriveId(userId: LocalUserId, legacyDriveId: string): LocalJourney | null {
  initializeLocalStore();
  const row = db.getFirstSync<Record<string, unknown>>('SELECT * FROM local_journeys WHERE legacy_drive_id=? AND user_id=? ORDER BY updated_at DESC LIMIT 1;', legacyDriveId, userId);
  return row ? rowToJourney(row) : null;
}

// --- GPS points --------------------------------------------------------------

export function insertGpsPoints(userId: LocalUserId, journeyId: string, points: Omit<LocalGpsPoint, 'journeyId'>[]): void {
  initializeLocalStore();
  const owned = db.getFirstSync<{ id: string }>('SELECT id FROM local_journeys WHERE id=? AND user_id=?;', journeyId, userId);
  if (!owned || !points.length) return;
  let inserted = 0;
  db.withTransactionSync(() => {
    for (const p of points) {
      const result = db.runSync(
        'INSERT OR IGNORE INTO local_gps_points(journey_id,sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps) VALUES(?,?,?,?,?,?,?,?,?);',
        journeyId, p.sequence, p.recordedAt, p.latitude, p.longitude,
        guard(p.accuracyMeters, 0, 10_000), guard(p.altitudeMeters, -1000, 100_000),
        guard(p.headingDegrees, 0, 360), guard(p.speedMps, 0, 150),
      );
      inserted += result.changes;
    }
    if (inserted > 0) {
      db.runSync(`UPDATE local_journeys SET route_synced_to_cloud=0,route_sync_revision=route_sync_revision+1,
        route_updated_at=? WHERE id=? AND user_id=?;`, now(), journeyId, userId);
    }
  });
}

export function listJourneyGpsPoints(userId: LocalUserId, journeyId: string): LocalGpsPoint[] {
  initializeLocalStore();
  const owned = db.getFirstSync<{ id: string }>('SELECT id FROM local_journeys WHERE id=? AND user_id=?;', journeyId, userId);
  if (!owned) return [];
  return db.getAllSync<LocalGpsPoint>(`SELECT journey_id AS journeyId,sequence,recorded_at AS recordedAt,latitude,longitude,
    accuracy_meters AS accuracyMeters,altitude_meters AS altitudeMeters,heading_degrees AS headingDegrees,speed_mps AS speedMps
    FROM local_gps_points WHERE journey_id=? ORDER BY sequence;`, journeyId);
}

export function routeArchivesPendingSync(userId: LocalUserId, limit = 10): LocalRouteArchive[] {
  initializeLocalStore();
  return db.getAllSync<LocalRouteArchive>(`SELECT j.id AS journeyId,j.user_id AS userId,j.route_sync_revision AS syncRevision,
    j.route_synced_to_cloud AS syncedToCloud,COALESCE(j.route_updated_at,j.updated_at) AS updatedAt,
    (SELECT COUNT(*) FROM local_gps_points p WHERE p.journey_id=j.id) AS pointCount
    FROM local_journeys j WHERE j.user_id=? AND j.route_synced_to_cloud=0
      AND EXISTS(SELECT 1 FROM local_gps_points p WHERE p.journey_id=j.id)
    ORDER BY COALESCE(j.route_updated_at,j.updated_at) DESC LIMIT ?;`, userId, Math.max(1, Math.min(25, Math.trunc(limit))));
}

export function getRouteArchive(userId: LocalUserId, journeyId: string): LocalRouteArchive | null {
  initializeLocalStore();
  return db.getFirstSync<LocalRouteArchive>(`SELECT j.id AS journeyId,j.user_id AS userId,j.route_sync_revision AS syncRevision,
    j.route_synced_to_cloud AS syncedToCloud,COALESCE(j.route_updated_at,j.updated_at) AS updatedAt,
    (SELECT COUNT(*) FROM local_gps_points p WHERE p.journey_id=j.id) AS pointCount
    FROM local_journeys j WHERE j.id=? AND j.user_id=?;`, journeyId, userId);
}

export function replaceJourneyGpsPointsFromCloud(
  userId: LocalUserId,
  journeyId: string,
  points: Omit<LocalGpsPoint, 'journeyId'>[],
  syncRevision: number,
  updatedAt: string,
): void {
  initializeLocalStore();
  const owned = db.getFirstSync<{ id: string }>('SELECT id FROM local_journeys WHERE id=? AND user_id=?;', journeyId, userId);
  if (!owned) throw new Error('Cannot restore a route without its local journey summary.');
  const validated = points.map(point => {
    const latitude = guard(point.latitude, -90, 90);
    const longitude = guard(point.longitude, -180, 180);
    if (latitude == null || longitude == null) throw new Error('Cloud route contains an invalid coordinate.');
    return { ...point, latitude, longitude };
  });
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM local_gps_points WHERE journey_id=?;', journeyId);
    for (const p of validated) {
      db.runSync(`INSERT INTO local_gps_points(journey_id,sequence,recorded_at,latitude,longitude,accuracy_meters,
        altitude_meters,heading_degrees,speed_mps) VALUES(?,?,?,?,?,?,?,?,?);`, journeyId, p.sequence, p.recordedAt,
      p.latitude, p.longitude, guard(p.accuracyMeters, 0, 10_000),
      guard(p.altitudeMeters, -1000, 100_000), guard(p.headingDegrees, 0, 360), guard(p.speedMps, 0, 150));
    }
    db.runSync(`UPDATE local_journeys SET route_synced_to_cloud=1,route_sync_revision=?,route_updated_at=?
      WHERE id=? AND user_id=?;`, Math.max(1, Math.trunc(syncRevision)), updatedAt, journeyId, userId);
  });
}

export function getJourneyRoute(userId: LocalUserId, journeyId: string): { type: 'LineString'; coordinates: [number, number][] } | null {
  initializeLocalStore();
  const owned = db.getFirstSync<{ id: string }>('SELECT id FROM local_journeys WHERE id=? AND user_id=?;', journeyId, userId);
  if (!owned) return null;
  const points = db.getAllSync<{ latitude: number; longitude: number }>('SELECT latitude,longitude FROM local_gps_points WHERE journey_id=? ORDER BY sequence;', journeyId);
  if (!points.length) return null;
  return { type: 'LineString', coordinates: points.map(p => [p.longitude, p.latitude]) };
}

export function getJourneyRouteSamples(userId: LocalUserId, journeyId: string): { recordedAt: string; coordinate: [number, number]; speedMph: number | null; headingDegrees: number | null; batteryPercent: null }[] {
  initializeLocalStore();
  const owned = db.getFirstSync<{ id: string }>('SELECT id FROM local_journeys WHERE id=? AND user_id=?;', journeyId, userId);
  if (!owned) return [];
  return db.getAllSync<{ recordedAt: string; latitude: number; longitude: number; speedMps: number | null; headingDegrees: number | null }>(
    'SELECT recorded_at AS recordedAt,latitude,longitude,speed_mps AS speedMps,heading_degrees AS headingDegrees FROM local_gps_points WHERE journey_id=? ORDER BY sequence;', journeyId,
  ).map(point => ({
    recordedAt: point.recordedAt,
    coordinate: [point.longitude, point.latitude],
    speedMph: point.speedMps == null ? null : point.speedMps * 2.2369362921,
    headingDegrees: point.headingDegrees,
    batteryPercent: null,
  }));
}

// --- Music entries -----------------------------------------------------------

export type UpsertMusicEntryInput = Omit<LocalMusicEntry, 'syncedToCloud' | 'createdAt'>;
export type UpsertMusicEntryOptions = { syncedToCloud?: 0 | 1; createdAt?: string };

export function upsertMusicEntry(input: UpsertMusicEntryInput, options: UpsertMusicEntryOptions = {}): void {
  initializeLocalStore();
  assertRowOwnership('local_music_entries', input.id, input.userId);
  if (input.journeyId) {
    const ownedJourney = db.getFirstSync<{ id: string }>('SELECT id FROM local_journeys WHERE id=? AND user_id=?;', input.journeyId, input.userId);
    if (!ownedJourney) throw new Error('Cannot attach music to another local user\'s journey.');
  }
  const songId = ensureCanonicalMusicRecords({
    userId: input.userId, track: input.track, artist: input.artist, album: input.album,
    durationMs: input.durationMs, artworkUrl: input.artworkUrl, externalUrl: input.externalUrl,
  });
  if (input.journeyId) {
    const recent = db.getAllSync<{ id: string; source: string; playedAt: string; track: string; artist: string; durationMs: number | null }>(
      `SELECT id,source,played_at AS playedAt,track,artist,duration_ms AS durationMs
       FROM local_music_entries WHERE user_id=? AND journey_id=? AND source=? ORDER BY played_at DESC LIMIT 24;`,
      input.userId, input.journeyId, input.source,
    );
    const duplicate = findDuplicatePlayback(input, recent.filter(row => row.id !== input.id));
    if (duplicate) {
      db.runSync(`UPDATE local_music_entries SET song_id=?,
        album=COALESCE(?,album),duration_ms=COALESCE(?,duration_ms),
        artwork_url=COALESCE(?,artwork_url),external_url=COALESCE(?,external_url),
        confidence=COALESCE(?,confidence),
        synced_to_cloud=CASE WHEN ?=1 THEN synced_to_cloud ELSE 0 END
        WHERE id=? AND user_id=?;`, songId, input.album ?? null, input.durationMs ?? null,
      input.artworkUrl ?? null, input.externalUrl ?? null, input.confidence ?? null,
      options.syncedToCloud ?? 0, duplicate.id, input.userId);
      return;
    }
  }
  db.runSync(
    `INSERT INTO local_music_entries(id,user_id,journey_id,source,played_at,track,artist,album,duration_ms,artwork_url,external_url,confidence,synced_to_cloud,created_at,song_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET journey_id=excluded.journey_id,source=excluded.source,
       played_at=excluded.played_at,track=excluded.track,artist=excluded.artist,
       album=COALESCE(excluded.album,local_music_entries.album),duration_ms=COALESCE(excluded.duration_ms,local_music_entries.duration_ms),
       artwork_url=COALESCE(excluded.artwork_url,local_music_entries.artwork_url),external_url=COALESCE(excluded.external_url,local_music_entries.external_url),
       confidence=COALESCE(excluded.confidence,local_music_entries.confidence),synced_to_cloud=excluded.synced_to_cloud,
       song_id=excluded.song_id;`,
    input.id, input.userId, input.journeyId ?? null, input.source, input.playedAt,
    input.track, input.artist, input.album ?? null, input.durationMs ?? null, input.artworkUrl ?? null,
    input.externalUrl ?? null, input.confidence ?? null, options.syncedToCloud ?? 0, options.createdAt ?? now(), songId,
  );
}

export function refreshJourneySongCount(userId: LocalUserId, journeyId: string): number {
  initializeLocalStore();
  const total = Number(db.getFirstSync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM local_music_entries WHERE user_id=? AND journey_id=?;', userId, journeyId,
  )?.total ?? 0);
  db.runSync('UPDATE local_journeys SET song_count=?,synced_to_cloud=0,updated_at=? WHERE id=? AND user_id=?;', total, now(), journeyId, userId);
  return total;
}

function withoutDuplicateJourneyPlaybacks(rows: LocalMusicEntry[]) {
  const visibleIds = new Set<string>();
  const groups = new Map<string, LocalMusicEntry[]>();
  rows.forEach(row => {
    if (!row.journeyId) { visibleIds.add(row.id); return; }
    const key = `${row.userId}\0${row.journeyId}\0${row.source}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  groups.forEach(group => partitionDuplicatePlaybacks(group).kept.forEach(row => visibleIds.add(row.id)));
  return rows.filter(row => visibleIds.has(row.id));
}

export function listMusicEntries(userId: LocalUserId, limit = 50): LocalMusicEntry[] {
  initializeLocalStore();
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT e.id,e.user_id AS userId,e.journey_id AS journeyId,e.source,e.played_at AS playedAt,
      COALESCE(s.title,e.track) AS track,COALESCE(s.artist,e.artist) AS artist,
      COALESCE(a.title,e.album) AS album,COALESCE(s.duration_ms,e.duration_ms) AS durationMs,
      COALESCE(sa.remote_url,aa.remote_url,e.artwork_url) AS artworkUrl,
      COALESCE(s.external_url,a.external_url,e.external_url) AS externalUrl,
      e.confidence,e.synced_to_cloud AS syncedToCloud,e.created_at AS createdAt
      FROM local_music_entries e
      LEFT JOIN local_songs s ON s.id=e.song_id AND s.user_id=e.user_id
      LEFT JOIN local_albums a ON a.id=s.album_id AND a.user_id=e.user_id
      LEFT JOIN local_artworks sa ON sa.id=s.artwork_id AND sa.user_id=e.user_id
      LEFT JOIN local_artworks aa ON aa.id=a.artwork_id AND aa.user_id=e.user_id
      WHERE e.user_id=? ORDER BY e.played_at DESC LIMIT ?;`,
    userId, Math.max(1, Math.min(500, Math.trunc(limit))),
  ).map(r => r as unknown as LocalMusicEntry);
  return withoutDuplicateJourneyPlaybacks(rows);
}

export type MusicArtworkCatalogItem = {
  track: string;
  artist: string;
  album?: string | null;
  artworkUrl: string;
  externalUrl?: string | null;
};

/**
 * Backfills catalog artwork without relying on MusicKit playback timestamps.
 * Recently-played responses can omit lastPlayedDate even though their catalog
 * metadata is complete, so title + artist is the safe local repair identity.
 */
export function enrichMusicEntriesWithArtwork(userId: LocalUserId, catalog: MusicArtworkCatalogItem[], options: { replaceExisting?: boolean } = {}): number {
  initializeLocalStore();
  let enriched = 0;
  db.withTransactionSync(() => {
    for (const item of catalog) {
      const track = item.track.trim(), artist = item.artist.trim();
      if (!track || !artist || !item.artworkUrl.startsWith('https://')) continue;
      const songId = ensureCanonicalMusicRecords({
        userId, track, artist, album: item.album ?? null, durationMs: null,
        artworkUrl: item.artworkUrl, externalUrl: item.externalUrl ?? null,
      });
      const result = db.runSync(`UPDATE local_music_entries SET song_id=?,
        album=COALESCE(album,?),artwork_url=?,external_url=COALESCE(external_url,?),synced_to_cloud=0
        WHERE user_id=? AND source='apple_music' AND (artwork_url IS NULL OR ?=1)
          AND LOWER(TRIM(track))=LOWER(?) AND LOWER(TRIM(artist))=LOWER(?);`,
      songId, item.album ?? null, item.artworkUrl, item.externalUrl ?? null,
      userId, Number(Boolean(options.replaceExisting)), track, artist);
      enriched += result.changes;
    }
  });
  return enriched;
}

/** Records successful Expo Image disk caching against the shared artwork row. */
export function markArtworkUrlsCached(userId: LocalUserId, urls: string[]): number {
  initializeLocalStore();
  const unique = [...new Set(urls.filter(url => safeArtworkUrl(url)))];
  if (!unique.length) return 0;
  const cachedAt = now();
  let changed = 0;
  db.withTransactionSync(() => {
    for (const url of unique) {
      changed += db.runSync(`UPDATE local_artworks SET cache_status='cached',cache_key=COALESCE(cache_key,?),
        cached_at=?,last_accessed_at=?,updated_at=? WHERE user_id=? AND remote_url=?;`,
      url, cachedAt, cachedAt, cachedAt, userId, url).changes;
    }
  });
  return changed;
}

export function listMusicEntriesForJourney(userId: LocalUserId, journeyId: string): LocalMusicEntry[] {
  initializeLocalStore();
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT e.id,e.user_id AS userId,e.journey_id AS journeyId,e.source,e.played_at AS playedAt,
      COALESCE(s.title,e.track) AS track,COALESCE(s.artist,e.artist) AS artist,
      COALESCE(a.title,e.album) AS album,COALESCE(s.duration_ms,e.duration_ms) AS durationMs,
      COALESCE(sa.remote_url,aa.remote_url,e.artwork_url) AS artworkUrl,
      COALESCE(s.external_url,a.external_url,e.external_url) AS externalUrl,
      e.confidence,e.synced_to_cloud AS syncedToCloud,e.created_at AS createdAt
      FROM local_music_entries e
      LEFT JOIN local_songs s ON s.id=e.song_id AND s.user_id=e.user_id
      LEFT JOIN local_albums a ON a.id=s.album_id AND a.user_id=e.user_id
      LEFT JOIN local_artworks sa ON sa.id=s.artwork_id AND sa.user_id=e.user_id
      LEFT JOIN local_artworks aa ON aa.id=a.artwork_id AND aa.user_id=e.user_id
      WHERE e.user_id=? AND e.journey_id=? ORDER BY e.played_at,e.id;`,
    userId, journeyId,
  ).map(row => row as unknown as LocalMusicEntry);
  return withoutDuplicateJourneyPlaybacks(rows);
}

// --- Places ------------------------------------------------------------------

const PLACE_SELECT = `SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,
  foursquare_id AS foursquareId,osm_id AS osmId,cached_until AS cachedUntil,
  created_at AS createdAt,updated_at AS updatedAt FROM local_places`;

function placeByIdInternal(userId: LocalUserId, id: string): LocalPlace | null {
  return db.getFirstSync<LocalPlace>(`${PLACE_SELECT} WHERE user_id=? AND id=COALESCE(
    (SELECT canonical_place_id FROM local_place_aliases WHERE user_id=? AND alias_id=?),?);`,
  userId, userId, id, id) ?? null;
}

export function getPlace(userId: LocalUserId, id: string): LocalPlace | null {
  initializeLocalStore();
  return placeByIdInternal(userId, id);
}

function shouldReplaceEndpointPlace(
  current: LocalPlace | null,
  candidate: LocalPlace,
  latitude: number,
  longitude: number,
): boolean {
  if (!current || current.id === candidate.id) return true;
  if (current.kind !== 'geocoded' && candidate.kind === 'geocoded') return false;
  if (current.kind === 'geocoded' && candidate.kind !== 'geocoded') return true;
  return placeDistanceMeters(latitude, longitude, candidate) < placeDistanceMeters(latitude, longitude, current);
}

function linkJourneyEndpointsForPlace(place: LocalPlace): number {
  const radius = Math.max(1, Math.min(50_000, place.radiusMeters));
  const latDelta = radius / 111_000;
  const lngDelta = radius / (111_000 * Math.max(0.01, Math.abs(Math.cos((place.lat * Math.PI) / 180))));
  const journeys = db.getAllSync<{ id: string; start_lat: number | null; start_lng: number | null; end_lat: number | null; end_lng: number | null; start_place_id: string | null; end_place_id: string | null }>(`
    SELECT id,start_lat,start_lng,end_lat,end_lng,start_place_id,end_place_id FROM local_journeys
    WHERE user_id=? AND (
      (start_lat BETWEEN ? AND ? AND start_lng BETWEEN ? AND ?)
      OR (end_lat BETWEEN ? AND ? AND end_lng BETWEEN ? AND ?));`,
  place.userId,
  place.lat - latDelta, place.lat + latDelta, place.lng - lngDelta, place.lng + lngDelta,
  place.lat - latDelta, place.lat + latDelta, place.lng - lngDelta, place.lng + lngDelta);
  let changed = 0;
  for (const journey of journeys) {
    let startId = journey.start_place_id, endId = journey.end_place_id;
    if (journey.start_lat != null && journey.start_lng != null
      && placeDistanceMeters(journey.start_lat, journey.start_lng, place) <= radius
      && shouldReplaceEndpointPlace(startId ? placeByIdInternal(place.userId, startId) : null, place, journey.start_lat, journey.start_lng)) {
      startId = place.id;
    }
    if (journey.end_lat != null && journey.end_lng != null
      && placeDistanceMeters(journey.end_lat, journey.end_lng, place) <= radius
      && shouldReplaceEndpointPlace(endId ? placeByIdInternal(place.userId, endId) : null, place, journey.end_lat, journey.end_lng)) {
      endId = place.id;
    }
    if (startId !== journey.start_place_id || endId !== journey.end_place_id) {
      changed += db.runSync(`UPDATE local_journeys SET start_place_id=?,end_place_id=?,
        synced_to_cloud=0,updated_at=? WHERE id=? AND user_id=?;`,
      startId, endId, now(), journey.id, place.userId).changes;
    }
  }
  return changed;
}

export function upsertPlace(input: Omit<LocalPlace, 'createdAt' | 'updatedAt'>): LocalPlace {
  initializeLocalStore();
  const label = input.label.replace(/\s+/g, ' ').trim().slice(0, 200);
  const lat = guard(input.lat, -90, 90), lng = guard(input.lng, -180, 180);
  const radiusMeters = guard(input.radiusMeters, 1, 50_000);
  if (!label || lat == null || lng == null || radiusMeters == null) throw new Error('Saved place coordinates, label, or radius are invalid.');
  const aliased = placeByIdInternal(input.userId, input.id);
  const nearby = input.kind === 'geocoded'
    ? findCachedPlace(input.userId, lat, lng, Math.min(radiusMeters, 150))
    : findNamedPlace(input.userId, lat, lng, Math.min(radiusMeters, SAVED_PLACE_MATCH_RADIUS_METERS));
  const existing = aliased ?? nearby;
  const canonicalId = existing?.id ?? input.id;
  assertRowOwnership('local_places', canonicalId, input.userId);
  const preserveNamed = existing?.kind !== 'geocoded' && input.kind === 'geocoded';
  const preserved = preserveNamed ? existing! : null;
  const canonicalKind = preserved?.kind ?? input.kind;
  const canonicalLabel = preserved?.label ?? label;
  const t = now();
  db.withTransactionSync(() => {
    db.runSync(`
      INSERT INTO local_places(id,user_id,kind,label,lat,lng,radius_meters,foursquare_id,osm_id,cached_until,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,label=excluded.label,lat=excluded.lat,lng=excluded.lng,
        radius_meters=excluded.radius_meters,foursquare_id=COALESCE(excluded.foursquare_id,local_places.foursquare_id),
        osm_id=COALESCE(excluded.osm_id,local_places.osm_id),cached_until=excluded.cached_until,updated_at=excluded.updated_at;
    `, canonicalId, input.userId, canonicalKind, canonicalLabel, preserved?.lat ?? lat, preserved?.lng ?? lng,
    Math.max(radiusMeters, preserved?.radiusMeters ?? 0), input.foursquareId ?? null, input.osmId ?? null,
    preserved?.cachedUntil ?? input.cachedUntil ?? null, existing?.createdAt ?? t, t);
    db.runSync(`INSERT INTO local_place_aliases(alias_id,user_id,canonical_place_id,created_at) VALUES(?,?,?,?)
      ON CONFLICT(alias_id) DO UPDATE SET canonical_place_id=excluded.canonical_place_id;`, input.id, input.userId, canonicalId, t);
    db.runSync(`INSERT OR IGNORE INTO local_place_aliases(alias_id,user_id,canonical_place_id,created_at) VALUES(?,?,?,?);`,
      canonicalId, input.userId, canonicalId, existing?.createdAt ?? t);
    linkJourneyEndpointsForPlace(placeByIdInternal(input.userId, canonicalId)!);
  });
  return placeByIdInternal(input.userId, canonicalId)!;
}

export function getSensitivePlaces(userId: LocalUserId): LocalPlace[] {
  initializeLocalStore();
  return db.getAllSync<LocalPlace>(
    "SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,foursquare_id AS foursquareId,osm_id AS osmId,cached_until AS cachedUntil,created_at AS createdAt,updated_at AS updatedAt FROM local_places WHERE user_id=? AND kind IN ('home','work') ORDER BY kind;",
    userId,
  );
}

function placeDistanceMeters(lat: number, lng: number, place: Pick<LocalPlace, 'lat' | 'lng'>) {
  return distanceBetweenCoordinatesMeters({ latitude: lat, longitude: lng }, { latitude: place.lat, longitude: place.lng });
}

export function findCachedPlace(userId: LocalUserId, lat: number, lng: number, radiusMeters = 100): LocalPlace | null {
  initializeLocalStore();
  const latDelta = radiusMeters / 111_000;
  const lngDelta = radiusMeters / (111_000 * Math.max(0.01, Math.abs(Math.cos((lat * Math.PI) / 180))));
  const places = db.getAllSync<LocalPlace>(
    'SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,foursquare_id AS foursquareId,osm_id AS osmId,cached_until AS cachedUntil,created_at AS createdAt,updated_at AS updatedAt FROM local_places WHERE user_id=? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND (cached_until IS NULL OR cached_until > ?) ORDER BY kind ASC LIMIT 10;',
    userId, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, now(),
  );
  if (!places.length) return null;
  for (const place of places) {
    if (placeDistanceMeters(lat, lng, place) <= radiusMeters) return place;
  }
  return null;
}

/** Returns only places explicitly named by the user, never a temporary geocoder cache row. */
export function findNamedPlace(userId: LocalUserId, lat: number, lng: number, radiusMeters = SAVED_PLACE_MATCH_RADIUS_METERS): LocalPlace | null {
  initializeLocalStore();
  const latDelta = radiusMeters / 111_000;
  const lngDelta = radiusMeters / (111_000 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const places = db.getAllSync<LocalPlace>(
    `SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,foursquare_id AS foursquareId,osm_id AS osmId,
      cached_until AS cachedUntil,created_at AS createdAt,updated_at AS updatedAt
      FROM local_places WHERE user_id=? AND kind IN ('home','work','custom')
      AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? ORDER BY updated_at DESC LIMIT 20;`,
    userId, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta,
  );
  return places
    .map(place => ({ place, distance: placeDistanceMeters(lat, lng, place) }))
    .filter(candidate => candidate.distance <= Math.max(radiusMeters, candidate.place.radiusMeters))
    .sort((left, right) => left.distance - right.distance)[0]?.place ?? null;
}

export function deletePlace(userId: LocalUserId, id: string): void {
  initializeLocalStore();
  const canonical = placeByIdInternal(userId, id);
  if (!canonical) return;
  db.withTransactionSync(() => {
    db.runSync('UPDATE local_journeys SET start_place_id=NULL,synced_to_cloud=0,updated_at=? WHERE user_id=? AND start_place_id=?;', now(), userId, canonical.id);
    db.runSync('UPDATE local_journeys SET end_place_id=NULL,synced_to_cloud=0,updated_at=? WHERE user_id=? AND end_place_id=?;', now(), userId, canonical.id);
    db.runSync('DELETE FROM local_places WHERE user_id=? AND id=?;', userId, canonical.id);
  });
}

// --- Memories (legacy Collection storage remains dormant) -------------------

type CloudUpsertOptions = {
  syncedToCloud?: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  syncRevision?: number;
};

type LocalCollectionInput = Omit<LocalCollection, 'syncedToCloud' | 'deletedAt' | 'syncRevision' | 'createdAt' | 'updatedAt'>;
type LocalMemoryInput = Omit<LocalMemory, 'syncedToCloud' | 'deletedAt' | 'syncRevision' | 'createdAt' | 'updatedAt'>;

function nextSyncRevision(table: 'local_collections' | 'local_memories' | 'local_photos', id: string, options: CloudUpsertOptions): number {
  if (options.syncRevision != null) return Math.max(1, Math.trunc(options.syncRevision));
  if (options.syncedToCloud === 1) return 1;
  const current = db.getFirstSync<{ sync_revision: number }>(`SELECT sync_revision FROM ${table} WHERE id=?;`, id);
  return (current?.sync_revision ?? 0) + 1;
}

export function upsertCollection(input: LocalCollectionInput, options: CloudUpsertOptions = {}): void {
  initializeLocalStore();
  assertRowOwnership('local_collections', input.id, input.userId);
  const t = now(), createdAt = options.createdAt ?? t, updatedAt = options.updatedAt ?? t;
  const revision = nextSyncRevision('local_collections', input.id, options);
  db.runSync(
    'INSERT INTO local_collections(id,user_id,name,description,journey_ids,synced_to_cloud,deleted_at,sync_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,journey_ids=excluded.journey_ids,synced_to_cloud=excluded.synced_to_cloud,deleted_at=excluded.deleted_at,sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;',
    input.id, input.userId, input.name, input.description ?? null, input.journeyIds, options.syncedToCloud ?? 0, options.deletedAt ?? null, revision, createdAt, updatedAt,
  );
}

export function listCollections(userId: LocalUserId): LocalCollection[] {
  initializeLocalStore();
  return db.getAllSync<LocalCollection>(
    'SELECT id,user_id AS userId,name,description,journey_ids AS journeyIds,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_collections WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC;', userId,
  );
}

export function getCollectionIncludingDeleted(userId: LocalUserId, id: string): LocalCollection | null {
  initializeLocalStore();
  return db.getFirstSync<LocalCollection>('SELECT id,user_id AS userId,name,description,journey_ids AS journeyIds,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_collections WHERE user_id=? AND id=?;', userId, id) ?? null;
}

export function softDeleteCollection(userId: LocalUserId, id: string, deletedAt = now()): void {
  initializeLocalStore();
  assertRowOwnership('local_collections', id, userId);
  db.withTransactionSync(() => {
    db.runSync('UPDATE local_collections SET deleted_at=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND id=? AND deleted_at IS NULL;', deletedAt, deletedAt, userId, id);
    const photoIds = db.getAllSync<{ id: string }>('SELECT id FROM local_photos WHERE user_id=? AND collection_id=? AND deleted_at IS NULL;', userId, id).map(item => item.id);
    db.runSync('UPDATE local_photos SET deleted_at=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND collection_id=? AND deleted_at IS NULL;', deletedAt, deletedAt, userId, id);
    for (const photoId of photoIds) db.runSync('UPDATE local_memories SET cover_photo_id=NULL,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND cover_photo_id=?;', deletedAt, userId, photoId);
    const memories = db.getAllSync<{ id: string; collection_ids: string }>('SELECT id,collection_ids FROM local_memories WHERE user_id=? AND deleted_at IS NULL;', userId);
    for (const memory of memories) {
      let ids: string[] = [];
      try { ids = JSON.parse(memory.collection_ids) as string[]; } catch { continue; }
      if (!ids.includes(id)) continue;
      db.runSync('UPDATE local_memories SET collection_ids=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND id=?;', JSON.stringify(ids.filter(value => value !== id)), deletedAt, userId, memory.id);
    }
  });
}

export function upsertMemory(input: LocalMemoryInput, options: CloudUpsertOptions = {}): void {
  initializeLocalStore();
  assertRowOwnership('local_memories', input.id, input.userId);
  const t = now(), createdAt = options.createdAt ?? t, updatedAt = options.updatedAt ?? t;
  const revision = nextSyncRevision('local_memories', input.id, options);
  db.runSync(
    'INSERT INTO local_memories(id,user_id,name,notes,artwork_key,cover_photo_id,cover_photo_local_path,collection_ids,synced_to_cloud,deleted_at,sync_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,notes=excluded.notes,artwork_key=excluded.artwork_key,cover_photo_id=excluded.cover_photo_id,cover_photo_local_path=COALESCE(excluded.cover_photo_local_path,local_memories.cover_photo_local_path),collection_ids=excluded.collection_ids,synced_to_cloud=excluded.synced_to_cloud,deleted_at=excluded.deleted_at,sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;',
    input.id, input.userId, input.name, input.notes ?? null, input.artworkKey ?? null, input.coverPhotoId ?? null, input.coverPhotoLocalPath ?? null, input.journeyIds, options.syncedToCloud ?? 0, options.deletedAt ?? null, revision, createdAt, updatedAt,
  );
}

export function listMemories(userId: LocalUserId): LocalMemory[] {
  initializeLocalStore();
  return db.getAllSync<LocalMemory>(
    'SELECT id,user_id AS userId,name,notes,artwork_key AS artworkKey,cover_photo_id AS coverPhotoId,cover_photo_local_path AS coverPhotoLocalPath,collection_ids AS journeyIds,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_memories WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC;', userId,
  );
}

export function getMemoryIncludingDeleted(userId: LocalUserId, id: string): LocalMemory | null {
  initializeLocalStore();
  return db.getFirstSync<LocalMemory>('SELECT id,user_id AS userId,name,notes,artwork_key AS artworkKey,cover_photo_id AS coverPhotoId,cover_photo_local_path AS coverPhotoLocalPath,collection_ids AS journeyIds,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_memories WHERE user_id=? AND id=?;', userId, id) ?? null;
}

export function softDeleteMemory(userId: LocalUserId, id: string, deletedAt = now()): void {
  initializeLocalStore();
  assertRowOwnership('local_memories', id, userId);
  db.withTransactionSync(() => {
    db.runSync('UPDATE local_memories SET deleted_at=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND id=? AND deleted_at IS NULL;', deletedAt, deletedAt, userId, id);
    db.runSync('UPDATE local_photos SET deleted_at=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND memory_id=? AND deleted_at IS NULL;', deletedAt, deletedAt, userId, id);
  });
}

// --- Private photos & preferences -------------------------------------------

type LocalPhotoInput = Omit<LocalPhoto, 'syncedToCloud' | 'deletedAt' | 'syncRevision' | 'createdAt' | 'updatedAt'>;

export function upsertPhoto(input: LocalPhotoInput, options: CloudUpsertOptions = {}): void {
  initializeLocalStore();
  assertRowOwnership('local_photos', input.id, input.userId);
  const t = now(), createdAt = options.createdAt ?? t, updatedAt = options.updatedAt ?? t;
  const revision = nextSyncRevision('local_photos', input.id, options);
  db.runSync(`INSERT INTO local_photos(id,user_id,source,collection_id,memory_id,file_name,content_type,byte_length,local_uri,synced_to_cloud,deleted_at,sync_revision,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source=excluded.source,collection_id=excluded.collection_id,memory_id=excluded.memory_id,file_name=excluded.file_name,content_type=excluded.content_type,byte_length=excluded.byte_length,local_uri=excluded.local_uri,synced_to_cloud=excluded.synced_to_cloud,deleted_at=excluded.deleted_at,sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;`,
  input.id, input.userId, input.source, input.collectionId, input.memoryId, input.fileName, input.contentType, input.byteLength, input.localUri, options.syncedToCloud ?? 0, options.deletedAt ?? null, revision, createdAt, updatedAt);
}

export function getPhotoIncludingDeleted(userId: LocalUserId, id: string): LocalPhoto | null {
  initializeLocalStore();
  return db.getFirstSync<LocalPhoto>('SELECT id,user_id AS userId,source,collection_id AS collectionId,memory_id AS memoryId,file_name AS fileName,content_type AS contentType,byte_length AS byteLength,local_uri AS localUri,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_photos WHERE user_id=? AND id=?;', userId, id) ?? null;
}

export function listPhotos(userId: LocalUserId): LocalPhoto[] {
  initializeLocalStore();
  return db.getAllSync<LocalPhoto>('SELECT id,user_id AS userId,source,collection_id AS collectionId,memory_id AS memoryId,file_name AS fileName,content_type AS contentType,byte_length AS byteLength,local_uri AS localUri,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_photos WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at;', userId);
}

export function softDeletePhoto(userId: LocalUserId, id: string, deletedAt = now()): LocalPhoto | null {
  initializeLocalStore();
  assertRowOwnership('local_photos', id, userId);
  db.runSync('UPDATE local_photos SET deleted_at=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND id=? AND deleted_at IS NULL;', deletedAt, deletedAt, userId, id);
  db.runSync('UPDATE local_memories SET cover_photo_id=NULL,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND cover_photo_id=?;', deletedAt, userId, id);
  return getPhotoIncludingDeleted(userId, id);
}

export function upsertPrivatePreference(userId: LocalUserId, key: string, value: unknown, options: CloudUpsertOptions = {}): void {
  initializeLocalStore();
  if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(key)) throw new Error('Private preference key is invalid.');
  const valueJson = JSON.stringify(value);
  if (typeof valueJson !== 'string' || valueJson.length > 65_536) throw new Error('Private preference value is invalid or too large.');
  const t = now(), existing = db.getFirstSync<{ sync_revision: number }>('SELECT sync_revision FROM local_private_preferences WHERE user_id=? AND key=?;', userId, key);
  const revision = options.syncRevision != null ? Math.max(1, Math.trunc(options.syncRevision)) : options.syncedToCloud === 1 ? 1 : (existing?.sync_revision ?? 0) + 1;
  db.runSync(`INSERT INTO local_private_preferences(user_id,key,value_json,synced_to_cloud,deleted_at,sync_revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,key) DO UPDATE SET value_json=excluded.value_json,synced_to_cloud=excluded.synced_to_cloud,deleted_at=excluded.deleted_at,sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;`,
  userId, key, valueJson, options.syncedToCloud ?? 0, options.deletedAt ?? null, revision, options.createdAt ?? t, options.updatedAt ?? t);
}

export function getPrivatePreference<T>(userId: LocalUserId, key: string): T | null {
  initializeLocalStore();
  const row = db.getFirstSync<{ value_json: string }>('SELECT value_json FROM local_private_preferences WHERE user_id=? AND key=? AND deleted_at IS NULL;', userId, key);
  if (!row) return null;
  try { return JSON.parse(row.value_json) as T; } catch { return null; }
}

export function listPrivatePreferences(userId: LocalUserId, includeDeleted = false): LocalPrivatePreference[] {
  initializeLocalStore();
  return db.getAllSync<LocalPrivatePreference>(`SELECT user_id AS userId,key,value_json AS valueJson,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_private_preferences WHERE user_id=?${includeDeleted ? '' : ' AND deleted_at IS NULL'} ORDER BY key;`, userId);
}

export function softDeletePrivatePreference(userId: LocalUserId, key: string, deletedAt = now()): void {
  initializeLocalStore();
  db.runSync("UPDATE local_private_preferences SET value_json='null',deleted_at=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE user_id=? AND key=? AND deleted_at IS NULL;", deletedAt, deletedAt, userId, key);
}

// --- Atlas snapshot ----------------------------------------------------------

export function writeAtlasSnapshot(snapshot: LocalAtlasSnapshot): void {
  initializeLocalStore();
  db.runSync(`
    INSERT INTO local_atlas_snapshots(user_id,generated_at,all_time_journey_count,all_time_miles,all_time_minutes,
      last7_journey_count,last7_miles,last7_minutes,last7_song_count,listening_hours,songs_on_road,
      current_streak_days,top_artists_json,mood_json,weekly_tour_miles,weekly_tour_change_percent)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET generated_at=excluded.generated_at,
      all_time_journey_count=excluded.all_time_journey_count,all_time_miles=excluded.all_time_miles,
      all_time_minutes=excluded.all_time_minutes,last7_journey_count=excluded.last7_journey_count,
      last7_miles=excluded.last7_miles,last7_minutes=excluded.last7_minutes,
      last7_song_count=excluded.last7_song_count,listening_hours=excluded.listening_hours,
      songs_on_road=excluded.songs_on_road,current_streak_days=excluded.current_streak_days,
      top_artists_json=excluded.top_artists_json,mood_json=excluded.mood_json,
      weekly_tour_miles=excluded.weekly_tour_miles,weekly_tour_change_percent=excluded.weekly_tour_change_percent;
  `, snapshot.userId, snapshot.generatedAt,
    snapshot.allTimeJourneyCount, snapshot.allTimeMiles, snapshot.allTimeMinutes,
    snapshot.last7DaysJourneyCount, snapshot.last7DaysMiles, snapshot.last7DaysMinutes, snapshot.last7DaysSongCount,
    snapshot.listeningHours, snapshot.songsOnRoad, snapshot.currentStreakDays,
    snapshot.topArtistsJson, snapshot.moodJson, snapshot.weeklyTourMiles, snapshot.weeklyTourChangePercent ?? null,
  );
}

export function readAtlasSnapshot(userId: LocalUserId): LocalAtlasSnapshot | null {
  initializeLocalStore();
  const row = db.getFirstSync<Record<string, unknown>>('SELECT * FROM local_atlas_snapshots WHERE user_id=?;', userId);
  if (!row) return null;
  return {
    userId: String(row.user_id), generatedAt: String(row.generated_at),
    allTimeJourneyCount: Number(row.all_time_journey_count), allTimeMiles: Number(row.all_time_miles), allTimeMinutes: Number(row.all_time_minutes),
    last7DaysJourneyCount: Number(row.last7_journey_count), last7DaysMiles: Number(row.last7_miles), last7DaysMinutes: Number(row.last7_minutes), last7DaysSongCount: Number(row.last7_song_count),
    listeningHours: Number(row.listening_hours), songsOnRoad: Number(row.songs_on_road), currentStreakDays: Number(row.current_streak_days),
    topArtistsJson: String(row.top_artists_json), moodJson: String(row.mood_json),
    weeklyTourMiles: Number(row.weekly_tour_miles), weeklyTourChangePercent: row.weekly_tour_change_percent != null ? Number(row.weekly_tour_change_percent) : null,
  };
}

// --- CloudKit sync queue helpers ----------------------------------------------

export function journeysPendingSync(userId: LocalUserId, limit = 50): string[] {
  initializeLocalStore();
  return db.getAllSync<{ id: string }>('SELECT id FROM local_journeys WHERE user_id=? AND synced_to_cloud=0 ORDER BY started_at DESC LIMIT ?;', userId, limit).map(r => r.id);
}

export function musicEntriesPendingSync(userId: LocalUserId, limit = 50): string[] {
  initializeLocalStore();
  return db.getAllSync<{ id: string }>('SELECT id FROM local_music_entries WHERE user_id=? AND synced_to_cloud=0 ORDER BY played_at DESC LIMIT ?;', userId, limit).map(r => r.id);
}

export function collectionsPendingSync(userId: LocalUserId, limit = 50): string[] {
  initializeLocalStore();
  return db.getAllSync<{ id: string }>('SELECT id FROM local_collections WHERE user_id=? AND synced_to_cloud=0 ORDER BY updated_at DESC LIMIT ?;', userId, limit).map(r => r.id);
}

export function memoriesPendingSync(userId: LocalUserId, limit = 50): string[] {
  initializeLocalStore();
  return db.getAllSync<{ id: string }>('SELECT id FROM local_memories WHERE user_id=? AND synced_to_cloud=0 ORDER BY updated_at DESC LIMIT ?;', userId, limit).map(r => r.id);
}

export function photosPendingSync(userId: LocalUserId, limit = 50): string[] {
  initializeLocalStore();
  return db.getAllSync<{ id: string }>('SELECT id FROM local_photos WHERE user_id=? AND synced_to_cloud=0 ORDER BY updated_at DESC LIMIT ?;', userId, limit).map(r => r.id);
}

export function preferencesPendingSync(userId: LocalUserId, limit = 50): string[] {
  initializeLocalStore();
  return db.getAllSync<{ key: string }>('SELECT key FROM local_private_preferences WHERE user_id=? AND synced_to_cloud=0 ORDER BY updated_at DESC LIMIT ?;', userId, limit).map(r => r.key);
}

export function getMusicEntry(userId: LocalUserId, id: string): LocalMusicEntry | null {
  initializeLocalStore();
  return db.getFirstSync<LocalMusicEntry>(`SELECT id,user_id AS userId,journey_id AS journeyId,source,played_at AS playedAt,
    track,artist,album,duration_ms AS durationMs,artwork_url AS artworkUrl,external_url AS externalUrl,
    confidence,synced_to_cloud AS syncedToCloud,created_at AS createdAt
    FROM local_music_entries WHERE id=? AND user_id=?;`, id, userId);
}

export function markRouteArchiveRevisionsSynced(userId: LocalUserId, acknowledgements: SyncRevisionAck[]): void {
  initializeLocalStore();
  db.withTransactionSync(() => {
    for (const item of acknowledgements) {
      db.runSync('UPDATE local_journeys SET route_synced_to_cloud=1 WHERE user_id=? AND id=? AND route_sync_revision=?;', userId, item.id, item.syncRevision);
    }
  });
}

export function listCollectionsIncludingDeleted(userId: LocalUserId): LocalCollection[] {
  initializeLocalStore();
  return db.getAllSync<LocalCollection>('SELECT id,user_id AS userId,name,description,journey_ids AS journeyIds,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_collections WHERE user_id=? ORDER BY updated_at DESC;', userId);
}

export function listMemoriesIncludingDeleted(userId: LocalUserId): LocalMemory[] {
  initializeLocalStore();
  return db.getAllSync<LocalMemory>('SELECT id,user_id AS userId,name,notes,artwork_key AS artworkKey,cover_photo_id AS coverPhotoId,cover_photo_local_path AS coverPhotoLocalPath,collection_ids AS journeyIds,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_memories WHERE user_id=? ORDER BY updated_at DESC;', userId);
}

export function listPhotosIncludingDeleted(userId: LocalUserId): LocalPhoto[] {
  initializeLocalStore();
  return db.getAllSync<LocalPhoto>('SELECT id,user_id AS userId,source,collection_id AS collectionId,memory_id AS memoryId,file_name AS fileName,content_type AS contentType,byte_length AS byteLength,local_uri AS localUri,synced_to_cloud AS syncedToCloud,deleted_at AS deletedAt,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt FROM local_photos WHERE user_id=? ORDER BY updated_at DESC;', userId);
}

export function markJourneysSynced(userId: LocalUserId, ids: string[]): void {
  initializeLocalStore();
  if (!ids.length) return;
  db.runSync(`UPDATE local_journeys SET synced_to_cloud=1 WHERE user_id=? AND id IN (${ids.map(() => '?').join(',')});`, userId, ...ids);
}

export function markMusicEntriesSynced(userId: LocalUserId, ids: string[]): void {
  initializeLocalStore();
  if (!ids.length) return;
  db.runSync(`UPDATE local_music_entries SET synced_to_cloud=1 WHERE user_id=? AND id IN (${ids.map(() => '?').join(',')});`, userId, ...ids);
}

export function markCollectionsSynced(userId: LocalUserId, ids: string[]): void {
  initializeLocalStore();
  if (!ids.length) return;
  db.runSync(`UPDATE local_collections SET synced_to_cloud=1 WHERE user_id=? AND id IN (${ids.map(() => '?').join(',')});`, userId, ...ids);
}

export function markMemoriesSynced(userId: LocalUserId, ids: string[]): void {
  initializeLocalStore();
  if (!ids.length) return;
  db.runSync(`UPDATE local_memories SET synced_to_cloud=1 WHERE user_id=? AND id IN (${ids.map(() => '?').join(',')});`, userId, ...ids);
}

export type SyncRevisionAck = { id: string; syncRevision: number };

function markRevisionsSynced(table: 'local_collections' | 'local_memories' | 'local_photos', userId: LocalUserId, acknowledgements: SyncRevisionAck[]): void {
  initializeLocalStore();
  db.withTransactionSync(() => {
    for (const item of acknowledgements) {
      db.runSync(`UPDATE ${table} SET synced_to_cloud=1 WHERE user_id=? AND id=? AND sync_revision=?;`, userId, item.id, item.syncRevision);
    }
  });
}

export function markCollectionRevisionsSynced(userId: LocalUserId, acknowledgements: SyncRevisionAck[]): void {
  markRevisionsSynced('local_collections', userId, acknowledgements);
}

export function markMemoryRevisionsSynced(userId: LocalUserId, acknowledgements: SyncRevisionAck[]): void {
  markRevisionsSynced('local_memories', userId, acknowledgements);
}

export function markPhotoRevisionsSynced(userId: LocalUserId, acknowledgements: SyncRevisionAck[]): void {
  markRevisionsSynced('local_photos', userId, acknowledgements);
}

export function markPreferenceRevisionsSynced(userId: LocalUserId, acknowledgements: Array<{ id: string; syncRevision: number }>): void {
  initializeLocalStore();
  db.withTransactionSync(() => {
    for (const item of acknowledgements) {
      db.runSync('UPDATE local_private_preferences SET synced_to_cloud=1 WHERE user_id=? AND key=? AND sync_revision=?;', userId, item.id, item.syncRevision);
    }
  });
}

export function quarantineCloudDeletions(userId: LocalUserId, recordNames: string[], observedAt = now()): void {
  initializeLocalStore();
  db.withTransactionSync(() => {
    for (const recordName of [...new Set(recordNames)].filter(Boolean)) {
      db.runSync(`INSERT INTO local_cloud_deletion_quarantine(user_id,record_name,observed_at) VALUES(?,?,?)
        ON CONFLICT(user_id,record_name) DO UPDATE SET observed_at=excluded.observed_at;`, userId, recordName, observedAt);
      const mappings: Array<[string, string, string]> = [
        ['collection_', 'local_collections', 'id'], ['memory_', 'local_memories', 'id'], ['photo_', 'local_photos', 'id'],
      ];
      for (const [prefix, table, column] of mappings) if (recordName.startsWith(prefix)) {
        db.runSync(`UPDATE ${table} SET synced_to_cloud=0 WHERE user_id=? AND ${column}=?;`, userId, recordName.slice(prefix.length));
      }
      if (recordName.startsWith('preference_')) {
        const encoded = recordName.slice('preference_'.length);
        try { db.runSync('UPDATE local_private_preferences SET synced_to_cloud=0 WHERE user_id=? AND key=?;', userId, decodeURIComponent(encoded)); } catch { /* invalid names stay quarantined */ }
      }
      if (recordName.startsWith('route_')) {
        db.runSync('UPDATE local_journeys SET route_synced_to_cloud=0 WHERE user_id=? AND id=?;', userId, recordName.slice('route_'.length));
      }
    }
  });
}

export function listQuarantinedCloudDeletions(userId: LocalUserId): QuarantinedCloudDeletion[] {
  initializeLocalStore();
  return db.getAllSync<QuarantinedCloudDeletion>('SELECT user_id AS userId,record_name AS recordName,observed_at AS observedAt FROM local_cloud_deletion_quarantine WHERE user_id=? ORDER BY observed_at DESC;', userId);
}

// --- Diagnostics -------------------------------------------------------------

export type LocalDatabaseIntegrityReport = {
  database: 'journeydeck-local.db';
  applicationId: number;
  schemaVersion: number;
  quickCheck: 'ok' | 'failed';
  foreignKeyViolationCount: number;
  ownershipViolationCount: number;
  invalidValueCount: number;
  ok: boolean;
};

/**
 * Runs a read-only integrity audit suitable for Data Health and support logs.
 * It checks SQLite's physical structure plus JourneyDeck's profile boundaries
 * and the most important pre-migration value invariants.
 */
export function localDatabaseIntegrityReport(): LocalDatabaseIntegrityReport {
  initializeLocalStore();
  const quickRow = db.getFirstSync<Record<string, unknown>>('PRAGMA quick_check(1);');
  const quickCheck = String(Object.values(quickRow ?? {})[0] ?? '').toLowerCase() === 'ok' ? 'ok' : 'failed';
  const foreignKeyViolationCount = db.getAllSync<Record<string, unknown>>('PRAGMA foreign_key_check;').length;
  const ownershipViolationCount = Number(db.getFirstSync<{ n: number }>(`SELECT
    (SELECT COUNT(*) FROM local_music_entries m JOIN local_journeys j ON j.id=m.journey_id WHERE m.user_id<>j.user_id) +
    (SELECT COUNT(*) FROM local_photos p JOIN local_collections c ON c.id=p.collection_id WHERE p.user_id<>c.user_id) +
    (SELECT COUNT(*) FROM local_photos p JOIN local_memories m ON m.id=p.memory_id WHERE p.user_id<>m.user_id) +
    (SELECT COUNT(*) FROM local_journeys j JOIN local_places p ON p.id=j.start_place_id WHERE j.user_id<>p.user_id) +
    (SELECT COUNT(*) FROM local_journeys j JOIN local_places p ON p.id=j.end_place_id WHERE j.user_id<>p.user_id) +
    (SELECT COUNT(*) FROM local_music_entries m JOIN local_songs s ON s.id=m.song_id WHERE m.user_id<>s.user_id) +
    (SELECT COUNT(*) FROM local_songs s JOIN local_albums a ON a.id=s.album_id WHERE s.user_id<>a.user_id) +
    (SELECT COUNT(*) FROM local_songs s JOIN local_artworks a ON a.id=s.artwork_id WHERE s.user_id<>a.user_id) +
    (SELECT COUNT(*) FROM local_albums a JOIN local_artworks w ON w.id=a.artwork_id WHERE a.user_id<>w.user_id) +
    (SELECT COUNT(*) FROM local_place_aliases a JOIN local_places p ON p.id=a.canonical_place_id WHERE a.user_id<>p.user_id) +
    (SELECT COUNT(*) FROM local_memories m JOIN local_photos p ON p.id=m.cover_photo_id WHERE m.user_id<>p.user_id) +
    (SELECT COUNT(*) FROM local_collections c
      JOIN json_each(CASE WHEN json_valid(c.journey_ids) THEN c.journey_ids ELSE '[]' END) ids
      JOIN local_journeys j ON j.id=ids.value WHERE c.user_id<>j.user_id) +
    (SELECT COUNT(*) FROM local_memories m
      JOIN json_each(CASE WHEN json_valid(m.collection_ids) THEN m.collection_ids ELSE '[]' END) ids
      JOIN local_collections c ON c.id=ids.value WHERE m.user_id<>c.user_id)
    AS n;`)?.n ?? 0);
  const invalidValueCount = Number(db.getFirstSync<{ n: number }>(`SELECT
    (SELECT COUNT(*) FROM local_journeys WHERE duration_minutes<0 OR miles<0 OR song_count<0
      OR synced_to_cloud NOT IN (0,1) OR route_synced_to_cloud NOT IN (0,1)
      OR (start_lat IS NULL)<>(start_lng IS NULL) OR (end_lat IS NULL)<>(end_lng IS NULL)
      OR start_lat NOT BETWEEN -90 AND 90 OR start_lng NOT BETWEEN -180 AND 180
      OR end_lat NOT BETWEEN -90 AND 90 OR end_lng NOT BETWEEN -180 AND 180) +
    (SELECT COUNT(*) FROM local_gps_points WHERE sequence<0 OR latitude NOT BETWEEN -90 AND 90
      OR longitude NOT BETWEEN -180 AND 180) +
    (SELECT COUNT(*) FROM local_places WHERE trim(label)='' OR lat NOT BETWEEN -90 AND 90
      OR lng NOT BETWEEN -180 AND 180 OR radius_meters<=0 OR radius_meters>50000) +
    (SELECT COUNT(*) FROM local_music_entries WHERE song_id IS NULL) +
    (SELECT COUNT(*) FROM local_artworks WHERE cache_status NOT IN ('pending','cached','failed')
      OR (remote_url IS NOT NULL AND lower(substr(remote_url,1,8))<>'https://')
      OR byte_length<0 OR width<1 OR height<1) +
    (SELECT COUNT(*) FROM local_albums WHERE trim(title)='' OR trim(artist)=''
      OR trim(normalized_title)='' OR trim(normalized_artist)='') +
    (SELECT COUNT(*) FROM local_songs WHERE trim(title)='' OR trim(artist)=''
      OR trim(normalized_title)='' OR trim(normalized_artist)='' OR duration_ms<0) +
    (SELECT COUNT(*) FROM local_collections WHERE json_valid(journey_ids)=0 OR json_type(journey_ids)<>'array') +
    (SELECT COUNT(*) FROM local_memories WHERE json_valid(collection_ids)=0 OR json_type(collection_ids)<>'array') +
    (SELECT COUNT(*) FROM local_private_preferences WHERE json_valid(value_json)=0) +
    (SELECT COUNT(*) FROM local_preferences p WHERE p.key='active_user_id'
      AND NOT EXISTS(SELECT 1 FROM local_users u WHERE u.id=p.value))
    AS n;`)?.n ?? 0);
  const ok = quickCheck === 'ok' && foreignKeyViolationCount === 0
    && ownershipViolationCount === 0 && invalidValueCount === 0;
  return {
    database: 'journeydeck-local.db',
    applicationId: Number(db.getFirstSync<{ application_id: number }>('PRAGMA application_id;')?.application_id ?? 0),
    schemaVersion,
    quickCheck,
    foreignKeyViolationCount,
    ownershipViolationCount,
    invalidValueCount,
    ok,
  };
}

export function localStoreDiagnostics(userId: LocalUserId): {
  schemaVersion: number; journeyCount: number; gpsPointCount: number; musicEntryCount: number;
  songCount: number; albumCount: number; artworkCount: number;
  placeCount: number; collectionCount: number; memoryCount: number; photoCount: number; privatePreferenceCount: number;
  tombstoneCount: number; quarantinedCloudDeletionCount: number; pendingSyncCount: number;
} {
  initializeLocalStore();
  return {
    schemaVersion,
    journeyCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_journeys WHERE user_id=?;', userId)?.n ?? 0),
    gpsPointCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_gps_points WHERE journey_id IN (SELECT id FROM local_journeys WHERE user_id=?);', userId)?.n ?? 0),
    musicEntryCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_music_entries WHERE user_id=?;', userId)?.n ?? 0),
    songCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_songs WHERE user_id=?;', userId)?.n ?? 0),
    albumCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_albums WHERE user_id=?;', userId)?.n ?? 0),
    artworkCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_artworks WHERE user_id=?;', userId)?.n ?? 0),
    placeCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_places WHERE user_id=?;', userId)?.n ?? 0),
    collectionCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_collections WHERE user_id=? AND deleted_at IS NULL;', userId)?.n ?? 0),
    memoryCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_memories WHERE user_id=? AND deleted_at IS NULL;', userId)?.n ?? 0),
    photoCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_photos WHERE user_id=? AND deleted_at IS NULL;', userId)?.n ?? 0),
    privatePreferenceCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_private_preferences WHERE user_id=? AND deleted_at IS NULL;', userId)?.n ?? 0),
    tombstoneCount: Number(db.getFirstSync<{ n: number }>(`SELECT
      (SELECT COUNT(*) FROM local_collections WHERE user_id=? AND deleted_at IS NOT NULL) +
      (SELECT COUNT(*) FROM local_memories WHERE user_id=? AND deleted_at IS NOT NULL) +
      (SELECT COUNT(*) FROM local_photos WHERE user_id=? AND deleted_at IS NOT NULL) +
      (SELECT COUNT(*) FROM local_private_preferences WHERE user_id=? AND deleted_at IS NOT NULL) AS n;`, userId, userId, userId, userId)?.n ?? 0),
    quarantinedCloudDeletionCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_cloud_deletion_quarantine WHERE user_id=?;', userId)?.n ?? 0),
    pendingSyncCount: Number(db.getFirstSync<{ n: number }>(`SELECT
      (SELECT COUNT(*) FROM local_journeys WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_journeys j WHERE j.user_id=? AND j.route_synced_to_cloud=0 AND EXISTS(SELECT 1 FROM local_gps_points p WHERE p.journey_id=j.id)) +
      (SELECT COUNT(*) FROM local_music_entries WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_collections WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_memories WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_photos WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_private_preferences WHERE user_id=? AND synced_to_cloud=0) AS n;`, userId, userId, userId, userId, userId, userId, userId)?.n ?? 0),
  };
}

/**
 * Builds an exact, read-only preview of the conservative legacy-import policy.
 * This function only issues SELECT statements. It never changes or deletes data.
 */
export function previewLocalRetention(
  userId: LocalUserId,
  options: { now?: Date; retentionDays?: number } = {},
): LocalRetentionPreview {
  initializeLocalStore();
  const nowDate = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoffAt = new Date(nowDate.getTime() - retentionDays * 24 * 60 * 60 * 1_000).toISOString();
  const journeys = db.getAllSync<RetentionJourneyCandidate>(`
    SELECT
      j.id AS id,
      j.legacy_drive_id AS legacyDriveId,
      j.provider AS provider,
      j.started_at AS startedAt,
      (SELECT COUNT(*) FROM local_gps_points p WHERE p.journey_id=j.id) AS routePointCount,
      (SELECT COUNT(*) FROM local_music_entries m WHERE m.user_id=j.user_id AND m.journey_id=j.id) AS matchedSongCount
    FROM local_journeys j
    WHERE j.user_id=?;
  `, userId).map(journey => ({
    ...journey,
    routePointCount: Number(journey.routePointCount ?? 0),
    matchedSongCount: Number(journey.matchedSongCount ?? 0),
  }));
  const protectedJourneyIds = new Set<string>();
  let memoryMetadataComplete = true;
  const memories = db.getAllSync<{ journeyIds: string }>(
    'SELECT collection_ids AS journeyIds FROM local_memories WHERE user_id=? AND deleted_at IS NULL;', userId,
  );
  for (const memory of memories) {
    try {
      const ids = JSON.parse(memory.journeyIds) as unknown;
      if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string' && id) protectedJourneyIds.add(id);
    } catch { memoryMetadataComplete = false; }
  }
  if (!memoryMetadataComplete) for (const journey of journeys) {
    protectedJourneyIds.add(journey.id);
    if (journey.legacyDriveId) protectedJourneyIds.add(journey.legacyDriveId);
  }
  const totalSongCount = Number(db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM local_music_entries WHERE user_id=?;', userId,
  )?.n ?? 0);
  const oldUnmatchedSpotifySongCount = Number(db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM local_music_entries WHERE user_id=? AND journey_id IS NULL AND source='spotify' AND julianday(played_at)<julianday(?);",
    userId, cutoffAt,
  )?.n ?? 0);
  const memoryCount = Number(db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM local_memories WHERE user_id=? AND deleted_at IS NULL;', userId,
  )?.n ?? 0);

  return buildRetentionPreview({
    journeys,
    protectedJourneyIds,
    totalSongCount,
    oldUnmatchedSpotifySongCount,
    memoryCount,
    now: nowDate,
    retentionDays,
  });
}
