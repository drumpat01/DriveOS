import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const recorderToken = "recorder-mobile-test-token-0123456789";
const headers = { authorization: `Bearer ${recorderToken}` };

test("mobile Recorder APIs expose a narrow dashboard, paged journeys, detail, and durable provider preferences", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", recorderToken, recorderDurableTurso: false });
  try {
    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/recorder/dashboard" })).statusCode, 401);

    const defaults = await runtime.app.inject({ method: "GET", url: "/api/recorder/preferences/iphone-owner", headers });
    assert.equal(defaults.statusCode, 200, defaults.body);
    assert.deepEqual(JSON.parse(defaults.body), {
      deviceId: "iphone-owner", musicProvider: null, onboardingCompleted: false,
      connections: { appleMusic: "not_connected", shazam: "not_enabled", lastFm: "not_connected", tessie: "not_connected" },
      updatedAt: null
    });

    const saved = await runtime.app.inject({
      method: "PUT", url: "/api/recorder/preferences/iphone-owner", headers,
      payload: {
        musicProvider: "shazam", onboardingCompleted: true,
        connections: { appleMusic: "not_connected", shazam: "enabled", lastFm: "needs_attention", tessie: "connected" }
      }
    });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal(JSON.parse(saved.body).musicProvider, "shazam");
    assert.ok(JSON.parse(saved.body).updatedAt);
    const reread = await runtime.app.inject({ method: "GET", url: "/api/recorder/preferences/iphone-owner", headers });
    assert.deepEqual(JSON.parse(reread.body), JSON.parse(saved.body));

    const secretAttempt = await runtime.app.inject({
      method: "PUT", url: "/api/recorder/preferences/iphone-owner", headers,
      payload: {
        musicProvider: "lastfm", onboardingCompleted: true, tessieToken: "must-never-be-stored",
        connections: { appleMusic: "not_connected", shazam: "not_enabled", lastFm: "connected", tessie: "connected" }
      }
    });
    assert.equal(secretAttempt.statusCode, 400, secretAttempt.body);
    const storedPreference = runtime.database.prepare("SELECT value_json FROM app_state WHERE key LIKE 'recorder-mobile-preferences:%' LIMIT 1").get() as { value_json: string };
    assert.doesNotMatch(storedPreference.value_json, /token|secret/i);

    const now = Date.now(), sessionId = "mobile-shell-session", deviceId = "iphone-owner";
    const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
    const start = await runtime.app.inject({ method: "POST", url: "/api/recorder/sessions", headers, payload: { id: sessionId, deviceId, startedAt: iso(-600_000) } });
    assert.equal(start.statusCode, 201, start.body);
    const points = [
      { sequence: 0, recordedAt: iso(-590_000), latitude: 32.8601, longitude: -97.3601, speedMps: 8 },
      { sequence: 1, recordedAt: iso(-300_000), latitude: 32.8701, longitude: -97.3501, speedMps: 10 },
      { sequence: 2, recordedAt: iso(-10_000), latitude: 32.8801, longitude: -97.3401, speedMps: 9 }
    ];
    const upload = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/points`, headers, payload: { deviceId, points } });
    assert.equal(upload.statusCode, 200, upload.body);

    const observation = {
      observationId: "shazam-match-1", source: "shazam", playedAt: iso(-280_000),
      track: "Night Drive", artist: "The Test Pilots", album: "Open Roads", durationMs: 195000,
      artworkUrl: "https://example.com/artwork.jpg", externalUrl: "https://example.com/track", confidence: 0.96
    };
    const observed = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/music`, headers, payload: { deviceId, observations: [observation] } });
    assert.equal(observed.statusCode, 200, observed.body);
    assert.deepEqual(JSON.parse(observed.body), { accepted: 1, total: 1, updatedAt: JSON.parse(observed.body).updatedAt });
    const retried = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/music`, headers, payload: { deviceId, observations: [observation] } });
    assert.equal(retried.statusCode, 200, retried.body);
    assert.equal(JSON.parse(retried.body).total, 1);
    assert.equal((runtime.database.prepare("SELECT COUNT(*) AS count FROM listening_history WHERE id LIKE 'mobile_music_%'").get() as any).count, 1);

    const rawAudioAttempt = await runtime.app.inject({
      method: "POST", url: `/api/recorder/sessions/${sessionId}/music`, headers,
      payload: { deviceId, observations: [{ ...observation, observationId: "unsafe", rawAudio: "base64-audio" }] }
    });
    assert.equal(rawAudioAttempt.statusCode, 400, rawAudioAttempt.body);
    const outOfWindow = await runtime.app.inject({
      method: "POST", url: `/api/recorder/sessions/${sessionId}/music`, headers,
      payload: { deviceId, observations: [{ ...observation, observationId: "too-old", playedAt: iso(-3_600_000) }] }
    });
    assert.equal(outOfWindow.statusCode, 409, outOfWindow.body);

    const finish = await runtime.app.inject({ method: "POST", url: `/api/recorder/sessions/${sessionId}/complete`, headers, payload: { deviceId, endedAt: iso(0) } });
    assert.equal(finish.statusCode, 200, finish.body);
    const driveId = JSON.parse(finish.body).driveId, legacyDriveId = JSON.parse(finish.body).legacyDriveId;
    const soundtrackPayload = JSON.stringify({
      status: "finalized", tessieToken: "legacy-private-value",
      songs: [{ playedAt: iso(-400_000), track: "Archived Song", artist: "Fixture Artist", album: "Fixture Album", source: "spotify", spotifyUrl: "https://open.spotify.com/track/example" }]
    });
    runtime.database.prepare("INSERT INTO drive_soundtracks(drive_id,drive_started_at,drive_ended_at,status,payload_json,updated_at) VALUES(?,?,?,?,?,?)").run(legacyDriveId, iso(-600_000), iso(0), "finalized", soundtrackPayload, iso(0));
    runtime.database.prepare("INSERT INTO listening_history(id,played_at,payload_json) VALUES('malformed-history',?, 'not-json')").run(iso(-100_000));

    const dashboard = await runtime.app.inject({ method: "GET", url: "/api/recorder/dashboard?deviceId=iphone-owner", headers });
    assert.equal(dashboard.statusCode, 200, dashboard.body);
    assert.equal(dashboard.headers["cache-control"], "private, no-store");
    const dashboardBody = JSON.parse(dashboard.body);
    assert.equal(dashboardBody.latestJourney.id, driveId);
    assert.equal(dashboardBody.latestJourney.songCount, 2);
    assert.ok(dashboardBody.latestJourney.soundtrackPreview.some((song: any) => song.track === "Night Drive"));
    assert.equal(dashboardBody.providerPreferences.musicProvider, "shazam");
    assert.ok(dashboardBody.summary.last7Days.journeyCount >= 1);

    const firstPage = await runtime.app.inject({ method: "GET", url: "/api/recorder/journeys?limit=1", headers });
    assert.equal(firstPage.statusCode, 200, firstPage.body);
    const firstPageBody = JSON.parse(firstPage.body);
    assert.equal(firstPageBody.items.length, 1);
    assert.equal(firstPageBody.items[0].id, driveId);
    assert.ok(firstPageBody.nextCursor);
    const secondPage = await runtime.app.inject({ method: "GET", url: `/api/recorder/journeys?limit=1&cursor=${encodeURIComponent(firstPageBody.nextCursor)}`, headers });
    assert.equal(secondPage.statusCode, 200, secondPage.body);
    const secondDriveId = JSON.parse(secondPage.body).items[0].id;
    assert.notEqual(secondDriveId, driveId);
    const badCursor = await runtime.app.inject({ method: "GET", url: "/api/recorder/journeys?cursor=not-a-cursor", headers });
    assert.equal(badCursor.statusCode, 400, badCursor.body);

    assert.equal((await runtime.app.inject({ method: "GET", url: "/api/recorder/memories" })).statusCode, 401);
    const collectionOneResponse = await runtime.app.inject({ method: "PUT", url: "/api/recorder/collections", headers, payload: { name: "Night drives", description: "After dark", driveIds: [driveId] } });
    const collectionTwoResponse = await runtime.app.inject({ method: "PUT", url: "/api/recorder/collections", headers, payload: { name: "Weekend roads", driveIds: [secondDriveId] } });
    assert.equal(collectionOneResponse.statusCode, 200, collectionOneResponse.body);
    assert.equal(collectionTwoResponse.statusCode, 200, collectionTwoResponse.body);
    const collectionOne = JSON.parse(collectionOneResponse.body), collectionTwo = JSON.parse(collectionTwoResponse.body);
    const collectionPhotoResponse = await runtime.app.inject({
      method: "POST", url: `/api/recorder/collections/${collectionOne.id}/photos`, headers,
      payload: { fileName: "night-drive.jpg", contentType: "image/jpeg", dataBase64: "/9j/2Q==" }
    });
    assert.equal(collectionPhotoResponse.statusCode, 200, collectionPhotoResponse.body);
    const collectionPhoto = JSON.parse(collectionPhotoResponse.body);
    assert.equal(collectionPhoto.source, "collection");
    assert.equal((await runtime.app.inject({ method: "POST", url: `/api/recorder/collections/${collectionOne.id}/photos`, payload: { fileName: "private.jpg", contentType: "image/jpeg", dataBase64: "/9j/2Q==" } })).statusCode, 401);
    const memoryResponse = await runtime.app.inject({ method: "PUT", url: "/api/recorder/memories", headers, payload: { name: "Open road", notes: "A mobile memory", artworkKey: "road-trips", collectionIds: [collectionOne.id, collectionTwo.id] } });
    assert.equal(memoryResponse.statusCode, 200, memoryResponse.body);
    const memory = JSON.parse(memoryResponse.body);
    const catalogResponse = await runtime.app.inject({ method: "GET", url: "/api/recorder/memories", headers });
    assert.equal(catalogResponse.statusCode, 200, catalogResponse.body);
    assert.deepEqual(JSON.parse(catalogResponse.body).memories.find((item: any) => item.id === memory.id).collectionIds, [collectionOne.id, collectionTwo.id]);
    assert.deepEqual(JSON.parse(catalogResponse.body).collections.find((item: any) => item.id === collectionOne.id).driveIds, [driveId]);
    assert.deepEqual(JSON.parse(catalogResponse.body).collections.find((item: any) => item.id === collectionOne.id).photos.map((photo: any) => photo.id), [collectionPhoto.id]);
    assert.deepEqual(JSON.parse(catalogResponse.body).memories.find((item: any) => item.id === memory.id).photos.map((photo: any) => photo.id), [collectionPhoto.id]);
    const directPhotoResponse = await runtime.app.inject({ method: "POST", url: `/api/recorder/memories/${memory.id}/photos`, headers, payload: { fileName: "memory.jpg", contentType: "image/jpeg", dataBase64: "/9j/2Q==" } });
    assert.equal(directPhotoResponse.statusCode, 200, directPhotoResponse.body);
    const directPhoto = JSON.parse(directPhotoResponse.body);
    const selectedCover = await runtime.app.inject({ method: "PUT", url: "/api/recorder/memories", headers, payload: { id: memory.id, name: memory.name, notes: memory.notes, artworkKey: memory.artworkKey, coverPhotoId: collectionPhoto.id, collectionIds: memory.collectionIds } });
    assert.equal(selectedCover.statusCode, 200, selectedCover.body);
    assert.equal(JSON.parse(selectedCover.body).coverPhotoId, collectionPhoto.id);
    assert.deepEqual(JSON.parse(selectedCover.body).photos.map((photo: any) => photo.id), [directPhoto.id, collectionPhoto.id]);
    const loadedPhoto = await runtime.app.inject({ method: "GET", url: `/api/recorder/photos/${collectionPhoto.id}`, headers });
    assert.equal(loadedPhoto.statusCode, 200, loadedPhoto.body);
    assert.equal(JSON.parse(loadedPhoto.body).dataBase64, "/9j/2Q==");
    const removedPhoto = await runtime.app.inject({ method: "DELETE", url: `/api/recorder/photos/${collectionPhoto.id}`, headers });
    assert.equal(removedPhoto.statusCode, 200, removedPhoto.body);
    const afterRemoval = await runtime.app.inject({ method: "GET", url: "/api/recorder/memories", headers });
    const memoryAfterRemoval = JSON.parse(afterRemoval.body).memories.find((item: any) => item.id === memory.id);
    assert.equal(memoryAfterRemoval.coverPhotoId, null);
    assert.deepEqual(memoryAfterRemoval.photos.map((photo: any) => photo.id), [directPhoto.id]);
    const removedJourney = await runtime.app.inject({ method: "PUT", url: "/api/recorder/collections", headers, payload: { id: collectionOne.id, name: collectionOne.name, description: collectionOne.description, driveIds: [] } });
    assert.equal(removedJourney.statusCode, 200, removedJourney.body);
    assert.deepEqual(JSON.parse(removedJourney.body).driveIds, []);
    const oneCollectionMemory = await runtime.app.inject({ method: "PUT", url: "/api/recorder/memories", headers, payload: { id: memory.id, name: memory.name, collectionIds: [collectionOne.id] } });
    assert.equal(oneCollectionMemory.statusCode, 400, oneCollectionMemory.body);

    const detail = await runtime.app.inject({ method: "GET", url: `/api/recorder/journeys/${driveId}`, headers });
    assert.equal(detail.statusCode, 200, detail.body);
    const detailBody = JSON.parse(detail.body);
    assert.equal(detailBody.soundtrack.length, 2);
    assert.ok(detailBody.soundtrack.some((song: any) => song.source === "shazam" && song.track === "Night Drive"));
    assert.equal(detailBody.route.type, "LineString");
    assert.equal(detailBody.route.coordinates.length, 3);
    assert.doesNotMatch(detail.body, /observationId|recorderSessionId|rawAudio|must-never-be-stored|legacy-private-value/i);
    const missing = await runtime.app.inject({ method: "GET", url: "/api/recorder/journeys/does-not-exist", headers });
    assert.equal(missing.statusCode, 404);
  } finally { await runtime.app.close(); fixture.cleanup(); }
});
