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
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
let light = true;
const native = { StyleSheet: { create: (value: any) => value, hairlineWidth: 1 },
  ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'ActivityIndicator', 'TextInput', 'RefreshControl'].map(name => [name, host(name)])) };
function load(name: string, mocks: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id === './artist-credit' ? require('../src/artist-credit.ts') : id === './touch-feedback' ? touchFeedbackMock : id in mocks ? mocks[id] : id === './theme-catalog.ts' ? require('../src/theme-catalog.ts') : id.startsWith('../assets/') ? id : require(id) });
  return module.exports;
}
const dataHelpers = load('ipad-music-data.ts');
const model = load('library-model.ts');
const theme = { useAppTheme: () => testTheme(light), useThemedStyles: (styles: any) => styles };
const carousel = { AlbumCarousel: ({ tracks, enabled, onTrack }: any) => React.createElement('Carousel', { tracks, enabled },
  tracks.map((track: any, i: number) => React.createElement('Pressable', { key: i, disabled: !enabled, accessibilityLabel: `Open ${track.track} by ${track.artist}`, onPress: () => onTrack(track) }))) };
const header = load('ipad-page-header.tsx', {
  'react-native': native, 'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
  './app-theme': theme, './header-artwork': { HeaderArtworkLayers: ({ source }: any) => React.createElement('Image', { source: `${light ? 'light' : 'dark'}:${source}` }), HEADER_ARTWORK_ASPECT_RATIO: 1672 / 941 },
  './phone-tab-title': { PhoneTabTitle: host('PhoneTabTitle') },
});
const ui = load('ipad-music-screen.tsx', {
  './album-carousel': carousel,
  './ipad-page-header': header,
  'react-native': native, 'expo-image': { Image: host('Image') }, 'expo-symbols': { SymbolView: host('Symbol') },
  'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView'), useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
  './app-theme': theme, './theme-palette': load('theme-palette.ts'),
  './header-image-sources': { headerImageSource: (source: string, mode: string) => `${mode}:${source}` },
});
const links: string[] = [], journeysOpened: string[] = [];
const music = load('music-screen.tsx', {
  './album-carousel': carousel,
  './app-theme': theme, './device-layout': { isIpad: () => true }, './ipad-music-screen': ui, './ipad-music-data': dataHelpers,
  'react-native': { ...native, Alert: { alert: () => {} }, Linking: { openURL: async (url: string) => { links.push(url); } } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
  'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') }, 'react-native-svg': {},
  './music-destination': { musicTrackDestination: (track: any) => track.externalUrl }, './library-model': model,
  './neon-widget-outline': {}, './header-artwork': { HEADER_ARTWORK_ASPECT_RATIO: 2 },
  './phone-tab-title': { PhoneTabTitle: host('PhoneTabTitle') },
});
const track = (i: number) => ({ track: `Song ${i}`, artist: i === 0 ? 'Unique artist' : 'Road artist', album: 'Coast album', playedAt: '2026-09-05T10:00:00Z',
  durationMs: 180000, artworkUrl: null, externalUrl: `https://music.apple.com/song/${i}`, source: 'apple-music', confidence: null });
const tracks = Array.from({ length: 20 }, (_, i) => track(i));
const journey = { id: 'journey-1', startedAt: '2026-09-05T09:00:00Z', startingLocation: 'Coast', endingLocation: 'Hills', soundtrackPreview: tracks, soundtrack: tracks };
const dashboard = { generatedAt: '2026-09-05T11:00:00Z', metrics: { milesWithMusic: 0, listeningHours: 1, songsOnRoad: 20, currentStreak: 1 }, recentSelections: tracks.slice(0, 8), topArtists: [{ artist: 'Road artist', plays: 19, artworkUrl: null }], daily: [] };
const text = (tree: any) => tree.root.findAllByType('Text').map((node: any) => node.children.filter((child: any) => typeof child === 'string').join('')).join('|');
const press = (tree: any, label: string) => tree.root.findAllByType('Pressable').find((node: any) => node.props.accessibilityLabel === label);

test('iPad Music search, paging, source links and Journey links work across resizes and themes', async () => {
  let tree: any;
  let refreshes = 0;
  const render = (provider = 'apple-music', state: any = { status: 'ready', data: dashboard }) => React.createElement(music.MusicScreen, {
    state, provider, journeys: [journey], details: [journey], onJourney: (id: string) => journeysOpened.push(id), onRefresh: async () => { refreshes++; },
  });
  try {
    await act(() => { tree = create(render()); });
    const screen = tree.root.findAllByType('ScrollView').find((node: any) => node.props.testID === 'ipad-music');
    assert.equal(screen.props.contentInsetAdjustmentBehavior, 'automatic');
    assert.deepEqual(Array.from(tree.root.findByType('SafeAreaView').props.edges), ['left', 'right']);
    const canvas = tree.root.findAllByType('View').find((node: any) => node.props.testID === 'ipad-music-canvas');
    const input = tree.root.findByType('TextInput');
    await act(() => input.props.onChangeText('Unique artist'));
    assert.match(text(tree), /1 journey plays/);
    for (const width of [1132, 772, 280, 1132]) {
      await act(() => canvas.props.onLayout({ nativeEvent: { layout: { width } } }));
      const row = tree.root.findAllByType('View').find((node: any) => node.props.testID === 'ipad-music-artists-row');
      assert.equal(row.props.style[1].flexDirection, width >= 960 ? 'row' : 'column');
      assert.equal(tree.root.findByType('TextInput').props.value, 'Unique artist');
      const title = tree.root.findByProps({ testID: 'ipad-page-title' });
      assert.equal(title.props.style[1].fontSize, width >= 600 ? 36 : 28);
      assert.equal(title.props.style[0].fontWeight, '600');
      const gallery = tree.root.findByType('Carousel');
      assert.equal(gallery.props.tracks.length, 8, 'all recent covers are available through the shared carousel');

      assert.equal(tree.root.findAllByType('ScrollView').find((node: any) => node.props.testID === 'ipad-music'), screen);
    }
    assert.equal(tree.root.findByType('Carousel').children.length, 8);
    await act(() => press(tree, 'Open Song 0 by Unique artist').props.onPress());
    assert.equal(links.at(-1), 'https://music.apple.com/song/0');
    await act(() => press(tree, 'Open journey Coast → Hills').props.onPress());
    assert.equal(journeysOpened.at(-1), 'journey-1');
    await act(() => input.props.onChangeText(''));
    assert.equal(tree.root.findAllByType('Pressable').filter((node: any) => node.props.accessibilityLabel?.startsWith('Open journey')).length, 6);
    const more = tree.root.findAllByType('Pressable').find((node: any) => node.findAllByType('Text').some((label: any) => label.children.join('') === 'Show more listening history'));
    await act(() => more.props.onPress());
    assert.equal(tree.root.findAllByType('Pressable').filter((node: any) => node.props.accessibilityLabel?.startsWith('Open journey')).length, 18);
    await act(() => input.props.onChangeText('no-match'));
    assert.match(text(tree), /No listening moments match/);
    await act(() => input.props.onChangeText(''));
    assert.equal(tree.root.findAllByType('Pressable').filter((node: any) => node.props.accessibilityLabel?.startsWith('Open journey')).length, 6);
    for (const appearance of [true, false]) {
      light = appearance;
      await act(() => tree.update(render()));
      assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor, light ? '#fffaf0' : '#08070d');
      assert.ok(tree.root.findAllByType('Image')[0].props.source.startsWith(light ? 'light:' : 'dark:'));
    }
    await act(() => tree.update(render('shazam')));
    assert.equal(press(tree, 'Open Song 0 by Unique artist').props.disabled, true);
    assert.equal(press(tree, 'Open journey Coast → Hills').props.disabled, undefined);
    await act(() => screen.props.refreshControl.props.onRefresh());
    assert.equal(refreshes, 1);
    assert.equal(screen.props.refreshControl.props.refreshing, false);
  } finally { light = true; await act(() => tree?.unmount()); }
});

test('Music initial load, error and empty archive are honest without fake sample content', async () => {
  let tree: any;
  const render = (state: any) => React.createElement(music.MusicScreen, { state, provider: 'apple-music', journeys: [], details: [], onJourney: () => {}, onRefresh: async () => {} });
  try {
    await act(() => { tree = create(render({ status: 'loading', data: null })); });
    assert.equal(tree.root.findAllByType('ActivityIndicator').length, 1);
    assert.match(text(tree), /—/);
    assert.doesNotMatch(text(tree), /216\.3|Connected/);
    await act(() => tree.update(render({ status: 'error', data: null, message: 'Offline archive error' })));
    assert.match(text(tree), /Offline archive error/);
    assert.match(text(tree), /Try again/);
    await act(() => tree.update(render({ status: 'ready', data: { ...dashboard, recentSelections: [], topArtists: [] } })));
    assert.match(text(tree), /Your latest songs will appear/);
    assert.match(text(tree), /Your artist ranking will grow/);
    assert.match(text(tree), /No saved song durations/);
  } finally { await act(() => tree?.unmount()); }
});

test('listening chart uses seven local calendar days, saved durations and excludes invalid/future dates', () => {
  const now = new Date(2026, 8, 5, 12);
  const at = (day: number, durationMs: number | null, hour = 10) => ({ ...track(day), playedAt: new Date(2026, 8, day, hour).toISOString(), durationMs });
  const days = dataHelpers.ipadListeningDays([at(5, 180000), at(5, null), at(5, -1), at(5, Number.NaN), at(4, 60000), at(29, 60000), at(5, 60000, 14), { ...at(5, 60000), playedAt: 'invalid' }], now);
  assert.equal(days.length, 7);
  assert.equal(days.at(-1).minutes, 3);
  assert.equal(days.at(-2).minutes, 1);
  assert.equal(days.reduce((sum: number, day: any) => sum + day.minutes, 0), 4);
  assert.equal(new Date(days[0].date).getDate(), 30);
});
