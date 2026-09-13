import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from './app-theme';
import type { ThemeId } from './theme-catalog';

const LOGO = require('../assets/icon-tinted-clear-v1.png');
const ARTWORK: Record<ThemeId, number> = {
  dark: require('../assets/onboarding-road-background.png'),
  redline: require('../assets/theme-grand-touring-home-v2.png'),
  light: require('../assets/home-header-light-v1.png'),
  sakura: require('../assets/theme-rosewater-road-v1.png'),
};

function alpha(hex: string, opacity: number) {
  const value = Math.max(0, Math.min(255, Math.round(opacity * 255))).toString(16).padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${value}` : hex;
}

export function FirstRunWelcomeScreen({ onStart }: { onStart: () => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const palette = theme.palette;

  return <View testID="first-run-welcome" style={[styles.screen, { backgroundColor: palette.page }]}>
    <Image testID="welcome-road-artwork" source={ARTWORK[theme.id]} contentFit="cover" accessible={false}
      style={[StyleSheet.absoluteFill, { opacity: theme.isLight ? 0.28 : 0.5 }]} />
    <LinearGradient pointerEvents="none"
      colors={[alpha(palette.page, theme.isLight ? 0.18 : 0.08), alpha(palette.page, 0.72), palette.page]}
      locations={[0, 0.58, 1]} style={StyleSheet.absoluteFill} />
    <View style={[styles.safeArea, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.welcomeContent}>
        <View style={[styles.logoFrame, { backgroundColor: alpha(palette.card, 0.9), borderColor: alpha(palette.accent, 0.72), shadowColor: palette.accent }]}>
          <Image testID="welcome-logo" source={LOGO} contentFit="contain" accessible={false}
            style={[styles.logo, { tintColor: palette.accent }]} />
        </View>
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" style={[styles.welcomeLine, { color: palette.text }]}>Welcome to</Text>
          <Text style={[styles.productName, { color: palette.accent }]}>JourneyDeck</Text>
          <Text style={[styles.tagline, { color: palette.muted }]}>Every mile has a story.</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Start JourneyDeck setup" onPress={onStart}
          style={({ pressed }) => [styles.startButton, { backgroundColor: palette.accent, borderColor: alpha(palette.text, 0.18) }, pressed && styles.startPressed]}>
          <Text style={[styles.startLabel, { color: palette.onAccent }]}>Start</Text>
        </Pressable>
        <Text accessible={false} style={[styles.wordmark, { color: palette.muted }]}>JOURNEYDECK</Text>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 28 },
  welcomeContent: { flex: 1, minHeight: 390, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  logoFrame: { width: 164, height: 164, borderRadius: 82, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 9 } },
  logo: { width: 126, height: 126 },
  titleGroup: { alignItems: 'center', marginTop: 30 },
  welcomeLine: { fontSize: 30, lineHeight: 36, fontWeight: '500', textAlign: 'center' },
  productName: { fontSize: 46, lineHeight: 54, fontWeight: '800', letterSpacing: -1.3, textAlign: 'center' },
  tagline: { fontSize: 17, lineHeight: 24, marginTop: 12, textAlign: 'center' },
  footer: { alignItems: 'center', gap: 20 },
  startButton: { width: '100%', maxWidth: 390, minHeight: 62, borderRadius: 31, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  startPressed: { opacity: 0.78 },
  startLabel: { fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: 2.6, textTransform: 'uppercase' },
  wordmark: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 4.2, opacity: 0.78 },
});
