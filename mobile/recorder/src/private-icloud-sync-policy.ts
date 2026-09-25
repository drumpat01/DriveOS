/**
 * Private iCloud failure classification and retry schedule.
 *
 * Categories are a fixed vocabulary derived from error text. The text itself
 * (which can carry record names or CloudKit debug descriptions) never leaves
 * this module, so the category is safe to attach to diagnostics.
 */
export type PrivateICloudSyncErrorCategory =
  | 'profile_changed'
  | 'deletion_pending'
  | 'native_unavailable'
  | 'request_in_flight'
  | 'timeout'
  | 'account_unavailable'
  | 'network'
  | 'rate_limited'
  | 'service_unavailable'
  | 'quota_exceeded'
  | 'change_cursor'
  | 'zone_missing'
  | 'invalid_payload'
  | 'asset_missing'
  | 'asset_invalid'
  | 'partial_upload'
  | 'unknown';

// JourneyDeckCloudKit NSError codes thrown by the native module.
const NATIVE_CODE_CATEGORIES: Record<number, PrivateICloudSyncErrorCategory> = {
  1: 'invalid_payload', 2: 'account_unavailable', 3: 'zone_missing', 4: 'invalid_payload',
  5: 'invalid_payload', 6: 'invalid_payload', 7: 'asset_missing', 8: 'asset_missing',
  9: 'asset_missing', 10: 'asset_invalid', 11: 'asset_invalid', 12: 'asset_invalid',
  13: 'timeout', 14: 'zone_missing', 15: 'change_cursor', 16: 'request_in_flight',
};

// CKError.Code raw values (CloudKit/CKError.h).
const CLOUDKIT_CODE_CATEGORIES: Record<number, PrivateICloudSyncErrorCategory> = {
  3: 'network', 4: 'network', 6: 'service_unavailable', 7: 'rate_limited', 9: 'account_unavailable',
  21: 'change_cursor', 23: 'service_unavailable', 25: 'quota_exceeded', 26: 'zone_missing',
  28: 'zone_missing', 36: 'account_unavailable',
};

const MESSAGE_CATEGORIES: [RegExp, PrivateICloudSyncErrorCategory][] = [
  [/active profile changed/i, 'profile_changed'],
  [/account deletion finishes/i, 'deletion_pending'],
  [/requires the (JourneyDeck 1\.9|next JourneyDeck) native build/i, 'native_unavailable'],
  [/recovering an earlier request/i, 'request_in_flight'],
  [/timed out/i, 'timeout'],
  [/private_cloud_partial/, 'partial_upload'],
  [/private iCloud is unavailable|not ?authenticated|no ?account|account temporarily unavailable/i, 'account_unavailable'],
  [/network (unavailable|failure)|NSURLErrorDomain|internet connection/i, 'network'],
  [/rate ?limited/i, 'rate_limited'],
  [/service unavailable|zone ?busy/i, 'service_unavailable'],
  [/quota ?exceeded/i, 'quota_exceeded'],
  [/change (cursor|page|token)/i, 'change_cursor'],
  [/zone ?not ?found|user deleted zone|record zone/i, 'zone_missing'],
];

export function classifyPrivateICloudSyncError(error: unknown): PrivateICloudSyncErrorCategory {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const native = /JourneyDeckCloudKit(?: error|\D+)(\d{1,3})/.exec(message);
  if (native && NATIVE_CODE_CATEGORIES[Number(native[1])]) return NATIVE_CODE_CATEGORIES[Number(native[1])];
  for (const [pattern, category] of MESSAGE_CATEGORIES) if (pattern.test(message)) return category;
  const cloudKit = /CKErrorDomain(?: error|\D+)(\d{1,3})|<CKError [^>]*\((\d{1,3})\//.exec(message);
  const cloudKitCode = cloudKit ? Number(cloudKit[1] ?? cloudKit[2]) : Number.NaN;
  return CLOUDKIT_CODE_CATEGORIES[cloudKitCode] ?? 'unknown';
}

/** Automatic retries wait 2, 5, 15, 30, then 60 minutes (longer only for a CloudKit retry-after); a user sync bypasses the wait. */
export const PRIVATE_ICLOUD_BACKOFF_STEPS_MS = [2, 5, 15, 30, 60].map(minutes => minutes * 60_000);
export const PRIVATE_ICLOUD_MAX_BACKOFF_MS = PRIVATE_ICLOUD_BACKOFF_STEPS_MS[PRIVATE_ICLOUD_BACKOFF_STEPS_MS.length - 1];
/**
 * The app's own schedule is capped at 60 minutes. A valid CloudKit
 * retry-after is the server's instruction, so it is honored in full, even
 * beyond that cap. Invalid hints (non-numeric, non-finite, zero or negative)
 * are ignored and the app schedule applies.
 */
export function privateICloudBackoffDelayMs(consecutiveFailures: number, retryAfterSeconds: number | null = null): number {
  const index = Math.max(0, Math.min(PRIVATE_ICLOUD_BACKOFF_STEPS_MS.length - 1, Math.trunc(consecutiveFailures) - 1));
  const serverDelay = typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1000
    : 0;
  return Math.max(PRIVATE_ICLOUD_BACKOFF_STEPS_MS[index], serverDelay);
}

export type PrivateICloudSyncBackoff = {
  consecutiveFailures: number;
  nextAttemptAt: number;
  category: PrivateICloudSyncErrorCategory;
};

export function nextPrivateICloudSyncBackoff(
  previous: PrivateICloudSyncBackoff | null | undefined,
  category: PrivateICloudSyncErrorCategory,
  now: number,
  retryAfterSeconds: number | null = null,
): PrivateICloudSyncBackoff {
  const consecutiveFailures = (previous?.consecutiveFailures ?? 0) + 1;
  return { consecutiveFailures, category, nextAttemptAt: now + privateICloudBackoffDelayMs(consecutiveFailures, retryAfterSeconds) };
}

/** Thrown to automatic callers while a failure backoff is active. No CloudKit work was attempted. */
export class PrivateICloudSyncDeferredError extends Error {
  readonly backoff: PrivateICloudSyncBackoff;
  constructor(backoff: PrivateICloudSyncBackoff) {
    super('Private iCloud will retry automatically after a short wait. Tap Sync to retry now.');
    this.name = 'PrivateICloudSyncDeferredError';
    this.backoff = backoff;
  }
}
