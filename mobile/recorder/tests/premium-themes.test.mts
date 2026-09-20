import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as catalog from '../src/theme-catalog.ts';
import * as palette from '../src/theme-palette.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(name: string, mocks: Record<string, any>) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  return module.exports;
}
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const styles = { card: { backgroundColor: '#08070d', color: '#ffffff', padding: 12, borderColor: '#49304f' } };

test('all choices persist, restore and recolor without remounting live content; failed writes leave current selection intact', async () => {
  let saved: string | null = 'light', fail = false, mounts = 0, control: any, rendered: any;
  const appearances: string[] = [];
  const api = load('app-theme.tsx', {
    './theme-palette': palette, './theme-catalog': catalog,
    './theme-water-transition': { useWaterThemeTransition: (_id: string, persist: (next: string) => void, apply: (next: string) => void) => ({
      rootRef: { current: null }, overlay: null, settleTransition: () => {},
      transitionTheme: (next: string) => { persist(next); apply(next); },
    }) },
    'react-native': {
      Appearance: { setColorScheme: (mode: string) => appearances.push(mode) },
      Dimensions: { get: () => ({ width: 390, height: 844 }) },
      StyleSheet: { create: (value: any) => value },
      View: host('View'),
    },
    'expo-system-ui': { setBackgroundColorAsync: async () => {} },
    'expo-secure-store': { getItem: () => saved, setItem: (_key: string, value: string) => { if (fail) throw Error('storage failed'); saved = value; } },
  });
  function LiveRecorder() {
    control = api.useThemeChoice(); rendered = api.useThemedStyles(styles);
    const [draft, setDraft] = React.useState('recording-session');
    React.useEffect(() => { mounts++; }, []);
    return React.createElement('recorder', { draft, setDraft });
  }
  const render = () => React.createElement(api.AppThemeProvider, null, React.createElement(LiveRecorder));
  let tree: any;
  try {
    await act(() => { tree = create(render()); });
    assert.equal(control.theme.id, 'light', 'restore existing legacy preference');
    for (const id of ['sakura', 'redline', 'midnight-canopy', 'light', 'dark', 'sakura'] as const) {
      await act(() => control.setTheme(id));
      assert.equal(saved, id); assert.equal(control.theme.id, id);
      assert.equal(control.theme.mode, catalog.themeCatalog[id].mode);
      assert.equal(rendered.card.backgroundColor, catalog.themeCatalog[id].palette.page);
      assert.equal(tree.root.findByType('recorder').props.draft, 'recording-session');
      assert.equal(rendered.card.padding, 12);
    }
    assert.equal(mounts, 1);
    fail = true;
    assert.throws(() => control.setTheme('redline'), /storage failed/);
    assert.equal(saved, 'sakura'); assert.equal(control.theme.id, 'sakura');
    await act(() => tree.unmount());
    fail = false;
    await act(() => { tree = create(render()); });
    assert.equal(control.theme.id, 'sakura', 'custom theme survives restart');
    assert.equal(appearances.at(-1), 'light');
  } finally { await act(() => tree?.unmount()); }
});

test('premium palettes keep text and supporting metric colors readable on their surfaces', () => {
  assert.equal(catalog.themeCatalog.sakura.name, 'Rosewater');
  assert.equal(catalog.themeCatalog.redline.name, 'Grand Touring');
  assert.equal(catalog.themeCatalog['midnight-canopy'].name, 'Autumn Drive');
  assert.equal(catalog.parseThemeId('sakura'), 'sakura', 'existing light selection adopts Rosewater');
  assert.equal(catalog.parseThemeId('redline'), 'redline', 'existing dark selection adopts Grand Touring');
  assert.equal(catalog.themeCatalog.redline.palette.accent, '#d4b15a', 'primary actions use champagne gold');
  assert.equal(catalog.themeCatalog.redline.palette.green, '#2f6b57', 'Grand Touring uses British Racing Green for structural and chart accents');
  assert.equal(catalog.themeCatalog.redline.palette.blue, '#6fa5f0', 'Touring Blue remains visibly distinct from Chrome in compact charts');
  assert.deepEqual(catalog.themeCatalog.redline.swatches, ['#081832', '#203a63', '#d4b15a', '#f6f0e2', '#b6bfcc', '#2f6b57'], 'Grand Touring presents navy first, blue second and racing green sixth');
  assert.deepEqual(catalog.themeCatalog['midnight-canopy'].swatches, ['#162f13', '#206722', '#590000', '#ffd000', '#ffa600', '#ff7600', '#ffffff', '#000000']);
  assert.deepEqual(catalog.themeChoices(false), ['dark', 'redline', 'light', 'sakura']);
  assert.deepEqual(catalog.themeChoices(true), ['dark', 'redline', 'midnight-canopy', 'light', 'sakura']);
  assert.equal(catalog.chartColor(catalog.themeCatalog.sakura.palette.rose, 'sakura'), '#d895ab');
  const lum = (hex: string) => {
    const c = [1, 3, 5].map(i => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const id of ['dark', 'light', 'sakura', 'redline', 'midnight-canopy'] as const) {
    const start = palette.themedColor('#43e6ae', id, 'accent');
    const end = palette.themedColor('#ff5f67', id, 'accent');
    assert.notEqual(start, end, `${id} keeps journey start and end markers visually distinct`);
  }
  for (const id of ['sakura', 'redline', 'midnight-canopy'] as const) {
    const p = catalog.themeCatalog[id].palette;
    assert.equal(new Set([p.coral, p.amber, p.teal, p.blue, p.rose, p.green]).size, id === 'midnight-canopy' ? 3 : 6, 'test 4 intentionally consolidates legacy supporting colors');
    const supportingBackgrounds = id === 'midnight-canopy' ? [p.page, p.card] : [p.page, p.card, p.inset];
    const textColors = id === 'midnight-canopy' ? [p.text, p.muted] : [p.text, p.muted, p.accent, p.coral, p.amber, p.teal, p.blue, p.rose, ...(id === 'redline' ? [] : [p.green])];
    for (const bg of supportingBackgrounds) for (const fg of textColors) {
      assert.ok(contrast(fg, bg) >= 4.5, `${id}: ${fg} on ${bg} = ${contrast(fg, bg)}`);
    }
    if (id === 'midnight-canopy') for (const fg of [p.text, p.muted]) assert.ok(contrast(fg, p.inset) >= 4.5, `midnight-canopy readable copy on raised Pine: ${fg}`);
    if (id === 'redline') assert.ok(contrast(p.text, p.green) >= 4.5, 'Racing Green surfaces carry warm ivory text');
    assert.ok(contrast(p.onAccent, p.accent) >= 4.5);
    assert.equal(palette.themedColor('transparent', id), 'transparent');
    assert.equal(palette.themedColor('url(#route)', id), 'url(#route)');
    assert.match(palette.themedColor('rgba(5,3,11,0)', id, 'surface'), /,0\)$/);
  }
  for (const id of ['dark', 'light', 'sakura', 'redline'] as const) {
    const p = catalog.themeCatalog[id].palette;
    assert.ok(contrast(p.onSuccess, p.success) >= 4.5, `${id} saved action remains readable`);
    assert.ok(contrast(p.onDanger, p.danger) >= 4.5, `${id} destructive action remains readable`);
  }
  assert.deepEqual(catalog.PLUS_THEME_IDS, ['dark', 'sakura']);
  assert.deepEqual(catalog.FREE_THEME_IDS, ['redline', 'light']);
  assert.deepEqual(catalog.THEME_GRID_ORDER, ['redline', 'light', 'dark', 'sakura']);
  assert.equal(catalog.themeRequiresPlus('dark'), true);
  assert.equal(catalog.themeRequiresPlus('sakura'), true);
  assert.equal(catalog.themeRequiresPlus('redline'), false);
  assert.equal(catalog.themeRequiresPlus('light'), false);
  for (const invalid of [null, 'expired-theme', '__proto__', 7]) assert.equal(catalog.parseThemeId(invalid), 'redline');
});

test('Autumn uses the exact test 4 palette and keeps page, card, control and glow roles separate', () => {
  const p = catalog.themeCatalog['midnight-canopy'].palette;
  const approved = new Set(['#162f13', '#206722', '#590000', '#ffd000', '#ffa600', '#ff7600', '#ffffff', '#000000']);
  assert.equal(p.accent, '#ffa600', 'actions use test 4 orange');
  assert.equal(p.page, '#162f13');
  assert.equal(p.card, '#206722');
  assert.equal(p.inset, '#590000');
  assert.equal(p.onAccent, '#000000');
  assert.equal(p.glow, '#ff7600');
  assert.equal(palette.themedColor('#bc6aff', 'midnight-canopy', 'shadow'), p.glow);
  const surfaces = palette.themedStyleSheet({ homeRecorderCard: { backgroundColor: '#09080e' }, approvedLatestMemory: { backgroundColor: '#09080e' }, approvedLatestSongArrow: { backgroundColor: '#271730' } }, 'midnight-canopy');
  assert.equal(surfaces.homeRecorderCard.backgroundColor, p.card);
  assert.equal(surfaces.approvedLatestMemory.backgroundColor, p.card);
  assert.equal(surfaces.approvedLatestSongArrow.backgroundColor, p.inset);
  assert.equal(p.text, '#ffffff');
  assert.equal(p.muted, '#ffffff');
  assert.notEqual(p.accent, p.text);
  assert.deepEqual(new Set(Object.values(p)), approved);
  for (const input of ['#c43c00', '#ffa800', '#471329', '#ff5c73', '#08070d']) {
    assert.ok([p.page, p.card].includes(palette.themedColor(input, 'midnight-canopy', 'surface')));
    assert.ok([p.text, p.accent, p.amber].includes(palette.themedColor(input, 'midnight-canopy', 'text')));
  }
  assert.deepEqual(palette.themedGradient(['#c43c00', '#471329', '#08070d'], 'midnight-canopy'), [p.card, p.card, p.page]);
  assert.equal(palette.themedGradient(['rgba(196,60,0,0.25)'], 'midnight-canopy')[0], 'rgba(32,103,34,0.25)');
  for (const value of ['#ffffff', '#b6a6c1', '#746a7c']) assert.equal(palette.themedColor(value, 'midnight-canopy', 'text'), p.text);
  assert.equal(palette.themedColor('#ff5577', 'midnight-canopy', 'text'), p.accent);
  assert.equal(palette.themedColor('#ffb050', 'midnight-canopy', 'text'), p.amber);
});

test('tab titles no longer use a palette bar as a substitute for themed elements', async () => {
  let tree: any, id = 'midnight-canopy';
  const header = load('phone-tab-title.tsx', {
    'react-native': { View: host('View'), Text: host('Text'), StyleSheet: { create: (v: any) => v } },
    './app-theme': { useAppTheme: () => ({ id, palette: catalog.themeCatalog[id].palette }) },
  });
  try {
    for (const title of ['Home', 'Memories', 'Soundtracks', 'Statistics', 'Settings']) {
      await act(() => { tree = create(React.createElement(header.PhoneTabTitle, { title })); });
      const colors = tree.root.findAllByType('View').map((node: any) => node.props.style?.borderTopColor).filter(Boolean);
      assert.equal(colors.length, 0);
      await act(() => tree.unmount());
    }
    id = 'light';
    await act(() => { tree = create(React.createElement(header.PhoneTabTitle, { title: 'Home' })); });
    assert.equal(tree.root.findAllByProps({ testID: 'autumn-title-accent' }).length, 0);
  } finally { await act(() => tree?.unmount()); }
});

test('Autumn assigns red to small badges and section markers, yellow to values, never red cards', () => {
  const p = catalog.themeCatalog['midnight-canopy'].palette;
  const input = { sectionAccent: { backgroundColor: '#ff795b' }, cardAccent: { backgroundColor: '#ff5577' }, settingsHubIcon: { backgroundColor: '#291735' }, metricValue: { color: '#ffffff' }, panel: { backgroundColor: '#120d19' }, page: { backgroundColor: '#08070d' } };
  const actual = palette.themedStyleSheet(input, 'midnight-canopy');
  assert.equal(actual.sectionAccent.backgroundColor, p.rose);
  assert.equal(actual.cardAccent.backgroundColor, p.rose);
  assert.equal(actual.settingsHubIcon.backgroundColor, p.rose);
  assert.equal(actual.metricValue.color, p.amber);
  assert.ok([p.page, p.card].includes(actual.panel.backgroundColor));
  assert.ok([p.page, p.card].includes(actual.page.backgroundColor));
  assert.equal(palette.themedStyleSheet(input, 'dark'), input);
});

test('Autumn widgets have yellow outlines and the recording beacon is red with amber paused state', () => {
  const p = catalog.themeCatalog['midnight-canopy'].palette;
  assert.equal(p.line, '#ffd000');
  assert.equal(palette.themedColor('rgba(190,168,194,0.44)', 'midnight-canopy', 'border'), p.line);
  assert.equal(palette.themedColor('transparent', 'midnight-canopy', 'border'), 'transparent');
  const input = { homeRecorderPulseCore: {}, homeRecorderPulseOuter: {}, homeRecorderPulseMiddle: {}, homeRecorderPulseCorePaused: {}, homeRecorderCard: { backgroundColor: '#09080e', borderColor: '#abcabc' } };
  const actual: any = palette.themedStyleSheet(input, 'midnight-canopy');
  assert.equal(actual.homeRecorderPulseCore.backgroundColor, p.rose);
  assert.equal(actual.homeRecorderPulseMiddle.borderColor, p.rose);
  assert.equal(actual.homeRecorderPulseCorePaused.backgroundColor, p.amber);
  assert.equal(actual.homeRecorderCard.borderColor, p.line);
  assert.equal(actual.homeRecorderCard.backgroundColor, p.card);
});

test('Autumn widget headings are orange while body copy remains white', () => {
  const input = { cardTitle: { color: '#ffffff' }, sectionTitle: { color: '#ffffff' }, metricLabel: { color: '#ffffff' }, body: { color: '#ffffff' } };
  const output = palette.themedStyleSheet(input, 'midnight-canopy');
  for (const name of ['cardTitle', 'sectionTitle', 'metricLabel'] as const) assert.equal(output[name].color, '#ffa600');
  assert.equal(output.body.color, '#ffffff');
  assert.equal(palette.themedStyleSheet(input, 'dark'), input);
});

test('theme grid exposes every paid selection and reports failed saves', async () => {
  const selections: string[] = [], alerts: string[] = []; let fail = false;
  const origins: { x: number; y: number }[] = [];
  const assets = Object.fromEntries(['cinematic-home-main-photo-v1.jpg', 'home-header-light-v1.png', 'theme-rosewater-road-v1.png', 'theme-grand-touring-home-v2.png', 'theme-midnight-canopy-v1.png'].map((name, i) => [`../assets/${name}`, i + 1]));
  const api = load('theme-picker.tsx', {
    ...assets, './release-features': { V3_MIDNIGHT_CANOPY_ENABLED: false },
    './theme-catalog': catalog,
    './app-theme': { useThemeChoice: () => ({
      theme: { ...catalog.themeCatalog.sakura, id: 'sakura' },
      setTheme: () => {},
      transitionTheme: (id: string, origin: { x: number; y: number }) => {
        if (fail) throw Error();
        selections.push(id);
        origins.push({ ...origin });
      },
    }) },
    'react-native': {
      StyleSheet: { create: (v: any) => v, absoluteFill: {} },
      Alert: { alert: (title: string) => alerts.push(title) },
      ...Object.fromEntries(['View', 'Text', 'Pressable'].map(n => [n, host(n)])),
    },
    'expo-image': { Image: host('Image') },
    'expo-linear-gradient': { LinearGradient: host('Gradient') },
    'expo-symbols': { SymbolView: host('Symbol') },
  });
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(api.ThemePicker, { membershipTier: 'paid' }), { createNodeMock: () => ({
      measureInWindow: (callback: (...values: number[]) => void) => callback(40, 120, 160, 80),
    }) }); });
    const buttons = tree.root.findAllByType('Pressable');
    assert.deepEqual(buttons.map((button: any) => button.props.testID), ['theme-card-redline', 'theme-card-light', 'theme-card-dark', 'theme-card-sakura']);
    assert.equal(buttons.filter((button: any) => button.props.accessibilityState.checked).length, 1);
    for (const button of buttons) {
      assert.equal(button.props.accessibilityRole, 'radio');
      await act(() => button.props.onPress({ nativeEvent: { pageX: 20, pageY: 30 } }));
    }
    assert.equal(selections.join(','), 'redline,light,dark', 'reselecting the committed theme does not replay the water transition');
    assert.deepEqual(origins, Array.from({ length: 3 }, () => ({ x: 20, y: 30 })), 'every changed theme uses the actual window tap');
    await act(() => buttons[0].props.onPress({ nativeEvent: { pageX: 0, pageY: 0 } }));
    assert.deepEqual(origins.at(-1), { x: 120, y: 160 }, 'coordinate-free activation starts at the pressed card center');
    fail = true;
    await act(() => buttons[0].props.onPress({ nativeEvent: { pageX: 20, pageY: 30 } }));
    assert.deepEqual(alerts, ['Appearance not saved']);
  } finally { await act(() => tree?.unmount()); }
});

test('theme artwork switches only registered decorative images, preserving user photos and music covers', () => {
  const assets = new Map<string, number>();
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL('../src/header-image-sources.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const asset = (path: string) => { if (!assets.has(path)) assets.set(path, assets.size + 1); return assets.get(path)!; };
  vm.runInNewContext(code, { module, exports: module.exports, require: asset });
  assert.ok(![...assets.keys()].some(path => /theme-(rosewater|carbon-blue|grand-touring)-/.test(path)), 'custom replacements register only when selected');
  const resolve = module.exports.headerImageSource;
  assert.equal(resolve(asset('../assets/cinematic-home-main-photo-v1.jpg'), 'midnight-canopy'), asset('../assets/theme-autumn-home-road-v1.jpg'));
  const autumnSettings = asset('../assets/cinematic-settings-photo-v1.jpg');
  assert.equal(resolve(autumnSettings, 'midnight-canopy'), autumnSettings, 'Home photo replacement stays scoped to Home');
  const photo = { uri: 'file:///private/photo.jpg' };
  const rosewaterRoad = asset('../assets/theme-rosewater-road-v1.png');
  const rosewaterMemory = asset('../assets/theme-rosewater-memory-v1.png');
  const rosewaterJourney = asset('../assets/theme-rosewater-journey-v1.png');
  for (const file of ['cinematic-settings-photo-v1.jpg', 'cinematic-soundtracks-photo-v1.jpg', 'cinematic-home-main-photo-v1.jpg', 'cinematic-statistics-photo-v1.jpg']) assert.equal(resolve(asset(`../assets/${file}`), 'sakura'), rosewaterRoad);
  for (const file of ['cinematic-memory-polaroids-photo-v1.jpg', 'cinematic-memories-polaroids-photo-v1.jpg']) assert.equal(resolve(asset(`../assets/${file}`), 'sakura'), rosewaterMemory);
  for (const file of ['cinematic-journey-photo-v1.jpg', 'cinematic-home-morning-photo-v1.jpg', 'cinematic-home-afternoon-photo-v1.jpg', 'cinematic-home-evening-photo-v1.jpg', 'cinematic-home-night-photo-v1.jpg']) assert.equal(resolve(asset(`../assets/${file}`), 'sakura'), rosewaterJourney);

  const grandTouringTabs = [
    ['cinematic-home-main-photo-v1.jpg', 'theme-grand-touring-home-v2.png'],
    ['cinematic-soundtracks-photo-v1.jpg', 'theme-grand-touring-soundtracks-v1.png'],
    ['cinematic-memories-polaroids-photo-v1.jpg', 'theme-grand-touring-memories-v1.png'],
    ['cinematic-statistics-photo-v1.jpg', 'theme-grand-touring-statistics-v1.png'],
    ['cinematic-settings-photo-v1.jpg', 'theme-grand-touring-settings-v1.png'],
  ];
  const tabArt = grandTouringTabs.map(([source, replacement]) => {
    const expected = asset(`../assets/${replacement}`);
    assert.equal(resolve(asset(`../assets/${source}`), 'redline'), expected);
    return expected;
  });
  assert.equal(new Set(tabArt).size, 5, 'Grand Touring gives every primary tab distinct art');
  for (const file of [
    'theme-grand-touring-home-v2.png',
    'theme-grand-touring-soundtracks-v1.png',
    'theme-grand-touring-memories-v1.png',
    'theme-grand-touring-statistics-v1.png',
    'theme-grand-touring-settings-v1.png',
    'theme-carbon-blue-journey-v1.png',
    'theme-carbon-blue-road-v1.png',
  ]) {
    const png = readFileSync(new URL(`../assets/${file}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 1536, `${file} keeps the theme artwork width`);
    assert.equal(png.readUInt32BE(20), 1024, `${file} keeps the theme artwork height`);
  }
  assert.equal(resolve(asset('../assets/cinematic-memory-polaroids-photo-v1.jpg'), 'redline'), asset('../assets/theme-grand-touring-memories-v1.png'));
  assert.equal(resolve(asset('../assets/cinematic-journey-photo-v1.jpg'), 'redline'), asset('../assets/theme-carbon-blue-journey-v1.png'));

  for (const id of ['sakura', 'redline']) { assert.equal(resolve(photo, id), photo); assert.equal(resolve(99999, id), 99999); }
  const statistics = asset('../assets/cinematic-statistics-photo-v1.jpg');
  assert.equal(resolve(statistics, 'dark'), statistics, 'original Cinematic Dark artwork stays intact');
  assert.equal(resolve(statistics, 'light'), asset('../assets/statistics-header-light-v1.png'));
});

test('default Memory artwork receives a fresh shared image identity for every theme', () => {
  const shell = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
  const ipadHome = readFileSync(new URL('../src/ipad-home.tsx', import.meta.url), 'utf8');
  assert.match(shell, /key=\{`default-memory-\$\{theme\.id\}`\}/);
  assert.match(shell, /imageIdentity=\{`default-memory-\$\{theme\.id\}`\}/);
  assert.match(ipadHome, /const sourceKey = .*`default-memory-\$\{theme\.id\}`/);
  assert.match(ipadHome, /imageIdentity=\{sourceKey\}/);
});
