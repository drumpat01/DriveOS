import { testTheme } from './theme-fixture.mts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const src = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
function load(name: string, mocks: Record<string, unknown> = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(src(name), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : id === './theme-catalog.ts' ? require('../src/theme-catalog.ts') : require(id) }, { filename: name });
  return module.exports;
}
const navigationContext = load('native-navigation-context.tsx');
let light = false;
let ipad = false;
let windowSize = { width: 820, height: 1180 };
let memoryParams: any = { id: 'memory-a' };
let memoryFlip: any = null;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const Tabs = Object.assign(host('tabs'), { Trigger: Object.assign(host('trigger'), { Icon: host('icon'), Label: host('label') }) });
const Stack = Object.assign(host('stack'), { Screen: host('route') });
const navigation = load('native-navigation.tsx', {
  'react-native': { View: host('view'), useWindowDimensions: () => { throw new Error('Tab labels must not depend on global rotation metrics'); } },
  'react-native-safe-area-context': { useSafeAreaFrame: () => ({ x: 0, y: 0, ...windowSize }) },
  './device-layout': { isIpad: () => ipad },
  './detail-screen-frame': { DetailViewportProvider: host('viewport') },
  './card-detail-link': { useCardDetailDismissal: () => {} },
  './memory-flip': { MemoryFlipProvider: host('memory-flip'), MemoryFlipImageContext: React.createContext(false), useMemoryFlip: () => memoryFlip },
  './native-navigation-context': navigationContext,
  './app-theme': { useAppTheme: () => testTheme(light) },
  'expo-router': { Stack, ThemeProvider: host('theme'), DarkTheme: { dark: true, colors: {} }, DefaultTheme: { dark: false, colors: {} }, useFocusEffect: () => {}, useLocalSearchParams: () => memoryParams },
  'expo-router/unstable-native-tabs': { NativeTabs: Tabs },
  '../assets/home-tab-orange.png': 42,
});

test('Memory native handoff waits for layout plus the correct hero; ordinary back navigation regains its native animation', async () => {
  const ready: string[] = [];
  memoryParams = { id: 'memory-a', memoryFlip: 'token-a' };
  memoryFlip = { activeToken: 'token-a', destinationReady: (token: string) => ready.push(token) };
  let tree: any, stack: any;
  const render = () => React.createElement(navigationContext.NativeNavigationContext.Provider, { value: { memory: (id: string, onReady: () => void) => React.createElement('detail', { id, onReady }) } }, React.createElement(navigation.NativeMemoryScreen));
  try {
    await act(() => { tree = create(render()); stack = create(React.createElement(navigation.JourneyDeckNativeStack)); });
    const memoryOptions = () => stack.root.findAllByType('route').find((node: any) => node.props.name === 'memory/[id]').props.options;
    assert.equal(memoryOptions().animation, 'none');
    assert.equal(ready.length, 0);
    await act(() => tree.root.findByType('view').props.onLayout());
    assert.equal(ready.length, 0, 'layout alone cannot expose an unloaded photo');
    await act(() => tree.root.findByType('detail').props.onReady());
    assert.deepEqual(ready, ['token-a']);
    memoryParams = { id: 'memory-b', memoryFlip: 'token-b' };
    await act(() => tree.update(render()));
    assert.equal(ready.length, 1, 'an earlier hero cannot mark a different memory ready');
    await act(() => tree.root.findByType('detail').props.onReady());
    assert.deepEqual(ready, ['token-a', 'token-b']);
    memoryFlip = null;
    await act(() => stack.update(React.createElement(navigation.JourneyDeckNativeStack)));
    assert.equal(memoryOptions().animation, 'default');
    assert.equal(stack.root.findByType('stack').props.screenOptions.gestureEnabled, true);
  } finally {
    memoryFlip = null; memoryParams = { id: 'memory-a' };
    await act(() => { tree?.unmount(); stack?.unmount(); });
  }
});

test('zoom detail routes omit UIKit headers while retaining native stack gestures', async () => {
  let tree: any;
  await act(() => { tree = create(React.createElement(navigation.JourneyDeckNativeStack)); });
  const stack = tree.root.findByType('stack');
  assert.equal(stack.props.screenOptions.gestureEnabled, true);
  assert.equal(tree.root.findByType('viewport').findByType('stack'), stack);
  for (const name of ['memory/[id]', 'journey/[id]']) {
    const route = tree.root.findAllByType('route').find((item: any) => item.props.name === name);
    assert.equal(route.props.options.headerShown, false);
  }
  await act(() => tree.unmount());
});

test('native bar has five fixed routes and an original orange Home image in both appearances', async () => {
  let tree: any;
  const render = () => React.createElement(navigationContext.NativeNavigationContext.Provider, { value: { tabBarHidden: false } }, React.createElement(navigation.JourneyDeckNativeTabs));
  for (const isLight of [false, true]) {
    light = isLight;
    await act(() => { if (tree) tree.update(render()); else tree = create(render()); });
    const triggers = tree.root.findAllByType('trigger');
    assert.deepEqual(triggers.map((item: any) => item.props.name), ['music', 'journeys', 'index', 'statistics', 'settings']);
    for (const item of triggers) {
      assert.equal(item.props.disablePopToTop, true);
      assert.equal(item.props.disableScrollToTop, true);
      assert.equal(item.props.disableAutomaticContentInsets, true);
      assert.equal(item.props.hidden, undefined, 'hiding individual triggers would destroy tab state');
    }
    assert.equal(triggers[2].findByType('icon').props.renderingMode, 'original');
    assert.equal(triggers[2].findByType('icon').props.src, 42);
    assert.equal(triggers[3].findByType('label').props.children, 'Statistics');
    assert.equal(tree.root.findByType('tabs').props.minimizeBehavior, 'never');
    assert.equal(tree.root.findByType('tabs').props.tintColor, isLight ? '#ad492e' : '#ff9470', 'iPhone navigation palette is preserved');
  }
  await act(() => tree.unmount());
});

test('iPad enables the native sidebar with Home first and all five destinations', async () => {
  ipad = true;
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(navigationContext.NativeNavigationContext.Provider, { value: { tabBarHidden: false } }, React.createElement(navigation.JourneyDeckNativeTabs))); });
    assert.equal(tree.root.findByType('tabs').props.sidebarAdaptable, true);
    assert.deepEqual(tree.root.findAllByType('trigger').map((item: any) => item.props.name), ['index', 'music', 'journeys', 'statistics', 'settings']);
    assert.equal(tree.root.findAllByType('trigger')[0].findByType('icon').props.renderingMode, 'original');
    for (const isLight of [true, false]) {
      light = isLight;
      await act(() => tree.update(React.createElement(navigationContext.NativeNavigationContext.Provider, { value: { tabBarHidden: false } }, React.createElement(navigation.JourneyDeckNativeTabs))));
      const tabs = tree.root.findByType('tabs');
      const neutral = isLight ? '#685461' : '#b6a6c1';
      assert.equal(tabs.props.tintColor, neutral, 'sidebar symbols inherit neutral host tint');
      assert.equal(tabs.props.labelStyle.default.color, neutral);
      assert.equal(tabs.props.labelStyle.selected.color, neutral);
      const home = tree.root.findAllByType('trigger')[0].findByType('label');
      assert.equal(home.props.selectedStyle.color, '#ff8956');
      for (const size of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }]) {
        windowSize = size;
        await act(() => tree.update(React.createElement(navigationContext.NativeNavigationContext.Provider, { value: { tabBarHidden: false } }, React.createElement(navigation.JourneyDeckNativeTabs))));
        const statistics = tree.root.findAllByType('trigger').find((item: any) => item.props.name === 'statistics');
        assert.equal(statistics.findByType('label').props.children, size.height > size.width ? 'Stats' : 'Statistics');
        assert.equal(tree.root.findByType('tabs'), tabs, 'rotation updates labels without replacing the tab host');
      }
    }
  } finally { ipad = false; await act(() => tree?.unmount()); }
});

test('screen context updates and tab changes retain drafts and one Home recorder lifecycle', async () => {
  const mounts: Record<string, number> = {}, unmounts: Record<string, number> = {};
  const setters: Record<string, (value: string) => void> = {};
  const tabs = ['music', 'journeys', 'home', 'statistics', 'settings'];
  function Probe({ tab }: { tab: string }) {
    const [draft, setDraft] = React.useState('');
    setters[tab] = setDraft;
    React.useEffect(() => { mounts[tab] = (mounts[tab] ?? 0) + 1; return () => { unmounts[tab] = (unmounts[tab] ?? 0) + 1; }; }, [tab]);
    return React.createElement('screen-state', { tab, draft });
  }
  // The installed iOS tabs host keeps every route mounted. Exercise our actual
  // context consumers under that lifecycle, including replacement JSX props.
  const nativeHost = readFileSync(new URL('../node_modules/expo-router/build/native-tabs/NativeTabsView.ios.js', import.meta.url), 'utf8');
  assert.match(nativeHost, /const children = tabs\.map/);
  assert.match(nativeHost, /tab\.routeKey/);
  const render = (selected: string) => React.createElement(navigationContext.NativeNavigationContext.Provider, {
    value: { tabs: Object.fromEntries(tabs.map(tab => [tab, React.createElement(Probe, { tab })])), onTabFocus: () => {} },
  }, tabs.map(tab => React.createElement('native-screen', { key: tab, hidden: selected !== tab }, React.createElement(navigation.NativeTabScreen, { tab }))));
  let tree: any;
  await act(() => { tree = create(render('home')); });
  await act(() => setters.journeys('search=lake;filter=music;scroll=640'));
  await act(() => setters.settings('profile draft'));
  for (const selected of [...tabs, 'home', 'journeys']) await act(() => tree.update(render(selected)));
  assert.equal(tree.root.findAllByType('screen-state').find((node: any) => node.props.tab === 'journeys').props.draft, 'search=lake;filter=music;scroll=640');
  assert.equal(tree.root.findAllByType('screen-state').find((node: any) => node.props.tab === 'settings').props.draft, 'profile draft');
  assert.deepEqual(mounts, Object.fromEntries(tabs.map(tab => [tab, 1])));
  assert.deepEqual(unmounts, {});
  await act(() => tree.unmount());
  assert.equal(unmounts.home, 1);
});

test('Expo stack retains Memory and tab keys when opening a Journey and going back', () => {
  const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');
  const { TabRouter } = require('../node_modules/expo-router/build/react-navigation/routers/TabRouter.js');
  const tabOptions = { routeNames: ['music', 'journeys', 'index', 'statistics', 'settings'], routeParamList: {}, routeGetIdList: {} };
  const tabRouter = TabRouter({ initialRouteName: 'index', backBehavior: 'history' });
  let tabState = tabRouter.getInitialState(tabOptions);
  assert.equal(tabState.routes[tabState.index].name, 'index');
  const tabKeys = tabState.routes.map((route: any) => route.key);
  for (const name of ['settings', 'music', 'journeys']) {
    tabState = tabRouter.getStateForAction(tabState, { type: 'JUMP_TO', payload: { name } }, tabOptions);
    assert.deepEqual(tabState.routes.map((route: any) => route.key), tabKeys);
  }
  const stack = StackRouter({ initialRouteName: '(tabs)' });
  const options = { routeNames: ['(tabs)', 'memory/[id]', 'journey/[id]', 'atlas', 'tools'], routeParamList: {}, routeGetIdList: {} };
  let state = stack.getInitialState(options);
  state.routes[0].state = tabState;
  const tabKey = state.routes[0].key;
  state = stack.getStateForAction(state, { type: 'PUSH', payload: { name: 'memory/[id]', params: { id: 'memory-a' } } }, options);
  const memoryKey = state.routes[1].key;
  state = stack.getStateForAction(state, { type: 'PUSH', payload: { name: 'journey/[id]', params: { id: 'journey-b' } } }, options);
  state = stack.getStateForAction(state, { type: 'GO_BACK' }, options);
  assert.equal(state.routes[state.index].key, memoryKey);
  assert.equal(state.routes[0].key, tabKey);
  assert.equal(state.routes[0].state, tabState);
  state = stack.getStateForAction(state, { type: 'GO_BACK' }, options);
  assert.equal(state.routes[state.index].name, '(tabs)');
  assert.equal(state.routes[0].state.routes[tabState.index].name, 'journeys');
});

test('route-local loads ignore old responses and retain data while refreshing', async () => {
  const requests: { id: string; resolve: (value: any) => void; reject: (reason: Error) => void }[] = [];
  let archiveChanged: (() => void) | null = null;
  const { useJourneyDetail } = load('use-journey-detail.ts', { './local-archive-events': { subscribeLocalArchiveChanges: (listener: () => void) => { archiveChanged = listener; return () => { archiveChanged = null; }; } }, './app-data': { appDataClient: { journey: (id: string) => new Promise((resolve, reject) => requests.push({ id, resolve, reject })) } } });
  let result: any;
  function Detail({ id }: { id: string }) { result = useJourneyDetail(id); return null; }
  let tree: any;
  await act(() => { tree = create(React.createElement(Detail, { id: 'old' })); });
  await act(() => tree.update(React.createElement(Detail, { id: 'new' })));
  await act(async () => { requests[0].resolve({ id: 'old' }); await Promise.resolve(); });
  assert.equal(result.state.data, null);
  await act(async () => { requests[1].resolve({ id: 'new', title: 'Original' }); await Promise.resolve(); });
  assert.equal(result.state.data.id, 'new');
  await act(() => archiveChanged?.());
  assert.equal(result.state.status, 'loading');
  assert.equal(result.state.data.title, 'Original');
  await act(async () => { requests[2].resolve({ id: 'new', title: 'Saved place' }); await Promise.resolve(); });
  assert.equal(result.state.data.title, 'Saved place');
  await act(() => result.refresh());
  await act(async () => { requests[3].reject(new Error('offline read failed')); await Promise.resolve(); });
  assert.equal(result.state.status, 'error');
  assert.equal(result.state.data.id, 'new');
  await act(() => result.refresh());
  await act(() => tree.unmount());
  assert.equal(archiveChanged, null);
  await act(async () => { requests[4].resolve({ id: 'new', title: 'Late response' }); await Promise.resolve(); });
  assert.notEqual(result.state.data.title, 'Late response');
});

test('preview navigation runtime stays isolated from V1 and the installed preview OTA runtime', async () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const config = require('../app.config.js');
  const previous = process.env.APP_VARIANT;
  try {
    process.env.APP_VARIANT = 'v2-preview';
    const preview = config({ config: app });
    assert.equal(preview.runtimeVersion, '2.0.0-preview.9');
    assert.ok(preview.plugins.includes('./plugins/with-journeydeck-watch'));
    assert.equal(preview.ios.supportsTablet, true);
    assert.equal(preview.ios.requireFullScreen, false);
    assert.equal(preview.orientation, 'portrait', 'iPhone orientation remains unchanged');
    assert.equal(preview.ios.infoPlist['UISupportedInterfaceOrientations~ipad'].length, 4);
    assert.equal(preview.ios.bundleIdentifier, 'com.journeydeck.recorder.v2');
    assert.ok(preview.plugins.includes('expo-router'));
    assert.ok(preview.plugins.includes('./plugins/with-even-native-tabs'));
    assert.deepEqual(preview.ios.icon, {
      light: './assets/icon-light-plum-v1.png',
      dark: './assets/icon.png',
      tinted: './assets/icon-tinted-clear-v1.png',
    });
    for (const file of Object.values(preview.ios.icon) as string[]) {
      const png = readFileSync(new URL('../' + file, import.meta.url));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), 'Home Screen icons must be square');
    }
    const tinted = await require('@expo/image-utils').getPngInfo(fileURLToPath(new URL('../assets/icon-tinted-clear-v1.png', import.meta.url)));
    assert.equal(tinted.width, 1024);
    assert.equal(tinted.height, 1024);
    let validMonochrome = true;
    for (let offset = 0; offset < tinted.data.length; offset += 4) {
      if (tinted.data[offset] !== tinted.data[offset + 1] || tinted.data[offset + 1] !== tinted.data[offset + 2] || tinted.data[offset + 3] !== 255) {
        validMonochrome = false; break;
      }
    }
    assert.equal(validMonochrome, true, 'tinted icon must be opaque grayscale');
    delete process.env.APP_VARIANT;
    const publicRelease = config({ config: app });
    assert.equal(publicRelease.ios.bundleIdentifier, app.ios.bundleIdentifier);
    assert.equal(publicRelease.ios.entitlements['com.apple.developer.icloud-container-identifiers'][0], 'iCloud.com.journeydeck.recorder');
  } finally { if (previous === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = previous; }
});
