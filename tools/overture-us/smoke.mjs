import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { overtureTileKey, parseOvertureTile, selectOverturePlace } from '../../mobile/recorder/src/overture-place-model.ts';

const base = process.argv[2];
if (!/^https:\/\/journeydeck-edge(?:-preview)?\.patrickbstewart\.workers\.dev$/.test(base ?? '')) throw Error('Use a JourneyDeck public edge URL');
const cases = JSON.parse(readFileSync(new URL('../../.cache/places-lab-six-results.json', import.meta.url), 'utf8'));
async function query(body) {
  const start = performance.now();
  const response = await fetch(`${base}/api/places/us-tile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  const data = await response.json();
  return { response, data, milliseconds: Math.round(performance.now() - start) };
}
for (const item of cases) {
  const place = item.sources.overture.places[0];
  const tile = overtureTileKey(place.lat, place.lon);
  const first = await query({ tile });
  assert.equal(first.response.status, 200, JSON.stringify(first.data));
  assert.equal(first.response.headers.get('cache-control'), 'no-store');
  const data = parseOvertureTile(first.data, tile);
  assert.ok(data, 'gzip decodes into the mobile contract');
  assert.ok(data.places.some(row => row[0] === place.id), 'known public business is present');
  const repeat = await query({ tile });
  assert.deepEqual(repeat.data, first.data);
  console.log(JSON.stringify({ name: item.name, places: data.places.length, firstMs: first.milliseconds, repeatMs: repeat.milliseconds,
    matchAtPublicPOIPoint: selectOverturePlace(data, place.lat, place.lon)?.[1] ?? 'ambiguous: native fallback' }));
}
assert.equal((await query({ tile: '../private' })).response.status, 400);
assert.equal((await query({ tile: '0_0', userId: 'rejected' })).response.status, 400);
assert.equal((await query({ lat: '32.812345', lng: '-97.312345' })).response.status, 400);
const empty = await query({ tile: '0_0' });
assert.equal(empty.response.status, 200);
assert.equal(empty.data.places.length, 0);
console.log('Live public directory smoke checks passed. These are POI points, not physical parking-stop acceptance tests.');
