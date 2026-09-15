// Preserve authored pixels while reducing OTA size. Cropping is shared at render time.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets/medallions-v2');
const output = path.join(source, 'runtime');
fs.mkdirSync(output, { recursive: true });
const { findMedallionFrame } = require('../src/medallion-surface.ts');
(async () => {
  const files = fs.readdirSync(source).filter(name => name.endsWith('.png')).sort();
  if (files.length !== 40) throw new Error(`Expected all 40 authored faces, found ${files.length}`);
  const frames = {};
  let originalBytes = 0, runtimeBytes = 0;
  for (const name of files) {
    const file = path.join(source, name);
    const original = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (Math.min(original.info.width, original.info.height) < 1040) throw new Error(`Low resolution: ${name}`);
    const frame = findMedallionFrame(original.data, original.info.width, original.info.height);
    frames[name.slice(0, -4)] = frame;
    const target = path.join(output, name.replace('.png', '.webp'));
    await sharp(file).webp({ lossless: true, effort: 6 }).toFile(target);
    const decoded = await sharp(target).ensureAlpha().raw().toBuffer();
    // Transparent source RGB has no visible meaning; every visible pixel must be exact.
    for (let i = 0; i < original.data.length; i += 4) {
      if (decoded[i + 3] !== original.data[i + 3] || (original.data[i + 3] !== 0 &&
        (decoded[i] !== original.data[i] || decoded[i + 1] !== original.data[i + 1] || decoded[i + 2] !== original.data[i + 2]))) {
        throw new Error(`Pixel mismatch: ${name}`);
      }
    }
    originalBytes += fs.statSync(file).size;
    runtimeBytes += fs.statSync(target).size;
  }
  fs.writeFileSync(path.join(source, 'frames.json'), JSON.stringify(frames, null, 2) + '\n');
  console.log(JSON.stringify({ count: files.length, originalBytes, runtimeBytes, visiblePixelsLossless: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
