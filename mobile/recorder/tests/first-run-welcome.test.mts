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

function load(themeId: 'dark' | 'light' | 'sakura' | 'redline') {
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

test('static welcome uses each theme, no app logo, one action, and no automatic advance', async () => {
  assert.doesNotMatch(source, /Animated|setTimeout|setInterval|useEffect|autoplay|JourneyOpening/);
  const artwork = {
    dark: '../assets/onboarding-road-background.png',
    light: '../assets/home-header-light-v1.png',
    sakura: '../assets/theme-rosewater-road-v1.png',
    redline: '../assets/onboarding-grand-touring-blue-hour.jpg',
  };
  for (const themeId of ['dark', 'light', 'sakura', 'redline'] as const) {
    let starts = 0, tree: any;
    const Welcome = load(themeId);
    try {
      await act(() => { tree = create(React.createElement(Welcome, { onStart: () => { starts++; } })); });
      const images = tree.root.findAllByType('Image');
      assert.equal(images.length, 1, 'only the background artwork remains');
      assert.equal(images.find((node: any) => node.props.testID === 'welcome-road-artwork').props.source, artwork[themeId]);
      const labels = tree.root.findAllByType('Text').map((node: any) => node.children.join(''));
      assert.ok(labels.includes('JourneyDeck'));
      assert.ok(labels.includes('Every mile has a story.'));
      assert.equal(labels.filter((label: string) => label === 'Get Started').length, 1);
      const start = tree.root.findByProps({ accessibilityLabel: 'Start JourneyDeck setup' });
      assert.equal(start.props.accessibilityRole, 'button');
      await act(() => start.props.onPress());
      assert.equal(starts, 1);
    } finally { await act(() => tree?.unmount()); }
  }
});
