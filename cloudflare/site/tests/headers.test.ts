import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HSTS, HOMEPAGE_LINKS, SECURITY_HEADERS, mimeForPath, versionedCache, withOwnedHeaders } from "../src/headers.ts";

test("javascript and icon types match the live static server", () => {
  assert.equal(mimeForPath("/app.js"), "application/javascript; charset=utf-8");
  assert.equal(mimeForPath("/service-worker.js"), "application/javascript; charset=utf-8");
  assert.equal(mimeForPath("/favicon.ico"), "image/vnd.microsoft.icon");
  assert.equal(mimeForPath("/terms.html"), "text/html; charset=utf-8");
});

test("versioned files are immutable and plain HTML is not", () => {
  assert.equal(versionedCache(new URL("https://journeydeck.me/terms")), false);
  assert.equal(versionedCache(new URL("https://journeydeck.me/styles.css?v=6.0.1")), true);
  assert.equal(versionedCache(new URL("https://journeydeck.me/app.js?v=6.0.1")), true);
  assert.equal(versionedCache(new URL("https://journeydeck.me/assets/favicon.png?v=1")), true);
  assert.equal(versionedCache(new URL("https://journeydeck.me/privacy.html")), false);
});

test("worker headers replace must-revalidate and do not duplicate CSP", () => {
  const asset = new Response("<html></html>", {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "content-type": "text/html",
      "content-security-policy": "default-src 'none'",
      etag: "W/\"asset\""
    }
  });
  const response = withOwnedHeaders(asset, headers => {
    headers.set("cache-control", "public, max-age=0");
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("link", HOMEPAGE_LINKS);
  });
  assert.equal(response.headers.get("cache-control"), "public, max-age=0");
  assert.equal(response.headers.get("cache-control")?.includes("must-revalidate"), false);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("strict-transport-security"), HSTS);
  assert.equal(response.headers.get("content-security-policy"), SECURITY_HEADERS["content-security-policy"]);
  let policies = 0;
  response.headers.forEach((_value, name) => { if (name === "content-security-policy") policies += 1; });
  assert.equal(policies, 1);
  assert.equal(response.headers.get("etag"), "W/\"asset\"");
  assert.match(response.headers.get("link") || "", /api-catalog/);
});

test("wrangler config is workers.dev only", () => {
  const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const withoutComments = source.replace(/^\s*\/\/.*$/gm, "");
  assert.match(withoutComments, /"workers_dev":\s*true/);
  assert.match(withoutComments, /"html_handling":\s*"none"/);
  assert.match(withoutComments, /"not_found_handling":\s*"none"/);
  assert.match(withoutComments, /"run_worker_first":\s*true/);
  assert.match(withoutComments, /"RENDER_ORIGIN":\s*"https:\/\/driveos\.onrender\.com"/);
  assert.doesNotMatch(withoutComments, /"routes"/);
  assert.doesNotMatch(withoutComments, /"route"/);
  assert.doesNotMatch(withoutComments, /custom_domain/);
  assert.doesNotMatch(withoutComments, /"zone"/);
  assert.doesNotMatch(withoutComments, /journeydeck\.me/);
});
