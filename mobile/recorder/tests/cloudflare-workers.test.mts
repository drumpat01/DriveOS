/** Structural and behavior checks for JourneyDeck's stateless Cloudflare edge. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePlacesLookup } from '../../../cloudflare/workers/places-lookup.ts';
import { handleLastFmHistory } from '../../../cloudflare/workers/lastfm-history.ts';
import { handleTessieMedia, handleTessieSync } from '../../../cloudflare/workers/oauth-tessie.ts';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../../cloudflare');
const indexSource = readFileSync(resolve(root, 'workers/index.ts'), 'utf8');
const spotifySource = readFileSync(resolve(root, 'workers/oauth-spotify.ts'), 'utf8');
const tessieSource = readFileSync(resolve(root, 'workers/oauth-tessie.ts'), 'utf8');
const placesSource = readFileSync(resolve(root, 'workers/places-lookup.ts'), 'utf8');
const lastFmSource = readFileSync(resolve(root, 'workers/lastfm-history.ts'), 'utf8');
const policySource = readFileSync(resolve(root, 'workers/edge-policy.ts'), 'utf8');
const config = JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8')) as Record<string, unknown>;

assert.match(indexSource, /satisfies ExportedHandler<Env>/, 'entry point uses the generated Worker environment type');
assert.match(indexSource, /Origin not allowed/, 'unapproved browser origins fail closed');
assert.match(indexSource, /event: 'edge_request'/, 'requests emit structured operational logs');
assert.doesNotMatch(indexSource + spotifySource + tessieSource + placesSource + lastFmSource + policySource, /\bany\b/, 'Worker source avoids any');
assert.match(indexSource, /EDGE_RATE_LIMITER|enforceGlobalRateLimit/, 'all edge APIs share a global abuse limit');
assert.match(indexSource, /featureAvailable/, 'provider kill switches are enforced by the router');
assert.match(policySource, /UPSTREAM_TIMEOUT_MS/, 'upstream timeouts share one bounded policy');

assert.match(spotifySource, /code_verifier/, 'Spotify exchange requires PKCE');
assert.match(spotifySource, /SPOTIFY_REDIRECT_URIS/, 'Spotify redirect URIs are allowlisted');
assert.match(spotifySource, /SPOTIFY_RATE_LIMITER/, 'Spotify token broker has a global owner rate limit');
assert.match(spotifySource, /readBoundedJson/, 'Spotify bodies are size bounded');
assert.match(spotifySource, /no-store, no-cache/, 'Spotify tokens are never cached');
assert.doesNotMatch(spotifySource, /SPOTIFY_CLIENT_SECRET/, 'PKCE broker stores no Spotify client secret');
assert.match(spotifySource, /user-read-recently-played|clientId|handleSpotifyConfig/, 'owner PKCE setup exposes only its public client configuration');

assert.match(lastFmSource, /user\.getRecentTracks/, 'Last.fm broker uses bounded recent listening history');
assert.match(lastFmSource, /LASTFM_RATE_LIMITER/, 'Last.fm requests have an edge rate limit');
assert.match(lastFmSource, /nowplaying/, 'unstable now-playing rows are excluded');
assert.doesNotMatch(lastFmSource, /\bimage\b|artwork/i, 'Last.fm artwork is not retained or relayed');

assert.match(tessieSource, /readBoundedJson/, 'Tessie bodies are size bounded');
assert.match(tessieSource, /vehicleCount/, 'Tessie returns only the minimum verification result');
assert.match(tessieSource, /TESSIE_RATE_LIMITER/, 'Tessie reads have a provider-specific edge limit');
assert.match(tessieSource, /\/charges\?|\/drives\?/, 'Tessie history is fetched through bounded read-only endpoints');
assert.match(tessieSource, /endpoints=vehicle_state/, 'Tessie live reads request the vehicle-state block containing media metadata');
assert.match(tessieSource, /\$\{encodedVin\}\/state/, 'Tessie media has a bounded native-state fallback');
assert.match(indexSource, /\/api\/vehicle\/tessie\/media/, 'Tessie media has an explicit edge route');
assert.doesNotMatch(tessieSource, /command\//, 'Tessie edge exposes no vehicle commands');

assert.equal(config.compatibility_date, '2026-08-27');
assert.equal((config.observability as { enabled?: boolean }).enabled, true);
assert.equal(((config.env as { preview?: { name?: string } }).preview?.name), 'journeydeck-edge-preview');
assert.equal(((config.env as { preview?: { ratelimits?: unknown[] } }).preview?.ratelimits?.length), 4);

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

let lastFmCalls = 0;
globalThis.fetch = async input => {
  lastFmCalls += 1;
  const url = new URL(String(input));
  assert.equal(url.searchParams.get('method'), 'user.getRecentTracks');
  assert.equal(url.searchParams.get('limit'), '200');
  return new Response(JSON.stringify({ recenttracks: { track: [
    { name: 'Ignored live song', artist: { '#text': 'Artist' }, '@attr': { nowplaying: 'true' } },
    { name: 'Road Song', artist: { '#text': 'Driver' }, album: { '#text': 'Night' }, url: 'https://www.last.fm/music/driver/road-song', date: { uts: '1787833500' }, image: [{ '#text': 'https://images.example/forbidden.jpg' }] },
  ], '@attr': { totalPages: '1' } } }), { status: 200, headers: { 'content-type': 'application/json' } });
};
try {
  const response = await handleLastFmHistory(new Request('https://edge.example/api/music/lastfm/recent', { method: 'POST', body: JSON.stringify({ username: 'privacy_driver', from: '2026-08-27T12:20:00.000Z', to: '2026-08-27T12:30:00.000Z' }) }), {
    LASTFM_API_KEY: 'test-key', LASTFM_RATE_LIMITER: { limit: async () => ({ success: true }) },
  } as unknown as Env);
  assert.equal(response.status, 200);
  const payload = await response.json() as { tracks: Record<string, unknown>[]; attribution: string };
  assert.equal(lastFmCalls, 1);
  assert.equal(payload.tracks.length, 1);
  assert.equal(payload.tracks[0]?.track, 'Road Song');
  assert.equal('artworkUrl' in (payload.tracks[0] ?? {}), false);
  assert.match(payload.attribution, /Last\.fm/);
} finally {
  globalThis.fetch = originalFetch;
}

const syncTo = new Date(), syncFrom = new Date(syncTo.getTime() - 24 * 60 * 60_000);
globalThis.fetch = async (input, init) => {
  assert.match(String((init?.headers as Record<string, string> | undefined)?.authorization), /^Bearer test-tessie-token/);
  const url = new URL(String(input));
  if (url.pathname === '/vehicles') return new Response(JSON.stringify({ results: [{ vin: '5YJ3E1EA7KF123456', last_state: { state: 'online', display_name: 'Juniper', charge_state: { battery_level: 74, battery_range: 208, charging_state: 'Disconnected', timestamp: Date.now() }, vehicle_state: { odometer: 32000 } } }] }));
  if (url.pathname.endsWith('/charges')) return new Response(JSON.stringify({ results: [{ id: 1, started_at: Math.floor(syncFrom.getTime() / 1000), ended_at: Math.floor(syncTo.getTime() / 1000), location: 'Home charger', latitude: 32.8, longitude: -97.4, energy_added: 24, energy_used: 25, miles_added: 90, starting_battery: 40, ending_battery: 74, cost: 3.5 }] }));
  if (url.pathname.endsWith('/drives')) return new Response(JSON.stringify({ results: [{ id: 2, started_at: Math.floor(syncFrom.getTime() / 1000), ended_at: Math.floor(syncTo.getTime() / 1000), starting_location: 'Home', ending_location: 'Work', starting_latitude: 32.8, starting_longitude: -97.4, odometer_distance: 12, energy_used: 3.2 }] }));
  throw new Error(`Unexpected Tessie path ${url.pathname}`);
};
try {
  const response = await handleTessieSync(new Request('https://edge.example/api/vehicle/tessie/sync', { method: 'POST', body: JSON.stringify({ accessToken: 'test-tessie-token-123456', from: syncFrom.toISOString(), to: syncTo.toISOString() }) }), {
    TESSIE_RATE_LIMITER: { limit: async () => ({ success: true }) }, UPSTREAM_TIMEOUT_MS: '10000',
  } as unknown as Env);
  assert.equal(response.status, 200);
  const payload = await response.json() as { vehicles: Record<string, unknown>[]; charges: Record<string, unknown>[]; drives: Record<string, unknown>[] };
  assert.equal(payload.vehicles[0]?.name, 'Juniper');
  assert.equal(payload.charges.length, 1);
  assert.equal(payload.drives.length, 1);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /5YJ3E1EA7KF123456|latitude|longitude/, 'VINs and precise coordinates never leave the edge');
} finally {
  globalThis.fetch = originalFetch;
}

let tessieMediaCalls = 0;
globalThis.fetch = async (input, init) => {
  tessieMediaCalls += 1;
  assert.match(String((init?.headers as Record<string, string> | undefined)?.authorization), /^Bearer test-tessie-token/);
  const url = new URL(String(input));
  if (url.pathname === '/vehicles') {
    return new Response(JSON.stringify({ results: [{ vin: '5YJ3E1EA7KF123456', last_state: { drive_state: { shift_state: 'D' } } }] }));
  }
  if (url.pathname.endsWith('/vehicle_data')) {
    assert.equal(url.searchParams.get('endpoints'), 'vehicle_state');
    return new Response(JSON.stringify({ response: {
      vehicle_state: { media_info: {
        now_playing_title: 'Midnight City', now_playing_artist: 'M83', now_playing_album: 'Hurry Up, We’re Dreaming',
        now_playing_source: 'AppleMusic', now_playing_duration: 243000, now_playing_elapsed: 48000,
        media_playback_status: 'MEDIA_STATUS_PLAYING',
      } },
      drive_state: { latitude: 32.7555, longitude: -97.3308 },
    } }));
  }
  throw new Error(`Unexpected Tessie media path ${url.pathname}`);
};
try {
  const response = await handleTessieMedia(new Request('https://edge.example/api/vehicle/tessie/media', { method: 'POST', body: JSON.stringify({ accessToken: 'test-tessie-token-123456' }) }), {
    TESSIE_RATE_LIMITER: { limit: async () => ({ success: true }) }, UPSTREAM_TIMEOUT_MS: '10000',
  } as unknown as Env);
  assert.equal(response.status, 200);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(tessieMediaCalls, 2);
  assert.equal(payload.track, 'Midnight City');
  assert.equal(payload.artist, 'M83');
  assert.equal(payload.isPlaying, true);
  assert.equal(payload.elapsedMs, 48000);
  assert.doesNotMatch(JSON.stringify(payload), /5YJ3E1EA7KF123456|latitude|longitude/, 'VINs and unrelated vehicle data never leave the edge');
} finally {
  globalThis.fetch = originalFetch;
}

let tessieStateFallbackCalls = 0;
globalThis.fetch = async input => {
  tessieStateFallbackCalls += 1;
  const url = new URL(String(input));
  if (url.pathname === '/vehicles') {
    return new Response(JSON.stringify({ results: [{ vin: '5YJ3E1EA7KF123456', last_state: { state: 'online' } }] }));
  }
  if (url.pathname.endsWith('/vehicle_data')) {
    return new Response(JSON.stringify({ response: { vehicle_state: { media_state: { remote_control_enabled: true } } } }));
  }
  if (url.pathname.endsWith('/state')) {
    return new Response(JSON.stringify({ vehicle_state: { media_info: {
      now_playing_title: 'Electric Feel', now_playing_artist: 'MGMT', now_playing_source: 'AppleMusic',
      media_playback_status: 'Playing', now_playing_duration: 229000, now_playing_elapsed: 31000,
    } } }));
  }
  throw new Error(`Unexpected Tessie fallback path ${url.pathname}`);
};
try {
  const response = await handleTessieMedia(new Request('https://edge.example/api/vehicle/tessie/media', { method: 'POST', body: JSON.stringify({ accessToken: 'test-tessie-token-123456' }) }), {
    TESSIE_RATE_LIMITER: { limit: async () => ({ success: true }) }, UPSTREAM_TIMEOUT_MS: '10000',
  } as unknown as Env);
  assert.equal(response.status, 200);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(tessieStateFallbackCalls, 3);
  assert.equal(payload.track, 'Electric Feel');
  assert.equal(payload.artist, 'MGMT');
  assert.doesNotMatch(JSON.stringify(payload), /5YJ3E1EA7KF123456|latitude|longitude/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('✅  cloudflare-workers: all checks passed.');
