import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

import * as icons from '../src/app-icon-catalog.ts';
import { themeCatalog } from '../src/theme-catalog.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);

function loadPicker(state: {
  appIconId: icons.AppIconId;
  availability: 'checking' | 'ready' | 'requires-build' | 'unsupported';
  changing: boolean;
  selections: string[];
  alerts: string[];
  fail: boolean;
  colorScheme: 'light' | 'dark';
}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL('../src/app-icon-picker.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const assets = Object.fromEntries(['icon-cinematic-dark-v2.png', 'icon-warm-ivory-v2.png', 'icon-rosewater-v2.png', 'icon-grand-touring-v2.png', 'icon-midnight-canopy-v1.png', 'icon-cinematic-dark-appearance-v1.png', 'icon-warm-ivory-dark-v1.png', 'icon-rosewater-dark-v1.png', 'icon-grand-touring-dark-v1.png', 'icon-midnight-canopy-dark-v1.png']
    .map((name, index) => [`../assets/${name}`, index + 1]));
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id: string) => ({
      ...assets,
      './app-theme': { useAppTheme: () => ({ ...themeCatalog.redline, id: 'redline' }) },
      './app-icon-catalog': icons,
      './release-features': { V3_MIDNIGHT_CANOPY_ENABLED: false },
      './app-icon-preference': { useAppIconChoice: () => ({
        appIconId: state.appIconId,
        availability: state.availability,
        changing: state.changing,
        setAppIcon: async (next: string) => {
          if (state.fail) throw new Error('native icon failed');
          state.selections.push(next);
        },
      }) },
      'react-native': {
        Alert: { alert: (title: string) => state.alerts.push(title) },
        useColorScheme: () => state.colorScheme,
        StyleSheet: { create: (value: any) => value },
        View: host('View'), Text: host('Text'), Pressable: host('Pressable'),
      },
      'expo-image': { Image: host('Image') },
      'expo-symbols': { SymbolView: host('Symbol') },
    } as Record<string, any>)[id] ?? require(id),
  });
  return module.exports;
}

async function mount(membershipTier: 'free' | 'paid' = 'free', availability: 'checking' | 'ready' | 'requires-build' | 'unsupported' = 'ready') {
  const state = { appIconId: 'grand-touring' as icons.AppIconId, availability, changing: false, selections: [] as string[], alerts: [] as string[], fail: false, colorScheme: 'light' as const };
  const api = loadPicker(state);
  let upgrades = 0;
  let tree: any;
  await act(() => { tree = create(React.createElement(api.AppIconPicker, { membershipTier, onUpgrade: () => { upgrades += 1; } })); });
  return {
    tree,
    state,
    upgrades: () => upgrades,
    cards: () => tree.root.findAllByType('Pressable'),
    unmount: async () => act(() => tree.unmount()),
  };
}

test('app icon grid orders two free icons above two Plus icons', async () => {
  assert.deepEqual([...icons.FREE_APP_ICON_IDS], ['grand-touring', 'warm-ivory']);
  assert.deepEqual([...icons.PLUS_APP_ICON_IDS], ['original', 'rosewater']);
  assert.deepEqual([...icons.APP_ICON_GRID_ORDER], ['grand-touring', 'warm-ivory', 'original', 'rosewater']);
  assert.equal(icons.appIconRequiresPlus('original'), true);
  assert.equal(icons.appIconRequiresPlus('rosewater'), true);
  assert.equal(icons.appIconRequiresPlus('grand-touring'), false);
  const harness = await mount();
  try {
    assert.deepEqual(harness.cards().map((card: any) => card.props.testID), [
      'app-icon-grand-touring', 'app-icon-warm-ivory', 'app-icon-original', 'app-icon-rosewater',
    ]);
    assert.equal(harness.tree.root.findByProps({ testID: 'app-icon-row-free' }).findAllByType('Pressable').length, 2);
    assert.equal(harness.tree.root.findByProps({ testID: 'app-icon-row-plus' }).findAllByType('Pressable').length, 2);
  } finally { await harness.unmount(); }
});

test('free icon taps apply and Plus icon taps open membership', async () => {
  const harness = await mount('free');
  try {
    const warmIvory = harness.cards().find((card: any) => card.props.testID === 'app-icon-warm-ivory');
    const rosewater = harness.cards().find((card: any) => card.props.testID === 'app-icon-rosewater');
    await act(async () => { warmIvory.props.onPress(); await Promise.resolve(); });
    assert.deepEqual(harness.state.selections, ['warm-ivory']);
    await act(async () => { rosewater.props.onPress(); await Promise.resolve(); });
    assert.equal(harness.upgrades(), 1);
    assert.deepEqual(harness.state.selections, ['warm-ivory']);
    assert.match(rosewater.props.accessibilityLabel, /Requires JourneyDeck Plus/);
    assert.equal(rosewater.props.accessibilityHint, 'Opens JourneyDeck Plus');
  } finally { await harness.unmount(); }
});

test('paid users can select Plus icons and native failures are reported', async () => {
  const harness = await mount('paid');
  try {
    const original = harness.cards().find((card: any) => card.props.testID === 'app-icon-original');
    await act(async () => { original.props.onPress(); await Promise.resolve(); });
    assert.deepEqual(harness.state.selections, ['original']);
    harness.state.fail = true;
    const rosewater = harness.cards().find((card: any) => card.props.testID === 'app-icon-rosewater');
    await act(async () => { rosewater.props.onPress(); await Promise.resolve(); });
    assert.deepEqual(harness.state.alerts, ['App icon not changed']);
  } finally { await harness.unmount(); }
});

test('icon cards remain direct radio controls and allow text to grow', async () => {
  const harness = await mount('paid');
  try {
    const cards = harness.cards();
    assert.equal(cards.length, 4);
    assert.equal(cards.filter((card: any) => card.props.accessibilityState.checked).length, 1);
    for (const [index, id] of icons.APP_ICON_GRID_ORDER.entries()) {
      const card = cards.find((candidate: any) => candidate.props.testID === `app-icon-${id}`);
      assert.equal(card.props.accessibilityRole, 'radio');
      assert.match(card.props.accessibilityLabel, new RegExp(`${icons.appIconCatalog[id].name}, app icon ${index + 1} of 4`));
    }
    assert.ok(harness.tree.root.findAllByType('Text').every((node: any) => node.props.numberOfLines === undefined));
  } finally { await harness.unmount(); }
});

test('unavailable native icon support disables all four cards', async () => {
  const harness = await mount('free', 'requires-build');
  try {
    for (const card of harness.cards()) {
      assert.equal(card.props.disabled, true);
      assert.equal(card.props.accessibilityState.disabled, true);
    }
  } finally { await harness.unmount(); }
});

test('icon previews follow the device light and dark appearance', async () => {
  const harness = await mount('paid');
  try {
    const preview = () => harness.tree.root.findAllByType('Image')[0];
    assert.equal(preview().props.source, 4, 'light appearance uses the existing Grand Touring icon');
    harness.state.colorScheme = 'dark';
    await act(() => harness.tree.update(React.createElement(loadPicker(harness.state).AppIconPicker, { membershipTier: 'paid' })));
    assert.equal(preview().props.source, 9, 'dark appearance uses the approved Grand Touring dark variant');
  } finally { await harness.unmount(); }
});
