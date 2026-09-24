import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View, useColorScheme,
} from 'react-native';

import {
  databaseStartupIssue, prepareJourneyDeckDatabase, retryJourneyDeckDatabase, type DatabaseStartupIssue,
} from './database-startup';
import { observeJourneyDeckEventOnce } from './observability';

export function DatabaseStartupGate({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const light = colorScheme === 'light';
  const [issue, setIssue] = useState<DatabaseStartupIssue | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setIssue(null);
    const task = attempt === 0 ? prepareJourneyDeckDatabase() : retryJourneyDeckDatabase();
    void task.then(() => {
      if (active) setReady(true);
    }).catch(error => {
      if (active) {
        const startupIssue = databaseStartupIssue(error);
        setIssue(startupIssue);
        if (startupIssue.schemaDiagnostic) {
          const { source, found, supported } = startupIssue.schemaDiagnostic;
          observeJourneyDeckEventOnce('database.startup_schema_blocked', `${source}:${found}:${supported}`, { source, found, supported });
        }
      }
    });
    return () => { active = false; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);
  if (ready) return children;

  return (
    <SafeAreaView style={[styles.safeArea, light && styles.safeAreaLight]}>
      <View style={styles.content} accessibilityLiveRegion="polite">
        <View style={[styles.mark, light && styles.markLight]}><Text style={[styles.markText, light && styles.markTextLight]}>JD</Text></View>
        {issue ? (
          <>
            <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>{issue.code}</Text>
            <Text style={[styles.title, light && styles.titleLight]}>{issue.title}</Text>
            <Text style={[styles.detail, light && styles.detailLight]}>{issue.detail}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={light ? '#7d4d91' : '#e6c562'} size="large" />
            <Text style={[styles.title, light && styles.titleLight]}>Preparing your journeys</Text>
            <Text style={[styles.detail, light && styles.detailLight]}>Checking the private archive on this device before JourneyDeck starts.</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#07162a' },
  safeAreaLight: { backgroundColor: '#fff9ef' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 36 },
  mark: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3e68', borderWidth: 1, borderColor: '#e6c562' },
  markLight: { backgroundColor: '#f5e8d7', borderColor: '#7d4d91' },
  markText: { color: '#fff8e5', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  markTextLight: { color: '#2e1c32' },
  eyebrow: { color: '#e6c562', fontSize: 11, fontWeight: '900', letterSpacing: 2.2, marginTop: 8 },
  eyebrowLight: { color: '#7d4d91' },
  title: { color: '#fff8e5', fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center' },
  titleLight: { color: '#2e1c32' },
  detail: { maxWidth: 480, color: '#b9c7d9', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  detailLight: { color: '#68596c' },
  button: { minWidth: 180, minHeight: 54, marginTop: 8, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#e6c562' },
  buttonPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  buttonText: { color: '#07162a', fontSize: 16, fontWeight: '800' },
});
