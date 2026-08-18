import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const auth = { "x-journeydeck-test-auth": "owner" };
const writeHeaders = { ...auth, origin: "http://127.0.0.1" };

test("Atlas API enforces auth, origin, roles, and durable serialized writes", async () => {
  const fixture = fixtureDatabase();
  const options = { databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", publicOrigin: "http://127.0.0.1" };
  let runtime = await createApp(options);
  try {
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap" })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: { "tailscale-user-login": "spoofed@example.com" } })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/atlas/bootstrap", headers: auth })).statusCode, 200);
    assert.equal((await runtime.app.inject({ method: "POST", url: "/api/atlas/snapshot/rebuild", headers: { ...auth, origin: "https://evil.invalid" } })).statusCode, 403);
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

test("legacy compatibility is explicit, passes reads, and blocks production writes", async () => {
  let requests = 0;
  const seen: Array<{ url?: string; host?: string; forwardedHost?: string; origin?: string }> = [];
  const upstream = http.createServer((req, res) => { requests++; seen.push({ url: req.url, host: req.headers.host, forwardedHost: String(req.headers["x-forwarded-host"] || ""), origin: req.headers.origin }); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ compatible: true, method: req.method })); });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve)); const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: `http://127.0.0.1:${address.port}`, legacyReadOnly: true, publicOrigin: "https://journeydeck.me" });
  try {
    const read = await runtime.app.inject({ method: "GET", url: "/api/status", headers: auth }); assert.equal(read.statusCode, 200); assert.equal(JSON.parse(read.body).compatible, true);
    const computedRead = await runtime.app.inject({ method: "POST", url: "/api/drive/share-card", headers: { ...auth, origin: "https://journeydeck.me" }, payload: { driveId: "fixture" } }); assert.equal(computedRead.statusCode, 200);
    const login = await runtime.app.inject({ method: "POST", url: "/api/auth/login", headers: { host: "journeydeck.me", origin: "https://journeydeck.me" }, payload: { email: "owner@example.com", password: "test" } }); assert.equal(login.statusCode, 200);
    const passkey = await runtime.app.inject({ method: "POST", url: "/api/auth/passkey/options", headers: { host: "journeydeck.me", origin: "https://journeydeck.me" }, payload: {} }); assert.equal(passkey.statusCode, 200);
    assert.deepEqual(seen.slice(-2), [
      { url: "/api/auth/login", host: "journeydeck.me", forwardedHost: "journeydeck.me", origin: "https://journeydeck.me" },
      { url: "/api/auth/passkey/options", host: "journeydeck.me", forwardedHost: "journeydeck.me", origin: "https://journeydeck.me" }
    ]);
    const write = await runtime.app.inject({ method: "POST", url: "/api/layout", headers: { ...auth, origin: "https://journeydeck.me" }, payload: {} }); assert.equal(write.statusCode, 503); assert.equal(requests, 4);
    const retiredAtlas = await runtime.app.inject({ method: "GET", url: "/api/atlas/journeys", headers: auth }); assert.equal(retiredAtlas.statusCode, 410); assert.equal(requests, 4);
  } finally { await runtime.app.close(); await new Promise<void>(resolve => upstream.close(() => resolve())); fixture.cleanup(); }
});
