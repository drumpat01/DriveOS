import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { queryTurso } from "./turso-client.js";
import type { TimedRouteCoordinate } from "./tessie-route.js";

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
export type RecorderPlaceAliasInput = { location: string; label: string };

export const recorderPlaceCategories = ["home", "work", "school", "favorite", "custom"] as const;
export type RecorderPlaceCategory = typeof recorderPlaceCategories[number];

export type RecorderVehicleIntelligencePreferences = {
  electricityRatePerKwh: number;
  favoriteChargingLocationKeys: string[];
  placeOverrides: { placeId: string; name: string; category: RecorderPlaceCategory }[];
  placeMerges: { sourcePlaceId: string; targetPlaceId: string }[];
};

export type RecorderMusicDashboard = {
  generatedAt: string;
  metrics: { milesWithMusic: number; listeningHours: number; songsOnRoad: number; currentStreak: number };
  recentSelections: SafeSong[];
  topArtists: { artist: string; plays: number; artworkUrl: string | null }[];
  tour: { miles: number; changePercent: number | null };
  mood: { label: string; count: number; percent: number }[];
  cities: { label: string; songs: number }[];
  daily: { date: string; label: string; count: number; minutes: number }[];
  week: { total: number; changePercent: number | null };
};

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
  vehicle_vin: string | null;
};

export type RecorderJourneyRouteLoader = (input: { vin: string; startedAtEpoch: number; endedAtEpoch: number }) => Promise<TimedRouteCoordinate[]>;

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
  v.vin AS vehicle_vin,
  (SELECT rs.id FROM recorder_sessions rs WHERE rs.drive_id=d.id AND rs.household_id=d.household_id ORDER BY rs.updated_at_utc DESC LIMIT 1) AS recorder_session_id`;

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validCoordinate(longitude: number, latitude: number) {
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

function distanceMiles(first: { latitude: number; longitude: number }, second: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude), longitudeDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stablePlaceId(locationKey: string) {
  return `place_${createHash("sha256").update(locationKey).digest("hex").slice(0, 24)}`;
}

function chargingLocationKey(location: unknown, latitude: unknown, longitude: unknown) {
  const raw = boundedText(location, 200), lat = finiteOrNull(latitude), lon = finiteOrNull(longitude);
  const basis = raw || (lat !== null && lon !== null ? `${lat.toFixed(4)},${lon.toFixed(4)}` : "Unknown charging location");
  return `charge_${createHash("sha256").update(basis.toLocaleLowerCase()).digest("hex").slice(0, 20)}`;
}

function boundedText(value: unknown, maximum = 200) {
  return String(value ?? "").trim().slice(0, maximum);
}

function placeAliasKey(location: unknown, latitude: unknown, longitude: unknown) {
  const raw = boundedText(location, 512), lat = finiteOrNull(latitude), lon = finiteOrNull(longitude);
  const genericRecorderLocation = /^(?:recorder|google timeline) location$/i.test(raw);
  if (genericRecorderLocation && lat !== null && lon !== null && validCoordinate(lon, lat)) {
    return `geo:${lat.toFixed(4)},${lon.toFixed(4)}`;
  }
  return raw;
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
  const source = boundedText(item.source || (item.spotifyUrl || item.spotify_url ? "spotify" : "unknown"), 40).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "unknown";
  const duration = finiteOrNull(item.durationMs ?? item.duration_ms);
  const confidence = finiteOrNull(item.confidence);
  return {
    playedAt: safeIso(item.playedAt ?? item.played_at),
    track,
    artist,
    album: boundedText(item.album) || null,
    durationMs: duration === null ? null : Math.max(0, Math.min(3_600_000, Math.round(duration))),
    artworkUrl: safeHttpsUrl(item.artworkUrl ?? item.albumImage ?? item.album_image),
    externalUrl: safeHttpsUrl(item.externalUrl ?? item.spotifyUrl ?? item.spotify_url ?? item.youtubeUrl),
    source,
    confidence: confidence === null ? null : Math.max(0, Math.min(1, confidence))
  };
}

function soundtrackSongs(payload: unknown) {
  const parsed = safeJson(payload);
  return (Array.isArray(parsed?.songs) ? parsed.songs : []).map(safeSong).filter((song): song is SafeSong => Boolean(song));
}

function listeningSong(row: Record<string, unknown>) {
  const payload = safeJson(row.payload_json);
  return safeSong(payload ? { ...payload, playedAt: payload.playedAt ?? payload.played_at ?? row.played_at } : null);
}

function rounded(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function cityLabel(value: unknown) {
  const parts = boundedText(value, 200).split(",").map(part => part.trim()).filter(Boolean);
  if (!parts.length) return "On the road";
  return (parts.length >= 3 ? parts.at(-3)! : parts[0]).replace(/^\d+\s+/, "") || "On the road";
}

function localDayIndex(value: string | null, timezoneOffsetMinutes: number) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.floor((parsed - timezoneOffsetMinutes * 60_000) / 86_400_000) : null;
}

function dayDescriptor(index: number) {
  const date = new Date(index * 86_400_000);
  return {
    date: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date)
  };
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

function normalizedVehicleIntelligencePreferences(value: unknown): RecorderVehicleIntelligencePreferences {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rate = finiteOrNull(item.electricityRatePerKwh);
  const favoriteChargingLocationKeys = Array.isArray(item.favoriteChargingLocationKeys)
    ? [...new Set(item.favoriteChargingLocationKeys.map(value => boundedText(value, 80)).filter(Boolean))].slice(0, 100)
    : [];
  const placeOverrides = Array.isArray(item.placeOverrides) ? item.placeOverrides.flatMap(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const override = value as Record<string, unknown>, placeId = boundedText(override.placeId, 80), name = boundedText(override.name, 64);
    const category = boundedText(override.category, 20) as RecorderPlaceCategory;
    return placeId && name && recorderPlaceCategories.includes(category) ? [{ placeId, name, category }] : [];
  }).slice(0, 500) : [];
  const placeMerges = Array.isArray(item.placeMerges) ? item.placeMerges.flatMap(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const merge = value as Record<string, unknown>, sourcePlaceId = boundedText(merge.sourcePlaceId, 80), targetPlaceId = boundedText(merge.targetPlaceId, 80);
    return sourcePlaceId && targetPlaceId && sourcePlaceId !== targetPlaceId ? [{ sourcePlaceId, targetPlaceId }] : [];
  }).slice(0, 200) : [];
  return {
    electricityRatePerKwh: rate !== null && rate >= 0.01 && rate <= 5 ? Math.round(rate * 10_000) / 10_000 : 0.14,
    favoriteChargingLocationKeys,
    placeOverrides,
    placeMerges
  };
}

export class RecorderMobileStore {
  constructor(private database: DatabaseSync, private householdId: string, private durableTurso: boolean, private journeyRouteLoader?: RecorderJourneyRouteLoader) {}

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

  private async allMobileSongs() {
    const rows = await this.read({
      sql: "SELECT payload_json FROM listening_history WHERE json_valid(payload_json) AND json_extract(payload_json,'$.origin')='journeydeck_mobile' AND json_extract(payload_json,'$.householdId')=? ORDER BY played_at,id;",
      args: [this.householdId]
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
    const aliasRows = await this.read({ sql: "SELECT location,label FROM place_aliases;" });
    const aliases = new Map(aliasRows.map(row => [String(row.location), boundedText(row.label, 64)]));
    return rows.map(row => {
      const songs = uniqueSongs([...soundtrackSongs(row.soundtrack_payload), ...(row.recorder_session_id ? mobile.get(row.recorder_session_id) || [] : [])]);
      const started = Number(row.started_at_epoch), ended = Number(row.ended_at_epoch);
      const rawStartingLocation = boundedText(row.starting_location, 200) || "Unknown start";
      const rawEndingLocation = boundedText(row.ending_location, 200) || "Unknown destination";
      const startingLocationKey = placeAliasKey(rawStartingLocation, row.starting_latitude, row.starting_longitude);
      const endingLocationKey = placeAliasKey(rawEndingLocation, row.ending_latitude, row.ending_longitude);
      return {
        id: row.id,
        legacyDriveId: row.legacy_drive_id,
        provider: boundedText(row.provider, 40),
        vehicleName: boundedText(row.vehicle_name, 120) || null,
        startedAt: row.started_at_utc,
        endedAt: row.ended_at_utc,
        durationMinutes: Math.max(0, Math.round((ended - started) / 60)),
        miles: Math.round((finiteOrNull(row.distance_miles) || 0) * 10) / 10,
        startingLocation: aliases.get(startingLocationKey) || rawStartingLocation,
        endingLocation: aliases.get(endingLocationKey) || rawEndingLocation,
        rawStartingLocation,
        rawEndingLocation,
        startingLocationKey,
        endingLocationKey,
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

  async musicDashboard(timezoneOffsetMinutes = 0): Promise<RecorderMusicDashboard> {
    const offset = Math.max(-840, Math.min(840, Math.round(timezoneOffsetMinutes)));
    const generatedAt = new Date().toISOString();
    const [historyRows, loadedDriveRows, mobile, aliasRows] = await Promise.all([
      this.read({ sql: "SELECT played_at,payload_json FROM listening_history WHERE json_valid(payload_json) ORDER BY played_at DESC,id DESC;" }),
      this.read({ sql: `SELECT ${journeyColumns} FROM drives d JOIN vehicles v ON v.id=d.vehicle_id LEFT JOIN drive_soundtracks ds ON ds.drive_id=d.legacy_drive_id WHERE d.household_id=? ORDER BY d.started_at_epoch DESC,d.id ASC;`, args: [this.householdId] }),
      this.allMobileSongs(),
      this.read({ sql: "SELECT location,label FROM place_aliases;" })
    ]);
    const driveRows = loadedDriveRows as unknown as JourneyRow[];
    const history = historyRows.map(listeningSong).filter((song): song is SafeSong => Boolean(song));
    const aliases = new Map(aliasRows.map(row => [String(row.location), boundedText(row.label, 64)]));
    const today = localDayIndex(generatedAt, offset)!;
    const dailyCounts = new Map<number, number>();
    const dailyMinutes = new Map<number, number>();
    for (const song of history) {
      const day = localDayIndex(song.playedAt, offset);
      if (day !== null) {
        dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
        dailyMinutes.set(day, (dailyMinutes.get(day) || 0) + Math.max(0, song.durationMs || 0) / 60_000);
      }
    }
    const daily = Array.from({ length: 14 }, (_, itemIndex) => {
      const index = today - (13 - itemIndex);
      return { ...dayDescriptor(index), count: dailyCounts.get(index) || 0, minutes: Math.round(dailyMinutes.get(index) || 0) };
    });
    let currentStreak = 0;
    while ((dailyCounts.get(today - currentStreak) || 0) > 0) currentStreak += 1;

    const journeySongs: SafeSong[] = [];
    let milesWithMusic = 0, tourMiles = 0, previousTourMiles = 0;
    const citySongs = new Map<string, number>();
    for (const row of driveRows) {
      const songs = uniqueSongs([...soundtrackSongs(row.soundtrack_payload), ...(row.recorder_session_id ? mobile.get(row.recorder_session_id) || [] : [])]);
      if (!songs.length) continue;
      journeySongs.push(...songs);
      const miles = Math.max(0, finiteOrNull(row.distance_miles) || 0);
      milesWithMusic += miles;
      const driveDay = localDayIndex(row.started_at_utc, offset);
      if (driveDay !== null && driveDay >= today - 6 && driveDay <= today) tourMiles += miles;
      else if (driveDay !== null && driveDay >= today - 13 && driveDay <= today - 7) previousTourMiles += miles;
      const endingLocation = boundedText(row.ending_location, 200), rawLocation = endingLocation || boundedText(row.starting_location, 200);
      const aliasKey = placeAliasKey(rawLocation, endingLocation ? row.ending_latitude : row.starting_latitude, endingLocation ? row.ending_longitude : row.starting_longitude);
      const city = cityLabel(aliases.get(aliasKey) || rawLocation);
      citySongs.set(city, (citySongs.get(city) || 0) + songs.length);
    }

    const todaySongs = history.filter(song => localDayIndex(song.playedAt, offset) === today);
    const selectionSource = todaySongs.length ? todaySongs : history;
    const selectedKeys = new Set<string>();
    const recentSelections = selectionSource.filter(song => {
      const key = `${song.track.toLocaleLowerCase()}\0${song.artist.toLocaleLowerCase()}`;
      if (selectedKeys.has(key)) return false;
      selectedKeys.add(key);
      return true;
    }).slice(0, 6);

    const artists = new Map<string, { artist: string; plays: number; artworkUrl: string | null }>();
    for (const song of history) {
      const key = song.artist.toLocaleLowerCase(), current = artists.get(key);
      if (current) {
        current.plays += 1;
        if (!current.artworkUrl && song.artworkUrl) current.artworkUrl = song.artworkUrl;
      } else artists.set(key, { artist: song.artist, plays: 1, artworkUrl: song.artworkUrl });
    }
    const topArtists = [...artists.values()].sort((a, b) => b.plays - a.plays || a.artist.localeCompare(b.artist)).slice(0, 5);

    const moodLabels = ["Morning", "Midday", "Evening", "Late night"];
    const moodCounts = [0, 0, 0, 0];
    for (const song of journeySongs.length ? journeySongs : history) {
      const parsed = song.playedAt ? Date.parse(song.playedAt) - offset * 60_000 : Number.NaN;
      if (!Number.isFinite(parsed)) continue;
      const hour = new Date(parsed).getUTCHours();
      moodCounts[hour < 10 ? 0 : hour < 16 ? 1 : hour < 22 ? 2 : 3] += 1;
    }
    const moodTotal = Math.max(1, moodCounts.reduce((sum, count) => sum + count, 0));
    const mood = moodLabels.map((label, index) => ({ label, count: moodCounts[index], percent: Math.round((moodCounts[index] / moodTotal) * 100) }));
    const cities = [...citySongs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([label, songs]) => ({ label, songs }));
    const durationMs = journeySongs.reduce((sum, song) => sum + (song.durationMs || 0), 0);
    const weekTotal = daily.slice(-7).reduce((sum, day) => sum + day.count, 0);
    const previousWeekTotal = daily.slice(0, 7).reduce((sum, day) => sum + day.count, 0);
    return {
      generatedAt,
      metrics: {
        milesWithMusic: rounded(milesWithMusic),
        listeningHours: rounded(durationMs / 3_600_000),
        songsOnRoad: journeySongs.length,
        currentStreak
      },
      recentSelections,
      topArtists,
      tour: { miles: rounded(tourMiles), changePercent: previousTourMiles > 0 ? Math.round(((tourMiles - previousTourMiles) / previousTourMiles) * 100) : null },
      mood,
      cities,
      daily,
      week: { total: weekTotal, changePercent: previousWeekTotal > 0 ? Math.round(((weekTotal - previousWeekTotal) / previousWeekTotal) * 100) : null }
    };
  }

  async journeys(limit: number, cursor = "") {
    const rows = await this.journeyRows(limit, cursor), page = rows.slice(0, limit);
    return { items: await this.journeySummaries(page), nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!) : null };
  }

  async savePlaceAlias(input: RecorderPlaceAliasInput) {
    const location = boundedText(input.location, 513), label = boundedText(input.label, 65);
    if (!location || location.length > 512) throw new Error("A valid journey location is required.");
    if (label.length > 64) throw new Error("Location names must be 64 characters or fewer.");
    await this.write(label
      ? [{ sql: "INSERT INTO place_aliases(location,label) VALUES(?,?) ON CONFLICT(location) DO UPDATE SET label=excluded.label;", args: [location, label] }]
      : [{ sql: "DELETE FROM place_aliases WHERE location=?;", args: [location] }]);
    return { location, label, removed: !label };
  }

  private async vehicleIntelligencePreferences() {
    const key = `recorder-vehicle-intelligence:${this.householdId}`;
    const rows = await this.read({ sql: "SELECT value_json FROM app_state WHERE key=? LIMIT 1;", args: [key] });
    return normalizedVehicleIntelligencePreferences(safeJson(rows[0]?.value_json));
  }

  async vehicleIntelligence(timezoneOffsetMinutes = 0) {
    const offset = Math.max(-840, Math.min(840, Math.round(timezoneOffsetMinutes)));
    const [loadedChargingRows, loadedDriveRows, aliasRows, foursquareRows, preferences] = await Promise.all([
      this.read({
        sql: `SELECT c.id,c.provider,c.started_at_utc,c.ended_at_utc,c.started_at_epoch,c.ended_at_epoch,c.location,c.latitude,c.longitude,c.is_supercharger,c.energy_added_kwh,c.energy_used_kwh,c.miles_added,c.starting_battery,c.ending_battery,c.recorded_cost,v.display_name AS vehicle_name FROM charging_sessions c JOIN vehicles v ON v.id=c.vehicle_id WHERE c.household_id=? ORDER BY c.started_at_epoch DESC,c.id LIMIT 500;`,
        args: [this.householdId]
      }),
      this.read({ sql: `SELECT ${journeyColumns} FROM drives d JOIN vehicles v ON v.id=d.vehicle_id LEFT JOIN drive_soundtracks ds ON ds.drive_id=d.legacy_drive_id WHERE d.household_id=? ORDER BY d.started_at_epoch DESC,d.id ASC LIMIT 2000;`, args: [this.householdId] }),
      this.read({ sql: "SELECT location,label FROM place_aliases;" }),
      this.read({ sql: "SELECT value_json FROM app_state WHERE key='foursquare-cache' LIMIT 1;" }),
      this.vehicleIntelligencePreferences()
    ]);
    const driveRows = loadedDriveRows as unknown as JourneyRow[], mobile = await this.mobileSongs(driveRows.map(row => row.recorder_session_id || ""));
    const aliases = new Map(aliasRows.map(row => [String(row.location), boundedText(row.label, 64)]));
    const overrides = new Map(preferences.placeOverrides.map(item => [item.placeId, item]));
    const mergeTargets = new Map(preferences.placeMerges.map(item => [item.sourcePlaceId, item.targetPlaceId]));
    const timeLabels = ["Morning", "Midday", "Evening", "Late night"];
    const foursquarePayload = safeJson(foursquareRows[0]?.value_json);
    const foursquareEntries = Array.isArray(foursquarePayload?.entries) ? foursquarePayload.entries.filter(value => value && typeof value === "object" && !Array.isArray(value)) as Record<string, unknown>[] : [];
    type PlaceAccumulator = {
      id: string; label: string; category: RecorderPlaceCategory; latitude: number | null; longitude: number | null;
      arrivals: number; departures: number; firstSeenAt: string; lastSeenAt: string; aliasKeys: Set<string>;
      timeCounts: number[]; journeyMap: Map<string, { id: string; startedAt: string; startingLocation: string; endingLocation: string; miles: number; energyUsedKwh: number | null }>;
      songCounts: Map<string, { track: string; artist: string; plays: number; artworkUrl: string | null }>;
    };
    const places = new Map<string, PlaceAccumulator>();
    const placeFor = (location: unknown, latitudeValue: unknown, longitudeValue: unknown, seenAt: string) => {
      const raw = boundedText(location, 200) || "Unknown place", latitude = finiteOrNull(latitudeValue), longitude = finiteOrNull(longitudeValue);
      const aliasKey = placeAliasKey(raw, latitude, longitude), id = stablePlaceId(aliasKey), override = overrides.get(id);
      const aliased = aliases.get(aliasKey) || raw;
      const inferredCategory: RecorderPlaceCategory = /^home$/i.test(aliased) ? "home" : /^work$/i.test(aliased) ? "work" : /school/i.test(aliased) ? "school" : "custom";
      let place = places.get(id);
      if (!place) {
        place = { id, label: override?.name || aliased, category: override?.category || inferredCategory, latitude, longitude, arrivals: 0, departures: 0, firstSeenAt: seenAt, lastSeenAt: seenAt, aliasKeys: new Set(), timeCounts: [0, 0, 0, 0], journeyMap: new Map(), songCounts: new Map() };
        places.set(id, place);
      }
      place.aliasKeys.add(aliasKey);
      if (seenAt < place.firstSeenAt) place.firstSeenAt = seenAt;
      if (seenAt > place.lastSeenAt) place.lastSeenAt = seenAt;
      return place;
    };
    const routeGroups = new Map<string, { startPlaceId: string; endPlaceId: string; startLabel: string; endLabel: string; trips: number; miles: number; energyKwh: number; cost: number; efficiencies: number[] }>();
    for (const row of driveRows) {
      const start = placeFor(row.starting_location, row.starting_latitude, row.starting_longitude, row.started_at_utc);
      const end = placeFor(row.ending_location, row.ending_latitude, row.ending_longitude, row.ended_at_utc);
      start.departures += 1; end.arrivals += 1;
      const localHour = new Date(Date.parse(row.ended_at_utc) - offset * 60_000).getUTCHours();
      end.timeCounts[localHour < 10 ? 0 : localHour < 16 ? 1 : localHour < 22 ? 2 : 3] += 1;
      const related = { id: row.id, startedAt: row.started_at_utc, startingLocation: start.label, endingLocation: end.label, miles: rounded(Math.max(0, finiteOrNull(row.distance_miles) || 0)), energyUsedKwh: finiteOrNull(row.energy_used_kwh) };
      start.journeyMap.set(row.id, related); end.journeyMap.set(row.id, related);
      const songs = uniqueSongs([...soundtrackSongs(row.soundtrack_payload), ...(row.recorder_session_id ? mobile.get(row.recorder_session_id) || [] : [])]);
      for (const place of [start, end]) for (const song of songs) {
        const key = `${song.track.toLocaleLowerCase()}\0${song.artist.toLocaleLowerCase()}`, existing = place.songCounts.get(key);
        if (existing) existing.plays += 1;
        else place.songCounts.set(key, { track: song.track, artist: song.artist, plays: 1, artworkUrl: song.artworkUrl });
      }
      const miles = Math.max(0, finiteOrNull(row.distance_miles) || 0), energyKwh = Math.max(0, finiteOrNull(row.energy_used_kwh) || 0);
      if (miles > 0 && energyKwh > 0) {
        const key = `${start.id}\0${end.id}`, group = routeGroups.get(key) || { startPlaceId: start.id, endPlaceId: end.id, startLabel: start.label, endLabel: end.label, trips: 0, miles: 0, energyKwh: 0, cost: 0, efficiencies: [] };
        group.trips += 1; group.miles += miles; group.energyKwh += energyKwh; group.cost += energyKwh * preferences.electricityRatePerKwh; group.efficiencies.push(energyKwh * 1000 / miles);
        routeGroups.set(key, group);
      }
    }
    for (const [sourceId, targetId] of mergeTargets) {
      const source = places.get(sourceId), target = places.get(targetId);
      if (!source || !target) continue;
      target.arrivals += source.arrivals; target.departures += source.departures;
      source.aliasKeys.forEach(key => target.aliasKeys.add(key));
      source.journeyMap.forEach((journey, id) => target.journeyMap.set(id, journey));
      source.songCounts.forEach((song, key) => { const existing = target.songCounts.get(key); if (existing) existing.plays += song.plays; else target.songCounts.set(key, { ...song }); });
      source.timeCounts.forEach((count, index) => { target.timeCounts[index] += count; });
      if (source.firstSeenAt < target.firstSeenAt) target.firstSeenAt = source.firstSeenAt;
      if (source.lastSeenAt > target.lastSeenAt) target.lastSeenAt = source.lastSeenAt;
      places.delete(sourceId);
    }
    const placeItems = [...places.values()].map(place => {
      const suggestion = place.latitude === null || place.longitude === null ? null : foursquareEntries.map(entry => {
        const latitude = finiteOrNull(entry.latitude), longitude = finiteOrNull(entry.longitude);
        if (latitude === null || longitude === null) return null;
        return { distance: distanceMiles({ latitude: place.latitude!, longitude: place.longitude! }, { latitude, longitude }), name: boundedText(entry.name ?? entry.businessName ?? entry.label, 64), category: boundedText(entry.category, 64), address: boundedText(entry.address ?? entry.businessAddress, 160) };
      }).filter((item): item is NonNullable<typeof item> => Boolean(item?.name) && item!.distance <= 0.3).sort((a, b) => a.distance - b.distance)[0] || null;
      return {
        id: place.id, name: place.label, category: place.category, latitude: place.latitude, longitude: place.longitude,
        visitCount: place.arrivals || place.departures, arrivals: place.arrivals, departures: place.departures, firstSeenAt: place.firstSeenAt, lastSeenAt: place.lastSeenAt,
        timeOfDay: timeLabels.map((label, index) => ({ label, visits: place.timeCounts[index] })).filter(item => item.visits > 0),
        relatedJourneys: [...place.journeyMap.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8),
        soundtrack: [...place.songCounts.values()].sort((a, b) => b.plays - a.plays || a.track.localeCompare(b.track)).slice(0, 5),
        foursquareSuggestion: suggestion ? { name: suggestion.name, category: suggestion.category || null, address: suggestion.address || null } : null
      };
    }).sort((a, b) => b.visitCount - a.visitCount || b.lastSeenAt.localeCompare(a.lastSeenAt));
    const duplicateCandidates: { sourcePlaceId: string; targetPlaceId: string; reason: string }[] = [];
    for (let firstIndex = 0; firstIndex < Math.min(placeItems.length, 250); firstIndex += 1) for (let secondIndex = firstIndex + 1; secondIndex < Math.min(placeItems.length, 250); secondIndex += 1) {
      const first = placeItems[firstIndex]!, second = placeItems[secondIndex]!;
      const sameName = first.name.trim().toLocaleLowerCase() === second.name.trim().toLocaleLowerCase();
      const nearby = first.latitude !== null && first.longitude !== null && second.latitude !== null && second.longitude !== null
        && distanceMiles({ latitude: first.latitude, longitude: first.longitude }, { latitude: second.latitude, longitude: second.longitude }) <= 0.15;
      if (sameName || nearby) duplicateCandidates.push({ sourcePlaceId: second.id, targetPlaceId: first.id, reason: sameName ? "Same name" : "Within 0.15 miles" });
      if (duplicateCandidates.length >= 30) break;
    }
    const chargingSessions = loadedChargingRows.map(row => {
      const energyAddedKwh = Math.max(0, finiteOrNull(row.energy_added_kwh) || 0), energyUsedKwh = Math.max(0, finiteOrNull(row.energy_used_kwh) || 0);
      const recordedCost = finiteOrNull(row.recorded_cost), started = Number(row.started_at_epoch), ended = Number(row.ended_at_epoch);
      const startingBatteryPercent = finiteOrNull(row.starting_battery), endingBatteryPercent = finiteOrNull(row.ending_battery);
      return {
        id: String(row.id), locationKey: chargingLocationKey(row.location, row.latitude, row.longitude), location: boundedText(row.location, 200) || "Charging location",
        vehicleName: boundedText(row.vehicle_name, 120) || null, provider: boundedText(row.provider, 40), startedAt: String(row.started_at_utc), endedAt: String(row.ended_at_utc),
        durationMinutes: Math.max(0, Math.round((ended - started) / 60)), isSupercharger: Number(row.is_supercharger) === 1,
        energyAddedKwh: rounded(energyAddedKwh, 2), energyUsedKwh: rounded(energyUsedKwh, 2), milesAdded: rounded(Math.max(0, finiteOrNull(row.miles_added) || 0), 1),
        startingBatteryPercent, endingBatteryPercent, batteryGainedPercent: startingBatteryPercent !== null && endingBatteryPercent !== null ? Math.max(0, rounded(endingBatteryPercent - startingBatteryPercent, 1)) : null,
        cost: rounded(recordedCost !== null ? Math.max(0, recordedCost) : energyAddedKwh * preferences.electricityRatePerKwh, 2), costSource: recordedCost !== null ? "recorded" : "estimated"
      };
    });
    const cutoff = Date.now() - 30 * 86_400_000, recentCharging = chargingSessions.filter(item => Date.parse(item.startedAt) >= cutoff);
    const favoriteKeys = new Set(preferences.favoriteChargingLocationKeys), chargingLocations = new Map<string, { locationKey: string; name: string; sessions: number; energyAddedKwh: number; cost: number; lastChargedAt: string; isFavorite: boolean }>();
    for (const session of chargingSessions) {
      const current = chargingLocations.get(session.locationKey) || { locationKey: session.locationKey, name: session.location, sessions: 0, energyAddedKwh: 0, cost: 0, lastChargedAt: session.startedAt, isFavorite: favoriteKeys.has(session.locationKey) };
      current.sessions += 1; current.energyAddedKwh += session.energyAddedKwh; current.cost += session.cost;
      if (session.startedAt > current.lastChargedAt) current.lastChargedAt = session.startedAt;
      chargingLocations.set(session.locationKey, current);
    }
    return {
      generatedAt: new Date().toISOString(), preferences,
      chargingSummary30Days: {
        sessions: recentCharging.length,
        energyAddedKwh: rounded(recentCharging.reduce((sum, item) => sum + item.energyAddedKwh, 0), 1),
        batteryGainedPercent: rounded(recentCharging.reduce((sum, item) => sum + (item.batteryGainedPercent || 0), 0), 1),
        durationMinutes: recentCharging.reduce((sum, item) => sum + item.durationMinutes, 0),
        cost: rounded(recentCharging.reduce((sum, item) => sum + item.cost, 0), 2)
      },
      chargingSessions,
      chargingLocations: [...chargingLocations.values()].map(item => ({ ...item, energyAddedKwh: rounded(item.energyAddedKwh, 1), cost: rounded(item.cost, 2) })).sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.lastChargedAt.localeCompare(a.lastChargedAt)),
      places: placeItems,
      duplicateCandidates,
      routeComparisons: [...routeGroups.values()].map(group => ({
        ...group, miles: rounded(group.miles, 1), energyKwh: rounded(group.energyKwh, 2), cost: rounded(group.cost, 2),
        averageWhPerMile: Math.round(group.energyKwh * 1000 / group.miles), bestWhPerMile: Math.round(Math.min(...group.efficiencies)), worstWhPerMile: Math.round(Math.max(...group.efficiencies))
      })).sort((a, b) => b.trips - a.trips || b.miles - a.miles).slice(0, 50)
    };
  }

  async saveVehicleIntelligencePreferences(value: RecorderVehicleIntelligencePreferences) {
    const preferences = normalizedVehicleIntelligencePreferences(value), now = new Date().toISOString();
    const key = `recorder-vehicle-intelligence:${this.householdId}`;
    const rows = await this.read({ sql: "SELECT starting_location,starting_latitude,starting_longitude,ending_location,ending_latitude,ending_longitude FROM drives WHERE household_id=?;", args: [this.householdId] });
    const aliasKeys = new Map<string, Set<string>>();
    for (const row of rows) for (const endpoint of [
      [row.starting_location, row.starting_latitude, row.starting_longitude],
      [row.ending_location, row.ending_latitude, row.ending_longitude]
    ]) {
      const locationKey = placeAliasKey(endpoint[0], endpoint[1], endpoint[2]), placeId = stablePlaceId(locationKey);
      aliasKeys.set(placeId, (aliasKeys.get(placeId) || new Set()).add(locationKey));
    }
    const overrideNames = new Map(preferences.placeOverrides.map(item => [item.placeId, item.name]));
    const statements: Statement[] = [
      { sql: "INSERT INTO app_state(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;", args: [key, JSON.stringify(preferences), now] }
    ];
    for (const override of preferences.placeOverrides) for (const locationKey of aliasKeys.get(override.placeId) || []) {
      statements.push({ sql: "INSERT INTO place_aliases(location,label) VALUES(?,?) ON CONFLICT(location) DO UPDATE SET label=excluded.label;", args: [locationKey, override.name] });
    }
    for (const merge of preferences.placeMerges) {
      const targetName = overrideNames.get(merge.targetPlaceId);
      if (!targetName) continue;
      for (const locationKey of aliasKeys.get(merge.sourcePlaceId) || []) statements.push({ sql: "INSERT INTO place_aliases(location,label) VALUES(?,?) ON CONFLICT(location) DO UPDATE SET label=excluded.label;", args: [locationKey, targetName] });
    }
    await this.write(statements);
    return preferences;
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
    let timedCoordinates: TimedRouteCoordinate[] = [];
    if (row.recorder_session_id) {
      const points = await this.read({ sql: "SELECT recorded_at_epoch_ms,longitude,latitude,heading_degrees,speed_mps FROM recorder_points WHERE session_id=? ORDER BY recorded_at_epoch_ms,sequence;", args: [row.recorder_session_id] });
      timedCoordinates = points.map(point => ({
        recordedAtEpochMs: Number(point.recorded_at_epoch_ms),
        coordinate: [Number(point.longitude), Number(point.latitude)] as [number, number],
        speedMph: finiteOrNull(point.speed_mps) === null ? null : finiteOrNull(point.speed_mps)! * 2.2369362921,
        headingDegrees: finiteOrNull(point.heading_degrees),
        batteryPercent: null
      })).filter(point => Number.isFinite(point.recordedAtEpochMs) && validCoordinate(point.coordinate[0], point.coordinate[1]));
      coordinates = timedCoordinates.map(point => point.coordinate);
      if (coordinates.length > 2500) {
        const last = coordinates.at(-1)!, step = (coordinates.length - 1) / 2499;
        coordinates = Array.from({ length: 2499 }, (_, index) => coordinates[Math.floor(index * step)]).concat([last]);
      }
    }
    if (!timedCoordinates.length && row.vehicle_vin && /tessie/i.test(row.provider) && this.journeyRouteLoader) {
      try {
        timedCoordinates = await this.journeyRouteLoader({
          vin: row.vehicle_vin,
          startedAtEpoch: Number(row.started_at_epoch),
          endedAtEpoch: Number(row.ended_at_epoch)
        });
        const routeStartMs = Number(row.started_at_epoch) * 1000, routeEndMs = Number(row.ended_at_epoch) * 1000;
        timedCoordinates = timedCoordinates.filter(point => point.recordedAtEpochMs >= routeStartMs && point.recordedAtEpochMs <= routeEndMs);
        coordinates = timedCoordinates.map(point => point.coordinate);
        if (coordinates.length > 2500) {
          const last = coordinates.at(-1)!, step = (coordinates.length - 1) / 2499;
          coordinates = Array.from({ length: 2499 }, (_, index) => coordinates[Math.floor(index * step)]).concat([last]);
        }
      } catch {
        timedCoordinates = [];
      }
    }
    if (!coordinates.length) {
      const endpoints = [[finiteOrNull(row.starting_longitude), finiteOrNull(row.starting_latitude)], [finiteOrNull(row.ending_longitude), finiteOrNull(row.ending_latitude)]];
      if (endpoints.every(point => point[0] !== null && point[1] !== null && validCoordinate(point[0], point[1]))) coordinates = endpoints as [number, number][];
    }
    const routePointSource = timedCoordinates.length > 2500
      ? Array.from({ length: 2499 }, (_, index) => timedCoordinates[Math.floor(index * (timedCoordinates.length - 1) / 2499)]!).concat([timedCoordinates.at(-1)!])
      : timedCoordinates;
    const soundtrackWithCoordinates = soundtrack.map(song => {
      const playedAt = song.playedAt ? Date.parse(song.playedAt) : Number.NaN;
      if (!Number.isFinite(playedAt) || !timedCoordinates.length) return { ...song, mapCoordinate: null };
      let nearest = timedCoordinates[0]!;
      for (const point of timedCoordinates.slice(1)) {
        if (Math.abs(point.recordedAtEpochMs - playedAt) < Math.abs(nearest.recordedAtEpochMs - playedAt)) nearest = point;
      }
      return { ...song, mapCoordinate: nearest.coordinate };
    });
    return {
      ...summary,
      startingBatteryPercent: finiteOrNull(row.starting_battery),
      endingBatteryPercent: finiteOrNull(row.ending_battery),
      energyUsedKwh: finiteOrNull(row.energy_used_kwh),
      tessieTag: boundedText(row.tessie_tag, 120) || null,
      driverProfile: boundedText(row.driver_profile, 120) || null,
      soundtrack: soundtrackWithCoordinates,
      route: coordinates.length >= 2 ? {
        type: "LineString" as const,
        coordinates,
        points: routePointSource.map(point => ({
          recordedAt: new Date(point.recordedAtEpochMs).toISOString(),
          coordinate: point.coordinate,
          speedMph: point.speedMph ?? null,
          headingDegrees: point.headingDegrees ?? null,
          batteryPercent: point.batteryPercent ?? null
        }))
      } : null
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
