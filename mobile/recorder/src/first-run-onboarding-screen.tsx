import { useAppTheme } from './app-theme';
import { useEffect, useState } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMotionPreferences } from './motion';
import { TESSIE_INTEGRATION_ENABLED, V3_LASTFM_ENABLED } from './release-features';
import { TessieConnectionCard } from './tessie-connection-card';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FirstRunStage } from './first-run-onboarding';
import type { RecordingMode } from './recording-mode';
import { FirstRunWelcomeScreen, FIRST_RUN_ARTWORK } from './first-run-welcome-screen';

const APPLE_MUSIC_ICON = require('../assets/apple-music-icon.png');
const SPOTIFY_ICON = require('../assets/spotify-icon-white.png');

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
  onConnectLastFm: (username: string) => Promise<void>;
  lastFmUsername: string;
  onSkipMusic: () => void;
  tessieProfileId: string;
  tessieMembershipTier: 'free' | 'paid';
  onTessieUpgrade: () => void;
  onTessieChanged: () => void;
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
          <Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>{saving ? 'Connectingâ€¦' : 'Connect Apple Music'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
}

function MusicPickerScreen({ onBack, onConnectAppleMusic, onConnectLastFm, lastFmUsername, onSkip }: {
  onBack?: () => void; onConnectAppleMusic: () => Promise<void>; onConnectLastFm: (username: string) => Promise<void>;
  lastFmUsername: string; onSkip: () => void;
}) {
  const theme = useAppTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<'apple-music' | 'lastfm'>('apple-music');
  const [username, setUsername] = useState(lastFmUsername);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const act = async () => {
    if (saving) return;
    if (selection === 'lastfm' && !/^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(username.trim())) {
      setError('Enter your Last.fm username: 2–15 characters, starting with a letter.');
      return;
    }
    setSaving(true);
    try {
      if (selection === 'lastfm') await onConnectLastFm(username.trim());
      else await onConnectAppleMusic();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your music choice. Try again.');
    } finally { setSaving(false); }
  };
  return <View style={recordingStyles.screen}>
    <View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} showsVerticalScrollIndicator={false}>
        <OnboardingHeader step={STEP_NUMBER.music!} onBack={onBack} onSkip={onSkip} />
        <View style={recordingStyles.musicScenerySpace} />
        <StepIcon name="music.note" />
        <Text accessibilityRole="header" style={[recordingStyles.title, recordingStyles.musicHeadline, { color: palette.text, textShadowColor: palette.page }]}>Bring your music along.</Text>
        <Text style={[recordingStyles.musicPickerDescription, { color: palette.muted }]}>Choose one way to add songs to your journeys. You can change it later.</Text>
        <View accessibilityRole="radiogroup" style={recordingStyles.musicOptions}>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: selection === 'apple-music' }} onPress={() => { setSelection('apple-music'); setError(''); }}
            style={[recordingStyles.musicOption, { backgroundColor: alpha(palette.card, 0.72), borderColor: selection === 'apple-music' ? palette.accent : alpha(palette.line, 0.75) }]}>
            <ExpoImage source={APPLE_MUSIC_ICON} contentFit="contain" accessible={false} style={recordingStyles.musicOptionIcon} />
            <View style={recordingStyles.musicOptionCopy}><Text style={[recordingStyles.musicOptionTitle, { color: palette.text }]}>Apple Music</Text><Text style={[recordingStyles.musicOptionDetail, { color: palette.muted }]}>Songs played on this device</Text></View>
            <SymbolView name={selection === 'apple-music' ? 'largecircle.fill.circle' : 'circle'} tintColor={selection === 'apple-music' ? palette.accent : palette.muted} size={22} />
          </Pressable>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: selection === 'lastfm' }} onPress={() => { setSelection('lastfm'); setError(''); }}
            style={[recordingStyles.musicOption, { backgroundColor: alpha(palette.card, 0.72), borderColor: selection === 'lastfm' ? palette.accent : alpha(palette.line, 0.75) }]}>
            <View style={[recordingStyles.musicOptionIcon, recordingStyles.spotifyIcon]}><ExpoImage source={SPOTIFY_ICON} contentFit="contain" accessible={false} style={recordingStyles.spotifyMark} /></View>
            <View style={recordingStyles.musicOptionCopy}><Text style={[recordingStyles.musicOptionTitle, { color: palette.text }]}>Spotify via Last.fm</Text><Text style={[recordingStyles.musicOptionDetail, { color: palette.muted }]}>Spotify listening history, after journeys</Text></View>
            <SymbolView name={selection === 'lastfm' ? 'largecircle.fill.circle' : 'circle'} tintColor={selection === 'lastfm' ? palette.accent : palette.muted} size={22} />
          </Pressable>
        </View>
        {selection === 'lastfm' && <View style={recordingStyles.lastFmSetup}>
          <Text style={[recordingStyles.lastFmInstructions, { color: palette.text }]}>Create a free Last.fm account, then connect Spotify to Last.fm. Enter your Last.fm username here once Spotify scrobbling is on.</Text>
          <View style={recordingStyles.lastFmLinks}>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.last.fm/join')}><Text style={[recordingStyles.lastFmLink, { color: palette.accent }]}>Create free account ↗</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.last.fm/about/trackmymusic')}><Text style={[recordingStyles.lastFmLink, { color: palette.accent }]}>Connect Spotify ↗</Text></Pressable>
          </View>
          <TextInput accessibilityLabel="Last.fm username" value={username} onChangeText={value => { setUsername(value); setError(''); }} autoCapitalize="none" autoCorrect={false} maxLength={15}
            placeholder="Last.fm username" placeholderTextColor={palette.muted} style={[recordingStyles.lastFmInput, { color: palette.text, borderColor: alpha(palette.line, 0.8), backgroundColor: alpha(palette.card, 0.8) }]} />
          <Text style={[recordingStyles.lastFmPrivacy, { color: palette.muted }]}>JourneyDeck uses your public Last.fm history to match songs to completed journeys. Spotify does not connect directly to JourneyDeck.</Text>
        </View>}
        {error ? <Text accessibilityRole="alert" style={recordingStyles.musicError}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving}
          onPress={() => void act()} style={({ pressed }) => [recordingStyles.button, recordingStyles.musicButton, { backgroundColor: palette.accent, opacity: pressed || saving ? 0.78 : 1 }]}>
          <Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>{saving ? 'Saving…' : selection === 'lastfm' ? 'Use Spotify history' : 'Connect Apple Music'}</Text>
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

function TessieIntroScreen({ profileId, membershipTier, onUpgrade, onChanged, onContinue, onBack }: {
  profileId: string; membershipTier: 'free' | 'paid'; onUpgrade: () => void; onChanged: () => void; onContinue: () => void; onBack?: () => void;
}) {
  const theme = useAppTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();
  return <View style={recordingStyles.screen}>
    <View style={[recordingStyles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView style={recordingStyles.scroll} contentContainerStyle={recordingStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <OnboardingHeader step={STEP_NUMBER.tessie!} onBack={onBack} onSkip={onContinue} />
        <Text accessibilityRole="header" style={[recordingStyles.title, { color: palette.text }]}>Bring your car along.</Text>
        <Text style={[recordingStyles.musicDescription, { color: palette.muted }]}>Connect Tessie to add Tesla drives, charging, and vehicle insights. You can set this up later in Settings.</Text>
        <TessieConnectionCard profileId={profileId} membershipTier={membershipTier} onUpgrade={onUpgrade} onChanged={onChanged} />
        <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={onContinue}
          style={({ pressed }) => [recordingStyles.button, { backgroundColor: palette.accent, opacity: pressed ? 0.78 : 1 }]}>
          <Text style={[recordingStyles.buttonLabel, { color: palette.onAccent }]}>Continue</Text>
        </Pressable>
      </ScrollView>
    </View>
  </View>;
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
      {visibleStage === 'music' && (V3_LASTFM_ENABLED
        ? <MusicPickerScreen onBack={props.onBack} onConnectAppleMusic={props.onConnectAppleMusic} onConnectLastFm={props.onConnectLastFm} lastFmUsername={props.lastFmUsername} onSkip={props.onSkipMusic} />
        : <AppleMusicScreen onBack={props.onBack} onConnect={props.onConnectAppleMusic} onSkip={props.onSkipMusic} />)}
      {visibleStage === 'membership' && <MembershipStageBackdrop />}
      {visibleStage === 'tessie' && <TessieIntroScreen profileId={props.tessieProfileId} membershipTier={props.tessieMembershipTier} onUpgrade={props.onTessieUpgrade} onChanged={props.onTessieChanged} onContinue={props.onTessieContinue} onBack={props.onBack} />}
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
  musicScenerySpace: { flexGrow: 1, minHeight: 20 },
  musicPickerDescription: { fontSize: 16, lineHeight: 24, marginBottom: 22 },
  musicOptions: { gap: 10 },
  musicOption: { minHeight: 74, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  musicOptionIcon: { width: 40, height: 40, borderRadius: 9 },
  spotifyIcon: { backgroundColor: '#08080a', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  spotifyMark: { width: 24, height: 24 },
  musicOptionCopy: { flex: 1, minWidth: 0 },
  musicOptionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  musicOptionDetail: { fontSize: 13, lineHeight: 18 },
  lastFmSetup: { marginTop: 18, gap: 12 },
  lastFmInstructions: { fontSize: 14, lineHeight: 21 },
  lastFmLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 10 },
  lastFmLink: { fontSize: 14, lineHeight: 22, fontWeight: '700' },
  lastFmInput: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  lastFmPrivacy: { fontSize: 12, lineHeight: 18 },
  musicError: { color: '#ff9b91', fontSize: 13, lineHeight: 19, marginTop: 12 },
  musicButton: { marginTop: 24 },
});
