import assert from 'node:assert/strict';
import test from 'node:test';
import { themeCatalog, type ThemeId } from '../src/theme-catalog.ts';
import { journeyDeckSemanticColors } from '../src/journeydeck-design-tokens.ts';
import { redesignColors, withAlpha } from '../src/redesign-palette.ts';

const ids = Object.keys(themeCatalog) as ThemeId[];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('alpha helper only rewrites six-digit hex colors', () => {
  assert.equal(withAlpha('#102030', 0.5), '#10203080');
  assert.equal(withAlpha('#102030', 2), '#102030ff');
  assert.equal(withAlpha('rgba(0,0,0,0.2)', 0.5), 'rgba(0,0,0,0.2)');
});

test('every theme drives the redesign roles from its own palette', () => {
  for (const id of ids) {
    const { palette } = themeCatalog[id];
    const semantic = journeyDeckSemanticColors(id, palette);
    const colors = redesignColors(id, palette);
    assert.equal(colors.page, semantic.page, `${id} page`);
    assert.equal(colors.text, semantic.text, `${id} text`);
    assert.equal(colors.accent, semantic.accent, `${id} accent`);
    assert.equal(colors.onAccent, semantic.onAccent, `${id} onAccent`);
    assert.ok(Object.values(palette).includes(colors.highlight), `${id} highlight comes from the palette`);
    assert.notEqual(colors.highlight.toLowerCase(), colors.accent.toLowerCase(), `${id} highlight differs from the accent`);
    assert.notEqual(colors.highlight.toLowerCase(), colors.text.toLowerCase(), `${id} highlight differs from body text`);
    assert.ok(colors.photoScrim[3].startsWith(semantic.page), `${id} photo scrim fades into its own page`);
    assert.equal(colors.routes[0], semantic.accent);
  }
});

test('body text and accent buttons stay readable in every theme', () => {
  for (const id of ids) {
    const colors = redesignColors(id, themeCatalog[id].palette);
    assert.ok(contrast(colors.text, colors.page) >= 7, `${id} text on page`);
    assert.ok(contrast(colors.textSecondary, colors.page) >= 4.5, `${id} secondary text on page`);
    assert.ok(contrast(colors.onAccent, colors.accent) >= 4.5, `${id} label on accent button`);
  }
});

test('light themes use their own card surfaces while dark themes use translucent ink', () => {
  for (const id of ['light', 'sakura'] as const) {
    const semantic = journeyDeckSemanticColors(id, themeCatalog[id].palette);
    assert.ok(redesignColors(id, themeCatalog[id].palette).surface.startsWith(semantic.surfaceRaised), id);
  }
  for (const id of ['dark', 'redline', 'midnight-canopy', 'aurora-glass'] as const) {
    assert.ok(redesignColors(id, themeCatalog[id].palette).surface.startsWith('#ffffff'), id);
  }
});

test('redesigned screens take every color from the theme, never a literal', async () => {
  const { readFileSync } = await import('node:fs');
  const files = ['today-screen', 'soundtrack-screen', 'memories-library', 'memory-detail-v4', 'search-tab', 'recorder-accessory', 'redesign-ui', 'preferences-screen', 'memory-route-map', 'journey-detail-v4', 'journey-replay-card-v4', 'ask-journeydeck-v4', 'ask-chat-motion', 'glass-avatar', 'atlas-tab-v4'];
  for (const name of files) {
    const source = readFileSync(new URL(`../src/${name}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|'(white|black)'/i, `${name}.tsx must use theme colors`);
    assert.doesNotMatch(source, /theme\.color\(/, `${name}.tsx maps roles through redesign-palette, not ad-hoc recoloring`);
  }
});
