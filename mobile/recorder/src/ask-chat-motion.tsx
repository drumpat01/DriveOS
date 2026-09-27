// Composer, bubble entrance and typing motion adapted from
// Appllama/liquid-glass-chat-ui (Fable thread components),
// Copyright (c) 2026 Appllama, MIT License. See THIRD_PARTY_NOTICES.md.
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withRepeat,
  withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { haptics } from './haptics';
import { redesignStyles, useRedesignColors } from './redesign-ui';
import { TouchPressable } from './touch-feedback';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const SOFT = { duration: 480, dampingRatio: 0.82 } as const;

/** Your question leaves the composer: it starts a little low and large, then settles. */
const enterOutgoing = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 22 }, { scale: 1.02 }] },
    animations: {
      opacity: withTiming(1, { duration: 140 }),
      transform: [{ translateY: withSpring(0, SOFT) }, { scale: withSpring(1, SOFT) }],
    },
  };
};

/** Animates a message in when it arrives after the chat opened; restored history stays still. */
export function MessageEntrance({ mine, animate, reduceMotion, children }: { mine: boolean; animate: boolean; reduceMotion: boolean; children: ReactNode }) {
  const entering = !animate || reduceMotion ? undefined : mine ? enterOutgoing : FadeInDown.duration(260).easing(EASE_OUT);
  return <Animated.View entering={entering}>{children}</Animated.View>;
}

function Dot({ delay, color, reduceMotion }: { delay: number; color: string; reduceMotion: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) { t.set(0.6); return; }
    t.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1)));
    return () => cancelAnimation(t);
  }, [delay, t, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * t.get(), transform: [{ translateY: -3 * t.get() }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** Three breathing dots; still dots under Reduce Motion. */
export function TypingDots({ color, reduceMotion }: { color: string; reduceMotion: boolean }) {
  return <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)} exiting={reduceMotion ? undefined : FadeOut.duration(140)} style={styles.dots}>
    <Dot delay={0} color={color} reduceMotion={reduceMotion} />
    <Dot delay={140} color={color} reduceMotion={reduceMotion} />
    <Dot delay={280} color={color} reduceMotion={reduceMotion} />
  </Animated.View>;
}

/**
 * The floating composer. It rides the keyboard, including interactive
 * drag-to-dismiss, grows with multi-line questions, and the send button
 * fades up as soon as there is text.
 */
export function ChatComposer({ value, onChange, onSubmit, canSend, busy, error, reduceMotion, bottomInset, onHeight }: {
  value: string; onChange: (value: string) => void; onSubmit: () => void; canSend: boolean; busy: boolean; error: boolean;
  reduceMotion: boolean; bottomInset: number; onHeight: (height: number) => void;
}) {
  const colors = useRedesignColors();
  const input = useRef<TextInput>(null);
  const ready = canSend && value.trim().length > 0;
  const sendT = useSharedValue(ready ? 1 : 0);
  useEffect(() => {
    sendT.set(reduceMotion ? (ready ? 1 : 0) : withTiming(ready ? 1 : 0, { duration: 180, easing: EASE_OUT }));
  }, [ready, reduceMotion, sendT]);
  const sendStyle = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * sendT.get(), transform: [{ scale: 0.82 + 0.18 * sendT.get() }] }));
  const submit = () => { if (!ready) return; void haptics.selection(); onSubmit(); };
  return <KeyboardStickyView offset={{ closed: 0, opened: bottomInset }} style={styles.sticky}>
    <View onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)} style={[styles.dock, { paddingBottom: Math.max(bottomInset, 12), backgroundColor: colors.photoScrim[3] }]}>
      <Text style={[styles.privacy, { color: colors.textTertiary }]}>Questions stay on this iPhone and aren’t saved.</Text>
      <View style={[styles.card, { backgroundColor: colors.surfaceStrong, borderColor: error ? colors.accent : colors.border, boxShadow: `0 12px 30px ${colors.shadow}` }]}>
        <TextInput ref={input} testID="ask-question" value={value} onChangeText={onChange} multiline placeholder="Ask about your road history"
          placeholderTextColor={colors.textTertiary} selectionColor={colors.accent} maxLength={500} editable={canSend || busy}
          returnKeyType="send" submitBehavior="submit" enablesReturnKeyAutomatically onSubmitEditing={submit}
          accessibilityLabel="Ask about your road history" style={[styles.input, { color: colors.text }]} />
        <Animated.View style={sendStyle}>
          <TouchPressable testID="ask-submit" accessibilityRole="button" accessibilityLabel={busy ? 'Reading your local history' : 'Send question'}
            accessibilityState={{ disabled: !ready }} onPress={submit} disabled={!ready}
            style={({ pressed }) => [styles.send, { backgroundColor: ready ? colors.accent : colors.track }, pressed && redesignStyles.pressed]}>
            {busy ? <ActivityIndicator color={colors.textSecondary} size="small" /> : <SymbolView name="arrow.up" tintColor={ready ? colors.onAccent : colors.textTertiary} size={17} weight="bold" />}
          </TouchPressable>
        </Animated.View>
      </View>
    </View>
  </KeyboardStickyView>;
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 20 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  dock: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  privacy: { fontSize: 11, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: 58, paddingLeft: 20, paddingRight: 7, paddingVertical: 7, borderRadius: 29, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, maxHeight: 138, fontSize: 16, lineHeight: 22, paddingTop: 11, paddingBottom: 11 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
