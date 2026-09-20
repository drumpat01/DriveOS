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
const source = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const detail = source.slice(source.indexOf('function JourneyDetailScreen('), source.indexOf('type SettingsDestination'));
const module = { exports: {} as any };
const code = ts.transpileModule(detail + '\nexports.JourneyDetailScreen = JourneyDetailScreen;', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const styles = new Proxy({}, { get: (_target, key) => String(key) });
let adaptive: any = { fold: null, occlusionInsets: { top: 0, right: 0, bottom: 0, left: 0 } };
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require,
  darkStyles: {},
  useState: React.useState,
  useMemo: React.useMemo,
  useEffect: React.useEffect,
  View: host('view'), Text: host('text'), Pressable: host('button'), TextInput: host('input'), ScrollView: host('scroll'),
  DetailScreenFrame: host('frame'), LoadingCard: host('loading'), InlineNotice: host('notice'), JourneyCinematicHero: host('hero'),
  JourneyMarkerRoute: host('map'), RouteSketch: host('sketch'), SectionHeading: host('heading'), TrackRow: host('track'), EmptyCard: host('empty'),
  InfoRow: host('info'), NativeSheet: host('sheet'), ShareCardModal: host('share'),
  useAppTheme: () => ({ color: (value: string) => value }), useThemedStyles: () => styles,
  useAdaptiveLayout: () => adaptive,
  verticalFoldContentColumns: (fold: any, padding: number) => fold?.axis === 'vertical' ? { beforeWidth: fold.before.width - padding, afterWidth: fold.after.width - padding, gap: fold.frame.width } : null,
  loadReplayPhotos: () => [], getCurrentUser: () => ({ id: 'user' }), buildSongRouteMoments: () => [], journeyDisplayTitle: () => 'Park to Museum',
  loadCityLabelForCoordinate: async () => null, useJourneyCardAction() {}, appDataClient: {},
  formatFullDate: () => '', formatMiles: () => '', formatDuration: () => '', privacySafeRealShareRoute: () => ({}),
  requestSheetClose() {}, Alert: { alert() {} }, router: { push() {} },
});

test('Journey detail retains its selected song while map and story move into Duo panes', async () => {
  const journey = {
    id: 'journey-1', startedAt: '2026-09-10T10:00:00Z', endedAt: '2026-09-10T10:30:00Z', startingLocation: 'Park', endingLocation: 'Museum',
    miles: 8, durationMinutes: 30, songCount: 1, soundtrackPreview: [], soundtrack: [{ source: 'apple-music', track: 'Road song', artist: 'Artist' }], route: { coordinates: [] },
  };
  const props = { visible: true, state: { status: 'ready', data: journey }, onClose() {}, onRetry() {}, onLocationsSaved: async () => {} };
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(module.exports.JourneyDetailScreen, props)); });
    const map = tree.root.findByType('map');
    await act(() => tree.root.findByType('track').props.onPress());
    assert.equal(tree.root.findByType('track').props.selected, true);
    assert.equal(tree.root.findByType('map'), map, 'the route map stays mounted through the pose transition');

    adaptive = { fold: { axis: 'vertical', frame: { width: 27 }, before: { width: 634 }, after: { width: 634 } }, occlusionInsets: { top: 28, right: 0, bottom: 0, left: 0 } };
    await act(() => tree.update(React.createElement(module.exports.JourneyDetailScreen, props)));
    assert.equal(tree.root.findByProps({ testID: 'journey-detail-duo-layout' }).props.style.gap, 27);
    assert.equal(tree.root.findByProps({ testID: 'journey-detail-map-pane' }).props.style.width, 618);
    assert.equal(tree.root.findByProps({ testID: 'journey-detail-story-pane' }).props.style.width, 618);
    assert.equal(tree.root.findByType('track').props.selected, true);
    assert.equal(tree.root.findByType('scroll').props.contentContainerStyle[1].paddingTop, 44);
  } finally {
    adaptive = { fold: null, occlusionInsets: { top: 0, right: 0, bottom: 0, left: 0 } };
    await act(() => tree?.unmount());
  }
});
