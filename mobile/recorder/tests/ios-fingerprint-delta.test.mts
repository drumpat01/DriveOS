import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const yaml = require('yaml');
const configureApp = require('../app.config.js');
const fingerprintConfig = require('../fingerprint.config.js');
const {
  compareIosFingerprint, emitGithub, formatDecision, loadBaseline, parseArgs, run,
} = await import('../scripts/ios-fingerprint-delta.mjs');

test('SDK 58 fingerprint config pins the balanced preset', () => {
  assert.equal(fingerprintConfig.preset, 'balanced');
});

test('V3, V2 preview, and production embed expo-channel-name for CNG and channel surfing', () => {
  const names = ['APP_VARIANT', 'EAS_BUILD_PROFILE'];
  const previous = names.map(name => process.env[name]);
  const base = { ios: { infoPlist: {}, bundleIdentifier: 'com.journeydeck.recorder' }, updates: { url: 'https://u.expo.dev/ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4' } };
  try {
    delete process.env.EAS_BUILD_PROFILE;
    process.env.APP_VARIANT = 'v3-preview';
    const v3 = configureApp({ config: base });
    assert.equal(v3.runtimeVersion, '3.0.0-preview.4');
    assert.equal(v3.updates.requestHeaders['expo-channel-name'], 'v3-preview');
    process.env.APP_VARIANT = 'v2-preview';
    assert.equal(configureApp({ config: base }).updates.requestHeaders['expo-channel-name'], 'v2-preview');
    delete process.env.APP_VARIANT;
    assert.equal(configureApp({ config: base }).updates.requestHeaders['expo-channel-name'], 'production');
  } finally {
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});

test('fingerprint delta fails closed without a recorded hash and skips native rebuilds when unchanged', () => {
  assert.deepEqual(compareIosFingerprint('abc', { hash: null }).reason, 'missing-baseline');
  assert.equal(compareIosFingerprint('abc', { hash: null }).nativeRebuild, true);
  assert.equal(compareIosFingerprint('abc', { hash: 'abc' }).nativeRebuild, false);
  assert.equal(compareIosFingerprint('def', { hash: 'abc' }).nativeRebuild, true);
  assert.match(formatDecision({ reason: 'unchanged' }), /eas-cli update --channel v3-preview/);
  assert.doesNotMatch(formatDecision({ reason: 'unchanged' }), /eas build/);
});

test('CLI writes GitHub outputs and records the current iOS hash without publishing', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'journeydeck-fingerprint-'));
  try {
    const envPath = join(folder, 'env');
    const outputPath = join(folder, 'output');
    const currentPath = join(folder, 'current.json');
    writeFileSync(envPath, '');
    writeFileSync(outputPath, '');
    writeFileSync(join(folder, 'baseline.json'), JSON.stringify({ hash: 'same' }));
    const result = await run(['--github-output', '--write-current', currentPath, '--baseline', join(folder, 'baseline.json'), '--json'], {
      fingerprint: { hash: 'same', sources: [] },
      githubEnv: envPath,
      githubOutput: outputPath,
      silent: true,
    });
    assert.equal(result.decision.nativeRebuild, false);
    assert.match(readFileSync(envPath, 'utf8'), /NATIVE_REBUILD=false/);
    assert.match(readFileSync(outputPath, 'utf8'), /FINGERPRINT_REASON=unchanged/);
    assert.equal(JSON.parse(readFileSync(currentPath, 'utf8')).hash, 'same');
    assert.equal(JSON.parse(readFileSync(currentPath, 'utf8')).preset, 'balanced');
    emitGithub({ nativeRebuild: true, currentHash: 'new', reason: 'native-delta' }, envPath, outputPath);
    assert.match(readFileSync(envPath, 'utf8'), /NATIVE_REBUILD=true/);
  } finally { rmSync(folder, { recursive: true }); }
});

test('missing baseline file is treated as an absent hash', () => {
  assert.equal(loadBaseline(join(tmpdir(), 'journeydeck-missing-fingerprint.json')).hash, null);
  assert.equal(loadBaseline(join(tmpdir(), 'journeydeck-missing-fingerprint.json')).missing, true);
  assert.deepEqual(parseArgs(['--json', '--github-output']), { githubOutput: true, json: true, writeCurrent: '', project: '', baseline: '' });
});

test('device workflow fingerprints before archiving and can skip the native rebuild', () => {
  const candidates = [new URL('../../../.github/workflows/ios-v3-device.yml', import.meta.url), new URL('../.github/workflows/ios-v3-device.yml', import.meta.url)];
  let text = '';
  for (const url of candidates) { try { text = readFileSync(url, 'utf8'); break; } catch { /* mobile snapshot or main repository */ } }
  const w = yaml.parse(text);
  assert.equal(w.on.workflow_dispatch.inputs.force_native.type, 'boolean');
  assert.match(text, /scripts\/ios-fingerprint-delta\.mjs/);
  assert.match(text, /NATIVE_REBUILD/);
  const archive = w.jobs.build.steps.find((step: { name?: string }) => step.name === 'Compile signed device archive');
  assert.match(String(archive.if), /NATIVE_REBUILD/);
  assert.doesNotMatch(text, /eas build/);
  assert.doesNotMatch(text, /eas update --channel/);
});
