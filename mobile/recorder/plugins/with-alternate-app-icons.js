const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');

const alternateIcons = [
  {
    name: 'JourneyDeckWarmIvory',
    source: 'assets/icon-light-plum-v1.png',
    backgroundColor: '#f6f0e2',
  },
  {
    name: 'JourneyDeckRosewater',
    source: 'assets/icon-rosewater-v1.png',
    backgroundColor: '#fff4f7',
  },
  {
    name: 'JourneyDeckGrandTouring',
    source: 'assets/icon-grand-touring-v1.png',
    backgroundColor: '#081832',
  },
];

function configureAlternateIconBuildSettings(project) {
  const host = project.getFirstTarget().firstTarget;
  const list = project.pbxXCConfigurationList()[host.buildConfigurationList];
  const configurations = project.pbxXCBuildConfigurationSection();
  const names = `"${alternateIcons.map(icon => icon.name).join(' ')}"`;
  for (const { value } of list.buildConfigurations) {
    const settings = configurations[value]?.buildSettings;
    if (!settings) continue;
    settings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = names;
    settings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
  }
  return project;
}

async function writeAlternateIconAssets(projectRoot, assetCatalogRoot) {
  fs.mkdirSync(assetCatalogRoot, { recursive: true });
  for (const icon of alternateIcons) {
    const destination = path.join(assetCatalogRoot, `${icon.name}.appiconset`);
    fs.mkdirSync(destination, { recursive: true });
    const filename = `${icon.name}.png`;
    const { source } = await generateImageAsync({
      projectRoot,
      cacheType: `journeydeck-alternate-icon-${icon.name}`,
    }, {
      src: path.join(projectRoot, icon.source),
      name: filename,
      width: 1024,
      height: 1024,
      resizeMode: 'cover',
      removeTransparency: true,
      backgroundColor: icon.backgroundColor,
    });
    fs.writeFileSync(path.join(destination, filename), source);
    fs.writeFileSync(path.join(destination, 'Contents.json'), JSON.stringify({
      images: [{ filename, idiom: 'universal', platform: 'ios', size: '1024x1024' }],
      info: { author: 'xcode', version: 1 },
    }, null, 2));
  }
}

module.exports = config => {
  config = withDangerousMod(config, ['ios', async mod => {
    const sourceRoot = IOSConfig.Paths.getSourceRoot(mod.modRequest.projectRoot);
    await writeAlternateIconAssets(mod.modRequest.projectRoot, path.join(sourceRoot, 'Images.xcassets'));
    return mod;
  }]);
  return withXcodeProject(config, mod => {
    configureAlternateIconBuildSettings(mod.modResults);
    return mod;
  });
};

module.exports.alternateIcons = alternateIcons;
module.exports.configureAlternateIconBuildSettings = configureAlternateIconBuildSettings;
module.exports.writeAlternateIconAssets = writeAlternateIconAssets;
