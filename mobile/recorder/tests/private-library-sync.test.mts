import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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
        getInfoAsync: async (path: string) => ({ exists: files.has(path), size: files.get(path)?.length ?? 0 }),
      };
      if (name.startsWith('.')) return load(resolve(dirname(path), `${name}.ts`));
      throw new Error(`Unexpected fixture dependency: ${name}`);
    };
    new Function('require', 'module', 'exports', compiled.get(path)!)(require, module, module.exports);
    return module.exports;
  }
  const store = load(resolve(src, 'local-store.ts'));
  const user = store.ensureLocalUser({ appleSubject: 'fixture-apple-account' });
  const sync = load(resolve(src, 'cloudkit-sync.ts'));
  const engine = new sync.CloudKitSyncEngine(user.id, { privateContentV2: true, privateRouteAssets: true });
  return { db, store, user, engine, sync, load };
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
