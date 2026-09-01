import { useEffect, useRef } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { JourneyDeckMembershipProduct } from '../modules/journeydeck-membership';
import type { JourneyDeckMembershipState } from './membership-store';

function periodLabel(product: JourneyDeckMembershipProduct) {
  if (!product.periodUnit || !product.periodValue) return '';
  const unit = product.periodValue === 1 ? product.periodUnit : `${product.periodUnit}s`;
  return `${product.displayPrice} / ${product.periodValue === 1 ? '' : `${product.periodValue} `}${unit}`;
}

export function MembershipPaywall({ visible, state, onClose, onLoadProducts, onPurchase, onRestore }: {
  visible: boolean;
  state: JourneyDeckMembershipState;
  onClose: () => void;
  onLoadProducts: () => void;
  onPurchase: (productId: string) => void;
  onRestore: () => void;
}) {
  const requestedProducts = useRef(false);
  useEffect(() => {
    if (!visible) {
      requestedProducts.current = false;
      return;
    }
    if (!requestedProducts.current && !state.products.length && !state.productsLoading) {
      requestedProducts.current = true;
      onLoadProducts();
    }
  }, [onLoadProducts, state.products.length, state.productsLoading, visible]);

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#250b28', '#09050f', '#030207']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}><Text style={styles.brand}>JOURNEYDECK</Text><Pressable accessibilityRole="button" accessibilityLabel="Close membership" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
        <Text style={styles.eyebrow}>THE WHOLE ROAD · YOURS</Text>
        <Text style={styles.title}>Keep every journey within reach.</Text>
        <Text style={styles.subtitle}>Free JourneyDeck keeps your latest 45 days. Membership unlocks Atlas and your complete private history without changing how your journeys are stored.</Text>

        <View style={styles.featureCard}>
          <Feature glyph="⌁" title="Atlas" detail="See the places, patterns, and roads that shape your life." />
          <Feature glyph="∞" title="Complete history" detail="Open journeys, memories, and timeline moments beyond 45 days." />
          <Feature glyph="⌂" title="Still local-first" detail="Your routes and memories remain private on your iPhone and in your private iCloud." last />
        </View>

        {state.productsLoading && <View style={styles.loading}><ActivityIndicator color="#ff7962" /><Text style={styles.loadingText}>Checking the App Store…</Text></View>}
        {!state.productsLoading && state.products.map(product => <Pressable key={product.id} disabled={state.purchasePending} onPress={() => onPurchase(product.id)} style={({ pressed }) => [styles.product, pressed && styles.pressed]}>
          <View style={styles.productCopy}><Text style={styles.productName}>{product.displayName || (product.periodUnit === 'year' ? 'JourneyDeck Annual' : 'JourneyDeck Monthly')}</Text><Text style={styles.productDetail}>{periodLabel(product)}</Text></View>
          <LinearGradient colors={['#ff8a4d', '#ff3f72']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.productAction}><Text style={styles.productActionText}>{state.purchasePending ? 'WAIT…' : 'CHOOSE'}</Text></LinearGradient>
        </Pressable>)}
        {state.message && <Text style={styles.message}>{state.message}</Text>}

        <Pressable disabled={state.purchasePending} onPress={onRestore} style={styles.restore}><Text style={styles.restoreText}>Restore Purchases</Text></Pressable>
        <Text style={styles.legal}>Payment is charged to your Apple Account. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your App Store subscription settings.</Text>
        <View style={styles.links}>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://journeydeck.me/privacy')}><Text style={styles.link}>Privacy Policy</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}><Text style={styles.link}>Terms of Use</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

function Feature({ glyph, title, detail, last = false }: { glyph: string; title: string; detail: string; last?: boolean }) {
  return <View style={[styles.feature, last && styles.featureLast]}><View style={styles.featureGlyph}><Text style={styles.featureGlyphText}>{glyph}</Text></View><View style={styles.featureCopy}><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureDetail}>{detail}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#030207' },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 38 },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#ff795f', fontSize: 10, fontWeight: '900', letterSpacing: 2.7 },
  close: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#614068', backgroundColor: '#160d1b', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#f5edf7', fontSize: 27, lineHeight: 28, marginTop: -2, fontWeight: '300' },
  eyebrow: { color: '#ff9a79', fontSize: 10, fontWeight: '900', letterSpacing: 2.4, marginTop: 22 },
  title: { color: '#fff9ff', fontSize: 36, lineHeight: 40, fontWeight: '900', letterSpacing: -1.2, marginTop: 8 },
  subtitle: { color: '#b3a8b8', fontSize: 14, lineHeight: 21, marginTop: 12 },
  featureCard: { marginTop: 25, borderRadius: 24, borderWidth: 1, borderColor: '#593160', backgroundColor: 'rgba(20,10,25,0.9)', paddingHorizontal: 16 },
  feature: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#47304c' },
  featureLast: { borderBottomWidth: 0 },
  featureGlyph: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#934957', backgroundColor: '#32131d', alignItems: 'center', justifyContent: 'center' },
  featureGlyphText: { color: '#ff8066', fontSize: 20, fontWeight: '900' },
  featureCopy: { flex: 1, paddingVertical: 12 },
  featureTitle: { color: '#f8f2fa', fontSize: 15, fontWeight: '900' },
  featureDetail: { color: '#95899c', fontSize: 11, lineHeight: 16, marginTop: 4 },
  loading: { minHeight: 68, marginTop: 18, borderRadius: 18, backgroundColor: '#120b16', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#a99dad', fontSize: 12, fontWeight: '700' },
  product: { minHeight: 74, marginTop: 12, borderRadius: 19, borderWidth: 1, borderColor: '#70405d', backgroundColor: '#170c18', paddingLeft: 17, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  productCopy: { flex: 1 },
  productName: { color: '#fff7fb', fontSize: 15, fontWeight: '900' },
  productDetail: { color: '#bbabbc', fontSize: 11, marginTop: 4 },
  productAction: { minWidth: 78, height: 43, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  productActionText: { color: '#22070d', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  message: { color: '#ffb492', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 13 },
  restore: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  restoreText: { color: '#d2b0ef', fontSize: 13, fontWeight: '800' },
  legal: { color: '#736a78', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 14 },
  link: { color: '#a78ac0', fontSize: 10, textDecorationLine: 'underline' },
});
