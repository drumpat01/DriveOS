import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { applyMigrations, openDatabase } from "../src/database.js";
import { DRIVE_COLUMNS, refreshHostedSnapshot } from "../src/hosted-snapshot-refresh.js";
import { rebuildAtlasSnapshot } from "../src/snapshot-builder.js";
import { seedRealisticAtlasFixture } from "./fixture.js";

const HOUSEHOLD = "household_primary";
const VEHICLE = "vehicle_measure";
const JOURNEY_COUNT = Number(process.env.DRIVEOS_MEASURE_JOURNEYS || 2100);
const PAYLOAD_BYTES = Number(process.env.DRIVEOS_MEASURE_PAYLOAD_BYTES || 4096);
const BATCH_SIZE = Number(process.env.DRIVEOS_ATLAS_REFRESH_BATCH_SIZE || 75);

function rssMb() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

function peakTracker() {
  let peak = rssMb();
  const timer = setInterval(() => { peak = Math.max(peak, rssMb()); }, 20);
  timer.unref();
  return {
    sample() { peak = Math.max(peak, rssMb()); return peak; },
    stop() { clearInterval(timer); return this.sample(); }
  };
}

function tessieSizedPayload(index: number) {
  const pad = "x".repeat(Math.max(0, PAYLOAD_BYTES - 80));
  return JSON.stringify({
    id: index, started_at: "2025-01-01T00:00:00.000Z", starting_location: "Home", ending_location: `Place ${index}`,
    odometer: 12000 + index, energy: { used: 3.2, added: 0 }, pad
  });
}

function makeDrive(index: number) {
  const started = new Date(Date.UTC(2025, 0, 1) + index * 4 * 60 * 60 * 1000);
  const ended = new Date(started.getTime() + 35 * 60 * 1000);
  const id = `measure-drive-${String(index).padStart(4, "0")}`;
  return {
    id, household_id: HOUSEHOLD, vehicle_id: VEHICLE, provider: "fixture", provider_drive_id: id, legacy_drive_id: id,
    started_at_utc: started.toISOString(), ended_at_utc: ended.toISOString(),
    started_at_epoch: Math.floor(started.getTime() / 1000), ended_at_epoch: Math.floor(ended.getTime() / 1000),
    starting_location: "Home", ending_location: `Resolved place ${index % 350}`,
    starting_latitude: 31.75 + (index % 25) * 0.01, starting_longitude: -101.4 + Math.floor(index / 25) * 0.01,
    ending_latitude: 31.76, ending_longitude: -101.41, starting_battery: 80, ending_battery: 70,
    distance_miles: 8, energy_used_kwh: 2.1, average_speed_mph: 32, max_speed_mph: 55, tessie_tag: null,
    driver_profile: "Synthetic hosted measure", raw_payload_json: tessieSizedPayload(index),
    source_updated_at_utc: started.toISOString(), created_at_utc: started.toISOString(), updated_at_utc: started.toISOString()
  };
}

function catalog() {
  return {
    households: [{ id: HOUSEHOLD, display_name: "Measure household", created_at_utc: "2026-01-01T00:00:00.000Z", updated_at_utc: "2026-01-01T00:00:00.000Z" }],
    vehicles: [{ id: VEHICLE, household_id: HOUSEHOLD, provider: "fixture", provider_vehicle_id: "measure", vin: null, display_name: "Eloise", observed_at_utc: "2026-01-01T00:00:00.000Z", raw_payload_json: "{}", created_at_utc: "2026-01-01T00:00:00.000Z", updated_at_utc: "2026-01-01T00:00:00.000Z" }]
  };
}

function fakeTurso(drives: ReturnType<typeof makeDrive>[] | { count: number; materialize: boolean }) {
  const { households, vehicles } = catalog();
  const count = Array.isArray(drives) ? drives.length : drives.count;
  return async (statements: Array<{ sql: string; args?: unknown[] }>) => statements.map(statement => {
    if (statement.sql.includes("COUNT(*)")) return [{ count }];
    if (statement.sql.includes("FROM households")) return households;
    if (statement.sql.includes("FROM vehicles")) return vehicles;
    if (statement.sql.includes("FROM app_state") || statement.sql.includes("FROM atlas_place_labels") || statement.sql.includes("FROM atlas_pattern_reviews")) return [];
    if (statement.sql.includes("FROM drives") && statement.sql.includes("LIMIT")) {
      const epoch = Number(statement.args?.[1] ?? -1), id = String(statement.args?.[3] ?? ""), limit = Number(statement.args?.[4] ?? 0);
      if (Array.isArray(drives)) return drives.filter(row => row.started_at_epoch > epoch || (row.started_at_epoch === epoch && row.id > id)).slice(0, limit);
      const start = epoch < 0 ? 0 : Math.min(count, Math.floor((epoch - Math.floor(Date.UTC(2025, 0, 1) / 1000)) / (4 * 60 * 60)) + (id ? 1 : 0));
      const page = [];
      for (let index = start; index < count && page.length < limit; index++) page.push(makeDrive(index));
      return page;
    }
    if (statement.sql.includes("FROM drives") && Array.isArray(drives)) return drives;
    throw new Error(`Unexpected SQL: ${statement.sql}`);
  });
}

function upsertRows(database: ReturnType<typeof openDatabase>, table: string, key: string, columns: readonly string[], rows: Record<string, unknown>[]) {
  const updates = columns.filter(column => column !== key).map(column => `${column}=excluded.${column}`).join(",");
  const statement = database.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")}) ON CONFLICT(${key}) DO UPDATE SET ${updates}`);
  for (const row of rows) statement.run(...columns.map(column => row[column] ?? null) as any[]);
}

async function legacyLoadAll(directory: string, filename: string, drives: ReturnType<typeof makeDrive>[]) {
  const database = openDatabase(filename);
  applyMigrations(database, path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1))), "..", ".."));
  const query = fakeTurso(drives);
  const [beforeRows, households, vehicles, allDrives, appState, afterRows] = await query([
    { sql: "SELECT COUNT(*) AS count FROM drives WHERE household_id=?;", args: [HOUSEHOLD] },
    { sql: "SELECT * FROM households;" },
    { sql: "SELECT * FROM vehicles;" },
    { sql: "SELECT * FROM drives;" },
    { sql: "SELECT * FROM app_state;" },
    { sql: "SELECT COUNT(*) AS count FROM drives WHERE household_id=?;", args: [HOUSEHOLD] }
  ]);
  if (Number(beforeRows[0]?.count) !== Number(afterRows[0]?.count) || allDrives.length !== Number(afterRows[0]?.count)) throw new Error("legacy count mismatch");
  database.exec("BEGIN IMMEDIATE;");
  upsertRows(database, "households", "id", ["id", "display_name", "created_at_utc", "updated_at_utc"], households);
  upsertRows(database, "vehicles", "id", ["id", "household_id", "provider", "provider_vehicle_id", "vin", "display_name", "observed_at_utc", "raw_payload_json", "created_at_utc", "updated_at_utc"], vehicles);
  upsertRows(database, "drives", "id", DRIVE_COLUMNS, allDrives);
  upsertRows(database, "app_state", "key", ["key", "value_json", "updated_at"], appState);
  database.exec("COMMIT;");
  const built = rebuildAtlasSnapshot(database, HOUSEHOLD);
  database.close();
  return { journeyCount: allDrives.length, snapshotId: built.snapshotId, directory };
}

async function measure(mode: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `journeydeck-measure-${mode}-`));
  const filename = path.join(directory, "measure.db");
  const peak = peakTracker();
  const started = performance.now();
  const baseline = rssMb();
  try {
    if (mode === "legacy") {
      const drives = Array.from({ length: JOURNEY_COUNT }, (_, index) => makeDrive(index));
      const result = await legacyLoadAll(directory, filename, drives);
      return { mode, journeyCount: result.journeyCount, payloadBytes: PAYLOAD_BYTES, baselineMb: baseline, peakMb: peak.stop(), elapsedMs: Math.round(performance.now() - started) };
    }
    if (mode === "batched") {
      const database = openDatabase(filename);
      applyMigrations(database, path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1))), "..", ".."));
      const result = await refreshHostedSnapshot({
        database, householdId: HOUSEHOLD, root: path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1))), "..", ".."),
        dataRoot: directory, databasePath: filename, atlasDurableTurso: false, batchSize: BATCH_SIZE,
        query: fakeTurso({ count: JOURNEY_COUNT, materialize: false })
      });
      database.close();
      return { mode, journeyCount: result.journeyCount, batchCount: result.batchCount, payloadBytes: PAYLOAD_BYTES, baselineMb: baseline, peakMb: peak.stop(), elapsedMs: Math.round(performance.now() - started) };
    }
    if (mode === "listen" || mode === "hosted") {
      const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1))), "..", "..");
      const database = openDatabase(filename);
      applyMigrations(database, root);
      if (mode === "listen") {
        seedRealisticAtlasFixture(database, JOURNEY_COUNT);
        rebuildAtlasSnapshot(database, HOUSEHOLD);
      }
      database.close();
      const appStarted = performance.now();
      const runtime = await createApp({ databasePath: filename, dataRoot: directory, root, allowTestAuth: true, legacyUpstream: "", atlasRefreshEnabled: false, mode: "web" });
      const createAppMs = Math.round(performance.now() - appStarted);
      const listenStarted = performance.now();
      await runtime.app.listen({ host: "127.0.0.1", port: 0 });
      const listenMs = Math.round(performance.now() - listenStarted);
      const ready = await runtime.app.inject({ method: "GET", url: "/readyz" });
      const home = await runtime.app.inject({ method: "GET", url: "/" });
      const readyMs = Math.round(performance.now() - appStarted);
      let refreshMs = 0, atlas = 0;
      if (mode === "hosted") {
        const refreshStarted = performance.now();
        await refreshHostedSnapshot({
          database: runtime.database, householdId: HOUSEHOLD, root, dataRoot: directory, databasePath: filename,
          atlasDurableTurso: false, batchSize: BATCH_SIZE, query: fakeTurso({ count: JOURNEY_COUNT, materialize: false })
        });
        refreshMs = Math.round(performance.now() - refreshStarted);
      }
      const bootstrap = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { "x-journeydeck-test-auth": "owner" } });
      atlas = bootstrap.statusCode;
      const afterListen = rssMb();
      await runtime.app.close();
      return {
        mode, journeyCount: JOURNEY_COUNT, baselineMb: baseline, peakMb: peak.stop(), afterListenMb: afterListen,
        createAppMs, listenMs, readyMs, refreshMs, readyz: ready.statusCode, home: home.statusCode, atlas
      };
    }
    throw new Error(`Unknown measure mode: ${mode}`);
  } finally {
    peak.stop();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 });
  }
}

const mode = process.argv[2] || "all";
const thisFile = fileURLToPath(import.meta.url);
if (mode === "all") {
  const results = [];
  for (const item of ["legacy", "batched", "listen", "hosted"]) {
    results.push(await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", thisFile, item], { stdio: ["ignore", "pipe", "inherit"] });
      let output = "";
      child.stdout.on("data", chunk => { output += chunk; });
      child.on("exit", code => {
        if (code !== 0) reject(new Error(`${item} measure exited ${code}`));
        else resolve(JSON.parse(output));
      });
    }));
  }
  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify(await measure(mode), null, 2)}\n`);
}
