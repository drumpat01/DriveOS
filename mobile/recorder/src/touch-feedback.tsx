import { Children, forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutRectangle, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTION_DURATIONS, motionEasing, useMotionPreferences } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Keeps native hit testing, cancellation, accessibility and forwarded navigation refs. */
export const TouchPressable = forwardRef<View, PressableProps>(function TouchPressable({ style, disabled, onPressIn, onPressOut, ...props }, ref) {
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const [pressed, setPressed] = useState(false);
  useEffect(() => { setPressed(false); }, [disabled, isAppActive]);
  const resolved = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: pressed && !disabled && isAppActive }) : style);
  const transforms = Array.isArray(resolved?.transform) ? resolved.transform : [];
  const animate = !reduceMotion && isAppActive;
  return <AnimatedPressable {...props} ref={ref} disabled={disabled}
    onPressIn={event => { if (!disabled && isAppActive) setPressed(true); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); onPressOut?.(event); }}
    style={[resolved, { transform: [...transforms, { scale: pressed && !disabled && animate ? .97 : 1 }],
      transitionProperty: 'transform', transitionDuration: animate ? MOTION_DURATIONS.feedback : 0, transitionTimingFunction: 'ease-out' }]} />;
});

/** One measured highlight, including wrapped rows and unequal label widths. */
export function SlidingSelection({ selectedIndex, children, style, itemStyle, highlightStyle }: {
  selectedIndex: number; children: ReactNode; style?: StyleProp<ViewStyle>; itemStyle?: StyleProp<ViewStyle>; highlightStyle: StyleProp<ViewStyle>;
}) {
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const [layouts, setLayouts] = useState<Record<number, LayoutRectangle>>({});
  const ready = useRef(false);
  const frame = useSharedValue([0, 0, 0, 0]);
  const target = layouts[selectedIndex];
  useEffect(() => {
    if (!target) return;
    const next = [target.x, target.y, target.width, target.height];
    frame.set(ready.current && !reduceMotion && isAppActive ? withTiming(next, { duration: MOTION_DURATIONS.standard, easing: motionEasing.standard }) : next);
    ready.current = true;
  }, [target, reduceMotion, isAppActive, frame]);
  const highlight = useAnimatedStyle(() => {
    const [x, y, width, height] = frame.get();
    return { transform: [{ translateX: x }, { translateY: y }], width, height };
  });
  return <View style={style}>
    <Animated.View accessible={false} pointerEvents="none" style={[highlightStyle, { position: 'absolute', top: 0, left: 0, opacity: target ? 1 : 0 }, highlight]} />
    {Children.map(children, (child, index) => <View style={itemStyle} onLayout={event => {
      const next = event.nativeEvent.layout;
      setLayouts(previous => { const old = previous[index]; return old && old.x === next.x && old.y === next.y && old.width === next.width && old.height === next.height ? previous : { ...previous, [index]: next }; });
    }}>{child}</View>)}
  </View>;
}

/** Content remains measurable while clipped; closed controls leave the accessibility tree. */
export function ExpandingSection({ expanded, children }: { expanded: boolean; children: ReactNode }) {
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const [height, setHeight] = useState(0);
  const extent = useSharedValue(0);
  useEffect(() => {
    const next = expanded ? height : 0;
    extent.set(!reduceMotion && isAppActive ? withTiming(next, { duration: MOTION_DURATIONS.standard, easing: motionEasing.standard }) : next);
  }, [expanded, height, reduceMotion, isAppActive, extent]);
  const animated = useAnimatedStyle(() => ({ height: extent.get() }));
  return <Animated.View style={[{ overflow: 'hidden' }, animated]} pointerEvents={expanded ? 'auto' : 'none'}
    accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} onLayout={event => setHeight(event.nativeEvent.layout.height)}>{children}</View>
  </Animated.View>;
}
