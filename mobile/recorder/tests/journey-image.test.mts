import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

import { diskCacheLookupKey, imageTransitionDuration, stableImageIdentity } from '../src/image-loading-model.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);

test('image identities bind recycled views to their real source and cache key', () => {
  assert.equal(stableImageIdentity('header-dark', 42), 'header-dark:asset-42');
  assert.equal(stableImageIdentity('album-song', { uri: 'https://is1-ssl.mzstatic.com/image.jpg' }), 'album-song:https://is1-ssl.mzstatic.com/image.jpg');
  assert.equal(diskCacheLookupKey({ uri: 'https://is1-ssl.mzstatic.com/image.jpg' }), 'https://is1-ssl.mzstatic.com/image.jpg');
  assert.equal(diskCacheLookupKey({ uri: 'https://example.test/image.jpg', cacheKey: 'album-cache' }), 'album-cache');
  assert.equal(diskCacheLookupKey({ uri: 'data:image/jpeg;base64,abc' }), null);
  assert.equal(diskCacheLookupKey(42), null);
});

test('crossfades are short, and cached or Reduce Motion images appear immediately', () => {
  assert.equal(imageTransitionDuration({ reduceMotion: false, alreadyReady: false }), 140);
  assert.equal(imageTransitionDuration({ reduceMotion: false, alreadyReady: true }), 0);
  assert.equal(imageTransitionDuration({ reduceMotion: true, alreadyReady: false }), 0);
  assert.equal(imageTransitionDuration({ reduceMotion: false, alreadyReady: false, duration: 90 }), 90);
});

function loadJourneyImage(cachePath: () => Promise<string | null>, state: { reduceMotion: boolean; inset: string }) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL('../src/journey-image.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  function MockImage(props: any) { return React.createElement('Image', props); }
  MockImage.getCachePathAsync = cachePath;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id: string) => id === 'expo-image' ? { Image: MockImage }
      : id === 'react-native' ? { StyleSheet: { create: (value: any) => value, absoluteFill: { position: 'absolute' } }, View: host('View') }
      : id === './app-theme' ? { useAppTheme: () => ({ palette: { inset: state.inset } }) }
      : id === './motion' ? { useMotionPreferences: () => ({ reduceMotion: state.reduceMotion }) }
      : id === './image-loading-model' ? { diskCacheLookupKey, imageTransitionDuration, stableImageIdentity }
      : require(id),
  });
  return module.exports.JourneyImage;
}

test('a fresh remote image holds a themed placeholder, fades once, and then stays ready', async () => {
  const state = { reduceMotion: false, inset: '#291735' };
  const JourneyImage = loadJourneyImage(async () => null, state);
  let tree: any;
  await act(async () => { tree = create(React.createElement(JourneyImage, {
    imageIdentity: 'album-one', source: { uri: 'https://example.test/one.jpg' },
    placeholder: { uri: 'https://example.test/thumb.jpg' }, style: { width: 120, height: 120 },
  })); await Promise.resolve(); });
  const frame = tree.root.findByType('View');
  const image = tree.root.findByType('Image');
  assert.equal(frame.props.style[1].backgroundColor, '#291735');
  assert.equal(frame.props.style[2].width, 120);
  assert.equal(image.props.source.uri, 'https://example.test/one.jpg');
  assert.equal(image.props.placeholder.uri, 'https://example.test/thumb.jpg');
  assert.equal(image.props.placeholderContentFit, 'cover');
  assert.equal(image.props.cachePolicy, 'memory-disk');
  assert.equal(image.props.transition, 140);
  await act(() => image.props.onDisplay());
  assert.equal(tree.root.findByType('Image').props.transition, 0, 'a displayed image does not re-fade');
  await act(() => tree.update(React.createElement(JourneyImage, {
    imageIdentity: 'album-one', source: { uri: 'https://example.test/one.jpg' }, style: { width: 96, height: 96 },
  })));
  assert.equal(tree.root.findByType('Image').props.transition, 0, 'session-cached image remains immediate after resize/remount');
  assert.equal(tree.root.findByType('View').props.style[2].width, 96, 'the wrapper preserves responsive dimensions');
  await act(() => tree.unmount());
});

test('disk-cached, bundled, and Reduce Motion images skip the fade', async () => {
  const state = { reduceMotion: false, inset: '#eee2ef' };
  const JourneyImage = loadJourneyImage(async () => '/cache/art.jpg', state);
  let tree: any;
  await act(async () => { tree = create(React.createElement(JourneyImage, { imageIdentity: 'cached', source: { uri: 'https://example.test/cached.jpg' } })); await Promise.resolve(); });
  assert.equal(tree.root.findByType('Image').props.transition, 0);
  await act(() => tree.update(React.createElement(JourneyImage, { imageIdentity: 'bundled-light', source: 22 })));
  assert.equal(tree.root.findByType('Image').props.source, 22);
  assert.equal(tree.root.findByType('Image').props.transition, 0);
  state.reduceMotion = true;
  await act(async () => { tree.update(React.createElement(JourneyImage, { imageIdentity: 'reduced', source: { uri: 'https://example.test/reduced.jpg' } })); await Promise.resolve(); });
  assert.equal(tree.root.findByType('Image').props.transition, 0);
  await act(() => tree.unmount());
});

test('theme changes repaint the stable placeholder and image failures remain observable', async () => {
  const state = { reduceMotion: false, inset: '#291735' };
  const JourneyImage = loadJourneyImage(async () => null, state);
  let failures = 0;
  let tree: any;
  const render = (id: string, source: number) => React.createElement(JourneyImage, {
    imageIdentity: `default-memory-${id}`, source, onError: () => { failures++; }, style: { width: '100%', aspectRatio: 1.55 },
  });
  await act(() => { tree = create(render('dark', 1)); });
  assert.match(tree.root.findByType('Image').props.recyclingKey, /^default-memory-dark:/);
  state.inset = '#f9e9ee';
  await act(() => tree.update(render('sakura', 2)));
  assert.equal(tree.root.findByType('View').props.style[1].backgroundColor, '#f9e9ee');
  assert.match(tree.root.findByType('Image').props.recyclingKey, /^default-memory-sakura:/);
  await act(() => tree.root.findByType('Image').props.onError({ error: 'decode failed' }));
  assert.equal(failures, 1);
  await act(() => tree.unmount());
});

test('an old cache lookup cannot replace the source chosen during an interrupted refresh', async () => {
  const resolvers = new Map<string, (path: string | null) => void>();
  const state = { reduceMotion: false, inset: '#291735' };
  const JourneyImage = loadJourneyImage((key: string) => new Promise(resolve => resolvers.set(key, resolve)), state);
  let tree: any;
  await act(() => { tree = create(React.createElement(JourneyImage, { imageIdentity: 'album-a', source: { uri: 'https://example.test/a.jpg' } })); });
  await act(() => { tree.update(React.createElement(JourneyImage, { imageIdentity: 'album-b', source: { uri: 'https://example.test/b.jpg' } })); });
  await act(async () => { resolvers.get('https://example.test/a.jpg')?.('/cache/a.jpg'); await Promise.resolve(); });
  assert.equal(tree.root.findByType('Image').props.source, null, 'late completion from the retired source is ignored');
  await act(async () => { resolvers.get('https://example.test/b.jpg')?.(null); await Promise.resolve(); });
  assert.equal(tree.root.findByType('Image').props.source.uri, 'https://example.test/b.jpg');
  assert.match(tree.root.findByType('Image').props.recyclingKey, /^album-b:/);
  await act(() => tree.unmount());
});

test('headers, album covers, and default Memory artwork use the shared surface', () => {
  const read = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const header = read('header-artwork.tsx');
  const carousel = read('album-carousel.tsx');
  const music = read('music-screen.tsx');
  const ipadMusic = read('ipad-music-screen.tsx');
  const ipadHome = read('ipad-home.tsx');
  const shell = read('shell.tsx');
  assert.equal((header.match(/<JourneyImage/g) ?? []).length, 2, 'both sharp and blurred shared header layers migrate together');
  assert.match(carousel, /placeholder=\{track\.artworkUrl \? \{ uri: track\.artworkUrl \}/);
  assert.match(carousel, /imageIdentity=\{`album-cover-/);
  assert.match(music, /imageIdentity=\{`archive-/);
  assert.match(ipadMusic, /imageIdentity=\{`ipad-music-/);
  assert.match(ipadHome, /imageIdentity=\{sourceKey\}/);
  assert.match(ipadHome, /imageIdentity=\{`ipad-home-album-/);
  assert.match(shell, /imageIdentity=\{`default-memory-\$\{theme\.id\}`\}/);
  assert.match(shell, /imageIdentity=\{`home-header-\$\{theme\.id\}`\}/);
  assert.match(shell, /imageIdentity=\{`journey-header-\$\{theme\.id\}`\}/);
});
