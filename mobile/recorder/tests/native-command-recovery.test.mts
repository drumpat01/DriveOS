import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecorderCommands } from '../modules/journeydeck-recorder/src/RecorderCommands.ts';
import { createCloudKitRequestGate } from '../modules/journeydeck-cloudkit/src/CloudKitRequestGate.ts';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const status: any = { statusReliable: true, sessionId: 'native_recording_test', controlToken: 'fixture-token' };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('lost Start response reconciles its original operation instead of creating another journey', async () => {
  const late = deferred<any>(); let calls = 0; let outcome: any = { state: 'unknown' };
  const api = createRecorderCommands({ getStatusAsync: async () => status,
    executeCommandAsync: (id, action, session, token, expiry) => {
      assert.equal(id, 'operation-one'); assert.equal(action, 'start'); assert.equal(token, status.controlToken);
      assert.ok(expiry > Date.now() / 1000); calls++; return late.promise;
    }, getCommandOutcomeAsync: async id => { assert.equal(id, 'operation-one'); return outcome; },
  }, () => 'unused', 5);
  await assert.rejects(api('start', '', 'operation-one'), /delayed/);
  await assert.rejects(api('start', '', 'operation-two'), /still pending/);
  outcome = { state: 'applied' };
  late.resolve({ ...status, command: outcome });
  await api('start', '', 'operation-two');
  assert.equal(calls, 1);
});

test('a terminal rejection is reported and a deliberate later action can proceed', async () => {
  let calls = 0;
  const api = createRecorderCommands({ getStatusAsync: async () => status,
    executeCommandAsync: async () => ({ ...status, command: ++calls === 1
      ? { state: 'rejected', errorCode: 'session_changed' } : { state: 'applied' } }),
    getCommandOutcomeAsync: async () => ({ state: 'unknown' }),
  }, () => 'id');
  await assert.rejects(api('pause', status.sessionId), /session_changed/);
  await api('pause', status.sessionId);
  assert.equal(calls, 2);
});

test('simultaneous controls cannot overwrite an unresolved operation', async () => {
  const late = deferred<any>(); let calls = 0;
  const api = createRecorderCommands({ getStatusAsync: async () => status,
    executeCommandAsync: () => { calls++; return late.promise; },
    getCommandOutcomeAsync: async () => ({ state: 'pending' }),
  }, () => 'id', 5);
  const attempts = await Promise.allSettled([api('pause', status.sessionId), api('finish', status.sessionId)]);
  assert.equal(calls, 1); assert.ok(attempts.every(x => x.status === 'rejected'));
  late.resolve({ ...status, command: { state: 'applied' } });
});

test('pending Finish recovery prevents a new Resume until the finish is resolved', async () => {
  let calls = 0;
  const api = createRecorderCommands({ getStatusAsync: async () => status,
    executeCommandAsync: async () => { calls++; return { ...status, command: { state: 'pending', errorCode: 'database_write_failed' } }; },
    getCommandOutcomeAsync: async () => ({ state: 'pending' }),
  }, () => 'id');
  await assert.rejects(api('finish', status.sessionId), /database_write_failed/);
  await assert.rejects(api('resume', status.sessionId), /still pending/);
  assert.equal(calls, 1);
});

test('a rejected bridge promise with unknown native outcome remains fenced until native expiry', async () => {
  let calls = 0;
  const api = createRecorderCommands({ getStatusAsync: async () => status,
    executeCommandAsync: async () => { calls++; throw new Error('bridge disconnected'); },
    getCommandOutcomeAsync: async () => ({ state: 'unknown' }),
  }, () => 'id');
  await assert.rejects(api('pause', status.sessionId), /disconnected/);
  await assert.rejects(api('resume', status.sessionId), /still pending/);
  assert.equal(calls, 1, 'a bridge error is not proof that a queued native action was cancelled');
});

test('CloudKit timeout releases the caller but fences native work and discards late acknowledgements', async () => {
  const gate = createCloudKitRequestGate(5), late = deferred<string>(); let acknowledgements = 0;
  await assert.rejects(gate(() => late.promise).then(() => { acknowledgements++; }), /timed out/);
  await assert.rejects(gate(async () => assert.fail('overlapped native request')), /recovering/);
  late.resolve('saved'); await Promise.resolve(); await Promise.resolve();
  assert.equal(acknowledgements, 0);
  assert.equal(await gate(async () => 'next pull'), 'next pull');
});

test('late CloudKit rejection and synchronous bridge failure both leave the gate reusable', async () => {
  const gate = createCloudKitRequestGate(5), late = deferred<string>();
  await assert.rejects(gate(() => late.promise), /timed out/);
  late.reject(new Error('native cancelled')); await Promise.resolve(); await Promise.resolve();
  await assert.rejects(gate(() => { throw new Error('bridge'); }), /bridge/);
  assert.equal(await gate(async () => 'recovered'), 'recovered');
});

test('every CloudKit bridge entry uses the response deadline, including capabilities and token mutations', async () => {
  const compiled = ts.transpileModule(readFileSync(new URL('../modules/journeydeck-cloudkit/index.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const entries = [
    ['getCloudKitAccountStatus', 'getAccountStatusAsync'], ['getCloudKitCapabilities', 'getCapabilitiesAsync'],
    ['ensureCloudKitPrivateZone', 'ensurePrivateZoneAsync'], ['deleteCloudKitPrivateZone', 'deletePrivateZoneAsync'],
    ['pushCloudKitRecords', 'pushRecordsAsync'], ['pullCloudKitChanges', 'pullChangesAsync'],
    ['commitCloudKitChangeToken', 'commitChangeTokenAsync'], ['resetCloudKitChangeToken', 'resetChangeTokenAsync'],
  ];
  for (const [publicName, nativeName] of entries) {
    const late = deferred<any>(); const module = { exports: {} as any }; let dispatched = 0;
    new Function('require', 'module', 'exports', compiled)((name: string) => {
      if (name === './src/CloudKitRequestGate') return { createCloudKitRequestGate: () => createCloudKitRequestGate(5) };
      if (name === './src/JourneyDeckCloudKitModule') return { __esModule: true, default: { [nativeName]: () => { dispatched++; return late.promise; } } };
      throw new Error(`unexpected dependency ${name}`);
    }, module, module.exports);
    await assert.rejects(module.exports[publicName]('scope', []), /timed out/, publicName);
    await assert.rejects(module.exports[publicName]('scope', []), /recovering/, publicName);
    assert.equal(dispatched, 1); late.resolve(undefined);
  }
});
