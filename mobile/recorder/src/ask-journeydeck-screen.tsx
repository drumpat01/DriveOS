import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Column, Host, TextInput, useNativeState } from '@expo/ui';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAppTheme } from './app-theme';
import { getCurrentUser } from './auth';
import { ASK_EXAMPLES, askJourneyDeck, isAskJourneyDeckAvailable, resolveJourneyDeckAnswer, type AskAnswer, type AskEvidence } from './ask-journeydeck';
import { V3_ASK_JOURNEYDECK_ENABLED } from './release-features';
import { canShowSiriTesting } from './siri-testing';

export function AskJourneyDeckScreen() {
  const theme = useAppTheme(), c = theme.palette, userID = getCurrentUser().id;
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const question = useNativeState('');
  const [answer, setAnswer] = useState<AskAnswer | null>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const request = useRef(0), inFlight = useRef(false), context = useRef<string | undefined>(undefined);
  const invalidate = useCallback(() => {
    request.current++; inFlight.current = false; context.current = undefined;
    setBusy(false); setAnswer(null); setError(null);
    // Expo can release the native state before the navigation cleanup on unmount.
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

  const perform = useCallback(async (work: () => Promise<AskAnswer>) => {
    if (inFlight.current || AppState.currentState !== 'active') return;
    const id = ++request.current; inFlight.current = true; setBusy(true); setError(null);
    try {
      const next = await work();
      if (id !== request.current || getCurrentUser().id !== userID || AppState.currentState !== 'active') return;
      setAnswer(next); context.current = next.contextToken;
    } catch {
      if (id === request.current) { setAnswer(null); context.current = undefined; setError('Your question could not be answered. Check the active profile and try again.'); }
    } finally {
      if (id === request.current) { inFlight.current = false; setBusy(false); }
    }
  }, [userID]);
  useEffect(() => {
    if (ticket && V3_ASK_JOURNEYDECK_ENABLED && foreground) void perform(() => resolveJourneyDeckAnswer(userID, ticket));
  }, [ticket, userID, foreground, perform]);

  const submit = () => {
    const value = question.value.trim();
    if (!value) { setError('Enter a question first.'); return; }
    Keyboard.dismiss();
    void perform(() => askJourneyDeck(userID, value, context.current));
  };
  const openEvidence = async (item: AskEvidence) => {
    if (!answer?.ticket || inFlight.current) return;
    const id = ++request.current; inFlight.current = true; setBusy(true);
    try {
      const refreshed = await resolveJourneyDeckAnswer(userID, answer.ticket);
      if (id !== request.current || getCurrentUser().id !== userID || AppState.currentState !== 'active') return;
      if (!refreshed.evidence.some(e => e.id === item.id && e.kind === item.kind)) { setAnswer(refreshed); setError('That record is no longer in this answer. Ask again to refresh the result.'); return; }
      router.push(item.kind === 'journey' ? { pathname: '/journey/[id]', params: { id: item.id } } : { pathname: '/memory/[id]', params: { id: item.id } });
    } catch { if (id === request.current) setError('The supporting record could not be opened. Please ask again.'); }
    finally { if (id === request.current) { inFlight.current = false; setBusy(false); } }
  };

  return <ScrollView contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
    style={{ flex: 1, backgroundColor: c.page }} contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 20 }}>
    <Stack.Screen options={{ headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Close Ask JourneyDeck" onPress={() => { invalidate(); router.canGoBack() ? router.back() : router.replace('/'); }}
      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}><Text style={{ color: c.accent, fontSize: 17 }}>Done</Text></Pressable> }} />
    {!V3_ASK_JOURNEYDECK_ENABLED ? <Text selectable style={{ color: c.text }}>Ask JourneyDeck is available in the V3 preview.</Text> : <>
      <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24 }}>Ask about your completed journeys, Memories, or recorded music. Answers use the active profile’s history saved on this device.</Text>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>Your question</Text>
      <Host matchContents colorScheme={theme.isLight ? 'light' : 'dark'} seedColor={c.accent}>
        <Column spacing={12}>
          <TextInput testID="ask-question" value={question} placeholder="What would you like to know?" autoFocus={!ticket} maxLength={500} editable={!busy && foreground}
            returnKeyType="send" onSubmitEditing={submit} style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }} textStyle={{ color: c.text, fontSize: 17 }} />
          <Button testID="ask-submit" label={busy ? 'Checking your history…' : 'Ask JourneyDeck'} onPress={submit} disabled={busy || !foreground || !isAskJourneyDeckAvailable} />
        </Column>
      </Host>
      {!isAskJourneyDeckAvailable && <Text selectable style={{ color: c.muted }}>This installed version needs the new V3 native preview to answer questions.</Text>}
      {busy && <ActivityIndicator accessibilityLabel="Reading your local history" color={c.accent} />}
      {error && <Text selectable accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}
      {foreground && answer && <View style={{ padding: 20, gap: 14, backgroundColor: c.card, borderRadius: 22, borderWidth: 1, borderColor: c.line }}>
        <Text style={{ color: c.accent, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>{answer.status === 'answered' ? 'FROM YOUR LOCAL HISTORY' : 'ASK JOURNEYDECK'}</Text>
        <Text selectable accessibilityLiveRegion="polite" style={{ color: c.text, fontSize: 18, lineHeight: 27 }}>{answer.text}</Text>
        {answer.evidence.length > 0 && <Text style={{ color: c.muted, fontSize: 13 }}>Supporting records · up to 5 shown</Text>}
        {answer.evidence.map(item => <Pressable key={`${item.kind}:${item.id}`} accessibilityRole="button" accessibilityLabel={`Open ${item.label}`} onPress={() => void openEvidence(item)} disabled={busy}
          style={{ minHeight: 48, paddingVertical: 12, borderTopWidth: 1, borderColor: c.line }}><Text style={{ color: c.accent, fontSize: 15 }}>{item.label} ›</Text></Pressable>)}
        {answer.status === 'answered' && <Text style={{ color: c.muted, fontSize: 13 }}>You can follow up with “And how many journeys was that?” or “What about last week?”</Text>}
      </View>}
      <View style={{ gap: 8 }}><Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>TRY ASKING</Text>
        {ASK_EXAMPLES.map(example => <Pressable key={example} accessibilityRole="button" disabled={busy} onPress={() => { question.value = example; }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: c.accent, fontSize: 15 }}>{example}</Text>
        </Pressable>)}
      </View>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Apple Intelligence interprets supported English questions about journeys, music, Memories, markers, and recorded arrivals. JourneyDeck calculates each answer from your local history. Notes and photo contents are not searchable. Simple questions also work without Apple Intelligence. Questions are not saved. Siri follows your Apple settings; say “Ask JourneyDeck V3.” Your device must be unlocked.</Text>
      {canShowSiriTesting && <Pressable accessibilityRole="button" onPress={() => router.push('/siri-testing')} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ color: c.accent, fontSize: 16 }}>Open Siri AI testing ›</Text>
      </Pressable>}
    </>}
  </ScrollView>;
}
