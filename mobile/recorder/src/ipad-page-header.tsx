import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from './app-theme';
import { headerImageSource } from './header-image-sources';

/** One title treatment for every implemented iPad tab, using its own theme artwork. */
export function IpadPageHeader({ title, artwork, width, subtitle, children }: {
  title: string; artwork: ImageSourcePropType; width: number; subtitle?: string; children?: ReactNode;
}) {
  const theme = useAppTheme();
  const page = theme.isLight ? '#fffaf0' : '#08070d';
  return <View testID="ipad-page-header" style={[styles.hero, { backgroundColor: page }]}>
    <Image source={headerImageSource(artwork, theme.mode)} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={[`${page}e8`, `${page}a8`, `${page}30`]} locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={[`${page}00`, page]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
    <View style={styles.content}>
      <View style={styles.copy}><Text testID="ipad-page-title" accessibilityRole="header"
        style={[styles.title, { fontSize: width >= 600 ? 36 : 28, color: theme.isLight ? '#291d26' : '#fff6ed' }]}>{title.toUpperCase()}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.isLight ? '#685461' : '#b6a6c1' }]}>{subtitle}</Text> : null}</View>
      {children}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hero: { width: '100%', minHeight: 190, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end', padding: 24 },
  content: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  copy: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  title: { fontWeight: '600', letterSpacing: 2 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 8 },
});
