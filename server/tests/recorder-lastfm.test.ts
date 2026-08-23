import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const recorderToken = "recorder-lastfm-test-token-0123456789";
const headers = { authorization: `Bearer ${recorderToken}` };

async function completedSession(runtime: Awaited<ReturnType<typeof createApp>>, id: string, deviceId: string, startedAtMs: number, endedAtMs: number) {
  const startedAt = new Date(startedAtMs).toISOString();
  const endedAt = new Date(endedAtMs).toISOString();
  const start = await runtime.app.inject({ method: "POST", url: "/api/recorder/sessions", headers, payload: { id, deviceId, startedAt } });
  assert.equal(start.statusCode, 201, start.body);
  const points = [
    { sequence: 0, recordedAt: new Date(startedAtMs + 10_000).toISOString(), latitude: 32.86, longitude: -97.36 },
    { sequence: 1, recordedAt: new Date(endedAtMs - 10_000).toISOString(), latitude: 32.87, longitude: -97.35 }
  ];
  const upload = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${id}/points`, headers, payload: { deviceId, points } });
  assert.equal(upload.statusCode, 200, upload.body);
  const finish = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${id}/complete`, headers, payload: { deviceId, endedAt } });
  assert.equal(finish.statusCode, 200, finish.body);
}

function recentTracksPayload(epochSeconds: number, totalPages = "1") {
  return {
    recenttracks: {
      "@attr": { totalPages },
      track: [
        {
          name: "Automatic Road Song",
          artist: { "#text": "The Scrobblers" },
          album: { "#text": "Open Highway" },
          mbid: "track-mbid",
          url: "https://www.last.fm/music/example/track",
          image: [{ size: "small", "#text": "http://unsafe.example/art.jpg" }, { size: "large", "#text": "https://safe.example/art.jpg" }],
          date: { uts: String(epochSeconds) }
        },
        {
          name: "Currently Playing",
          artist: { "#text": "Skipped Artist" },
          "@attr": { nowplaying: "true" }
        },
        {
          name: "Outside Window",
          artist: { "#text": "Skipped Artist" },
          date: { uts: String(epochSeconds - 86_400) }
        }
      ]
    }
  };
}

test("Last.fm Recorder sync is authenticated, capability-only, bounded, filtered, and idempotent", async () => {
  const fixture = fixtureDatabase();
  const now = Date.now(), startedAtMs = now - 10 * 60_000, endedAtMs = now - 30_000;
  const calls: URL[] = [];
  const mockFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url);
    assert.equal(url.origin, "https://ws.audioscrobbler.com");
    assert.equal(url.pathname, "/2.0/");
    assert.equal(url.searchParams.get("method"), "user.getRecentTracks");
    assert.equal(url.searchParams.get("api_key"), "server-only-lastfm-key");
    assert.equal(url.searchParams.get("user"), "road_listener");
    assert.equal(url.searchParams.get("limit"), "200");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return new Response(JSON.stringify(recentTracksPayload(Math.floor((startedAtMs + 4 * 60_000) / 1_000), "99")), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  const runtime = await createApp({
    databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", recorderToken,
    recorderDurableTurso: false, lastFmApiKey: "server-only-lastfm-key", tessieToken: "server-only-tessie-token", lastFmFetch: mockFetch
  });
  try {
    const unauthenticated = await runtime.app.inject({ method: "GET", url: "/api/recorder/connections/status" });
    assert.equal(unauthenticated.statusCode, 401);
    const capability = await runtime.app.inject({ method: "GET", url: "/api/recorder/connections/status", headers });
    assert.equal(capability.statusCode, 200, capability.body);
    assert.equal(capability.headers["cache-control"], "private, no-store");
    assert.deepEqual(JSON.parse(capability.body), { lastFmConfigured: true, tessieConfigured: true });
    assert.doesNotMatch(capability.body, /server-only|token|api.?key/i);

    await completedSession(runtime, "lastfm-session", "iphone-owner", startedAtMs, endedAtMs);
    const wrongDevice = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/lastfm-session/lastfm/sync", headers,
      payload: { deviceId: "different-iphone", username: "road_listener" }
    });
    assert.equal(wrongDevice.statusCode, 404, wrongDevice.body);
    assert.equal(calls.length, 0);

    const synced = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/lastfm-session/lastfm/sync", headers,
      payload: { deviceId: "iphone-owner", username: "road_listener" }
    });
    assert.equal(synced.statusCode, 200, synced.body);
    assert.deepEqual(JSON.parse(synced.body), { synced: 1, total: 1 });
    assert.equal(calls.length, 5, "pagination must stop at the strict five-page bound");
    assert.deepEqual(calls.map(url => url.searchParams.get("page")), ["1", "2", "3", "4", "5"]);
    const from = Number(calls[0].searchParams.get("from")), to = Number(calls[0].searchParams.get("to"));
    assert.equal(from, Math.floor((startedAtMs - 2 * 60_000) / 1_000));
    assert.equal(to, Math.ceil((endedAtMs + 2 * 60_000) / 1_000));

    const retried = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/lastfm-session/lastfm/sync", headers,
      payload: { deviceId: "iphone-owner", username: "road_listener" }
    });
    assert.equal(retried.statusCode, 200, retried.body);
    assert.deepEqual(JSON.parse(retried.body), { synced: 1, total: 1 });
    const rows = runtime.database.prepare("SELECT payload_json FROM listening_history WHERE id LIKE 'mobile_music_%'").all() as { payload_json: string }[];
    assert.equal(rows.length, 1);
    assert.match(rows[0].payload_json, /Automatic Road Song/);
    assert.match(rows[0].payload_json, /https:\/\/safe\.example\/art\.jpg/);
    assert.doesNotMatch(rows[0].payload_json, /Outside Window|Currently Playing|server-only-lastfm-key/);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
test("Last.fm Recorder sync stays unavailable without a server key and rejects credential-shaped input", async () => {
  const fixture = fixtureDatabase();
  let fetchCalls = 0;
  const runtime = await createApp({
    databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", recorderToken,
    recorderDurableTurso: false, lastFmApiKey: "", tessieToken: "", lastFmFetch: (async () => { fetchCalls += 1; throw new Error("must not fetch"); }) as typeof fetch
  });
  try {
    const capability = await runtime.app.inject({ method: "GET", url: "/api/recorder/connections/status", headers });
    assert.deepEqual(JSON.parse(capability.body), { lastFmConfigured: false, tessieConfigured: false });
    const unavailable = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/unknown/lastfm/sync", headers,
      payload: { deviceId: "iphone-owner", username: "road_listener" }
    });
    assert.equal(unavailable.statusCode, 503, unavailable.body);
    assert.equal(unavailable.json().error, "Last.fm sync is not configured.");

    const credentialAttempt = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/unknown/lastfm/sync", headers,
      payload: { deviceId: "iphone-owner", username: "road_listener", apiKey: "client-secret" }
    });
    assert.equal(credentialAttempt.statusCode, 400, credentialAttempt.body);
    const invalidUsername = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/unknown/lastfm/sync", headers,
      payload: { deviceId: "iphone-owner", username: "https://attacker.example/" }
    });
    assert.equal(invalidUsername.statusCode, 400, invalidUsername.body);
    assert.equal(fetchCalls, 0);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});

test("Last.fm Recorder sync redacts upstream failures and refuses oversized journey windows", async () => {
  const fixture = fixtureDatabase();
  let fetchCalls = 0;
  const mockFetch = (async () => {
    fetchCalls += 1;
    return new Response("upstream leaked api_key=server-only-lastfm-key", { status: 500 });
  }) as typeof fetch;
  const runtime = await createApp({
    databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", recorderToken,
    recorderDurableTurso: false, lastFmApiKey: "server-only-lastfm-key", tessieToken: "", lastFmFetch: mockFetch
  });
  try {
    const now = Date.now();
    await completedSession(runtime, "ordinary-session", "iphone-owner", now - 10 * 60_000, now - 30_000);
    const failed = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/ordinary-session/lastfm/sync", headers,
      payload: { deviceId: "iphone-owner", username: "road_listener" }
    });
    assert.equal(failed.statusCode, 502, failed.body);
    assert.equal(failed.json().error, "Last.fm sync is temporarily unavailable.");
    assert.doesNotMatch(failed.body, /server-only|api.?key|leaked/i);

    await completedSession(runtime, "oversized-session", "iphone-owner", now - 25 * 60 * 60_000, now - 60_000);
    const oversized = await runtime.app.inject({
      method: "POST", url: "/api/recorder/sessions/oversized-session/lastfm/sync", headers,
      payload: { deviceId: "iphone-owner", username: "road_listener" }
    });
    assert.equal(oversized.statusCode, 409, oversized.body);
    assert.equal(oversized.json().error, "The journey time window cannot be synced with Last.fm.");
    assert.equal(fetchCalls, 1, "oversized windows must be rejected before contacting Last.fm");
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
