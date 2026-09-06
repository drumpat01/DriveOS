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
let mode = 'light', saveFailed = false, alerts = 0;
const native = { Platform: platform, StyleSheet: { create: (value: any) => value, hairlineWidth: 1 },
  Alert: { alert: () => alerts++ }, ...Object.fromEntries(['View', 'Text', 'ScrollView', 'Switch', 'Pressable', 'ActivityIndicator'].map(name => [name, host(name)])) };
function load(name: string, mocks: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : id.startsWith('../assets/') ? id : require(id) });
  return module.exports;
}
const layout = load('device-layout.ts', { 'react-native': native });
const theme = () => ({ mode, isLight: mode === 'light' });
const header = load('ipad-page-header.tsx', {
  'react-native': native, 'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
  './app-theme': { useAppTheme: theme }, './header-image-sources': { headerImageSource: (source: string, appearance: string) => `${appearance}:${source}` },
});
const ui = load('ipad-home.tsx', {
  './ipad-page-header': header,
  'react-native': native, 'expo-image': { Image: host('Image') }, 'expo-symbols': { SymbolView: host('Symbol') },
  'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView'), useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
  './app-theme': { useAppTheme: theme, useThemeChoice: () => ({ theme: theme(), setMode: (next: string) => { if (saveFailed) throw Error('write failed'); mode = next; } }) },
  './theme-palette': load('theme-palette.ts'), './device-layout': layout,
  './header-image-sources': { headerImageSource: (source: string, appearance: string) => `${appearance}:${source}` },
  './app-data': { appDataClient: { photoDataUrl: async () => null } },
  './journey-title': { journeyDisplayTitle: (journey: any) => journey.title },
});
const text = (tree: any) => tree.root.findAllByType('Text').map((node: any) => node.children.join('')).join('|');

test('iPad identity stays independent of narrow window layout and never matches iPhone or web', () => {
  assert.equal(layout.isIpad(), true);
  for (const width of [272, 390, 600, 740, 1180]) {
    const columns = layout.ipadHomeColumns(width);
    assert.ok(width / columns.metrics >= 180, 'metric text and icon retain usable space');
    assert.equal(layout.isIpad(), true);
  }
  platform.isPad = false;
  assert.equal(layout.isIpad(), false);
  platform.isPad = true; platform.OS = 'web';
  assert.equal(layout.isIpad(), false);
  platform.OS = 'ios';
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
      const metricValue = tree.root.findAllByType('Text').find((node: any) => node.children.join('') === '—');
      let cell = metricValue.parent;
      while (cell && !cell.props.style?.width) cell = cell.parent;
      assert.equal(cell.props.style.width, `${100 / layout.ipadHomeColumns(usableWidth).metrics}%`);
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
