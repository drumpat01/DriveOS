import assert from 'node:assert/strict';
import test from 'node:test';
import { themeCatalog } from '../src/theme-catalog.ts';
import {
  journeyDeckElevation,
  journeyDeckRadius,
  journeyDeckSemanticColors,
  journeyDeckSpacing,
  journeyDeckTypography,
} from '../src/journeydeck-design-tokens.ts';

test('shared roadbook scales stay locked and semantic', () => {
  assert.deepEqual(Object.values(journeyDeckSpacing), [4, 8, 12, 16, 20, 24, 32, 48]);
  assert.deepEqual(Object.values(journeyDeckRadius), [12, 16, 20, 24, 28, 999]);
  assert.equal(journeyDeckTypography.body.lineHeight, 21);
  assert.equal(journeyDeckTypography.metric.fontFamily, 'Georgia');
  assert.match(String(journeyDeckElevation.raised.boxShadow), /rgba/);
});

test('Grand Touring and Warm Ivory expose distinct interaction accents', () => {
  const grandTouring = journeyDeckSemanticColors('redline', themeCatalog.redline.palette);
  const warmIvory = journeyDeckSemanticColors('light', themeCatalog.light.palette);
  assert.equal(grandTouring.accent, '#d4b15a');
  assert.equal(grandTouring.onAccent, '#081832');
  assert.equal(warmIvory.accent, '#b94f3d');
  assert.equal(warmIvory.onAccent, '#ffffff');
  assert.notEqual(warmIvory.accent, themeCatalog.light.palette.accent, 'plum remains decorative rather than the primary action color');
});
