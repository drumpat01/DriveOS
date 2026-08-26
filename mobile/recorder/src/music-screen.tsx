import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

import type { MusicDashboardData, SoundtrackTrack } from './app-data';
import type { MusicProvider } from './music-preferences';
import { musicTrackDestination } from './music-destination';

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

export function MusicScreen({ state, provider, onRefresh }: { state: MusicDashboardState; provider: MusicProvider; onRefresh: () => Promise<void> }) {
  const data = state.data;
  const latest = data?.recentSelections[0] ?? null;
  const canOpenTracks = provider === 'apple-music' || provider === 'lastfm';
  const insets = useSafeAreaInsets();
  const [manualRefreshing, setManualRefreshing] = useState(false);
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
      <View style={[styles.header, musicHeaderStyles.header]}>
        <MusicHeaderScene />
        <Text style={[styles.eyebrow, musicHeaderStyles.eyebrow]}>YOUR ROAD, YOUR SOUNDTRACK</Text>
        <Text style={[styles.pageTitle, musicHeaderStyles.title]}>MUSIC</Text>
        <Text style={[styles.pageBody, musicHeaderStyles.body]}>The songs that turn every journey into part of your story.</Text>
      </View>

      {state.status === 'loading' && !data ? <View style={styles.loading}><ActivityIndicator color={colors.pink} /><Text style={styles.loadingText}>Building your soundtrack…</Text></View> : null}
      {state.status === 'error' ? <View style={styles.notice}><Text style={styles.noticeTitle}>Music archive unavailable</Text><Text style={styles.noticeBody}>{state.message}</Text><Pressable onPress={() => void onRefresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}

      {data ? <>
        <Pressable disabled={!latest || !canOpenTracks} onPress={() => latest && void openTrack(latest, provider)} style={styles.hero}>
          <MusicHeroHaze />
          <View style={styles.heroArtworkShell}>
            <View style={styles.vinylRingOuter}><View style={styles.vinylRingMiddle}><View style={styles.vinylRingInner} /></View></View>
            {latest?.artworkUrl ? <Image source={{ uri: latest.artworkUrl }} style={styles.heroArtwork} contentFit="cover" cachePolicy="memory-disk" transition={140} /> : <View style={styles.heroArtworkFallback}><Text style={styles.heroNote}>♪</Text></View>}
          </View>
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
    <View style={styles.routeAura} />
    <Svg width="100%" height="100%" viewBox="0 0 150 70">
      <Defs><SvgLinearGradient id="mileageRoad" x1="8" y1="58" x2="142" y2="12" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor="#ff795b" /><Stop offset="0.55" stopColor="#ff4d87" /><Stop offset="1" stopColor="#b46cff" /></SvgLinearGradient></Defs>
      <Path d="M8 57 C35 57 34 20 65 21 C95 22 99 56 140 13" fill="none" stroke="#28152f" strokeWidth="13" strokeLinecap="round" />
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
  return items.length ? <View style={styles.cityList}>{items.map(item => <View key={item.label} style={styles.cityRow}><Text style={styles.cityName} numberOfLines={1}>{item.label}</Text><View style={styles.cityTrack}><View style={[styles.cityFill, { width: `${Math.max(5, Math.round((item.songs / maximum) * 100))}%` }]} /></View><Text style={styles.cityCount}>{item.songs}</Text></View>)}</View> : <Empty text="Journey locations with music will appear here." />;
}

function IntensityChart({ daily }: { daily: MusicDashboardData['daily'] }) {
  const [width, setWidth] = useState(0), height = 116;
  const maximum = Math.max(1, ...daily.map(day => day.minutes ?? 0));
  const points = useMemo(() => daily.map((day, index) => ({ x: daily.length > 1 ? 10 + index * ((Math.max(20, width) - 20) / (daily.length - 1)) : width / 2, y: 12 + (1 - (day.minutes ?? 0) / maximum) * 78 })), [daily, maximum, width]);
  return <View><View style={styles.chart} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={styles.chartGlow} />
    {width > 0 ? points.slice(1).map((point, index) => {
      const previous = points[index], dx = point.x - previous.x, dy = point.y - previous.y, length = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return <View key={index} style={[styles.chartLine, { left: (previous.x + point.x - length) / 2, top: (previous.y + point.y) / 2, width: length, transform: [{ rotate: `${angle}deg` }] }]} />;
    }) : null}
    {width > 0 ? points.map((point, index) => <View key={index} style={[styles.chartDot, { left: point.x - 4, top: point.y - 4 }]} />) : null}
  </View><View style={styles.chartLabels}>{daily.map(day => <Text key={day.date} style={styles.chartLabel}>{day.label.slice(0, 1)}</Text>)}</View></View>;
}

function WeekBars({ daily }: { daily: MusicDashboardData['daily'] }) {
  const maximum = Math.max(1, ...daily.map(day => day.count));
  return <View style={styles.weekBars}>{daily.map(day => <View key={day.date} style={styles.weekBarItem}><View style={styles.weekBarTrack}><View style={[styles.weekBarFill, { height: `${Math.max(day.count ? 10 : 2, Math.round((day.count / maximum) * 100))}%` }]} /></View><Text style={styles.weekBarLabel}>{day.label.slice(0, 1)}</Text></View>)}</View>;
}

function MusicHeaderScene() {
  const bars = [25, 43, 70, 38, 83, 57, 98, 45, 74];
  return <>
    <LinearGradient pointerEvents="none" colors={['#0b102b', '#1b0b29', '#100611'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={musicHeaderStyles.vinylHalo} />
    <View pointerEvents="none" style={musicHeaderStyles.vinylOuter}><View style={musicHeaderStyles.vinylMiddle}><View style={musicHeaderStyles.vinylInner}><View style={musicHeaderStyles.vinylLabel} /></View></View></View>
    <View pointerEvents="none" style={musicHeaderStyles.spectrum}>{bars.map((height, index) => <View key={`${height}-${index}`} style={[musicHeaderStyles.spectrumBar, { height }]} />)}</View>
    <View pointerEvents="none" style={musicHeaderStyles.rail}><View style={musicHeaderStyles.railCore} /></View>
  </>;
}

const musicHeaderStyles = StyleSheet.create({
  header: { minHeight: 166, borderColor: '#652d70', backgroundColor: '#0d0818', shadowColor: '#ff4594', shadowOpacity: 0.3, shadowRadius: 24 },
  eyebrow: { color: '#ff9fc4', maxWidth: 208 },
  title: { maxWidth: 208, textShadowColor: '#ff4f9a', textShadowRadius: 13 },
  body: { color: '#d2c3d8', maxWidth: 215 },
  vinylHalo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -44, top: -54, backgroundColor: '#a9347c', opacity: 0.31, shadowColor: '#e858ae', shadowOpacity: 0.82, shadowRadius: 28 },
  vinylOuter: { position: 'absolute', width: 100, height: 100, borderRadius: 50, right: 19, top: 23, borderWidth: 1, borderColor: 'rgba(255, 158, 217, 0.68)', backgroundColor: '#14091d', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff62aa', shadowOpacity: 0.56, shadowRadius: 17 },
  vinylMiddle: { width: 78, height: 78, borderRadius: 39, borderWidth: 1, borderColor: 'rgba(158, 109, 255, 0.72)', alignItems: 'center', justifyContent: 'center' },
  vinylInner: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255, 110, 172, 0.58)', alignItems: 'center', justifyContent: 'center' },
  vinylLabel: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#ff785f', shadowColor: '#ff785f', shadowOpacity: 1, shadowRadius: 7 },
  spectrum: { position: 'absolute', right: 19, bottom: 13, height: 36, width: 126, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', opacity: 0.88 },
  spectrumBar: { width: 5, borderRadius: 6, backgroundColor: '#ff5aa1', shadowColor: '#ff5aa1', shadowOpacity: 0.94, shadowRadius: 5 },
  rail: { position: 'absolute', left: 18, top: 13, width: 60, height: 3, borderRadius: 3, backgroundColor: 'rgba(235, 117, 202, 0.3)', overflow: 'hidden' },
  railCore: { width: '72%', height: '100%', borderRadius: 3, backgroundColor: '#ff8467', shadowColor: '#ff8467', shadowOpacity: 1, shadowRadius: 8 },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  pageContent: { paddingHorizontal: 18, gap: 13 },
  atmosphere: { position: 'absolute', top: -45, left: -20, right: -20, height: 1460 },
  header: { minHeight: 142, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#482756', backgroundColor: '#110919', paddingHorizontal: 18, paddingVertical: 19, justifyContent: 'center', shadowColor: '#7f47c4', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, headerGlow: { position: 'absolute', width: 185, height: 185, borderRadius: 93, backgroundColor: '#6d1f55', opacity: 0.42, right: -77, top: -104 }, headerRail: { position: 'absolute', left: 18, top: 13, width: 50, height: 3, borderRadius: 3, backgroundColor: '#47214c', overflow: 'hidden' }, headerRailCore: { width: '58%', height: '100%', borderRadius: 3, backgroundColor: colors.coral, shadowColor: colors.coral, shadowOpacity: 1, shadowRadius: 6 }, eyebrow: { color: '#c5a1ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.9, marginTop: 4 }, pageTitle: { color: colors.text, fontSize: 37, lineHeight: 41, fontWeight: '900', marginTop: 7, letterSpacing: -0.8 }, pageBody: { color: '#aca0b1', fontSize: 13, lineHeight: 20, marginTop: 3, maxWidth: 310 },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: colors.muted, fontSize: 12 },
  notice: { borderWidth: 1, borderColor: '#744152', backgroundColor: '#1a0b15', borderRadius: 18, padding: 15, gap: 7, shadowColor: '#ff4d82', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } }, noticeTitle: { color: '#ff9a83', fontWeight: '900', fontSize: 14 }, noticeBody: { color: '#ad9da8', fontSize: 12, lineHeight: 18 }, retry: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#3b1930', paddingHorizontal: 13, paddingVertical: 8, shadowColor: '#ff4d82', shadowOpacity: 0.35, shadowRadius: 10 }, retryText: { color: '#ff8bb6', fontWeight: '900', fontSize: 10 },
  hero: { minHeight: 210, borderRadius: 27, borderWidth: 1, borderColor: '#5c2672', backgroundColor: '#090413', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 17, gap: 15, shadowColor: '#9b36ff', shadowOpacity: 0.28, shadowRadius: 22 },
  heroArtworkShell: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' }, vinylRingOuter: { position: 'absolute', width: 128, height: 128, borderRadius: 64, borderWidth: 1, borderColor: '#b15fc3', backgroundColor: '#0a0710', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff4e9a', shadowOpacity: 0.45, shadowRadius: 18 }, vinylRingMiddle: { width: 105, height: 105, borderRadius: 53, borderWidth: 1, borderColor: '#75427d', alignItems: 'center', justifyContent: 'center' }, vinylRingInner: { width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: '#4d2858' }, heroArtwork: { width: 94, height: 94, borderRadius: 47, borderWidth: 2, borderColor: '#ff91b9', shadowColor: colors.pink, shadowOpacity: 0.9, shadowRadius: 17 }, heroArtworkFallback: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', backgroundColor: '#37132f', borderWidth: 2, borderColor: '#ff91b9', shadowColor: colors.pink, shadowOpacity: 0.7, shadowRadius: 14 }, heroNote: { color: '#ff6f9b', fontSize: 40, fontWeight: '900' },
  heroCopy: { flex: 1, alignItems: 'flex-start' }, heroEyebrow: { color: '#ff7559', fontSize: 7, fontWeight: '900', letterSpacing: 1.1, marginBottom: 9 }, heroTitle: { color: colors.text, fontSize: 19, lineHeight: 21, fontWeight: '900' }, heroAccent: { color: '#ff4e8b', fontSize: 26, lineHeight: 29, fontStyle: 'italic', fontWeight: '900', textShadowColor: '#ff2f79', textShadowRadius: 12 }, heroService: { color: '#81748b', fontSize: 7, letterSpacing: 1.1, fontWeight: '900', marginTop: 8 },
  waveform: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5 }, waveBar: { width: 2, borderRadius: 2, backgroundColor: colors.pink, shadowColor: colors.pink, shadowOpacity: 0.85, shadowRadius: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, metric: { width: '48.6%', minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 19, borderWidth: 1, borderColor: '#553267', backgroundColor: colors.panel, padding: 11, shadowColor: '#9b61ff', shadowOpacity: 0.24, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } }, metricIcon: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.55, shadowRadius: 12 }, metricSymbol: { fontSize: 18, fontWeight: '900' }, metricCopy: { flex: 1 }, metricLabel: { color: '#94899d', fontSize: 8, lineHeight: 11 }, metricValue: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 2, textShadowColor: '#9b61ff55', textShadowRadius: 7 }, metricDetail: { color: '#7f7389', fontSize: 7, lineHeight: 10, marginTop: 1 },
  panel: { borderRadius: 20, borderWidth: 1, borderColor: '#633678', backgroundColor: colors.panel, padding: 14, overflow: 'hidden', shadowColor: '#a64dff', shadowOpacity: 0.28, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, cardHeader: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }, cardTitleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, cardAccent: { width: 3, height: 17, borderRadius: 2, backgroundColor: colors.coral, shadowColor: colors.coral, shadowOpacity: 0.9, shadowRadius: 8 }, cardTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900', textShadowColor: '#a34cff55', textShadowRadius: 6 }, cardKicker: { color: '#ff6b89', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  albumStrip: { gap: 11, paddingRight: 4 }, albumCard: { width: 112, shadowColor: '#ff4d91', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, albumPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }, albumArtwork: { width: 112, height: 112, borderRadius: 13, borderWidth: 1, borderColor: '#75416c' }, albumFallback: { width: 112, height: 112, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27142c', borderWidth: 1, borderColor: '#75416c' }, albumNote: { color: colors.pink, fontSize: 35, fontWeight: '900' }, albumTitle: { color: colors.text, fontSize: 11, fontWeight: '900', marginTop: 8 }, albumArtist: { color: '#8d8295', fontSize: 9, marginTop: 2 }, empty: { color: '#82778a', fontSize: 11, lineHeight: 17, paddingVertical: 12 },
  artistList: { gap: 3 }, artistRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#291932' }, artistRank: { width: 26, color: '#877a92', fontSize: 10 }, artistArtwork: { width: 42, height: 42, borderRadius: 21 }, artistFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#251634', borderWidth: 1, borderColor: '#4e2e68', alignItems: 'center', justifyContent: 'center' }, artistInitial: { color: '#c9aaff', fontSize: 16, fontWeight: '900' }, artistName: { flex: 1, color: '#f0e9f3', fontSize: 14, fontWeight: '800' }, artistPlays: { color: '#a296ab', fontSize: 10, fontWeight: '700' },
  insightPair: { flexDirection: 'row', gap: 10 }, flexCard: { flex: 1 }, insightCard: { minHeight: 175, borderRadius: 20, borderWidth: 1, borderColor: '#633678', backgroundColor: colors.panel, padding: 14, overflow: 'hidden', shadowColor: '#ff4d91', shadowOpacity: 0.25, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, tourValue: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 2, textShadowColor: '#ff4d9155', textShadowRadius: 8 }, tourUnit: { color: '#aa9db0', fontSize: 8 }, routeGraphic: { height: 70, marginTop: 1 }, routeAura: { position: 'absolute', width: 112, height: 88, borderRadius: 50, backgroundColor: '#fa4a1e', opacity: 0.13, right: -10, top: -8 }, change: { color: '#ff795c', fontSize: 7, fontWeight: '800' }, changeDown: { color: '#ffb05c' },
  moodBlock: { flex: 1, justifyContent: 'space-between', paddingTop: 8 }, moodBar: { height: 17, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.track }, moodLegend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 12 }, moodItem: { width: '50%' }, moodPercent: { fontSize: 10, fontWeight: '900' }, moodLabel: { color: '#817589', fontSize: 7, marginTop: 3 }, moodFootnote: { color: '#ff765a', fontSize: 6.5, marginTop: 15 },
  cityList: { gap: 12, paddingTop: 2 }, cityRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, cityName: { width: 103, color: '#d8cfdd', fontSize: 9 }, cityTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#27172f', overflow: 'hidden' }, cityFill: { height: 6, borderRadius: 3, backgroundColor: colors.pink, shadowColor: colors.pink, shadowOpacity: 1, shadowRadius: 6 }, cityCount: { width: 25, color: '#b9a9c1', fontSize: 9, fontWeight: '800', textAlign: 'right' },
  chart: { height: 116, overflow: 'hidden' }, chartGlow: { position: 'absolute', left: 0, right: 0, bottom: 10, height: 67, backgroundColor: '#6f162d', opacity: 0.22, borderTopLeftRadius: 120, borderTopRightRadius: 120 }, chartLine: { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: colors.coral, shadowColor: colors.pink, shadowOpacity: 1, shadowRadius: 8 }, chartDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, borderWidth: 2, borderColor: '#ff9b84' }, chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }, chartLabel: { width: 16, textAlign: 'center', color: '#74697d', fontSize: 7 }, chartFootnote: { color: '#ff876f', fontSize: 8, fontWeight: '700', marginTop: 8 },
  weekBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 3 }, weekBarItem: { flex: 1, height: 105, alignItems: 'center', justifyContent: 'flex-end' }, weekBarTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' }, weekBarFill: { width: '100%', minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.coral, shadowColor: colors.pink, shadowOpacity: 0.75, shadowRadius: 7 }, weekBarLabel: { color: '#81758a', fontSize: 7, marginTop: 7 }, weekTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 12 }, weekTotalValue: { color: colors.text, fontSize: 27, fontWeight: '900' }, weekTotalLabel: { flex: 1, color: '#8d8294', fontSize: 8 }, weekChange: { color: colors.coral, fontSize: 10, fontWeight: '900' },
  linkFootnote: { color: '#766b7d', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 2 },
});
