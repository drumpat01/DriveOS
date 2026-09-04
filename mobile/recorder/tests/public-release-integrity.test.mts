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
const membershipNative = await readFile(new URL('../modules/journeydeck-membership/ios/JourneyDeckMembershipModule.swift', import.meta.url), 'utf8');

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
  assert.match(membershipStore, /const availableProducts = await getMembershipProducts\(\)/);
  assert.match(membershipStore, /productLoadGeneration/);
  assert.match(membershipStore, /setProducts\(\[\]\)/);
  assert.match(membershipPaywall, /product\.displayPrice/);
  assert.match(membershipPaywall, /selectedProduct\.displayPrice/);
  assert.match(membershipPaywall, /loadProductsRef\.current\(\)/);
  assert.match(membershipPaywall, /Restore Purchases/);
  assert.doesNotMatch(shell, /[$€£¥]\s?\d/);
  assert.doesNotMatch(membershipPaywall, /[$€£¥]\s?\d/);
  assert.match(membershipNative, /product\.displayPrice/);
});

test('membership sells Atlas intelligence and complete history in one full-screen composition', () => {
  assert.match(membershipPaywall, /presentationStyle="fullScreen"/);
  assert.match(membershipPaywall, /atlas-globe-membership-v1\.jpg/);
  assert.match(membershipPaywall, /atlas-header-orbit-v1\.png/);
  assert.match(membershipPaywall, /ambientGlow: \{[\s\S]*?width: 320,[\s\S]*?height: 320,/);
  assert.doesNotMatch(membershipPaywall, /rgba\(170,36,157,0\.18\)/);
  assert.match(membershipPaywall, /Your driving story, decoded\./);
  assert.match(membershipPaywall, /YOUR PRIVATE ATLAS/);
  assert.match(membershipPaywall, /Pattern Intelligence/);
  assert.match(membershipPaywall, /Favorite Places/);
  assert.match(membershipPaywall, /Repeated Routes/);
  assert.match(membershipPaywall, /Music Moments/);
  assert.match(membershipPaywall, /Every journey beyond the latest 45 days/);
  assert.match(membershipPaywall, /BEST VALUE/);
  assert.match(membershipPaywall, /accessibilityRole="radio"/);
  assert.match(membershipPaywall, /purchaseInFlight/);
  assert.match(membershipPaywall, /useWindowDimensions/);
  assert.match(membershipPaywall, /useSafeAreaInsets/);
  assert.match(membershipPaywall, /\(usableHeight - 790\) \/ 60/);
  assert.match(membershipPaywall, /height: 156 \+ \(44 \* expansion\)/);
  assert.match(membershipPaywall, /minHeight: 84 \+ \(14 \* expansion\)/);
  assert.match(membershipPaywall, /fontScale >= 1\.25/);
  assert.match(membershipPaywall, /featureRow: \{ flexDirection: 'row'/);
  assert.doesNotMatch(membershipPaywall, /featureGrid: \{[^\n]*flexWrap/);
  assert.match(membershipPaywall, /ctaShell: \{ minHeight: 52, marginTop: 9/);
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
