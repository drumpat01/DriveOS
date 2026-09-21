#!/usr/bin/env node
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT = join(SCRIPT_DIR, '..');
const DEFAULT_BASELINE = join(DEFAULT_PROJECT, 'native-fingerprint.ios.json');
const JS_ONLY_UPDATE = [
  'Native iOS fingerprint is unchanged. Prefer EAS Update over a native rebuild:',
  '  cd mobile/recorder',
  '  $env:APP_VARIANT = "v3-preview"',
  '  npx eas-cli update --channel v3-preview --environment preview --platform ios --message "Describe the JS/asset change"',
  'Do not publish until that update is explicitly authorized. Installed binaries still need runtime 3.0.0-preview.4.',
].join('\n');

export function parseArgs(argv) {
  const options = { githubOutput: false, json: false, writeCurrent: '', project: '', baseline: '' };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--github-output') options.githubOutput = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--write-current') options.writeCurrent = argv[++index];
    else if (arg === '--project') options.project = argv[++index];
    else if (arg === '--baseline') options.baseline = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function loadBaseline(path) {
  if (!existsSync(path)) return { hash: null, missing: true, path };
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return { ...parsed, missing: false, path, hash: parsed.hash || null };
}

export function compareIosFingerprint(currentHash, baseline) {
  if (!currentHash) throw new Error('Current iOS fingerprint hash is empty');
  if (!baseline?.hash) {
    return { nativeRebuild: true, reason: 'missing-baseline', currentHash, baselineHash: null };
  }
  if (currentHash === baseline.hash) {
    return { nativeRebuild: false, reason: 'unchanged', currentHash, baselineHash: baseline.hash };
  }
  return { nativeRebuild: true, reason: 'native-delta', currentHash, baselineHash: baseline.hash };
}

export function formatDecision(decision) {
  if (decision.reason === 'unchanged') return JS_ONLY_UPDATE;
  if (decision.reason === 'missing-baseline') {
    return `No committed iOS fingerprint hash at ${decision.baselinePath || 'native-fingerprint.ios.json'}. Fail closed: compile a native archive, then record the hash.`;
  }
  return `iOS native fingerprint changed (${decision.baselineHash} -> ${decision.currentHash}). Compile a native archive.`;
}

export function emitGithub(decision, envPath, outputPath) {
  const rebuild = decision.nativeRebuild ? 'true' : 'false';
  const lines = [
    `NATIVE_REBUILD=${rebuild}`,
    `FINGERPRINT_HASH=${decision.currentHash}`,
    `FINGERPRINT_REASON=${decision.reason}`,
  ];
  if (envPath) appendFileSync(envPath, `${lines.join('\n')}\n`);
  if (outputPath) appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

export async function loadFingerprintApi(projectRoot) {
  const require = createRequire(join(projectRoot, 'package.json'));
  for (const id of ['expo/fingerprint', '@expo/fingerprint']) {
    try {
      return require(id);
    } catch {
      // Try the next resolver. The Expo 58 package is a transitive dependency.
    }
  }
  throw new Error('Unable to load expo/fingerprint. Run npm ci in mobile/recorder first.');
}

export async function generateIosFingerprint(projectRoot, api = null) {
  const fingerprintApi = api ?? await loadFingerprintApi(projectRoot);
  if (typeof fingerprintApi.createFingerprintAsync !== 'function') {
    throw new Error('createFingerprintAsync is missing from expo/fingerprint');
  }
  return fingerprintApi.createFingerprintAsync(projectRoot, { platforms: ['ios'], silent: true });
}

export async function run(argv, io = {}) {
  const options = parseArgs(argv);
  const projectRoot = resolve(options.project || io.project || DEFAULT_PROJECT);
  const baselinePath = resolve(options.baseline || io.baseline || DEFAULT_BASELINE);
  const baseline = loadBaseline(baselinePath);
  const fingerprint = io.fingerprint || await generateIosFingerprint(projectRoot, io.fingerprintApi);
  const decision = {
    ...compareIosFingerprint(fingerprint.hash, baseline),
    baselinePath,
    sources: fingerprint.sources ?? [],
  };
  const currentRecord = {
    platform: 'ios',
    preset: 'balanced',
    runtimeVersion: '3.0.0-preview.4',
    channel: 'v3-preview',
    hash: fingerprint.hash,
    recordedAt: new Date().toISOString(),
  };
  if (options.writeCurrent) writeFileSync(options.writeCurrent, `${JSON.stringify(currentRecord, null, 2)}\n`);
  if (options.githubOutput) {
    emitGithub(decision, io.githubEnv || process.env.GITHUB_ENV, io.githubOutput || process.env.GITHUB_OUTPUT);
  }
  const message = formatDecision(decision);
  if (options.json) {
    return { decision, currentRecord, message, fingerprint };
  }
  if (!io.silent) console.log(message);
  return { decision, currentRecord, message, fingerprint };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
