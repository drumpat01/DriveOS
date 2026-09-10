import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createStartupCoordinator } from '../src/database-startup-model.ts';

test('concurrent app and background startup callers share one attempt', async () => {
  let releases!: () => void;
  const blocked = new Promise<void>(resolve => { releases = resolve; });
  let starts = 0;
  const coordinator = createStartupCoordinator(async () => {
    starts += 1;
    await blocked;
  });

  const app = coordinator.prepare();
  const background = coordinator.prepare();
  assert.equal(app, background);
  assert.equal(coordinator.state(), 'starting');
  assert.equal(starts, 0, 'startup begins on a microtask instead of during module evaluation');
  await Promise.resolve();
  assert.equal(starts, 1);
  releases();
  await Promise.all([app, background]);
  assert.equal(coordinator.state(), 'ready');
  assert.equal(starts, 1);
});

test('a failed non-destructive startup can be retried without parallel work', async () => {
  let attempts = 0;
  const coordinator = createStartupCoordinator(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('database is locked');
  });

  await assert.rejects(coordinator.prepare(), /locked/);
  assert.equal(coordinator.state(), 'failed');
  assert.match(coordinator.failure()?.message ?? '', /locked/);
  const retry = coordinator.retry();
  const duplicateRetry = coordinator.retry();
  assert.equal(retry, duplicateRetry);
  await retry;
  assert.equal(coordinator.state(), 'ready');
  assert.equal(attempts, 2);
});

test('runtime wiring defers the only live handle and gates UI and headless tasks', () => {
  const owner = readFileSync(new URL('../src/database-owner.ts', import.meta.url), 'utf8');
  const localStore = readFileSync(new URL('../src/local-store.ts', import.meta.url), 'utf8');
  const atlas = readFileSync(new URL('../src/local-atlas.ts', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const locationTask = readFileSync(new URL('../src/location-task.ts', import.meta.url), 'utf8');
  const automaticTask = readFileSync(new URL('../src/automatic-drive-task.ts', import.meta.url), 'utf8');
  const recovery = readFileSync(new URL('../src/database-startup-gate.tsx', import.meta.url), 'utf8');
  const startup = readFileSync(new URL('../src/database-startup.ts', import.meta.url), 'utf8');

  assert.match(owner, /openDatabaseAsync\('journeydeck-local\.db'\)/);
  assert.doesNotMatch(owner, /openDatabaseSync\('journeydeck-local\.db'\)/);
  assert.match(owner, /if \(!masterDatabase\)[\s\S]*Await database startup/);
  assert.match(localStore, /export function prepareLocalStore\(\): Promise<void>/);
  assert.match(localStore, /let db: ReturnType<typeof getMasterDatabase>/);
  assert.doesNotMatch(atlas, /initializeLocalStore\(\);\s*const db/);
  assert.match(storage, /initializeLocalStore\(\);\s*db = getRecorderDatabase\(\)/);
  assert.match(app, /<DatabaseStartupGate><AppThemeProvider>/);
  assert.match(locationTask, /await prepareJourneyDeckDatabase\(\)/);
  assert.match(automaticTask, /await prepareJourneyDeckDatabase\(\)/);
  assert.match(startup, /Your saved journeys remain untouched/);
  assert.match(recovery, /onPress=\{retry\}/);
});

test('schema and multi-row critical mutations remain atomic on the controlled connection', () => {
  const localStore = readFileSync(new URL('../src/local-store.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/journey-editor-store.ts', import.meta.url), 'utf8');
  assert.match(localStore, /for \(let i = current; i < MIGRATIONS\.length; i\+\+\) \{\s*db\.withTransactionSync/);
  assert.match(localStore, /export function insertGpsPoints[\s\S]*?db\.withTransactionSync/);
  assert.match(localStore, /export function deleteLocalUserData[\s\S]*?db\.withTransactionSync/);
  assert.match(editor, /commitReviewedJourneyEdit[\s\S]*?db\.withTransactionSync/);
});
