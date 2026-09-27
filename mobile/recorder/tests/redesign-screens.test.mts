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
const THEMES = ['redline', 'light', 'sakura', 'dark', 'midnight-canopy', 'aurora-glass'];
let themeId = 'redline';
const pushes: unknown[] = [];

const host = (name: string) => React.forwardRef(({ children, ...props }: any, ref: any) => React.createElement(name, { ...props, ref }, children));
class AnimatedValue { value: number; constructor(value: number) { this.value = value; } interpolate() { return this; } }
const native = {
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, hairlineWidth: 0.5 },
  useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1 }),
  Animated: { Value: AnimatedValue, View: host('AnimatedView'), ScrollView: host('AnimatedScrollView'), event: () => () => {} },
  ...Object.fromEntries(['View', 'Text', 'ScrollView', 'TextInput', 'ActivityIndicator', 'RefreshControl'].map(name => [name, host(name)])),
};
const shared: Record<string, unknown> = {
  react: React,
  'react-native': native,
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
  'expo-image': { Image: host('Image') },
  'expo-linear-gradient': { LinearGradient: host('LinearGradient') },
  'expo-symbols': { SymbolView: host('Symbol') },
  'react-native-svg': { __esModule: true, default: host('Svg'), Circle: host('Circle'), Path: host('Path') },
  'expo-router': { useFocusEffect: (effect: () => void) => React.useEffect(effect, []), router: { push: (value: unknown) => pushes.push(value), back() {} } },
  './app-theme': { useAppTheme: () => testTheme(themeId) },
  './app-data': { appDataClient: { photoDataUrl: async () => 'data:image/jpeg;base64,AA' } },
  './glass-material': { GlassBackdrop: () => null, useGlassCardStyle: () => null },
  './header-image-sources': { headerImageSource: (source: unknown) => source },
  './haptics': { haptics: { selection() {}, primaryAction() {} } },
  './journey-image': { JourneyImage: host('JourneyImage') },
  './touch-feedback': { TouchPressable: host('Pressable') },
  './card-detail-link': { CardDetailLink: ({ children }: any) => children },
  './artist-credit': { compactArtistCredit: (value: string) => value },
  './detail-screen-frame': { useDetailViewportInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
  './motion': { useMotionPreferences: () => ({ reduceMotion: false }) },
  './native-action-menu': { NativeActionMenu: host('Menu') },
  './primary-sections-data': { searchPrimarySections: (records: any[], query: string) => query.trim() ? records.filter(record => record.title.toLowerCase().includes(query.trim().toLowerCase())) : records.slice(0, 18) },
  './redesign-model': require('../src/redesign-model.ts'),
  './redesign-palette': require('../src/redesign-palette.ts'),
};
function load(name: string, extra: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const resolve = (id: string) => id in extra ? extra[id] : id in shared ? shared[id] : id.startsWith('../assets/') ? 7 : require(id);
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve, console, setTimeout, clearTimeout }, { filename: name });
  return module.exports;
}
const ui = load('redesign-ui.tsx');
shared['./redesign-ui'] = ui;
const accessoryModel = require('../src/recorder-accessory-model.ts');
const { TodayScreen } = load('today-screen.tsx');
const { SoundtrackScreen } = load('soundtrack-screen.tsx');
const { MemoriesLibraryScreen } = load('memories-library.tsx');
const { MemoryDetailV4 } = load('memory-detail-v4.tsx');
const { SearchTabScreen } = load('search-tab.tsx');
const { RecorderAccessoryBar } = load('recorder-accessory.tsx');

const now = new Date();
const daysAgo = (days: number, hour = 18) => { const date = new Date(now); date.setDate(date.getDate() - days); date.setHours(hour, 5, 0, 0); return date.toISOString(); };
const song = (track: string, playedAt: string | null, artworkUrl: string | null = null) => ({ playedAt, track, artist: 'Neon Dreams', album: 'Odyssey', durationMs: 200_000, artworkUrl, externalUrl: null, source: 'apple_music', confidence: 1 });
const journey = (id: string, startedAt: string, miles: number, tracks: any[]) => ({
  id, legacyDriveId: null, provider: null, vehicleName: null, startedAt, endedAt: startedAt, durationMinutes: 47, miles,
  startingLocation: 'Pacifica, CA', endingLocation: 'Half Moon Bay, CA', averageSpeedMph: 36, maxSpeedMph: 60, songCount: tracks.length, soundtrackPreview: tracks,
});
const lastYear = new Date(now); lastYear.setFullYear(now.getFullYear() - 1); lastYear.setHours(12);
const journeys = [
  journey('j1', daysAgo(0, 8), 28.4, [song('Midnight Odyssey', daysAgo(0, 8), 'https://example.com/a.jpg'), song('Coastline', daysAgo(0, 8))]),
  journey('j2', daysAgo(2), 14.2, [song('Midnight Odyssey', daysAgo(2))]),
  journey('j3', lastYear.toISOString(), 121, [song('Low Tide', lastYear.toISOString())]),
];
const details = [{ ...journeys[0], startingBatteryPercent: null, endingBatteryPercent: null, energyUsedKwh: null, tessieTag: null, driverProfile: null, soundtrack: journeys[0].soundtrackPreview,
  route: { type: 'LineString', coordinates: [[-122.49, 37.61], [-122.47, 37.55], [-122.43, 37.46]], points: [] } }];
const memories = [
  { id: 'm1', name: 'Open road weekend', notes: 'Fog lifted at Bixby.', artworkKey: 'road-trips', coverPhotoId: null, photos: [], journeyIds: ['j1', 'j2'], createdAtUtc: daysAgo(1), updatedAtUtc: daysAgo(1) },
  { id: 'm2', name: 'Big Sur weekend', notes: '', artworkKey: 'road-trips', coverPhotoId: null, photos: [], journeyIds: ['j3'], createdAtUtc: lastYear.toISOString(), updatedAtUtc: lastYear.toISOString() },
];
const primary = { status: 'ready', data: { journeys, details, search: [
  { id: 'memory:m1', kind: 'memory', title: 'Open road weekend', subtitle: '2 journeys', keywords: '' },
  { id: 'song:1', kind: 'song', title: 'Midnight Odyssey', subtitle: 'Neon Dreams', keywords: '', journeyId: 'j1' },
] } };

const texts = (tree: any) => tree.root.findAll((node: any) => node.type === 'Text').flatMap((node: any) => [node.props.children].flat(Infinity)).filter((value: unknown) => typeof value === 'string' || typeof value === 'number').join(' ');
const press = async (tree: any, label: string) => {
  const [target] = tree.root.findAll((node: any) => node.type === 'Pressable' && node.props.accessibilityLabel === label);
  assert.ok(target, `pressable "${label}"`);
  await act(async () => { target.props.onPress(); });
};

test('Today renders the last drive, the week, On this day and recent memories in every theme', async () => {
  for (const id of THEMES) {
    themeId = id;
    const calls: string[] = [];
    let tree: any;
    await act(async () => { tree = create(React.createElement(TodayScreen, { primary, memories, loadProfile: () => ({ initials: 'PS', avatarUri: null }),
      onJourney: (value: string) => calls.push(`journey:${value}`), onMemory: (value: string) => calls.push(`memory:${value}`), onMemories: () => calls.push('memories'),
      onWeek: () => calls.push('week'), onProfile: () => calls.push('profile'), onRefresh: async () => {} })); });
    const copy = texts(tree);
    assert.match(copy, /Today/);
    assert.match(copy, /This week/);
    assert.match(copy, /Pacifica → Half Moon Bay/);
    assert.match(copy, /On this day · 1 year ago/i, id);
    assert.doesNotMatch(copy, /1 songs|1 drives/);
    assert.match(copy, /Recent memories/);
    assert.equal(tree.root.findAllByProps({ testID: 'today-last-drive' }).length > 0, true);
    await press(tree, 'Profile and settings');
    assert.deepEqual(calls, ['profile']);
    await act(async () => tree.unmount());
  }
  let empty: any;
  await act(async () => { empty = create(React.createElement(TodayScreen, { primary: { status: 'ready', data: { journeys: [], details: [], search: [] } }, memories: [], loadProfile: () => ({ initials: 'PS', avatarUri: null }), recorder: React.createElement('inline-recorder'),
    onJourney() {}, onMemory() {}, onMemories() {}, onWeek() {}, onProfile() {}, onRefresh: async () => {} })); });
  assert.match(texts(empty), /The road remembers/);
  assert.equal(empty.root.findAllByType('inline-recorder').length, 1, 'before iOS 26 the recorder sits on Today');
  await act(async () => empty.unmount());
});

test('Soundtrack names the anthem, switches ranges and stays usable without music', async () => {
  for (const id of THEMES) {
    themeId = id;
    const opened: string[] = [];
    let tree: any;
    await act(async () => { tree = create(React.createElement(SoundtrackScreen, { status: 'ready', music: { topArtists: [] }, provider: 'apple-music', journeys, details,
      canOpenTracks: true, onTrack: (track: any) => opened.push(track.track), onJourney() {}, onRefresh: async () => {} })); });
    assert.match(texts(tree), /Midnight Odyssey/);
    assert.match(texts(tree), /Your road anthem · this month/i);
    await press(tree, 'Number 1, Midnight Odyssey by Neon Dreams, 2 plays on 2 drives');
    assert.deepEqual(opened, ['Midnight Odyssey']);
    const week = tree.root.find((node: any) => node.type === 'Pressable' && node.props.accessibilityRole === 'tab' && [node.props.children].flat().some((child: any) => child?.props?.children === 'Week'));
    await act(async () => week.props.onPress());
    assert.match(texts(tree), /this week/i);
    await act(async () => tree.unmount());
  }
  let empty: any;
  await act(async () => { empty = create(React.createElement(SoundtrackScreen, { status: 'ready', music: null, provider: 'shazam', journeys: [], details: [], canOpenTracks: false, onTrack() {}, onJourney() {}, onRefresh: async () => {} })); });
  assert.match(texts(empty), /No songs\s+this month/);
  await act(async () => empty.unmount());
});

test('Memories library groups by year and offers Drives and Map views', async () => {
  for (const id of THEMES) {
    themeId = id;
    const calls: string[] = [];
    let tree: any;
    await act(async () => { tree = create(React.createElement(MemoriesLibraryScreen, { memories, journeys, details, loading: false, historyLimited: false,
      onUpgrade() {}, onCreate: () => calls.push('create'), onMemory: (value: string) => calls.push(value), onJourney() {}, onEdit() {}, onShare() {},
      onAddToMemory: (value: string) => calls.push(`add:${value}`), onRefresh() {} })); });
    assert.match(texts(tree), new RegExp(`${now.getFullYear()}`));
    assert.match(texts(tree), /Open road weekend/);
    await press(tree, 'New memory');
    const drives = tree.root.find((node: any) => node.type === 'Pressable' && node.props.accessibilityRole === 'tab' && [node.props.children].flat().some((child: any) => child?.props?.children === 'Drives'));
    await act(async () => drives.props.onPress());
    assert.match(texts(tree), /Pacifica → Half Moon Bay/);
    await press(tree, 'Add Pacifica → Half Moon Bay to a Memory');
    const map = tree.root.find((node: any) => node.type === 'Pressable' && node.props.accessibilityRole === 'tab' && [node.props.children].flat().some((child: any) => child?.props?.children === 'Map'));
    await act(async () => map.props.onPress());
    assert.match(texts(tree), /1\s+of\s+3\s+drives drawn/);
    assert.deepEqual(calls.slice(0, 2), ['create', 'add:j1']);
    await act(async () => tree.unmount());
  }
});

test('Memory detail tells the trip: stats, drives timeline, soundtrack and photos', async () => {
  for (const id of THEMES) {
    themeId = id;
    const opened: string[] = [];
    let tree: any;
    await act(async () => { tree = create(React.createElement(MemoryDetailV4, { memory: memories[0], journeys, details, onClose() {}, onOpenJourney: (value: string) => opened.push(value), onShare() {}, onEdit() {} })); });
    const copy = texts(tree);
    assert.match(copy, /Open road weekend/);
    assert.match(copy, /The drives/);
    assert.match(copy, /Soundtrack/);
    assert.match(copy, /Fog lifted at Bixby/);
    await press(tree, 'Relive the first drive');
    assert.deepEqual(opened, ['j2'], 'the earliest drive opens first');
    await act(async () => tree.unmount());
  }
});

test('Search groups results and opens memories and drives', async () => {
  themeId = 'light';
  const calls: string[] = [];
  let tree: any;
  await act(async () => { tree = create(React.createElement(SearchTabScreen, { state: primary, onJourney: (value: string) => calls.push(`journey:${value}`), onMemory: (value: string) => calls.push(`memory:${value}`) })); });
  assert.match(texts(tree), /Memories/);
  await press(tree, 'Open road weekend. 2 journeys');
  await press(tree, 'Midnight Odyssey. Neon Dreams');
  assert.deepEqual(calls, ['memory:m1', 'journey:j1']);
  await act(async () => tree.root.findByType('TextInput').props.onChangeText('nothing matches'));
  assert.match(texts(tree), /Nothing in your library matches/);
  await act(async () => tree.unmount());
});

test('the recorder bar offers the one action its state allows', async () => {
  for (const id of THEMES) {
    themeId = id;
    const calls: string[] = [];
    const state = accessoryModel.recorderAccessoryState({ startupPending: false, permissionsReady: true, status: 'recording', clockTracking: true, automaticMode: false, automaticDetectionActive: false, justSaved: false, elapsed: '12:00', miles: 4 });
    let tree: any;
    await act(async () => { tree = create(React.createElement(RecorderAccessoryBar, { state, busy: false, onAction: () => calls.push('action'), onOpen: () => calls.push('open') })); });
    await press(tree, 'End journey');
    await press(tree, 'Recording · 4.0 mi · 12:00. Tap for markers and song ID');
    assert.deepEqual(calls, ['action', 'open']);
    await act(async () => tree.unmount());
  }
});
