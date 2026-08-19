import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { openDatabase } from "../src/database.js";

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
}

async function coldBootstrap() {
  const entry = path.join(config.root, "server", "dist", "index.js");
  if (!fs.existsSync(entry)) throw new Error("Build the TypeScript service before running the cold benchmark.");
  const port = 18000 + Math.floor(Math.random() * 1000), started = performance.now();
  const child = spawn(process.execPath, [entry], { cwd: config.root, env: { ...process.env, DRIVEOS_NODE_PORT: String(port), DRIVEOS_NODE_HOST: "127.0.0.1", DRIVEOS_NODE_DATABASE: config.databasePath, DRIVEOS_NODE_TEST_AUTH: "true", DRIVEOS_NODE_LEGACY_UPSTREAM: "", DRIVEOS_NODE_LOG_LEVEL: "silent" }, stdio: "ignore", windowsHide: true });
  try {
    const deadline = Date.now() + 5000; let response: Response | undefined;
    while (Date.now() < deadline) { try { response = await fetch(`http://127.0.0.1:${port}/api/atlas/bootstrap`, { headers: { "x-journeydeck-test-auth": "owner" } }); if (response.ok) break; } catch { response = undefined; } await new Promise(resolve => setTimeout(resolve, 10)); }
    if (!response?.ok) throw new Error("Cold Atlas service did not become ready.");
    await response.arrayBuffer(); return performance.now() - started;
  } finally { child.kill("SIGTERM"); }
}

if (!fs.existsSync(config.databasePath)) throw new Error("Development database is missing. Run npm run seed:atlas first.");
process.env.DRIVEOS_NODE_LOG_LEVEL = "silent";
const database = openDatabase(config.databasePath);
const row = database.prepare("SELECT payload_json FROM atlas_snapshots ORDER BY generated_at_utc DESC LIMIT 1").get() as { payload_json: string } | undefined;
database.close(); if (!row) throw new Error("No valid Atlas snapshot exists.");
const payload = Buffer.from(row.payload_json);

const runtime = await createApp({ databasePath: config.databasePath, allowTestAuth: true, legacyUpstream: "" });
const warm: number[] = [];
for (let index = 0; index < 120; index++) { const started = performance.now(); const response = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { "x-journeydeck-test-auth": "owner", "accept-encoding": "br" } }); if (response.statusCode !== 200) throw new Error(`Warm bootstrap failed with ${response.statusCode}`); warm.push(performance.now() - started); }
const mapWarm: number[] = []; let mapPayload = Buffer.alloc(0), mapFeatureCount = 0;
for (let index = 0; index < 60; index++) { const started = performance.now(); const response = await runtime.app.inject({ method: "GET", url: "/api/atlas/map?west=-180&south=-90&east=180&north=90&zoom=11", headers: { "x-journeydeck-test-auth": "owner" } }); if (response.statusCode !== 200) throw new Error(`Progressive map failed with ${response.statusCode}`); mapWarm.push(performance.now() - started); if (!mapPayload.length) { mapPayload = Buffer.from(response.body); mapFeatureCount = JSON.parse(response.body).returned; } }
await runtime.app.close();

const browserPreparation: number[] = [];
for (let index = 0; index < 120; index++) { const started = performance.now(); const parsed = JSON.parse(row.payload_json); const pointFeatures = parsed.places.map((place: any) => ({ type: "Feature", properties: { placeId: place.id, label: place.label, category: place.category }, geometry: { type: "Point", coordinates: [place.longitude, place.latitude] } })); if (pointFeatures.length !== parsed.places.length || parsed.representativeLines.features.length !== 200) throw new Error("Prepared Atlas payload is incomplete."); browserPreparation.push(performance.now() - started); }

const result = {
  fixture: { journeys: 2100, rawVisits: 4200 },
  payload: { uncompressedBytes: payload.length, gzipBytes: gzipSync(payload).length, brotliBytes: brotliCompressSync(payload).length },
  warmBootstrap: { p50Ms: percentile(warm, .5), p95Ms: percentile(warm, .95), maxMs: Math.max(...warm) },
  progressiveMap: { p50Ms: percentile(mapWarm, .5), p95Ms: percentile(mapWarm, .95), maxMs: Math.max(...mapWarm), features: mapFeatureCount, brotliBytes: brotliCompressSync(mapPayload).length },
  processColdBootstrapMs: await coldBootstrap(),
  browserPreparation: { p50Ms: percentile(browserPreparation, .5), p95Ms: percentile(browserPreparation, .95), maxMs: Math.max(...browserPreparation) }
};
if (result.warmBootstrap.p95Ms >= 300) throw new Error(`Warm p95 ${result.warmBootstrap.p95Ms.toFixed(1)}ms exceeds 300ms.`);
if (result.progressiveMap.p95Ms >= 300) throw new Error(`Progressive map p95 ${result.progressiveMap.p95Ms.toFixed(1)}ms exceeds 300ms.`);
if (result.progressiveMap.features > 1200 || result.progressiveMap.brotliBytes >= 500 * 1024) throw new Error("Progressive map response exceeded its rendering budget.");
if (result.processColdBootstrapMs >= 1000) throw new Error(`Process-cold bootstrap ${result.processColdBootstrapMs.toFixed(1)}ms exceeds 1000ms.`);
if (result.payload.brotliBytes >= 500 * 1024) throw new Error(`Brotli payload ${result.payload.brotliBytes} bytes exceeds 500KB.`);
if (result.browserPreparation.p95Ms >= 100) throw new Error(`Browser preparation p95 ${result.browserPreparation.p95Ms.toFixed(1)}ms exceeds 100ms.`);
const artifacts = path.join(config.root, "artifacts"); fs.mkdirSync(artifacts, { recursive: true }); fs.writeFileSync(path.join(artifacts, "atlas-performance.json"), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
