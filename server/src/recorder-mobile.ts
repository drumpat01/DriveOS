import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { queryTurso } from "./turso-client.js";

type Statement = { sql: string; args?: unknown[] };

export const musicProviders = ["apple_music", "shazam", "lastfm"] as const;
export type MusicProvider = typeof musicProviders[number];
export const accountConnectionStatuses = ["not_connected", "connected", "needs_attention"] as const;
export type AccountConnectionStatus = typeof accountConnectionStatuses[number];
export const shazamConnectionStatuses = ["not_enabled", "enabled", "permission_denied"] as const;
export type ShazamConnectionStatus = typeof shazamConnectionStatuses[number];

export type RecorderProviderPreferences = {
  deviceId: string;
  musicProvider: MusicProvider | null;
  onboardingCompleted: boolean;
  connections: {
    appleMusic: AccountConnectionStatus;
    shazam: ShazamConnectionStatus;
    lastFm: AccountConnectionStatus;
    tessie: AccountConnectionStatus;
  };
  updatedAt: string | null;
};

export type RecorderMusicObservation = {
  observationId: string;
  source: MusicProvider;
  playedAt: string;
  track: string;
  artist: string;
  album?: string | null;
  durationMs?: number | null;
  artworkUrl?: string | null;
  externalUrl?: string | null;
  confidence?: number | null;
};

export type RecorderJourneyCollection = {
  id: string;
  name: string;
  description: string;
  driveIds: string[];
  createdAtUtc: string;
  updatedAtUtc: string;
  photos: RecorderPhoto[];
};

export type RecorderPhoto = {
  id: string;
  fileName: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteLength: number;
  createdAtUtc: string;
  source: "collection" | "memory";
  collectionId: string | null;
  memoryId: string | null;
};

export type RecorderJourneyMemory = {
  id: string;
  name: string;
  notes: string;
  artworkKey: string;
  coverPhotoId: string | null;
  photos: RecorderPhoto[];
  collectionIds: string[];
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type RecorderCollectionInput = { id?: string | null; name: string; description?: string | null; driveIds: string[] };
export type RecorderMemoryInput = { id?: string | null; name: string; notes?: string | null; artworkKey?: string | null; coverPhotoId?: string | null; collectionIds: string[] };
export type RecorderPhotoInput = { fileName: string; contentType: string; dataBase64: string };

type JourneyRow = {
  id: string;
  legacy_drive_id: string;
  provider: string;
  vehicle_name: string | null;
  started_at_utc: string;
  ended_at_utc: string;
  started_at_epoch: number | string;
  ended_at_epoch: number | string;
  starting_location: string | null;
  ending_location: string | null;
  starting_latitude: number | string | null;
  starting_longitude: number | string | null;
  ending_latitude: number | string | null;
  ending_longitude: number | string | null;
  starting_battery: number | string | null;
  ending_battery: number | string | null;
  distance_miles: number | string | null;
  energy_used_kwh: number | string | null;
  average_speed_mph: number | string | null;
  max_speed_mph: number | string | null;
  tessie_tag: string | null;
  driver_profile: string | null;
  soundtrack_payload: string | null;
  recorder_session_id: string | null;
};

type SafeSong = {
  playedAt: string | null;
  track: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  externalUrl: string | null;
  source: string;
  confidence: number | null;
};

const journeyColumns = `
  d.id,d.legacy_drive_id,d.provider,v.display_name AS vehicle_name,
  d.started_at_utc,d.ended_at_utc,d.started_at_epoch,d.ended_at_epoch,
  d.starting_location,d.ending_location,d.starting_latitude,d.starting_longitude,
  d.ending_latitude,d.ending_longitude,d.starting_battery,d.ending_battery,
  d.distance_miles,d.energy_used_kwh,d.average_speed_mph,d.max_speed_mph,
  d.tessie_tag,d.driver_profile,ds.payload_json AS soundtrack_payload,
  (SELECT rs.id FROM recorder_sessions rs WHERE rs.drive_id=d.id AND rs.household_id=d.household_id ORDER BY rs.updated_at_utc DESC LIMIT 1) AS recorder_session_id`;

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validCoordinate(longitude: number, latitude: number) {
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

function boundedText(value: unknown, maximum = 200) {
  return String(value ?? "").trim().slice(0, maximum);
}

function safeHttpsUrl(value: unknown) {
  const raw = boundedText(value, 2048);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch { return null; }
}

function safeJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function safeIso(value: unknown) {
  const raw = boundedText(value, 40);
  return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : null;
}

function safeSong(value: unknown): SafeSong | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const track = boundedText(item.track), artist = boundedText(item.artist);
  if (!track || !artist) return null;
  const source = boundedText(item.source || (item.spotifyUrl ? "spotify" : "unknown"), 40).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "unknown";
  const duration = finiteOrNull(item.durationMs ?? item.duration_ms);
  const confidence = finiteOrNull(item.confidence);
  return {
    playedAt: safeIso(item.playedAt ?? item.played_at),
    track,
    artist,
    album: boundedText(item.album) || null,
    durationMs: duration === null ? null : Math.max(0, Math.min(3_600_000, Math.round(duration))),
    artworkUrl: safeHttpsUrl(item.artworkUrl ?? item.albumImage ?? item.album_image),
    externalUrl: safeHttpsUrl(item.externalUrl ?? item.spotifyUrl ?? item.youtubeUrl),
    source,
    confidence: confidence === null ? null : Math.max(0, Math.min(1, confidence))
  };
}

function soundtrackSongs(payload: unknown) {
  const parsed = safeJson(payload);
  return (Array.isArray(parsed?.songs) ? parsed.songs : []).map(safeSong).filter((song): song is SafeSong => Boolean(song));
}

function uniqueSongs(songs: SafeSong[]) {
  const seen = new Set<string>();
  return songs.filter(song => {
    const key = `${song.playedAt || ""}\0${song.track.toLocaleLowerCase()}\0${song.artist.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => String(a.playedAt).localeCompare(String(b.playedAt)) || a.track.localeCompare(b.track));
}

function encodeCursor(row: JourneyRow) {
  return Buffer.from(JSON.stringify([Number(row.started_at_epoch), row.id])).toString("base64url");
}

function decodeCursor(value: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 || !Number.isSafeInteger(parsed[0]) || typeof parsed[1] !== "string" || !parsed[1] || parsed[1].length > 160) throw new Error();
    return { epoch: parsed[0] as number, id: parsed[1] as string };
  } catch { throw new Error("The journey cursor is invalid."); }
}

function preferenceDefaults(deviceId: string): RecorderProviderPreferences {
  return {
    deviceId,
    musicProvider: null,
    onboardingCompleted: false,
    connections: { appleMusic: "not_connected", shazam: "not_enabled", lastFm: "not_connected", tessie: "not_connected" },
    updatedAt: null
  };
}

const memoryArtworkKeys = new Set(["everyday-life", "weekend-escapes", "summer-2026", "sunday-drives", "road-trips", "texas-weekends", "golden-hour-drives"]);
const collectionIdPattern = /^collection_[a-f0-9]{32}$/;
const memoryIdPattern = /^memory_[a-f0-9]{32}$/;
const attachmentIdPattern = /^(?:attachment|memory_attachment)_[a-f0-9]{32}$/;
const imageContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 1_572_864;

function validatedPhoto(input: RecorderPhotoInput) {
  const fileName = boundedText(input.fileName, 121), contentType = boundedText(input.contentType, 40).toLowerCase();
  if (!fileName || fileName.length > 120 || fileName.includes("/") || fileName.includes("\\")) throw new Error("Photo filename is invalid.");
  if (!imageContentTypes.has(contentType)) throw new Error("Photo must be a JPEG, PNG, or WebP image.");
  let bytes: Buffer;
  try { bytes = Buffer.from(input.dataBase64, "base64"); } catch { throw new Error("Photo data is invalid."); }
  if (!bytes.length || bytes.length > maxPhotoBytes || bytes.toString("base64") !== input.dataBase64.replace(/\s/g, "")) throw new Error("Photo must be a valid image no larger than 1.5 MB.");
  const signatureValid = contentType === "image/jpeg"
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : contentType === "image/png"
      ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!signatureValid) throw new Error("Photo content does not match its file type.");
  return { fileName, contentType: contentType as RecorderPhoto["contentType"], byteLength: bytes.length, dataBase64: bytes.toString("base64") };
}

function photoMetadata(row: Record<string, unknown>, source: RecorderPhoto["source"]): RecorderPhoto {
  return {
    id: String(row.id), fileName: boundedText(row.file_name, 120), contentType: String(row.content_type) as RecorderPhoto["contentType"],
    byteLength: Number(row.byte_length) || 0, createdAtUtc: String(row.created_at_utc), source,
    collectionId: row.collection_id ? String(row.collection_id) : null, memoryId: row.memory_id ? String(row.memory_id) : null
  };
}

function uniqueIdentifiers(values: unknown, maximum: number, label: string) {
  if (!Array.isArray(values)) throw new Error(`${label} must be a list.`);
  const result: string[] = [], seen = new Set<string>();
  for (const value of values) {
    const id = boundedText(value, 160);
    if (!id) throw new Error(`${label} must not contain empty IDs.`);
    if (!seen.has(id)) { seen.add(id); result.push(id); }
  }
  if (result.length > maximum) throw new Error(`${label} may contain at most ${maximum} items.`);
  return result;
}

function normalizedPreferences(deviceId: string, value: unknown, updatedAt: string | null): RecorderProviderPreferences {
  const defaults = preferenceDefaults(deviceId);
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const item = value as Record<string, any>, connections = item.connections && typeof item.connections === "object" ? item.connections : {};
  return {
    deviceId,
    musicProvider: musicProviders.includes(item.musicProvider) ? item.musicProvider : null,
    onboardingCompleted: item.onboardingCompleted === true,
    connections: {
      appleMusic: accountConnectionStatuses.includes(connections.appleMusic) ? connections.appleMusic : defaults.connections.appleMusic,
      shazam: shazamConnectionStatuses.includes(connections.shazam) ? connections.shazam : defaults.connections.shazam,
      lastFm: accountConnectionStatuses.includes(connections.lastFm) ? connections.lastFm : defaults.connections.lastFm,
      tessie: accountConnectionStatuses.includes(connections.tessie) ? connections.tessie : defaults.connections.tessie
    },
    updatedAt
  };
}

export class RecorderMobileStore {
  constructor(private database: DatabaseSync, private householdId: string, private durableTurso: boolean) {}

  private async read(statement: Statement) {
    if (this.durableTurso) return (await queryTurso([statement]))[0];
    return this.database.prepare(statement.sql).all(...((statement.args || []) as any[])) as Record<string, unknown>[];
  }

  private async write(statements: Statement[]) {
    if (this.durableTurso) { await queryTurso(statements); return; }
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      for (const statement of statements) this.database.prepare(statement.sql).run(...((statement.args || []) as any[]));
      this.database.exec("COMMIT;");
    } catch (error) { this.database.exec("ROLLBACK;"); throw error; }
  }

  private async mobileSongs(sessionIds: string[]) {
    const ids = [...new Set(sessionIds.filter(Boolean))];
    if (!ids.length) return new Map<string, SafeSong[]>();
    const placeholders = ids.map(() => "?").join(",");
    const rows = await this.read({
      sql: `SELECT payload_json FROM listening_history WHERE json_valid(payload_json) AND json_extract(payload_json,'$.origin')='journeydeck_mobile' AND json_extract(payload_json,'$.householdId')=? AND json_extract(payload_json,'$.recorderSessionId') IN (${placeholders}) ORDER BY played_at,id;`,
      args: [this.householdId, ...ids]
    });
    const result = new Map<string, SafeSong[]>();
    for (const row of rows) {
      const payload = safeJson(row.payload_json), sessionId = boundedText(payload?.recorderSessionId, 120), song = safeSong(payload);
      if (!sessionId || !song) continue;
      result.set(sessionId, [...(result.get(sessionId) || []), song]);
    }
    return result;
  }

  private async journeySummaries(rows: JourneyRow[], loadedMobileSongs?: Map<string, SafeSong[]>) {
    const mobile = loadedMobileSongs || await this.mobileSongs(rows.map(row => row.recorder_session_id || ""));
    return rows.map(row => {
      const songs = uniqueSongs([...soundtrackSongs(row.soundtrack_payload), ...(row.recorder_session_id ? mobile.get(row.recorder_session_id) || [] : [])]);
      const started = Number(row.started_at_epoch), ended = Number(row.ended_at_epoch);
      return {
        id: row.id,
        legacyDriveId: row.legacy_drive_id,
        provider: boundedText(row.provider, 40),
        vehicleName: boundedText(row.vehicle_name, 120) || null,
        startedAt: row.started_at_utc,
        endedAt: row.ended_at_utc,
        durationMinutes: Math.max(0, Math.round((ended - started) / 60)),
        miles: Math.round((finiteOrNull(row.distance_miles) || 0) * 10) / 10,
        startingLocation: boundedText(row.starting_location, 200) || "Unknown start",
        endingLocation: boundedText(row.ending_location, 200) || "Unknown destination",
        averageSpeedMph: finiteOrNull(row.average_speed_mph),
        maxSpeedMph: finiteOrNull(row.max_speed_mph),
        songCount: songs.length,
        soundtrackPreview: songs.slice(0, 3)
      };
    });
  }

  private async journeyRows(limit: number, cursor = "") {
    const decoded = decodeCursor(cursor), args: unknown[] = [this.householdId];
    let cursorClause = "";
    if (decoded) { cursorClause = " AND (d.started_at_epoch<? OR (d.started_at_epoch=? AND d.id>?))"; args.push(decoded.epoch, decoded.epoch, decoded.id); }
    args.push(limit + 1);
    return await this.read({
      sql: `SELECT ${journeyColumns} FROM drives d JOIN vehicles v ON v.id=d.vehicle_id LEFT JOIN drive_soundtracks ds ON ds.drive_id=d.legacy_drive_id WHERE d.household_id=?${cursorClause} ORDER BY d.started_at_epoch DESC,d.id ASC LIMIT ?;`,
      args
    }) as unknown as JourneyRow[];
  }

  async dashboard(deviceId?: string) {
    const generatedAt = new Date().toISOString(), since = Math.floor(Date.parse(generatedAt) / 1000) - 7 * 24 * 60 * 60;
    const [allTimeRows, recentRows, last7Rows, providerPreferences] = await Promise.all([
      this.read({ sql: "SELECT COUNT(*) AS journey_count,COALESCE(SUM(distance_miles),0) AS miles,COALESCE(SUM(ended_at_epoch-started_at_epoch),0) AS seconds FROM drives WHERE household_id=?;", args: [this.householdId] }),
      this.journeyRows(5),
      this.read({ sql: `SELECT ${journeyColumns} FROM drives d JOIN vehicles v ON v.id=d.vehicle_id LEFT JOIN drive_soundtracks ds ON ds.drive_id=d.legacy_drive_id WHERE d.household_id=? AND d.started_at_epoch>=? ORDER BY d.started_at_epoch DESC,d.id ASC;`, args: [this.householdId, since] }),
      deviceId ? this.preferences(deviceId) : Promise.resolve(null)
    ]);
    const recentPage = recentRows.slice(0, 5), last7Page = last7Rows as unknown as JourneyRow[];
    const mobile = await this.mobileSongs([...recentPage, ...last7Page].map(row => row.recorder_session_id || ""));
    const recent = await this.journeySummaries(recentPage, mobile), last7 = await this.journeySummaries(last7Page, mobile);
    const totals = allTimeRows[0] || {};
    return {
      generatedAt,
      summary: {
        allTime: { journeyCount: Number(totals.journey_count) || 0, miles: Math.round((Number(totals.miles) || 0) * 10) / 10, minutes: Math.max(0, Math.round((Number(totals.seconds) || 0) / 60)) },
        last7Days: { journeyCount: last7.length, miles: Math.round(last7.reduce((sum, item) => sum + item.miles, 0) * 10) / 10, minutes: last7.reduce((sum, item) => sum + item.durationMinutes, 0), songCount: last7.reduce((sum, item) => sum + item.songCount, 0) }
      },
      latestJourney: recent[0] || null,
      recentJourneys: recent,
      providerPreferences
    };
  }

  async journeys(limit: number, cursor = "") {
    const rows = await this.journeyRows(limit, cursor), page = rows.slice(0, limit);
    return { items: await this.journeySummaries(page), nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!) : null };
  }

  async memoriesCatalog() {
    const [collectionRows, collectionDriveRows, collectionPhotoRows, memoryRows, memoryCollectionRows, memoryPhotoRows] = await Promise.all([
      this.read({ sql: "SELECT id,name,description,created_at_utc,updated_at_utc FROM journey_collections WHERE household_id=? ORDER BY updated_at_utc DESC,id;", args: [this.householdId] }),
      this.read({ sql: "SELECT jcd.collection_id,jcd.drive_id FROM journey_collection_drives jcd JOIN journey_collections jc ON jc.id=jcd.collection_id WHERE jc.household_id=? ORDER BY jcd.collection_id,jcd.sort_order,jcd.drive_id;", args: [this.householdId] }),
      this.read({ sql: "SELECT id,collection_id,file_name,content_type,byte_length,created_at_utc FROM journey_attachments WHERE household_id=? AND content_type LIKE 'image/%' ORDER BY collection_id,created_at_utc,id;", args: [this.householdId] }),
      this.read({ sql: "SELECT id,name,notes,artwork_key,cover_attachment_id,created_at_utc,updated_at_utc FROM memories WHERE household_id=? ORDER BY updated_at_utc DESC,id;", args: [this.householdId] }),
      this.read({ sql: "SELECT mc.memory_id,mc.collection_id FROM memory_collections mc JOIN memories m ON m.id=mc.memory_id WHERE m.household_id=? ORDER BY mc.memory_id,mc.sort_order,mc.collection_id;", args: [this.householdId] }),
      this.read({ sql: "SELECT id,memory_id,file_name,content_type,byte_length,created_at_utc FROM memory_attachments WHERE household_id=? AND content_type LIKE 'image/%' ORDER BY memory_id,created_at_utc,id;", args: [this.householdId] })
    ]);
    const drives = new Map<string, string[]>(), collections = new Map<string, string[]>(), collectionPhotos = new Map<string, RecorderPhoto[]>(), memoryPhotos = new Map<string, RecorderPhoto[]>();
    for (const row of collectionDriveRows) drives.set(String(row.collection_id), [...(drives.get(String(row.collection_id)) || []), String(row.drive_id)]);
    for (const row of memoryCollectionRows) collections.set(String(row.memory_id), [...(collections.get(String(row.memory_id)) || []), String(row.collection_id)]);
    for (const row of collectionPhotoRows) collectionPhotos.set(String(row.collection_id), [...(collectionPhotos.get(String(row.collection_id)) || []), photoMetadata(row, "collection")]);
    for (const row of memoryPhotoRows) memoryPhotos.set(String(row.memory_id), [...(memoryPhotos.get(String(row.memory_id)) || []), photoMetadata(row, "memory")]);
    return {
      collections: collectionRows.map(row => ({
        id: String(row.id), name: boundedText(row.name, 80), description: boundedText(row.description, 500),
        driveIds: drives.get(String(row.id)) || [], photos: collectionPhotos.get(String(row.id)) || [], createdAtUtc: String(row.created_at_utc), updatedAtUtc: String(row.updated_at_utc)
      } satisfies RecorderJourneyCollection)),
      memories: memoryRows.map(row => {
        const collectionIds = collections.get(String(row.id)) || [];
        const photos = [...(memoryPhotos.get(String(row.id)) || []), ...collectionIds.flatMap(id => collectionPhotos.get(id) || [])];
        const coverPhotoId = boundedText(row.cover_attachment_id, 80) || null;
        return {
          id: String(row.id), name: boundedText(row.name, 80), notes: boundedText(row.notes, 1200), artworkKey: boundedText(row.artwork_key, 40) || "summer-2026",
          coverPhotoId: coverPhotoId && photos.some(photo => photo.id === coverPhotoId) ? coverPhotoId : null, photos,
          collectionIds, createdAtUtc: String(row.created_at_utc), updatedAtUtc: String(row.updated_at_utc)
        } satisfies RecorderJourneyMemory;
      })
    };
  }

  async saveCollection(input: RecorderCollectionInput) {
    const name = boundedText(input.name, 81), description = boundedText(input.description, 501), driveIds = uniqueIdentifiers(input.driveIds, 100, "Collection journeys");
    if (!name) throw new Error("Collection name is required.");
    if (name.length > 80) throw new Error("Collection name must be 80 characters or fewer.");
    if (description.length > 500) throw new Error("Collection description must be 500 characters or fewer.");
    const id = boundedText(input.id, 80) || `collection_${randomUUID().replaceAll("-", "")}`;
    if (!collectionIdPattern.test(id)) throw new Error("Collection ID is invalid.");
    const existing = await this.read({ sql: "SELECT created_at_utc FROM journey_collections WHERE id=? AND household_id=? LIMIT 1;", args: [id, this.householdId] });
    if (input.id && !existing.length) throw new Error("Collection was not found.");
    if (driveIds.length) {
      const placeholders = driveIds.map(() => "?").join(",");
      const rows = await this.read({ sql: `SELECT id FROM drives WHERE household_id=? AND id IN (${placeholders});`, args: [this.householdId, ...driveIds] });
      if (rows.length !== driveIds.length) throw new Error("One or more collection journeys no longer exist.");
    }
    const now = new Date().toISOString(), createdAt = existing.length ? String(existing[0].created_at_utc) : now;
    const statements: Statement[] = [
      existing.length
        ? { sql: "UPDATE journey_collections SET name=?,description=?,updated_at_utc=? WHERE id=? AND household_id=?;", args: [name, description, now, id, this.householdId] }
        : { sql: "INSERT INTO journey_collections(id,household_id,name,description,created_at_utc,updated_at_utc) VALUES(?,?,?,?,?,?);", args: [id, this.householdId, name, description, createdAt, now] },
      { sql: "DELETE FROM journey_collection_drives WHERE collection_id=?;", args: [id] },
      ...driveIds.map((driveId, index) => ({ sql: "INSERT INTO journey_collection_drives(collection_id,drive_id,sort_order,added_at_utc) VALUES(?,?,?,?);", args: [id, driveId, index, now] }))
    ];
    await this.write(statements);
    const photos = existing.length ? (await this.read({ sql: "SELECT id,collection_id,file_name,content_type,byte_length,created_at_utc FROM journey_attachments WHERE collection_id=? AND household_id=? AND content_type LIKE 'image/%' ORDER BY created_at_utc,id;", args: [id, this.householdId] })).map(row => photoMetadata(row, "collection")) : [];
    return { id, name, description, driveIds, photos, createdAtUtc: createdAt, updatedAtUtc: now } satisfies RecorderJourneyCollection;
  }

  async saveMemory(input: RecorderMemoryInput) {
    const name = boundedText(input.name, 81), notes = boundedText(input.notes, 1201), collectionIds = uniqueIdentifiers(input.collectionIds, 50, "Memory collections");
    const artworkKey = boundedText(input.artworkKey, 40) || "summer-2026", coverPhotoId = boundedText(input.coverPhotoId, 80) || null;
    if (!name) throw new Error("Memory name is required.");
    if (name.length > 80) throw new Error("Memory name must be 80 characters or fewer.");
    if (notes.length > 1200) throw new Error("Memory notes must be 1200 characters or fewer.");
    if (collectionIds.length < 2) throw new Error("A memory must contain at least two collections.");
    if (!memoryArtworkKeys.has(artworkKey)) throw new Error("Memory artwork is invalid.");
    if (coverPhotoId && !attachmentIdPattern.test(coverPhotoId)) throw new Error("Memory cover photo is invalid.");
    if (collectionIds.some(id => !collectionIdPattern.test(id))) throw new Error("Memory collection ID is invalid.");
    const id = boundedText(input.id, 80) || `memory_${randomUUID().replaceAll("-", "")}`;
    if (!memoryIdPattern.test(id)) throw new Error("Memory ID is invalid.");
    const [existing, available] = await Promise.all([
      this.read({ sql: "SELECT created_at_utc FROM memories WHERE id=? AND household_id=? LIMIT 1;", args: [id, this.householdId] }),
      this.read({ sql: `SELECT id FROM journey_collections WHERE household_id=? AND id IN (${collectionIds.map(() => "?").join(",")});`, args: [this.householdId, ...collectionIds] })
    ]);
    if (input.id && !existing.length) throw new Error("Memory was not found.");
    if (available.length !== collectionIds.length) throw new Error("One or more memory collections no longer exist.");
    if (coverPhotoId) {
      const direct = await this.read({ sql: "SELECT id FROM memory_attachments WHERE id=? AND memory_id=? AND household_id=? AND content_type LIKE 'image/%' LIMIT 1;", args: [coverPhotoId, id, this.householdId] });
      const inherited = direct.length ? direct : await this.read({ sql: `SELECT ja.id FROM journey_attachments ja WHERE ja.id=? AND ja.household_id=? AND ja.content_type LIKE 'image/%' AND ja.collection_id IN (${collectionIds.map(() => "?").join(",")}) LIMIT 1;`, args: [coverPhotoId, this.householdId, ...collectionIds] });
      if (!inherited.length) throw new Error("Choose a cover photo that belongs to this Memory.");
    }
    const now = new Date().toISOString(), createdAt = existing.length ? String(existing[0].created_at_utc) : now;
    const statements: Statement[] = [
      existing.length
        ? { sql: "UPDATE memories SET name=?,notes=?,artwork_key=?,cover_attachment_id=?,updated_at_utc=? WHERE id=? AND household_id=?;", args: [name, notes, artworkKey, coverPhotoId, now, id, this.householdId] }
        : { sql: "INSERT INTO memories(id,household_id,name,notes,artwork_key,cover_attachment_id,created_at_utc,updated_at_utc) VALUES(?,?,?,?,?,?,?,?);", args: [id, this.householdId, name, notes, artworkKey, coverPhotoId, createdAt, now] },
      { sql: "DELETE FROM memory_collections WHERE memory_id=?;", args: [id] },
      ...collectionIds.map((collectionId, index) => ({ sql: "INSERT INTO memory_collections(memory_id,collection_id,sort_order,added_at_utc) VALUES(?,?,?,?);", args: [id, collectionId, index, now] }))
    ];
    await this.write(statements);
    const catalog = await this.memoriesCatalog();
    return catalog.memories.find(memory => memory.id === id)!;
  }

  async addPhoto(owner: { collectionId?: string; memoryId?: string }, input: RecorderPhotoInput) {
    const photo = validatedPhoto(input), now = new Date().toISOString();
    const collectionId = boundedText(owner.collectionId, 80), memoryId = boundedText(owner.memoryId, 80);
    if (Boolean(collectionId) === Boolean(memoryId)) throw new Error("Choose exactly one photo destination.");
    const targetRows = collectionId
      ? await this.read({ sql: "SELECT id FROM journey_collections WHERE id=? AND household_id=? LIMIT 1;", args: [collectionId, this.householdId] })
      : await this.read({ sql: "SELECT id FROM memories WHERE id=? AND household_id=? LIMIT 1;", args: [memoryId, this.householdId] });
    if (!targetRows.length) throw new Error(collectionId ? "Collection was not found." : "Memory was not found.");
    const table = collectionId ? "journey_attachments" : "memory_attachments", ownerColumn = collectionId ? "collection_id" : "memory_id", ownerId = collectionId || memoryId;
    const count = await this.read({ sql: `SELECT COUNT(*) AS count FROM ${table} WHERE ${ownerColumn}=? AND household_id=? AND content_type LIKE 'image/%';`, args: [ownerId, this.householdId] });
    if (Number(count[0]?.count) >= 20) throw new Error("This item may contain at most 20 photos.");
    const id = `${collectionId ? "attachment" : "memory_attachment"}_${randomUUID().replaceAll("-", "")}`;
    await this.write([{ sql: `INSERT INTO ${table}(id,household_id,${ownerColumn},file_name,content_type,byte_length,data_base64,created_at_utc) VALUES(?,?,?,?,?,?,?,?);`, args: [id, this.householdId, ownerId, photo.fileName, photo.contentType, photo.byteLength, photo.dataBase64, now] }]);
    return photoMetadata({ id, collection_id: collectionId || null, memory_id: memoryId || null, file_name: photo.fileName, content_type: photo.contentType, byte_length: photo.byteLength, created_at_utc: now }, collectionId ? "collection" : "memory");
  }

  async photo(id: string) {
    if (!attachmentIdPattern.test(id)) return null;
    const table = id.startsWith("memory_attachment_") ? "memory_attachments" : "journey_attachments";
    const rows = await this.read({ sql: `SELECT id,file_name,content_type,byte_length,data_base64,created_at_utc FROM ${table} WHERE id=? AND household_id=? AND content_type LIKE 'image/%' LIMIT 1;`, args: [id, this.householdId] });
    return rows.length ? { ...photoMetadata(rows[0], table === "memory_attachments" ? "memory" : "collection"), dataBase64: String(rows[0].data_base64) } : null;
  }

  async removePhoto(id: string) {
    if (!attachmentIdPattern.test(id)) throw new Error("Photo ID is invalid.");
    const table = id.startsWith("memory_attachment_") ? "memory_attachments" : "journey_attachments";
    const existing = await this.read({ sql: `SELECT id FROM ${table} WHERE id=? AND household_id=? LIMIT 1;`, args: [id, this.householdId] });
    if (!existing.length) throw new Error("Photo was not found.");
    await this.write([
      { sql: "UPDATE memories SET cover_attachment_id=NULL,updated_at_utc=? WHERE household_id=? AND cover_attachment_id=?;", args: [new Date().toISOString(), this.householdId, id] },
      { sql: `DELETE FROM ${table} WHERE id=? AND household_id=?;`, args: [id, this.householdId] }
    ]);
    return { deleted: true, photoId: id };
  }

  async journey(id: string) {
    const rows = await this.read({
      sql: `SELECT ${journeyColumns} FROM drives d JOIN vehicles v ON v.id=d.vehicle_id LEFT JOIN drive_soundtracks ds ON ds.drive_id=d.legacy_drive_id WHERE d.household_id=? AND d.id=? LIMIT 1;`,
      args: [this.householdId, id]
    }) as unknown as JourneyRow[];
    const row = rows[0]; if (!row) return null;
    const mobile = row.recorder_session_id ? await this.mobileSongs([row.recorder_session_id]) : new Map<string, SafeSong[]>();
    const summary = (await this.journeySummaries([row], mobile))[0];
    const soundtrack = uniqueSongs([...soundtrackSongs(row.soundtrack_payload), ...(row.recorder_session_id ? mobile.get(row.recorder_session_id) || [] : [])]);
    let coordinates: [number, number][] = [];
    if (row.recorder_session_id) {
      const points = await this.read({ sql: "SELECT longitude,latitude FROM recorder_points WHERE session_id=? ORDER BY recorded_at_epoch_ms,sequence;", args: [row.recorder_session_id] });
      coordinates = points.map(point => [Number(point.longitude), Number(point.latitude)] as [number, number]).filter(point => validCoordinate(point[0], point[1]));
      if (coordinates.length > 2500) {
        const last = coordinates.at(-1)!, step = (coordinates.length - 1) / 2499;
        coordinates = Array.from({ length: 2499 }, (_, index) => coordinates[Math.floor(index * step)]).concat([last]);
      }
    }
    if (!coordinates.length) {
      const endpoints = [[finiteOrNull(row.starting_longitude), finiteOrNull(row.starting_latitude)], [finiteOrNull(row.ending_longitude), finiteOrNull(row.ending_latitude)]];
      if (endpoints.every(point => point[0] !== null && point[1] !== null && validCoordinate(point[0], point[1]))) coordinates = endpoints as [number, number][];
    }
    return {
      ...summary,
      startingBatteryPercent: finiteOrNull(row.starting_battery),
      endingBatteryPercent: finiteOrNull(row.ending_battery),
      energyUsedKwh: finiteOrNull(row.energy_used_kwh),
      tessieTag: boundedText(row.tessie_tag, 120) || null,
      driverProfile: boundedText(row.driver_profile, 120) || null,
      soundtrack,
      route: coordinates.length >= 2 ? { type: "LineString" as const, coordinates } : null
    };
  }

  async preferences(deviceId: string) {
    const key = `recorder-mobile-preferences:${this.householdId}:${deviceId}`;
    const rows = await this.read({ sql: "SELECT value_json,updated_at FROM app_state WHERE key=? LIMIT 1;", args: [key] });
    const row = rows[0];
    return normalizedPreferences(deviceId, safeJson(row?.value_json), row ? safeIso(row.updated_at) : null);
  }

  async savePreferences(deviceId: string, value: Omit<RecorderProviderPreferences, "deviceId" | "updatedAt">) {
    const now = new Date().toISOString(), normalized = normalizedPreferences(deviceId, value, now);
    const key = `recorder-mobile-preferences:${this.householdId}:${deviceId}`;
    const stored = { musicProvider: normalized.musicProvider, onboardingCompleted: normalized.onboardingCompleted, connections: normalized.connections };
    await this.write([
      { sql: "INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,'Primary household',?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;", args: [this.householdId, now, now] },
      { sql: "INSERT INTO app_state(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;", args: [key, JSON.stringify(stored), now] }
    ]);
    return normalized;
  }

  async recordingWindow(sessionId: string, deviceId: string) {
    const rows = await this.read({
      sql: "SELECT status,started_at_utc,ended_at_utc FROM recorder_sessions WHERE id=? AND household_id=? AND device_id=? LIMIT 1;",
      args: [sessionId, this.householdId, deviceId]
    });
    const row = rows[0];
    if (!row) return null;
    return {
      status: boundedText(row.status, 20),
      startedAt: String(row.started_at_utc),
      endedAt: row.ended_at_utc ? String(row.ended_at_utc) : null
    };
  }

  async saveMusicObservations(sessionId: string, deviceId: string, observations: RecorderMusicObservation[]) {
    const sessions = await this.read({ sql: "SELECT started_at_utc,ended_at_utc FROM recorder_sessions WHERE id=? AND household_id=? AND device_id=? LIMIT 1;", args: [sessionId, this.householdId, deviceId] });
    const session = sessions[0]; if (!session) return null;
    const start = Date.parse(String(session.started_at_utc)) - 15 * 60_000;
    const end = session.ended_at_utc ? Date.parse(String(session.ended_at_utc)) + 15 * 60_000 : Date.now() + 5 * 60_000;
    if (observations.some(item => { const played = Date.parse(item.playedAt); return !Number.isFinite(played) || played < start || played > end; })) throw new Error("Music observations must fall within the recording window.");
    const now = new Date().toISOString(), statements: Statement[] = [];
    for (const observation of observations) {
      const payload = safeSong(observation);
      if (!payload) throw new Error("Music observations require a track and artist.");
      const id = `mobile_music_${createHash("sha256").update(`${this.householdId}\0${sessionId}\0${deviceId}\0${observation.observationId}`).digest("hex").slice(0, 40)}`;
      const stored = { ...payload, origin: "journeydeck_mobile", householdId: this.householdId, recorderSessionId: sessionId, observationId: observation.observationId };
      statements.push({ sql: "INSERT INTO listening_history(id,played_at,payload_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET played_at=excluded.played_at,payload_json=excluded.payload_json;", args: [id, payload.playedAt, JSON.stringify(stored)] });
    }
    if (statements.length) await this.write(statements);
    const countRows = await this.read({ sql: "SELECT COUNT(*) AS total FROM listening_history WHERE json_valid(payload_json) AND json_extract(payload_json,'$.origin')='journeydeck_mobile' AND json_extract(payload_json,'$.householdId')=? AND json_extract(payload_json,'$.recorderSessionId')=?;", args: [this.householdId, sessionId] });
    return { accepted: observations.length, total: Number(countRows[0]?.total) || 0, updatedAt: now };
  }
}
