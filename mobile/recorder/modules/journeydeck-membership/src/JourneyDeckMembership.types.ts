export type JourneyDeckMembershipStatus = {
  nativeModuleAvailable: boolean;
  tier: 'free' | 'paid';
  activeProductId: string | null;
  expirationDate: string | null;
  environment: 'sandbox' | 'production' | 'xcode' | null;
};

export type JourneyDeckMembershipProduct = {
  id: string;
  displayName: string;
  description: string;
  displayPrice: string;
  periodUnit: 'day' | 'week' | 'month' | 'year' | null;
  periodValue: number | null;
  isFamilyShareable: boolean;
};

export type JourneyDeckMembershipPurchaseResult = {
  outcome: 'purchased' | 'pending' | 'cancelled';
  status: JourneyDeckMembershipStatus;
};

export type JourneyDeckMembershipEvents = {
  onMembershipChanged: (status: JourneyDeckMembershipStatus) => void;
};
