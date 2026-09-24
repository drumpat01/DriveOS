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
    assert.match(String(script.headers["content-security-policy"]), /frame-src https:\/\/open\.spotify\.com/);
    assert.match(String(script.headers["permissions-policy"]), /autoplay=\(self "https:\/\/open\.spotify\.com"\).*encrypted-media=\(self "https:\/\/open\.spotify\.com"\)/);
  } finally {
    await runtime.app.close(); fixture.cleanup(); fs.rmSync(webRoot, { recursive: true, force: true });
  }
});

test("public information and discovery pages are accessible without an authenticated JourneyDeck session", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "" });
  try {
    const privacy = await runtime.app.inject({ method: "GET", url: "/privacy" });
    const support = await runtime.app.inject({ method: "GET", url: "/support" });
    assert.equal(privacy.statusCode, 200, privacy.body);
    assert.match(String(privacy.headers["content-type"]), /text\/html/);
    assert.match(privacy.body, /JourneyDeck Privacy Policy/i);
    assert.match(privacy.body, /journeydeckapp@gmail\.com/i);
    assert.match(privacy.body, /JourneyDeck 2\.0 never begins a journey automatically/i);
    assert.match(privacy.body, /RevenueCat/i);
    assert.doesNotMatch(privacy.body, /Automatic Drive Detection|Tessie/i);
    assert.match(privacy.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    assert.match(privacy.body, /\/public-page\.css\?v=grand-tour-3/);
    assert.equal(support.statusCode, 200, support.body);
    assert.match(String(support.headers["content-type"]), /text\/html/);
    assert.match(support.body, /JourneyDeck Support/i);
    assert.match(support.body, /mailto:journeydeckapp@gmail\.com/i);
    assert.match(support.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    const soundtrack = await runtime.app.inject({ method: "GET", url: "/apple-music-soundtrack" });
    assert.equal(soundtrack.statusCode, 200, soundtrack.body);
    assert.match(String(soundtrack.headers["content-type"]), /text\/html/);
    assert.match(soundtrack.body, /records drives and builds an optional soundtrack from your authorized Apple Music listening history/i);
    assert.match(soundtrack.body, /href="\/privacy"/);
    assert.match(soundtrack.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(soundtrack.body, /aria-current="page">Soundtracks<\/a>/);
    assert.match(soundtrack.body, /\/assets\/v2\/soundtrack\.jpg/);
    assert.match(soundtrack.body, /Identify Song uses ShazamKit/);
    const journal = await runtime.app.inject({ method: "GET", url: "/private-driving-journal" });
    assert.equal(journal.statusCode, 200, journal.body);
    assert.match(String(journal.headers["content-type"]), /text\/html/);
    assert.match(journal.body, /<h1>Private driving journal for iPhone<\/h1>/);
    assert.match(journal.body, /JourneyDeck is a private driving journal for iPhone\. You manually start a journey/);
    assert.match(journal.body, /<h2>Frequently asked questions<\/h2>/);
    assert.match(journal.body, /What is a private driving journal app for iPhone\?/);
    assert.match(journal.body, /href="\/privacy"/);
    assert.match(journal.body, /href="\/apple-music-soundtrack"/);
    assert.match(journal.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(journal.body, /rel="canonical" href="https:\/\/journeydeck\.me\/private-driving-journal"/);
    const journalAlias = await runtime.app.inject({ method: "GET", url: "/driving-journal" });
    assert.equal(journalAlias.statusCode, 301);
    assert.equal(journalAlias.headers.location, "/private-driving-journal");
    const terms = await runtime.app.inject({ method: "GET", url: "/terms" });
    assert.equal(terms.statusCode, 200, terms.body);
    assert.match(terms.body, /JourneyDeck Terms of Use/i);
    for (const page of [privacy, support, soundtrack, journal, terms]) {
      assert.match(page.body, /class="site-header"/);
      assert.match(page.body, /class="desktop-nav" aria-label="Main navigation"/);
      assert.match(page.body, /href="\/apple-music-soundtrack"/);
      assert.match(page.body, /class="mobile-menu"/);
      assert.match(page.body, /Get the app/);
    }
    const robots = await runtime.app.inject({ method: "GET", url: "/robots.txt" });
    assert.equal(robots.statusCode, 200, robots.body);
    assert.match(robots.body, /Sitemap: https:\/\/journeydeck\.me\/sitemap\.xml/i);
    assert.doesNotMatch(robots.body, /Disallow: \/beta/i);
    const sitemap = await runtime.app.inject({ method: "GET", url: "/sitemap.xml" });
    assert.equal(sitemap.statusCode, 200, sitemap.body);
    assert.match(String(sitemap.headers["content-type"]), /xml/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/terms<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/apple-music-soundtrack<\/loc>/i);
    assert.match(sitemap.body, /<loc>https:\/\/journeydeck\.me\/private-driving-journal<\/loc>/i);
    assert.doesNotMatch(sitemap.body, /<loc>https:\/\/journeydeck\.me\/(?:beta|app|login)(?:\/|<)/i);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("hosted root serves the Grand Touring launch page while private routes stay separate", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const landing = await runtime.app.inject({ method: "GET", url: "/" });
    assert.equal(landing.statusCode, 200, landing.body);
    assert.match(String(landing.headers["content-type"]), /text\/html/);
    assert.match(landing.body, /GRAND TOURING/);
    assert.match(landing.body, /JOURNEYDECK 2\.0 · AVAILABLE NOW/);
    assert.match(landing.body, /href="\/beta\.css\?v=grand-tour-4"/);
    assert.match(landing.body, /id="medallion-theme"/);
    assert.match(landing.body, /data-theme="redline"/);
    assert.match(landing.body, /aria-label="1 of 5: Home"/);
    assert.match(landing.body, /https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(landing.body, /https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
    assert.match(landing.body, /IPAD \/ VERSION 2\.0/);
    assert.match(landing.body, /APPLE WATCH \/ VERSION 2\.0/);
    assert.match(landing.body, /rel="canonical" href="https:\/\/journeydeck\.me\/"/);
    assert.match(landing.body, /property="og:url" content="https:\/\/journeydeck\.me\/"/);
    assert.match(landing.body, /href="\/login"/i);
    assert.match(landing.body, /href="#medallions"/);
    assert.match(landing.body, /href="\/apple-music-soundtrack"/);
    assert.match(landing.body, /class="feature-cta" href="\/apple-music-soundtrack"/);
    assert.match(landing.body, /class="feature-cta" href="\/private-driving-journal">See the private driving journal overview/);
    assert.match(landing.body, /id="replay"/);
    assert.match(landing.body, /id="memories"/);
    assert.match(landing.body, /id="membership"/);
    assert.match(landing.body, /class="mobile-menu"/);
    assert.match(landing.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    assert.match(landing.body, /Follow @JourneyDeck on X/i);
    assert.doesNotMatch(landing.body, /noindex|2\.0 PREVIEW|Coming soon for iPhone|Follow the launch|Tessie/);
    assert.doesNotMatch(landing.body, /@JourneyDeckApp|x\.com\/JourneyDeckApp/i);

    for (const [url, mime] of [
      ["/beta.css?v=grand-tour-4", /text\/css/],
      ["/public-page.css?v=grand-tour-3", /text\/css/],
      ["/site-mobile-nav.css?v=1", /text\/css/],
      ["/v2-features.css?v=1", /text\/css/],
      ["/soundtrack-v2.css?v=1", /text\/css/],
      ["/assets/v2/route-replay.jpg", /image\/jpeg/],
      ["/assets/v2/soundtrack.jpg", /image\/jpeg/],
      ["/assets/v2/memory.jpg", /image\/jpeg/],
      ["/assets/v2/themes.jpg", /image\/jpeg/],
      ["/login-grand-touring.css?v=grand-tour-1", /text\/css/],
      ["/beta.js?v=grand-tour-1", /javascript/],
      ["/medallions/medallions.css?v=medallions-1", /text\/css/],
      ["/medallions/medallions.js?v=medallions-1", /javascript/],
      ["/medallions/catalog.js", /javascript/],
      ["/medallions/viewer.js?v=medallions-1", /javascript/],
      ["/assets/medallions/soundtrack-100-dark.webp", /image\/webp/],
      ["/assets/medallions/story-collector-light-thumb.webp", /image\/webp/],
      ["/assets/beta/grand-touring-home.webp", /image\/webp/],
      ["/assets/beta/journeydeck-pulse.svg", /image\/svg/],
      ...["home", "soundtracks", "memories", "medallions", "statistics"].map(name => [`/assets/beta/screens/${name}.webp`, /image\/webp/] as const)
    ] as const) {
      const asset = await runtime.app.inject({ method: "GET", url });
      assert.equal(asset.statusCode, 200, url);
      assert.match(String(asset.headers["content-type"]), mime, url);
    }

    for (const url of ["/beta", "/beta/", "/beta.html", "/landing.html"]) {
      const legacyLanding = await runtime.app.inject({ method: "GET", url });
      assert.equal(legacyLanding.statusCode, 302, url);
      assert.equal(legacyLanding.headers.location, "/", url);
    }
    const nestedBeta = await runtime.app.inject({ method: "GET", url: "/beta/private" });
    assert.equal(nestedBeta.statusCode, 404);
    assert.match(nestedBeta.body, /Page not found/i);
    assert.equal(nestedBeta.headers["x-robots-tag"], "noindex, nofollow");

    const missing = await runtime.app.inject({ method: "GET", url: "/a-page-that-does-not-exist" });
    assert.equal(missing.statusCode, 404, missing.body);
    assert.match(missing.body, /Page not found/i);
    assert.equal(missing.headers["x-robots-tag"], "noindex, nofollow");
    const missingApi = await runtime.app.inject({ method: "GET", url: "/api/a-page-that-does-not-exist" });
    assert.equal(missingApi.statusCode, 401);

    const login = await runtime.app.inject({ method: "GET", url: "/login" });
    assert.equal(login.statusCode, 200, login.body);
    assert.match(login.body, /JourneyDeck Sign In/i);
    assert.match(login.body, /\/login-grand-touring\.css\?v=grand-tour-1/);
    assert.match(login.body, /\/assets\/favicon\.png\?v=app-logo-1/i);
    assert.ok(fs.readFileSync(path.join(root, "web", "assets", "favicon.png")).equals(fs.readFileSync(path.join(root, "web", "assets", "journeydeck-cinematic-192.png"))));

    const privateApp = await runtime.app.inject({ method: "GET", url: "/app" });
    assert.equal(privateApp.statusCode, 302, privateApp.body);
    assert.equal(privateApp.headers.location, "/login");

    const authenticatedApp = await runtime.app.inject({ method: "GET", url: "/app", headers: auth });
    assert.equal(authenticatedApp.statusCode, 200, authenticatedApp.body);
    assert.match(String(authenticatedApp.headers["content-type"]), /text\/html/);
    assert.match(authenticatedApp.body, /JourneyDeck/i);

    const loginScript = fs.readFileSync(path.join(root, "web", "login.js"), "utf8");
    assert.match(loginScript, /window\.location\.replace\("\/app"\)/);
    assert.doesNotMatch(loginScript, /window\.location\.replace\("\/"\)/);
    const wifeScript = fs.readFileSync(path.join(root, "web", "wife.js"), "utf8");
    assert.match(wifeScript, /location\.replace\("\/app"\)/);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "web", "manifest.webmanifest"), "utf8"));
    assert.equal(manifest.start_url, "/app#dashboard");
  } finally { await runtime.app.close(); fixture.cleanup(); }
});

test("desktop root continues to serve only the authenticated private app", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "desktop" });
  try {
    const anonymous = await runtime.app.inject({ method: "GET", url: "/" });
    assert.equal(anonymous.statusCode, 302, anonymous.body);
    assert.equal(anonymous.headers.location, "/login");
    const authenticated = await runtime.app.inject({ method: "GET", url: "/", headers: auth });
    assert.equal(authenticated.statusCode, 200, authenticated.body);
    assert.match(authenticated.body, /JourneyDeck/i);
  } finally { await runtime.app.close(); fixture.cleanup(); }
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

test("hosted Spotify playback returns a browser PKCE authorization configuration", async () => {
  const fixture = fixtureDatabase(), publicOrigin = "https://journeydeck.me";
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", publicOrigin, mode: "web", spotifyClientId: "spotify-test-client" });
  try {
    const response = await runtime.app.inject({ method: "POST", url: "/api/spotify/player/connect", headers: { ...auth, origin: publicOrigin }, payload: {} });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(JSON.parse(response.body), { mode: "pkce", clientId: "spotify-test-client", redirectUri: "https://journeydeck.me/spotify-callback" });
    const callback = await runtime.app.inject({ method: "GET", url: "/spotify-callback?code=test&state=test", headers: auth });
    assert.equal(callback.statusCode, 200, callback.body);
    assert.match(String(callback.headers["content-type"]), /text\/html/);
  } finally { await runtime.app.close(); fixture.cleanup(); }
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
