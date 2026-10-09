import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { syncAtlasDurableState, uploadAtlasDurableState } from "./atlas-durable-state.js";
import { rebuildAtlasSnapshot } from "./snapshot-builder.js";
import { queryTurso } from "./turso-client.js";

export const DRIVE_COLUMNS = [
  "id", "household_id", "vehicle_id", "provider", "provider_drive_id", "legacy_drive_id",
  "started_at_utc", "ended_at_utc", "started_at_epoch", "ended_at_epoch",
  "starting_location", "ending_location", "starting_latitude", "starting_longitude",
  "ending_latitude", "ending_longitude", "starting_battery", "ending_battery",
  "distance_miles", "energy_used_kwh", "average_speed_mph", "max_speed_mph",
  "tessie_tag", "driver_profile", "raw_payload_json", "source_updated_at_utc",
  "created_at_utc", "updated_at_utc"
] as const;

const HOUSEHOLD_COLUMNS = ["id", "display_name", "created_at_utc", "updated_at_utc"] as const;
const VEHICLE_COLUMNS = ["id", "household_id", "provider", "provider_vehicle_id", "vin", "display_name", "observed_at_utc", "raw_payload_json", "created_at_utc", "updated_at_utc"] as const;
const APP_STATE_COLUMNS = ["key", "value_json", "updated_at"] as const;

export type TursoQuery = typeof queryTurso;
export type HostedRefreshResult = {
  synced: true;
  journeyCount: number;
  batchCount: number;
  sourceWatermark: string;
  snapshotId: string;
  legacyState: unknown;
  durableState: unknown;
};

export type HostedRefreshOptions = {
  database: DatabaseSync;
  householdId: string;
  root: string;
  dataRoot: string;
  databasePath: string;
  atlasDurableTurso: boolean;
  atlasLegacyDatabasePath?: string;
  batchSize?: number;
  query?: TursoQuery;
  rebuild?: boolean;
};

function upsertRows(database: DatabaseSync, table: string, key: string, columns: readonly string[], rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const updates = columns.filter(column => column !== key).map(column => `${column}=excluded.${column}`).join(",");
  const statement = database.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")}) ON CONFLICT(${key}) DO UPDATE SET ${updates}`);
  for (const row of rows) statement.run(...columns.map(column => row[column] ?? null) as any[]);
}

export function assertRefreshTarget(databasePath: string, dataRoot: string) {
  const target = path.resolve(databasePath);
  const allowedRoot = path.resolve(dataRoot);
  if (!target.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`Sync target must remain inside ${allowedRoot}.`);
  return target;
}

export function drivePageSql() {
  return `SELECT ${DRIVE_COLUMNS.join(",")} FROM drives WHERE household_id=? AND (started_at_epoch>? OR (started_at_epoch=? AND id>?)) ORDER BY started_at_epoch,id LIMIT ?;`;
}

function cursorFrom(row: Record<string, unknown> | undefined) {
  if (!row) return { epoch: -1, id: "" };
  const epoch = Number(row.started_at_epoch);
  return { epoch: Number.isFinite(epoch) ? epoch : -1, id: String(row.id || "") };
}

export async function refreshHostedSnapshot(options: HostedRefreshOptions): Promise<HostedRefreshResult> {
  const batchSize = options.batchSize ?? 75;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("Atlas refresh batch size must be an integer between 1 and 500.");
  assertRefreshTarget(options.databasePath, options.dataRoot);
  const runQuery = options.query || queryTurso;
  const database = options.database;
  let legacyState = null;
  const legacyPath = options.atlasLegacyDatabasePath ? path.resolve(options.atlasLegacyDatabasePath) : "";
  if (options.atlasDurableTurso && legacyPath && legacyPath !== path.resolve(options.databasePath) && fs.existsSync(legacyPath)) {
    const legacyDatabase = new DatabaseSync(legacyPath, { readOnly: true });
    try { legacyState = await uploadAtlasDurableState(legacyDatabase, runQuery); }
    finally { legacyDatabase.close(); }
  }
  const durableState = options.atlasDurableTurso ? await syncAtlasDurableState(database, runQuery) : null;
  const [beforeRows, households, vehicles, appState] = await runQuery([
    { sql: "SELECT COUNT(*) AS count FROM drives WHERE household_id=?;", args: [options.householdId] },
    { sql: "SELECT id,display_name,created_at_utc,updated_at_utc FROM households WHERE id=?;", args: [options.householdId] },
    { sql: "SELECT id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc FROM vehicles WHERE household_id=?;", args: [options.householdId] },
    { sql: "SELECT key,value_json,updated_at FROM app_state WHERE key IN ('foursquare-cache','mobility-preferences') ORDER BY key;" }
  ]);
  const before = Number(beforeRows[0]?.count);
  if (!Number.isFinite(before) || !households.length || !vehicles.length) throw new Error("The source snapshot is incomplete.");
  let journeyCount = 0, batchCount = 0, cursor = cursorFrom(undefined);
  database.exec("BEGIN IMMEDIATE;");
  try {
    upsertRows(database, "households", "id", HOUSEHOLD_COLUMNS, households);
    upsertRows(database, "vehicles", "id", VEHICLE_COLUMNS, vehicles);
    upsertRows(database, "app_state", "key", APP_STATE_COLUMNS, appState);
    database.exec("CREATE TEMP TABLE atlas_sync_drive_ids(id TEXT PRIMARY KEY);");
    const remember = database.prepare("INSERT INTO atlas_sync_drive_ids(id) VALUES(?)");
    while (true) {
      const page = await runQuery([{ sql: drivePageSql(), args: [options.householdId, cursor.epoch, cursor.epoch, cursor.id, batchSize] }]);
      const drives = page[0] || [];
      if (!drives.length) break;
      batchCount++;
      upsertRows(database, "drives", "id", DRIVE_COLUMNS, drives);
      for (const row of drives) remember.run(String(row.id));
      journeyCount += drives.length;
      cursor = cursorFrom(drives.at(-1));
      if (typeof globalThis.gc === "function") globalThis.gc();
    }
    const [afterRows] = await runQuery([{ sql: "SELECT COUNT(*) AS count FROM drives WHERE household_id=?;", args: [options.householdId] }]);
    const after = Number(afterRows[0]?.count);
    if (!Number.isFinite(after) || before !== after || journeyCount !== after) {
      throw new Error("Turso changed during Atlas refresh; the existing snapshot remains active.");
    }
    database.prepare("DELETE FROM drives WHERE household_id=? AND id NOT IN (SELECT id FROM atlas_sync_drive_ids)").run(options.householdId);
    database.exec("DROP TABLE atlas_sync_drive_ids; COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  const built = options.rebuild === false ? { snapshotId: "", bootstrap: { sourceWatermark: "" } } : rebuildAtlasSnapshot(database, options.householdId);
  return { synced: true, journeyCount, batchCount, sourceWatermark: built.bootstrap.sourceWatermark, snapshotId: built.snapshotId, legacyState, durableState };
}

export function snapshotAgeMs(generatedAtUtc: string | null | undefined) {
  if (!generatedAtUtc) return Number.POSITIVE_INFINITY;
  const generated = Date.parse(generatedAtUtc);
  return Number.isFinite(generated) ? Math.max(0, Date.now() - generated) : Number.POSITIVE_INFINITY;
}

export class HostedSnapshotRefresher {
  private inflight?: Promise<HostedRefreshResult | null>;
  constructor(private readonly options: HostedRefreshOptions & { refreshSeconds: number; enabled: boolean; status: () => { ready: boolean; generatedAtUtc?: string | null } }) {}

  get enabled() { return this.options.enabled; }

  isStale() {
    const status = this.options.status();
    return !status.ready || snapshotAgeMs(status.generatedAtUtc) >= this.options.refreshSeconds * 1000;
  }

  refreshIfStale() {
    if (!this.options.enabled || (!this.isStale() && !this.inflight)) return Promise.resolve(null);
    return this.refresh();
  }

  refresh() {
    if (!this.options.enabled) return Promise.resolve(null);
    if (this.inflight) return this.inflight;
    this.inflight = refreshHostedSnapshot(this.options).finally(() => { this.inflight = undefined; });
    return this.inflight;
  }
}
