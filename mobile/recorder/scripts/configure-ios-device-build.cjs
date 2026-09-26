const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const xcode = require('xcode');

function configure(project, settings, number) {
  const objects = project.hash.project.objects;
  let matched = 0;
  for (const [id, target] of Object.entries(objects.PBXNativeTarget)) {
    if (id.endsWith('_comment') || !target.buildConfigurationList) continue;
    const list = objects.XCConfigurationList[target.buildConfigurationList];
    for (const item of list.buildConfigurations) {
      const configuration = objects.XCBuildConfiguration[item.value], build = configuration.buildSettings;
      const bundle = String(build.PRODUCT_BUNDLE_IDENTIFIER || '').replaceAll('"', '');
      if (!settings.profiles[bundle]) continue;
      Object.assign(build, { CODE_SIGN_STYLE: 'Manual', DEVELOPMENT_TEAM: settings.team,
        CODE_SIGN_IDENTITY: settings.identity, PROVISIONING_PROFILE_SPECIFIER: settings.profiles[bundle],
        CURRENT_PROJECT_VERSION: String(number) });
      matched++;
    }
  }
  if (matched < 4) throw Error('Expected both V3 app and Watch signing configurations');
}

function setBundleBuildNumbers(files, number) {
  if (!Number.isInteger(number) || number < 1 || files.length !== 2) throw Error('Expected app and Watch build-number inputs');
  for (const file of files) {
    const info = plist.parse(fs.readFileSync(file, 'utf8'));
    info.CFBundleVersion = String(number);
    fs.writeFileSync(file, plist.build(info));
  }
}

if (require.main === module) {
  if (process.platform !== 'darwin' || process.env.GITHUB_ACTIONS !== 'true') throw Error('GitHub Mac runner required');
  const settings = JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP, 'journeydeck-signing/settings.json'), 'utf8'));
  const projects = fs.readdirSync('ios').filter(file => file.endsWith('.xcodeproj'));
  if (projects.length !== 1) throw Error('Expected one app project');
  const projectFile = path.join('ios', projects[0], 'project.pbxproj');
  const project = xcode.project(projectFile); project.parseSync();
  const buildNumber = 100000 + Number(process.env.GITHUB_RUN_NUMBER);
  configure(project, settings, buildNumber);
  fs.writeFileSync(projectFile, project.writeSync());
  const appFolder = path.join('ios', projects[0].replace('.xcodeproj', ''));
  setBundleBuildNumbers([path.join(appFolder, 'Info.plist'), path.join('ios', 'JourneyDeckWatch', 'Info.plist')], buildNumber);
  const expoPlist = path.join(appFolder, 'Supporting/Expo.plist');
  const updates = plist.parse(fs.readFileSync(expoPlist, 'utf8'));
  if (updates.EXUpdatesRuntimeVersion !== '3.0.0-preview.7') throw Error('Unexpected native runtime; Expo MediaLibrary and the Ask bridges require the next V3 binary');
  updates.EXUpdatesRequestHeaders = { ...updates.EXUpdatesRequestHeaders, 'expo-channel-name': 'v3-preview' };
  fs.writeFileSync(expoPlist, plist.build(updates));
}
module.exports = { configure, setBundleBuildNumbers };
