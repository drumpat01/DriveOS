import { StyleSheet, View } from 'react-native';
import { useAppTheme } from './app-theme';
import { useJourneyDeckNavigation } from './native-navigation-context';

/**
 * V4 iPhone Settings, pushed from Today's profile button instead of occupying a tab.
 * The hub and every editor draw their own back button, so this route adds none.
 */
export function NativePreferencesScreen() {
  const theme = useAppTheme();
  const { tabs } = useJourneyDeckNavigation();
  return <View style={[styles.screen, { backgroundColor: theme.palette.page }]}>{tabs.settings}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
