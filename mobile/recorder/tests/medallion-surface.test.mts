import assert from 'node:assert/strict';
import test from 'node:test';
import { findMedallionFrame, smoothField, engravedNormals } from '../src/medallion-surface.ts';

function close(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

function framedPixels(width: number, height: number, centerX: number, centerY: number, radius: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    // An opaque checkerboard reproduces generation backgrounds that alpha cannot locate.
    const gray = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 190 : 245;
    pixels.set([gray, gray, gray, 255], i);
    const distance = Math.hypot(x - centerX, y - centerY);
    if (distance < radius - 0.55) pixels.set([24, 30, 65, 255], i);
    if (Math.abs(distance - radius) <= 0.55) pixels.set([230, 181, 61, 255], i);
  }
  // Transparent golden RGB must not expand the detected face back to a square.
  pixels.set([230, 181, 61, 0], 0);
  pixels.set([230, 181, 61, 0], pixels.length - 4);
  return pixels;
}

test('gold perimeter detection excludes opaque checkerboard and transparent corner color', () => {
  const width = 120, height = 120;
  const frame = findMedallionFrame(framedPixels(width, height, 60, 60, 52), width, height);
  close(frame.x + frame.width / 2, 60.5 / width);
  close(frame.y + frame.height / 2, 60.5 / height);
  close(frame.width * width, frame.height * height);
  assert.ok(frame.x > 0.05 && frame.y > 0.05, 'backdrop does not become part of the circular face');
  assert.ok(frame.width > 0.83 && frame.width < 0.85, 'retain the face while leaving a small margin inside an irregular painted perimeter');
});

test('an off-center circle on a rectangular source gets a square pixel crop around its own center', () => {
  const width = 132, height = 112;
  const frame = findMedallionFrame(framedPixels(width, height, 72, 56, 48), width, height);
  close(frame.x * width + frame.width * width / 2, 72.5);
  close(frame.y * height + frame.height * height / 2, 56.5);
  close(frame.width * width, frame.height * height);
  assert.ok(frame.x > 0 && frame.y > 0 && frame.x + frame.width < 1 && frame.y + frame.height < 1);
});

test('missing or incomplete gold perimeter fails rather than selecting interior highlights', () => {
  const pixels = new Uint8Array(100 * 100 * 4);
  assert.throws(() => findMedallionFrame(pixels, 100, 100), /Missing complete gold face perimeter/);
  for (let y = 35; y < 65; y++) for (let x = 35; x < 65; x++) pixels.set([230, 181, 61, 255], (y * 100 + x) * 4);
  assert.throws(() => findMedallionFrame(pixels, 100, 100), /Missing complete gold face perimeter/);
});

test('CPU smoothing preserves a constant field and leaves its input untouched', () => {
  const field = new Float32Array(7 * 3).fill(0.37), before = field.slice();
  const smoothed = smoothField(field, 7, 3, 4, 3);
  assert.notEqual(smoothed, field);
  assert.deepEqual(field, before);
  for (const value of smoothed) close(value, field[0]);
});

test('CPU smoothing clamps edges without wrapping or creating a dark border', () => {
  const horizontal = smoothField(new Float32Array([1, 0, 0, 0, 0]), 5, 1, 1, 1);
  const vertical = smoothField(new Float32Array([1, 0, 0, 0, 0]), 1, 5, 1, 1);
  [2 / 3, 1 / 3, 0, 0, 0].forEach((expected, i) => { close(horizontal[i], expected); close(vertical[i], expected); });
  const step = smoothField(new Float32Array([0, 0, 1, 1, 1]), 5, 1, 1, 1);
  [0, 1 / 3, 2 / 3, 1, 1].forEach((expected, i) => close(step[i], expected));
});

test('constant material fields produce neutral opaque normals at every edge', () => {
  const normals = engravedNormals(new Float32Array(4 * 3).fill(0.6), 4, 3);
  for (let i = 0; i < normals.length; i += 4) assert.deepEqual(Array.from(normals.slice(i, i + 4)), [128, 128, 255, 255]);
});

test('engraving normals follow slope direction but remain shallow even across sharp highlights', () => {
  const field = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1, 1]), before = field.slice();
  const normals = engravedNormals(field, 3, 3);
  assert.deepEqual(field, before);
  assert.ok(normals[(0 * 3 + 1) * 4] < 128, 'rising horizontal image values tilt in negative tangent X');
  assert.ok(normals[(1 * 3 + 0) * 4 + 1] > 128, 'image Y is converted to the texture tangent direction');
  for (let i = 0; i < normals.length; i += 4) {
    const x = normals[i] / 255 * 2 - 1, y = normals[i + 1] / 255 * 2 - 1, z = normals[i + 2] / 255 * 2 - 1;
    assert.ok(Math.abs(x) <= 0.15 && Math.abs(y) <= 0.15 && z >= 0.97, 'high-contrast albedo must not create steep lighting normals');
    close(Math.hypot(x, y, z), 1, 0.01);
    assert.equal(normals[i + 3], 255);
  }
});
