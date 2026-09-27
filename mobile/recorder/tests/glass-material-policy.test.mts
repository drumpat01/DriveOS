import assert from 'node:assert/strict';
import test from 'node:test';
import { glassMaterialSpec, type GlassRole } from '../src/glass-material-policy.ts';
import { themeCatalog } from '../src/theme-catalog.ts';

const aurora = themeCatalog['aurora-glass'].palette;
const liquid = { glassApiAvailable: true, liquidGlassAvailable: true, reduceTransparency: false };
const roles: GlassRole[] = ['clear', 'frosted', 'sheet', 'primary'];
const alphaOf = (color: string) => parseInt(color.slice(7, 9), 16) / 255;

test('Aurora roles use live glass when available and blur plus tint on older systems', () => {
  for (const role of roles) {
    assert.equal(glassMaterialSpec(role, aurora, liquid).mode, 'glass');
    assert.equal(glassMaterialSpec(role, aurora, { ...liquid, liquidGlassAvailable: false }).mode, 'blur');
  }
  assert.equal(glassMaterialSpec('clear', aurora, liquid).glassEffectStyle, 'clear');
  assert.equal(glassMaterialSpec('frosted', aurora, liquid).glassEffectStyle, 'regular');
});

test('clear controls stay lighter than frosted content, and sheets are the calmest', () => {
  const tint = (role: GlassRole) => alphaOf(glassMaterialSpec(role, aurora, liquid).tintColor);
  assert.ok(tint('clear') < tint('frosted'));
  assert.ok(tint('frosted') < tint('sheet'));
  assert.ok(glassMaterialSpec('clear', aurora, liquid).blurIntensity < glassMaterialSpec('frosted', aurora, liquid).blurIntensity);
});

test('mint belongs only to the primary role, with dark content for legibility', () => {
  const primary = glassMaterialSpec('primary', aurora, liquid);
  assert.ok(primary.tintColor.startsWith(aurora.accent));
  assert.equal(primary.contentColor, aurora.onAccent);
  for (const role of ['clear', 'frosted', 'sheet'] as const) {
    const spec = glassMaterialSpec(role, aurora, liquid);
    assert.ok(!spec.tintColor.startsWith(aurora.accent), `${role} must not tint with mint`);
    assert.ok(!spec.borderColor.startsWith(aurora.accent), `${role} must not outline with mint`);
    assert.equal(spec.contentColor, aurora.text);
  }
});

test('Reduce Transparency uses solid palette surfaces for every role', () => {
  for (const role of roles) {
    const spec = glassMaterialSpec(role, aurora, { ...liquid, reduceTransparency: true });
    assert.equal(spec.mode, 'opaque');
    assert.match(spec.fallbackColor, /^#[\da-f]{6}$/i, `${role} fallback is fully opaque`);
  }
  assert.equal(glassMaterialSpec('primary', aurora, { ...liquid, reduceTransparency: true }).fallbackColor, aurora.accent);
  assert.equal(glassMaterialSpec('frosted', aurora, { ...liquid, reduceTransparency: true }).fallbackColor, aurora.card);
});

test('Increase Contrast strengthens tints and edges without changing the role', () => {
  for (const role of roles) {
    const normal = glassMaterialSpec(role, aurora, liquid);
    const strong = glassMaterialSpec(role, aurora, { ...liquid, increaseContrast: true });
    assert.ok(alphaOf(strong.tintColor) >= 0.81, 'tint reaches ~82% (one hex byte of rounding)');
    assert.ok(alphaOf(strong.borderColor) >= alphaOf(normal.borderColor));
    assert.equal(strong.glassEffectStyle, normal.glassEffectStyle);
  }
});
