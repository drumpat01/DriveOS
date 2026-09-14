import { StyleSheet, Text, View } from 'react-native';
import { FirstJourneyMedallion } from '../modules/journeydeck-keepsakes';
import { useAppTheme } from './app-theme';

export function FirstJourneyKeepsake({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  const palette = theme.resolvePalette(theme.isLight
    ? { card: '#fff8ed', text: '#2b1d20', muted: '#715d65', line: '#d9c2ae', accent: '#a64d34' }
    : { card: '#120d1a', text: '#fff6ed', muted: '#b6a6c1', line: '#51354c', accent: '#e4ae58' });
  return <View testID="first-journey-keepsake" style={[styles.card, compact && styles.compactCard,
    { backgroundColor: palette.card, borderColor: palette.line }]}>
    <FirstJourneyMedallion style={compact ? styles.compactCoin : styles.coin} />
    <View style={styles.copy}>
      <Text style={[styles.eyebrow, { color: palette.accent }]}>FIRST RECORDED JOURNEY</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>The First Track</Text>
      <Text style={[styles.body, { color: palette.muted }]}>Your road story began with a soundtrack. Drag the medallion to turn it.</Text>
      <Text style={[styles.earned, { color: palette.accent }]}>EARNED · JOURNEY 01</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 230, borderWidth: 1, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 18, overflow: 'hidden' },
  compactCard: { minHeight: 190, padding: 12, gap: 10 },
  coin: { width: 210, height: 210, flexShrink: 0 },
  compactCoin: { width: 146, height: 166, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 7 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 25, lineHeight: 30, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 19 },
  earned: { marginTop: 4, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
});
