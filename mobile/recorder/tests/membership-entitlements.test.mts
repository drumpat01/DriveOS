import assert from 'node:assert/strict';
import test from 'node:test';

import {
  currentMembershipEntitlements, entitlementsForMembershipTier, entitlementsForVerifiedMembership,
  membershipCanAccessDate, membershipHistoryCutoff,
} from '../src/membership-entitlements.ts';

test('free members receive Statistics and a rolling 45-day timeline', () => {
  assert.deepEqual(entitlementsForMembershipTier('free'), {
    tier: 'free',
    atlasAccess: false,
    tessieAccess: false,
    timelineHistoryDays: 45,
  });
});

test('paid members receive Atlas and their complete timeline', () => {
  assert.deepEqual(entitlementsForMembershipTier('paid'), {
    tier: 'paid',
    atlasAccess: true,
    tessieAccess: false,
    timelineHistoryDays: null,
  });
});

test('version 1 fails closed until a verified StoreKit entitlement is connected', () => {
  assert.equal(currentMembershipEntitlements().tier, 'free');
});

test('only a paid status from the native StoreKit verifier unlocks membership', () => {
  assert.equal(entitlementsForVerifiedMembership({ nativeModuleAvailable: true, tier: 'paid' }).tier, 'paid');
  assert.equal(entitlementsForVerifiedMembership({ nativeModuleAvailable: false, tier: 'paid' }).tier, 'free');
  assert.equal(entitlementsForVerifiedMembership({ nativeModuleAvailable: true, tier: 'free' }).tier, 'free');
});

test('free history stops at 45 days while paid history has no cutoff', () => {
  const now = Date.parse('2026-08-31T12:00:00.000Z');
  const free = entitlementsForMembershipTier('free');
  const paid = entitlementsForMembershipTier('paid');
  assert.equal(membershipHistoryCutoff(free, now), now - 45 * 86_400_000);
  assert.equal(membershipCanAccessDate(free, '2026-08-01T12:00:00.000Z', now), true);
  assert.equal(membershipCanAccessDate(free, '2026-06-01T12:00:00.000Z', now), false);
  assert.equal(membershipCanAccessDate(paid, '2020-01-01T00:00:00.000Z', now), true);
});
