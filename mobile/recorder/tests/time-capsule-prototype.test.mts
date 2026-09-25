import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const navigation = readFileSync(new URL('../src/native-navigation.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const ipadSettings = readFileSync(new URL('../src/ipad-settings-screen.tsx', import.meta.url), 'utf8');
const primarySections = readFileSync(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');

test('the obsolete standalone Markers settings page and route are removed', () => {
  assert.doesNotMatch(navigation, /time-capsule-prototype/);
  assert.doesNotMatch(shell, /markers-prototype-entry|onMarkersPrototype|time-capsule-prototype/);
  assert.doesNotMatch(ipadSettings, /onMarkersPrototype|ipad-markers-prototype-entry/);
  assert.equal(existsSync(new URL('../app/time-capsule-prototype.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/markers-library-screen.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/time-capsule-prototype.tsx', import.meta.url)), false);
});

test('back navigation uses icon-only chevrons and native minimal stack buttons', () => {
  assert.match(navigation, /headerBackButtonDisplayMode: 'minimal'/);
  assert.doesNotMatch(shell, /‹\s*\{backLabel\}/);
  assert.match(shell, /accessibilityLabel="Back"[\s\S]*name="chevron\.left"/);
  assert.doesNotMatch(primarySections, /‹\s*\{leadingAction\.label\}/);
  assert.match(primarySections, /accessibilityLabel=\{leadingAction\.label\}[\s\S]*name="chevron\.left"/);
});
