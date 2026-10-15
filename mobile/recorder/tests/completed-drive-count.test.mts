import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRecordedDrive,
  drivesAreFullyFree,
  emptyCompletedDriveRecord,
  initialCompletedDriveCount,
  parseCompletedDriveRecord,
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
  assert.equal(shouldShowTripSummaryPaywall(3, false), false);
  assert.equal(shouldShowTripSummaryPaywall(4, false), true);
  assert.equal(shouldShowTripSummaryPaywall(8, false), true);
  assert.equal(shouldShowTripSummaryPaywall(8, true), false);
});
