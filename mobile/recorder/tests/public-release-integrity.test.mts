import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const preferences = await readFile(new URL('../src/music-preferences.ts', import.meta.url), 'utf8');
const lastFm = await readFile(new URL('../src/lastfm-sync.ts', import.meta.url), 'utf8');
const spotify = await readFile(new URL('../src/spotify-direct.ts', import.meta.url), 'utf8');
const checklist = await readFile(new URL('../APP_STORE_RELEASE.md', import.meta.url), 'utf8');
const publicPreflight = await readFile(new URL('../scripts/public-release-preflight.mjs', import.meta.url), 'utf8');

test('production uses the production privacy edge and keeps internal testing disabled', () => {
  assert.equal(app.expo.extra.edge.url, 'https://journeydeck-edge.patrickbstewart.workers.dev');
  assert.doesNotMatch(app.expo.extra.edge.url, /preview/i);
  assert.equal(eas.build.production.env.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING, '0');
});

test('public music choices cannot include preview-only Spotify integrations', () => {
  assert.match(preferences, /export function isMusicProviderAvailable/);
  assert.match(preferences, /provider === 'apple-music' \|\| provider === 'shazam' \|\| isInternalTestingBuild\(\)/);
  assert.match(preferences, /if \(!isMusicProviderAvailable\(provider\) \|\| provider === 'spotify-direct'\) return null/);
  assert.match(lastFm, /if \(!isMusicProviderAvailable\('lastfm'\)\) return \{ attempted: 0, succeeded: 0, matchedTracks: 0 \}/);
  assert.match(spotify, /function requireInternalPreview\(\)/);
  assert.match(spotify, /requireInternalPreview\(\);/);
  assert.match(shell, /const publicProviderOptions = providerOptions\.filter\(option => isMusicProviderAvailable\(option\.id\)\)/);
  assert.match(shell, /\{isInternalTestingBuild\(\) && <>/);
});

test('public settings do not advertise an unimplemented paid tier', () => {
  assert.doesNotMatch(shell, /JourneyDeck Pro/);
  assert.doesNotMatch(shell, /PRO MEMBERSHIP/);
  assert.doesNotMatch(shell, /\$4\.99/);
});

test('release checklist keeps the non-code App Store gates explicit', () => {
  for (const required of ['privacy policy', 'support URL', 'CloudKit production schema', 'App Store Connect privacy nutrition labels', 'TestFlight']) {
    assert.match(checklist, new RegExp(required, 'i'));
  }
});

test('public legal pages are a required, network-verified release gate', () => {
  assert.match(publicPreflight, /JOURNEYDECK_APP_STORE_PRIVACY_URL/);
  assert.match(publicPreflight, /JOURNEYDECK_APP_STORE_SUPPORT_URL/);
  assert.match(publicPreflight, /redirect: 'manual'/);
  assert.match(publicPreflight, /public 2xx response without an authentication redirect/);
});

test('Settings includes the public Privacy Policy required for the App Store release', () => {
  assert.match(shell, /https:\/\/journeydeck\.me\/privacy/);
  assert.match(shell, /Read Privacy Policy/);
});
