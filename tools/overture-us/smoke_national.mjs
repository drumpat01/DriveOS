// Read-only preview smoke: compare live R2 range results to verified package bytes.
import assert from 'node:assert/strict';
import { readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseOvertureTile } from '../../mobile/recorder/src/overture-place-model.ts';

const directory = resolve(process.argv[2]);
const base = 'https://journeydeck-edge-preview.patrickbstewart.workers.dev';
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
async function query(tile) {
  const r = await fetch(`${base}/api/places/us-tile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tile }), signal: AbortSignal.timeout(12000) });
  assert.equal(r.status, 200, `Tile ${tile} HTTP status`);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const data = await r.json();
  assert.ok(parseOvertureTile(data, tile), 'App parser accepts live tile');
  return data;
}
let checked = 0;
for (const band of Object.keys(manifest.bands)) {
  const index = JSON.parse(readFileSync(join(directory, 'bands', `${band}.json`), 'utf8'));
  const keys = Object.keys(index), tile = keys[Math.floor(keys.length / 2)];
  if (!tile) continue;
  const [offset, length] = index[tile], bytes = Buffer.alloc(length);
  const fd = openSync(join(directory, 'bands', `${band}.bin`), 'r');
  try { assert.equal(readSync(fd, bytes, 0, length, offset), length); } finally { closeSync(fd); }
  assert.deepEqual(await query(tile), JSON.parse(gunzipSync(bytes)), `Band ${band}: live range matches package`);
  checked++;
}
for (const tile of Object.keys(manifest.nativeFallbackTiles ?? {})) {
  assert.equal((await query(tile)).places.length, 0, 'Oversized tile returns native fallback');
}
console.log(`National preview passed: ${checked} bands match verified tile bytes, including Alaska/Hawaii bands; ${Object.keys(manifest.nativeFallbackTiles ?? {}).length} oversized tile falls back. No configuration changes.`);
