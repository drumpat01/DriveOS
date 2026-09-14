import { useAppTheme } from './app-theme';
import { useEffect, useState } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMotionPreferences } from './motion';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FirstRunStage } from './first-run-onboarding';
import type { RecordingMode } from './recording-mode';
import { FirstRunWelcomeScreen, FIRST_RUN_ARTWORK } from './first-run-welcome-screen';

const APPLE_MUSIC_ICON = require('../assets/apple-music-icon.png');

type Props = {
  stage: Exclude<FirstRunStage, 'complete'>;
  onWelcomeComplete: () => void;
  onRecordingContinue: (mode: RecordingMode) => Promise<void>;
  onLocationContinue: () => Promise<void>;
  onConnectAppleMusic: () => Promise<void>;
  onFinish: () => void;
};

function RecordingScreen({ onContinue }: { onContinue: (mode: RecordingMode) => Promise<void> }) {
  const theme = useAppTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const proceed = async () => {
    if (saving) return;
    setSaving(true);
    try { await onContinue('manual'); } finally { setSaving(false); }
  };
  return <View style={recordingStyles.screen}>
    <View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} showsVerticalScrollIndicator={false}>
        <View style={recordingStyles.header}>
          <Text accessibilityLabel="Step 2 of 5" style={[recordingStyles.progress, { color: palette.text }]}>02 / 05</Text>
        </View>
        <View style={recordingStyles.scenerySpace} />
        <Text accessibilityRole="header" style={[recordingStyles.title, { color: palette.text, textShadowColor: palette.page }]}>You decide when the journey begins.</Text>
        <Text style={[recordingStyles.body, { color: palette.text }]}>Tap <Text style={recordingStyles.emphasis}>Start</Text> before you set off. JourneyDeck saves your route as you go. Tap <Text style={recordingStyles.emphasis}>Finish</Text> when you arrive.</Text>
        <Text style={[recordingStyles.safeguard, { color: palette.text }]}>As a safeguard, GPS recording stops after 10 minutes of detected inactivity.</Text>
        <Text style={[recordingStyles.note, { color: palette.muted }]}>Your journeys stay private. Use the controls only when safely stopped.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving}
          onPress={() => void proceed()} style={({ pressed }) => [recordingStyles.button, { backgroundColor: palette.accent, opacity: pressed || saving ? 0.78 : 1 }]}>
          <Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>{saving ? 'Continuing…' : 'Continue'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}

function AppleMusicScreen({ onConnect }: { onConnect: () => Promise<void> }) {
  const theme = useAppTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const act = async (action: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try { await action(); } finally { setSaving(false); }
  };
  return <View style={recordingStyles.screen}>
    <View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} showsVerticalScrollIndicator={false}>
        <View style={recordingStyles.header}>
          <Text accessibilityLabel="Step 4 of 5" style={[recordingStyles.progress, { color: palette.text }]}>04 / 05</Text>
        </View>
        <View style={recordingStyles.scenerySpace} />
        <ExpoImage source={APPLE_MUSIC_ICON} contentFit="contain" accessible={false} style={recordingStyles.musicMark} />
        <Text accessibilityRole="header" style={[recordingStyles.title, recordingStyles.musicHeadline, { color: palette.text, textShadowColor: palette.page }]}>Bring your music along.</Text>
        <Text style={[recordingStyles.musicDescription, { color: palette.muted }]}>Play Apple Music on this device to save songs with your journeys.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Connect Apple Music" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving}
          onPress={() => void act(onConnect)} style={({ pressed }) => [recordingStyles.button, { backgroundColor: palette.accent, opacity: pressed || saving ? 0.78 : 1 }]}>
          <Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>{saving ? 'Connecting…' : 'Connect Apple Music'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}

function LocationScreen({ onContinue }: { onContinue: () => Promise<void> }) {
  const theme = useAppTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const act = async (action: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try { await action(); } finally { setSaving(false); }
  };
  return <View style={recordingStyles.screen}>
    <View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} showsVerticalScrollIndicator={false}>
        <View style={recordingStyles.header}>
          <Text accessibilityLabel="Step 3 of 5" style={[recordingStyles.progress, { color: palette.text }]}>03 / 05</Text>
        </View>
        <View style={recordingStyles.scenerySpace} />
        <Text accessibilityRole="header" style={[recordingStyles.title, recordingStyles.musicHeadline, { color: palette.text, textShadowColor: palette.page }]}>Keep your route connected.</Text>
        <Text style={[recordingStyles.musicDescription, { color: palette.muted }]}>Allow Always location access to save your route with your screen locked or another app open.</Text>
        <Text style={[recordingStyles.musicDescription, { color: palette.muted }]}>You control recording with Start and Finish.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving}
          onPress={() => void act(onContinue)} style={({ pressed }) => [recordingStyles.button, { backgroundColor: palette.accent, opacity: pressed || saving ? 0.78 : 1 }]}>
          <Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>{saving ? 'Connecting…' : 'Continue'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}

function FinishScreen({ onFinish }: { onFinish: () => void }) {
  const theme = useAppTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();

  return <View style={recordingStyles.screen}>
    <View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} showsVerticalScrollIndicator={false}>
        <View style={recordingStyles.header}>
          <Text accessibilityLabel="Step 5 of 5" style={[recordingStyles.progress, { color: palette.text }]}>05 / 05</Text>
        </View>
        <View style={recordingStyles.scenerySpace} />
        <Text accessibilityRole="header" style={[recordingStyles.title, recordingStyles.musicHeadline, { color: palette.text, textShadowColor: palette.page }]}>The road is yours.</Text>
        <Text style={[recordingStyles.musicDescription, { color: palette.muted }]}>Tap Start on Home before you set off. Tap Finish when you arrive.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Let the Journey Begin" onPress={onFinish}
          style={({ pressed }) => [recordingStyles.button, { backgroundColor: palette.accent, opacity: pressed ? 0.78 : 1 }]}>
          <Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>Let the Journey Begin</Text>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}

export function FirstRunOnboardingScreen(props: Props) {
  const theme = useAppTheme();
  const { palette } = theme;
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const { width } = useWindowDimensions();
  const [visibleStage, setVisibleStage] = useState(props.stage);
  const [transitioning, setTransitioning] = useState(false);
  const offset = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  useEffect(() => {
    if (props.stage === visibleStage) return;
    if (reduceMotion || !isAppActive) {
      cancelAnimation(offset);
      offset.set(0);
      setVisibleStage(props.stage);
      setTransitioning(false);
      return;
    }
    setTransitioning(true);
    const next = props.stage;
    offset.set(withTiming(-width, { duration: 220, easing: Easing.bezier(0.23, 1, 0.32, 1) }, finished => {
      if (finished) scheduleOnRN(setVisibleStage, next);
    }));
    return () => cancelAnimation(offset);
  }, [props.stage, visibleStage, reduceMotion, isAppActive, width, offset]);

  useEffect(() => {
    if (!transitioning || props.stage !== visibleStage) return;
    if (reduceMotion || !isAppActive) {
      offset.set(0);
      setTransitioning(false);
      return;
    }
    offset.set(width);
    offset.set(withTiming(0, { duration: 260, easing: Easing.bezier(0.23, 1, 0.32, 1) }, finished => {
      if (finished) scheduleOnRN(setTransitioning, false);
    }));
    return () => cancelAnimation(offset);
  }, [visibleStage, props.stage, transitioning, reduceMotion, isAppActive, width, offset]);

  return <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.page, overflow: 'hidden' }]}>
    <ExpoImage source={FIRST_RUN_ARTWORK[theme.id]} contentFit="cover" accessible={false} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={theme.id === 'redline' ? [`${palette.page}00`, `${palette.page}08`, `${palette.page}99`, palette.page] : [`${palette.page}33`, `${palette.page}55`, `${palette.page}f5`, palette.page]}
      locations={theme.id === 'redline' ? [0, 0.48, 0.80, 1] : [0, 0.25, 0.65, 1]} style={StyleSheet.absoluteFill} />
    <Animated.View style={[recordingStyles.screen, contentStyle]} pointerEvents={transitioning || visibleStage !== props.stage ? 'none' : 'auto'}
      accessibilityElementsHidden={transitioning} importantForAccessibility={transitioning ? 'no-hide-descendants' : 'auto'}>
      {visibleStage === 'welcome' && <FirstRunWelcomeScreen onStart={props.onWelcomeComplete} contentOnly />}
      {visibleStage === 'recording' && <RecordingScreen onContinue={props.onRecordingContinue} />}
      {visibleStage === 'location' && <LocationScreen onContinue={props.onLocationContinue} />}
      {visibleStage === 'music' && <AppleMusicScreen onConnect={props.onConnectAppleMusic} />}
      {visibleStage === 'instructions' && <FinishScreen onFinish={props.onFinish} />}
    </Animated.View>
  </View>;
}

const recordingStyles = StyleSheet.create({
  screen: { flex: 1 },
  safeFrame: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 12 },
  header: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  progress: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 2 },
  scenerySpace: { flexGrow: 1, minHeight: 100 },
  title: { fontFamily: 'Georgia', fontSize: 34, lineHeight: 41, letterSpacing: -0.7, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  body: { fontSize: 17, lineHeight: 27, marginTop: 24 },
  safeguard: { fontSize: 16, lineHeight: 24, marginTop: 20 },
  emphasis: { fontWeight: '700' },
  note: { fontSize: 14, lineHeight: 22, marginTop: 24, marginBottom: 32 },
  button: { minHeight: 60, borderRadius: 18, paddingHorizontal: 24, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  musicMark: { width: 64, height: 64, borderRadius: 15, marginBottom: 24 },
  musicHeadline: { marginBottom: 16 },
  musicDescription: { fontSize: 16, lineHeight: 24, marginBottom: 32 },
});
