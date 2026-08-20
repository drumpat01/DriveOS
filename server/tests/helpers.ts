import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyMigrations, openDatabase } from "../src/database.js";
import { rebuildAtlasSnapshot } from "../src/snapshot-builder.js";
import { seedRealisticAtlasFixture } from "../tools/fixture.js";

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1))), "..", "..");

function removeFixtureDirectory(directory: string) {
  // SQLite and antivirus filters can briefly retain handles on Windows CI
  // after the database closes. Give those handles time to drain before
  // treating fixture cleanup as a test failure.
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
}

export function fixtureDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-atlas-"));
  const filename = path.join(directory, "fixture.db");
  const database = openDatabase(filename); applyMigrations(database, root); seedRealisticAtlasFixture(database); rebuildAtlasSnapshot(database, "household_primary"); database.close();
  return {
    filename,
    directory,
    cleanup: () => removeFixtureDirectory(directory)
  };
}
