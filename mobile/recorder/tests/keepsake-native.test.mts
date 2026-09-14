import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, projectRoot), 'utf8');

test('the approved medallions are backed by a pinned Minted native module', async () => {
  const [config, podspec, swift] = await Promise.all([
    read('modules/journeydeck-keepsakes/expo-module.config.json'),
    read('modules/journeydeck-keepsakes/ios/JourneyDeckKeepsakes.podspec'),
    read('modules/journeydeck-keepsakes/ios/JourneyDeckKeepsakesModule.swift'),
  ]);

  assert.deepEqual(JSON.parse(config).apple?.modules, ['JourneyDeckKeepsakesModule']);
  assert.match(podspec, /:ios => '17\.0'/);
  assert.match(podspec, /github\.com\/haplollc\/Minted\.git/);
  assert.match(podspec, /kind: 'exactVersion', version: '1\.1\.1'/);
  assert.match(podspec, /products: \['Minted'\]/);
  assert.match(swift, /import Minted/);
  assert.match(swift, /ArtworkCoin\(image: image\)/);
  assert.match(swift, /ArtworkCoinScene\.makeScene\(coin: coin, gold: gold\)/);
  assert.match(swift, /Constant\("assetCatalogVersion"\) \{ 3 \}/);
  assert.match(swift, /node\?\.eulerAngles\.y = 0/);
  assert.match(swift, /required init\(appContext: AppContext\? = nil\)/);
  assert.match(swift, /Prop\("artworkUri"\)/);
  assert.match(swift, /url\.isFileURL/);
  assert.doesNotMatch(swift, /private static let achievements/);
  assert.match(swift, /Drag left or right to rotate the medallion/);
});

test('all 24 theme faces stay in the OTA artwork catalog instead of the native bundle', async () => {
  const designs = {
    'first-track': ['the-first-track/option-01-theme-variants', 'first-track'],
    'road-regular': ['road-regular/option-06-theme-variants', 'road-regular'],
    'century-road': ['century-road/option-01-theme-variants', 'century-road'],
    'soundtrack-100': ['soundtrack-100/option-01-theme-variants', 'soundtrack-100'],
    'long-way-home': ['long-way-home/option-07-theme-variants', 'long-way-home'],
    'memory-maker': ['memory-maker/option-08-theme-variants', 'memory-maker'],
  } as const;
  const themes = { redline: 'grand-touring', sakura: 'rosewater', dark: 'cinematic-dark', light: 'warm-ivory' } as const;
  for (const [id, [directory, prefix]] of Object.entries(designs)) for (const [themeId, sourceTheme] of Object.entries(themes)) {
    const fallbackArtwork = new URL(`assets/medallion-concepts/${directory}/${prefix}-${sourceTheme}.png`, projectRoot);
    const [fallbackBytes, fallbackInfo] = await Promise.all([readFile(fallbackArtwork), stat(fallbackArtwork)]);
    assert.deepEqual([...fallbackBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(fallbackInfo.size > 100_000, `${id}-${themeId} should retain production artwork detail`);
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

  assert.match(bridge, /requireNativeView/);
  assert.match(bridge, /assetCatalogVersion/);
  assert.match(bridge, /from 'expo-asset'/);
  assert.match(bridge, /Asset\.fromModule\(artworkSource\)\.downloadAsync\(\)/);
  assert.match(bridge, /artworkUri=\{artworkUri\}/);
  assert.match(bridge, /JourneyDeckMedallion/);
  assert.match(bridge, /PanResponder\.create/);
  assert.match(bridge, /Animated\.spring/);
  assert.match(bridge, /from 'expo-image'/);
  assert.match(bridge, /aspectRatio: 1/);
  assert.match(bridge, /contentFit="cover"/);
  assert.match(bridge, /if \(NativeMedallion && artworkUri\) return <NativeMedallion/);
  assert.match(bridge, /goldBack/);
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
  assert.match(achievements, /snapPoints=\{\['half', 'full'\]\}/);
  assert.match(achievements, /Gesture\.Pan\(\)/);
  assert.match(achievements, /rotateY/);
  assert.match(achievements, />HOW</);
  assert.match(achievements, />WHEN</);
  assert.match(achievements, />WHY</);
  assert.match(achievements, /muted=\{!achievement\.earned\}/);
  assert.match(categories, /id: 'achievements', title: 'Achievements'/);
  assert.match(appConfig, /preview \? '2\.0\.0-preview\.12' : '2\.0\.0-watch\.7'/);
  assert.match(appConfig, /deploymentTarget: '17\.0'/);
});
