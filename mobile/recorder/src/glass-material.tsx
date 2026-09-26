import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useSurfacePreferences } from './app-theme';
import { glassMaterialSpec, type GlassRole } from './glass-material-policy';

function glassAvailability() {
  try { return { glassApiAvailable: isGlassEffectAPIAvailable(), liquidGlassAvailable: isLiquidGlassAvailable() }; }
  catch { return { glassApiAvailable: false, liquidGlassAvailable: false }; }
}

function useGlassSpec(role: GlassRole) {
  const theme = useAppTheme();
  const surfaces = useSurfacePreferences();
  return glassMaterialSpec(role, theme.palette, { ...glassAvailability(), ...surfaces });
}

function MaterialLayers({ role }: { role: GlassRole }) {
  const spec = useGlassSpec(role);
  return <>
    {spec.mode === 'glass'
      ? <GlassView pointerEvents="none" glassEffectStyle={spec.glassEffectStyle} colorScheme="dark" tintColor={spec.tintColor} style={StyleSheet.absoluteFill} />
      : spec.mode === 'blur'
        ? <><BlurView pointerEvents="none" intensity={spec.blurIntensity} tint="dark" style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: spec.tintColor }]} /></>
        : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: spec.fallbackColor }]} />}
    <LinearGradient pointerEvents="none" colors={spec.highlight} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
  </>;
}

type GlassMaterialProps = { role: GlassRole; radius?: number; style?: StyleProp<ViewStyle>; children?: ReactNode };

/**
 * A self-contained glass surface for the material roles in glass-material-policy:
 * live Liquid Glass where available, blur plus tint otherwise, and a solid surface
 * for Reduce Transparency. Decorative layers never intercept touches.
 */
export function GlassMaterial({ role, radius = 20, style, children }: GlassMaterialProps) {
  const spec = useGlassSpec(role);
  return <View style={[styles.surface, { borderRadius: radius, borderColor: spec.borderColor }, style]}>
    <MaterialLayers role={role} />
    {children}
  </View>;
}

/**
 * First child for an existing card in glass themes; renders nothing in other themes.
 * The card keeps its layout, content and touch handling; give it `glassCardStyle` so
 * its own fill does not hide the backdrop.
 */
export function GlassBackdrop({ role, radius }: { role: GlassRole; radius: number }) {
  const theme = useAppTheme();
  const spec = useGlassSpec(role);
  if (!theme.isGlass) return null;
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.backdrop, { borderRadius: radius, borderColor: spec.borderColor }]}>
    <MaterialLayers role={role} />
  </View>;
}

/** Clears an existing card fill in glass themes so GlassBackdrop shows through. */
export function useGlassCardStyle(): ViewStyle | null {
  const theme = useAppTheme();
  return theme.isGlass ? styles.glassCard : null;
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  backdrop: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  glassCard: { backgroundColor: 'transparent', overflow: 'hidden' },
});
