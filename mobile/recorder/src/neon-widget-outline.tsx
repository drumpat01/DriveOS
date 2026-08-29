import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { BlurMask, Canvas, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';

type OutlineTone = 'standard' | 'hero' | 'selected';

const neonStops = ['#ff795b', '#ff4d87', '#a66cff', '#5aa7ff', '#ff795b'];
const selectedStops = ['#ff9b5d', '#ff7138', '#ff9b5d'];

export function NeonWidgetOutline({ radius, tone = 'standard' }: { radius: number; tone?: OutlineTone }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const isHero = tone === 'hero';
  const isSelected = tone === 'selected';
  const colors = isSelected ? selectedStops : neonStops;
  const positions = isSelected ? [0, 0.54, 1] : [0, 0.27, 0.54, 0.78, 1];
  const glowOpacity = isHero ? 0.46 : isSelected ? 0.4 : 0.14;
  const rimOpacity = isHero ? 0.94 : isSelected ? 0.92 : 0.54;
  const glowWidth = isHero ? 3.6 : isSelected ? 3 : 2.2;
  const rimWidth = isHero ? 1.55 : isSelected ? 1.35 : 1;
  return <View pointerEvents="none" onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    setSize(current => current.width === width && current.height === height ? current : { width, height });
  }} style={[StyleSheet.absoluteFill, styles.outline]}>
    {size.width > 0 && size.height > 0 && <Canvas style={StyleSheet.absoluteFill}>
      <RoundedRect x={3} y={3} width={size.width - 6} height={size.height - 6} r={Math.max(radius - 3, 0)} style="stroke" strokeWidth={glowWidth} opacity={glowOpacity}>
        <LinearGradient start={vec(0, 0)} end={vec(size.width, size.height)} colors={colors} positions={positions} />
        <BlurMask blur={isHero ? 8 : isSelected ? 7 : 4} style="normal" />
      </RoundedRect>
      <RoundedRect x={3} y={3} width={size.width - 6} height={size.height - 6} r={Math.max(radius - 3, 0)} style="stroke" strokeWidth={rimWidth} opacity={rimOpacity}>
        <LinearGradient start={vec(0, 0)} end={vec(size.width, size.height)} colors={colors} positions={positions} />
      </RoundedRect>
    </Canvas>}
  </View>;
}

export function NeonWidget({ children, radius = 20, tone = 'standard', style }: { children: ReactNode; radius?: number; tone?: OutlineTone; style?: any }) {
  return <View style={[style, styles.widget, { borderRadius: radius }]}><NeonWidgetOutline radius={radius} tone={tone} />{children}</View>;
}

export function QuietInset({ children, radius = 16, accent = '#a66cff', style }: { children: ReactNode; radius?: number; accent?: string; style?: any }) {
  return <View style={[styles.inset, style, { borderRadius: radius }]}>
    <ExpoLinearGradient pointerEvents="none" colors={[accent, `${accent}4d`, 'transparent']} locations={[0, 0.48, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.insetAccent, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
    {children}
  </View>;
}

const styles = StyleSheet.create({
  outline: { zIndex: 20 },
  widget: { position: 'relative', overflow: 'hidden', borderWidth: 0 },
  inset: { position: 'relative', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(197, 166, 219, 0.17)', backgroundColor: 'rgba(255,255,255,0.035)' },
  insetAccent: { position: 'absolute', top: 0, left: 14, right: 14, height: 1.5, opacity: 0.8 },
});
