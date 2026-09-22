#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT = join(SCRIPT_DIR, '..');
export const V2_ASC_APP_ID = '6806502526';
export const V3_ASC_APP_ID_TBD = 'TBD-V3-ASC-APP-ID';

export const INTENDED_COMMANDS = [
  'npx eas-cli build --platform ios --profile v3-testflight --non-interactive',
  'npx eas-cli submit --platform ios --profile v3-testflight --non-interactive',
];

export const REQUIRED_SECRETS = [
  'EXPO_TOKEN — Expo account token for eas-cli. This skeleton never reads it and never invokes EAS.',
];

export function isRealV3AscAppId(value) {
  return typeof value === 'string' && /^\d+$/.test(value) && value !== V2_ASC_APP_ID;
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
    if (build.channel !== 'v3-preview') reasons.push('v3-testflight channel must remain v3-preview');
    if (build.environment !== 'preview') reasons.push('v3-testflight environment must remain preview');
    if (build.env?.APP_VARIANT !== 'v3-preview') reasons.push('v3-testflight APP_VARIANT must be v3-preview');
    if (build.ios?.simulator !== false) reasons.push('v3-testflight ios.simulator must be false');
    if (build.autoIncrement !== true) reasons.push('v3-testflight autoIncrement must be true');
  }

  if (productionId !== V2_ASC_APP_ID) {
    reasons.push('submit.production.ios.ascAppId must remain the frozen V2 listing id');
  }
  if (ascAppId === V2_ASC_APP_ID) {
    reasons.push('v3-testflight must never use V2 ascAppId 6806502526');
  }
  if (!isRealV3AscAppId(ascAppId)) {
    reasons.push(`submit.v3-testflight.ios.ascAppId is TBD/blocked (${ascAppId ?? 'missing'}); set a real V3 App Store Connect Apple ID before submit`);
  }
  if (!authorize) {
    reasons.push('no Patrick/CoS clear; authorize_eas_build_and_submit remains false');
  }

  return {
    blocked: reasons.length > 0,
    authorize,
    ascAppId: ascAppId ?? null,
    readyId: isRealV3AscAppId(ascAppId),
    reasons,
    commands: INTENDED_COMMANDS,
  };
}

export function formatGateReport(result) {
  return [
    'JourneyDeck V3 TestFlight EAS wiring gate',
    'V3 TestFlight is not the V2 App Store listing. Bundle com.journeydeck.recorder.v3.',
    'Prefer EAS-managed iOS credentials (eas credentials). Do not reuse ios-v3-device.yml ad hoc secrets.',
    `Required later: ${REQUIRED_SECRETS.join(' ')}`,
    'Intended commands after a real V3 ascAppId and written Patrick/CoS clear (not invoked here):',
    ...result.commands.map(command => `  ${command}`),
    `ascAppId: ${result.ascAppId ?? 'missing'}`,
    result.blocked ? `BLOCKED:\n${result.reasons.map(reason => `- ${reason}`).join('\n')}` : 'Gate open for a later authorized job. This skeleton still does not invoke eas build or eas submit.',
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
