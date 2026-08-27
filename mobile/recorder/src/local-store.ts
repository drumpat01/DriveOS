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
 * - Privacy by design: raw home/work coordinates are stored ONLY here, inside
 *   the Secure Enclave-backed app sandbox. They never leave the device in plain text.
 * - CloudKit sync uses lightweight summary records; raw GPS points stay local.
 */

import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

// --- Database handle (single shared connection, WAL mode) --------------------

const db = SQLite.openDatabaseSync('journeydeck-local.db');
let schemaVersion = 0;

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
  createdAt: string;
  updatedAt: string;
};

export type LocalMemory = {
  id: string;
  userId: LocalUserId;
  name: string;
  notes: string | null;
  artworkKey: string | null;
  coverPhotoLocalPath: string | null;
  collectionIds: string;
  syncedToCloud: number;
  createdAt: string;
  updatedAt: string;
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
];

// --- Initialisation ----------------------------------------------------------

export function initializeLocalStore(): void {
  if (schemaVersion > 0) return;
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const current = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version ?? 0;
  schemaVersion = current;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.withTransactionSync(() => {
      MIGRATIONS[i]!();
      db.execSync(`PRAGMA user_version = ${i + 1};`);
      schemaVersion = i + 1;
    });
  }
}

// --- Helpers -----------------------------------------------------------------

function now() { return new Date().toISOString(); }
function guard(value: number | null | undefined, min: number, max: number): number | null {
  return value != null && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

type UserOwnedTable = 'local_journeys' | 'local_music_entries' | 'local_places' | 'local_collections' | 'local_memories';

function assertRowOwnership(table: UserOwnedTable, id: string, userId: LocalUserId): void {
  const existing = db.getFirstSync<{ user_id: string }>(`SELECT user_id FROM ${table} WHERE id=?;`, id);
  if (existing && existing.user_id !== userId) {
    throw new Error(`Refusing to modify ${table} row owned by another local user.`);
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
      db.runSync('UPDATE local_journeys SET synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_music_entries SET synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_collections SET synced_to_cloud=0 WHERE user_id=?;', userId);
      db.runSync('UPDATE local_memories SET synced_to_cloud=0 WHERE user_id=?;', userId);
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
  db.withTransactionSync(() => {
    for (const p of points) {
      db.runSync(
        'INSERT OR IGNORE INTO local_gps_points(journey_id,sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps) VALUES(?,?,?,?,?,?,?,?,?);',
        journeyId, p.sequence, p.recordedAt, p.latitude, p.longitude,
        guard(p.accuracyMeters, 0, 10_000), guard(p.altitudeMeters, -1000, 100_000),
        guard(p.headingDegrees, 0, 360), guard(p.speedMps, 0, 150),
      );
    }
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
    const recent = db.getAllSync<{ played_at: string }>(
      'SELECT played_at FROM local_music_entries WHERE user_id=? AND journey_id=? AND source=? AND LOWER(track)=LOWER(?) AND LOWER(artist)=LOWER(?) ORDER BY played_at DESC LIMIT 8;',
      input.userId, input.journeyId, input.source, input.track, input.artist,
    );
    const playedTs = Date.parse(input.playedAt);
    if (options.syncedToCloud !== 1 && recent.some(r => Math.abs(Date.parse(r.played_at) - playedTs) <= 45_000)) return;
  }
  db.runSync(
    `INSERT INTO local_music_entries(id,user_id,journey_id,source,played_at,track,artist,album,duration_ms,artwork_url,external_url,confidence,synced_to_cloud,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET journey_id=excluded.journey_id,source=excluded.source,
       played_at=excluded.played_at,track=excluded.track,artist=excluded.artist,album=excluded.album,duration_ms=excluded.duration_ms,
       artwork_url=excluded.artwork_url,external_url=excluded.external_url,confidence=excluded.confidence,synced_to_cloud=excluded.synced_to_cloud;`,
    input.id, input.userId, input.journeyId ?? null, input.source, input.playedAt,
    input.track, input.artist, input.album ?? null, input.durationMs ?? null, input.artworkUrl ?? null,
    input.externalUrl ?? null, input.confidence ?? null, options.syncedToCloud ?? 0, options.createdAt ?? now(),
  );
}

export function listMusicEntries(userId: LocalUserId, limit = 50): LocalMusicEntry[] {
  initializeLocalStore();
  return db.getAllSync<Record<string, unknown>>(
    'SELECT id,user_id AS userId,journey_id AS journeyId,source,played_at AS playedAt,track,artist,album,duration_ms AS durationMs,artwork_url AS artworkUrl,external_url AS externalUrl,confidence,synced_to_cloud AS syncedToCloud,created_at AS createdAt FROM local_music_entries WHERE user_id=? ORDER BY played_at DESC LIMIT ?;',
    userId, Math.max(1, Math.min(500, Math.trunc(limit))),
  ).map(r => r as unknown as LocalMusicEntry);
}

export function listMusicEntriesForJourney(userId: LocalUserId, journeyId: string): LocalMusicEntry[] {
  initializeLocalStore();
  return db.getAllSync<Record<string, unknown>>(
    'SELECT id,user_id AS userId,journey_id AS journeyId,source,played_at AS playedAt,track,artist,album,duration_ms AS durationMs,artwork_url AS artworkUrl,external_url AS externalUrl,confidence,synced_to_cloud AS syncedToCloud,created_at AS createdAt FROM local_music_entries WHERE user_id=? AND journey_id=? ORDER BY played_at,id;',
    userId, journeyId,
  ).map(row => row as unknown as LocalMusicEntry);
}

// --- Places ------------------------------------------------------------------

export function upsertPlace(input: Omit<LocalPlace, 'createdAt' | 'updatedAt'>): LocalPlace {
  initializeLocalStore();
  assertRowOwnership('local_places', input.id, input.userId);
  const t = now();
  db.runSync(`
    INSERT INTO local_places(id,user_id,kind,label,lat,lng,radius_meters,foursquare_id,osm_id,cached_until,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,label=excluded.label,lat=excluded.lat,lng=excluded.lng,
      radius_meters=excluded.radius_meters,foursquare_id=excluded.foursquare_id,osm_id=excluded.osm_id,
      cached_until=excluded.cached_until,updated_at=excluded.updated_at;
  `, input.id, input.userId, input.kind, input.label, input.lat, input.lng, input.radiusMeters,
    input.foursquareId ?? null, input.osmId ?? null, input.cachedUntil ?? null, t, t);
  return db.getFirstSync<LocalPlace>(
    'SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,foursquare_id AS foursquareId,osm_id AS osmId,cached_until AS cachedUntil,created_at AS createdAt,updated_at AS updatedAt FROM local_places WHERE id=? AND user_id=?;',
    input.id, input.userId,
  )!;
}

export function getSensitivePlaces(userId: LocalUserId): LocalPlace[] {
  initializeLocalStore();
  return db.getAllSync<LocalPlace>(
    "SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,foursquare_id AS foursquareId,osm_id AS osmId,cached_until AS cachedUntil,created_at AS createdAt,updated_at AS updatedAt FROM local_places WHERE user_id=? AND kind IN ('home','work') ORDER BY kind;",
    userId,
  );
}

export function findCachedPlace(userId: LocalUserId, lat: number, lng: number, radiusMeters = 100): LocalPlace | null {
  initializeLocalStore();
  const latDelta = radiusMeters / 111_000;
  const lngDelta = radiusMeters / (111_000 * Math.cos((lat * Math.PI) / 180));
  const places = db.getAllSync<LocalPlace>(
    'SELECT id,user_id AS userId,kind,label,lat,lng,radius_meters AS radiusMeters,foursquare_id AS foursquareId,osm_id AS osmId,cached_until AS cachedUntil,created_at AS createdAt,updated_at AS updatedAt FROM local_places WHERE user_id=? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND (cached_until IS NULL OR cached_until > ?) ORDER BY kind ASC LIMIT 10;',
    userId, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, now(),
  );
  if (!places.length) return null;
  const R = 6_371_000;
  for (const place of places) {
    const dLat = ((place.lat - lat) * Math.PI) / 180;
    const dLng = ((place.lng - lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((place.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    if (2 * R * Math.asin(Math.sqrt(a)) <= radiusMeters) return place;
  }
  return null;
}

// --- Collections & Memories --------------------------------------------------

type CloudUpsertOptions = { syncedToCloud?: 0 | 1; createdAt?: string; updatedAt?: string };

export function upsertCollection(input: Omit<LocalCollection, 'syncedToCloud' | 'createdAt' | 'updatedAt'>, options: CloudUpsertOptions = {}): void {
  initializeLocalStore();
  assertRowOwnership('local_collections', input.id, input.userId);
  const t = now(), createdAt = options.createdAt ?? t, updatedAt = options.updatedAt ?? t;
  db.runSync(
    'INSERT INTO local_collections(id,user_id,name,description,journey_ids,synced_to_cloud,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,journey_ids=excluded.journey_ids,synced_to_cloud=excluded.synced_to_cloud,updated_at=excluded.updated_at;',
    input.id, input.userId, input.name, input.description ?? null, input.journeyIds, options.syncedToCloud ?? 0, createdAt, updatedAt,
  );
}

export function listCollections(userId: LocalUserId): LocalCollection[] {
  initializeLocalStore();
  return db.getAllSync<LocalCollection>(
    'SELECT id,user_id AS userId,name,description,journey_ids AS journeyIds,synced_to_cloud AS syncedToCloud,created_at AS createdAt,updated_at AS updatedAt FROM local_collections WHERE user_id=? ORDER BY updated_at DESC;', userId,
  );
}

export function upsertMemory(input: Omit<LocalMemory, 'syncedToCloud' | 'createdAt' | 'updatedAt'>, options: CloudUpsertOptions = {}): void {
  initializeLocalStore();
  assertRowOwnership('local_memories', input.id, input.userId);
  const t = now(), createdAt = options.createdAt ?? t, updatedAt = options.updatedAt ?? t;
  db.runSync(
    'INSERT INTO local_memories(id,user_id,name,notes,artwork_key,cover_photo_local_path,collection_ids,synced_to_cloud,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,notes=excluded.notes,artwork_key=excluded.artwork_key,cover_photo_local_path=COALESCE(excluded.cover_photo_local_path,local_memories.cover_photo_local_path),collection_ids=excluded.collection_ids,synced_to_cloud=excluded.synced_to_cloud,updated_at=excluded.updated_at;',
    input.id, input.userId, input.name, input.notes ?? null, input.artworkKey ?? null, input.coverPhotoLocalPath ?? null, input.collectionIds, options.syncedToCloud ?? 0, createdAt, updatedAt,
  );
}

export function listMemories(userId: LocalUserId): LocalMemory[] {
  initializeLocalStore();
  return db.getAllSync<LocalMemory>(
    'SELECT id,user_id AS userId,name,notes,artwork_key AS artworkKey,cover_photo_local_path AS coverPhotoLocalPath,collection_ids AS collectionIds,synced_to_cloud AS syncedToCloud,created_at AS createdAt,updated_at AS updatedAt FROM local_memories WHERE user_id=? ORDER BY updated_at DESC;', userId,
  );
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

// --- Diagnostics -------------------------------------------------------------

export function localStoreDiagnostics(userId: LocalUserId): {
  schemaVersion: number; journeyCount: number; gpsPointCount: number; musicEntryCount: number;
  placeCount: number; collectionCount: number; memoryCount: number; pendingSyncCount: number;
} {
  initializeLocalStore();
  return {
    schemaVersion,
    journeyCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_journeys WHERE user_id=?;', userId)?.n ?? 0),
    gpsPointCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_gps_points WHERE journey_id IN (SELECT id FROM local_journeys WHERE user_id=?);', userId)?.n ?? 0),
    musicEntryCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_music_entries WHERE user_id=?;', userId)?.n ?? 0),
    placeCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_places WHERE user_id=?;', userId)?.n ?? 0),
    collectionCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_collections WHERE user_id=?;', userId)?.n ?? 0),
    memoryCount: Number(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM local_memories WHERE user_id=?;', userId)?.n ?? 0),
    pendingSyncCount: Number(db.getFirstSync<{ n: number }>(`SELECT
      (SELECT COUNT(*) FROM local_journeys WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_music_entries WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_collections WHERE user_id=? AND synced_to_cloud=0) +
      (SELECT COUNT(*) FROM local_memories WHERE user_id=? AND synced_to_cloud=0) AS n;`, userId, userId, userId, userId)?.n ?? 0),
  };
}
