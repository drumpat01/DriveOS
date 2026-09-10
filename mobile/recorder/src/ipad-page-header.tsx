import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from './app-theme';
import { PhoneTabTitle } from './phone-tab-title';
import { HeaderArtworkLayers, HEADER_ARTWORK_ASPECT_RATIO } from './header-artwork';

/** One title treatment for every implemented iPad tab, using its own theme artwork. */
export function IpadPageHeader({ title, artwork, width, subtitle, children, compact = false }: {
  title: string; artwork: ImageSourcePropType; width: number; subtitle?: string; children?: ReactNode; compact?: boolean;
}) {
  const theme = useAppTheme();
  const page = theme.palette.page;
  if (compact) return <View testID="ipad-page-header" style={{ backgroundColor: page }}>
    <PhoneTabTitle title={title} testID="ipad-page-title" />
    <View style={[styles.hero, styles.compactHero, { backgroundColor: page }]}>
      <HeaderArtworkLayers source={artwork} />
      <LinearGradient pointerEvents="none" colors={[`${page}e8`, `${page}a8`, `${page}30`]} locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={[`${page}00`, page]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      <View testID="page-header-content" style={[styles.content, styles.compactContent]}>
        {subtitle ? <Text style={[styles.subtitle, styles.compactSubtitle, { color: theme.palette.muted }]}>{subtitle}</Text> : null}
        {children ? <View testID="page-header-actions" style={[styles.actions, styles.compactActions]}>{children}</View> : null}
      </View>
    </View>
  </View>;
  return <View testID="ipad-page-header" style={[styles.hero, compact && styles.compactHero, { backgroundColor: page }]}>
    <HeaderArtworkLayers source={artwork} />
    <LinearGradient pointerEvents="none" colors={[`${page}e8`, `${page}a8`, `${page}30`]} locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={[`${page}00`, page]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
    <View testID="page-header-content" style={[styles.content, compact && styles.compactContent]}>
      <View style={styles.copy}><Text testID="ipad-page-title" accessibilityRole="header"
        style={[styles.title, { fontSize: width >= 600 ? 36 : 28, color: theme.palette.text }]}>{title.toUpperCase()}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.palette.muted }]}>{subtitle}</Text> : null}</View>
      {children ? <View testID="page-header-actions" style={[styles.actions, compact && styles.compactActions]}>{children}</View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hero: { width: '100%', minHeight: 190, overflow: 'hidden', justifyContent: 'flex-end', padding: 24 },
  compactHero: { minHeight: 0, aspectRatio: HEADER_ARTWORK_ASPECT_RATIO, padding: 20 },
  content: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  compactContent: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', justifyContent: 'flex-end', gap: 16 },
  copy: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  actions: { minWidth: 0 },
  compactActions: { width: '100%' },
  title: { fontWeight: '600', letterSpacing: 2 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  compactSubtitle: { marginTop: 0 },
});
