import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { testTheme } from './theme-fixture.mts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compile(source: string, dependencies: Record<string, any>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout: () => 1, clearTimeout: () => {}, require: (id: string) => id in dependencies ? dependencies[id] : id.startsWith('.') ? {} : require(id) });
  return module.exports;
}
const src = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const interpolation = compile(readFileSync(new URL('../node_modules/react-native-reanimated/src/interpolation.ts', import.meta.url), 'utf8'), {});
const style = (v: any): any => !v ? {} : Array.isArray(v) ? Object.assign({}, ...v.map(style)) : v.evaluate ? v.evaluate() : v;
const tx = (node: any) => Object.assign({}, ...style(node.props.style).transform);

async function harness(themeId = 'sakura', reduced = false, size = { width: 440, height: 956 }) {
  const state = { active: true, size, reduced, captures: 0, haptics: 0, fallback: 0, selected: 0,
    edited: 0, shared: 0,
    frame: { x: 222, y: 350, width: 190, height: 230 }, failCapture: false,
    releases: [] as string[], navigation: [] as any[], animations: [] as any[], values: [] as any[], api: null as any,
    capture: null as null | (() => Promise<string>),
  };
  const native = { View: 'View', Image: 'Image', Modal: 'Modal', Platform: { OS: 'ios', Version: '26' },
    useWindowDimensions: () => state.size,
    StyleSheet: { create: (v: any) => v, absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } },
  };
  const dependencies = {
    'react-native': native,
    'expo-router': { router: { push: (route: any) => state.navigation.push(route) } },
    'react-native-view-shot': { captureRef: async () => { state.captures++; if (state.failCapture) throw Error('failed'); return state.capture ? state.capture() : 'file:///private-card.png'; }, releaseCapture: (uri: string) => state.releases.push(uri) },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, ...interpolation,
      Easing: { bezier: (...points: number[]) => points }, cancelAnimation: () => {},
      useSharedValue: (initial: number) => {
        const [shared] = React.useState(() => {
          const v = { current: initial, get: () => v.current, set: (next: any) => typeof next === 'number' ? v.current = next : state.animations.push({ ...next, shared: v }) };
          state.values.push(v); return v;
        }); return shared;
      },
      useAnimatedStyle: (evaluate: () => any) => ({ evaluate }),
      withTiming: (to: number, config: any, finish: any) => ({ to, config, finish }),
    },
    'react-native-worklets': { scheduleOnRN: (fn: any) => fn() },
    './app-theme': { useAppTheme: () => testTheme(themeId) },
    './motion': { useMotionPreferences: () => ({ reduceMotion: state.reduced, isAppActive: state.active }) },
    './haptics': { haptics: { softImpact: () => state.haptics++ } },
    './native-navigation-context': { useJourneyDeckNavigation: () => ({ memory: (id: string, onReady: () => void) => React.createElement('MemoryDetails', { id, onReady }, 'real header, hero and journey list') }) },
  };
  const api = compile(src('memory-flip.tsx'), dependencies);
  const { Slot } = require('@radix-ui/react-slot');
  function Link({ href, children }: any) {
    const items = React.Children.toArray(children) as any[];
    return React.createElement(React.Fragment, null,
      React.createElement(Slot, { style: {}, onPress: () => state.navigation.push(href) }, items.find(child => child.type !== Link.Menu)),
      items.find(child => child.type === Link.Menu));
  }
  Link.Trigger = ({ children, ...props }: any) => React.createElement(Slot, props, children);
  Link.AppleZoom = ({ children, ...props }: any) => React.createElement('AppleZoom', {}, React.createElement(Slot, props, children));
  Link.Menu = ({ children }: any) => React.createElement('Menu', {}, children);
  Link.MenuAction = (props: any) => React.createElement('MenuAction', props);
  const links = compile(src('card-detail-link.tsx'), { ...dependencies, './memory-flip': api, 'expo-router': { Link } });
  function Probe() { state.api = api.useMemoryFlip(); return null; }
  const render = () => React.createElement(api.MemoryFlipProvider, {}, React.createElement(Probe),
    React.createElement(links.CardMotionProvider, {}, React.createElement(links.CardDetailLink, { kind: 'memory', id: 'held-memory', onSelect: () => state.selected++, actions: [
      { id: 'edit', title: 'Edit Memory', onPress: () => state.edited++ }, { id: 'share', title: 'Share Memory', onPress: () => state.shared++ },
    ] }, React.createElement('Card', {
      style: ({ pressed }: any) => [{ padding: 12, borderRadius: 20 }, pressed && { backgroundColor: '#fff' }],
      onPress: () => state.fallback++, onPressIn: () => { throw Error('unwanted tap effect'); },
    }))));
  let tree: any;
  await act(() => { tree = create(render(), { createNodeMock: () => ({ measureInWindow: (done: any) => done(state.frame.x, state.frame.y, state.frame.width, state.frame.height) }) }); });
  const card = () => tree.root.findByType('Card');
  return { state, tree, card,
    tap: () => act(async () => { card().props.onPress({ preventDefault() {} }); await Promise.resolve(); }),
    show: () => act(() => tree.root.findByType('Modal').props.onShow()),
    frontReady: () => act(() => tree.root.findByType('Image').props.onLoad()),
    backReady: () => act(() => tree.root.findByType('MemoryDetails').props.onReady()),
    finish: () => act(() => { const a = state.animations.at(-1); a.shared.current = a.to; a.finish(true); }),
    close: () => act(() => tree.root.findByType('Modal').props.onRequestClose()),
    update: () => act(() => tree.update(render())),
    unmount: () => act(() => tree.unmount()),
  };
}

test('memory waits for modal and both images, then opens exactly once and retains the final face until the native destination is ready', async () => {
  const h = await harness();
  try {
    assert.equal(h.tree.root.findAllByType('AppleZoom').length, 0, 'memory flip replaces rather than stacks on native zoom');
    const actions = h.tree.root.findAllByType('MenuAction');
    actions[0].props.onPress(); actions[1].props.onPress();
    assert.equal(h.state.edited, 1); assert.equal(h.state.shared, 1);
    assert.equal(h.state.captures, 0); assert.equal(h.state.navigation.length, 0);
    assert.equal(h.card().props.onPressIn, undefined);
    assert.equal(style(h.card().props.style).backgroundColor, undefined, 'no white pressed style');
    await h.tap(); await h.tap();
    assert.equal(h.state.captures, 1);
    assert.equal(style(h.card().props.style).opacity ?? 1, 1);
    await h.show(); await h.frontReady();
    assert.equal(h.state.haptics, 0, 'no haptic while destination artwork is loading');
    await h.backReady(); await h.show(); await h.backReady();
    assert.equal(h.state.animations.length, 1);
    assert.equal(h.state.animations[0].config.duration, 650);
    assert.equal(h.state.haptics, 1); assert.equal(h.state.selected, 1);
    assert.equal(style(h.card().props.style).opacity, 0);
    assert.equal(h.state.navigation.length, 0);
    await h.finish();
    assert.equal(h.state.navigation.length, 1);
    const route = h.state.navigation[0];
    assert.equal(route.params.id, 'held-memory');
    assert.equal(h.tree.root.findByType('Modal').props.visible, true);
    await act(() => h.state.api.destinationReady('stale'));
    assert.equal(h.tree.root.findByType('Modal').props.visible, true);
    await act(() => h.state.api.destinationReady(route.params.memoryFlip));
    assert.equal(h.tree.root.findByType('Modal').props.visible, false);
    assert.equal(h.state.releases.length, 0, 'retain local image through UIKit dismissal');
    await act(() => h.tree.root.findByType('Modal').props.onDismiss());
    assert.equal(h.tree.root.findAllByType('Modal').length, 0);
    assert.equal(style(h.card().props.style).opacity ?? 1, 1);
    assert.deepEqual(h.state.releases, ['file:///private-card.png']);
    assert.equal(h.state.fallback, 0);
  } finally { await h.unmount(); }
});

for (const theme of ['dark', 'light', 'sakura', 'redline']) test(`${theme}: memory flip shares continuous geometry and ends at the full window bounds`, async () => {
  const h = await harness(theme);
  try {
    await h.tap(); await h.frontReady(); await h.backReady(); await h.show();
    const foreground = h.tree.root.findByProps({ testID: 'memory-flip-foreground' });
    assert.equal(foreground.props.collapsable, false);
    assert.equal(style(foreground.props.style).zIndex, 1);
    const front = foreground.findByProps({ testID: 'memory-flip-front' });
    const back = foreground.findByProps({ testID: 'memory-flip-back' });
    assert.equal(back.findByType('MemoryDetails').props.id, 'held-memory', 'real details remain in the rotating face');
    for (const p of [0, .1, .46, .5, .54, .8, .99, 1]) {
      h.state.values[0].current = p;
      const a = style(front.props.style), b = style(back.props.style), ta = tx(front), tb = tx(back);
      for (const [av, bv] of [[a.left + a.width / 2 + ta.translateX, b.width / 2 + tb.translateX], [a.top + a.height / 2 + ta.translateY, b.height / 2 + tb.translateY], [a.width * ta.scaleX, b.width * tb.scaleX], [a.height * ta.scaleY, b.height * tb.scaleY]]) assert.ok(Math.abs(av - bv) < .000001);
      for (const face of [a, b]) { assert.ok(face.opacity >= 0 && face.opacity <= 1); assert.equal(face.backfaceVisibility, 'hidden'); }
    }
    const final = style(back.props.style);
    assert.equal(final.left, 0); assert.equal(final.top, 0);
    assert.equal(final.width, 440); assert.equal(final.height, 956);
    assert.equal(tx(back).rotateY, '0deg'); assert.equal(tx(back).scaleX, 1); assert.equal(tx(back).scaleY, 1);
    assert.equal(final.backgroundColor, testTheme(theme).palette.page);
  } finally { await h.unmount(); }
});

test('Reduce Motion uses a short non-rotating fade and cancellation restores the source without navigation', async () => {
  const h = await harness('sakura', true);
  try {
    await h.tap(); await h.show(); await h.frontReady(); await h.backReady();
    assert.equal(h.state.animations[0].config.duration, 180);
    h.state.values[0].current = .5;
    assert.equal(tx(h.tree.root.findByProps({ testID: 'memory-flip-back' })).rotateY, '0deg');
    await h.close(); await h.close();
    assert.equal(h.state.animations.length, 2);
    assert.equal(h.state.animations[1].config.duration, 150);
    await h.finish();
    assert.equal(h.state.navigation.length, 0);
    assert.equal(style(h.card().props.style).opacity ?? 1, 1);
    assert.equal(h.state.releases.length, 1);
  } finally { await h.unmount(); }
});

test('invalid bounds and failed captures fall back once, remain visible, and allow retry', async () => {
  const h = await harness();
  try {
    h.state.frame.width = 0; await h.tap();
    assert.equal(h.state.fallback, 1); assert.equal(h.state.captures, 0);
    h.state.frame.width = 190; h.state.failCapture = true; await h.tap();
    assert.equal(h.state.fallback, 2);
    h.state.failCapture = false; await h.tap();
    assert.equal(h.tree.root.findAllByType('Modal').length, 1);
    assert.equal(style(h.card().props.style).opacity ?? 1, 1);
  } finally { await h.unmount(); }
});

test('backgrounding cancels an in-flight capture and releases its late result without navigation', async () => {
  const h = await harness();
  let resolve!: (uri: string) => void;
  try {
    h.state.capture = () => new Promise(r => { resolve = r; });
    await h.tap();
    h.state.active = false; await h.update();
    await act(async () => { resolve('file:///late.png'); await Promise.resolve(); });
    assert.deepEqual(h.state.releases, ['file:///late.png']);
    assert.equal(h.tree.root.findAllByType('Modal').length, 0);
    assert.equal(h.state.navigation.length, 0); assert.equal(h.state.fallback, 0);
  } finally { await h.unmount(); }
});

test('rotation cancels the obsolete geometry and iPad uses its actual full-screen target', async () => {
  const h = await harness('redline', false, { width: 1194, height: 834 });
  try {
    await h.tap();
    const back = style(h.tree.root.findByProps({ testID: 'memory-flip-back' }).props.style);
    assert.equal(back.width, 1194); assert.equal(back.height, 834);
    h.state.size = { width: 834, height: 1194 }; await h.update();
    assert.equal(h.tree.root.findAllByType('Modal').length, 0);
    assert.equal(h.state.releases.length, 1);
    assert.equal(style(h.card().props.style).opacity ?? 1, 1);
  } finally { await h.unmount(); }
});
