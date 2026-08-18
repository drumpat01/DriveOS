import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyMigrations, openDatabase, rollbackAtlasMigration } from "../src/database.js";
import { root } from "./helpers.js";

test("Atlas migration applies and rolls back without touching canonical journeys", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-migration-")), filename = path.join(directory, "migration.db"), database = openDatabase(filename);
  try {
    applyMigrations(database, root, 5); database.prepare("INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES('h','h','x','x')").run();
    applyMigrations(database, root); assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name='atlas_snapshots'").get());
    rollbackAtlasMigration(database, root); assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name='atlas_snapshots'").get(), undefined); assert.equal((database.prepare("SELECT COUNT(*) AS count FROM households").get() as { count: number }).count, 1);
    applyMigrations(database, root); assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name='atlas_snapshots'").get());
  } finally { database.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
