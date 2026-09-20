import assert from 'node:assert/strict';
import test from 'node:test';
import { WATER_CAPTURE_MAX_PIXELS, waterCaptureSize, waterRippleGeometry } from '../src/theme-water-geometry.ts';

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

test('water snapshots stay at logical resolution and large canvases are proportionally bounded', () => {
  assert.deepEqual(waterCaptureSize({ width: 390, height: 844 }), { width: 390, height: 844 });
  assert.deepEqual(waterCaptureSize({ width: 844.4, height: 389.6 }), { width: 844, height: 390 });
  const large = waterCaptureSize({ width: 2732, height: 2048 });
  assert.ok(large.width * large.height <= WATER_CAPTURE_MAX_PIXELS + large.width, 'rounding stays near the pixel budget');
  assert.ok(Math.abs((large.width / large.height) - (2732 / 2048)) < 0.002, 'downsampling preserves aspect ratio');
  assert.deepEqual(waterCaptureSize({ width: Number.NaN, height: 0 }), { width: 1, height: 1 });
});
