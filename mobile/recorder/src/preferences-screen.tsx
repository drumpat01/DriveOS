import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useAppTheme } from './app-theme';
import { useJourneyDeckNavigation } from './native-navigation-context';

/** V4 iPhone Settings, pushed from Today's profile button instead of occupying a tab. */
export function NativePreferencesScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { tabs } = useJourneyDeckNavigation();
  return <View style={[styles.screen, { backgroundColor: theme.palette.page }]}>
    {tabs.settings}
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}
      style={({ pressed }) => [styles.back, { top: insets.top + 6, backgroundColor: theme.palette.card, borderColor: theme.palette.line, opacity: pressed ? 0.65 : 1 }]}>
      <SymbolView name="chevron.left" tintColor={theme.palette.text} size={18} weight="semibold" />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
