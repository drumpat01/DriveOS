import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";
import { CompatibilitySupervisor, compatibilitySupervisorCanSpawn } from "../src/compatibility-supervisor.js";

test("compatibility supervisor only spawns for loopback upstreams", () => {
  assert.equal(compatibilitySupervisorCanSpawn("http://127.0.0.1:10001"), true);
  assert.equal(compatibilitySupervisorCanSpawn("https://journeydeck.me"), false);
  assert.equal(compatibilitySupervisorCanSpawn(""), false);
});

test("ensureStarted waits for a reachable loopback process and can be stopped", async () => {
  const server = http.createServer((_req, res) => { res.writeHead(200); res.end("ok"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock compatibility listener failed.");
  let spawned = 0;
  const supervisor = new CompatibilitySupervisor({
    upstream: `http://127.0.0.1:${address.port}`,
    publicOrigin: "https://journeydeck.me",
    command: "pwsh",
    scriptPath: "DriveOS-Server.ps1",
    startupTimeoutMs: 2000,
    spawnImpl: () => {
      spawned += 1;
      return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
    }
  });
  try {
    await supervisor.ensureStarted();
    assert.equal(supervisor.started, true);
    assert.equal(spawned, 1);
    await supervisor.ensureStarted();
    assert.equal(spawned, 1);
  } finally {
    supervisor.stop();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
