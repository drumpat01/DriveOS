import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Text, View, StyleSheet, type StyleProp, type TextStyle, type ViewProps, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, FadeInDown, LinearTransition, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTION_DURATIONS, useMotionPreferences } from './motion';
import { statisticsFraction, statisticsPointsString, statisticsSparkline } from './statistics-motion-model';

// Atlas Flip's on-screen morph curve, with the shared everyday duration.
const morph = Easing.bezier(0.77, 0, 0.175, 1);
const timing = { duration: MOTION_DURATIONS.standard, easing: morph };
const reflow = LinearTransition.duration(MOTION_DURATIONS.standard).easing(morph);
const reveal = FadeInDown.duration(MOTION_DURATIONS.standard).withInitialValues({ transform: [{ translateY: 8 }] });
const MotionContext = createContext(false);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

export function StatisticsMotionProvider({ children }: { children: ReactNode }) {
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const focused = useIsFocused();
  return <MotionContext.Provider value={focused && isAppActive && !reduceMotion}>{children}</MotionContext.Provider>;
}

/** Never reset to the last target: a second tap redirects the current presentation.
 * Initial loads and resuming the tab settle immediately, without a replay. */
function useStatisticsValue<T extends number | number[]>(target: T) {
  const enabled = useContext(MotionContext);
  const signature = JSON.stringify(target);
  const stableTarget = useMemo(() => JSON.parse(signature) as T, [signature]);
  const previous = useRef(signature);
  const value = useSharedValue(stableTarget);
  useEffect(() => {
    cancelAnimation(value);
    value.set(enabled && previous.current !== signature ? withTiming(stableTarget, timing) : stableTarget);
    previous.current = signature;
    return () => cancelAnimation(value);
  }, [enabled, signature, stableTarget, value]);
  return value;
}

export function StatisticsMotionFrame({ children, ...props }: ViewProps) {
  const enabled = useContext(MotionContext);
  return <Animated.View {...props} layout={enabled ? reflow : undefined}>{children}</Animated.View>;
}

export function StatisticsDayJourneys({ selectionKey, children }: { selectionKey: string; children: ReactNode }) {
  const enabled = useContext(MotionContext);
  const initial = useRef(selectionKey);
  useEffect(() => { initial.current = selectionKey; }, [selectionKey]);
  return <StatisticsMotionFrame testID="statistics-day-journeys" style={{ gap: 12 }}>
    <Animated.View key={selectionKey} entering={enabled && initial.current !== selectionKey ? reveal : undefined} style={{ gap: 12 }}>
      {children}
    </Animated.View>
  </StatisticsMotionFrame>;
}

function RollingDigit({ digit, style }: { digit: string; style: StyleProp<TextStyle> }) {
  const [height, setHeight] = useState(0);
  const position = useStatisticsValue(Number(digit));
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: -position.get() * height }] }));
  return <View style={{ overflow: 'hidden' }}>
    <Text onLayout={event => setHeight(event.nativeEvent.layout.height)} style={[style, { opacity: height ? 0 : 1 }]}>{digit}</Text>
    {height > 0 && <Animated.View pointerEvents="none" style={[styles.digitStrip, animated]}>
      {Array.from({ length: 10 }, (_, n) => <Text key={n} style={[style, { height }]}>{n}</Text>)}
    </Animated.View>}
  </View>;
}

/** Keep localized formatting and units in React; only digit positions run per frame.
 * VoiceOver sees the real final value once, never intermediate digits. */
export function StatisticsRollingValue({ value, style }: { value: string; style: StyleProp<TextStyle> }) {
  const chars = [...value];
  const digitStyle: StyleProp<TextStyle> = [style, { fontVariant: ['tabular-nums'] }];
  return <View testID="statistics-rolling-value" accessible accessibilityRole="text" accessibilityLabel={value}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.valueRow}>
      {chars.map((char, index) => /[0-9]/.test(char)
        ? <RollingDigit key={`digit-${chars.length - index}`} digit={char} style={digitStyle} />
        : <Text key={`text-${chars.length - index}`} style={style}>{char}</Text>)}
    </View>
  </View>;
}

export function StatisticsBar({ fraction, color, horizontal = false, style }: { fraction: number; color: string; horizontal?: boolean; style?: StyleProp<ViewStyle> }) {
  const progress = useStatisticsValue(statisticsFraction(fraction));
  const animated = useAnimatedStyle(() => ({ transform: horizontal ? [{ scaleX: progress.get() }] : [{ scaleY: progress.get() }] }));
  return <Animated.View testID="statistics-animated-bar" style={[style, {
    width: horizontal ? '100%' : 17, height: horizontal ? 6 : 105, borderRadius: horizontal ? 3 : 4,
    backgroundColor: color, transformOrigin: horizontal ? 'left center' : 'center bottom',
  }, animated]} />;
}

export function StatisticsSparkline({ values, color, style }: { values: number[]; color: string; style?: StyleProp<ViewStyle> }) {
  const points = useStatisticsValue(statisticsSparkline(values));
  const animatedProps = useAnimatedProps(() => ({ points: statisticsPointsString(points.get()) }));
  return <Svg width="100%" height={30} viewBox="0 0 160 30" accessible={false} style={style}>
    <AnimatedPolyline testID="statistics-animated-line" animatedProps={animatedProps} fill="none" stroke={color} strokeWidth={2} />
  </Svg>;
}

const styles = StyleSheet.create({
  digitStrip: { position: 'absolute', top: 0, left: 0, right: 0 },
  valueRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
