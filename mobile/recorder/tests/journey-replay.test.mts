import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { compactArtistCredit } from '../src/artist-credit.ts';
import { recordedReplayStops, replayPhotoMoments } from '../src/journey-replay-model.ts';
import * as route from '../src/route-moments.ts';
import { testTheme } from './theme-fixture.mts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const base = Date.parse('2026-09-09T12:00:00Z');
const iso = (seconds: number) => new Date(base + seconds * 1000).toISOString();
const samples = [0, 30, 60, 90, 180].map((seconds, i) => ({ recordedAt: iso(seconds), coordinate: [i < 3 ? -90 : -90 + i * .001, 40] as [number, number], speedMph: i < 3 ? 0 : 20 }));

test('artist credits show two names with a count and retain band names containing ampersands', () => {
  assert.equal(compactArtistCredit('A, B, C, D'), 'A, B +2 more');
  assert.equal(compactArtistCredit('Earth, Wind & Fire'), 'Earth, Wind & Fire');
  assert.equal(compactArtistCredit('Simon & Garfunkel'), 'Simon & Garfunkel');
  assert.equal(compactArtistCredit(''), '');
});
test('stops require a minute of nearby stationary recordings and never bridge missing GPS', () => {
  assert.equal(recordedReplayStops(samples).length, 1);
  assert.equal(recordedReplayStops(samples)[0].at, base);
  assert.equal(recordedReplayStops(samples.slice(0, 2)).length, 0);
  assert.equal(recordedReplayStops([samples[0], { ...samples[1], recordedAt: iso(200) }]).length, 0);
  assert.equal(recordedReplayStops(samples.map(p => ({ ...p, speedMph: null }))).length, 0);
  assert.equal(recordedReplayStops(samples.map((p, i) => ({ ...p, coordinate: [-90 + i, 40] }))).length, 0);
});
test('photo timing is bounded to the journey and never substitutes import time', () => {
  const points = route.buildReplayRoute(samples.map(p => p.coordinate), samples, iso(0), iso(180), null, null);
  const photo = { id: 'photo', uri: 'file:///photo.jpg', capturedAt: iso(90) };
  const result = replayPhotoMoments([photo, photo, { ...photo, id: 'old', capturedAt: iso(-1) }, { ...photo, id: 'invalid', capturedAt: 'bad' }], points);
  assert.equal(result.length, 1); assert.equal(result[0].at, base + 90_000);
  assert.deepEqual(result[0].coordinate, samples[3].coordinate);
  assert.equal(replayPhotoMoments([photo], []).length, 0);
});

function load(name: string, mocks: Record<string, any>, globals: Record<string, any> = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id), ...globals }); return module.exports;
}
test('saved photo associations respect owner, surviving memories, and original capture time', () => {
  let owner = 'one'; const prefs = new Map();
  const api = load('journey-replay-photos.ts', {
    './auth': { getCurrentUser: () => ({ id: owner }) },
    './storage': { writeAppCache: (key: string, value: any) => { assert.ok(key.length <= 200); prefs.set(key, value); }, readAppCache: (key: string) => prefs.get(key) },
    './local-store': {
      listMemories: () => [{ id: 'memory', journeyIds: '["journey"]' }],
      listPhotos: () => [{ id: 'photo', memoryId: 'memory', localUri: 'file:///photo.jpg' }, { id: 'deleted-memory-photo', memoryId: 'removed', localUri: 'file:///removed.jpg' }],
    },
  });
  api.saveReplayPhotoTiming('one', 'photo', 'journey', iso(90));
  api.saveReplayPhotoTiming('one', 'deleted-memory-photo', 'journey', iso(90));
  assert.equal(api.loadReplayPhotos('one', 'journey').length, 1);
  assert.equal(api.loadReplayPhotos('one', 'other').length, 0);
  owner = 'two'; assert.equal(api.loadReplayPhotos('one', 'journey').length, 0);
});

test('mounted replay reveals moments in order, rewinds them, pauses, and settles on blur', async () => {
  let now = base, focused = true; const timers = new Set<() => void>();
  class Clock extends Date { static now() { return now; } }
  const host = (name: string) => React.forwardRef(({ children, ...props }: any, ref) => React.createElement(name, { ...props, ref }, children));
  const native = { ...Object.fromEntries(['View', 'Text', 'Pressable', 'ActivityIndicator'].map(n => [n, host(n)])), StyleSheet: { create: (s: any) => s, hairlineWidth: 1 }, Linking: { openURL() {} }, PanResponder: { create: (handlers: any) => ({ panHandlers: handlers }) } };
  const api = load('interactive-route-map.tsx', {
    './journey-replay-stage': { JourneyReplayStage: host('ReplayStage'), ReplayPosition: host('ReplayPosition') },
    'react-native': native, 'expo-image': { Image: host('Image') }, 'expo-router': { useIsFocused: () => focused },
    'react-native-reanimated': { __esModule: true, default: { View: host('AnimatedView') }, FadeIn: { duration: () => 'fade' }, FadeInDown: { duration: () => 'enter' } },
    '@maplibre/maplibre-react-native': Object.fromEntries(['Map', 'Camera', 'Marker', 'Layer', 'GeoJSONSource'].map(n => [n, host(n)])),
    './route-moments': route, './journey-replay-model': { recordedReplayStops, replayPhotoMoments },
    './app-theme': { useAppTheme: () => testTheme('sakura'), useThemedStyles: (s: any) => s },
    './journey-map-theme': { journeyDeckMapPalette: () => ({}), loadJourneyDeckMapStyle: async () => ({}) },
    './motion': { useSettleWhenAppInactive() {} }, './delight-ui': { AdaptiveGlassSurface: host('Glass') },
    './use-core-motion': { useCoreMotion: () => ({ animate: false, reduceTransparency: true }) },
  }, { Date: Clock, fetch: () => {}, setInterval: (fn: () => void) => { timers.add(fn); return fn; }, clearInterval: (fn: () => void) => timers.delete(fn) });
  const song = (index: number, second: number) => ({ index, playedAt: iso(second), coordinate: samples[0].coordinate, track: `Song ${index}`, artist: 'Artist', durationMs: 30_000 });
  const props = { coordinates: samples.map(p => p.coordinate), routeSamples: samples, songMoments: [song(1, 60), song(2, 150)], totalSongCount: 2, startedAt: iso(0), endedAt: iso(180), startingBatteryPercent: null, endingBatteryPercent: null, startLabel: 'Start', endLabel: 'End', photos: [{ id: 'p', uri: 'file:///p.jpg', capturedAt: iso(90) }] };
  let tree: any;
  const button = (label: string) => tree.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityLabel === label);
  const markers = () => tree.root.findAllByType('Marker').map((n: any) => n.props.id);
  await act(async () => { tree = create(React.createElement(api.InteractiveRouteMap, props)); });
  assert.ok(markers().includes('journey-song-2'), 'overview retains all song exploration');
  await act(() => button('Play replay').props.onPress());
  assert.ok(!markers().includes('journey-song-1')); assert.ok(!markers().includes('journey-end'));
  await act(() => { now += 20_000; [...timers].forEach(fn => fn()); });
  assert.ok(markers().includes('journey-song-1')); assert.ok(!markers().includes('journey-song-2'));
  await act(() => { now += 5000; [...timers].forEach(fn => fn()); });
  assert.ok(markers().includes('replay-photo-p'));
  assert.equal(tree.root.findByType('ReplayStage').props.photo.uri, 'file:///p.jpg');
  await act(() => button('Pause replay').props.onPress()); assert.equal(timers.size, 0);
  for (let i = 0; i < 2; i++) await act(() => tree.root.findAllByType('View').find((n: any) => n.props.accessibilityRole === 'adjustable').props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  assert.ok(!markers().includes('replay-photo-p'), 'scrubbing backward hides later media');
  await act(() => button('Restart replay').props.onPress()); assert.ok(!markers().includes('replay-photo-p'));
  await act(() => button('Play replay').props.onPress());
  focused = false; await act(() => tree.update(React.createElement(api.InteractiveRouteMap, props)));
  assert.equal(timers.size, 0);
  focused = true; await act(() => tree.update(React.createElement(api.InteractiveRouteMap, props)));
  await act(() => tree.root.findByType('ReplayStage').props.onExplore());
  await act(() => button('Watch journey story').props.onPress());
  await act(() => { now += 60_000; [...timers].forEach(fn => fn()); });
  assert.equal(tree.root.findByType('ReplayStage').props.complete, true);
  assert.equal(timers.size, 0, 'one-minute story stops at the destination');
  assert.ok(markers().includes('journey-end'));
  await act(() => tree.unmount());
});
