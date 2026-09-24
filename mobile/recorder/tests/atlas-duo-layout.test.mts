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

const source = readFileSync(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
const atlas = source.slice(source.indexOf('export function AtlasScreen('), source.indexOf('function AtlasPulseCard('));
const module = { exports: {} as any };
const code = ts.transpileModule(atlas + '\nAtlasTravelStoriesCards = ({children}) => null; exports.AtlasScreen = AtlasScreen;', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const styles = new Proxy({}, { get: (_target, key) => String(key) });
let adaptive: any = { fold: null };
let fontScale = 1;
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require,
  darkStyles: {},
  useState: React.useState,
  useMemo: React.useMemo,
  View: host('view'),
  Text: host('text'),
  Pressable: host('button'),
  ScrollView: host('scroll'),
  SymbolView: host('symbol'),
  ScreenScaffold: host('scaffold'),
  DataNotice: host('notice'),
  AtlasPulseCard: host('pulse'),
  AtlasInsightGrid: host('insights'),
  SoundtrackIntelligenceCard: host('soundtrack'),
  SectionTitle: host('section-title'),
  NeonWidgetOutline: host('outline'),
  PrimaryMobilityMap: host('map'),
  EmptyCard: host('empty'),
  PlaceDetails: host('place-details'),
  PatternAction: host('pattern-action'),
  JourneyRow: host('journey-row'),
  useAppTheme: () => ({ color: (value: string) => value }),
  useThemedStyles: () => styles,
  useAdaptiveLayout: () => adaptive,
  useWindowDimensions: () => ({ fontScale }),
  verticalFoldContentColumns: (fold: any, padding: number) => fold?.axis === 'vertical' ? { beforeWidth: fold.before.width - padding, afterWidth: fold.after.width - padding, gap: fold.frame.width } : null,
  buildAtlasInsights: (_journeys: any[], _details: any[], window: string) => ({ window }),
  TESSIE_INTEGRATION_ENABLED: false,
  getCurrentUser: () => ({ id: 'test' }),
  saveAtlasPatternReview() {},
  formatAtlasPatternRoute: () => '',
});

test('Atlas retains its selected window while opening into two physical panes', async () => {
  const props = { state: { status: 'ready', data: { journeys: [], details: [], vehicle: { places: [] }, atlasPatterns: [] } }, onRefresh() {}, onJourney() {} };
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(module.exports.AtlasScreen, props)); });
    const map = tree.root.findByType('map');
    const windowButton = () => tree.root.findAllByType('button').filter((node: any) => node.props.accessibilityRole === 'tab')[1];
    await act(() => windowButton().props.onPress());
    assert.equal(windowButton().props.accessibilityState.selected, true);

    adaptive = { fold: { axis: 'vertical', frame: { width: 27 }, before: { width: 634 }, after: { width: 634 } } };
    await act(() => tree.update(React.createElement(module.exports.AtlasScreen, props)));
    const layout = tree.root.findByProps({ testID: 'atlas-duo-layout' });
    assert.equal(layout.props.style.gap, 27);
    assert.equal(tree.root.findByProps({ testID: 'atlas-duo-intelligence' }).props.style.width, 614);
    assert.equal(tree.root.findByProps({ testID: 'atlas-duo-map' }).props.style.width, 614);
    assert.equal(windowButton().props.accessibilityState.selected, true);
    assert.equal(tree.root.findByType('map'), map, 'the map host and its camera state survive the pose transition');
    fontScale = 1.4;
    await act(() => tree.update(React.createElement(module.exports.AtlasScreen, props)));
    assert.equal(tree.root.findByType('insights').props.singleColumn, true, 'enlarged text uses one insight column on iPad');
  } finally {
    adaptive = { fold: null };
    fontScale = 1;
    await act(() => tree?.unmount());
  }
});
