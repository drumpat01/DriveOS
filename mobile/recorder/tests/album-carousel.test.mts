import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { albumCarouselDepth, albumCarouselItems, albumCarouselLayout } from '../src/album-carousel-model.ts';
import { testTheme } from './theme-fixture.mts';
import { highQualityAlbumArtwork } from '../src/album-artwork.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const track = (name: string) => ({ track: name, artist: 'Artist', album: 'Album', playedAt: name, artworkUrl: `https://example.com/${name}.jpg` });
function style(input: any): any {
  if (Array.isArray(input)) return Object.assign({}, ...input.map(style));
  return input?.evaluate ? input.evaluate() : input;
}
function harness() {
  const state = { reduceMotion: false, isAppActive: true, focused: true, theme: 'redline', scrolls: [] as any[], values: [] as any[], opened: [] as any[] };
  const List = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: (request: any) => state.scrolls.push(request) }));
    return React.createElement('List', props, props.data.map((item: any, index: number) => React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item, index }))));
  });
  const mocks: Record<string, any> = {
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', FlatList: List, StyleSheet: { create: (v: any) => v, absoluteFill: { position: 'absolute' } } },
    'expo-image': { Image: 'Image' }, 'expo-router': { useIsFocused: () => state.focused },
    './motion': { MOTION_DURATIONS: { feedback: 120 }, useMotionPreferences: () => state },
    './app-theme': { useAppTheme: () => testTheme(state.theme) },
    './album-carousel-model': { albumCarouselDepth, albumCarouselItems, albumCarouselLayout },
    './album-artwork': { highQualityAlbumArtwork },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView', FlatList: List },
      useAnimatedStyle: (evaluate: () => any) => ({ evaluate }),
      useAnimatedScrollHandler: (handlers: any) => handlers.onScroll,
      useSharedValue: (initial: number) => {
        const [value] = React.useState(() => {
          const shared = { current: initial, get: () => shared.current, set: (next: number) => { shared.current = next; } };
          state.values.push(shared); return shared;
        });
        return value;
      },
    },
  };
  const module = { exports: {} as any };
  const source = readFileSync(new URL('../src/album-carousel.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : require(id) });
  return { state, render: (tracks = [track('A'), track('B'), track('C')], enabled = true) => React.createElement(module.exports.AlbumCarousel, { tracks, enabled, onTrack: (value: any) => state.opened.push(value) }) };
}

test('carousel centers first/last covers on narrow phones and tablets, with symmetric bounded depth', () => {
  for (const width of [160, 280, 390, 772, 1200]) {
    const { cover, stride, padding } = albumCarouselLayout(width);
    assert.ok(cover > 0 && cover <= 220);
    assert.ok(Math.abs(padding + stride / 2 - width / 2) < 1e-9);
    const maximumOffset = padding * 2 + 8 * stride - width;
    assert.ok(Math.abs(maximumOffset - 7 * stride) < 1e-9);
    const center = albumCarouselDepth(2, 2 * stride, stride, true);
    const left = albumCarouselDepth(1, 2 * stride, stride, true), right = albumCarouselDepth(3, 2 * stride, stride, true);
    assert.equal(center.lift, -8); assert.equal(center.scale, 1);
    assert.ok(left.scale < center.scale); assert.ok(Math.abs(left.scale - right.scale) < 1e-9);
    assert.ok(Math.abs(left.rotation + right.rotation) < 1e-9);
    assert.equal(albumCarouselDepth(100, 0, stride, true).scale, .86);
    assert.deepEqual(albumCarouselDepth(2, 0, stride, false), { scale: 1, lift: 0, rotation: 0 });
  }
});

test('scroll controls depth continuously, and rotation/refresh retain the centered track', async () => {
  const h = harness(); let tree: any;
  try {
    await act(() => { tree = create(h.render()); });
    const measure = (width: number) => tree.root.findByProps({ testID: 'soundtrack-carousel' }).props.onLayout({ nativeEvent: { layout: { width } } });
    await act(() => measure(390));
    const list = () => tree.root.findByType('List');
    const stride = albumCarouselLayout(390).stride;
    list().props.onScroll({ contentOffset: { x: stride } });
    const depth = (index: number) => Object.assign({}, ...style(tree.root.findByProps({ testID: `album-depth-${index}` }).props.style).transform);
    assert.equal(depth(1).translateY, -8); assert.equal(depth(1).scale, 1);
    assert.ok(Math.abs(depth(0).scale - .93) < 1e-9);
    list().props.onScroll({ contentOffset: { x: stride * 1.5 } });
    assert.ok(Math.abs(depth(1).scale - depth(2).scale) < 1e-9, 'halfway through the swipe both covers share depth');
    list().props.onScroll({ contentOffset: { x: stride } });
    await act(() => measure(772));
    assert.equal(h.state.scrolls.at(-1).offset, albumCarouselLayout(772).stride);
    await act(() => tree.update(h.render([track('New'), track('A'), track('B'), track('C')])));
    assert.equal(h.state.scrolls.at(-1).offset, albumCarouselLayout(772).stride * 2, 'B remains centered after insertion');
    await act(() => tree.update(h.render([track('New')])));
    assert.equal(h.state.scrolls.at(-1).offset, 0, 'shortened lists clamp to a real cover');
    assert.equal(list().props.removeClippedSubviews, false);
    assert.equal(list().props.initialNumToRender, 5);
  } finally { await act(() => tree?.unmount()); }
});

test('press compression precedes opening; cancelled, disabled and inactive presses never open music', async () => {
  const h = harness(); let tree: any;
  try {
    await act(() => { tree = create(h.render()); });
    await act(() => tree.root.findByProps({ testID: 'soundtrack-carousel' }).props.onLayout({ nativeEvent: { layout: { width: 390 } } }));
    const button = () => tree.root.findAllByType('Pressable')[0];
    const compression = () => tree.root.findByProps({ testID: 'album-press-0' }).props.style;
    await act(() => button().props.onPressIn());
    assert.equal(compression().transform[0].scale, .97); assert.equal(compression().transitionDuration, 120);
    assert.equal(h.state.opened.length, 0);
    await act(() => button().props.onPressOut());
    assert.equal(compression().transform[0].scale, 1); assert.equal(h.state.opened.length, 0);
    await act(() => button().props.onPressIn());
    await act(() => button().props.onPress());
    assert.equal(h.state.opened.length, 1); assert.equal(h.state.opened[0].track, 'A');
    for (const flag of ['focused', 'isAppActive'] as const) {
      h.state[flag] = false;
      await act(() => tree.update(h.render()));
      assert.equal(compression().transform[0].scale, 1);
      await act(() => button().props.onPress()); assert.equal(h.state.opened.length, 1);
      h.state[flag] = true;
      await act(() => tree.update(h.render()));
    }
    await act(() => tree.update(h.render(undefined, false)));
    assert.equal(button().props.accessibilityState.disabled, true);
    await act(() => { button().props.onPressIn(); button().props.onPress(); });
    assert.equal(h.state.opened.length, 1); assert.equal(compression().transform[0].scale, 1);
    h.state.reduceMotion = true;
    await act(() => tree.update(h.render()));
    await act(() => button().props.onPressIn());
    assert.equal(compression().transform[0].scale, 1); assert.equal(compression().transitionDuration, 0);
    const depth = Object.assign({}, ...style(tree.root.findByProps({ testID: 'album-depth-1' }).props.style).transform);
    assert.equal(depth.translateY, 0); assert.equal(depth.scale, 1); assert.equal(depth.rotateY, '0deg');
  } finally { await act(() => tree?.unmount()); }
});

test('all themes, missing/failed covers and duplicate tracks preserve usable labels and targets', async () => {
  const h = harness(); let tree: any;
  const items = [track('A'), track('A'), { ...track('No art'), artworkUrl: null }];
  const keys = albumCarouselItems(items as any).map(item => item.key);
  assert.equal(new Set(keys).size, items.length);
  try {
    await act(() => { tree = create(h.render(items as any)); });
    await act(() => tree.root.findByProps({ testID: 'soundtrack-carousel' }).props.onLayout({ nativeEvent: { layout: { width: 280 } } }));
    for (const theme of ['dark', 'light', 'sakura', 'redline']) {
      h.state.theme = theme;
      await act(() => tree.update(h.render(items as any)));
      const captions = tree.root.findAllByType('Text').filter((n: any) => n.children[0] === 'A');
      assert.equal(style(captions[0].props.style).color, testTheme(theme).palette.text);
    }
    assert.equal(tree.root.findAllByType('Image').length, 2);
    await act(() => tree.root.findAllByType('Image')[0].props.onError());
    assert.equal(tree.root.findAllByType('Image').length, 1);
    assert.equal(tree.root.findAllByType('Pressable').length, 3, 'image failures do not remove music links');
  } finally { await act(() => tree?.unmount()); }
});

test('Apple thumbnail upgrades preserve artwork identity and leave other providers and unknown forms unchanged', () => {
  const base = 'https://is1-ssl.mzstatic.com/image/thumb/Music/test.jpg/';
  for (const size of [100, 256, 600]) assert.equal(highQualityAlbumArtwork(`${base}${size}x${size}bb.jpg?test=1`), `${base}800x800bb.jpg?test=1`);
  for (const uri of [`${base}1200x1200bb.jpg`, `${base}256x128bb.jpg`, `${base}original.jpg`,
    'https://example.com/100x100bb.jpg', 'https://mzstatic.com.example.com/100x100bb.jpg', 'file:///100x100bb.jpg', 'invalid']) {
    assert.equal(highQualityAlbumArtwork(uri), uri);
  }
  assert.equal(highQualityAlbumArtwork(null), null);
});

test('larger covers use disk caching and the saved thumbnail as placeholder/fallback, then recover when artwork changes', async () => {
  const h = harness(); let tree: any;
  const original = 'https://is1-ssl.mzstatic.com/image/thumb/Music/test.jpg/100x100bb.jpg';
  const items = [{ ...track('A'), artworkUrl: original }];
  try {
    await act(() => { tree = create(h.render(items)); });
    await act(() => tree.root.findByProps({ testID: 'soundtrack-carousel' }).props.onLayout({ nativeEvent: { layout: { width: 390 } } }));
    const image = () => tree.root.findByType('Image');
    assert.equal(image().props.source.uri, highQualityAlbumArtwork(original));
    assert.equal(image().props.placeholder.uri, original);
    assert.equal(image().props.cachePolicy, 'memory-disk');
    await act(() => image().props.onError());
    assert.equal(image().props.source.uri, original, 'offline/unsupported HQ falls back to the previously saved thumbnail');
    await act(() => image().props.onError());
    assert.equal(tree.root.findAllByType('Image').length, 0);
    await act(() => tree.update(h.render([{ ...items[0], artworkUrl: original.replace('test.jpg', 'new.jpg') }])));
    assert.match(image().props.source.uri, /new\.jpg\/800x800bb\.jpg$/);
  } finally { await act(() => tree?.unmount()); }
});
