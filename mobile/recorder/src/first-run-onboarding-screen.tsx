import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FirstRunStage } from './first-run-onboarding';
import type { RecordingMode } from './recording-mode';

const WELCOME_ANIMATION = require('../assets/onboarding-welcome-approved.webp');
const WELCOME_POSTER = require('../assets/onboarding-welcome-approved-poster.png');
const ROAD_BACKGROUND = require('../assets/onboarding-road-background.png');
const APP_ICON = require('../assets/icon.png');
const APPLE_MUSIC_ICON = require('../assets/apple-music-icon.png');

type Props = {
  stage: Exclude<FirstRunStage, 'complete'>;
  initialRecordingMode: RecordingMode;
  onWelcomeComplete: () => void;
  onRecordingContinue: (mode: RecordingMode) => Promise<void>;
  onConnectAppleMusic: () => Promise<void>;
  onSkipAppleMusic: () => Promise<void>;
  onFinish: () => void;
};

function WelcomeAnimation({ onComplete }: { onComplete: () => void }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!loaded) return undefined;
    const timer = setTimeout(() => {
      if (completed.current) return;
      completed.current = true;
      onCompleteRef.current();
    }, 2500);
    return () => clearTimeout(timer);
  }, [loaded]);

  return <View style={styles.fullScreen}><ExpoImage
    accessibilityLabel="Welcome to JourneyDeck. Your drive, remembered. Private, personal, yours."
    autoplay={!reduceMotion} contentFit="cover" onLoad={() => setLoaded(true)}
    source={reduceMotion ? WELCOME_POSTER : WELCOME_ANIMATION} style={StyleSheet.absoluteFill}
  /></View>;
}

function RoadBackdrop() {
  return <><ExpoImage source={ROAD_BACKGROUND} contentFit="cover" style={StyleSheet.absoluteFill} /><View style={styles.backdropShade} /></>;
}

function ProgressHeader({ step }: { step: '02 / 04' | '03 / 04' | '04 / 04' }) {
  return <View style={styles.progressHeader}>
    <View style={styles.brandLockup}><Image source={APP_ICON} resizeMode="contain" style={styles.brandIcon} /><Text style={styles.brandName}>JOURNEYDECK</Text></View>
    <Text style={styles.progressText}>{step}</Text>
  </View>;
}

function ScreenFrame({ children, bottom }: { children: ReactNode; bottom?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={styles.fullScreen}><RoadBackdrop /><View style={[styles.safeFrame, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 12) }]}>{children}{bottom}</View></View>;
}

function GradientAction({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionPressable, pressed && styles.pressed]}>
    <LinearGradient colors={['#ff694f', '#ff386d']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.actionGradient}>
      <Text style={styles.actionLabel}>{label}</Text><Text style={styles.actionArrow}>›</Text>
    </LinearGradient>
  </Pressable>;
}

function Bullet({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <View style={styles.bulletRow}><View style={[styles.bulletMark, warning ? styles.bulletWarning : styles.bulletGood]}><Text style={styles.bulletMarkText}>{warning ? '!' : '✓'}</Text></View><Text style={styles.bulletText}>{children}</Text></View>;
}

function SelectionGlyph({ selected, mode }: { selected: boolean; mode: RecordingMode }) {
  const automatic = mode === 'automatic';
  return <View style={[styles.selectionGlyph, automatic ? styles.selectionGlyphAuto : styles.selectionGlyphManual]}>
    <View style={[styles.selectionRing, automatic ? styles.selectionRingAuto : styles.selectionRingManual]}><View style={[styles.selectionDot, automatic ? styles.selectionDotAuto : styles.selectionDotManual]} /></View>
    {selected && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>✓</Text></View>}
  </View>;
}

function RecordingChoice({ mode, selected, onPress }: { mode: RecordingMode; selected: boolean; onPress: () => void }) {
  const automatic = mode === 'automatic';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Select ${automatic ? 'Automatic' : 'Manual'} recording`} onPress={onPress} style={[styles.choiceCard, selected && (automatic ? styles.choiceSelectedAuto : styles.choiceSelectedManual)]}>
    <View style={styles.choiceHeader}>
      <SelectionGlyph selected={selected} mode={mode} />
      <View style={styles.choiceHeaderCopy}>
        {selected && <Text style={styles.choiceSelectedKicker}>{automatic ? 'SELECTED · HANDS-FREE' : "SELECTED · YOU'RE IN CONTROL"}</Text>}
        <Text style={styles.choiceTitle}>{automatic ? 'Automatic' : 'Manual Recording'}</Text>
        {!selected && <Text style={styles.choiceSummary}>{automatic ? 'Starts when driving is detected.' : 'Tap Start and Finish for every journey.'}</Text>}
      </View>
      {!selected && <Text style={styles.choiceChevron}>›</Text>}
    </View>
    {selected && <View style={styles.choiceDetails}>
      <Text style={styles.choiceDescription}>{automatic ? 'Starts when driving is detected and stops after you park.' : "Tap Start when your journey begins and Finish when you're done."}</Text>
      <Text style={styles.detailLabelGood}>BENEFITS</Text>
      <Bullet>{automatic ? 'No need to open JourneyDeck' : 'Every journey starts only when you choose'}</Bullet>
      <Bullet>{automatic ? 'Your complete route is easier to capture' : 'Lower background battery use'}</Bullet>
      {!automatic && <Bullet>Apple Music can still add your soundtrack afterward</Bullet>}
      <Text style={styles.detailLabelWarning}>LIMITATIONS</Text>
      <Bullet warning>{automatic ? 'Always Location uses more background battery' : 'Nothing before you tap Start can be recovered'}</Bullet>
      <Bullet warning>{automatic ? 'Detection can occasionally start late' : 'You must remember to finish the journey'}</Bullet>
      {!automatic && <Bullet warning>Only interact with the controls when it’s safe</Bullet>}
    </View>}
    {!selected && <Text style={styles.tapCompare}>Tap to compare</Text>}
  </Pressable>;
}

function RecordingScreen({ initial, onContinue }: { initial: RecordingMode; onContinue: (mode: RecordingMode) => Promise<void> }) {
  const [selected, setSelected] = useState<RecordingMode>(initial);
  const [saving, setSaving] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const select = (next: RecordingMode) => {
    if (next === selected || saving) return;
    Animated.timing(opacity, { toValue: 0.2, duration: 120, useNativeDriver: true }).start(() => {
      setSelected(next);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
  };
  const proceed = async () => {
    if (saving) return;
    setSaving(true);
    try { await onContinue(selected); } finally { setSaving(false); }
  };
  return <ScreenFrame bottom={<View style={styles.fixedAction}><GradientAction label={`Continue with ${selected === 'automatic' ? 'Automatic' : 'Manual'}`} disabled={saving} onPress={() => void proceed()} /></View>}>
    <ProgressHeader step="02 / 04" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>GPS METHOD</Text><Text accessibilityRole="header" style={styles.title}>Choose how journeys begin.</Text><Text style={styles.subtitle}>You can change this anytime in Settings.</Text>
      <Animated.View style={[styles.choiceStack, { opacity }]}>
        <RecordingChoice mode="automatic" selected={selected === 'automatic'} onPress={() => select('automatic')} />
        <RecordingChoice mode="manual" selected={selected === 'manual'} onPress={() => select('manual')} />
        <View style={styles.privacyPill}><Text style={styles.privacyGlyph}>♙</Text><Text style={styles.privacyText}>{selected === 'automatic' ? 'Automatic needs Always Location. Your routes stay private.' : 'Location recording runs only after you tap Start.'}</Text></View>
      </Animated.View>
    </ScrollView>
  </ScreenFrame>;
}

function AppleMusicScreen({ onConnect, onSkip }: { onConnect: () => Promise<void>; onSkip: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const act = async (action: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try { await action(); } finally { setSaving(false); }
  };
  return <ScreenFrame><ProgressHeader step="03 / 04" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.musicScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>YOUR ROAD SOUNDTRACK</Text><Text accessibilityRole="header" style={styles.title}>Connect Apple Music.</Text><Text style={styles.subtitle}>Bring the songs you played back to every journey.</Text>
      <View style={styles.musicCard}>
        <Image source={APPLE_MUSIC_ICON} resizeMode="contain" style={styles.musicIcon} /><Text style={styles.musicTitle}>Apple Music</Text><Text style={styles.musicKicker}>YOUR JOURNEY. YOUR MUSIC.</Text>
        <Text style={styles.musicBody}>JourneyDeck uses your Apple Music listening history to match the songs you played to each journey.</Text><View style={styles.cardDivider} />
        <Bullet>Match songs to the road where you heard them</Bullet><Bullet>Bring back titles, artists, and album artwork</Bullet><Bullet>No microphone required</Bullet>
        <View style={styles.privacyBox}><Text style={styles.privacyBoxTitle}>PRIVATE BY DESIGN</Text><Text style={styles.privacyBoxBody}>Only soundtrack details needed for your journeys.</Text></View>
        <GradientAction label={saving ? 'Connecting…' : 'Connect Apple Music'} disabled={saving} onPress={() => void act(onConnect)} />
      </View>
      <Text style={styles.permissionNote}>Apple will ask for permission next.</Text><Pressable accessibilityRole="button" accessibilityLabel="Continue without Apple Music" disabled={saving} onPress={() => void act(onSkip)} style={styles.skipButton}><Text style={styles.skipText}>Continue without Apple Music</Text></Pressable>
    </ScrollView>
  </ScreenFrame>;
}

function RadarGraphic() {
  return <View style={styles.radar}><View style={[styles.radarRing, styles.radarRingOuter]} /><View style={[styles.radarRing, styles.radarRingMiddle]} /><View style={[styles.radarRing, styles.radarRingInner]} /><View style={styles.radarCenter} /><View style={styles.radarRoute} /><View style={styles.radarPin} /></View>;
}

function InstructionStep({ number, label, detail, accent = false }: { number: number; label: string; detail: string; accent?: boolean }) {
  return <View style={styles.instructionRow}><View style={[styles.stepNumber, accent && styles.stepNumberAccent]}><Text style={[styles.stepNumberText, accent && styles.stepNumberTextAccent]}>{number}</Text></View><View style={styles.instructionCopy}><Text style={[styles.instructionLabel, accent && styles.instructionLabelAccent]}>{label}</Text><Text style={styles.instructionDetail}>{detail}</Text></View>{label === 'PRESS PLAY' && <Image source={APPLE_MUSIC_ICON} resizeMode="contain" style={styles.inlineMusicIcon} />}</View>;
}

function FinishScreen({ recordingMode, onFinish }: { recordingMode: RecordingMode; onFinish: () => void }) {
  const automatic = recordingMode === 'automatic';
  return <ScreenFrame bottom={<View style={styles.fixedAction}><GradientAction label="Let the Journey Begin" onPress={onFinish} /></View>}>
    <ProgressHeader step="04 / 04" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.finishScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.eyebrow, !automatic && styles.manualEyebrow]}>{automatic ? 'AUTOMATIC IS READY' : 'MANUAL IS READY'}</Text><Text accessibilityRole="header" style={styles.title}>{automatic ? 'You’re ready. Just drive.' : 'You’re in the driver’s seat.'}</Text><Text style={styles.subtitle}>{automatic ? 'JourneyDeck handles the route while you enjoy the road.' : 'Start and finish every journey when you choose.'}</Text>
      <View style={[styles.finishCard, !automatic && styles.finishCardManual]}>
        {automatic ? <RadarGraphic /> : <View style={styles.startPreview}><Text style={styles.startPreviewKicker}>HOME · MANUAL RECORDING</Text><View style={styles.startPreviewButton}><Text style={styles.startPreviewPlay}>▶</Text><Text style={styles.startPreviewLabel}>Start Your Journey</Text><Text style={styles.startPreviewArrow}>›</Text></View></View>}
        <Text style={styles.finishCardKicker}>{automatic ? 'SIMPLY GET IN AND GO' : 'START. DRIVE. REMEMBER TO FINISH.'}</Text><View style={styles.cardDivider} />
        {automatic ? <><InstructionStep number={1} label="GET IN" detail="Take your iPhone with you." /><InstructionStep number={2} label="DRIVE" detail="Your journey starts automatically." /><InstructionStep number={3} label="PRESS PLAY" detail="Play Apple Music through your iPhone or CarPlay." accent /><InstructionStep number={4} label="ARRIVE" detail="Park and JourneyDeck finishes the journey." /></> : <><InstructionStep number={1} label="OPEN" detail="Open JourneyDeck after you enter your car." /><InstructionStep number={2} label="START" detail="On Home, tap Start Your Journey." accent /><InstructionStep number={3} label="DRIVE" detail="Enjoy the road and play your music." /><InstructionStep number={4} label="FINISH" detail="When you arrive, open JourneyDeck and end the journey." accent /></>}
        <View style={[styles.readyPill, !automatic && styles.reminderPill]}><Text style={styles.readyMark}>{automatic ? '✓' : '!'}</Text><Text style={styles.readyText}>{automatic ? 'Automatic recording is ready.' : 'Remember to tap Finish Journey when the drive is over.'}</Text></View>
      </View>
    </ScrollView>
  </ScreenFrame>;
}

export function FirstRunOnboardingScreen(props: Props) {
  return <View style={styles.fullScreen}><ExpoStatusBar hidden /><StatusBar hidden animated={false} />
    {props.stage === 'welcome' && <WelcomeAnimation onComplete={props.onWelcomeComplete} />}
    {props.stage === 'recording' && <RecordingScreen initial={props.initialRecordingMode} onContinue={props.onRecordingContinue} />}
    {props.stage === 'music' && <AppleMusicScreen onConnect={props.onConnectAppleMusic} onSkip={props.onSkipAppleMusic} />}
    {props.stage === 'instructions' && <FinishScreen recordingMode={props.initialRecordingMode} onFinish={props.onFinish} />}
  </View>;
}

const styles = StyleSheet.create({
  fullScreen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#030107' }, backdropShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,3,12,0.64)' }, safeFrame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  progressHeader: { minHeight: 38, marginHorizontal: 24, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandIcon: { width: 30, height: 30, borderRadius: 8 }, brandName: { color: '#ddd2e3', fontSize: 9, fontWeight: '900', letterSpacing: 2 }, progressText: { color: '#b49cc6', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  scroll: { flex: 1 }, scrollContent: { paddingHorizontal: 24, paddingBottom: 112 }, musicScrollContent: { paddingHorizontal: 24, paddingBottom: 28 }, finishScrollContent: { paddingHorizontal: 24, paddingBottom: 112 }, eyebrow: { color: '#ff896d', fontSize: 9, fontWeight: '900', letterSpacing: 2.1, marginTop: 4 }, manualEyebrow: { color: '#c998ff' }, title: { color: '#fbf8ff', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8, marginTop: 14 }, subtitle: { color: '#b1a7b8', fontSize: 14, lineHeight: 20, marginTop: 8 },
  choiceStack: { gap: 14, marginTop: 26 }, choiceCard: { borderRadius: 23, borderWidth: 1, borderColor: '#67457c', backgroundColor: 'rgba(12,7,20,0.92)', padding: 16 }, choiceSelectedAuto: { borderColor: '#ff6c50' }, choiceSelectedManual: { borderColor: '#a567ff' }, choiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 }, choiceHeaderCopy: { flex: 1 }, choiceSelectedKicker: { color: '#5be2b9', fontSize: 8, fontWeight: '900', letterSpacing: 1.15, marginBottom: 6 }, choiceTitle: { color: '#faf5ff', fontSize: 22, lineHeight: 27, fontWeight: '900' }, choiceSummary: { color: '#a69baa', fontSize: 11, marginTop: 4 }, choiceChevron: { color: '#a766ff', fontSize: 26, fontWeight: '700' },
  selectionGlyph: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, selectionGlyphAuto: { borderColor: '#ff765d', backgroundColor: '#3c1d24' }, selectionGlyphManual: { borderColor: '#a96bff', backgroundColor: '#281a3e' }, selectionRing: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, selectionRingAuto: { borderColor: '#ff7257' }, selectionRingManual: { borderColor: '#a76aff' }, selectionDot: { width: 10, height: 10, borderRadius: 5 }, selectionDotAuto: { backgroundColor: '#ff7257' }, selectionDotManual: { backgroundColor: '#a76aff' }, selectedCheck: { position: 'absolute', right: -4, top: -4, width: 19, height: 19, borderRadius: 10, backgroundColor: '#58dfb7', alignItems: 'center', justifyContent: 'center' }, selectedCheckText: { color: '#07372d', fontSize: 11, fontWeight: '900' },
  choiceDetails: { marginTop: 17 }, choiceDescription: { color: '#afa5b4', fontSize: 12, lineHeight: 18 }, detailLabelGood: { color: '#59dfb8', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 19, marginBottom: 9 }, detailLabelWarning: { color: '#ffba61', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 17, marginBottom: 9 }, tapCompare: { color: '#bd8cff', fontSize: 10, fontWeight: '700', marginLeft: 60, marginTop: 9 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 }, bulletMark: { width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, bulletGood: { backgroundColor: '#55dfb5' }, bulletWarning: { backgroundColor: '#ffb55d' }, bulletMarkText: { color: '#0a352b', fontSize: 11, fontWeight: '900' }, bulletText: { flex: 1, color: '#e1dae5', fontSize: 12, lineHeight: 17 },
  privacyPill: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: '#9658ce', backgroundColor: 'rgba(49,29,62,0.9)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 }, privacyGlyph: { color: '#bb80ff', fontSize: 17 }, privacyText: { flex: 1, color: '#d2c6d8', fontSize: 10, lineHeight: 14 },
  fixedAction: { paddingHorizontal: 24, paddingTop: 10 }, actionPressable: { minHeight: 58, borderRadius: 18, overflow: 'hidden', shadowColor: '#ff4e62', shadowOpacity: 0.36, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } }, actionGradient: { minHeight: 58, borderRadius: 18, paddingHorizontal: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, actionLabel: { color: '#fff8fb', fontSize: 15, fontWeight: '900' }, actionArrow: { position: 'absolute', right: 18, color: '#fff6fa', fontSize: 27, lineHeight: 30 }, pressed: { opacity: 0.72 },
  musicCard: { borderRadius: 24, borderWidth: 1, borderColor: '#ff7258', backgroundColor: 'rgba(10,6,16,0.94)', padding: 20, alignItems: 'stretch', marginTop: 27 }, musicIcon: { width: 76, height: 76, alignSelf: 'center', borderRadius: 17 }, musicTitle: { color: '#fbf6ff', fontSize: 27, lineHeight: 31, fontWeight: '900', textAlign: 'center', marginTop: 14 }, musicKicker: { color: '#ff8168', fontSize: 7, fontWeight: '900', letterSpacing: 1.4, textAlign: 'center', marginTop: 5 }, musicBody: { color: '#c4bac9', fontSize: 13, lineHeight: 19, marginTop: 27 }, cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#73567e', marginVertical: 22 }, privacyBox: { borderRadius: 14, borderWidth: 1, borderColor: '#9d65d2', backgroundColor: '#2c1d39', paddingHorizontal: 15, paddingVertical: 12, marginTop: 16, marginBottom: 16 }, privacyBoxTitle: { color: '#d7b5ff', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, privacyBoxBody: { color: '#a99bad', fontSize: 9, marginTop: 4 }, permissionNote: { color: '#827987', fontSize: 9, textAlign: 'center', marginTop: 17 }, skipButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, skipText: { color: '#d0c5d5', fontSize: 11, fontWeight: '700' },
  finishCard: { borderRadius: 24, borderWidth: 1, borderColor: '#59d9b4', backgroundColor: 'rgba(8,6,15,0.94)', padding: 18, marginTop: 25 }, finishCardManual: { borderColor: '#a66bff' }, finishCardKicker: { color: '#59dcb7', fontSize: 8, fontWeight: '900', letterSpacing: 1.6, textAlign: 'center', marginTop: 12 },
  radar: { width: 116, height: 116, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, radarRing: { position: 'absolute', borderRadius: 999, borderWidth: 2, borderColor: '#59e2bd' }, radarRingOuter: { width: 112, height: 112 }, radarRingMiddle: { width: 78, height: 78 }, radarRingInner: { width: 42, height: 42 }, radarCenter: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#58e2bd' }, radarRoute: { position: 'absolute', width: 62, height: 5, borderRadius: 3, backgroundColor: '#ff694f', transform: [{ rotate: '-38deg' }], left: 53, top: 46 }, radarPin: { position: 'absolute', width: 13, height: 13, borderRadius: 7, backgroundColor: '#ff694f', borderWidth: 2, borderColor: '#fff', right: 3, top: 26 },
  instructionRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 13 }, stepNumber: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#5adfba', backgroundColor: '#102b27', alignItems: 'center', justifyContent: 'center' }, stepNumberAccent: { borderColor: '#ff6e54', backgroundColor: '#35191c' }, stepNumberText: { color: '#60e1bd', fontSize: 13, fontWeight: '900' }, stepNumberTextAccent: { color: '#ff8068' }, instructionCopy: { flex: 1 }, instructionLabel: { color: '#59dbb7', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, instructionLabelAccent: { color: '#ff8067' }, instructionDetail: { color: '#ddd6e1', fontSize: 12, lineHeight: 17, marginTop: 5 }, inlineMusicIcon: { width: 28, height: 28, borderRadius: 7 }, readyPill: { minHeight: 45, borderRadius: 14, borderWidth: 1, borderColor: '#58dfb7', backgroundColor: '#173c35', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }, reminderPill: { borderColor: '#ff9a66', backgroundColor: '#3a2223' }, readyMark: { color: '#59e2bc', fontSize: 15, fontWeight: '900' }, readyText: { flex: 1, color: '#d7eae4', fontSize: 10, lineHeight: 14 },
  startPreview: { borderRadius: 18, borderWidth: 1, borderColor: '#8e5fc5', backgroundColor: '#1e1229', padding: 14 }, startPreviewKicker: { color: '#cc9cff', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, startPreviewButton: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#ff7258', backgroundColor: '#321827', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginTop: 10, gap: 10 }, startPreviewPlay: { color: '#fff', fontSize: 13 }, startPreviewLabel: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '900' }, startPreviewArrow: { color: '#ff8068', fontSize: 24 },
});
