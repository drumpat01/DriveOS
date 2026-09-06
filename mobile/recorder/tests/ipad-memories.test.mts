import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { memoryStudioDrop, containsStudioPoint, phoneStudioLayout, studioEdgeVelocity } from '../src/memory-studio-model.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => React.forwardRef(({ children, ...props }: any, ref: any) => React.createElement(name, { ...props, ref }, children));
const frames = new Set<Function>();
const bounds = new Map<string, any>();
const scrolls: { id: string; y: number }[] = [];
let light = true, focused = true, reduced = false, appState: (state: string) => void = () => {};
let dimensions = { width: 1200, height: 900, fontScale: 1 };
const alerts: any[] = [];
const journeyActions: any[] = [];
const native = { StyleSheet: { create: (x: any) => x, absoluteFill: {} }, useWindowDimensions: () => dimensions,
  Keyboard: { dismiss() {} }, KeyboardAvoidingView: host('KeyboardAvoidingView'),
  AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: () => ({ remove() {} }), announceForAccessibility() {} },
  AppState: { addEventListener: (_: string, callback: any) => { appState = callback; return { remove() {} }; } }, Alert: { alert: (...args: any[]) => alerts.push(args) },
  ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'ActivityIndicator', 'TextInput'].map(n => [n, host(n)])) };
const gesture = () => {
  const g: any = {};
  for (const key of ['enabled', 'activateAfterLongPress', 'maxPointers']) g[key] = () => g;
  for (const key of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) g[key] = (fn: any) => { g[key.slice(2)] = fn; return g; };
  return g;
};
const reanimated = {
  __esModule: true,
  default: { View: native.View, ScrollView: native.ScrollView },
  useAnimatedRef: () => React.useRef(null), useSharedValue: (value: any) => React.useRef({ value }).current,
  useAnimatedStyle: (fn: any) => fn(), useAnimatedScrollHandler: (fn: any) => fn,
  measure: (ref: any) => bounds.get(ref.current?.id) ?? { pageX: 0, pageY: 0, width: 1200, height: 1200 },
  useFrameCallback: (fn: any) => { const latest = React.useRef(fn); latest.current = fn; const stable = React.useRef((...args: any[]) => latest.current(...args)); return { setActive: (active: boolean) => active ? frames.add(stable.current) : frames.delete(stable.current) }; },
  withTiming: (value: any, _config: any, cb: any) => { cb?.(true); return value; }, withSpring: (value: any) => value,
  runOnJS: (fn: any) => fn, scrollTo(ref: any, _x: number, y: number) { scrolls.push({ id: ref.current?.id, y }); }, LinearTransition: { springify: () => ({ damping: () => ({}) }) },
};
function load(name: string, mocks: Record<string, any> = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : id.startsWith('../assets/') ? id : require(id) });
  return module.exports;
}
const { IpadMemoriesScreen } = load('ipad-memories-screen.tsx', {
  'react-native': native, 'expo-router': { useIsFocused: () => focused },
  'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView') },
  'react-native-gesture-handler': { Gesture: { Pan: gesture }, GestureDetector: host('GestureDetector') },
  'react-native-reanimated': reanimated, 'expo-linear-gradient': { LinearGradient: host('Gradient') }, 'expo-symbols': { SymbolView: host('Symbol') },
  'expo-image': { Image: host('Image') }, './header-image-sources': { headerImageSource: (source: string, mode: string) => `${mode}:${source}` },
  './app-theme': { useAppTheme: () => ({ isLight: light, mode: light ? 'light' : 'dark' }) }, './ipad-page-header': { IpadPageHeader: host('Header') },
  './card-detail-link': { CardDetailLink: host('CardDetailLink') }, './library-model': load('library-model.ts'),
  './native-action-menu': { NativeActionMenu: host('Menu') }, './journey-card-action': { openJourneyCardAction: (...args: any[]) => journeyActions.push(args) },
  './memory-studio-model': { memoryStudioDrop, containsStudioPoint, phoneStudioLayout, studioEdgeVelocity },
});
const journeys = [1, 2, 3].map(i => ({ id: `j${i}`, startingLocation: `Start ${i}`, endingLocation: 'Coast', startedAt: '2026-09-05T10:00:00Z', miles: 12, durationMinutes: 30, songCount: 2, soundtrackPreview: [] }));
const memories = [{ id: 'm1', name: 'Coast days', notes: '', journeyIds: ['j1'], photos: [] }];
const press = (tree: any, label: string) => tree.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityLabel === label);
const tick = () => { for (const frame of frames) frame({ timeSincePreviousFrame: 16 }); };

test('drop intent validates live IDs, avoids self drops and distinguishes append from creation', () => {
  assert.deepEqual(memoryStudioDrop('j1', 'journey:j2', ['j1', 'j2'], []), { kind: 'create', journeyIds: ['j2', 'j1'] });
  assert.deepEqual(memoryStudioDrop('j1', 'memory:m1', ['j1'], ['m1']), { kind: 'add', memoryId: 'm1', journeyIds: ['j1'] });
  assert.deepEqual(memoryStudioDrop('j1', 'new', ['j1'], []), { kind: 'create', journeyIds: ['j1'] });
  for (const target of ['', 'journey:j1', 'journey:gone', 'memory:gone']) assert.equal(memoryStudioDrop('j1', target, ['j1'], []), null);
  assert.equal(memoryStudioDrop('gone', 'new', ['j1'], []), null);
  const rect = { pageX: 300, pageY: 100, width: 400, height: 600 };
  assert.equal(containsStudioPoint(rect, 200, 300), false, 'sidebar does not count as content');
  assert.equal(studioEdgeVelocity(rect, 400, 400), 0);
  assert.ok(studioEdgeVelocity(rect, 400, 110) < 0);
  assert.ok(studioEdgeVelocity(rect, 400, 690) > 0);
  assert.equal(studioEdgeVelocity(rect, 299, 690), 0);
});

test('Memory studio retains selection/search through resizing and themes, with accessible create/add and failure recovery', async () => {
  let tree: any, settle: () => void = () => {}, fail = false;
  const created: string[][] = [], added: any[] = [];
  const props = { memories, journeys, renderArtwork: () => React.createElement('Artwork'), onCreate: (ids: string[]) => created.push(ids),
    onAdd: async (id: string, ids: string[]) => { added.push([id, ids]); if (fail) throw new Error('Fixture save failed'); await new Promise<void>(r => { settle = r; }); },
    onEdit() {}, onShare() {}, onMemory() {}, onJourney() {}, onRefresh() {}, loading: false, historyLimited: false, onUpgrade() {} };
  const render = () => React.createElement(IpadMemoriesScreen, props);
  await act(() => { tree = create(render(), { createNodeMock: el => ({ id: el.props.testID }) }); });
  await act(() => press(tree, 'Select Start 2 → Coast').props.onPress());
  const search = tree.root.findAllByType('TextInput').find((n: any) => n.props.accessibilityLabel === 'Search journeys');
  await act(() => search.props.onChangeText('Start 2'));
  for (const width of [1150, 760, 400, 1150]) {
    await act(() => tree.root.findByProps({ testID: 'ipad-memories-canvas' }).props.onLayout({ nativeEvent: { layout: { width } } }));
    assert.equal(tree.root.findByProps({ testID: 'ipad-memory-studio' }).props.style[1].flexDirection, width >= 700 ? 'row' : 'column');
    assert.equal(search.props.value, 'Start 2');
    assert.equal(press(tree, 'Select Start 2 → Coast').props.accessibilityState.checked, true);
  }
  for (const mode of [false, true]) { light = mode; await act(() => tree.update(render())); assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor, mode ? '#fffaf0' : '#08070d'); }
  await act(() => tree.root.findAllByType('Pressable').find((n: any) => n.findAllByType('Text').some((t: any) => t.children.join('') === 'Create with 1 selected')).props.onPress());
  assert.deepEqual(Array.from(created[0]), ['j2']);
  await act(() => { press(tree, 'Add selected journeys to Coast days').props.onPress(); });
  assert.equal(press(tree, 'Add selected journeys to Coast days').props.disabled, true);
  await act(() => { press(tree, 'Add selected journeys to Coast days').props.onPress(); });
  assert.equal(added.length, 1, 'busy guard prevents repeated writes');
  await act(() => settle());
  assert.equal(press(tree, 'Add selected journeys to Coast days'), undefined);
  fail = true;
  await act(() => press(tree, 'Select Start 2 → Coast').props.onPress());
  await act(() => { press(tree, 'Add selected journeys to Coast days').props.onPress(); });
  assert.equal(alerts.at(-1)[0], 'Memory not updated');
  assert.equal(press(tree, 'Select Start 2 → Coast').props.accessibilityState.checked, true, 'failure preserves selection for retry');
  await act(() => tree.unmount());
});

test('actual gesture handlers create/add and cancel safely on background, self drop, and focus changes', async () => {
  let tree: any;
  const created: any[] = [], added: any[] = [];
  const props = { memories, journeys, renderArtwork: () => null, onCreate: (ids: any) => created.push(ids), onAdd: async (...args: any[]) => { added.push(args); },
    onEdit() {}, onShare() {}, onMemory() {}, onJourney() {}, onRefresh() {}, loading: false, historyLimited: false, onUpgrade() {} };
  const render = () => React.createElement(IpadMemoriesScreen, props);
  const rect = (x: number, y: number) => ({ pageX: x, pageY: y, width: 200, height: 150 });
  bounds.set('studio-drop-memory:m1', rect(0, 0)); bounds.set('studio-drop-new', rect(0, 200));
  for (let i = 1; i <= 3; i++) { bounds.set(`studio-drop-journey:j${i}`, rect(500, i * 200)); bounds.set(`studio-source-j${i}`, rect(500, i * 200)); }
  await act(() => { tree = create(render(), { createNodeMock: el => ({ id: el.props.testID }) }); });
  const pan = () => tree.root.findAllByType('GestureDetector')[0].props.gesture;
  const drag = async (x: number, y: number, cancel?: () => void) => {
    await act(() => pan().Start({ absoluteX: 550, absoluteY: 250 }));
    await act(() => { pan().Update({ absoluteX: x, absoluteY: y }); tick(); });
    if (cancel) await act(cancel);
    await act(() => pan().End({ absoluteX: x, absoluteY: y }));
  };
  await drag(550, 450); assert.deepEqual(Array.from(created[0]), ['j2', 'j1']);
  await drag(50, 50); assert.equal(added[0][0], 'm1');
  await drag(550, 250); assert.equal(created.length, 1);
  await drag(50, 50, () => appState('background')); assert.equal(added.length, 1);
  await drag(50, 50, () => { focused = false; tree.update(render()); }); assert.equal(added.length, 1);
  focused = true;
  await act(() => tree.update(render()));
  await act(() => tree.root.findByProps({ testID: 'ipad-memories-canvas' }).props.onLayout({ nativeEvent: { layout: { width: 400 } } }));
  bounds.set('ipad-memories', { pageX: 0, pageY: 100, width: 1200, height: 700 });
  const outer = tree.root.findAllByType('ScrollView').find((n: any) => n.props.testID === 'ipad-memories');
  outer.props.onContentSizeChange(400, 2000);
  outer.props.onScroll({ contentOffset: { y: 400 } });
  await drag(550, 110, () => appState('background'));
  assert.ok(scrolls.some(s => s.id === 'ipad-memories' && s.y < 400), 'a narrow window scrolls the outer page to reach the other panel');
  await act(() => tree.unmount());
  assert.equal(frames.size, 0, 'animation frame loops stop after leaving the workspace');
});

test('iPhone gallery and animated tray preserve state, navigation and accessible actions across resizing and themes', async () => {
  dimensions = { width: 393, height: 852, fontScale: 1 };
  let tree: any;
  const created: any[] = [], added: any[] = [], opened: any[] = [], edited: any[] = [];
  const props = { presentation: 'iphone', memories, journeys, renderArtwork: () => React.createElement('Artwork'),
    onCreate: (ids: any) => created.push(ids), onAdd: async (...args: any[]) => { added.push(args); },
    onEdit: (m: any) => edited.push(m.id), onShare() {}, onMemory: (id: string) => opened.push(id), onJourney: (id: string) => opened.push(id), onRefresh() {}, loading: false, historyLimited: false, onUpgrade() {} };
  const render = () => React.createElement(IpadMemoriesScreen, props);
  try {
    await act(async () => { tree = create(render(), { createNodeMock: el => ({ id: el.props.testID }) }); });
    assert.deepEqual(Array.from(tree.root.findByType('SafeAreaView').props.edges), ['top', 'left', 'right', 'bottom']);
    assert.equal(tree.root.findByType('KeyboardAvoidingView').props.behavior, 'padding');
    const root = tree.root.findByProps({ testID: 'studio-drag-root' });
    await act(() => root.props.onLayout({ nativeEvent: { layout: { width: 369, height: 680 } } }));
    assert.ok(root.props.style.marginBottom <= 12, 'native safe area owns bar clearance without a second fixed tab-bar spacer');
    const gallery = tree.root.findAllByType('ScrollView').find((n: any) => n.props.accessibilityLabel === 'Memory gallery');
    const library = tree.root.findAllByType('ScrollView').find((n: any) => n.props.accessibilityLabel === 'Journey library');
    await act(() => press(tree, 'Select Start 2 → Coast').props.onPress());
    const input = tree.root.findAllByType('TextInput').find((n: any) => n.props.accessibilityLabel === 'Search journeys');
    await act(() => input.props.onChangeText('Start 2'));
    await act(() => press(tree, 'Collapse journey library').props.onPress());
    assert.equal(tree.root.findByProps({ testID: 'iphone-journey-tray-body' }).props.pointerEvents, 'none');
    assert.equal(tree.root.findByProps({ testID: 'iphone-journey-tray' }).props.style[2].height, phoneStudioLayout(369, 680).collapsedTray);
    await act(() => press(tree, 'Expand journey library').props.onPress());
    assert.equal(input.props.value, 'Start 2');
    assert.equal(press(tree, 'Select Start 2 → Coast').props.accessibilityState.checked, true);
    for (const [width, height, fontScale] of [[369, 680, 1], [296, 450, 1], [750, 250, 1], [369, 680, 1.6], [369, 680, 1]]) {
      dimensions = { width, height: height + 150, fontScale };
      await act(() => tree.update(render()));
      await act(() => root.props.onLayout({ nativeEvent: { layout: { width, height } } }));
      const grid = tree.root.findAllByType('View').find((n: any) => n.props.testID === 'iphone-memory-grid');
      assert.equal(grid.children[0].props.style.width, phoneStudioLayout(width, height, fontScale).columns === 2 ? '50%' : '100%');
      const trayHeight = tree.root.findByProps({ testID: 'iphone-journey-tray' }).props.style[2].height;
      assert.ok(trayHeight <= height * .52, 'gallery retains room even in landscape or large text');
      assert.equal(tree.root.findAllByType('ScrollView').find((n: any) => n.props.accessibilityLabel === 'Memory gallery'), gallery);
      assert.equal(tree.root.findAllByType('ScrollView').find((n: any) => n.props.accessibilityLabel === 'Journey library'), library);
    }
    for (const value of [false, true]) { light = value; await act(() => tree.update(render())); assert.ok(tree.root.findByType('Image').props.source.startsWith(value ? 'light:' : 'dark:')); }
    await act(() => press(tree, 'New Memory').props.onPress());
    assert.deepEqual(Array.from(created[0]), ['j2']);
    await act(() => press(tree, 'Add selected journeys to Coast days').props.onPress());
    assert.equal(added[0][0], 'm1');
    await act(() => press(tree, 'Open Memory Coast days').props.onPress());
    assert.equal(opened.at(-1), 'm1');
    await act(() => tree.root.findByType('CardDetailLink').props.actions[0].onPress());
    assert.equal(edited[0], 'm1');
    await act(() => tree.root.findByType('Menu').props.actions[0].onSelect());
    assert.deepEqual(journeyActions.at(-1), ['j2', 'edit']);
    await act(() => tree.root.findByType('Menu').props.actions[1].onSelect());
    assert.deepEqual(journeyActions.at(-1), ['j2', 'share']);
  } finally { await act(() => tree?.unmount()); dimensions = { width: 1200, height: 900, fontScale: 1 }; }
});

test('iPhone uses real shared drag handlers for create and add, with tray collapse blocked during a drag', async () => {
  dimensions = { width: 393, height: 852, fontScale: 1 };
  let tree: any;
  const creates: any[] = [], adds: any[] = [];
  const props = { presentation: 'iphone', memories, journeys, renderArtwork: () => null, onCreate: (ids: any) => creates.push(ids), onAdd: async (...args: any[]) => { adds.push(args); },
    onEdit() {}, onShare() {}, onMemory() {}, onJourney() {}, onRefresh() {}, loading: false, historyLimited: false, onUpgrade() {} };
  try {
    bounds.set('studio-drop-memory:m1', { pageX: 10, pageY: 100, width: 160, height: 210 });
    bounds.set('studio-drop-new', { pageX: 10, pageY: 320, width: 350, height: 64 });
    for (let i = 1; i <= 3; i++) { const rect = { pageX: 10, pageY: 390 + i * 100, width: 350, height: 95 }; bounds.set(`studio-drop-journey:j${i}`, rect); bounds.set(`studio-source-j${i}`, rect); }
    await act(async () => { tree = create(React.createElement(IpadMemoriesScreen, props), { createNodeMock: el => ({ id: el.props.testID }) }); });
    const pan = () => tree.root.findAllByType('GestureDetector')[0].props.gesture;
    const drag = async (x: number, y: number) => {
      await act(() => pan().Start({ absoluteX: 100, absoluteY: 520 }));
      assert.equal(press(tree, 'Collapse journey library').props.disabled, true);
      await act(() => { pan().Update({ absoluteX: x, absoluteY: y }); tick(); });
      await act(() => pan().End({ absoluteX: x, absoluteY: y }));
    };
    await drag(80, 180); assert.equal(adds[0][0], 'm1');
    await drag(80, 630); assert.deepEqual(Array.from(creates[0]), ['j2', 'j1']);
    await drag(80, 350); assert.deepEqual(Array.from(creates[1]), ['j1']);
    await act(() => pan().Start({ absoluteX: 100, absoluteY: 520 }));
    await act(() => { pan().Update({ absoluteX: 80, absoluteY: 180 }); tick(); appState('background'); });
    await act(() => pan().End({ absoluteX: 80, absoluteY: 180 }));
    assert.equal(adds.length, 1, 'backgrounding cancels the pending iPhone drop');
  } finally { await act(() => tree?.unmount()); dimensions = { width: 1200, height: 900, fontScale: 1 }; }
});
