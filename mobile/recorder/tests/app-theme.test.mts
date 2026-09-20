import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ivoryPalette, themedColor, themedGradient, themedStyleSheet } from '../src/theme-palette.ts';
import { journeyDeckMapPalette, themeJourneyDeckMapStyle } from '../src/journey-map-theme.ts';

test('dark mode preserves existing colors and style objects without mutation', () => {
  const styles = { card: { backgroundColor: '#08070d', color: '#fff', padding: 20, borderRadius: 24, shadowColor: '#a85cff', transform: [{ scale: 0.98 }] } };
  assert.equal(themedStyleSheet(styles, 'dark'), styles);
  for (const value of ['#fff', '#08070d', 'rgba(25,11,35,0.99)', 'transparent', 'url(#navChromeFill)']) {
    for (const role of ['text', 'surface', 'border', 'accent', 'shadow'] as const) assert.equal(themedColor(value, 'dark', role), value);
  }
  assert.deepEqual(themedGradient(['#ff795b', '#ff376f'], 'dark'), ['#ff795b', '#ff376f']);
});

test('ivory mode changes only color properties, retaining layout, typography and motion', () => {
  const styles = { title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2 }, card: { padding: 20, gap: 12, backgroundColor: '#08070d', borderColor: '#3c2055', transform: [{ scale: 0.98 }] } };
  const original = structuredClone(styles);
  const light = themedStyleSheet(styles, 'light');
  assert.deepEqual(styles, original);
  assert.equal(light.card.backgroundColor, ivoryPalette.page);
  assert.equal(light.title.color, ivoryPalette.text);
  assert.notEqual(light.card.borderColor, styles.card.borderColor);
  for (const key of Object.keys(styles) as (keyof typeof styles)[]) {
    const nonColors = (style: object) => Object.fromEntries(Object.entries(style).filter(([name]) => !/color$/i.test(name)));
    assert.deepEqual(nonColors(light[key]), nonColors(styles[key]));
  }
});

test('light text colors have readable contrast against the ivory surfaces', () => {
  const luminance = (hex: string) => {
    const channel = (offset: number) => { const v = parseInt(hex.slice(offset, offset + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
  };
  for (const background of [ivoryPalette.page, ivoryPalette.surface, ivoryPalette.inset, ivoryPalette.peach, ivoryPalette.lilac]) {
    for (const foreground of [ivoryPalette.text, ivoryPalette.secondary, ivoryPalette.plum, ivoryPalette.coral, ivoryPalette.blue, ivoryPalette.green, ivoryPalette.violet]) {
      const ratio = (luminance(background) + 0.05) / (luminance(foreground) + 0.05);
      assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}`);
    }
  }
});

test('surface fades preserve transparency and SVG references remain intact', () => {
  assert.equal(themedColor('rgba(5,3,11,0)', 'light', 'surface'), 'rgba(255,250,240,0)');
  assert.equal(themedColor('rgba(5,3,11,0.72)', 'light', 'surface'), 'rgba(255,250,240,0.72)');
  assert.equal(themedColor('url(#route)', 'light'), 'url(#route)');
  assert.equal(themedColor('transparent', 'light'), 'transparent');
});

test('light map palette preserves sources, geometry definitions and filters', () => {
  const input = { version: 8, sources: { streets: { type: 'vector', url: 'fixture://streets' } }, layers: [
    { id: 'background', type: 'background', paint: {} },
    { id: 'water', type: 'fill', source: 'streets', filter: ['==', 'class', 'water'], paint: {} },
    { id: 'place-label', type: 'symbol', source: 'streets', layout: { 'text-field': '{name}' }, paint: {} },
  ] };
  const original = structuredClone(input);
  const light = themeJourneyDeckMapStyle(input, 'light')!;
  assert.deepEqual(input, original);
  assert.equal(light.sources, input.sources);
  assert.deepEqual(light.layers[1].filter, input.layers[1].filter);
  assert.deepEqual(light.layers[2].layout, input.layers[2].layout);
  assert.equal(light.layers[0].paint?.['background-color'], ivoryPalette.page);
  assert.equal(light.layers[1].paint?.['fill-color'], '#c8dce2');
  assert.equal(themeJourneyDeckMapStyle(input)?.layers[0].paint?.['background-color'], '#010104');
});

test('Grand Touring maps use a navy basemap, white roads and one glowing champagne route palette', () => {
  const input = { version: 8, layers: [
    { id: 'background', type: 'background', paint: {} },
    { id: 'road-primary', type: 'line', paint: {} },
    { id: 'road-secondary', type: 'line', paint: {} },
    { id: 'water', type: 'fill', paint: {} },
  ] };
  const result = themeJourneyDeckMapStyle(input, 'redline')!;
  assert.equal(result.layers[0].paint?.['background-color'], '#081832');
  assert.equal(result.layers[1].paint?.['line-color'], '#f6f0e2');
  assert.equal(result.layers[2].paint?.['line-color'], '#b6bfcc');
  assert.equal(result.layers[3].paint?.['fill-color'], '#07152c');
  assert.deepEqual(journeyDeckMapPalette('redline'), {
    routeGlow: '#f4c94f', routeShadow: '#6e5518', routeLine: '#e5bd4f',
  });
});

test('public V2 remains an ordinary App Store update; only internal preview changes identity', () => {
  const require = createRequire(import.meta.url);
  const config = require('../app.json').expo;
  const resolve = require('../app.config.js');
  const previousVariant = process.env.APP_VARIANT, previousProfile = process.env.EAS_BUILD_PROFILE;
  try {
    delete process.env.APP_VARIANT;
    process.env.EAS_BUILD_PROFILE = 'production';
    const production = resolve({ config });
    assert.equal(production.name, config.name);
    assert.equal(production.ios.bundleIdentifier, config.ios.bundleIdentifier);
    assert.equal(production.scheme, config.scheme);
    assert.deepEqual(production.ios.entitlements, config.ios.entitlements);
    assert.equal(production.ios.infoPlist.UIViewControllerBasedStatusBarAppearance, true);
    assert.ok(production.plugins.includes('./plugins/with-alternate-app-icons'));
    process.env.EAS_BUILD_PROFILE = 'v2-preview';
    process.env.APP_VARIANT = 'v2-preview';
    const preview = resolve({ config });
    assert.equal(preview.extra.features.atlasUnlocked, false);
    assert.notEqual(preview.ios.bundleIdentifier, production.ios.bundleIdentifier);
    assert.notEqual(preview.scheme, production.scheme);
    assert.notEqual(preview.runtimeVersion, production.runtimeVersion);
    assert.notDeepEqual(preview.ios.entitlements['com.apple.developer.icloud-container-identifiers'], production.ios.entitlements['com.apple.developer.icloud-container-identifiers']);
    assert.equal(production.extra.features.atlasUnlocked, false);
  } finally {
    if (previousVariant === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = previousVariant;
    if (previousProfile === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = previousProfile;
  }
});

test('theme switching does not remount the recorder or change exported card styling', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../src/app-theme.tsx', import.meta.url), 'utf8');
  const share = readFileSync(new URL('../src/share-card-modal.tsx', import.meta.url), 'utf8');
  assert.match(app, /<AppThemeProvider><AppIconProvider><CardMotionProvider><JourneyDeckShell recorder=\{RecorderScreen\}><JourneyDeckNativeStack \/><\/JourneyDeckShell><\/CardMotionProvider><\/AppIconProvider><\/AppThemeProvider>/);
  assert.doesNotMatch(theme, /key=\{|delete.*Database|clear.*Cache/);
  assert.match(theme, /useState<ThemeId>\(readTheme\)/);
  assert.match(theme, /SecureStore\.setItem\(THEME_KEY, next\);\s*setState\(next\)/);
  assert.match(share, /const uiStyles = useThemedStyles\(styles\)/);
  const preview = share.slice(share.indexOf('const JourneySharePreview'), share.indexOf('function JourneyShareControls'));
  assert.doesNotMatch(preview, /useThemedStyles|useAppTheme|uiStyles/);
  assert.match(share, /ref=\{cardRef\} collapsable=\{false\} style=\{styles.card\}/);
});
