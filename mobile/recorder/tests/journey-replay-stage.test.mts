import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { testTheme } from './theme-fixture.mts';
import { highQualityAlbumArtwork } from '../src/album-artwork.ts';
import { compactArtistCredit } from '../src/artist-credit.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
function harness() {
  let theme = 'light';
  const transition: any = { duration: () => transition, withInitialValues: () => transition };
  const mocks: any = {
    'react-native': { View: host('View'), Text: host('Text'), StyleSheet: { create: (v: any) => v } },
    'expo-image': { Image: host('Image') }, './touch-feedback': { TouchPressable: host('Pressable') },
    './album-artwork': { highQualityAlbumArtwork }, './artist-credit': { compactArtistCredit },
    './app-theme': { useAppTheme: () => testTheme(theme) },
    'react-native-reanimated': { __esModule: true, default: { View: host('AnimatedView') }, FadeInDown: transition, ZoomIn: transition,
      useSharedValue: (initial: number) => React.useState(() => { let value = initial; return { get: () => value, set: (v: number) => { value = v; } }; })[0],
      useAnimatedStyle: (fn: any) => fn(), withTiming: (v: number) => v,
    },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL('../src/journey-replay-stage.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  return { ...module.exports, theme: (value: string) => { theme = value; } };
}

test('stage keeps moment cards and transport together across songs, stops, photos and completion', async () => {
  const h = harness(); let tree: any; let toggles = 0, errors = 0; const seeks: number[] = [];
  const props: any = { playing: true, complete: false, animate: true, timestamp: Date.parse('2026-09-10T12:00:00Z'), progress: .5,
    song: { track: 'A Song', artist: 'One, Two, Three', artworkUrl: 'https://is1-ssl.mzstatic.com/cover/100x100bb.jpg' },
    onToggle: () => toggles++, onRestart() {}, onExplore() {}, onPhotoError: () => errors++, onSeek: (p: number) => seeks.push(p) };
  const render = (changes = {}) => React.createElement(h.JourneyReplayStage, { ...props, ...changes });
  await act(() => { tree = create(render()); });
  assert.equal(tree.root.findByType('Image').props.source.uri, 'https://is1-ssl.mzstatic.com/cover/800x800bb.jpg');
  await act(() => tree.root.findByType('Image').props.onError());
  assert.equal(tree.root.findByType('Image').props.source.uri, props.song.artworkUrl);
  const button = (label: string) => tree.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityLabel === label);
  await act(() => button('Pause journey story').props.onPress()); assert.equal(toggles, 1);
  await act(() => button('Journey story position').props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  assert.equal(seeks[0], .45);
  await act(() => tree.update(render({ stop: { id: 'stop', at: 0, end: 120000 } })));
  assert.ok(JSON.stringify(tree.toJSON()).includes('2 minute stop'));
  await act(() => tree.update(render({ photo: { id: 'p', uri: 'file:///p.jpg' } })));
  assert.equal(tree.root.findByType('Image').props.accessibilityLabel, 'Photo from this moment');
  await act(() => tree.root.findByType('Image').props.onError()); assert.equal(errors, 1);
  await act(() => tree.update(render({ complete: true, photo: { id: 'p', uri: 'file:///p.jpg' } })));
  assert.equal(tree.root.findAllByType('Image').length, 0);
  assert.ok(button('Replay journey story'));
  for (const theme of ['light', 'dark', 'sakura', 'redline']) {
    h.theme(theme); await act(() => tree.update(render({ animate: false })));
    assert.ok(tree.root.findAllByType('AnimatedView').every((n: any) => !n.props.entering));
  }
  await act(() => tree.unmount());
});

test('position halo only loops during active animated playback', async () => {
  const h = harness(); let tree: any;
  await act(() => { tree = create(React.createElement(h.ReplayPosition, { heading: 359, playing: true, animate: true })); });
  const loops = () => tree.root.findAllByType('AnimatedView').filter((n: any) => Array.isArray(n.props.style) && n.props.style.some((s: any) => s?.animationIterationCount === 'infinite'));
  assert.equal(loops().length, 1);
  await act(() => tree.update(React.createElement(h.ReplayPosition, { heading: 1, playing: false, animate: true })));
  assert.equal(loops().length, 0);
  await act(() => tree.update(React.createElement(h.ReplayPosition, { heading: 1, playing: true, animate: false })));
  assert.equal(loops().length, 0);
  await act(() => tree.unmount());
});
