import path from "node:path";
import { config } from "../src/config.js";
import { applyMigrations, openDatabase } from "../src/database.js";
import { rebuildAtlasSnapshot } from "../src/snapshot-builder.js";

if (!path.resolve(config.databasePath).startsWith(path.resolve(config.root, "data", "atlas-node-dev") + path.sep)) throw new Error("Snapshot rebuild is restricted to the isolated local development database.");
const database = openDatabase(config.databasePath);
try { applyMigrations(database, config.root); const result = rebuildAtlasSnapshot(database, config.householdId); process.stdout.write(`${JSON.stringify({ snapshotId: result.snapshotId, lines: result.bootstrap.representativeLines.features.length, patterns: result.bootstrap.patterns.length, generatedAtUtc: result.bootstrap.generatedAtUtc }, null, 2)}\n`); }
finally { database.close(); }
