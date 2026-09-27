import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function harness() {
  const writes: any[] = [];
  const lastPublishedProEntitlements = new Map<string, { fingerprint: string; at: number }>();
  let fail = false;
  const user = { id: 'local-user', appleSubject: 'apple-user' };
  const mocks: Record<string, any> = {
    '../modules/journeydeck-cloudkit': {
      isJourneyDeckCloudKitAvailable: true,
      getCloudKitAccountStatus: async () => 'available',
      getCloudKitPrivateZoneScopes: async () => ({ canonicalScope: 'a'.repeat(48), existingScopes: [] }),
      ensureCloudKitPrivateZone: async () => {},
      pushCloudKitRecords: async (scope: string, records: any[]) => {
        if (fail) throw Object.assign(new Error('Failed'), { code: 'quota_exceeded' });
        writes.push({ scope, record: records[0] });
        return { savedRecordNames: ['entitlement_pro'], remoteRecords: [], failedRecordNames: [] };
      },
    },
    './auth': { getCurrentUser: () => user },
    './local-store': { isPrivateCloudDeletionPending: () => false },
    './private-icloud-sync-policy': { classifyPrivateICloudSyncError: () => 'unknown' },
    './icloud-sync': { waitForPrivateICloudSyncIdle: async () => {} },
    './pro-entitlement-cache': { lastPublishedProEntitlements },
  };
  const module = { exports: {} as any };
  const source = readFileSync(new URL('../src/pro-entitlement-sync.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id], Date, JSON, Map, Promise, console });
  return { api: module.exports, writes, user, lastPublishedProEntitlements, setFailure: (value: boolean) => { fail = value; } };
}

test('only a verified subscription publishes the exact Pro pointer and keeps one record name', async () => {
  const h = harness();
  const neverSubscribed = { nativeModuleAvailable: true, tier: 'free', activeProductId: null, environment: null, expirationDate: null };
  await h.api.publishProEntitlement(neverSubscribed);
  assert.equal(h.writes.length, 0);
  const paid = {
    nativeModuleAvailable: true, tier: 'paid', activeProductId: 'com.journeydeck.recorder.pro.monthly', environment: 'sandbox',
    expirationDate: '2026-10-01T00:00:00Z', originalTransactionId: '123456789012345',
  };
  await h.api.publishProEntitlement(paid);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].scope, 'a'.repeat(48));
  assert.equal(h.writes[0].record.recordName, 'entitlement_pro');
  assert.equal(h.writes[0].record.recordType, 'Entitlement');
  assert.deepEqual(Object.keys(h.writes[0].record.fields).sort(),
    ['productId', 'originalTransactionId', 'expiresAt', 'isActive', 'environment', 'updatedAt'].sort());
  assert.equal(h.writes[0].record.fields.environment, 'Sandbox');
  assert.equal(h.writes[0].record.fields.isActive, 1);
  await h.api.publishProEntitlement(paid);
  assert.equal(h.writes.length, 1, 'unchanged refresh does not write again');
  await h.api.publishProEntitlement({ ...neverSubscribed, originalTransactionId: paid.originalTransactionId,
    mostRecentProductId: paid.activeProductId, mostRecentExpirationDate: paid.expirationDate,
    mostRecentEnvironment: paid.environment });
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[1].record.recordName, 'entitlement_pro');
  assert.equal(h.writes[1].record.fields.isActive, 0);
});

test('a failed entitlement upload is retried and never cached as published', async () => {
  const h = harness();
  const paid = { nativeModuleAvailable: true, tier: 'paid', activeProductId: 'com.journeydeck.recorder.pro.annual',
    environment: 'production', expirationDate: null, originalTransactionId: '42' };
  h.setFailure(true);
  await assert.rejects(h.api.publishProEntitlement(paid));
  h.setFailure(false);
  await h.api.publishProEntitlement(paid);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].record.fields.environment, 'Production');
});
