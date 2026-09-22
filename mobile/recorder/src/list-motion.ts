import { useMemo } from 'react';
import { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { MOTION_DURATIONS, motionEasing, useMotionPreferences } from './motion';

const ENTER = FadeIn.duration(MOTION_DURATIONS.standard).easing(motionEasing.enter);
const ENTER_DOWN = FadeInDown.duration(MOTION_DURATIONS.standard).easing(motionEasing.enter);
const EXIT = FadeOut.duration(MOTION_DURATIONS.exit).easing(motionEasing.exit);
const LAYOUT = LinearTransition.duration(MOTION_DURATIONS.standard).easing(motionEasing.standard);

export type ListRowMotion = Readonly<{
  entering: typeof ENTER | typeof ENTER_DOWN | undefined;
  exiting: typeof EXIT | undefined;
  layout: typeof LAYOUT | undefined;
}>;

/** Opacity fade / layout only. Reduce Motion and backgrounding snap with no layout animation. */
export function listRowMotion({
  reduceMotion,
  isAppActive,
  enter = true,
  variant = 'fade',
}: {
  reduceMotion: boolean;
  isAppActive: boolean;
  enter?: boolean;
  variant?: 'fade' | 'down';
}): ListRowMotion {
  if (reduceMotion || !isAppActive) return { entering: undefined, exiting: undefined, layout: undefined };
  return {
    entering: enter ? (variant === 'down' ? ENTER_DOWN : ENTER) : undefined,
    exiting: EXIT,
    layout: LAYOUT,
  };
}

export function useListRowMotion(options: { enter?: boolean; variant?: 'fade' | 'down' } = {}): ListRowMotion {
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const enter = options.enter !== false;
  const variant = options.variant ?? 'fade';
  return useMemo(
    () => listRowMotion({ reduceMotion, isAppActive, enter, variant }),
    [enter, isAppActive, reduceMotion, variant],
  );
}
