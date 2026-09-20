import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let frame = { width: 390, height: 844, fontScale: 1 };
let insets = { top: 47, right: 0, bottom: 34, left: 0 };
let display = { horizontalSizeClass: 'unspecified', verticalSizeClass: 'unspecified', divisionRegions: [], occlusionRegions: [] };
const module = { exports: {} as any };
const source = readFileSync(new URL('../src/adaptive-layout.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require: (id: string) => id === 'react-native'
    ? { useWindowDimensions: () => frame }
    : id === 'react-native-safe-area-context'
      ? { useSafeAreaInsets: () => insets }
      : id === './display-layout'
        ? { useDisplayLayoutMetrics: () => display }
      : (() => { throw new Error(`Unexpected import: ${id}`); })(),
});
const layout = module.exports;

test('adaptive presentation follows usable space rather than device identity', () => {
  const cases = [
    { name: 'conventional iPhone portrait', width: 390, height: 844, expected: 'compact' },
    { name: 'conventional iPhone landscape', width: 844, height: 390, expected: 'compact' },
    { name: 'iPhone Duo outer display', width: 466, height: 678, expected: 'compact' },
    { name: 'narrow iPad multitasking window', width: 620, height: 900, expected: 'compact' },
    { name: 'iPhone Duo inner display', width: 1335, height: 939, expected: 'regular' },
    { name: 'full iPad window', width: 1024, height: 1366, expected: 'regular' },
  ];

  for (const item of cases) {
    const result = layout.adaptiveLayoutForFrame(item);
    assert.equal(result.presentation, item.expected, item.name);
    assert.equal(result.isRegular, item.expected === 'regular');
    assert.equal(result.isCompact, item.expected === 'compact');
  }
});

test('safe areas participate in the decision and invalid measurements fail compact', () => {
  const inset = layout.adaptiveLayoutForFrame({
    width: 720,
    height: 540,
    insets: { left: 12, right: 12, top: 24, bottom: 24 },
  });
  assert.equal(inset.availableWidth, 696);
  assert.equal(inset.availableHeight, 492);
  assert.equal(inset.presentation, 'compact');

  const invalid = layout.adaptiveLayoutForFrame({ width: Number.NaN, height: Number.POSITIVE_INFINITY, fontScale: 0 });
  assert.equal(invalid.presentation, 'compact');
  assert.equal(invalid.availableWidth, 0);
  assert.equal(invalid.availableHeight, 0);
  assert.equal(invalid.fontScale, 1);
});

test('native size classes and reserved regions describe a folded inner display', () => {
  const result = layout.adaptiveLayoutForFrame({
    width: 1335,
    height: 939,
    insets: { top: 24, right: 20, bottom: 20, left: 20 },
    horizontalSizeClass: 'regular',
    verticalSizeClass: 'regular',
    divisionRegions: [{ x: 654, y: 0, width: 27, height: 939 }],
    occlusionRegions: [{ x: 622, y: 24, width: 52, height: 28 }],
  });
  assert.equal(result.presentation, 'regular');
  assert.equal(result.fold.axis, 'vertical');
  assert.deepEqual(JSON.parse(JSON.stringify(result.fold.frame)), { x: 654, y: 24, width: 27, height: 895 });
  assert.equal(result.fold.before.width, 634);
  assert.equal(result.fold.after.width, 634);
  assert.deepEqual(JSON.parse(JSON.stringify(result.occlusionRegions)), [{ x: 622, y: 24, width: 52, height: 28 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.occlusionInsets)), { top: 28, right: 0, bottom: 0, left: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(layout.verticalFoldContentColumns(result.fold, 24))), { beforeWidth: 610, afterWidth: 610, gap: 27 });

  const horizontal = layout.adaptiveLayoutForFrame({
    width: 939, height: 1335,
    divisionRegions: [{ x: 0, y: 650, width: 939, height: 35 }],
  });
  assert.equal(horizontal.fold.axis, 'horizontal');
  assert.equal(horizontal.fold.before.height, 650);
  assert.equal(horizontal.fold.after.height, 650);
  assert.equal(layout.verticalFoldContentColumns(horizontal.fold, 20), null, 'horizontal folds retain continuous vertical scrolling');
});

test('edge occlusions become directional content avoidance while interior regions do not', () => {
  const result = layout.adaptiveLayoutForFrame({
    width: 1000,
    height: 800,
    insets: { top: 20, right: 10, bottom: 30, left: 10 },
    occlusionRegions: [
      { x: 10, y: 20, width: 18, height: 90 },
      { x: 940, y: 200, width: 50, height: 80 },
      { x: 400, y: 300, width: 40, height: 40 },
      { x: 200, y: 750, width: 100, height: 20 },
    ],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result.occlusionInsets)), { top: 90, right: 50, bottom: 20, left: 18 });
});

test('live resizing changes presentation without replacing local state', async () => {
  let tree: any;
  function Probe() {
    const current = layout.useAdaptiveLayout();
    const [draft, setDraft] = React.useState('initial');
    return React.createElement('probe', { ...current, draft, setDraft });
  }

  try {
    await act(() => { tree = create(React.createElement(Probe)); });
    const first = tree.root.findByType('probe');
    assert.equal(first.props.presentation, 'compact');
    await act(() => first.props.setDraft('preserved'));

    frame = { width: 1335, height: 939, fontScale: 1.2 };
    insets = { top: 24, right: 20, bottom: 20, left: 20 };
    await act(() => tree.update(React.createElement(Probe)));
    const resized = tree.root.findByType('probe');
    assert.equal(resized.props.presentation, 'regular');
    assert.equal(resized.props.draft, 'preserved');
    assert.equal(resized.props.availableWidth, 1295);
    assert.equal(resized.props.fontScale, 1.2);
  } finally {
    frame = { width: 390, height: 844, fontScale: 1 };
    insets = { top: 47, right: 0, bottom: 34, left: 0 };
    display = { horizontalSizeClass: 'unspecified', verticalSizeClass: 'unspecified', divisionRegions: [], occlusionRegions: [] };
    await act(() => tree?.unmount());
  }
});
