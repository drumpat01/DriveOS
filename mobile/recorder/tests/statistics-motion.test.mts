import { touchFeedbackMock } from './touch-feedback-fixture.mts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { statisticsFraction, statisticsPointsString, statisticsSparkline } from '../src/statistics-motion-model.ts';
import { testTheme } from './theme-fixture.mts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(name: string, mocks: Record<string, any> = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id === './touch-feedback' ? touchFeedbackMock : id in mocks ? mocks[id] : id.startsWith('../assets/') ? id : id.startsWith('./') ? require(`../src/${id.slice(2)}`) : require(id) });
  return module.exports;
}
function flatten(style: any): any {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return style?.evaluate ? style.evaluate() : style ?? {};
}
function harness() {
  const state = { reduceMotion: false, focused: true, isAppActive: true, haptics: 0, values: [] as any[], animations: [] as any[] };
  const transition = () => {
    const builder: any = { duration: (duration: number) => { builder.ms = duration; return builder; }, easing: () => builder,
      withInitialValues: (values: any) => { builder.initial = values; return builder; } };
    return builder;
  };
  const native = { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', RefreshControl: 'RefreshControl', ActivityIndicator: 'ActivityIndicator',
    StyleSheet: { create: (v: any) => v, hairlineWidth: 1 }, useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }) };
  const svg = { __esModule: true, default: 'Svg', Polyline: 'Polyline', Circle: 'Circle', Line: 'Line' };
  const api = load('statistics-motion.tsx', {
    'react-native': native, 'react-native-svg': svg, 'expo-router': { useIsFocused: () => state.focused },
    './motion': { MOTION_DURATIONS: { standard: 260 }, useMotionPreferences: () => state },
    './statistics-motion-model': { statisticsFraction, statisticsPointsString, statisticsSparkline },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: any) => component },
      Easing: { bezier: (...args: any[]) => args }, LinearTransition: transition(), FadeInDown: transition(),
      useAnimatedProps: (evaluate: () => any) => ({ evaluate }), useAnimatedStyle: (evaluate: () => any) => ({ evaluate }),
      cancelAnimation: (value: any) => { if (value.animation) value.animation.cancelled = true; value.animation = null; },
      withTiming: (to: any, config: any) => ({ to, config, timing: true }),
      useSharedValue: (initial: any) => {
        const [value] = React.useState(() => {
          const shared: any = { current: initial, get: () => shared.current, set: (next: any) => {
            if (next?.timing) {
              const animation = { ...next, from: shared.current, shared, cancelled: false };
              shared.animation = animation; state.animations.push(animation);
            } else shared.current = next;
          } };
          state.values.push(shared); return shared;
        });
        return value;
      },
    },
  });
  const screen = load('ipad-statistics-screen.tsx', {
    'react-native': native, 'react-native-svg': svg, 'expo-symbols': { SymbolView: 'Symbol' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
    './statistics-motion': api, './haptics': { haptics: { selection: () => state.haptics++ } },
    './app-theme': { useAppTheme: () => testTheme('redline') },
    './delight-ui': { AdaptiveGlassSurface: 'GlassSurface' },
    './use-core-motion': { useCoreMotion: () => ({ reduceTransparency: false }) },
    './theme-palette': load('theme-palette.ts'), './ipad-page-header': { IpadPageHeader: 'Header' },
    './card-detail-link': { CardDetailLink: ({ children }: any) => children }, './journey-title': load('journey-title.ts'),
    './ipad-statistics-model': load('ipad-statistics-model.ts'),
    './device-layout': {
      IPAD_GRID_GAP: 12,
      ipadGridColumns: (width: number, scale = 1) => width / scale >= 900 ? 6 : width / scale >= 540 ? 3 : width / scale >= 330 ? 2 : 1,
      ipadGridSpan: (width: number, span: number, columns = 6, gap = 12) => (width - gap * (columns - 1)) / columns * span + gap * (span - 1),
    },
  });
  return { state, api, screen,
    wrap: (child: any) => React.createElement(api.StatisticsMotionProvider, null, child),
    step: (progress: number) => state.values.forEach(value => {
      const animation = value.animation;
      if (!animation || animation.cancelled) return;
      const mix = (from: number, to: number) => from + (to - from) * progress;
      value.current = Array.isArray(animation.to) ? animation.to.map((to: number, i: number) => mix(animation.from[i], to)) : mix(animation.from, animation.to);
    }),
  };
}

test('sparkline targets retain exact daily vertices, zeros and extrema across all range lengths', () => {
  for (const count of [7, 30, 90, 160]) {
    const values = Array.from({ length: count }, (_, i) => i % 5 ? i : 0);
    const visible = values.slice(-90), points = statisticsSparkline(values), max = Math.max(1, ...visible);
    assert.equal(points.length, 180);
    visible.forEach((n, i) => {
      assert.equal(points[i * 2], i / (visible.length - 1) * 160);
      assert.equal(points[i * 2 + 1], 28 - n / max * 25);
    });
    assert.equal(points.at(-2), 160);
    assert.ok(points.every(Number.isFinite));
  }
  for (const values of [[], [0], [NaN, Infinity, -3]]) assert.ok(statisticsSparkline(values).every(Number.isFinite));
  assert.equal(statisticsFraction(NaN), 0); assert.equal(statisticsFraction(-1), 0); assert.equal(statisticsFraction(2), 1);
});

test('bars and lines retarget their actual mid-flight geometry, then settle on blur, Reduce Motion and background', async () => {
  const h = harness(); let tree: any;
  const render = (fraction: number, values: number[]) => h.wrap(React.createElement(React.Fragment, null,
    React.createElement(h.api.StatisticsBar, { fraction, color: '#fff' }),
    React.createElement(h.api.StatisticsSparkline, { values, color: '#fff' })));
  try {
    await act(() => { tree = create(render(.2, [0, 10, 0])); });
    assert.equal(h.state.animations.length, 0, 'initial data is visible immediately');
    await act(() => tree.update(render(.8, [10, 0, 10, 5])));
    h.step(.5);
    const bar = () => flatten(tree.root.findByProps({ testID: 'statistics-animated-bar' }).props.style);
    assert.equal(bar().transformOrigin, 'center bottom');
    assert.equal(bar().transform[0].scaleY, .5);
    const line = () => tree.root.findByType('Polyline').props.animatedProps.evaluate().points;
    const midpoint = line();
    await act(() => tree.update(render(.1, [0, 5, 0, 5, 0])));
    assert.equal(bar().transform[0].scaleY, .5, 'no reset to either previous target');
    assert.equal(line(), midpoint, 'chart remains continuous at interruption');
    assert.ok(h.state.animations.slice(0, 2).every(a => a.cancelled));
    h.step(1);
    assert.ok(Math.abs(bar().transform[0].scaleY - .1) < 1e-9);
    assert.equal(line(), statisticsPointsString(statisticsSparkline([0, 5, 0, 5, 0])));
    for (const preference of ['reduceMotion', 'focused', 'isAppActive'] as const) {
      await act(() => tree.update(render(.9, [5, 0, 5]))); h.step(.25);
      h.state[preference] = preference === 'reduceMotion';
      await act(() => tree.update(render(.9, [5, 0, 5])));
      assert.equal(bar().transform[0].scaleY, .9);
      assert.equal(line(), statisticsPointsString(statisticsSparkline([5, 0, 5])));
      const count = h.state.animations.length;
      h.state[preference] = preference !== 'reduceMotion';
      await act(() => tree.update(render(.9, [5, 0, 5])));
      assert.equal(h.state.animations.length, count, 'returning to a screen does not replay its chart');
      await act(() => tree.update(render(.1, [0, 1, 0]))); h.step(1);
    }
  } finally { await act(() => tree?.unmount()); }
  assert.ok(h.state.values.every(v => !v.animation), 'unmount cancels every outstanding animation');
});

test('rolling digits retain interruption position, use measured text height, and expose only the final formatted value', async () => {
  const h = harness(); let tree: any;
  const render = (value: string) => h.wrap(React.createElement(h.api.StatisticsRollingValue, { value, style: { fontSize: 24 } }));
  try {
    await act(() => { tree = create(render('2 mi')); });
    const measuredText = () => tree.root.findAllByType('Text').find((n: any) => n.props.onLayout);
    await act(() => measuredText().props.onLayout({ nativeEvent: { layout: { height: 58 } } }));
    await act(() => tree.update(render('8 mi'))); h.step(.5);
    const strip = () => flatten(tree.root.findByType('AnimatedView').props.style);
    assert.equal(strip().transform[0].translateY, -5 * 58);
    await act(() => tree.update(render('1 mi')));
    assert.equal(strip().transform[0].translateY, -5 * 58);
    assert.equal(tree.root.findByProps({ testID: 'statistics-rolling-value' }).props.accessibilityLabel, '1 mi');
    assert.equal(tree.root.findByProps({ importantForAccessibility: 'no-hide-descendants' }).props.accessibilityElementsHidden, true);
    h.step(1);
    assert.equal(strip().transform[0].translateY, -58);
    await act(() => measuredText().props.onLayout({ nativeEvent: { layout: { height: 72 } } }));
    assert.equal(strip().transform[0].translateY, -72, 'font-size changes use the new measured row height');
    h.state.reduceMotion = true;
    await act(() => tree.update(render('9 mi')));
    assert.equal(strip().transform[0].translateY, -9 * 72);
  } finally { await act(() => tree?.unmount()); }
});

test('day reveal supports returning to the original date, empty content and reduced motion without stale journeys', async () => {
  const h = harness(); let tree: any;
  const render = (key: string, content: string) => h.wrap(React.createElement(h.api.StatisticsDayJourneys, { selectionKey: key }, React.createElement('Text', null, content)));
  try {
    await act(() => { tree = create(render('a', 'Journey A')); });
    const inner = () => tree.root.findAllByType('AnimatedView').at(-1);
    assert.equal(inner().props.entering, undefined);
    await act(() => tree.update(render('b', 'No journeys recorded this day.')));
    assert.ok(inner().props.entering);
    assert.deepEqual(tree.root.findAllByType('Text').map((n: any) => n.children.join('')), ['No journeys recorded this day.']);
    await act(() => tree.update(render('a', 'Journey A')));
    assert.ok(inner().props.entering, 'returning to the first date also reveals');
    assert.ok(tree.root.findAllByType('AnimatedView')[0].props.layout);
    h.state.reduceMotion = true;
    await act(() => tree.update(render('b', 'Empty')));
    assert.equal(inner().props.entering, undefined);
    assert.equal(tree.root.findAllByType('AnimatedView')[0].props.layout, undefined);
  } finally { await act(() => tree?.unmount()); }
});

test('real Statistics range and calendar actions drive the motion while preserving paywalls and journey navigation', async () => {
  const h = harness(); let tree: any, upgrades = 0, opened = '';
  const now = new Date(), old = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 12, 0);
  const journey = (id: string, date: Date, miles: number) => ({ id, startedAt: date.toISOString(), miles, durationMinutes: 20, songCount: 1, soundtrackPreview: [], startingLocation: 'Park', endingLocation: 'Museum' });
  const rows = [journey('new', now, 2), journey('old', old, 80)];
  const props = { state: { status: 'ready', data: { journeys: rows, details: [] } }, historyDays: 45, compact: true,
    onRefresh() {}, onUpgrade: () => upgrades++, onJourney: (id: string) => { opened = id; } };
  const button = (label: string) => tree.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityLabel === label);
  const totals = () => tree.root.findAllByType('View').filter((n: any) => n.props.testID === 'statistics-rolling-value').map((n: any) => n.props.accessibilityLabel);
  try {
    await act(() => { tree = create(React.createElement(h.screen.IpadStatisticsScreen, props)); });
    assert.ok(totals().includes('82 mi'));
    const hourly = tree.root.findAllByType('Pressable').filter((n: any) => n.props.accessibilityLabel?.includes(':00:'));
    assert.equal(hourly.length, 24);
    assert.ok(hourly.every((n: any) => flatten(n.props.style).backgroundColor === undefined), 'nonselectable hourly bars do not inherit a date highlight');
    const lines = tree.root.findAllByType('Polyline');
    await act(() => button('7D').props.onPress());
    assert.ok(totals().includes('2 mi'));
    assert.equal(h.state.haptics, 1);
    assert.ok(h.state.animations.length > 0);
    assert.equal(tree.root.findAllByType('Polyline')[0], lines[0], 'existing chart instance survives range changes');
    h.step(.4);
    await act(() => button('30D').props.onPress()); h.step(1);
    assert.ok(totals().includes('82 mi'));
    await act(() => button('90D · Plus').props.onPress());
    assert.equal(upgrades, 1); assert.equal(h.state.haptics, 2, 'locked range does not run the data-change haptic');
    const dayButtons = tree.root.findAllByType('Pressable').filter((n: any) => n.props.testID?.startsWith('day-') && !n.props.disabled);
    const empty = dayButtons.find((n: any) => n.props.accessibilityLabel.includes('0 journeys'));
    await act(() => empty.props.onPress());
    const content = tree.root.findByProps({ testID: 'statistics-day-journeys' });
    assert.equal(content.findAllByType('Pressable').length, 0, 'old date links do not remain clickable');
    const today = dayButtons.find((n: any) => n.props.accessibilityLabel.includes('2 miles, 1 journeys'));
    await act(() => today.props.onPress());
    await act(() => tree.root.findByProps({ testID: 'statistics-day-journeys' }).findByType('Pressable').props.onPress());
    assert.equal(opened, 'new');
  } finally { await act(() => tree?.unmount()); }
});
