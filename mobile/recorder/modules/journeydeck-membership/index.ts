import { revenueCatBilling } from '../../src/revenuecat';
import JourneyDeckMembershipModule from './src/JourneyDeckMembershipModule';

export type {
  JourneyDeckMembershipProduct,
  JourneyDeckMembershipPurchaseResult,
  JourneyDeckMembershipStatus,
} from './src/JourneyDeckMembership.types';

export const JOURNEYDECK_MEMBERSHIP_PRODUCT_IDS = [
  'com.journeydeck.recorder.pro.monthly',
  'com.journeydeck.recorder.pro.annual',
] as const;

// V4 offers weekly and annual. Keep monthly recognized natively for existing subscribers.
export const JOURNEYDECK_V4_MEMBERSHIP_PRODUCT_IDS = [
  'com.journeydeck.recorder.pro.weekly',
  'com.journeydeck.recorder.pro.annual',
] as const;

export const isJourneyDeckMembershipNativeAvailable = JourneyDeckMembershipModule !== null;

const unavailableStatus = {
  nativeModuleAvailable: false,
  tier: 'free',
  activeProductId: null,
  expirationDate: null,
  environment: null,
} as const;

export async function getMembershipStatus() {
  revenueCatBilling.start();
  const status = await JourneyDeckMembershipModule?.getMembershipStatusAsync() ?? unavailableStatus;
  if (status.tier === 'paid') void revenueCatBilling.sync();
  return status;
}

export async function getMembershipProducts(productIds: readonly string[] = JOURNEYDECK_MEMBERSHIP_PRODUCT_IDS) {
  if (!JourneyDeckMembershipModule) return [];
  return JourneyDeckMembershipModule.getProductsAsync([...productIds]);
}

export async function purchaseMembership(productId: string) {
  if (!JourneyDeckMembershipModule) throw new Error('Subscriptions require JourneyDeck Build 10 or newer.');
  revenueCatBilling.start();
  const result = await JourneyDeckMembershipModule.purchaseAsync(productId);
  if (result.outcome === 'purchased') void revenueCatBilling.sync(true);
  return result;
}

export async function restoreMembershipPurchases() {
  if (!JourneyDeckMembershipModule) throw new Error('Restore Purchases requires JourneyDeck Build 10 or newer.');
  revenueCatBilling.start();
  const status = await JourneyDeckMembershipModule.restorePurchasesAsync();
  void revenueCatBilling.sync(true);
  return status;
}

export function addMembershipChangeListener(listener: (status: import('./src/JourneyDeckMembership.types').JourneyDeckMembershipStatus) => void) {
  return JourneyDeckMembershipModule?.addListener('onMembershipChanged', listener) ?? { remove() {} };
}
