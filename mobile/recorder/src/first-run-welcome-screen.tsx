import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from './app-theme';
import type { ThemeId } from './theme-catalog';

export const FIRST_RUN_ARTWORK: Record<ThemeId, number> = {
  dark: require('../assets/onboarding-road-background.png'),
  redline: require('../assets/onboarding-grand-touring-blue-hour.jpg'),
  light: require('../assets/home-header-light-v1.png'),
  sakura: require('../assets/theme-rosewater-road-v1.png'),
  'midnight-canopy': require('../assets/theme-midnight-canopy-v1.png'),
};

function alpha(hex: string, opacity: number) {
  const value = Math.max(0, Math.min(255, Math.round(opacity * 255))).toString(16).padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${value}` : hex;
}

export function FirstRunWelcomeScreen({ onStart, contentOnly = false }: { onStart: () => void; contentOnly?: boolean }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const palette = theme.palette;

  return <View testID="first-run-welcome" style={[styles.screen, { backgroundColor: contentOnly ? 'transparent' : palette.page }]}>
    {!contentOnly && <><Image testID="welcome-road-artwork" source={FIRST_RUN_ARTWORK[theme.id]} contentFit="cover" accessible={false}
      style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none"
      colors={theme.id === 'redline' ? [`${palette.page}00`, `${palette.page}08`, `${palette.page}99`, palette.page] : [alpha(palette.page, 0.2), alpha(palette.page, theme.isLight ? 0.35 : 0.1), alpha(palette.page, 0.94), palette.page]}
      locations={theme.id === 'redline' ? [0, 0.48, 0.80, 1] : [0, 0.32, 0.65, 1]} style={StyleSheet.absoluteFill} /></>}
    <View style={[styles.safeArea, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.scenerySpace} />
        <View style={styles.welcomeContent}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>JOURNEYDECK</Text>
          <Text accessibilityRole="header" style={[styles.headline, { color: palette.text }]}>Your drives,{`\n`}remembered.</Text>
          <Text style={[styles.valueProposition, { color: palette.muted }]}>Record the route, match the music you played, and keep the moments in one private road archive.</Text>
          <View accessibilityLabel="Example memory: Sunday Coast Drive, 12.4 miles, 28 minutes, matched with Nightfall Radio, 3 songs."
            style={[styles.sampleMemoryCard, { backgroundColor: alpha(palette.card, theme.isLight ? 0.88 : 0.72), borderColor: alpha(palette.line, 0.72) }]}>
            <Text style={[styles.sampleMemoryKicker, { color: palette.accent }]}>WHAT YOU'LL GET</Text>
            <View style={styles.sampleMemoryRow}>
              <View style={[styles.sampleMemoryIcon, { backgroundColor: alpha(palette.accent, 0.16) }]}><SymbolView name="mappin.and.ellipse" tintColor={palette.accent} size={16} /></View>
              <View style={styles.sampleMemoryText}>
                <Text style={[styles.sampleMemoryTitle, { color: palette.text }]}>Sunday Coast Drive</Text>
                <Text style={[styles.sampleMemoryMeta, { color: palette.muted }]}>12.4 mi · 28 min</Text>
              </View>
            </View>
            <View style={styles.sampleMemoryRow}>
              <View style={[styles.sampleMemoryIcon, { backgroundColor: alpha(palette.accent, 0.16) }]}><SymbolView name="music.note" tintColor={palette.accent} size={16} /></View>
              <View style={styles.sampleMemoryText}>
                <Text style={[styles.sampleMemoryTitle, { color: palette.text }]}>Nightfall Radio</Text>
                <Text style={[styles.sampleMemoryMeta, { color: palette.muted }]}>3 songs matched automatically</Text>
              </View>
            </View>
          </View>
          <View accessibilityLabel="Private by design. Your roads stay on this iPhone and in your iCloud."
            style={[styles.privacyCard, { backgroundColor: alpha(palette.card, theme.isLight ? 0.88 : 0.72), borderColor: alpha(palette.line, 0.72) }]}>
            <View style={[styles.privacyDot, { backgroundColor: palette.accent }]} />
            <Text style={[styles.privacyText, { color: palette.text }]}>Private by design. Your roads stay on this iPhone and in your iCloud.</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Start JourneyDeck setup" onPress={onStart}
            style={({ pressed }) => [styles.startButton, { backgroundColor: palette.accent, borderColor: alpha(palette.text, 0.18) }, pressed && styles.startPressed]}>
            <Text style={[styles.startLabel, { color: palette.onAccent }]}>Set up JourneyDeck</Text>
          </Pressable>
          <Text style={[styles.nextStep, { color: palette.muted }]}>Recording and music choices are next. Change them anytime.</Text>
        </View>
      </ScrollView>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  scenerySpace: { flexGrow: 1, minHeight: 96 },
  welcomeContent: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 22 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 2.4, marginBottom: 10 },
  headline: { fontFamily: 'Georgia', fontSize: 42, lineHeight: 47, fontWeight: '700', letterSpacing: -1.25, flexShrink: 1 },
  valueProposition: { maxWidth: 480, fontSize: 16, lineHeight: 23, marginTop: 14 },
  sampleMemoryCard: { maxWidth: 480, borderRadius: 18, borderWidth: 1, padding: 14, gap: 10, marginTop: 18 },
  sampleMemoryKicker: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.6 },
  sampleMemoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sampleMemoryIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sampleMemoryText: { flex: 1 },
  sampleMemoryTitle: { fontSize: 14, fontWeight: '700' },
  sampleMemoryMeta: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  privacyCard: { maxWidth: 480, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginTop: 18 },
  privacyDot: { width: 7, height: 7, borderRadius: 4 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  footer: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 4, paddingBottom: 12 },
  startButton: { width: '100%', minHeight: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 24, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  startPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  startLabel: { fontSize: 17, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  nextStep: { maxWidth: 360, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 11 },
});
