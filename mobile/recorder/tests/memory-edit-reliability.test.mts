import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as memoryModel from '../src/memory-model.ts';

// Exercise the real app-data write boundary without loading native transports.
function harness(ids: string[]) {
  const source = readFileSync(new URL('../src/app-data.ts', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('  async saveMemory('), source.indexOf('  async addJourneysToMemory('));
  let record: any = { id: 'memory_v1_test', userId: 'owner', journeyIds: JSON.stringify(ids), createdAt: '2026-08-01T00:00:00Z', deletedAt: null };
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(`exports.client = {${method}}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, ...memoryModel, Crypto: { randomUUID: () => 'new' }, MEMORIES_CACHE_KEY: 'memories',
    getCurrentUser: () => ({ id: 'owner' }), readAppCache: () => null,
    getMemoryIncludingDeleted: () => record, upsertMemory: (value: any) => { record = { ...record, ...value }; }, cacheMemory: () => {},
  });
  return { save: exports.client.saveMemory, ids: () => JSON.parse(record.journeyIds), remove: () => { record = null; }, tombstone: () => { record.deletedAt = '2026-09-07T00:00:00Z'; } };
}

test('renaming a Memory from a filtered detail view preserves hidden journey links', async () => {
  const h = harness(['old-hidden', 'recent']);
  await h.save({ id: 'memory_v1_test', name: 'New name', journeyIds: ['recent'], previousJourneyIds: ['recent'] });
  assert.deepEqual(h.ids(), ['old-hidden', 'recent']);
});

test('an explicit removal preserves hidden and concurrently added links without restoring a removed link', async () => {
  const h = harness(['hidden', 'remove-me', 'concurrent']);
  await h.save({ id: 'memory_v1_test', name: 'Edited', journeyIds: ['removed-on-ipad', 'new'], previousJourneyIds: ['remove-me', 'removed-on-ipad'] });
  assert.deepEqual(h.ids(), ['hidden', 'concurrent', 'new']);
});

test('new Memory creation and intentional full membership replacement retain their semantics', async () => {
  const h = harness(['old']);
  await h.save({ id: 'memory_v1_test', name: 'Replace', journeyIds: ['new', 'new'] });
  assert.deepEqual(h.ids(), ['new']);
  h.remove();
  const created = await h.save({ name: 'Create', journeyIds: ['new', 'new'], previousJourneyIds: [] });
  assert.equal(created.id, 'memory_v1_new'); assert.deepEqual(h.ids(), ['new']);
});

test('a stale editor cannot resurrect a Memory removed on another device', async () => {
  const h = harness(['recent']); h.tombstone();
  await assert.rejects(h.save({ id: 'memory_v1_test', name: 'Stale edit', journeyIds: ['recent'], previousJourneyIds: ['recent'] }), /no longer available/);
});
