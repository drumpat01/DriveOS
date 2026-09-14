import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from './app-theme';
import type { ThemeId } from './theme-catalog';

export const FIRST_RUN_ARTWORK: Record<ThemeId, number> = {
  dark: require('../assets/onboarding-road-background.png'),
  redline: require('../assets/onboarding-grand-touring-blue-hour.jpg'),
  light: require('../assets/home-header-light-v1.png'),
  sakura: require('../assets/theme-rosewater-road-v1.png'),
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
          <Text accessibilityRole="header" style={[styles.productName, { color: palette.text }]}>JourneyDeck</Text>
          <Text style={[styles.tagline, { color: palette.muted }]}>Every mile has a story.</Text>
        </View>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Start JourneyDeck setup" onPress={onStart}
            style={({ pressed }) => [styles.startButton, { backgroundColor: palette.accent, borderColor: alpha(palette.text, 0.18) }, pressed && styles.startPressed]}>
            <Text style={[styles.startLabel, { color: palette.onAccent }]}>Get Started</Text>
          </Pressable>
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
  scenerySpace: { flexGrow: 1, minHeight: 120 },
  welcomeContent: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 32 },
  productName: { fontFamily: 'Georgia', fontSize: 42, lineHeight: 52, fontWeight: '400', letterSpacing: -1.2, flexShrink: 1 },
  tagline: { fontSize: 17, lineHeight: 25, marginTop: 10 },
  footer: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 8, paddingBottom: 12 },
  startButton: { width: '100%', minHeight: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 24, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  startPressed: { opacity: 0.78 },
  startLabel: { fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
});
