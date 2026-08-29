import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const lifecycle = await readFile(new URL('../src/account-lifecycle.ts', import.meta.url), 'utf8');
const auth = await readFile(new URL('../src/auth.ts', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const recorder = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const cloud = await readFile(new URL('../src/icloud-sync.ts', import.meta.url), 'utf8');
const nativeCloud = await readFile(new URL('../modules/journeydeck-cloudkit/ios/JourneyDeckCloudKitModule.swift', import.meta.url), 'utf8');
const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));

test('profile handoff stops manual and automatic background location before identity changes', () => {
  const stopIndex = lifecycle.indexOf('await stopProfileBackgroundWork()');
  assert.ok(stopIndex >= 0);
  assert.match(lifecycle, /await stopLocationTracking\(\);[\s\S]*await stopAutomaticDetection\(\);[\s\S]*resetAutomaticDriveState\(\)/);
  assert.match(lifecycle, /activeSession\(\)/);
  assert.match(shell, /await prepareForProfileSwitch\(\)[\s\S]*switchActiveUser\(userId\)/);
  assert.match(auth, /await beforeProfileCommit\?\.\(\);[\s\S]*handleAppleSignInResult\(credential\)/);
  assert.match(shell, /signInWithApple\(prepareForProfileSwitch\)[\s\S]*onProfileChanged\(\)/);
});

test('sign-out preserves the old profile while account deletion removes cloud first and local data last', () => {
  assert.match(auth, /export function signOutToFreshLocalProfile/);
  assert.match(auth, /export function finalizeActiveProfileDeletion/);
  assert.doesNotMatch(auth.slice(auth.indexOf('export function signOutToFreshLocalProfile'), auth.indexOf('export function finalizeActiveProfileDeletion')), /deleteLocalUserData/);
  assert.ok(lifecycle.indexOf('await deletePrivateCloudDataForUser(user)') < lifecycle.indexOf('finalizeActiveProfileDeletion(user.id)'));
  assert.ok(lifecycle.indexOf('await deletePrivateRouteStagingAssets(user.id)') < lifecycle.indexOf('finalizeActiveProfileDeletion(user.id)'));
  assert.match(lifecycle, /const file = new File\(uri\);[\s\S]*if \(file\.exists\) file\.delete\(\);/);
  assert.doesNotMatch(lifecycle, /FileSystem\.deleteAsync\(uri/);
  assert.match(cloud, /deleteCloudKitPrivateZone/);
  assert.match(nativeCloud, /deletePrivateZoneAsync/);
  assert.match(shell, /Final confirmation[\s\S]*Delete forever/);
});

test('runtime 1.8 declares required permission and background-location configuration', () => {
  assert.equal(app.expo.version, '1.8.0');
  assert.deepEqual(app.expo.runtimeVersion, { policy: 'appVersion' });
  const location = app.expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-location');
  assert.equal(location[1].isIosBackgroundLocationEnabled, true);
  assert.match(location[1].locationWhenInUsePermission, /record the route/);
  assert.match(location[1].locationAlwaysAndWhenInUsePermission, /phone is locked/);
  assert.match(recorder, /getForegroundPermissionsAsync\(\)[\s\S]*getBackgroundPermissionsAsync\(\)/);
  assert.match(recorder, /canAskAgain[\s\S]*Linking\.openSettings\(\)/);
});

test('native CloudKit rejects unsupported and oversized downloaded assets before persistence', () => {
  assert.match(nativeCloud, /guard allowedRecordTypes\.contains\(record\.recordType\)/);
  assert.match(nativeCloud, /guard assetRecordTypes\.contains\(recordType\), let source = asset\.fileURL/);
  assert.match(nativeCloud, /guard size > 0 && size <= maximumBytes/);
  assert.match(nativeCloud, /else if assetRecordTypes\.contains\(record\.recordType\) && !\(record\["deletedAt"\] is String\)/);
});
