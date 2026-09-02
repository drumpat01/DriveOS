import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', projectRoot), 'utf8'));
const appJson = JSON.parse(await readFile(new URL('app.json', projectRoot), 'utf8'));
const membershipModule = await readFile(new URL('modules/journeydeck-membership/ios/JourneyDeckMembershipModule.swift', projectRoot), 'utf8');
const membershipConfig = JSON.parse(await readFile(new URL('modules/journeydeck-membership/expo-module.config.json', projectRoot), 'utf8'));

const requiredCapabilities = [
  '@expo/ui',
  '@shopify/flash-list',
  '@shopify/react-native-skia',
  '@maplibre/maplibre-react-native',
  'babel-plugin-react-compiler',
  'expo-blur',
  'expo-glass-effect',
  'expo-haptics',
  'expo-image',
  'expo-linear-gradient',
  'expo-mesh-gradient',
  'expo-observe',
  'expo-apple-authentication',
  'expo-splash-screen',
  'expo-symbols',
  'expo-system-ui',
  'react-native-gesture-handler',
  'react-native-keyboard-controller',
  'react-native-pager-view',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-svg',
  'react-native-worklets',
] as const;

test('the 1.9 native runtime contains the complete native foundation', () => {
  assert.equal(packageJson.version, '1.9.0');
  assert.equal(appJson.expo.version, '1.9.0');
  assert.equal(appJson.expo.runtimeVersion, '1.9.0-build13');
  assert.equal(appJson.expo.experiments?.reactCompiler, true);

  for (const dependency of requiredCapabilities) {
    assert.ok(packageJson.dependencies?.[dependency], `${dependency} must remain compiled into the native runtime`);
  }

  assert.ok(appJson.expo.plugins.includes('@maplibre/maplibre-react-native'), 'MapLibre config plugin must remain enabled');
  assert.ok(appJson.expo.plugins.includes('expo-apple-authentication'), 'Sign in with Apple config plugin must remain enabled');
  assert.equal(appJson.expo.ios?.usesAppleSignIn, true, 'the iOS build must carry the Sign in with Apple capability');
});

test('future design capabilities do not add unrelated privacy permissions', () => {
  const infoPlist = appJson.expo.ios?.infoPlist ?? {};
  assert.deepEqual(Object.keys(infoPlist).sort(), [
    'NSAppleMusicUsageDescription',
    'NSMicrophoneUsageDescription',
  ]);
});

test('Build 13 retains the fail-closed StoreKit membership verifier', () => {
  assert.deepEqual(membershipConfig.apple?.modules, ['JourneyDeckMembershipModule']);
  assert.match(membershipModule, /Transaction\.currentEntitlements/);
  assert.match(membershipModule, /case \.verified\(let transaction\)/);
  assert.match(membershipModule, /Transaction\.updates/);
  assert.match(membershipModule, /try await AppStore\.sync\(\)/);
  assert.match(membershipModule, /com\.journeydeck\.recorder\.pro\.monthly/);
  assert.match(membershipModule, /com\.journeydeck\.recorder\.pro\.annual/);
});
