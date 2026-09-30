// V4 iPhone onboarding: four steps (Welcome, Location, Soundtrack, See where you've been), each built like the
// approved Soundtrack motion study: elements arrive in sequence, routes draw, items land with a small spring.
// Reduce Motion: Reanimated's entering animations follow the system setting, and the drawn lines appear whole.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, {
  Easing, FadeIn, FadeInDown, LinearTransition, ZoomIn, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence,
  withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from './app-theme';
import { haptics } from './haptics';
import { headerImageSource } from './header-image-sources';
import { useMotionPreferences } from './motion';
import type { RecordingMode } from './recording-mode';
import { SERIF, useRedesignColors } from './redesign-ui';
import { withAlpha } from './redesign-palette';
import { getCurrentUser } from './auth';
import { US_STATES_MAP_VIEW_BOX, US_STATE_PATHS } from './fifty-states-map-data';
import { US_STATES, type USStateCode } from './fifty-states-model';
import { tripDates, type RoadsSoFar } from './roads-so-far-model';
import { RoadsScanCancelled, requestRoadsAccess, saveFoundStates, saveTripsAsMemories, scanRoadsSoFar, type RoadsScanProgress } from './roads-so-far-scan';
import { showTodayCard } from './today-screen';

import { V4_STEPS, type V4Stage } from './first-run-v4-flow';
export { nextV4Stage, previousV4Stage, v4Stage, type V4Stage } from './first-run-v4-flow';

const SPRING = { damping: 14, stiffness: 150 };
/** Rises into place: the shared entrance for text, cards and buttons. */
const rise = (delay: number) => FadeInDown.delay(delay).duration(620).easing(Easing.bezier(0.2, 0.8, 0.2, 1)).withInitialValues({ transform: [{ translateY: 18 }] });
/** Lands with a small bounce: songs on the timeline, a chosen option's icon. */
const land = (delay: number) => FadeInDown.delay(delay).springify().damping(12).stiffness(170).withInitialValues({ transform: [{ translateY: -14 }] });

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A route line that draws itself from start to end. */
function DrawnRoute({ d, length, width, height, color, delay, duration = 1600 }: { d: string; length: number; width: number; height: number; color: string; delay: number; duration?: number }) {
  const { reduceMotion } = useMotionPreferences();
  const offset = useSharedValue(reduceMotion ? 0 : length);
  useEffect(() => { if (!reduceMotion) offset.value = withDelay(delay, withTiming(0, { duration, easing: Easing.bezier(0.6, 0, 0.2, 1) })); }, [delay, duration, offset, reduceMotion]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return <Svg pointerEvents="none" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <AnimatedPath d={d} stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" strokeDasharray={[length, length]} animatedProps={props} />
  </Svg>;
}

function Progress({ stage, onBack }: { stage: Exclude<V4Stage, 'welcome'>; onBack?: () => void }) {
  const c = useRedesignColors();
  const step = V4_STEPS.indexOf(stage) + 1;
  return <View style={styles.progressRow}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} disabled={!onBack} onPress={onBack}
      style={[styles.back, { backgroundColor: c.surfaceStrong, borderColor: c.border }, !onBack && styles.hidden]}>
      <SymbolView name="chevron.left" tintColor={c.text} size={15} weight="semibold" />
    </Pressable>
    <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${V4_STEPS.length}`} accessibilityValue={{ min: 1, max: V4_STEPS.length, now: step }} style={styles.bars}>
      {V4_STEPS.map((_, index) => <ProgressBar key={index} lit={index < step} current={index === step - 1} />)}
    </View>
  </View>;
}

/** The current step's segment fills like a stretch of road being driven. */
function ProgressBar({ lit, current }: { lit: boolean; current: boolean }) {
  const c = useRedesignColors();
  const { reduceMotion } = useMotionPreferences();
  const fill = useSharedValue(current && !reduceMotion ? 0 : lit ? 1 : 0);
  useEffect(() => { if (current && !reduceMotion) fill.value = withDelay(150, withTiming(1, { duration: 700, easing: Easing.bezier(0.5, 0, 0.2, 1) })); }, [current, fill, reduceMotion]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return <View style={[styles.bar, { backgroundColor: c.track }]}><Animated.View style={[styles.barFill, { backgroundColor: c.accent }, style]} /></View>;
}

function Title({ children, delay, center = false }: { children: string; delay: number; center?: boolean }) {
  const c = useRedesignColors();
  return <Animated.Text entering={rise(delay)} accessibilityRole="header" style={[styles.title, { color: c.text }, center && styles.center]}>{children}</Animated.Text>;
}

function Body({ children, delay }: { children: string; delay: number }) {
  const c = useRedesignColors();
  return <Animated.Text entering={rise(delay)} style={[styles.body, { color: c.textSecondary }]}>{children}</Animated.Text>;
}

function PrimaryButton({ label, onPress, busy = false, delay }: { label: string; onPress: () => void; busy?: boolean; delay: number }) {
  const c = useRedesignColors();
  return <Animated.View entering={rise(delay)}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} disabled={busy}
      onPress={() => { void haptics.primaryAction(); onPress(); }}
      style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed || busy ? 0.8 : 1 }]}>
      {busy ? <ActivityIndicator color={c.onAccent} /> : <Text style={[styles.ctaText, { color: c.onAccent }]}>{label}</Text>}
    </Pressable>
  </Animated.View>;
}

function QuietLink({ label, onPress, delay }: { label: string; onPress: () => void; delay: number }) {
  const c = useRedesignColors();
  return <Animated.View entering={rise(delay)} style={styles.linkWrap}>
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress} style={styles.link}><Text style={[styles.linkText, { color: c.textSecondary }]}>{label}</Text></Pressable>
  </Animated.View>;
}

function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useRedesignColors();
  const insets = useSafeAreaInsets();
  const content = { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8 };
  return <View style={[styles.screen, { backgroundColor: c.page }]}>
    <LinearGradient pointerEvents="none" colors={[c.glow, c.page]} style={styles.glow} />
    {scroll ? <ScrollView contentContainerStyle={[styles.content, content]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      : <View style={[styles.content, content, styles.flex]}>{children}</View>}
  </View>;
}

// --- 1 · Welcome -----------------------------------------------------------------------------------------------

function WelcomeStep({ onContinue, onHaveAccount }: { onContinue: () => void; onHaveAccount: () => void }) {
  const c = useRedesignColors();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useMotionPreferences();
  const push = useSharedValue(reduceMotion ? 1 : 1.14);
  useEffect(() => { if (!reduceMotion) push.value = withTiming(1, { duration: 7000, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }); }, [push, reduceMotion]);
  const photo = useAnimatedStyle(() => ({ transform: [{ scale: push.value }] }));
  return <View style={[styles.screen, { backgroundColor: c.page }]}>
    <Animated.View style={[StyleSheet.absoluteFill, photo]}>
      <ExpoImage accessible={false} source={headerImageSource(require('../assets/cinematic-home-main-photo-v1.jpg'), theme.id)} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
    <LinearGradient pointerEvents="none" colors={[withAlpha(c.page, 0.35), withAlpha(c.page, 0.08), withAlpha(c.page, 0.92), c.page]} locations={[0, 0.35, 0.68, 1]} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={styles.welcomeRoute}>
      <DrawnRoute d="M-10 100 C 70 90, 110 40, 190 52 S 320 96, 400 30" length={520} width={390} height={120} color={c.accent} delay={300} />
    </View>
    <View style={[styles.welcomeCopy, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <Animated.Text entering={rise(1100)} style={[styles.kicker, { color: c.accent }]}>JOURNEYDECK</Animated.Text>
      <Animated.Text entering={rise(1100)} accessibilityRole="header" style={[styles.welcomeTitle, { color: c.text }]}>Your journey, remembered.</Animated.Text>
      <Animated.Text entering={rise(1350)} style={[styles.welcomeBody, { color: c.textSecondary }]}>Every route and song, all private.</Animated.Text>
      <PrimaryButton label="Get started" onPress={onContinue} delay={1600} />
      <QuietLink label="I have an account" onPress={onHaveAccount} delay={1800} />
    </View>
  </View>;
}

// --- 2 · Location ----------------------------------------------------------------------------------------------

function ModeOption({ symbol, title, detail, selected, onPress, delay }: { symbol: SFSymbol; title: string; detail: string; selected: boolean; onPress: () => void; delay: number }) {
  const c = useRedesignColors();
  const pop = useSharedValue(1);
  useEffect(() => { if (selected) pop.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, SPRING)); }, [pop, selected]);
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return <Animated.View entering={rise(delay)}>
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${title}. ${detail}`}
      onPress={() => { void haptics.selection(); onPress(); }}
      style={[styles.option, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : c.surface, borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth }]}>
      <Animated.View style={[styles.optionIcon, { backgroundColor: selected ? c.accent : c.surfaceStrong }, icon]}>
        <SymbolView name={symbol} tintColor={selected ? c.onAccent : c.accent} size={19} weight="semibold" />
      </Animated.View>
      <View style={styles.flex}><Text style={[styles.optionTitle, { color: c.text }]}>{title}</Text><Text style={[styles.optionDetail, { color: c.textSecondary }]}>{detail}</Text></View>
      {selected ? <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.check, { backgroundColor: c.accent }]}><SymbolView name="checkmark" tintColor={c.onAccent} size={11} weight="bold" /></Animated.View> : null}
    </Pressable>
  </Animated.View>;
}

function LocationStep({ onBack, onContinue, initialMode }: { onBack: () => void; onContinue: (mode: RecordingMode, drivesTesla: boolean | null) => Promise<void>; initialMode: RecordingMode | null }) {
  const c = useRedesignColors();
  // A replay keeps the mode already chosen; a first run suggests automatic.
  const [mode, setMode] = useState<RecordingMode>(initialMode ?? 'automatic');
  const [tesla, setTesla] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const allow = async () => {
    if (busy) return;
    setBusy(true);
    try { await onContinue(mode, tesla); } finally { setBusy(false); }
  };
  return <Screen>
    <Progress stage="location" onBack={onBack} />
    <Title delay={80}>How should drives be recorded?</Title>
    <Body delay={220}>JourneyDeck uses your location only while you drive. Routes stay on your iPhone and in your iCloud.</Body>
    <View accessibilityRole="radiogroup" style={styles.options}>
      <ModeOption symbol="location.fill" title="Automatically" detail="Starts when you start driving" selected={mode === 'automatic'} onPress={() => setMode('automatic')} delay={380} />
      <ModeOption symbol="record.circle" title="When I tap Start" detail="You choose which drives to keep" selected={mode === 'manual'} onPress={() => setMode('manual')} delay={500} />
    </View>
    <Animated.View entering={rise(660)} layout={LinearTransition.springify().damping(16)} style={[styles.divider, { backgroundColor: c.separator }]} />
    <Animated.View entering={rise(720)} layout={LinearTransition.springify().damping(16)} style={styles.teslaRow}>
      <Text style={[styles.teslaQuestion, { color: c.text }]}>Do you drive a Tesla?</Text>
      <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: c.surface, borderColor: c.border }]}>
        {([['Yes', true], ['No', false]] as const).map(([label, value]) => {
          const on = tesla === value;
          return <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { void haptics.selection(); setTesla(value); }}
            style={[styles.segmentItem, on && { backgroundColor: value ? c.accent : c.surfaceStrong }]}>
            <Text style={[styles.segmentText, { color: on ? (value ? c.onAccent : c.text) : c.textSecondary }]}>{label}</Text>
          </Pressable>;
        })}
      </View>
    </Animated.View>
    {tesla ? <Animated.View entering={FadeInDown.springify().damping(15)} layout={LinearTransition.springify().damping(16)}
      style={[styles.teslaNote, { backgroundColor: withAlpha(c.routes[2], 0.16), borderColor: withAlpha(c.routes[2], 0.45) }]}>
      <TeslaCar />
      <View style={styles.flex}>
        <Text style={[styles.optionTitle, { color: c.text }]}>Bring in your Tesla drives</Text>
        <Text style={[styles.optionDetail, { color: c.textSecondary }]}>Connect Tessie later in Settings › Recording and JourneyDeck will add your Tesla trips automatically.</Text>
      </View>
    </Animated.View> : null}
    <View style={styles.spacer} />
    <PrimaryButton label="Allow location" onPress={() => void allow()} busy={busy} delay={860} />
    <Animated.Text entering={rise(960)} style={[styles.fine, { color: c.textTertiary }]}>{mode === 'automatic' ? 'iOS asks next. Choose “Always” for automatic drives.' : 'iOS asks next.'}</Animated.Text>
  </Screen>;
}

/** The car rolls in from the left as the note opens. */
function TeslaCar() {
  const c = useRedesignColors();
  const { reduceMotion } = useMotionPreferences();
  const x = useSharedValue(reduceMotion ? 0 : -46);
  useEffect(() => { if (!reduceMotion) x.value = withSpring(0, { damping: 13, stiffness: 120 }); }, [reduceMotion, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View style={[styles.teslaIcon, { backgroundColor: c.routes[2] }]}>
    <Animated.View style={style}><SymbolView name="car.side.fill" tintColor={c.onAccent} size={20} /></Animated.View>
  </View>;
}

// --- 3 · Your soundtrack ---------------------------------------------------------------------------------------

const SAMPLE_SONGS = [{ title: 'Open Road', mile: 2 }, { title: 'Golden Hour', mile: 9 }, { title: 'Home Stretch', mile: 17 }];

function TimelineLine() {
  const c = useRedesignColors();
  const { reduceMotion } = useMotionPreferences();
  const grow = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => { if (!reduceMotion) grow.value = withDelay(500, withTiming(1, { duration: 1900, easing: Easing.bezier(0.5, 0, 0.2, 1) })); }, [grow, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));
  return <Animated.View style={[styles.timeline, { transformOrigin: 'top' }, style]}>
    <LinearGradient colors={[c.accent, withAlpha(c.accent, 0.2)]} style={StyleSheet.absoluteFill} />
  </Animated.View>;
}

function SampleSong({ index }: { index: number }) {
  const c = useRedesignColors();
  const song = SAMPLE_SONGS[index]!;
  const delay = 700 + index * 600;
  useEffect(() => { const timer = setTimeout(() => { void haptics.selection(); }, delay + 180); return () => clearTimeout(timer); }, [delay]);
  const tint = c.artwork[index % c.artwork.length];
  return <Animated.View entering={land(delay)} style={[styles.song, index === SAMPLE_SONGS.length - 1 && styles.songFaded]}>
    <Animated.View entering={ZoomIn.delay(delay).springify().damping(11)} style={[styles.art, { backgroundColor: withAlpha(tint, 0.9) }]}>
      <SymbolView name="music.note" tintColor={c.onAccent} size={18} weight="semibold" />
    </Animated.View>
    <View style={styles.flex}><Text style={[styles.songTitle, { color: c.text }]}>{song.title}</Text><Text style={[styles.songArtist, { color: c.textSecondary }]}>Sample song</Text></View>
    <Animated.Text entering={FadeIn.delay(delay + 300).duration(400)} style={[styles.mile, { color: c.accent }]}>mile {song.mile}</Animated.Text>
  </Animated.View>;
}

function SoundWave() {
  const c = useRedesignColors();
  return <View style={styles.wave}>{[0, 1, 2, 3].map(index => <WaveBar key={index} index={index} color={c.accent} />)}</View>;
}

function WaveBar({ index, color }: { index: number; color: string }) {
  const { reduceMotion } = useMotionPreferences();
  const h = useSharedValue(0.4);
  useEffect(() => { if (!reduceMotion) h.value = withDelay(index * 150, withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0.35, { duration: 450 })), -1)); }, [h, index, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return <Animated.View style={[styles.waveBar, { backgroundColor: color, transformOrigin: 'bottom' }, style]} />;
}

function MusicStep({ onBack, onConnectAppleMusic, onConnectLastFm, lastFmUsername, onContinue, onSkip }: {
  onBack: () => void; onConnectAppleMusic: () => Promise<void>; onConnectLastFm: (username: string) => Promise<void>; lastFmUsername: string;
  onContinue: () => void; onSkip: () => void;
}) {
  const c = useRedesignColors();
  const [connected, setConnected] = useState<'apple' | 'lastfm' | null>(null);
  const [busy, setBusy] = useState<'apple' | 'lastfm' | null>(null);
  const [lastFmOpen, setLastFmOpen] = useState(false);
  const [username, setUsername] = useState(lastFmUsername);
  const [error, setError] = useState<string | null>(null);
  const finish = (provider: 'apple' | 'lastfm') => { setConnected(provider); void haptics.success(); setTimeout(onContinue, 1100); };
  const connectApple = async () => {
    if (busy || connected) return;
    setBusy('apple'); setError(null);
    try { await onConnectAppleMusic(); finish('apple'); } catch { setError('Apple Music could not connect. Try again, or choose later in Settings.'); } finally { setBusy(null); }
  };
  const connectLastFm = async () => {
    const name = username.trim();
    if (busy || connected || !name) return;
    setBusy('lastfm'); setError(null);
    try { await onConnectLastFm(name); finish('lastfm'); } catch { setError('Last.fm could not find that username. Check it and try again.'); } finally { setBusy(null); }
  };
  return <Screen>
    <Progress stage="music" onBack={onBack} />
    <Animated.View entering={rise(100)} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.cardHead}><Text style={[styles.cardTitle, { color: c.text }]}>Friday evening drive</Text><Text style={[styles.cardMeta, { color: c.textSecondary }]}>24 mi · 38 min</Text></View>
      <Text style={[styles.cardKicker, { color: c.accent }]}>SOUNDTRACK · 9 SONGS</Text>
      <View style={styles.timelineWrap}>
        <TimelineLine />
        {SAMPLE_SONGS.map((_, index) => <SampleSong key={index} index={index} />)}
      </View>
    </Animated.View>
    <Title delay={2300}>Every drive has a soundtrack.</Title>
    <Body delay={2500}>Each song is pinned to the mile you heard it. Relive a drive by its music, and meet your road anthem every month.</Body>
    <View style={styles.spacer} />
    <Animated.View entering={rise(2700)} layout={LinearTransition.springify().damping(16)} style={[styles.providers, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.provider}>
        <View style={[styles.dot, { backgroundColor: '#fa4659' }]} />
        <Text style={[styles.providerName, { color: c.text }]}>Apple Music</Text>
        {connected === 'apple' ? <ConnectedMark /> : <Pressable accessibilityRole="button" accessibilityLabel="Connect Apple Music" disabled={Boolean(busy || connected)} onPress={() => void connectApple()}
          style={({ pressed }) => [styles.pill, { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 }]}>
          {busy === 'apple' ? <ActivityIndicator size="small" color={c.onAccent} /> : <Text style={[styles.pillText, { color: c.onAccent }]}>Connect</Text>}
        </Pressable>}
      </View>
      <View style={[styles.rowDivider, { backgroundColor: c.separator }]} />
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: lastFmOpen }} accessibilityLabel="Spotify through Last.fm. Allow Last.fm to sync your Spotify tracks"
        disabled={Boolean(connected)} onPress={() => { void haptics.selection(); setLastFmOpen(open => !open); }} style={styles.provider}>
        <View style={[styles.dot, { backgroundColor: '#1ed760' }]} />
        <View style={styles.flex}><Text style={[styles.providerName, { color: c.text }]}>Spotify through Last.fm</Text><Text style={[styles.providerDetail, { color: c.textSecondary }]}>Allow Last.fm to sync your Spotify tracks</Text></View>
        {connected === 'lastfm' ? <ConnectedMark /> : <SymbolView name={lastFmOpen ? 'chevron.up' : 'chevron.down'} tintColor={c.textTertiary} size={13} weight="semibold" />}
      </Pressable>
      {lastFmOpen && !connected ? <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.lastFm}>
        <TextInput value={username} onChangeText={setUsername} placeholder="Last.fm username" placeholderTextColor={c.textTertiary} autoCapitalize="none" autoCorrect={false}
          returnKeyType="done" onSubmitEditing={() => void connectLastFm()} accessibilityLabel="Last.fm username"
          style={[styles.input, { color: c.text, backgroundColor: c.surfaceStrong, borderColor: c.border }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Connect Last.fm" disabled={!username.trim() || Boolean(busy)} onPress={() => void connectLastFm()}
          style={({ pressed }) => [styles.pill, styles.pillTall, { backgroundColor: c.accent, opacity: !username.trim() ? 0.5 : pressed ? 0.8 : 1 }]}>
          {busy === 'lastfm' ? <ActivityIndicator size="small" color={c.onAccent} /> : <Text style={[styles.pillText, { color: c.onAccent }]}>Connect</Text>}
        </Pressable>
      </Animated.View> : null}
    </Animated.View>
    {error ? <Animated.Text entering={FadeIn} accessibilityLiveRegion="polite" style={[styles.fine, { color: c.danger }]}>{error}</Animated.Text> : null}
    <QuietLink label="Not now" onPress={onSkip} delay={2800} />
  </Screen>;
}

function ConnectedMark() {
  const c = useRedesignColors();
  return <View accessibilityLabel="Connected" style={styles.connected}>
    <SoundWave />
    <Animated.View entering={ZoomIn.springify().damping(10)} style={[styles.check, styles.checkLarge, { backgroundColor: c.accent }]}>
      <SymbolView name="checkmark" tintColor={c.onAccent} size={12} weight="bold" />
    </Animated.View>
  </View>;
}

// --- 4 · See where you've been ---------------------------------------------------------------------------------

const PREVIEW_STATES: readonly USStateCode[] = ['CA', 'AZ', 'CO', 'TX', 'TN', 'NC'];

/** One state that fills with gold after `delay`, the way a found trip lights up the map. */
function MapState({ d, lit, delay, fill, idle, stroke }: { d: string; lit: boolean; delay: number; fill: string; idle: string; stroke: string }) {
  const { reduceMotion } = useMotionPreferences();
  const glow = useSharedValue(lit && reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!lit) glow.value = 0;
    else if (!reduceMotion) glow.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [delay, glow, lit, reduceMotion]);
  const lightProps = useAnimatedProps(() => ({ fillOpacity: glow.value }));
  return <>
    <Path d={d} fill={idle} stroke={stroke} strokeWidth={0.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    {lit ? <AnimatedPath d={d} fill={fill} stroke={fill} strokeWidth={0.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" animatedProps={lightProps} /> : null}
  </>;
}

function AnimatedStatesMap({ lit, startDelay = 400, step = 160 }: { lit: readonly USStateCode[]; startDelay?: number; step?: number }) {
  const c = useRedesignColors();
  const order = new Map(lit.map((code, index) => [code, index]));
  return <Animated.View entering={FadeIn.duration(700)} style={styles.map} accessible={false}>
    <Svg viewBox={US_STATES_MAP_VIEW_BOX} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {US_STATES.map(([code]) => <MapState key={code} d={US_STATE_PATHS[code]} lit={order.has(code)} delay={startDelay + (order.get(code) ?? 0) * step}
        fill={c.accent} idle={c.surfaceStrong} stroke={c.border} />)}
    </Svg>
  </Animated.View>;
}

/** Counts up to `value`, like a trip odometer. */
function CountUp({ value, delay = 0, style }: { value: number; delay?: number; style: object }) {
  const { reduceMotion } = useMotionPreferences();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  useEffect(() => {
    if (reduceMotion) { setShown(value); return; }
    let frame = 0;
    const frames = 24;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => { frame += 1; setShown(Math.round((value * frame) / frames)); if (frame >= frames && timer) clearInterval(timer); }, 38);
    }, delay);
    return () => { clearTimeout(start); if (timer) clearInterval(timer); };
  }, [delay, reduceMotion, value]);
  return <Text style={style}>{shown.toLocaleString()}</Text>;
}

/** While photos are read, the map breathes, so the wait feels like work being done. */
function ScanningMap() {
  const { reduceMotion } = useMotionPreferences();
  const pulse = useSharedValue(1);
  useEffect(() => { if (!reduceMotion) pulse.value = withRepeat(withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })), -1); }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={style}><AnimatedStatesMap lit={[]} /></Animated.View>;
}

type PhotosPhase = { kind: 'offer' } | { kind: 'scanning'; progress: RoadsScanProgress } | { kind: 'results'; roads: RoadsSoFar } | { kind: 'saving' } | { kind: 'blocked' } | { kind: 'empty' } | { kind: 'error' };

function PhotosStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const c = useRedesignColors();
  const [phase, setPhase] = useState<PhotosPhase>({ kind: 'offer' });
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);
  const start = async () => {
    cancelled.current = false;
    try {
      const permission = await requestRoadsAccess();
      if (permission !== 'full' && permission !== 'limited') { setPhase({ kind: 'blocked' }); return; }
      setPhase({ kind: 'scanning', progress: { photos: 0, places: 0, states: 0, phase: 'reading' } });
      const roads = await scanRoadsSoFar(progress => { if (!cancelled.current) setPhase({ kind: 'scanning', progress }); }, () => cancelled.current);
      if (cancelled.current) return;
      if (!roads.states.length && !roads.trips.length) { setPhase({ kind: 'empty' }); return; }
      saveFoundStates(roads.states);
      if (roads.states.length) showTodayCard(getCurrentUser().id, 'fiftyStates');
      setChosen(new Set(roads.trips.slice(0, 2).map(trip => trip.id)));
      void haptics.success();
      setPhase({ kind: 'results', roads });
    } catch (error) {
      if (!(error instanceof RoadsScanCancelled) && !cancelled.current) setPhase({ kind: 'error' });
    }
  };
  const save = async (roads: RoadsSoFar) => {
    const trips = roads.trips.filter(trip => chosen.has(trip.id));
    if (!trips.length) { onFinish(); return; }
    setPhase({ kind: 'saving' });
    try { await saveTripsAsMemories(trips); void haptics.success(); } catch { /* Memories already saved stay saved. */ }
    onFinish();
  };
  const toggle = (id: string) => setChosen(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const cardStyle = [styles.card, { backgroundColor: c.surface, borderColor: c.border }];
  const statValue = [styles.statValue, { color: c.text }];
  const statLabel = [styles.statLabel, { color: c.textSecondary }];

  if (phase.kind === 'results') {
    const { roads } = phase;
    return <Screen key="results">
      <Progress stage="photos" onBack={onBack} />
      <Animated.View entering={rise(60)} style={cardStyle}>
        <AnimatedStatesMap lit={roads.states} startDelay={350} step={Math.max(60, Math.min(180, 1400 / Math.max(1, roads.states.length)))} />
        <View style={styles.stats}>
          <View><CountUp value={roads.trips.length} delay={500} style={statValue} /><Text style={statLabel}>{roads.trips.length === 1 ? 'road trip found' : 'road trips found'}</Text></View>
          <View style={styles.statRight}><CountUp value={roads.states.length} delay={650} style={statValue} /><Text style={statLabel}>{roads.states.length === 1 ? 'state on your map' : 'states on your map'}</Text></View>
        </View>
      </Animated.View>
      <Title delay={900}>{"You've been busy."}</Title>
      {roads.trips.length ? <Animated.View entering={rise(1100)} style={[styles.providers, { backgroundColor: c.surface, borderColor: c.border }]}>
        {roads.trips.map((trip, index) => {
          const on = chosen.has(trip.id);
          return <Animated.View key={trip.id} entering={land(1200 + index * 120)}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Save ${trip.name}, ${tripDates(trip.startMs, trip.endMs)}`}
              onPress={() => { void haptics.selection(); toggle(trip.id); }}
              style={[styles.provider, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
              <View style={[styles.optionIcon, { backgroundColor: c.accentSoft }]}><SymbolView name="car.fill" tintColor={c.accent} size={17} /></View>
              <View style={styles.flex}><Text numberOfLines={1} style={[styles.providerName, { color: c.text }]}>{trip.name}</Text><Text style={[styles.providerDetail, { color: c.textSecondary }]}>{tripDates(trip.startMs, trip.endMs)} · {trip.photoIds.length} photos</Text></View>
              <SymbolView name={on ? 'checkmark.circle.fill' : 'circle'} tintColor={on ? c.accent : c.textTertiary} size={24} />
            </Pressable>
          </Animated.View>;
        })}
      </Animated.View> : <Body delay={1100}>No road trips stood out, but your states are already on your 50 States map.</Body>}
      <View style={styles.spacer} />
      <PrimaryButton label={chosen.size ? `Save ${chosen.size} ${chosen.size === 1 ? 'Memory' : 'Memories'} and finish` : 'Finish'} onPress={() => void save(roads)} delay={1300} />
    </Screen>;
  }
  if (phase.kind === 'scanning' || phase.kind === 'saving') {
    const progress = phase.kind === 'scanning' ? phase.progress : null;
    return <Screen key="scanning">
      <Progress stage="photos" />
      <Animated.View entering={rise(60)} style={cardStyle}><ScanningMap /></Animated.View>
      <Title delay={150}>{phase.kind === 'saving' ? 'Saving your Memories…' : 'Tracing your roads…'}</Title>
      <Body delay={250}>Reading only photo dates and places, on this iPhone.</Body>
      {progress ? <Animated.View entering={rise(350)} style={styles.stats}>
        <View><Text style={statValue}>{progress.photos.toLocaleString()}</Text><Text style={statLabel}>photos read</Text></View>
        <View style={styles.statRight}><Text style={statValue}>{progress.places.toLocaleString()}</Text><Text style={statLabel}>places found</Text></View>
      </Animated.View> : <ActivityIndicator color={c.accent} />}
      <View style={styles.spacer} />
      {phase.kind === 'scanning' ? <QuietLink label="Cancel" onPress={() => { cancelled.current = true; setPhase({ kind: 'offer' }); }} delay={450} /> : null}
    </Screen>;
  }
  if (phase.kind === 'blocked' || phase.kind === 'empty' || phase.kind === 'error') {
    const copy = phase.kind === 'blocked'
      ? { title: 'Photos access is off.', body: 'Allow JourneyDeck to use your photos in iOS Settings, or do this later from Settings.', action: 'Open Settings', run: () => void Linking.openSettings().catch(() => undefined) }
      : phase.kind === 'empty'
        ? { title: 'No places in your photos yet.', body: 'Your drives will fill in your map from now on.', action: 'Finish', run: onFinish }
        : { title: "That didn't finish.", body: 'JourneyDeck could not read your photos this time. Nothing was changed.', action: 'Try again', run: () => void start() };
    return <Screen key={phase.kind}>
      <Progress stage="photos" onBack={onBack} />
      <Title delay={80}>{copy.title}</Title>
      <Body delay={200}>{copy.body}</Body>
      <View style={styles.spacer} />
      <PrimaryButton label={copy.action} onPress={copy.run} delay={320} />
      {phase.kind !== 'empty' ? <QuietLink label="Finish without photos" onPress={onFinish} delay={420} /> : null}
    </Screen>;
  }
  return <Screen key="offer">
    <Progress stage="photos" onBack={onBack} />
    <Animated.View entering={rise(60)} style={cardStyle}>
      <AnimatedStatesMap lit={PREVIEW_STATES} startDelay={600} step={260} />
      <Animated.Text entering={FadeIn.delay(600 + PREVIEW_STATES.length * 260).duration(500)} style={[styles.mapCaption, { color: c.textTertiary }]}>Example</Animated.Text>
    </Animated.View>
    <Animated.Text entering={rise(2200)} style={[styles.kicker, { color: c.accent }]}>{"SEE WHERE YOU'VE BEEN"}</Animated.Text>
    <Title delay={2300}>Your road trips are already in your photos.</Title>
    <Body delay={2450}>JourneyDeck reads only the dates and places of your photos, on this iPhone, and turns past trips into Memories.</Body>
    <View style={styles.spacer} />
    <PrimaryButton label="Look through my photos" onPress={() => void start()} delay={2600} />
    <QuietLink label="Skip and start using JourneyDeck" onPress={onFinish} delay={2700} />
  </Screen>;
}

// --- The flow --------------------------------------------------------------------------------------------------

export function FirstRunV4({ recordingMode = null, stage, onAdvance, onBack, onHaveAccount, onLocationContinue, onConnectAppleMusic, onConnectLastFm, lastFmUsername, onSkipMusic, onFinish }: {
  stage: V4Stage;
  /** The recording mode already saved, if any. */
  recordingMode?: RecordingMode | null;
  onAdvance: () => void;
  onBack: () => void;
  onHaveAccount: () => void;
  onLocationContinue: (mode: RecordingMode, drivesTesla: boolean | null) => Promise<void>;
  onConnectAppleMusic: () => Promise<void>;
  onConnectLastFm: (username: string) => Promise<void>;
  lastFmUsername: string;
  onSkipMusic: () => void;
  onFinish: () => void;
}) {
  const c = useRedesignColors();
  // Each step remounts, so its elements arrive in sequence; the page color underneath never moves.
  return <View key={stage} style={[styles.flow, { backgroundColor: c.page }]}>
    {stage === 'welcome' && <WelcomeStep onContinue={onAdvance} onHaveAccount={onHaveAccount} />}
    {stage === 'location' && <LocationStep onBack={onBack} onContinue={onLocationContinue} initialMode={recordingMode} />}
    {stage === 'music' && <MusicStep onBack={onBack} onConnectAppleMusic={onConnectAppleMusic} onConnectLastFm={onConnectLastFm} lastFmUsername={lastFmUsername} onContinue={onAdvance} onSkip={onSkipMusic} />}
    {stage === 'photos' && <PhotosStep onBack={onBack} onFinish={onFinish} />}
  </View>;
}

const styles = StyleSheet.create({
  flow: { flex: 1 },
  flex: { flex: 1 },
  screen: { flex: 1, overflow: 'hidden' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 16 },
  hidden: { opacity: 0 },
  center: { textAlign: 'center' },
  spacer: { flexGrow: 1, minHeight: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 5 },
  bar: { width: 22, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  title: { fontFamily: SERIF, fontSize: 32, lineHeight: 36, fontWeight: '600', letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 21 },
  kicker: { fontSize: 12, lineHeight: 15, fontWeight: '700', letterSpacing: 1.6 },
  cta: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '700' },
  linkWrap: { alignItems: 'center' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  linkText: { fontSize: 15, fontWeight: '600' },
  fine: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  welcomeRoute: { position: 'absolute', left: 0, right: 0, top: '51%' },
  welcomeCopy: { position: 'absolute', left: 24, right: 24, bottom: 0, gap: 16 },
  welcomeTitle: { fontFamily: SERIF, fontSize: 40, lineHeight: 44, fontWeight: '600', letterSpacing: -0.4 },
  welcomeBody: { fontSize: 16, lineHeight: 22 },
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18 },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 16, fontWeight: '600' },
  optionDetail: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkLarge: { width: 26, height: 26, borderRadius: 13 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  teslaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  teslaQuestion: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  segmentItem: { minWidth: 62, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '700' },
  teslaNote: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1 },
  teslaIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  card: { marginTop: 4, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontFamily: SERIF, fontSize: 20, fontWeight: '600' },
  cardMeta: { fontSize: 12 },
  cardKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 4 },
  timelineWrap: { marginTop: 14 },
  timeline: { position: 'absolute', left: 21, top: 18, bottom: 26, width: 2, overflow: 'hidden' },
  song: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  songFaded: { opacity: 0.55 },
  art: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  songTitle: { fontSize: 15, fontWeight: '600' },
  songArtist: { fontSize: 12, marginTop: 1 },
  mile: { fontSize: 12, fontWeight: '700' },
  providers: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  provider: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 8 },
  providerName: { flex: 1, fontSize: 16, fontWeight: '600' },
  providerDetail: { fontSize: 12, marginTop: 2 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 38 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { minHeight: 32, minWidth: 82, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pillTall: { minHeight: 44 },
  pillText: { fontSize: 13, fontWeight: '700' },
  lastFm: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  input: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16 },
  connected: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wave: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 14 },
  map: { width: '100%', aspectRatio: 1024 / 603 },
  mapCaption: { position: 'absolute', right: 14, bottom: 10, fontSize: 11, fontWeight: '600' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 6 },
  statRight: { alignItems: 'flex-end' },
  statValue: { fontFamily: SERIF, fontSize: 28, lineHeight: 32, fontWeight: '600' },
  statLabel: { fontSize: 12, marginTop: 2 },
  waveBar: { width: 3, height: 14, borderRadius: 2 },
});
