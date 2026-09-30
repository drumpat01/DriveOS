import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { JourneyDeckMembershipProduct } from '../modules/journeydeck-membership';
import { haptics } from './haptics';
import { withAlpha } from './redesign-palette';
import { SERIF, useRedesignColors } from './redesign-ui';

const PERKS: readonly { symbol: SFSymbol; title: string; detail: string }[] = [
  { symbol: 'bubble.left.and.text.bubble.right.fill', title: 'Ask JourneyDeck', detail: 'Ask about your drives, here and with Siri' },
  { symbol: 'paintpalette.fill', title: 'Themes and icons', detail: 'Every theme and app icon' },
  { symbol: 'scissors', title: 'Journey Studio', detail: 'Trim, split and restore drives' },
  { symbol: 'infinity', title: 'Complete history', detail: 'Every journey, not just today' },
];

export type PaywallPlan = { product: JourneyDeckMembershipProduct; name: string; period: string; trialDays: number | null; badge?: string };

/**
 * V4 iPhone paywall. It uses the same pieces as Today and Memories: a photo card with its
 * title on a scrim, one grouped card, and theme-role colors, so it matches every theme.
 * It fits one screen at default text size and scrolls when text is larger.
 */
export function MembershipPaywallV4({ hero, plans, selectedId, onSelect, loading, pending, disabled, message, onPurchase, onRestore, onClose }: {
  hero: ImageSourcePropType;
  plans: PaywallPlan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  pending: boolean;
  disabled: boolean;
  message: string | null;
  onPurchase: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const c = useRedesignColors();
  const insets = useSafeAreaInsets();
  const selected = plans.find(plan => plan.product.id === selectedId) ?? null;

  return <View style={[styles.page, { backgroundColor: c.page }]}>
    <LinearGradient pointerEvents="none" colors={[c.glow, c.page]} style={styles.glow} />
    <ScrollView bounces={false} showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, styles.column, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.topBar}>
        <Text style={[styles.kicker, { color: c.textSecondary }]}>JOURNEYDECK PLUS</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Not now, keep the free plan" hitSlop={8} onPress={onClose}
          style={({ pressed }) => [styles.notNow, { backgroundColor: c.surfaceStrong, borderColor: c.border }, pressed && styles.pressed]}>
          <Text style={[styles.notNowText, { color: c.text }]}>Not now</Text>
        </Pressable>
      </View>

      <View style={[styles.hero, { borderColor: c.border, backgroundColor: c.surfaceStrong }]}>
        <ExpoImage accessible={false} source={hero} contentFit="cover" style={StyleSheet.absoluteFill} />
        <LinearGradient pointerEvents="none" colors={c.photoScrim} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroCopy}>
          <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Your driving story,{'\n'}decoded.</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {PERKS.map((perk, index) => <View key={perk.title} style={[styles.perk, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
          <View style={[styles.perkIcon, { backgroundColor: c.accentSoft }]}><SymbolView name={perk.symbol} tintColor={c.accent} size={16} weight="semibold" /></View>
          <View style={styles.flex}>
            <Text style={[styles.perkTitle, { color: c.text }]}>{perk.title}</Text>
            <Text numberOfLines={1} style={[styles.perkDetail, { color: c.textSecondary }]}>{perk.detail}</Text>
          </View>
        </View>)}
      </View>

      {loading ? <View accessibilityLiveRegion="polite" style={styles.loading}>
        <ActivityIndicator color={c.accent} />
        <Text style={[styles.perkDetail, { color: c.textSecondary }]}>Checking App Store prices…</Text>
      </View> : plans.length ? <View accessibilityRole="radiogroup" style={styles.plans}>
        {plans.map(plan => {
          const on = plan.product.id === selectedId;
          return <Pressable key={plan.product.id} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} disabled={disabled}
            accessibilityLabel={`${plan.name}, ${plan.product.displayPrice} ${plan.period}${plan.badge ? `, ${plan.badge}` : ''}`}
            onPress={() => { if (!on) { void haptics.selection(); onSelect(plan.product.id); } }}
            style={({ pressed }) => [styles.plan, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.border }, pressed && styles.pressed]}>
            <View style={styles.planTop}>
              <Text style={[styles.planName, { color: on ? c.text : c.textSecondary }]}>{plan.name}</Text>
              <View style={[styles.radio, { borderColor: on ? c.accent : c.textTertiary, backgroundColor: on ? c.accent : 'transparent' }]}>
                {on ? <SymbolView name="checkmark" tintColor={c.onAccent} size={11} weight="bold" /> : null}
              </View>
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.8} style={[styles.planPrice, { color: c.text }]}>{plan.product.displayPrice}</Text>
            <Text style={[styles.planPeriod, { color: c.textSecondary }]}>{plan.period}</Text>
            {plan.trialDays ? <Text style={[styles.planPeriod, { color: c.accent }]}>{plan.trialDays} days free</Text> : null}
            {plan.badge ? <View style={[styles.badge, { backgroundColor: c.highlightSoft }]}><Text style={[styles.badgeText, { color: c.text }]}>{plan.badge}</Text></View> : null}
          </Pressable>;
        })}
      </View> : <View accessibilityLiveRegion="polite" style={[styles.card, styles.unavailable, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.perkTitle, { color: c.text }]}>App Store options unavailable</Text>
        <Text style={[styles.perkDetail, { color: c.textSecondary, textAlign: 'center' }]}>{message ?? 'Close this screen and try again in a moment.'}</Text>
      </View>}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPurchase}
          accessibilityLabel={selected ? `${selected.trialDays ? `Start ${selected.trialDays}-day free trial, then` : 'Unlock JourneyDeck Plus,'} ${selected.name}, ${selected.product.displayPrice} ${selected.period}` : 'Unlock JourneyDeck Plus'}
          style={({ pressed }) => [styles.cta, { backgroundColor: disabled ? withAlpha(c.accent, 0.45) : c.accent }, pressed && styles.pressed]}>
          {pending ? <ActivityIndicator color={c.onAccent} /> : <Text style={[styles.ctaText, { color: c.onAccent }]}>{selected?.trialDays ? `Start ${selected.trialDays}-day free trial` : selected ? `Continue · ${selected.product.displayPrice}` : 'Continue'}</Text>}
        </Pressable>
        {selected?.trialDays ? <Text style={[styles.fine, { color: c.textSecondary }]}>Then {selected.product.displayPrice} {selected.period}. Renews automatically unless cancelled.</Text> : null}
        {message && plans.length ? <Text accessibilityLiveRegion="polite" style={[styles.fine, { color: c.danger }]}>{message}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="No thanks, keep the free plan" onPress={onClose} style={({ pressed }) => [styles.noThanks, pressed && styles.pressed]}>
          <Text style={[styles.noThanksText, { color: c.textSecondary }]}>No thanks, keep the free plan</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" disabled={pending} onPress={onRestore} hitSlop={8}><Text style={[styles.footerLink, { color: c.textTertiary }]}>Restore Purchases</Text></Pressable>
        <Text style={[styles.footerLink, { color: c.textTertiary }]}>·</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://journeydeck.me/privacy')} hitSlop={8}><Text style={[styles.footerLink, { color: c.textTertiary }]}>Privacy</Text></Pressable>
        <Text style={[styles.footerLink, { color: c.textTertiary }]}>·</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')} hitSlop={8}><Text style={[styles.footerLink, { color: c.textTertiary }]}>Terms</Text></Pressable>
      </View>
      <Text style={[styles.fine, { color: c.textTertiary }]}>Charged to your Apple Account. Renews automatically unless cancelled at least 24 hours before the period ends; manage it in Settings.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  page: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  content: { flexGrow: 1, paddingHorizontal: 20, gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1 },
  notNow: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  notNowText: { fontSize: 15, fontWeight: '600' },
  hero: { height: 176, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'flex-end' },
  heroCopy: { padding: 18 },
  title: { fontFamily: SERIF, fontSize: 30, lineHeight: 35, fontWeight: '600', letterSpacing: -0.5 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  perk: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  perkIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
  perkDetail: { fontSize: 13, lineHeight: 17 },
  loading: { minHeight: 104, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  plans: { flexDirection: 'row', gap: 10 },
  plan: { flex: 1, minHeight: 104, borderRadius: 22, borderWidth: 1.5, padding: 14, gap: 2 },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: 14, fontWeight: '700' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  planPrice: { fontFamily: SERIF, fontSize: 26, lineHeight: 31, fontWeight: '600', marginTop: 4 },
  planPeriod: { fontSize: 13 },
  badge: { position: 'absolute', right: 12, bottom: 12, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  unavailable: { minHeight: 104, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 4 },
  actions: { gap: 2 },
  cta: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '700' },
  noThanks: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  noThanksText: { fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  footerLink: { fontSize: 12, fontWeight: '600' },
  fine: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
