import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createCloudKitRequestGate } from '../modules/journeydeck-cloudkit/src/CloudKitRequestGate.ts';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const files = new Map<string, string>();
const compiled = new Map<string, string>();
function device(overrides: Record<string, any> = {}) {
  const db = new DatabaseSync(':memory:');
  let depth = 0;
  const adapter = {
    execSync: (sql: string) => db.exec(sql),
    runSync: (sql: string, ...args: any[]) => db.prepare(sql).run(...args),
    getFirstSync: (sql: string, ...args: any[]) => db.prepare(sql).get(...args) ?? null,
    getAllSync: (sql: string, ...args: any[]) => db.prepare(sql).all(...args),
    withTransactionSync: (fn: () => void) => {
      const name = `fixture_${depth++}`;
      db.exec(`SAVEPOINT ${name}`);
      try { fn(); db.exec(`RELEASE ${name}`); }
      catch (error) { db.exec(`ROLLBACK TO ${name}`); db.exec(`RELEASE ${name}`); throw error; }
      finally { depth--; }
    },
  };
  const cache = new Map<string, any>();
  function load(path: string): any {
    if (cache.has(path)) return cache.get(path).exports;
    if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    const module = { exports: {} };
    cache.set(path, module);
    const require = (name: string): any => {
      if (name in overrides) return overrides[name];
      if (name === './database-owner') return { getMasterDatabase: () => adapter };
      if (name === 'expo-crypto') return {
        randomUUID, CryptoDigestAlgorithm: { SHA256: 'sha256' },
        digestStringAsync: async (_algorithm: string, text: string) => createHash('sha256').update(text).digest('hex'),
      };
      if (name === 'expo-file-system/legacy') return {
        documentDirectory: 'file:///current-app/Documents/',
        cacheDirectory: 'fixture://cache/', EncodingType: { UTF8: 'utf8' },
        makeDirectoryAsync: async () => {},
        writeAsStringAsync: async (path: string, text: string) => files.set(path, text),
        readAsStringAsync: async (path: string) => { if (!files.has(path)) throw new Error('Missing fixture asset'); return files.get(path); },
        getInfoAsync: async (path: string) => ({ exists: files.has(path), isDirectory: false, size: files.get(path)?.length ?? 0 }),
        copyAsync: async ({ from, to }: { from: string; to: string }) => {
          if (!files.has(from)) throw new Error('Missing fixture asset');
          files.set(to, files.get(from)!);
        },
        moveAsync: async ({ from, to }: { from: string; to: string }) => {
          if (!files.has(from)) throw new Error('Missing fixture asset');
          files.set(to, files.get(from)!); files.delete(from);
        },
        deleteAsync: async (path: string) => { for (const key of [...files.keys()]) if (key === path || key.startsWith(path)) files.delete(key); },
      };
      if (name.startsWith('.')) return load(resolve(dirname(path), `${name}.ts`));
      throw new Error(`Unexpected fixture dependency: ${name}`);
    };
    new Function('require', 'module', 'exports', compiled.get(path)!)(require, module, module.exports);
    return module.exports;
  }
  const store = load(resolve(src, 'local-store.ts'));
  const user = store.ensureLocalUser({ appleSubject: 'fixture-apple-account' });
  store.setActiveLocalUserId(user.id);
  const sync = load(resolve(src, 'cloudkit-sync.ts'));
  const engine = new sync.CloudKitSyncEngine(user.id, { privateContentV2: true, privateRouteAssets: true, privateMarkers: true });
  return { db, store, user, engine, sync, load, reload: (path: string) => { cache.delete(path); return load(path); } };
}

function seed(d: ReturnType<typeof device>) {
  const home = d.store.upsertPlace({ id: `saved-place-v1-home-${d.user.id}`, userId: d.user.id,
    kind: 'home', label: 'Home', lat: 10, lng: 20, radiusMeters: 300,
    foursquareId: null, osmId: null, cachedUntil: null });
  const park = d.store.upsertPlace({ id: 'fixture-park', userId: d.user.id,
    kind: 'custom', label: 'Favorite park', lat: 11, lng: 21, radiusMeters: 150,
    foursquareId: null, osmId: 'fixture-osm', cachedUntil: null });
  d.store.upsertJourney({ id: 'fixture-journey', userId: d.user.id, legacyDriveId: null,
    startedAt: '2026-09-01T12:00:00Z', endedAt: '2026-09-01T12:30:00Z', durationMinutes: 30,
    miles: 8, startLat: 10, startLng: 20, endLat: 11, endLng: 21, startPlaceId: home.id,
    endPlaceId: park.id, averageSpeedMph: 16, maxSpeedMph: 30, songCount: 1, vehicleName: 'Car', provider: 'native' });
  d.store.insertGpsPoints(d.user.id, 'fixture-journey', [
    { sequence: 0, recordedAt: '2026-09-01T12:00:00Z', latitude: 10, longitude: 20, accuracyMeters: 5, altitudeMeters: null, headingDegrees: null, speedMps: 0 },
    { sequence: 1, recordedAt: '2026-09-01T12:30:00Z', latitude: 11, longitude: 21, accuracyMeters: 5, altitudeMeters: null, headingDegrees: null, speedMps: 2 },
  ]);
  d.store.upsertMusicEntry({ id: 'fixture-play', userId: d.user.id, journeyId: 'fixture-journey',
    source: 'apple_music', playedAt: '2026-09-01T12:05:00Z', track: 'Fixture song', artist: 'Fixture artist',
    album: 'Fixture album', durationMs: 180000, artworkUrl: 'https://example.com/cover.jpg', externalUrl: null, confidence: 1 });
  d.store.upsertMemory({ id: 'memory_v1_fixture', userId: d.user.id, name: 'Road trip', notes: 'Private notes',
    artworkKey: null, coverPhotoId: 'fixture-photo', coverPhotoLocalPath: null, journeyIds: '["fixture-journey"]' });
  files.set('fixture://photo', 'photo-bytes');
  d.store.upsertPhoto({ id: 'fixture-photo', userId: d.user.id, source: 'memory', memoryId: 'memory_v1_fixture',
    collectionId: null, fileName: 'photo.jpg', contentType: 'image/jpeg', byteLength: 11, localUri: 'fixture://photo' });
  d.store.upsertPrivatePreference(d.user.id, 'profile.appearance', { displayName: 'Test driver', avatarDataUri: null });
  d.store.upsertPrivatePreference(d.user.id, 'saved-place.v1.home', { enabled: true, latitude: 10, longitude: 20 });
  return { home, park };
}

function seedMarker(d: ReturnType<typeof device>, notes = 'A private roadside memory') {
  const id = `marker_${randomUUID()}`, photoId = randomUUID();
  const capturedAt = '2026-09-01T12:10:00Z';
  d.db.prepare(`INSERT INTO local_journey_markers(
    id,user_id,session_id,root_journey_id,captured_at,location_at,latitude,longitude,accuracy_meters,notes,
    synced_to_cloud,deleted_at,sync_revision,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,0,NULL,1,?,?)`).run(
    id, d.user.id, 'native_recording_fixture', 'fixture-journey', capturedAt, capturedAt, 10.25, 20.25, 5, notes, capturedAt, capturedAt,
  );
  const fileName = `${photoId}.jpg`;
  const path = `file:///current-app/Documents/journeydeck-marker-media/${encodeURIComponent(d.user.id)}/${fileName}`;
  files.set(path, 'marker-photo-bytes');
  d.db.prepare(`INSERT INTO local_marker_media(
    id,marker_id,kind,file_name,created_at,synced_to_cloud,deleted_at,sync_revision,updated_at
  ) VALUES(?,?,'photo',?,?,0,NULL,1,?)`).run(photoId, id, fileName, capturedAt, capturedAt);
  return { id, photoId, path };
}

test('a fresh iPad restores the full private library, canonical labels, routes, assets, and derived statistics', async () => {
  const phone = device(), ipad = device();
  const { home } = seed(phone);
  // Simulate a library already uploaded by the old build: only places need backfill.
  phone.db.prepare("DELETE FROM local_private_preferences WHERE key LIKE 'library.place.v1.%'").run();
  phone.engine.setSyncInProgress();
  const records = await phone.engine.preparePushPayload();
  const restored = await ipad.engine.ingestRemoteRecords([...records].reverse());
  assert.equal(restored.deferredCount, 0);
  const journey = ipad.store.getJourney(ipad.user.id, 'fixture-journey');
  assert.equal(journey.startPlaceId, `saved-place-v1-home-${ipad.user.id}`);
  assert.equal(ipad.store.getPlace(ipad.user.id, home.id).id, journey.startPlaceId);
  assert.equal(ipad.store.getPlace(ipad.user.id, journey.endPlaceId).label, 'Favorite park');
  assert.deepEqual([journey.startLat, journey.startLng, journey.endLat, journey.endLng], [10, 20, 11, 21]);
  assert.equal(ipad.store.getJourneyRoute(ipad.user.id, journey.id).coordinates.length, 2);
  assert.equal(ipad.store.getMemoryIncludingDeleted(ipad.user.id, 'memory_v1_fixture').notes, 'Private notes');
  assert.equal(ipad.store.getPhotoIncludingDeleted(ipad.user.id, 'fixture-photo').localUri, 'fixture://photo');
  assert.equal(ipad.store.getMusicEntry(ipad.user.id, 'fixture-play').track, 'Fixture song');
  assert.equal(ipad.store.getPrivatePreference(ipad.user.id, 'profile.appearance').displayName, 'Test driver');
  assert.equal(ipad.load(resolve(src, 'saved-places.ts')).loadSavedPlaces(ipad.user.id).home.id, journey.startPlaceId);
  const atlas = ipad.load(resolve(src, 'local-atlas.ts')).rebuildAtlasSnapshot(ipad.user.id);
  assert.equal(atlas.allTimeJourneyCount, 1);
  assert.equal(atlas.allTimeMiles, 8);
  assert.deepEqual(ipad.db.prepare('PRAGMA foreign_key_check').all(), []);
  phone.engine.acknowledgeSuccessfulPush(records.map((record: any) => record.recordName));
  assert.equal((await phone.engine.preparePushPayload()).length, 0);
  assert.equal((await ipad.engine.preparePushPayload()).length, 0, 'restoring is not a new edit');
  assert.equal((await ipad.engine.ingestRemoteRecords(records)).deferredCount, 0, 'replaying the retained cursor is safe');
  assert.equal(ipad.db.prepare('SELECT COUNT(*) AS n FROM local_places').get()?.n, 2);
});

test('Journey Markers and photos round-trip through versioned private records without leaking local profile or paths', async () => {
  const phone = device(), ipad = device(); seed(phone);
  const marker = seedMarker(phone);
  const records = await phone.engine.preparePushPayload();
  const markerRecords = records.filter((record: any) => record.recordType === 'JourneyMarker' || record.recordType === 'MarkerPhoto');
  assert.deepEqual(markerRecords.map((record: any) => record.recordType).sort(), ['JourneyMarker', 'MarkerPhoto']);
  const markerRecord = markerRecords.find((record: any) => record.recordType === 'JourneyMarker');
  const photoRecord = markerRecords.find((record: any) => record.recordType === 'MarkerPhoto');
  assert.equal(markerRecord.recordName, `journey_marker_${marker.id}`);
  assert.equal(photoRecord.recordName, `marker_photo_${marker.photoId}`);
  assert.equal(photoRecord.assetFilePath, marker.path);
  assert.equal(JSON.stringify(markerRecords.map(({ recordName, recordType, fields }: any) => ({ recordName, recordType, fields }))).includes(phone.user.id), false,
    'local profile ids never enter Marker CloudKit records');
  assert.equal(JSON.stringify(markerRecord.fields).includes('file:///'), false, 'device paths never enter record fields');

  const restored = await ipad.engine.ingestRemoteRecords([...records].reverse());
  assert.equal(restored.deferredCount, 0);
  const markerStore = ipad.load(resolve(src, 'journey-marker-store.ts'));
  const saved = markerStore.getMarkerIncludingDeleted(ipad.user.id, marker.id);
  assert.equal(saved.notes, 'A private roadside memory');
  assert.equal(saved.rootJourneyId, 'fixture-journey');
  const photo = markerStore.getMarkerPhotoIncludingDeleted(ipad.user.id, marker.photoId);
  assert.equal(photo.deletedAt, null);
  const restoredPath = markerStore.markerMediaUri(ipad.user.id, photo);
  assert.equal(files.get(restoredPath), 'marker-photo-bytes');
  assert.notEqual(restoredPath, marker.path, 'downloaded assets are copied into the receiving profile storage');

  phone.engine.acknowledgeSuccessfulPush(markerRecords.map((record: any) => record.recordName));
  assert.equal(phone.db.prepare('SELECT synced_to_cloud FROM local_journey_markers WHERE id=?').get(marker.id)?.synced_to_cloud, 1);
  assert.equal(phone.db.prepare('SELECT synced_to_cloud FROM local_marker_media WHERE id=?').get(marker.photoId)?.synced_to_cloud, 1);
  assert.equal((await ipad.engine.preparePushPayload()).filter((record: any) => ['JourneyMarker', 'MarkerPhoto'].includes(record.recordType)).length, 0,
    'restored Marker content is acknowledged locally');
});

test('Marker acknowledgements are revision-safe and stale records cannot resurrect a removed photo', async () => {
  const phone = device(), ipad = device(); seed(phone);
  const marker = seedMarker(phone);
  const original = (await phone.engine.preparePushPayload()).filter((record: any) => ['JourneyMarker', 'MarkerPhoto'].includes(record.recordType));
  await ipad.engine.ingestRemoteRecords([...(await phone.engine.preparePushPayload())]);

  phone.db.prepare(`UPDATE local_journey_markers SET notes='Edited while uploading',sync_revision=2,
    synced_to_cloud=0,updated_at='2026-09-01T12:11:00Z' WHERE id=?`).run(marker.id);
  phone.engine.acknowledgeSuccessfulPush(original.map((record: any) => record.recordName));
  assert.equal(phone.db.prepare('SELECT synced_to_cloud FROM local_journey_markers WHERE id=?').get(marker.id)?.synced_to_cloud, 0,
    'an acknowledgement for revision 1 cannot acknowledge revision 2');

  const ipadMarkers = ipad.load(resolve(src, 'journey-marker-store.ts'));
  ipadMarkers.saveMarkerNotes(ipad.user.id, marker.id, 'Edited on iPad');
  const photo = ipadMarkers.listMarkerMedia(ipad.user.id, marker.id)[0];
  await ipadMarkers.removeMarkerMedia(ipad.user.id, marker.id, photo);
  const edits = (await ipad.engine.preparePushPayload()).filter((record: any) => ['JourneyMarker', 'MarkerPhoto'].includes(record.recordType));
  await phone.engine.ingestRemoteRecords(edits);
  assert.equal(phone.load(resolve(src, 'journey-marker-store.ts')).getMarkerIncludingDeleted(phone.user.id, marker.id).notes, 'Edited on iPad');
  assert.ok(phone.load(resolve(src, 'journey-marker-store.ts')).getMarkerPhotoIncludingDeleted(phone.user.id, marker.photoId).deletedAt);
  assert.equal(files.has(marker.path), false, 'the winning tombstone removes the local app-owned photo');

  await phone.engine.ingestRemoteRecords(original);
  assert.ok(phone.load(resolve(src, 'journey-marker-store.ts')).getMarkerPhotoIncludingDeleted(phone.user.id, marker.photoId).deletedAt,
    'a stale live-photo replay cannot resurrect a newer tombstone');
});

test('Marker restore defers missing Journeys and rejects immutable identity collisions without overwriting local capture data', async () => {
  const phone = device(), fresh = device(); seed(phone);
  const marker = seedMarker(phone);
  const markerRecords = (await phone.engine.preparePushPayload()).filter((record: any) => ['JourneyMarker', 'MarkerPhoto'].includes(record.recordType));
  const deferred = await fresh.engine.ingestRemoteRecords(markerRecords);
  assert.equal(deferred.deferredCount, 2);
  assert.equal(fresh.load(resolve(src, 'journey-marker-store.ts')).getMarkerIncludingDeleted(fresh.user.id, marker.id), null);

  const allRecords = await phone.engine.preparePushPayload();
  await fresh.engine.ingestRemoteRecords(allRecords);
  const forged = structuredClone(markerRecords.find((record: any) => record.recordType === 'JourneyMarker'));
  forged.fields.sessionId = 'different_session';
  forged.fields.syncRevision = 2;
  forged.fields.updatedAt = '2026-09-01T12:12:00Z';
  const collision = await fresh.engine.ingestRemoteRecords([forged]);
  assert.equal(collision.deferredCount, 1);
  assert.equal(fresh.load(resolve(src, 'journey-marker-store.ts')).getMarkerIncludingDeleted(fresh.user.id, marker.id).sessionId, 'native_recording_fixture');
});

test('missing or length-mismatched Marker photo assets fail safely without blocking Marker metadata', async () => {
  const phone = device(); seed(phone);
  const marker = seedMarker(phone);
  files.delete(marker.path);
  const payload = await phone.engine.preparePushPayload();
  assert.ok(payload.some((record: any) => record.recordName === `journey_marker_${marker.id}`));
  assert.ok(!payload.some((record: any) => record.recordName === `marker_photo_${marker.photoId}`));
  assert.equal(phone.engine.getPreparationFailureCount(), 1);
  assert.ok(phone.engine.getIssueDetails().every(detail => !detail.includes(marker.photoId)), 'diagnostics do not expose Marker photo ids');
  assert.equal(phone.db.prepare('SELECT synced_to_cloud FROM local_marker_media WHERE id=?').get(marker.photoId)?.synced_to_cloud, 0);

  const source = device(), receiving = device(); seed(source); seedMarker(source);
  const records = await source.engine.preparePushPayload();
  const photo = records.find((record: any) => record.recordType === 'MarkerPhoto');
  photo.fields.byteLength += 1;
  await assert.rejects(receiving.engine.ingestRemoteRecords(records), /between 1 byte and 10 MB/);
  assert.equal(receiving.db.prepare('SELECT COUNT(*) AS n FROM local_marker_media').get()?.n, 0);
});

test('out-of-order place uploads defer dependent journeys and restore them intact on retry', async () => {
  const phone = device(), ipad = device(); seed(phone);
  const records = await phone.engine.preparePushPayload();
  const withoutPlaces = records.filter((r: any) => !String(r.fields.key).startsWith('library.place.v1.'));
  const partial = await ipad.engine.ingestRemoteRecords(withoutPlaces);
  assert.ok(partial.deferredCount >= 3);
  assert.equal(ipad.store.getJourney(ipad.user.id, 'fixture-journey'), null);
  assert.equal(ipad.store.getPrivatePreference(ipad.user.id, 'profile.appearance').displayName, 'Test driver');
  assert.equal((await ipad.engine.ingestRemoteRecords(records)).deferredCount, 0);
  assert.equal(ipad.store.getPlace(ipad.user.id, 'fixture-park').label, 'Favorite park');
});

test('an iPad place rename round-trips without losing wire identity; deletion does not resurrect on replay', async () => {
  const phone = device(), ipad = device(); seed(phone);
  const original = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(original.map((r: any) => r.recordName));
  await ipad.engine.ingestRemoteRecords(original);
  const park = ipad.store.getPlace(ipad.user.id, 'fixture-park');
  ipad.store.upsertPlace({ ...park, label: 'Renamed park' });
  const edits = await ipad.engine.preparePushPayload();
  await phone.engine.ingestRemoteRecords(edits);
  assert.equal(phone.store.getPlace(phone.user.id, park.id).label, 'Renamed park');
  await phone.engine.ingestRemoteRecords(original);
  assert.equal(phone.store.getPlace(phone.user.id, park.id).label, 'Renamed park', 'older edit cannot win');
  ipad.store.deletePlace(ipad.user.id, park.id);
  const deleted = await ipad.engine.preparePushPayload();
  await phone.engine.ingestRemoteRecords(deleted);
  assert.equal(phone.store.getPlace(phone.user.id, park.id), null);
  await phone.engine.ingestRemoteRecords(original);
  assert.equal(phone.store.getPlace(phone.user.id, park.id), null);
});

test('private place import cannot overwrite another local profile or its aliases', async () => {
  const phone = device(), ipad = device(); seed(phone);
  const other = ipad.store.ensureLocalUser({ appleSubject: 'other-fixture-account' });
  ipad.store.upsertPlace({ id: 'fixture-park', userId: other.id, kind: 'custom', label: 'Other private place',
    lat: 1, lng: 2, radiusMeters: 100, foursquareId: null, osmId: null, cachedUntil: null });
  const records = await phone.engine.preparePushPayload();
  await assert.rejects(ipad.engine.ingestRemoteRecords(records), /another profile|owned by/);
  assert.equal(ipad.store.getPlace(other.id, 'fixture-park').label, 'Other private place');
});

test('missing photos stay pending without starving later valid photos in the library', async () => {
  const phone = device(); seed(phone);
  const original = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(original.map((r: any) => r.recordName));
  for (let index = 0; index < 55; index++) {
    phone.store.upsertPhoto({ id: `missing-${index}`, userId: phone.user.id, source: 'memory', memoryId: 'memory_v1_fixture',
      collectionId: null, fileName: 'photo.jpg', contentType: 'image/jpeg', byteLength: 11, localUri: `fixture://missing-${index}` });
  }
  phone.store.upsertPhoto({ id: 'later-valid-photo', userId: phone.user.id, source: 'memory', memoryId: 'memory_v1_fixture',
    collectionId: null, fileName: 'photo.jpg', contentType: 'image/jpeg', byteLength: 11, localUri: 'fixture://photo' });
  const pending = await phone.engine.preparePushPayload(50);
  assert.ok(pending.some((r: any) => r.recordName === 'photo_later-valid-photo'));
  assert.equal(phone.engine.getPreparationFailureCount(), 55);
  const details = phone.engine.getIssueDetails();
  assert.match(details[0], /Photo \d+ in “Road trip” · Ref [a-f0-9]{8}/);
  assert.match(details[0], /saved photo file is missing/);
  assert.doesNotMatch(details.join('\n'), /fixture:\/\/|missing-0/);
  assert.equal(details.length, 6, 'large failures have five details and a remaining count');
  assert.equal(phone.store.getPhotoIncludingDeleted(phone.user.id, 'missing-0').syncedToCloud, 0);
  assert.equal(phone.store.getPhotoIncludingDeleted(phone.user.id, 'missing-0').deletedAt, null);
});

test('removing and setting Home again on iPad keeps one versioned identity and survives old tombstone replay', async () => {
  const phone = device(), ipad = device(); seed(phone);
  const original = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(original.map((r: any) => r.recordName));
  await ipad.engine.ingestRemoteRecords(original);
  const saved = ipad.load(resolve(src, 'saved-places.ts'));
  saved.removeSavedPlace(ipad.user.id, 'home');
  const removal = await ipad.engine.preparePushPayload();
  await phone.engine.ingestRemoteRecords(removal);
  ipad.engine.acknowledgeSuccessfulPush(removal.map((r: any) => r.recordName));
  saved.saveSavedPlace(ipad.user.id, 'home', 12, 22);
  const replacement = await ipad.engine.preparePushPayload();
  await phone.engine.ingestRemoteRecords(replacement);
  await phone.engine.ingestRemoteRecords(removal);
  const home = phone.load(resolve(src, 'saved-places.ts')).loadSavedPlaces(phone.user.id).home;
  assert.equal(home.lat, 12);
  assert.equal(home.lng, 22);
  assert.equal(phone.store.listPrivatePreferences(phone.user.id, true).filter((p: any) => p.key === 'library.place.v1.home').length, 1);
});

test('custom safe places remain distinct, private, removable, and sync across devices', async () => {
  const phone = device(), ipad = device();
  const saved = phone.load(resolve(src, 'saved-places.ts'));
  const gym = saved.saveCustomSavedPlace(phone.user.id, 'Neighborhood Gym', 43.5, -83.9);
  const cabin = saved.saveCustomSavedPlace(phone.user.id, 'Family Cabin', 44.1, -84.2);
  assert.notEqual(gym.id, cabin.id);
  assert.deepEqual(saved.loadCustomSavedPlaces(phone.user.id).map((place: any) => place.label), ['Family Cabin', 'Neighborhood Gym']);
  assert.deepEqual(phone.store.getSensitivePlaces(phone.user.id).map((place: any) => place.label), ['Family Cabin', 'Neighborhood Gym']);

  const upload = await phone.engine.preparePushPayload();
  await ipad.engine.ingestRemoteRecords(upload);
  const ipadSaved = ipad.load(resolve(src, 'saved-places.ts'));
  assert.deepEqual(ipadSaved.loadCustomSavedPlaces(ipad.user.id).map((place: any) => place.label), ['Family Cabin', 'Neighborhood Gym']);

  ipadSaved.removeCustomSavedPlace(ipad.user.id, gym.id);
  const removal = await ipad.engine.preparePushPayload();
  await phone.engine.ingestRemoteRecords(removal);
  assert.deepEqual(saved.loadCustomSavedPlaces(phone.user.id).map((place: any) => place.label), ['Family Cabin']);
});

test('the real sync coordinator retains the change token for incomplete dependencies, then commits on successful retry', async () => {
  const phone = device(); seed(phone);
  const records = await phone.engine.preparePushPayload();
  let pull = records.filter((r: any) => !String(r.fields.key).startsWith('library.place.v1.'));
  let commits = 0;
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: async () => ({ privateContentVersion: 3 }),
      getCloudKitAccountStatus: async () => 'available', ensureCloudKitPrivateZone: async () => {},
      pullCloudKitChanges: async () => ({ records: pull, deletedRecordNames: [] }),
      commitCloudKitChangeToken: async () => { commits++; },
      pushCloudKitRecords: async (_scope: string, records: any[]) => ({ savedRecordNames: records.map(r => r.recordName), remoteRecords: [], failedRecordNames: [] }),
    },
    './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const ipad = device(overrides);
  overrides['./auth'] = { getCurrentUser: () => ipad.user };
  const coordinator = ipad.load(resolve(src, 'icloud-sync.ts'));
  const first = await coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  assert.ok(first.failedUploads > 0);
  assert.ok(first.issueDetails.some((detail: string) => detail.includes('has not arrived yet')));
  assert.equal(commits, 0);
  pull = records;
  const second = await coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  assert.equal(second.failedUploads, 0);
  assert.deepEqual(second.issueDetails, []);
  assert.equal(commits, 1);
  assert.equal(ipad.store.getPlace(ipad.user.id, 'fixture-park').label, 'Favorite park');
  ipad.store.upsertPhoto(ipad.store.getPhotoIncludingDeleted(ipad.user.id, 'fixture-photo'));
  overrides['../modules/journeydeck-cloudkit'].pushCloudKitRecords = async () => ({
    savedRecordNames: [], remoteRecords: [], failedRecordNames: ['photo_fixture-photo'],
    failedRecords: [{ recordName: 'photo_fixture-photo', code: 'quota_exceeded', retryable: false, retryAfterSeconds: null }],
  });
  const third = await coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  assert.equal(third.failedUploads, 1);
  assert.match(third.issueDetails[0], /Photo 1 in “Road trip”[\s\S]*insufficient storage/);
});

test('upload diagnostics identify the local item and native failure without exposing raw metadata', () => {
  const phone = device(); seed(phone);
  phone.engine.recordUploadFailure('photo_fixture-photo', 'quota_exceeded');
  const detail = phone.engine.getIssueDetails()[0];
  assert.match(detail, /Photo 1 in “Road trip”/);
  assert.match(detail, /insufficient storage/);
  phone.engine.recordUploadFailure('music_fixture-play', 'file:///private/token-secret');
  assert.match(phone.engine.getIssueDetails()[1], /Song “Fixture song”/);
  assert.doesNotMatch(phone.engine.getIssueDetails().join('\n'), /file:\/\/|token-secret|fixture-photo/);
});

test('Memory Studio appends to the latest private record, queues sync, and rejects deleted or foreign records', async () => {
  const phone = device(); seed(phone);
  const initial = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(initial.map((r: any) => r.recordName));
  const userId = phone.user.id, memoryId = 'memory_v1_fixture';
  const journey = phone.store.getJourney(userId, 'fixture-journey');
  phone.store.upsertJourney({ ...journey, id: 'fixture-second' });
  const original = phone.store.getMemoryIncludingDeleted(userId, memoryId);
  phone.store.upsertMemory({ ...original, journeyIds: '["fixture-journey","older-hidden-journey"]', notes: 'Latest cloud edit' });
  const before = phone.store.getMemoryIncludingDeleted(userId, memoryId);
  // Execute the real app-data mutation against the real SQLite store and sync engine.
  const appData = readFileSync(resolve(src, 'app-data.ts'), 'utf8');
  const method = appData.slice(appData.indexOf('  async addJourneysToMemory('), appData.indexOf('  async uploadMemoryPhoto('));
  const js = ts.transpileModule(`const client = { ${method} };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const add = new Function('getCurrentUser', 'getMemoryIncludingDeleted', 'getJourney', 'isDirectJourneyMemoryId', 'upsertMemory', `${js}; return client.addJourneysToMemory;`)(
    () => phone.user, phone.store.getMemoryIncludingDeleted, phone.store.getJourney, (id: string) => id.startsWith('memory_v1_'), phone.store.upsertMemory,
  );
  await add(memoryId, ['fixture-second', 'fixture-second']);
  const after = phone.store.getMemoryIncludingDeleted(userId, memoryId);
  assert.deepEqual(JSON.parse(after.journeyIds), ['fixture-journey', 'older-hidden-journey', 'fixture-second']);
  assert.equal(after.notes, 'Latest cloud edit');
  assert.equal(after.coverPhotoId, original.coverPhotoId);
  assert.equal(after.createdAt, original.createdAt);
  assert.equal(after.syncRevision, before.syncRevision + 1);
  assert.equal(after.syncedToCloud, 0);
  assert.ok((await phone.engine.preparePushPayload()).some((r: any) => r.recordName === `memory_${memoryId}`));
  await add(memoryId, ['fixture-second']);
  assert.equal(phone.store.getMemoryIncludingDeleted(userId, memoryId).syncRevision, after.syncRevision, 'duplicate drop is idempotent');
  const other = phone.store.ensureLocalUser({ appleSubject: 'another-account' });
  phone.store.upsertJourney({ ...journey, id: 'foreign-journey', userId: other.id, startPlaceId: null, endPlaceId: null });
  await assert.rejects(() => add(memoryId, ['foreign-journey']), /no longer available/);
  await assert.rejects(() => add('missing-memory', ['fixture-second']), /no longer available/);
  phone.store.softDeleteMemory(userId, memoryId);
  await assert.rejects(() => add(memoryId, ['fixture-second']), /no longer available/);
  assert.ok(phone.store.getMemoryIncludingDeleted(userId, memoryId).deletedAt, 'drop cannot resurrect a deleted Memory');
});

test('a relocated private photo is relinked for display and upload without changing its content revision', async () => {
  const phone = device(); seed(phone);
  const initial = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(initial.map((r: any) => r.recordName));
  const id = 'local_relocation-photo';
  const relative = `journeydeck-private-photos/${encodeURIComponent(phone.user.id)}/${id}.jpg`;
  const oldUri = `file:///old-app/Documents/${relative}`, currentUri = `file:///current-app/Documents/${relative}`;
  files.set(currentUri, 'photo-bytes');
  phone.store.upsertPhoto({ id, userId: phone.user.id, source: 'memory', memoryId: 'memory_v1_fixture',
    collectionId: null, fileName: 'photo.jpg', contentType: 'image/jpeg', byteLength: 11, localUri: oldUri },
    { syncRevision: 7, syncedToCloud: 1, updatedAt: '2026-09-01T12:00:00Z' });
  const resolver = phone.load(resolve(src, 'private-photo-file.ts'));
  const before = phone.store.getPhotoIncludingDeleted(phone.user.id, id);
  assert.deepEqual(await resolver.resolvePrivatePhotoFile(before), { localUri: currentUri, status: 'available' });
  const after = phone.store.getPhotoIncludingDeleted(phone.user.id, id);
  assert.equal(after.localUri, currentUri);
  assert.equal(after.syncRevision, 7);
  assert.equal(after.syncedToCloud, 1);
  assert.equal(after.updatedAt, before.updatedAt);
  assert.equal((await phone.engine.preparePushPayload()).length, 0);
  // The same recovery happens when sync is the first caller, for an unuploaded photo.
  phone.store.upsertPhoto({ ...after, localUri: oldUri });
  const pending = await phone.engine.preparePushPayload();
  const record = pending.find((r: any) => r.recordName === `photo_${id}`);
  assert.equal(record.assetFilePath, currentUri);
  assert.doesNotMatch(JSON.stringify(record.fields), /file:\/\/|Documents/);
  assert.equal(phone.engine.getPreparationFailureCount(), 0);
});

test('photo relocation cannot select another owner/file, traverse folders, or invent a missing asset', async () => {
  const phone = device(); seed(phone);
  const resolver = phone.load(resolve(src, 'private-photo-file.ts'));
  const base = { ...phone.store.getPhotoIncludingDeleted(phone.user.id, 'fixture-photo'), id: 'local_missing' };
  for (const localUri of [
    `file:///old/Documents/journeydeck-private-photos/other-user/local_missing.jpg`,
    `file:///old/Documents/journeydeck-private-photos/${phone.user.id}/local_other.jpg`,
    `https://example.com/Documents/journeydeck-private-photos/${phone.user.id}/local_missing.jpg`,
  ]) assert.equal(resolver.currentPrivatePhotoUri({ ...base, localUri }, 'file:///current-app/Documents/'), null);
  assert.equal(resolver.currentPrivatePhotoUri({ ...base, id: '../local_missing' }, 'file:///current-app/Documents/'), null);
  const localUri = `file:///old/Documents/journeydeck-private-photos/${phone.user.id}/local_missing.jpg`;
  assert.equal((await resolver.resolvePrivatePhotoFile({ ...base, localUri })).status, 'missing');
});

test('an iCloud photo survives repeated app-container moves without a content edit or redownload', async () => {
  const phone = device(); seed(phone);
  const id = 'local_cloud-relocation';
  const scope = createHash('sha256').update(`journeydeck-profile:apple:${phone.user.appleSubject}`).digest('hex').slice(0, 48);
  const file = `photo_${id}-${'a'.repeat(64)}.heic`;
  const relative = `Library/Application%20Support/JourneyDeckPrivateAssets/JourneyDeck-${scope}/Photo/${file}`;
  const oldUri = `file:///old-app/${relative}`, currentUri = `file:///current-app/${relative}`;
  files.set(currentUri, 'cloud-photo-bytes');
  phone.store.upsertPhoto({ ...phone.store.getPhotoIncludingDeleted(phone.user.id, 'fixture-photo'), id, localUri: oldUri },
    { syncRevision: 9, syncedToCloud: 1, updatedAt: '2026-09-01T12:00:00Z' });
  const resolver = phone.load(resolve(src, 'private-photo-file.ts'));
  const before = phone.store.getPhotoIncludingDeleted(phone.user.id, id);
  assert.deepEqual(await resolver.resolvePrivatePhotoFile(before), { localUri: currentUri, status: 'available' });
  const after = phone.store.getPhotoIncludingDeleted(phone.user.id, id);
  assert.equal(after.syncRevision, before.syncRevision);
  assert.equal(after.syncedToCloud, 1);
  assert.equal(after.updatedAt, before.updatedAt);
  // The current installation can be moved again: the same identity/path rule applies.
  const nextUri = `file:///next-app/${relative}`;
  files.delete(currentUri); files.set(nextUri, 'cloud-photo-bytes');
  const next = device({ 'expo-file-system/legacy': {
    documentDirectory: 'file:///next-app/Documents/',
    getInfoAsync: async (uri: string) => ({ exists: files.has(uri), size: files.get(uri)?.length ?? 0 }),
  } });
  seed(next);
  next.store.upsertPhoto({ ...after, userId: next.user.id });
  assert.deepEqual(await next.load(resolve(src, 'private-photo-file.ts')).resolvePrivatePhotoFile(next.store.getPhotoIncludingDeleted(next.user.id, id)),
    { localUri: nextUri, status: 'available' });
});

test('cloud photo repair accepts legacy native names but rejects another profile, photo, or traversed path', async () => {
  const phone = device(); seed(phone);
  const resolver = phone.load(resolve(src, 'private-photo-file.ts'));
  const base = { ...phone.store.getPhotoIncludingDeleted(phone.user.id, 'fixture-photo'), id: 'local_safe-photo' };
  const scope = createHash('sha256').update(`journeydeck-profile:apple:${phone.user.appleSubject}`).digest('hex').slice(0, 48);
  const folder = `Library/Application%20Support/JourneyDeckPrivateAssets/JourneyDeck-${scope}/Photo/`;
  const oldUri = `file:///old-app/${folder}photo_local_safe-photo.png`;
  const currentUri = `file:///current-app/${folder}photo_local_safe-photo.png`;
  assert.equal(await resolver.currentCloudPhotoUri({ ...base, localUri: oldUri }, 'file:///current-app/Documents/'), currentUri);
  for (const localUri of [oldUri.replace(scope, 'f'.repeat(48)), oldUri.replace('photo_local_safe-photo', 'photo_local_other'),
    oldUri.replace('Photo/', 'Photo/../Photo/'), oldUri.replace('Photo/', 'Photo/%2e%2e/Photo/'),
    oldUri.replace('file:///old-app/', 'https://example.com/'), `${oldUri}?other=1`]) {
    assert.equal(await resolver.currentCloudPhotoUri({ ...base, localUri }, 'file:///current-app/Documents/'), null);
  }
  assert.equal((await resolver.resolvePrivatePhotoFile({ ...base, localUri: oldUri })).status, 'missing');
});

test('a photo removed while recovery checks the filesystem is never resurrected', async () => {
  let phone: ReturnType<typeof device>;
  const photoId = 'local_race-photo';
  const overrides = { 'expo-file-system/legacy': {
    documentDirectory: 'file:///current-app/Documents/',
    getInfoAsync: async (uri: string) => {
      if (uri.startsWith('file:///current-app/')) {
        phone.store.softDeletePhoto(phone.user.id, photoId);
        return { exists: true, size: 11, isDirectory: false };
      }
      return { exists: false };
    },
  } };
  phone = device(overrides); seed(phone);
  const oldUri = `file:///old-app/Documents/journeydeck-private-photos/${phone.user.id}/${photoId}.jpg`;
  phone.store.upsertPhoto({ ...phone.store.getPhotoIncludingDeleted(phone.user.id, 'fixture-photo'), id: photoId, localUri: oldUri });
  const photo = phone.store.getPhotoIncludingDeleted(phone.user.id, photoId);
  const resolved = await phone.load(resolve(src, 'private-photo-file.ts')).resolvePrivatePhotoFile(photo);
  assert.equal(resolved.status, 'missing');
  const after = phone.store.getPhotoIncludingDeleted(phone.user.id, photoId);
  assert.ok(after.deletedAt);
  assert.equal(after.localUri, oldUri);
});

test('upload acknowledgement cannot mark a journey or song edited in flight as backed up', async () => {
  const phone = device(); seed(phone);
  const pending = await phone.engine.preparePushPayload();
  const before = phone.store.getJourney(phone.user.id, 'fixture-journey');
  phone.store.upsertJourney({ ...before, vehicleName: 'Changed during upload' }, { updatedAt: before.updatedAt });
  const song = phone.store.getMusicEntry(phone.user.id, 'fixture-play');
  phone.store.upsertMusicEntry({ ...song, artworkUrl: 'https://example.com/new-cover.jpg' });
  phone.engine.acknowledgeSuccessfulPush(pending.map((record: any) => record.recordName));
  assert.equal(phone.store.getJourney(phone.user.id, before.id).syncedToCloud, 0,
    'even a same-timestamp local edit must remain queued');
  assert.equal(phone.store.getMusicEntry(phone.user.id, song.id).syncedToCloud, 0);
  const retry = await phone.engine.preparePushPayload();
  assert.equal(retry.find((record: any) => record.recordName === 'journey_fixture-journey').fields.vehicleName, 'Changed during upload');
  assert.equal(retry.find((record: any) => record.recordName === 'music_fixture-play').fields.artworkUrl, 'https://example.com/new-cover.jpg');
  phone.engine.acknowledgeSuccessfulPush(retry.map((record: any) => record.recordName));
  assert.equal(phone.store.getJourney(phone.user.id, before.id).syncedToCloud, 1);
  assert.equal(phone.store.getMusicEntry(phone.user.id, song.id).syncedToCloud, 1);
});

test('unsolicited or repeated acknowledgements never mark unrelated pending rows as backed up', async () => {
  const phone = device(); seed(phone);
  phone.engine.acknowledgeSuccessfulPush(['journey_fixture-journey', 'music_fixture-play']);
  assert.equal(phone.store.getJourney(phone.user.id, 'fixture-journey').syncedToCloud, 0);
  assert.equal(phone.store.getMusicEntry(phone.user.id, 'fixture-play').syncedToCloud, 0);
  const records = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(records.map((record: any) => record.recordName));
  phone.store.upsertJourney({ ...phone.store.getJourney(phone.user.id, 'fixture-journey'), vehicleName: 'Later edit' });
  phone.engine.acknowledgeSuccessfulPush(records.map((record: any) => record.recordName));
  assert.equal(phone.store.getJourney(phone.user.id, 'fixture-journey').syncedToCloud, 0);
});

test('newer artwork enrichment replaces an older cloud copy without a false sync conflict', async () => {
  const phone = device(); seed(phone);
  const records = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(records.map((record: any) => record.recordName));
  phone.store.upsertMusicEntry({ ...phone.store.getMusicEntry(phone.user.id, 'fixture-play'),
    artworkUrl: 'https://example.com/repaired-cover.jpg' });
  phone.db.prepare("UPDATE local_songs SET updated_at='2099-09-10T12:00:00.000Z' WHERE user_id=?").run(phone.user.id);
  const result = await phone.engine.ingestRemoteRecords(records.filter((record: any) => record.recordType === 'MusicEntry'));
  const after = phone.store.getMusicEntry(phone.user.id, 'fixture-play');
  assert.equal(after.artworkUrl, 'https://example.com/repaired-cover.jpg');
  assert.equal(after.syncedToCloud, 0);
  assert.equal(result.deferredCount, 0, 'a newer identity-preserving catalog repair is safe to upload');
  assert.deepEqual(phone.engine.getIssueDetails(), []);
  const retry = (await phone.engine.preparePushPayload()).find((record: any) => record.recordName === 'music_fixture-play');
  assert.equal(retry.fields.artworkUrl, 'https://example.com/repaired-cover.jpg');
  assert.equal(retry.fields.updatedAt, '2099-09-10T12:00:00.000Z');
});

test('a changed playback identity still remains quarantined even with a newer local timestamp', async () => {
  const phone = device(); seed(phone);
  const records = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(records.map((record: any) => record.recordName));
  phone.store.upsertMusicEntry({ ...phone.store.getMusicEntry(phone.user.id, 'fixture-play'), track: 'Different song' });
  phone.db.prepare("UPDATE local_songs SET updated_at='2099-09-10T12:00:00.000Z' WHERE user_id=?").run(phone.user.id);
  const result = await phone.engine.ingestRemoteRecords(records.filter((record: any) => record.recordType === 'MusicEntry'));
  assert.equal(result.deferredCount, 1);
  assert.equal(phone.store.getMusicEntry(phone.user.id, 'fixture-play').track, 'Different song');
  assert.match(phone.engine.getIssueDetails()[0], /kept safely on this device/);
});

test('same-timestamp remote journey conflicts preserve a pending local edit', async () => {
  const phone = device(); seed(phone);
  const records = await phone.engine.preparePushPayload();
  phone.engine.acknowledgeSuccessfulPush(records.map((record: any) => record.recordName));
  const journey = phone.store.getJourney(phone.user.id, 'fixture-journey');
  phone.store.upsertJourney({ ...journey, vehicleName: 'Local pending vehicle' }, { updatedAt: journey.updatedAt });
  const result = await phone.engine.ingestRemoteRecords(records.filter((record: any) => record.recordType === 'Journey'));
  assert.equal(phone.store.getJourney(phone.user.id, journey.id).vehicleName, 'Local pending vehicle');
  assert.equal(phone.store.getJourney(phone.user.id, journey.id).syncedToCloud, 0);
  assert.equal(result.deferredCount, 1);
});

test('a same-timestamp journey with a missing remote place defers without aborting unrelated records', async () => {
  const phone = device(); seed(phone);
  const records = await phone.engine.preparePushPayload();
  const journeyRecord = records.find((record: any) => record.recordType === 'Journey');
  journeyRecord.fields.startPlaceId = 'place-arriving-in-a-later-batch';
  const result = await phone.engine.ingestRemoteRecords([
    journeyRecord, ...records.filter((record: any) => record.recordType === 'MusicEntry'),
  ]);
  assert.equal(result.deferredCount, 1);
  assert.equal(result.updatedCount, 1, 'an unrelated valid song still imports');
  assert.match(phone.engine.getIssueDetails()[0], /missing|not arrived/i);
  assert.equal(phone.store.getJourney(phone.user.id, 'fixture-journey').syncedToCloud, 0);
  assert.notEqual(phone.store.getJourney(phone.user.id, 'fixture-journey').startPlaceId, journeyRecord.fields.startPlaceId);
});

test('automatic iCloud sync retries immediately after account availability recovers', async () => {
  let accountStatus = 'no_account', pulls = 0;
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: async () => ({ privateContentVersion: 3 }),
      getCloudKitAccountStatus: async () => accountStatus,
      ensureCloudKitPrivateZone: async () => {},
      pullCloudKitChanges: async () => { pulls++; return { records: [], deletedRecordNames: [] }; },
      commitCloudKitChangeToken: async () => {},
    },
    './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const phone = device(overrides);
  overrides['./auth'] = { getCurrentUser: () => phone.user };
  const coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  assert.equal((await coordinator.syncCurrentUserWithPrivateICloud()).accountStatus, 'no_account');
  accountStatus = 'available';
  assert.equal((await coordinator.syncCurrentUserWithPrivateICloud()).accountStatus, 'available');
  assert.equal(pulls, 1);
});

test('timed-out cloud deletion remains paused across coordinator restart and can be retried after native settles', async () => {
  const gate = createCloudKitRequestGate(5);
  let release!: () => void, deletes = 0;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: () => gate(async () => ({ privateContentVersion: 3 })),
      getCloudKitAccountStatus: () => gate(async () => 'available'),
      deleteCloudKitPrivateZone: () => gate(async () => { if (++deletes === 1) await blocked; }),
    }, './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const phone = device(overrides); seed(phone);
  overrides['./auth'] = { getCurrentUser: () => phone.user };
  let coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  await assert.rejects(coordinator.deletePrivateCloudDataForUser(phone.user), /timed out/);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), true);
  coordinator = phone.reload(resolve(src, 'icloud-sync.ts'));
  await assert.rejects(coordinator.syncCurrentUserWithPrivateICloud(), /paused/);
  await assert.rejects(coordinator.deletePrivateCloudDataForUser(phone.user), /recovering/);
  assert.equal(deletes, 1);
  release(); await blocked; await new Promise(resolve => setImmediate(resolve));
  await coordinator.deletePrivateCloudDataForUser(phone.user);
  assert.equal(deletes, 2);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), true, 'barrier stays until local account cleanup');
  assert.ok(phone.store.getJourney(phone.user.id, 'fixture-journey'));
});

test('hung CloudKit upload releases sync state without acknowledging its late success', async () => {
  const gate = createCloudKitRequestGate(5);
  let release!: () => void, sent: any[] = [], first = true;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: () => gate(async () => ({ privateContentVersion: 3 })),
      getCloudKitAccountStatus: () => gate(async () => 'available'),
      ensureCloudKitPrivateZone: () => gate(async () => {}),
      pullCloudKitChanges: () => gate(async () => ({ records: [], deletedRecordNames: [] })),
      commitCloudKitChangeToken: () => gate(async () => {}),
      pushCloudKitRecords: (_scope: string, records: any[]) => gate(async () => {
        sent = records; if (first) { first = false; await blocked; }
        return { savedRecordNames: records.map(r => r.recordName), remoteRecords: [], failedRecordNames: [] };
      }),
    }, './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const phone = device(overrides); seed(phone);
  overrides['./auth'] = { getCurrentUser: () => phone.user };
  const coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  await assert.rejects(coordinator.syncCurrentUserWithPrivateICloud({ force: true }), /timed out/);
  assert.ok(sent.length);
  await assert.rejects(coordinator.syncCurrentUserWithPrivateICloud({ force: true }), /recovering/);
  release(); await blocked; await new Promise(resolve => setImmediate(resolve));
  assert.equal(phone.store.getJourney(phone.user.id, 'fixture-journey').syncedToCloud, 0);
  await coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  assert.equal(phone.store.getJourney(phone.user.id, 'fixture-journey').syncedToCloud, 1);
});

test('queued requests recheck the active sync after a profile switch and do not overlap', async () => {
  let pulls = 0, releaseFirst!: () => void, notifyStarted!: () => void;
  const started = new Promise<void>(resolve => { notifyStarted = resolve; });
  const blocked = new Promise<void>(resolve => { releaseFirst = resolve; });
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: async () => ({ privateContentVersion: 3 }),
      getCloudKitAccountStatus: async () => 'available', ensureCloudKitPrivateZone: async () => {},
      pullCloudKitChanges: async () => {
        pulls++;
        if (pulls === 1) { notifyStarted(); await blocked; }
        return { records: [], deletedRecordNames: [] };
      },
      commitCloudKitChangeToken: async () => {},
    },
    './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const phone = device(overrides);
  let currentUser = phone.user;
  overrides['./auth'] = { getCurrentUser: () => currentUser };
  const coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  const first = coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  await started;
  currentUser = phone.store.ensureLocalUser({ appleSubject: 'second-account' });
  const second = coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  const third = coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  releaseFirst();
  const results = await Promise.allSettled([first, second, third]);
  assert.equal(results[0].status, 'rejected', 'the old profile does not ingest or acknowledge after switching');
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(results[2].status, 'fulfilled');
  assert.equal(pulls, 2, 'one physical sync per active profile, even when two callers waited');
});

test('cloud account deletion drains an in-flight upload and keeps sync paused across coordinator restarts', async () => {
  let releaseUpload!: () => void, notifyUpload!: () => void, deletes = 0, cloudPresent = true;
  const events: string[] = [];
  const started = new Promise<void>(resolve => { notifyUpload = resolve; });
  const blocked = new Promise<void>(resolve => { releaseUpload = resolve; });
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: async () => ({ privateContentVersion: 3 }),
      getCloudKitAccountStatus: async () => 'available', ensureCloudKitPrivateZone: async () => {},
      pullCloudKitChanges: async () => ({ records: [], deletedRecordNames: [] }),
      commitCloudKitChangeToken: async () => {},
      pushCloudKitRecords: async (_scope: string, records: any[]) => {
        notifyUpload(); await blocked;
        events.push('upload'); cloudPresent = true;
        return { savedRecordNames: records.map(r => r.recordName), remoteRecords: [], failedRecordNames: [] };
      },
      deleteCloudKitPrivateZone: async () => { events.push('delete'); deletes++; cloudPresent = false; },
    },
    './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const phone = device(overrides); seed(phone);
  overrides['./auth'] = { getCurrentUser: () => phone.user };
  const coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  const syncing = coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  const settledSync = syncing.then(() => 'finished', () => 'cancelled');
  await started;
  const deleting = coordinator.deletePrivateCloudDataForUser(phone.user);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), true);
  assert.equal(deletes, 0, 'the zone must not be deleted while native upload can recreate it');
  await assert.rejects(coordinator.syncCurrentUserWithPrivateICloud({ force: true }), /paused/);
  releaseUpload();
  await deleting;
  assert.equal(await settledSync, 'cancelled');
  assert.deepEqual(events, ['upload', 'delete']);
  assert.equal(cloudPresent, false);
  assert.equal(phone.store.getJourney(phone.user.id, 'fixture-journey').syncedToCloud, 0);
  const restartedCoordinator = phone.reload(resolve(src, 'icloud-sync.ts'));
  await assert.rejects(restartedCoordinator.syncCurrentUserWithPrivateICloud({ force: true }), /paused/,
    'failed later file cleanup cannot repopulate the deleted backup after restart');
  await restartedCoordinator.deletePrivateCloudDataForUser(phone.user);
  assert.equal(deletes, 2, 'account deletion remains explicitly retryable');
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), true);
  phone.store.deleteLocalUserData(phone.user.id);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), false);
});

test('an unavailable account leaves local data intact and removes only a new deletion pause', async () => {
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitAccountStatus: async () => 'no_account',
    },
    './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const phone = device(overrides); seed(phone);
  overrides['./auth'] = { getCurrentUser: () => phone.user };
  const coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  await assert.rejects(coordinator.deletePrivateCloudDataForUser(phone.user), /must be available/);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), false);
  assert.ok(phone.store.getJourney(phone.user.id, 'fixture-journey'));
  phone.store.setPrivateCloudDeletionPending(phone.user.id, true);
  await assert.rejects(coordinator.deletePrivateCloudDataForUser(phone.user), /must be available/);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), true,
    'a previous completed cloud deletion stays paused when retry cleanup cannot reach iCloud');
});

test('an uncertain cloud deletion response keeps backup paused across restart until deletion is retried', async () => {
  let cloudPresent = true, attempts = 0;
  const overrides: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: async () => ({ privateContentVersion: 3 }),
      getCloudKitAccountStatus: async () => 'available',
      deleteCloudKitPrivateZone: async () => {
        cloudPresent = false;
        if (++attempts === 1) throw new Error('Connection lost before deletion response');
      },
    },
  };
  const phone = device(overrides); seed(phone);
  overrides['./auth'] = { getCurrentUser: () => phone.user };
  const coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  await assert.rejects(coordinator.deletePrivateCloudDataForUser(phone.user), /Connection lost/);
  assert.equal(cloudPresent, false);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), true,
    'native rejection cannot prove the server kept the zone');
  assert.ok(phone.store.getJourney(phone.user.id, 'fixture-journey'));
  const restarted = phone.reload(resolve(src, 'icloud-sync.ts'));
  await assert.rejects(restarted.syncCurrentUserWithPrivateICloud({ force: true }), /paused/);
  await restarted.deletePrivateCloudDataForUser(phone.user);
  assert.equal(attempts, 2);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), true);
  phone.store.deleteLocalUserData(phone.user.id);
  assert.equal(phone.store.isPrivateCloudDeletionPending(phone.user.id), false);
});

test('a profile handoff during route-asset validation stops before replacing local GPS', async () => {
  const phone = device(); seed(phone);
  const route = (await phone.engine.preparePushPayload()).find((record: any) => record.recordType === 'RouteArchive');
  const before = phone.store.listJourneyGpsPoints(phone.user.id, 'fixture-journey');
  let validations = 0;
  await assert.rejects(phone.engine.ingestRemoteRecords([route], () => {
    if (++validations === 2) throw new Error('Profile changed while asset was being read');
  }), /Profile changed/);
  assert.equal(validations, 2, 'profile must be checked again after asynchronous asset validation');
  assert.deepEqual(phone.store.listJourneyGpsPoints(phone.user.id, 'fixture-journey'), before);
  assert.equal(phone.store.getRouteArchive(phone.user.id, 'fixture-journey').syncedToCloud, 0);
});

test('edits and Markers use separate private zones and account deletion removes every zone', async () => {
  const pushes: Array<{ scope: string; records: any[] }> = [], pulls: string[] = [], deleted: string[] = [];
  const overrides: Record<string, any> = {
    '../modules/journeydeck-membership': { getMembershipStatus: async () => ({ nativeModuleAvailable: true, tier: 'paid' }) },
    '../modules/journeydeck-recorder': { getNativeAutomaticRecorderStatus: async () => ({ nativeModuleAvailable: true, statusReliable: true, recording: false, paused: false, sessionId: null }) },
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitCapabilities: async () => ({ privateContentVersion: 5 }),
      getCloudKitAccountStatus: async () => 'available',
      ensureCloudKitPrivateZone: async () => {},
      pullCloudKitChanges: async (scope: string) => { pulls.push(scope); return { records: [], deletedRecordNames: [] }; },
      commitCloudKitChangeToken: async () => {},
      pushCloudKitRecords: async (scope: string, records: any[]) => { pushes.push({ scope, records }); return { savedRecordNames: records.map(r => r.recordName), remoteRecords: [], failedRecordNames: [] }; },
      deleteCloudKitPrivateZone: async (scope: string) => { deleted.push(scope); },
    },
    './network-activity': { beginNetworkActivity: () => ({ finish() {} }) },
  };
  const phone = device(overrides); seed(phone); seedMarker(phone); phone.store.setActiveLocalUserId(phone.user.id);
  overrides['./auth'] = { getCurrentUser: () => phone.user };
  const editor = phone.load(resolve(src, 'journey-editor-store.ts'));
  const snapshot = editor.loadJourneyEditor(phone.user.id, 'fixture-journey');
  await editor.commitJourneyEdit(snapshot, { kind: 'split', atMs: Date.parse('2026-09-01T12:15:00Z') });
  const coordinator = phone.load(resolve(src, 'icloud-sync.ts'));
  const base = await coordinator.privateCloudProfileScope(phone.user), edits = await coordinator.privateCloudEditorScope(phone.user);
  const markers = await coordinator.privateCloudMarkerScope(phone.user);
  assert.notEqual(base, edits); assert.notEqual(base, markers); assert.notEqual(edits, markers);
  const synced = await coordinator.syncCurrentUserWithPrivateICloud({ force: true });
  assert.equal(synced.failedUploads, 0);
  assert.deepEqual(pulls, [base, edits, markers]);
  assert.ok(pushes.some(batch => batch.scope === edits && batch.records.some(record => record.recordType === 'JourneyEdit')));
  assert.ok(pushes.some(batch => batch.scope === markers && batch.records.some(record => record.recordType === 'JourneyMarker')));
  assert.ok(pushes.every(batch => batch.records.every(record => {
    if (record.recordType === 'JourneyEdit') return batch.scope === edits;
    if (record.recordType === 'JourneyMarker' || record.recordType === 'MarkerPhoto') return batch.scope === markers;
    return batch.scope === base;
  })));
  assert.equal(editor.journeyEditsPendingSync(phone.user.id).length, 0);
  await coordinator.deletePrivateCloudDataForUser(phone.user);
  assert.deepEqual(deleted, [base, edits, markers]);
});

test('immutable edit assets round-trip out of order and physical deletion requeues the recovery copy', async () => {
  const overrides = {
    '../modules/journeydeck-membership': { getMembershipStatus: async () => ({ nativeModuleAvailable: true, tier: 'paid' }) },
    '../modules/journeydeck-recorder': { getNativeAutomaticRecorderStatus: async () => ({ nativeModuleAvailable: false }) },
  };
  const phone = device(overrides), ipad = device(); seed(phone); phone.store.setActiveLocalUserId(phone.user.id);
  const editor = phone.load(resolve(src, 'journey-editor-store.ts'));
  await editor.commitJourneyEdit(editor.loadJourneyEditor(phone.user.id, 'fixture-journey'), { kind: 'split', atMs: Date.parse('2026-09-01T12:15:00Z') });
  await editor.commitJourneyEdit(editor.loadJourneyEditor(phone.user.id, 'fixture-journey'), { kind: 'restore' });
  const engine = new phone.sync.CloudKitSyncEngine(phone.user.id, { privateContentV2: true, privateRouteAssets: true, privateJourneyEdits: true });
  const records = (await engine.preparePushPayload()).filter((record: any) => record.recordType === 'JourneyEdit');
  assert.equal(records.length, 2);
  const result = await ipad.engine.ingestRemoteRecords([...records].reverse());
  assert.equal(result.deferredCount, 0, 'in-batch ancestry orders a split before its restore');
  assert.equal(ipad.store.getJourney(ipad.user.id, 'fixture-journey').durationMinutes, 30);
  assert.equal(ipad.store.listJourneyGpsPoints(ipad.user.id, 'fixture-journey').length, 2);
  engine.acknowledgeSuccessfulPush(records.map((record: any) => record.recordName));
  assert.equal(editor.journeyEditsPendingSync(phone.user.id).length, 0);
  engine.ingestRemoteDeletions([records[0].recordName]);
  assert.equal(editor.journeyEditsPendingSync(phone.user.id).length, 1);
  const corrupt = { ...records[0], fields: { ...records[0].fields, sha256: '0'.repeat(64) } };
  await assert.rejects(ipad.engine.ingestRemoteRecords([corrupt]), /integrity/);
  assert.equal(ipad.store.getJourney(ipad.user.id, 'fixture-journey').durationMinutes, 30);
});

test('an edit committed while an ordinary route asset is preparing takes ownership before push', async () => {
  let duringDigest: (() => Promise<void>) | null = null;
  const phone = device({
    'expo-crypto': { randomUUID, CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_algorithm: string, value: string) => {
      if (duringDigest && value.startsWith('{"version":1,"journeyId"')) { const run = duringDigest; duringDigest = null; await run(); }
      return createHash('sha256').update(value).digest('hex');
    } },
    '../modules/journeydeck-membership': { getMembershipStatus: async () => ({ nativeModuleAvailable: true, tier: 'paid' }) },
    '../modules/journeydeck-recorder': { getNativeAutomaticRecorderStatus: async () => ({ nativeModuleAvailable: false }) },
  });
  seed(phone); phone.store.setActiveLocalUserId(phone.user.id);
  const editor = phone.load(resolve(src, 'journey-editor-store.ts'));
  const snapshot = editor.loadJourneyEditor(phone.user.id, 'fixture-journey');
  duringDigest = () => editor.commitJourneyEdit(snapshot, { kind: 'trim', startMs: Date.parse('2026-09-01T12:05:00Z'), endMs: Date.parse('2026-09-01T12:25:00Z') });
  const payload = await phone.engine.preparePushPayload();
  assert.ok(payload.every((record: any) => !['Journey', 'RouteArchive', 'MusicEntry'].includes(record.recordType)), 'no pre-edit summary can be mixed with a post-edit route');
  assert.equal(editor.journeyEditsPendingSync(phone.user.id).length, 1);
  assert.equal(phone.store.getJourney(phone.user.id, 'fixture-journey').durationMinutes, 20);
});
