import assert from 'node:assert/strict';
import test from 'node:test';

import {
  circularPagerProgress,
  circularPagerTabIndex,
  circularPagerTransition,
  navigationGeometry,
  navigationIndexAtX,
  navigationIndicatorX,
  navigationProgressAtX,
  navigationTabX,
  tabPageMotion,
} from '../src/navigation-motion.ts';

const width = 390;
const count = 5;
const padding = 6;
const gap = 4;

function assertClose(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `expected ${actual} to be close to ${expected}`);
}

test('navigation geometry fits five equal items inside the glass track', () => {
  assert.deepEqual(navigationGeometry(width, count, padding, gap), {
    itemWidth: 72.4,
    stride: 76.4,
    minimumX: 6,
    maximumX: 311.6,
  });
});

test('indicator follows the finger continuously instead of jumping between tabs', () => {
  assertClose(navigationIndicatorX(42.2, width, count, padding, gap), 6);
  assertClose(navigationIndicatorX(100, width, count, padding, gap), 63.8);
  assertClose(navigationIndicatorX(150, width, count, padding, gap), 113.8);
  assertClose(navigationIndicatorX(347, width, count, padding, gap), 310.8);
});

test('selected tab changes at the midpoint while the indicator remains continuous', () => {
  assert.equal(navigationIndexAtX(80, width, count, padding, gap), 0);
  assert.equal(navigationIndexAtX(81, width, count, padding, gap), 1);
  assert.equal(navigationIndexAtX(156, width, count, padding, gap), 1);
  assert.equal(navigationIndexAtX(157, width, count, padding, gap), 2);
  assert.equal(navigationIndexAtX(390, width, count, padding, gap), 4);
});

test('release snap positions align with each tab', () => {
  [6, 82.4, 158.8, 235.2, 311.6].forEach((expected, index) => {
    assertClose(navigationTabX(index, width, count, padding, gap), expected);
  });
});

test('continuous navigation progress follows the pager between tabs', () => {
  assertClose(navigationProgressAtX(42.2, width, count, padding, gap), 0);
  assertClose(navigationProgressAtX(118.6, width, count, padding, gap), 1);
  assertClose(navigationProgressAtX(156.8, width, count, padding, gap), 1.5);
  assertClose(navigationProgressAtX(347.8, width, count, padding, gap), 4);
});

test('the circular pager uses one-step edge transitions in both directions', () => {
  assert.deepEqual(circularPagerTransition(0, 4, 5), { targetPosition: 0, canonicalSnapPosition: 5 });
  assert.deepEqual(circularPagerTransition(4, 0, 5), { targetPosition: 6, canonicalSnapPosition: 1 });
  assert.deepEqual(circularPagerTransition(1, 3, 5), { targetPosition: 4, canonicalSnapPosition: null });
  assert.deepEqual(circularPagerTransition(0, 4, 5, true), { targetPosition: 5, canonicalSnapPosition: null });
});

test('circular pager sentinels map back to canonical tabs and motion progress', () => {
  assert.equal(circularPagerTabIndex(0, 5), 4);
  assert.equal(circularPagerTabIndex(1, 5), 0);
  assert.equal(circularPagerTabIndex(3, 5), 2);
  assert.equal(circularPagerTabIndex(6, 5), 0);
  assert.equal(circularPagerProgress(0, 0), -1);
  assert.equal(circularPagerProgress(3, 0), 2);
  assert.equal(circularPagerProgress(6, 0), 5);
});

test('tab motion remains subtle and respects Reduce Motion', () => {
  assert.deepEqual(tabPageMotion(2, 2, false), { opacity: 1, scale: 1 });
  assert.deepEqual(tabPageMotion(1.5, 2, false), { opacity: 0.96, scale: 0.9925 });
  assert.deepEqual(tabPageMotion(0, 2, false), { opacity: 0.92, scale: 0.985 });
  assert.deepEqual(tabPageMotion(0, 2, true), { opacity: 1, scale: 1 });
});
