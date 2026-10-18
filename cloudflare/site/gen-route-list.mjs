#!/usr/bin/env node
// Builds route-list.csv and route-list.md from the DriveOS source tree.
// Usage: node gen-route-list.mjs [repoRoot] [observed.json]
// Read-only against the repo. Explicit routes are transcribed from
// server/src/app.ts, recorder-mobile-routes.ts, retention-messaging.ts and the
// DriveOS-Server.ps1 dispatch switch (legacy routes are parsed from source).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] || join(here, "..", "..");
const observedPath = process.argv[3] || join(here, "live-observed.json");
const outDir = here;
const commit = (() => { try { return execFileSync("git", ["-C", repo, "log", "-1", "--format=%h %s"], { encoding: "utf8" }).trim(); } catch { return ""; } })();

const APP = "server/src/app.ts", MOB = "server/src/recorder-mobile-routes.ts", PS = "DriveOS-Server.ps1", STATIC = "server/src/app.ts (@fastify/static wildcard over web/)";
const SEC = "security headers from onSend hook (CSP, nosniff, x-frame-options DENY, referrer-policy, permissions-policy, HSTS on https)";
const rows = [];
const add = r => rows.push({
  method: "GET", match: "exact", type: "", phase1_owner: "", worker_action: "", target: "",
  expected_status: "200", content_type: "", cache_control: "", x_robots_tag: "", canonical: "", other_headers: "",
  auth: "none", worker_secrets: "none", handler_file: APP, probe_method: "GET", probe_path: r.path, probe_body: "", probe_compare: "full", notes: "", ...r
});

// ---------- Worker: SEO and legal pages (clean URLs) ----------
const pages = [
  ["/", "beta.html", "home; onSend adds Link header (api-catalog, service-desc, service-doc, describedby)"],
  ["/privacy", "privacy.html", "linked from the iOS app and App Store metadata; must never break"],
  ["/support", "support.html", "linked from the iOS app and App Store metadata; must never break"],
  ["/terms", "terms.html", ""],
  ["/apple-music-soundtrack", "apple-music-soundtrack.html", ""],
  ["/private-driving-journal", "private-driving-journal.html", ""],
  ["/road-trip-journal-app", "road-trip-journal-app.html", ""],
  ["/road-trip-tracker-app", "road-trip-tracker-app.html", ""],
  ["/travel-journal-app-with-photos", "travel-journal-app-with-photos.html", ""],
  ["/driving-history-app", "driving-history-app.html", ""],
  ["/route-66-road-trip-journal", "route-66-road-trip-journal.html", ""],
  ["/pacific-coast-highway-road-trip-journal", "pacific-coast-highway-road-trip-journal.html", ""],
  ["/national-parks-road-trip-journal", "national-parks-road-trip-journal.html", ""],
  ["/texas-hill-country-road-trip-journal", "texas-hill-country-road-trip-journal.html", ""],
  ["/tesla-drive-journal", "tesla-drive-journal.html", ""],
  ["/api-docs", "api-docs.html", "not in sitemap"],
];
const canonOf = (file) => {
  try { const m = readFileSync(join(repo, "web", file), "utf8").match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i); return m ? m[1] : ""; } catch { return ""; }
};
for (const [path, file, note] of pages) add({
  path, type: "static page", phase1_owner: "worker", worker_action: "asset", target: file,
  content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", canonical: canonOf(file),
  other_headers: (path === "/" ? "link (homepageLinks); " : "") + SEC,
  notes: [note, "sendFile route; clean URL must not redirect"].filter(Boolean).join("; ")
});
add({ path: "/.well-known/api-catalog", type: "static page", phase1_owner: "worker", worker_action: "asset_typed", target: "api-catalog.json",
  content_type: "application/linkset+json", cache_control: "", other_headers: SEC, notes: "content-type override; live sends no cache-control" });
add({ path: "/google8e611381b21882a8.html", type: "static page", phase1_owner: "worker", worker_action: "asset_typed", target: "google8e611381b21882a8.html",
  content_type: "text/html; charset=utf-8", cache_control: "", other_headers: SEC, notes: "Search Console verification; served via readFile not sendFile, so no cache-control" });

// ---------- Worker: redirects and retired paths ----------
add({ path: "/driving-journal", type: "redirect", phase1_owner: "worker", worker_action: "redirect", target: "/private-driving-journal", expected_status: "301", other_headers: SEC, notes: "relative Location" });
add({ path: "/homeworld", type: "redirect", phase1_owner: "worker", worker_action: "redirect", target: "https://studio.journeydeck.me/homeworld", expected_status: "301", other_headers: SEC, notes: "added by #297 (102a13b). Do not use a prefix match: the journeydeck-staging route journeydeck.me/homeworld* would win once the apex is proxied (phase 2) - decide the owner before cutover" });
add({ path: "/homeworld/", type: "redirect", phase1_owner: "worker", worker_action: "redirect", target: "https://studio.journeydeck.me/homeworld", expected_status: "301", other_headers: SEC, notes: "added by #297" });
for (const p of ["/beta", "/beta/", "/beta.html", "/landing.html"]) add({ path: p, type: "redirect", phase1_owner: "worker", worker_action: "not_found_page", target: "404.html", expected_status: "404",
  content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", x_robots_tag: "noindex, nofollow", other_headers: SEC, notes: "retired landing page: 404 body + noindex even though beta.html/landing.html exist in web/" });
add({ path: "/*", match: "fallback", type: "static page", phase1_owner: "worker", worker_action: "not_found_page", target: "404.html", expected_status: "404",
  content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", x_robots_tag: "noindex, nofollow", other_headers: SEC,
  probe_path: "/parity-check-not-a-page", notes: "setNotFoundHandler for unknown non-/api GET/HEAD. Non-GET unknown -> JSON 404 {error:'Not found.'}" });
add({ path: "/privacy/", match: "exact", type: "static page", phase1_owner: "worker", worker_action: "not_found_page", target: "404.html", expected_status: "404",
  content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", x_robots_tag: "noindex, nofollow", other_headers: SEC,
  notes: "parity guard: Fastify does not ignore trailing slashes, so /<page>/ is a 404 today. Workers assets html_handling auto-trailing-slash would redirect instead - use html_handling none" });
add({ path: "/assets/", match: "exact", type: "static page", phase1_owner: "worker", worker_action: "status_only", target: "403", expected_status: "403",
  content_type: "application/json; charset=utf-8", other_headers: SEC, probe_compare: "status+headers+json", notes: "parity guard: @fastify/static answers a directory path with 403 JSON (index:false). Workers assets would 404 - decide whether to keep 403 or accept 404 (harmless)" });

// ---------- Worker: Apple retention messaging ----------
// Render on the free plan sleeps, and Apple waits 700 ms without retrying.
// The Worker answers these four routes. Verification is Web Crypto. The pinned
// Apple root and WWDR G6 intermediate are parsed at isolate startup. The Apple
// library stays on Render.
const RETENTION_HANDLER = "cloudflare/site/src/retention.ts";
const retentionNote = "Answered by the Worker with Web Crypto. No fetch to RENDER_ORIGIN. OCSP stays off. Apple realtime call, 700 ms budget. 64 KB body limit, application/json only (415 otherwise).";
for (const p of ["/retention-messaging-api", "/retention-messaging-api/"]) {
  add({ method: "POST", path: p, type: "API", phase1_owner: "worker", worker_action: "native", target: "retention", handler_file: RETENTION_HANDLER,
    expected_status: "400", content_type: "application/json; charset=utf-8", cache_control: "no-store", other_headers: SEC,
    worker_secrets: "none",
    probe_method: "POST", probe_body: "{}", probe_compare: "status+headers+json",
    notes: `${retentionNote} Probe sends {} -> 400. Real signed Sandbox request still untested. server/src/retention-messaging.ts still serves Render.` });
  add({ method: "ALL", path: p, type: "API", phase1_owner: "worker", worker_action: "native", target: "retention", handler_file: RETENTION_HANDLER,
    expected_status: "405", content_type: "application/json; charset=utf-8", cache_control: "no-store", other_headers: "allow: POST; " + SEC,
    probe_method: "GET", probe_compare: "status+headers+json", notes: `${retentionNote} non-POST methods -> 405` });
}

// ---------- Passthrough: app shells, health ----------
const shell = (path, status, notes, extra = {}) => add({ path, type: "static page", phase1_owner: "passthrough", worker_action: "proxy", target: "RENDER_ORIGIN", expected_status: status,
  auth: "DriveOSSession cookie (redirects to /login without one)", other_headers: SEC, notes, ...extra });
shell("/app", "302", "app shell (index.html); Location: /login (relative) when signed out", { x_robots_tag: "noindex, nofollow" });
shell("/spotify-callback", "302", "Spotify PKCE redirect target (index.html); Location /login when signed out", { x_robots_tag: "noindex, nofollow" });
shell("/wife", "302", "wife dashboard shell (wife.html); Location /login when signed out");
shell("/login", "200", "sign-in page (login.html). Kept on Render so the auth surface stays together", { auth: "none", content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", x_robots_tag: "noindex, nofollow" });
shell("/login.html", "200", "same file as /login, served by the static wildcard", { auth: "none", content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", x_robots_tag: "noindex, nofollow", handler_file: STATIC });
shell("/index.html", "200", "SURPRISE: app shell HTML is publicly fetchable (web-mode GET rule); data still needs auth", { auth: "none", content_type: "text/html; charset=utf-8", cache_control: "public, max-age=0", x_robots_tag: "noindex, nofollow", handler_file: STATIC });
shell("/wife.html", "302", "#301 requires the existing session for /wife.html, including decoded and case-variant paths. Unauthenticated requests redirect to /login. web/.assetsignore keeps the file out of the asset bundle", { x_robots_tag: "noindex, nofollow" });
add({ path: "/healthz", type: "health", phase1_owner: "passthrough", worker_action: "proxy", target: "RENDER_ORIGIN", content_type: "application/json; charset=utf-8", other_headers: SEC, probe_compare: "status+headers", notes: "static JSON about the Node process; keep on Render so it describes Render" });
add({ path: "/readyz", type: "health", phase1_owner: "passthrough", worker_action: "proxy", target: "RENDER_ORIGIN", content_type: "application/json; charset=utf-8", other_headers: SEC, probe_compare: "status+headers", notes: "Render healthCheckPath; body is dynamic (atlas, snapshotStale). The verify-live routine reads generatedAtUtc here" });

// ---------- Passthrough: Node-handled APIs ----------
const nodeApi = [
  ["GET", "/api/auth/session", APP, "session cookie", "falls to Node; 401 JSON without cookie"],
  ["GET", "/api/recorder/status", APP, "recorder bearer"], ["POST", "/api/recorder/sessions", APP, "recorder bearer"],
  ["GET", "/api/recorder/sessions/:id", APP, "recorder bearer", "query deviceId required"],
  ["POST", "/api/recorder/sessions/:id/points", APP, "recorder bearer"], ["POST", "/api/recorder/sessions/:id/state", APP, "recorder bearer"],
  ["POST", "/api/recorder/sessions/:id/complete", APP, "recorder bearer"],
  ["GET", "/api/recorder/connections/status", MOB, "recorder bearer"], ["GET", "/api/recorder/dashboard", MOB, "recorder bearer"],
  ["GET", "/api/recorder/music-dashboard", MOB, "recorder bearer"], ["GET", "/api/recorder/journeys", MOB, "recorder bearer"],
  ["GET", "/api/recorder/journeys/:id", MOB, "recorder bearer"], ["PUT", "/api/recorder/places/alias", MOB, "recorder bearer"],
  ["GET", "/api/recorder/vehicle-intelligence", MOB, "recorder bearer", "Tessie-backed (TESSIE_TOKEN on Render)"], ["PUT", "/api/recorder/vehicle-intelligence/preferences", MOB, "recorder bearer"],
  ["GET", "/api/recorder/memories", MOB, "recorder bearer"], ["PUT", "/api/recorder/memories", MOB, "recorder bearer"],
  ["PUT", "/api/recorder/collections", MOB, "recorder bearer"],
  ["POST", "/api/recorder/collections/:id/photos", MOB, "recorder bearer", "base64 photo bodies up to 4 MB (Fastify bodyLimit); Worker proxy must stream, Workers request limit is 100 MB so OK"],
  ["POST", "/api/recorder/memories/:id/photos", MOB, "recorder bearer", "base64 photo bodies up to 4 MB"],
  ["GET", "/api/recorder/photos/:id", MOB, "recorder bearer"], ["DELETE", "/api/recorder/photos/:id", MOB, "recorder bearer"],
  ["GET", "/api/recorder/preferences/:deviceId", MOB, "recorder bearer"], ["PUT", "/api/recorder/preferences/:deviceId", MOB, "recorder bearer"],
  ["POST", "/api/recorder/sessions/:id/music", MOB, "recorder bearer"], ["POST", "/api/recorder/sessions/:id/lastfm/sync", MOB, "recorder bearer", "uses LASTFM_API_KEY on Render"],
  ["GET", "/api/atlas/bootstrap", APP, "session cookie", "ETag + private, no-cache; 304 support must survive the proxy (pass If-None-Match)"],
  ["GET", "/api/atlas/map", APP, "session cookie", "private, max-age=30"], ["GET", "/api/atlas/places/:id", APP, "session cookie"],
  ["GET", "/api/atlas/patterns", APP, "session cookie"], ["GET", "/api/atlas/snapshot/status", APP, "session cookie"],
  ["POST", "/api/atlas/places/label", APP, "session cookie + Origin check"], ["POST", "/api/atlas/patterns/:id/confirm", APP, "session cookie + Origin check"],
  ["POST", "/api/atlas/patterns/:id/dismiss", APP, "session cookie + Origin check"], ["POST", "/api/atlas/snapshot/rebuild", APP, "session cookie + Origin check"],
  ["ALL", "/api/atlas/*", APP, "session cookie", "410 for any other /api/atlas path (after auth). SHADOWS legacy /api/atlas/journeys, /api/atlas/places, /api/atlas/places/scan"],
  ["GET", "/api/spotify/player/session", APP, "session cookie", "no-store"], ["GET", "/api/spotify/player/auth-status", APP, "session cookie", "no-store"],
  ["POST", "/api/spotify/player/connect", APP, "session cookie + Origin check", "returns PKCE redirectUri = DRIVEOS_NODE_PUBLIC_ORIGIN/spotify-callback"],
  ["POST", "/api/drive/map", APP, "session cookie + Origin check", "recorder map, falls back to legacy PowerShell"],
  ["ALL", "/api/*", APP, "session cookie", "catch-all: proxies to the PowerShell compatibility server (spawned lazily, 20 s start). Unknown paths after auth -> legacy JSON 404"],
];
for (const [method, path, file, auth, note = ""] of nodeApi) {
  const authHow = auth.startsWith("recorder") ? "Bearer JOURNEYDECK_RECORDER_TOKEN (checked on Render)" : auth.startsWith("session") ? "DriveOSSession cookie (checked on Render)" + (auth.includes("Origin") ? "; non-GET also needs Origin == https://journeydeck.me" : "") : auth;
  const probe = method === "GET" || method === "ALL";
  add({ method, path, match: path.endsWith("*") ? "prefix" : path.includes(":") ? "pattern" : "exact", type: "API", phase1_owner: "passthrough", worker_action: "proxy", target: "RENDER_ORIGIN",
    expected_status: probe ? "401" : "", content_type: "application/json; charset=utf-8", handler_file: file, auth: authHow, other_headers: SEC,
    probe_method: probe ? "GET" : "", probe_path: probe ? path.replace(/:[A-Za-z]+/g, "parity-probe").replace("/*", "/parity-probe") : "", probe_compare: probe ? "status+headers+json" : "skip",
    notes: [note, probe ? "probe is unauthenticated: 401 is rejected in onRequest before any handler or PowerShell runs" : "write route: not probed"].filter(Boolean).join("; ") });
}
add({ method: "POST", path: "/api/spotify/sync", type: "API", phase1_owner: "passthrough", worker_action: "proxy", target: "RENDER_ORIGIN", handler_file: PS + " (+ app.ts onRequest)",
  expected_status: "401", content_type: "application/json; charset=utf-8", auth: "x-driveos-sync-token == DRIVEOS_SPOTIFY_SYNC_SECRET (checked on Render)", other_headers: SEC,
  probe_method: "GET", probe_path: "/api/spotify/sync", probe_compare: "status+headers+json", notes: "scheduled sync; caller not in repo (open question for Kit). GET -> 401 because the check requires POST. Worker must forward x-driveos-sync-token" });

// ---------- Passthrough: legacy PowerShell routes (parsed) ----------
const ps = readFileSync(join(repo, PS), "utf8").split("\n");
const getStart = ps.findIndex(l => /if \(\$Method -eq "GET"\) \{/.test(l) && ps.slice(ps.indexOf(l), ps.indexOf(l) + 3).some(x => /"\/healthz"/.test(x)));
const postStart = ps.findIndex((l, i) => i > getStart && /if \(\$Method -eq "POST"\) \{/.test(l));
const nodeKeys = new Set([...nodeApi.map(([m, p]) => `${m} ${p}`), "POST /api/spotify/sync"]);
const publicAuth = new Set(["/api/auth/login", "/api/auth/passkey/options", "/api/auth/passkey/verify"]);
let section = null;
for (let i = getStart; i < Math.min(ps.length, postStart + 450); i++) {
  if (i === getStart) section = "GET"; if (i === postStart) section = "POST";
  const m = ps[i].match(/^ {16}"(\/[^"]*)" \{/); if (!m) continue;
  const path = m[1];
  if (!path.startsWith("/api/")) {
    add({ method: section, path, type: "API", phase1_owner: "n/a", worker_action: "none", handler_file: `${PS}:${i + 1}`, probe_compare: "skip", probe_method: "", probe_path: "", expected_status: "",
      notes: `legacy-only route, unreachable through Node (Node answers ${path} itself or 404s it). Dead code for the Worker` });
    continue;
  }
  if (nodeKeys.has(`${section} ${path}`)) continue;
  const shadowed = path.startsWith("/api/atlas/");
  const isPublicAuth = publicAuth.has(path);
  add({ method: section, path, type: "API", phase1_owner: shadowed ? "n/a" : "passthrough", worker_action: shadowed ? "none" : "proxy", target: shadowed ? "" : "RENDER_ORIGIN",
    expected_status: section === "GET" && !isPublicAuth && !shadowed ? "401" : "", content_type: "application/json; charset=utf-8", handler_file: `${PS}:${i + 1} via app.ts app.all("/api/*")`,
    auth: path === "/api/spotify/sync" ? "sync secret" : isPublicAuth ? "public (login/passkey); POST needs Origin == https://journeydeck.me" : path.startsWith("/api/wife/") ? "DriveOSSession cookie, wife or owner role" : "DriveOSSession cookie, owner role",
    other_headers: SEC,
    probe_method: section === "GET" && !isPublicAuth && !shadowed ? "GET" : "", probe_path: section === "GET" && !isPublicAuth && !shadowed ? path : "",
    probe_compare: section === "GET" && !isPublicAuth && !shadowed ? "status+headers+json" : "skip",
    notes: [shadowed ? "SHADOWED: Node's app.all('/api/atlas/*') returns 410 first, so this legacy route is dead" : "",
      isPublicAuth ? "not probed: an unauthenticated request reaches PowerShell (would spawn it)" : "",
      path === "/api/auth/login" ? "sets DriveOSSession cookie; Worker must pass Set-Cookie through untouched" : "",
      path.startsWith("/api/auth/passkey") ? "WebAuthn RP ID journeydeck.me: cannot work on workers.dev staging" : "",
      /attachments\/add/.test(path) ? "larger body limit for owner uploads" : "",
      section === "POST" ? "write route: not probed" : ""].filter(Boolean).join("; ") });
}
add({ method: "GET", path: "/api/spotify/artwork/:trackId", match: "pattern", type: "API", phase1_owner: "passthrough", worker_action: "proxy", target: "RENDER_ORIGIN",
  expected_status: "401", content_type: "application/json; charset=utf-8", handler_file: `${PS} (default branch regex ^/api/spotify/artwork/([A-Za-z0-9]{10,64})$)`,
  auth: "DriveOSSession cookie, owner role", other_headers: SEC, probe_path: "/api/spotify/artwork/parityprobe01", probe_compare: "status+headers+json", notes: "regex route, easy to miss" });

// ---------- Worker: static files in web/ ----------
const explicitFiles = new Set(["beta.html", "landing.html", "index.html", "login.html", "wife.html", "google8e611381b21882a8.html"]);
const walk = d => readdirSync(d).flatMap(n => {
  if (n === ".assetsignore") return [];
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/vnd.microsoft.icon", ".gif": "image/gif", ".avif": "image/avif",
  ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".md": "text/markdown; charset=utf-8", ".webmanifest": "application/manifest+json", ".mp4": "video/mp4" };
const imgRe = /\.(?:png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot)$/i, verRe = /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot)$/i;
const files = walk(join(repo, "web")).map(f => relative(join(repo, "web"), f).split("\\").join("/")).sort();
for (const rel of files) {
  if (explicitFiles.has(rel)) continue;
  const path = "/" + rel, ext = extname(rel).toLowerCase();
  const assetFolder = path.startsWith("/assets/") || path.startsWith("/medallions/");
  const cc = assetFolder && imgRe.test(path) ? "public, max-age=604800" : "public, max-age=0";
  const special = { "/robots.txt": "robots; Disallow /api/, /app$, /app/, /spotify-callback, /wife; Sitemap https://journeydeck.me/sitemap.xml",
    "/sitemap.xml": "15 <loc> on https://journeydeck.me (host-specific)", "/service-worker.js": "PWA service worker: scope / . A different SW body at the edge changes client caching",
    "/build.json": "web build manifest", "/manifest.webmanifest": "PWA manifest", "/404.html": "direct fetch returns 200 (not 404)", "/openapi.json": "linked from / Link header", "/auth.md": "agent auth doc",
    "/api-catalog.json": "raw file; /.well-known/api-catalog serves the same bytes as application/linkset+json" }[path] || "";
  const page = ext === ".html";
  add({ path, type: page ? "static page" : "asset", phase1_owner: "worker", worker_action: "asset", target: rel, content_type: mime[ext] || "",
    cache_control: cc, canonical: page ? canonOf(rel) : "", other_headers: SEC, handler_file: STATIC,
    probe_compare: page || [".txt", ".xml", ".json", ".md", ".webmanifest"].includes(ext) || path === "/service-worker.js" ? "full" : "status+headers+bytes",
    notes: [special, page && rel !== "404.html" ? ".html alias of a clean URL or an unlisted page; must return 200, not a redirect" : "", verRe.test(path) && !assetFolder ? "?v= query switches cache-control to immutable" : ""].filter(Boolean).join("; ") });
}
// cache-class probes with ?v=
for (const [path, cc] of [["/styles.css?v=6.0.1", "public, max-age=31536000, immutable"], ["/app.js?v=6.0.1", "public, max-age=31536000, immutable"], ["/assets/favicon.png?v=1", "public, max-age=31536000, immutable"], ["/public-page.css?v=1", "public, max-age=31536000, immutable"]]) {
  add({ path, match: "query", type: "asset", phase1_owner: "worker", worker_action: "asset", target: path.slice(1).split("?")[0], content_type: mime[extname(path.split("?")[0])],
    cache_control: cc, other_headers: SEC, handler_file: APP + " publicCacheClass", probe_compare: "status+headers+bytes", notes: "cache-class guard: versioned static gets immutable" });
}

// ---------- Retire approved Render routes ----------
// The old web app is answered by the Worker, and so are /healthz and /readyz.
// Nothing in this list is fetched from Render. / is the homepage asset and is
// not /index.html; the file paths below stay exact matches.
const RETIRED_HANDLER = "cloudflare/site/src/retired.ts";
const HEALTH_HANDLER = "cloudflare/site/src/health.ts";
const healthNote = "Answered by the Worker. GET and HEAD return {\"ok\":true,\"service\":\"journeydeck-site\"} with Cache-Control no-store. No fetch to Render.";
const retiredPrefixes = new Set(["/login", "/app", "/wife"]);
const retiredExact = new Set(["/login.html", "/index.html", "/wife.html", "/spotify-callback"]);
function retirePage(row, match) {
  const path = row.path;
  row.method = "ALL";
  row.match = match;
  row.phase1_owner = "worker";
  row.worker_action = "retired_page";
  row.target = "retired";
  row.expected_status = "410";
  row.content_type = "text/html; charset=utf-8";
  row.cache_control = "no-store";
  row.x_robots_tag = "noindex";
  row.auth = "none";
  row.handler_file = RETIRED_HANDLER;
  row.probe_method = "GET";
  row.probe_path = match === "prefix" ? `${path}/parity-probe` : path;
  row.probe_compare = "skip";
  const scope = match === "prefix" ? `${path} and ${path}/* return` : `${path} returns`;
  const homepage = path === "/index.html" ? " GET / stays the homepage asset and is a different route." : "";
  row.notes = `Retired web app. ${scope} an HTML 410 notice for every method, with noindex and no fetch to RENDER_ORIGIN.${homepage}`;
}
function claimHealth(row) {
  row.phase1_owner = "worker";
  row.worker_action = "health";
  row.target = "health";
  row.expected_status = "200";
  row.content_type = "application/json; charset=utf-8";
  row.cache_control = "no-store";
  row.x_robots_tag = "";
  row.auth = "none";
  row.handler_file = HEALTH_HANDLER;
  row.probe_compare = "skip";
  row.notes = healthNote;
}
for (const row of rows) {
  if (row.worker_action !== "proxy") continue;
  const path = row.path.split("?")[0];
  if (path === "/api" || path.startsWith("/api/")) {
    row.phase1_owner = "worker";
    row.worker_action = "gone";
    row.target = "gone";
    row.expected_status = "410";
    row.content_type = "application/json; charset=utf-8";
    row.cache_control = "no-store";
    row.x_robots_tag = "";
    row.auth = "none";
    row.handler_file = RETIRED_HANDLER;
    row.probe_compare = "skip";
    row.notes = "Retired ahead of the Render shutdown. Every method returns HTTP 410 JSON and Cache-Control no-store. No fetch to RENDER_ORIGIN.";
    continue;
  }
  if (retiredPrefixes.has(path)) retirePage(row, "prefix");
  else if (retiredExact.has(path)) retirePage(row, "exact");
  else if (path === "/healthz" || path === "/readyz") {
    claimHealth(row);
    add({ method: "ALL", path, type: "health", phase1_owner: "worker", worker_action: "health", target: "health",
      expected_status: "405", content_type: "application/json; charset=utf-8", cache_control: "no-store",
      other_headers: "allow: GET, HEAD; " + SEC, auth: "none", handler_file: HEALTH_HANDLER,
      probe_method: "POST", probe_path: path, probe_compare: "skip",
      notes: `${healthNote} Other methods return 405 with Allow: GET, HEAD.` });
  }
}
const leftoverProxy = rows.filter(row => row.worker_action === "proxy");
if (leftoverProxy.length) throw new Error(`proxy routes remain: ${leftoverProxy.map(row => `${row.method} ${row.path}`).join(", ")}`);

// ---------- merge observed live values ----------
let observed = {};
if (existsSync(observedPath)) observed = JSON.parse(readFileSync(observedPath, "utf8"));
rows.forEach((r, i) => {
  r.route_id = `R${String(i + 1).padStart(3, "0")}`;
  const o = observed[`${r.probe_method} ${r.probe_path}`];
  r.live_status = o ? String(o.status) : ""; r.live_content_type = o?.contentType || ""; r.live_cache_control = o?.cacheControl || ""; r.live_x_robots_tag = o?.xRobotsTag || ""; r.live_location = o?.location || "";
});
const cols = ["route_id", "method", "path", "match", "type", "phase1_owner", "worker_action", "target", "expected_status", "content_type", "cache_control", "x_robots_tag", "canonical", "other_headers", "auth", "worker_secrets", "handler_file", "probe_method", "probe_path", "probe_body", "probe_compare", "live_status", "live_content_type", "live_cache_control", "live_x_robots_tag", "live_location", "notes"];
const esc = v => { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
writeFileSync(join(outDir, "route-list.csv"), [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n") + "\n");

const count = f => rows.filter(f).length;
const summary = {
  total: rows.length, worker: count(r => r.phase1_owner === "worker"), workerExplicit: count(r => r.phase1_owner === "worker" && !r.handler_file.includes("wildcard")),
  workerAssets: count(r => r.phase1_owner === "worker" && r.handler_file.includes("wildcard")), passthrough: count(r => r.phase1_owner === "passthrough"), dead: count(r => r.phase1_owner === "n/a"),
  probed: count(r => r.probe_compare !== "skip" && r.probe_path),
};
writeFileSync(join(outDir, "route-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
const mdCols = ["route_id", "method", "path", "type", "phase1_owner", "worker_action", "target", "expected_status", "content_type", "cache_control", "x_robots_tag", "auth", "handler_file", "notes"];
const mdEsc = v => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const section_ = (title, f) => [`## ${title} (${count(f)})`, "", `| ${mdCols.join(" | ")} |`, `|${mdCols.map(() => "---").join("|")}|`, ...rows.filter(f).map(r => `| ${mdCols.map(c => mdEsc(r[c])).join(" | ")} |`), ""].join("\n");
const md = [
  "# DriveOS phase-one route list", "",
  `Generated by gen-route-list.mjs from ${repo} (${commit || "origin/main 102a13b"}) on ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT. Same rows as route-list.csv, which is the machine-readable source for Kat's route map.`, "",
  `Totals: ${summary.total} rows. Worker-served ${summary.worker} (explicit routes ${summary.worker - summary.workerAssets}, static files from web/ ${summary.workerAssets}). Passthrough to Render ${summary.passthrough}. Dead or unreachable legacy routes ${summary.dead}. No route proxies to Render.`, "",
  "Column guide: `phase1_owner` worker | passthrough | n/a. `worker_action` asset (serve `target` from the ASSETS binding at that exact path), asset_typed (asset with a forced content-type), redirect (status + Location = target), not_found_page (404.html, status 404, x-robots-tag noindex, nofollow), native (Worker retention handler for /retention-messaging-api, Web Crypto, no Render fetch), gone (HTTP 410 JSON for /api/*, Cache-Control no-store, no Render fetch), retired_page (HTTP 410 HTML notice for /login, /app, /wife and their subpaths, plus exact /login.html, /index.html, /wife.html, and /spotify-callback, noindex, no Render fetch), health (GET and HEAD /healthz and /readyz return JSON {\"ok\":true,\"service\":\"journeydeck-site\"} with Cache-Control no-store; other methods return 405 and Allow: GET, HEAD; no Render fetch), none (no route needed). No row uses proxy. `match` exact | pattern (:param) | prefix (/*) | fallback | query (cache-class probe only). `live_*` columns are what production returned during the self-test.", "",
  "Every response today also carries the onSend security headers (CSP, x-content-type-options nosniff, x-frame-options DENY, referrer-policy no-referrer, permissions-policy, HSTS max-age=31536000 on https). No route proxies to Render.", "",
  section_("Worker: explicit routes", r => r.phase1_owner === "worker" && !r.handler_file.includes("wildcard")),
  section_("Passthrough to Render", r => r.phase1_owner === "passthrough"),
  section_("Dead or unreachable legacy routes (no route needed)", r => r.phase1_owner === "n/a"),
  section_("Worker: static files from web/ (ASSETS binding)", r => r.phase1_owner === "worker" && r.handler_file.includes("wildcard")),
].join("\n");
writeFileSync(join(outDir, "route-list.md"), md);
console.log(JSON.stringify(summary));
