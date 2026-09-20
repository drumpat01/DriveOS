import { useEffect, type ReactElement } from 'react';
import { Marker } from '@maplibre/maplibre-react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { replaySnapshotAt, type ReplayRoutePoint } from './route-moments';

export const REPLAY_TICK_MS = 100;
const AnimatedMarker = Animated.createAnimatedComponent(Marker);

/**
 * React publishes the replay at 10 Hz; the native marker moves on every UI frame.
 * Animate time, not a chord between tick coordinates, so a tick spanning a turn
 * still follows every recorded segment. The camera uses the same linear window.
 */
export function JourneyReplayMarker({ points, timestamp, playing, animate, children }: {
  points: ReplayRoutePoint[];
  timestamp: number;
  playing: boolean;
  animate: boolean;
  children: ReactElement;
}) {
  const displayedTime = useSharedValue(timestamp);
  useEffect(() => {
    displayedTime.set(playing && animate
      ? withTiming(timestamp, { duration: REPLAY_TICK_MS, easing: Easing.linear })
      : timestamp);
    return () => cancelAnimation(displayedTime);
  }, [timestamp, playing, animate, displayedTime]);

  const animatedProps = useAnimatedProps(() => ({
    lngLat: replaySnapshotAt(points, displayedTime.get())!.coordinate,
  }));

  return <AnimatedMarker id="journey-replay-position" anchor="center"
    lngLat={points[0]!.coordinate} animatedProps={animatedProps}>
    {children}
  </AnimatedMarker>;
}
