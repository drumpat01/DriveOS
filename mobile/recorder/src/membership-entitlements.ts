export type JourneyDeckMembershipTier = 'free' | 'paid';

export type JourneyDeckMembershipEntitlements = {
  tier: JourneyDeckMembershipTier;
  atlasAccess: boolean;
  tessieAccess: boolean;
  timelineHistoryDays: number | null;
};

export type VerifiedMembershipStatus = {
  nativeModuleAvailable: boolean;
  tier: JourneyDeckMembershipTier;
};

export function entitlementsForMembershipTier(tier: JourneyDeckMembershipTier): JourneyDeckMembershipEntitlements {
  return tier === 'paid'
    ? { tier, atlasAccess: true, tessieAccess: false, timelineHistoryDays: null }
    : { tier, atlasAccess: false, tessieAccess: false, timelineHistoryDays: 45 };
}

export function entitlementsForVerifiedMembership(status: VerifiedMembershipStatus): JourneyDeckMembershipEntitlements {
  return entitlementsForMembershipTier(status.nativeModuleAvailable && status.tier === 'paid' ? 'paid' : 'free');
}

export function membershipHistoryCutoff(entitlements: JourneyDeckMembershipEntitlements, now = Date.now()): number {
  return entitlements.timelineHistoryDays === null
    ? Number.NEGATIVE_INFINITY
    : now - entitlements.timelineHistoryDays * 86_400_000;
}

export function membershipCanAccessDate(entitlements: JourneyDeckMembershipEntitlements, value: string, now = Date.now()): boolean {
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && epoch >= membershipHistoryCutoff(entitlements, now);
}

/**
 * Version 1 has no verified StoreKit subscription receipt yet. Fail closed to
 * the free tier instead of treating a locally editable preference as payment.
 * Replace only this boundary when the native subscription provider is added.
 */
export function currentMembershipEntitlements(): JourneyDeckMembershipEntitlements {
  return entitlementsForMembershipTier('free');
}
