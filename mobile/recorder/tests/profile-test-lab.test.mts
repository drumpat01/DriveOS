import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const auth = await readFile(new URL('../src/auth.ts', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const health = await readFile(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
const profileSecrets = await readFile(new URL('../src/profile-secure-store.ts', import.meta.url), 'utf8');
const musicPreferences = await readFile(new URL('../src/music-preferences.ts', import.meta.url), 'utf8');
const spotify = await readFile(new URL('../src/spotify-direct.ts', import.meta.url), 'utf8');
const tessie = await readFile(new URL('../src/tessie-direct.ts', import.meta.url), 'utf8');
const internalTesting = await readFile(new URL('../src/internal-testing.ts', import.meta.url), 'utf8');
const eas = await readFile(new URL('../eas.json', import.meta.url), 'utf8');

test('the temporary lab creates a distinct local profile and never deletes the original', () => {
  assert.match(auth, /export function createIsolationTestProfile\(\)/);
  assert.match(auth, /ensureLocalUser\(\{ displayName:/);
  assert.match(auth, /setActiveLocalUserId\(user\.id\)/);
  assert.doesNotMatch(auth, /delete.*Isolation|DELETE FROM local_users/i);
});

test('the temporary lab is excluded from production builds', () => {
  assert.match(auth, /isInternalTestingBuild\(\)/);
  assert.match(health, /isInternalTestingBuild\(\)/);
  assert.match(internalTesting, /__DEV__ \|\| process\.env\.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING === '1'/);
  assert.match(eas, /"production"[\s\S]*"EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING": "0"/);
});

test('profile switching is blocked during recording and remounts every profile-bound service in app', () => {
  assert.match(shell, /dashboard\.data\.recorder\.state !== 'ready'/);
  assert.match(shell, /switchActiveUser\(userId\)/);
  assert.match(shell, /await prepareForProfileSwitch\(\)/);
  assert.match(shell, /JourneyDeckShellContent key=\{profileRevision\}/);
  assert.match(shell, /onProfileChanged\(\)/);
  const profileSwitching = shell.slice(shell.indexOf('const createProfileIsolationTest'), shell.indexOf('const connectAppleIdentity'));
  assert.doesNotMatch(profileSwitching, /Updates\.reloadAsync\(\)/);
});

test('synthetic profiles cannot pull existing private iCloud records into the clean test', () => {
  const sync = shell.slice(shell.indexOf('const syncPrivateCloud'), shell.indexOf('const connectAppleIdentity'));
  assert.match(sync, /isIsolationTestProfile\(\)/);
  assert.match(sync, /Paused for the temporary clean-profile isolation test/);
  assert.ok(sync.indexOf('isIsolationTestProfile()') < sync.indexOf('syncCurrentUserWithPrivateICloud'));
});

test('Data Health exposes exact aggregate isolation counts and a safe return path', () => {
  assert.match(health, /Profile Test Lab/);
  assert.match(health, /localStoreDiagnostics\(currentUser\.id\)/);
  for (const label of ['JOURNEYS', 'GPS POINTS', 'SONGS', 'MEMORIES', 'RECORDER QUEUE']) assert.match(health, new RegExp(label));
  assert.doesNotMatch(health, /COLLECTIONS/);
  assert.match(health, /Return to \{profile\.displayName/);
  assert.match(health, /This never deletes, merges, or edits your current data/);
});

test('legacy device credentials can only be claimed by a normal profile', () => {
  assert.match(profileSecrets, /profileKey\(base\)/);
  assert.match(profileSecrets, /legacy-owner-v1/);
  assert.match(profileSecrets, /isIsolationTestProfile\(\)/);
  assert.ok(profileSecrets.indexOf('isIsolationTestProfile()') < profileSecrets.indexOf('SecureStore.setItemAsync(ownerKey'));
});

test('music, owner Spotify, and Tessie credentials are profile-scoped', () => {
  for (const source of [musicPreferences, spotify, tessie]) {
    assert.match(source, /profile-secure-store/);
    assert.doesNotMatch(source, /SecureStore\.(?:get|set|delete)ItemAsync/);
  }
  assert.match(spotify, /loadProfileSecret\(TOKEN_KEY\)/);
  assert.match(tessie, /loadProfileSecret\(TESSIE_TOKEN_KEY\)/);
});
