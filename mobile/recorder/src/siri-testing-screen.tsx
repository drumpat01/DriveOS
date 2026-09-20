import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { Button, Column, Host } from '@expo/ui';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from './app-theme';
import { canShowSiriTesting, siriTesting, type SiriAIStatus, type SiriTestCase, type SiriTestResult } from './siri-testing';

export function SiriTestingScreen() {
  const theme = useAppTheme(), c = theme.palette;
  const [status, setStatus] = useState<SiriAIStatus | null>(null), [cases, setCases] = useState<SiriTestCase[]>([]);
  const [results, setResults] = useState<SiriTestResult[]>([]), [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(''), [error, setError] = useState('');
  const generation = useRef(0), active = useRef(false);
  const stop = useCallback((clear = false) => {
    generation.current++; active.current = false; setRunning(false);
    void siriTesting.cancel().catch(() => {});
    setProgress(clear ? '' : 'Stopped. Completed results are shown below.');
    if (clear) { setResults([]); setError(''); }
  }, []);
  useFocusEffect(useCallback(() => {
    const id = ++generation.current;
    void Promise.all([siriTesting.status(), siriTesting.cases()]).then(([next, list]) => {
      if (id === generation.current) { setStatus(next); setCases(list); }
    }).catch(() => { if (id === generation.current) setError('Native test status could not be read.'); });
    return () => stop(true);
  }, [stop]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') stop(true); });
    return () => listener.remove();
  }, [stop]);
  const run = async (full: boolean) => {
    if (active.current || AppState.currentState !== 'active') return;
    const selected = full ? cases : cases.filter((_, index) => index % 8 === 0);
    const id = ++generation.current; active.current = true; setRunning(true); setResults([]); setError('');
    try {
      for (let i = 0; i < selected.length; i++) {
        if (generation.current !== id) return;
        setProgress(`${i + 1} of ${selected.length} · ${selected[i].question}`);
        const next = await siriTesting.run(selected[i].id);
        if (generation.current !== id || AppState.currentState !== 'active') return;
        setResults(previous => [...previous, next]);
        if (next.status === 'unavailable' || next.status === 'cancelled') { setProgress(next.detail); return; }
      }
      if (generation.current === id) setProgress('Finished. Review the failures and timings below.');
    } catch { if (generation.current === id) setError('The native evaluation stopped unexpectedly. Try again.'); }
    finally { if (generation.current === id) { active.current = false; setRunning(false); } }
  };
  const enabled = status?.testing && status.model === 'available' && cases.length > 0;
  const timed = results.flatMap(r => r.elapsedMs === undefined ? [] : [r.elapsedMs]);
  const mean = timed.length ? (timed.reduce((sum, n) => sum + n, 0) / timed.length / 1000).toFixed(1) : null;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: c.page }} contentContainerStyle={{ padding: 24, paddingBottom: 48, gap: 20 }}>
    {!canShowSiriTesting ? <Text style={{ color: c.text }}>Siri testing is available in internal JourneyDeck V3 builds.</Text> : <>
      <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>Siri AI testing</Text>
      <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24 }}>Test the on-device question planner against 100 synthetic questions. These tests use invented journeys, music, Memories, and markers. Your saved archive is never changed.</Text>
      <View style={{ padding: 18, gap: 10, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18 }}>
        <Text selectable style={{ color: c.text, fontWeight: '600' }}>Apple Intelligence: {status?.model ?? 'Checking…'}</Text>
        {status && <Text style={{ color: c.muted }}>Planner revision: {status.plannerRevision ?? 1}</Text>}
        <Text style={{ color: c.muted }}>Each test checks interpretation and calculated facts separately. First-use and warm timings are shown per question. Keep the app open during the run.</Text>
        {status?.model === 'newNativeBuildRequired' && <Text style={{ color: c.accent }}>Install the new signed V3 build to use this screen.</Text>}
      </View>
      <Host matchContents colorScheme={theme.isLight ? 'light' : 'dark'} seedColor={c.accent}>
        <Column spacing={12}>
          <Button testID="siri-smoke" label="Run 13-question sample" disabled={!enabled || running} onPress={() => void run(false)} />
          <Button testID="siri-full" label="Run all 100 questions" disabled={!enabled || running} onPress={() => void run(true)} />
          <Button testID="siri-cancel" label="Stop testing" disabled={!running} onPress={() => stop()} />
        </Column>
      </Host>
      {!!progress && <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>{progress}</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>}
      {!!results.length && <Text style={{ color: c.accent, fontWeight: '700' }}>{results.filter(r => r.status === 'passed').length} passed · {results.filter(r => r.status === 'failed').length} failed · {results.filter(r => ['unavailable', 'cancelled'].includes(r.status)).length} not completed{mean ? ` · ${mean}s average` : ''}</Text>}
      {results.map((result, index) => <View key={index} style={{ gap: 8, padding: 16, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 16 }}>
        <Text selectable style={{ color: c.accent, fontWeight: '600' }}>{index + 1}. {result.status.toUpperCase()}{result.elapsedMs !== undefined ? ` · ${(result.elapsedMs / 1000).toFixed(1)}s` : ''}</Text>
        <Text selectable style={{ color: c.text }}>{result.question}</Text>
        <Text selectable style={{ color: c.muted }}>{result.detail}</Text>
        {result.answer && <Text selectable style={{ color: c.text }}>{result.answer}</Text>}
        {result.status === 'failed' && (result.proposedPlan || result.plan) && <Text selectable style={{ color: c.muted, fontSize: 12 }}>Generated query: {JSON.stringify(result.proposedPlan ?? result.plan)}</Text>}
        {result.status === 'failed' && result.normalizedPlan && <Text selectable style={{ color: c.muted, fontSize: 12 }}>Validated query: {JSON.stringify(result.normalizedPlan)}</Text>}
        {result.status === 'failed' && result.expectedPlan && <Text selectable style={{ color: c.muted, fontSize: 12 }}>Expected query: {JSON.stringify(result.expectedPlan)}</Text>}
      </View>)}
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>This checks the same planner and executor used by Ask JourneyDeck. Siri invocation, spoken replies, microphone behavior, and lock-screen access require separate phone tests. Results clear when you leave or background this screen.</Text>
    </>}
  </ScrollView>;
}
