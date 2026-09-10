import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { Easing, ReduceMotion, cancelAnimation, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import {
  MOTION_DELAYS,
  MOTION_DURATIONS,
  MOTION_EASING_POINTS,
  MOTION_SPRINGS,
  NATIVE_MOTION_SPRINGS,
  createMotionSystem,
  motionDelay,
  motionDuration,
} from './motion-system';

const motionSystem = createMotionSystem({
  getCurrentAppState: () => AppState.currentState,
  readReduceMotion: () => AccessibilityInfo.isReduceMotionEnabled(),
  subscribeAppState: listener => {
    const subscription = AppState.addEventListener('change', listener);
    return () => subscription.remove();
  },
  subscribeReduceMotion: listener => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', listener);
    return () => subscription.remove();
  },
});

function bezier(points: readonly [number, number, number, number]) {
  return Easing.bezier(points[0], points[1], points[2], points[3]);
}

export const motionEasing = Object.freeze({
  standard: bezier(MOTION_EASING_POINTS.standard),
  enter: bezier(MOTION_EASING_POINTS.enter),
  exit: bezier(MOTION_EASING_POINTS.exit),
  linear: Easing.linear,
});

export { MOTION_DELAYS, MOTION_DURATIONS, MOTION_SPRINGS, NATIVE_MOTION_SPRINGS, motionDelay, motionDuration };

export function useMotionPreferences() {
  return useSyncExternalStore(motionSystem.subscribe, motionSystem.getSnapshot, motionSystem.getSnapshot);
}

export function useSettleWhenAppInactive(settle: () => void) {
  const { isAppActive } = useMotionPreferences();
  const settleRef = useRef(settle);
  settleRef.current = settle;
  useEffect(() => {
    if (!isAppActive) settleRef.current();
  }, [isAppActive]);
  return isAppActive;
}

export function useAmbientSharedValueLoop(
  value: SharedValue<number>,
  { from = 0, to = 1, duration = MOTION_DURATIONS.ambient, enabled = true }:
  Readonly<{ from?: number; to?: number; duration?: number; enabled?: boolean }> = {},
) {
  const { ambientMotionEnabled } = useMotionPreferences();
  useEffect(() => {
    cancelAnimation(value);
    value.value = from;
    if (!enabled || !ambientMotionEnabled) return;
    value.value = withRepeat(
      withTiming(to, { duration, easing: motionEasing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    return () => {
      cancelAnimation(value);
      value.value = from;
    };
  }, [ambientMotionEnabled, duration, enabled, from, to, value]);
}
