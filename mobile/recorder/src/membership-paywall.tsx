import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  JOURNEYDECK_MEMBERSHIP_PRODUCT_IDS,
  type JourneyDeckMembershipProduct,
} from '../modules/journeydeck-membership';
import type { JourneyDeckMembershipState } from './membership-store';

const MONTHLY_PRODUCT_ID = JOURNEYDECK_MEMBERSHIP_PRODUCT_IDS[0];
const ANNUAL_PRODUCT_ID = JOURNEYDECK_MEMBERSHIP_PRODUCT_IDS[1];

function planName(product: JourneyDeckMembershipProduct) {
  if (product.id === ANNUAL_PRODUCT_ID) return 'Annual';
  if (product.id === MONTHLY_PRODUCT_ID) return 'Monthly';
  return product.displayName || 'JourneyDeck';
}

function periodSuffix(product: JourneyDeckMembershipProduct) {
  if (!product.periodUnit || !product.periodValue) return '';
  const unit = product.periodValue === 1 ? product.periodUnit : product.periodUnit + 's';
  return product.periodValue === 1 ? '/ ' + unit : '/ ' + product.periodValue + ' ' + unit;
}

function productOrder(product: JourneyDeckMembershipProduct) {
  if (product.id === MONTHLY_PRODUCT_ID) return 0;
  if (product.id === ANNUAL_PRODUCT_ID) return 1;
  return 2;
}

function preferredProductId(products: JourneyDeckMembershipProduct[], current: string | null) {
  if (current && products.some(product => product.id === current)) return current;
  return products.find(product => product.id === ANNUAL_PRODUCT_ID)?.id ?? products[0]?.id ?? null;
}

export function MembershipPaywall({ visible, state, onClose, onLoadProducts, onPurchase, onRestore }: {
  visible: boolean;
  state: JourneyDeckMembershipState;
  onClose: () => void;
  onLoadProducts: () => Promise<boolean>;
  onPurchase: (productId: string) => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productsFresh, setProductsFresh] = useState(false);
  const loadProductsRef = useRef(onLoadProducts);
  const openGeneration = useRef(0);
  const purchaseInFlight = useRef(false);
  const { fontScale, height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const usableHeight = viewportHeight - safeAreaInsets.top - safeAreaInsets.bottom;
  const expansion = Math.max(0, Math.min(1, (usableHeight - 790) / 60));
  const stackedLayout = fontScale >= 1.25 || viewportWidth < 350;

  useEffect(() => {
    loadProductsRef.current = onLoadProducts;
  }, [onLoadProducts]);

  useEffect(() => {
    if (!visible) {
      openGeneration.current += 1;
      setProductsFresh(false);
      return;
    }

    const generation = openGeneration.current + 1;
    openGeneration.current = generation;
    setProductsFresh(false);
    void loadProductsRef.current().then(succeeded => {
      if (openGeneration.current === generation) setProductsFresh(succeeded);
    });

    return () => {
      if (openGeneration.current === generation) openGeneration.current += 1;
    };
  }, [visible]);

  const orderedProducts = useMemo(
    () => [...state.products].sort((left, right) => productOrder(left) - productOrder(right)),
    [state.products],
  );

  useEffect(() => {
    if (!orderedProducts.length) return;
    setSelectedProductId(current => preferredProductId(orderedProducts, current));
  }, [orderedProducts]);

  const selectedProduct = orderedProducts.find(product => product.id === selectedProductId) ?? null;
  const purchaseDisabled = !productsFresh || state.productsLoading || state.purchasePending || !selectedProduct;

  async function purchaseSelectedProduct() {
    if (purchaseDisabled || !selectedProduct || purchaseInFlight.current) return;
    purchaseInFlight.current = true;
    try {
      await onPurchase(selectedProduct.id);
    } finally {
      purchaseInFlight.current = false;
    }
  }

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#1d071f', '#09050f', '#020106']} locations={[0, 0.46, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.ambientGlow}>
        <Image
          accessible={false}
          resizeMode="contain"
          source={require('../assets/atlas-header-orbit-v1.png')}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>JOURNEYDECK MEMBERSHIP</Text>
            <Text style={styles.atlasLabel}>ATLAS · PRIVATE DRIVE INTELLIGENCE</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close membership"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <Text accessibilityRole="header" style={styles.title}>Your driving story, decoded.</Text>
        <Text style={styles.subtitle}>Atlas finds the patterns, places, routes, and music hidden across every journey.</Text>

        <View style={[styles.hero, { height: 156 + (44 * expansion), marginTop: 11 + (5 * expansion) }]}>
          <ImageBackground
            accessible={false}
            source={require('../assets/atlas-globe-membership-v1.jpg')}
            resizeMode="cover"
            style={styles.heroImage}
            imageStyle={styles.heroImageCorners}
          >
            <LinearGradient
              colors={['rgba(3,1,8,0.02)', 'rgba(4,1,9,0.08)', 'rgba(5,2,10,0.88)']}
              locations={[0, 0.57, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>YOUR PRIVATE ATLAS</Text>
              <Text style={styles.heroTitle}>Every road becomes intelligence.</Text>
            </View>
          </ImageBackground>
        </View>

        <View style={[styles.featureGrid, { gap: 7 + (3 * expansion), marginTop: 9 + (3 * expansion) }]}>
          <View style={[styles.featureRow, { gap: 7 + (3 * expansion) }, stackedLayout && styles.featureRowStacked]}>
            <IntelligenceFeature
              expansion={expansion}
              stacked={stackedLayout}
              kind="pattern"
              title="Pattern Intelligence"
              description="See when and where you drive."
            />
            <IntelligenceFeature
              expansion={expansion}
              stacked={stackedLayout}
              kind="places"
              title="Favorite Places"
              description="Find the places that matter most."
            />
          </View>
          <View style={[styles.featureRow, { gap: 7 + (3 * expansion) }, stackedLayout && styles.featureRowStacked]}>
            <IntelligenceFeature
              expansion={expansion}
              stacked={stackedLayout}
              kind="routes"
              title="Repeated Routes"
              description="Spot roads that keep returning."
            />
            <IntelligenceFeature
              expansion={expansion}
              stacked={stackedLayout}
              kind="music"
              title="Music Moments"
              description="Match songs to places and drives."
            />
          </View>
        </View>

        <View style={[styles.historyRow, { minHeight: 43 + (9 * expansion), marginTop: 8 + (3 * expansion) }]}>
          <View style={styles.historyIcon}><Text style={styles.historyIconText}>∞</Text></View>
          <View style={styles.historyCopy}>
            <Text style={styles.historyTitle}>COMPLETE HISTORY</Text>
            <Text style={styles.historyDetail}>Every journey beyond the latest 45 days</Text>
          </View>
          <Text style={styles.historyCheck}>✓</Text>
        </View>

        <View style={[styles.planArea, { minHeight: 86 + (14 * expansion), marginTop: 8 + (3 * expansion) }]}>
          {state.productsLoading && <View accessibilityLiveRegion="polite" style={[styles.loading, { minHeight: 84 + (14 * expansion) }]}>
            <ActivityIndicator color="#ff7962" />
            <Text style={styles.loadingText}>Checking live App Store prices…</Text>
          </View>}

          {!state.productsLoading && orderedProducts.length > 0 && <View accessibilityRole="radiogroup" style={[styles.planRow, stackedLayout && styles.planRowStacked]}>
            {orderedProducts.map(product => {
              const selected = product.id === selectedProductId;
              const annual = product.id === ANNUAL_PRODUCT_ID;
              const disabled = !productsFresh || state.purchasePending;
              const suffix = periodSuffix(product);
              return <Pressable
                key={product.id}
                accessibilityRole="radio"
                accessibilityLabel={planName(product) + ', ' + product.displayPrice + (suffix ? ' ' + suffix : '')}
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() => setSelectedProductId(product.id)}
                style={({ pressed }) => [
                  styles.plan,
                  { minHeight: 84 + (14 * expansion), paddingVertical: 9 + (3 * expansion) },
                  selected && styles.planSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.planHeading}>
                  <Text style={[styles.planName, selected && styles.planNameSelected]}>{planName(product)}</Text>
                  {annual && <Text style={styles.bestValue}>BEST VALUE</Text>}
                </View>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
                  style={styles.planPrice}
                >
                  {product.displayPrice}
                </Text>
                <Text style={styles.planPeriod}>{suffix || 'App Store price'}</Text>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>;
            })}
          </View>}

          {!state.productsLoading && !orderedProducts.length && <View accessibilityLiveRegion="polite" style={[styles.unavailable, { minHeight: 72 + (14 * expansion) }]}>
            <Text style={styles.unavailableTitle}>App Store options unavailable</Text>
            <Text style={styles.unavailableDetail}>{state.message ?? 'Close this screen and try again in a moment.'}</Text>
          </View>}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={selectedProduct
            ? 'Unlock Atlas with ' + planName(selectedProduct) + ' for ' + selectedProduct.displayPrice + (periodSuffix(selectedProduct) ? ' ' + periodSuffix(selectedProduct) : '')
            : 'Unlock Atlas'}
          accessibilityState={{ disabled: purchaseDisabled }}
          disabled={purchaseDisabled}
          onPress={() => void purchaseSelectedProduct()}
          style={({ pressed }) => [styles.ctaShell, { minHeight: 52 + (6 * expansion) }, purchaseDisabled && styles.ctaDisabled, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={purchaseDisabled ? ['#5b3e4e', '#523149'] : ['#ff8a4d', '#ff3f72']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.cta, { minHeight: 52 + (6 * expansion) }]}
          >
            {state.purchasePending
              ? <ActivityIndicator color="#24060c" />
              : <Text style={styles.ctaText}>{selectedProduct ? 'Unlock Atlas · ' + selectedProduct.displayPrice : 'Unlock Atlas'}</Text>}
          </LinearGradient>
        </Pressable>

        {state.message && orderedProducts.length > 0 && <Text accessibilityLiveRegion="polite" style={styles.message}>{state.message}</Text>}

        <View style={[styles.footerRow, { marginTop: 3 + (5 * expansion) }]}>
          <Pressable
            accessibilityRole="button"
            disabled={state.purchasePending}
            onPress={() => void onRestore()}
            style={({ pressed }) => [styles.footerAction, pressed && styles.pressed]}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL('https://journeydeck.me/privacy')}
            style={styles.footerAction}
          >
            <Text style={styles.link}>Privacy</Text>
          </Pressable>
          <Text style={styles.footerDot}>·</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            style={styles.footerAction}
          >
            <Text style={styles.link}>Terms</Text>
          </Pressable>
        </View>
        <Text style={styles.legal}>Subscriptions renew automatically unless cancelled at least 24 hours before the current period ends.</Text>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

function IntelligenceFeature({ expansion, stacked, kind, title, description }: {
  expansion: number;
  stacked: boolean;
  kind: 'pattern' | 'places' | 'routes' | 'music';
  title: string;
  description: string;
}) {
  return <View style={[styles.feature, stacked && styles.featureStacked, { minHeight: 72 + (12 * expansion), paddingVertical: 9 + (3 * expansion) }]}>
    <MiniIntelligence kind={kind} />
    <View style={styles.featureCopy}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text numberOfLines={stacked ? undefined : 2} style={styles.featureDescription}>{description}</Text>
    </View>
  </View>;
}

function MiniIntelligence({ kind }: { kind: 'pattern' | 'places' | 'routes' | 'music' }) {
  if (kind === 'places') {
    return <View accessible={false} style={styles.mini}>
      <View style={styles.placeOuter}><View style={styles.placeInner}><View style={styles.placeDot} /></View></View>
    </View>;
  }
  if (kind === 'routes') {
    return <View accessible={false} style={styles.mini}>
      <View style={[styles.routeLine, styles.routeLineOne]} />
      <View style={[styles.routeLine, styles.routeLineTwo]} />
      <View style={styles.routePoint} />
    </View>;
  }
  if (kind === 'music') {
    return <View accessible={false} style={[styles.mini, styles.miniBars]}>
      {[11, 20, 15, 26, 17].map((height, index) => <View key={index} style={[styles.musicBar, { height }]} />)}
    </View>;
  }
  return <View accessible={false} style={[styles.mini, styles.miniBars]}>
    {[8, 14, 22, 28, 18].map((height, index) => <View key={index} style={[styles.patternBar, { height }]} />)}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#020106' },
  ambientGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    top: -175,
    right: -100,
    opacity: 0.72,
  },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  topRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#ff9a79', fontSize: 9, fontWeight: '900', letterSpacing: 1.9 },
  atlasLabel: { color: '#9d79bd', fontSize: 8, fontWeight: '900', letterSpacing: 1.25, marginTop: 4 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#755079',
    backgroundColor: 'rgba(23,11,28,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff7fb', fontSize: 29, lineHeight: 30, marginTop: -2, fontWeight: '300' },
  title: { color: '#fff9ff', fontSize: 30, lineHeight: 32, fontWeight: '900', letterSpacing: -1.05, marginTop: 4 },
  subtitle: { color: '#bdb0bf', fontSize: 12, lineHeight: 16, marginTop: 5, maxWidth: 360 },
  hero: {
    height: 156,
    marginTop: 11,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#b34c70',
    backgroundColor: '#110716',
    shadowColor: '#ff4b72',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
  },
  heroImage: { flex: 1, justifyContent: 'flex-end' },
  heroImageCorners: { borderRadius: 21 },
  heroCopy: { paddingHorizontal: 15, paddingBottom: 11 },
  heroKicker: { color: '#ffae8e', fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  heroTitle: { color: '#fff9ff', fontSize: 16, lineHeight: 19, fontWeight: '900', letterSpacing: -0.25, marginTop: 3 },
  featureGrid: { gap: 7, marginTop: 9 },
  featureRow: { flexDirection: 'row', gap: 7 },
  featureRowStacked: { flexDirection: 'column' },
  feature: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#57315c',
    backgroundColor: 'rgba(20,9,25,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureStacked: { flex: 0, width: '100%' },
  featureCopy: { flex: 1 },
  featureTitle: { color: '#fff6fb', fontSize: 11, lineHeight: 13, fontWeight: '900' },
  featureDescription: { color: '#a99dab', fontSize: 9, lineHeight: 12, marginTop: 3 },
  mini: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#853c65',
    backgroundColor: '#2a0e23',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingBottom: 6 },
  patternBar: { width: 3, borderRadius: 2, backgroundColor: '#ff7b62' },
  musicBar: { width: 3, borderRadius: 2, backgroundColor: '#d66eff' },
  placeOuter: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: '#bc567d', alignItems: 'center', justifyContent: 'center' },
  placeInner: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: '#ff7d66', alignItems: 'center', justifyContent: 'center' },
  placeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff9272' },
  routeLine: { position: 'absolute', width: 31, height: 2, borderRadius: 2, backgroundColor: '#ff7962' },
  routeLineOne: { transform: [{ rotate: '-26deg' }], top: 13, left: 3 },
  routeLineTwo: { transform: [{ rotate: '25deg' }], top: 23, left: 5, backgroundColor: '#d866ff' },
  routePoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff0e9', borderWidth: 2, borderColor: '#ff635f' },
  historyRow: {
    minHeight: 43,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#56315c',
    backgroundColor: 'rgba(19,9,24,0.92)',
    marginTop: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  historyIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#32121f', borderWidth: 1, borderColor: '#914357', alignItems: 'center', justifyContent: 'center' },
  historyIconText: { color: '#ff8066', fontSize: 15, fontWeight: '900' },
  historyCopy: { flex: 1 },
  historyTitle: { color: '#ff9b7a', fontSize: 8, fontWeight: '900', letterSpacing: 1.25 },
  historyDetail: { color: '#e4d9e6', fontSize: 10, fontWeight: '700', marginTop: 2 },
  historyCheck: { color: '#ff8b70', fontSize: 16, fontWeight: '900' },
  planArea: { minHeight: 86, marginTop: 8 },
  planRow: { flexDirection: 'row', gap: 8 },
  planRowStacked: { flexDirection: 'column' },
  plan: {
    flex: 1,
    minHeight: 84,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#55315c',
    backgroundColor: '#130918',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  planSelected: {
    borderColor: '#ff755f',
    backgroundColor: '#25101c',
    shadowColor: '#ff4b6b',
    shadowOpacity: 0.26,
    shadowRadius: 10,
  },
  planHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 16, gap: 4 },
  planName: { color: '#bdb0c1', fontSize: 10, fontWeight: '900', letterSpacing: 0.45 },
  planNameSelected: { color: '#ff9d80' },
  bestValue: { color: '#24070d', backgroundColor: '#ff8168', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  planPrice: { color: '#fff8fd', fontSize: 20, lineHeight: 23, fontWeight: '900', letterSpacing: -0.45, marginTop: 4, paddingRight: 22 },
  planPeriod: { color: '#9f91a3', fontSize: 9, lineHeight: 11, marginTop: 2 },
  radio: { position: 'absolute', right: 10, bottom: 10, width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#755178', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#ff8168' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff8168' },
  loading: { minHeight: 84, borderRadius: 17, backgroundColor: '#130918', borderWidth: 1, borderColor: '#55315c', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#baadbd', fontSize: 11, fontWeight: '700' },
  unavailable: { minHeight: 72, borderRadius: 17, backgroundColor: '#130918', borderWidth: 1, borderColor: '#55315c', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  unavailableTitle: { color: '#f7edf8', fontSize: 12, fontWeight: '900' },
  unavailableDetail: { color: '#9f92a2', fontSize: 10, marginTop: 4 },
  ctaShell: { minHeight: 52, marginTop: 9, borderRadius: 17, overflow: 'hidden', shadowColor: '#ff456c', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  cta: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  ctaText: { color: '#24070d', fontSize: 15, fontWeight: '900', letterSpacing: -0.15 },
  ctaDisabled: { opacity: 0.62, shadowOpacity: 0 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  message: { color: '#ffb492', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 7 },
  footerRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 3 },
  footerAction: { minHeight: 44, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  restoreText: { color: '#d8b4f3', fontSize: 11, fontWeight: '800' },
  footerDot: { color: '#625768', fontSize: 12 },
  link: { color: '#a78fbb', fontSize: 11, textDecorationLine: 'underline' },
  legal: { color: '#746b78', fontSize: 9.5, lineHeight: 13, textAlign: 'center', paddingHorizontal: 9 },
});
