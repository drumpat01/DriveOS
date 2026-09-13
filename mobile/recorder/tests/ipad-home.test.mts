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
const platform = { OS: 'ios', isPad: true };
let mode = 'light', saveFailed = false, alerts = 0, fontScale = 1;
const native = { Platform: platform, StyleSheet: { create: (value: any) => value, hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 1194, height: 834, fontScale }),
  Alert: { alert: () => alerts++ }, ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Switch', 'Pressable', 'ActivityIndicator'].map(name => [name, host(name)])) };
function load(name: string, mocks: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id === './touch-feedback' ? touchFeedbackMock : id in mocks ? mocks[id] : id === './theme-catalog.ts' ? require('../src/theme-catalog.ts') : id.startsWith('../assets/') ? id : require(id) });
  return module.exports;
}
const layout = load('device-layout.ts', { 'react-native': native });
const theme = () => testTheme(mode);
const phoneTabTitle = load('phone-tab-title.tsx', { 'react-native': native, './app-theme': { useAppTheme: theme } });
const header = load('ipad-page-header.tsx', {
  'react-native': native, 'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
  './app-theme': { useAppTheme: theme }, './header-artwork': { HeaderArtworkLayers: ({ source }: any) => React.createElement('Image', { source: `${mode}:${source}` }), HEADER_ARTWORK_ASPECT_RATIO: 1672 / 941 },
  './phone-tab-title': phoneTabTitle, './device-layout': layout,
});
const ui = load('ipad-home.tsx', {
  './ipad-page-header': header,
  './journey-image': { JourneyImage: ({ imageIdentity, ...props }: any) => React.createElement('Image', { ...props, recyclingKey: imageIdentity }) },
  'react-native': native, 'expo-image': { Image: host('Image') }, 'expo-symbols': { SymbolView: host('Symbol') },
  'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView'), useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
  './app-theme': { useAppTheme: theme, useThemeChoice: () => ({ theme: theme(), setMode: (next: string) => { if (saveFailed) throw Error('write failed'); mode = next; } }) },
  './theme-palette': load('theme-palette.ts'), './device-layout': layout,
  './header-image-sources': { headerImageSource: (source: string, appearance: string) => `${appearance}:${source}` },
  './app-data': { appDataClient: { photoDataUrl: async () => null } },
  './journey-title': { journeyDisplayTitle: (journey: any) => journey.title },
});
const text = (tree: any) => tree.root.findAllByType('Text').map((node: any) => node.children.join('')).join('|');

test('Home opens the selected Memory and journey in every theme', async () => {
  const calls: string[] = [];
  let tree: any;
  try {
    for (const appearance of ['dark', 'light', 'sakura', 'redline']) {
      mode = appearance;
      await act(() => { tree = create(React.createElement(ui.IpadHomeScreen, {
        memories: [{ id: 'memory-7', name: 'Weekend', photos: [], journeyIds: ['journey-9'] }],
        journeys: [{ id: 'journey-9', title: 'Park to Museum', miles: 3, durationMinutes: 12 }],
        music: null, recorder: null, onMemory: (id: string) => calls.push(`memory:${id}`), onJourney: (id: string) => calls.push(`journey:${id}`),
      })); });
      const cards = tree.root.findAllByType('Pressable');
      await act(() => cards.find((card: any) => card.props.accessibilityLabel === 'Open memory Weekend').props.onPress());
      await act(() => cards.find((card: any) => card.props.accessibilityLabel === 'Open journey Park to Museum').props.onPress());
      assert.deepEqual(calls.slice(-2), ['memory:memory-7', 'journey:journey-9']);
      await act(() => tree.unmount()); tree = null;
    }
  } finally { mode = 'light'; await act(() => tree?.unmount()); }
});

test('shared artwork header stacks copy above full-width actions on phones', async () => {
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(header.IpadPageHeader, { title: 'Statistics', artwork: 1, width: 358, compact: true, subtitle: 'Every mile. Every journey. Your numbers.' }, React.createElement('actions'))); });
    assert.ok(tree.root.findAllByType('View').some((node: any) => [node.props.style].flat(2).some((style: any) => style?.aspectRatio === 1672 / 941 && style?.minHeight === 0)));
    assert.ok(tree.root.findByProps({ testID: 'page-header-content' }).props.style.flat().some((style: any) => style?.flexDirection === 'column'));
    assert.ok(tree.root.findByProps({ testID: 'page-header-actions' }).props.style.flat().some((style: any) => style?.width === '100%'));
    assert.equal(tree.root.findAllByType('Text').find((node: any) => node.props.testID === 'ipad-page-title')?.props.numberOfLines, 1);
    assert.ok(tree.root.findByProps({ testID: 'phone-tab-title' }));
    assert.equal(text(tree).includes('Every mile. Every journey. Your numbers.'), true);
  } finally { await act(() => tree?.unmount()); }
});

test('shared iPad artwork header keeps narrow sidebar titles on one line', async () => {
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(header.IpadPageHeader, { title: 'Settings', artwork: 1, width: 218 })); });
    const title = tree.root.findByProps({ testID: 'ipad-page-title' });
    assert.equal(title.props.children, 'SETTINGS');
    assert.equal(title.props.numberOfLines, 1);
    assert.equal(title.props.adjustsFontSizeToFit, true);
    assert.equal(title.props.minimumFontScale, 0.72);
    assert.equal(title.props.style[1].fontSize, 24);
    assert.equal(title.props.style[1].letterSpacing, 1.4);
    assert.ok(tree.root.findByProps({ testID: 'ipad-page-header' }).props.style.flat().some((style: any) => style?.paddingHorizontal === 16));
  } finally { await act(() => tree?.unmount()); }
});

test('Home actions span the artwork height only while title and portal fit side by side', async () => {
  let tree: any;
  const render = (width: number) => React.createElement(header.IpadPageHeader, {
    title: 'Home', artwork: 1, width, subtitle: 'Your roads. Your memories. Your music.', fullHeightActions: true,
  }, React.createElement('recorder'));
  try {
    await act(() => { tree = create(render(1024)); });
    let actionStyle = tree.root.findByProps({ testID: 'page-header-actions' }).props.style.flat().filter(Boolean);
    assert.ok(actionStyle.some((value: any) => value.marginVertical === -24), 'wide iPad portal reaches both artwork edges');
    assert.ok(actionStyle.some((value: any) => value.width === layout.ipadGridSpan(1024, 2)), 'journey control occupies exactly two landscape columns');
    await act(() => tree.update(render(480)));
    actionStyle = tree.root.findByProps({ testID: 'page-header-actions' }).props.style.flat().filter(Boolean);
    assert.equal(actionStyle.some((value: any) => value.marginVertical === -24), false, 'narrow Split View stacks without overlap');
  } finally { await act(() => tree?.unmount()); }
});

test('iPad identity stays independent of narrow window layout and never matches iPhone or web', () => {
  assert.equal(layout.isIpad(), true);
  for (const width of [272, 390, 600, 740, 1180]) {
    assert.ok([1, 2, 3, 6].includes(layout.ipadGridColumns(width)));
    assert.equal(layout.isIpad(), true);
  }
  platform.isPad = false;
  assert.equal(layout.isIpad(), false);
  platform.isPad = true; platform.OS = 'web';
  assert.equal(layout.isIpad(), false);
  platform.OS = 'ios';
});

test('Home reduces card density for accessibility text without changing iPad identity', () => {
  assert.equal(layout.ipadGridColumns(976, 1), 6);
  assert.equal(layout.ipadGridColumns(976, 2), 2);
  const widths = [1, 2, 3, 4, 6].map(span => layout.ipadGridSpan(976, span));
  assert.ok(widths.every((value, index) => index === 0 || value > widths[index - 1]));
  assert.equal(layout.ipadGridSpan(976, 2) * 3 + 24, 976);
});

test('Home uses real zero values, honest empty states, responsive artwork and both themes', async () => {
  let tree: any;
  const render = (music: any) => React.createElement(ui.IpadHomeScreen, { memories: [], journeys: [], music, recorder: React.createElement('recorder') });
  try {
    for (const appearance of ['light', 'dark']) {
      mode = appearance;
      await act(() => { if (tree) tree.update(render(null)); else tree = create(render(null)); });
      assert.match(text(tree), /Finish your first journey/);
      assert.match(text(tree), /Your latest journey soundtrack/);
      assert.match(text(tree), /—/);
      assert.equal(tree.root.findByType('ScrollView').props.style.backgroundColor, mode === 'light' ? '#fffaf0' : '#08070d');
      const hero = tree.root.findByType('Image');
      assert.ok(hero.props.source.startsWith(appearance + ':'));
      const canvas = tree.root.findAllByType('View').find((node: any) => node.props.onLayout);
      await act(() => canvas.props.onLayout({ nativeEvent: { layout: { width: 1024 } } }));
      assert.equal(tree.root.findByProps({ testID: 'ipad-page-title' }).props.style[1].fontSize, 36);
      assert.equal(tree.root.findByProps({ testID: 'ipad-page-title' }).props.style[0].fontWeight, '600');
      await act(() => canvas.props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
      assert.equal(tree.root.findByProps({ testID: 'ipad-page-title' }).props.style[1].fontSize, 28);
      await act(() => tree.update(render({ metrics: { milesWithMusic: 0, listeningHours: 0, songsOnRoad: 0, currentStreak: 0 }, recentSelections: [] })));
      assert.equal(tree.root.findAllByType('Text').filter((node: any) => node.children.join('') === '0').length, 4);
      assert.equal(tree.root.findAllByType('recorder').length, 1);
    }
  } finally { await act(() => tree?.unmount()); }
});

test('sidebar viewport resizing preserves Home recorder state and vertical scroll ownership', async () => {
  let mounts = 0, unmounts = 0;
  function Recorder() { React.useEffect(() => { mounts++; return () => { unmounts++; }; }, []); return React.createElement('recorder'); }
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(ui.IpadHomeScreen, { memories: [], journeys: [], music: null, recorder: React.createElement(Recorder) })); });
    assert.deepEqual(Array.from(tree.root.findByType('SafeAreaView').props.edges), ['left', 'right']);
    assert.equal(tree.root.findByType('ScrollView').props.contentInsetAdjustmentBehavior, 'automatic');
    const canvas = tree.root.findAllByType('View').find((node: any) => node.props.onLayout);
    for (const usableWidth of [1200, 896, 560, 896, 1200]) {
      await act(() => canvas.props.onLayout({ nativeEvent: { layout: { width: usableWidth } } }));
      const columns = layout.ipadGridColumns(usableWidth, fontScale);
      const firstSpan = columns === 6 || columns === 3 ? 2 : 1;
      assert.equal(tree.root.findByProps({ testID: 'ipad-home-metric-0' }).props.style.width, layout.ipadGridSpan(usableWidth, firstSpan, columns));
      assert.equal(tree.root.findByProps({ testID: 'ipad-home-memories' }).props.style.width, layout.ipadGridSpan(usableWidth, columns === 6 ? 3 : columns, columns));
    }
    assert.equal(mounts, 1);
    assert.equal(unmounts, 0);
  } finally { await act(() => tree?.unmount()); }
});

test('blank destinations have no controls; Settings contains only a working saved theme switch', async () => {
  let tree: any;
  mode = 'dark';
  try {
    await act(() => { tree = create(React.createElement(ui.IpadBlankScreen)); });
    assert.equal(text(tree), '');
    assert.equal(tree.root.findAllByType('Pressable').length, 0);
    await act(() => tree.update(React.createElement(ui.IpadSettingsScreen)));
    assert.deepEqual(Array.from(tree.root.findByType('SafeAreaView').props.edges), ['left', 'right']);
    assert.equal(text(tree), 'Settings|Light Mode');
    const toggle = tree.root.findByType('Switch');
    assert.equal(toggle.props.value, false);
    await act(() => toggle.props.onValueChange(true));
    assert.equal(mode, 'light');
    saveFailed = true;
    await act(() => toggle.props.onValueChange(false));
    assert.equal(mode, 'light');
    assert.equal(alerts, 1);
  } finally { saveFailed = false; await act(() => tree?.unmount()); }
});

test('recorder controls retain permission, start, finish and resume actions with busy protection', async () => {
  const calls: string[] = [];
  const props = { busy: false, onStart: () => calls.push('start'), onEnable: () => calls.push('enable'), onEnd: () => calls.push('end'), onResume: () => calls.push('resume') };
  let tree: any;
  try {
    for (const [status, expected] of [['permission', 'enable'], ['ready', 'start'], ['recording', 'end'], ['paused', 'end']]) {
      await act(() => { if (tree) tree.update(React.createElement(ui.IpadRecorderControls, { ...props, status })); else tree = create(React.createElement(ui.IpadRecorderControls, { ...props, status })); });
      const button = tree.root.findAllByType('Pressable')[0];
      assert.equal(button.props.disabled, false);
      await act(() => button.props.onPress());
      assert.equal(calls.at(-1), expected);
      if (status === 'paused') { await act(() => tree.root.findAllByType('Pressable')[1].props.onPress()); assert.equal(calls.at(-1), 'resume'); }
    }
    for (const status of ['loading', 'finishing', 'automatic']) {
      await act(() => tree.update(React.createElement(ui.IpadRecorderControls, { ...props, status })));
      assert.equal(tree.root.findAllByType('Pressable')[0].props.disabled, true);
    }
    await act(() => tree.update(React.createElement(ui.IpadRecorderControls, { ...props, status: 'ready', busy: true })));
    assert.equal(tree.root.findAllByType('Pressable')[0].props.disabled, true);
  } finally { await act(() => tree?.unmount()); }
});
