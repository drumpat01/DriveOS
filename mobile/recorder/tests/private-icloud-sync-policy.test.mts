import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyPrivateICloudSyncError,
  nextPrivateICloudSyncBackoff,
  privateICloudBackoffDelayMs,
  PRIVATE_ICLOUD_MAX_BACKOFF_MS,
} from '../src/private-icloud-sync-policy.ts';

const minutes = (value: number) => value * 60_000;

test('sync failures map to a fixed category vocabulary', () => {
  const cases: [string, string][] = [
    ['Private iCloud is recovering an earlier request. Local changes remain queued; retry sync shortly.', 'request_in_flight'],
    ['Private iCloud response timed out. Local changes remain queued; retry sync shortly.', 'timeout'],
    ['Private iCloud request timed out. Local data remains queued; retry sync to reconcile.', 'timeout'],
    ['The active profile changed during private iCloud sync. Its local records remain queued safely.', 'profile_changed'],
    ['Private iCloud sync is paused while this account deletion finishes. Retry account deletion to finish removing this profile.', 'deletion_pending'],
    ['Private iCloud sync requires the JourneyDeck 1.9 native build.', 'native_unavailable'],
    ['Private iCloud is unavailable: temporarilyUnavailable.', 'account_unavailable'],
    ['CloudKit change cursor did not advance. Retry sync shortly.', 'change_cursor'],
    ['CloudKit returned an incomplete change page; the previous cursor was retained.', 'change_cursor'],
    ['CloudKit did not create the private record zone.', 'zone_missing'],
    ['The operation couldn’t be completed. (JourneyDeckCloudKit error 7.)', 'asset_missing'],
    ['The operation couldn’t be completed. (JourneyDeckCloudKit error 16.)', 'request_in_flight'],
    ['The operation couldn’t be completed. (CKErrorDomain error 3.)', 'network'],
    ['<CKError 0x600: "Request Rate Limited" (7/2061); Retry after 12.0 seconds>', 'rate_limited'],
    ['<CKError 0x600: "Quota Exceeded" (25/2035)>', 'quota_exceeded'],
    ['The operation couldn’t be completed. (CKErrorDomain error 26.)', 'zone_missing'],
    ['private_cloud_partial', 'partial_upload'],
  ];
  for (const [message, category] of cases) assert.equal(classifyPrivateICloudSyncError(new Error(message)), category, message);
});

test('unrecognized errors never leak their text into the category', () => {
  const secret = 'Record Journey-2026-09-24 near 1 Infinite Loop failed for user abc@example.com';
  assert.equal(classifyPrivateICloudSyncError(new Error(secret)), 'unknown');
  assert.equal(classifyPrivateICloudSyncError(undefined), 'unknown');
  assert.equal(classifyPrivateICloudSyncError({ message: 'timed out' }), 'unknown', 'only Error instances and strings are read');
});

test('automatic retries back off 2, 5, 15, 30, then hold at 60 minutes', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 40].map(count => privateICloudBackoffDelayMs(count)),
    [minutes(2), minutes(5), minutes(15), minutes(30), minutes(60), minutes(60), minutes(60)]);
  assert.equal(privateICloudBackoffDelayMs(0), minutes(2));
});

test('CloudKit retry-after extends the wait, including beyond the app cap', () => {
  assert.equal(privateICloudBackoffDelayMs(1, 600), minutes(10));
  assert.equal(privateICloudBackoffDelayMs(1, 30), minutes(2), 'a shorter server hint never shortens the schedule');
  assert.equal(privateICloudBackoffDelayMs(1, 2 * 3600), minutes(120), 'the server hint wins over the 60-minute app cap');
  assert.equal(privateICloudBackoffDelayMs(9, 3 * 3600), minutes(180));
  assert.equal(privateICloudBackoffDelayMs(9), PRIVATE_ICLOUD_MAX_BACKOFF_MS, 'without a hint the app schedule stays capped');
});

test('a valid retry-after longer than 24 hours is honored in full', () => {
  assert.equal(privateICloudBackoffDelayMs(1, 36 * 3600), minutes(36 * 60));
  assert.equal(privateICloudBackoffDelayMs(5, 3 * 86_400), minutes(3 * 24 * 60));
});

test('invalid or non-finite retry-after hints are rejected in favor of the app schedule', () => {
  for (const hint of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5, 0, '600' as any, undefined as any, null]) {
    assert.equal(privateICloudBackoffDelayMs(1, hint), minutes(2), String(hint));
    assert.equal(privateICloudBackoffDelayMs(9, hint), PRIVATE_ICLOUD_MAX_BACKOFF_MS, String(hint));
  }
});

test('consecutive failures accumulate from the previous record', () => {
  const first = nextPrivateICloudSyncBackoff(null, 'timeout', 1_000);
  assert.deepEqual(first, { consecutiveFailures: 1, category: 'timeout', nextAttemptAt: 1_000 + minutes(2) });
  const second = nextPrivateICloudSyncBackoff(first, 'network', 2_000);
  assert.deepEqual(second, { consecutiveFailures: 2, category: 'network', nextAttemptAt: 2_000 + minutes(5) });
});
