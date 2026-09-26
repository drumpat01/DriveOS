const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');

const alternateIcons = [
  {
    name: 'JourneyDeckWarmIvory',
    source: 'assets/icon-warm-ivory-v2.png',
    darkSource: 'assets/icon-warm-ivory-dark-v1.png',
    backgroundColor: '#fffaf0',
  },
  {
    name: 'JourneyDeckRosewater',
    source: 'assets/icon-rosewater-v2.png',
    darkSource: 'assets/icon-rosewater-dark-v1.png',
    backgroundColor: '#fff4f7',
  },
  {
    name: 'JourneyDeckGrandTouring',
    source: 'assets/icon-grand-touring-v2.png',
    darkSource: 'assets/icon-grand-touring-dark-v1.png',
    backgroundColor: '#081832',
  },
  {
    name: 'JourneyDeckCinematic',
    source: 'assets/icon-cinematic-dark-v2.png',
    darkSource: 'assets/icon-cinematic-dark-appearance-v1.png',
    backgroundColor: '#08070d',
  },
  {
    name: 'JourneyDeckMidnightCanopy',
    source: 'assets/icon-midnight-canopy-v1.png',
    darkSource: 'assets/icon-midnight-canopy-dark-v1.png',
    backgroundColor: '#101a12',
    v3Only: true,
  },
];

function iconsForConfig(config) {
  const includeAutumnDrive = config?.extra?.features?.midnightCanopy === true;
  return alternateIcons.filter(icon => includeAutumnDrive || !icon.v3Only);
}

function configureAlternateIconBuildSettings(project, icons = alternateIcons) {
  const host = project.getFirstTarget().firstTarget;
  const list = project.pbxXCConfigurationList()[host.buildConfigurationList];
  const configurations = project.pbxXCBuildConfigurationSection();
  const names = `"${icons.map(icon => icon.name).join(' ')}"`;
  for (const { value } of list.buildConfigurations) {
    const settings = configurations[value]?.buildSettings;
    if (!settings) continue;
    settings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = names;
    settings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
  }
  return project;
}

async function writeAlternateIconAssets(projectRoot, assetCatalogRoot, icons = alternateIcons) {
  fs.mkdirSync(assetCatalogRoot, { recursive: true });
  const activeNames = new Set(icons.map(icon => icon.name));
  for (const icon of alternateIcons) {
    if (!activeNames.has(icon.name)) fs.rmSync(path.join(assetCatalogRoot, `${icon.name}.appiconset`), { recursive: true, force: true });
  }
  for (const icon of icons) {
    const destination = path.join(assetCatalogRoot, `${icon.name}.appiconset`);
    fs.mkdirSync(destination, { recursive: true });
    const filename = `${icon.name}.png`;
    const darkFilename = `${icon.name}-dark.png`;
    for (const variant of [
      { filename, source: icon.source, cacheSuffix: 'light', backgroundColor: icon.backgroundColor },
      { filename: darkFilename, source: icon.darkSource, cacheSuffix: 'dark', backgroundColor: '#000000' },
    ]) {
      const { source } = await generateImageAsync({
        projectRoot,
        cacheType: `journeydeck-alternate-icon-${icon.name}-${variant.cacheSuffix}`,
      }, {
        src: path.join(projectRoot, variant.source),
        name: variant.filename,
        width: 1024,
        height: 1024,
        resizeMode: 'cover',
        removeTransparency: true,
        backgroundColor: variant.backgroundColor,
      });
      fs.writeFileSync(path.join(destination, variant.filename), source);
    }
    fs.writeFileSync(path.join(destination, 'Contents.json'), JSON.stringify({
      images: [
        { filename, idiom: 'universal', platform: 'ios', size: '1024x1024' },
        { appearances: [{ appearance: 'luminosity', value: 'dark' }], filename: darkFilename, idiom: 'universal', platform: 'ios', size: '1024x1024' },
      ],
      info: { author: 'xcode', version: 1 },
    }, null, 2));
  }
}

module.exports = config => {
  const icons = iconsForConfig(config);
  config = withDangerousMod(config, ['ios', async mod => {
    const sourceRoot = IOSConfig.Paths.getSourceRoot(mod.modRequest.projectRoot);
    await writeAlternateIconAssets(mod.modRequest.projectRoot, path.join(sourceRoot, 'Images.xcassets'), icons);
    return mod;
  }]);
  return withXcodeProject(config, mod => {
    configureAlternateIconBuildSettings(mod.modResults, icons);
    return mod;
  });
};

module.exports.alternateIcons = alternateIcons;
module.exports.iconsForConfig = iconsForConfig;
module.exports.configureAlternateIconBuildSettings = configureAlternateIconBuildSettings;
module.exports.writeAlternateIconAssets = writeAlternateIconAssets;
