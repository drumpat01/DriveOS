import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = await readFile(new URL('../src/time-capsule-prototype.tsx', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/time-capsule-prototype.tsx', import.meta.url), 'utf8');
const navigation = await readFile(new URL('../src/native-navigation.tsx', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const ipadSettings = await readFile(new URL('../src/ipad-settings-screen.tsx', import.meta.url), 'utf8');
const releaseFeatures = await readFile(new URL('../src/release-features.ts', import.meta.url), 'utf8');
const appConfig = await readFile(new URL('../app.config.js', import.meta.url), 'utf8');
test('Markers use the standard native header and ordinary scroll content', () => {
  assert.match(navigation, /name="time-capsule-prototype" options=\{\{ title: 'Markers', headerShown: true \}\}/);
  assert.match(screen, /testID="markers-standard-header"/);
  assert.match(screen, /<ScrollView testID="markers-scroll"/);
  assert.doesNotMatch(screen, /HeaderMotion|useMotionProgress|useAnimatedStyle|interpolate\(/);
  for (const color of ['#081832', '#203a63', '#132d55', '#f6f0e2', '#d4b15a', '#2f6b57']) assert.match(screen, new RegExp(color));
});

test('prototype models hands-free capture, a distinct route pin, and later enrichment without future reminders', () => {
  assert.match(screen, /Hey Siri, create a marker in JourneyDeck/);
  assert.match(screen, /Markers use a polaroid pin/);
  assert.match(screen, /Add photos/);
  assert.match(screen, /Voice memo/);
  assert.doesNotMatch(screen, /one year|five years|Choose a date|resurfac/i);
});

test('prototype is isolated to V3 and performs no persistence, recording, location, or network work', () => {
  assert.match(appConfig, /markerPrototype: v3/);
  assert.match(releaseFeatures, /V3_MARKERS_PROTOTYPE_ENABLED/);
  assert.match(screen, /if \(!V3_MARKERS_PROTOTYPE_ENABLED\)/);
  assert.match(shell, /V3_MARKERS_PROTOTYPE_ENABLED && <TouchPressable/);
  assert.match(ipadSettings, /p\.onMarkersPrototype &&/);
  assert.match(navigation, /name="time-capsule-prototype"/);
  assert.match(route, /MarkersLibraryScreen as default/);
  assert.doesNotMatch(screen, /appDataClient|expo-location|expo-audio|fetch\(|FileSystem|SecureStore|SQLite/);
  assert.match(screen, /does not yet record, import, or persist media/);
});
