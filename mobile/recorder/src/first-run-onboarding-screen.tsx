import { useAppTheme } from './app-theme';
import { useEffect, useState } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMotionPreferences } from './motion';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FirstRunStage } from './first-run-onboarding';
import type { RecordingMode } from './recording-mode';
import { FirstRunWelcomeScreen, FIRST_RUN_ARTWORK } from './first-run-welcome-screen';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';

const APPLE_MUSIC_ICON = require('../assets/apple-music-icon.png');

const TOTAL_STEPS = TESSIE_INTEGRATION_ENABLED ? 7 : 6;
const STEP_NUMBER: Partial<Record<FirstRunStage, number>> = {
  recording: 2, location: 3, music: 4, membership: 5, tessie: 6, instructions: TOTAL_STEPS,
};

function alpha(hex: string, opacity: number) {
  const value = Math.max(0, Math.min(255, Math.round(opacity * 255))).toString(16).padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${value}` : hex;
}

type Props = {
  stage: Exclude<FirstRunStage, 'complete'>;
  onWelcomeComplete: () => void;
  onRecordingContinue: (mode: RecordingMode) => Promise<void>;
  onLocationContinue: () => Promise<void>;
  onConnectAppleMusic: () => Promise<void>;
  onSkipMusic: () => void;
  onOpenTessie: () => void;
  onTessieContinue: () => void;
  onFinish: () => void;
  onBack?: () => void;
};

function OnboardingHeader({ step, onBack, onSkip }: { step: number; onBack?: () => void; onSkip?: () => void }) {
  const theme = useAppTheme();
  const { palette } = theme;
  return <View style={recordingStyles.headerRow}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} disabled={!onBack} onPress={onBack}
      style={[recordingStyles.backButton, { backgroundColor: alpha(palette.card, 0.55), borderColor: alpha(palette.line, 0.6) }, !onBack && recordingStyles.headerControlHidden]}>
      <SymbolView name="chevron.left" tintColor={palette.text} size={16} weight="semibold" />
    </Pressable>
    <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${TOTAL_STEPS}`} accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step }} style={recordingStyles.dots}>
      {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map(dot => <View key={dot} style={[recordingStyles.dot,
        dot === step && [recordingStyles.dotActive, { backgroundColor: palette.accent }],
        dot < step && { backgroundColor: alpha(palette.text, 0.55) },
        dot > step && { backgroundColor: alpha(palette.text, 0.24) },
      ]} />)}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Skip" hitSlop={10} disabled={!onSkip} onPress={onSkip} style={!onSkip && recordingStyles.headerControlHidden}>
      <Text style={[recordingStyles.skipText, { color: palette.muted }]}>Skip</Text>
    </Pressable>
  </View>;
}

function StepIcon({ name }: { name: SFSymbol }) {
  const theme = useAppTheme();
  const { palette } = theme;
  return <View style={[recordingStyles.stepIcon, { backgroundColor: alpha(palette.accent, 0.16), borderColor: alpha(palette.accent, 0.32) }]}>
    <SymbolView name={name} tintColor={palette.accent} size={26} />
  </View>;
}

function RecordingScreen({ onBack, onContinue }: { onBack?: () => void; onContinue: (mode: RecordingMode) => Promise<void> }) {
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
        <OnboardingHeader step={STEP_NUMBER.recording!} onBack={onBack} />
        <View style={recordingStyles.scenerySpace} />
        <StepIcon name="record.circle" />
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

function AppleMusicScreen({ onBack, onConnect, onSkip }: { onBack?: () => void; onConnect: () => Promise<void>; onSkip: () => void }) {
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
        <OnboardingHeader step={STEP_NUMBER.music!} onBack={onBack} onSkip={onSkip} />
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

function LocationScreen({ onBack, onContinue }: { onBack?: () => void; onContinue: () => Promise<void> }) {
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
        <OnboardingHeader step={STEP_NUMBER.location!} onBack={onBack} />
        <View style={recordingStyles.scenerySpace} />
        <StepIcon name="location.fill" />
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

function MembershipStageBackdrop() {
  const theme = useAppTheme();
  return <View style={[recordingStyles.screen, { backgroundColor: theme.palette.page }]} />;
}

function TessieIntroScreen({ onBack, onOpenTessie, onContinue }: { onBack?: () => void; onOpenTessie: () => void; onContinue: () => void }) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  return <View style={recordingStyles.screen}><View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
    <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} showsVerticalScrollIndicator={false}>
      <OnboardingHeader step={STEP_NUMBER.tessie!} onBack={onBack} onSkip={onContinue} />
      <View style={recordingStyles.scenerySpace} /><StepIcon name="car.side.fill" />
      <Text accessibilityRole="header" style={[recordingStyles.title, { color: palette.text }]}>Bring your Tesla along.</Text>
      <Text style={[recordingStyles.musicDescription, { color: palette.muted }]}>Connect Tessie to explore vehicle status, charging, drives, and efficiency. This is optional and you can connect later in Settings.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Set up Tessie" onPress={onOpenTessie} style={[recordingStyles.button, { backgroundColor: palette.accent }]}><Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>Set up Tessie</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Continue without Tessie" onPress={onContinue} style={{ padding: 18, alignItems: 'center' }}><Text style={{ color: palette.muted, fontSize: 16 }}>Continue</Text></Pressable>
    </ScrollView>
  </View></View>;
}

function FinishScreen({ onBack, onFinish }: { onBack?: () => void; onFinish: () => void }) {
  const theme = useAppTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();

  return <View style={recordingStyles.screen}>
    <View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} showsVerticalScrollIndicator={false}>
        <OnboardingHeader step={STEP_NUMBER.instructions!} onBack={onBack} />
        <View style={recordingStyles.scenerySpace} />
        <StepIcon name="flag.checkered" />
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
      {visibleStage === 'recording' && <RecordingScreen onBack={props.onBack} onContinue={props.onRecordingContinue} />}
      {visibleStage === 'location' && <LocationScreen onBack={props.onBack} onContinue={props.onLocationContinue} />}
      {visibleStage === 'music' && <AppleMusicScreen onBack={props.onBack} onConnect={props.onConnectAppleMusic} onSkip={props.onSkipMusic} />}
      {visibleStage === 'membership' && <MembershipStageBackdrop />}
      {visibleStage === 'tessie' && <TessieIntroScreen onBack={props.onBack} onOpenTessie={props.onOpenTessie} onContinue={props.onTessieContinue} />}
      {visibleStage === 'instructions' && <FinishScreen onBack={props.onBack} onFinish={props.onFinish} />}
    </Animated.View>
  </View>;
}

const recordingStyles = StyleSheet.create({
  screen: { flex: 1 },
  safeFrame: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 12 },
  headerRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerControlHidden: { opacity: 0 },
  backButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 16 },
  skipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  stepIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  scenerySpace: { flexGrow: 1, minHeight: 80 },
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
