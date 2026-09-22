#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT = join(SCRIPT_DIR, '..');
export const LIVE_ASC_APP_ID = '6806502526';
export const V2_ASC_APP_ID = LIVE_ASC_APP_ID;
export const FORBIDDEN_V3_PREVIEW_ASC_APP_ID = '6814695593';

export const INTENDED_COMMANDS = [
  'npx eas-cli build --platform ios --profile v3-testflight --non-interactive',
  'npx eas-cli submit --platform ios --profile v3-testflight --non-interactive',
];

export const REQUIRED_SECRETS = [
  'EXPO_TOKEN — Expo account token for eas-cli. This skeleton never reads it and never invokes EAS.',
];

export function isLiveListingAscAppId(value) {
  return value === LIVE_ASC_APP_ID;
}

export function evaluateV3TestflightGate(eas, { authorize = false } = {}) {
  const build = eas?.build?.['v3-testflight'];
  const submit = eas?.submit?.['v3-testflight'];
  const productionId = eas?.submit?.production?.ios?.ascAppId;
  const ascAppId = submit?.ios?.ascAppId;
  const reasons = [];

  if (!build) reasons.push('missing build.v3-testflight');
  else {
    if (build.distribution !== 'store') reasons.push('v3-testflight must use store/App Store distribution, not internal');
    if (build.channel !== 'production') reasons.push('v3-testflight channel must be production');
    if (build.environment !== 'production') reasons.push('v3-testflight environment must be production');
    if (build.env?.APP_VARIANT !== 'v3-store') reasons.push('v3-testflight APP_VARIANT must be v3-store so V3 features stay on the live identity');
    if (build.env?.APP_VARIANT === 'v3-preview') reasons.push('v3-testflight must never use APP_VARIANT=v3-preview (that forces the .v3 bundle)');
    if (build.env?.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING !== '0') reasons.push('v3-testflight INTERNAL_TESTING must be 0 for live-store TestFlight');
    if (build.ios?.simulator !== false) reasons.push('v3-testflight ios.simulator must be false');
    if (build.autoIncrement !== true) reasons.push('v3-testflight autoIncrement must be true');
  }

  if (productionId !== LIVE_ASC_APP_ID) {
    reasons.push('submit.production.ios.ascAppId must remain the live listing id 6806502526');
  }
  if (ascAppId === FORBIDDEN_V3_PREVIEW_ASC_APP_ID) {
    reasons.push('v3-testflight must never use isolated V3 preview ascAppId 6814695593');
  }
  if (!isLiveListingAscAppId(ascAppId)) {
    reasons.push(`submit.v3-testflight.ios.ascAppId must be the live listing ${LIVE_ASC_APP_ID} (got ${ascAppId ?? 'missing'}); never use isolated V3 preview ${FORBIDDEN_V3_PREVIEW_ASC_APP_ID}`);
  }
  if (!authorize) {
    reasons.push('no Patrick/CoS clear; authorize_eas_build_and_submit remains false');
  }

  return {
    blocked: reasons.length > 0,
    authorize,
    ascAppId: ascAppId ?? null,
    readyId: isLiveListingAscAppId(ascAppId),
    reasons,
    commands: INTENDED_COMMANDS,
  };
}

export function formatGateReport(result) {
  return [
    'JourneyDeck V3 TestFlight EAS wiring gate',
    'V3 TestFlight targets the LIVE App Store listing. Bundle com.journeydeck.recorder.',
    'Watch com.journeydeck.recorder.watchkitapp. iCloud iCloud.com.journeydeck.recorder.',
    'Production CloudKit is shared with the live app. TestFlight only — NEVER App Store review submit from this stream.',
    'Never use com.journeydeck.recorder.v3, iCloud.com.journeydeck.recorder.v3, or ascAppId 6814695593.',
    'Prefer EAS-managed iOS credentials (eas credentials). Do not reuse ios-v3-device.yml ad hoc secrets.',
    `Required later: ${REQUIRED_SECRETS.join(' ')}`,
    'Intended commands after written Patrick/CoS clear (not invoked here):',
    ...result.commands.map(command => `  ${command}`),
    `ascAppId: ${result.ascAppId ?? 'missing'}`,
    result.blocked ? `BLOCKED:\n${result.reasons.map(reason => `- ${reason}`).join('\n')}` : 'Gate open for a later authorized job. This skeleton still does not invoke eas build or eas submit. TestFlight only — never submit this stream for App Store review.',
  ].join('\n');
}

export function parseAuthorizeFlag(value) {
  return value === 'true' || value === '1' || value === 'yes';
}

function loadEas(projectRoot) {
  return JSON.parse(readFileSync(join(projectRoot, 'eas.json'), 'utf8'));
}

export function run(env = process.env, projectRoot = env.MOBILE_DIR || DEFAULT_PROJECT) {
  const result = evaluateV3TestflightGate(loadEas(projectRoot), {
    authorize: parseAuthorizeFlag(env.AUTHORIZE_EAS_BUILD_AND_SUBMIT),
  });
  const report = formatGateReport(result);
  if (result.blocked) {
    console.error(report);
    return { result, report, status: 1 };
  }
  console.log(report);
  return { result, report, status: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run().status);
}
