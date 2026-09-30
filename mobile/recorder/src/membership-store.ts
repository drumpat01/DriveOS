import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  addMembershipChangeListener,
  getMembershipProducts,
  JOURNEYDECK_V4_MEMBERSHIP_PRODUCT_IDS,
  getMembershipStatus,
  isJourneyDeckMembershipNativeAvailable,
  purchaseMembership,
  restoreMembershipPurchases,
  type JourneyDeckMembershipProduct,
  type JourneyDeckMembershipStatus,
} from '../modules/journeydeck-membership';
import { entitlementsForMembershipTier, entitlementsForTestFlightMembership, entitlementsForVerifiedMembership, sameMembershipEntitlements, withPlusTrial, withPreviewAtlasAccess, type JourneyDeckMembershipEntitlements } from './membership-entitlements';
import { loadOrStartPlusTrial, plusTrialEndsAt } from './plus-trial';
import { isDemoProfile } from './auth';
import { PREVIEW_ATLAS_UNLOCKED, TESSIE_INTEGRATION_ENABLED, TESTFLIGHT_PLUS_UNLOCKED, V4_REDESIGN_ENABLED } from './release-features';
import { publishProEntitlement } from './pro-entitlement-sync';

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
  const [trialStartedAt, setTrialStartedAt] = useState<number | null>(null);
  const [trialClock, setTrialClock] = useState(() => Date.now());
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
    void publishProEntitlement(nextStatus).catch(() => undefined);
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
      const availableProducts = await getMembershipProducts(V4_REDESIGN_ENABLED ? JOURNEYDECK_V4_MEMBERSHIP_PRODUCT_IDS : undefined);
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
      if (nextState === 'active') { setTrialClock(Date.now()); void refresh(); }
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

  useEffect(() => {
    let cancelled = false;
    void loadOrStartPlusTrial().then(started => { if (!cancelled) setTrialStartedAt(started); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const trialEndsAt = trialStartedAt === null ? null : plusTrialEndsAt(trialStartedAt, trialClock);
  useEffect(() => {
    if (trialEndsAt === null || trialEndsAt <= trialClock) return;
    // Lock Plus again the moment the trial ends, even if the app stays open.
    const timer = setTimeout(() => setTrialClock(Date.now()), Math.min(trialEndsAt - trialClock + 1_000, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [trialClock, trialEndsAt]);

  // Every StoreKit refresh (15-minute timer, app resume) yields a new status
  // object. Keep the previous entitlements identity when nothing changed so
  // consumers' callbacks/effects (archive reloads, private iCloud sync) do not rerun.
  const entitlementsRef = useRef<JourneyDeckMembershipEntitlements | null>(null);
  const entitlements = useMemo(() => {
    const verified = entitlementsForTestFlightMembership(status, TESTFLIGHT_PLUS_UNLOCKED, TESSIE_INTEGRATION_ENABLED);
    // The sample library is a fixed demo: show all of it, never Plus-gated, whatever the device's membership.
    const next = isDemoProfile()
      ? { ...entitlementsForMembershipTier('paid'), tessieAccess: false }
      : withPreviewAtlasAccess(withPlusTrial(verified, trialEndsAt, trialClock), PREVIEW_ATLAS_UNLOCKED);
    const previous = entitlementsRef.current;
    if (previous && sameMembershipEntitlements(previous, next)) return previous;
    entitlementsRef.current = next;
    return next;
  }, [status, trialEndsAt, trialClock]);
  const state: JourneyDeckMembershipState = { phase, status, entitlements, products, productsLoading, purchasePending, message };
  return { state, refresh, loadProducts, purchase, restore };
}
