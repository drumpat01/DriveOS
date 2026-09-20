import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { decideHiddenJourney, pendingHiddenJourneyChoice, type HiddenJourneyChoice } from './app-data';
import { useThemedStyles } from './app-theme';
import { getCurrentUser } from './auth';
import { subscribeLocalArchiveChanges } from './local-archive-events';
import type { JourneyVisibilityChoice } from './journey-visibility-preference';

/** A saved recording remains intact regardless of the presentation choice. */
export function HiddenJourneyNotice({ enabled, notice }: { enabled: boolean; notice: string }) {
  const styles = useThemedStyles(darkStyles);
  const userId = getCurrentUser().id;
  const [pending, setPending] = useState<HiddenJourneyChoice | null>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setResult('');
    setError('');
    const refresh = () => {
      if (!enabled || getCurrentUser().id !== userId) { setPending(null); return; }
      try { setPending(pendingHiddenJourneyChoice()); }
      catch { setPending(null); } // The archive may still be opening; retry on its next event.
    };
    refresh();
    const unsubscribe = subscribeLocalArchiveChanges(refresh);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { unsubscribe(); subscription.remove(); };
  }, [enabled, userId]);

  const choose = (choice: JourneyVisibilityChoice) => {
    if (!pending || pending.userId !== getCurrentUser().id) return;
    try {
      decideHiddenJourney(pending, choice);
      setPending(null);
      setError('');
      setResult(choice === 'show' ? 'Journey added to Memories.' : 'Journey kept hidden. Your recording is still saved.');
    } catch {
      setError('Your choice could not be saved. Please try again.');
    }
  };

  if (enabled && pending?.userId === userId) return <View style={styles.container} testID="hidden-journey-choice">
    <Text accessibilityLiveRegion="polite" style={styles.message}>
      Your journey is saved. It started and ended at {pending.anchor}, so it’s hidden from Memories. Show it anyway?
    </Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={() => choose('show')}
        style={({ pressed }) => [styles.button, styles.showButton, pressed && styles.pressed]}>
        <Text style={styles.showLabel}>Show in Memories</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => choose('hide')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.hideLabel}>Keep hidden</Text>
      </Pressable>
    </View>
    {!!error && <Text accessibilityLiveRegion="polite" style={styles.message}>{error}</Text>}
  </View>;

  const message = enabled && result ? result : notice;
  return message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null;
}

const darkStyles = StyleSheet.create({
  container: { gap: 8 },
  message: { color: '#b9afc7', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#62576f' },
  showButton: { backgroundColor: '#31223f', borderColor: '#9b7cff' },
  showLabel: { color: '#e4d8ff', fontSize: 13, fontWeight: '600' },
  hideLabel: { color: '#b9afc7', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
