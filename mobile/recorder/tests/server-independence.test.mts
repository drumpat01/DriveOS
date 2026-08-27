import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
const automaticDrive = await readFile(new URL('../src/automatic-drive-task.ts', import.meta.url), 'utf8');
const appData = await readFile(new URL('../src/app-data.ts', import.meta.url), 'utf8');
const primaryData = await readFile(new URL('../src/primary-sections-data.ts', import.meta.url), 'utf8');
const storage = await readFile(new URL('../src/storage.ts', import.meta.url), 'utf8');
const iCloud = await readFile(new URL('../src/icloud-sync.ts', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const localArchiveEvents = await readFile(new URL('../src/local-archive-events.ts', import.meta.url), 'utf8');

test('manual finish commits to the on-device archive before optional remote sync', () => {
  const finish = app.slice(app.indexOf('const finishSession'), app.indexOf('const finish =', app.indexOf('const finishSession')));
  assert.ok(finish.indexOf('completeSessionLocally(currentSummary.id)') >= 0);
  assert.ok(finish.indexOf('completeSessionLocally(currentSummary.id)') < finish.indexOf('syncPendingCompletedRecordingsBestEffort(currentConnection)'));
  assert.match(finish, /setSyncStage\('saved'\)/);
  assert.doesNotMatch(finish, /await completeRecording|await flushRecording/);
});

test('local completion invalidates the visible archive without a server refresh', () => {
  assert.match(storage, /notifyLocalArchiveChanged\(\)/);
  assert.match(shell, /subscribeLocalArchiveChanges\(\(\) => \{ void refreshPrimarySections\(false\); \}\)/);
  assert.match(localArchiveEvents, /const listeners = new Set<LocalArchiveListener>\(\)/);
});

test('active recording has no automatic JourneyDeck mirror loop', () => {
  assert.equal((app.match(/await flushRecording\(/g) ?? []).length, 1, 'only the explicit Sync saved data action may flush an active recording');
  assert.doesNotMatch(app, /setTimeout\([\s\S]{0,220}flushRecording/);
  assert.doesNotMatch(automaticDrive, /flushRecording|completeRecording/);
  assert.match(automaticDrive, /completeSessionLocally\(sessionId\)/);
});

test('completed sessions remain queued locally and remote retries stop after one connectivity failure', () => {
  assert.match(storage, /remote_completed INTEGER NOT NULL DEFAULT 0/);
  assert.match(storage, /sessionsPendingRemoteCompletion/);
  assert.match(storage, /status='completed' AND s\.remote_completed=0/);
  assert.match(api, /for \(const sessionId of sessionsPendingRemoteCompletion\(limit\)\)/);
  assert.match(api, /catch \{[\s\S]{0,240}break;/);
});

test('normal archive navigation is local-first and remote refresh is explicit', () => {
  assert.match(appData, /async dashboard\(refreshRemote = false\)/);
  assert.match(appData, /async journeys\(limit = 25, cursor\?: string, refreshRemote = false\)/);
  assert.match(appData, /async memories\(refreshRemote = false\)/);
  assert.match(appData, /async musicDashboard\(refreshRemote = false, details: JourneyDetail\[\] = \[\]\)/);
  assert.match(primaryData, /appDataClient\.dashboard\(forceRefresh\)/);
  assert.match(primaryData, /loadJourneyArchive\(8, forceRefresh\)/);
});

test('automatic iCloud checks are coalesced while explicit sync can force a pass', () => {
  assert.match(iCloud, /AUTOMATIC_SYNC_COOLDOWN_MS = 15 \* 60_000/);
  assert.match(iCloud, /!options\.force && recent/);
  assert.match(app, /syncCurrentUserWithPrivateICloud\(\{ force: true \}\)/);
});
