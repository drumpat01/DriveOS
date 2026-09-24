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
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const native = { StyleSheet: { create: (value: any) => value }, ...Object.fromEntries(['View', 'Text', 'Pressable'].map(name => [name, host(name)])) };
const module = { exports: {} as any };
const source = readFileSync(new URL('../src/tessie-home-widgets.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, {
  module, exports: module.exports,
  require: (id: string) => id === 'react-native' ? native
    : id === 'expo-symbols' ? { SymbolView: host('Symbol') }
      : id === './app-theme' ? { useAppTheme: () => testTheme('dark') }
        : id === './journeydeck-design-tokens' ? { journeyDeckSemanticColors: () => ({ surfaceRaised: '#111', separator: '#333', text: '#fff', textSecondary: '#aaa', accent: '#8b6cff' }) }
          : id === './native-sheet' ? { NativeSheet: host('NativeSheet') }
            : require(id),
});
const widgets = module.exports;
const visibleText = (tree: any) => tree.root.findAllByType('Text').map((node: any) => node.children.join('')).join('|');

test('vehicle reading age distinguishes fresh, stale, and unavailable snapshots', () => {
  const now = Date.parse('2026-09-22T17:00:00.000Z');
  assert.deepEqual(JSON.parse(JSON.stringify(widgets.vehicleReadingAge('2026-09-22T16:59:30.000Z', now))), { label: 'Updated just now', stale: false });
  assert.deepEqual(JSON.parse(JSON.stringify(widgets.vehicleReadingAge('2026-09-22T16:29:00.000Z', now))), { label: 'Updated 31m ago · stale', stale: true });
  assert.deepEqual(JSON.parse(JSON.stringify(widgets.vehicleReadingAge(null, now))), { label: 'Reading time unavailable', stale: true });
});

test('Your car has stable card sizing for loading, disconnected, and connected stale-data states', async () => {
  const vehicle = { vehicleKey: 'v1', name: 'Model Y', status: 'online', batteryPercent: 68, rangeMiles: 191, chargingState: null, odometerMiles: 10, updatedAt: new Date(Date.now() - 60 * 60_000).toISOString() };
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(widgets.YourCarWidget, { vehicles: [], loading: true, failed: false })); });
    const height = Object.assign({}, ...tree.root.findByProps({ testID: 'home-tessie-your-car' }).props.style).minHeight;
    assert.match(visibleText(tree), /Loading your car/);
    await act(() => tree.update(React.createElement(widgets.YourCarWidget, { vehicles: [], loading: false, failed: false })));
    assert.match(visibleText(tree), /Connect Tessie in Settings/);
    assert.equal(Object.assign({}, ...tree.root.findByProps({ testID: 'home-tessie-your-car' }).props.style).minHeight, height);
    await act(() => tree.update(React.createElement(widgets.YourCarWidget, { vehicles: [vehicle], loading: false, failed: true })));
    assert.match(visibleText(tree), /68%/);
    assert.match(visibleText(tree), /Online · Stale/);
    assert.match(visibleText(tree), /Updated 1h ago · stale/);
    assert.equal(Object.assign({}, ...tree.root.findByProps({ testID: 'home-tessie-your-car' }).props.style).minHeight, height);
    const newer = { ...vehicle, vehicleKey: 'v2', name: 'Model 3', updatedAt: new Date(Date.now() - 10 * 60_000).toISOString() };
    await act(() => tree.update(React.createElement(widgets.YourCarWidget, { vehicles: [vehicle, newer], loading: false, failed: false })));
    assert.match(visibleText(tree), /Model 3/);
    assert.match(visibleText(tree), /Updated 10m ago/);
  } finally { await act(() => tree?.unmount()); }
});

test('Journey in progress exposes live recorder metrics and opens its details action', async () => {
  const progress = { startedAt: '2026-09-22T16:30:00.000Z', status: 'recording', elapsed: '30 min', distanceMiles: 12.4, pointCount: 18 };
  let opened = 0, tree: any;
  try {
    await act(() => { tree = create(React.createElement(widgets.JourneyInProgressWidget, { progress, onOpen: () => opened++ })); });
    assert.match(visibleText(tree), /RECORDING/);
    assert.match(visibleText(tree), /12\.4 mi/);
    assert.match(visibleText(tree), /18/);
    await act(() => tree.root.findByType('Pressable').props.onPress());
    assert.equal(opened, 1);
  } finally { await act(() => tree?.unmount()); }
});
