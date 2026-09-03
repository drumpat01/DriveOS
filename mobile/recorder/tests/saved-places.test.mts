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
  const settings = shell.slice(shell.indexOf('function ConnectionsScreen'), shell.indexOf('function CinematicTabPage'));
  assert.match(settings, /SectionHeading title="Saved Places"/);
  assert.match(settings, /SAVED_PLACE_SLOTS\.map/);
  assert.match(settings, /Location\.geocodeAsync/);
  assert.match(settings, /Location\.getCurrentPositionAsync/);
  assert.match(settings, /title=\{savedPlaceEditor[\s\S]*?animationType="none"/);
  assert.doesNotMatch(settings, /Home & Work Safe Zones/);
  assert.doesNotMatch(settings, /SectionHeading title="Recording"/);
});

test('the Primary Driver account row opens the private name and profile-photo editor', () => {
  const settings = shell.slice(shell.indexOf('function ConnectionsScreen'), shell.indexOf('function CinematicTabPage'));
  assert.match(settings, /accessibilityLabel="Edit primary driver profile"/);
  assert.match(settings, /onPress=\{editProfile\}/);
  assert.match(settings, /chooseProfileAvatar\(\)/);
  assert.match(settings, /saveProfileAppearance\(currentUser, profileDraft\)/);
  assert.match(settings, /visible=\{profileEditorOpen\}/);
  assert.match(settings, /visible=\{profileEditorOpen\} transparent animationType="none"/);
  assert.match(settings, />Edit your profile</);
});

test('Settings editors do not redraw the native scroll view on each keystroke', () => {
  const settings = shell.slice(shell.indexOf('function ConnectionsScreen'), shell.indexOf('function CinematicTabPage'));
  const cachedPageStart = settings.indexOf('const settingsScrollView = useMemo');
  const cachedPageEnd = settings.indexOf('return (', cachedPageStart);
  const cachedPage = settings.slice(cachedPageStart, cachedPageEnd);

  assert.ok(cachedPageStart >= 0, 'Settings should cache the visible scroll view separately from its editors');
  assert.match(settings, /\{settingsScrollView\}[\s\S]*?<OverlayModal visible=\{Boolean\(savedPlaceEditor\)\}/);
  assert.doesNotMatch(cachedPage, /savedPlaceAddress|profileDraft|savedPlaceBusy|profileAvatarBusy/);
});

test('the shared editor sheet ignores transient iOS key-preview frame changes', () => {
  const overlay = shell.slice(shell.indexOf('function OverlayModal'), shell.indexOf('function OverviewMetrics'));

  assert.match(overlay, /Keyboard\.addListener\('keyboardDidShow'/);
  assert.match(overlay, /setKeyboardHeight\(Math\.max\(0, event\.endCoordinates\.height\)\)/);
  assert.doesNotMatch(overlay, /<KeyboardAvoidingView|keyboardWillChangeFrame/);
});
