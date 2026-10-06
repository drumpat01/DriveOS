import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useSegments } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { tabPaths, useJourneyDeckNavigation, type JourneyDeckTab } from './native-navigation-context';

// Pushed screens sit above the tab layout, so UIKit's tab bar is not drawn on them. On Duo's
// vertical-bar poses the system still reserves that column (a trailing inset), so draw the
// same five destinations there. Other devices report no side inset and render nothing.
const COVERED_ROUTES = new Set(['journey', 'memory', 'year-on-road', 'atlas', 'tools', 'preferences', 'roads-so-far', 'fifty-states']);
const ITEMS: { tab: JourneyDeckTab; label: string; symbol: SFSymbol }[] = [
  { tab: 'home', label: 'Today', symbol: 'sun.horizon.fill' },
  { tab: 'journeys', label: 'Memories', symbol: 'photo.stack' },
  { tab: 'music', label: 'Soundtrack', symbol: 'music.note' },
  { tab: 'statistics', label: 'Atlas', symbol: 'map' },
  { tab: 'search', label: 'Search', symbol: 'magnifyingglass' },
];

export function DuoSideTabs() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const theme = useAppTheme();
  const { redesign } = useJourneyDeckNavigation();
  const first = String(segments[0] ?? '');
  if (!redesign || insets.right < 40 || !COVERED_ROUTES.has(first)) return null;
  const tint = theme.isCustom ? theme.palette.text : theme.isLight ? '#59316d' : '#eee4f6';
  return <View pointerEvents="box-none" style={[styles.column, { width: insets.right }]}>
    <View style={[styles.pill, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }]}>
      {ITEMS.map(item => <Pressable key={item.tab} accessibilityRole="button" accessibilityLabel={item.label}
        onPress={() => router.dismissTo(tabPaths[item.tab])}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}>
        <SymbolView name={item.symbol} tintColor={tint} size={24} weight="medium" />
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  // UIKit's bar sits at the bottom of the reserved column, just above the home indicator.
  column: { position: 'absolute', right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 19, zIndex: 50 },
  pill: { width: 56, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 4, alignItems: 'center' },
  item: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
