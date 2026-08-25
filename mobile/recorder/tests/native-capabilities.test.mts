import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', projectRoot), 'utf8'));
const appJson = JSON.parse(await readFile(new URL('app.json', projectRoot), 'utf8'));

const requiredCapabilities = [
  '@expo/ui',
  '@shopify/flash-list',
  '@shopify/react-native-skia',
  'babel-plugin-react-compiler',
  'expo-blur',
  'expo-glass-effect',
  'expo-haptics',
  'expo-image',
  'expo-linear-gradient',
  'expo-mesh-gradient',
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

test('the 1.6 native runtime contains the complete OTA design foundation', () => {
  assert.equal(packageJson.version, '1.6.0');
  assert.equal(appJson.expo.version, '1.6.0');
  assert.deepEqual(appJson.expo.runtimeVersion, { policy: 'appVersion' });
  assert.equal(appJson.expo.experiments?.reactCompiler, true);

  for (const dependency of requiredCapabilities) {
    assert.ok(packageJson.dependencies?.[dependency], `${dependency} must remain compiled into the native runtime`);
  }
});

test('future design capabilities do not add unrelated privacy permissions', () => {
  const infoPlist = appJson.expo.ios?.infoPlist ?? {};
  assert.deepEqual(Object.keys(infoPlist).sort(), [
    'NSAppleMusicUsageDescription',
    'NSMicrophoneUsageDescription',
  ]);
});
