import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from './app-theme';
import { ivoryPalette } from './theme-palette';
import { IpadPageHeader } from './ipad-page-header';
import type { MusicDashboardState } from './music-screen';
import type { MusicDashboardData, SoundtrackTrack } from './app-data';
import type { MusicArchiveEntry } from './library-model';
import type { MusicProvider } from './music-preferences';

function useColors() {
  return useAppTheme().isLight
    ? { page: ivoryPalette.page, card: ivoryPalette.surface, text: ivoryPalette.text, muted: ivoryPalette.secondary, accent: ivoryPalette.violet, line: ivoryPalette.border, inset: ivoryPalette.lilac }
    : { page: '#08070d', card: '#120d1a', text: '#fff6ed', muted: '#b6a6c1', accent: '#b795e5', line: '#49304f', inset: '#291735' };
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.line }]}>
    <View style={styles.panelHeading}><Text accessibilityRole="header" style={[styles.panelTitle, { color: c.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.meta, { color: c.muted }]}>{subtitle}</Text> : null}</View>
    {children}
  </View>;
}

function Empty({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.empty, { color: c.muted }]}>{children}</Text>;
}

function Artwork({ uri, size, round = false }: { uri: string | null; size: number; round?: boolean }) {
  const c = useColors();
  const shape = { width: size, height: size, borderRadius: round ? size / 2 : 12 };
  return uri ? <Image source={{ uri }} contentFit="cover" cachePolicy="memory-disk" style={shape} />
    : <View style={[shape, styles.center, { backgroundColor: c.inset }]}><SymbolView name="music.note" tintColor={c.accent} style={styles.icon} /></View>;
}

function ListeningChart({ daily }: { daily: MusicDashboardData['daily'] }) {
  const c = useColors();
  const days = daily.slice(-7);
  const max = Math.max(1, ...days.map(day => day.minutes));
  if (!days.some(day => day.minutes > 0)) return <Empty>No saved song durations this week. Your listening time will appear as music is archived.</Empty>;
  return <View>
    <View style={styles.chart}>{days.map(day => <View key={day.date} style={styles.chartColumn}
      accessible accessibilityLabel={`${day.label}: ${Math.round(day.minutes)} minutes`}>
      <Text style={[styles.chartValue, { color: c.muted }]}>{Math.round(day.minutes)}</Text>
      <View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(0, day.minutes) / max * 100}%`, backgroundColor: c.accent }]} /></View>
      <Text numberOfLines={1} style={[styles.chartLabel, { color: c.muted }]}>{day.label}</Text>
    </View>)}</View>
    <Text style={[styles.chartFootnote, { color: c.muted }]}>Minutes per day, based on saved song durations.</Text>
  </View>;
}

function playedDate(entry: MusicArchiveEntry) {
  const date = new Date(entry.playedAt ?? entry.journeyStartedAt);
  return Number.isNaN(date.valueOf()) ? 'Time unavailable' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function IpadMusicScreen({ state, daily, provider, archive, query, onQueryChange, canOpenTracks, onTrack, onJourney, refreshing, onRefresh }: {
  daily: MusicDashboardData['daily'];
  state: MusicDashboardState; provider: MusicProvider; archive: MusicArchiveEntry[]; query: string; onQueryChange: (value: string) => void;
  canOpenTracks: boolean; onTrack: (track: SoundtrackTrack) => void; onJourney: (id: string) => void; refreshing: boolean; onRefresh: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [historyCount, setHistoryCount] = useState(6);
  const [galleryCount, setGalleryCount] = useState(6);
  useEffect(() => setHistoryCount(6), [query]);
  const data = state.data;
  const wide = width >= 960;
  const table = wide || width >= 640;
  const metricColumns = width >= 420 ? 2 : 1;
  const mainWidth = wide ? (width - 16) * 0.65 : width;
  const albumColumns = mainWidth >= 500 ? 3 : mainWidth >= 310 ? 2 : 1;
  const albumSize = Math.max(60, (mainWidth - 38 - (albumColumns - 1) * 14) / albumColumns);
  const providerName = provider === 'apple-music' ? 'Apple Music' : provider === 'lastfm' ? 'Spotify via Last.fm' : provider === 'shazam' ? 'Song Recognition' : 'Music archive';
  const metrics: { title: string; value: number | undefined; icon: SFSymbol; unit: string; digits: number }[] = [
    { title: 'Miles with music', value: data?.metrics.milesWithMusic, icon: 'road.lanes', unit: 'mi', digits: 1 },
    { title: 'Listening hours', value: data?.metrics.listeningHours, icon: 'headphones', unit: 'hrs', digits: 1 },
    { title: 'Songs on the road', value: data?.metrics.songsOnRoad, icon: 'music.note', unit: 'songs', digits: 0 },
    { title: 'Current streak', value: data?.metrics.currentStreak, icon: 'flame', unit: 'days', digits: 0 },
  ];
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
    <ScrollView testID="ipad-music" style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: insets.bottom + 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}>
      <View testID="ipad-music-canvas" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.canvas}>
        <IpadPageHeader title="Soundtracks" width={width} artwork={require('../assets/soundtracks-header-cinematic-v2.png')} subtitle={`${providerName} · Your journey soundtrack`} />
        {state.status === 'loading' && !data ? <ActivityIndicator accessibilityLabel="Loading your music archive" color={c.accent} /> : null}
        {state.status === 'error' ? <View accessibilityRole="alert" style={styles.notice}><Text style={[styles.body, { color: c.muted }]}>{state.message || 'Your music archive is temporarily unavailable.'}</Text>
          <Pressable accessibilityRole="button" onPress={onRefresh} disabled={refreshing} style={styles.action}><Text style={{ color: c.accent }}>Try again</Text></Pressable></View> : null}
        <View testID="ipad-music-artists-row" style={[styles.row, { flexDirection: wide ? 'row' : 'column' }]}>
          <View style={wide ? styles.main : undefined}><Panel title="Today's soundtrack" subtitle={data?.recentSelections.length ? `${data.recentSelections.length} recent selections` : undefined}>
            {data?.recentSelections.length ? <View testID="ipad-music-gallery" style={styles.albums}>
              {data.recentSelections.slice(0, galleryCount).map((track, i) => <Pressable key={`${track.playedAt}-${track.track}-${i}`} accessibilityRole="button" accessibilityLabel={`Open ${track.track} by ${track.artist}`}
                disabled={!canOpenTracks} onPress={() => onTrack(track)} style={({ pressed }) => [{ width: albumSize, gap: 7, opacity: pressed ? 0.65 : 1 }]}>
                <Artwork uri={track.artworkUrl} size={albumSize} /><Text numberOfLines={2} style={[styles.songTitle, { color: c.text }]}>{track.track}</Text><Text numberOfLines={1} style={[styles.meta, { color: c.muted }]}>{track.artist}</Text>
              </Pressable>)}
            </View> : <Empty>Your latest songs will appear here after JourneyDeck receives listening history.</Empty>}
            {(data?.recentSelections.length ?? 0) > galleryCount ? <Pressable accessibilityRole="button" accessibilityLabel="Show more soundtrack songs" onPress={() => setGalleryCount(count => count + 6)} style={styles.action}><Text style={[styles.songTitle, { color: c.accent }]}>Show more soundtrack songs</Text></Pressable> : null}
          </Panel></View>
          <View testID="ipad-music-summary" style={[wide ? styles.side : undefined, styles.summary]}>
            <View style={styles.metrics}>{metrics.map(metric => <View key={metric.title} style={{ width: `${100 / metricColumns}%`, padding: 6 }}>
          <View style={[styles.metric, { borderColor: c.line, backgroundColor: c.card }]}><View style={[styles.metricIcon, { backgroundColor: c.inset }]}><SymbolView name={metric.icon} tintColor={c.accent} style={styles.icon} /></View>
            <View style={styles.flex}><Text style={[styles.meta, { color: c.muted }]}>{metric.title}</Text><Text style={[styles.value, { color: c.text }]}>
              {metric.value == null ? '—' : metric.value.toLocaleString(undefined, { maximumFractionDigits: metric.digits })} <Text style={[styles.meta, { color: c.muted }]}>{metric.unit}</Text></Text></View></View>
        </View>)}</View>
            <Panel title="Top artists" subtitle="All-time archive">
            {data?.topArtists.length ? <View>{data.topArtists.slice(0, 5).map((artist, i) => <View key={artist.artist} style={[styles.artist, { borderColor: c.line }]}>
              <Text style={[styles.rank, { color: c.accent }]}>{i + 1}</Text><Artwork uri={artist.artworkUrl} size={32} round />
              <Text numberOfLines={2} style={[styles.flex, styles.songTitle, { color: c.text }]}>{artist.artist}</Text><Text style={[styles.meta, { color: c.muted }]}>{artist.plays} plays</Text>
            </View>)}</View> : <Empty>Your artist ranking will grow with your listening archive.</Empty>}
          </Panel>
            <Panel title="Listening time" subtitle="Last 7 days"><ListeningChart daily={daily} /></Panel>
          </View>
        </View>
        <View><Panel title="Listening history" subtitle={`${archive.length} journey plays`}>
            <TextInput accessibilityLabel="Search listening history" value={query} onChangeText={onQueryChange} placeholder="Search songs, artists, albums, or places" placeholderTextColor={c.muted}
              autoCorrect={false} clearButtonMode="while-editing" style={[styles.search, { color: c.text, backgroundColor: c.page, borderColor: c.line }]} />
            {table && archive.length > 0 ? <View style={styles.tableHeading}><Text style={[styles.songCell, styles.meta, { color: c.muted }]}>Song / Artist</Text><Text style={[styles.routeCell, styles.meta, { color: c.muted }]}>Journey</Text><Text style={[styles.timeCell, styles.meta, { color: c.muted }]}>Time</Text></View> : null}
            {archive.slice(0, historyCount).map(entry => <View key={entry.key} style={[styles.historyRow, { borderColor: c.line, flexDirection: table ? 'row' : 'column' }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${entry.track} by ${entry.artist}`} disabled={!canOpenTracks} onPress={() => onTrack(entry)} style={[styles.track, table ? styles.songCell : undefined]}>
                <Artwork uri={entry.artworkUrl} size={38} /><View style={styles.flex}><Text numberOfLines={2} style={[styles.songTitle, { color: c.text }]}>{entry.track}</Text><Text numberOfLines={1} style={[styles.meta, { color: c.muted }]}>{entry.artist}</Text></View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open journey ${entry.routeLabel}`} onPress={() => onJourney(entry.journeyId)} style={[styles.action, table ? styles.routeCell : undefined]}>
                <Text numberOfLines={2} style={[styles.meta, { color: c.accent }]}>{entry.routeLabel} ›</Text>
              </Pressable><Text style={[styles.meta, table ? styles.timeCell : undefined, { color: c.muted }]}>{playedDate(entry)}</Text>
            </View>)}
            {!archive.length ? <Empty>{query ? 'No listening moments match that search.' : 'Songs matched to journeys will build your searchable archive here.'}</Empty> : null}
            {archive.length > historyCount ? <Pressable accessibilityRole="button" onPress={() => setHistoryCount(count => count + 12)} style={styles.action}><Text style={[styles.songTitle, { color: c.accent }]}>Show more listening history</Text></Pressable> : null}
        </Panel></View>
        <Text style={[styles.meta, { color: c.muted }]}>{canOpenTracks ? `Tap a song to open it in ${provider === 'lastfm' ? 'Spotify' : 'Apple Music'}. Tap a journey to see the drive.` : 'Song Recognition saves individual matches. Song links are unavailable for this source.'}</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 1400, alignSelf: 'center', gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  row: { gap: 16, alignItems: 'stretch' }, main: { flex: 0.65, minWidth: 0 }, side: { flex: 0.35, minWidth: 0 },
  panel: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12, flexGrow: 1 }, panelHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  panelTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 }, meta: { fontSize: 12, lineHeight: 18 }, body: { fontSize: 15, lineHeight: 22 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', margin: -6 }, metric: { flex: 1, minHeight: 92, borderRadius: 22, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, icon: { width: 22, height: 22 }, value: { fontSize: 24, fontWeight: '700', marginTop: 3 },
  summary: { gap: 16 }, albums: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingBottom: 8 }, center: { alignItems: 'center', justifyContent: 'center' }, songTitle: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  artist: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 7 }, rank: { width: 16, fontSize: 13 },
  search: { borderRadius: 14, borderWidth: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  tableHeading: { flexDirection: 'row', gap: 12 }, historyRow: { gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'stretch' },
  songCell: { flex: 1.3, minWidth: 0 }, routeCell: { flex: 1, minWidth: 0 }, timeCell: { width: 105, alignSelf: 'center' }, track: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  action: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 }, empty: { minHeight: 120, fontSize: 14, lineHeight: 22, paddingVertical: 22 }, notice: { gap: 8 },
  chart: { height: 100, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, chartColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  chartValue: { fontSize: 11 }, barTrack: { height: 60, width: '70%', justifyContent: 'flex-end' }, bar: { width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartLabel: { fontSize: 11 }, chartFootnote: { fontSize: 12, marginTop: 16 },
});
