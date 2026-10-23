import { Component, Fragment, type ReactNode } from 'react';
import {
  Pressable, SafeAreaView, StyleSheet, Text, View, useColorScheme,
} from 'react-native';
import * as Updates from 'expo-updates';

/** Remount the tree after a render crash, or reload the JS runtime when Expo Updates can. */
export async function reloadAppRoot(remount: () => void, reload = () => Updates.reloadAsync()) {
  try {
    await reload();
  } catch {
    remount();
  }
}

export function AppErrorFallback({ onReload }: { onReload: () => void }) {
  const light = useColorScheme() === 'light';
  return (
    <SafeAreaView style={[styles.safeArea, light && styles.safeAreaLight]}>
      <View style={styles.content} accessibilityLiveRegion="polite">
        <View style={[styles.mark, light && styles.markLight]}><Text style={[styles.markText, light && styles.markTextLight]}>JD</Text></View>
        <Text style={[styles.title, light && styles.titleLight]}>Something unexpected happened</Text>
        <Text style={[styles.detail, light && styles.detailLight]}>Your journeys are still saved on this iPhone. Reload JourneyDeck to continue.</Text>
        <Pressable
          testID="app-error-reload"
          accessibilityRole="button"
          accessibilityLabel="Reload JourneyDeck"
          onPress={onReload}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type AppErrorBoundaryState = { hasError: boolean; generation: number };

/** Root render net: an uncaught child error shows an on-brand recovery screen instead of a white screen. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, generation: 0 };

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { hasError: true };
  }

  private remount = () => {
    this.setState(state => ({ hasError: false, generation: state.generation + 1 }));
  };

  private recover = () => reloadAppRoot(this.remount);

  render() {
    if (this.state.hasError) return <AppErrorFallback onReload={this.recover} />;
    return <Fragment key={this.state.generation}>{this.props.children}</Fragment>;
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#07162a' },
  safeAreaLight: { backgroundColor: '#fff9ef' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 36 },
  mark: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3e68', borderWidth: 1, borderColor: '#e6c562' },
  markLight: { backgroundColor: '#f5e8d7', borderColor: '#7d4d91' },
  markText: { color: '#fff8e5', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  markTextLight: { color: '#2e1c32' },
  title: { color: '#fff8e5', fontSize: 27, lineHeight: 33, fontWeight: '600', textAlign: 'center' },
  titleLight: { color: '#2e1c32' },
  detail: { maxWidth: 480, color: '#b9c7d9', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  detailLight: { color: '#68596c' },
  button: { minWidth: 180, minHeight: 54, marginTop: 8, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#e6c562' },
  buttonPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  buttonText: { color: '#07162a', fontSize: 16, fontWeight: '600' },
});
