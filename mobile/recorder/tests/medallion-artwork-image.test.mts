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
const module = { exports: {} as any };
const frames = {
  redline: { x: 0.1, y: 0.05, width: 0.8, height: 0.9 },
  light: { x: 0.03, y: 0.04, width: 0.94, height: 0.92 },
};
const mocks: Record<string, any> = {
  'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
  'expo-image': { Image: host('Image') },
  'react-native': { View: host('View'), StyleSheet: { create: (value: any) => value } },
  './medallion-artwork': {
    medallionArtwork: { 'memory-maker': { redline: 1, light: 2 } },
    getMedallionFrame: (_id: string, theme: keyof typeof frames) => frames[theme],
  },
};
const source = readFileSync(new URL('../src/medallion-artwork-image.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
  if (!(name in mocks)) throw Error(`Unexpected import ${name}`); return mocks[name];
} });

test('native artwork maps its measured face bounds onto a clipped circle across theme changes', async () => {
  const Component = module.exports.MedallionArtworkImage;
  const element = (themeId: string) => React.createElement(Component, {
    achievementId: 'memory-maker', themeId, label: 'Memory Maker artwork', style: { width: 300, height: 300 },
  });
  let tree: any;
  await act(() => { tree = create(element('redline')); });
  for (const themeId of ['redline', 'light'] as const) {
    await act(() => tree.update(element(themeId)));
    const frame = frames[themeId];
    const image = tree.root.findByType('Image');
    const crop = image.props.style;
    const scaleX = Number.parseFloat(crop.width) / 100;
    const scaleY = Number.parseFloat(crop.height) / 100;
    const left = Number.parseFloat(crop.left) / 100;
    const top = Number.parseFloat(crop.top) / 100;
    assert.ok(Math.abs(left + frame.x * scaleX) < 1e-12, 'face left meets circle left');
    assert.ok(Math.abs(top + frame.y * scaleY) < 1e-12, 'face top meets circle top');
    assert.ok(Math.abs(left + (frame.x + frame.width) * scaleX - 1) < 1e-12, 'face right meets circle right');
    assert.ok(Math.abs(top + (frame.y + frame.height) * scaleY - 1) < 1e-12, 'face bottom meets circle bottom');
    assert.equal(image.props.contentFit, 'fill');
    assert.equal(image.props.source, themeId === 'redline' ? 1 : 2);
    assert.equal(image.props.accessibilityLabel, 'Memory Maker artwork');
    const views = tree.root.findAllByType('View');
    const rim = Object.assign({}, ...views[0].props.style);
    const clip = Object.assign({}, ...views[1].props.style);
    assert.equal(rim.width, rim.height);
    assert.equal(rim.overflow, 'hidden');
    assert.equal(rim.borderColor, '#f4d47b');
    assert.equal(rim.borderWidth, 1, 'every thumbnail has a consistent bright outer line');
    assert.ok(rim.borderRadius >= rim.width / 2);
    assert.equal(clip.overflow, 'hidden');
    assert.equal(clip.top, 2.5);
    assert.equal(clip.left, 2.5);
  }
  await act(() => tree.unmount());
});
