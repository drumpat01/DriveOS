import assert from 'node:assert/strict';
import test from 'node:test';

import {
  currentMembershipEntitlements, entitlementsForMembershipTier, entitlementsForTestFlightMembership, entitlementsForVerifiedMembership,
  membershipCanAccessDate, membershipHistoryCutoff,
} from '../src/membership-entitlements.ts';

test('free members receive Statistics and a today-only timeline', () => {
  assert.deepEqual(entitlementsForMembershipTier('free'), {
    tier: 'free',
    atlasAccess: false,
    tessieAccess: false,
    timelineHistoryDays: 0,
    trialEndsAt: null,
  });
});

test('paid members receive Atlas and their complete timeline', () => {
  assert.deepEqual(entitlementsForMembershipTier('paid'), {
    tier: 'paid',
    atlasAccess: true,
    tessieAccess: false,
    timelineHistoryDays: null,
    trialEndsAt: null,
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

test('V3 Tessie needs verified paid membership; V2 and preview Atlas remain closed', () => {
  const v3 = { tessieV3Enabled: true };
  assert.equal(entitlementsForVerifiedMembership({ nativeModuleAvailable: true, tier: 'paid' }, v3).tessieAccess, true);
  assert.equal(entitlementsForVerifiedMembership({ nativeModuleAvailable: false, tier: 'paid' }, v3).tessieAccess, false);
  assert.equal(entitlementsForVerifiedMembership({ nativeModuleAvailable: true, tier: 'free' }, v3).tessieAccess, false);
  assert.equal(entitlementsForVerifiedMembership({ nativeModuleAvailable: true, tier: 'paid' }).tessieAccess, false);
});

test('Build 36 TestFlight grants Plus and Tessie without a sandbox purchase', () => {
  const free = { nativeModuleAvailable: true, tier: 'free' as const };
  assert.deepEqual(entitlementsForTestFlightMembership(free, true, true), {
    tier: 'paid', atlasAccess: true, tessieAccess: true, timelineHistoryDays: null, trialEndsAt: null,
  });
  assert.equal(entitlementsForTestFlightMembership(free, false, true).tessieAccess, false);
  assert.equal(entitlementsForTestFlightMembership(free, true, false).tessieAccess, false);
});

test('free history starts at local midnight today while paid history has no cutoff', () => {
  const now = new Date(2026, 8, 27, 15, 30).getTime();
  const free = entitlementsForMembershipTier('free');
  const paid = entitlementsForMembershipTier('paid');
  assert.equal(membershipHistoryCutoff(free, now), new Date(2026, 8, 27).getTime());
  assert.equal(membershipCanAccessDate(free, new Date(2026, 8, 27, 7).toISOString(), now), true);
  assert.equal(membershipCanAccessDate(free, new Date(2026, 8, 26, 23).toISOString(), now), false);
  assert.equal(membershipCanAccessDate(paid, '2020-01-01T00:00:00.000Z', now), true);
});
