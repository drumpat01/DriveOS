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

function transpile(name: string) {
  return ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}

function builder(kind: string): any {
  return { kind, duration: (ms: number) => ({ ...builder(kind), ms }), easing() { return this; } };
}

function motionHarness() {
  const module = { exports: {} as any };
  vm.runInNewContext(transpile('list-motion.ts'), {
    module, exports: module.exports,
    require: (id: string) => id === 'react-native-reanimated'
      ? { FadeIn: builder('fade'), FadeInDown: builder('down'), FadeOut: builder('exit'), LinearTransition: builder('layout') }
      : id === './motion'
        ? { MOTION_DURATIONS: { standard: 260, exit: 150 }, motionEasing: { enter: 'enter', exit: 'exit', standard: 'standard' }, useMotionPreferences: () => ({ reduceMotion: false, isAppActive: true }) }
        : require(id),
  });
  return module.exports;
}

function skeletonHarness() {
  const prefs = { reduceMotion: false, isAppActive: true, ambientMotionEnabled: true };
  const pulse = { repeats: 0 };
  const mocks: any = {
    'react-native': { View: 'View', StyleSheet: { create: (value: any) => value } },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' }, ReduceMotion: { Never: 'never' },
      cancelAnimation() {}, interpolate: (_value: number, _from: number[], to: number[]) => to[1],
      useAnimatedStyle: (fn: () => any) => fn(), useSharedValue: (value: number) => ({ value }),
      withRepeat: (anim: any) => { pulse.repeats += 1; return anim; }, withTiming: (value: any) => value,
    },
    './app-theme': { useAppTheme: () => ({ color: (value: string) => value }) },
    './motion': { useMotionPreferences: () => prefs, MOTION_DURATIONS: { sweep: 540 }, motionEasing: { linear: 'linear' } },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(transpile('list-skeleton.tsx'), { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  return { ...module.exports, prefs, pulse };
}

test('list row enter/exit/layout snap off when Reduce Motion or the app is backgrounded', () => {
  const { listRowMotion } = motionHarness();
  const live = listRowMotion({ reduceMotion: false, isAppActive: true });
  assert.equal(live.entering.kind, 'fade');
  assert.equal(live.entering.ms, 260);
  assert.equal(live.exiting.kind, 'exit');
  assert.equal(live.layout.kind, 'layout');
  assert.equal(listRowMotion({ reduceMotion: false, isAppActive: true, variant: 'down' }).entering.kind, 'down');
  assert.equal(listRowMotion({ reduceMotion: false, isAppActive: true, enter: false }).entering, undefined);
  for (const mode of [{ reduceMotion: true, isAppActive: true }, { reduceMotion: false, isAppActive: false }]) {
    const snapped = listRowMotion(mode);
    assert.equal(snapped.entering, undefined);
    assert.equal(snapped.exiting, undefined);
    assert.equal(snapped.layout, undefined);
  }
});

test('skeleton bones pulse on the UI thread and snap to a static fill under Reduce Motion', async () => {
  const h = skeletonHarness();
  let tree: any;
  await act(() => { tree = create(React.createElement(h.SkeletonBone, { width: 48, height: 48 })); });
  assert.ok(h.pulse.repeats > 0);
  assert.equal(tree.root.findAllByType('AnimatedView').length, 1);
  h.prefs.ambientMotionEnabled = false;
  await act(() => tree.update(React.createElement(h.SkeletonBone, { width: 48, height: 48 })));
  assert.equal(tree.root.findAllByType('AnimatedView').length, 0);
  assert.equal(tree.root.findByType('View').props.style.at(-2).opacity, 0.55);
  await act(() => tree.unmount());
});

test('Music and journey list skeletons expose a progress label without fake rows', async () => {
  const h = skeletonHarness();
  let tree: any;
  await act(() => { tree = create(React.createElement(h.MusicArchiveSkeleton, { label: 'Loading your music archive' })); });
  const host = (id: string) => tree.root.findAllByType('View').find((node: any) => node.props.testID === id);
  const music = host('music-archive-skeleton');
  assert.equal(music.props.accessibilityRole, 'progressbar');
  assert.equal(music.props.accessibilityLabel, 'Loading your music archive');
  assert.equal(tree.root.findAllByType('AnimatedView').length, 25);
  await act(() => tree.update(React.createElement(h.JourneyListSkeleton, { compact: true })));
  assert.equal(host('journey-list-skeleton').props.accessibilityLabel, 'Loading your journeys…');
  await act(() => tree.unmount());
});

test('Scout list motion stays Reanimated-only and off Record chrome', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies.moti, undefined);
  assert.doesNotMatch(Object.keys(pkg.dependencies).join('\n'), /moti/i);
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const music = readFileSync(new URL('../src/music-screen.tsx', import.meta.url), 'utf8');
  const ipadMusic = readFileSync(new URL('../src/ipad-music-screen.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
  const memories = readFileSync(new URL('../src/ipad-memories-screen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /list-skeleton|MusicArchiveSkeleton|JourneyListSkeleton|MemoryListSkeleton/);
  assert.match(app, /key="live-recorder"/);
  assert.match(music, /MusicArchiveSkeleton/);
  assert.match(music, /useListRowMotion/);
  assert.match(ipadMusic, /MusicArchiveSkeleton/);
  assert.match(ipadMusic, /useListRowMotion/);
  assert.match(shell, /JourneyListSkeleton/);
  assert.match(shell, /useListRowMotion/);
  assert.match(memories, /MemoryListSkeleton/);
  assert.doesNotMatch(memories, /entering=\{motion/);
});
