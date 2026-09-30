// Today's banner while the first-launch Plus trial runs (replaces the onboarding screen that used to announce it).
// Slides in once; its gold ring draws around the days left, which counts down each day.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { Easing, FadeInDown, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { haptics } from './haptics';
import { useMotionPreferences } from './motion';
import { PLUS_TRIAL_DAYS } from './plus-trial';
import { SERIF, useRedesignColors } from './redesign-ui';
import { withAlpha } from './redesign-palette';

const DAY_MS = 86_400_000;
const SIZE = 36;
const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Whole days left, rounded up so the last day reads "1 day". */
export function trialDaysLeft(trialEndsAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((trialEndsAt - now) / DAY_MS));
}

export function PlusTrialBanner({ trialEndsAt, onPress, now = Date.now() }: { trialEndsAt: number | null; onPress: () => void; now?: number }) {
  const c = useRedesignColors();
  const { reduceMotion } = useMotionPreferences();
  const days = trialEndsAt ? trialDaysLeft(trialEndsAt, now) : 0;
  // The ring shows how much of the trial is left.
  const remaining = Math.min(1, days / PLUS_TRIAL_DAYS);
  const drawn = useSharedValue(reduceMotion ? remaining : 0);
  useEffect(() => { if (!reduceMotion) drawn.value = withDelay(350, withTiming(remaining, { duration: 900, easing: Easing.bezier(0.5, 0, 0.2, 1) })); }, [drawn, reduceMotion, remaining]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - drawn.value) }));
  if (!trialEndsAt || days <= 0) return null;
  const title = days === 1 ? 'Plus is on for 1 more day' : `Plus is on for ${days} days`;
  return <Animated.View entering={FadeInDown.delay(150).springify().damping(15)}>
    <Pressable testID="plus-trial-banner" accessibilityRole="button" accessibilityLabel={`${title}. No payment. See what's included`}
      onPress={() => { void haptics.selection(); onPress(); }}
      style={({ pressed }) => [styles.banner, { backgroundColor: withAlpha(c.accent, 0.12), borderColor: withAlpha(c.accent, 0.45) }, pressed && styles.pressed]}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={withAlpha(c.accent, 0.25)} strokeWidth={2} fill="none" />
          <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={c.accent} strokeWidth={2} fill="none" strokeLinecap="round"
            strokeDasharray={[CIRCUMFERENCE, CIRCUMFERENCE]} animatedProps={ring} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
        </Svg>
        <Text style={[styles.days, { color: c.accent }]}>{days}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <Text style={[styles.detail, { color: c.textSecondary }]}>No payment. See what&apos;s included</Text>
      </View>
      <SymbolView name="chevron.right" tintColor={c.accent} size={14} weight="semibold" />
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
  pressed: { opacity: 0.8 },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  days: { fontFamily: SERIF, fontSize: 17, fontWeight: '600' },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 12, marginTop: 2 },
});
