import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { cancelAnimation, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from './app-theme';
import { delightMaterialMode, projectPrivateRouteGeometry } from './delight-policy';
import { MOTION_DURATIONS } from './motion';
import type { RouteCoordinate } from './route-moments';

export function AdaptiveGlassSurface({ children, reduceTransparency, style }: { children: ReactNode; reduceTransparency: boolean; style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  let glassApiAvailable = false;
  let liquidGlassAvailable = false;
  try {
    glassApiAvailable = isGlassEffectAPIAvailable();
    liquidGlassAvailable = isLiquidGlassAvailable();
  } catch { /* Unsupported platforms use the fallback below. */ }
  const mode = delightMaterialMode({ glassApiAvailable, liquidGlassAvailable, reduceTransparency });
  return <View style={[styles.material, style]}>
    {mode === 'glass'
      ? <GlassView pointerEvents="none" glassEffectStyle="clear" colorScheme={theme.mode} tintColor={`${theme.palette.card}30`} style={StyleSheet.absoluteFill} />
      : mode === 'blur'
        ? <><BlurView pointerEvents="none" intensity={32} tint={theme.mode} style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${theme.palette.page}80` }]} /></>
        : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.palette.card }]} />}
    {children}
  </View>;
}

export function RouteTraceMoment({ coordinates, active, reduceMotion, completed = false, duration = MOTION_DURATIONS.sweep }: { coordinates: RouteCoordinate[]; active: boolean; reduceMotion: boolean; completed?: boolean; duration?: number }) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(1);
  const progress = useSharedValue(active && !reduceMotion ? 0 : 1);
  const revealed = useRef(false);
  const signature = `${coordinates.length}:${coordinates[0]?.join(',') ?? ''}:${coordinates.at(-1)?.join(',') ?? ''}`;
  const previousSignature = useRef(signature);
  const points = useMemo(() => projectPrivateRouteGeometry(coordinates, width, 72), [coordinates, width]);
  const path = useMemo(() => {
    const next = Skia.Path.Make();
    const first = points[0];
    if (!first) return next;
    next.moveTo(first.x, first.y);
    for (const point of points.slice(1)) next.lineTo(point.x, point.y);
    return next;
  }, [points]);

  useEffect(() => {
    if (previousSignature.current !== signature) { previousSignature.current = signature; revealed.current = false; }
    cancelAnimation(progress);
    if (!active || reduceMotion || revealed.current) { progress.set(1); return; }
    revealed.current = true;
    progress.set(0);
    progress.set(withTiming(1, { duration }));
    return () => cancelAnimation(progress);
  }, [active, duration, progress, reduceMotion, signature]);

  if (points.length < 2) return null;
  const end = points.at(-1)!;
  return <View accessible accessibilityRole="image" accessibilityLabel={completed ? 'Recorded journey route, replay complete' : 'Recorded journey route'} onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))} style={[styles.routeMoment, { backgroundColor: theme.palette.inset }]}>
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Path path={path} style="stroke" strokeWidth={12} strokeCap="round" strokeJoin="round" color={theme.palette.accent} opacity={0.16} end={progress} />
      <Path path={path} style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round" color={theme.palette.coral} end={progress} />
      <Circle cx={points[0]!.x} cy={points[0]!.y} r={4.5} color={theme.palette.green} />
      <Circle cx={end.x} cy={end.y} r={completed ? 12 : 8} color={`${theme.palette.coral}44`} />
      <Circle cx={end.x} cy={end.y} r={4.5} color={theme.palette.coral} />
    </Canvas>
  </View>;
}

const styles = StyleSheet.create({
  material: { overflow: 'hidden' },
  routeMoment: { height: 72, borderRadius: 15, overflow: 'hidden' },
});
