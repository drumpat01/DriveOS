import assert from 'node:assert/strict';
import test from 'node:test';

import {
  navigationGeometry,
  navigationIndexAtX,
  navigationIndicatorX,
  navigationTabX,
} from '../src/navigation-motion.ts';

const width = 390;
const count = 5;
const padding = 6;
const gap = 2;

test('navigation geometry fits five equal items inside the glass track', () => {
  assert.deepEqual(navigationGeometry(width, count, padding, gap), {
    itemWidth: 74,
    stride: 76,
    minimumX: 6,
    maximumX: 310,
  });
});

test('indicator follows the finger continuously instead of jumping between tabs', () => {
  assert.equal(navigationIndicatorX(43, width, count, padding, gap), 6);
  assert.equal(navigationIndicatorX(100, width, count, padding, gap), 63);
  assert.equal(navigationIndicatorX(150, width, count, padding, gap), 113);
  assert.equal(navigationIndicatorX(347, width, count, padding, gap), 310);
});

test('selected tab changes at the midpoint while the indicator remains continuous', () => {
  assert.equal(navigationIndexAtX(80, width, count, padding, gap), 0);
  assert.equal(navigationIndexAtX(82, width, count, padding, gap), 1);
  assert.equal(navigationIndexAtX(158, width, count, padding, gap), 2);
  assert.equal(navigationIndexAtX(390, width, count, padding, gap), 4);
});

test('release snap positions align with each tab', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(index => navigationTabX(index, width, count, padding, gap)), [6, 82, 158, 234, 310]);
});
