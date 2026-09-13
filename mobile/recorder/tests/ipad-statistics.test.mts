import { touchFeedbackMock } from './touch-feedback-fixture.mts';
import { testTheme } from './theme-fixture.mts';
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
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id === './touch-feedback' ? touchFeedbackMock : id in mocks ? mocks[id] : id === './theme-catalog.ts' ? require('../src/theme-catalog.ts') : id.startsWith('../assets/') ? id : require(id) });
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
let light: boolean | 'sakura' | 'redline' = false, fontScale = 1;
const native = { Platform: { OS: 'ios', isPad: true }, StyleSheet: { create: (v: any) => v, hairlineWidth: 1 }, useWindowDimensions: () => ({ fontScale }),
  ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'ActivityIndicator', 'RefreshControl'].map(name => [name, host(name)])) };
const gridLayout = load('device-layout.ts', { 'react-native': native });
const ui = load('ipad-statistics-screen.tsx', {
  './statistics-motion': {
    StatisticsMotionProvider: ({ children }: any) => children,
    StatisticsMotionFrame: host('View'), StatisticsDayJourneys: host('View'),
    StatisticsRollingValue: ({ value, style }: any) => React.createElement('Text', { style }, value),
    StatisticsBar: host('Bar'), StatisticsSparkline: host('Sparkline'),
  },
  './haptics': { haptics: { selection: () => {} } },
  'react-native': native, 'react-native-svg': { __esModule: true, default: host('Svg'), Circle: host('Circle'), Line: host('Line'), Polyline: host('Polyline') },
  'expo-symbols': { SymbolView: host('Symbol') },
  'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView'), useSafeAreaInsets: () => ({ bottom: 20 }) },
  './theme-material': { ThemeMaterial: host('ThemeMaterial') },
  './app-theme': { useAppTheme: () => testTheme(light) }, './theme-palette': load('theme-palette.ts'),
  './ipad-page-header': { IpadPageHeader: host('Header') }, './card-detail-link': { CardDetailLink: host('DetailLink') },
  './journey-title': load('journey-title.ts'), './ipad-statistics-model': model, './device-layout': gridLayout,
});
const text = (tree: any) => tree.root.findAllByType('Text').map((n: any) => n.children.join('')).join('|');
const button = (tree: any, label: string) => tree.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityLabel === label);

test('Atlas takes the top feature position and Year on the Road follows the statistics in every theme and form factor', async () => {
  let tree: any, atlas = 0, year = 0, upgrades = 0;
  try {
    for (const theme of [false, true, 'sakura', 'redline'] as const) for (const compact of [false, true]) {
      light = theme;
      const render = (onAtlas?: () => void) => React.createElement(ui.IpadStatisticsScreen, {
        state: { status: 'ready', data: { journeys: [], details: [] } }, historyDays: null, compact,
        onRefresh() {}, onJourney() {}, onAtlas, onYearOnRoad: () => year++, onUpgrade: () => upgrades++,
      });
      await act(() => { if (tree) tree.update(render(() => atlas++)); else tree = create(render(() => atlas++)); });
      const content = text(tree);
      assert.ok(content.indexOf('Atlas ↗') < content.indexOf('Total miles'));
      assert.ok(content.indexOf('Your Year on the Road ↗') > content.indexOf('Activity split'));
      const top = button(tree, 'Open Atlas'), bottom = button(tree, 'Your Year on the Road. JourneyDeck Plus');
      assert.deepEqual(top.props.style({ pressed: false }), bottom.props.style({ pressed: false }));
      top.props.onPress(); bottom.props.onPress();
      await act(() => tree.update(render()));
      button(tree, 'Open Atlas').props.onPress();
    }
    assert.equal(atlas, 8); assert.equal(year, 8); assert.equal(upgrades, 8);
  } finally { light = false; await act(() => tree?.unmount()); }
});
test('widgets precede calendar; date selection, paging, ranges, links, refresh and themes work', async () => {
  let tree: any, upgrades = 0, refreshes = 0, opened = '', atlas = 0;
  const today = new Date(), todayKey = model.dayKey(today);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0).toISOString();
  const rows = Array.from({ length: 12 }, (_, i) => journey(`j${i}`, start));
  const state = { status: 'ready', data: { journeys: rows, details: rows.map(j => ({ ...j, soundtrack: [song()] })) } };
  const render = (historyDays: number | null = 45, dataState: any = state, compact = false) => React.createElement(ui.IpadStatisticsScreen, { state: dataState, historyDays, compact, onUpgrade: () => upgrades++, onRefresh: () => refreshes++, onJourney: (id: string) => { opened = id; }, onAtlas: () => atlas++ });
  try {
    await act(async () => { tree = create(render()); });
    const canvas = tree.root.findByProps({ testID: 'ipad-statistics-canvas' });
    const widgets = canvas.findByProps({ testID: 'statistics-widgets' });
    const metricSymbols = widgets.findAllByType('Symbol');
    assert.equal(metricSymbols.length, 6);
    assert.equal(new Set(metricSymbols.map((node: any) => node.props.tintColor)).size, 6, 'headline metrics use distinct cinematic accents');
    const metricCards = widgets.findAllByType('View').filter((node: any) => Array.isArray(node.props.style) && node.props.style.flat().some((style: any) => style?.height === 200));
    assert.equal(metricCards.length, 6);
    assert.ok(metricCards.every((node: any) => node.props.style.flat().some((style: any) => style?.shadowOpacity > 0)), 'dark metric cards have neon glows');
    assert.match(text(tree), /Journey averages/); assert.match(text(tree), /Record book/); assert.match(text(tree), /Activity split/);
    assert.ok(tree.root.findByProps({ testID: 'statistics-bottom-widgets' }));
    assert.ok(text(tree).indexOf('Active days') < text(tree).indexOf('Your days, in detail'));
    const selectedThirtyDayBorder = button(tree, '30D').props.style.flat().find((style: any) => style?.opacity !== undefined).borderColor;
    await act(async () => button(tree, '7D').props.onPress());
    assert.equal(button(tree, '7D').props.style.flat().find((style: any) => style?.opacity !== undefined).borderColor, selectedThirtyDayBorder, '7D and 30D share the same selected filter accent');
    await act(async () => button(tree, '30D').props.onPress());
    await act(async () => button(tree, '90D · Plus').props.onPress()); assert.equal(upgrades, 1);
    await act(async () => tree.root.findByProps({ testID: `day-${todayKey}` }).props.onPress());
    const selectedDate = tree.root.findByProps({ testID: `day-${todayKey}` });
    assert.equal(selectedDate.props.accessibilityState.selected, true);
    assert.ok(selectedDate.props.style.flat().some((style: any) => style?.shadowOpacity > 0), 'selected dark date glows');
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (tomorrow.getMonth() === today.getMonth()) {
      const futureDate = tree.root.findByProps({ testID: `day-${model.dayKey(tomorrow)}` });
      assert.equal(futureDate.props.accessibilityState.disabled, true);
      assert.equal(futureDate.props.style.flat().find((style: any) => style?.opacity !== undefined).opacity, 1, 'all dates in the displayed month remain fully visible');
    }
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
      assert.equal(tree.root.findByProps({ testID: 'statistics-analysis-row' }).props.style.flexDirection, direction);
      assert.equal(tree.root.findByProps({ testID: 'statistics-bottom-layout' }).props.style.flexDirection, direction);
      assert.equal(tree.root.findByProps({ testID: `day-${todayKey}` }).props.accessibilityState.selected, true);
    }
    for (const id of ['statistics-hourly-panel', 'statistics-scatter-panel', 'statistics-music-panel']) {
      const panel = tree.root.findAllByType('View').find((node: any) => node.props.testID === id);
      assert.ok(panel.props.style.flat().some((style: any) => style?.flex === 1), `${id} fills its row`);
    }
    fontScale = 1;
    await act(async () => tree.update(render()));
    assert.equal(tree.root.findByProps({ testID: 'statistics-distance-panel' }).props.style.width, gridLayout.ipadGridSpan(1200, 4));
    assert.equal(tree.root.findByProps({ testID: 'statistics-breakdown-panel' }).props.style.width, gridLayout.ipadGridSpan(1200, 2));
    assert.equal(tree.root.findByProps({ testID: 'statistics-calendar-panel' }).props.style.width, gridLayout.ipadGridSpan(1162, 4));
    assert.equal(tree.root.findByProps({ testID: 'statistics-day-panel' }).props.style.width, gridLayout.ipadGridSpan(1162, 2));
    assert.equal(tree.root.findByProps({ testID: 'statistics-recent-panel' }).props.style.width, gridLayout.ipadGridSpan(1200, 4));
    assert.equal(tree.root.findByProps({ testID: 'statistics-bottom-widgets' }).props.style.width, gridLayout.ipadGridSpan(1200, 2));
    await act(async () => canvas.props.onLayout({ nativeEvent: { layout: { width: 390 } } }));
    const phoneMetric = tree.root.findByProps({ testID: 'statistics-widgets' }).findAllByType('View').find((node: any) => Array.isArray(node.props.style) && node.props.style.flat().some((style: any) => style?.height === 200));
    assert.equal(phoneMetric.props.style.flat().find((style: any) => style?.width !== undefined).width, 189, 'phone uses two equal metric columns');
    assert.equal(tree.root.findByProps({ testID: 'statistics-bottom-layout' }).props.style.flexDirection, 'column');
    await act(async () => tree.update(render(45, state, true)));
    const header = tree.root.findByType('Header');
    assert.equal(header.props.compact, true);
    assert.equal(header.props.subtitle, undefined, 'Statistics omits the sentence beneath its artwork');
    assert.equal(header.props.artworkTreatment, 'bright', 'Statistics requests the brighter center treatment');
    assert.equal(header.findAllByProps({ accessibilityLabel: '7D' }).length, 0, 'range filters render below rather than inside the artwork header');
    assert.equal(tree.root.findByType('SafeAreaView').props.edges.join(','), 'top,left,right');
    assert.equal(tree.root.findByProps({ testID: 'ipad-statistics' }).props.contentInsetAdjustmentBehavior, 'never');
    assert.equal(tree.root.findByProps({ testID: 'ipad-statistics' }).props.contentContainerStyle.padding, 16);
    for (const label of ['7D', '30D', '90D · Plus', 'All · Plus']) {
      const item = tree.root.findAllByProps({ testID: 'selection-item' }).find((node: any) => node.findAllByProps({ accessibilityLabel: label }).length);
      assert.equal(item?.props.style.flex, 1, `${label} shares one equal-width phone range row`);
      assert.equal(item?.props.style.minWidth, 0, `${label} can contract on narrow phones`);
      const labelNode = item?.findByProps({ accessibilityLabel: label }).findByType('Text');
      assert.equal(labelNode?.props.adjustsFontSizeToFit, true, `${label} remains legible in the compact row`);
    }
    fontScale = 1.3;
    await act(async () => tree.update(render(45, state, true)));
    for (const label of ['7D', '30D', '90D · Plus', 'All · Plus']) {
      const item = tree.root.findAllByProps({ testID: 'selection-item' }).find((node: any) => node.findAllByProps({ accessibilityLabel: label }).length);
      assert.equal(item?.props.style.flexBasis, '45%', `${label} wraps at larger accessibility text sizes`);
    }
    fontScale = 1;
    light = true;
    await act(async () => tree.update(render(null)));
    assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor, '#fffaf0');
    assert.equal(tree.root.findByProps({ testID: `day-${todayKey}` }).props.style.flat().some((style: any) => style?.shadowOpacity > 0), false, 'light mode keeps the pastel treatment without neon shadows');
    await act(async () => button(tree, 'All').props.onPress());
    assert.equal(button(tree, 'All').props.accessibilityState.selected, true);
    const beforeThemeChange = text(tree);
    for (const id of ['sakura', 'redline'] as const) {
      light = id;
      await act(async () => tree.update(render(null)));
      const theme = testTheme(id);
      assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor, theme.palette.page);
      assert.equal(text(tree), beforeThemeChange, 'changing theme preserves raw statistics and selected range');
      const accents = tree.root.findByProps({ testID: 'statistics-widgets' }).findAllByType('Symbol').map((n: any) => n.props.tintColor);
      assert.equal(new Set(accents).size, 6);
      assert.ok(accents.includes(theme.palette.blue) && accents.includes(theme.palette.teal));
      assert.equal(button(tree, 'All').props.accessibilityState.selected, true);
    }
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
