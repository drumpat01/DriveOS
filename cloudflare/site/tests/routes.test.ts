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
  assert.equal(routes.length, 429);
  assert.equal(routes.filter(route => route.phase1_owner === "worker").length, 308);
  assert.equal(routes.filter(route => route.phase1_owner === "passthrough").length, 114);
  assert.equal(routes.filter(route => route.worker_action === "proxy").length, 114);
  assert.equal(routes.filter(route => route.worker_action === "none").length, 7);
});

test("every CSV row resolves to its action", () => {
  for (const route of routes) {
    if (route.worker_action === "none") {
      const winner = matched(route.method === "ALL" ? "GET" : route.method, route.path);
      assert.notEqual(winner?.route_id, route.route_id, route.route_id);
      if (route.path.startsWith("/api/")) assert.equal(winner?.worker_action, "proxy", route.path);
      continue;
    }
    const method = route.method === "ALL" ? "PUT" : route.method;
    const winner = matched(method, probePathFor(route));
    assert.ok(winner, `${route.route_id} ${route.path}`);
    assert.equal(winner.worker_action, route.worker_action, `${route.route_id} ${route.method} ${route.path}`);
    if (route.match === "exact" || route.match === "query") assert.equal(winner.route_id, route.route_id, route.path);
  }
});

test("homepage, clean URLs, trailing slash, and app shell stay distinct", () => {
  assert.equal(matched("GET", "/")?.target, "beta.html");
  assert.equal(matched("GET", "/privacy")?.target, "privacy.html");
  assert.equal(matched("GET", "/privacy.html")?.worker_action, "asset");
  assert.equal(matched("GET", "/privacy.html")?.expected_status, "200");
  assert.equal(matched("GET", "/privacy/")?.worker_action, "not_found_page");
  assert.equal(matched("GET", "/index.html")?.worker_action, "proxy");
  assert.equal(matched("GET", "/login.html")?.worker_action, "proxy");
  assert.equal(matched("GET", "/wife.html")?.worker_action, "proxy");
  assert.equal(matched("GET", "/wife.html")?.expected_status, "302");
  assert.equal(matched("GET", "/wife.html")?.x_robots_tag, "noindex, nofollow");
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

test("retention and api paths are proxied", () => {
  for (const routeId of ["R029", "R030", "R031", "R032"]) {
    const route = routes.find(row => row.route_id === routeId);
    assert.equal(route?.worker_action, "proxy", routeId);
    assert.equal(route?.phase1_owner, "passthrough", routeId);
    assert.equal(route?.target, "RENDER_ORIGIN", routeId);
  }
  assert.equal(matched("POST", "/retention-messaging-api")?.worker_action, "proxy");
  assert.equal(matched("GET", "/retention-messaging-api/")?.worker_action, "proxy");
  assert.equal(matched("POST", "/retention-messaging-api")?.route_id, "R029");
  assert.equal(matched("GET", "/retention-messaging-api")?.route_id, "R030");
  assert.equal(matched("GET", "/api/auth/session")?.worker_action, "proxy");
  assert.equal(matched("GET", "/api/atlas/journeys")?.worker_action, "proxy");
  assert.equal(matched("GET", "/readyz")?.worker_action, "proxy");
  assert.equal(matched("GET", "/app")?.worker_action, "proxy");
  assert.equal(matched("GET", "/styles.css?v=6.0.1")?.cache_control, "public, max-age=31536000, immutable");
  assert.equal(matched("GET", "/styles.css")?.cache_control, "public, max-age=0");
  assert.equal(matched("GET", "/app.js")?.content_type, "application/javascript; charset=utf-8");
  assert.equal(matched("GET", "/favicon.ico")?.content_type, "image/vnd.microsoft.icon");
  assert.equal(matched("GET", "/terms")?.cache_control, "public, max-age=0");
  assert.equal(matched("GET", "/.well-known/api-catalog")?.content_type, "application/linkset+json");
  assert.equal(matched("GET", "/google8e611381b21882a8.html")?.cache_control, "");
});

test("login and passkey routes are proxied and known-fail on workers.dev", () => {
  // requestOriginAllowed rejects a workers.dev Origin, and the WebAuthn RP ID is
  // journeydeck.me. Those failures are the Render app, not Worker bugs.
  const known = routes.filter(route => route.worker_action !== "none" && /workers\.dev|passkey|WebAuthn RP ID/.test(route.notes));
  assert.ok(known.length >= 6);
  for (const route of known) assert.equal(route.worker_action, "proxy", route.route_id);
  for (const path of ["/login", "/api/auth/login", "/api/auth/passkey/options", "/api/auth/passkey/verify"]) {
    assert.equal(routes.find(route => route.path === path && route.worker_action !== "none")?.worker_action, "proxy", path);
  }
});

test("every web file is in the route map", () => {
  const named = new Set<string>();
  for (const route of routes) {
    if (route.target && !route.target.startsWith("http") && route.target !== "403" && route.target !== "retention" && route.target !== "RENDER_ORIGIN") named.add(route.target);
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
  assert.equal(owned.some(route => route.worker_action === "proxy"), false);
});
