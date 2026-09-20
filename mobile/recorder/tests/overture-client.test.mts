import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as model from '../src/overture-place-model.ts';
import { parsePrivatePlace, privatePlaceValue } from '../src/private-place-record.ts';

const code = ts.transpileModule(readFileSync(new URL('../src/overture-places.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tile = model.overtureTileKey(32.8, -97.3)!;
const payload = () => ({ schema: 1, release: '2026-08-19.0', tile, places: [['gers-1', 'Example', -97.3, 32.8, 'shop', .9]] });

function setup() {
  const files = new Map<string, { text: string; time: number }>();
  const state = { allowed: true, blocked: false, requests: 0, response: payload() as unknown, fails: false, afterRequest: () => {} };
  const modules: Record<string, unknown> = {
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { edge: { url: 'https://edge.example' } } } } },
    'expo-file-system/legacy': {
      cacheDirectory: 'cache/',
      getInfoAsync: async (path: string) => files.has(path) ? { exists: true, modificationTime: files.get(path)!.time, size: Buffer.byteLength(files.get(path)!.text) } : { exists: false },
      readAsStringAsync: async (path: string) => files.get(path)!.text,
      writeAsStringAsync: async (path: string, text: string) => { files.set(path, { text, time: Date.now()/1000 }); },
      makeDirectoryAsync: async () => {},
      readDirectoryAsync: async () => [...files.keys()].map(path => path.split('/').at(-1)),
      deleteAsync: async (path: string) => { files.delete(path); },
    },
    './network-activity': { areJourneyDeckRequestsBlocked: () => state.blocked },
    './network-request': { requestPrivacyEdgeJson: async (url: string, path: string, body: unknown, options: any) => {
      assert.equal(url, 'https://edge.example'); assert.equal(path, '/api/places/us-tile');
      assert.equal(JSON.stringify(body), JSON.stringify({ tile }), 'only a coarse tile ID leaves the device');
      assert.equal(options.maxResponseBytes, 4_000_000);
      state.requests++; state.afterRequest();
      if (state.fails) throw Error('offline');
      return state.response;
    } },
    './overture-place-model': model,
  };
  const module = { exports: {} as any };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
    if (!(id in modules)) throw Error('Unmocked module '+id);
    return modules[id];
  } });
  return { state, files, run: () => module.exports.lookupOverturePlace(32.8, -97.3, () => state.allowed) };
}

test('public cache survives client recreation and bounds geographic storage', async () => {
  const app = setup();
  for (let n=0; n<24; n++) app.files.set(`cache/overture-public-v1/1_${n}.json`, { text: '{}', time: n });
  assert.equal((await app.run())[0], 'gers-1');
  assert.equal(app.state.requests, 1); assert.equal(app.files.size, 24);
  assert.equal(app.files.has('cache/overture-public-v1/1_0.json'), false);
  const restarted = setup();
  for (const [key, value] of app.files) restarted.files.set(key, value);
  assert.equal((await restarted.run())[0], 'gers-1'); assert.equal(restarted.state.requests, 0);
});

test('expired/malformed tiles never become matches, and network failures are cooled down', async () => {
  for (const text of [JSON.stringify(payload()), '{bad']) {
    const app = setup(); app.state.fails = true;
    app.files.set(`cache/overture-public-v1/${tile}.json`, { text, time: (Date.now() - 8*86400000)/1000 });
    assert.equal(await app.run(), null); assert.equal(await app.run(), null);
    assert.equal(app.state.requests, 1);
  }
  const app = setup(); app.state.response = { ...payload(), tile: 'incorrect' };
  assert.equal(await app.run(), null); assert.equal(app.files.size, 0);
});

test('blocked requests and mid-request privacy changes do not save tiles or return a match', async () => {
  const app = setup(); app.state.blocked = true;
  assert.equal(await app.run(), null); assert.equal(app.state.requests, 0);
  app.state.blocked = false; app.state.afterRequest = () => { app.state.allowed = false; };
  assert.equal(await app.run(), null); assert.equal(app.files.size, 0);
});

test('Overture labels and identities round trip through the existing private iCloud place payload', () => {
  const place = { id: 'overture-poi-driver-gers-1', userId: 'driver', kind: 'geocoded' as const, label: 'Example', lat: 32.8, lng: -97.3,
    radiusMeters: 150, foursquareId: null, osmId: null, cachedUntil: '2026-10-05T00:00:00Z', createdAt: '2026-09-05', updatedAt: '2026-09-05' };
  const encoded = privatePlaceValue(place);
  assert.deepEqual(parsePrivatePlace(JSON.stringify(encoded)), encoded);
  assert.equal('userId' in encoded, false);
});
