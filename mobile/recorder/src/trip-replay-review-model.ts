/** Ask once, when the member finishes watching their third trip replay. */
export const REVIEW_AFTER_TRIP_REPLAYS = 3;

export type TripReplayReviewRecord = {
  count: number;
  requested: boolean;
};

export function emptyTripReplayReview(): TripReplayReviewRecord {
  return { count: 0, requested: false };
}

export function parseTripReplayReview(value: unknown): TripReplayReviewRecord {
  if (!value || typeof value !== 'object') return emptyTripReplayReview();
  const record = value as { count?: unknown; requested?: unknown };
  const count = typeof record.count === 'number' && Number.isInteger(record.count) && record.count >= 0
    ? record.count
    : 0;
  return { count, requested: record.requested === true };
}

export function nextTripReplayReview(record: TripReplayReviewRecord): { record: TripReplayReviewRecord; requestReview: boolean } {
  const count = record.count + 1;
  const requestReview = count === REVIEW_AFTER_TRIP_REPLAYS && !record.requested;
  return { record: { count, requested: record.requested || requestReview }, requestReview };
}
