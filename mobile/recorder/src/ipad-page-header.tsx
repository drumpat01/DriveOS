import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from './app-theme';
import { PhoneTabTitle } from './phone-tab-title';
import { HeaderArtworkLayers, HEADER_ARTWORK_ASPECT_RATIO } from './header-artwork';
import { ipadGridColumns, ipadGridSpan } from './device-layout';
import { IPAD_GRID_GAP } from './device-layout';

/** One title treatment for every implemented iPad tab. Home may add cinematic artwork. */
export function IpadPageHeader({ title, artwork, width, subtitle, children, compact = false, fullHeightActions = false, artworkTreatment = 'standard' }: {
  title: string; artwork?: ImageSourcePropType; width: number; subtitle?: string; children?: ReactNode; compact?: boolean; fullHeightActions?: boolean; artworkTreatment?: 'standard' | 'bright';
}) {
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const page = theme.palette.page;
  const narrow = width < 300;
  const brightArtwork = artworkTreatment === 'bright';
  const horizontalMask: [string, string, string] = brightArtwork ? [`${page}a8`, `${page}44`, `${page}08`] : [`${page}e8`, `${page}a8`, `${page}30`];
  const bottomMaskLocations: [number, number] = brightArtwork ? [0.68, 1] : [0.45, 1];
  const fullHeightActionWidth = ipadGridColumns(width, fontScale) === 6 ? ipadGridSpan(width, 2) : undefined;
  if (!artwork) return <View testID="ipad-page-header" style={[styles.plainHeader, narrow && styles.narrowPlainHeader, { backgroundColor: page }]}>
    {compact ? <PhoneTabTitle title={title} testID="ipad-page-title" /> : <View style={styles.copy}><Text testID="ipad-page-title" accessibilityRole="header" numberOfLines={1}
      adjustsFontSizeToFit minimumFontScale={0.72}
      style={[styles.title, { fontSize: width >= 600 ? 36 : narrow ? 24 : 28, letterSpacing: narrow ? 1.4 : 2, color: theme.palette.text }]}>{title.toUpperCase()}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.palette.muted }]}>{subtitle}</Text> : null}</View>}
    {compact && subtitle ? <Text style={[styles.subtitle, { color: theme.palette.muted }]}>{subtitle}</Text> : null}
    {children ? <View testID="page-header-actions" style={[styles.actions, compact && styles.compactActions, fullHeightActions && width >= 520 && styles.fullHeightActions, fullHeightActionWidth !== undefined && { width: fullHeightActionWidth }]}>{children}</View> : null}
  </View>;
  if (compact) return <View testID="ipad-page-header" style={{ backgroundColor: page }}>
    <PhoneTabTitle title={title} testID="ipad-page-title" />
    <View style={[styles.hero, styles.compactHero, { backgroundColor: page }]}>
      <HeaderArtworkLayers source={artwork} />
      <LinearGradient pointerEvents="none" colors={horizontalMask} locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={[`${page}00`, page]} locations={bottomMaskLocations} style={StyleSheet.absoluteFill} />
      <View testID="page-header-content" style={[styles.content, styles.compactContent]}>
        {subtitle ? <Text style={[styles.subtitle, styles.compactSubtitle, { color: theme.palette.muted }]}>{subtitle}</Text> : null}
        {children ? <View testID="page-header-actions" style={[styles.actions, styles.compactActions]}>{children}</View> : null}
      </View>
    </View>
  </View>;
  return <View testID="ipad-page-header" style={[styles.hero, narrow && styles.narrowHero, compact && styles.compactHero, { backgroundColor: page }]}>
    <HeaderArtworkLayers source={artwork} />
    <LinearGradient pointerEvents="none" colors={horizontalMask} locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={[`${page}00`, page]} locations={bottomMaskLocations} style={StyleSheet.absoluteFill} />
    <View testID="page-header-content" style={[styles.content, compact && styles.compactContent]}>
      <View style={styles.copy}><Text testID="ipad-page-title" accessibilityRole="header" numberOfLines={1}
        adjustsFontSizeToFit minimumFontScale={0.72}
        style={[styles.title, { fontSize: width >= 600 ? 36 : narrow ? 24 : 28, letterSpacing: narrow ? 1.4 : 2, color: theme.palette.text }]}>{title.toUpperCase()}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.palette.muted }]}>{subtitle}</Text> : null}</View>
      {children ? <View testID="page-header-actions" style={[styles.actions, compact && styles.compactActions, fullHeightActions && width >= 520 && styles.fullHeightActions, fullHeightActionWidth !== undefined && { width: fullHeightActionWidth }]}>{children}</View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hero: { width: '100%', minHeight: 190, overflow: 'hidden', justifyContent: 'flex-end', padding: 24 },
  plainHeader: { width: '100%', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: IPAD_GRID_GAP },
  narrowPlainHeader: { paddingHorizontal: 16 },
  narrowHero: { paddingHorizontal: 16 },
  compactHero: { minHeight: 0, aspectRatio: HEADER_ARTWORK_ASPECT_RATIO, padding: 20 },
  content: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: IPAD_GRID_GAP },
  compactContent: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', justifyContent: 'flex-end', gap: 16 },
  copy: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  actions: { minWidth: 0 },
  compactActions: { width: '100%' },
  fullHeightActions: { marginVertical: -24 },
  title: { fontWeight: '600', letterSpacing: 2 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  compactSubtitle: { marginTop: 0 },
});
