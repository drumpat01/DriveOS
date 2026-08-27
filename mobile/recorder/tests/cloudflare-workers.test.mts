/** Structural and behavior checks for JourneyDeck's stateless Cloudflare edge. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePlacesLookup } from '../../../cloudflare/workers/places-lookup.ts';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../cloudflare');
const indexSource = readFileSync(resolve(root, 'workers/index.ts'), 'utf8');
const spotifySource = readFileSync(resolve(root, 'workers/oauth-spotify.ts'), 'utf8');
const tessieSource = readFileSync(resolve(root, 'workers/oauth-tessie.ts'), 'utf8');
const placesSource = readFileSync(resolve(root, 'workers/places-lookup.ts'), 'utf8');
const config = JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8')) as Record<string, unknown>;

assert.match(indexSource, /satisfies ExportedHandler<Env>/, 'entry point uses the generated Worker environment type');
assert.match(indexSource, /Origin not allowed/, 'unapproved browser origins fail closed');
assert.match(indexSource, /event: 'edge_request'/, 'requests emit structured operational logs');
assert.doesNotMatch(indexSource + spotifySource + tessieSource + placesSource, /\bany\b/, 'Worker source avoids any');

assert.match(spotifySource, /code_verifier/, 'Spotify exchange requires PKCE');
assert.match(spotifySource, /SPOTIFY_REDIRECT_URIS/, 'Spotify redirect URIs are allowlisted');
assert.match(spotifySource, /readBoundedJson/, 'Spotify bodies are size bounded');
assert.match(spotifySource, /no-store, no-cache/, 'Spotify tokens are never cached');
assert.doesNotMatch(spotifySource, /SPOTIFY_CLIENT_SECRET/, 'PKCE broker stores no Spotify client secret');

assert.match(tessieSource, /readBoundedJson/, 'Tessie bodies are size bounded');
assert.match(tessieSource, /vehicleCount/, 'Tessie returns only the minimum verification result');
assert.doesNotMatch(tessieSource, /\bvin\b|display_name|vehicles,/, 'Tessie never returns vehicle identifiers or names');

assert.equal(config.compatibility_date, '2026-08-27');
assert.equal((config.observability as { enabled?: boolean }).enabled, true);
assert.equal(((config.env as { preview?: { name?: string } }).preview?.name), 'journeydeck-edge-preview');

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
let upstreamCalls = 0;
const cacheWrites: Promise<unknown>[] = [];
Object.defineProperty(globalThis, 'caches', {
  configurable: true,
  value: { default: { match: async () => undefined, put: async () => undefined } },
});
globalThis.fetch = async input => {
  upstreamCalls += 1;
  const url = String(input);
  assert.match(url, /lat=32\.76/);
  assert.match(url, /lon=-97\.33/);
  assert.match(url, /zoom=10/);
  return new Response(JSON.stringify({ address: { city: 'Fort Worth', state: 'Texas', country: 'United States' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
const context = { waitUntil: (promise: Promise<unknown>) => { cacheWrites.push(promise); } };
try {
  const rejected = await handlePlacesLookup(new Request('https://edge.example/api/places/reverse', { method: 'POST', body: JSON.stringify({ lat: '32.7555', lng: '-97.3308' }) }), { NOMINATIM_USER_AGENT: 'JourneyDeck-Test/1.7' }, context);
  assert.equal(rejected.status, 400, 'edge rejects coordinates more precise than the city grid');
  assert.equal(upstreamCalls, 0);

  const accepted = await handlePlacesLookup(new Request('https://edge.example/api/places/reverse', { method: 'POST', body: JSON.stringify({ lat: '32.76', lng: '-97.33' }) }), { NOMINATIM_USER_AGENT: 'JourneyDeck-Test/1.7' }, context);
  assert.equal(accepted.status, 200);
  const payload = await accepted.json() as Record<string, unknown>;
  assert.equal(payload.label, 'Fort Worth, Texas');
  assert.equal(payload.attribution, '© OpenStreetMap contributors');
  assert.equal('fuzzedLat' in payload, false, 'edge response does not echo coordinates');
  assert.equal('fuzzedLng' in payload, false, 'edge response does not echo coordinates');
  assert.equal(upstreamCalls, 1);
  await Promise.all(cacheWrites);
} finally {
  globalThis.fetch = originalFetch;
  if (originalCaches) Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches });
  else Reflect.deleteProperty(globalThis, 'caches');
}

console.log('✅  cloudflare-workers: all checks passed.');
