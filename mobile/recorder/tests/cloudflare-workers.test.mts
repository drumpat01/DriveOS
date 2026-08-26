/**
 * cloudflare-workers.test.mts
 * 
 * Structural and logic tests for the Cloudflare Serverless Edge Workers.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dir, '../../../cloudflare');

const indexSrc = readFileSync(resolve(rootDir, 'workers/index.ts'), 'utf8');
const spotifySrc = readFileSync(resolve(rootDir, 'workers/oauth-spotify.ts'), 'utf8');
const tessieSrc = readFileSync(resolve(rootDir, 'workers/oauth-tessie.ts'), 'utf8');
const placesSrc = readFileSync(resolve(rootDir, 'workers/places-lookup.ts'), 'utf8');
const wranglerSrc = readFileSync(resolve(rootDir, 'wrangler.toml'), 'utf8');

// ============================================================
// 1. Router & CORS
// ============================================================
assert.match(indexSrc, /export default/, 'index.ts has default export with fetch handler');
assert.match(indexSrc, /Access-Control-Allow-Origin/, 'CORS headers configured');
assert.match(indexSrc, /\/api\/auth\/spotify\/token/, 'Spotify token route mapped');
assert.match(indexSrc, /\/api\/auth\/tessie\/verify/, 'Tessie verify route mapped');
assert.match(indexSrc, /\/api\/places\/reverse/, 'Places reverse lookup route mapped');

// ============================================================
// 2. Spotify Worker Security & Zero-State Invariants
// ============================================================
assert.match(spotifySrc, /handleSpotifyTokenExchange/, 'exports handleSpotifyTokenExchange');
assert.match(spotifySrc, /accounts\.spotify\.com\/api\/token/, 'proxies to official Spotify token endpoint');
assert.match(spotifySrc, /grant_type/, 'supports grant_type parameter');
assert.match(spotifySrc, /code_verifier/, 'supports PKCE code_verifier');
assert.match(spotifySrc, /no-store, no-cache/, 'never caches auth tokens');

// ============================================================
// 3. Tessie Token Verification
// ============================================================
assert.match(tessieSrc, /handleTessieVerification/, 'exports handleTessieVerification');
assert.match(tessieSrc, /api\.tessie\.com\/vehicles/, 'verifies token with Tessie API');
assert.match(tessieSrc, /no-store/, 'never caches Tessie API key verification');

// ============================================================
// 4. Places Reverse Geocoding & Privacy Fuzzing
// ============================================================
assert.match(placesSrc, /handlePlacesLookup/, 'exports handlePlacesLookup');
assert.match(placesSrc, /toFixed\(3\)/, 'fuzzes coordinates to 3 decimal places (~110m grid) for privacy and caching');
assert.match(placesSrc, /nominatim\.openstreetmap\.org/, 'uses Nominatim API');
assert.match(placesSrc, /public, max-age=86400/, 'sets 24-hour cache control headers');

// ============================================================
// 5. Wrangler Configuration
// ============================================================
assert.match(wranglerSrc, /name = "journeydeck-edge"/, 'worker name configured');
assert.match(wranglerSrc, /main = "workers\/index\.ts"/, 'entry point configured');

console.log('✅  cloudflare-workers: all checks passed.');
