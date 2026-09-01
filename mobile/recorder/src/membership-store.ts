import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  addMembershipChangeListener,
  getMembershipProducts,
  getMembershipStatus,
  isJourneyDeckMembershipNativeAvailable,
  purchaseMembership,
  restoreMembershipPurchases,
  type JourneyDeckMembershipProduct,
  type JourneyDeckMembershipStatus,
} from '../modules/journeydeck-membership';
import { entitlementsForVerifiedMembership, type JourneyDeckMembershipEntitlements } from './membership-entitlements';

const unavailableStatus: JourneyDeckMembershipStatus = {
  nativeModuleAvailable: false,
  tier: 'free',
  activeProductId: null,
  expirationDate: null,
  environment: null,
};

export type JourneyDeckMembershipState = {
  phase: 'loading' | 'ready' | 'error';
  status: JourneyDeckMembershipStatus;
  entitlements: JourneyDeckMembershipEntitlements;
  products: JourneyDeckMembershipProduct[];
  productsLoading: boolean;
  purchasePending: boolean;
  message: string | null;
};

export function useJourneyDeckMembership() {
  const [status, setStatus] = useState<JourneyDeckMembershipStatus>(unavailableStatus);
  const [phase, setPhase] = useState<JourneyDeckMembershipState['phase']>('loading');
  const [products, setProducts] = useState<JourneyDeckMembershipProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [purchasePending, setPurchasePending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const applyStatus = useCallback((nextStatus: JourneyDeckMembershipStatus) => {
    setStatus(nextStatus);
    setPhase('ready');
    setMessage(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyStatus(await getMembershipStatus());
    } catch (error) {
      setStatus(unavailableStatus);
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'JourneyDeck could not verify membership right now.');
    }
  }, [applyStatus]);

  const loadProducts = useCallback(async () => {
    if (!isJourneyDeckMembershipNativeAvailable) {
      setMessage('Subscriptions require JourneyDeck Build 10 or newer.');
      return;
    }
    setProductsLoading(true);
    setMessage(null);
    try {
      const availableProducts = await getMembershipProducts();
      setProducts(availableProducts);
      if (!availableProducts.length) setMessage('JourneyDeck memberships are not available from the App Store yet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The App Store could not load membership options.');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const purchase = useCallback(async (productId: string) => {
    setPurchasePending(true);
    setMessage(null);
    try {
      const result = await purchaseMembership(productId);
      applyStatus(result.status);
      if (result.outcome === 'pending') setMessage('The purchase is awaiting approval. JourneyDeck will unlock automatically after the App Store approves it.');
      return result.outcome;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The App Store purchase did not finish.');
      return 'failed' as const;
    } finally {
      setPurchasePending(false);
    }
  }, [applyStatus]);

  const restore = useCallback(async () => {
    setPurchasePending(true);
    setMessage(null);
    try {
      const restoredStatus = await restoreMembershipPurchases();
      applyStatus(restoredStatus);
      if (restoredStatus.tier !== 'paid') setMessage('No active JourneyDeck membership was found for this App Store account.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The App Store could not restore purchases.');
    } finally {
      setPurchasePending(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    void refresh();
    const nativeSubscription = addMembershipChangeListener(applyStatus);
    const refreshTimer = setInterval(() => void refresh(), 15 * 60_000);
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') void refresh();
    });
    return () => {
      clearInterval(refreshTimer);
      nativeSubscription.remove();
      appStateSubscription.remove();
    };
  }, [applyStatus, refresh]);

  const entitlements = useMemo(() => entitlementsForVerifiedMembership(status), [status]);
  const state: JourneyDeckMembershipState = { phase, status, entitlements, products, productsLoading, purchasePending, message };
  return { state, refresh, loadProducts, purchase, restore };
}
