import { isIpad } from './device-layout';
import { useCallback, useMemo } from 'react';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppTheme } from './app-theme';
import { useCardDetailDismissal } from './card-detail-link';
import { DetailViewportProvider } from './detail-screen-frame';
import { useJourneyDeckNavigation, type JourneyDeckTab } from './native-navigation-context';

export function JourneyDeckNativeStack() {
  const theme = useAppTheme();
  const navigationTheme = useMemo(() => {
    const base = theme.isLight ? DefaultTheme : DarkTheme;
    return { ...base, colors: { ...base.colors, background: theme.isLight ? '#fffaf0' : '#08070d', card: theme.isLight ? '#fffaf0' : '#08070d', text: theme.isLight ? '#59316d' : '#eee4f6', primary: theme.isLight ? '#ad492e' : '#ff9470' } };
  }, [theme.isLight]);
  return <DetailViewportProvider><ThemeProvider value={navigationTheme}><Stack screenOptions={{ headerStyle: { backgroundColor: navigationTheme.colors.card }, headerTintColor: navigationTheme.colors.text, contentStyle: { backgroundColor: navigationTheme.colors.background }, statusBarStyle: theme.isLight ? 'dark' : 'light', headerShadowVisible: false, gestureEnabled: true, freezeOnBlur: false }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    {/* Native navigation bars can resize zoom destinations after the transition.
        Detail frames own the header and window safe area from first render. */}
    <Stack.Screen name="journey/[id]" options={{ title: 'Journey', headerShown: false }} />
    <Stack.Screen name="memory/[id]" options={{ title: 'Memory', headerShown: false }} />
    <Stack.Screen name="atlas" options={{ headerShown: false }} />
    <Stack.Screen name="tools" options={{ headerShown: false }} />
  </Stack></ThemeProvider></DetailViewportProvider>;
}
export function JourneyDeckNativeTabs() {
  const theme = useAppTheme();
  const { tabBarHidden } = useJourneyDeckNavigation();
  const tablet = isIpad();
  // Use native layout measurements, not global dimensions sampled during rotation.
  const { width, height } = useSafeAreaFrame();
  const statisticsLabel = tablet && height > width ? 'Stats' : 'Statistics';
  const neutral = theme.isLight ? '#685461' : '#b6a6c1';
  const inactive = tablet ? neutral : theme.isLight ? '#756775' : '#b6a6c1';
  // UIKit's sidebar inherits the host tint, including unselected SF Symbols.
  // Reserve orange for Home rather than applying it to the whole iPad host.
  const selected = tablet ? neutral : theme.isLight ? '#ad492e' : '#ff9470';
  const homeLabelStyle = tablet ? { color: '#ff8956' } : undefined;
  const homeTrigger = <NativeTabs.Trigger name="index" disablePopToTop disableScrollToTop disableAutomaticContentInsets><NativeTabs.Trigger.Icon src={require('../assets/home-tab-orange.png')} renderingMode="original" /><NativeTabs.Trigger.Label selectedStyle={homeLabelStyle}>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>;
  return <NativeTabs sidebarAdaptable={isIpad() ? true : undefined} hidden={tabBarHidden} minimizeBehavior="never" disableTransparentOnScrollEdge tintColor={selected} iconColor={{ default: inactive, selected }} labelStyle={{ default: { color: inactive }, selected: { color: selected } }}>
    {isIpad() && homeTrigger}
    <NativeTabs.Trigger name="music" disablePopToTop disableScrollToTop disableAutomaticContentInsets><NativeTabs.Trigger.Icon sf="music.note" /><NativeTabs.Trigger.Label>Music</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="journeys" disablePopToTop disableScrollToTop disableAutomaticContentInsets><NativeTabs.Trigger.Icon sf="photo.on.rectangle" /><NativeTabs.Trigger.Label>Memories</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    {!isIpad() && homeTrigger}
    <NativeTabs.Trigger name="statistics" disablePopToTop disableScrollToTop disableAutomaticContentInsets><NativeTabs.Trigger.Icon sf="chart.xyaxis.line" /><NativeTabs.Trigger.Label>{statisticsLabel}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="settings" disablePopToTop disableScrollToTop disableAutomaticContentInsets><NativeTabs.Trigger.Icon sf="gearshape" /><NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
export function NativeTabScreen({ tab }: { tab: JourneyDeckTab }) {
  const { tabs, onTabFocus } = useJourneyDeckNavigation();
  useFocusEffect(useCallback(() => { onTabFocus(tab); }, [onTabFocus, tab]));
  return tabs[tab];
}
export function NativeMemoryScreen() {
  useCardDetailDismissal();
  const { id } = useLocalSearchParams<{ id: string }>();
  return useJourneyDeckNavigation().memory(id);
}
export function NativeAtlasScreen() {
  return useJourneyDeckNavigation().atlas;
}
export function NativeToolsScreen() {
  return useJourneyDeckNavigation().tools;
}
