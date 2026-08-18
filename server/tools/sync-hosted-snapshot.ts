import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "../src/config.js";
import { applyMigrations, openDatabase } from "../src/database.js";
import { rebuildAtlasSnapshot } from "../src/snapshot-builder.js";

type Snapshot = { households: Record<string, unknown>[]; vehicles: Record<string, unknown>[]; drives: Record<string, unknown>[]; appState: Record<string, unknown>[] };
const source = path.resolve(process.argv[2] || "");
const target = config.databasePath;
const allowedRoot = path.resolve(process.env.DRIVEOS_NODE_DATA_ROOT || path.join(config.root, "data", "atlas-node-dev"));
if (!source || !fs.existsSync(source)) throw new Error("A private source snapshot is required.");
if (!path.resolve(target).startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`Sync target must remain inside ${allowedRoot}.`);
if (!fs.existsSync(target)) throw new Error("The Atlas database must be initialized before incremental sync.");
const snapshot = JSON.parse(fs.readFileSync(source, "utf8")) as Snapshot;
if (!snapshot.drives?.length || !snapshot.households?.length || !snapshot.vehicles?.length) throw new Error("The source snapshot is incomplete.");

function upsertRows(database: DatabaseSync, table: string, key: string, columns: string[], rows: Record<string, unknown>[]) {
  const updates = columns.filter(column => column !== key).map(column => `${column}=excluded.${column}`).join(",");
  const statement = database.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")}) ON CONFLICT(${key}) DO UPDATE SET ${updates}`);
  for (const row of rows) statement.run(...columns.map(column => row[column] ?? null) as any[]);
}

const database = openDatabase(target); applyMigrations(database, config.root); database.exec("BEGIN IMMEDIATE;");
try {
  upsertRows(database, "households", "id", ["id", "display_name", "created_at_utc", "updated_at_utc"], snapshot.households);
  upsertRows(database, "vehicles", "id", ["id", "household_id", "provider", "provider_vehicle_id", "vin", "display_name", "observed_at_utc", "raw_payload_json", "created_at_utc", "updated_at_utc"], snapshot.vehicles);
  upsertRows(database, "drives", "id", ["id", "household_id", "vehicle_id", "provider", "provider_drive_id", "legacy_drive_id", "started_at_utc", "ended_at_utc", "started_at_epoch", "ended_at_epoch", "starting_location", "ending_location", "starting_latitude", "starting_longitude", "ending_latitude", "ending_longitude", "starting_battery", "ending_battery", "distance_miles", "energy_used_kwh", "average_speed_mph", "max_speed_mph", "tessie_tag", "driver_profile", "raw_payload_json", "source_updated_at_utc", "created_at_utc", "updated_at_utc"], snapshot.drives);
  upsertRows(database, "app_state", "key", ["key", "value_json", "updated_at"], snapshot.appState || []);
  database.exec("CREATE TEMP TABLE atlas_sync_drive_ids(id TEXT PRIMARY KEY);");
  const remember = database.prepare("INSERT INTO atlas_sync_drive_ids(id) VALUES(?)");
  for (const row of snapshot.drives) remember.run(row.id as string);
  database.prepare("DELETE FROM drives WHERE household_id=? AND id NOT IN (SELECT id FROM atlas_sync_drive_ids)").run(config.householdId);
  database.exec("DROP TABLE atlas_sync_drive_ids; COMMIT;");
} catch (error) { database.exec("ROLLBACK;"); database.close(); throw error; }
const built = rebuildAtlasSnapshot(database, config.householdId);
database.close();
process.stdout.write(`${JSON.stringify({ synced: true, journeyCount: snapshot.drives.length, sourceWatermark: built.bootstrap.sourceWatermark, snapshotId: built.snapshotId })}\n`);
