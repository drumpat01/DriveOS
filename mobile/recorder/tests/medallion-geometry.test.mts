import assert from 'node:assert/strict';
import test from 'node:test';
import { Raycaster, Vector3, Mesh, MeshBasicMaterial } from 'three';
import { createMedallionBody, createMedallionFace, FACE_Z, COIN_DEPTH, COIN_RADIUS,
  FACE_RADIUS, FACE_MAX_Z, LIP_Z, BODY_FIELD_Z, visibleArtworkBounds } from '../src/medallion-geometry.ts';

test('the face stays circular, above the metal field and below its protective lip', () => {
  const geometry = createMedallionFace();
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    assert.ok(Number.isFinite(x + y + z));
    assert.ok(Math.hypot(x, y) <= FACE_RADIUS + 1e-7, 'no square extends past the face');
    assert.ok(z > BODY_FIELD_Z, 'face stays above the flat metal backing');
    assert.ok(z < LIP_Z, 'engraved field never projects beyond its protective rim');
    assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  assert.ok(Math.abs(minZ - FACE_Z) < 1e-7);
  assert.ok(Math.abs(maxZ - FACE_MAX_Z) < 1e-7);
  assert.ok(maxZ - minZ > 0 && maxZ - minZ <= 0.012, 'minting stays within a shallow physical height budget');
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const ray = (x: number, y: number) => new Raycaster(new Vector3(x, y, 3), new Vector3(0, 0, -1)).intersectObject(mesh);
  assert.ok(ray(0.03, 0.01).length > 0, 'face triangles point toward viewer');
  assert.equal(ray(0.9, 0.9).length, 0, 'transparent PNG corners do not become geometry');
  geometry.dispose(); mesh.material.dispose();
});

test('body, backing and raised lips share one center and a modest thickness', () => {
  const geometry = createMedallionBody();
  const bounds = geometry.boundingBox!;
  const center = bounds.getCenter(new Vector3());
  assert.ok(center.length() < 1e-7, 'front/back have no offset from the rotation axis');
  assert.ok(Math.abs(bounds.max.x - COIN_RADIUS) < 1e-7);
  assert.ok(Math.abs(bounds.max.y - COIN_RADIUS) < 1e-7);
  assert.ok(Math.abs(bounds.max.z - LIP_Z) < 1e-7);
  assert.ok(Math.abs(bounds.max.z - bounds.min.z - COIN_DEPTH) < 1e-7);
  assert.ok(COIN_DEPTH >= 0.1 && COIN_DEPTH <= 0.15, 'coin thickness is 5–7.5% of its diameter');
  const material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  const front = new Raycaster(new Vector3(0.25, 0.1, 3), new Vector3(0, 0, -1)).intersectObject(mesh);
  const back = new Raycaster(new Vector3(0.25, 0.1, -3), new Vector3(0, 0, 1)).intersectObject(mesh);
  assert.ok(front.length && back.length, 'both faces close the solid coin');
  assert.ok(Math.abs(front[0].point.z - BODY_FIELD_Z) < 1e-7);
  assert.ok(Math.abs(back[0].point.z + BODY_FIELD_Z) < 1e-7);
  assert.ok(Math.abs(front[0].point.x - back[0].point.x) < 1e-7);
  geometry.dispose(); material.dispose();
});

test('painted highlights, black regions and noisy image values cannot change geometry', () => {
  const reference = createMedallionFace();
  for (const callback of [() => 0, () => 1, () => Number.NaN, () => { throw new Error('image callback must not run'); }]) {
    const geometry = createMedallionFace(callback);
    assert.deepEqual(geometry.getAttribute('position').array, reference.getAttribute('position').array);
    assert.deepEqual(geometry.getAttribute('normal').array, reference.getAttribute('normal').array);
    geometry.dispose();
  }
  reference.dispose();
});

test('the face has one welded center, no angular seam and smooth outward normals', () => {
  const geometry = createMedallionFace();
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const indices = geometry.getIndex()!;
  const seen = new Set<string>(), edgeUses = new Map<string, number>();
  let centerCount = 0;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const key = `${Math.round(x * 1e7)},${Math.round(y * 1e7)}`;
    assert.ok(!seen.has(key), 'coincident center/seam vertices must share their normal');
    seen.add(key);
    if (x === 0 && y === 0) centerCount++;
    const n = new Vector3(normal.getX(i), normal.getY(i), normal.getZ(i));
    assert.ok(Math.abs(n.length() - 1) < 1e-6 && n.z > 0.99, 'no lighting spikes or reversed normals');
  }
  assert.equal(centerCount, 1);
  for (let i = 0; i < indices.count; i += 3) {
    const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    const [a, b, c] = triangle.map(index => new Vector3().fromBufferAttribute(position, index));
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).z > 1e-10, 'every triangle has area and faces the viewer');
    for (let edge = 0; edge < 3; edge++) {
      const start = triangle[edge], end = triangle[(edge + 1) % 3];
      const key = start < end ? `${start},${end}` : `${end},${start}`;
      edgeUses.set(key, (edgeUses.get(key) || 0) + 1);
    }
  }
  for (const [key, count] of edgeUses) {
    assert.ok(count === 1 || count === 2, 'no overlapping/non-manifold triangles');
    if (count === 1) for (const index of key.split(',').map(Number)) {
      assert.ok(Math.abs(Math.hypot(position.getX(index), position.getY(index)) - FACE_RADIUS) < 1e-7,
        'the outer circle is the only open boundary; there is no radial lighting seam');
    }
  }
  geometry.dispose();
});

test('artwork normalization ignores transparent RGB and recenters uneven padding', () => {
  const width = 12, height = 10;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 2; y < 8; y++) for (let x = 4; x < 10; x++) data[(y * width + x) * 4 + 3] = 255;
  // Black transparent corners reproduce the input that broke Minted's RGB tracer.
  assert.deepEqual(visibleArtworkBounds(data, width, height), { x: 4, y: 2, size: 6 });
  data.fill(0);
  assert.throws(() => visibleArtworkBounds(data, width, height), /Empty medallion/);
});
