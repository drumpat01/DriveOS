import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const configureApp = require('../app.config.js');
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const {
  LIVE_ASC_APP_ID,
  V2_ASC_APP_ID,
  FORBIDDEN_V3_PREVIEW_ASC_APP_ID,
  evaluateV3TestflightGate,
  formatGateReport,
  isLiveListingAscAppId,
  parseAuthorizeFlag,
  run,
} = await import('../scripts/v3-testflight-gate.mjs');

const base = {
  name: 'JourneyDeck',
  scheme: 'journeydeck',
  ios: { infoPlist: {}, bundleIdentifier: 'com.journeydeck.recorder', entitlements: {} },
  updates: { url: 'https://u.expo.dev/ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4' },
};

function withEnv(values: Record<string, string | undefined>, body: () => void) {
  const names = Object.keys(values);
  const previous = names.map(name => process.env[name]);
  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    body();
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
}

function assertLiveIdentityWithV3Features(config: ReturnType<typeof configureApp>) {
  assert.equal(config.ios.bundleIdentifier, 'com.journeydeck.recorder');
  assert.doesNotMatch(config.ios.bundleIdentifier, /\.v3$/);
  assert.equal(config.ios.entitlements['com.apple.developer.icloud-container-identifiers'][0], 'iCloud.com.journeydeck.recorder');
  assert.equal(config.ios.infoPlist.JourneyDeckCloudKitContainer, 'iCloud.com.journeydeck.recorder');
  assert.doesNotMatch(config.ios.infoPlist.JourneyDeckCloudKitContainer, /\.v3$/);
  assert.equal(`${config.ios.bundleIdentifier}.watchkitapp`, 'com.journeydeck.recorder.watchkitapp');
  assert.equal(config.scheme, 'journeydeck');
  assert.equal(config.name, 'JourneyDeck');
  assert.equal(config.runtimeVersion, '3.0.0-preview.5');
  assert.equal(config.extra.features.testflightPlusUnlocked, true);
  assert.equal(config.extra.features.testflightTessieEnabled, true);
  assert.equal(config.extra.features.testflightDataHealth, true);
  assert.equal(config.updates.requestHeaders['expo-channel-name'], 'production');
  assert.equal(config.extra.features.atlasUnlocked, true);
  assert.equal(config.extra.features.markerPrototype, true);
  assert.equal(config.extra.features.fiftyStates, true);
  assert.equal(config.extra.features.askJourneyDeck, true);
  assert.equal(config.extra.features.midnightCanopy, true);
  assert.equal(config.plugins.includes('./plugins/with-ask-journeydeck'), true);
}

test('v3-testflight is store distribution on the live listing and production channel', () => {
  const profile = eas.build['v3-testflight'];
  assert.equal(profile.distribution, 'store');
  assert.notEqual(profile.distribution, 'internal');
  assert.equal(profile.channel, 'production');
  assert.equal(profile.environment, 'production');
  assert.equal(profile.env.APP_VARIANT, 'v3-store');
  assert.notEqual(profile.env.APP_VARIANT, 'v3-preview');
  assert.equal(profile.env.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING, '0');
  assert.equal(profile.ios.simulator, false);
  assert.equal(profile.autoIncrement, true);
  assert.equal(eas.submit.production.ios.ascAppId, LIVE_ASC_APP_ID);
  assert.equal(eas.submit.production.ios.ascAppId, '6806502526');
  assert.equal(eas.submit['v3-testflight'].ios.ascAppId, LIVE_ASC_APP_ID);
  assert.equal(eas.submit['v3-testflight'].ios.ascAppId, '6806502526');
  assert.notEqual(eas.submit['v3-testflight'].ios.ascAppId, FORBIDDEN_V3_PREVIEW_ASC_APP_ID);
  assert.doesNotMatch(JSON.stringify(eas.submit['v3-testflight']), /6814695593/);
  assert.doesNotMatch(JSON.stringify(profile), /v3-preview|6814695593|com\.journeydeck\.recorder\.v3/);
  assert.equal(isLiveListingAscAppId(eas.submit['v3-testflight'].ios.ascAppId), true);
  assert.equal(V2_ASC_APP_ID, LIVE_ASC_APP_ID);
});

test('V3 TestFlight config keeps live identity and turns V3 features on', () => {
  withEnv({ APP_VARIANT: undefined, EAS_BUILD_PROFILE: 'v3-testflight' }, () => {
    assertLiveIdentityWithV3Features(configureApp({ config: base }));
  });
  withEnv({
    APP_VARIANT: 'v3-store',
    EAS_BUILD_PROFILE: undefined,
    REVENUECAT_PREVIEW_APPLE_API_KEY: 'appl_preview',
    REVENUECAT_PRODUCTION_APPLE_API_KEY: 'appl_production',
  }, () => {
    const config = configureApp({ config: base });
    assertLiveIdentityWithV3Features(config);
    assert.equal(config.extra.revenueCat.appleApiKey, 'appl_production');
  });
  withEnv({ APP_VARIANT: 'v3-preview', EAS_BUILD_PROFILE: 'v3-testflight' }, () => {
    assertLiveIdentityWithV3Features(configureApp({ config: base }));
  });
});

test('isolated v3-preview identity is unchanged and is not selected by v3-testflight', () => {
  withEnv({ APP_VARIANT: 'v3-preview', EAS_BUILD_PROFILE: 'v3-preview' }, () => {
    const config = configureApp({ config: base });
    assert.equal(config.ios.bundleIdentifier, 'com.journeydeck.recorder.v3');
    assert.equal(config.ios.entitlements['com.apple.developer.icloud-container-identifiers'][0], 'iCloud.com.journeydeck.recorder.v3');
    assert.equal(config.updates.requestHeaders['expo-channel-name'], 'v3-preview');
    assert.equal(config.extra.features.askJourneyDeck, true);
  });
});

test('Ask and Siri plugins enable V3 native work from feature flags, not the .v3 bundle', () => {
  const ask = readFileSync(new URL('../plugins/with-ask-journeydeck.js', import.meta.url), 'utf8');
  const siri = readFileSync(new URL('../plugins/with-journeydeck-siri.js', import.meta.url), 'utf8');
  assert.match(ask, /features\?\.askJourneyDeck !== true/);
  assert.doesNotMatch(ask, /bundleIdentifier !== 'com\.journeydeck\.recorder\.v3'/);
  assert.match(siri, /features\?\.markerPrototype === true/);
  assert.doesNotMatch(siri, /bundleIdentifier === 'com\.journeydeck\.recorder\.v3'/);
});

test('the V3 TestFlight gate accepts the live listing id and still requires CoS clear', () => {
  const current = evaluateV3TestflightGate(eas, { authorize: false });
  assert.equal(current.blocked, true);
  assert.equal(current.readyId, true);
  assert.match(formatGateReport(current), /6806502526/);
  assert.match(formatGateReport(current), /com\.journeydeck\.recorder/);
  assert.match(formatGateReport(current), /iCloud\.com\.journeydeck\.recorder/);
  assert.match(formatGateReport(current), /TestFlight only/);
  assert.match(formatGateReport(current), /never use isolated V3 preview|Never use com\.journeydeck\.recorder\.v3|6814695593/);
  assert.match(formatGateReport(current), /Patrick\/CoS clear/);
  assert.match(formatGateReport(current), /EXPO_TOKEN/);
  assert.doesNotMatch(formatGateReport(current), /TBD-V3-ASC-APP-ID/);
  assert.equal(eas.submit.production.ios.ascAppId, '6806502526');

  const stolenPreview = structuredClone(eas);
  stolenPreview.submit['v3-testflight'].ios.ascAppId = FORBIDDEN_V3_PREVIEW_ASC_APP_ID;
  const stolen = evaluateV3TestflightGate(stolenPreview, { authorize: true });
  assert.equal(stolen.blocked, true);
  assert.match(stolen.reasons.join('\n'), /6814695593/);

  const leftoverTbd = structuredClone(eas);
  leftoverTbd.submit['v3-testflight'].ios.ascAppId = 'TBD-V3-ASC-APP-ID';
  const tbd = evaluateV3TestflightGate(leftoverTbd, { authorize: true });
  assert.equal(tbd.blocked, true);
  assert.match(tbd.reasons.join('\n'), /6806502526/);

  const previewVariant = structuredClone(eas);
  previewVariant.build['v3-testflight'].env.APP_VARIANT = 'v3-preview';
  previewVariant.build['v3-testflight'].channel = 'v3-preview';
  const previewBlocked = evaluateV3TestflightGate(previewVariant, { authorize: true });
  assert.equal(previewBlocked.blocked, true);
  assert.match(previewBlocked.reasons.join('\n'), /v3-store/);
  assert.match(previewBlocked.reasons.join('\n'), /production/);

  const open = evaluateV3TestflightGate(eas, { authorize: true });
  assert.equal(open.blocked, false);
  assert.equal(open.readyId, true);
});

test('gate CLI fails closed on the committed eas.json and never calls eas', () => {
  assert.equal(parseAuthorizeFlag('false'), false);
  assert.equal(parseAuthorizeFlag('true'), true);
  const { status, report } = run({ AUTHORIZE_EAS_BUILD_AND_SUBMIT: 'false' }, fileURLToPath(new URL('..', import.meta.url)));
  assert.equal(status, 1);
  assert.match(report, /npx eas-cli build --platform ios --profile v3-testflight/);
  assert.match(report, /npx eas-cli submit --platform ios --profile v3-testflight/);
  assert.match(report, /6806502526/);
  assert.match(report, /6814695593/);
  assert.match(report, /Patrick\/CoS clear/);
  assert.match(report, /BLOCKED/);
  assert.match(report, /TestFlight only/);
  assert.doesNotMatch(report, /TBD-V3-ASC-APP-ID/);
});

test('V3 TestFlight workflow is dispatch-only, free-runner, and does not invoke EAS', () => {
  const candidates = [
    new URL('../../../.github/workflows/ios-v3-testflight.yml', import.meta.url),
    new URL('../.github/workflows/ios-v3-testflight.yml', import.meta.url),
  ];
  let text = '';
  for (const url of candidates) {
    try { text = readFileSync(url, 'utf8').replace(/\r\n/g, '\n'); break; } catch { /* mobile snapshot or main repository */ }
  }
  assert.match(text, /^name: JourneyDeck V3 TestFlight$/m);
  assert.match(text, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(text, /^  (push|pull_request|schedule):/m);
  assert.match(text, /authorize_eas_build_and_submit:[\s\S]*default: false/);
  assert.match(text, /^\s+runs-on: ubuntu-latest$/m);
  assert.doesNotMatch(text, /runs-on: (macos-|windows-)/);
  assert.match(text, /EXPO_TOKEN/);
  assert.match(text, /6806502526/);
  assert.match(text, /6814695593/);
  assert.match(text, /APP_VARIANT = 'v3-store'/);
  assert.match(text, /TestFlight only/);
  assert.doesNotMatch(text, /TBD-V3-ASC-APP-ID/);
  assert.match(text, /npx eas-cli build --platform ios --profile v3-testflight/);
  assert.match(text, /scripts\/v3-testflight-gate\.mjs/);
  assert.doesNotMatch(text, /IOS_DISTRIBUTION_P12|IOS_V3_PROFILE_BASE64/);
  const uncommented = text.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
  assert.doesNotMatch(uncommented, /^\s+(npx\s+)?eas(-cli)?\s+(build|submit)/m);
});
