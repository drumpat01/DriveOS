import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const source = readFileSync(new URL('../src/memory-route-map.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const module = { exports: {} as any };
const dependencies: Record<string, any> = {
  react: React,
  'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': { StyleSheet: { create: (value: any) => value, absoluteFill: {} }, View: host('View'), Text: host('Text') },
  '@maplibre/maplibre-react-native': { Camera: host('Camera'), GeoJSONSource: host('GeoJSONSource'), Layer: host('Layer'), Map: host('Map') },
  './app-theme': { useAppTheme: () => ({ id: 'redline', isLight: false }) },
  './journey-map-theme': { loadJourneyDeckMapStyle: async () => null, OPEN_FREE_MAP_DARK_STYLE: 'dark-style', OPEN_FREE_MAP_LIGHT_STYLE: 'light-style' },
  './redesign-ui': { RouteSketch: host('RouteSketch'), useRedesignColors: () => ({ page: '#080808', surfaceStrong: '#161616', textSecondary: '#bbbbbb', photoChip: '#222222' }) },
};
vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => dependencies[id], fetch }, { filename: 'memory-route-map.tsx' });
const { MemoryRouteMap } = module.exports;

test('Memory map fits all recorded routes and keeps a sketch until map tiles load or if they fail', async () => {
  let tree: any;
  const routes = [
    { id: 'first', color: '#bf93f2', coordinates: [[-122.5, 37.7], [-122.4, 37.5]] },
    { id: 'second', color: '#e8ac52', coordinates: [[-122.3, 37.4], [-122.2, 37.3]] },
    { id: 'invalid', color: '#ff0000', coordinates: [[NaN, 37.2], [181, 37.1]] },
  ];
  await act(async () => { tree = create(React.createElement(MemoryRouteMap, { routes, width: 353 })); });
  const map = tree.root.findByType('Map');
  assert.equal(map.props.mapStyle, 'dark-style');
  const bounds = tree.root.findByType('Camera').props.initialViewState.bounds;
  assert.ok(bounds[0] < -122.5 && bounds[2] > -122.2);
  assert.ok(bounds[1] < 37.3 && bounds[3] > 37.7);
  const lines = tree.root.findByType('GeoJSONSource').props.data.features;
  assert.deepEqual(Array.from(lines, (line: any) => line.properties.color), ['#bf93f2', '#e8ac52']);
  assert.equal(tree.root.findAllByType('RouteSketch').length, 1);
  assert.equal(tree.root.findAllByType('Text').length, 0);
  await act(async () => map.props.onDidFinishLoadingMap());
  assert.match(tree.root.findByType('Text').props.children, /OpenFreeMap/);
  await act(async () => tree.root.findByType('Map').props.onDidFailLoadingMap());
  assert.equal(tree.root.findAllByType('Map').length, 0);
  assert.equal(tree.root.findAllByType('RouteSketch').length, 1);
  await act(async () => tree.unmount());
});
