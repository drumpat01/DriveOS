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
const gestures: any[] = [];
const host = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
const mocks: any = {
  'react-native': { View: host('View'), Text: host('Text'), Pressable: host('Pressable'), Alert: {}, I18nManager: { isRTL: false }, StyleSheet: { create: (v: any) => v } },
  'react-native-gesture-handler': { GestureDetector: host('GestureDetector'), Gesture: { Pan: () => {
    const config: any = {};
    const builder: any = new Proxy({}, { get: (_, name) => (...args: any[]) => { config[name] = args[0]; return builder; } });
    gestures.push(config); return builder;
  } } },
  'react-native-reanimated': { __esModule: true, default: { View: host('View') }, ReduceMotion: { System: 'system' },
    useSharedValue: (initial: number) => React.useMemo(() => { let value = initial; return { get: () => value, set: (next: number) => { value = next; } }; }, []),
    useAnimatedStyle: (fn: any) => fn(), withSpring: (v: any) => v },
  'react-native-worklets': { scheduleOnRN: (fn: any, ...args: any[]) => fn(...args) },
  'expo-symbols': { SymbolView: host('Symbol') },
  './app-theme': { useAppTheme: () => ({ palette: { accent: 'orange' } }) },
  './journeydeck-design-tokens': { journeyDeckRadius: { compact: 16 }, journeyDeckSpacing: { 3: 12, 4: 16 }, journeyDeckTypography: { label: {}, body: {} }, journeyDeckSemanticColors: () => ({ text: 'white', textSecondary: 'gray', separator: 'gray', surfaceInset: 'black', accent: 'orange', onAccent: 'black' }) },
  './native-sheet': { NativeSheet: host('NativeSheet') },
  'expo-secure-store': {},
};
function load(file: string) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  return module.exports;
}
mocks['./home-widget-layout'] = load('home-widget-layout.ts');
const { HomeGridCell, HOME_WIDGET_HOLD_MS } = load('home-widget-grid.tsx');

test('hold enters editing only on activation; cancellation does not move; edge resize commits on release', async () => {
  let tree: any, edits = 0;
  const moves: number[] = [], sizes: number[] = [];
  const props = { placement: { id: 'memories', span: 6, order: 0 }, title: 'Memories', editing: false, width: '50%', onStartEditing: () => edits++, onMove: (v: number) => moves.push(v), onResize: (v: number) => sizes.push(v), onToggle() {}, children: React.createElement('content') };
  try {
    await act(() => { tree = create(React.createElement(HomeGridCell, props)); });
    const hold = gestures.at(-1);
    assert.equal(HOME_WIDGET_HOLD_MS, 1000);
    assert.equal(hold.activateAfterLongPress, 1000);
    hold.onFinalize();
    assert.equal(edits, 0);
    assert.deepEqual(moves, []);
    hold.onStart();
    assert.equal(edits, 1);
    hold.onEnd({ translationX: 60, translationY: 0 }, false);
    assert.deepEqual(moves, []);
    hold.onEnd({ translationX: 60, translationY: 0 }, true);
    assert.deepEqual(moves, [1]);
    await act(() => tree.update(React.createElement(HomeGridCell, { ...props, editing: true })));
    tree.root.findAllByType('View').find((n: any) => n.props.testID === 'home-grid-memories').props.onLayout({ nativeEvent: { layout: { width: 300 } } });
    const right = gestures.at(-1);
    assert.ok(right.blocksExternalGesture);
    right.onBegin();
    right.onUpdate({ translationX: 100 });
    assert.deepEqual(sizes, []);
    right.onFinalize();
    assert.deepEqual(sizes, [], 'cancelled resize leaves saved width unchanged');
    right.onBegin();
    right.onEnd({ translationX: 100 }, false);
    assert.deepEqual(sizes, []);
    right.onEnd({ translationX: 100 }, true);
    assert.deepEqual(sizes, [8]);
    assert.equal(tree.root.findAllByType('Pressable').some((n: any) => n.props.accessibilityLabel === 'Resize Memories'), false);
    assert.ok(tree.root.findAllByType('View').some((n: any) => n.props.pointerEvents === 'none'));
  } finally { await act(() => tree?.unmount()); }
});
