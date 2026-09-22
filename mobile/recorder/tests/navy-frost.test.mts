import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import {
  NAVY_FROST,
  nativeSheetModalProps,
  navyFrostIsMilky,
  navyFrostMaterial,
} from '../src/navy-frost-policy.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);

function loadFrost() {
  const mocks: Record<string, unknown> = {
    'react-native': { View: host('View'), StyleSheet: { create: (styles: unknown) => styles, absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } } },
    'expo-blur': { BlurView: host('BlurView') },
    '@shopify/react-native-skia': { BackdropBlur: host('BackdropBlur'), Canvas: host('Canvas'), Fill: host('Fill'), Image: host('SkiaImage') },
    './navy-frost-policy': { NAVY_FROST, navyFrostMaterial },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL('../src/navy-frost.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : require(id) });
  return module.exports;
}

test('navy frost recipe stays soft navy and never milky white', () => {
  assert.equal(navyFrostIsMilky(NAVY_FROST.solid), false);
  assert.equal(navyFrostIsMilky(NAVY_FROST.tint), false);
  assert.equal(navyFrostIsMilky('#ffffff'), true);
  assert.equal(navyFrostIsMilky('rgba(255,255,255,0.7)'), true);
  assert.match(NAVY_FROST.solid, /^#0B1830$/i);
  assert.match(NAVY_FROST.tint, /8,\s*24,\s*50/);
  assert.ok(NAVY_FROST.skiaBlur <= 24);
  assert.ok(NAVY_FROST.blurIntensity <= 48);
});

test('Reduce Transparency selects solid navy with no blur', () => {
  assert.equal(navyFrostMaterial({ reduceTransparency: true }), 'solid');
  assert.equal(navyFrostMaterial({ reduceTransparency: false }), 'blur');
});

test('frost sheets sit over imagery; opaque sheets keep pageSheet', () => {
  assert.deepEqual(nativeSheetModalProps({ surface: 'opaque', reduceMotion: false, animateChrome: true }), {
    presentationStyle: 'pageSheet', transparent: false, animationType: 'slide',
  });
  assert.deepEqual(nativeSheetModalProps({ surface: 'frost', reduceMotion: false, animateChrome: true }), {
    presentationStyle: 'overFullScreen', transparent: true, animationType: 'slide',
  });
  assert.equal(nativeSheetModalProps({ surface: 'frost', reduceMotion: true, animateChrome: true }).animationType, 'none');
  assert.equal(nativeSheetModalProps({ surface: 'frost', reduceMotion: false, animateChrome: false }).animationType, 'none');
});

test('live frost uses expo-blur plus navy tint; Reduce Transparency is a solid fill', async () => {
  const { NavyFrostSurface } = loadFrost();
  let tree: any;
  await act(() => { tree = create(React.createElement(NavyFrostSurface, { reduceTransparency: false }, 'copy')); });
  const blur = tree.root.findByType('BlurView');
  assert.equal(blur.props.intensity, NAVY_FROST.blurIntensity);
  assert.equal(blur.props.tint, 'systemUltraThinMaterialDark');
  const styleHas = (node: any, key: string, value: string) => {
    const styles = Array.isArray(node.props.style) ? node.props.style : [node.props.style];
    return styles.some((item: any) => item?.[key] === value);
  };
  assert.equal(tree.root.findAllByType('View').some((node: any) => styleHas(node, 'backgroundColor', NAVY_FROST.tint)), true);
  await act(() => tree.update(React.createElement(NavyFrostSurface, { reduceTransparency: true }, 'copy')));
  assert.equal(tree.root.findAllByType('BlurView').length, 0);
  assert.ok(tree.root.findByProps({ testID: 'navy-frost-solid' }));
  await act(() => tree.unmount());
});

test('Skia stills use BackdropBlur unless Reduce Transparency is on', async () => {
  const { NavyFrostStill } = loadFrost();
  const image = { __skia: true };
  let tree: any;
  await act(() => { tree = create(React.createElement(NavyFrostStill, { image, width: 320, height: 480, reduceTransparency: false })); });
  const blur = tree.root.findByType('BackdropBlur');
  assert.equal(blur.props.blur, NAVY_FROST.skiaBlur);
  assert.equal(tree.root.findByType('Fill').props.color, NAVY_FROST.tint);
  await act(() => tree.update(React.createElement(NavyFrostStill, { image, width: 320, height: 480, reduceTransparency: true })));
  assert.equal(tree.root.findAllByType('BackdropBlur').length, 0);
  assert.ok(tree.root.findAllByType('Fill').some((node: any) => node.props.color === NAVY_FROST.solid));
  await act(() => tree.unmount());
});

test('frost wiring stays off Record chrome and never depends on Moti', () => {
  const files = [
    readFileSync(new URL('../src/navy-frost.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/navy-frost-policy.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/native-sheet.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/journey-markers.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/journey-replay-stage.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../App.tsx', import.meta.url), 'utf8'),
  ];
  for (const source of files) {
    assert.doesNotMatch(source, /from ['"]moti['"]|require\(['"]moti['"]\)/);
  }
  const recorder = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(recorder, /NavyFrost|surface="frost"/);
  const markers = readFileSync(new URL('../src/journey-markers.tsx', import.meta.url), 'utf8');
  assert.match(markers, /surface="frost"/);
  assert.match(markers, /animateChrome=\{!editingBlocked\}/);
  const replay = readFileSync(new URL('../src/journey-replay-stage.tsx', import.meta.url), 'utf8');
  assert.match(replay, /NavyFrostSurface/);
  assert.match(replay, /reduceTransparency=\{motion\.reduceTransparency\}/);
});
