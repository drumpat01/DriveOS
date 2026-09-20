import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

import * as catalog from '../src/theme-catalog.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const host = (name: string) => React.forwardRef(function Host({ children, ...props }: any, ref: any) {
  return React.createElement(name, { ...props, ref }, children);
});

function loadThemePicker(options: {
  includeAutumn?: boolean;
  initial?: catalog.ThemeId;
  fail?: { current: boolean };
  setThemes?: string[];
  transitions?: { id: string; origin: { x: number; y: number } }[];
  alerts?: string[];
}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL('../src/theme-picker.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const initial = options.initial ?? 'redline';
  const assets = Object.fromEntries([
    'cinematic-home-main-photo-v1.jpg',
    'home-header-light-v1.png',
    'theme-rosewater-road-v1.png',
    'theme-grand-touring-home-v2.png',
    'theme-midnight-canopy-v1.png',
  ].map((name, index) => [`../assets/${name}`, index + 1]));
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id: string) => ({
      ...assets,
      './theme-catalog': catalog,
      './release-features': { V3_MIDNIGHT_CANOPY_ENABLED: options.includeAutumn ?? false },
      './app-theme': { useThemeChoice: () => ({
        theme: { ...catalog.themeCatalog[initial], id: initial },
        setTheme: (id: string) => options.setThemes?.push(id),
        transitionTheme: (id: string, origin: { x: number; y: number }) => {
          if (options.fail?.current) throw new Error('secure persistence failed');
          options.transitions?.push({ id, origin: { ...origin } });
        },
      }) },
      'react-native': {
        StyleSheet: { create: (value: any) => value, absoluteFill: {} },
        Alert: { alert: (title: string) => options.alerts?.push(title) },
        View: host('View'), Text: host('Text'), Pressable: host('Pressable'),
      },
      'expo-image': { Image: host('Image') },
      'expo-linear-gradient': { LinearGradient: host('Gradient') },
      'expo-symbols': { SymbolView: host('Symbol') },
    } as Record<string, any>)[id] ?? require(id),
  });
  return module.exports;
}

async function mount(options: { initial?: catalog.ThemeId; membershipTier?: 'free' | 'paid'; includeAutumn?: boolean } = {}) {
  const transitions: { id: string; origin: { x: number; y: number } }[] = [];
  const setThemes: string[] = [];
  const alerts: string[] = [];
  const fail = { current: false };
  let upgrades = 0;
  let surroundingMounts = 0;
  const api = loadThemePicker({ initial: options.initial, includeAutumn: options.includeAutumn, transitions, setThemes, alerts, fail });
  function Screen() {
    React.useEffect(() => { surroundingMounts += 1; }, []);
    return React.createElement('RecorderScreen', null, React.createElement(api.ThemePicker, {
      membershipTier: options.membershipTier ?? 'paid',
      onUpgrade: () => { upgrades += 1; },
    }));
  }
  let tree: any;
  await act(() => { tree = create(React.createElement(Screen), {
    createNodeMock: () => ({ measureInWindow: (callback: (...args: number[]) => void) => callback(40, 120, 160, 80) }),
  }); });
  return {
    tree,
    transitions,
    setThemes,
    alerts,
    fail,
    upgrades: () => upgrades,
    mounts: () => surroundingMounts,
    cards: () => tree.root.findAllByType('Pressable'),
    unmount: async () => act(() => tree.unmount()),
  };
}

test('theme grid orders two free cards above two Plus cards with no carousel control', async () => {
  assert.deepEqual([...catalog.FREE_THEME_IDS], ['redline', 'light']);
  assert.deepEqual([...catalog.PLUS_THEME_IDS], ['dark', 'sakura']);
  assert.deepEqual([...catalog.THEME_GRID_ORDER], ['redline', 'light', 'dark', 'sakura']);
  const harness = await mount();
  try {
    assert.deepEqual(harness.cards().map((card: any) => card.props.testID), [
      'theme-card-redline', 'theme-card-light', 'theme-card-dark', 'theme-card-sakura',
    ]);
    assert.equal(harness.tree.root.findByProps({ testID: 'theme-row-free' }).findAllByType('Pressable').length, 2);
    assert.equal(harness.tree.root.findByProps({ testID: 'theme-row-plus' }).findAllByType('Pressable').length, 2);
    assert.equal(harness.tree.root.findAllByType('FlatList').length, 0);
    assert.equal(harness.tree.root.findAllByType('ScrollView').length, 0);
    assert.equal(harness.tree.root.findAllByProps({ testID: 'theme-adjustable' }).length, 0);
  } finally { await harness.unmount(); }
});

test('free theme taps apply immediately while Plus taps open membership', async () => {
  const harness = await mount({ membershipTier: 'free' });
  try {
    const cards = harness.cards();
    const light = cards.find((card: any) => card.props.testID === 'theme-card-light');
    const dark = cards.find((card: any) => card.props.testID === 'theme-card-dark');
    assert.doesNotMatch(light.props.accessibilityLabel, /Requires JourneyDeck Plus/);
    assert.equal(light.props.accessibilityHint, 'Applies this theme');
    await act(() => light.props.onPress({ nativeEvent: { pageX: 74, pageY: 210 } }));
    assert.deepEqual(harness.transitions, [{ id: 'light', origin: { x: 74, y: 210 } }]);
    await act(() => dark.props.onPress({ nativeEvent: { pageX: 90, pageY: 300 } }));
    assert.equal(harness.upgrades(), 1);
    assert.equal(harness.transitions.length, 1);
    assert.match(dark.props.accessibilityLabel, /Requires JourneyDeck Plus/);
    assert.equal(dark.props.accessibilityHint, 'Opens JourneyDeck Plus');
    assert.equal(harness.mounts(), 1, 'selection does not remount the surrounding recorder');
  } finally { await harness.unmount(); }
});

test('paid users can activate all four cards and coordinate-free activation uses the card center', async () => {
  const harness = await mount({ membershipTier: 'paid' });
  try {
    const cards = harness.cards();
    for (const card of cards) {
      assert.equal(card.props.accessibilityRole, 'radio');
      assert.doesNotMatch(card.props.accessibilityLabel, /Requires JourneyDeck Plus/);
    }
    const rosewater = cards.find((card: any) => card.props.testID === 'theme-card-sakura');
    await act(() => rosewater.props.onPress({ nativeEvent: { pageX: 0, pageY: 0 } }));
    assert.deepEqual(harness.transitions.at(-1), { id: 'sakura', origin: { x: 120, y: 160 } });
  } finally { await harness.unmount(); }
});

test('a locked restored theme normalizes to Grand Touring for a free membership', async () => {
  const harness = await mount({ initial: 'dark', membershipTier: 'free' });
  try {
    assert.deepEqual(harness.setThemes, ['redline']);
  } finally { await harness.unmount(); }
});

test('theme persistence failure keeps the current selection and reports the failure', async () => {
  const harness = await mount({ initial: 'light', membershipTier: 'paid' });
  try {
    harness.fail.current = true;
    const redline = harness.cards().find((card: any) => card.props.testID === 'theme-card-redline');
    await act(() => redline.props.onPress({ nativeEvent: { pageX: 70, pageY: 190 } }));
    assert.deepEqual(harness.alerts, ['Appearance not saved']);
    assert.equal(harness.transitions.length, 0);
    const selected = harness.cards().filter((card: any) => card.props.accessibilityState.selected);
    assert.deepEqual(selected.map((card: any) => card.props.testID), ['theme-card-light']);
  } finally { await harness.unmount(); }
});

test('all important grid copy can grow for Dynamic Type', async () => {
  const harness = await mount();
  try {
    assert.equal(harness.cards().length, 4);
    for (const [index, id] of catalog.THEME_GRID_ORDER.entries()) {
      const card = harness.cards().find((candidate: any) => candidate.props.testID === `theme-card-${id}`);
      assert.match(card.props.accessibilityLabel, new RegExp(`${catalog.themeCatalog[id].name}, theme ${index + 1} of 4`));
      assert.match(card.props.accessibilityLabel, new RegExp(catalog.themeCatalog[id].description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    const textNodes = harness.tree.root.findAllByType('Text');
    assert.ok(textNodes.every((node: any) => node.props.numberOfLines === undefined));
  } finally { await harness.unmount(); }
});

test('V3 Autumn is a standard free card and animates from touch or accessibility activation', async () => {
  const harness = await mount({ includeAutumn: true, membershipTier: 'free' });
  try {
    const free = harness.tree.root.findByProps({ testID: 'theme-row-free' });
    const card = free.findByProps({ testID: 'theme-card-midnight-canopy' });
    assert.equal(free.findAllByType('Pressable').length, 3);
    assert.equal(harness.tree.root.findAllByProps({ testID: 'theme-row-preview' }).length, 0);
    assert.deepEqual(harness.cards().map((c: any) => c.props.testID), ['theme-card-redline', 'theme-card-light', 'theme-card-midnight-canopy', 'theme-card-dark', 'theme-card-sakura']);
    assert.match(card.props.accessibilityLabel, /Autumn Drive, theme 3 of 5/);
    assert.doesNotMatch(card.props.accessibilityLabel, /Requires JourneyDeck Plus/);
    await act(() => card.props.onPress({ nativeEvent: { pageX: 85, pageY: 380 } }));
    await act(() => card.props.onPress({ nativeEvent: { pageX: 0, pageY: 0 } }));
    assert.deepEqual(harness.transitions, [
      { id: 'midnight-canopy', origin: { x: 85, y: 380 } },
      { id: 'midnight-canopy', origin: { x: 120, y: 160 } },
    ]);
    assert.deepEqual(harness.setThemes, [], 'selection must use the animated API, never the immediate setter');
    assert.equal(harness.upgrades(), 0);
    assert.equal(harness.mounts(), 1);
  } finally { await harness.unmount(); }
  const restored = await mount({ includeAutumn: true, initial: 'midnight-canopy', membershipTier: 'free' });
  try {
    const card = restored.cards().find((c: any) => c.props.testID === 'theme-card-midnight-canopy');
    assert.equal(card.props.accessibilityState.selected, true);
    await act(() => card.props.onPress({ nativeEvent: { pageX: 85, pageY: 380 } }));
    assert.equal(restored.transitions.length, 0, 'reselecting Autumn does not replay the transition');
    assert.deepEqual(restored.setThemes, [], 'restored Autumn remains available to free members');
  } finally { await restored.unmount(); }
});
