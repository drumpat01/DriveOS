import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const preferences = await readFile(new URL('../src/music-preferences.ts', import.meta.url), 'utf8');
const lastFm = await readFile(new URL('../src/lastfm-sync.ts', import.meta.url), 'utf8');
const spotify = await readFile(new URL('../src/spotify-direct.ts', import.meta.url), 'utf8');
const recorder = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const entrypoint = await readFile(new URL('../index.ts', import.meta.url), 'utf8');
const automaticDriveTask = await readFile(new URL('../src/automatic-drive-task.ts', import.meta.url), 'utf8');
const locationTask = await readFile(new URL('../src/location-task.ts', import.meta.url), 'utf8');
const musicCapture = await readFile(new URL('../src/music-capture.ts', import.meta.url), 'utf8');
const tessie = await readFile(new URL('../src/tessie-direct.ts', import.meta.url), 'utf8');
const releaseFeatures = await readFile(new URL('../src/release-features.ts', import.meta.url), 'utf8');
const firstRunScreen = await readFile(new URL('../src/first-run-onboarding-screen.tsx', import.meta.url), 'utf8');
const checklist = await readFile(new URL('../APP_STORE_RELEASE.md', import.meta.url), 'utf8');
const publicPreflight = await readFile(new URL('../scripts/public-release-preflight.mjs', import.meta.url), 'utf8');
const membershipPaywall = await readFile(new URL('../src/membership-paywall.tsx', import.meta.url), 'utf8');
const membershipStore = await readFile(new URL('../src/membership-store.ts', import.meta.url), 'utf8');

test('production uses the production privacy edge and keeps internal testing disabled', () => {
  assert.equal(app.expo.extra.edge.url, 'https://journeydeck-edge.patrickbstewart.workers.dev');
  assert.doesNotMatch(app.expo.extra.edge.url, /preview/i);
  assert.equal(eas.build.production.env.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING, '0');
});

test('production microphone purpose string describes only user-initiated recognition', () => {
  const microphonePurpose = app.expo.ios.infoPlist.NSMicrophoneUsageDescription;
  const imagePicker = app.expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');

  assert.equal(typeof microphonePurpose, 'string');
  assert.match(microphonePurpose, /when you tap Identify Song/i);
  assert.match(microphonePurpose, /never recorded or saved/i);
  assert.ok(Array.isArray(imagePicker));
  assert.equal(imagePicker[1].microphonePermission, microphonePurpose);
});

test('public Shazam capture is manual per song and never starts from background drive tasks', () => {
  assert.match(entrypoint, /\.\/src\/automatic-drive-task/);
  assert.doesNotMatch(automaticDriveTask, /sampleShazamForActiveSession|recognizeAndQueueActiveSessionMusic/);
  assert.doesNotMatch(locationTask, /sampleShazamForActiveSession|recognizeAndQueueActiveSessionMusic/);
  assert.doesNotMatch(musicCapture, /export async function sampleShazamForActiveSession/);
  assert.match(recorder, /label="Identify Song"/);
  assert.match(recorder, /recognizeAndQueueActiveSessionMusic\(10_000, \{ allowAdHoc: true \}\)/);
  assert.match(recorder, /Tap once for each song you want on this journey/);
});

test('public music choices cannot include preview-only Spotify integrations', () => {
  assert.match(preferences, /export function isMusicProviderAvailable/);
  assert.match(preferences, /provider === 'apple-music' \|\| provider === 'shazam' \|\| isInternalTestingBuild\(\)/);
  assert.match(preferences, /if \(!isMusicProviderAvailable\(provider\) \|\| provider === 'spotify-direct'\) return null/);
  assert.match(lastFm, /if \(!isMusicProviderAvailable\('lastfm'\)\) return \{ attempted: 0, succeeded: 0, matchedTracks: 0 \}/);
  assert.match(spotify, /function requireInternalPreview\(\)/);
  assert.match(spotify, /requireInternalPreview\(\);/);
  assert.match(shell, /const publicProviderOptions = providerOptions\.filter\(option => isMusicProviderAvailable\(option\.id\)\)/);
  assert.match(shell, /\{isInternalTestingBuild\(\) && advancedSupportVisible && <>/);
});

test('public recording defaults to manual while Apple Music continues during an active route', () => {
  assert.match(firstRunScreen, /await onContinue\('manual'\)/);
  assert.doesNotMatch(firstRunScreen, /<RecordingChoice mode="automatic"/);
  assert.match(locationTask, /sampleAppleMusicForActiveSession\(\)/);
  assert.match(recorder, /!active && !automaticMode && <PrimaryButton label="Start recording"/);
});

test('version 1 disables Tessie and automatic recording for every membership tier', () => {
  assert.match(releaseFeatures, /TESSIE_INTEGRATION_ENABLED: boolean = false/);
  assert.match(tessie, /entitlementsForVerifiedMembership\(await getMembershipStatus\(\)\)\.tessieAccess/);
  assert.match(tessie, /storedVerifiedVehicleCount/);
  assert.match(tessie, /if \(vehicleCount < 1\)/);
  assert.match(automaticDriveTask, /!current && !\(await tessieAutomaticRecordingEligible\(\)\)/);
  assert.match(recorder, /const shouldRun = Boolean\(foregroundPermission && backgroundPermission && \(tessieEligible \|\| finishingExistingAutomaticJourney\)\)/);
  assert.match(recorder, /const automaticMode = TESSIE_INTEGRATION_ENABLED &&/);
  assert.doesNotMatch(membershipPaywall, /Tessie|Tesla|Automatic Drive Detection/);
});

test('public membership uses verified StoreKit products without hardcoded pricing', () => {
  assert.match(shell, /membershipTier=\{membership\.tier\}/);
  assert.match(membershipStore, /entitlementsForVerifiedMembership/);
  assert.match(membershipPaywall, /product\.displayPrice/);
  assert.match(membershipPaywall, /Restore Purchases/);
  assert.doesNotMatch(shell, /\$4\.99/);
  assert.doesNotMatch(membershipPaywall, /\$4\.99/);
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
