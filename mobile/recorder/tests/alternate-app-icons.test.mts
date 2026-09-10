import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';
import { appIconCatalog, appIconIdForNativeName, parseAppIconId } from '../src/app-icon-catalog.ts';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const plugin = require('../plugins/with-alternate-app-icons.js');
const root = fileURLToPath(new URL('../', import.meta.url));

test('app icon choices keep stable persisted IDs and distinct native names', () => {
  assert.equal(parseAppIconId('rosewater'), 'rosewater');
  assert.equal(parseAppIconId('grand-touring'), 'grand-touring');
  assert.equal(parseAppIconId('warm-ivory'), 'warm-ivory');
  assert.equal(parseAppIconId('unknown'), 'original');
  assert.equal(appIconIdForNativeName(null), 'original');
  assert.equal(appIconIdForNativeName('JourneyDeckWarmIvory'), 'warm-ivory');
  assert.equal(appIconIdForNativeName('JourneyDeckRosewater'), 'rosewater');
  assert.equal(appIconIdForNativeName('JourneyDeckGrandTouring'), 'grand-touring');
  assert.equal(new Set(Object.values(appIconCatalog).map(icon => icon.nativeName)).size, 4);
});

test('iOS host target declares every alternate app icon set', () => {
  const project = xcode.project(join(root, 'node_modules/react-native-view-shot/ios/RNViewShot.xcodeproj/project.pbxproj'));
  project.parseSync();
  plugin.configureAlternateIconBuildSettings(project);
  plugin.configureAlternateIconBuildSettings(project);
  const host = project.getFirstTarget().firstTarget;
  const list = project.pbxXCConfigurationList()[host.buildConfigurationList];
  for (const { value } of list.buildConfigurations) {
    const settings = project.pbxXCBuildConfigurationSection()[value].buildSettings;
    assert.equal(settings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES, '"JourneyDeckWarmIvory JourneyDeckRosewater JourneyDeckGrandTouring"');
    assert.equal(settings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS, 'YES');
  }
});

test('alternate icon assets are build-ready 1024px opaque iOS app icon sets', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'journeydeck-alternate-icons-'));
  try {
    await plugin.writeAlternateIconAssets(root, directory);
    for (const icon of plugin.alternateIcons) {
      const catalogRoot = join(directory, `${icon.name}.appiconset`);
      const catalog = JSON.parse(readFileSync(join(catalogRoot, 'Contents.json'), 'utf8'));
      assert.deepEqual(catalog.images, [{ filename: `${icon.name}.png`, idiom: 'universal', platform: 'ios', size: '1024x1024' }]);
      const generated = join(catalogRoot, catalog.images[0].filename);
      const png = readFileSync(generated);
      assert.equal(png.readUInt32BE(16), 1024);
      assert.equal(png.readUInt32BE(20), 1024);
      const decoded = await require('@expo/image-utils').getPngInfo(generated);
      for (let alpha = 3; alpha < decoded.data.length; alpha += 4) {
        assert.equal(decoded.data[alpha], 255, `${icon.name} must be opaque`);
      }
    }
  } finally {
    const resolved = resolve(directory);
    assert.ok(resolved.startsWith(resolve(tmpdir()) + require('node:path').sep));
    rmSync(resolved, { recursive: true });
  }
});

test('icon preference is stored separately from appearance', () => {
  const icons = readFileSync(join(root, 'src/app-icon-preference.tsx'), 'utf8');
  const themes = readFileSync(join(root, 'src/app-theme.tsx'), 'utf8');
  assert.match(icons, /journeydeck\.app-icon\.v1/);
  assert.match(themes, /journeydeck\.appearance\.v2/);
  assert.doesNotMatch(icons, /setTheme|useThemeChoice/);
});
