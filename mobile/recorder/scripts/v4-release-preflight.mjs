import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const eas = JSON.parse(readFileSync(new URL('eas.json', root), 'utf8'));
const base = require('../app.json').expo;
const previousVariant = process.env.APP_VARIANT;
const previousProfile = process.env.EAS_BUILD_PROFILE;

let config;
try {
  process.env.APP_VARIANT = 'v4-store';
  process.env.EAS_BUILD_PROFILE = 'v4-testflight';
  config = require('../app.config.js')({ config: base });
} finally {
  if (previousVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = previousVariant;
  if (previousProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
  else process.env.EAS_BUILD_PROFILE = previousProfile;
}

const build = eas.build['v4-testflight'];
assert.ok(build, 'V4 TestFlight build profile is missing');
assert.equal(build.distribution, 'store');
assert.equal(build.environment, 'production');
assert.equal(build.channel, 'v4-testflight');
assert.equal(build.env?.APP_VARIANT, 'v4-store');
assert.equal(build.env?.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING, '0');
assert.equal(config.ios.bundleIdentifier, 'com.journeydeck.recorder');
assert.deepEqual(config.ios.entitlements['com.apple.developer.icloud-container-identifiers'], ['iCloud.com.journeydeck.recorder']);
assert.equal(config.version, '4.0.0');
assert.equal(config.runtimeVersion, '4.0.0-preview.1');
assert.equal(config.updates.requestHeaders['xprem-branch'], 'v4-testflight');
assert.equal(config.extra.features.auroraGlass, true);
assert.equal(eas.submit['v4-testflight']?.ios?.ascAppId, '6806502526');

console.log('V4 TestFlight identity, isolation, and EAS profile checks passed.');
