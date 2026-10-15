import * as StoreReview from 'expo-store-review';

import { getCurrentUser, isDemoProfile } from './auth';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';
import { nextTripReplayReview, parseTripReplayReview } from './trip-replay-review-model';

const KEY = 'review.trip-replays.v1';

/** Counts one finished replay and asks StoreKit for a rating exactly once, on the third. */
export async function noteCompletedTripReplay(): Promise<void> {
  try {
    if (isDemoProfile()) return;
    const userId = getCurrentUser().id;
    const current = parseTripReplayReview(getPrivatePreference(userId, KEY));
    const next = nextTripReplayReview(current);
    upsertPrivatePreference(userId, KEY, next.record);
    if (!next.requestReview) return;
    if (await StoreReview.isAvailableAsync()) await StoreReview.requestReview();
  } catch {
    // A missing or declined rating sheet must not interrupt the replay.
  }
}
