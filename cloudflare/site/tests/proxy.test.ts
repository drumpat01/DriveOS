import assert from "node:assert/strict";
import test from "node:test";
import { proxyToRender, RENDER_ORIGIN } from "../src/proxy.ts";

test("proxy strips tailscale and test-auth headers and keeps cookies", async () => {
  let forwarded: Headers | undefined;
  let target = "";
  const response = await proxyToRender(new Request("https://journeydeck-site.example.workers.dev/api/auth/session?device=1", {
    method: "POST",
    headers: {
      cookie: "DriveOSSession=abc",
      authorization: "Bearer recorder",
      "x-driveos-sync-token": "sync-token",
      "if-none-match": "W/\"etag\"",
      origin: "https://journeydeck.me",
      referer: "https://journeydeck.me/app",
      host: "journeydeck-site.example.workers.dev",
      "cf-connecting-ip": "203.0.113.8",
      "cf-ray": "ray-id",
      "cf-visitor": "{\"scheme\":\"https\"}",
      "cdn-loop": "cloudflare",
      "x-real-ip": "198.51.100.9",
      "x-forwarded-for": "198.51.100.4",
      "tailscale-user-login": "patrick@example.com",
      "x-journeydeck-test-auth": "wife",
      "content-type": "application/json"
    },
    body: "{\"ok\":true}"
  }), RENDER_ORIGIN, async (input, init) => {
    target = String(input);
    forwarded = new Headers(init?.headers);
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "manual");
    assert.equal(await new Response(init?.body).text(), "{\"ok\":true}");
    const headers = new Headers({ "content-type": "application/json", etag: "W/\"up\"", location: "/login", "content-security-policy": "default-src 'self'" });
    headers.append("set-cookie", "DriveOSSession=one; Path=/");
    headers.append("set-cookie", "other=two; Path=/");
    return new Response("{\"error\":\"Authentication required.\"}", { status: 401, headers });
  });
  assert.equal(target, "https://driveos.onrender.com/api/auth/session?device=1");
  assert.ok(forwarded);
  assert.equal(forwarded.get("tailscale-user-login"), null);
  assert.equal(forwarded.get("x-journeydeck-test-auth"), null);
  assert.equal(forwarded.get("cf-connecting-ip"), null);
  assert.equal(forwarded.get("cf-ray"), null);
  assert.equal(forwarded.get("cf-visitor"), null);
  assert.equal(forwarded.get("cdn-loop"), null);
  assert.equal(forwarded.get("x-real-ip"), null);
  assert.equal(forwarded.get("cookie"), "DriveOSSession=abc");
  assert.equal(forwarded.get("authorization"), "Bearer recorder");
  assert.equal(forwarded.get("x-driveos-sync-token"), "sync-token");
  assert.equal(forwarded.get("if-none-match"), "W/\"etag\"");
  assert.equal(forwarded.get("origin"), "https://journeydeck.me");
  assert.equal(forwarded.get("referer"), "https://journeydeck.me/app");
  assert.equal(forwarded.get("x-forwarded-proto"), "https");
  assert.equal(forwarded.get("x-forwarded-host"), "journeydeck-site.example.workers.dev");
  assert.equal(forwarded.get("x-forwarded-for"), "198.51.100.4, 203.0.113.8");
  assert.equal(response.status, 401);
  assert.deepEqual(response.headers.getSetCookie(), ["DriveOSSession=one; Path=/", "other=two; Path=/"]);
  assert.equal(response.headers.get("location"), "/login");
  assert.equal(response.headers.get("etag"), "W/\"up\"");
  let policies = 0;
  response.headers.forEach((_value, name) => { if (name === "content-security-policy") policies += 1; });
  assert.equal(policies, 1);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'self'");
});

test("forwarding appends the inbound address and drops Cloudflare request headers", async () => {
  async function capture(url: string, headers: Record<string, string>, method = "GET") {
    let sent: Headers | undefined;
    const response = await proxyToRender(new Request(url, { method, headers, body: method === "GET" ? undefined : "{}" }), RENDER_ORIGIN, async (_input, init) => {
      sent = new Headers(init?.headers);
      return new Response("ok", { status: 200 });
    });
    assert.equal(response.status, 200);
    assert.ok(sent);
    return sent;
  }

  const login = await capture("https://journeydeck-site.example.workers.dev/login", {
    host: "journeydeck-site.example.workers.dev",
    "cf-connecting-ip": "203.0.113.8",
    "cf-ray": "ray-id",
    "cdn-loop": "cloudflare",
    "x-real-ip": "198.51.100.9",
    "x-forwarded-for": "192.0.2.1, 198.51.100.4"
  });
  assert.equal(login.get("host"), "driveos.onrender.com");
  assert.equal(login.get("x-forwarded-proto"), "https");
  assert.equal(login.get("x-forwarded-host"), "journeydeck-site.example.workers.dev");
  // The append records the visitor. Cross-zone Cloudflare still rewrites
  // CF-Connecting-IP to the Worker egress, and #302's one-hop rule selects
  // that address. These headers must not be forwarded for the visitor to set.
  assert.equal(login.get("cf-connecting-ip"), null);
  assert.equal(login.get("cf-ray"), null);
  assert.equal(login.get("cdn-loop"), null);
  assert.equal(login.get("x-real-ip"), null);
  assert.equal(login.get("x-forwarded-for"), "192.0.2.1, 198.51.100.4, 203.0.113.8");

  const apiLogin = await capture("https://journeydeck.me/api/auth/login", {
    host: "journeydeck.me",
    "cf-connecting-ip": "203.0.113.8"
  }, "POST");
  assert.equal(apiLogin.get("x-forwarded-for"), "203.0.113.8");
  assert.equal(apiLogin.get("x-forwarded-proto"), "https");
  assert.equal(apiLogin.get("x-forwarded-host"), "journeydeck.me");
  assert.equal(apiLogin.get("host"), "driveos.onrender.com");

  const local = await capture("http://127.0.0.1:8787/readyz", { host: "127.0.0.1:8787" });
  assert.equal(local.get("x-forwarded-proto"), "http");
  assert.equal(local.get("x-forwarded-host"), "127.0.0.1:8787");
  assert.equal(local.get("x-forwarded-for"), null);
  assert.equal(local.get("cf-connecting-ip"), null);
  assert.equal(local.get("host"), "driveos.onrender.com");
});

test("proxy never calls journeydeck.me", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => { called = true; return new Response("no"); };
  for (const origin of ["https://journeydeck.me", "https://www.journeydeck.me", "https://studio.journeydeck.me", "http://driveos.onrender.com", "https://example.com"]) {
    const response = await proxyToRender(new Request("https://worker.example/readyz"), origin, fetchImpl);
    assert.equal(response.status, 502, origin);
    assert.equal(called, false, origin);
  }
  const local = await proxyToRender(new Request("https://worker.example/readyz"), "http://127.0.0.1:9", async input => {
    called = true;
    assert.equal(String(input), "http://127.0.0.1:9/readyz");
    return new Response("ok", { status: 200 });
  });
  assert.equal(local.status, 200);
  assert.equal(called, true);
});
