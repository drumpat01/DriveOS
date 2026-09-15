import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { medallions } from '../web/medallions/catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
// These are the demo's exact dependency versions, isolated from the server and
// mobile app. Deployment serves the checked-in output without running a build.
const require = createRequire(path.join(root, 'tools/public-medallions/package.json'));
const esbuild = require('esbuild');
const sharp = require('sharp');
const artworkSource = process.argv[2];
const source = artworkSource ? path.resolve(artworkSource) : null;
const destination = path.join(root, 'web/assets/medallions');
const frames = JSON.parse(await fs.readFile(path.join(root, 'tools/public-medallions/source/frames.json'), 'utf8'));
await fs.mkdir(destination, { recursive: true });
await esbuild.build({
  absWorkingDir: root, entryPoints: ['tools/public-medallions/source/entry.ts'],
  outfile: 'web/medallions/viewer.js', bundle: true, minify: true,
  platform: 'browser', format: 'esm', target: ['safari17'], legalComments: 'eof',
  // Escape Three.js shader strings instead of emitting their whitespace as
  // physical template-literal lines in the checked-in JavaScript bundle.
  supported: { 'template-literal': false },
});
await fs.copyFile(path.resolve(path.dirname(require.resolve('three')), '../LICENSE'), path.join(root, 'web/medallions/THREE-LICENSE.txt'));
if (!source) {
  console.log('Built the public renderer. Existing web artwork is unchanged; supply an approved medallions-v2 directory to rebuild it.');
  process.exit(0);
}
let total = 0;
for (const { id } of medallions) {
  for (const theme of ['dark', 'redline', 'sakura', 'light']) {
    const key = `${id}-${theme}`;
    const input = path.join(source, 'runtime', `${key}.webp`);
    const metadata = await sharp(input).metadata();
    const frame = frames[key];
    const full = await sharp(input).webp({ quality: 90, effort: 6 }).toFile(path.join(destination, `${key}.webp`));
    // Normalize the approved crop before applying a circle, never expose the
    // generated backgrounds in thumbnails or the no-WebGL fallback.
    const thumbnail = await sharp(input).extract({
      left: Math.round(frame.x * metadata.width), top: Math.round(frame.y * metadata.height),
      width: Math.round(frame.width * metadata.width), height: Math.round(frame.height * metadata.height),
    }).resize(480, 480, { fit: 'fill' }).toBuffer();
    const mask = Buffer.from('<svg width="480" height="480"><circle cx="240" cy="240" r="240" fill="white"/></svg>');
    const thumb = await sharp(thumbnail).composite([{ input: mask, blend: 'dest-in' }])
      .webp({ quality: 86, effort: 6 }).toFile(path.join(destination, `${key}-thumb.webp`));
    total += full.size + thumb.size;
  }
}
console.log(`Built 40 medallion faces and thumbnails (${(total / 1024 / 1024).toFixed(1)} MiB), plus the shared 3D renderer.`);
