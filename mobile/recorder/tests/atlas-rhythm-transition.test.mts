import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { themedStyleSheet } from '../src/theme-palette.ts';
import { testTheme } from './theme-fixture.mts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compile(source: string, dependencies: Record<string, any>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
    if (id in dependencies) return dependencies[id];
    if (id.startsWith('.')) return {};
    return require(id);
  } });
  return module.exports;
}
// Execute the installed interpolation implementation, including its clamp rules.
const interpolation = compile(readFileSync(new URL('../node_modules/react-native-reanimated/src/interpolation.ts', import.meta.url), 'utf8'), {});
const source = readFileSync(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
const insight = {
  ready: true, leadingDay: 'Fri', leadingDayJourneys: 2, leadingTime: 'Morning',
  journeyCount: 5, miles: 18, averageMinutes: 7, mostActiveHour: 8,
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => ({ label, journeys: index % 3 })),
  twoHourBuckets: Array.from({ length: 12 }, (_, index) => index % 3),
  weekdayTwoHourBuckets: Array.from({ length: 7 }, () => Array.from({ length: 12 }, (_, index) => index % 3)),
};
function style(value: any): any {
  if (!value) return {};
  if (Array.isArray(value)) return Object.assign({}, ...value.map(style));
  return value.evaluate ? value.evaluate() : value;
}
function transform(node: any) {
  return Object.assign({}, ...style(node.props.style).transform);
}
async function harness(themeId = 'light', reduceMotion = false, grid = false) {
  const theme = testTheme(themeId);
  const state = {
    haptics: 0, measurements: 0, frame: [210, 420, 190, 230],
    animations: [] as any[], values: [] as any[],
  };
  const api = compile(source + '\nexports.RhythmCard = DrivingRhythmsCard; exports.InsightGrid = AtlasInsightGrid;', {
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal',
      StyleSheet: { create: (v: any) => v, hairlineWidth: 0.5,
        absoluteFill: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 },
      },
      useWindowDimensions: () => ({ width: 440, height: 956 }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 62, bottom: 34 }) },
    'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'expo-symbols': { SymbolView: 'Symbol' }, 'expo-constants': {}, 'expo-updates': {},
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', LinearGradient: 'SvgGradient', Path: 'Path', Stop: 'Stop' },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' }, ...interpolation,
      Easing: { bezier: (...points: number[]) => points },
      useSharedValue: (initial: number) => {
        const [shared] = React.useState(() => {
          const value = { current: initial, get: () => value.current, set: (next: any) => {
            if (typeof next === 'number') value.current = next;
            else state.animations.push({ ...next, shared: value });
          } };
          state.values.push(value);
          return value;
        });
        return shared;
      },
      useAnimatedStyle: (evaluate: () => any) => ({ evaluate }),
      withTiming: (to: number, config: any, finish?: (finished: boolean) => void) => ({ to, config, finish }),
      cancelAnimation: () => {},
    },
    'react-native-worklets': { scheduleOnRN: (callback: () => void) => callback() },
    './app-theme': { useAppTheme: () => theme, useThemedStyles: (value: any) => themedStyleSheet(value, theme.id) },
    './motion': { useMotionPreferences: () => ({ reduceMotion }) },
    './haptics': { haptics: { softImpact: async () => { state.haptics++; } } },
    './neon-widget-outline': { NeonWidgetOutline: 'Outline' },
  });
  let tree: any;
  await act(() => { tree = create(grid ? React.createElement(api.InsightGrid, { insights: { drivingRhythms: insight, routeDna: { ready: false }, exploration: { ready: false }, placeRelationships: { ready: false } } }) : React.createElement(api.RhythmCard, { insight }), { createNodeMock: () => ({
    measureInWindow: (callback: (...bounds: number[]) => void) => { state.measurements++; callback(...state.frame); },
  }) }); });
  const sourceCard = () => tree.root.findByProps({ accessibilityLabel: 'Driving Rhythms. Open expanded details.' });
  return {
    state, tree, sourceCard,
    tap: () => act(() => sourceCard().props.onPress()),
    show: () => act(() => tree.root.findByType('Modal').props.onShow()),
    step: (progress: number) => { state.values[0].current = progress; },
    close: () => act(() => tree.root.findByType('Modal').props.onRequestClose()),
    finish: () => act(() => { const animation = state.animations.at(-1); animation.shared.current = animation.to; animation.finish?.(true); }),
    unmount: () => act(() => tree.unmount()),
  };
}

test('all four Atlas cards share unpadded equal columns and the tallest intrinsic content height without feeding stretched sizes back into layout', async () => {
  const h = await harness('sakura', false, true);
  try {
    const cells = () => ['route', 'rhythm', 'exploration', 'places'].map(id => h.tree.root.findByProps({ testID: `atlas-cell-${id}` }));
    for (const cell of cells()) {
      assert.equal(style(cell.props.style).flexBasis, 0);
      assert.equal(style(cell.props.style).paddingHorizontal, undefined);
      assert.equal(style(cell.props.style).minHeight, 230);
    }
    const measurements = () => cells().map(cell => cell.findAllByType('View').find((node: any) => node.props.onLayout));
    await act(() => measurements().forEach((node: any, i: number) => node.props.onLayout({ nativeEvent: { layout: { height: [280, 255, 240, 260][i] } } })));
    assert.ok(cells().every(cell => style(cell.props.style).minHeight === 281));
    await act(() => measurements().forEach((node: any) => node.props.onLayout({ nativeEvent: { layout: { height: 229 } } })));
    assert.ok(cells().every(cell => style(cell.props.style).minHeight === 230), 'can shrink after wider layout or smaller text');
    h.state.frame = [210, 420, 204, 281];
    await h.tap(); await h.show();
    const modal = h.tree.root.findByType('Modal');
    assert.equal(modal.findAllByType('View').filter((node: any) => node.props.onLayout).length, 0, 'moving duplicate cannot change grid measurements');
    const front = modal.findAllByType('AnimatedView')[1];
    assert.equal(style(front.props.style).width, 204); assert.equal(style(front.props.style).height, 281);
  } finally { await h.unmount(); }
});

test('the widget stays visible while UIKit presents; motion and one haptic start only when its replacement is ready', async () => {
  const h = await harness();
  try {
    await h.tap();
    assert.equal(h.tree.root.findAllByType('Modal').length, 1);
    assert.equal(style(h.sourceCard().props.style).opacity ?? 1, 1, 'no exposed page-colored hole before onShow');
    assert.equal(h.state.animations.length, 0, 'mounting must not start the flip early');
    assert.equal(h.state.haptics, 0);
    await h.tap();
    assert.equal(h.state.measurements, 1, 'rapid duplicate taps cannot create another presentation');
    await h.show();
    assert.equal(style(h.sourceCard().props.style).opacity, 0);
    assert.equal(h.state.animations[0].to, 1);
    assert.equal(h.state.animations[0].config.duration, 650);
    assert.equal(h.state.haptics, 1);
    await h.show();
    assert.equal(h.state.animations.length, 1);
    assert.equal(h.state.haptics, 1);
    h.step(0.72);
    await h.close();
    await h.close();
    assert.equal(h.state.animations.length, 2, 'one uninterrupted reverse even after a second close request');
    assert.equal(h.state.animations[1].config.duration, 520);
    assert.equal(style(h.sourceCard().props.style).opacity, 0, 'retain the return source handoff until the flip finishes');
    await h.finish();
    assert.equal(h.tree.root.findAllByType('Modal').length, 0);
    assert.equal(style(h.sourceCard().props.style).opacity ?? 1, 1);
    await h.tap();
    await h.show();
    assert.equal(h.state.haptics, 2, 'the next opening starts a fresh presentation');
  } finally { await h.unmount(); }
});

for (const themeId of ['dark', 'light', 'sakura', 'redline']) test(`${themeId}: complete card faces stay together above the backdrop with continuous geometry`, async () => {
  const h = await harness(themeId);
  try {
    await h.tap(); await h.show();
    const [backdrop, front, back] = h.tree.root.findByType('Modal').findAllByType('AnimatedView');
    assert.equal(back.parent, front.parent, 'both rotating faces belong to the same foreground scene');
    assert.notEqual(front.parent, backdrop.parent, 'rotating faces cannot directly share the backdrop plane');
    assert.equal(front.parent.props.collapsable, false, 'Fabric must retain the native flattening boundary');
    assert.equal(style(front.parent.props.style).transform, undefined, 'the boundary itself must stay flat');
    assert.ok(style(front.parent.props.style).zIndex > (style(backdrop.props.style).zIndex ?? 0));
    assert.equal(back.findAllByType('Svg').length, 1, 'the chart travels with the back face, never as a late overlay');
    assert.deepEqual(front.findAllByType('Gradient').map((node: any) => node.props.colors),
      h.sourceCard().findAllByType('Gradient').map((node: any) => node.props.colors), 'tapping does not replace the themed card or bars');
    assert.deepEqual(front.findAllByType('Symbol').map((node: any) => node.props.name),
      h.sourceCard().findAllByType('Symbol').map((node: any) => node.props.name));
    for (const progress of [0, 0.25, 0.46, 0.5, 0.54, 0.75, 0.9, 0.99, 1]) {
      h.step(progress);
      for (const face of [front, back]) {
        const current = style(face.props.style);
        assert.ok(current.opacity >= 0 && current.opacity <= 1, `valid opacity at ${progress}`);
        assert.equal(current.display, undefined, 'no layout removal/reinsertion in the middle of the animation');
      }
      const a = style(front.props.style), b = style(back.props.style), ta = transform(front), tb = transform(back);
      for (const [key, av, bv] of [
        ['center X', a.left + a.width / 2 + ta.translateX, b.left + b.width / 2 + tb.translateX],
        ['center Y', a.top + a.height / 2 + ta.translateY, b.top + b.height / 2 + tb.translateY],
        ['width', a.width * ta.scaleX, b.width * tb.scaleX],
        ['height', a.height * ta.scaleY, b.height * tb.scaleY],
      ] as const) assert.ok(Math.abs(av - bv) < 0.000001, `${key} matches at ${progress}`);
    }
    assert.equal(style(front.props.style).opacity, 0);
    assert.equal(style(back.props.style).opacity, 1);
  } finally { await h.unmount(); }
});

test('Reduce Motion retains the presentation handoff and uses the short path without a rotating front', async () => {
  const h = await harness('sakura', true);
  try {
    await h.tap();
    assert.equal(style(h.sourceCard().props.style).opacity ?? 1, 1);
    await h.show();
    assert.equal(h.state.animations[0].config.duration, 180);
    const [, back] = h.tree.root.findByType('Modal').findAllByType('AnimatedView');
    h.step(0.5);
    assert.equal(transform(back).rotateY, '0deg');
    await h.close();
    assert.equal(h.state.animations[1].config.duration, 150);
    await h.finish();
    assert.equal(style(h.sourceCard().props.style).opacity ?? 1, 1);
  } finally { await h.unmount(); }
});

test('invalid source measurements leave the widget visible and allow a later retry', async () => {
  const h = await harness();
  try {
    h.state.frame = [0, 0, 0, 230];
    await h.tap();
    assert.equal(h.tree.root.findAllByType('Modal').length, 0);
    assert.equal(h.state.haptics, 0);
    h.state.frame = [210, 420, 190, 230];
    await h.tap();
    assert.equal(h.tree.root.findAllByType('Modal').length, 1);
  } finally { await h.unmount(); }
});
