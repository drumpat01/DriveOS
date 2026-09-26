import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from './app-theme';
import { getCurrentUser } from './auth';
import { ASK_CANNOT_COMPUTE, askJourneyDeck, askJourneyDeckModelAvailability, isAskJourneyDeckAvailable, resolveJourneyDeckAnswer, type AskAnswer, type AskEvidence } from './ask-journeydeck';
import { V3_ASK_JOURNEYDECK_ENABLED } from './release-features';
import { canShowSiriTesting } from './siri-testing';
import type { ThemeId } from './theme-catalog';

const botAvatars: Record<ThemeId, ImageSourcePropType> = {
  dark: require('../assets/navigator-cinematic-dark-256.png'),
  light: require('../assets/navigator-warm-ivory-256.png'),
  sakura: require('../assets/navigator-rosewater-256.png'),
  redline: require('../assets/navigator-grand-touring-256.png'),
  'midnight-canopy': require('../assets/navigator-autumn-drive-256.png'),
};

function BotAvatar({ themeID, size }: { themeID: ThemeId; size: number }) {
  return <Image accessibilityLabel="JourneyDeck bot avatar" source={botAvatars[themeID]}
    style={{ width: size, height: size }} />;
}

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: AskAnswer };

type ChatSession = {
  messages: ChatMessage[];
  context?: string;
  nextMessageID: number;
  busy: boolean;
  openedTickets: Set<string>;
  listeners: Set<() => void>;
};
const chatSessions = new Map<string, ChatSession>();
const sessionFor = (userID: string) => {
  const existing = chatSessions.get(userID);
  if (existing) return existing;
  const created: ChatSession = { messages: [], nextMessageID: 0, busy: false, openedTickets: new Set(), listeners: new Set() };
  chatSessions.set(userID, created);
  return created;
};
const notifySession = (session: ChatSession) => { for (const listener of session.listeners) listener(); };

export function AskJourneyDeckScreen() {
  const theme = useAppTheme(), c = theme.palette, userID = getCurrentUser().id, insets = useSafeAreaInsets();
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const session = sessionFor(userID);
  const [question, setQuestion] = useState('');
  const [chatSnapshot, setChatSnapshot] = useState({ userID, messages: session.messages, busy: session.busy });
  const messages = chatSnapshot.userID === userID ? chatSnapshot.messages : session.messages;
  const busy = chatSnapshot.userID === userID ? chatSnapshot.busy : session.busy;
  const [error, setError] = useState<string | null>(null), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const visibleQuestion = chatSnapshot.userID === userID ? question : '';
  const visibleError = chatSnapshot.userID === userID ? error : null;
  const [modelAvailability, setModelAvailability] = useState<string>('checking');
  const request = useRef(0), context = useRef<string | undefined>(session.context);
  const scroll = useRef<ScrollView>(null);
  const scrollRequested = useRef(false);
  const renderedMessageCount = useRef(session.messages.length);
  const nextID = (kind: string) => `${kind}-${++sessionFor(userID).nextMessageID}`;
  const updateMessages = (update: (current: ChatMessage[]) => ChatMessage[]) => {
    const saved = sessionFor(userID);
    saved.messages = update(saved.messages);
    notifySession(saved);
  };
  const setSessionBusy = (value: boolean) => {
    const saved = sessionFor(userID);
    saved.busy = value;
    notifySession(saved);
  };
  useEffect(() => {
    const saved = sessionFor(userID);
    // iOS formSheet reports changing content sizes during its open animation.
    // Scrolling a restored transcript then can move every bubble off screen.
    // Only scroll when a new message arrives after the sheet is visible.
    scrollRequested.current = false;
    renderedMessageCount.current = saved.messages.length;
    const sync = () => {
      if (saved.messages.length > renderedMessageCount.current) scrollRequested.current = true;
      renderedMessageCount.current = saved.messages.length;
      context.current = saved.context;
      setChatSnapshot({ userID, messages: saved.messages, busy: saved.busy });
    };
    saved.listeners.add(sync);
    request.current++;
    sync(); setError(null); setQuestion('');
    return () => { saved.listeners.delete(sync); request.current++; };
  }, [userID]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
    });
    return () => { listener.remove(); };
  }, []);
  useEffect(() => {
    if (!foreground) return;
    let cancelled = false;
    void askJourneyDeckModelAvailability().then(status => { if (!cancelled) setModelAvailability(status); });
    return () => { cancelled = true; };
  }, [foreground]);

  const perform = useCallback(async (work: () => Promise<AskAnswer>, prompt?: string) => {
    if (sessionFor(userID).busy || AppState.currentState !== 'active') return;
    setSessionBusy(true); setError(null);
    if (prompt) { scrollRequested.current = true; updateMessages(current => [...current, { id: nextID('user'), role: 'user', text: prompt }]); }
    try {
      const next = await work();
      if (getCurrentUser().id !== userID) {
        const saved = sessionFor(userID);
        saved.context = undefined;
        saved.messages = [...saved.messages, { id: nextID('answer'), role: 'assistant', answer: { status: 'unavailable', text: ASK_CANNOT_COMPUTE, evidence: [] } }];
        return;
      }
      scrollRequested.current = true;
      updateMessages(current => [...current, { id: nextID('answer'), role: 'assistant', answer: next }]);
      sessionFor(userID).context = next.status === 'answered' ? next.contextToken : undefined;
      context.current = sessionFor(userID).context;
    } catch {
      if (getCurrentUser().id === userID) {
        context.current = undefined; sessionFor(userID).context = undefined;
        scrollRequested.current = true;
        updateMessages(current => [...current, { id: nextID('answer'), role: 'assistant', answer: { status: 'unavailable', text: ASK_CANNOT_COMPUTE, evidence: [] } }]);
      }
    } finally {
      setSessionBusy(false);
    }
  }, [userID]);
  useEffect(() => {
    if (!ticket || !V3_ASK_JOURNEYDECK_ENABLED || !foreground || busy || sessionFor(userID).openedTickets.has(ticket)) return;
    sessionFor(userID).openedTickets.add(ticket);
    void perform(() => resolveJourneyDeckAnswer(userID, ticket));
  }, [ticket, userID, foreground, busy, perform]);

  const submitValue = (raw: string) => {
    const value = raw.trim();
    if (!value) { setError('Enter a question first.'); return; }
    Keyboard.dismiss(); setQuestion('');
    void perform(() => askJourneyDeck(userID, value, context.current), value);
  };
  const submit = () => submitValue(visibleQuestion);
  const openEvidence = async (messageId: string, answer: AskAnswer, item: AskEvidence) => {
    if (!answer.ticket || sessionFor(userID).busy) return;
    const id = ++request.current; setSessionBusy(true);
    try {
      const refreshed = await resolveJourneyDeckAnswer(userID, answer.ticket);
      if (id !== request.current || getCurrentUser().id !== userID || AppState.currentState !== 'active') return;
      if (!refreshed.evidence.some(e => e.id === item.id && e.kind === item.kind)) {
        updateMessages(current => current.map(message => message.id === messageId && message.role === 'assistant' ? { ...message, answer: refreshed } : message));
        setError('That record is no longer in this answer. Ask again to refresh the result.'); return;
      }
      router.push(item.kind === 'journey' ? { pathname: '/journey/[id]', params: { id: item.id } } : { pathname: '/memory/[id]', params: { id: item.id } });
    } catch { if (id === request.current) setError('The supporting record could not be opened. Please ask again.'); }
    finally { setSessionBusy(false); }
  };

  const canSend = !busy && foreground && isAskJourneyDeckAvailable;
  const emptyChat = messages.length === 0 && !busy && !visibleError && !ticket && isAskJourneyDeckAvailable;
  return <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: c.page }]}>
    <Stack.Screen options={{
      title: 'Ask JourneyDeck',
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Close Ask JourneyDeck" onPress={() => { router.canGoBack() ? router.back() : router.replace('/'); }} style={styles.closeButton}>
        <SymbolView name="xmark" tintColor={c.accent} size={17} weight="semibold" />
      </Pressable>,
    }} />
    {!V3_ASK_JOURNEYDECK_ENABLED
      ? <View style={styles.unavailable}><Text selectable style={[styles.body, { color: c.text }]}>Ask JourneyDeck is available in V3.</Text></View>
      : <>
        {emptyChat ? <View style={[styles.scroll, styles.conversation]}>
          <View style={styles.identityRow}>
            <BotAvatar themeID={theme.id} size={42} />
            <View style={styles.identityCopy}><Text style={[styles.identityTitle, { color: c.text }]}>JourneyDeck</Text><Text numberOfLines={2} style={[styles.identityStatus, { color: c.muted }]}>{modelStatusLabel(modelAvailability)}</Text></View>
            <View style={[styles.privateBadge, { backgroundColor: c.inset }]}><SymbolView name="lock.fill" tintColor={c.accent} size={10} /><Text style={[styles.privateText, { color: c.muted }]}>ON DEVICE</Text></View>
          </View>
          <View style={styles.assistantRow}>
            <BotAvatar themeID={theme.id} size={30} />
            <View style={[styles.assistantBubble, { backgroundColor: c.card, borderColor: c.line }]}>
              <Text style={[styles.messageText, { color: c.text }]}>Hello! I’m JourneyDeck.</Text>
              <Text style={[styles.messageText, { color: c.muted }]}>Ask me about your journeys, music, Memories, markers, or familiar places, and I’ll answer from this profile’s private on-device history.</Text>
            </View>
          </View>
        </View> :
        <ScrollView ref={scroll} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          style={styles.scroll} contentContainerStyle={styles.conversation}
          onContentSizeChange={() => { if (scrollRequested.current) { scrollRequested.current = false; scroll.current?.scrollToEnd({ animated: true }); } }}>
          <View style={styles.identityRow}>
            <BotAvatar themeID={theme.id} size={42} />
            <View style={styles.identityCopy}><Text style={[styles.identityTitle, { color: c.text }]}>JourneyDeck</Text><Text numberOfLines={2} style={[styles.identityStatus, { color: c.muted }]}>{modelStatusLabel(modelAvailability)}</Text></View>
            <View style={[styles.privateBadge, { backgroundColor: c.inset }]}><SymbolView name="lock.fill" tintColor={c.accent} size={10} /><Text style={[styles.privateText, { color: c.muted }]}>ON DEVICE</Text></View>
          </View>

          <View style={styles.assistantRow}>
            <BotAvatar themeID={theme.id} size={30} />
            <View style={[styles.assistantBubble, { backgroundColor: c.card, borderColor: c.line }]}>
              <Text style={[styles.messageText, { color: c.text }]}>Hello! I’m JourneyDeck.</Text>
              <Text style={[styles.messageText, { color: c.muted }]}>Ask me about your journeys, music, Memories, markers, or familiar places, and I’ll answer from this profile’s private on-device history.</Text>
            </View>
          </View>

          {messages.map(message => message.role === 'user'
            ? <View key={message.id} style={styles.userRow}><View style={[styles.userBubble, { backgroundColor: c.accent }]}><Text selectable style={[styles.messageText, { color: c.onAccent }]}>{message.text}</Text></View></View>
            : <AssistantMessage key={message.id} message={message} themeID={theme.id} colors={c} busy={busy} onEvidence={item => void openEvidence(message.id, message.answer, item)} />)}

          {busy && <View accessibilityLabel="Reading your local history" style={styles.assistantRow}>
            <BotAvatar themeID={theme.id} size={30} />
            <View style={[styles.thinkingBubble, { backgroundColor: c.card, borderColor: c.line }]}><ActivityIndicator color={c.accent} size="small" /><Text style={[styles.thinkingText, { color: c.muted }]}>Reading your road history…</Text></View>
          </View>}
          {visibleError && <View accessibilityRole="alert" style={[styles.errorBubble, { backgroundColor: c.inset, borderColor: c.line }]}><SymbolView name="exclamationmark.circle.fill" tintColor={c.accent} size={17} /><Text selectable style={[styles.errorText, { color: c.text }]}>{visibleError}</Text></View>}
          {!isAskJourneyDeckAvailable && <Text selectable style={[styles.availability, { color: c.muted }]}>This installed version needs the V3 native question engine.</Text>}
          {messages.length > 0 && !busy && <Text style={[styles.followUp, { color: c.muted }]}>Ask a follow-up or start a new question below.</Text>}
          {canShowSiriTesting && <Pressable accessibilityRole="button" onPress={() => router.push('/siri-testing')} style={styles.testingLink}><Text style={[styles.testingText, { color: c.accent }]}>Open Siri AI testing</Text><SymbolView name="chevron.right" tintColor={c.accent} size={13} /></Pressable>}
        </ScrollView>}

        <View style={[styles.composerDock, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: c.page, borderColor: c.line }]}>
          <View style={styles.privacyRow}><SymbolView name="lock.fill" tintColor={c.muted} size={9} /><Text style={[styles.privacyLine, { color: c.muted }]}>Questions aren’t saved or sent with your journey data.</Text></View>
          <View style={[styles.composer, { backgroundColor: c.card, borderColor: visibleError ? c.accent : c.line }]}>
            <TextInput testID="ask-question" value={visibleQuestion} onChangeText={setQuestion} placeholder="Ask about your road history"
              placeholderTextColor={c.muted} selectionColor={c.accent} maxLength={500} editable={canSend} returnKeyType="send"
              onSubmitEditing={submit} style={[styles.input, { color: c.text }]} />
            <Pressable testID="ask-submit" accessibilityRole="button" accessibilityLabel={busy ? 'Reading your local history' : 'Send question'} onPress={submit} disabled={!canSend}
              style={({ pressed }) => [styles.sendButton, { backgroundColor: canSend ? c.accent : c.inset, opacity: pressed ? 0.7 : 1 }]}>
              {busy ? <ActivityIndicator color={c.muted} size="small" /> : <SymbolView name="arrow.up" tintColor={canSend ? c.onAccent : c.muted} size={18} weight="bold" />}
            </Pressable>
          </View>
        </View>
      </>}
  </KeyboardAvoidingView>;
}

function AssistantMessage({ message, themeID, colors: c, busy, onEvidence }: { message: Extract<ChatMessage, { role: 'assistant' }>; themeID: ThemeId; colors: ReturnType<typeof useAppTheme>['palette']; busy: boolean; onEvidence: (item: AskEvidence) => void }) {
  const { answer } = message;
  return <View style={styles.assistantRow}>
    <BotAvatar themeID={themeID} size={30} />
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

function modelStatusLabel(status: string): string {
  switch (status) {
  case 'available': return 'Apple Intelligence ready on this iPhone';
  case 'appleIntelligenceNotEnabled': return 'Turn on Apple Intelligence in iPhone Settings';
  case 'modelNotReady': return 'Apple Intelligence is preparing its on-device model';
  case 'deviceNotEligible': return 'On-device Apple Intelligence needs a supported iPhone';
  case 'unsupportedOS': return 'On-device Apple Intelligence needs iOS 26 or later';
  default: return 'Your private road companion';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, scroll: { flex: 1 }, conversation: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 18 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, unavailable: { flex: 1, padding: 24 }, body: { fontSize: 17, lineHeight: 24 },
  identityRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  identityCopy: { flex: 1, gap: 2 }, identityTitle: { fontSize: 17, fontWeight: '800' }, identityStatus: { fontSize: 12 }, privateBadge: { minHeight: 28, paddingHorizontal: 9, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 5 }, privateText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  userRow: { alignItems: 'flex-end', paddingLeft: 52 }, userBubble: { maxWidth: '88%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderBottomRightRadius: 7, borderCurve: 'continuous' },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingRight: 28 },
  assistantBubble: { flexShrink: 1, maxWidth: '92%', padding: 15, borderRadius: 20, borderBottomLeftRadius: 7, borderCurve: 'continuous', borderWidth: 1, gap: 13 }, messageText: { fontSize: 16, lineHeight: 23 },
  thinkingBubble: { minHeight: 46, borderRadius: 18, borderBottomLeftRadius: 7, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, thinkingText: { fontSize: 14 },
  sources: { gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth }, sourceLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, sourceRow: { minHeight: 46, borderRadius: 13, borderCurve: 'continuous', paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 }, sourceText: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  errorBubble: { minHeight: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, errorText: { flex: 1, fontSize: 14, lineHeight: 19 },
  availability: { fontSize: 13, lineHeight: 19 }, followUp: { textAlign: 'center', fontSize: 12, paddingVertical: 4 }, testingLink: { minHeight: 44, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5 }, testingText: { fontSize: 14, fontWeight: '700' },
  composerDock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 8, gap: 7 }, privacyRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }, privacyLine: { textAlign: 'center', fontSize: 10, lineHeight: 14 }, composer: { minHeight: 54, borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, paddingLeft: 6, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }, input: { flex: 1, minHeight: 44, paddingHorizontal: 10, backgroundColor: 'transparent', fontSize: 16 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
