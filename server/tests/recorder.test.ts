import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const recorderToken = "recorder-test-token-0123456789-abcdef";
const recorderHeaders = { authorization: `Bearer ${recorderToken}` };
const ownerHeaders = { "x-journeydeck-test-auth": "owner", origin: "http://127.0.0.1" };

test("Recorder authenticates, retries point uploads safely, completes a journey, and serves its route", async () => {
  const fixture = fixtureDatabase();
  const options = { databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", publicOrigin: "http://127.0.0.1", recorderToken, recorderDurableTurso: false };
  let runtime = await createApp(options);
  try {
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/recorder/status" })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/recorder/status", headers: { authorization: "Bearer wrong-token" } })).statusCode, 401);
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/recorder/status", headers: recorderHeaders })).statusCode, 200);

    const sessionId = "session-test-001", deviceId = "iphone-owner", startedAt = "2026-08-21T12:00:00.000Z";
    const start = await runtime.app.inject({ method: "POST", url: "/api/recorder/sessions", headers: recorderHeaders, payload: { id: sessionId, deviceId, startedAt } });
    assert.equal(start.statusCode, 201, start.body);
    assert.equal(JSON.parse(start.body).status, "recording");

    const points = [
      { sequence: 0, recordedAt: "2026-08-21T12:00:05.000Z", latitude: 32.8601, longitude: -97.3601, accuracyMeters: 5, speedMps: 10 },
      { sequence: 1, recordedAt: "2026-08-21T12:00:35.000Z", latitude: 32.8631, longitude: -97.3571, accuracyMeters: 6, speedMps: 12 },
      { sequence: 2, recordedAt: "2026-08-21T12:01:05.000Z", latitude: 32.8661, longitude: -97.3541, accuracyMeters: 5, speedMps: 11 }
    ];
    const upload = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/points`, headers: recorderHeaders, payload: { deviceId, points } });
    assert.equal(upload.statusCode, 200, upload.body);
    assert.equal(JSON.parse(upload.body).pointCount, 3);
    const retry = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/points`, headers: recorderHeaders, payload: { deviceId, points } });
    assert.equal(retry.statusCode, 200, retry.body);
    assert.equal(JSON.parse(retry.body).pointCount, 3);

    const paused = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/state`, headers: recorderHeaders, payload: { deviceId, status: "paused" } });
    assert.equal(paused.statusCode, 200, paused.body);
    assert.equal(JSON.parse(paused.body).status, "paused");

    const finish = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/complete`, headers: recorderHeaders, payload: { deviceId, endedAt: "2026-08-21T12:01:10.000Z" } });
    assert.equal(finish.statusCode, 200, finish.body);
    const completed = JSON.parse(finish.body);
    assert.equal(completed.status, "completed");
    assert.equal(completed.pointCount, 3);
    assert.ok(completed.distanceMiles > 0);
    assert.equal(completed.legacyDriveId, "1787313600-1787313670");

    const drive = runtime.database.prepare("SELECT provider,legacy_drive_id,distance_miles,starting_battery,energy_used_kwh FROM drives WHERE id=?").get(completed.driveId) as any;
    assert.equal(drive.provider, "journeydeck_recorder");
    assert.equal(drive.legacy_drive_id, completed.legacyDriveId);
    assert.ok(Number(drive.distance_miles) > 0);
    assert.equal(drive.starting_battery, null);
    assert.equal(drive.energy_used_kwh, null);

    const map = await runtime.app.inject({ method: "POST", url: "/api/drive/map", headers: ownerHeaders, payload: { driveId: completed.legacyDriveId } });
    assert.equal(map.statusCode, 200, map.body);
    const mapBody = JSON.parse(map.body);
    assert.equal(mapBody.routePoints.length, 3);
    assert.equal(mapBody.songMarkers.length, 0);
    assert.match(mapBody.provider, /JourneyDeck Recorder/);

    const wrongDevice = await runtime.app.inject({ method: "GET", url: `/api/recorder/sessions/${sessionId}?deviceId=somebody-else`, headers: recorderHeaders });
    assert.equal(wrongDevice.statusCode, 404);
    await runtime.app.close();
    runtime = await createApp(options);
    const durable = await runtime.app.inject({ method: "GET", url: `/api/recorder/sessions/${sessionId}?deviceId=${deviceId}`, headers: recorderHeaders });
    assert.equal(durable.statusCode, 200, durable.body);
    assert.equal(JSON.parse(durable.body).status, "completed");
  } finally {
    await runtime.app.close().catch(() => {});
    fixture.cleanup();
  }
});

test("Recorder rejects malformed timestamps, oversized batches, and premature completion", async () => {
  const fixture = fixtureDatabase(), runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", recorderToken, recorderDurableTurso: false });
  try {
    const invalid = await runtime.app.inject({ method: "POST", url: "/api/recorder/sessions", headers: recorderHeaders, payload: { id: "bad-time", deviceId: "iphone-owner", startedAt: "not-a-date" } });
    assert.equal(invalid.statusCode, 400);
    const start = await runtime.app.inject({ method: "POST", url: "/api/recorder/sessions", headers: recorderHeaders, payload: { id: "short-session", deviceId: "iphone-owner", startedAt: "2026-08-21T12:00:00.000Z" } });
    assert.equal(start.statusCode, 201, start.body);
    const incomplete = await runtime.app.inject({ method: "POST", url: "/api/recorder/sessions/short-session/complete", headers: recorderHeaders, payload: { deviceId: "iphone-owner", endedAt: "2026-08-21T12:01:00.000Z" } });
    assert.equal(incomplete.statusCode, 409);
    const oversized = Array.from({ length: 251 }, (_, sequence) => ({ sequence, recordedAt: "2026-08-21T12:00:05.000Z", latitude: 32.86, longitude: -97.36 }));
    const batch = await runtime.app.inject({ method: "POST", url: "/api/recorder/sessions/short-session/points", headers: recorderHeaders, payload: { deviceId: "iphone-owner", points: oversized } });
    assert.equal(batch.statusCode, 400);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});
