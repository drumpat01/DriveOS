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
    ? { tier, atlasAccess: true, tessieAccess: true, timelineHistoryDays: null }
    : { tier, atlasAccess: false, tessieAccess: false, timelineHistoryDays: 45 };
}

export function entitlementsForVerifiedMembership(status: VerifiedMembershipStatus): JourneyDeckMembershipEntitlements {
  return entitlementsForMembershipTier(status.nativeModuleAvailable && status.tier === 'paid' ? 'paid' : 'free');
}

export function entitlementsForTestFlightMembership(
  status: VerifiedMembershipStatus,
  testflightPlusUnlocked: boolean,
): JourneyDeckMembershipEntitlements {
  return testflightPlusUnlocked
    ? entitlementsForMembershipTier('paid')
    : entitlementsForVerifiedMembership(status);
}

export function withPreviewAtlasAccess(
  entitlements: JourneyDeckMembershipEntitlements,
  enabled: boolean,
): JourneyDeckMembershipEntitlements {
  return enabled && !entitlements.atlasAccess
    ? { ...entitlements, atlasAccess: true }
    : entitlements;
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
 * Synchronous fallback for callers that have not supplied the native StoreKit
 * verifier's result. Never infer payment from an editable local preference.
 * The app shell supplies useJourneyDeckMembership's verified entitlements.
 */
export function currentMembershipEntitlements(): JourneyDeckMembershipEntitlements {
  return entitlementsForMembershipTier('free');
}
