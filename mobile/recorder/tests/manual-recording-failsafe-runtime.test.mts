import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/manual-recording-failsafe-runtime.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(hangCredentials: boolean, failStop = false, failCompletion = false) {
  let claimed = false;
  const calls: string[] = [];
  const dependencies: Record<string, any> = {
    './credentials': { loadConnection: () => { calls.push('credentials'); return hangCredentials ? new Promise(() => {}) : Promise.resolve(null); } },
    './automatic-drive-state': {}, './manual-recording-failsafe': {},
    './lastfm-sync': { queueLastFmForCompletedSession: () => calls.push('lastfm') },
    './observability': { observeJourneyDeckEvent() {} },
    './completion-jobs': { processPendingCompletionJobs: () => { calls.push('enrichment'); return new Promise(() => {}); } },
    './storage': {
      claimManualSessionForFailsafeFinish: () => { if (claimed) return false; claimed = true; calls.push('claim'); return true; },
      completeSessionLocally: () => { calls.push('completed'); if (failCompletion) throw Error('SQLITE_FULL'); return false; }, // Archive may still be retrying.
    },
    './tracking': { stopLocationTracking: async () => { calls.push('stop'); if (failStop) throw new Error('unavailable'); } },
  };
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(name in dependencies, name); return dependencies[name];
  } });
  return { finish: exports.finishManualRecordingForFailsafe, calls };
}

for (const hangCredentials of [true, false]) {
  test(`local stop does not wait for ${hangCredentials ? 'Keychain' : 'enrichment'} and concurrent attempts finish once`, async () => {
    const { finish, calls } = fixture(hangCredentials);
    const decision = { shouldFinish: true, reason: 'stationary_timeout', inactiveForMs: 600_000 };
    const result = await Promise.all([finish('a', decision), finish('a', decision)]);
    assert.deepEqual(result, [true, false]);
    assert.deepEqual(calls.slice(0, 3), ['claim', 'completed', 'stop']);
    assert.equal(calls.filter(call => call === 'completed').length, 1);
  });
}

test('a transport stop rejection leaves the session completed locally', async () => {
  const { finish, calls } = fixture(false, true);
  assert.equal(await finish('a', { shouldFinish: true, reason: 'stationary_timeout' }, null), true);
  assert.deepEqual(calls.slice(0, 3), ['claim', 'completed', 'stop']);
});

test('after claiming finish, a completion write failure still stops GPS and does not announce success', async () => {
  const { finish, calls } = fixture(false, false, true);
  await assert.rejects(finish('a', { shouldFinish: true, reason: 'stationary_timeout' }, null), /SQLITE_FULL/);
  assert.deepEqual(calls, ['claim', 'completed', 'stop']);
});
