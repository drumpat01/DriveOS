import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  JourneyDeckMembershipEvents,
  JourneyDeckMembershipProduct,
  JourneyDeckMembershipPurchaseResult,
  JourneyDeckMembershipStatus,
} from './JourneyDeckMembership.types';

declare class JourneyDeckMembershipModule extends NativeModule<JourneyDeckMembershipEvents> {
  getMembershipStatusAsync(): Promise<JourneyDeckMembershipStatus>;
  getProductsAsync(productIds: string[]): Promise<JourneyDeckMembershipProduct[]>;
  purchaseAsync(productId: string): Promise<JourneyDeckMembershipPurchaseResult>;
  restorePurchasesAsync(): Promise<JourneyDeckMembershipStatus>;
}

export default requireOptionalNativeModule<JourneyDeckMembershipModule>('JourneyDeckMembership');
