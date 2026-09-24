import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function fixture(verified = true) {
  const secrets = new Map<string, string>();
  const calls: { path: string; body: any }[] = [];
  const source = readFileSync(new URL('../src/tessie-direct.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  const modules: Record<string, any> = {
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { edge: { url: 'https://edge.example.test' } } } } },
    './network-request': { requestPrivacyEdgeJson: async (_edge: string, path: string, body: any) => {
      calls.push({ path, body });
      if (path.endsWith('/verify')) return { valid: verified, vehicleCount: verified ? 1 : 0 };
      if (path.endsWith('/sync')) return { generatedAt: new Date().toISOString(), vehicles: [], charges: [], drives: [] };
      return { available: false, sampledAt: new Date().toISOString() };
    } },
    './profile-secure-store': {
      loadProfileSecret: async (key: string) => secrets.get(key) ?? null,
      saveProfileSecret: async (key: string, value: string) => { secrets.set(key, value); },
      deleteProfileSecret: async (key: string) => { secrets.delete(key); },
      deleteProfileSecretAndOwnedLegacy: async (key: string) => { secrets.delete(key); },
    },
    '../modules/journeydeck-membership': { getMembershipStatus: async () => ({ nativeModuleAvailable: true, tier: 'free' }) },
    './membership-entitlements': { entitlementsForTestFlightMembership: () => ({ tessieAccess: true }) },
    './release-features': { TESSIE_INTEGRATION_ENABLED: true, TESTFLIGHT_PLUS_UNLOCKED: true },
  };
  vm.runInNewContext(output, { exports, require: (name: string) => modules[name], Date, Number, Math, Promise, Error });
  return { api: exports, secrets, calls };
}

test('TestFlight Tessie verifies before storing a profile token, then syncs and disconnects', async () => {
  const { api, secrets, calls } = fixture();
  const token = 'test-token-with-enough-characters';
  assert.equal(await api.connectTessieDirect(token), 1);
  assert.equal(await api.tessieDirectStatus(), 'connected');
  await api.syncTessieDirect();
  assert.deepEqual(calls.map(call => call.path), ['/api/auth/tessie/verify', '/api/vehicle/tessie/sync']);
  assert.equal(calls[1]?.body.accessToken, token);
  await api.disconnectTessieDirect();
  assert.equal(await api.tessieDirectStatus(), 'not_connected');
  assert.equal(secrets.size, 0);
});

test('rejected Tessie token is never stored', async () => {
  const { api, secrets } = fixture(false);
  await assert.rejects(api.connectTessieDirect('test-token-with-enough-characters'), /did not accept/);
  assert.equal(secrets.size, 0);
});
