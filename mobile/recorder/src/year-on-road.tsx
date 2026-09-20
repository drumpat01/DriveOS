import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import Svg, { Circle, Path } from 'react-native-svg';
import { themeCatalog, type ThemeId, type ThemePalette } from './theme-catalog';
import { V3_MIDNIGHT_CANOPY_ENABLED } from './release-features';
import { headerImageSource } from './header-image-sources';
import { buildYearOnRoadRecap, recapRoutePath, type RecapRank, type YearOnRoadData, type YearOnRoadRecap } from './year-on-road-model';
import { useYearOnRoadAudio } from './year-on-road-audio';
import { musicForTheme, yearOnRoadMusic, type YearOnRoadMusicId } from './year-on-road-music';

export type { YearOnRoadData } from './year-on-road-model';
export type YearOnRoadViewerProps = {
  visible: boolean;
  data: YearOnRoadData;
  appTheme: ThemeId;
  premium: boolean;
  onClose: () => void;
  onUnlock: () => void;
  initialYear?: number;
  /** Disable while recorder/Shazam owns the audio session. */
  soundAllowed?: boolean;
  soundUnavailableReason?: string;
};
const CHAPTERS = ['Your year', 'The miles', 'Your rhythm', 'The long way', 'Your soundtrack', 'On repeat', 'The memories', 'Keep going'];
const CHAPTER_DURATION_MS = 10_000;
const THEMES: ThemeId[] = ['dark', 'light', 'redline', 'sakura'];
if (V3_MIDNIGHT_CANOPY_ENABLED) THEMES.push('midnight-canopy');
const AnimatedPath = Animated.createAnimatedComponent(Path);
const alpha = (hex: string, opacity: number) => `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
const number = (value: number, decimals = 0) => value.toLocaleString(undefined, { maximumFractionDigits: decimals });
function hours(minutes: number) { return `${number(minutes / 60, 1)} h`; }

/** Standalone local experience. Closing unmounts every animation and audio player. */
export function YearOnRoadViewer(props: YearOnRoadViewerProps) {
  return <Modal visible={props.visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={props.onClose}>
    {props.visible ? <YearOnRoadExperience {...props} /> : null}
  </Modal>;
}

function useReducedStoryMotion() {
  // Motion remains off until the platform answers; no surprise animation first frame.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; listener.remove(); };
  }, []);
  return reduced;
}

function YearOnRoadExperience({ data, appTheme, premium, onClose, onUnlock, initialYear, soundAllowed = true, soundUnavailableReason }: YearOnRoadViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const now = useRef(new Date()).current;
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [choice, setChoice] = useState<ThemeId | null>(null);
  const themeId = choice ?? appTheme, theme = themeCatalog[themeId], palette = theme.palette;
  const [musicChoice, setMusicChoice] = useState<YearOnRoadMusicId | null>(null);
  const musicId = musicChoice ?? musicForTheme(themeId), music = yearOnRoadMusic[musicId];
  const recap = useMemo(() => buildYearOnRoadRecap(data, year, now), [data, year, now]);
  const [chapter, setChapter] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [chooser, setChooser] = useState<'year' | 'theme' | 'music' | null>(null);
  const [held, setHeld] = useState(false);
  const reduced = useReducedStoryMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const progressFraction = useRef(0);
  const playingRef = useRef(false);
  const wide = width >= 760;
  const compact = height < 740;
  const canPlay = premium && recap.journeyCount > 0;
  const advancing = playing && foreground && !held && chooser == null && canPlay;
  const audioPlaying = playing && foreground && canPlay;
  playingRef.current = advancing;
  const audioAvailable = useYearOnRoadAudio(sound && premium && soundAllowed, audioPlaying, chapter, musicId);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state !== 'active') { setPlaying(false); setHeld(false); }
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    // VoiceOver users can read and navigate each chapter at their own pace.
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (mounted && enabled) setPlaying(false); }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => { if (enabled) setPlaying(false); });
    return () => { mounted = false; listener.remove(); };
  }, []);
  useEffect(() => {
    progress.stopAnimation(); progress.setValue(0); progressFraction.current = 0;
  }, [chapter, year, progress]);
  useEffect(() => {
    const listener = progress.addListener(({ value }) => { progressFraction.current = value; });
    if (!advancing) { progress.stopAnimation(); return () => progress.removeListener(listener); }
    const animation = Animated.timing(progress, { toValue: 1, duration: Math.max(1, (1 - progressFraction.current) * CHAPTER_DURATION_MS), easing: Easing.linear, useNativeDriver: false, isInteraction: false });
    animation.start(({ finished }) => {
      if (!finished || !playingRef.current) return;
      if (chapter < CHAPTERS.length - 1) setChapter(index => index + 1);
      else setPlaying(false);
    });
    return () => { animation.stop(); progress.removeListener(listener); };
  }, [advancing, chapter, year, progress]);

  function move(direction: -1 | 1) {
    setHeld(false);
    const next = chapter + direction;
    if (next < 0) { progress.setValue(0); progressFraction.current = 0; return; }
    if (next >= CHAPTERS.length) { setChapter(0); setPlaying(false); return; }
    setChapter(next);
  }
  const contentHeight = Math.max(350, height - insets.top - insets.bottom - (compact ? 230 : 255));
  return <View style={[styles.root, { backgroundColor: palette.page, paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityViewIsModal>
    <AmbientField palette={palette} moving={advancing && !reduced} />
    <View style={[styles.top, { maxWidth: wide ? 1060 : 680 }]}>
      <View style={styles.brand}><Text style={[styles.eyebrow, { color: palette.accent }]}>JOURNEYDECK PLUS</Text><Text style={[styles.brandTitle, { color: palette.text }]}>Your Year on the Road</Text></View>
      <IconButton name="xmark" label="Close year on the road" color={palette.text} onPress={onClose} />
    </View>
    <View style={[styles.toolbar, { maxWidth: wide ? 1060 : 680 }]}>
      <ChoiceButton label={`${recap.year}${recap.soFar ? ' · so far' : ''}`} onPress={() => { setChooser(chooser === 'year' ? null : 'year'); }} palette={palette} icon="calendar" />
      <ChoiceButton label={theme.name} onPress={() => { setChooser(chooser === 'theme' ? null : 'theme'); }} palette={palette} icon="paintpalette" />
      <ChoiceButton label={music.name} onPress={() => { setChooser(chooser === 'music' ? null : 'music'); }} palette={palette} icon="music.note.list" />
      <Pressable accessibilityRole="button" accessibilityLabel={!soundAllowed ? soundUnavailableReason ?? 'Sound is paused while journey recording is active' : sound ? 'Mute recap soundtrack' : 'Enable original recap soundtrack'} accessibilityState={{ selected: sound && soundAllowed, disabled: !soundAllowed }} disabled={!soundAllowed} onPress={() => setSound(value => !value)} style={[styles.soundButton, { borderColor: alpha(palette.line, 0.4), backgroundColor: sound && soundAllowed ? alpha(palette.accent, 0.15) : 'transparent' }]}>
        <SymbolView name={sound && soundAllowed && audioAvailable !== false ? 'speaker.wave.2.fill' : 'speaker.slash.fill'} tintColor={sound && soundAllowed ? palette.accent : palette.muted} style={styles.smallIcon} />
      </Pressable>
    </View>
    {chooser === 'year' ? <ScrollView horizontal style={styles.chooser} contentContainerStyle={styles.choices} showsHorizontalScrollIndicator={false}>
      {recap.years.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === recap.year }} onPress={() => { setYear(value); setChapter(0); setPlaying(false); setChooser(null); }} style={[styles.option, { borderColor: value === recap.year ? palette.accent : alpha(palette.line, 0.4), backgroundColor: palette.card }]}><Text style={[styles.optionText, { color: value === recap.year ? palette.accent : palette.text }]}>{value}{value === now.getFullYear() ? ' · so far' : ''}</Text></Pressable>)}
    </ScrollView> : chooser === 'theme' ? <View style={[styles.themeChooser, { backgroundColor: palette.card, borderColor: alpha(palette.line, 0.45) }]}>
      <Text style={[styles.caption, { color: palette.muted }]}>The look of this story is yours to choose.</Text>
      <View style={styles.themeChoices}>{THEMES.map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Use ${themeCatalog[id].name} for this recap`} accessibilityState={{ selected: id === themeId }} onPress={() => { setChoice(id); setChooser(null); }} style={[styles.themeOption, { backgroundColor: themeCatalog[id].palette.page, borderColor: id === themeId ? themeCatalog[id].palette.accent : themeCatalog[id].palette.line }]}>
        <View style={styles.swatches}>{[themeCatalog[id].palette.accent, themeCatalog[id].palette.coral, themeCatalog[id].palette.teal].map((color, i) => <View key={i} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
        <Text style={[styles.themeOptionName, { color: themeCatalog[id].palette.text }]}>{themeCatalog[id].name}</Text>
      </Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={() => { setChoice(null); setChooser(null); }} style={styles.matchApp}><Text style={{ color: palette.accent, fontWeight: '700' }}>Match app appearance{choice == null ? ' ✓' : ''}</Text></Pressable>
    </View> : chooser === 'music' ? <View style={[styles.themeChooser, { backgroundColor: palette.card, borderColor: alpha(palette.line, 0.45) }]}>
      <Text style={[styles.caption, { color: palette.muted }]}>Choose an original score, independently from the recap appearance.</Text>
      <View style={styles.themeChoices}>{THEMES.map(id => {
        const track = yearOnRoadMusic[id], trackTheme = themeCatalog[id];
        return <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Use ${track.name} for this recap`} accessibilityState={{ selected: id === musicId }} onPress={() => { setMusicChoice(id); setChooser(null); }} style={[styles.themeOption, { backgroundColor: trackTheme.palette.page, borderColor: id === musicId ? trackTheme.palette.accent : trackTheme.palette.line }]}>
          <View style={styles.swatches}>{[trackTheme.palette.accent, trackTheme.palette.coral, trackTheme.palette.teal].map((color, i) => <View key={i} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
          <Text style={[styles.themeOptionName, { color: trackTheme.palette.text }]}>{track.name}</Text>
          <Text style={[styles.musicDescription, { color: trackTheme.palette.muted }]}>{track.description} · {track.tempo} BPM</Text>
        </Pressable>;
      })}</View>
      <Pressable accessibilityRole="button" onPress={() => { setMusicChoice(null); setChooser(null); }} style={styles.matchApp}><Text style={{ color: palette.accent, fontWeight: '700' }}>Match recap appearance{musicChoice == null ? ' ✓' : ''}</Text></Pressable>
    </View> : null}
    {!premium ? <View style={styles.gate}><HeroArt themeId={themeId} palette={palette} moving={false} height={220} /><Text style={[styles.gateTitle, { color: palette.text }]}>A year worth reliving.</Text><Text style={[styles.gateText, { color: palette.muted }]}>Your miles, music and Memories, brought together in an animated story with JourneyDeck Plus.</Text><PrimaryButton label="Explore JourneyDeck Plus" onPress={onUnlock} palette={palette} /></View>
      : !recap.journeyCount ? <View style={styles.gate}><HeroArt themeId={themeId} palette={palette} moving={false} height={200} /><Text style={[styles.gateTitle, { color: palette.text }]}>The road is waiting.</Text><Text style={[styles.gateText, { color: palette.muted }]}>No saved journeys start in {recap.year}. Choose another year, or record a journey to begin your story.</Text><PrimaryButton label="Choose a year" onPress={() => setChooser('year')} palette={palette} /></View>
        : <>
          <View style={[styles.progressRow, { maxWidth: wide ? 1060 : 680 }]} accessibilityLabel={`Chapter ${chapter + 1} of ${CHAPTERS.length}: ${CHAPTERS[chapter]}`}>
            {CHAPTERS.map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Go to ${label}`} onPress={() => setChapter(index)} style={styles.progressHit}>
              <View style={[styles.progressTrack, { backgroundColor: alpha(palette.line, 0.28) }]}><Animated.View style={[styles.progressFill, { backgroundColor: palette.accent, width: index < chapter ? '100%' : index === chapter ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }]} /></View>
            </Pressable>)}
          </View>
          <ScrollView key={`${recap.year}:${chapter}`} style={styles.storyScroll} contentContainerStyle={[styles.storyContent, { minHeight: contentHeight, maxWidth: wide ? 1060 : 680 }]} showsVerticalScrollIndicator={false} onTouchStart={() => setHeld(true)} onTouchEnd={() => setHeld(false)} onTouchCancel={() => setHeld(false)}>
            <Entrance key={`${recap.year}:${chapter}:${themeId}`} reduced={reduced} moving={advancing}>
              <ChapterContent recap={recap} chapter={chapter} themeId={themeId} palette={palette} wide={wide} compact={compact} moving={advancing && !reduced} reduced={reduced} />
            </Entrance>
          </ScrollView>
          <View style={[styles.bottom, { maxWidth: wide ? 1060 : 680 }]}>
            <View style={styles.chapterLabel}><Text style={[styles.eyebrow, { color: palette.accent }]}>{String(chapter + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}</Text><Text style={[styles.caption, { color: palette.muted }]}>{held ? 'Holding your place' : !playing ? 'Ready when you are' : CHAPTERS[chapter]}</Text></View>
            <View style={styles.playback}><IconButton name="chevron.left" label="Previous chapter" color={palette.text} onPress={() => move(-1)} /><Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause recap' : 'Play recap'} onPress={() => { if (chapter === CHAPTERS.length - 1 && progressFraction.current >= 0.99) setChapter(0); setPlaying(value => !value); }} style={[styles.playButton, { backgroundColor: palette.accent }]}><SymbolView name={playing ? 'pause.fill' : 'play.fill'} tintColor={palette.onAccent} style={styles.playIcon} /><Text style={[styles.playText, { color: palette.onAccent }]}>{playing ? 'Pause' : chapter === CHAPTERS.length - 1 && progressFraction.current >= 0.99 ? 'Replay' : 'Play story'}</Text></Pressable><IconButton name={chapter === CHAPTERS.length - 1 ? 'arrow.counterclockwise' : 'chevron.right'} label={chapter === CHAPTERS.length - 1 ? 'Replay from the start' : 'Next chapter'} color={palette.text} onPress={() => move(1)} /></View>
            <Text style={[styles.audioNote, { color: palette.muted }]}>{!soundAllowed ? soundUnavailableReason ?? 'Sound is paused while journey recording is active.' : audioAvailable === false && sound ? 'Sound is unavailable in this app version. Your story is ready to read.' : sound ? `${music.name} · original JourneyDeck score` : `${music.name} selected · tap the speaker for sound`}</Text>
          </View>
        </>}
  </View>;
}

function ChapterContent({ recap, chapter, themeId, palette: p, wide, compact, moving, reduced }: {
  recap: YearOnRoadRecap; chapter: number; themeId: ThemeId; palette: ThemePalette; wide: boolean; compact: boolean; moving: boolean; reduced: boolean;
}) {
  const kicker = (text: string) => <Text style={[styles.eyebrow, { color: p.accent }]}>{text}</Text>;
  const heading = (text: string) => <Text style={[styles.headline, wide && styles.headlineWide, { color: p.text }]}>{text}</Text>;
  const body = (text: string) => <Text style={[styles.body, { color: p.muted }]}>{text}</Text>;
  const durationNote = recap.measuredDurationJourneys < recap.journeyCount ? `Time saved for ${recap.measuredDurationJourneys} of ${recap.journeyCount} journeys.` : 'From your saved journey durations.';
  const artHeight = wide ? 330 : compact ? 180 : 235;
  if (chapter === 0) return <View style={[styles.chapter, wide && styles.split]}>
    <View style={[styles.column, wide && styles.wideColumn]}>{kicker(recap.soFar ? 'THE STORY SO FAR' : 'YOUR YEAR, REMEMBERED')}<Text style={[styles.year, wide && { fontSize: 132 }, { color: p.accent }]}>{recap.year}</Text>{heading('You made\nyour own way.')}{body(`${number(recap.journeyCount)} saved journeys. ${number(recap.activeDays)} days on the road. A story only you could make.`)}<View style={[styles.rule, { backgroundColor: p.accent }]} />{kicker('MILES. MUSIC. MEMORIES.')}</View>
    <View style={[styles.column, wide && styles.wideColumn]}><HeroArt themeId={themeId} palette={p} moving={moving} height={artHeight + 30} /><Text style={[styles.finePrint, { color: p.muted }]}>{recap.coverageNote ?? 'Made from the journeys saved on this device. Choose Play story, or move through at your own pace.'}</Text></View>
  </View>;
  if (chapter === 1) return <View style={[styles.chapter, wide && styles.split]}><View style={[styles.column, wide && styles.wideColumn]}>{kicker('EVERY MILE COUNTS')}{heading('Look how far\nyou went.')}<Counter value={recap.miles} decimals={recap.miles < 100 ? 1 : 0} suffix=" mi" palette={p} reduced={reduced} moving={moving} />{body('Recorded miles. Familiar roads and new turns, all part of your year.')}<View style={styles.metricRow}><Metric value={number(recap.journeyCount)} label="saved journeys" palette={p} /><Metric value={hours(recap.drivingMinutes)} label="driving time" palette={p} /></View><Text style={[styles.finePrint, { color: p.muted }]}>{durationNote}</Text></View><View style={[styles.column, wide && styles.wideColumn]}><RouteArt journey={recap.longestJourney} palette={p} reduced={reduced} moving={moving} /><Text style={[styles.caption, { color: p.muted }]}>A shape from your longest recorded journey.</Text></View></View>;
  if (chapter === 2) {
    const favoriteTime = recap.dayparts.reduce((best, part) => part.journeys > best.journeys ? part : best, recap.dayparts[0]);
    const max = Math.max(1, ...recap.months.map(month => month.journeys));
    return <View style={styles.chapter}>{kicker('YOU FOUND YOUR RHYTHM')}{heading(`${recap.busiestMonth ?? 'This year'} kept you moving.`)}{body(`${number(recap.activeDays)} different days held a journey. ${favoriteTime.label} had the most starts.`)}<View style={[styles.chartCard, { backgroundColor: alpha(p.card, 0.82), borderColor: alpha(p.line, 0.35) }]}><View style={styles.monthBars}>{recap.months.map((month, index) => <MonthBar key={month.label} label={month.label} value={month.journeys} ratio={month.journeys / max} index={index} palette={p} reduced={reduced} moving={moving} />)}</View><Text style={[styles.chartCaption, { color: p.muted }]}>Journey starts by month · {recap.year}{recap.soFar ? ' so far' : ''}</Text></View><View style={[styles.metricRow, { flexWrap: 'wrap' }]}>{recap.dayparts.map(part => <Metric key={part.label} value={number(part.journeys)} label={part.label.toLocaleLowerCase()} palette={p} />)}</View></View>;
  }
  if (chapter === 3) {
    const longest = recap.longestJourney;
    return <View style={[styles.chapter, wide && styles.split]}><View style={[styles.column, wide && styles.wideColumn]}>{kicker('A JOURNEY TO REMEMBER')}{heading('One journey\nstood out.')}<Counter value={longest?.miles ?? 0} suffix=" mi" decimals={1} palette={p} reduced={reduced} moving={moving} />{body(longest ? `${longest.startingLocation || 'Recorded start'} → ${longest.endingLocation || 'Recorded destination'}` : 'No distance was saved for these journeys.')}{longest ? <Text style={[styles.date, { color: p.accent }]}>{new Date(longest.startedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}{longest.durationMinutes != null && Number.isFinite(longest.durationMinutes) && longest.durationMinutes >= 0 ? ` · ${hours(longest.durationMinutes)}` : ''}</Text> : null}</View><View style={[styles.column, wide && styles.wideColumn]}><RouteArt journey={longest} palette={p} reduced={reduced} moving={moving} />{body('Your longest journey by recorded distance.')}</View></View>;
  }
  if (chapter === 4) return <View style={[styles.chapter, wide && styles.split]}><View style={[styles.column, wide && styles.wideColumn]}>{kicker('THE SOUND OF YOUR YEAR')}{heading(recap.topArtists.length ? `${recap.topArtists[0].name}\ncame along.` : 'Every road has\nroom for music.')}<View style={styles.metricRow}><Metric value={number(recap.songPlays)} label="matched song plays" palette={p} /><Metric value={number(recap.distinctSongs)} label="different songs" palette={p} /></View>{body(recap.songPlays ? `Music was matched to ${number(recap.journeysWithMusic)} of your journeys. These are the artists that came up most.` : 'No song plays have been matched to journeys in this year yet. Future listening can become part of your story.')}</View><View style={[styles.column, wide && styles.wideColumn]}><AlbumFan rows={recap.topArtists} palette={p} moving={moving} /><RankList rows={recap.topArtists.slice(0, 3)} palette={p} /></View></View>;
  if (chapter === 5) return <View style={[styles.chapter, wide && styles.split]}><View style={[styles.column, wide && styles.wideColumn]}>{kicker('THE ON-REPEAT CHAPTER')}{heading(recap.topSongs.length ? 'Some songs\nfound their way back.' : 'A soundtrack\nstill to come.')}<RankList rows={recap.topSongs} palette={p} includeArtist /><Text style={[styles.finePrint, { color: p.muted }]}>Ranked by saved matched plays. The recap's original score is separate from your listening history.</Text></View><View style={[styles.column, wide && styles.wideColumn]}><SpinningRecord row={recap.topSongs[0]} palette={p} moving={moving} /><View style={styles.metricRow}><Metric value={hours(recap.knownSongMinutes)} label="known track durations" palette={p} /></View>{body(recap.songsWithDuration ? `Duration metadata is saved for ${number(recap.songsWithDuration)} of ${number(recap.songPlays)} plays. This is not measured listening time.` : 'Track duration data is not available for this year.')}</View></View>;
  if (chapter === 6) return <View style={[styles.chapter, wide && styles.split]}><View style={[styles.column, wide && styles.wideColumn]}>{kicker('MORE THAN A DESTINATION')}{heading(recap.memories.length ? 'You kept\nthe good parts.' : 'Some moments\nare still waiting.')}<Counter value={recap.memories.length} palette={p} reduced={reduced} moving={moving} />{body(recap.memories.length ? `Memor${recap.memories.length === 1 ? 'y includes' : 'ies include'} journeys from ${recap.year}. Little chapters in a bigger story.` : 'No Memories include journeys from this year yet. Group a few favorite journeys to keep the moments together.')}<View style={styles.memoryNames}>{recap.memories.slice(0, 3).map(memory => <View key={memory.id} style={[styles.memoryName, { borderColor: alpha(p.line, 0.35) }]}><Text style={[styles.memoryNameText, { color: p.text }]} numberOfLines={2}>{memory.name}</Text><Text style={[styles.caption, { color: p.muted }]}>{number(memory.journeyIds.length)} journeys in {recap.year}</Text></View>)}</View></View><View style={[styles.column, wide && styles.wideColumn]}><MemoryFan recap={recap} themeId={themeId} palette={p} moving={moving} /></View></View>;
  return <View style={[styles.chapter, styles.finale]}>{kicker(recap.soFar ? 'AND THERE IS MORE AHEAD' : 'ONE YEAR. YOUR STORY.')}{heading('Keep taking\nthe scenic route.')}<View style={styles.finalMetrics}><Metric value={`${number(recap.miles)} mi`} label="recorded miles" palette={p} /><Metric value={number(recap.journeyCount)} label="journeys" palette={p} /><Metric value={number(recap.songPlays)} label="matched plays" palette={p} /><Metric value={number(recap.memories.length)} label="Memories" palette={p} /></View><HeroArt themeId={themeId} palette={p} moving={moving} height={compact ? 150 : 210} /><Text style={[styles.finalYear, { color: p.accent }]}>{recap.year}{recap.soFar ? ' · SO FAR' : ''}</Text><Text style={[styles.finePrint, { color: p.muted }]}>Built from your saved journeys, grouped by the year each journey started. Your next chapter is out there.</Text></View>;
}

function Entrance({ children, reduced, moving }: { children: ReactNode; reduced: boolean; moving: boolean }) {
  const entrance = useRef(new Animated.Value(reduced || !moving ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !moving) { entrance.setValue(1); return; }
    const animation = Animated.timing(entrance, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [entrance, reduced, moving]);
  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>{children}</Animated.View>;
}

function useDrift(moving: boolean, duration = 11_000) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!moving) { drift.stopAnimation(); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start(); return () => animation.stop();
  }, [drift, moving, duration]);
  return drift;
}
function AmbientField({ palette, moving }: { palette: ThemePalette; moving: boolean }) {
  const drift = useDrift(moving, 14_000);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
    <Animated.View style={[styles.orb, { backgroundColor: alpha(palette.accent, 0.075), top: '8%', right: '-20%', transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 85] }) }, { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }]} />
    <Animated.View style={[styles.orb, { backgroundColor: alpha(palette.teal, 0.055), bottom: '2%', left: '-25%', transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) }] }]} />
    {Array.from({ length: 12 }, (_, index) => <Animated.View key={index} style={[styles.spark, { left: `${(index * 31 + 9) % 96}%`, top: `${(index * 17 + 7) % 90}%`, backgroundColor: index % 3 ? palette.accent : palette.teal, opacity: drift.interpolate({ inputRange: [0, 1], outputRange: index % 2 ? [0.14, 0.4] : [0.35, 0.12] }), transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 ? -18 : 18] }) }] }]} />)}
  </View>;
}
function HeroArt({ themeId, palette, moving, height }: { themeId: ThemeId; palette: ThemePalette; moving: boolean; height: number }) {
  const drift = useDrift(moving);
  const source = headerImageSource(require('../assets/cinematic-home-main-photo-v1.jpg'), themeId);
  return <View style={[styles.hero, { height }]} accessible={false}>
    <Animated.Image source={source} resizeMode="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.02, 1.11] }) }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] }]} />
    <LinearGradient colors={[alpha(palette.page, 0.03), alpha(palette.page, 0.06), palette.page]} locations={[0, 0.58, 1]} style={StyleSheet.absoluteFill} />
  </View>;
}
function Counter({ value, suffix = '', decimals = 0, palette, reduced, moving }: { value: number; suffix?: string; decimals?: number; palette: ThemePalette; reduced: boolean; moving: boolean }) {
  const [display, setDisplay] = useState(reduced || !moving ? value : 0);
  const displayed = useRef(display);
  useEffect(() => {
    if (reduced || !moving) { displayed.current = value; setDisplay(value); return; }
    const from = displayed.current;
    if (from === value) return;
    const start = Date.now();
    const timer = setInterval(() => { const t = Math.min(1, (Date.now() - start) / 1150); displayed.current = from + (value - from) * (1 - Math.pow(1 - t, 3)); setDisplay(displayed.current); if (t === 1) clearInterval(timer); }, 40);
    return () => clearInterval(timer);
  }, [value, reduced, moving]);
  return <Text style={[styles.counter, { color: palette.accent }]} adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1} accessibilityLabel={`${number(value, decimals)}${suffix}`}>{number(display, decimals)}<Text style={styles.counterUnit}>{suffix}</Text></Text>;
}
function Metric({ value, label, palette }: { value: string; label: string; palette: ThemePalette }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: palette.text }]} adjustsFontSizeToFit numberOfLines={1}>{value}</Text><Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text></View>;
}
function RouteArt({ journey, palette, moving, reduced }: { journey: YearOnRoadRecap['longestJourney']; palette: ThemePalette; moving: boolean; reduced: boolean }) {
  const path = useMemo(() => recapRoutePath(journey?.route?.coordinates ?? []), [journey]);
  const reveal = useRef(new Animated.Value(reduced || !moving ? 1 : 0)).current;
  const drift = useDrift(moving, 7000);
  const length = useMemo(() => {
    const pairs = (path?.match(/-?\d+\.?\d*,-?\d+\.?\d*/g) ?? []).map(pair => pair.split(',').map(Number));
    return Math.max(1, pairs.reduce((sum, point, index) => index ? sum + Math.hypot(point[0] - pairs[index - 1][0], point[1] - pairs[index - 1][1]) : sum, 0));
  }, [path]);
  useEffect(() => {
    if (reduced || !moving) { reveal.setValue(1); return; }
    const animation = Animated.timing(reveal, { toValue: 1, duration: 1650, easing: Easing.inOut(Easing.cubic), useNativeDriver: false, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [reveal, path, reduced, moving]);
  return <View style={[styles.routeCard, { backgroundColor: alpha(palette.card, 0.78), borderColor: alpha(palette.line, 0.3) }]}>
    <View style={styles.routeLabel}><Text style={[styles.eyebrow, { color: palette.accent }]}>{path ? 'YOUR ROUTE, REMEMBERED' : 'THE ROAD AHEAD'}</Text><SymbolView name="location.north.line" tintColor={palette.accent} style={styles.smallIcon} /></View>
    <Animated.View style={{ transform: [{ scale: drift.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.03] }) }] }} accessible={false}>
      <Svg viewBox="0 0 320 220" width="100%" height={220}>
        {Array.from({ length: 7 }, (_, i) => <Path key={i} d={`M0 ${i * 36} H320 M${i * 54} 0 V220`} stroke={alpha(palette.line, 0.09)} strokeWidth={1} />)}
        <Circle cx={160} cy={110} r={82} stroke={alpha(palette.line, 0.13)} strokeWidth={1} fill="none" />
        <Path d={path ?? 'M20 188 C80 190 45 110 135 125 S170 32 300 36'} stroke={alpha(palette.accent, 0.16)} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <AnimatedPath d={path ?? 'M20 188 C80 190 45 110 135 125 S170 32 300 36'} stroke={palette.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={path ? [length, length] : undefined} strokeDashoffset={path ? reveal.interpolate({ inputRange: [0, 1], outputRange: [length, 0] }) : undefined} />
      </Svg>
    </Animated.View>
    <Text style={[styles.finePrint, { color: palette.muted }]}>{path ? 'Private route silhouette · not to scale' : 'Decorative road illustration · route geometry is unavailable'}</Text>
  </View>;
}
function MonthBar({ label, value, ratio, index, palette, reduced, moving }: { label: string; value: number; ratio: number; index: number; palette: ThemePalette; reduced: boolean; moving: boolean }) {
  const grow = useRef(new Animated.Value(reduced || !moving ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !moving) { grow.setValue(1); return; }
    const animation = Animated.timing(grow, { toValue: 1, delay: index * 45, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [grow, index, reduced, moving]);
  return <View style={styles.monthColumn} accessible accessibilityLabel={`${label}, ${value} journeys`}><View style={styles.barWell}><Animated.View style={[styles.bar, { height: Math.max(2, ratio * 150), backgroundColor: index % 3 === 1 ? palette.teal : palette.accent, opacity: value ? 0.95 : 0.15, transformOrigin: 'bottom', transform: [{ scaleY: grow }] }]} /></View><Text style={[styles.monthLabel, { color: palette.muted }]}>{label.slice(0, 1)}</Text></View>;
}
function AlbumArt({ uri, palette, style }: { uri?: string | null; palette: ThemePalette; style?: object }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View style={[styles.albumImage, { backgroundColor: palette.inset }, style]}>{uri && !failed ? <Image source={{ uri }} resizeMode="cover" onError={() => setFailed(true)} style={StyleSheet.absoluteFill} /> : <SymbolView name="music.note" tintColor={palette.accent} style={{ width: 46, height: 46 }} />}</View>;
}
function AlbumFan({ rows, palette, moving }: { rows: RecapRank[]; palette: ThemePalette; moving: boolean }) {
  const drift = useDrift(moving, 6000);
  return <View style={styles.albumFan} accessible={false}>{[0, 1, 2].map(index => <Animated.View key={index} style={[styles.albumFloating, { zIndex: index === 1 ? 3 : 1, left: `${index * 23 + 5}%`, top: index === 1 ? 35 : 65, borderColor: alpha(palette.chrome, 0.6), transform: [{ rotate: `${(index - 1) * 14}deg` }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, index === 1 ? -12 : 8] }) }] }]}><AlbumArt uri={rows[index]?.artworkUrl} palette={palette} style={{ width: '100%', height: '100%' }} /></Animated.View>)}</View>;
}
function SpinningRecord({ row, palette, moving }: { row?: RecapRank; palette: ThemePalette; moving: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!moving) { spin.stopAnimation(); return; }
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 18_000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    animation.start(); return () => animation.stop();
  }, [spin, moving]);
  return <View style={styles.recordStage} accessible={false}><Animated.View style={[styles.record, { borderColor: alpha(palette.chrome, 0.6), transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>{[0, 1, 2, 3, 4].map(index => <View key={index} style={[styles.groove, { inset: 12 + index * 14, borderColor: alpha(palette.chrome, 0.15) }]} />)}<AlbumArt uri={row?.artworkUrl} palette={palette} style={styles.recordLabel} /><View style={[styles.recordHole, { backgroundColor: palette.page }]} /></Animated.View></View>;
}
function RankList({ rows, palette, includeArtist = false }: { rows: RecapRank[]; palette: ThemePalette; includeArtist?: boolean }) {
  return <View style={styles.ranks}>{rows.map((row, index) => <View key={`${row.name}:${row.artist ?? ''}`} style={[styles.rank, { borderColor: alpha(palette.line, 0.22) }]}><Text style={[styles.rankNumber, { color: palette.accent }]}>{String(index + 1).padStart(2, '0')}</Text><AlbumArt uri={row.artworkUrl} palette={palette} style={styles.rankArt} /><View style={styles.rankBody}><Text style={[styles.rankName, { color: palette.text }]} numberOfLines={2}>{row.name}</Text>{includeArtist ? <Text style={[styles.caption, { color: palette.muted }]} numberOfLines={1}>{row.artist}</Text> : null}</View><Text style={[styles.rankPlays, { color: palette.accent }]}>{number(row.plays)}<Text style={[styles.caption, { color: palette.muted }]}>{row.plays === 1 ? ' play' : ' plays'}</Text></Text></View>)}</View>;
}
function MemoryFan({ recap, themeId, palette, moving }: { recap: YearOnRoadRecap; themeId: ThemeId; palette: ThemePalette; moving: boolean }) {
  const drift = useDrift(moving, 8000);
  const fallback = headerImageSource(require('../assets/cinematic-memory-polaroids-photo-v1.jpg'), themeId);
  return <View style={styles.memoryFan} accessible={false}>{[0, 1, 2].map(index => {
    const memory = recap.memories[index];
    return <Animated.View key={index} style={[styles.memoryPhoto, { zIndex: 3 - index, left: `${9 + index * 13}%`, top: 18 + index * 27, borderColor: palette.chrome, backgroundColor: palette.card, transform: [{ rotate: `${-10 + index * 11}deg` }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 ? 10 : -9] }) }] }]}><MemoryPicture source={memory?.photoUri ? { uri: memory.photoUri } : fallback} fallback={fallback} /><Text style={[styles.polaroidLabel, { color: palette.text }]} numberOfLines={1}>{memory?.name || (index ? 'The moments between' : `${recap.year} on the road`)}</Text></Animated.View>;
  })}</View>;
}
function MemoryPicture({ source, fallback }: { source: ImageSourcePropType; fallback: ImageSourcePropType }) {
  const [failed, setFailed] = useState(false);
  const identity = JSON.stringify(source);
  useEffect(() => setFailed(false), [identity]);
  return <Image source={failed ? fallback : source} onError={() => setFailed(true)} resizeMode="cover" style={styles.memoryPicture} />;
}
function IconButton({ name, label, color, onPress }: { name: React.ComponentProps<typeof SymbolView>['name']; label: string; color: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}><SymbolView name={name} tintColor={color} style={styles.smallIcon} /></Pressable>;
}
function ChoiceButton({ label, onPress, palette, icon }: { label: string; onPress: () => void; palette: ThemePalette; icon: React.ComponentProps<typeof SymbolView>['name'] }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choiceButton, { borderColor: alpha(palette.line, 0.4) }]}><SymbolView name={icon} tintColor={palette.accent} style={styles.tinyIcon} /><Text style={[styles.choiceLabel, { color: palette.text }]} numberOfLines={1}>{label}</Text><SymbolView name="chevron.down" tintColor={palette.muted} style={styles.chevron} /></Pressable>;
}
function PrimaryButton({ label, onPress, palette }: { label: string; onPress: () => void; palette: ThemePalette }) { return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.primary, { backgroundColor: palette.accent }]}><Text style={[styles.playText, { color: palette.onAccent }]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' }, top: { width: '100%', alignSelf: 'center', paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { flex: 1 }, brandTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2.1 },
  toolbar: { width: '100%', alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 20, gap: 7, marginTop: 15 }, choiceButton: { borderWidth: 1, borderRadius: 22, minHeight: 44, minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 5 },
  choiceLabel: { fontSize: 12, fontWeight: '700', flexShrink: 1 }, tinyIcon: { width: 13, height: 13 }, chevron: { width: 10, height: 10 }, smallIcon: { width: 20, height: 20 }, soundButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  chooser: { flexGrow: 0, maxHeight: 76, marginTop: 10 }, choices: { paddingHorizontal: 20, gap: 9, paddingVertical: 4 }, option: { minHeight: 44, paddingHorizontal: 19, justifyContent: 'center', borderRadius: 22, borderWidth: 1 }, optionText: { fontWeight: '700', fontSize: 14 },
  themeChooser: { marginHorizontal: 20, marginTop: 12, padding: 15, borderRadius: 22, borderWidth: 1, gap: 12, maxWidth: 720, alignSelf: 'center', width: '90%' }, themeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, themeOption: { flexBasis: '46%', flexGrow: 1, borderRadius: 15, borderWidth: 1.5, padding: 12, gap: 9 }, swatches: { flexDirection: 'row', gap: 5 }, swatch: { width: 15, height: 15, borderRadius: 8 }, themeOptionName: { fontSize: 12, fontWeight: '700' }, matchApp: { minHeight: 40, justifyContent: 'center' },
  musicDescription: { fontSize: 10, lineHeight: 14 },
  progressRow: { flexDirection: 'row', width: '100%', alignSelf: 'center', paddingHorizontal: 21, gap: 5, marginTop: 7 }, progressHit: { flex: 1, paddingVertical: 14 }, progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 2 },
  storyScroll: { flex: 1 }, storyContent: { width: '100%', alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 22 },
  chapter: { gap: 18 }, split: { flexDirection: 'row', alignItems: 'center', gap: 40 }, column: { minWidth: 0, gap: 17 }, wideColumn: { flex: 1 }, headline: { fontSize: 39, lineHeight: 42, fontWeight: '800', letterSpacing: -1.3 }, headlineWide: { fontSize: 53, lineHeight: 57 }, body: { fontSize: 16, lineHeight: 23 }, caption: { fontSize: 11, lineHeight: 16 }, finePrint: { fontSize: 11, lineHeight: 17 }, year: { fontSize: 102, lineHeight: 112, fontWeight: '900', letterSpacing: -5, fontVariant: ['tabular-nums'] }, rule: { height: 3, width: 44, borderRadius: 2, marginVertical: 3 },
  hero: { overflow: 'hidden', borderRadius: 24, width: '100%' }, counter: { fontSize: 70, fontWeight: '900', letterSpacing: -2.6, fontVariant: ['tabular-nums'] }, counterUnit: { fontSize: 27, letterSpacing: -0.5 }, metricRow: { flexDirection: 'row', gap: 24, marginTop: 5 }, metric: { flex: 1, minWidth: 70, gap: 4 }, metricValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }, metricLabel: { fontSize: 11, lineHeight: 16 }, date: { fontSize: 14, fontWeight: '700' },
  chartCard: { padding: 20, borderRadius: 25, borderWidth: 1, marginVertical: 15 }, monthBars: { height: 179, flexDirection: 'row', gap: 7, alignItems: 'flex-end' }, monthColumn: { flex: 1, gap: 9, alignItems: 'center' }, barWell: { height: 150, width: '100%', justifyContent: 'flex-end' }, bar: { width: '100%', borderRadius: 5 }, monthLabel: { fontSize: 9, fontWeight: '700' }, chartCaption: { fontSize: 11, marginTop: 20 },
  routeCard: { borderRadius: 27, borderWidth: 1, padding: 19, gap: 12, marginVertical: 10 }, routeLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  albumFan: { height: 220, position: 'relative', marginVertical: 8 }, albumFloating: { position: 'absolute', width: '43%', aspectRatio: 1, borderWidth: 1, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, albumImage: { width: 120, height: 120, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ranks: { gap: 3 }, rank: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 62, borderBottomWidth: 1, paddingVertical: 9 }, rankNumber: { fontSize: 12, fontWeight: '800' }, rankArt: { width: 40, height: 40, borderRadius: 8 }, rankBody: { flex: 1, gap: 3 }, rankName: { fontSize: 14, fontWeight: '700' }, rankPlays: { fontSize: 15, fontWeight: '800' },
  recordStage: { alignItems: 'center', justifyContent: 'center', marginVertical: 10 }, record: { width: 225, height: 225, borderRadius: 113, backgroundColor: '#15161d', borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, groove: { position: 'absolute', borderRadius: 120, borderWidth: 1 }, recordLabel: { width: 82, height: 82, borderRadius: 42 }, recordHole: { position: 'absolute', width: 10, height: 10, borderRadius: 6 },
  memoryNames: { gap: 10 }, memoryName: { borderBottomWidth: 1, paddingBottom: 11, gap: 5 }, memoryNameText: { fontSize: 16, fontWeight: '700' }, memoryFan: { height: 340, position: 'relative', marginVertical: 8 }, memoryPhoto: { position: 'absolute', width: '64%', height: 232, padding: 9, borderWidth: 1, borderRadius: 9, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 17, shadowOffset: { width: 0, height: 8 } }, memoryPicture: { width: '100%', height: 177, borderRadius: 3 }, polaroidLabel: { fontSize: 11, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  finale: { alignItems: 'stretch' }, finalMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginVertical: 10 }, finalYear: { fontSize: 19, letterSpacing: 3, fontWeight: '900' },
  bottom: { paddingHorizontal: 21, paddingTop: 11, width: '100%', alignSelf: 'center' }, chapterLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, playback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, playButton: { minHeight: 44, minWidth: 155, borderRadius: 25, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, playIcon: { width: 14, height: 14 }, playText: { fontSize: 14, fontWeight: '800' }, audioNote: { fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 10 },
  orb: { position: 'absolute', width: 470, height: 470, borderRadius: 250 }, spark: { position: 'absolute', width: 3, height: 3, borderRadius: 2 },
  gate: { padding: 28, gap: 22, flex: 1, justifyContent: 'center', maxWidth: 650, alignSelf: 'center', width: '100%' }, gateTitle: { fontSize: 34, fontWeight: '800', letterSpacing: -1 }, gateText: { fontSize: 16, lineHeight: 24 }, primary: { alignItems: 'center', justifyContent: 'center', padding: 17, borderRadius: 28, minHeight: 48 },
});
