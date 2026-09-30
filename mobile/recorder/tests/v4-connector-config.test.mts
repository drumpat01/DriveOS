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
    assert.equal(config.runtimeVersion, '4.0.0-preview.2');
    assert.equal(config.updates.requestHeaders['xprem-branch'], 'v4-testflight');
    assert.equal(config.ios.bundleIdentifier, 'com.journeydeck.recorder');
    assert.equal(config.ios.infoPlist.JourneyDeckCloudKitContainer, 'iCloud.com.journeydeck.recorder');
    assert.equal(config.extra.features.markerPrototype, true);
    assert.equal(config.extra.features.auroraGlass, true, 'V4 offers the Aurora Glass Plus theme');
    assert.equal(config.extra.features.testflightPlusUnlocked, false, 'V4 enforces the Plus paywall');
    assert.equal(config.extra.features.atlasUnlocked, false, 'V4 enforces the Plus paywall for Atlas');
    assert.equal(config.extra.features.connector, true, 'V4 offers Connect to Claude');
    assert.equal(config.extra.features.redesign, true, 'V4 ships the iPhone redesign');
    assert.equal(config.extra.connector.url, 'https://mcp.journeydeck.me/mcp', 'V4 TestFlight and App Store builds use the production connector');
    delete process.env.EAS_BUILD_PROFILE;
    assert.equal(configure({ config: base }).extra.connector.url, 'https://mcp.journeydeck.me/mcp', 'V4 OTA exports use the production connector');
    process.env.EAS_BUILD_PROFILE = 'v4-development-simulator';
    assert.equal(configure({ config: base }).extra.connector.url, 'https://mcp-staging.journeydeck.me/mcp', 'V4 development builds use staging');
    process.env.EAS_BUILD_PROFILE = 'v4-testflight';
    assert.equal(eas.build['v4-testflight'].env.APP_VARIANT, 'v4-store');
    assert.equal(eas.submit['v4-testflight'].ios.ascAppId, '6806502526');
    assert.equal(eas.build['v3-testflight'].env.APP_VARIANT, 'v3-store');
    process.env.APP_VARIANT = 'v3-store';
    process.env.EAS_BUILD_PROFILE = 'v3-testflight';
    assert.equal(configure({ config: base }).extra.features.auroraGlass, false, 'V3 never offers Aurora Glass');
    assert.equal(configure({ config: base }).extra.features.connector, false, 'V3 never offers Connect to Claude');
    assert.equal(configure({ config: base }).extra.features.redesign, false, 'V3 keeps its approved layout');
    assert.equal(configure({ config: base }).extra.connector, undefined);
  } finally {
    if (previousVariant === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = previousVariant;
    if (previousProfile === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = previousProfile;
  }
});
