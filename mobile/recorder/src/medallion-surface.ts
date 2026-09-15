export type MedallionFrame = { x: number; y: number; width: number; height: number };
export const DEFAULT_MEDALLION_FRAME: MedallionFrame = { x: 0.02, y: 0.02, width: 0.96, height: 0.96 };

/** Locate the gold perimeter of authored orthographic faces, excluding the backdrop. */
export function findMedallionFrame(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number): MedallionFrame {
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (pixels[i + 3] < 128 || r < 110 || r - b < 25 || g < r * 0.64 || g > r * 0.98) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right - left < width * 0.7 || bottom - top < height * 0.7) throw new Error('Missing complete gold face perimeter');
  const inset = Math.max(1, Math.round(Math.min(width, height) * 0.001));
  // Authored circles vary slightly from perfect ellipses. Stay inside their
  // irregular outer paint edge; the physical metal lip supplies the perimeter.
  // Audited at 1,440 angles on all 40 faces, with a ~4px filtering margin.
  const cropWidth = (right - left + 1 - 2 * inset) * 0.975;
  const cropHeight = (bottom - top + 1 - 2 * inset) * 0.975;
  return { x: ((left + right + 1) / 2 - cropWidth / 2) / width,
    y: ((top + bottom + 1) / 2 - cropHeight / 2) / height,
    width: cropWidth / width, height: cropHeight / height };
}

/** CPU blur has identical behavior on Safari and Chromium; no Canvas.filter dependency. */
export function smoothField(input: Float32Array, width: number, height: number, radius = 3, passes = 2) {
  let source = input.slice();
  const temporary = new Float32Array(source.length), output = new Float32Array(source.length), span = radius * 2 + 1;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let dx = -radius; dx <= radius; dx++) sum += source[y * width + Math.max(0, Math.min(width - 1, dx))];
      for (let x = 0; x < width; x++) {
        temporary[y * width + x] = sum / span;
        sum += source[y * width + Math.min(width - 1, x + radius + 1)] - source[y * width + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) sum += temporary[Math.max(0, Math.min(height - 1, dy)) * width + x];
      for (let y = 0; y < height; y++) {
        output[y * width + x] = sum / span;
        sum += temporary[Math.min(height - 1, y + radius + 1) * width + x] - temporary[Math.max(0, y - radius) * width + x];
      }
    }
    source = output.slice();
  }
  return source;
}

/** Restrained material engraving normals; these never displace the physical face. */
export function engravedNormals(field: Float32Array, width: number, height: number) {
  const normal = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const dx = field[y * width + Math.min(width - 1, x + 1)] - field[y * width + Math.max(0, x - 1)];
    const dy = field[Math.min(height - 1, y + 1) * width + x] - field[Math.max(0, y - 1) * width + x];
    const nx = Math.max(-0.14, Math.min(0.14, -dx * 1.6)), ny = Math.max(-0.14, Math.min(0.14, dy * 1.6));
    const length = Math.hypot(nx, ny, 1);
    normal[i * 4] = Math.round((nx / length * 0.5 + 0.5) * 255);
    normal[i * 4 + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
    normal[i * 4 + 2] = Math.round((1 / length * 0.5 + 0.5) * 255); normal[i * 4 + 3] = 255;
  }
  return normal;
}
