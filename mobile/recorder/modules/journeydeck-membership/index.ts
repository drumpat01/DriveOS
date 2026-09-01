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

export const isJourneyDeckMembershipNativeAvailable = JourneyDeckMembershipModule !== null;

const unavailableStatus = {
  nativeModuleAvailable: false,
  tier: 'free',
  activeProductId: null,
  expirationDate: null,
  environment: null,
} as const;

export async function getMembershipStatus() {
  return JourneyDeckMembershipModule?.getMembershipStatusAsync() ?? unavailableStatus;
}

export async function getMembershipProducts() {
  if (!JourneyDeckMembershipModule) return [];
  return JourneyDeckMembershipModule.getProductsAsync([...JOURNEYDECK_MEMBERSHIP_PRODUCT_IDS]);
}

export async function purchaseMembership(productId: string) {
  if (!JourneyDeckMembershipModule) throw new Error('Subscriptions require JourneyDeck Build 10 or newer.');
  return JourneyDeckMembershipModule.purchaseAsync(productId);
}

export async function restoreMembershipPurchases() {
  if (!JourneyDeckMembershipModule) throw new Error('Restore Purchases requires JourneyDeck Build 10 or newer.');
  return JourneyDeckMembershipModule.restorePurchasesAsync();
}

export function addMembershipChangeListener(listener: (status: import('./src/JourneyDeckMembership.types').JourneyDeckMembershipStatus) => void) {
  return JourneyDeckMembershipModule?.addListener('onMembershipChanged', listener) ?? { remove() {} };
}
