import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const render = "10.21.0.8";
const attacker = "203.0.113.50";
const owner = "198.51.100.20";

function listen(server: http.Server) {
  return new Promise<number>(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Mock upstream failed.");
      resolve(address.port);
    });
  });
}

test("the login proxy strips a spoofed client header and locks out only the derived address", async () => {
  const seen: string[] = [];
  const upstream = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      seen.push(String(req.headers["x-driveos-client-ip"] || ""));
      const body = Buffer.concat(chunks).toString("utf8");
      const status = body.includes("\"password\":\"correct\"") ? 200 : 401;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(status === 200 ? { authenticated: true } : { error: "Invalid email or password." }));
    });
  });
  const port = await listen(upstream);
  const fixture = fixtureDatabase();
  const runtime = await createApp({
    databasePath: fixture.filename,
    root,
    allowTestAuth: true,
    legacyUpstream: `http://127.0.0.1:${port}`,
    legacyReadOnly: false,
    publicOrigin: "https://journeydeck.me",
    trustProxyHops: 1
  });
  try {
    const attempt = (forwardedFor: string, password = "wrong") => runtime.app.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: render,
      headers: {
        "x-forwarded-for": forwardedFor,
        "x-driveos-client-ip": "192.0.2.9",
        "cf-connecting-ip": "198.51.100.77"
      },
      payload: { email: "owner@example.com", password }
    });

    for (let attemptNumber = 0; attemptNumber < 5; attemptNumber += 1) {
      const failed = await attempt(`192.0.2.1, ${attacker}`);
      assert.equal(failed.statusCode, 401, failed.body);
    }
    const blocked = await attempt(`192.0.2.1, ${attacker}`);
    assert.equal(blocked.statusCode, 429, blocked.body);
    assert.equal(blocked.headers["retry-after"], "30");
    assert.equal(JSON.parse(blocked.body).error, "Too many login attempts. Please wait and try again.");
    const ownerFailed = await attempt(`192.0.2.1, ${owner}`);
    assert.equal(ownerFailed.statusCode, 401, ownerFailed.body);
    const ownerSignedIn = await attempt(`192.0.2.1, ${owner}`, "correct");
    assert.equal(ownerSignedIn.statusCode, 200, ownerSignedIn.body);
    assert.deepEqual(seen, [attacker, attacker, attacker, attacker, attacker, owner, owner]);

    const direct = await runtime.app.inject({
      method: "POST",
      url: "/api/auth/passkey/verify",
      remoteAddress: owner,
      headers: { "x-driveos-client-ip": attacker, "cf-connecting-ip": attacker },
      payload: {}
    });
    assert.equal(direct.statusCode, 401, direct.body);
    assert.equal(seen.at(-1), owner);
  } finally {
    await runtime.app.close();
    if (upstream.listening) await new Promise<void>(resolve => upstream.close(() => resolve()));
    fixture.cleanup();
  }
});
