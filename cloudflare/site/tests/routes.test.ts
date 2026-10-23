import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { matchRoute, parseRouteList, probePathFor, type RouteRow } from "../src/routes.ts";

const root = join(import.meta.dirname, "..", "..", "..");
const routes = parseRouteList(readFileSync(join(import.meta.dirname, "..", "route-list.csv"), "utf8"));

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    if (name === ".assetsignore") return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function matched(method: string, path: string) {
  const url = new URL(path, "https://journeydeck.me");
  return matchRoute(routes, method, url.pathname, url.search);
}

test("route list has the phase-one shape", () => {
  assert.equal(routes.length, 465);
  assert.equal(routes.filter(route => route.phase1_owner === "worker").length, 458);
  assert.equal(routes.filter(route => route.phase1_owner === "passthrough").length, 0);
  assert.equal(routes.filter(route => route.worker_action === "health").length, 4);
  assert.equal(routes.filter(route => route.target === "RENDER_ORIGIN").length, 0);
  assert.equal(routes.filter(route => route.worker_action === "gone").length, 101);
  assert.equal(routes.filter(route => route.worker_action === "retired_page").length, 7);
  assert.equal(routes.filter(route => route.worker_action === "native").length, 4);
  assert.equal(routes.filter(route => route.worker_action === "none").length, 7);
});

test("every CSV row resolves to its action", () => {
  for (const route of routes) {
    if (route.worker_action === "none") {
      const winner = matched(route.method === "ALL" ? "GET" : route.method, route.path);
      assert.notEqual(winner?.route_id, route.route_id, route.route_id);
      if (route.path.startsWith("/api/")) assert.equal(winner?.worker_action, "gone", route.path);
      continue;
    }
    const method = route.method === "ALL" ? "PUT" : route.method;
    const winner = matched(method, probePathFor(route));
    assert.ok(winner, `${route.route_id} ${route.path}`);
    assert.equal(winner.worker_action, route.worker_action, `${route.route_id} ${route.method} ${route.path}`);
    if (route.match === "exact" || route.match === "query") assert.equal(winner.route_id, route.route_id, route.path);
  }
});

test("llms.txt is a public plain text asset", () => {
  const route = matched("GET", "/llms.txt");
  assert.equal(route?.worker_action, "asset");
  assert.equal(route?.target, "llms.txt");
  assert.equal(route?.content_type, "text/plain; charset=utf-8");
  assert.equal(route?.cache_control, "public, max-age=0");
  assert.equal(route?.x_robots_tag, "");
  assert.equal(route?.expected_status, "200");
  assert.equal(matched("HEAD", "/llms.txt")?.target, "llms.txt");
});

test("homepage, clean URLs, trailing slash, and app shell stay distinct", () => {
  const home = matched("GET", "/");
  const indexFile = matched("GET", "/index.html");
  assert.equal(home?.target, "beta.html");
  assert.equal(home?.worker_action, "asset");
  assert.equal(home?.expected_status, "200");
  assert.equal(home?.match, "exact");
  assert.equal(matched("POST", "/"), undefined);
  assert.equal(indexFile?.worker_action, "retired_page");
  assert.equal(indexFile?.match, "exact");
  assert.notEqual(indexFile?.route_id, home?.route_id);
  assert.equal(matched("GET", "/index.html/")?.worker_action, "not_found_page");
  assert.equal(matched("GET", "/privacy")?.target, "privacy.html");
  assert.equal(matched("GET", "/privacy.html")?.worker_action, "asset");
  assert.equal(matched("GET", "/privacy.html")?.expected_status, "200");
  assert.equal(matched("GET", "/privacy/")?.worker_action, "not_found_page");
  assert.equal(matched("GET", "/login.html")?.worker_action, "retired_page");
  assert.equal(matched("GET", "/login.html")?.match, "exact");
  assert.equal(matched("POST", "/wife.html")?.worker_action, "retired_page");
  assert.equal(matched("POST", "/spotify-callback")?.worker_action, "retired_page");
  assert.equal(matched("GET", "/spotify-callback/extra")?.worker_action, "not_found_page");
  for (const path of ["/assets/v2/soundtrack.jpg", "/assets/v2/soundtrack.webp", "/assets/v4/05-soundtrack.webp"]) {
    assert.equal(routes.some(route => route.path === path), false, path);
  }
  assert.notEqual(matched("GET", "/")?.target, "index.html");
});

test("redirects, retired landings, directory 403, and unknown GET", () => {
  assert.deepEqual(
    [matched("GET", "/driving-journal")?.worker_action, matched("GET", "/driving-journal")?.target, matched("GET", "/driving-journal")?.expected_status],
    ["redirect", "/private-driving-journal", "301"]
  );
  assert.equal(matched("GET", "/homeworld")?.target, "https://studio.journeydeck.me/homeworld");
  assert.equal(matched("GET", "/homeworld/")?.target, "https://studio.journeydeck.me/homeworld");
  assert.equal(matched("GET", "/homeworld-anything")?.worker_action, "not_found_page");
  for (const path of ["/beta", "/beta/", "/beta.html", "/landing.html"]) assert.equal(matched("GET", path)?.worker_action, "not_found_page", path);
  assert.equal(matched("GET", "/assets/")?.worker_action, "status_only");
  assert.equal(matched("GET", "/assets/")?.target, "403");
  assert.equal(matched("GET", "/parity-check-not-a-page")?.worker_action, "not_found_page");
  assert.equal(matched("POST", "/parity-check-not-a-page"), undefined);
});

test("retention stays native and retired routes do not proxy", () => {
  for (const routeId of ["R029", "R030", "R031", "R032"]) {
    const route = routes.find(row => row.route_id === routeId);
    assert.equal(route?.worker_action, "native", routeId);
    assert.equal(route?.phase1_owner, "worker", routeId);
    assert.equal(route?.target, "retention", routeId);
    assert.equal(route?.handler_file, "cloudflare/site/src/retention.ts", routeId);
  }
  assert.equal(matched("POST", "/retention-messaging-api")?.worker_action, "native");
  assert.equal(matched("GET", "/retention-messaging-api/")?.worker_action, "native");
  assert.equal(matched("POST", "/retention-messaging-api")?.route_id, "R029");
  assert.equal(matched("GET", "/retention-messaging-api")?.route_id, "R030");
  assert.equal(routes.filter(route => route.path.includes("retention-messaging") && route.worker_action !== "native").length, 0);
  assert.equal(matched("GET", "/api/auth/session")?.worker_action, "gone");
  assert.equal(matched("POST", "/api/auth/login")?.worker_action, "gone");
  assert.equal(matched("PUT", "/api/anything")?.worker_action, "gone");
  assert.equal(matched("GET", "/api/atlas/journeys")?.worker_action, "gone");
  assert.equal(matched("GET", "/api-docs")?.worker_action, "asset");
  assert.equal(matched("GET", "/readyz")?.worker_action, "health");
  assert.equal(matched("HEAD", "/readyz")?.method, "GET");
  assert.equal(matched("GET", "/healthz")?.worker_action, "health");
  assert.equal(matched("HEAD", "/healthz")?.route_id, "R040");
  assert.equal(matched("POST", "/healthz")?.route_id, "R462");
  assert.equal(matched("POST", "/healthz")?.expected_status, "405");
  assert.equal(matched("PUT", "/readyz")?.expected_status, "405");
  assert.equal(matched("GET", "/healthz")?.cache_control, "no-store");
  assert.equal(matched("GET", "/healthz/extra")?.worker_action, "not_found_page");
  assert.equal(matched("GET", "/app")?.worker_action, "retired_page");
  assert.equal(matched("POST", "/app/library")?.worker_action, "retired_page");
  assert.equal(matched("GET", "/login")?.worker_action, "retired_page");
  assert.equal(matched("HEAD", "/login/reset")?.worker_action, "retired_page");
  assert.equal(matched("DELETE", "/wife")?.worker_action, "retired_page");
  assert.equal(matched("GET", "/wife/summary")?.worker_action, "retired_page");
  assert.equal(matched("GET", "/app.js")?.worker_action, "asset");
  assert.equal(matched("GET", "/styles.css?v=6.0.1")?.cache_control, "public, max-age=31536000, immutable");
  assert.equal(matched("GET", "/styles.css")?.cache_control, "public, max-age=0");
  assert.equal(matched("GET", "/app.js")?.content_type, "application/javascript; charset=utf-8");
  assert.equal(matched("GET", "/favicon.ico")?.content_type, "image/vnd.microsoft.icon");
  assert.equal(matched("GET", "/terms")?.cache_control, "public, max-age=0");
  assert.equal(matched("GET", "/.well-known/api-catalog")?.content_type, "application/linkset+json");
  assert.equal(matched("GET", "/google8e611381b21882a8.html")?.cache_control, "");
});

test("no route proxies to Render", () => {
  const health = routes.filter(route => (route.path === "/healthz" || route.path === "/readyz") && route.worker_action !== "none").map(route => `${route.method} ${route.path} ${route.worker_action} ${route.expected_status}`).sort();
  assert.deepEqual(health, [
    "ALL /healthz health 405",
    "ALL /readyz health 405",
    "GET /healthz health 200",
    "GET /readyz health 200"
  ]);
  const legacyHealth = routes.find(route => route.route_id === "R084");
  assert.equal(legacyHealth?.path, "/healthz");
  assert.equal(legacyHealth?.worker_action, "none");
  assert.equal(legacyHealth?.phase1_owner, "n/a");
  assert.equal(routes.some(route => route.phase1_owner === "passthrough" || route.target === "RENDER_ORIGIN"), false);
  for (const path of ["/login", "/app", "/wife"]) {
    const route = routes.find(row => row.path === path);
    assert.equal(route?.worker_action, "retired_page", path);
    assert.equal(route?.method, "ALL", path);
    assert.equal(route?.match, "prefix", path);
    assert.equal(route?.expected_status, "410", path);
    assert.equal(route?.x_robots_tag, "noindex", path);
    assert.equal(route?.cache_control, "no-store", path);
  }
  for (const path of ["/login.html", "/index.html", "/wife.html", "/spotify-callback"]) {
    const route = routes.find(row => row.path === path);
    assert.equal(route?.worker_action, "retired_page", path);
    assert.equal(route?.method, "ALL", path);
    assert.equal(route?.match, "exact", path);
    assert.equal(route?.expected_status, "410", path);
    assert.equal(route?.x_robots_tag, "noindex", path);
  }
  for (const path of ["/api/auth/login", "/api/auth/passkey/options", "/api/auth/passkey/verify", "/api/auth/session"]) {
    const route = routes.find(row => row.path === path && row.worker_action !== "none");
    assert.equal(route?.worker_action, "gone", path);
    assert.equal(route?.expected_status, "410", path);
    assert.equal(route?.cache_control, "no-store", path);
  }
});

test("every web file is in the route map", () => {
  const named = new Set<string>();
  for (const route of routes) {
    if (route.target && !route.target.startsWith("http") && route.target !== "403" && route.target !== "retention" && route.target !== "RENDER_ORIGIN" && route.target !== "gone" && route.target !== "retired" && route.target !== "health") named.add(route.target);
    if (route.path.startsWith("/") && !route.path.includes("*") && !route.path.includes("?")) named.add(route.path.slice(1));
  }
  const missing = walk(join(root, "web"))
    .map(file => relative(join(root, "web"), file).split("\\").join("/"))
    .filter(file => !named.has(file));
  assert.deepEqual(missing, []);
});

test("a new app.ts route that is not in the map fails this test", () => {
  const files = ["server/src/app.ts", "server/src/recorder-mobile-routes.ts", "server/src/retention-messaging.ts"];
  const found = new Set<string>();
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    for (const match of source.matchAll(/app\.(?:get|post|put|delete|all)\s*(?:<[\s\S]*?>)?\s*\(\s*["'](\/[^"']+)["']/g)) found.add(match[1]);
    for (const match of source.matchAll(/["'](\/(?:beta|beta\/|beta\.html|landing\.html|retention-messaging-api\/?))["']/g)) found.add(match[1]);
  }
  const known = new Set(routes.map(route => route.path));
  const missing = [...found].filter(path => !known.has(path));
  assert.deepEqual(missing, [], "add the new route to route-list.csv");
});

test("worker responses do not duplicate a content security policy", () => {
  const owned = routes.filter((route): route is RouteRow => route.phase1_owner === "worker" && route.worker_action !== "none");
  assert.equal(owned.some(route => route.target === "RENDER_ORIGIN"), false);
  assert.equal(routes.some(route => route.phase1_owner === "passthrough"), false);
  assert.equal(owned.some(route => route.worker_action === "health"), true);
});
