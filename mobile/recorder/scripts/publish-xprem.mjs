#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(mobileRoot, '../..');
const serverUrl = 'https://ota.journeydeck.me/manifest';
const appId = '45dbc2f7-fa8a-4761-8db8-8fac41a4c624';
const targets = {
  'v3-preview': { branch: 'v3-preview', variant: 'v3-preview', internalTesting: '1' },
  'v3-testflight': { branch: 'production', variant: 'v3-store', internalTesting: '0' },
};

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npm run xprem:publish -- --target <v3-preview|v3-testflight> --message "..." [--execute]');
  console.log('Defaults to dry-run. --execute requires explicit authorization for this target.');
  process.exit(0);
}

const parsed = { execute: false };
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--execute') parsed.execute = true;
  else if (arg === '--target' || arg === '--message') {
    const value = args[++i];
    if (!value || value.startsWith('--')) fail(`${arg} requires a value.`);
    parsed[arg.slice(2)] = value;
  } else fail(`Unknown argument: ${arg}`);
}

const target = targets[parsed.target];
if (!target) fail('Select --target v3-preview or --target v3-testflight.');
if (!parsed.message || parsed.message.trim().length < 8) fail('--message must describe the change.');
if (!/^[A-Za-z0-9][A-Za-z0-9 .,_()-]{7,119}$/.test(parsed.message.trim())) {
  fail('--message must use plain text without shell control characters.');
}
if (process.env.EAS_BUILD_PROFILE) fail('Unset EAS_BUILD_PROFILE before publishing an xprem update.');

const configPath = resolve(mobileRoot, 'app.config.js');
const basePath = resolve(mobileRoot, 'app.json');
if (!existsSync(configPath) || !existsSync(basePath)) fail('JourneyDeck mobile app config is missing.');
const oldVariant = process.env.APP_VARIANT;
process.env.APP_VARIANT = target.variant;
let config;
try {
  config = require(configPath)({ config: JSON.parse(readFileSync(basePath, 'utf8')).expo });
} finally {
  if (oldVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = oldVariant;
}
if (config.updates?.url !== serverUrl || config.updates?.requestHeaders?.['expo-app-id'] !== appId ||
    config.updates?.requestHeaders?.['expo-channel-name'] !== target.branch ||
    config.updates?.requestHeaders?.['xprem-branch'] !== target.branch ||
    !config.updates?.codeSigningCertificate ||
    !existsSync(resolve(mobileRoot, config.updates.codeSigningCertificate))) {
  fail('The selected V3 app config does not match the local xprem server, channel, or certificate.');
}

const git = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
if (git.status !== 0) fail('Unable to inspect Git state.');
const command = ['--yes', 'eoas@3.2.2', 'publish', '--branch', target.branch, '--platform', 'ios',
  '--message', parsed.message.trim(), '--nonInteractive'];
console.log(`xprem target: ${parsed.target}; branch/channel: ${target.branch}; platform: ios`);
console.log(`Server: ${serverUrl}; app: ${appId}; runtime: ${config.runtimeVersion}`);
console.log(`Command: npx ${command.join(' ')}`);

if (!parsed.execute) {
  console.log('Dry-run only. No update was published.');
  process.exit(0);
}
if (!process.env.EOO_TOKEN) fail('Set EOO_TOKEN in the process environment before publishing.');
if (git.stdout.trim()) fail('Commit or otherwise resolve working-tree changes before publishing; no files were staged.');

const result = spawnSync('npx', command, {
  cwd: mobileRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    APP_VARIANT: target.variant,
    RELEASE_CHANNEL: target.branch,
    EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING: target.internalTesting,
  },
});
process.exit(result.status ?? 1);
