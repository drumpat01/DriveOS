import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRecordedDrive,
  drivesAreFullyFree,
  emptyCompletedDriveRecord,
  initialCompletedDriveCount,
  parseCompletedDriveRecord,
  sessionIdForFinishedDrive,
  shouldShowTripSummaryPaywall,
} from '../src/completed-drive-count.ts';

test('a completed drive counts once and stays stored', () => {
  const first = applyRecordedDrive(emptyCompletedDriveRecord(2), 'session-a');
  assert.equal(first.counted, true);
  assert.equal(first.record.count, 3);
  const repeat = applyRecordedDrive(first.record, 'session-a');
  assert.equal(repeat.counted, false);
  assert.equal(repeat.record.count, 3);
  assert.deepEqual(parseCompletedDriveRecord(first.record), first.record);
});

test('the first stored count includes a mirrored journey and adds one that is not mirrored yet', () => {
  assert.equal(initialCompletedDriveCount(4, true), 4);
  assert.equal(initialCompletedDriveCount(4, false), 5);
  assert.equal(initialCompletedDriveCount(0, false), 1);
});

test('the first three completed drives are fully free and the paywall starts on the fourth for non-subscribers', () => {
  assert.equal(drivesAreFullyFree(0), true);
  assert.equal(drivesAreFullyFree(2), true);
  assert.equal(drivesAreFullyFree(3), false);
  assert.equal(shouldShowTripSummaryPaywall(0, false), false);
  assert.equal(shouldShowTripSummaryPaywall(3, false), false);
  assert.equal(shouldShowTripSummaryPaywall(4, false), true);
  assert.equal(shouldShowTripSummaryPaywall(8, false), true);
  assert.equal(shouldShowTripSummaryPaywall(4, true), false);
  assert.equal(shouldShowTripSummaryPaywall(8, true), false);
});

test('a seeded library does not count the same mirrored drive again', () => {
  const seeded = emptyCompletedDriveRecord(4);
  const replay = applyRecordedDrive(seeded, 'session-already-saved', { mirrored: true, libraryCount: 4 });
  assert.equal(replay.counted, false);
  assert.equal(replay.record.count, 4);
  assert.deepEqual(replay.record.sessionIds, ['session-already-saved']);
  const newer = applyRecordedDrive(replay.record, 'session-new', { mirrored: true, libraryCount: 5 });
  assert.equal(newer.counted, true);
  assert.equal(newer.record.count, 5);
});

test('a finished native drive keeps its session id after the active session is cleared', () => {
  assert.equal(sessionIdForFinishedDrive({
    kind: 'manual_auto_finished',
    eventSessionId: 'native_recording_manual_a',
    activeSessionId: null,
  }), 'native_recording_manual_a');
  assert.equal(sessionIdForFinishedDrive({
    kind: 'finished',
    eventSessionId: null,
    activeSessionId: 'native_recording_b',
  }), 'native_recording_b');
});

test('cancelled, failed, and too-short starts do not count as completed drives', () => {
  for (const kind of ['start_failed', 'started', 'paused', 'finish_waiting', 'status_failed', null]) {
    assert.equal(sessionIdForFinishedDrive({ kind, eventSessionId: 'session-short', activeSessionId: 'session-short' }), null);
  }
  assert.equal(sessionIdForFinishedDrive({ kind: 'finished', eventSessionId: '  ', activeSessionId: null }), null);
  assert.equal(sessionIdForFinishedDrive({ kind: 'manual_finished', eventSessionId: '', activeSessionId: '' }), null);
});
