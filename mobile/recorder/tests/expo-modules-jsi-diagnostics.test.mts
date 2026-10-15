import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { EXPO_MODULES_JSI_DIAGNOSTIC_PROFILES } from '../scripts/diagnose-expo-modules-jsi.mjs';

test('production removes the ExpoModulesJSI -quiet flag that Xcode 27.0 fails on', () => {
  assert.deepEqual(EXPO_MODULES_JSI_DIAGNOSTIC_PROFILES, ['v3-testflight', 'v4-testflight', 'production']);
  const installed = readFileSync(new URL('../node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh', import.meta.url), 'utf8');
  assert.equal([...installed.matchAll(/^    -quiet \\\r?\n/gm)].length, 1);
  const hook = readFileSync(new URL('../scripts/diagnose-expo-modules-jsi.mjs', import.meta.url), 'utf8');
  assert.match(hook, /expo\/expo#50311/);
});
