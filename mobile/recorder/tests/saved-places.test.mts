import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const savedPlaces = readFileSync(resolve(directory, '../src/saved-places.ts'), 'utf8');
const localStore = readFileSync(resolve(directory, '../src/local-store.ts'), 'utf8');
const shell = readFileSync(resolve(directory, '../src/shell.tsx'), 'utf8');

test('Saved Places supports fixed and repeatable custom places through private local-first persistence', () => {
  assert.match(savedPlaces, /'home' \| 'work' \| 'school'/);
  assert.match(savedPlaces, /saved-place\.v1\.\$\{slot\}/);
  assert.match(savedPlaces, /upsertPrivatePreference/);
  assert.match(savedPlaces, /notifyLocalArchiveChanged/);
  assert.match(savedPlaces, /saveCustomSavedPlace/);
  assert.match(savedPlaces, /saved-custom-place-v1-/);
  assert.match(savedPlaces, /loadCustomSavedPlaces/);
  assert.match(localStore, /LOWER\(label\)='school'/);
  assert.match(localStore, /id LIKE 'saved-custom-place-v1-%'/);
});

test('Settings replaces the passive safe-zone and recording cards with one compact Saved Places editor', () => {
  const settings = shell.slice(shell.indexOf('type SettingsDestination'), shell.indexOf('function CinematicTabPage'));
  assert.match(settings, /SectionHeading title="Saved Places"/);
  assert.match(settings, /SAVED_PLACE_SLOTS\.map/);
  assert.match(settings, /Location\.geocodeAsync/);
  assert.match(settings, /Location\.getCurrentPositionAsync/);
  assert.match(settings, /setDestination\(\{ kind: 'saved-place', slot: slot\.id \}\)/);
  assert.match(settings, /<SettingsSavedPlaceEditor/);
  assert.match(settings, /<SettingsCustomPlaceEditor/);
  assert.match(settings, /Add another custom place/);
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

test('Settings editors replace the overview without controlling its native scroll position', () => {
  const settings = shell.slice(shell.indexOf('function ConnectionsScreen'), shell.indexOf('function AppearanceSwitch'));
  assert.match(settings, /if \(destination\.kind === 'profile'\) \{[\s\S]*?return <SettingsProfileEditor/);
  assert.match(settings, /if \(destination\.kind === 'saved-place'\) \{[\s\S]*?return <SettingsSavedPlaceEditor/);
  assert.doesNotMatch(settings, /settingsScrollView|settingsScrollOffset|contentOffset=|onScroll=|scrollEventThrottle|<OverlayModal|<Modal/);
  assert.equal(shell.match(/<ConnectionsScreen\b/g)?.length, 1);
});

test('Settings editors never resize from transient iOS keyboard frames', () => {
  const editors = shell.slice(shell.indexOf('type SettingsDestination'), shell.indexOf('function ConnectionsScreen'));

  assert.match(editors, /automaticallyAdjustKeyboardInsets=\{false\}/);
  assert.match(editors, /keyboardShouldPersistTaps="handled"/, 'Settings editors retain their proven native tap policy');
  assert.doesNotMatch(editors, /disableScrollViewPanResponder|canCancelContentTouches=\{false\}/, 'Settings leaves child gesture arbitration to the native scroll views');
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
  const navigation = readFileSync(new URL('../src/native-navigation.tsx', import.meta.url), 'utf8');
  assert.match(shell, /tabBarHidden: settingsEditorActive/);
  assert.match(navigation, /<NativeTabs\b[^>]*\bhidden=\{tabBarHidden\}/);
});
