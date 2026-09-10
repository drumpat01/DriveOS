import { isIpad } from './device-layout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppTheme } from './app-theme';
import { useCardDetailDismissal } from './card-detail-link';
import { DetailViewportProvider } from './detail-screen-frame';
import { useJourneyDeckNavigation, type JourneyDeckTab } from './native-navigation-context';
import { MemoryFlipImageContext, MemoryFlipProvider, useMemoryFlip } from './memory-flip';

export function JourneyDeckNativeStack() {
  return <DetailViewportProvider><MemoryFlipProvider><JourneyDeckStackContent /></MemoryFlipProvider></DetailViewportProvider>;
}

function JourneyDeckStackContent() {
  const theme = useAppTheme();
  const flip = useMemoryFlip();
  const navigationTheme = useMemo(() => {
    const base = theme.isLight ? DefaultTheme : DarkTheme;
    return { ...base, colors: { ...base.colors, background: theme.palette.page, card: theme.palette.page, text: theme.palette.text, primary: theme.isCustom ? theme.palette.accent : theme.isLight ? '#ad492e' : '#ff9470' } };
  }, [theme.id]);
  return <ThemeProvider value={navigationTheme}><Stack screenOptions={{ headerStyle: { backgroundColor: navigationTheme.colors.card }, headerTintColor: navigationTheme.colors.text, contentStyle: { backgroundColor: navigationTheme.colors.background }, statusBarStyle: theme.isLight ? 'dark' : 'light', headerShadowVisible: false, gestureEnabled: true, freezeOnBlur: false }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    {/* Native navigation bars can resize zoom destinations after the transition.
        Detail frames own the header and window safe area from first render. */}
    <Stack.Screen name="journey/[id]" options={{ title: 'Journey', headerShown: false }} />
    <Stack.Screen name="journey-editor/[id]" options={{ title: 'Journey Studio', headerShown: false, gestureEnabled: false }} />
    <Stack.Screen name="memory-photos/[id]" options={{ title: 'Find matching photos', headerShown: false, gestureEnabled: false }} />
    <Stack.Screen name="year-on-road" options={{ title: 'Your Year on the Road', headerShown: false }} />
    <Stack.Screen name="memory/[id]" options={{ title: 'Memory', headerShown: false, animation: flip?.activeToken ? 'none' : 'default' }} />
    <Stack.Screen name="atlas" options={{ headerShown: false }} />
    <Stack.Screen name="tools" options={{ headerShown: false }} />
  </Stack></ThemeProvider>;
}
export function JourneyDeckNativeTabs() {
  const theme = useAppTheme();
  const { tabBarHidden } = useJourneyDeckNavigation();
  const tablet = isIpad();
  // Use native layout measurements, not global dimensions sampled during rotation.
  const { width, height } = useSafeAreaFrame();
  const statisticsLabel = tablet && height > width ? 'Stats' : 'Statistics';
  const neutral = theme.palette.muted;
  const inactive = theme.isCustom ? neutral : tablet ? neutral : theme.isLight ? '#756775' : '#b6a6c1';
  // UIKit's sidebar inherits the host tint, including unselected SF Symbols.
  // Reserve orange for Home rather than applying it to the whole iPad host.
  const selected = theme.isCustom ? theme.palette.accent : tablet ? neutral : theme.isLight ? '#ad492e' : '#ff9470';
  const homeLabelStyle = theme.isCustom ? { color: selected } : tablet ? { color: '#ff8956' } : undefined;
  const homeTrigger = <NativeTabs.Trigger name="index" disablePopToTop disableScrollToTop disableAutomaticContentInsets>{theme.isCustom ? <NativeTabs.Trigger.Icon sf="house.fill" /> : <NativeTabs.Trigger.Icon src={require('../assets/home-tab-orange.png')} renderingMode="original" />}<NativeTabs.Trigger.Label selectedStyle={homeLabelStyle}>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>;
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
  const { id, memoryFlip: token } = useLocalSearchParams<{ id: string; memoryFlip?: string }>();
  const flip = useMemoryFlip();
  const [laidOut, setLaidOut] = useState(false);
  const [readyId, setReadyId] = useState<string | null>(null);
  const imageReady = useCallback(() => setReadyId(id), [id]);
  useEffect(() => {
    if (laidOut && readyId === id && token) flip?.destinationReady(token);
  }, [laidOut, readyId, id, token, flip?.destinationReady]);
  return <View style={{ flex: 1 }} onLayout={() => setLaidOut(true)}>
    <MemoryFlipImageContext.Provider value={Boolean(token && flip?.activeToken === token)}>
      {useJourneyDeckNavigation().memory(id, imageReady)}
    </MemoryFlipImageContext.Provider>
  </View>;
}
export function NativeAtlasScreen() {
  return useJourneyDeckNavigation().atlas;
}
export function NativeToolsScreen() {
  return useJourneyDeckNavigation().tools;
}
