import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createBetaLiveProxyServer } from "../tools/beta-live-proxy.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", resolve).once("error", reject));
  return `http://127.0.0.1:${server.address().port}`;
}

test("beta serves its frontend and proxies authenticated API traffic", async t => {
  const seen = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen.push({ url: req.url, method: req.method, cookie: req.headers.cookie, forwardedFor: req.headers["x-forwarded-for"], body: Buffer.concat(chunks).toString() });
    if (req.url === "/api/auth/login") {
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "DriveOSSession=live; Path=/; HttpOnly; Secure; SameSite=Strict" });
      res.end('{"ok":true}');
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ live: true }));
  });
  const upstreamUrl = await listen(upstream);
  const beta = createBetaLiveProxyServer({ upstreamUrl });
  const betaUrl = await listen(beta);
  t.after(() => { upstream.close(); beta.close(); });

  const anonymousPage = await fetch(betaUrl, { redirect: "manual" });
  assert.equal(anonymousPage.status, 302);
  assert.equal(anonymousPage.headers.get("location"), "/login");

  const page = await fetch(betaUrl, { headers: { cookie: "DriveOSSession=abc" } });
  assert.equal(page.status, 200);
  const csp = page.headers.get("content-security-policy");
  assert.match(csp, /script-src[^;]*https:\/\/unpkg\.com/);
  assert.match(csp, /style-src[^;]*https:\/\/unpkg\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/tiles\.openfreemap\.org/);
  assert.match(csp, /worker-src 'self' blob:/);
  assert.match(await page.text(), /reference-dashboard/);
  assert.equal(seen.length, 0, "frontend must be served from the beta build");

  const api = await fetch(`${betaUrl}/api/status`, { headers: { cookie: "DriveOSSession=abc", "x-forwarded-for": "203.0.113.8" } });
  assert.deepEqual(await api.json(), { live: true });
  assert.equal(seen[0].cookie, "DriveOSSession=abc");
  assert.equal(seen[0].forwardedFor, "203.0.113.8");

  const login = await fetch(`${betaUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"password":"example"}' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /DriveOSSession=live/);
  assert.equal(seen[1].body, '{"password":"example"}');

  const health = await fetch(`${betaUrl}/healthz`);
  assert.deepEqual(await health.json(), { ok: true, mode: "live-proxy" });
});
