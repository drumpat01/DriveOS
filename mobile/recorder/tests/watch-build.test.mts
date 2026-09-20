import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const plist = require('@expo/plist').default;
const plugin = require('../plugins/with-journeydeck-watch.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path: string) => readFileSync(join(root, path), 'utf8');

for (const bundleIdentifier of ['com.journeydeck.recorder', 'com.journeydeck.recorder.v2']) {
  test(`Watch target embeds the actual product and preserves host settings: ${bundleIdentifier}`, () => {
    const project = xcode.project(join(root, 'node_modules/react-native-view-shot/ios/RNViewShot.xcodeproj/project.pbxproj'));
    project.parseSync();
    const host = project.getFirstTarget();
    const hostList = project.pbxXCConfigurationList()[host.firstTarget.buildConfigurationList];
    for (const { value } of hostList.buildConfigurations) {
      Object.assign(project.pbxXCBuildConfigurationSection()[value].buildSettings, {
        CURRENT_PROJECT_VERSION: '27', MARKETING_VERSION: '"2.0.0"', DEVELOPMENT_TEAM: 'TESTTEAM',
      });
    }
    const before = JSON.stringify(hostList.buildConfigurations.map(({ value }: { value: string }) => project.pbxXCBuildConfigurationSection()[value]));
    const config = { name: 'JourneyDeck', version: '2.0.0', ios: { bundleIdentifier } };
    plugin.addWatchTarget(project, config);
    const once = project.writeSync();
    plugin.addWatchTarget(project, config);
    assert.equal(project.writeSync(), once, 'prebuild must be idempotent');
    assert.equal(JSON.stringify(hostList.buildConfigurations.map(({ value }: { value: string }) => project.pbxXCBuildConfigurationSection()[value])), before);
    const targets = Object.entries(project.pbxNativeTargetSection()).filter(([, target]: any) => target.name === '"JourneyDeckWatch"') as any[];
    assert.equal(targets.length, 1);
    const [id, target] = targets[0];
    assert.equal(target.productType, '"com.apple.product-type.application"');
    const configs = project.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations;
    for (const { value } of configs) {
      const settings = project.pbxXCBuildConfigurationSection()[value].buildSettings;
      assert.equal(settings.SDKROOT, 'watchos');
      assert.equal(settings.TARGETED_DEVICE_FAMILY, '4');
      assert.equal(settings.PRODUCT_BUNDLE_IDENTIFIER, `"${bundleIdentifier}.watchkitapp"`);
      assert.equal(settings.CURRENT_PROJECT_VERSION, '27');
      assert.equal(settings.DEVELOPMENT_TEAM, 'TESTTEAM');
    }
    const embeds = Object.values(project.hash.project.objects.PBXCopyFilesBuildPhase)
      .filter((phase: any) => phase.name === '"Embed Watch Content"') as any[];
    assert.equal(embeds.length, 1);
    assert.equal(embeds[0].dstPath, '"$(CONTENTS_FOLDER_PATH)/Watch"');
    const file = project.pbxBuildFileSection()[embeds[0].files[0].value];
    assert.equal(file.fileRef, target.productReference);
    const dependencies = host.firstTarget.dependencies.map((entry: any) => project.hash.project.objects.PBXTargetDependency[entry.value]);
    assert.ok(dependencies.some((dependency: any) => dependency.target === id));
    assert.ok(once.includes('JourneyDeckWatch/JourneyDeckWatchApp.swift'));
    assert.ok(once.includes('JourneyDeckWatch/Assets.xcassets'));
    const watchGroup = Object.values(project.hash.project.objects.PBXGroup).find((group: any) => group?.name === 'JourneyDeckWatch') as any;
    assert.equal(watchGroup.path, '""');
    assert.equal(watchGroup.sourceTree, 'SOURCE_ROOT');
    assert.doesNotMatch(once, /path = undefined;/, 'Xcode must resolve the Watch catalog from the project root');
  });
}

test('generated Watch files identify the paired preview app and match the bundled Grand Touring primary icon', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'journeydeck-watch-test-'));
  try {
    await plugin.writeWatchFiles(root, directory, { name: 'JourneyDeck V2', ios: { bundleIdentifier: 'com.journeydeck.recorder.v2' } });
    const info = plist.parse(readFileSync(join(directory, 'JourneyDeckWatch/Info.plist'), 'utf8'));
    assert.equal(info.WKApplication, true);
    assert.equal(info.WKRunsIndependentlyOfCompanionApp, false);
    assert.equal(info.WKCompanionAppBundleIdentifier, 'com.journeydeck.recorder.v2');
    assert.equal(info.NSLocationAlwaysAndWhenInUseUsageDescription, undefined);
    const icons = join(directory, 'JourneyDeckWatch/Assets.xcassets/AppIcon.appiconset');
    const catalog = JSON.parse(readFileSync(join(icons, 'Contents.json'), 'utf8'));
    assert.deepEqual(catalog.images, [{ filename: 'AppIcon.png', idiom: 'universal', platform: 'watchos', size: '1024x1024' }]);
    const icon = readFileSync(join(icons, catalog.images[0].filename));
    assert.equal(icon.subarray(1, 4).toString(), 'PNG');
    assert.equal(icon.readUInt32BE(16), 1024, 'actual PNG width must match the catalog slot');
    assert.equal(icon.readUInt32BE(20), 1024, 'actual PNG height must match the catalog slot');
    const decoded = await require('@expo/image-utils').getPngInfo(join(icons, catalog.images[0].filename));
    const primary = await require('@expo/image-utils').getPngInfo(join(root, 'assets/icon-grand-touring-v2.png'));
    assert.ok(decoded.data.equals(primary.data), 'Watch primary icon must match the iPhone/iPad primary icon pixels');
    assert.equal(decoded.data.length, 1024 * 1024 * 4);
    for (let alpha = 3; alpha < decoded.data.length; alpha += 4) {
      assert.equal(decoded.data[alpha], 255, 'Watch App Store icon must be opaque');
    }
    const backgroundPath = 'Assets.xcassets/CinematicRoad.imageset';
    const background = JSON.parse(readFileSync(join(directory, 'JourneyDeckWatch', backgroundPath, 'Contents.json'), 'utf8'));
    assert.equal(background.images[0].filename, 'cinematic-road.png');
    assert.equal(readFileSync(join(directory, 'JourneyDeckWatch', backgroundPath, background.images[0].filename))
      .compare(readFileSync(join(root, 'watch', backgroundPath, 'cinematic-road.png'))), 0);
  } finally {
    const resolved = resolve(directory);
    assert.ok(resolved.startsWith(resolve(tmpdir()) + require('node:path').sep));
    rmSync(resolved, { recursive: true });
  }
});

test('native integration retains isolated persistence, precise stop ownership and legacy fallback', () => {
  const swift = source('modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift');
  const bridge = source('modules/journeydeck-recorder/ios/JourneyDeckWatchBridge.swift');
  const app = source('App.tsx');
  const machine = source('modules/journeydeck-recorder/ios/RecorderStateMachine.swift');
  assert.match(machine, /current\?\[0\] != request\.sessionID/);
  assert.match(swift, /manualSessionPrefix = "native_recording_manual_"/);
  assert.match(swift, /nextState\.manualInactivity = policy/);
  assert.match(swift, /try commitState\(nextState/);
  assert.match(swift, /kCLDistanceFilterNone/);
  assert.doesNotMatch(swift, /journeydeck-local\.db/);
  assert.doesNotMatch(bridge, /\.transferUserInfo\(|URLSession|latitude|longitude/);
  assert.match(bridge, /timeIntervalSince1970 - issuedAt\) <= 30/);
  assert.match(bridge, /executeCommand\(operationID: requestID, action: "finish", sessionID: expected, expectedToken: token, expiresAt: issuedAt \+ 30\)/);
  assert.match(app, /isNativeManualRecorderAvailable[\s\S]*startNativeManualJourney\(randomUUID\(\)\)/);
  assert.match(app, /beginLocalSession\(deviceId\)/);
});
