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
    seen.push({ url: req.url, method: req.method, cookie: req.headers.cookie, body: Buffer.concat(chunks).toString() });
    if (req.url === "/api/auth/login") {
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "New-DriveOSWebSessionCookie=live; Path=/; HttpOnly; Secure; SameSite=Strict" });
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

  const page = await fetch(betaUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /reference-dashboard/);
  assert.equal(seen.length, 0, "frontend must be served from the beta build");

  const api = await fetch(`${betaUrl}/api/status`, { headers: { cookie: "New-DriveOSWebSessionCookie=abc" } });
  assert.deepEqual(await api.json(), { live: true });
  assert.equal(seen[0].cookie, "New-DriveOSWebSessionCookie=abc");

  const login = await fetch(`${betaUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"password":"example"}' });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /New-DriveOSWebSessionCookie=live/);
  assert.equal(seen[1].body, '{"password":"example"}');

  const health = await fetch(`${betaUrl}/healthz`);
  assert.deepEqual(await health.json(), { ok: true, mode: "live-proxy" });
});
