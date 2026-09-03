import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const savedPlaces = readFileSync(resolve(directory, '../src/saved-places.ts'), 'utf8');
const localStore = readFileSync(resolve(directory, '../src/local-store.ts'), 'utf8');
const shell = readFileSync(resolve(directory, '../src/shell.tsx'), 'utf8');

test('Saved Places supports Home, Work, and School through private local-first preferences', () => {
  assert.match(savedPlaces, /'home' \| 'work' \| 'school'/);
  assert.match(savedPlaces, /saved-place\.v1\.\$\{slot\}/);
  assert.match(savedPlaces, /upsertPrivatePreference/);
  assert.match(savedPlaces, /notifyLocalArchiveChanged/);
  assert.match(localStore, /LOWER\(label\)='school'/);
});

test('Settings replaces the passive safe-zone and recording cards with one compact Saved Places editor', () => {
  const settings = shell.slice(shell.indexOf('type SettingsDestination'), shell.indexOf('function CinematicTabPage'));
  assert.match(settings, /SectionHeading title="Saved Places"/);
  assert.match(settings, /SAVED_PLACE_SLOTS\.map/);
  assert.match(settings, /Location\.geocodeAsync/);
  assert.match(settings, /Location\.getCurrentPositionAsync/);
  assert.match(settings, /setDestination\(\{ kind: 'saved-place', slot: slot\.id \}\)/);
  assert.match(settings, /<SettingsSavedPlaceEditor/);
  assert.doesNotMatch(settings, /Home & Work Safe Zones/);
  assert.doesNotMatch(settings, /SectionHeading title="Recording"/);
});

test('the Primary Driver account row opens the private name and profile-photo editor', () => {
  const settings = shell.slice(shell.indexOf('type SettingsDestination'), shell.indexOf('function CinematicTabPage'));
  assert.match(settings, /accessibilityLabel="Edit primary driver profile"/);
  assert.match(settings, /setDestination\(\{ kind: 'profile' \}\)/);
  assert.match(settings, /<SettingsProfileEditor/);
  assert.match(settings, /chooseProfileAvatar\(\)/);
  assert.match(settings, /saveProfileAppearance\(currentUser, draft\)/);
  assert.match(settings, /title="Edit your profile"/);
});

test('Settings editors replace the overview instead of redrawing it underneath', () => {
  const settings = shell.slice(shell.indexOf('function ConnectionsScreen'), shell.indexOf('function CinematicTabPage'));
  assert.match(settings, /if \(destination\.kind === 'profile'\) \{[\s\S]*?return <SettingsProfileEditor/);
  assert.match(settings, /if \(destination\.kind === 'saved-place'\) \{[\s\S]*?return <SettingsSavedPlaceEditor/);
  assert.match(settings, /contentOffset=\{\{ x: 0, y: settingsScrollOffset\.current \}\}/);
  assert.match(settings, /settingsScrollOffset\.current = event\.nativeEvent\.contentOffset\.y/);
  assert.doesNotMatch(settings, /settingsScrollView|<OverlayModal|<Modal/);
  assert.equal(shell.match(/<ConnectionsScreen\b/g)?.length, 1);
});

test('Settings editors never resize from transient iOS keyboard frames', () => {
  const editors = shell.slice(shell.indexOf('type SettingsDestination'), shell.indexOf('function ConnectionsScreen'));

  assert.match(editors, /automaticallyAdjustKeyboardInsets=\{false\}/);
  assert.match(editors, /keyboardShouldPersistTaps="handled"/);
  assert.doesNotMatch(editors, /Keyboard\.addListener|KeyboardAvoidingView|keyboardHeight|paddingBottom: keyboard/);
  assert.doesNotMatch(editors, /<Modal|<OverlayModal|BlurView|CinematicGlass/);
});

test('Settings editors own navigation and cancel stale asynchronous place work', () => {
  const editors = shell.slice(shell.indexOf('type SettingsDestination'), shell.indexOf('function ConnectionsScreen'));
  const settings = shell.slice(shell.indexOf('function ConnectionsScreen'), shell.indexOf('function CinematicTabPage'));

  assert.match(editors, /backDisabled=\{avatarBusy\}/);
  assert.match(editors, /backDisabled=\{busy\}/);
  assert.match(editors, /operationGeneration\.current \+= 1/);
  assert.match(editors, /operation !== operationGeneration\.current/);
  assert.match(settings, /onEditorActiveChange\(destination\.kind !== 'overview'\)/);
  assert.match(shell, /appVisible && !settingsEditorActive && <SafeAreaView style=\{styles\.navSafe\}>/);
});
