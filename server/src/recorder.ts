import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { queryTurso } from "./turso-client.js";

type Statement = { sql: string; args?: unknown[] };

export type RecorderPoint = {
  sequence: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  altitudeMeters?: number | null;
  headingDegrees?: number | null;
  speedMps?: number | null;
};

type RecorderSessionRow = {
  id: string;
  household_id: string;
  device_id: string;
  status: "recording" | "paused" | "completed";
  started_at_utc: string;
  ended_at_utc: string | null;
  point_count: number | string;
  last_sequence: number | string;
  distance_miles: number | string;
  drive_id: string | null;
  updated_at_utc: string;
};

type RecorderPointRow = {
  sequence: number | string;
  recorded_at_utc: string;
  recorded_at_epoch_ms: number | string;
  latitude: number | string;
  longitude: number | string;
  accuracy_meters: number | string | null;
  altitude_meters: number | string | null;
  heading_degrees: number | string | null;
  speed_mps: number | string | null;
};

function stableId(entity: string, providerKey: string) {
  return `${entity}_${createHash("sha256").update(`journeydeck\0${entity}\0${providerKey}`).digest("hex").slice(0, 32)}`;
}

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sessionResult(row: RecorderSessionRow) {
  return {
    id: row.id,
    deviceId: row.device_id,
    status: row.status,
    startedAt: row.started_at_utc,
    endedAt: row.ended_at_utc,
    pointCount: Number(row.point_count) || 0,
    lastSequence: Number(row.last_sequence),
    distanceMiles: Number(row.distance_miles) || 0,
    driveId: row.drive_id,
    updatedAt: row.updated_at_utc
  };
}

function pointResult(row: RecorderPointRow) {
  return {
    sequence: Number(row.sequence),
    recordedAt: row.recorded_at_utc,
    recordedAtEpochMs: Number(row.recorded_at_epoch_ms),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: finiteOrNull(row.accuracy_meters),
    altitudeMeters: finiteOrNull(row.altitude_meters),
    headingDegrees: finiteOrNull(row.heading_degrees),
    speedMps: finiteOrNull(row.speed_mps)
  };
}

function radians(value: number) { return value * Math.PI / 180; }

function segmentMiles(a: ReturnType<typeof pointResult>, b: ReturnType<typeof pointResult>) {
  const latitudeDelta = radians(b.latitude - a.latitude), longitudeDelta = radians(b.longitude - a.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function routeMetrics(points: Array<ReturnType<typeof pointResult>>) {
  let distanceMiles = 0, maxSpeedMph = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1], current = points[index];
    const seconds = (current.recordedAtEpochMs - previous.recordedAtEpochMs) / 1000;
    if (seconds <= 0 || seconds > 900) continue;
    const miles = segmentMiles(previous, current), derivedSpeed = miles / (seconds / 3600);
    if (derivedSpeed <= 150) distanceMiles += miles;
    if (derivedSpeed <= 150) maxSpeedMph = Math.max(maxSpeedMph, derivedSpeed);
    if (current.speedMps !== null && current.speedMps >= 0) maxSpeedMph = Math.max(maxSpeedMph, current.speedMps * 2.236936);
  }
  const durationHours = Math.max(0, points.at(-1)!.recordedAtEpochMs - points[0].recordedAtEpochMs) / 3_600_000;
  return {
    distanceMiles: Math.round(distanceMiles * 1000) / 1000,
    averageSpeedMph: durationHours > 0 ? Math.round(distanceMiles / durationHours * 10) / 10 : 0,
    maxSpeedMph: Math.round(maxSpeedMph * 10) / 10
  };
}

const sessionColumns = "id,household_id,device_id,status,started_at_utc,ended_at_utc,point_count,last_sequence,distance_miles,drive_id,updated_at_utc";
const pointColumns = "sequence,recorded_at_utc,recorded_at_epoch_ms,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps";

export class RecorderStore {
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
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  private async session(id: string, deviceId?: string) {
    const args: unknown[] = [id, this.householdId], deviceClause = deviceId ? " AND device_id=?" : "";
    if (deviceId) args.push(deviceId);
    const rows = await this.read({ sql: `SELECT ${sessionColumns} FROM recorder_sessions WHERE id=? AND household_id=?${deviceClause} LIMIT 1;`, args });
    return rows[0] as unknown as RecorderSessionRow | undefined;
  }

  private async points(id: string) {
    const rows = await this.read({ sql: `SELECT ${pointColumns} FROM recorder_points WHERE session_id=? ORDER BY recorded_at_epoch_ms,sequence;`, args: [id] });
    return rows.map(row => pointResult(row as unknown as RecorderPointRow));
  }

  async start(id: string, deviceId: string, startedAt: string) {
    const now = new Date().toISOString();
    await this.write([
      { sql: "INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,'Primary household',?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;", args: [this.householdId, now, now] },
      { sql: "INSERT INTO recorder_sessions(id,household_id,device_id,status,started_at_utc,created_at_utc,updated_at_utc) VALUES(?,?,?,'recording',?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc WHERE recorder_sessions.household_id=excluded.household_id AND recorder_sessions.device_id=excluded.device_id AND recorder_sessions.status!='completed';", args: [id, this.householdId, deviceId, startedAt, now, now] }
    ]);
    const row = await this.session(id, deviceId);
    if (!row) throw new Error("Recorder session could not be created for this device.");
    return sessionResult(row);
  }

  async appendPoints(id: string, deviceId: string, points: RecorderPoint[]) {
    const row = await this.session(id, deviceId);
    if (!row) return null;
    if (row.status === "completed") throw new Error("Completed recordings cannot accept new points.");
    const now = new Date().toISOString();
    const statements: Statement[] = points.map(point => ({
      sql: "INSERT INTO recorder_points(session_id,sequence,recorded_at_utc,recorded_at_epoch_ms,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps,created_at_utc) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM recorder_sessions WHERE id=? AND household_id=? AND device_id=? AND status!='completed') ON CONFLICT(session_id,sequence) DO UPDATE SET recorded_at_utc=excluded.recorded_at_utc,recorded_at_epoch_ms=excluded.recorded_at_epoch_ms,latitude=excluded.latitude,longitude=excluded.longitude,accuracy_meters=excluded.accuracy_meters,altitude_meters=excluded.altitude_meters,heading_degrees=excluded.heading_degrees,speed_mps=excluded.speed_mps;",
      args: [id, point.sequence, point.recordedAt, Date.parse(point.recordedAt), point.latitude, point.longitude, point.accuracyMeters ?? null, point.altitudeMeters ?? null, point.headingDegrees ?? null, point.speedMps ?? null, now, id, this.householdId, deviceId]
    }));
    statements.push({
      sql: "UPDATE recorder_sessions SET point_count=(SELECT COUNT(*) FROM recorder_points WHERE session_id=?),last_sequence=COALESCE((SELECT MAX(sequence) FROM recorder_points WHERE session_id=?),-1),updated_at_utc=? WHERE id=? AND household_id=? AND device_id=?;",
      args: [id, id, now, id, this.householdId, deviceId]
    });
    await this.write(statements);
    const updated = await this.session(id, deviceId);
    return updated ? sessionResult(updated) : null;
  }

  async setState(id: string, deviceId: string, status: "recording" | "paused") {
    await this.write([{ sql: "UPDATE recorder_sessions SET status=?,updated_at_utc=? WHERE id=? AND household_id=? AND device_id=? AND status!='completed';", args: [status, new Date().toISOString(), id, this.householdId, deviceId] }]);
    const row = await this.session(id, deviceId);
    return row ? sessionResult(row) : null;
  }

  async get(id: string, deviceId: string) {
    const row = await this.session(id, deviceId);
    return row ? sessionResult(row) : null;
  }

  async complete(id: string, deviceId: string, endedAt: string) {
    const session = await this.session(id, deviceId);
    if (!session) return null;
    if (session.status === "completed") return sessionResult(session);
    const points = await this.points(id);
    if (points.length < 2) throw new Error("At least two recorded points are required to finish a journey.");
    const startedEpoch = Math.floor(Date.parse(session.started_at_utc) / 1000), endedEpoch = Math.floor(Date.parse(endedAt) / 1000);
    if (!Number.isFinite(startedEpoch) || !Number.isFinite(endedEpoch) || endedEpoch <= startedEpoch || Date.parse(endedAt) < points.at(-1)!.recordedAtEpochMs) throw new Error("The recording end time is invalid.");
    const metrics = routeMetrics(points), first = points[0], last = points.at(-1)!;
    const providerDriveId = id, legacyDriveId = `${startedEpoch}-${endedEpoch}`;
    const desiredDriveId = stableId("drive", `journeydeck_recorder:${deviceId}:${id}`);
    const vehicleId = stableId("vehicle", `journeydeck_recorder:${deviceId}`), now = new Date().toISOString();
    const collision = (await this.read({ sql: "SELECT id FROM drives WHERE household_id=? AND legacy_drive_id=? LIMIT 1;", args: [this.householdId, legacyDriveId] }))[0];
    const driveId = collision ? String(collision.id) : desiredDriveId;
    const rawPayload = JSON.stringify({
      id: `journeydeck-recorder:${id}`, source: "journeydeck_recorder", recorded: true,
      started_at: startedEpoch, ended_at: endedEpoch,
      starting_location: "Recorder location", ending_location: "Recorder location",
      starting_latitude: first.latitude, starting_longitude: first.longitude,
      ending_latitude: last.latitude, ending_longitude: last.longitude,
      starting_battery: null, ending_battery: null,
      odometer_distance: metrics.distanceMiles, energy_used: null,
      average_speed: metrics.averageSpeedMph, max_speed: metrics.maxSpeedMph,
      tag: "Recorded", driver_profile: "JourneyDeck Recorder"
    });
    const statements: Statement[] = [];
    if (!collision) {
      statements.push(
        { sql: "INSERT INTO vehicles(id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc) VALUES(?,?,'journeydeck_recorder',?,NULL,'JourneyDeck Recorder',?,'{\"source\":\"journeydeck_recorder\"}',?,?) ON CONFLICT(id) DO UPDATE SET observed_at_utc=excluded.observed_at_utc,updated_at_utc=excluded.updated_at_utc;", args: [vehicleId, this.householdId, deviceId, now, now, now] },
        { sql: "INSERT INTO drives(id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc) VALUES(?,?,?,'journeydeck_recorder',?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,NULL,?,?,'Recorded','JourneyDeck Recorder',?,NULL,?,?) ON CONFLICT(id) DO UPDATE SET ended_at_utc=excluded.ended_at_utc,ended_at_epoch=excluded.ended_at_epoch,ending_latitude=excluded.ending_latitude,ending_longitude=excluded.ending_longitude,distance_miles=excluded.distance_miles,average_speed_mph=excluded.average_speed_mph,max_speed_mph=excluded.max_speed_mph,raw_payload_json=excluded.raw_payload_json,updated_at_utc=excluded.updated_at_utc;", args: [driveId, this.householdId, vehicleId, providerDriveId, legacyDriveId, session.started_at_utc, endedAt, startedEpoch, endedEpoch, "Recorder location", "Recorder location", first.latitude, first.longitude, last.latitude, last.longitude, metrics.distanceMiles, metrics.averageSpeedMph, metrics.maxSpeedMph, rawPayload, now, now] }
      );
    }
    statements.push({ sql: "UPDATE recorder_sessions SET status='completed',ended_at_utc=?,point_count=?,last_sequence=?,distance_miles=?,drive_id=?,updated_at_utc=? WHERE id=? AND household_id=? AND device_id=?;", args: [endedAt, points.length, points.at(-1)!.sequence, metrics.distanceMiles, driveId, now, id, this.householdId, deviceId] });
    await this.write(statements);
    const completed = await this.session(id, deviceId);
    return completed ? { ...sessionResult(completed), legacyDriveId, reusedExistingDrive: Boolean(collision) } : null;
  }

  async routeMap(legacyDriveId: string) {
    const sessions = await this.read({
      sql: "SELECT rs.id FROM recorder_sessions rs JOIN drives d ON d.id=rs.drive_id WHERE rs.household_id=? AND d.legacy_drive_id=? AND rs.status='completed' ORDER BY rs.updated_at_utc DESC LIMIT 1;",
      args: [this.householdId, legacyDriveId]
    });
    if (!sessions[0]) return null;
    const points = await this.points(String(sessions[0].id));
    if (!points.length) return null;
    const routePoints = points.slice(0, 2500).map(point => ({
      timestamp: Math.floor(point.recordedAtEpochMs / 1000),
      time: new Date(point.recordedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }),
      latitude: point.latitude, longitude: point.longitude,
      speed: point.speedMps === null ? null : Math.round(point.speedMps * 2.236936 * 10) / 10,
      heading: point.headingDegrees, battery: null
    }));
    return {
      driveId: legacyDriveId, provider: "JourneyDeck Recorder / OpenFreeMap",
      routePoints, songMarkers: [], startMarker: routePoints[0], endMarker: routePoints.at(-1),
      stateCount: points.length, message: null
    };
  }
}
