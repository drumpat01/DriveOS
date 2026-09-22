#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const targets = {
  'v3-preview': {
    channel: 'v3-preview',
    environment: 'preview',
    appVariant: 'v3-preview',
    internalTesting: '1',
    note: 'Patrick internal V3 preview path',
  },
  'v3-testflight': {
    channel: 'production',
    environment: 'production',
    appVariant: 'v3-store',
    internalTesting: '0',
    note: 'V3 live identity / TestFlight only',
  },
};

function usage() {
  console.log(`Usage:
  node scripts/publish-ota.mjs --target <v3-preview|v3-testflight> --message "..." [--execute]

Defaults to dry-run. Add --execute only after Patrick explicitly authorized the exact target.`);
}

function parseArgs(argv) {
  const args = { execute: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') {
      args.execute = true;
    } else if (arg === '--target' || arg === '--message') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      args[arg.slice(2)] = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', ...options });
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const mobileRoot = resolve(repoRoot, 'mobile/recorder');
const parsed = parseArgs(process.argv.slice(2));

if (parsed.help) {
  usage();
  process.exit(0);
}

const selected = targets[parsed.target];
if (!selected) {
  usage();
  fail('Select --target v3-preview or --target v3-testflight.');
}

if (!parsed.message || parsed.message.trim().length < 8) {
  fail('--message must describe the OTA change.');
}

if (!existsSync(resolve(mobileRoot, 'app.config.js')) || !existsSync(resolve(mobileRoot, 'eas.json'))) {
  fail('Run this from the JourneyDeck repository with mobile/recorder present.');
}

const branch = run('git', ['branch', '--show-current'], { cwd: repoRoot });
const head = run('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot });
const status = run('git', ['status', '--short'], { cwd: repoRoot });

if (branch.status !== 0 || head.status !== 0 || status.status !== 0) {
  fail('Unable to inspect Git state before OTA.');
}

const command = [
  'eas-cli',
  'update',
  '--channel',
  selected.channel,
  '--environment',
  selected.environment,
  '--platform',
  'ios',
  '--message',
  parsed.message.trim(),
];

console.log('JourneyDeck OTA publish wrapper');
console.log(`Target: ${parsed.target} (${selected.note})`);
console.log(`Channel: ${selected.channel}`);
console.log(`Environment: ${selected.environment}`);
console.log('Platform: ios');
console.log(`APP_VARIANT: ${selected.appVariant}`);
console.log(`EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING: ${selected.internalTesting}`);
console.log(`Git: ${branch.stdout.trim() || 'detached HEAD'} @ ${head.stdout.trim()}`);
console.log(status.stdout.trim() ? `Git status:\n${status.stdout.trim()}` : 'Git status: clean');
console.log(`Command: npx ${command.join(' ')}`);

if (!parsed.execute) {
  console.log('\nDry-run only. Re-run with --execute after explicit authorization to publish this exact target.');
  process.exit(0);
}

if (parsed.target === 'v3-testflight') {
  console.log('\nPublishing to production channel for V3 TestFlight/live identity. This must not be used for App Review submit.');
}

const result = spawnSync('npx', command, {
  cwd: mobileRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    APP_VARIANT: selected.appVariant,
    EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING: selected.internalTesting,
  },
});

process.exit(result.status ?? 1);
