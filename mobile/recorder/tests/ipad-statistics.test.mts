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
function load(name: string, mocks: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : id.startsWith('../assets/') ? id : require(id) });
  return module.exports;
}
const model = load('ipad-statistics-model.ts');
const journey = (id: string, startedAt: string, miles = 10, durationMinutes = 20) => ({ id, startedAt, miles, durationMinutes, songCount: 1, soundtrackPreview: [], startingLocation: 'Park', endingLocation: 'Museum' });
const song = (name = 'Song', durationMs: number | null = 180000) => ({ track: name, artist: 'Artist', album: 'Album', playedAt: '2026-09-05T12:00:00', durationMs });

test('range totals, previous period, local days, hours and distance bands agree', () => {
  const rows = [journey('a', '2026-09-05T10:00:00', 4), journey('b', '2026-09-05T11:00:00', 5), journey('c', '2026-09-04T12:00:00', 15), journey('d', '2026-09-03T13:00:00', 30), journey('prior', '2026-08-25T10:00:00', 27)];
  const details = rows.map(j => ({ ...j, soundtrack: [song()] }));
  const result = model.buildIpadStatistics(rows, details, 7, new Date('2026-09-05T20:00:00'));
  assert.equal(result.totals.miles, 54); assert.equal(result.totals.drivingMinutes, 80);
  assert.equal(result.totals.journeys, 4); assert.equal(result.totals.activeDays, 3);
  assert.equal(result.totals.plays, 4); assert.equal(result.totals.listeningMinutes, 12);
  assert.equal(result.totals.uniqueTracks, 1); assert.equal(result.totals.partialMusic, false);
  assert.equal(result.previous.miles, 27); assert.equal(result.days.length, 7);
  assert.equal(result.days.reduce((n: number, d: any) => n + d.miles, 0), 54);
  assert.equal(result.hours.reduce((a: number, b: number) => a + b, 0), 4);
  assert.equal(result.bands.map((b: any) => b.count).join(','), '1,1,1,1');
});
test('invalid, future, duplicate and inaccessible journeys do not enter statistics', () => {
  const a = journey('a', '2026-09-05T10:00:00', -2, NaN);
  const result = model.buildIpadStatistics([a, a, journey('bad', 'invalid'), journey('future', '2027-01-01'), journey('old', '2025-01-01')], [], 'all', new Date('2026-09-05T20:00:00'), 45);
  assert.equal(result.totals.journeys, 1); assert.equal(result.totals.miles, 0); assert.equal(result.totals.drivingMinutes, 0);
  assert.equal(result.previous, null); assert.equal(result.totals.partialMusic, true);
  const limited = model.buildIpadStatistics([a], [], 30, new Date('2026-09-05T20:00:00'), 45);
  assert.equal(limited.previous, null, 'do not compare 30 days against an incomplete previous 30');
});
test('music deduplication, missing durations and missing details are explicit', () => {
  const a = journey('a', '2026-09-05T10:00:00'), b = journey('b', '2026-09-04T10:00:00');
  const totals = model.summarize([a, b], [{ ...a, soundtrack: [song(), song(), song('Other', null)] }]);
  assert.equal(totals.listeningMinutes, 3); assert.equal(totals.uniqueTracks, 2);
  assert.equal(totals.uniqueArtists, 1); assert.equal(totals.uniqueAlbums, 1); assert.equal(totals.partialMusic, true);
  assert.equal(model.summarize([], []).partialMusic, false);
});
test('Monday-first calendar and local day iteration work across month and DST boundaries', () => {
  const august = model.calendarDays(new Date(2026, 7, 1));
  assert.equal(model.dayKey(august[0]), '2026-07-27');
  assert.equal(model.dayKey(august.at(-1)), '2026-09-06');
  const result = model.buildIpadStatistics([], [], 7, new Date(2026, 2, 10, 20));
  assert.equal(result.days.map((d: any) => d.key).join(','), '2026-03-04,2026-03-05,2026-03-06,2026-03-07,2026-03-08,2026-03-09,2026-03-10');
});

const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
let light = false, fontScale = 1;
const native = { StyleSheet: { create: (v: any) => v, hairlineWidth: 1 }, useWindowDimensions: () => ({ fontScale }),
  ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'ActivityIndicator', 'RefreshControl'].map(name => [name, host(name)])) };
const ui = load('ipad-statistics-screen.tsx', {
  'react-native': native, 'react-native-svg': { __esModule: true, default: host('Svg'), Circle: host('Circle'), Line: host('Line'), Polyline: host('Polyline') },
  'expo-symbols': { SymbolView: host('Symbol') },
  'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView'), useSafeAreaInsets: () => ({ bottom: 20 }) },
  './app-theme': { useAppTheme: () => ({ isLight: light }) }, './theme-palette': load('theme-palette.ts'),
  './ipad-page-header': { IpadPageHeader: host('Header') }, './card-detail-link': { CardDetailLink: host('DetailLink') },
  './journey-title': load('journey-title.ts'), './ipad-statistics-model': model,
});
const text = (tree: any) => tree.root.findAllByType('Text').map((n: any) => n.children.join('')).join('|');
const button = (tree: any, label: string) => tree.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityLabel === label);
test('widgets precede calendar; date selection, paging, ranges, links, refresh and themes work', async () => {
  let tree: any, upgrades = 0, refreshes = 0, opened = '', atlas = 0;
  const today = new Date(), todayKey = model.dayKey(today);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0).toISOString();
  const rows = Array.from({ length: 12 }, (_, i) => journey(`j${i}`, start));
  const state = { status: 'ready', data: { journeys: rows, details: rows.map(j => ({ ...j, soundtrack: [song()] })) } };
  const render = (historyDays: number | null = 45, dataState: any = state) => React.createElement(ui.IpadStatisticsScreen, { state: dataState, historyDays, onUpgrade: () => upgrades++, onRefresh: () => refreshes++, onJourney: (id: string) => { opened = id; }, onAtlas: () => atlas++ });
  try {
    await act(async () => { tree = create(render()); });
    const canvas = tree.root.findByProps({ testID: 'ipad-statistics-canvas' });
    const widgets = canvas.findByProps({ testID: 'statistics-widgets' });
    assert.equal(widgets.findAllByType('Symbol').length, 6);
    assert.ok(text(tree).indexOf('Active days') < text(tree).indexOf('Your days, in detail'));
    await act(async () => button(tree, '90D · Plus').props.onPress()); assert.equal(upgrades, 1);
    await act(async () => tree.root.findByProps({ testID: `day-${todayKey}` }).props.onPress());
    assert.equal(tree.root.findByProps({ testID: `day-${todayKey}` }).props.accessibilityState.selected, true);
    await act(async () => button(tree, 'More journeys this day').props.onPress());
    assert.equal(button(tree, 'More journeys this day'), undefined);
    await act(async () => button(tree, 'Show more journeys').props.onPress());
    assert.equal(button(tree, 'Show more journeys'), undefined);
    await act(async () => button(tree, 'Open Park → Museum').props.onPress()); assert.ok(opened.startsWith('j'));
    await act(async () => button(tree, 'Open Atlas').props.onPress()); assert.equal(atlas, 1);
    for (const [width, scale, direction] of [[1200, 1, 'row'], [772, 1, 'column'], [280, 1, 'column'], [1200, 2, 'column']] as const) {
      fontScale = scale;
      await act(async () => canvas.props.onLayout({ nativeEvent: { layout: { width } } }));
      assert.equal(tree.root.findByProps({ testID: 'statistics-calendar-layout' }).props.style.flexDirection, direction);
      assert.equal(tree.root.findByProps({ testID: `day-${todayKey}` }).props.accessibilityState.selected, true);
    }
    light = true;
    await act(async () => tree.update(render(null)));
    assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor, '#fffaf0');
    await act(async () => button(tree, 'All').props.onPress());
    assert.equal(button(tree, 'All').props.accessibilityState.selected, true);
    await act(async () => tree.update(render(null, { ...state, status: 'error', message: 'Refresh failed' })));
    assert.match(text(tree), /Refresh failed/);
    await act(async () => button(tree, 'Try again').props.onPress()); assert.equal(refreshes, 1);
    assert.match(text(tree), /Total miles/);
  } finally { await act(async () => tree?.unmount()); fontScale = 1; light = false; }
});
test('loading and error do not invent zero data; empty loaded data has an honest state', async () => {
  let tree: any;
  const render = (state: any) => React.createElement(ui.IpadStatisticsScreen, { state, historyDays: null, onRefresh() {}, onJourney() {}, onUpgrade() {} });
  try {
    await act(async () => { tree = create(render({ status: 'loading', data: null })); });
    assert.equal(tree.root.findAllByType('ActivityIndicator').length, 1); assert.doesNotMatch(text(tree), /Total miles/);
    await act(async () => tree.update(render({ status: 'error', data: null })));
    assert.match(text(tree), /unavailable/); assert.doesNotMatch(text(tree), /Total miles/);
    await act(async () => tree.update(render({ status: 'ready', data: { journeys: [], details: [] } })));
    assert.match(text(tree), /No journeys in this period/); assert.match(text(tree), /0 mi/);
  } finally { await act(async () => tree?.unmount()); }
});
