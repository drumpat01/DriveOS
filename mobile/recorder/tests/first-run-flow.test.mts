import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { testTheme } from './theme-fixture.mts';
const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(file: string, mocks: Record<string, any>) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module, exports: module.exports, require: (name: string) => name in mocks ? mocks[name] : name.startsWith('../assets/') ? name : require(name) });
  return module.exports;
}
test('location access requests foreground before background and handles denial without starting recording', async () => {
  for (const denial of ['none', 'foreground', 'background', 'blocked']) {
    const calls: string[] = [];
    const { requestJourneyLocationAccess } = load('location-permissions.ts', {
      'expo-location': {
        requestForegroundPermissionsAsync: async () => { calls.push('foreground'); return { status: denial === 'foreground' || denial === 'blocked' ? 'denied' : 'granted', canAskAgain: denial !== 'blocked' }; },
        requestBackgroundPermissionsAsync: async () => { calls.push('background'); return { status: denial === 'background' ? 'denied' : 'granted', canAskAgain: true }; },
      },
      'react-native': { Alert: { alert: () => calls.push('alert') }, Linking: { openSettings: () => {} } },
    });
    assert.equal(await requestJourneyLocationAccess(), denial === 'none');
    assert.deepEqual(calls, denial === 'none' ? ['foreground', 'background'] : denial === 'background' ? ['foreground', 'background', 'alert'] : ['foreground', 'alert']);
  }
});
test('saved location stage resumes and completed users stay complete', () => {
  let stored: any;
  const api = load('first-run-onboarding.ts', { './auth': { getCurrentUser: () => ({ id: 'test' }) }, './local-store': {
    getPrivatePreference: () => stored, upsertPrivatePreference: (_user: string, _key: string, value: any) => { stored = value; },
  } });
  api.saveFirstRunProgress({ stage: 'location', recordingMode: 'manual' });
  assert.equal(api.loadFirstRunProgress().stage, 'location');
  api.completeFirstRun('manual');
  assert.equal(api.loadFirstRunProgress().stage, 'complete');
});
test('content exits before the next step enters while artwork stays mounted; Reduce Motion settles immediately', async () => {
  for (const reduced of [false, true]) {
    const pending: Array<() => void> = [];
    const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
    const native = { View: host('View'), Text: host('Text'), ScrollView: host('ScrollView'), Pressable: host('Pressable'),
      useWindowDimensions: () => ({ width: 390, height: 844 }), StyleSheet: { create: (s: any) => s, absoluteFill: {} } };
    const Screen = load('first-run-onboarding-screen.tsx', {
      'react-native': native,
      './app-theme': { useAppTheme: () => testTheme('redline') },
      './motion': { useMotionPreferences: () => ({ reduceMotion: reduced, isAppActive: true }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 54, bottom: 34 }) },
      'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
      'expo-symbols': { SymbolView: host('Symbol') },
      './first-run-welcome-screen': { FirstRunWelcomeScreen: host('Welcome'), FIRST_RUN_ARTWORK: { redline: 'road' } },
      './release-features': { TESSIE_INTEGRATION_ENABLED: false },
      'react-native-worklets': { scheduleOnRN: (fn: any, ...args: any[]) => fn(...args) },
      'react-native-reanimated': { __esModule: true, default: { View: host('AnimatedView') }, Easing: { bezier: () => {} },
        useSharedValue: (initial: number) => React.useRef({ value: initial, get() { return this.value; }, set(v: any) { this.value = v; } }).current,
        useAnimatedStyle: (fn: any) => fn(), cancelAnimation: () => {},
        withTiming: (value: number, _config: any, done: any) => { pending.push(() => done(true)); return value; },
      },
    }).FirstRunOnboardingScreen;
    const props = { onWelcomeComplete() {}, async onRecordingContinue() {}, async onLocationContinue() {}, async onConnectAppleMusic() {}, onSkipMusic() {}, onFinish() {} };
    let tree: any;
    await act(() => { tree = create(React.createElement(Screen, { ...props, stage: 'recording' })); });
    const artwork = tree.root.findByType('Image');
    await act(() => tree.update(React.createElement(Screen, { ...props, stage: 'location' })));
    if (!reduced) {
      assert.equal(tree.root.findAllByProps({ accessibilityLabel: 'Step 3 of 6' }).length, 0);
      assert.equal(tree.root.findByType('AnimatedView').props.pointerEvents, 'none');
      await act(() => pending.shift()!());
      assert.ok(tree.root.findAllByProps({ accessibilityLabel: 'Step 3 of 6' }).length);
      await act(() => pending.shift()!());
    }
    assert.ok(tree.root.findAllByProps({ accessibilityLabel: 'Step 3 of 6' }).length);
    assert.equal(tree.root.findByType('Image'), artwork);
    assert.equal(tree.root.findByType('AnimatedView').props.pointerEvents, 'auto');
    assert.equal(pending.length, 0);
    await act(() => tree.unmount());
  }
});
