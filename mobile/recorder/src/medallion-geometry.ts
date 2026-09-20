import { BufferGeometry, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';

export const COIN_RADIUS = 1;
// At a 40 mm diameter these dimensions describe a 2.64 mm thick minted coin.
// The face rises by only 0.12 mm and always stays below the protective lip.
export const COIN_DEPTH = 0.132;
export const FACE_RADIUS = 0.958;
export const FACE_Z = 0.054;
export const RELIEF_DEPTH = 0.006;
export const FACE_MAX_Z = FACE_Z + RELIEF_DEPTH;
export const LIP_Z = COIN_DEPTH / 2;
export const BODY_FIELD_Z = 0.052;

/** A smooth, shallow field flowing into the rim; independent of painted light. */
export function medallionFaceHeight(radiusRatio: number) {
  const shoulder = Math.max(0, Math.min(1, (radiusRatio - 0.68) / 0.32));
  return FACE_Z + RELIEF_DEPTH * shoulder * shoulder * (3 - 2 * shoulder);
}

/**
 * Closed, concentric metal body with integral front/back lips and rolled edges.
 * LatheGeometry starts on the Y axis; rotate once so both faces share the
 * artwork's XY plane. The renderer must not add a second floating rim.
 */
export function createMedallionBody() {
  const frontProfile = [
    [0, BODY_FIELD_Z],
    [0.93, BODY_FIELD_Z],
    [0.948, BODY_FIELD_Z],
    [FACE_RADIUS, FACE_MAX_Z],
    [0.966, 0.063],
    [0.974, LIP_Z],
    [0.982, LIP_Z],
    [0.99, 0.062],
    [0.997, 0.055],
    [COIN_RADIUS, 0.046],
  ];
  const profile = [
    ...frontProfile.map(([radius, z]) => new Vector2(radius, -z)),
    ...frontProfile.toReversed().map(([radius, z]) => new Vector2(radius, z)),
  ];
  const geometry = new LatheGeometry(profile, 192);
  geometry.rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A single continuous coin face. The optional former height callback is
 * deliberately ignored: color/light in an illustration is not physical depth.
 * Fine authored engraving belongs in material normals, never a brightness mesh.
 */
export function createMedallionFace(_sampleHeight?: (u: number, v: number) => number) {
  // Dense radial tessellation prevents the shallow minted shoulder from
  // resolving into visible vertical facets when viewed edge-on.
  const rings = 96, segments = 256;
  const vertices: number[] = [0, 0, FACE_Z], uv: number[] = [0.5, 0.5], indices: number[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const r = ring / rings;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const x = r * Math.cos(angle), y = r * Math.sin(angle);
      vertices.push(x * FACE_RADIUS, y * FACE_RADIUS, medallionFaceHeight(r));
      uv.push((x + 1) / 2, (y + 1) / 2);
      const current = 1 + (ring - 1) * segments + segment;
      const next = 1 + (ring - 1) * segments + (segment + 1) % segments;
      if (ring === 1) indices.push(0, current, next);
      else {
        const previous = current - segments, previousNext = next - segments;
        indices.push(previous, current, next, previous, next, previousNext);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  // One center vertex and welded angular seam keep lighting continuous.
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function visibleArtworkBounds(data: Uint8ClampedArray, width: number, height: number) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right <= left || bottom <= top) throw new Error('Empty medallion artwork');
  const size = Math.max(right - left + 1, bottom - top + 1);
  return { x: (left + right + 1 - size) / 2, y: (top + bottom + 1 - size) / 2, size };
}
