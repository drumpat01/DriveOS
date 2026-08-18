import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../src/config.js";
import { applyMigrations, openDatabase } from "../src/database.js";
import { rebuildAtlasSnapshot } from "../src/snapshot-builder.js";

type Snapshot = { households: Record<string, unknown>[]; vehicles: Record<string, unknown>[]; drives: Record<string, unknown>[]; appState: Record<string, unknown>[] };
const source = path.resolve(process.argv[2] || "");
const target = config.databasePath;
const allowedRoot = path.resolve(config.root, "data", "atlas-node-dev");
if (!source || !fs.existsSync(source)) throw new Error("A private snapshot file is required.");
if (!path.resolve(target).startsWith(`${allowedRoot}${path.sep}`)) throw new Error("Import target must remain inside data/atlas-node-dev.");
if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing development database: ${target}`);
const snapshot = JSON.parse(fs.readFileSync(source, "utf8")) as Snapshot;
if (!snapshot.drives?.length || !snapshot.households?.length || !snapshot.vehicles?.length) throw new Error("The source snapshot is incomplete.");

function insertRows(database: DatabaseSync, table: string, columns: string[], rows: Record<string, unknown>[]) {
  const statement = database.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`);
  for (const row of rows) statement.run(...columns.map(column => row[column] ?? null) as any[]);
}

const database = openDatabase(target); applyMigrations(database, config.root, 5); database.exec("BEGIN IMMEDIATE;");
try {
  insertRows(database, "households", ["id", "display_name", "created_at_utc", "updated_at_utc"], snapshot.households);
  insertRows(database, "vehicles", ["id", "household_id", "provider", "provider_vehicle_id", "vin", "display_name", "observed_at_utc", "raw_payload_json", "created_at_utc", "updated_at_utc"], snapshot.vehicles);
  insertRows(database, "drives", ["id", "household_id", "vehicle_id", "provider", "provider_drive_id", "legacy_drive_id", "started_at_utc", "ended_at_utc", "started_at_epoch", "ended_at_epoch", "starting_location", "ending_location", "starting_latitude", "starting_longitude", "ending_latitude", "ending_longitude", "starting_battery", "ending_battery", "distance_miles", "energy_used_kwh", "average_speed_mph", "max_speed_mph", "tessie_tag", "driver_profile", "raw_payload_json", "source_updated_at_utc", "created_at_utc", "updated_at_utc"], snapshot.drives);
  insertRows(database, "app_state", ["key", "value_json", "updated_at"], snapshot.appState || []);
  database.exec("COMMIT;");
} catch (error) { database.exec("ROLLBACK;"); database.close(); throw error; }
database.close();

const backupDirectory = path.join(path.dirname(target), "backups"); fs.mkdirSync(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-"); const backup = path.join(backupDirectory, `pre-atlas-private-${stamp}.db`); fs.copyFileSync(target, backup);
const verification = new DatabaseSync(backup, { readOnly: true }); const integrity = String((verification.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check); const count = Number((verification.prepare("SELECT COUNT(*) AS count FROM drives").get() as { count: number }).count); verification.close();
if (integrity !== "ok" || count !== snapshot.drives.length || fs.statSync(backup).size < 1024) throw new Error("Private development backup verification failed.");
const migrated = openDatabase(target); applyMigrations(migrated, config.root); const built = rebuildAtlasSnapshot(migrated, config.householdId); migrated.close();
process.stdout.write(`${JSON.stringify({ database: target, backup, backupVerified: true, journeyCount: count, lines: built.bootstrap.representativeLines.features.length, patterns: built.bootstrap.patterns.length, insights: built.bootstrap.changeInsights.length }, null, 2)}\n`);
