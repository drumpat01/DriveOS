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
let viewportWidth = 393, viewportFontScale = 1;
const pushes: unknown[] = [];
const secureStore = new Map<string, string>();

const host = (name: string) => React.forwardRef(({ children, ...props }: any, ref: any) => React.createElement(name, { ...props, ref }, children));
class AnimatedValue { value: number; constructor(value: number) { this.value = value; } interpolate() { return this; } }
const native = {
  StyleSheet: { create: (styles: any) => styles, absoluteFill: {}, hairlineWidth: 0.5 },
  useWindowDimensions: () => ({ width: viewportWidth, height: 852, fontScale: viewportFontScale }),
  Animated: { Value: AnimatedValue, View: host('AnimatedView'), ScrollView: host('AnimatedScrollView'), event: () => () => {} },
  ...Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'TextInput', 'ActivityIndicator', 'RefreshControl', 'Image', 'KeyboardAvoidingView', 'Switch'].map(name => [name, host(name)])),
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  Keyboard: { dismiss() {} },
};
const shared: Record<string, unknown> = {
  react: React,
  'react-native': native,
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
  'expo-image': { Image: host('Image') },
  'expo-linear-gradient': { LinearGradient: host('LinearGradient') },
  'expo-symbols': { SymbolView: host('Symbol') },
  'react-native-svg': { __esModule: true, default: host('Svg'), Circle: host('Circle'), Line: host('Line'), Path: host('Path') },
  'expo-router': { useFocusEffect: (effect: () => void) => React.useEffect(effect, []), router: { push: (value: unknown) => pushes.push(value), back() {} } },
  './app-theme': { useAppTheme: () => testTheme(themeId), useSurfacePreferences: () => ({ reduceTransparency: false, increaseContrast: false }) },
  './app-data': { appDataClient: { photoDataUrl: async () => 'data:image/jpeg;base64,AA' } },
  './glass-material': { GlassBackdrop: () => null, useGlassCardStyle: () => null },
  './header-image-sources': { headerImageSource: (source: unknown) => source },
  './haptics': { haptics: { selection() {}, primaryAction() {} } },
  './journey-image': { JourneyImage: host('JourneyImage') },
  './touch-feedback': { TouchPressable: host('Pressable') },
  './card-detail-link': { CardDetailLink: host('CardDetailLink') },
  './artist-credit': { compactArtistCredit: (value: string) => value },
  './detail-screen-frame': { useDetailViewportInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
  './motion': { useMotionPreferences: () => ({ reduceMotion: false }) },
  './native-action-menu': { NativeActionMenu: host('Menu') },
  './memory-route-map': { MemoryRouteMap: host('MemoryRouteMap') },
  './primary-sections-data': { searchPrimarySections: (records: any[], query: string) => query.trim() ? records.filter(record => record.title.toLowerCase().includes(query.trim().toLowerCase())) : records.slice(0, 18) },
  './redesign-model': require('../src/redesign-model.ts'),
  './today-layout': require('../src/today-layout.ts'),
  'react-native-keyboard-controller': {
    KeyboardProvider: ({ children }: any) => children, KeyboardStickyView: host('KeyboardStickyView'),
    KeyboardChatScrollView: React.forwardRef(({ children, ...props }: any, ref: any) => { React.useImperativeHandle(ref, () => ({ scrollTo() {} })); return React.createElement('ChatScroll', props, children); }),
  },
  'react-native-reanimated': (() => {
    const chain: any = { duration: () => chain, easing: () => chain };
    return { __esModule: true, default: { View: host('AnimatedView') }, Easing: { bezier: () => (value: number) => value },
      FadeIn: chain, FadeInDown: chain, FadeOut: chain, cancelAnimation() {}, withDelay: (_: number, value: unknown) => value, withRepeat: (value: unknown) => value,
      withSequence: (...values: unknown[]) => values[0], withSpring: (value: unknown) => value, withTiming: (value: unknown) => value,
      useSharedValue: (value: number) => { const ref = React.useRef({ value, get() { return this.value; }, set(next: number) { this.value = next; } }); return ref.current; },
      useAnimatedStyle: (fn: () => unknown) => fn() };
  })(),
  '@shopify/react-native-skia': { Skia: { RuntimeEffect: { Make: () => null } }, useImage: () => null, Canvas: host('Canvas'), Fill: host('Fill'), Shader: host('Shader'), ImageShader: host('ImageShader') },
  './home-widget-grid': { HomeLayoutEditorSheet: host('EditorSheet') },
  'expo-secure-store': { getItem: (key: string) => secureStore.get(key) ?? null, setItem: (key: string, value: string) => { secureStore.set(key, value); } },
  './redesign-palette': require('../src/redesign-palette.ts'),
};
function load(name: string, extra: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const resolve = (id: string) => id in extra ? extra[id] : id in shared ? shared[id] : id.startsWith('../assets/') ? 7 : require(id);
  vm.runInNewContext(code, { module, exports: module.exports, require: resolve, console, setTimeout, clearTimeout, setInterval, clearInterval }, { filename: name });
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
    assert.ok(tree.root.findAllByType('CardDetailLink').some((node: any) => node.props.kind === 'memory' && node.props.id === 'm1'), 'Today memory opens through Atlas Flip link');
    assert.equal(tree.root.findAllByProps({ testID: 'today-last-drive' }).length > 0, true);
    await press(tree, 'Profile and settings');
    assert.deepEqual(calls, ['profile']);
    assert.equal(tree.root.findAllByProps({ testID: 'today-ask' }).length, 0, 'no Ask bar without Ask');
    await act(async () => tree.unmount());
    await act(async () => { tree = create(React.createElement(TodayScreen, { userId: `user-${id}`, primary, memories, loadProfile: () => ({ initials: 'PS', avatarUri: null }),
      onAsk: () => calls.push('ask'), onJourney() {}, onMemory() {}, onMemories() {}, onWeek() {}, onProfile() {}, onRefresh: async () => {} })); });
    await press(tree, 'Ask JourneyDeck about your drives');
    assert.equal(calls.at(-1), 'ask');
    await press(tree, 'Edit Today');
    assert.equal(tree.root.findByType('EditorSheet').props.visible, true);
    const hideWeek = tree.root.find((node: any) => node.type === 'Switch' && node.props.accessibilityLabel === 'Show This week on Today');
    await act(async () => hideWeek.props.onValueChange());
    assert.equal(tree.root.findAllByProps({ testID: 'today-week' }).length, 0, 'the week card is hidden');
    assert.ok(secureStore.get(`journeydeck.today.layout.v1.user-${id}`)?.includes('"week","visible":false'), 'the choice is saved for this profile');
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
    assert.ok(tree.root.findAllByType('CardDetailLink').some((node: any) => node.props.kind === 'memory' && node.props.id === 'm1'), 'library card uses Atlas Flip link');
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
    const maps = tree.root.findAllByType('MemoryRouteMap');
    assert.equal(maps.length, 1, 'one combined map and route card');
    assert.equal(maps[0].props.routes.length, 1, 'only drives with a recorded route are mapped');
    assert.equal(tree.root.findAllByType('Svg').length, 0, 'the hero has no duplicate route sketch');
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
  assert.ok(tree.root.findAllByType('CardDetailLink').some((node: any) => node.props.kind === 'memory' && node.props.id === 'm1'), 'Search memory result uses Atlas Flip link');
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

test('Journey detail V4 puts the title and stats under the map and keeps every action', async () => {
  const routeProps: any[] = [];
  const route = ({ v4Header, v4Middle, ...props }: any) => { routeProps.push(props); return React.createElement('route', null, v4Header, v4Middle); };
  const { JourneyDetailV4 } = load('journey-detail-v4.tsx', { './journey-markers': { JourneyMarkerRoute: route } });
  const drive = { ...details[0], averageSpeedMph: 36.4, vehicleName: null, startingBatteryPercent: null, energyUsedKwh: null,
    soundtrack: [song('Coastline', daysAgo(0, 8)), song('Midnight Odyssey', daysAgo(0, 8), 'https://example.com/a.jpg')] };
  for (const id of THEMES) {
    themeId = id;
    const calls: string[] = [];
    let tree: any;
    await act(async () => { tree = create(React.createElement(JourneyDetailV4, { journey: drive, title: 'Friday evening drive', songMoments: [], replayPhotos: [],
      selectedSongIndex: null, onSelectSong: (index: number | null) => calls.push(`song:${index}`), showAllTracks: false, onToggleTracks() {},
      memories, onMemory: (value: string) => calls.push(`memory:${value}`), onAddToMemory: () => calls.push('add'),
      onBack: () => calls.push('back'), onShare: () => calls.push('share'), onEditLocations() {}, onTrim() {}, fallback: null })); });
    const copy = texts(tree);
    assert.match(copy, /Friday evening drive/);
    assert.match(copy, /Pacifica → Half Moon Bay/);
    assert.match(copy, /mph avg/);
    assert.match(copy, /Soundtrack/);
    assert.doesNotMatch(copy, /Vehicle/, 'the vehicle card only shows for connected cars');
    assert.equal(routeProps.at(-1).layout, 'v4');
    assert.ok(routeProps.at(-1).v4TopInset > 59, 'map controls clear the floating toolbar');
    await press(tree, 'Open Memory Open road weekend');
    await press(tree, 'Add this drive to a Memory');
    await press(tree, 'Song 2, Midnight Odyssey by Neon Dreams. Show on the map');
    await press(tree, 'Create share card');
    await press(tree, 'Back');
    assert.deepEqual(calls, ['memory:m1', 'add', 'song:2', 'share', 'back']);
    await act(async () => tree.unmount());
  }
});

test('the V4 replay card shows live speed only while replaying and marks every song', async () => {
  const { JourneyReplayCardV4 } = load('journey-replay-card-v4.tsx');
  const base = { canReplay: true, playing: false, engaged: false, progress: 0, speedMph: 42, songTitle: 'Coastline', rate: 'story', songTicks: [0.1, 0.5, 0.8],
    startClock: '6:42 PM', endClock: '7:29 PM', startLabel: 'Pacifica', endLabel: 'Half Moon Bay', estimated: false, scrubberHandlers: {}, onScrubberLayout() {}, onAdjust() {} };
  for (const id of THEMES) {
    themeId = id;
    const calls: string[] = [];
    let tree: any;
    await act(async () => { tree = create(React.createElement(JourneyReplayCardV4, { ...base, onToggle: () => calls.push('toggle'), onRestart: () => calls.push('restart'), onRate: (rate: unknown) => calls.push(`rate:${rate}`) })); });
    assert.match(texts(tree), /Relive this drive/);
    assert.doesNotMatch(texts(tree), /mph/, 'no live readout at rest');
    assert.equal(tree.root.findAll((node: any) => node.type === 'View' && [node.props.style].flat(Infinity).some((style: any) => style?.marginLeft === -4)).length, 3, 'one tick per song');
    await press(tree, 'Relive this drive');
    await press(tree, 'Restart replay');
    const twelve = tree.root.find((node: any) => node.type === 'Pressable' && node.props.accessibilityRole === 'tab' && [node.props.children].flat().some((child: any) => child?.props?.children === '12×'));
    await act(async () => twelve.props.onPress());
    assert.deepEqual(calls, ['toggle', 'restart', 'rate:12']);
    await act(async () => tree.update(React.createElement(JourneyReplayCardV4, { ...base, engaged: true, playing: true, progress: 0.42, onToggle() {}, onRestart() {}, onRate() {} })));
    assert.match(texts(tree), /Coastline/);
    assert.match(texts(tree), /42 mph · 42% of the drive/);
    await act(async () => tree.unmount());
  }
});

test('Ask V4 suggests questions, shows records as cards, and starts a new conversation', async () => {
  const motion = load('ask-chat-motion.tsx');
  const v4 = load('ask-journeydeck-v4.tsx', { './ask-chat-motion': motion, './glass-avatar': load('glass-avatar.tsx') });
  const asked: any[] = [];
  const answer = { status: 'answered', text: 'You drove 42.6 miles this week.', ticket: 't', contextToken: 't', evidence: [{ kind: 'memory', id: 'm1', label: 'Open road weekend' }] };
  const make = () => load('ask-journeydeck-screen.tsx', {
    './ask-journeydeck-v4': v4, './ask-chat-motion': motion, './device-layout': { isIpad: () => false },
    './release-features': { V3_ASK_JOURNEYDECK_ENABLED: true, V4_REDESIGN_ENABLED: true },
    './siri-testing': { canShowSiriTesting: false }, './auth': { getCurrentUser: () => ({ id: `ask-${themeId}` }) },
    'expo-router': { router: { push: (value: unknown) => pushes.push(value), back() {}, canGoBack: () => true, replace() {} }, useLocalSearchParams: () => ({}) },
    './ask-journeydeck': {
      ASK_EXAMPLES: ['How many miles did I drive this week?', 'When was my last journey?'], ASK_CANNOT_COMPUTE: 'x', isAskJourneyDeckAvailable: true,
      askJourneyDeckModelAvailability: async () => 'available',
      askJourneyDeck: async (...args: any[]) => { asked.push(args); return answer; },
      resolveJourneyDeckAnswer: async () => answer,
    },
  }).AskJourneyDeckScreen;
  for (const id of THEMES) {
    themeId = id;
    const Screen = make();
    let tree: any;
    await act(async () => { tree = create(React.createElement(Screen)); });
    assert.equal(tree.root.findAllByProps({ testID: 'ask-v4' }).length > 0, true);
    assert.match(texts(tree), /On this iPhone · Ready/);
    await press(tree, 'Ask: How many miles did I drive this week?');
    assert.equal(asked.at(-1)[1], 'How many miles did I drive this week?');
    assert.match(texts(tree), /42\.6 miles/);
    assert.match(texts(tree), /FROM YOUR LIBRARY/);
    assert.ok(tree.root.findAll((node: any) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Open Memory Open road weekend').length > 0);
    const fresh = tree.root.findByType('Menu').props.actions.find((action: any) => action.id === 'new');
    await act(async () => fresh.onSelect());
    assert.doesNotMatch(texts(tree), /42\.6 miles/, 'New conversation clears the thread');
    await act(async () => tree.unmount());
  }
});

test('Atlas V4 keeps every filter visible and its data usable across six themes', async () => {
  const atlasModel = require('../src/ipad-statistics-model.ts');
  const vehicle = {
    drivingEfficiency: { whPerMile: 241, measuredJourneys: 1, journeys: 1, energyUsedKwh: 8.2 },
    chargingOnRoad: { sessions: 0, energyAddedKwh: null, durationMinutes: 0, charges: [] },
    energyByJourney: [], repeatedRoutes: [],
  };
  const make = (tessie: boolean) => load('atlas-tab-v4.tsx', {
    './ipad-statistics-model': atlasModel,
    './journey-title': { journeyDisplayTitle: (item: any) => `${item.startingLocation} to ${item.endingLocation}` },
    './auth': { getCurrentUser: () => ({ id: 'atlas-test' }) },
    './app-data': { localAtlasClient: { tessieStatistics: () => vehicle } },
    './release-features': { TESSIE_INTEGRATION_ENABLED: tessie },
    './tessie-direct': { tessieDirectStatus: async () => 'connected' },
  }).AtlasTabV4;
  const styleOf = (node: any) => Object.assign({}, ...[typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style].flat(Infinity).filter(Boolean));
  for (const id of THEMES) {
    themeId = id;
    const Screen = make(false);
    let upgrades = 0, atlasOpens = 0, tree: any;
    const props = { state: primary, historyDays: 45, onRefresh() {}, onJourney() {}, onUpgrade: () => upgrades++, onAtlas: () => atlasOpens++ };
    await act(async () => { tree = create(React.createElement(Screen, props)); });
    assert.ok(tree.root.findByProps({ testID: 'atlas-overview-hero' }));
    assert.ok(tree.root.findByProps({ testID: 'atlas-metric-grid' }));
    const sections = tree.root.findByProps({ testID: 'atlas-section-filters' }).findAllByType('Pressable');
    assert.deepEqual(sections.map((node: any) => node.props.accessibilityLabel), ['Overview', 'Days', 'Insights']);
    assert.ok(sections.every((node: any) => styleOf(node).flexBasis === '30%'), 'three sections fit in one row');
    await press(tree, '90D, JourneyDeck Plus');
    assert.equal(upgrades, 1, 'locked range opens Plus without changing the selected range');
    assert.equal(tree.root.findByProps({ testID: 'atlas-range-filters' }).findAllByType('Pressable')[1].props.accessibilityState.selected, true);
    await press(tree, 'Days');
    assert.ok(tree.root.findByProps({ testID: 'atlas-calendar' }));
    await press(tree, 'Insights');
    assert.match(texts(tree), /Distance breakdown|DISTANCE BREAKDOWN/);
    await press(tree, 'Overview');
    await press(tree, 'Explore your Atlas map');
    assert.equal(atlasOpens, 1);
    await act(async () => tree.unmount());
  }
  themeId = 'redline'; viewportWidth = 320; viewportFontScale = 1.5;
  const Screen = make(true);
  let tree: any;
  try {
    await act(async () => { tree = create(React.createElement(Screen, { state: primary, historyDays: null, onRefresh() {}, onJourney() {}, onUpgrade() {} })); });
    const sections = tree.root.findByProps({ testID: 'atlas-section-filters' }).findAllByType('Pressable');
    assert.deepEqual(sections.map((node: any) => node.props.accessibilityLabel), ['Overview', 'Days', 'Insights', 'Tessie']);
    assert.ok(sections.every((node: any) => styleOf(node).flexBasis === '47%'), 'four sections use two complete rows at narrow widths');
    await press(tree, 'Tessie');
    assert.match(texts(tree), /Vehicle insights/);
    assert.match(texts(tree), /241 Wh\/mi/);
  } finally {
    viewportWidth = 393; viewportFontScale = 1;
    await act(async () => tree?.unmount());
  }
});

test('the V4 recorder sheet shows the live drive and routes each control in every theme', async () => {
  const sheetModel = require('../src/recorder-sheet-model.ts');
  const route = [[-122.49, 37.61], [-122.47, 37.55], [-122.43, 37.46]].map(([longitude, latitude], sequence) => ({ sequence, recordedAt: daysAgo(0), latitude, longitude, accuracyMeters: 5, altitudeMeters: null, headingDegrees: null, speedMps: null }));
  const { RecorderSheetV4 } = load('recorder-sheet-v4.tsx', {
    './redesign-ui': ui,
    './storage': { getLiveRecorderSnapshot: () => ({ session: { id: 's1' }, route, music: [song('Midnight Odyssey', daysAgo(0))], lastPoint: null }) },
    './journey-marker-capture': { captureJourneyMarker: async () => undefined },
    './native-recorder-inbox': { syncNativeRecorderInbox: async () => undefined },
    './release-features': { V3_MARKERS_PROTOTYPE_ENABLED: true },
  });
  for (const id of THEMES) {
    themeId = id;
    const calls: string[] = [];
    const handlers = Object.fromEntries(['onClose', 'onStart', 'onEnable', 'onPause', 'onResume', 'onEnd', 'onIdentify'].map(name => [name, () => calls.push(name)]));
    const render = async (status: string | null) => {
      let tree: any;
      const state = sheetModel.recorderSheetState({ startupPending: false, permissionsReady: true, status, clockTracking: true, automaticMode: false, automaticDetectionActive: false });
      await act(async () => { tree = create(React.createElement(RecorderSheetV4, { state, sessionId: status ? 's1' : null, startedAt: daysAgo(0), elapsed: '24:18', miles: 14.62, points: 1284, busy: false, showIdentify: true, ...handlers })); });
      return tree;
    };
    let tree = await render('recording');
    const text = texts(tree);
    for (const expected of ['Your drive is being remembered.', '24:18', '14.6', 'Midnight Odyssey', 'Add marker', 'Identify song', 'End journey']) assert.ok(text.includes(expected), `${id}: ${expected}`);
    assert.ok(tree.root.findAll((node: any) => node.props.accessibilityLabel === 'Route so far').length, `${id} draws the route`);
    await press(tree, 'Pause journey'); await press(tree, 'End journey'); await press(tree, 'Identify song'); await press(tree, 'Close recorder');
    act(() => tree.unmount());
    tree = await render('paused');
    await press(tree, 'Resume journey');
    assert.ok(!texts(tree).includes('Add marker'), `${id}: no in-drive tools while paused`);
    act(() => tree.unmount());
    tree = await render(null);
    await press(tree, 'Start journey');
    assert.deepEqual(calls, ['onPause', 'onEnd', 'onIdentify', 'onClose', 'onResume', 'onStart'], id);
    act(() => tree.unmount());
  }
});
