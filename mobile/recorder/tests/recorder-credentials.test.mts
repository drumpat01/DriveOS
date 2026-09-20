import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function harness() {
  const values = new Map<string, string>(); let generated = 0, failWrite = false;
  const module = { exports: {} as any };
  const mocks: Record<string, any> = {
    'expo-crypto': { randomUUID: () => `test-device-${++generated}` },
    'expo-secure-store': { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'test', getItemAsync: async (key: string) => values.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { if (failWrite) throw Error('Keychain locked'); values.set(key, value); } },
    './auth': { getCurrentUser: () => ({ id: 'test-owner' }) },
  };
  const code = ts.transpileModule(readFileSync(new URL('../src/credentials.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] });
  return { api: module.exports, values, fail: (value: boolean) => { failWrite = value; } };
}

test('concurrent first-launch callers use one durable recorder device identity', async () => {
  const h = harness();
  const ids = await Promise.all([h.api.loadOrCreateDeviceId(), h.api.loadOrCreateDeviceId(), h.api.loadOrCreateDeviceId()]);
  assert.equal(new Set(ids).size, 1);
  assert.equal(ids[0], h.values.get('journeydeck.recorder.device'));
});

test('a failed device identity write is retried without claiming a volatile identity persisted', async () => {
  const h = harness(); h.fail(true);
  await assert.rejects(h.api.loadOrCreateDeviceId(), /Keychain locked/);
  h.fail(false);
  const id = await h.api.loadOrCreateDeviceId();
  assert.equal(id, h.values.get('journeydeck.recorder.device'));
});
