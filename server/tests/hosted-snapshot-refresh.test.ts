import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyMigrations, openDatabase } from "../src/database.js";
import { drivePageSql, HostedSnapshotRefresher, refreshHostedSnapshot, snapshotAgeMs } from "../src/hosted-snapshot-refresh.js";
import { root } from "./helpers.js";

const HOUSEHOLD = "household_primary";
const VEHICLE = "vehicle_refresh";

function makeDrive(index: number, payload = `{"fixture":true,"n":${index}}`) {
  const started = new Date(Date.UTC(2025, 0, 1, index));
  const ended = new Date(started.getTime() + 30 * 60 * 1000);
  const id = `refresh-drive-${String(index).padStart(4, "0")}`;
  return {
    id, household_id: HOUSEHOLD, vehicle_id: VEHICLE, provider: "fixture", provider_drive_id: id, legacy_drive_id: id,
    started_at_utc: started.toISOString(), ended_at_utc: ended.toISOString(), started_at_epoch: Math.floor(started.getTime() / 1000),
    ended_at_epoch: Math.floor(ended.getTime() / 1000), starting_location: "Home", ending_location: `Place ${index}`,
    starting_latitude: 32.9, starting_longitude: -97.2, ending_latitude: 32.91, ending_longitude: -97.21,
    starting_battery: 80, ending_battery: 70, distance_miles: 4, energy_used_kwh: 1.2, average_speed_mph: 30,
    max_speed_mph: 45, tessie_tag: null, driver_profile: "test", raw_payload_json: payload,
    source_updated_at_utc: started.toISOString(), created_at_utc: started.toISOString(), updated_at_utc: started.toISOString()
  };
}

function source(drives: ReturnType<typeof makeDrive>[], options: { failAfter?: number } = {}) {
  const households = [{ id: HOUSEHOLD, display_name: "Refresh household", created_at_utc: "2026-01-01T00:00:00.000Z", updated_at_utc: "2026-01-01T00:00:00.000Z" }];
  const vehicles = [{ id: VEHICLE, household_id: HOUSEHOLD, provider: "fixture", provider_vehicle_id: "v1", vin: null, display_name: "Eloise", observed_at_utc: "2026-01-01T00:00:00.000Z", raw_payload_json: "{}", created_at_utc: "2026-01-01T00:00:00.000Z", updated_at_utc: "2026-01-01T00:00:00.000Z" }];
  const observed: number[] = [];
  const query = async (statements: Array<{ sql: string; args?: unknown[] }>) => {
    return statements.map(statement => {
      if (statement.sql.includes("COUNT(*)")) return [{ count: drives.length }];
      if (statement.sql.includes("FROM households")) return households;
      if (statement.sql.includes("FROM vehicles")) return vehicles;
      if (statement.sql.includes("FROM app_state")) return [];
      if (statement.sql.includes("FROM atlas_place_labels") || statement.sql.includes("FROM atlas_pattern_reviews")) return [];
      if (statement.sql.includes("FROM drives") && statement.sql.includes("LIMIT")) {
        const epoch = Number(statement.args?.[1] ?? -1), id = String(statement.args?.[3] ?? ""), limit = Number(statement.args?.[4] ?? 0);
        const page = drives.filter(row => row.started_at_epoch > epoch || (row.started_at_epoch === epoch && row.id > id)).slice(0, limit);
        observed.push(page.length);
        if (options.failAfter !== undefined && observed.length > options.failAfter) throw new Error("injected Turso failure");
        return page;
      }
      throw new Error(`Unexpected SQL: ${statement.sql}`);
    });
  };
  return { query, observed, households, vehicles };
}

function tempDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-refresh-"));
  const filename = path.join(directory, "refresh.db");
  const database = openDatabase(filename);
  applyMigrations(database, root);
  return { directory, filename, database, cleanup: () => { database.close(); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }); } };
}

test("paged Turso SQL uses a keyset limit instead of selecting every drive", () => {
  assert.match(drivePageSql(), /LIMIT \?/);
  assert.match(drivePageSql(), /started_at_epoch>\? OR \(started_at_epoch=\? AND id>\?\)/);
  assert.doesNotMatch(drivePageSql(), /ORDER BY started_at_epoch,id;$/);
});

test("refresh writes drives in batches and never asks Turso for the full drive set", async () => {
  const fixture = tempDatabase(), drives = Array.from({ length: 40 }, (_, index) => makeDrive(index)), fake = source(drives);
  try {
    const result = await refreshHostedSnapshot({
      database: fixture.database, householdId: HOUSEHOLD, root, dataRoot: fixture.directory, databasePath: fixture.filename,
      atlasDurableTurso: false, batchSize: 10, query: fake.query
    });
    assert.equal(result.journeyCount, 40);
    assert.equal(result.batchCount, 4);
    assert.deepEqual(fake.observed.slice(0, 4), [10, 10, 10, 10]);
    assert.equal(fake.observed.at(-1), 0);
    assert.ok(fake.observed.every(size => size <= 10));
    const stored = fixture.database.prepare("SELECT COUNT(*) AS count FROM drives").get() as { count: number };
    assert.equal(Number(stored.count), 40);
    assert.ok(result.snapshotId);
  } finally { fixture.cleanup(); }
});

test("a count mismatch or mid-refresh Turso failure leaves the existing snapshot in place", async () => {
  const fixture = tempDatabase(), drives = Array.from({ length: 8 }, (_, index) => makeDrive(index));
  try {
    fixture.database.prepare("INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,?,?,?)").run(HOUSEHOLD, "Existing", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    await refreshHostedSnapshot({
      database: fixture.database, householdId: HOUSEHOLD, root, dataRoot: fixture.directory, databasePath: fixture.filename,
      atlasDurableTurso: false, batchSize: 8, query: source(drives).query
    });
    const before = fixture.database.prepare("SELECT COUNT(*) AS count FROM drives").get() as { count: number };
    const fake = source(drives, { failAfter: 1 });
    await assert.rejects(() => refreshHostedSnapshot({
      database: fixture.database, householdId: HOUSEHOLD, root, dataRoot: fixture.directory, databasePath: fixture.filename,
      atlasDurableTurso: false, batchSize: 3, query: fake.query
    }), /injected Turso failure|Turso changed/);
    const after = fixture.database.prepare("SELECT COUNT(*) AS count FROM drives").get() as { count: number };
    assert.equal(Number(after.count), Number(before.count));
  } finally { fixture.cleanup(); }
});

test("refresher treats a missing or aged snapshot as stale and coalesces in-flight work", async () => {
  assert.equal(snapshotAgeMs(undefined), Number.POSITIVE_INFINITY);
  assert.ok(snapshotAgeMs(new Date(Date.now() - 1_000).toISOString()) < 5_000);
  const fixture = tempDatabase(), drives = [makeDrive(1)], fake = source(drives);
  const refresher = new HostedSnapshotRefresher({
    database: fixture.database, householdId: HOUSEHOLD, root, dataRoot: fixture.directory, databasePath: fixture.filename,
    atlasDurableTurso: false, batchSize: 10, query: fake.query, refreshSeconds: 900, enabled: true,
    status: () => ({ ready: false, generatedAtUtc: null })
  });
  try {
    assert.equal(refresher.isStale(), true);
    const first = refresher.refreshIfStale(), second = refresher.refreshIfStale();
    assert.equal(first, second);
    const result = await first;
    assert.equal(result?.journeyCount, 1);
  } finally { fixture.cleanup(); }
});
