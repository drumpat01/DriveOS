import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { entitlementsForTestFlightMembership, entitlementsForVerifiedMembership, withPreviewAtlasAccess, type JourneyDeckMembershipEntitlements } from './membership-entitlements';
import { PREVIEW_ATLAS_UNLOCKED, TESTFLIGHT_PLUS_UNLOCKED } from './release-features';

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
  const productLoadGeneration = useRef(0);
  const statusLoadGeneration = useRef(0);
  const statusRef = useRef(status);
  const mounted = useRef(true);
  const purchaseInFlight = useRef(false);

  const applyStatus = useCallback((nextStatus: JourneyDeckMembershipStatus) => {
    if (!mounted.current) return;
    // A transaction event or completed purchase supersedes reads that began
    // before it. Their delayed responses must not re-lock (or re-unlock) access.
    statusLoadGeneration.current += 1;
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setPhase('ready');
    setMessage(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!mounted.current || purchaseInFlight.current) return;
    const generation = ++statusLoadGeneration.current;
    try {
      const nextStatus = await getMembershipStatus();
      if (!mounted.current || generation !== statusLoadGeneration.current) return;
      applyStatus(nextStatus);
    } catch (error) {
      if (!mounted.current || generation !== statusLoadGeneration.current) return;
      statusRef.current = unavailableStatus;
      setStatus(unavailableStatus);
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'JourneyDeck could not verify membership right now.');
    }
  }, [applyStatus]);

  const loadProducts = useCallback(async () => {
    if (!mounted.current) return false;
    const generation = productLoadGeneration.current + 1;
    productLoadGeneration.current = generation;
    setProducts([]);
    if (!isJourneyDeckMembershipNativeAvailable) {
      setProductsLoading(false);
      setMessage('Subscriptions require JourneyDeck Build 10 or newer.');
      return false;
    }
    setProductsLoading(true);
    setMessage(null);
    try {
      const availableProducts = await getMembershipProducts();
      if (productLoadGeneration.current !== generation) return false;
      setProducts(availableProducts);
      if (!availableProducts.length) setMessage('JourneyDeck memberships are not available from the App Store yet.');
      return true;
    } catch (error) {
      if (productLoadGeneration.current !== generation) return false;
      setProducts([]);
      setMessage(error instanceof Error ? error.message : 'The App Store could not load membership options.');
      return false;
    } finally {
      if (productLoadGeneration.current === generation) setProductsLoading(false);
    }
  }, []);

  const purchase = useCallback(async (productId: string) => {
    if (!mounted.current || purchaseInFlight.current) return 'pending' as const;
    purchaseInFlight.current = true;
    const generation = ++statusLoadGeneration.current;
    setPurchasePending(true);
    setMessage(null);
    try {
      const result = await purchaseMembership(productId);
      if (!mounted.current) return result.outcome;
      if (generation === statusLoadGeneration.current) applyStatus(result.status);
      if (result.outcome === 'purchased' && entitlementsForVerifiedMembership(statusRef.current).tier !== 'paid') {
        setMessage('The App Store completed the purchase, but an active membership is not available yet. Try Restore Purchases.');
        return 'pending' as const;
      }
      if (result.outcome === 'pending' && statusRef.current.tier !== 'paid') setMessage('The purchase is awaiting approval. JourneyDeck will unlock automatically after the App Store approves it.');
      return result.outcome;
    } catch (error) {
      if (mounted.current && generation === statusLoadGeneration.current) setMessage(error instanceof Error ? error.message : 'The App Store purchase did not finish.');
      return 'failed' as const;
    } finally {
      purchaseInFlight.current = false;
      if (mounted.current) setPurchasePending(false);
    }
  }, [applyStatus]);

  const restore = useCallback(async () => {
    if (!mounted.current || purchaseInFlight.current) return;
    purchaseInFlight.current = true;
    const generation = ++statusLoadGeneration.current;
    setPurchasePending(true);
    setMessage(null);
    try {
      const restoredStatus = await restoreMembershipPurchases();
      if (!mounted.current) return;
      if (generation === statusLoadGeneration.current) applyStatus(restoredStatus);
      if (statusRef.current.tier !== 'paid') setMessage('No active JourneyDeck membership was found for this App Store account.');
    } catch (error) {
      if (mounted.current && generation === statusLoadGeneration.current) setMessage(error instanceof Error ? error.message : 'The App Store could not restore purchases.');
    } finally {
      purchaseInFlight.current = false;
      if (mounted.current) setPurchasePending(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    mounted.current = true;
    const nativeSubscription = addMembershipChangeListener(applyStatus);
    void refresh();
    const refreshTimer = setInterval(() => void refresh(), 15 * 60_000);
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') void refresh();
    });
    return () => {
      mounted.current = false;
      statusLoadGeneration.current += 1;
      productLoadGeneration.current += 1;
      clearInterval(refreshTimer);
      nativeSubscription.remove();
      appStateSubscription.remove();
    };
  }, [applyStatus, refresh]);

  useEffect(() => {
    const expiration = status.expirationDate ? Date.parse(status.expirationDate) : Number.NaN;
    if (status.tier !== 'paid' || !Number.isFinite(expiration) || expiration <= Date.now()) return;
    // Ask StoreKit again at renewal/expiration; don't revoke locally from this
    // date because currentEntitlements also includes Apple's billing grace period.
    const timer = setTimeout(() => void refresh(), Math.min(expiration - Date.now() + 1_000, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [refresh, status]);

  const entitlements = useMemo(
    () => withPreviewAtlasAccess(entitlementsForTestFlightMembership(status, TESTFLIGHT_PLUS_UNLOCKED), PREVIEW_ATLAS_UNLOCKED),
    [status],
  );
  const state: JourneyDeckMembershipState = { phase, status, entitlements, products, productsLoading, purchasePending, message };
  return { state, refresh, loadProducts, purchase, restore };
}
