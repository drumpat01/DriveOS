import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSurfacePreferences } from './app-theme';
import { TypingDots } from './ask-chat-motion';
import { GlassAvatar } from './glass-avatar';
import { SymbolView } from 'expo-symbols';
import type { AskEvidence } from './ask-journeydeck';
import { NativeActionMenu, type NativeMenuAction } from './native-action-menu';
import { redesignStyles, useRedesignColors } from './redesign-ui';
import { TouchPressable } from './touch-feedback';

/**
 * V4 Ask JourneyDeck pieces: avatar header, grouped bubbles, record cards,
 * typing indicator and floating composer. Presentational only; the screen
 * keeps the question engine, session and scrolling logic.
 */
export function AskHeaderV4({ avatar, status, onClose, actions }: { avatar: ImageSourcePropType; status: string; onClose: () => void; actions: NativeMenuAction[] }) {
  const colors = useRedesignColors();
  const plain = useSurfacePreferences().reduceTransparency;
  return <View style={styles.header}>
    <TouchPressable accessibilityRole="button" accessibilityLabel="Close Ask JourneyDeck" onPress={onClose}
      style={({ pressed }) => [styles.circle, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, pressed && redesignStyles.pressed]}>
      <SymbolView name="xmark" tintColor={colors.text} size={15} weight="semibold" />
    </TouchPressable>
    <View style={styles.identity} accessible accessibilityRole="header" accessibilityLabel={`JourneyDeck. ${status}`}>
      <GlassAvatar source={avatar} size={46} plain={plain} />
      <Text style={[styles.name, { color: colors.text }]}>JourneyDeck</Text>
      <View style={styles.statusRow}>
        <SymbolView name="lock.fill" tintColor={colors.accent} size={9} />
        <Text numberOfLines={1} style={[styles.status, { color: colors.textSecondary }]}>{status}</Text>
      </View>
    </View>
    <View style={[styles.circle, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
      <NativeActionMenu compact label="Ask JourneyDeck actions" actions={actions} />
    </View>
  </View>;
}

export function DayLabel({ children }: { children: string }) {
  const colors = useRedesignColors();
  return <Text style={[styles.day, { color: colors.textTertiary }]}>{children}</Text>;
}

/** An assistant bubble. The avatar sits beside the last bubble of a group. */
export function AssistantBubbleV4({ avatar, showAvatar = true, live = false, children }: { avatar: ImageSourcePropType; showAvatar?: boolean; live?: boolean; children: ReactNode }) {
  const colors = useRedesignColors();
  const plain = useSurfacePreferences().reduceTransparency;
  return <View style={styles.assistantRow}>
    {showAvatar ? <GlassAvatar source={avatar} size={28} plain={plain} /> : <View style={styles.bubbleAvatar} />}
    <View accessibilityLiveRegion={live ? 'polite' : undefined} style={[styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
  </View>;
}

export function BubbleText({ children, secondary = false }: { children: string; secondary?: boolean }) {
  const colors = useRedesignColors();
  return <Text selectable style={[styles.bubbleText, { color: secondary ? colors.textSecondary : colors.text }]}>{children}</Text>;
}

export function UserBubbleV4({ text }: { text: string }) {
  const colors = useRedesignColors();
  return <View style={styles.userRow}>
    <View style={[styles.userBubble, { backgroundColor: colors.accent }]}><Text selectable style={[styles.bubbleText, { color: colors.onAccent }]}>{text}</Text></View>
  </View>;
}

export function EvidenceCardsV4({ items, disabled, onOpen }: { items: AskEvidence[]; disabled: boolean; onOpen: (item: AskEvidence) => void }) {
  const colors = useRedesignColors();
  if (!items.length) return null;
  return <View style={[styles.evidence, { borderTopColor: colors.separator }]}>
    <Text style={[styles.kicker, { color: colors.textSecondary }]}>FROM YOUR LIBRARY</Text>
    {items.slice(0, 5).map(item => <TouchPressable key={`${item.kind}:${item.id}`} accessibilityRole="button" accessibilityLabel={`Open ${item.kind === 'journey' ? 'drive' : 'Memory'} ${item.label}`}
      disabled={disabled} onPress={() => onOpen(item)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surfaceStrong }, disabled && styles.disabled, pressed && redesignStyles.pressed]}>
      <View style={[styles.cardIcon, { backgroundColor: colors.accentSoft }]}>
        <SymbolView name={item.kind === 'journey' ? 'road.lanes' : 'photo.stack'} tintColor={colors.accent} size={17} />
      </View>
      <View style={redesignStyles.flex}>
        <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.text }]}>{item.label}</Text>
        <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{item.kind === 'journey' ? 'Drive' : 'Memory'}</Text>
      </View>
      <SymbolView name="chevron.right" tintColor={colors.textTertiary} size={12} weight="semibold" />
    </TouchPressable>)}
  </View>;
}

export function TypingBubbleV4({ avatar, reduceMotion = false }: { avatar: ImageSourcePropType; reduceMotion?: boolean }) {
  const colors = useRedesignColors();
  const plain = useSurfacePreferences().reduceTransparency;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Reading your road history" style={styles.assistantRow}>
    <GlassAvatar source={avatar} size={28} plain={plain} />
    <View style={[styles.typing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TypingDots color={colors.accent} reduceMotion={reduceMotion} />
      <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>Reading your road history…</Text>
    </View>
  </View>;
}

export function SuggestionChipsV4({ suggestions, disabled, onPick }: { suggestions: readonly string[]; disabled: boolean; onPick: (text: string) => void }) {
  const colors = useRedesignColors();
  return <View style={styles.suggestions}>
    {suggestions.map(text => <TouchPressable key={text} accessibilityRole="button" accessibilityLabel={`Ask: ${text}`} disabled={disabled} onPress={() => onPick(text)}
      style={({ pressed }) => [styles.suggestion, { backgroundColor: colors.accentSoft }, disabled && styles.disabled, pressed && redesignStyles.pressed]}>
      <Text style={[styles.suggestionText, { color: colors.accent }]}>{text}</Text>
    </TouchPressable>)}
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  identity: { flex: 1, alignItems: 'center', gap: 2 },
  name: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  status: { fontSize: 11, lineHeight: 14, flexShrink: 1 },
  day: { alignSelf: 'center', fontSize: 12, fontWeight: '600', paddingVertical: 6 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingRight: 36 },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 14 },
  assistantBubble: { flexShrink: 1, paddingHorizontal: 15, paddingVertical: 12, gap: 8, borderRadius: 20, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: 56 },
  userBubble: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 20, borderBottomRightRadius: 6 },
  evidence: { gap: 8, paddingTop: 10, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 20, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 36 },
  suggestion: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, minHeight: 34, justifyContent: 'center' },
  suggestionText: { fontSize: 13, fontWeight: '600' },
});
