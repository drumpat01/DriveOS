import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { configure, setBundleBuildNumbers } = require('../scripts/configure-ios-device-build.cjs');
const plist = require('@expo/plist').default;

test('manual signing assigns app and Watch their own profiles without touching Pods', () => {
  const objects: any = { PBXNativeTarget: {}, XCConfigurationList: {}, XCBuildConfiguration: {} };
  for (const name of ['app', 'watch', 'pod']) {
    objects.PBXNativeTarget[name] = { buildConfigurationList: name };
    objects.XCConfigurationList[name] = { buildConfigurations: ['debug', 'release'].map(c => ({ value: name + c })) };
    for (const c of ['debug', 'release']) objects.XCBuildConfiguration[name + c] = { buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: name } };
  }
  configure({ hash: { project: { objects } } }, { profiles: { app: 'app-profile', watch: 'watch-profile' }, team: 'team', identity: 'cert' }, 100012);
  assert.equal(objects.XCBuildConfiguration.apprelease.buildSettings.PROVISIONING_PROFILE_SPECIFIER, 'app-profile');
  assert.equal(objects.XCBuildConfiguration.watchrelease.buildSettings.PROVISIONING_PROFILE_SPECIFIER, 'watch-profile');
  assert.equal(objects.XCBuildConfiguration.watchrelease.buildSettings.CURRENT_PROJECT_VERSION, '100012');
  assert.equal(objects.XCBuildConfiguration.podrelease.buildSettings.CODE_SIGN_STYLE, undefined);
});
test('device build stamps a monotonically higher build number into app and Watch plists', () => {
  const folder = mkdtempSync(join(tmpdir(), 'journeydeck-build-number-'));
  const files = ['App.plist', 'Watch.plist'].map(name => join(folder, name));
  try {
    for (const file of files) writeFileSync(file, plist.build({ CFBundleIdentifier: 'example', CFBundleVersion: '1' }));
    setBundleBuildNumbers(files, 100004);
    for (const file of files) assert.equal(plist.parse(readFileSync(file, 'utf8')).CFBundleVersion, '100004');
  } finally { rmSync(folder, { recursive: true }); }
});
test('device workflow is manual, public standard runner only, and exports only an encrypted artifact', () => {
  // Source safety contract, not a claim the Xcode workflow has run.
  const candidates = [new URL('../../../.github/workflows/ios-v3-device.yml', import.meta.url), new URL('../.github/workflows/ios-v3-device.yml', import.meta.url)];
  let text = '';
  for (const url of candidates) { try { text = readFileSync(url, 'utf8'); break; } catch { /* mobile snapshot or main repository */ } }
  const w = require('yaml').parse(text);
  assert.deepEqual(Object.keys(w.on), ['workflow_dispatch']);
  assert.equal(w.jobs.build['runs-on'], 'macos-26');
  assert.match(w.jobs.build.if, /private == false/);
  assert.doesNotMatch(text, /eas build|simctl|serve-sim|\.p12\s*\n.*upload/);
  const upload = w.jobs.build.steps.find((s: any) => s.with?.name === 'journeydeck-v3-device-encrypted');
  assert.match(upload.with.path, /JourneyDeckEncrypted/);
  assert.equal(upload.with['retention-days'], 1);
  assert.equal(upload.if, "env.NATIVE_REBUILD == 'true'");
});
