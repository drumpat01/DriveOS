import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from './app-theme';
import { MOTION_DURATIONS, motionEasing, useMotionPreferences } from './motion';

const PULSE_MS = MOTION_DURATIONS.sweep * 2;
const REST_OPACITY = 0.55;
const PULSE_FROM = 0.38;
const PULSE_TO = 0.78;

type BoneSize = number | `${number}%`;

/** Reanimated opacity pulse. Reduce Motion and backgrounding snap to a static fill — no Moti. */
export function SkeletonBone({
  width, height, radius = 8, style,
}: {
  width: BoneSize; height: number; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const { ambientMotionEnabled } = useMotionPreferences();
  const pulse = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    if (!ambientMotionEnabled) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: motionEasing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    return () => {
      cancelAnimation(pulse);
      pulse.value = 0;
    };
  }, [ambientMotionEnabled, pulse]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: ambientMotionEnabled ? interpolate(pulse.value, [0, 1], [PULSE_FROM, PULSE_TO]) : REST_OPACITY,
  }));
  const bone = {
    width, height, borderRadius: radius,
    backgroundColor: theme.color('#2a2234', 'surface'),
  };
  if (!ambientMotionEnabled) {
    return <View accessible={false} style={[styles.bone, bone, { opacity: REST_OPACITY }, style]} />;
  }
  return <Animated.View accessible={false} style={[styles.bone, bone, animatedStyle, style]} />;
}

function SkeletonRows({
  label, testID, count, children,
}: {
  label: string; testID: string; count: number; children: (index: number) => ReactNode;
}) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} testID={testID} style={styles.stack}>
      {Array.from({ length: count }, (_, index) => children(index))}
    </View>
  );
}

export function MusicArchiveSkeleton({ label = 'Building your soundtrack…' }: { label?: string }) {
  return (
    <SkeletonRows label={label} testID="music-archive-skeleton" count={5}>
      {index => (
        <View key={index} style={styles.archiveRow}>
          <SkeletonBone width={48} height={48} radius={10} />
          <View style={styles.copy}>
            <SkeletonBone width="72%" height={12} radius={6} />
            <SkeletonBone width="48%" height={8} radius={4} />
            <SkeletonBone width="36%" height={8} radius={4} />
          </View>
          <SkeletonBone width={52} height={22} radius={9} />
        </View>
      )}
    </SkeletonRows>
  );
}

export function JourneyListSkeleton({
  compact = false, count = 3, label = 'Loading your journeys…',
}: {
  compact?: boolean; count?: number; label?: string;
}) {
  return (
    <SkeletonRows label={label} testID="journey-list-skeleton" count={count}>
      {index => (
        <View key={index} style={compact ? styles.journeyCompact : styles.journeyCard}>
          <SkeletonBone width="28%" height={compact ? 8 : 10} radius={4} />
          <SkeletonBone width="78%" height={compact ? 14 : 17} radius={6} />
          <View style={styles.statRow}>
            <SkeletonBone width={54} height={10} radius={4} />
            <SkeletonBone width={48} height={10} radius={4} />
          </View>
          <View style={styles.soundtrack}>
            <SkeletonBone width={compact ? 30 : 42} height={compact ? 30 : 42} radius={compact ? 7 : 10} />
            <View style={styles.copy}>
              <SkeletonBone width="70%" height={12} radius={5} />
              <SkeletonBone width="44%" height={9} radius={4} />
            </View>
          </View>
        </View>
      )}
    </SkeletonRows>
  );
}

export function MemoryListSkeleton({ count = 4, label = 'Loading Memories…' }: { count?: number; label?: string }) {
  return (
    <SkeletonRows label={label} testID="memory-list-skeleton" count={count}>
      {index => (
        <View key={index} style={styles.memoryCard}>
          <SkeletonBone width="100%" height={118} radius={16} />
          <View style={styles.memoryCopy}>
            <SkeletonBone width="64%" height={14} radius={6} />
            <SkeletonBone width="38%" height={10} radius={4} />
          </View>
        </View>
      )}
    </SkeletonRows>
  );
}

const styles = StyleSheet.create({
  bone: { overflow: 'hidden' },
  stack: { gap: 10 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  archiveRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  journeyCard: { backgroundColor: '#121019', borderRadius: 21, borderWidth: 1, borderColor: '#292334', padding: 16, gap: 11 },
  journeyCompact: { backgroundColor: '#121019', borderRadius: 16, borderWidth: 1, borderColor: '#292334', paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  statRow: { flexDirection: 'row', gap: 8 },
  soundtrack: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  memoryCard: { borderRadius: 18, overflow: 'hidden', gap: 10 },
  memoryCopy: { gap: 6, paddingHorizontal: 2 },
});
