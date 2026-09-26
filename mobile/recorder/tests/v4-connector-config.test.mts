import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const base = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));

test('V4 TestFlight has its own runtime and update branch while using the existing private CloudKit container', () => {
  const previousVariant = process.env.APP_VARIANT;
  const previousProfile = process.env.EAS_BUILD_PROFILE;
  try {
    process.env.APP_VARIANT = 'v4-store';
    process.env.EAS_BUILD_PROFILE = 'v4-testflight';
    const config = configure({ config: base });
    assert.equal(config.version, '4.0.0');
    assert.equal(config.runtimeVersion, '4.0.0-preview.1');
    assert.equal(config.updates.requestHeaders['xprem-branch'], 'v4-testflight');
    assert.equal(config.ios.bundleIdentifier, 'com.journeydeck.recorder');
    assert.equal(config.ios.infoPlist.JourneyDeckCloudKitContainer, 'iCloud.com.journeydeck.recorder');
    assert.equal(config.extra.features.markerPrototype, true);
    assert.equal(eas.build['v4-testflight'].env.APP_VARIANT, 'v4-store');
    assert.equal(eas.submit['v4-testflight'].ios.ascAppId, '6806502526');
    assert.equal(eas.build['v3-testflight'].env.APP_VARIANT, 'v3-store');
  } finally {
    if (previousVariant === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = previousVariant;
    if (previousProfile === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = previousProfile;
  }
});
