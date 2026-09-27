import { StyleSheet, Text, View, type GestureResponderHandlers, type LayoutChangeEvent } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { redesignStyles, Segmented, Surface, useRedesignColors } from './redesign-ui';
import { TouchPressable } from './touch-feedback';

export type ReplayRate = 'story' | 1 | 4 | 12;
const RATES: { id: string; label: string }[] = [{ id: 'story', label: 'Story' }, { id: '1', label: '1×' }, { id: '4', label: '4×' }, { id: '12', label: '12×' }];

/**
 * V4 replay controls: one card with play, restart, a scrubber marked with
 * each song, and the replay speed. Live speed and progress only show while
 * the replay is engaged. State lives in InteractiveRouteMap.
 */
export function JourneyReplayCardV4({
  canReplay, playing, engaged, progress, speedMph, songTitle, rate, songTicks, startClock, endClock, startLabel, endLabel,
  estimated, scrubberHandlers, onScrubberLayout, onAdjust, onToggle, onRestart, onRate,
}: {
  canReplay: boolean; playing: boolean; engaged: boolean; progress: number; speedMph: number | null; songTitle: string | null;
  rate: ReplayRate; songTicks: number[]; startClock: string; endClock: string; startLabel: string | null; endLabel: string | null;
  estimated: boolean; scrubberHandlers: GestureResponderHandlers; onScrubberLayout: (event: LayoutChangeEvent) => void;
  onAdjust: (delta: number) => void; onToggle: () => void; onRestart: () => void; onRate: (rate: ReplayRate) => void;
}) {
  const colors = useRedesignColors();
  const percent = Math.max(0, Math.min(100, progress * 100));
  const title = !engaged ? 'Relive this drive' : playing ? songTitle ?? 'Replaying your drive' : percent >= 100 ? 'Replay finished' : 'Replay paused';
  const caption = !engaged
    ? rate === 'story' ? 'Story pace · about a minute, pausing on songs' : `${rate}× real time`
    : `${speedMph == null ? '—' : Math.round(speedMph)} mph · ${Math.round(percent)}% of the drive`;
  return <Surface testID="journey-replay-card-v4" style={styles.card}>
    <View style={redesignStyles.row}>
      <TouchPressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause replay' : 'Relive this drive'} accessibilityState={{ disabled: !canReplay }}
        disabled={!canReplay} onPress={onToggle} style={({ pressed }) => [styles.play, { backgroundColor: colors.accent }, !canReplay && styles.disabled, pressed && redesignStyles.pressed]}>
        <SymbolView name={playing ? 'pause.fill' : 'play.fill'} tintColor={colors.onAccent} size={20} />
      </TouchPressable>
      <View style={redesignStyles.flex}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={1} accessibilityLiveRegion={engaged ? 'polite' : undefined} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{caption}</Text>
      </View>
      <TouchPressable accessibilityRole="button" accessibilityLabel="Restart replay" disabled={!canReplay} onPress={onRestart}
        style={({ pressed }) => [styles.restart, { backgroundColor: colors.surfaceStrong }, !canReplay && styles.disabled, pressed && redesignStyles.pressed]}>
        <SymbolView name="arrow.counterclockwise" tintColor={colors.text} size={16} weight="semibold" />
      </TouchPressable>
    </View>
    <View style={styles.timeline}>
      <View accessible accessibilityRole="adjustable" accessibilityLabel="Journey replay position"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        accessibilityActions={[{ name: 'increment', label: 'Forward' }, { name: 'decrement', label: 'Back' }]}
        onAccessibilityAction={event => onAdjust(event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05)}
        onLayout={onScrubberLayout} style={styles.scrubber} {...scrubberHandlers}>
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.accent }]} />
        </View>
        {songTicks.map((tick, index) => <View key={`tick-${index}`} pointerEvents="none" style={[styles.tick, { left: `${Math.max(0, Math.min(100, tick * 100))}%`, backgroundColor: colors.highlight }]} />)}
        <View pointerEvents="none" style={[styles.thumb, { left: `${percent}%`, backgroundColor: colors.page, borderColor: colors.accent }]} />
      </View>
      <View style={styles.labels}>
        <Text numberOfLines={1} style={[styles.label, { color: colors.textSecondary }]}>{startClock}{startLabel ? ` · ${startLabel}` : ''}</Text>
        <Text numberOfLines={1} style={[styles.label, styles.labelEnd, { color: colors.textSecondary }]}>{endClock}{endLabel ? ` · ${endLabel}` : ''}</Text>
      </View>
    </View>
    <Segmented label="Replay speed" options={RATES} value={String(rate)} onChange={value => onRate(value === 'story' ? 'story' : Number(value) as ReplayRate)} />
    {estimated ? <Text style={[redesignStyles.caption, { color: colors.textTertiary }]}>Replay timing and speed are estimated from the saved route.</Text> : null}
  </Surface>;
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 16 },
  play: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  restart: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  timeline: { gap: 8 },
  scrubber: { height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  tick: { position: 'absolute', top: 10, width: 8, height: 8, marginLeft: -4, borderRadius: 4 },
  thumb: { position: 'absolute', top: 6, width: 16, height: 16, marginLeft: -8, borderRadius: 8, borderWidth: 3 },
  labels: { flexDirection: 'row', gap: 12 },
  label: { flex: 1, fontSize: 12, lineHeight: 16 },
  labelEnd: { textAlign: 'right' },
});
