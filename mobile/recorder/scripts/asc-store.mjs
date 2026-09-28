#!/usr/bin/env node
// Thin wrapper around the App Store Connect CLI (`asc`) for JourneyDeck store tasks.
// Credentials come from env vars pointing at a local .p8 outside the repo; the key
// itself is never read or stored here. The Windows keychain backend in asc 5.7 drops
// stored profiles after one use, so env-based auth is the reliable path.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP_ID = '6806502526';
const KEY_ID = process.env.ASC_KEY_ID || '3S6UPKF5SP';
const ISSUER_ID = process.env.ASC_ISSUER_ID || 'd3edec2b-d549-410b-97a7-6ce5c0850d88';
const KEY_PATH = process.env.ASC_PRIVATE_KEY_PATH || path.join(os.homedir(), '.asc', `AuthKey_${KEY_ID}.p8`);
const METADATA_DIR = './store/metadata';

function resolveAsc() {
  const wingetExe = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft', 'WinGet', 'Packages', 'Rorkai.ASC_Microsoft.Winget.Source_8wekyb3d8bbwe', 'asc.exe',
  );
  return process.platform === 'win32' && existsSync(wingetExe) ? wingetExe : 'asc';
}

function run(args) {
  const result = spawnSync(resolveAsc(), args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ASC_KEY_ID: KEY_ID,
      ASC_ISSUER_ID: ISSUER_ID,
      ASC_PRIVATE_KEY_PATH: KEY_PATH,
      ASC_BYPASS_KEYCHAIN: '1',
    },
  });
  if (result.error) {
    console.error(`Failed to run asc: ${result.error.message}. Install with: winget install --id Rorkai.ASC -e`);
    process.exit(1);
  }
  return result.status ?? 1;
}

const [command, version] = process.argv.slice(2);
const needsVersion = ['validate', 'pull', 'plan', 'keywords'];
if (needsVersion.includes(command) && !version) {
  console.error(`Usage: npm run store:${command} -- <version>   e.g. npm run store:${command} -- 2.1`);
  process.exit(2);
}
if (!existsSync(KEY_PATH)) {
  console.error(`App Store Connect key not found at ${KEY_PATH}. Set ASC_PRIVATE_KEY_PATH.`);
  process.exit(1);
}

const commands = {
  validate: () => ['validate', '--app', APP_ID, '--version', version, '--output', 'table'],
  pull: () => ['metadata', 'pull', '--app', APP_ID, '--version', version, '--platform', 'IOS', '--dir', METADATA_DIR],
  // Preview only; applying changes to the live listing stays a deliberate manual step.
  plan: () => ['metadata', 'plan', '--app', APP_ID, '--version', version, '--dir', METADATA_DIR],
  keywords: () => ['metadata', 'keywords', 'audit', '--app', APP_ID, '--version', version, '--output', 'table'],
  review: () => ['review', 'status', '--app', APP_ID],
  subscriptions: () => ['subscriptions', 'list', '--group-id', '22349553', '--output', 'table'],
};

if (!commands[command]) {
  console.error(`Unknown command "${command}". Use one of: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}
process.exit(run(commands[command]()));
