import assert from 'node:assert/strict';
import { syncPresentation, type SyncStage } from '../src/sync-status.ts';

const stages: Array<Exclude<SyncStage, 'idle'>> = ['saving', 'syncing', 'synced', 'retry'];

for (const stage of stages) {
  const presentation = syncPresentation(stage);
  assert.ok(presentation.title.length > 0, `${stage} has a title`);
  assert.ok(presentation.detail.length > 0, `${stage} has detail`);
}

assert.equal(syncPresentation('saving').spinning, true);
assert.equal(syncPresentation('syncing').spinning, true);
assert.equal(syncPresentation('synced').spinning, false);
assert.equal(syncPresentation('retry').spinning, false);
assert.match(syncPresentation('syncing').title, /Saved on this iPhone/);
assert.match(syncPresentation('retry').detail, /points are safe/i);
assert.match(syncPresentation('retry').detail, /retry automatically/i);

console.log(`sync status presentations: ${stages.length} passed`);
