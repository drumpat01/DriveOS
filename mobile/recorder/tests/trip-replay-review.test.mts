import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyTripReplayReview, nextTripReplayReview, parseTripReplayReview } from '../src/trip-replay-review-model.ts';

test('the rating request happens once, after the third finished trip replay', () => {
  const first = nextTripReplayReview(emptyTripReplayReview());
  const second = nextTripReplayReview(first.record);
  const third = nextTripReplayReview(second.record);
  const fourth = nextTripReplayReview(third.record);
  assert.equal(first.requestReview, false);
  assert.equal(second.requestReview, false);
  assert.equal(third.requestReview, true);
  assert.equal(third.record.count, 3);
  assert.equal(third.record.requested, true);
  assert.equal(fourth.requestReview, false);
  assert.deepEqual(parseTripReplayReview(third.record), third.record);
  assert.equal(nextTripReplayReview({ count: 2, requested: true }).requestReview, false);
});
