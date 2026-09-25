import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Column, Host, TextInput, useNativeState } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from './app-theme';
import { getCurrentUser } from './auth';
import { ASK_EXAMPLES, askJourneyDeck, isAskJourneyDeckAvailable, resolveJourneyDeckAnswer, type AskAnswer, type AskEvidence } from './ask-journeydeck';
import { V3_ASK_JOURNEYDECK_ENABLED } from './release-features';
import { canShowSiriTesting } from './siri-testing';

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: AskAnswer };

export function AskJourneyDeckScreen() {
  const theme = useAppTheme(), c = theme.palette, userID = getCurrentUser().id, insets = useSafeAreaInsets();
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const question = useNativeState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const request = useRef(0), inFlight = useRef(false), context = useRef<string | undefined>(undefined), messageID = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const nextID = (kind: string) => `${kind}-${++messageID.current}`;
  const invalidate = useCallback(() => {
    request.current++; inFlight.current = false; context.current = undefined; messageID.current = 0;
    setBusy(false); setMessages([]); setError(null);
    try { question.value = ''; } catch { /* The dismissed field is already gone. */ }
  }, [question]);
  useEffect(() => { invalidate(); }, [userID, invalidate]);
  useFocusEffect(useCallback(() => () => { invalidate(); }, [invalidate]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state !== 'active') invalidate();
    });
    return () => { request.current++; listener.remove(); };
  }, [invalidate]);

  const perform = useCallback(async (work: () => Promise<AskAnswer>, prompt?: string) => {
    if (inFlight.current || AppState.currentState !== 'active') return;
    const id = ++request.current; inFlight.current = true; setBusy(true); setError(null);
    if (prompt) setMessages(current => [...current, { id: nextID('user'), role: 'user', text: prompt }]);
    try {
      const next = await work();
      if (id !== request.current || getCurrentUser().id !== userID || AppState.currentState !== 'active') return;
      setMessages(current => [...current, { id: nextID('answer'), role: 'assistant', answer: next }]);
      context.current = next.contextToken;
    } catch {
      if (id === request.current) { context.current = undefined; setError('I couldn’t answer that question. Check the active profile and try again.'); }
    } finally {
      if (id === request.current) { inFlight.current = false; setBusy(false); }
    }
  }, [userID]);
  useEffect(() => {
    if (ticket && V3_ASK_JOURNEYDECK_ENABLED && foreground) void perform(() => resolveJourneyDeckAnswer(userID, ticket));
  }, [ticket, userID, foreground, perform]);

  const submitValue = (raw: string) => {
    const value = raw.trim();
    if (!value) { setError('Enter a question first.'); return; }
    Keyboard.dismiss(); question.value = '';
    void perform(() => askJourneyDeck(userID, value, context.current), value);
  };
  const submit = () => submitValue(question.value);
  const openEvidence = async (messageId: string, answer: AskAnswer, item: AskEvidence) => {
    if (!answer.ticket || inFlight.current) return;
    const id = ++request.current; inFlight.current = true; setBusy(true);
    try {
      const refreshed = await resolveJourneyDeckAnswer(userID, answer.ticket);
      if (id !== request.current || getCurrentUser().id !== userID || AppState.currentState !== 'active') return;
      if (!refreshed.evidence.some(e => e.id === item.id && e.kind === item.kind)) {
        setMessages(current => current.map(message => message.id === messageId && message.role === 'assistant' ? { ...message, answer: refreshed } : message));
        setError('That record is no longer in this answer. Ask again to refresh the result.'); return;
      }
      router.push(item.kind === 'journey' ? { pathname: '/journey/[id]', params: { id: item.id } } : { pathname: '/memory/[id]', params: { id: item.id } });
    } catch { if (id === request.current) setError('The supporting record could not be opened. Please ask again.'); }
    finally { if (id === request.current) { inFlight.current = false; setBusy(false); } }
  };

  const canSend = !busy && foreground && isAskJourneyDeckAvailable;
  return <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: c.page }]}>
    <Stack.Screen options={{
      title: 'Ask JourneyDeck',
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Close Ask JourneyDeck" onPress={() => { invalidate(); router.canGoBack() ? router.back() : router.replace('/'); }} style={styles.closeButton}>
        <SymbolView name="xmark" tintColor={c.accent} size={17} weight="semibold" />
      </Pressable>,
    }} />
    {!V3_ASK_JOURNEYDECK_ENABLED
      ? <View style={styles.unavailable}><Text selectable style={[styles.body, { color: c.text }]}>Ask JourneyDeck is available in V3.</Text></View>
      : <>
        <ScrollView ref={scroll} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          style={styles.scroll} contentContainerStyle={styles.conversation} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <View style={styles.identityRow}>
            <View style={[styles.avatar, { backgroundColor: c.accent }]}><SymbolView name="point.3.connected.trianglepath.dotted" tintColor={c.onAccent} size={23} weight="semibold" /></View>
            <View style={styles.identityCopy}><Text style={[styles.identityTitle, { color: c.text }]}>JourneyDeck</Text><Text style={[styles.identityStatus, { color: c.muted }]}>Your private road companion</Text></View>
            <View style={[styles.privateBadge, { backgroundColor: c.inset }]}><SymbolView name="lock.fill" tintColor={c.accent} size={10} /><Text style={[styles.privateText, { color: c.muted }]}>ON DEVICE</Text></View>
          </View>

          {messages.length === 0 && !busy && <View style={styles.welcome}>
            <Text style={[styles.welcomeTitle, { color: c.text }]}>Where have we been?</Text>
            <Text style={[styles.welcomeBody, { color: c.muted }]}>Ask about your journeys, music, Memories, markers, or familiar places. I’ll answer from the active profile’s local history.</Text>
            <View style={styles.prompts}>
              {ASK_EXAMPLES.map((example, index) => <Pressable key={example} accessibilityRole="button" accessibilityLabel={`Ask: ${example}`} disabled={busy}
                onPress={() => submitValue(example)} style={({ pressed }) => [styles.prompt, { backgroundColor: c.card, borderColor: c.line, opacity: pressed ? 0.68 : 1 }]}>
                <View style={[styles.promptIcon, { backgroundColor: c.inset }]}><SymbolView name={index === 0 ? 'road.lanes' : index === 1 ? 'clock.arrow.circlepath' : 'music.note'} tintColor={c.accent} size={17} /></View>
                <Text style={[styles.promptText, { color: c.text }]}>{example}</Text><SymbolView name="arrow.up.right" tintColor={c.muted} size={13} />
              </Pressable>)}
            </View>
          </View>}

          {messages.map(message => message.role === 'user'
            ? <View key={message.id} style={styles.userRow}><View style={[styles.userBubble, { backgroundColor: c.accent }]}><Text selectable style={[styles.messageText, { color: c.onAccent }]}>{message.text}</Text></View></View>
            : <AssistantMessage key={message.id} message={message} colors={c} busy={busy} onEvidence={item => void openEvidence(message.id, message.answer, item)} />)}

          {busy && <View accessibilityLabel="Reading your local history" style={styles.assistantRow}>
            <View style={[styles.miniAvatar, { backgroundColor: c.inset }]}><SymbolView name="point.3.connected.trianglepath.dotted" tintColor={c.accent} size={15} /></View>
            <View style={[styles.thinkingBubble, { backgroundColor: c.card, borderColor: c.line }]}><ActivityIndicator color={c.accent} size="small" /><Text style={[styles.thinkingText, { color: c.muted }]}>Reading your road history…</Text></View>
          </View>}
          {error && <View accessibilityRole="alert" style={[styles.errorBubble, { backgroundColor: c.inset, borderColor: c.line }]}><SymbolView name="exclamationmark.circle.fill" tintColor={c.accent} size={17} /><Text selectable style={[styles.errorText, { color: c.text }]}>{error}</Text></View>}
          {!isAskJourneyDeckAvailable && <Text selectable style={[styles.availability, { color: c.muted }]}>This installed version needs the V3 native question engine.</Text>}
          {messages.length > 0 && !busy && <Text style={[styles.followUp, { color: c.muted }]}>Ask a follow-up or start a new question below.</Text>}
          {canShowSiriTesting && <Pressable accessibilityRole="button" onPress={() => router.push('/siri-testing')} style={styles.testingLink}><Text style={[styles.testingText, { color: c.accent }]}>Open Siri AI testing</Text><SymbolView name="chevron.right" tintColor={c.accent} size={13} /></Pressable>}
        </ScrollView>

        <View style={[styles.composerDock, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: c.page, borderColor: c.line }]}>
          <View style={styles.privacyRow}><SymbolView name="lock.fill" tintColor={c.muted} size={9} /><Text style={[styles.privacyLine, { color: c.muted }]}>Questions aren’t saved or sent with your journey data.</Text></View>
          <View style={[styles.composer, { backgroundColor: c.card, borderColor: error ? c.accent : c.line }]}>
            <Host matchContents colorScheme={theme.isLight ? 'light' : 'dark'} seedColor={c.accent} style={styles.inputHost}>
              <Column><TextInput testID="ask-question" value={question} placeholder="Ask about your road history" maxLength={500} editable={canSend}
                returnKeyType="send" onSubmitEditing={submit} style={styles.input} textStyle={{ color: c.text, fontSize: 16 }} /></Column>
            </Host>
            <Pressable testID="ask-submit" accessibilityRole="button" accessibilityLabel={busy ? 'Reading your local history' : 'Send question'} onPress={submit} disabled={!canSend}
              style={({ pressed }) => [styles.sendButton, { backgroundColor: canSend ? c.accent : c.inset, opacity: pressed ? 0.7 : 1 }]}>
              {busy ? <ActivityIndicator color={c.muted} size="small" /> : <SymbolView name="arrow.up" tintColor={canSend ? c.onAccent : c.muted} size={18} weight="bold" />}
            </Pressable>
          </View>
        </View>
      </>}
  </KeyboardAvoidingView>;
}

function AssistantMessage({ message, colors: c, busy, onEvidence }: { message: Extract<ChatMessage, { role: 'assistant' }>; colors: ReturnType<typeof useAppTheme>['palette']; busy: boolean; onEvidence: (item: AskEvidence) => void }) {
  const { answer } = message;
  return <View style={styles.assistantRow}>
    <View style={[styles.miniAvatar, { backgroundColor: c.inset }]}><SymbolView name="point.3.connected.trianglepath.dotted" tintColor={c.accent} size={15} /></View>
    <View style={[styles.assistantBubble, { backgroundColor: c.card, borderColor: c.line }]}>
      <Text selectable accessibilityLiveRegion="polite" style={[styles.messageText, { color: c.text }]}>{answer.text}</Text>
      {answer.evidence.length > 0 && <View style={[styles.sources, { borderColor: c.line }]}>
        <Text style={[styles.sourceLabel, { color: c.muted }]}>SUPPORTING RECORDS</Text>
        {answer.evidence.slice(0, 5).map(item => <Pressable key={`${item.kind}:${item.id}`} accessibilityRole="button" accessibilityLabel={`Open ${item.label}`} onPress={() => onEvidence(item)} disabled={busy}
          style={({ pressed }) => [styles.sourceRow, { backgroundColor: c.inset, opacity: pressed ? 0.68 : 1 }]}>
          <SymbolView name={item.kind === 'journey' ? 'road.lanes' : 'photo.on.rectangle'} tintColor={c.accent} size={15} />
          <Text numberOfLines={2} style={[styles.sourceText, { color: c.text }]}>{item.label}</Text><SymbolView name="chevron.right" tintColor={c.muted} size={12} />
        </Pressable>)}
      </View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, scroll: { flex: 1 }, conversation: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 18 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, unavailable: { flex: 1, padding: 24 }, body: { fontSize: 17, lineHeight: 24 },
  identityRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 42, height: 42, borderRadius: 15, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1, gap: 2 }, identityTitle: { fontSize: 17, fontWeight: '800' }, identityStatus: { fontSize: 12 }, privateBadge: { minHeight: 28, paddingHorizontal: 9, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 5 }, privateText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  welcome: { paddingTop: 24, gap: 12 }, welcomeTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.5 }, welcomeBody: { fontSize: 16, lineHeight: 24, maxWidth: 520 }, prompts: { gap: 10, paddingTop: 8 },
  prompt: { minHeight: 60, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 }, promptIcon: { width: 34, height: 34, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, promptText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  userRow: { alignItems: 'flex-end', paddingLeft: 52 }, userBubble: { maxWidth: '88%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderBottomRightRadius: 7, borderCurve: 'continuous' },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingRight: 28 }, miniAvatar: { width: 30, height: 30, borderRadius: 11, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  assistantBubble: { flexShrink: 1, maxWidth: '92%', padding: 15, borderRadius: 20, borderBottomLeftRadius: 7, borderCurve: 'continuous', borderWidth: 1, gap: 13 }, messageText: { fontSize: 16, lineHeight: 23 },
  thinkingBubble: { minHeight: 46, borderRadius: 18, borderBottomLeftRadius: 7, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, thinkingText: { fontSize: 14 },
  sources: { gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth }, sourceLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, sourceRow: { minHeight: 46, borderRadius: 13, borderCurve: 'continuous', paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 }, sourceText: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  errorBubble: { minHeight: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, errorText: { flex: 1, fontSize: 14, lineHeight: 19 },
  availability: { fontSize: 13, lineHeight: 19 }, followUp: { textAlign: 'center', fontSize: 12, paddingVertical: 4 }, testingLink: { minHeight: 44, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5 }, testingText: { fontSize: 14, fontWeight: '700' },
  composerDock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 8, gap: 7 }, privacyRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }, privacyLine: { textAlign: 'center', fontSize: 10, lineHeight: 14 }, composer: { minHeight: 54, borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, paddingLeft: 6, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }, inputHost: { flex: 1 }, input: { minHeight: 44, paddingHorizontal: 10, backgroundColor: 'transparent' },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
