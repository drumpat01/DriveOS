import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { overtureTileKey, parseOvertureTile, selectOverturePlace, type OvertureTile } from '../src/overture-place-model.ts';
import { handleOverturePlaces } from '../../../cloudflare/workers/overture-places.ts';

const tile = overtureTileKey(32.8, -97.3)!;
const release = '2026-08-19.0';
const sample = (): OvertureTile => ({ schema: 1, release, tile, places: [['place-1', 'A business', -97.3, 32.8, 'restaurant', .95]] });

test('tile keys are coarse and validate poles, antimeridian, and invalid input', () => {
  assert.equal(overtureTileKey(32.8001, -97.3001), overtureTileKey(32.8002, -97.3002));
  for (const [lat, lon] of [[NaN, 0], [90, 0], [-90, 0], [0, 180], [0, Infinity]]) assert.equal(overtureTileKey(lat, lon), null);
  assert.ok(overtureTileKey(65, -150), 'Alaska is representable');
  assert.ok(overtureTileKey(21, -157), 'Hawaii is representable');
});

test('validation rejects poisoned, incompatible, or oversized public rows', () => {
  assert.ok(parseOvertureTile(sample(), tile));
  assert.equal(parseOvertureTile(sample(), 'other'), null);
  assert.equal(parseOvertureTile({ ...sample(), schema: 2 }, tile), null);
  for (const row of [['id', '', 0, 0, '', 1], ['../key', 'x', 0, 0, '', 1], ['id', 'x', 0, NaN, '', 1], ['id', 'x', 0, 0, '', .2]]) {
    assert.equal(parseOvertureTile({ ...sample(), places: [row] }, tile), null);
  }
});

test('local matching rejects distant places and ambiguous neighbors including across a cell boundary', () => {
  assert.equal(selectOverturePlace(sample(), 32.8, -97.3)?.[0], 'place-1');
  assert.equal(selectOverturePlace(sample(), 32.805, -97.3), null);
  const ambiguous = sample();
  ambiguous.places.push(['place-2', 'Different business', -97.3001, 32.8, 'shop', 1]);
  assert.equal(selectOverturePlace(ambiguous, 32.8, -97.3), null);
  const duplicate = sample();
  duplicate.places.push(duplicate.places[0]);
  assert.equal(selectOverturePlace(duplicate, 32.8, -97.3)?.[0], 'place-1');
  assert.ok(selectOverturePlace(sample(), 32.7999, -97.3), 'a halo candidate can be in the next cell');
});

test('public Worker enforces tile-only requests, readiness, sparse coverage, and ranged gzip responses', async () => {
  const previous = globalThis.caches;
  const cache = new Map<string, Response>();
  Object.assign(globalThis, { caches: { default: {
    match: async (request: Request) => cache.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => { cache.set(request.url, response); },
  } } });
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (work: Promise<unknown>) => { pending.push(work); } };
  const request = (body: unknown, method = 'POST') => new Request('https://edge.test/api/places/us-tile', { method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
  const payload = gzipSync(JSON.stringify(sample()));
  const band = String(Math.floor(Number(tile.split('_')[0]) / 50));
  const calls: string[] = [];
  const bucket = { get: async (key: string, options?: { range?: { offset: number; length: number } }) => {
    calls.push(key);
    const object = key.endsWith('manifest.json') ? { schema: 1, release, country: 'US', bands: { [band]: { bytes: payload.length + 23 } } }
      : key.endsWith('.json') ? { [tile]: [23, payload.length] } : null;
    if (object) return { size: 1000, text: async () => JSON.stringify(object) };
    assert.deepEqual(options?.range, { offset: 23, length: payload.length });
    return { body: new Response(payload).body };
  } };
  const env = { OVERTURE_ENABLED: 'true', OVERTURE_RELEASE: release, PUBLIC_PLACES: bucket } as unknown as Parameters<typeof handleOverturePlaces>[1];
  try {
    for (const body of [{ lat: '32.812345', lng: '-97.312345' }, { tile, userId: 'private' }, { tile: '../secret' }, { tile: '9000_0' }, { tile: '0_18000' }]) {
      assert.equal((await handleOverturePlaces(request(body), env, ctx)).status, 400);
    }
    assert.equal(calls.length, 0);
    assert.equal((await handleOverturePlaces(request({}, 'GET'), env, ctx)).status, 405);
    assert.equal((await handleOverturePlaces(request({ tile }), {}, ctx)).status, 503);
    const response = await handleOverturePlaces(request({ tile }), env, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await response.json(), sample());
    await Promise.all(pending);
    const afterFirst = calls.length;
    assert.equal((await handleOverturePlaces(request({ tile }), env, ctx)).status, 200);
    assert.equal(calls.length, afterFirst, 'repeat area reads use edge cache');
    const empty = await handleOverturePlaces(request({ tile: '100_100' }), env, ctx);
    assert.deepEqual((await empty.json() as { places: unknown[] }).places, []);
  } finally {
    Object.assign(globalThis, { caches: previous });
  }
});
