import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const nodeRequire = createRequire(import.meta.url);
const host = (name: string) => (props: any) => React.createElement(name, props, props.children);
const code = ts.transpileModule(readFileSync(new URL('../modules/journeydeck-keepsakes/index.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const frames = {
  redline: { x: 0.02, y: 0.03, width: 0.95, height: 0.94 },
  dark: { x: 0.04, y: 0.02, width: 0.93, height: 0.95 },
};
function load({ supported = true, fail = false, isPad = false } = {}) {
  let theme = 'redline';
  const files: string[] = [];
  const state = { reduceMotion: false, isAppActive: true, ambientMotionEnabled: true };
  const springs: Array<{ value: number; options: any }> = [];
  const timeouts = new Map<() => void, number>();
  const module = { exports: {} as any };
  const mocks: Record<string, any> = {
    react: React, 'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
    expo: { requireOptionalNativeModule: (name: string) => { assert.equal(name, 'ExpoDomWebViewModule'); return supported ? {} : null; } },
    'expo-asset': { Asset: { fromModule: (source: number) => ({ downloadAsync: async () => ({ localUri: `file:///art-${source}.webp` }) }) } },
    'expo-file-system': { File: class { uri: string; constructor(uri: string) { this.uri = uri; } async base64() { files.push(this.uri); if (fail) throw Error('Unreadable'); return 'cGl4ZWxz'; } } },
    'react-native': { View: host('View'), Text: host('Text'), ActivityIndicator: host('ActivityIndicator'), Platform: { OS: 'ios', isPad }, StyleSheet: { create: (value: any) => value, absoluteFill: { position: 'absolute' } } },
    'react-native-reanimated': {
      __esModule: true, default: { View: host('AnimatedView') },
      Easing: { linear: (value: number) => value, bezier: () => (value: number) => value },
      interpolate: (value: number, input: number[], output: number[]) => value <= input[0] ? output[0] : output.at(-1),
      useAnimatedStyle: (factory: () => any) => new Proxy({}, { get: (_target, property) => factory()[property] }),
      useSharedValue: (initial: number) => {
        const ref = React.useRef<any>(null);
        if (!ref.current) { let value = initial; ref.current = { get: () => value, set: (next: any) => { value = typeof next === 'function' ? next(value) : next; } }; }
        return ref.current;
      },
      withSpring: (value: number, options: any) => { springs.push({ value, options }); return value; }, withTiming: (value: number) => value,
    },
    '../../src/app-theme': { useAppTheme: () => ({ id: theme, palette: { page: '#081832', accent: '#d4ad50', muted: '#adb9c9' } }) },
    '../../src/motion': { useMotionPreferences: () => state },
    '../../src/medallion-artwork': {
      medallionArtwork: { 'memory-maker': { redline: 1, dark: 2 } },
      getMedallionFrame: (_id: string, themeId: keyof typeof frames) => frames[themeId],
    },
    '../../src/medallion-artwork-image': { MedallionArtworkImage: host('MedallionArtworkImage') },
    '../../src/medallion-dom': { __esModule: true, default: host('MedallionDOM') },
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!(name in mocks)) throw Error(`Unexpected import ${name}`); return mocks[name];
  }, setTimeout: (callback: () => void, delay: number) => { timeouts.set(callback, delay); return callback; },
  clearTimeout: (callback: () => void) => timeouts.delete(callback) });
  return { Component: module.exports.JourneyDeckMedallion, files, state, springs, timeouts, setTheme: (value: string) => { theme = value; } };
}

test('iPhone keeps its existing ready-gated drop and renderer handoff', async () => {
  const fixture = load(); let tree: any;
  const element = () => React.createElement(fixture.Component, { achievementId: 'memory-maker', name: 'Memory Maker' });
  await act(async () => { tree = create(element()); });
  assert.deepEqual(fixture.files, ['file:///art-1.webp']);
  const dom = tree.root.findByType('MedallionDOM');
  assert.equal(dom.props.artwork, 'data:image/webp;base64,cGl4ZWxz');
  assert.equal(dom.props.frame, frames.redline);
  assert.equal(dom.props.dom.useExpoDOMWebView, true);
  assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1);
  assert.equal(tree.root.findByType('MedallionArtworkImage').props.themeId, 'redline');
  assert.equal(tree.root.findByType('MedallionArtworkImage').props.rimWidth, 3);
  const beforeReady = tree.root.findAllByType('AnimatedView');
  assert.equal(beforeReady[0].props.style[2].transform[0].translateY, -440);
  assert.equal(beforeReady[2].props.style[1].opacity, 0);
  assert.equal(fixture.springs.length, 0);
  assert.equal(beforeReady[1].props.accessibilityElementsHidden, false);
  assert.equal(beforeReady[2].props.accessibilityElementsHidden, true);
  await act(() => dom.props.onReady());
  assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1, 'the fallback remains underneath the ready renderer');
  const afterReady = tree.root.findAllByType('AnimatedView');
  assert.equal(afterReady[0].props.style[2].transform[0].translateY, 0);
  assert.equal(fixture.springs.length, 1);
  assert.equal(afterReady[1].props.accessibilityElementsHidden, true);
  assert.equal(afterReady[2].props.accessibilityElementsHidden, false);
  fixture.state.reduceMotion = true; fixture.state.isAppActive = false;
  await act(() => tree.update(element()));
  assert.equal(tree.root.findByType('MedallionDOM').props.reduceMotion, true);
  assert.equal(tree.root.findByType('MedallionDOM').props.active, false);
  await act(() => tree.root.findByType('MedallionDOM').props.onError());
  assert.equal(tree.root.findAllByType('MedallionDOM').length, 0);
  assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1);
  await act(() => tree.unmount());
});

for (const [orientation, width, height] of [['portrait', 834, 1194], ['landscape', 1194, 834]] as const) {
  test(`iPad ${orientation} hides preparation without a 2D preview and keeps WebView paintable`, async () => {
    const fixture = load({ isPad: true }); let tree: any;
    let size = Math.min(380, width - 48, height - 430);
    const element = () => React.createElement(fixture.Component, { achievementId: 'memory-maker', name: 'Memory Maker', style: { width: size, height: size } });
    await act(async () => { tree = create(element()); });
    const layers = () => tree.root.findAllByType('AnimatedView');
    const cover = () => layers().find((node: any) => node.props.testID === 'medallion-loading-cover');
    const dom = tree.root.findByType('MedallionDOM');
    const oldReady = dom.props.onReady;
    assert.equal(dom.props.waitForPaint, true);
    assert.equal(layers()[1].props.style[1].opacity, 1, 'WebView never starts transparent');
    assert.equal(layers()[1].props.pointerEvents, 'none');
    assert.equal(layers()[0].props.style[2].transform[0].translateY, 0, 'WebView stays inside its visible native bounds');
    assert.equal(cover().props.style[1].zIndex, 1);
    assert.equal(cover().props.style[2].backgroundColor, '#081832');
    assert.equal(cover().props.style[3].opacity, 1);
    assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 0, 'no flat medallion is mounted during preparation');
    assert.equal(fixture.springs.length, 0);
    size = 250; await act(() => tree.update(element()));
    assert.equal(cover().props.style[3].opacity, 1, 'Split View keeps preparation covered');
    await act(() => dom.props.onReady());
    assert.equal(cover().props.style[3].opacity, 0);
    assert.equal(cover().props.accessibilityElementsHidden, true);
    assert.equal(tree.root.findAllByType('ActivityIndicator').length, 0);
    assert.equal(layers()[1].props.pointerEvents, 'auto');
    assert.equal(fixture.timeouts.size, 0);
    size = 320; await act(() => tree.update(element()));
    assert.equal(cover().props.style[3].opacity, 0, 'rotation does not re-cover a ready medallion');
    fixture.setTheme('dark');
    await act(async () => tree.update(element()));
    assert.equal(cover().props.style[3].opacity, 1, 'new artwork starts behind a fresh opaque cover');
    await act(() => oldReady());
    assert.equal(cover().props.style[3].opacity, 1, 'stale readiness cannot uncover a new theme');
    await act(() => tree.root.findByType('MedallionDOM').props.onError());
    assert.equal(cover(), undefined);
    assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1, 'errors show stable artwork');
    assert.equal(tree.root.findAllByType('MedallionDOM').length, 0);
    await act(() => tree.unmount());
    assert.equal(fixture.timeouts.size, 0);
  });
}

test('iPad Reduce Motion uses a static loading cover and a stalled renderer stays on its fallback', async () => {
  const fixture = load({ isPad: true }); fixture.state.reduceMotion = true;
  let tree: any;
  await act(async () => { tree = create(React.createElement(fixture.Component, { achievementId: 'memory-maker', name: 'Memory Maker' })); });
  const staleReady = tree.root.findByType('MedallionDOM').props.onReady;
  assert.equal(fixture.springs.length, 0);
  assert.equal(tree.root.findAllByType('AnimatedView')[0].props.style[2].transform[0].translateY, 0);
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 0);
  assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 0);
  assert.deepEqual([...fixture.timeouts.values()], [12_000]);
  await act(() => [...fixture.timeouts.keys()][0]());
  assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1);
  assert.equal(tree.root.findAllByType('MedallionDOM').length, 0);
  await act(() => staleReady());
  assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1, 'late readiness never replaces timed-out artwork with 3D');
  assert.equal(tree.root.findAllByType('MedallionDOM').length, 0);
  await act(() => tree.unmount());
});

test('iPad preparation pauses its timeout and spinner in the background and cleans up on dismissal', async () => {
  const fixture = load({ isPad: true }); let tree: any;
  const element = () => React.createElement(fixture.Component, { achievementId: 'memory-maker', name: 'Memory Maker' });
  await act(async () => { tree = create(element()); });
  assert.equal(fixture.timeouts.size, 1);
  fixture.state.isAppActive = false; await act(() => tree.update(element()));
  assert.equal(fixture.timeouts.size, 0);
  assert.equal(tree.root.findByType('ActivityIndicator').props.animating, false);
  fixture.state.isAppActive = true; await act(() => tree.update(element()));
  assert.equal(fixture.timeouts.size, 1);
  await act(() => tree.unmount());
  assert.equal(fixture.timeouts.size, 0);
});

test('late renderer callbacks cannot hide a newer theme', async () => {
  const fixture = load(); let tree: any;
  const element = () => React.createElement(fixture.Component, { achievementId: 'memory-maker', name: 'Memory Maker' });
  await act(async () => { tree = create(element()); });
  const oldCallbacks = tree.root.findByType('MedallionDOM').props;
  fixture.setTheme('dark');
  await act(async () => tree.update(element()));
  assert.equal(tree.root.findByType('MedallionDOM').props.frame, frames.dark);
  assert.equal(tree.root.findByType('MedallionArtworkImage').props.themeId, 'dark');
  await act(() => tree.root.findByType('MedallionDOM').props.onReady());
  await act(() => oldCallbacks.onError());
  await act(() => oldCallbacks.onReady());
  assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1);
  assert.equal(tree.root.findAllByType('MedallionDOM').length, 1);
  assert.deepEqual(fixture.files, ['file:///art-1.webp', 'file:///art-2.webp']);
  await act(() => tree.unmount());
});

test('missing native WebView or unreadable assets keep approved artwork visible', async () => {
  for (const options of [{ supported: false }, { fail: true }, { supported: false, isPad: true }, { fail: true, isPad: true }]) {
    const fixture = load(options); let tree: any;
    await act(async () => { tree = create(React.createElement(fixture.Component, { achievementId: 'memory-maker', name: 'Memory Maker' })); });
    assert.equal(tree.root.findAllByType('MedallionDOM').length, 0);
    assert.equal(tree.root.findAllByType('MedallionArtworkImage').length, 1);
    if (options.supported === false) assert.equal(fixture.files.length, 0);
    await act(() => tree.unmount());
  }
});

test('the DOM renderer receives the same crop and recreates it when theme bounds change', async () => {
  const source = readFileSync(new URL('../src/medallion-dom.tsx', import.meta.url), 'utf8');
  const domCode = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} as any };
  const calls: any[][] = [];
  let disposed = 0;
  const mocks: Record<string, any> = {
    react: React, 'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
    './medallion-renderer': { createMedallionViewer: async (...args: any[]) => {
      calls.push(args); return { setMotion() {}, dispose() { disposed++; } };
    } },
  };
  vm.runInNewContext(domCode, { module, exports: module.exports, require: (name: string) => {
    if (!(name in mocks)) throw Error(`Unexpected import ${name}`); return mocks[name];
  } });
  const element = (frame: typeof frames.redline) => React.createElement(module.exports.default, {
    artwork: 'data:image/webp;base64,cGl4ZWxz', name: 'Memory Maker', frame,
    reduceMotion: true, active: true, onReady: async () => {}, onError: async () => {},
  });
  const canvas = {};
  let tree: any;
  await act(async () => { tree = create(element(frames.redline), { createNodeMock: () => canvas }); });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], canvas);
  assert.equal(calls[0][4].frame, frames.redline);
  assert.equal(calls[0][4].name, 'Memory Maker');
  await act(async () => tree.update(element({ ...frames.redline })));
  assert.equal(calls.length, 1, 'identical crop values do not recreate the renderer');
  await act(async () => tree.update(element(frames.dark)));
  assert.equal(calls.length, 2);
  assert.equal(calls[1][4].frame, frames.dark);
  assert.equal(disposed, 1);
  await act(() => tree.unmount());
  assert.equal(disposed, 2);
});

test('iPad readiness waits for canvas layout and a rendered frame, and cancels after dismissal', async () => {
  const source = readFileSync(new URL('../src/medallion-dom.tsx', import.meta.url), 'utf8');
  const domCode = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} as any };
  const pendingFrames = new Map<number, () => void>();
  let id = 0, ready = 0, draws = 0, size = 0, disposed = 0;
  const mocks: Record<string, any> = {
    react: React, 'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
    './medallion-renderer': { createMedallionViewer: async () => ({ setMotion() { draws++; }, dispose() { disposed++; } }) },
  };
  vm.runInNewContext(domCode, { module, exports: module.exports, require: (name: string) => mocks[name],
    requestAnimationFrame: (callback: () => void) => { pendingFrames.set(++id, callback); return id; },
    cancelAnimationFrame: (key: number) => pendingFrames.delete(key),
  });
  const frame = async () => act(() => {
    const callbacks = [...pendingFrames.values()]; pendingFrames.clear(); callbacks.forEach(callback => callback());
  });
  const element = (artwork: string) => React.createElement(module.exports.default, {
    artwork, name: 'Memory Maker', frame: frames.redline,
    reduceMotion: true, active: true, waitForPaint: true, onReady: async () => { ready++; }, onError: async () => {},
  });
  let tree: any;
  await act(async () => { tree = create(element('first'), { createNodeMock: () => ({ getBoundingClientRect: () => ({ width: size, height: size }) }) }); });
  assert.equal(ready, 0, 'creating the viewer is not the iPad reveal signal');
  await frame(); assert.equal(ready, 0, 'zero-size canvas cannot uncover the renderer');
  size = 300; const beforeDraw = draws;
  await frame(); assert.equal(ready, 0); assert.equal(draws, beforeDraw + 1);
  await frame(); assert.equal(ready, 1, 'ready follows the sized canvas draw');
  await act(async () => tree.update(element('second')));
  assert.equal(disposed, 1);
  assert.equal(pendingFrames.size, 1);
  await act(() => tree.unmount());
  assert.equal(pendingFrames.size, 0);
  assert.equal(disposed, 2);
  await frame(); assert.equal(ready, 1, 'dismissal prevents a stale reveal callback');
});
