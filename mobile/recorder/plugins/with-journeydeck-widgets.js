const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');
const plist = require('@expo/plist');
const { generateImageAsync } = require('@expo/image-utils');

// V4 Home Screen and Lock Screen "Start a Journey" widget (WidgetKit extension).
const targetName = 'JourneyDeckWidgets';
const unquote = value => String(value ?? '').replace(/^"|"$/g, '');
const bundleIdOf = config => `${config.ios.bundleIdentifier}.widgets`;
const appGroupOf = config => `group.${config.ios.bundleIdentifier}`;

function addWidgetTarget(project, config) {
  const host = project.getFirstTarget();
  const hostConfigs = project.pbxXCConfigurationList()[host.firstTarget.buildConfigurationList].buildConfigurations;
  const targets = project.pbxNativeTargetSection();
  let targetID = Object.keys(targets).find(key => unquote(targets[key]?.name) === targetName);
  if (!targetID) {
    project.hash.project.objects.PBXTargetDependency ??= {};
    project.hash.project.objects.PBXContainerItemProxy ??= {};
    const target = project.addTarget(targetName, 'app_extension', targetName, bundleIdOf(config));
    targetID = target.uuid;
    project.addBuildPhase([`${targetName}/JourneyDeckWidgets.swift`], 'PBXSourcesBuildPhase', 'Sources', targetID);
    project.addBuildPhase([`${targetName}/Assets.xcassets`, `${targetName}/PrivacyInfo.xcprivacy`], 'PBXResourcesBuildPhase', 'Resources', targetID);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetID);
    // References already include JourneyDeckWidgets/, so anchor the group at root.
    const group = project.addPbxGroup([`${targetName}/JourneyDeckWidgets.swift`, `${targetName}/Info.plist`, `${targetName}/Assets.xcassets`, `${targetName}/PrivacyInfo.xcprivacy`, `${targetName}/${targetName}.entitlements`], targetName, '""', 'SOURCE_ROOT');
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
    // addTarget already embeds an app_extension product in the app's PlugIns folder.
  }
  const configurations = project.pbxXCBuildConfigurationSection();
  const widgetConfigs = project.pbxXCConfigurationList()[targets[targetID].buildConfigurationList].buildConfigurations;
  for (const { value } of widgetConfigs) {
    const build = configurations[value];
    const hostBuild = hostConfigs.map(({ value }) => configurations[value]).find(candidate => candidate.name === build.name)?.buildSettings ?? {};
    Object.assign(build.buildSettings, {
      PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdOf(config)}"`,
      PRODUCT_NAME: `"${targetName}"`, SDKROOT: 'iphoneos',
      IPHONEOS_DEPLOYMENT_TARGET: '17.0', TARGETED_DEVICE_FAMILY: '"1,2"', SWIFT_VERSION: '5.0',
      GENERATE_INFOPLIST_FILE: 'NO', INFOPLIST_FILE: `"${targetName}/Info.plist"`,
      CODE_SIGN_ENTITLEMENTS: `"${targetName}/${targetName}.entitlements"`,
      CURRENT_PROJECT_VERSION: config.ios.buildNumber ?? hostBuild.CURRENT_PROJECT_VERSION ?? '1',
      MARKETING_VERSION: `"${config.version}"`,
      CODE_SIGN_STYLE: 'Automatic', SKIP_INSTALL: 'YES', APPLICATION_EXTENSION_API_ONLY: 'YES',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
      SWIFT_OPTIMIZATION_LEVEL: build.name === 'Debug' ? '"-Onone"' : '"-O"',
    });
    if (hostBuild.DEVELOPMENT_TEAM) build.buildSettings.DEVELOPMENT_TEAM = hostBuild.DEVELOPMENT_TEAM;
  }
  return project;
}

async function writeWidgetFiles(projectRoot, platformRoot, config) {
  const destination = path.join(platformRoot, targetName);
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(path.join(projectRoot, 'widgets/JourneyDeckWidgets.swift'), path.join(destination, 'JourneyDeckWidgets.swift'));
  fs.writeFileSync(path.join(destination, 'Info.plist'), plist.default.build({
    CFBundleDisplayName: config.name, CFBundleName: '$(PRODUCT_NAME)',
    CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleExecutable: '$(EXECUTABLE_NAME)',
    CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)', CFBundleInfoDictionaryVersion: '6.0',
    CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
    NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
    JourneyDeckAppGroup: appGroupOf(config),
  }));
  // The widget reads the last drive from the App Group's UserDefaults, a required-reason API (1C8F.1).
  fs.writeFileSync(path.join(destination, 'PrivacyInfo.xcprivacy'), plist.default.build({
    NSPrivacyTracking: false, NSPrivacyTrackingDomains: [], NSPrivacyCollectedDataTypes: [],
    NSPrivacyAccessedAPITypes: [{ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['1C8F.1'] }],
  }));
  fs.writeFileSync(path.join(destination, `${targetName}.entitlements`), plist.default.build({
    'com.apple.security.application-groups': [appGroupOf(config)],
  }));
  // The road photo behind the widget, sized for a small widget at 3x.
  const assets = path.join(destination, 'Assets.xcassets');
  const photo = path.join(assets, 'RoadPhoto.imageset');
  fs.mkdirSync(photo, { recursive: true });
  const { source } = await generateImageAsync({ projectRoot, cacheType: 'journeydeck-widget-road' }, {
    src: path.join(projectRoot, 'assets/theme-grand-touring-home-v2.png'), name: 'RoadPhoto.jpg',
    width: 540, height: 540, resizeMode: 'cover', removeTransparency: true, backgroundColor: '#081832',
  });
  fs.writeFileSync(path.join(photo, 'RoadPhoto.png'), source);
  fs.writeFileSync(path.join(photo, 'Contents.json'), JSON.stringify({ images: [{ filename: 'RoadPhoto.png', idiom: 'universal' }], info: { author: 'xcode', version: 1 } }, null, 2));
  fs.writeFileSync(path.join(assets, 'Contents.json'), JSON.stringify({ info: { author: 'xcode', version: 1 } }));
}

module.exports = config => {
  const eas = config.extra?.eas ?? {};
  const build = eas.build ?? {};
  const experimental = build.experimental ?? {};
  const ios = experimental.ios ?? {};
  config.extra = { ...config.extra, eas: { ...eas, build: { ...build, experimental: { ...experimental, ios: {
    ...ios, appExtensions: [...(ios.appExtensions ?? []).filter(target => target.targetName !== targetName),
      { targetName, bundleIdentifier: bundleIdOf(config), entitlements: { 'com.apple.security.application-groups': [appGroupOf(config)] } }],
  } } } } };
  config = withDangerousMod(config, ['ios', async mod => {
    await writeWidgetFiles(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot, mod);
    return mod;
  }]);
  return withXcodeProject(config, mod => { addWidgetTarget(mod.modResults, mod); return mod; });
};
module.exports.addWidgetTarget = addWidgetTarget;
