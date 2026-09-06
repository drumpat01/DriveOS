const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');
const plist = require('@expo/plist');

const targetName = 'JourneyDeckWatch';
const unquote = value => String(value ?? '').replace(/^"|"$/g, '');

function addWatchTarget(project, config) {
  const host = project.getFirstTarget();
  const hostConfigs = project.pbxXCConfigurationList()[host.firstTarget.buildConfigurationList].buildConfigurations;
  const targets = project.pbxNativeTargetSection();
  let targetID = Object.keys(targets).find(key => unquote(targets[key]?.name) === targetName);
  if (!targetID) {
    project.hash.project.objects.PBXTargetDependency ??= {};
    project.hash.project.objects.PBXContainerItemProxy ??= {};
    const target = project.addTarget(targetName, 'application', targetName, `${config.ios.bundleIdentifier}.watchkitapp`);
    targetID = target.uuid;
    project.addBuildPhase([`${targetName}/JourneyDeckWatchApp.swift`], 'PBXSourcesBuildPhase', 'Sources', targetID);
    project.addBuildPhase([`${targetName}/Assets.xcassets`], 'PBXResourcesBuildPhase', 'Resources', targetID);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetID);
    // xcode serializes an omitted group path as the literal directory "undefined".
    // References already include JourneyDeckWatch/, so anchor the group at root.
    const group = project.addPbxGroup([`${targetName}/JourneyDeckWatchApp.swift`, `${targetName}/Assets.xcassets`], targetName, '""', 'SOURCE_ROOT');
    const mainGroup = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, mainGroup);
    const phase = project.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Embed Watch Content', host.uuid,
      'watch2_app', '"$(CONTENTS_FOLDER_PATH)/Watch"');
    // Use the actual product reference, never a second file reference to a
    // source-tree .app path. Xcode builds the dependency before embedding it.
    const buildFile = project.generateUuid();
    project.pbxBuildFileSection()[buildFile] = {
      isa: 'PBXBuildFile', fileRef: target.pbxNativeTarget.productReference,
      fileRef_comment: `${targetName}.app`, settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
    };
    project.pbxBuildFileSection()[`${buildFile}_comment`] = `${targetName}.app in Embed Watch Content`;
    phase.buildPhase.files.push({ value: buildFile, comment: `${targetName}.app in Embed Watch Content` });
  }
  const configurations = project.pbxXCBuildConfigurationSection();
  const watchConfigs = project.pbxXCConfigurationList()[targets[targetID].buildConfigurationList].buildConfigurations;
  for (const { value } of watchConfigs) {
    const build = configurations[value];
    const hostBuild = hostConfigs.map(({ value }) => configurations[value])
      .find(candidate => candidate.name === build.name)?.buildSettings ?? {};
    Object.assign(build.buildSettings, {
      PRODUCT_BUNDLE_IDENTIFIER: `"${config.ios.bundleIdentifier}.watchkitapp"`,
      PRODUCT_NAME: `"${targetName}"`, SDKROOT: 'watchos',
      SUPPORTED_PLATFORMS: '"watchos watchsimulator"', TARGETED_DEVICE_FAMILY: '4',
      WATCHOS_DEPLOYMENT_TARGET: '10.0', SWIFT_VERSION: '5.0',
      GENERATE_INFOPLIST_FILE: 'NO', INFOPLIST_FILE: `"${targetName}/Info.plist"`,
      ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
      CURRENT_PROJECT_VERSION: config.ios.buildNumber ?? hostBuild.CURRENT_PROJECT_VERSION ?? '1',
      MARKETING_VERSION: `"${config.version}"`,
      CODE_SIGN_STYLE: 'Automatic', SKIP_INSTALL: 'YES',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks"',
      SWIFT_OPTIMIZATION_LEVEL: build.name === 'Debug' ? '"-Onone"' : '"-O"',
      ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES: 'YES',
    });
    if (hostBuild.DEVELOPMENT_TEAM) build.buildSettings.DEVELOPMENT_TEAM = hostBuild.DEVELOPMENT_TEAM;
    delete build.buildSettings.IPHONEOS_DEPLOYMENT_TARGET;
  }
  return project;
}

function writeWatchFiles(projectRoot, platformRoot, config) {
  const destination = path.join(platformRoot, targetName);
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(path.join(projectRoot, 'watch/JourneyDeckWatchApp.swift'), path.join(destination, 'JourneyDeckWatchApp.swift'));
  fs.cpSync(path.join(projectRoot, 'watch/Assets.xcassets'), path.join(destination, 'Assets.xcassets'), { recursive: true });
  fs.writeFileSync(path.join(destination, 'Info.plist'), plist.default.build({
    CFBundleDisplayName: config.name, CFBundleName: '$(PRODUCT_NAME)',
    CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleExecutable: '$(EXECUTABLE_NAME)',
    CFBundlePackageType: 'APPL', CFBundleInfoDictionaryVersion: '6.0',
    CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
    WKApplication: true, WKCompanionAppBundleIdentifier: config.ios.bundleIdentifier,
    WKRunsIndependentlyOfCompanionApp: false, WKWatchOnly: false,
    ITSAppUsesNonExemptEncryption: false,
  }));
  const icons = path.join(destination, 'Assets.xcassets/AppIcon.appiconset');
  fs.mkdirSync(icons, { recursive: true });
  fs.copyFileSync(path.join(projectRoot, 'assets/icon.png'), path.join(icons, 'AppIcon.png'));
  fs.writeFileSync(path.join(icons, 'Contents.json'), JSON.stringify({
    images: [{ filename: 'AppIcon.png', idiom: 'universal', platform: 'watchos', size: '1024x1024' }],
    info: { author: 'xcode', version: 1 },
  }, null, 2));
  fs.writeFileSync(path.join(destination, 'Assets.xcassets/Contents.json'), JSON.stringify({ info: { author: 'xcode', version: 1 } }));
}

module.exports = config => {
  const eas = config.extra?.eas ?? {};
  const build = eas.build ?? {};
  const experimental = build.experimental ?? {};
  const ios = experimental.ios ?? {};
  config.extra = { ...config.extra, eas: { ...eas, build: { ...build, experimental: { ...experimental, ios: {
    ...ios, appExtensions: [...(ios.appExtensions ?? []).filter(target => target.targetName !== targetName),
      { targetName, bundleIdentifier: `${config.ios.bundleIdentifier}.watchkitapp`, entitlements: {} }],
  } } } } };
  config = withDangerousMod(config, ['ios', async mod => {
    writeWatchFiles(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot, mod);
    return mod;
  }]);
  return withXcodeProject(config, mod => { addWatchTarget(mod.modResults, mod); return mod; });
};
module.exports.addWatchTarget = addWatchTarget;
module.exports.writeWatchFiles = writeWatchFiles;
