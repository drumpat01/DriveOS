import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
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
