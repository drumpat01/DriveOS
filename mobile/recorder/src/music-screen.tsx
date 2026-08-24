import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';

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

export function MusicScreen({ state, provider, onRefresh }: { state: MusicDashboardState; provider: MusicProvider; onRefresh: () => void }) {
  const data = state.data;
  const latest = data?.recentSelections[0] ?? null;
  const canOpenTracks = provider === 'apple-music' || provider === 'lastfm';
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={state.status === 'loading' && Boolean(data)} onRefresh={onRefresh} tintColor={colors.pink} />}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR ROAD, YOUR SOUNDTRACK</Text>
        <Text style={styles.pageTitle}>MUSIC</Text>
        <Text style={styles.pageBody}>The songs that turn every journey into part of your story.</Text>
      </View>

      {state.status === 'loading' && !data ? <View style={styles.loading}><ActivityIndicator color={colors.pink} /><Text style={styles.loadingText}>Building your soundtrack…</Text></View> : null}
      {state.status === 'error' ? <View style={styles.notice}><Text style={styles.noticeTitle}>Music archive unavailable</Text><Text style={styles.noticeBody}>{state.message}</Text><Pressable onPress={onRefresh} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}

      {data ? <>
        <Pressable disabled={!latest || !canOpenTracks} onPress={() => latest && void openTrack(latest, provider)} style={styles.hero}>
          <View style={styles.heroGlowPink} /><View style={styles.heroGlowBlue} />
          <View style={styles.heroArtworkShell}>
            <View style={styles.vinylRingOuter}><View style={styles.vinylRingMiddle}><View style={styles.vinylRingInner} /></View></View>
            {latest?.artworkUrl ? <Image source={{ uri: latest.artworkUrl }} style={styles.heroArtwork} /> : <View style={styles.heroArtworkFallback}><Text style={styles.heroNote}>♪</Text></View>}
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
            {artist.artworkUrl ? <Image source={{ uri: artist.artworkUrl }} style={styles.artistArtwork} /> : <View style={styles.artistFallback}><Text style={styles.artistInitial}>{artist.artist.slice(0, 1).toUpperCase()}</Text></View>}
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
          <CardHeader title="Listening intensity" kicker="LAST 7 DAYS" />
          <IntensityChart daily={data.daily.slice(-7)} />
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
  return <View style={styles.cardHeader}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardKicker}>{kicker}</Text></View>;
}

function AlbumCard({ track, enabled, onPress }: { track: SoundtrackTrack; enabled: boolean; onPress: () => void }) {
  return <Pressable disabled={!enabled} onPress={onPress} style={({ pressed }) => [styles.albumCard, pressed && enabled && styles.albumPressed]}>
    {track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.albumArtwork} /> : <View style={styles.albumFallback}><Text style={styles.albumNote}>♪</Text></View>}
    <Text style={styles.albumTitle} numberOfLines={1}>{track.track}</Text><Text style={styles.albumArtist} numberOfLines={1}>{track.artist}</Text>
  </Pressable>;
}

function Empty({ text }: { text: string }) { return <Text style={styles.empty}>{text}</Text>; }

function RouteGlow() {
  return <View style={styles.routeGraphic}><View style={styles.routeAura} /><View style={styles.routeLineOne} /><View style={styles.routeLineTwo} /><View style={styles.routeStart} /><View style={styles.routeEnd} /></View>;
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
  const maximum = Math.max(1, ...daily.map(day => day.count));
  const points = useMemo(() => daily.map((day, index) => ({ x: daily.length > 1 ? 10 + index * ((Math.max(20, width) - 20) / (daily.length - 1)) : width / 2, y: 12 + (1 - day.count / maximum) * 78 })), [daily, maximum, width]);
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

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  pageContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 132, gap: 13 },
  header: { paddingHorizontal: 3, paddingTop: 6, paddingBottom: 4 }, eyebrow: { color: '#ad7dff', fontSize: 10, fontWeight: '900', letterSpacing: 2.2 }, pageTitle: { color: colors.text, fontSize: 38, lineHeight: 42, fontWeight: '900', marginTop: 7 }, pageBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: colors.muted, fontSize: 12 },
  notice: { borderWidth: 1, borderColor: '#744152', backgroundColor: '#1a0b15', borderRadius: 18, padding: 15, gap: 7 }, noticeTitle: { color: '#ff9a83', fontWeight: '900', fontSize: 14 }, noticeBody: { color: '#ad9da8', fontSize: 12, lineHeight: 18 }, retry: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#3b1930', paddingHorizontal: 13, paddingVertical: 8 }, retryText: { color: '#ff8bb6', fontWeight: '900', fontSize: 10 },
  hero: { minHeight: 210, borderRadius: 27, borderWidth: 1, borderColor: '#5c2672', backgroundColor: '#090413', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 17, gap: 15, shadowColor: '#9b36ff', shadowOpacity: 0.28, shadowRadius: 22 },
  heroGlowPink: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: '#a11852', opacity: 0.20, left: -95, top: -55 }, heroGlowBlue: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: '#371d91', opacity: 0.22, right: -110, bottom: -135 },
  heroArtworkShell: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' }, vinylRingOuter: { position: 'absolute', width: 128, height: 128, borderRadius: 64, borderWidth: 1, borderColor: '#8a4d9a', backgroundColor: '#0a0710', alignItems: 'center', justifyContent: 'center' }, vinylRingMiddle: { width: 105, height: 105, borderRadius: 53, borderWidth: 1, borderColor: '#4a294f', alignItems: 'center', justifyContent: 'center' }, vinylRingInner: { width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: '#291630' }, heroArtwork: { width: 98, height: 98, borderRadius: 15, shadowColor: colors.pink, shadowOpacity: 0.75, shadowRadius: 15 }, heroArtworkFallback: { width: 98, height: 98, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#37132f', borderWidth: 1, borderColor: '#7f315b' }, heroNote: { color: '#ff6f9b', fontSize: 43, fontWeight: '900' },
  heroCopy: { flex: 1, alignItems: 'flex-start' }, heroEyebrow: { color: '#ff7559', fontSize: 7, fontWeight: '900', letterSpacing: 1.1, marginBottom: 9 }, heroTitle: { color: colors.text, fontSize: 19, lineHeight: 21, fontWeight: '900' }, heroAccent: { color: '#ff4e8b', fontSize: 26, lineHeight: 29, fontStyle: 'italic', fontWeight: '900', textShadowColor: '#ff2f79', textShadowRadius: 12 }, heroService: { color: '#81748b', fontSize: 7, letterSpacing: 1.1, fontWeight: '900', marginTop: 8 },
  waveform: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5 }, waveBar: { width: 2, borderRadius: 2, backgroundColor: colors.pink, shadowColor: colors.pink, shadowOpacity: 0.85, shadowRadius: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, metric: { width: '48.6%', minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 19, borderWidth: 1, borderColor: '#392345', backgroundColor: colors.panel, padding: 11 }, metricIcon: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.45, shadowRadius: 10 }, metricSymbol: { fontSize: 18, fontWeight: '900' }, metricCopy: { flex: 1 }, metricLabel: { color: '#94899d', fontSize: 8, lineHeight: 11 }, metricValue: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 2 }, metricDetail: { color: '#7f7389', fontSize: 7, lineHeight: 10, marginTop: 1 },
  panel: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 13, overflow: 'hidden' }, cardHeader: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }, cardTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900' }, cardKicker: { color: '#ff537d', fontSize: 7, fontWeight: '900', letterSpacing: 0.65 },
  albumStrip: { gap: 11, paddingRight: 4 }, albumCard: { width: 112 }, albumPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }, albumArtwork: { width: 112, height: 112, borderRadius: 13, borderWidth: 1, borderColor: '#56304e' }, albumFallback: { width: 112, height: 112, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27142c', borderWidth: 1, borderColor: '#56304e' }, albumNote: { color: colors.pink, fontSize: 35, fontWeight: '900' }, albumTitle: { color: colors.text, fontSize: 11, fontWeight: '900', marginTop: 8 }, albumArtist: { color: '#8d8295', fontSize: 9, marginTop: 2 }, empty: { color: '#82778a', fontSize: 11, lineHeight: 17, paddingVertical: 12 },
  artistList: { gap: 2 }, artistRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#291932' }, artistRank: { width: 21, color: '#71657d', fontSize: 8 }, artistArtwork: { width: 32, height: 32, borderRadius: 16 }, artistFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#251634', borderWidth: 1, borderColor: '#4e2e68', alignItems: 'center', justifyContent: 'center' }, artistInitial: { color: '#c9aaff', fontWeight: '900' }, artistName: { flex: 1, color: '#e9e2ec', fontSize: 11, fontWeight: '800' }, artistPlays: { color: '#8d8196', fontSize: 8 },
  insightPair: { flexDirection: 'row', gap: 10 }, flexCard: { flex: 1 }, insightCard: { minHeight: 175, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, padding: 14, overflow: 'hidden' }, tourValue: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 2 }, tourUnit: { color: '#aa9db0', fontSize: 8 }, routeGraphic: { height: 67, marginTop: 2 }, routeAura: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#fa4a1e', opacity: 0.14, right: -15, top: -17 }, routeLineOne: { position: 'absolute', width: 95, height: 3, borderRadius: 2, backgroundColor: colors.coral, left: 8, top: 37, transform: [{ rotate: '-18deg' }], shadowColor: colors.coral, shadowOpacity: 1, shadowRadius: 8 }, routeLineTwo: { position: 'absolute', width: 58, height: 3, borderRadius: 2, backgroundColor: colors.pink, right: 1, top: 28, transform: [{ rotate: '19deg' }], shadowColor: colors.pink, shadowOpacity: 1, shadowRadius: 8 }, routeStart: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#ffc0ae', left: 5, top: 50 }, routeEnd: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.pink, right: 2, top: 37 }, change: { color: '#ff795c', fontSize: 7, fontWeight: '800' }, changeDown: { color: '#ffb05c' },
  moodBlock: { flex: 1, justifyContent: 'space-between', paddingTop: 8 }, moodBar: { height: 17, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.track }, moodLegend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 12 }, moodItem: { width: '50%' }, moodPercent: { fontSize: 10, fontWeight: '900' }, moodLabel: { color: '#817589', fontSize: 7, marginTop: 3 }, moodFootnote: { color: '#ff765a', fontSize: 6.5, marginTop: 15 },
  cityList: { gap: 12, paddingTop: 2 }, cityRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, cityName: { width: 103, color: '#d8cfdd', fontSize: 9 }, cityTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#27172f', overflow: 'hidden' }, cityFill: { height: 6, borderRadius: 3, backgroundColor: colors.pink, shadowColor: colors.pink, shadowOpacity: 1, shadowRadius: 6 }, cityCount: { width: 25, color: '#b9a9c1', fontSize: 9, fontWeight: '800', textAlign: 'right' },
  chart: { height: 116, overflow: 'hidden' }, chartGlow: { position: 'absolute', left: 0, right: 0, bottom: 10, height: 67, backgroundColor: '#6f162d', opacity: 0.22, borderTopLeftRadius: 120, borderTopRightRadius: 120 }, chartLine: { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: colors.coral, shadowColor: colors.pink, shadowOpacity: 1, shadowRadius: 8 }, chartDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, borderWidth: 2, borderColor: '#ff9b84' }, chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }, chartLabel: { width: 16, textAlign: 'center', color: '#74697d', fontSize: 7 },
  weekBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 3 }, weekBarItem: { flex: 1, height: 105, alignItems: 'center', justifyContent: 'flex-end' }, weekBarTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' }, weekBarFill: { width: '100%', minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.coral, shadowColor: colors.pink, shadowOpacity: 0.75, shadowRadius: 7 }, weekBarLabel: { color: '#81758a', fontSize: 7, marginTop: 7 }, weekTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 12 }, weekTotalValue: { color: colors.text, fontSize: 27, fontWeight: '900' }, weekTotalLabel: { flex: 1, color: '#8d8294', fontSize: 8 }, weekChange: { color: colors.coral, fontSize: 10, fontWeight: '900' },
  linkFootnote: { color: '#766b7d', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 2 },
});
