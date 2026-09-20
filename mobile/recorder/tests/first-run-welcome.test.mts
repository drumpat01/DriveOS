import { testTheme } from './theme-fixture.mts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const source = readFileSync(new URL('../src/first-run-welcome-screen.tsx', import.meta.url), 'utf8');

function load(themeId: 'dark' | 'light' | 'sakura' | 'redline' | 'midnight-canopy') {
  const module = { exports: {} as any };
  const native = {
    StyleSheet: { create: (value: any) => value, absoluteFill: { position: 'absolute' } },
    View: host('View'), Text: host('Text'), Pressable: host('Pressable'), ScrollView: host('ScrollView'),
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
    if (id.startsWith('../assets/')) return id;
    if (id === 'react-native') return native;
    if (id === 'expo-image') return { Image: host('Image') };
    if (id === 'expo-linear-gradient') return { LinearGradient: host('Gradient') };
    if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) };
    if (id === './app-theme') return { useAppTheme: () => testTheme(themeId) };
    return require(id);
  } });
  return module.exports.FirstRunWelcomeScreen;
}

test('static welcome makes the private route, music, and memory value clear with one action', async () => {
  assert.doesNotMatch(source, /Animated|setTimeout|setInterval|useEffect|autoplay|JourneyOpening/);
  const artwork = {
    dark: '../assets/onboarding-road-background.png',
    light: '../assets/home-header-light-v1.png',
    sakura: '../assets/theme-rosewater-road-v1.png',
    redline: '../assets/onboarding-grand-touring-blue-hour.jpg',
    'midnight-canopy': '../assets/theme-midnight-canopy-v1.png',
  };
  for (const themeId of ['dark', 'light', 'sakura', 'redline', 'midnight-canopy'] as const) {
    let starts = 0, tree: any;
    const Welcome = load(themeId);
    try {
      await act(() => { tree = create(React.createElement(Welcome, { onStart: () => { starts++; } })); });
      const images = tree.root.findAllByType('Image');
      assert.equal(images.length, 1, 'only the background artwork remains');
      assert.equal(images.find((node: any) => node.props.testID === 'welcome-road-artwork').props.source, artwork[themeId]);
      const labels = tree.root.findAllByType('Text').map((node: any) => node.children.join(''));
      assert.ok(labels.includes('JOURNEYDECK'));
      assert.ok(labels.includes('Your drives,\nremembered.'));
      assert.ok(labels.includes('Record the route, match the music you played, and keep the moments in one private road archive.'));
      assert.ok(labels.includes('Private by design. Your roads stay on this iPhone and in your iCloud.'));
      assert.equal(labels.filter((label: string) => label === 'Set up JourneyDeck').length, 1);
      assert.equal(tree.root.findAllByType('Pressable').length, 1);
      const start = tree.root.findByProps({ accessibilityLabel: 'Start JourneyDeck setup' });
      assert.equal(start.props.accessibilityRole, 'button');
      await act(() => start.props.onPress());
      assert.equal(starts, 1);
    } finally { await act(() => tree?.unmount()); }
  }
});
