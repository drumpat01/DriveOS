import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator, Alert, Animated, Easing, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

import type { JourneyDetail, JourneySummary, MusicDashboardData, SoundtrackTrack } from './app-data';
import type { MusicProvider } from './music-preferences';
import { musicTrackDestination } from './music-destination';
import { buildMusicArchive, filterMusicArchive, topArchiveTracks } from './library-model';

export type MusicDashboardState = {
  status: 'loading' | 'ready' | 'error';
  data: MusicDashboardData | null;
  message?: string;
};

const colors = {
  page: '#05030b', panel: '#0d0818', panelRaised: '#110a20', border: '#3c2055', text: '#f7f1fa', muted: '#95899f',
  coral: '#ff6c50', pink: '#ff3f82', purple: '#9b61ff', blue: '#4d93ff', mint: '#45e4ae', track: '#291735',
};

function number(value: number, digits = 1) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function serviceName(provider: MusicProvider) {
  return provider === 'apple-music' ? 'APPLE MUSIC ARCHIVE' : provider === 'lastfm' ? 'SPOTIFY VIA LAST.FM' : 'RECOGNITION ARCHIVE';
}

async function openTrack(track: SoundtrackTrack, provider: MusicProvider) {
  const destination = musicTrackDestination(track, provider);
  if (!destination) return;
  try { await Linking.openURL(destination); }
  catch { Alert.alert('Music app unavailable', `JourneyDeck could not open ${provider === 'lastfm' ? 'Spotify' : 'Apple Music'} right now.`); }
}

export function MusicScreen({ state, provider, journeys, details, onJourney, onRefresh }: { state: MusicDashboardState; provider: MusicProvider; journeys: JourneySummary[]; details: JourneyDetail[]; onJourney: (id: string) => void; onRefresh: () => Promise<void> }) {
  const data = state.data;
  const latest = data?.recentSelections[0] ?? null;
  const canOpenTracks = provider === 'apple-music' || provider === 'lastfm';
  const insets = useSafeAreaInsets();
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');
  const archive = useMemo(() => buildMusicArchive(journeys, details), [journeys, details]);
  const visibleArchive = useMemo(() => filterMusicArchive(archive, archiveQuery), [archive, archiveQuery]);
  const topTracks = useMemo(() => topArchiveTracks(archive), [archive]);
  const refreshFromGesture = useCallback(async () => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try { await onRefresh(); }
    finally { setManualRefreshing(false); }
  }, [manualRefreshing, onRefresh]);
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 132 }]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={() => void refreshFromGesture()} tintColor={colors.pink} />}
    >
      <MusicAtmosphere />
      <View style={musicHeaderStyles.heroCardHeader}>
        <Image source={require('../assets/music-header-hero.png')} style={musicHeaderStyles.heroHeaderImage} resizeMode="cover" />
      </View>

      {state.status === 'loading' && !data ? <View style={styles.loading}><ActivityIndicator color={colors.pink} /><Text style={styles.loadingText}>Building your soundtrack…</Text></View> : null}
      {state.status === 'error' ? <View style={styles.notice}><Text style={styles.noticeTitle}>Music archive unavailable</Text><Text style={styles.noticeBody}>{state.message}</Text><Pressable onPress={() => void onRefresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}

      {data ? <>
        <Pressable disabled={!latest || !canOpenTracks} onPress={() => latest && void openTrack(latest, provider)} style={styles.hero}>
          <MusicHeroHaze />
          <VinylHeroRecord artworkUrl={latest?.artworkUrl} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>THE ROAD SOUNDS BETTER WITH MUSIC</Text>
            <Text style={styles.heroTitle}>YOUR LIFE HAS A</Text>
            <Text style={styles.heroAccent}>SOUNDTRACK</Text>
            <Waveform />
            <Text style={styles.heroService}>{serviceName(provider)}</Text>
          </View>
        </Pressable>

        <View style={styles.metricGrid}>
          <Metric symbol="♜" label="Miles with music" value={number(data.metrics.milesWithMusic)} detail="all time" accent={colors.coral} />
          <Metric symbol="Ω" label="Listening hours" value={number(data.metrics.listeningHours)} detail="from archived plays" accent={colors.pink} />
          <Metric symbol="♫" label="Songs on the road" value={number(data.metrics.songsOnRoad, 0)} detail="matched to journeys" accent={colors.blue} />
          <Metric symbol="♨" label="Current streak" value={number(data.metrics.currentStreak, 0)} detail="days with music" accent="#ff4560" />
        </View>

        <Panel title="Today's soundtrack" kicker={data.recentSelections.length ? `${data.recentSelections.length} RECENT SELECTIONS` : 'WAITING FOR MUSIC'}>
          {data.recentSelections.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumStrip}>
            {data.recentSelections.map((track, index) => <AlbumCard key={`${track.playedAt}-${track.track}-${index}`} track={track} enabled={canOpenTracks} onPress={() => void openTrack(track, provider)} />)}
          </ScrollView> : <Empty text="Your latest songs will appear here after JourneyDeck receives listening history." />}
        </Panel>

        <Panel title="Top artists" kicker="ALL-TIME ARCHIVE">
          {data.topArtists.length ? <View style={styles.artistList}>{data.topArtists.map((artist, index) => <View key={artist.artist} style={styles.artistRow}>
            <Text style={styles.artistRank}>{String(index + 1).padStart(2, '0')}</Text>
            {artist.artworkUrl ? <Image source={{ uri: artist.artworkUrl }} style={styles.artistArtwork} contentFit="cover" cachePolicy="memory-disk" transition={120} /> : <View style={styles.artistFallback}><Text style={styles.artistInitial}>{artist.artist.slice(0, 1).toUpperCase()}</Text></View>}
            <Text style={styles.artistName} numberOfLines={1}>{artist.artist}</Text>
            <Text style={styles.artistPlays}>{number(artist.plays, 0)} plays</Text>
          </View>)}</View> : <Empty text="Your artist ranking will grow with your listening archive." />}
        </Panel>

        <Panel title="Listening history" kicker={`${visibleArchive.length} JOURNEY PLAYS`}>
          <TextInput value={archiveQuery} onChangeText={setArchiveQuery} placeholder="Search songs, artists, albums, or places" placeholderTextColor="#746a7c" style={styles.archiveSearch} />
          {visibleArchive.slice(0, 60).map(entry => <View key={entry.key} style={styles.archiveRow}>
            <Pressable disabled={!canOpenTracks} onPress={() => void openTrack(entry, provider)} style={styles.archiveTrackButton}>
              {entry.artworkUrl ? <Image source={{ uri: entry.artworkUrl }} style={styles.archiveArtwork} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.archiveArtworkFallback}><Text style={styles.archiveNote}>♪</Text></View>}
              <View style={styles.archiveCopy}><Text style={styles.archiveTitle} numberOfLines={1}>{entry.track}</Text><Text style={styles.archiveArtist} numberOfLines={1}>{entry.artist}{entry.album ? `  •  ${entry.album}` : ''}</Text><Text style={styles.archiveRoute} numberOfLines={1}>{entry.routeLabel}</Text></View>
            </Pressable>
            <Pressable onPress={() => onJourney(entry.journeyId)} style={styles.archiveJourneyButton}><Text style={styles.archiveJourneyText}>Journey ›</Text></Pressable>
          </View>)}
          {!visibleArchive.length && <Empty text={archiveQuery ? 'No listening moments match that search.' : 'Songs matched to journeys will build your searchable archive here.'} />}
        </Panel>

        <Panel title="Top tracks" kicker="CALCULATED ON THIS IPHONE">
          {topTracks.map((track, index) => <View key={`${track.track}-${track.artist}`} style={styles.topTrackRow}><Text style={styles.artistRank}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.flexCard}><Text style={styles.archiveTitle}>{track.track}</Text><Text style={styles.archiveArtist}>{track.artist}</Text></View><Text style={styles.artistPlays}>{track.plays} plays</Text></View>)}
          {!topTracks.length && <Empty text="Your most-played road songs will appear here." />}
        </Panel>

        <View style={styles.insightPair}>
          <View style={[styles.insightCard, styles.flexCard]}>
            <CardHeader title="Tour mileage" kicker="THIS WEEK" />
            <Text style={styles.tourValue}>{number(data.tour.miles)}</Text><Text style={styles.tourUnit}>miles with a soundtrack</Text>
            <RouteGlow />
            <Text style={[styles.change, (data.tour.changePercent ?? 0) < 0 && styles.changeDown]}>{data.tour.changePercent === null ? 'First week of matched journey music' : `${data.tour.changePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.tour.changePercent)}% vs last week`}</Text>
          </View>
          <View style={[styles.insightCard, styles.flexCard]}>
            <CardHeader title="Mood by mile" kicker="WHEN YOU LISTEN" />
            <MoodBar items={data.mood} />
          </View>
        </View>

        <View style={styles.insightCard}>
          <CardHeader title="Cities & sound" kicker="JOURNEY MATCHES" />
          <CityBars items={data.cities} />
        </View>

        <View style={styles.insightCard}>
          <CardHeader title="Listening time" kicker="LAST 7 DAYS" />
          <IntensityChart daily={data.daily.slice(-7)} />
          <Text style={styles.chartFootnote}>Minutes listened each day</Text>
        </View>

        <View style={styles.insightCard}>
          <CardHeader title="This week in sound" kicker={provider === 'apple-music' ? 'APPLE MUSIC PLAYS' : provider === 'lastfm' ? 'SPOTIFY PLAYS' : 'RECOGNIZED SONGS'} />
          <WeekBars daily={data.daily.slice(-7)} />
          <View style={styles.weekTotal}><Text style={styles.weekTotalValue}>{number(data.week.total, 0)}</Text><Text style={styles.weekTotalLabel}>plays this week</Text><Text style={[styles.weekChange, (data.week.changePercent ?? 0) < 0 && styles.changeDown]}>{data.week.changePercent === null ? 'New' : `${data.week.changePercent >= 0 ? '+' : ''}${data.week.changePercent}%`}</Text></View>
        </View>

        {!canOpenTracks ? <Text style={styles.linkFootnote}>Auto Recognition is not a playback service, so JourneyDeck leaves track taps inactive.</Text> : <Text style={styles.linkFootnote}>Tap any album to open it in {provider === 'lastfm' ? 'Spotify' : 'Apple Music'}.</Text>}
      </> : null}
    </ScrollView>
  );
}

function VinylHeroRecord({ artworkUrl }: { artworkUrl?: string | null }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.heroRecordOuterShell}>
      <Animated.View style={[styles.heroRecordShell, { transform: [{ rotate: spin }] }]}>
        <Svg width={148} height={148} viewBox="0 0 148 148" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="vinylSheenTop" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <Stop offset="45%" stopColor="#c58bff" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </SvgLinearGradient>
            <SvgLinearGradient id="vinylSheenBottom" x1="1" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <Stop offset="45%" stopColor="#ff8bb9" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </SvgLinearGradient>
            <SvgRadialGradient id="vinylBody" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#1e102e" />
              <Stop offset="40%" stopColor="#0a0612" />
              <Stop offset="75%" stopColor="#160c23" />
              <Stop offset="100%" stopColor="#040207" />
            </SvgRadialGradient>
          </Defs>
          {/* Vinyl Disc Body */}
          <Circle cx="74" cy="74" r="73" fill="url(#vinylBody)" stroke="#4d2869" strokeWidth="1.75" />

          {/* Prominent Concentric Micro-Groove Tracks */}
          <Circle cx="74" cy="74" r="70" fill="none" stroke="#2c1740" strokeWidth="1.2" />
          <Circle cx="74" cy="74" r="67" fill="none" stroke="#522a76" strokeWidth="0.8" opacity="0.8" />
          <Circle cx="74" cy="74" r="64" fill="none" stroke="#221133" strokeWidth="1" />
          <Circle cx="74" cy="74" r="61" fill="none" stroke="#63348e" strokeWidth="0.85" opacity="0.9" />
          <Circle cx="74" cy="74" r="58" fill="none" stroke="#1f0f2d" strokeWidth="1" />
          <Circle cx="74" cy="74" r="55" fill="none" stroke="#522a76" strokeWidth="0.8" opacity="0.85" />
          <Circle cx="74" cy="74" r="52" fill="none" stroke="#2c1740" strokeWidth="1.2" />
          <Circle cx="74" cy="74" r="49" fill="none" stroke="#6a3899" strokeWidth="0.9" opacity="0.9" />
          <Circle cx="74" cy="74" r="46" fill="none" stroke="#221133" strokeWidth="1" />
          <Circle cx="74" cy="74" r="43" fill="none" stroke="#522a76" strokeWidth="0.8" opacity="0.8" />
          <Circle cx="74" cy="74" r="40" fill="none" stroke="#2c1740" strokeWidth="1.1" />
          <Circle cx="74" cy="74" r="37" fill="none" stroke="#63348e" strokeWidth="0.9" opacity="0.85" />
          <Circle cx="74" cy="74" r="34" fill="none" stroke="#2a153c" strokeWidth="1.2" />

          {/* Quad Specular Sheen Reflection Cones */}
          <Path d="M 74 74 L 22 22 A 71 71 0 0 1 74 3 Z" fill="url(#vinylSheenTop)" />
          <Path d="M 74 74 L 126 126 A 71 71 0 0 1 74 145 Z" fill="url(#vinylSheenBottom)" />
          <Path d="M 74 74 L 126 22 A 71 71 0 0 1 145 74 Z" fill="url(#vinylSheenTop)" opacity="0.5" />
          <Path d="M 74 74 L 22 126 A 71 71 0 0 1 3 74 Z" fill="url(#vinylSheenBottom)" opacity="0.5" />

          {/* Run-Out Lead-in Spiral Groove */}
          <Circle cx="74" cy="74" r="32" fill="none" stroke="#68358c" strokeWidth="1.2" strokeDasharray="6 3.5" opacity="0.85" />
          <Circle cx="74" cy="74" r="30" fill="none" stroke="#33184a" strokeWidth="1" />
        </Svg>

        {/* Center Record Label with Spinning Artwork */}
        <View style={styles.vinylCenterLabel}>
          {artworkUrl ? (
            <Image source={{ uri: artworkUrl }} style={styles.vinylArtwork} contentFit="cover" cachePolicy="memory-disk" transition={140} />
          ) : (
            <View style={styles.vinylArtworkFallback}>
              <Text style={styles.vinylNote}>♪</Text>
            </View>
          )}
          <View pointerEvents="none" style={styles.spindleHole}>
            <View style={styles.spindleCore} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function Waveform() {
  const heights = [8, 18, 12, 26, 34, 19, 11, 27, 38, 22, 15, 31, 42, 25, 13, 28, 17, 35, 21, 9];
  return <View style={styles.waveform}>{heights.map((height, index) => <View key={index} style={[styles.waveBar, { height }]} />)}</View>;
}

function Metric({ symbol, label, value, detail, accent }: { symbol: string; label: string; value: string; detail: string; accent: string }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { borderColor: `${accent}66`, backgroundColor: `${accent}16`, shadowColor: accent }]}><Text style={[styles.metricSymbol, { color: accent }]}>{symbol}</Text></View><View style={styles.metricCopy}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View></View>;
}

function Panel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return <View style={styles.panel}><CardHeader title={title} kicker={kicker} />{children}</View>;
}

function CardHeader({ title, kicker }: { title: string; kicker: string }) {
  return <View style={styles.cardHeader}><View style={styles.cardTitleGroup}><View style={styles.cardAccent} /><Text style={styles.cardTitle}>{title}</Text></View><Text style={styles.cardKicker}>{kicker}</Text></View>;
}

function AlbumCard({ track, enabled, onPress }: { track: SoundtrackTrack; enabled: boolean; onPress: () => void }) {
  return <Pressable disabled={!enabled} onPress={onPress} style={({ pressed }) => [styles.albumCard, pressed && enabled && styles.albumPressed]}>
    {track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.albumArtwork} contentFit="cover" cachePolicy="memory-disk" transition={120} /> : <View style={styles.albumFallback}><Text style={styles.albumNote}>♪</Text></View>}
    <Text style={styles.albumTitle} numberOfLines={1}>{track.track}</Text><Text style={styles.albumArtist} numberOfLines={1}>{track.artist}</Text>
  </Pressable>;
}

function Empty({ text }: { text: string }) { return <Text style={styles.empty}>{text}</Text>; }

function RouteGlow() {
  return <View style={styles.routeGraphic}>
    <Svg width="100%" height="100%" viewBox="0 0 150 70">
      <Defs><SvgLinearGradient id="mileageRoad" x1="8" y1="58" x2="142" y2="12" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor="#ff795b" /><Stop offset="0.55" stopColor="#ff4d87" /><Stop offset="1" stopColor="#b46cff" /></SvgLinearGradient></Defs>
      <Path d="M8 57 C35 57 34 20 65 21 C95 22 99 56 140 13" fill="none" stroke="#28152f" strokeWidth="11" strokeLinecap="round" />
      <Path d="M8 57 C35 57 34 20 65 21 C95 22 99 56 140 13" fill="none" stroke="url(#mileageRoad)" strokeWidth="3" strokeLinecap="round" />
      <Path d="M15 54 C37 49 38 27 61 25 C87 23 101 48 133 18" fill="none" stroke="#ffe3d8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 7" opacity="0.78" />
      <Circle cx="8" cy="57" r="5" fill="#ffb39d" stroke="#fff2ec" strokeWidth="2" />
      <Circle cx="140" cy="13" r="6" fill="#ff4d87" stroke="#ffd9ea" strokeWidth="2" />
      <Circle cx="140" cy="13" r="11" fill="none" stroke="#ff4d87" strokeWidth="2" opacity="0.23" />
    </Svg>
  </View>;
}

function MusicAtmosphere() {
  return <Svg pointerEvents="none" viewBox="0 0 430 1450" preserveAspectRatio="none" style={styles.atmosphere}>
    <Defs><SvgRadialGradient id="musicTopBloom" cx="50%" cy="4%" rx="68%" ry="31%"><Stop offset="0" stopColor="#b72d92" stopOpacity="0.28" /><Stop offset="0.48" stopColor="#7d247a" stopOpacity="0.1" /><Stop offset="1" stopColor="#7d247a" stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="musicSideBloom" cx="100%" cy="48%" rx="75%" ry="34%"><Stop offset="0" stopColor="#6250e8" stopOpacity="0.2" /><Stop offset="0.56" stopColor="#6b36be" stopOpacity="0.06" /><Stop offset="1" stopColor="#6b36be" stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="musicLowBloom" cx="0%" cy="86%" rx="80%" ry="30%"><Stop offset="0" stopColor="#ff3f78" stopOpacity="0.13" /><Stop offset="1" stopColor="#ff3f78" stopOpacity="0" /></SvgRadialGradient></Defs>
    <Rect width="430" height="1450" fill="url(#musicTopBloom)" /><Rect width="430" height="1450" fill="url(#musicSideBloom)" /><Rect width="430" height="1450" fill="url(#musicLowBloom)" />
  </Svg>;
}

function MusicHeroHaze() {
  return <Svg pointerEvents="none" viewBox="0 0 400 220" preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Defs><SvgRadialGradient id="heroArtBloom" cx="20%" cy="46%" rx="54%" ry="74%"><Stop offset="0" stopColor="#ef3d8f" stopOpacity="0.34" /><Stop offset="0.55" stopColor="#8a1d65" stopOpacity="0.11" /><Stop offset="1" stopColor="#8a1d65" stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="heroCopyBloom" cx="93%" cy="70%" rx="67%" ry="75%"><Stop offset="0" stopColor="#633ad0" stopOpacity="0.28" /><Stop offset="0.58" stopColor="#47228f" stopOpacity="0.07" /><Stop offset="1" stopColor="#47228f" stopOpacity="0" /></SvgRadialGradient></Defs><Rect width="400" height="220" fill="url(#heroArtBloom)" /><Rect width="400" height="220" fill="url(#heroCopyBloom)" /></Svg>;
}

function MoodBar({ items }: { items: MusicDashboardData['mood'] }) {
  const palette = [colors.blue, '#7658dd', '#b34cd0', colors.pink];
  return <View style={styles.moodBlock}><View style={styles.moodBar}>{items.map((item, index) => <View key={item.label} style={{ flex: Math.max(item.percent, item.count ? 4 : 0.5), backgroundColor: palette[index] }} />)}</View><View style={styles.moodLegend}>{items.map((item, index) => <View key={item.label} style={styles.moodItem}><Text style={[styles.moodPercent, { color: palette[index] }]}>{item.percent}%</Text><Text style={styles.moodLabel}>{item.label}</Text></View>)}</View><Text style={styles.moodFootnote}>Your real listening rhythm across the day</Text></View>;
}

function CityBars({ items }: { items: MusicDashboardData['cities'] }) {
  const maximum = Math.max(1, ...items.map(item => item.songs));
  return items.length ? <View style={styles.cityList}>{items.map(item => <View key={item.label} style={styles.cityRow}><Text style={styles.cityName} numberOfLines={1}>{item.label}</Text><View style={styles.cityTrack}><View style={[styles.cityFill, { width: `${Math.max(5, Math.round((item.songs / maximum) * 100))}%` }]} /></View><Text style={styles.cityCount}>{item.songs}</Text></View>)}<Text style={styles.cityAttribution}>City labels © OpenStreetMap contributors · coordinates reduced before leaving this iPhone</Text></View> : <Empty text="Pull to refresh to add privacy-safe city labels for journey music." />;
}

function IntensityChart({ daily }: { daily: MusicDashboardData['daily'] }) {
  const [width, setWidth] = useState(0), height = 116;
  const maximum = Math.max(1, ...daily.map(day => day.minutes ?? 0));
  const points = useMemo(() => daily.map((day, index) => ({
    x: daily.length > 1 ? 14 + index * ((Math.max(30, width) - 28) / (daily.length - 1)) : width / 2,
    y: 12 + (1 - (day.minutes ?? 0) / maximum) * 78,
  })), [daily, maximum, width]);
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const baselineY = 100;
    const pathSegments = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return `${pathSegments} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  }, [points]);
  const linePath = useMemo(() => {
    if (points.length < 2) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  return <View><View style={styles.chart} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 ? (
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="intensityAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ff6c50" stopOpacity="0.32" />
            <Stop offset="55%" stopColor="#ff3f82" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#9b61ff" stopOpacity="0.0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="intensityLineGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#ff795b" />
            <Stop offset="50%" stopColor="#ff4d87" />
            <Stop offset="100%" stopColor="#b46cff" />
          </SvgLinearGradient>
        </Defs>
        {areaPath ? <Path d={areaPath} fill="url(#intensityAreaGrad)" /> : null}
        {points.map((point, index) => (
          <Path key={`guide-${index}`} d={`M ${point.x} ${point.y} L ${point.x} 100`} stroke="#3b204e" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
        ))}
        {linePath ? <Path d={linePath} fill="none" stroke="url(#intensityLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((point, index) => (
          <Circle key={`dot-${index}`} cx={point.x} cy={point.y} r="4.5" fill="#ff765a" stroke="#fff0ea" strokeWidth="2" />
        ))}
      </Svg>
    ) : null}
  </View><View style={styles.chartLabels}>{daily.map(day => <Text key={day.date} style={styles.chartLabel}>{day.label.slice(0, 1)}</Text>)}</View></View>;
}

function WeekBars({ daily }: { daily: MusicDashboardData['daily'] }) {
  const maximum = Math.max(1, ...daily.map(day => day.count));
  return <View style={styles.weekBars}>{daily.map(day => <View key={day.date} style={styles.weekBarItem}><View style={styles.weekBarTrack}><View style={[styles.weekBarFill, { height: `${Math.max(day.count ? 10 : 2, Math.round((day.count / maximum) * 100))}%` }]} /></View><Text style={styles.weekBarLabel}>{day.label.slice(0, 1)}</Text></View>)}</View>;
}

function MusicHeaderScene() {
  const bars = [26, 48, 76, 42, 92, 60, 105, 52, 82, 45, 68, 38, 74];
  return <>
    <LinearGradient pointerEvents="none" colors={['#0c102c', '#1b0b29', '#100611'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 360 170" style={musicHeaderStyles.sceneCanvas}>
      <Defs>
        <SvgRadialGradient id="musicSceneGlow" cx="82%" cy="32%" rx="65%" ry="75%">
          <Stop offset="0" stopColor="#ff3f82" stopOpacity="0.3" />
          <Stop offset="45%" stopColor="#9b61ff" stopOpacity="0.1" />
          <Stop offset="1" stopColor="#9b61ff" stopOpacity="0" />
        </SvgRadialGradient>
        <SvgLinearGradient id="soundwaveGrad1" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#ff795b" stopOpacity="0.8" />
          <Stop offset="50%" stopColor="#ff3f82" stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#c57fff" stopOpacity="0.9" />
        </SvgLinearGradient>
        <SvgLinearGradient id="soundwaveGrad2" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#43e6ae" stopOpacity="0.4" />
          <Stop offset="50%" stopColor="#7658dd" stopOpacity="0.75" />
          <Stop offset="100%" stopColor="#ff3f82" stopOpacity="0.8" />
        </SvgLinearGradient>
      </Defs>
      <Rect width="360" height="170" fill="url(#musicSceneGlow)" />

      {/* Harmonic Wave Interference Lines */}
      <Path d="M 140 115 Q 185 45 235 95 T 310 70 T 360 110" fill="none" stroke="url(#soundwaveGrad2)" strokeWidth="1.5" opacity="0.4" strokeDasharray="3 3" />
      <Path d="M 155 90 Q 200 130 250 80 T 325 105 T 360 75" fill="none" stroke="url(#soundwaveGrad2)" strokeWidth="1.75" opacity="0.5" />

      {/* Primary Harmonic Neon Equalizer Beam */}
      <Path d="M 150 78 C 190 32, 220 120, 265 65 S 315 110, 355 60" fill="none" stroke="#ff3f82" strokeWidth="8" opacity="0.18" strokeLinecap="round" />
      <Path d="M 150 78 C 190 32, 220 120, 265 65 S 315 110, 355 60" fill="none" stroke="url(#soundwaveGrad1)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Floating Audio Nodes / Constellation */}
      <Circle cx="210" cy="55" r="4" fill="#ff795b" stroke="#fff0ea" strokeWidth="1.5" />
      <Circle cx="265" cy="65" r="5.5" fill="#ff3f82" stroke="#fff" strokeWidth="2" />
      <Circle cx="265" cy="65" r="11" fill="none" stroke="#ff3f82" strokeWidth="1" opacity="0.4" strokeDasharray="2 2" />
      <Circle cx="315" cy="88" r="4.5" fill="#c57fff" stroke="#f6efff" strokeWidth="1.5" />
      <Circle cx="348" cy="62" r="3.5" fill="#43e6ae" stroke="#eafff8" strokeWidth="1.5" />
    </Svg>
    <View pointerEvents="none" style={musicHeaderStyles.spectrum}>{bars.map((height, index) => <View key={`${height}-${index}`} style={[musicHeaderStyles.spectrumBar, { height }]} />)}</View>
    <View pointerEvents="none" style={musicHeaderStyles.rail}><View style={musicHeaderStyles.railCore} /></View>
  </>;
}

const musicHeaderStyles = StyleSheet.create({
  heroCardHeader: { width: '100%', aspectRatio: 1270 / 674, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0c0716', shadowColor: '#ff4594', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  heroHeaderImage: { width: '100%', height: '100%' },
  header: { minHeight: 166, borderColor: '#652d70', backgroundColor: '#0d0818', shadowColor: '#ff4594', shadowOpacity: 0.3, shadowRadius: 24 },
  eyebrow: { color: '#ff9fc4', maxWidth: 208 },
  title: { maxWidth: 208, textShadowColor: '#ff4f9a', textShadowRadius: 13 },
  body: { color: '#d2c3d8', maxWidth: 215 },
  sceneCanvas: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  spectrum: { position: 'absolute', right: 18, bottom: 16, height: 38, width: 136, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', opacity: 0.92 },
  spectrumBar: { width: 4.5, borderRadius: 5, backgroundColor: '#ff5aa1', shadowColor: '#ff5aa1', shadowOpacity: 0.94, shadowRadius: 6 },
  rail: { position: 'absolute', left: 18, top: 13, width: 60, height: 3, borderRadius: 3, backgroundColor: 'rgba(235, 117, 202, 0.3)', overflow: 'hidden' },
  railCore: { width: '72%', height: '100%', borderRadius: 3, backgroundColor: '#ff8467', shadowColor: '#ff8467', shadowOpacity: 1, shadowRadius: 8 },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  pageContent: { paddingHorizontal: 16, gap: 13 },
  atmosphere: { position: 'absolute', top: -45, left: -20, right: -20, height: 1460 },
  header: { minHeight: 142, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#482756', backgroundColor: '#110919', paddingHorizontal: 18, paddingVertical: 19, justifyContent: 'center', shadowColor: '#7f47c4', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  eyebrow: { color: '#c5a1ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.9, marginTop: 4 },
  pageTitle: { color: colors.text, fontSize: 37, lineHeight: 41, fontWeight: '900', marginTop: 7, letterSpacing: -0.8 },
  pageBody: { color: '#aca0b1', fontSize: 13, lineHeight: 20, marginTop: 3, maxWidth: 310 },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: colors.muted, fontSize: 12 },
  notice: { borderWidth: 1, borderColor: '#744152', backgroundColor: '#1a0b15', borderRadius: 18, padding: 15, gap: 7, shadowColor: '#ff4d82', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } }, noticeTitle: { color: '#ff9a83', fontWeight: '900', fontSize: 14 }, noticeBody: { color: '#ad9da8', fontSize: 12, lineHeight: 18 }, retry: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#3b1930', paddingHorizontal: 13, paddingVertical: 8, shadowColor: '#ff4d82', shadowOpacity: 0.35, shadowRadius: 10 }, retryText: { color: '#ff8bb6', fontWeight: '900', fontSize: 10 },
  hero: { minHeight: 216, borderRadius: 27, borderWidth: 1, borderColor: '#5c2672', backgroundColor: '#090413', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, shadowColor: '#9b36ff', shadowOpacity: 0.28, shadowRadius: 22 },
  heroRecordOuterShell: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  heroRecordShell: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center', shadowColor: '#9b36ff', shadowOpacity: 0.5, shadowRadius: 20 },
  vinylCenterLabel: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: '#ff7e9e', shadowColor: '#ff4e9a', shadowOpacity: 0.65, shadowRadius: 9 },
  vinylArtwork: { width: 60, height: 60, borderRadius: 30 },
  vinylArtworkFallback: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2f132a' },
  vinylNote: { color: '#ff709b', fontSize: 26, fontWeight: '900' },
  spindleHole: { position: 'absolute', width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#060309', borderWidth: 1.5, borderColor: '#7c5e93', alignItems: 'center', justifyContent: 'center' },
  spindleCore: { width: 4.5, height: 4.5, borderRadius: 2.25, backgroundColor: '#020104' },
  heroCopy: { flex: 1, alignItems: 'flex-start', paddingLeft: 2 }, heroEyebrow: { color: '#ff7559', fontSize: 6.5, fontWeight: '900', letterSpacing: 1.0, marginBottom: 7 }, heroTitle: { color: colors.text, fontSize: 17, lineHeight: 19, fontWeight: '900' }, heroAccent: { color: '#ff4e8b', fontSize: 23, lineHeight: 26, fontStyle: 'italic', fontWeight: '900', textShadowColor: '#ff2f79', textShadowRadius: 12 }, heroService: { color: '#81748b', fontSize: 6.5, letterSpacing: 1.0, fontWeight: '900', marginTop: 7 },
  waveform: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5 }, waveBar: { width: 2, borderRadius: 2, backgroundColor: colors.pink, shadowColor: colors.pink, shadowOpacity: 0.85, shadowRadius: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, metric: { width: '48.6%', minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 19, borderWidth: 1, borderColor: '#553267', backgroundColor: colors.panel, padding: 11, shadowColor: '#9b61ff', shadowOpacity: 0.24, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } }, metricIcon: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.55, shadowRadius: 12 }, metricSymbol: { fontSize: 18, fontWeight: '900' }, metricCopy: { flex: 1 }, metricLabel: { color: '#94899d', fontSize: 8, lineHeight: 11 }, metricValue: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 2, textShadowColor: '#9b61ff55', textShadowRadius: 7 }, metricDetail: { color: '#7f7389', fontSize: 7, lineHeight: 10, marginTop: 1 },
  panel: { borderRadius: 20, borderWidth: 1, borderColor: '#633678', backgroundColor: colors.panel, padding: 14, overflow: 'hidden', shadowColor: '#a64dff', shadowOpacity: 0.28, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, cardHeader: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }, cardTitleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, cardAccent: { width: 3, height: 17, borderRadius: 2, backgroundColor: colors.coral, shadowColor: colors.coral, shadowOpacity: 0.9, shadowRadius: 8 }, cardTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900', textShadowColor: '#a34cff55', textShadowRadius: 6 }, cardKicker: { color: '#ff6b89', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  albumStrip: { gap: 11, paddingRight: 4 }, albumCard: { width: 112, shadowColor: '#ff4d91', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, albumPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }, albumArtwork: { width: 112, height: 112, borderRadius: 13, borderWidth: 1, borderColor: '#75416c' }, albumFallback: { width: 112, height: 112, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27142c', borderWidth: 1, borderColor: '#75416c' }, albumNote: { color: colors.pink, fontSize: 35, fontWeight: '900' }, albumTitle: { color: colors.text, fontSize: 11, fontWeight: '900', marginTop: 8 }, albumArtist: { color: '#8d8295', fontSize: 9, marginTop: 2 }, empty: { color: '#82778a', fontSize: 11, lineHeight: 17, paddingVertical: 12 },
  artistList: { gap: 3 }, artistRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#291932' }, artistRank: { width: 26, color: '#877a92', fontSize: 10 }, artistArtwork: { width: 42, height: 42, borderRadius: 21 }, artistFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#251634', borderWidth: 1, borderColor: '#4e2e68', alignItems: 'center', justifyContent: 'center' }, artistInitial: { color: '#c9aaff', fontSize: 16, fontWeight: '900' }, artistName: { flex: 1, color: '#f0e9f3', fontSize: 14, fontWeight: '800' }, artistPlays: { color: '#a296ab', fontSize: 10, fontWeight: '700' },
  insightPair: { flexDirection: 'row', gap: 10 }, flexCard: { flex: 1 }, insightCard: { minHeight: 175, borderRadius: 20, borderWidth: 1, borderColor: '#633678', backgroundColor: colors.panel, padding: 14, overflow: 'hidden', shadowColor: '#ff4d91', shadowOpacity: 0.25, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, tourValue: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 2, textShadowColor: '#ff4d9155', textShadowRadius: 8 }, tourUnit: { color: '#aa9db0', fontSize: 8 }, routeGraphic: { height: 70, marginTop: 1 }, change: { color: '#ff795c', fontSize: 7, fontWeight: '800' }, changeDown: { color: '#ffb05c' },
  moodBlock: { flex: 1, justifyContent: 'space-between', paddingTop: 8 }, moodBar: { height: 17, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.track }, moodLegend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 12 }, moodItem: { width: '50%' }, moodPercent: { fontSize: 10, fontWeight: '900' }, moodLabel: { color: '#817589', fontSize: 7, marginTop: 3 }, moodFootnote: { color: '#ff765a', fontSize: 6.5, marginTop: 15 },
  cityList: { gap: 12, paddingTop: 2 }, cityRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, cityName: { width: 103, color: '#d8cfdd', fontSize: 9 }, cityTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#27172f', overflow: 'hidden' }, cityFill: { height: 6, borderRadius: 3, backgroundColor: colors.pink, shadowColor: colors.pink, shadowOpacity: 1, shadowRadius: 6 }, cityCount: { width: 25, color: '#b9a9c1', fontSize: 9, fontWeight: '800', textAlign: 'right' }, cityAttribution: { color: '#6f6476', fontSize: 7, lineHeight: 11, marginTop: 3 },
  chart: { height: 116, overflow: 'hidden' },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  chartLabel: { width: 16, textAlign: 'center', color: '#74697d', fontSize: 7 },
  chartFootnote: { color: '#ff876f', fontSize: 8, fontWeight: '700', marginTop: 8 },
  weekBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 3 }, weekBarItem: { flex: 1, height: 105, alignItems: 'center', justifyContent: 'flex-end' }, weekBarTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' }, weekBarFill: { width: '100%', minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.coral, shadowColor: colors.pink, shadowOpacity: 0.75, shadowRadius: 7 }, weekBarLabel: { color: '#81758a', fontSize: 7, marginTop: 7 }, weekTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 12 }, weekTotalValue: { color: colors.text, fontSize: 27, fontWeight: '900' }, weekTotalLabel: { flex: 1, color: '#8d8294', fontSize: 8 }, weekChange: { color: colors.coral, fontSize: 10, fontWeight: '900' },
  archiveSearch: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#472759', backgroundColor: '#09060f', color: colors.text, paddingHorizontal: 13, fontSize: 12, marginBottom: 9 },
  archiveRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2e1938', paddingVertical: 9, gap: 7 }, archiveTrackButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }, archiveArtwork: { width: 48, height: 48, borderRadius: 10 }, archiveArtworkFallback: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#26142f', alignItems: 'center', justifyContent: 'center' }, archiveNote: { color: colors.pink, fontSize: 21, fontWeight: '900' }, archiveCopy: { flex: 1, minWidth: 0 }, archiveTitle: { color: '#f3edf6', fontSize: 12, fontWeight: '900' }, archiveArtist: { color: '#9a8da1', fontSize: 9, marginTop: 3 }, archiveRoute: { color: '#776b80', fontSize: 8, marginTop: 4 }, archiveJourneyButton: { paddingHorizontal: 7, paddingVertical: 8, borderRadius: 9, backgroundColor: '#261632' }, archiveJourneyText: { color: '#c79be9', fontSize: 8, fontWeight: '900' }, topTrackRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2e1938' },
  linkFootnote: { color: '#766b7d', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 2 },
});
