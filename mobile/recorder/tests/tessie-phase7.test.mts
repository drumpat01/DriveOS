import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const src = fileURLToPath(new URL('../src/', import.meta.url));
function loader(mocks: Record<string, any>) {
  const cache = new Map<string, any>();
  const load = (path: string): any => {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, Date, Error, console, setTimeout, clearTimeout,
      require: (id: string) => id in mocks ? mocks[id] : load(resolve(dirname(path), `${id}.ts`)),
    });
    return exports;
  };
  return (name: string) => load(resolve(src, `${name}.ts`));
}
const deferred = () => {
  let resolve!: (value?: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
};
const at = (minute: number) => new Date(Date.UTC(2026, 8, 21, 12, minute)).toISOString();
const drive = (index: number, start = index * 30, end = start + 30) => ({
  id: index.toString(16).padStart(32, '0'), vehicleKey: 'a'.repeat(32), vehicleName: 'Fixture Tesla',
  startedAt: at(start), endedAt: at(end), startingLocation: 'Start', endingLocation: 'End', miles: 10,
  energyUsedKwh: 3, energyUsedKnown: true, startingBatteryPercent: 80, endingBatteryPercent: 70,
});
const edge = { __esModule: true, default: { expoConfig: { extra: { edge: { url: 'https://example.invalid' } } } } };

function directFixture() {
  let profile = 'a', paid = true, writes = 0, captures = 0, requests = 0;
  const secrets = new Map([['journeydeck.vehicle.tessie.token.v1', 'synthetic-test-token'], ['journeydeck.vehicle.tessie.verified-count.v1', '1']]);
  const pending = deferred(), requested = deferred();
  const cached = { driveId: drive(1).id, routePoints: [{ recordedAt: at(30) }] };
  let routeCalls = 0, beforeCredentialWrite = async () => {};
  const load = loader({
    'expo-constants': edge,
    './auth': { getCurrentUser: () => ({ id: profile }) },
    './release-features': { TESSIE_INTEGRATION_ENABLED: true },
    '../modules/journeydeck-membership': { getMembershipStatus: async () => paid },
    './membership-entitlements': { entitlementsForTestFlightMembership: (value: boolean) => ({ tessieAccess: value }) },
    './profile-secure-store': {
      loadProfileSecret: async (key: string) => secrets.get(key) ?? null,
      deleteProfileSecretForUser: async (key: string) => { secrets.delete(key); },
      saveProfileSecretForUser: async (key: string, value: string) => { await beforeCredentialWrite(); secrets.set(key, value); },
      deleteProfileSecretAndOwnedLegacy: async (key: string) => { secrets.delete(key); },
    },
    './storage': { readAppCache: () => null, writeAppCache() {}, deleteAppCache() {} },
    './tessie-local-data': {
      clearTessieLocalData() {}, readTessieLocalRoute: () => cached,
      saveTessieLocalRoute: (value: any) => { writes++; return value; },
      saveTessieLocalSnapshot: (value: any) => { writes++; return value; },
    },
    './tessie-window-sync': { fetchTessieSnapshotAdaptive: async (from: Date, to: Date, request: any) => request(from.toISOString(), to.toISOString()) },
    './tessie-capture': { captureTessieJourneys: async () => { captures++; } },
    './network-request': { requestPrivacyEdgeJson: async (_url: string, path: string) => {
      if (path.endsWith('/route')) { routeCalls++; return { driveId: drive(1).id, routePoints: [{}, {}] }; }
      requests++; requested.resolve(); return pending.promise;
    } },
  });
  return { api: load('tessie-direct'), pending, requested, secrets,
    delayCredentialWrite: () => { const entered = deferred(), release = deferred(); beforeCredentialWrite = async () => { entered.resolve(); await release.promise; }; return { entered, release }; },
    profile: (value: string) => { profile = value; }, paid: (value: boolean) => { paid = value; },
    counts: () => ({ writes, captures, requests, routeCalls }) };
}

test('concurrent foreground and explicit refresh share one Tessie import', async () => {
  const f = directFixture();
  const first = f.api.syncTessieDirect(), second = f.api.syncTessieDirect();
  assert.equal(first, second);
  await f.requested.promise;
  f.pending.resolve({ drives: [], charges: [], vehicles: [] });
  await Promise.all([first, second]);
  assert.deepEqual(f.counts(), { writes: 1, captures: 1, requests: 1, routeCalls: 0 });
});

test('disconnect waits for an in-flight Keychain write and removes the entire connection', async () => {
  const f = directFixture(), gate = f.delayCredentialWrite();
  const connection = f.api.connectTessieDirect('synthetic-new-token');
  const rejected = assert.rejects(connection, /connection or profile changed/);
  await f.requested.promise; f.pending.resolve({ valid: true, vehicleCount: 1 });
  await gate.entered.promise;
  const disconnect = f.api.disconnectTessieDirect();
  gate.release.resolve(); await rejected; await disconnect;
  assert.equal(f.secrets.size, 0);
  assert.equal(await f.api.tessieDirectStatus(), 'not_connected');
});

test('disconnect during a provider request prevents cache resurrection and journey import', async () => {
  const f = directFixture(), task = f.api.syncTessieDirect();
  const rejection = assert.rejects(task, /connection or profile changed/);
  await f.requested.promise;
  await f.api.disconnectTessieDirect();
  f.pending.resolve({ drives: [], charges: [], vehicles: [] });
  await rejection;
  assert.equal(f.counts().writes, 0);
  assert.equal(f.counts().captures, 0);
  assert.equal(f.secrets.size, 0);
});

test('profile switching while history loads cannot persist the response to the new profile', async () => {
  const f = directFixture(), task = f.api.syncTessieDirect();
  const rejection = assert.rejects(task, /connection or profile changed/);
  await f.requested.promise;
  f.profile('b'); f.pending.resolve({}); await rejection;
  assert.equal(f.counts().writes, 0);
});

test('incomplete cached routes are fetched again, and credentials remain removable after membership expires', async () => {
  const f = directFixture();
  assert.equal((await f.api.loadTessieDriveRoute(drive(1))).routePoints.length, 2);
  assert.equal(f.counts().routeCalls, 1);
  f.paid(false);
  assert.equal(await f.api.tessieDirectStatus(), 'not_connected');
  assert.equal(await f.api.hasTessieCredentials(), true);
  await f.api.disconnectTessieDirect();
  assert.equal(await f.api.hasTessieCredentials(), false);
});

function captureFixture(provider = 'apple-music') {
  const entries = new Map<string, any>(), journeys = new Map<string, any>(), attempts = new Map<string, number>(), cache = new Map<string, any>();
  const requests: any[] = [], routes: string[] = [];
  let songs: any[] = [], current = true, notifications = 0, onHistory = () => {};
  const load = loader({
    'expo-constants': edge,
    './auth': { getCurrentUser: () => ({ id: 'a' }) },
    '../modules/journeydeck-music': { isJourneyDeckMusicNativeAvailable: true, getAppleMusicRecentSongs: async () => { onHistory(); return songs; } },
    './music-preferences': { loadMusicPreferences: async () => ({ provider, onboardingCompleted: true }),
      isMusicProviderAvailable: () => true, loadLastFmUsername: async () => 'fixture' },
    './local-atlas': { rebuildAtlasSnapshot() {} },
    './local-archive-events': { notifyLocalArchiveChanged: () => { notifications++; } },
    './storage': { readAppCache: (key: string) => cache.get(key), writeAppCache: (key: string, value: any) => cache.set(key, value) },
    './network-request': { requestPrivacyEdgeJson: async (_url: string, _path: string, body: any) => { requests.push(body); onHistory(); return { tracks: songs }; } },
    './local-store': {
      findTessieJourneyForDrive: (_user: string, drive: any) => journeys.get(load('tessie-journey-plan').tessieJourneyId('a', drive.id)),
      getMusicEntry: (_user: string, id: string) => entries.get(id),
      upsertMusicEntry: (entry: any) => entries.set(entry.id, entry), refreshJourneySongCount() {},
      tessieJourneyNeedsRoute: () => true, tessieRouteAttemptedAt: (_user: string, id: string) => attempts.get(id) ?? 0,
      markTessieRouteAttempt: (_user: string, id: string) => attempts.set(id, Date.now()),
      persistTessieJourney: (_user: string, plan: any, route: any) => {
        const id = load('tessie-journey-plan').tessieJourneyId('a', plan.drive.id);
        const exists = journeys.has(id); journeys.set(id, { id, provider: 'tessie' });
        return route ? 'updated' : exists ? 'unchanged' : 'created';
      },
    },
  });
  const capture = (drives: any[], routeLoader?: any) => load('tessie-capture').captureTessieJourneys({ drives, charges: [] }, routeLoader ?? (async (d: any) => { routes.push(d.id); return { routePoints: [] }; }), () => current);
  return { capture, entries, routes, requests, songs: (value: any[]) => { songs = value; }, cancel: () => { current = false; }, notifications: () => notifications,
    changeProviderDuringHistory: () => { onHistory = () => { provider = 'shazam'; }; } };
}

for (const provider of ['apple-music', 'lastfm']) test(`switching away from ${provider} during history lookup stops its import`, async () => {
  const f = captureFixture(provider);
  f.songs([{ id: 'song', lastPlayedAt: at(5), playedAt: at(5), title: 'Song', track: 'Song', artist: 'Fixture', durationSeconds: 180 }]);
  f.changeProviderDuringHistory();
  await f.capture([drive(1, 0, 30)]);
  assert.equal(f.entries.size, 0);
});

test('V3 enables Last.fm while V2 and direct Spotify remain gated', () => {
  for (const v3 of [false, true]) {
    const api = loader({
      './auth': {}, './internal-testing': { isInternalTestingBuild: () => false },
      './release-features': { V3_LASTFM_ENABLED: v3 }, './local-store': {}, './profile-secure-store': {},
    })('music-preferences');
    assert.equal(api.isMusicProviderAvailable('lastfm'), v3);
    assert.equal(api.isMusicProviderAvailable('spotify-direct'), false);
    assert.equal(api.isMusicProviderAvailable('apple-music'), true);
  }
});

for (const provider of ['apple-music', 'lastfm']) test(`${provider} history uses half-open timezone-aware drive times and stays idempotent`, async () => {
  const f = captureFixture(provider), first = drive(1, 0, 30), next = drive(2, 30, 60);
  const song = (time: string, name: string) => provider === 'apple-music'
    ? { id: name, lastPlayedAt: time, title: name, artist: 'Fixture', durationSeconds: 180 }
    : { playedAt: time, track: name, artist: 'Fixture', album: null, externalUrl: null };
  f.songs([song(at(-1), 'Before'), song(at(0), 'Start'), song(at(30), 'Boundary'), song(at(60), 'After'), song(at(10).replace('Z', ''), 'Ambiguous')]);
  await f.capture([first, next]); await f.capture([first, next]);
  assert.deepEqual([...f.entries.values()].map(row => row.track).sort(), ['Boundary', 'Start']);
  assert.equal(new Set([...f.entries.values()].map(row => row.journeyId)).size, 2);
});

test('bounded route and Last.fm retries eventually reach older drives', async () => {
  const f = captureFixture('lastfm'), drives = Array.from({ length: 12 }, (_, i) => drive(i + 1));
  await f.capture(drives); await f.capture(drives); await f.capture(drives);
  assert.equal(new Set(f.routes).size, 12);
  assert.equal(new Set(f.requests.map(row => row.from)).size, 12);
  assert.equal(f.requests.length, 24);
});

test('disconnect while a route loads stops the rest of capture, including music and notifications', async () => {
  const f = captureFixture('lastfm'), pending = deferred(), requested = deferred();
  const task = f.capture([drive(1)], async () => { requested.resolve(); return pending.promise; });
  await requested.promise; f.cancel(); pending.resolve({ routePoints: [{}, {}] }); await task;
  assert.equal(f.requests.length, 0);
  assert.equal(f.notifications(), 0);
});

test('legacy Keychain lookup never migrates a secret into a profile selected during the read', async () => {
  let profile = 'a'; const pending = deferred(), requested = deferred(), writes: any[] = [];
  const load = loader({
    './auth': { getCurrentUser: () => ({ id: profile }), isIsolationTestProfile: () => false },
    'expo-secure-store': { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
      getItemAsync: async (key: string) => {
        if (key.includes('.profile.')) return null;
        requested.resolve(); await pending.promise; return key.endsWith('legacy-owner-v1') ? null : 'synthetic-secret';
      },
      setItemAsync: async (...args: any[]) => { writes.push(args); },
    },
  });
  const task = load('profile-secure-store').loadProfileSecret('test.secret');
  await requested.promise; profile = 'b'; pending.resolve();
  assert.equal(await task, null); assert.equal(writes.length, 0);
});
