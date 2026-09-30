import { useMemo, useState } from 'react';
import { highQualityAlbumArtwork } from './album-artwork';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import type { JourneyDetail, JourneySummary, MusicDashboardData, SoundtrackTrack } from './app-data';
import { compactArtistCredit } from './artist-credit';
import type { MusicProvider } from './music-preferences';
import {
  driveSongs, driveTitle, formatMilesShort, formatMinutesShort, newestJourney, routeLabel, soundtrackSummary,
  SOUNDTRACK_RANGES, type SoundtrackRange,
} from './redesign-model';
import {
  Artwork, Kicker, LargeTitle, RedesignPage, CANVAS_READING_WIDTH, SectionHeader, Segmented, StatGrid, Surface, redesignStyles, SERIF,
  useRedesignColors,
} from './redesign-ui';
import { IphoneRequiredCard } from './iphone-required';
import { isIpad } from './device-layout';
import { TouchPressable } from './touch-feedback';

const PROVIDER_LABEL: Record<MusicProvider, string> = {
  'apple-music': 'Apple Music', lastfm: 'Spotify', shazam: 'Song ID', 'spotify-direct': 'Spotify',
};

export function SoundtrackScreen({ status, message, music, provider, journeys, details, canOpenTracks, onTrack, onJourney, onRefresh }: {
  status: 'loading' | 'ready' | 'error'; message?: string; music: MusicDashboardData | null;
  provider: MusicProvider; journeys: JourneySummary[]; details: JourneyDetail[];
  canOpenTracks: boolean; onTrack: (track: SoundtrackTrack) => void; onJourney: (id: string) => void; onRefresh: () => Promise<void>;
}) {
  const colors = useRedesignColors();
  const [range, setRange] = useState<SoundtrackRange>('month');
  const [now] = useState(Date.now);
  const [refreshing, setRefreshing] = useState(false);
  const summary = useMemo(() => soundtrackSummary(journeys, details, range, now), [journeys, details, range, now]);
  const period = SOUNDTRACK_RANGES.find(item => item.id === range)!.period;
  const lastDrive = useMemo(() => newestJourney(journeys.filter(journey => journey.songCount > 0 || journey.soundtrackPreview.length > 0)), [journeys]);
  const lastSongs = useMemo(() => lastDrive ? driveSongs(lastDrive, details.find(detail => detail.id === lastDrive.id)) : [], [lastDrive, details]);
  const artistArt = useMemo(() => new Map((music?.topArtists ?? []).map(artist => [artist.artist.toLocaleLowerCase(), artist.artworkUrl])), [music?.topArtists]);
  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };
  const busiest = [...summary.dayparts].sort((a, b) => b.plays - a.plays)[0];
  const maxDaypart = Math.max(1, ...summary.dayparts.map(part => part.plays));
  const maxTrackPlays = Math.max(1, ...summary.topTracks.map(track => track.plays));

  return <RedesignPage maxWidth={CANVAS_READING_WIDTH} testID="soundtrack-screen" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
    <LargeTitle title="Soundtrack" trailing={<View accessible accessibilityLabel={`Music source: ${PROVIDER_LABEL[provider]}`} style={[styles.source, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
      <View style={[styles.sourceDot, { backgroundColor: colors.accent }]} />
      <Text style={[styles.sourceText, { color: colors.text }]}>{PROVIDER_LABEL[provider]}</Text>
    </View>} />
    <Segmented label="Time range" options={SOUNDTRACK_RANGES} value={range} onChange={setRange} />

    {status === 'loading' && !journeys.length ? <Surface style={styles.message}><ActivityIndicator color={colors.accent} /><Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>Building your soundtrack…</Text></Surface> : null}
    {status === 'error' ? <Surface style={styles.message}><Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{message ?? 'Your music could not refresh. Pull down to try again.'}</Text></Surface> : null}

    {summary.anthem ? <View testID="soundtrack-anthem" style={styles.anthem}>
      {summary.anthem.artworkUrl ? <ExpoImage source={{ uri: highQualityAlbumArtwork(summary.anthem.artworkUrl) ?? summary.anthem.artworkUrl }} blurRadius={40} contentFit="cover" style={styles.anthemBackdrop} /> : null}
      <LinearGradient pointerEvents="none" colors={[colors.photoScrim[0], colors.photoScrim[2], colors.page]} locations={[0, 0.6, 1]} style={styles.anthemBackdrop} />
      <Kicker color={colors.highlight}>{`Your road anthem · ${period}`}</Kicker>
      <View style={[styles.anthemArt, { boxShadow: `0 24px 60px ${colors.shadow}` }]}><Artwork uri={summary.anthem.artworkUrl} size={220} label={`${summary.anthem.track} artwork`} /></View>
      <View style={styles.anthemCopy}>
        <Text numberOfLines={2} style={[styles.anthemTitle, { color: colors.text }]}>{summary.anthem.track}</Text>
        <Text numberOfLines={1} style={[styles.anthemArtist, { color: colors.textSecondary }]}>{compactArtistCredit(summary.anthem.artist)}</Text>
      </View>
      <Text style={[styles.anthemDetail, { color: colors.text }]}>Played on {summary.anthem.drives} {summary.anthem.drives === 1 ? 'drive' : 'drives'} across {formatMilesShort(summary.anthem.miles)}</Text>
      {canOpenTracks ? <TouchPressable accessibilityRole="button" onPress={() => onTrack(toTrack(summary.anthem!))}
        style={({ pressed }) => [styles.playButton, { backgroundColor: colors.text }, pressed && redesignStyles.pressed]}>
        <SymbolView name="play.fill" tintColor={colors.page} size={13} />
        <Text style={[styles.playText, { color: colors.page }]}>Play in {PROVIDER_LABEL[provider]}</Text>
      </TouchPressable> : null}
    </View> : status !== 'loading' && !journeys.length && isIpad() ? <IphoneRequiredCard subject="Your soundtrack and top songs" /> : status !== 'loading' ? <Surface style={styles.message}>
      <SymbolView name="music.note" tintColor={colors.accent} size={24} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No songs {period}</Text>
      <Text style={[redesignStyles.caption, styles.center, { color: colors.textSecondary }]}>{range === 'all' ? 'Songs matched to your drives will build your soundtrack here.' : 'Try a longer time range, or take a drive with music playing.'}</Text>
    </Surface> : null}

    {summary.plays ? <Surface style={styles.stats}>
      <StatGrid items={[
        { value: summary.listeningMinutes === null ? '—' : formatMinutesShort(summary.listeningMinutes), label: 'listening' },
        { value: summary.plays.toLocaleString(), label: summary.plays === 1 ? 'play' : 'plays' },
        { value: summary.musicMilesPercent === null ? '—' : `${summary.musicMilesPercent}%`, label: 'of miles had music' },
      ]} />
    </Surface> : null}

    {lastDrive && lastSongs.length ? <View style={styles.section}>
      <SectionHeader title="Last drive" detail={`${driveTitle(lastDrive.startedAt)} · ${routeLabel(lastDrive)}`} actionLabel="Open" onAction={() => onJourney(lastDrive.id)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railBleed} contentContainerStyle={styles.rail}>
        {lastSongs.slice(0, 20).map((song, index) => <TouchPressable key={`${song.track}-${song.playedAt}-${index}`} disabled={!canOpenTracks} accessibilityRole="button"
          accessibilityLabel={`${song.track} by ${song.artist}${song.mile !== null ? `, at mile ${song.mile}` : ''}`} onPress={() => onTrack(song)}
          style={({ pressed }) => [styles.railItem, pressed && redesignStyles.pressed]}>
          <Artwork uri={song.artworkUrl} size={118} index={index} />
          <Text numberOfLines={1} style={[styles.railTitle, { color: colors.text }]}>{song.track}</Text>
          <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.accent }]}>{song.mile !== null ? `mile ${song.mile}` : song.playedAt ? new Date(song.playedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : compactArtistCredit(song.artist)}</Text>
        </TouchPressable>)}
      </ScrollView>
    </View> : null}

    {summary.topArtists.length ? <View style={styles.section}>
      <SectionHeader title="Top artists" detail={period} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railBleed} contentContainerStyle={styles.rail}>
        {summary.topArtists.map((artist, index) => {
          const art = artist.artworkUrl ?? artistArt.get(artist.artist.toLocaleLowerCase()) ?? null;
          return <View key={artist.artist} accessible accessibilityLabel={`Number ${index + 1}, ${artist.artist}, ${artist.plays} plays`} style={styles.artist}>
            {art ? <Artwork uri={art} size={72} round /> : <View style={[styles.artistInitial, { backgroundColor: colors.artwork[index % 4] }]}><Text style={[styles.artistInitialText, { color: colors.page }]}>{artist.artist.slice(0, 1).toUpperCase()}</Text></View>}
            <Text numberOfLines={1} style={[styles.artistName, { color: colors.text }]}>{compactArtistCredit(artist.artist)}</Text>
            <Text style={[styles.artistPlays, { color: colors.textSecondary }]}>#{index + 1} · {artist.plays} {artist.plays === 1 ? 'play' : 'plays'}</Text>
          </View>;
        })}
      </ScrollView>
    </View> : null}

    {summary.topTracks.length ? <Surface style={styles.list}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>Top songs</Text>
      {summary.topTracks.map((track, index) => <TouchPressable key={`${track.track}-${track.artist}`} disabled={!canOpenTracks} accessibilityRole="button"
        accessibilityLabel={`Number ${index + 1}, ${track.track} by ${track.artist}, ${track.plays} plays on ${track.drives} drives`} onPress={() => onTrack(toTrack(track))}
        style={({ pressed }) => [styles.trackRow, pressed && redesignStyles.pressed]}>
        <Text style={[styles.rank, { color: colors.textTertiary }]}>{index + 1}</Text>
        <Artwork uri={track.artworkUrl} size={44} index={index} />
        <View style={[redesignStyles.flex, styles.trackCopy]}>
          <View style={redesignStyles.row}>
            <Text numberOfLines={1} style={[redesignStyles.flex, styles.trackTitle, { color: colors.text }]}>{track.track}</Text>
            <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{track.plays} {track.plays === 1 ? 'play' : 'plays'}</Text>
          </View>
          <View style={[styles.meter, { backgroundColor: colors.track }]}><View style={[styles.meterFill, { width: `${Math.round((track.plays / maxTrackPlays) * 100)}%`, backgroundColor: colors.accent }]} /></View>
          <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{compactArtistCredit(track.artist)} · {track.drives} {track.drives === 1 ? 'drive' : 'drives'}</Text>
        </View>
      </TouchPressable>)}
    </Surface> : null}

    {summary.plays ? <Surface style={styles.list}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>When you listen</Text>
      <View style={styles.dayparts} accessible accessibilityLabel={summary.dayparts.map(part => `${part.label} ${part.plays} plays`).join(', ')}>
        {summary.dayparts.map(part => <View key={part.id} style={styles.daypart}>
          <View style={[styles.daypartBar, { height: Math.max(6, Math.round((part.plays / maxDaypart) * 70)), backgroundColor: part.id === busiest.id ? colors.highlight : colors.highlightSoft }]} />
          <Text style={[styles.daypartLabel, { color: part.id === busiest.id ? colors.text : colors.textSecondary, fontWeight: part.id === busiest.id ? '700' : '500' }]}>{part.label}</Text>
        </View>)}
      </View>
      <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{busiest.label}s are your loudest drives: {Math.round((busiest.plays / summary.plays) * 100)}% of plays {period}.</Text>
    </Surface> : null}

    {summary.places.length ? <View style={styles.section}>
      <SectionHeader title="Sound of the place" detail="The song you play most where you arrive" />
      <View style={styles.placeGrid}>
        {summary.places.map(place => <Surface key={place.place} radius={20} style={styles.place}>
          <Kicker>{place.place}</Kicker>
          <Text numberOfLines={2} style={[styles.placeTrack, { color: colors.text }]}>{place.track}</Text>
          <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{place.plays} {place.plays === 1 ? 'play' : 'plays'} here</Text>
        </Surface>)}
      </View>
    </View> : null}

    <Text style={[redesignStyles.caption, styles.center, { color: colors.textTertiary }]}>{canOpenTracks ? `Tap a song to open it in ${PROVIDER_LABEL[provider]}. Search finds every play.` : 'Song ID saves only the match and timestamp, so songs do not open another app. Search finds every play.'}</Text>
  </RedesignPage>;
}

function toTrack(track: { track: string; artist: string; album: string | null; artworkUrl: string | null; externalUrl: string | null }): SoundtrackTrack {
  return { playedAt: null, track: track.track, artist: track.artist, album: track.album, durationMs: null, artworkUrl: track.artworkUrl, externalUrl: track.externalUrl, source: 'journeydeck', confidence: null };
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  center: { textAlign: 'center' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  sourceDot: { width: 8, height: 8, borderRadius: 4 },
  sourceText: { fontSize: 13, fontWeight: '600' },
  message: { padding: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  anthem: { alignItems: 'center', gap: 14, paddingTop: 8, paddingBottom: 4, marginHorizontal: -20, paddingHorizontal: 20, overflow: 'hidden' },
  anthemBackdrop: { position: 'absolute', left: 0, right: 0, top: -40, bottom: 0, opacity: 0.55 },
  anthemArt: { borderRadius: 44 },
  anthemCopy: { alignItems: 'center', gap: 4 },
  anthemTitle: { fontFamily: SERIF, fontSize: 30, lineHeight: 34, fontWeight: '600', textAlign: 'center' },
  anthemArtist: { fontSize: 16, lineHeight: 21 },
  anthemDetail: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  playButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 22, borderRadius: 23 },
  playText: { fontSize: 15, fontWeight: '700' },
  stats: { paddingVertical: 14, paddingHorizontal: 16 },
  railBleed: { marginHorizontal: -20 },
  rail: { gap: 12, paddingHorizontal: 20 },
  railItem: { width: 118, gap: 5 },
  railTitle: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  artist: { width: 76, alignItems: 'center', gap: 5 },
  artistInitial: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  artistInitialText: { fontSize: 26, fontWeight: '800' },
  artistName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  artistPlays: { fontSize: 11 },
  list: { padding: 16, gap: 14 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 16, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  trackCopy: { gap: 4 },
  trackTitle: { fontSize: 15, fontWeight: '600' },
  meter: { height: 4, borderRadius: 2, overflow: 'hidden' },
  meterFill: { height: 4, borderRadius: 2 },
  dayparts: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 94 },
  daypart: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  daypartBar: { width: '100%', borderRadius: 8 },
  daypartLabel: { fontSize: 11 },
  placeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  place: { width: '47.5%', flexGrow: 1, padding: 14, gap: 6 },
  placeTrack: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
});
