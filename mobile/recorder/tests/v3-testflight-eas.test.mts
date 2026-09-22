import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const configureApp = require('../app.config.js');
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const {
  V2_ASC_APP_ID,
  V3_ASC_APP_ID,
  evaluateV3TestflightGate,
  formatGateReport,
  isRealV3AscAppId,
  parseAuthorizeFlag,
  run,
} = await import('../scripts/v3-testflight-gate.mjs');

const base = {
  name: 'JourneyDeck',
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

test('v3-testflight is store distribution on the V3 preview channel and does not use the V2 listing', () => {
  const profile = eas.build['v3-testflight'];
  assert.equal(profile.distribution, 'store');
  assert.notEqual(profile.distribution, 'internal');
  assert.equal(profile.channel, 'v3-preview');
  assert.equal(profile.environment, 'preview');
  assert.equal(profile.env.APP_VARIANT, 'v3-preview');
  assert.equal(profile.env.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING, '1');
  assert.equal(profile.ios.simulator, false);
  assert.equal(profile.autoIncrement, true);
  assert.equal(eas.submit.production.ios.ascAppId, V2_ASC_APP_ID);
  assert.equal(eas.submit.production.ios.ascAppId, '6806502526');
  assert.equal(eas.submit['v3-testflight'].ios.ascAppId, V3_ASC_APP_ID);
  assert.equal(eas.submit['v3-testflight'].ios.ascAppId, '6814695593');
  assert.notEqual(eas.submit['v3-testflight'].ios.ascAppId, V2_ASC_APP_ID);
  assert.equal(isRealV3AscAppId(eas.submit['v3-testflight'].ios.ascAppId), true);
});

test('V3 TestFlight config selects the V3 bundle and keeps the preview.4 runtime string', () => {
  withEnv({ APP_VARIANT: undefined, EAS_BUILD_PROFILE: 'v3-testflight' }, () => {
    const config = configureApp({ config: base });
    assert.equal(config.ios.bundleIdentifier, 'com.journeydeck.recorder.v3');
    assert.equal(config.runtimeVersion, '3.0.0-preview.4');
    assert.equal(config.updates.requestHeaders['expo-channel-name'], 'v3-preview');
  });
});

test('the V3 TestFlight gate accepts the wired V3 id and still requires CoS clear', () => {
  const current = evaluateV3TestflightGate(eas, { authorize: false });
  assert.equal(current.blocked, true);
  assert.equal(current.readyId, true);
  assert.match(formatGateReport(current), /6814695593/);
  assert.match(formatGateReport(current), /Patrick\/CoS clear/);
  assert.match(formatGateReport(current), /EXPO_TOKEN/);
  assert.doesNotMatch(formatGateReport(current), /TBD-V3-ASC-APP-ID/);
  assert.doesNotMatch(JSON.stringify(eas.submit['v3-testflight']), /6806502526/);
  assert.equal(eas.submit.production.ios.ascAppId, '6806502526');

  const stolenV2 = structuredClone(eas);
  stolenV2.submit['v3-testflight'].ios.ascAppId = V2_ASC_APP_ID;
  const stolen = evaluateV3TestflightGate(stolenV2, { authorize: true });
  assert.equal(stolen.blocked, true);
  assert.match(stolen.reasons.join('\n'), /never use V2/);

  const leftoverTbd = structuredClone(eas);
  leftoverTbd.submit['v3-testflight'].ios.ascAppId = 'TBD-V3-ASC-APP-ID';
  const tbd = evaluateV3TestflightGate(leftoverTbd, { authorize: true });
  assert.equal(tbd.blocked, true);
  assert.match(tbd.reasons.join('\n'), /6814695593/);

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
  assert.match(report, /6814695593/);
  assert.match(report, /Patrick\/CoS clear/);
  assert.match(report, /BLOCKED/);
  assert.doesNotMatch(report, /TBD-V3-ASC-APP-ID/);
});

test('V3 TestFlight workflow is dispatch-only, free-runner, and does not invoke EAS', () => {
  const candidates = [
    new URL('../../../.github/workflows/ios-v3-testflight.yml', import.meta.url),
    new URL('../.github/workflows/ios-v3-testflight.yml', import.meta.url),
  ];
  let text = '';
  for (const url of candidates) {
    try { text = readFileSync(url, 'utf8'); break; } catch { /* mobile snapshot or main repository */ }
  }
  assert.match(text, /^name: JourneyDeck V3 TestFlight$/m);
  assert.match(text, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(text, /^  (push|pull_request|schedule):/m);
  assert.match(text, /authorize_eas_build_and_submit:[\s\S]*default: false/);
  assert.match(text, /^\s+runs-on: ubuntu-latest$/m);
  assert.doesNotMatch(text, /runs-on: (macos-|windows-)/);
  assert.match(text, /EXPO_TOKEN/);
  assert.match(text, /6814695593/);
  assert.doesNotMatch(text, /TBD-V3-ASC-APP-ID/);
  assert.match(text, /npx eas-cli build --platform ios --profile v3-testflight/);
  assert.match(text, /scripts\/v3-testflight-gate\.mjs/);
  assert.doesNotMatch(text, /IOS_DISTRIBUTION_P12|IOS_V3_PROFILE_BASE64/);
  const uncommented = text.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
  assert.doesNotMatch(uncommented, /^\s+(npx\s+)?eas(-cli)?\s+(build|submit)/m);
});
