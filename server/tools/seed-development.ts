import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../src/config.js";
import { applyMigrations, openDatabase } from "../src/database.js";
import { rebuildAtlasSnapshot } from "../src/snapshot-builder.js";
import { seedRealisticAtlasFixture } from "./fixture.js";

const target = config.databasePath;
const allowedRoot = path.resolve(config.root, "data", "atlas-node-dev");
if (!path.resolve(target).startsWith(`${allowedRoot}${path.sep}`)) throw new Error("Development seed target must remain inside data/atlas-node-dev.");
fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) throw new Error(`Refusing to overwrite existing development database: ${target}`);

const database = openDatabase(target);
applyMigrations(database, config.root, 5);
const fixture = seedRealisticAtlasFixture(database);
database.close();

const backupDirectory = path.join(path.dirname(target), "backups");
fs.mkdirSync(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(backupDirectory, `pre-atlas-${stamp}.db`);
fs.copyFileSync(target, backup);
const verification = new DatabaseSync(backup, { readOnly: true });
const integrity = String((verification.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check);
const backedUpJourneys = Number((verification.prepare("SELECT COUNT(*) AS count FROM drives").get() as { count: number }).count);
verification.close();
if (integrity !== "ok" || backedUpJourneys !== fixture.journeyCount || fs.statSync(backup).size < 1024) throw new Error("Development backup verification failed.");

const migrated = openDatabase(target);
applyMigrations(migrated, config.root);
const result = rebuildAtlasSnapshot(migrated, config.householdId);
migrated.close();
process.stdout.write(`${JSON.stringify({ database: target, backup, backupVerified: true, fixture, snapshotId: result.snapshotId, lines: result.bootstrap.representativeLines.features.length, patterns: result.bootstrap.patterns.length }, null, 2)}\n`);
