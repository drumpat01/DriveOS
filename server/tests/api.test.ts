import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const auth = { "x-journeydeck-test-auth": "owner" };
const writeHeaders = { ...auth, origin: "http://127.0.0.1" };

test("static web assets added after startup are served from the fixed web root", async () => {
  const fixture = fixtureDatabase(), webRoot = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-static-"));
  const runtime = await createApp({ databasePath: fixture.filename, root, webRoot, allowTestAuth: true, legacyUpstream: "" });
  try {
    fs.mkdirSync(path.join(webRoot, "features"), { recursive: true });
    fs.writeFileSync(path.join(webRoot, "moments.css"), ".moments-page{display:block}", "utf8");
    fs.writeFileSync(path.join(webRoot, "features", "moments.js"), "window.JourneyDeckMoments=true;", "utf8");
    const css = await runtime.app.inject({ method: "GET", url: "/moments.css?v=next" });
    const script = await runtime.app.inject({ method: "GET", url: "/features/moments.js?v=next" });
    assert.equal(css.statusCode, 200, css.body);
    assert.match(String(css.headers["content-type"]), /^text\/css/);
    assert.equal(script.statusCode, 200, script.body);
    assert.match(String(script.headers["content-type"]), /javascript/);
    assert.match(String(script.headers["content-security-policy"]), /https:\/\/sdk\.scdn\.co/);
  } finally {
    await runtime.app.close(); fixture.cleanup(); fs.rmSync(webRoot, { recursive: true, force: true });
  }
});

test("Atlas API enforces auth, origin, roles, and durable serialized writes", async () => {
  const fixture = fixtureDatabase();
  const options = { databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", publicOrigin: "http://127.0.0.1" };
  let runtime = await createApp(options);
  try {
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap" })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/spotify/player/session" })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { "tailscale-user-login": "spoofed@example.com" } })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).statusCode, 200);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { ...auth, origin: "https://evil.invalid" } })).statusCode, 403);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { ...auth, host: "127.0.0.1:8791", origin: "http://127.0.0.1:8791" } })).statusCode, 202);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { ...auth, host: "127.0.0.1:8791", origin: "http://127.0.0.1:8792" } })).statusCode, 403);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { "x-journeydeck-test-auth": "wife", origin: "http://127.0.0.1" } })).statusCode, 403);
    const original = JSON.parse((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).body);
    const places = original.places.filter((item: any) => item.category !== "home").slice(0, 2);
    for (const [index, place] of places.entries()) {
      const response = await runtime.app.inject({ method: "POST", url: "/api/atlas/places/label", headers: writeHeaders, payload: { placeId: place.id, name: index ? "Walmart - Saginaw" : "Home", category: index ? "errands" : "home", latitude: place.latitude, longitude: place.longitude, radiusFeet: 200 } });
      assert.equal(response.statusCode, 200, response.body);
    }
    const patternIds = original.patterns.slice(0, 2).map((item: any) => item.id);
    assert.equal((await runtime.app.inject({ method: "POST", url: `/api/atlas/patterns/${patternIds[0]}/confirm`, headers: writeHeaders, payload: { type: "frequent-route" } })).statusCode, 200);
    assert.equal((await runtime.app.inject({ method: "POST", url: `/api/atlas/patterns/${patternIds[1]}/dismiss`, headers: writeHeaders })).statusCode, 200);
    const after = JSON.parse((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).body);
    assert.equal(after.places.find((item: any) => item.id === places[0].id).label, "Home");
    assert.equal(after.places.find((item: any) => item.id === places[1].id).label, "Walmart - Saginaw");
    assert.equal(after.patterns.length, 10);
    assert.equal(after.patterns.some((item: any) => patternIds.includes(item.id)), false);
    assert.equal(new Set(after.patterns.map((item: any) => item.id)).size, 10);
    await runtime.app.close();
    runtime = await createApp(options);
    const refreshed = JSON.parse((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).body);
    assert.equal(refreshed.places.find((item: any) => item.id === places[0].id).label, "Home");
    assert.equal(refreshed.places.find((item: any) => item.id === places[1].id).label, "Walmart - Saginaw");
    assert.equal(refreshed.patterns.some((item: any) => patternIds.includes(item.id)), false);
  } finally { await runtime.app.close().catch(() => {}); fixture.cleanup(); }
});

test("bootstrap is private, ETagged, compressed, and contains no journey archive", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const response = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { ...auth, "accept-encoding": "br" } });
    assert.equal(response.statusCode, 200); assert.equal(response.headers["cache-control"], "private, no-cache"); assert.ok(response.headers.etag); assert.equal(response.headers["content-encoding"], "br");
    const conditional = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { ...auth, "if-none-match": String(response.headers.etag) } }); assert.equal(conditional.statusCode, 304);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("Atlas journey map is bounded, progressive, private, and contains no place labels", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const world = "west=-180&south=-90&east=180&north=90";
    assert.equal((await runtime.app.inject({ method: "GET", url: `/api/atlas/map?${world}&zoom=4` })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/map?west=5&south=5&east=1&north=9&zoom=4", headers: auth })).statusCode, 400);
    const overviewResponse = await runtime.app.inject({ method: "GET", url: `/api/atlas/map?${world}&zoom=4`, headers: auth });
    assert.equal(overviewResponse.statusCode, 200, overviewResponse.body); assert.equal(overviewResponse.headers["cache-control"], "private, max-age=30");
    const overview = JSON.parse(overviewResponse.body); assert.equal(overview.mode, "corridors"); assert.equal(overview.totalInView, 2100); assert.ok(overview.returned <= 500); assert.ok(overview.data.features.every((item: any) => item.properties.kind === "corridor" && !item.properties.journeyId));
    const detailResponse = await runtime.app.inject({ method: "GET", url: `/api/atlas/map?${world}&zoom=11`, headers: auth });
    assert.equal(detailResponse.statusCode, 200, detailResponse.body); const detail = JSON.parse(detailResponse.body);
    assert.equal(detail.mode, "journeys"); assert.equal(detail.returned, 1200); assert.equal(detail.truncated, true); assert.ok(detail.data.features.every((item: any) => item.properties.kind === "journey" && item.properties.journeyId));
    assert.doesNotMatch(detailResponse.body, /startingLocation|endingLocation|raw_payload|Resolved place|Walmart/i);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("snapshot rebuild runs off the request thread and preserves the last valid snapshot", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const before = runtime.store.status(); runtime.store.scheduleRebuild(0);
    const started = performance.now(), immediate = await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth });
    assert.equal(immediate.statusCode, 200); assert.ok(performance.now() - started < 300);
    const deadline = Date.now() + 5000; while (runtime.store.status().dirty && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    const after = runtime.store.status(); assert.equal(after.dirty, false); assert.equal(after.lastError, null); assert.notEqual(after.snapshotId, before.snapshotId);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("readiness fails when the compatibility API is unavailable", async () => {
  let healthHost = "";
  const upstream = http.createServer((req, res) => { healthHost = String(req.headers.host || ""); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: `http://127.0.0.1:${address.port}`, publicOrigin: "https://journeydeck.me" });
  try {
    const ready = await runtime.app.inject({ method: "GET", url: "/readyz" });
    assert.equal(ready.statusCode, 200);
    assert.equal(JSON.parse(ready.body).legacyCompatibilityReachable, true);
    assert.equal(healthHost, "journeydeck.me");
    await new Promise<void>(resolve => upstream.close(() => resolve()));
    const unavailable = await runtime.app.inject({ method: "GET", url: "/readyz" });
    assert.equal(unavailable.statusCode, 503);
    assert.equal(JSON.parse(unavailable.body).legacyCompatibilityReachable, false);
  } finally {
    await runtime.app.close().catch(() => {});
    if (upstream.listening) await new Promise<void>(resolve => upstream.close(() => resolve()));
    fixture.cleanup();
  }
});

test("legacy compatibility is explicit, passes reads, and blocks production writes", async () => {
  let requests = 0;
  const seen: Array<{ url?: string; host?: string; forwardedHost?: string; origin?: string }> = [];
  const upstream = http.createServer((req, res) => { requests++; seen.push({ url: req.url, host: req.headers.host, forwardedHost: String(req.headers["x-forwarded-host"] || ""), origin: req.headers.origin }); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(req.url === "/api/auth/session" ? { authenticated: true, role: "owner", email: "owner@example.com" } : { compatible: true, method: req.method })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve)); const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const previewOrigin = "https://preview.journeydeck.test";
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: `http://127.0.0.1:${address.port}`, legacyReadOnly: true, publicOrigin: previewOrigin });
  try {
    const read = await runtime.app.inject({ method: "GET", url: "/api/status", headers: auth }); assert.equal(read.statusCode, 200); assert.equal(JSON.parse(read.body).compatible, true);
    const computedRead = await runtime.app.inject({ method: "POST", url: "/api/drive/share-card", headers: { ...auth, origin: previewOrigin }, payload: { driveId: "fixture" } }); assert.equal(computedRead.statusCode, 200);
    const login = await runtime.app.inject({ method: "POST", url: "/api/auth/login", headers: { host: "preview.journeydeck.test", origin: previewOrigin }, payload: { email: "owner@example.com", password: "test" } }); assert.equal(login.statusCode, 200);
    const passkey = await runtime.app.inject({ method: "POST", url: "/api/auth/passkey/options", headers: { host: "preview.journeydeck.test", origin: previewOrigin }, payload: {} }); assert.equal(passkey.statusCode, 200);
    assert.deepEqual(seen.slice(-2), [
      { url: "/api/auth/login", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: previewOrigin },
      { url: "/api/auth/passkey/options", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: previewOrigin }
    ]);
    const sessionRead = await runtime.app.inject({ method: "GET", url: "/api/status", headers: { cookie: "DriveOSSession=production-host-regression" } }); assert.equal(sessionRead.statusCode, 200);
    assert.deepEqual(seen.slice(-2), [
      { url: "/api/auth/session", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: undefined },
      { url: "/api/status", host: "preview.journeydeck.test", forwardedHost: "preview.journeydeck.test", origin: undefined }
    ]);
    const write = await runtime.app.inject({ method: "POST", url: "/api/layout", headers: { ...auth, origin: previewOrigin }, payload: {} }); assert.equal(write.statusCode, 503); assert.equal(requests, 6);
    const retiredAtlas = await runtime.app.inject({ method: "GET", url: "/api/atlas/journeys", headers: auth }); assert.equal(retiredAtlas.statusCode, 410); assert.equal(requests, 6);
  } finally { await runtime.app.close(); await new Promise<void>(resolve => upstream.close(() => resolve())); fixture.cleanup(); }
});

test("scheduled Spotify sync requires the shared secret and preserves it across the compatibility boundary", async () => {
  const scheduledSyncSecret = "test-scheduled-sync-secret-0123456789";
  let receivedToken = "";
  const upstream = http.createServer((req, res) => { receivedToken = String(req.headers["x-driveos-sync-token"] || ""); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ synced: true })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve)); const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: `http://127.0.0.1:${address.port}`, legacyReadOnly: false, publicOrigin: "https://journeydeck.me", scheduledSyncSecret });
  try {
    const missing = await runtime.app.inject({ method: "POST", url: "/api/spotify/sync", payload: {} }); assert.equal(missing.statusCode, 401); assert.equal(receivedToken, "");
    const wrong = await runtime.app.inject({ method: "POST", url: "/api/spotify/sync", headers: { "x-driveos-sync-token": `${scheduledSyncSecret}-wrong` }, payload: {} }); assert.equal(wrong.statusCode, 401); assert.equal(receivedToken, "");
    const valid = await runtime.app.inject({ method: "POST", url: "/api/spotify/sync", headers: { "x-driveos-sync-token": scheduledSyncSecret }, payload: {} }); assert.equal(valid.statusCode, 200); assert.equal(receivedToken, scheduledSyncSecret);
  } finally { await runtime.app.close(); await new Promise<void>(resolve => upstream.close(() => resolve())); fixture.cleanup(); }
});
