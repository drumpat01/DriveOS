import { useAppTheme } from './app-theme';
import { headerImageSource } from './header-image-sources';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  JOURNEYDECK_MEMBERSHIP_PRODUCT_IDS,
  type JourneyDeckMembershipProduct,
} from '../modules/journeydeck-membership';
import type { JourneyDeckMembershipState } from './membership-store';
import { journeyDeckRadius, journeyDeckSemanticColors, journeyDeckSpacing, journeyDeckTypography, type JourneyDeckSemanticColors } from './journeydeck-design-tokens';

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

function alpha(hex: string, opacity: number) {
  const value = Math.max(0, Math.min(255, Math.round(opacity * 255))).toString(16).padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${value}` : hex;
}

export function MembershipPaywall({ visible, state, onClose, onLoadProducts, onPurchase, onRestore }: {
  visible: boolean;
  state: JourneyDeckMembershipState;
  onClose: () => void;
  onLoadProducts: () => Promise<boolean>;
  onPurchase: (productId: string) => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const theme = useAppTheme();
  const colors = journeyDeckSemanticColors(theme.id, theme.palette);
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth, fontScale } = useWindowDimensions();
  const heroHeight = Math.max(300, Math.min(420, viewportHeight * 0.44));
  const stackedLayout = fontScale >= 1.25 || viewportWidth < 350;

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productsFresh, setProductsFresh] = useState(false);
  const loadProductsRef = useRef(onLoadProducts);
  const openGeneration = useRef(0);
  const purchaseInFlight = useRef(false);

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
    <View style={[styles.safe, { backgroundColor: colors.page }]}>
      <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { height: heroHeight, paddingTop: insets.top }]}>
          <ExpoImage
            accessible={false}
            source={headerImageSource(require('../assets/cinematic-membership-photo-v1.jpg'), theme.id)}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[`${colors.page}00`, `${colors.page}59`, colors.page]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close membership"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.close, { top: 12, backgroundColor: alpha(colors.surface, 0.82), borderColor: alpha(colors.separator, 0.5) }, pressed && styles.pressed]}
          >
            <SymbolView name="xmark" tintColor={colors.text} size={14} weight="bold" />
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>JOURNEYDECK MEMBERSHIP</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your driving story, decoded.</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Atlas finds the patterns, places, routes, and music hidden across every journey.</Text>
          </View>
        </View>

        <View style={styles.benefits}>
          <BenefitRow icon="chart.line.uptrend.xyaxis" title="Pattern Intelligence" description="See when and where you drive." colors={colors} />
          <BenefitRow icon="mappin.and.ellipse" title="Favorite Places" description="Find the places that matter most." colors={colors} />
          <BenefitRow icon="scissors" title="Journey Studio" description="Trim, split, and restore your drives." colors={colors} />
          <BenefitRow icon="music.note" title="Your Year on the Road" description="Relive your year with music and motion." colors={colors} />
          <BenefitRow icon="infinity" title="Complete History" description="Every journey beyond the latest 45 days." colors={colors} last />
        </View>

        <View style={styles.planArea}>
          {state.productsLoading && <View accessibilityLiveRegion="polite" style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Checking live App Store prices…</Text>
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
                  { borderColor: alpha(colors.separator, 0.7), backgroundColor: colors.surface },
                  selected && { borderColor: colors.accent, backgroundColor: alpha(colors.accent, 0.1) },
                  pressed && styles.pressed,
                ]}
              >
                {annual && <Text style={[styles.bestValue, { color: colors.onAccent, backgroundColor: colors.accent }]}>BEST VALUE</Text>}
                <Text style={[styles.planName, { color: colors.textSecondary }, selected && { color: colors.accent }]}>{planName(product)}</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.planPrice, { color: colors.text }]}>{product.displayPrice}</Text>
                <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>{suffix || 'App Store price'}</Text>
              </Pressable>;
            })}
          </View>}

          {!state.productsLoading && !orderedProducts.length && <View accessibilityLiveRegion="polite" style={[styles.unavailable, { backgroundColor: colors.surface, borderColor: alpha(colors.separator, 0.7) }]}>
            <Text style={[styles.unavailableTitle, { color: colors.text }]}>App Store options unavailable</Text>
            <Text style={[styles.unavailableDetail, { color: colors.textSecondary }]}>{state.message ?? 'Close this screen and try again in a moment.'}</Text>
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
          style={({ pressed }) => [styles.cta, { backgroundColor: purchaseDisabled ? alpha(colors.accent, 0.4) : colors.accent }, pressed && styles.pressed]}
        >
          {state.purchasePending
            ? <ActivityIndicator color={colors.onAccent} />
            : <Text style={[styles.ctaText, { color: colors.onAccent }]}>{selectedProduct ? 'Unlock Atlas · ' + selectedProduct.displayPrice : 'Unlock Atlas'}</Text>}
        </Pressable>

        {state.message && orderedProducts.length > 0 && <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.danger }]}>{state.message}</Text>}

        <View style={[styles.footerRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable accessibilityRole="button" disabled={state.purchasePending} onPress={() => void onRestore()} style={({ pressed }) => [pressed && styles.pressed]}>
            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Restore Purchases</Text>
          </Pressable>
          <Text style={[styles.footerDot, { color: colors.separator }]}>·</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://journeydeck.me/privacy')}>
            <Text style={[styles.footerLink, styles.footerLinkUnderline, { color: colors.textSecondary }]}>Privacy</Text>
          </Pressable>
          <Text style={[styles.footerDot, { color: colors.separator }]}>·</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
            <Text style={[styles.footerLink, styles.footerLinkUnderline, { color: colors.textSecondary }]}>Terms</Text>
          </Pressable>
        </View>
        <Text style={[styles.legal, { color: colors.textSecondary }]}>Subscriptions renew automatically unless cancelled at least 24 hours before the current period ends.</Text>
      </ScrollView>
    </View>
  </Modal>;
}

function BenefitRow({ icon, title, description, colors, last = false }: { icon: SFSymbol; title: string; description: string; colors: JourneyDeckSemanticColors; last?: boolean }) {
  return <View style={[styles.benefitRow, !last && { borderBottomColor: alpha(colors.separator, 0.4), borderBottomWidth: StyleSheet.hairlineWidth }]}>
    <View style={[styles.benefitIcon, { backgroundColor: alpha(colors.accent, 0.14) }]}>
      <SymbolView name={icon} tintColor={colors.accent} size={19} />
    </View>
    <View style={styles.benefitCopy}>
      <Text style={[journeyDeckTypography.label, { color: colors.text }]}>{title}</Text>
      <Text style={[journeyDeckTypography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{description}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: journeyDeckSpacing[6] },
  hero: { width: '100%', justifyContent: 'flex-end', overflow: 'hidden' },
  close: { position: 'absolute', right: journeyDeckSpacing[4], width: 32, height: 32, borderRadius: journeyDeckRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { paddingHorizontal: journeyDeckSpacing[6], paddingBottom: journeyDeckSpacing[5] },
  eyebrow: { ...journeyDeckTypography.kicker, marginBottom: journeyDeckSpacing[2] },
  title: { fontFamily: 'Georgia', fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { ...journeyDeckTypography.body, marginTop: journeyDeckSpacing[2], maxWidth: 420 },
  benefits: { paddingHorizontal: journeyDeckSpacing[6], paddingTop: journeyDeckSpacing[5] },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: journeyDeckSpacing[3], paddingVertical: journeyDeckSpacing[3] },
  benefitIcon: { width: 38, height: 38, borderRadius: journeyDeckRadius.compact, alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1 },
  planArea: { paddingHorizontal: journeyDeckSpacing[6], paddingTop: journeyDeckSpacing[6] },
  planRow: { flexDirection: 'row', gap: journeyDeckSpacing[3] },
  planRowStacked: { flexDirection: 'column' },
  plan: { flex: 1, borderRadius: journeyDeckRadius.card, borderWidth: 1.5, borderCurve: 'continuous', paddingHorizontal: journeyDeckSpacing[4], paddingVertical: journeyDeckSpacing[4] },
  bestValue: { alignSelf: 'flex-start', borderRadius: journeyDeckRadius.full, overflow: 'hidden', paddingHorizontal: journeyDeckSpacing[2], paddingVertical: 3, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginBottom: journeyDeckSpacing[2] },
  planName: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  planPrice: { fontFamily: 'Georgia', fontSize: 24, lineHeight: 28, fontWeight: '700', marginTop: journeyDeckSpacing[1] },
  planPeriod: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  loading: { minHeight: 96, borderRadius: journeyDeckRadius.card, flexDirection: 'row', gap: journeyDeckSpacing[2], alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13, fontWeight: '600' },
  unavailable: { minHeight: 96, borderRadius: journeyDeckRadius.card, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: journeyDeckSpacing[4], gap: journeyDeckSpacing[1] },
  unavailableTitle: { fontSize: 14, fontWeight: '800' },
  unavailableDetail: { fontSize: 12, textAlign: 'center' },
  cta: { minHeight: 56, marginTop: journeyDeckSpacing[5], marginHorizontal: journeyDeckSpacing[6], borderRadius: journeyDeckRadius.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '800', letterSpacing: -0.15 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  message: { fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: journeyDeckSpacing[3], paddingHorizontal: journeyDeckSpacing[6] },
  footerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: journeyDeckSpacing[2], marginTop: journeyDeckSpacing[5] },
  footerLink: { fontSize: 12, fontWeight: '600' },
  footerLinkUnderline: { textDecorationLine: 'underline' },
  footerDot: { fontSize: 12 },
  legal: { fontSize: 10.5, lineHeight: 14, textAlign: 'center', paddingHorizontal: journeyDeckSpacing[6] },
});
