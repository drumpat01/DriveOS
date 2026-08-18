import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import { applyMigrations, openDatabase } from "./database.js";
import { rebuildAtlasSnapshot } from "./snapshot-builder.js";
import { queryTurso } from "./turso-client.js";

const target = config.databasePath;
const allowedRoot = path.resolve(process.env.DRIVEOS_NODE_DATA_ROOT || path.join(config.root, "data", "atlas-node-dev"));
if (!path.resolve(target).startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`Sync target must remain inside ${allowedRoot}.`);

const statements = [
  { sql: "SELECT COUNT(*) AS count FROM drives WHERE household_id=?;", args: [config.householdId] },
  { sql: "SELECT id,display_name,created_at_utc,updated_at_utc FROM households WHERE id=?;", args: [config.householdId] },
  { sql: "SELECT id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc FROM vehicles WHERE household_id=?;", args: [config.householdId] },
  { sql: "SELECT id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc FROM drives WHERE household_id=? ORDER BY started_at_epoch,id;", args: [config.householdId] },
  { sql: "SELECT key,value_json,updated_at FROM app_state WHERE key IN ('foursquare-cache','mobility-preferences') ORDER BY key;" },
  { sql: "SELECT COUNT(*) AS count FROM drives WHERE household_id=?;", args: [config.householdId] }
];

const [beforeRows, households, vehicles, drives, appState, afterRows] = await queryTurso(statements);
const before = Number(beforeRows[0]?.count), after = Number(afterRows[0]?.count);
if (!Number.isFinite(before) || before !== after || drives.length !== after) throw new Error("Turso changed during Atlas refresh; the existing snapshot remains active.");
if (!drives.length || !households.length || !vehicles.length) throw new Error("The source snapshot is incomplete.");

function upsertRows(database: DatabaseSync, table: string, key: string, columns: string[], rows: Record<string, unknown>[]) {
  const updates = columns.filter(column => column !== key).map(column => `${column}=excluded.${column}`).join(",");
  const statement = database.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")}) ON CONFLICT(${key}) DO UPDATE SET ${updates}`);
  for (const row of rows) statement.run(...columns.map(column => row[column] ?? null) as any[]);
}

const database = openDatabase(target);
applyMigrations(database, config.root);
database.exec("BEGIN IMMEDIATE;");
try {
  upsertRows(database, "households", "id", ["id", "display_name", "created_at_utc", "updated_at_utc"], households);
  upsertRows(database, "vehicles", "id", ["id", "household_id", "provider", "provider_vehicle_id", "vin", "display_name", "observed_at_utc", "raw_payload_json", "created_at_utc", "updated_at_utc"], vehicles);
  upsertRows(database, "drives", "id", ["id", "household_id", "vehicle_id", "provider", "provider_drive_id", "legacy_drive_id", "started_at_utc", "ended_at_utc", "started_at_epoch", "ended_at_epoch", "starting_location", "ending_location", "starting_latitude", "starting_longitude", "ending_latitude", "ending_longitude", "starting_battery", "ending_battery", "distance_miles", "energy_used_kwh", "average_speed_mph", "max_speed_mph", "tessie_tag", "driver_profile", "raw_payload_json", "source_updated_at_utc", "created_at_utc", "updated_at_utc"], drives);
  upsertRows(database, "app_state", "key", ["key", "value_json", "updated_at"], appState);
  database.exec("CREATE TEMP TABLE atlas_sync_drive_ids(id TEXT PRIMARY KEY);");
  const remember = database.prepare("INSERT INTO atlas_sync_drive_ids(id) VALUES(?)");
  for (const row of drives) remember.run(row.id as string);
  database.prepare("DELETE FROM drives WHERE household_id=? AND id NOT IN (SELECT id FROM atlas_sync_drive_ids)").run(config.householdId);
  database.exec("DROP TABLE atlas_sync_drive_ids; COMMIT;");
} catch (error) {
  database.exec("ROLLBACK;");
  database.close();
  throw error;
}
const built = rebuildAtlasSnapshot(database, config.householdId);
database.close();
process.stdout.write(`${JSON.stringify({ synced: true, journeyCount: drives.length, sourceWatermark: built.bootstrap.sourceWatermark, snapshotId: built.snapshotId })}\n`);
