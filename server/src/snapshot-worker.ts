import { parentPort, workerData } from "node:worker_threads";
import { applyMigrations, openDatabase } from "./database.js";
import { rebuildAtlasSnapshot } from "./snapshot-builder.js";

const data = workerData as { databasePath: string; householdId: string; root: string };
const database = openDatabase(data.databasePath);
try { applyMigrations(database, data.root); const result = rebuildAtlasSnapshot(database, data.householdId); parentPort?.postMessage({ ok: true, snapshotId: result.snapshotId }); }
catch (error) { parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : "Snapshot rebuild failed" }); process.exitCode = 1; }
finally { database.close(); }
