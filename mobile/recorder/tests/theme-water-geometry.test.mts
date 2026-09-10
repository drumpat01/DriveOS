import assert from 'node:assert/strict';
import test from 'node:test';
import { waterRippleGeometry } from '../src/theme-water-geometry.ts';

test('water geometry maps the window tap locally and covers every corner', () => {
  const frame = { x: 28, y: 64, width: 390, height: 844 };
  const geometry = waterRippleGeometry(frame, { x: 128, y: 264 });
  assert.deepEqual(geometry.origin, [100, 200]);
  for (const [x, y] of [[0, 0], [390, 0], [0, 844], [390, 844]]) {
    assert.ok(Math.hypot(x - 100, y - 200) <= geometry.radius);
  }
  assert.deepEqual(waterRippleGeometry(frame, { x: NaN, y: Infinity }).origin, [195, 422]);
  assert.deepEqual(waterRippleGeometry(frame, { x: -1, y: 1000 }).origin, [0, 844]);
});
