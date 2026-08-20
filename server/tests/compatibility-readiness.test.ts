import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compatibilityProcessReady, compatibilityReady, waitForCompatibility } from "../src/compatibility-readiness.js";

async function listen(server: http.Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock compatibility service failed to listen.");
  return `http://127.0.0.1:${address.port}`;
}

test("compatibility probe forwards the public host and requires an HTTP success", async () => {
  let host = "", status = 503;
  const server = http.createServer((req, res) => { host = String(req.headers.host || ""); res.writeHead(status); res.end(); });
  const upstream = await listen(server);
  try {
    assert.equal(await compatibilityReady(upstream, "https://journeydeck.me", 250), false);
    status = 200;
    assert.equal(await compatibilityReady(upstream, "https://journeydeck.me", 250), true);
    assert.equal(host, "journeydeck.me");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("startup gate requires consecutive healthy compatibility probes", async () => {
  let requests = 0;
  const server = http.createServer((_req, res) => { requests++; res.writeHead(requests === 2 ? 503 : 200); res.end(); });
  const upstream = await listen(server);
  try {
    const result = await waitForCompatibility({ upstream, publicOrigin: "https://journeydeck.me", probeTimeoutMs: 100, startupTimeoutMs: 1000, intervalMs: 10, requiredConsecutiveSuccesses: 2 });
    assert.equal(result.ready, true);
    assert.equal(result.attempts, 4);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("startup gate fails closed when compatibility never becomes healthy", async () => {
  const server = http.createServer((_req, res) => { res.writeHead(503); res.end(); });
  const upstream = await listen(server);
  try {
    await assert.rejects(waitForCompatibility({ upstream, publicOrigin: "https://journeydeck.me", probeTimeoutMs: 50, startupTimeoutMs: 80, intervalMs: 10 }), /did not become ready/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("runtime readiness uses the supervisor marker and listener instead of queuing an HTTP request", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-readiness-")), marker = path.join(directory, "compatibility.ready");
  const server = net.createServer(() => {});
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock compatibility listener failed.");
  try {
    assert.equal(await compatibilityProcessReady(`http://127.0.0.1:${address.port}`, marker), false);
    fs.writeFileSync(marker, "", "utf8");
    assert.equal(await compatibilityProcessReady(`http://127.0.0.1:${address.port}`, marker), true);
    await new Promise<void>(resolve => server.close(() => resolve()));
    assert.equal(await compatibilityProcessReady(`http://127.0.0.1:${address.port}`, marker), false);
  } finally {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
