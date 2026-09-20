// Read-only package smoke using the app's actual parser. Never accesses the edge.
import assert from 'node:assert/strict';
import { readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { overtureTileKey, parseOvertureTile } from '../../mobile/recorder/src/overture-place-model.ts';

const directory = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
function tilePayload(tile) {
  const band = String(Math.floor(Number(tile.split('_')[0]) / 50));
  if (!manifest.bands[band]) return { schema: 1, release: manifest.release, tile, places: [] };
  const index = JSON.parse(readFileSync(join(directory, 'bands', `${band}.json`), 'utf8'));
  if (!index[tile]) return { schema: 1, release: manifest.release, tile, places: [] };
  const [offset, length] = index[tile], bytes = Buffer.alloc(length);
  const fd = openSync(join(directory, 'bands', `${band}.bin`), 'r');
  try { assert.equal(readSync(fd, bytes, 0, length, offset), length); } finally { closeSync(fd); }
  return JSON.parse(gunzipSync(bytes));
}
const cases = JSON.parse(readFileSync(new URL('../../.cache/places-lab-six-results.json', import.meta.url), 'utf8'));
for (const item of cases) {
  const place = item.sources.overture.places[0];
  const tile = overtureTileKey(place.lat, place.lon);
  const parsed = parseOvertureTile(tilePayload(tile), tile);
  assert.ok(parsed, 'Mobile parser accepts local range payload');
  assert.ok(parsed.places.some(row => row[0] === place.id), 'Known public business is present');
}
for (const band of Object.keys(manifest.bands)) {
  const index = JSON.parse(readFileSync(join(directory, 'bands', `${band}.json`), 'utf8'));
  const tile = Object.keys(index)[0];
  if (tile) assert.ok(parseOvertureTile(tilePayload(tile), tile), `Band ${band} matches app contract`);
}
for (const tile of Object.keys(manifest.nativeFallbackTiles ?? {})) {
  assert.equal(tilePayload(tile).places.length, 0, 'Oversized tile produces the existing empty/native-fallback response');
}
console.log(`Local smoke passed: ${cases.length} known public businesses, ${Object.keys(manifest.bands).length} bands, ${Object.keys(manifest.nativeFallbackTiles ?? {}).length} fallback tiles. No network requests.`);
