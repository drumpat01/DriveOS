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

test('all four choices persist, restore and recolor without remounting live content; failed writes leave current selection intact', async () => {
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
    for (const id of ['sakura', 'redline', 'light', 'dark', 'sakura'] as const) {
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
  assert.equal(catalog.parseThemeId('sakura'), 'sakura', 'existing light selection adopts Rosewater');
  assert.equal(catalog.parseThemeId('redline'), 'redline', 'existing dark selection adopts Grand Touring');
  assert.equal(catalog.themeCatalog.redline.palette.accent, '#d4b15a', 'primary actions use champagne gold');
  assert.equal(catalog.themeCatalog.redline.palette.green, '#2f6b57', 'Grand Touring uses British Racing Green for structural and chart accents');
  assert.equal(catalog.themeCatalog.redline.palette.blue, '#6fa5f0', 'Touring Blue remains visibly distinct from Chrome in compact charts');
  assert.deepEqual(catalog.themeCatalog.redline.swatches, ['#081832', '#203a63', '#d4b15a', '#f6f0e2', '#b6bfcc', '#2f6b57'], 'Grand Touring presents navy first, blue second and racing green sixth');
  assert.equal(catalog.chartColor(catalog.themeCatalog.sakura.palette.rose, 'sakura'), '#d895ab');
  const lum = (hex: string) => {
    const c = [1, 3, 5].map(i => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const id of ['dark', 'light', 'sakura', 'redline'] as const) {
    const start = palette.themedColor('#43e6ae', id, 'accent');
    const end = palette.themedColor('#ff5f67', id, 'accent');
    assert.notEqual(start, end, `${id} keeps journey start and end markers visually distinct`);
  }
  for (const id of ['sakura', 'redline'] as const) {
    const p = catalog.themeCatalog[id].palette;
    assert.equal(new Set([p.coral, p.amber, p.teal, p.blue, p.rose, p.green]).size, 6);
    for (const bg of [p.page, p.card, p.inset]) for (const fg of [p.text, p.muted, p.accent, p.coral, p.amber, p.teal, p.blue, p.rose, ...(id === 'redline' ? [] : [p.green])]) {
      assert.ok(contrast(fg, bg) >= 4.5, `${id}: ${fg} on ${bg} = ${contrast(fg, bg)}`);
    }
    if (id === 'redline') assert.ok(contrast(p.text, p.green) >= 4.5, 'Racing Green surfaces carry warm ivory text');
    assert.ok(contrast(p.onAccent, p.accent) >= 4.5);
    assert.equal(palette.themedColor('transparent', id), 'transparent');
    assert.equal(palette.themedColor('url(#route)', id), 'url(#route)');
    assert.match(palette.themedColor('rgba(5,3,11,0)', id, 'surface'), /,0\)$/);
  }
  for (const invalid of [null, 'expired-theme', '__proto__', 7]) assert.equal(catalog.parseThemeId(invalid), 'dark');
});

test('theme picker exposes every theme without membership gating and reports failed saves', async () => {
  const selections: string[] = [], alerts: string[] = []; let fail = false;
  const origins: { x: number; y: number }[] = [];
  const assets = Object.fromEntries(['cinematic-home-main-photo-v1.jpg', 'home-header-light-v1.png', 'theme-rosewater-road-v1.png', 'theme-grand-touring-home-v1.png'].map((name, i) => [`../assets/${name}`, i + 1]));
  const api = load('theme-picker.tsx', {
    ...assets, './theme-catalog': catalog,
    './app-theme': { useThemeChoice: () => ({ theme: { ...catalog.themeCatalog.sakura, id: 'sakura' }, transitionTheme: (id: string, origin: { x: number; y: number }) => { if (fail) throw Error(); selections.push(id); origins.push({ ...origin }); } }) },
    'react-native': { StyleSheet: { create: (v: any) => v, absoluteFill: {} }, Alert: { alert: (title: string) => alerts.push(title) }, ...Object.fromEntries(['View', 'Text', 'Pressable'].map(n => [n, host(n)])) },
    'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
  });
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(api.ThemePicker), { createNodeMock: () => ({
      measureInWindow: (callback: (...values: number[]) => void) => callback(40, 120, 160, 80),
    }) }); });
    const buttons = tree.root.findAllByType('Pressable');
    assert.equal(buttons.length, 4);
    assert.ok(buttons.some((b: any) => b.props.accessibilityLabel === 'Rosewater, light theme'));
    assert.ok(buttons.some((b: any) => b.props.accessibilityLabel === 'Grand Touring, dark theme'));
    assert.equal(buttons.filter((b: any) => b.props.accessibilityState.checked).length, 1);
    for (const b of buttons) { assert.equal(b.props.accessibilityRole, 'radio'); await act(() => b.props.onPress({ nativeEvent: { pageX: 20, pageY: 30 } })); }
    assert.equal(selections.join(','), 'dark,redline,light,sakura');
    assert.deepEqual(origins, Array.from({ length: 4 }, () => ({ x: 20, y: 30 })), 'every theme uses the actual window tap');
    await act(() => buttons[0].props.onPress({ nativeEvent: { pageX: 0, pageY: 0 } }));
    assert.deepEqual(origins.at(-1), { x: 120, y: 160 }, 'accessibility activation starts at the pressed button center');
    fail = true; await act(() => buttons[0].props.onPress({ nativeEvent: { pageX: 20, pageY: 30 } }));
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
  const photo = { uri: 'file:///private/photo.jpg' };
  const rosewaterRoad = asset('../assets/theme-rosewater-road-v1.png');
  const rosewaterMemory = asset('../assets/theme-rosewater-memory-v1.png');
  const rosewaterJourney = asset('../assets/theme-rosewater-journey-v1.png');
  for (const file of ['cinematic-settings-photo-v1.jpg', 'cinematic-soundtracks-photo-v1.jpg', 'cinematic-home-main-photo-v1.jpg', 'cinematic-statistics-photo-v1.jpg']) assert.equal(resolve(asset(`../assets/${file}`), 'sakura'), rosewaterRoad);
  for (const file of ['cinematic-memory-polaroids-photo-v1.jpg', 'cinematic-memories-polaroids-photo-v1.jpg']) assert.equal(resolve(asset(`../assets/${file}`), 'sakura'), rosewaterMemory);
  for (const file of ['cinematic-journey-photo-v1.jpg', 'cinematic-home-morning-photo-v1.jpg', 'cinematic-home-afternoon-photo-v1.jpg', 'cinematic-home-evening-photo-v1.jpg', 'cinematic-home-night-photo-v1.jpg']) assert.equal(resolve(asset(`../assets/${file}`), 'sakura'), rosewaterJourney);

  const grandTouringTabs = [
    ['cinematic-home-main-photo-v1.jpg', 'theme-grand-touring-home-v1.png'],
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
    'theme-grand-touring-home-v1.png',
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
