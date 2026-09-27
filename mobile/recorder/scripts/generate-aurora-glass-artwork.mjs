// Regenerates the bundled Aurora Glass theme artwork from the shared procedural scene.
// Run from mobile/recorder: node scripts/generate-aurora-glass-artwork.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { auroraSceneSvg, SCENE_HEIGHT, SCENE_WIDTH } from './aurora-glass-scene.mjs';

const SCALE = 3; // 1170x2532: iPhone @3x portrait; iPad and banners crop with cover.
const out = name => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE_WIDTH * SCALE}" height="${SCENE_HEIGHT * SCALE}" viewBox="0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}">${auroraSceneSvg()}</svg>`);

const scene = await sharp(svg).png().toBuffer();
await sharp(scene).jpeg({ quality: 88, mozjpeg: true }).toFile(out('theme-aurora-glass-scene-v1.jpg'));

// Memories, Settings and other dense screens: heavily blurred and dimmed so only colour washes remain.
const dim = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE_WIDTH * SCALE}" height="${SCENE_HEIGHT * SCALE}"><rect width="100%" height="100%" fill="#02050d" fill-opacity="0.3"/></svg>`);
const soft = await sharp(scene).blur(14 * SCALE).png().toBuffer();
await sharp(soft).composite([{ input: dim }]).jpeg({ quality: 86, mozjpeg: true }).toFile(out('theme-aurora-glass-scene-soft-v1.jpg'));

console.log('theme-aurora-glass-scene-v1.jpg, theme-aurora-glass-scene-soft-v1.jpg');
