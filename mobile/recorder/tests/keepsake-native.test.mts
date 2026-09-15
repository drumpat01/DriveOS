import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';

const { PNG } = createRequire(import.meta.url)('pngjs');
const sharp = createRequire(import.meta.url)('sharp');

const projectRoot = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, projectRoot), 'utf8');

test('the approved medallions are backed by a pinned Minted native module', async () => {
  const [config, podspec, swift, bridge] = await Promise.all([
    read('modules/journeydeck-keepsakes/expo-module.config.json'),
    read('modules/journeydeck-keepsakes/ios/JourneyDeckKeepsakes.podspec'),
    read('modules/journeydeck-keepsakes/ios/JourneyDeckKeepsakesModule.swift'),
    read('modules/journeydeck-keepsakes/index.tsx'),
  ]);

  assert.deepEqual(JSON.parse(config).apple?.modules, ['JourneyDeckKeepsakesModule']);
  assert.match(podspec, /:ios => '17\.0'/);
  assert.match(podspec, /github\.com\/haplollc\/Minted\.git/);
  assert.match(podspec, /kind: 'exactVersion', version: '1\.1\.1'/);
  assert.match(podspec, /products: \['Minted'\]/);
  assert.match(swift, /import Minted/);
  // Build 28's native module is unchanged. The OTA bypasses its renderer.
  assert.match(swift, /Constant\("assetCatalogVersion"\) \{ 3 \}/);
  assert.doesNotMatch(bridge, /requireNativeView|JourneyDeckKeepsakesModule/);
  assert.match(bridge, /ExpoDomWebViewModule/);
  assert.match(swift, /node\?\.eulerAngles\.y = 0/);
  assert.match(swift, /required init\(appContext: AppContext\? = nil\)/);
  assert.match(swift, /Prop\("artworkUri"\)/);
  assert.match(swift, /url\.isFileURL/);
  assert.doesNotMatch(swift, /private static let achievements/);
  assert.match(swift, /Drag left or right to rotate the medallion/);
});

test('all 40 theme faces stay in the OTA artwork catalog instead of the native bundle', async () => {
  const ids = ['first-track', 'long-way-home', 'thousand-mile', 'grand-tourer', 'first-note', 'long-play', 'soundtrack-100', 'memory-maker', 'picture-this', 'story-collector'];
  const themes = ['redline', 'sakura', 'dark', 'light'];
  const frames = JSON.parse(await read('assets/medallions-v2/frames.json'));
  const catalog = await read('src/medallion-artwork.ts');
  assert.equal(Object.keys(frames).length, 40);
  for (const id of ids) for (const theme of themes) {
    const key = id + '-' + theme;
    const original = await readFile(new URL('assets/medallions-v2/' + key + '.png', projectRoot));
    const { width, height, data } = PNG.sync.read(original);
    assert.ok(width >= 1040 && height >= 1040, key + ' retains more than twice the original resolution');
    const runtime = await readFile(new URL('assets/medallions-v2/runtime/' + key + '.webp', projectRoot));
    const decoded = await sharp(runtime).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, width); assert.equal(decoded.info.height, height);
    // RGB under fully transparent pixels is intentionally undefined by WebP.
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) {
      data.fill(0, i, i + 3); decoded.data.fill(0, i, i + 3);
    }
    assert.equal(Buffer.compare(data, decoded.data), 0, key + ' lossless visible pixels');
    const frame = frames[key];
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= 1 && frame.y + frame.height <= 1, key + ' frame remains in source');
    assert.ok(frame.width > .85 && frame.height > .85 && frame.width <= 1 && frame.height <= 1, key + ' complete face crop');
    assert.ok(Math.abs(frame.width * width - frame.height * height) < width * .03, key + ' orthographic circle');
    assert.ok(catalog.includes('../assets/medallions-v2/runtime/' + key + '.webp'), key + ' uses recreated art');
  }
  const podspec = await read('modules/journeydeck-keepsakes/ios/JourneyDeckKeepsakes.podspec');
  assert.doesNotMatch(podspec, /resource_bundles/);
});

test('Achievements moves keepsakes out of Memories and into Settings', async () => {
  const [bridge, card, memories, achievements, categories, appConfig] = await Promise.all([
    read('modules/journeydeck-keepsakes/index.tsx'),
    read('src/first-journey-keepsake.tsx'),
    read('src/ipad-memories-screen.tsx'),
    read('src/achievements-overview.tsx'),
    read('src/settings-categories.ts'),
    read('app.config.js'),
  ]);

  assert.match(bridge, /requireOptionalNativeModule/);
  assert.match(bridge, /MedallionDOM/);
  assert.match(bridge, /from 'expo-asset'/);
  assert.match(bridge, /Asset\.fromModule\(source\)\.downloadAsync\(\)/);
  assert.match(bridge, /new File\(asset\.localUri\)\.base64\(\)/);
  assert.match(bridge, /JourneyDeckMedallion/);
  assert.match(bridge, /useMotionPreferences/);
  assert.match(bridge, /MedallionArtworkImage/);
  assert.match(bridge, /frame=\{frame\}/);
  assert.match(bridge, /useExpoDOMWebView: true/);
  assert.match(card, /FIRST RECORDED JOURNEY/);
  assert.match(card, /The First Track/);
  assert.match(card, /road story began with a soundtrack/);
  assert.match(card, /EARNED · JOURNEY 01/);
  assert.doesNotMatch(memories, /FirstJourneyKeepsake/);
  assert.match(memories, /accessibilityRole="link"/);
  assert.match(memories, /numberOfLines=\{1\} ellipsizeMode="tail"/);
  assert.match(achievements, /The First Track/);
  assert.match(achievements, /Memory Maker/);
  assert.match(achievements, /Grand Tourer/);
  assert.match(achievements, /<BottomSheet/);
  assert.match(achievements, /snapPoints=\{\['full'\]\}/);
  assert.match(achievements, /Gesture\.Pan\(\)/);
  assert.match(achievements, /rotateY/);
  assert.match(achievements, />HOW</);
  assert.match(achievements, />WHEN</);
  assert.match(achievements, />WHY</);
  assert.match(achievements, /muted=\{!achievement\.earned\}/);
  assert.match(categories, /id: 'achievements', title: 'Achievements'/);
  assert.match(appConfig, /preview \? '2\.0\.0-preview\.13' : '2\.0\.0-watch\.8'/);
  assert.match(appConfig, /deploymentTarget: '17\.0'/);
});
