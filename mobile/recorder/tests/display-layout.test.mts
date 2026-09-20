import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);

const module = { exports: {} as any };
const source = readFileSync(new URL('../src/display-layout.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require: (id: string) => id === 'react'
    ? React
    : id === 'react/jsx-runtime'
      ? require('react/jsx-runtime')
    : id === 'react-native'
      ? { StyleSheet: { absoluteFill: { position: 'absolute', inset: 0 } } }
      : id === '../modules/journeydeck-recorder'
        ? { JourneyDeckDisplayLayoutObserver: (props: any) => React.createElement('native-layout-observer', props) }
        : (() => { throw new Error(`Unexpected import: ${id}`); })(),
});
const displayLayout = module.exports;

test('native display measurements are normalized before entering app layout', () => {
  const result = displayLayout.normalizeDisplayLayoutMetrics({
    width: Number.NaN,
    height: -20,
    horizontalSizeClass: 'future',
    verticalSizeClass: 'regular',
    divisionRegions: [
      { x: -4, y: 0, width: 20, height: 100 },
      { x: 10, y: 10, width: 0, height: 10 },
    ],
    occlusionRegions: [{ x: 20, y: 8, width: 30, height: 12 }],
  });
  assert.equal(result.measured, true);
  assert.equal(result.width, 0);
  assert.equal(result.height, 0);
  assert.equal(result.horizontalSizeClass, 'unspecified');
  assert.equal(result.verticalSizeClass, 'regular');
  assert.deepEqual(JSON.parse(JSON.stringify(result.divisionRegions)), [{ x: -4, y: 0, width: 20, height: 100 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.occlusionRegions)), [{ x: 20, y: 8, width: 30, height: 12 }]);
});

test('display layout updates flow through context without replacing child state', async () => {
  let tree: any;
  function Probe() {
    const metrics = displayLayout.useDisplayLayoutMetrics();
    const [draft, setDraft] = React.useState('kept');
    return React.createElement('probe', { metrics, draft, setDraft });
  }
  try {
    await act(() => { tree = create(React.createElement(displayLayout.DisplayLayoutProvider, null, React.createElement(Probe))); });
    const observer = tree.root.findByType('native-layout-observer');
    assert.equal(tree.root.findByType('probe').props.metrics.measured, false);
    await act(() => observer.props.onDisplayLayoutChange({ nativeEvent: {
      width: 1335,
      height: 939,
      horizontalSizeClass: 'regular',
      verticalSizeClass: 'regular',
      divisionRegions: [{ x: 654, y: 0, width: 27, height: 939 }],
      occlusionRegions: [],
    } }));
    const probe = tree.root.findByType('probe');
    assert.equal(probe.props.metrics.width, 1335);
    assert.equal(probe.props.metrics.divisionRegions[0].width, 27);
    assert.equal(probe.props.draft, 'kept');
    assert.equal(observer.props.pointerEvents, 'none');
  } finally {
    await act(() => tree?.unmount());
  }
});
