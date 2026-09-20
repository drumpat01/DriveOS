import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as matching from '../src/place-matching.ts';
import { findSensitivePlace } from '../src/privacy-masker.ts';

const code = ts.transpileModule(readFileSync(new URL('../src/journey-place-enrichment.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const drive = [{ id: 'test', startedAt: '2026-09-05', route: { coordinates: [[-97.3, 32.8]] } }];

function setup() {
  const calls: string[] = [], saved: any[] = [];
  const state = { user: 'driver', recording: false, foreground: 'active', named: false, cached: false,
    country: 'US' as string | undefined, sensitive: [] as any[], overFailure: false, nativeFailure: false,
    afterCountry: () => {}, afterOverture: () => {} };
  const modules: Record<string, unknown> = {
    'expo-location': { reverseGeocodeAsync: async () => { calls.push('country'); state.afterCountry(); return [{ isoCountryCode: state.country, streetNumber: '12', street: 'Main St' }]; } },
    'react-native': { AppState: { get currentState() { return state.foreground; } } },
    '../modules/journeydeck-recorder': { lookupNearbyMapKitPointsOfInterest: async () => { calls.push('mapkit'); if (state.nativeFailure) throw Error('offline'); return [{ name: 'Apple business', distanceMeters: 20 }]; } },
    './local-archive-events': { notifyLocalArchiveChanged: () => calls.push('notify') },
    './overture-places': { lookupOverturePlace: async () => { calls.push('overture'); state.afterOverture(); return state.overFailure ? null : ['gers-1', 'Overture business']; } },
    './privacy-masker': { findSensitivePlace },
    './storage': { activeSession: () => state.recording ? {} : null },
    './local-store': { getActiveLocalUserId: () => state.user, getSensitivePlaces: () => state.sensitive,
      findNamedPlace: () => state.named ? {} : null, findCachedPlace: () => state.cached ? {} : null,
      upsertPlace: (place: unknown) => { calls.push('save'); saved.push(place); } },
    './place-matching': matching,
  };
  const module = { exports: {} as any };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
    if (!(id in modules)) throw Error('Unmocked module '+id);
    return modules[id];
  } });
  return { state, calls, saved, run: () => module.exports.enrichJourneyEndpointPlaces('driver', drive) };
}

test('US routing uses Overture first and persists its GERS identity in the private place envelope', async () => {
  const app = setup();
  assert.equal(await app.run(), 1);
  assert.deepEqual(app.calls, ['country', 'overture', 'save', 'notify']);
  assert.equal(app.saved[0].id, 'overture-poi-driver-gers-1');
  assert.equal(app.saved[0].label, 'Overture business');
  assert.equal(app.saved[0].foursquareId, null, 'GERS IDs never masquerade as Foursquare IDs');
});

test('Canada, Mexico, and unknown country stay on the native path', async () => {
  for (const country of ['CA', 'MX', 'FR', undefined]) {
    const app = setup(); app.state.country = country;
    await app.run();
    assert.deepEqual(app.calls, ['country', 'mapkit', 'save', 'notify']);
    assert.equal(app.saved[0].label, 'Apple business');
  }
});

test('uncertain/offline Overture falls through to Apple, then address if Apple POI also fails', async () => {
  for (const nativeFailure of [false, true]) {
    const app = setup(); app.state.overFailure = true; app.state.nativeFailure = nativeFailure;
    await app.run();
    assert.deepEqual(app.calls, ['country', 'overture', 'mapkit', 'save', 'notify']);
    assert.equal(app.saved[0].label, nativeFailure ? '12 Main St' : 'Apple business');
  }
});

test('user names, cached places, backgrounding, and recording suppress lookups', async () => {
  for (const key of ['named', 'cached', 'recording'] as const) {
    const app = setup(); app.state[key] = true;
    assert.equal(await app.run(), 0); assert.deepEqual(app.calls, []);
  }
  const app = setup(); app.state.foreground = 'background';
  assert.equal(await app.run(), 0); assert.deepEqual(app.calls, []);
});

test('the full 300 m Home/Work privacy fence wins outside the 250 m name radius', async () => {
  const app = setup();
  app.state.sensitive = [{ kind: 'home', label: 'Home', lat: 32.8025, lng: -97.3, radiusMeters: 100 }];
  assert.equal(await app.run(), 0); assert.deepEqual(app.calls, []);
});

test('profile changes, starting a drive, and user corrections during awaits cannot write stale results', async () => {
  for (const key of ['afterCountry', 'afterOverture'] as const) {
    for (const change of ['profile', 'recording', 'named', 'background']) {
      const app = setup();
      app.state[key] = () => {
        if (change === 'profile') app.state.user = 'other';
        if (change === 'recording') app.state.recording = true;
        if (change === 'named') app.state.named = true;
        if (change === 'background') app.state.foreground = 'background';
      };
      assert.equal(await app.run(), 0);
      assert.equal(app.saved.length, 0);
      assert.equal(app.calls.includes('mapkit'), false);
      if (key === 'afterCountry') assert.equal(app.calls.includes('overture'), false);
    }
  }
});
