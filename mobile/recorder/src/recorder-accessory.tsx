import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { RecorderAccessoryState } from './recorder-accessory-model';
import { redesignStyles, Surface, useRedesignColors } from './redesign-ui';
import { TouchPressable } from './touch-feedback';

/**
 * The V4 recorder bar. In the iOS 26 tab bar accessory the system draws the
 * glass; `framed` adds a themed surface when the bar sits on Today instead.
 */
export function RecorderAccessoryBar({ state, busy, compact = false, framed = false, onAction, onOpen }: {
  state: RecorderAccessoryState; busy: boolean; compact?: boolean; framed?: boolean;
  onAction: () => void; onOpen: () => void;
}) {
  const colors = useRedesignColors();
  const dot = state.tone === 'live' ? colors.danger : state.tone === 'paused' ? colors.highlight : state.tone === 'attention' ? colors.highlight : colors.accent;
  const destructive = state.action === 'end';
  const body = <View style={[styles.bar, compact && styles.compact]}>
    <TouchPressable testID="recorder-accessory-open" accessibilityRole="button" accessibilityLabel={`${state.title}. ${state.detail}`} accessibilityHint="Opens the recorder"
      onPress={onOpen} style={({ pressed }) => [styles.main, pressed && redesignStyles.pressed]}>
      <View style={[styles.dot, { backgroundColor: dot, boxShadow: `0 0 0 4px ${dot}33` }]} />
      <View style={redesignStyles.flex}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{state.title}</Text>
        {!compact ? <Text numberOfLines={1} style={[styles.detail, { color: colors.textSecondary }]}>{state.detail}</Text> : null}
      </View>
    </TouchPressable>
    {busy ? <ActivityIndicator color={colors.accent} style={styles.spinner} />
      : state.action && state.actionLabel ? <TouchPressable testID="recorder-accessory-action" accessibilityRole="button" accessibilityLabel={state.action === 'start' ? 'Start a journey' : state.action === 'end' ? 'End journey' : state.actionLabel}
        onPress={onAction} style={({ pressed }) => [styles.action, { backgroundColor: destructive ? colors.dangerSoft : state.action === 'start' ? colors.accent : colors.accentSoft }, pressed && redesignStyles.pressed]}>
        {state.action === 'start' ? <SymbolView name="play.fill" tintColor={colors.onAccent} size={11} /> : null}
        <Text style={[styles.actionText, { color: destructive ? colors.text : state.action === 'start' ? colors.onAccent : colors.accent }]}>{state.actionLabel}</Text>
      </TouchPressable>
      : <SymbolView name="chevron.up" tintColor={colors.textSecondary} size={13} weight="semibold" style={styles.chevron} />}
  </View>;
  return framed ? <Surface radius={26} testID="recorder-accessory-inline">{body}</Surface> : body;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingLeft: 16, paddingRight: 8 },
  compact: { minHeight: 40, paddingLeft: 12, paddingRight: 6 },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  detail: { fontSize: 12, lineHeight: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18 },
  actionText: { fontSize: 14, fontWeight: '700' },
  spinner: { marginRight: 10 },
  chevron: { width: 16, height: 16, marginRight: 12 },
});
