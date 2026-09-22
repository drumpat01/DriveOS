import { compactArtistCredit } from './artist-credit';
import { TouchPressable as Pressable } from './touch-feedback';
import { useAppTheme, useThemedStyles } from './app-theme';
import { useAdaptiveLayout } from './adaptive-layout';
import { IpadMusicScreen } from './ipad-music-screen';
import { ipadListeningDays } from './ipad-music-data';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import {
  Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

import type { JourneyDetail, JourneySummary, MusicDashboardData, SoundtrackTrack } from './app-data';
import type { MusicProvider } from './music-preferences';
import { musicTrackDestination } from './music-destination';
import { buildMusicArchive, filterMusicArchive, topArchiveTracks, type MusicArchiveEntry } from './library-model';
import { NeonWidget, QuietInset } from './neon-widget-outline';
import { PhoneTabTitle } from './phone-tab-title';
import { JourneyImage } from './journey-image';
import { useListRowMotion } from './list-motion';
import { MusicArchiveSkeleton } from './list-skeleton';

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

async function openTrack(track: SoundtrackTrack, provider: MusicProvider) {
  const destination = musicTrackDestination(track, provider);
  if (!destination) return;
  try { await Linking.openURL(destination); }
  catch { Alert.alert('Music app unavailable', `JourneyDeck could not open ${provider === 'lastfm' ? 'Spotify' : 'Apple Music'} right now.`); }
}

export function MusicScreen({ state, provider, journeys, details, onJourney, onRefresh }: { state: MusicDashboardState; provider: MusicProvider; journeys: JourneySummary[]; details: JourneyDetail[]; onJourney: (id: string) => void; onRefresh: () => Promise<void> }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const data = state.data;
  const canOpenTracks = provider === 'apple-music' || provider === 'lastfm';
  const insets = useSafeAreaInsets();
  const layout = useAdaptiveLayout();
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [ranking, setRanking] = useState<'artists' | 'tracks'>('artists');
  const archive = useMemo(() => buildMusicArchive(journeys, details), [journeys, details]);
  const visibleArchive = useMemo(() => filterMusicArchive(archive, archiveQuery), [archive, archiveQuery]);
  const topTracks = useMemo(() => topArchiveTracks(archive), [archive]);
  const historyLimit = archiveQuery.trim() || showAllHistory ? 60 : 5;
  const ipadDaily = useMemo(() => ipadListeningDays(archive), [archive, state.data?.generatedAt]);
  const refreshFromGesture = useCallback(async () => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try { await onRefresh(); }
    finally { setManualRefreshing(false); }
  }, [manualRefreshing, onRefresh]);
  if (layout.isRegular) return <IpadMusicScreen state={state} daily={ipadDaily} provider={provider} archive={visibleArchive} query={archiveQuery} onQueryChange={setArchiveQuery}
    canOpenTracks={canOpenTracks} onTrack={track => void openTrack(track, provider)} onJourney={onJourney} refreshing={manualRefreshing} onRefresh={() => void refreshFromGesture()} />;
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 112 }]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={() => void refreshFromGesture()} tintColor={theme.color(colors.pink, 'text')} />}
    >
      <MusicAtmosphere />
      <SoundtracksHeroHeader />

      <View style={styles.sourceGuidance}>
        <Text style={styles.sourceGuidanceKicker}>{provider === 'apple-music' ? 'AUTOMATIC · RECOMMENDED' : provider === 'shazam' ? 'MANUAL · ONE SONG AT A TIME' : 'INTERNAL MUSIC SOURCE'}</Text>
        <Text style={styles.sourceGuidanceText}>{provider === 'apple-music' ? 'JourneyDeck checks your authorized Apple Music history during and after each journey. Some song locations may be estimated.' : provider === 'shazam' ? 'JourneyDeck does not listen automatically. During an active journey, open the recorder and tap Identify Song for every track you want to save.' : 'This music source is available only in internal testing.'}</Text>
      </View>

      {state.status === 'loading' && !data ? <Panel title="Listening history" kicker="LOADING"><MusicArchiveSkeleton /></Panel> : null}
      {state.status === 'error' ? <View style={styles.notice}><Text style={styles.noticeTitle}>Music archive unavailable</Text><Text style={styles.noticeBody}>{state.message}</Text><Pressable onPress={() => void onRefresh()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}

      {data ? <>
        <Panel title="Latest road soundtrack" kicker={data.recentSelections.length ? `${data.recentSelections.length} RECENT` : 'WAITING FOR MUSIC'}>
          {data.recentSelections.length ? <LatestSoundtrack track={data.recentSelections[0]} enabled={canOpenTracks} onPress={() => void openTrack(data.recentSelections[0], provider)} /> : <Empty text="Your latest song will appear here after JourneyDeck receives listening history." />}
        </Panel>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricRail} contentInsetAdjustmentBehavior="never">
          <Metric symbol="car.fill" label="Miles with music" value={number(data.metrics.milesWithMusic)} detail="all time" accent={colors.coral} />
          <Metric symbol="headphones.circle.fill" label="Listening hours" value={number(data.metrics.listeningHours)} detail="from archived plays" accent={colors.pink} />
          <Metric symbol="waveform.circle.fill" label="Songs on the road" value={number(data.metrics.songsOnRoad, 0)} detail="matched to journeys" accent={colors.coral} />
          <Metric symbol="flame.fill" label="Current streak" value={number(data.metrics.currentStreak, 0)} detail="days with music" accent="#ff4560" />
        </ScrollView>

        <Panel title="Listening history" kicker={`${archive.length} JOURNEY PLAYS`}>
          <TextInput value={archiveQuery} onChangeText={setArchiveQuery} placeholder="Search songs, artists, albums, or places" placeholderTextColor={theme.color("#746a7c", 'text')} style={styles.archiveSearch} />
          {visibleArchive.slice(0, historyLimit).map(entry => <ArchiveRow key={entry.key} entry={entry} canOpenTracks={canOpenTracks} provider={provider} onJourney={onJourney} />)}
          {!visibleArchive.length && <Empty text={archiveQuery ? 'No listening moments match that search.' : 'Songs matched to journeys will build your searchable archive here.'} />}
          {!archiveQuery.trim() && visibleArchive.length > 5 ? <Pressable accessibilityRole="button" onPress={() => setShowAllHistory(value => !value)} style={styles.sectionAction}><Text style={styles.sectionActionText}>{showAllHistory ? 'Show less' : `View all ${visibleArchive.length} plays`}</Text><SymbolView name={showAllHistory ? 'chevron.up' : 'chevron.down'} tintColor={theme.palette.accent} weight="semibold" style={styles.sectionActionIcon} /></Pressable> : null}
        </Panel>

        <Panel title="Your sound" kicker="ALL-TIME ARCHIVE">
          <View accessibilityRole="tablist" style={styles.rankingTabs}>
            {(['artists', 'tracks'] as const).map(option => <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: ranking === option }} onPress={() => setRanking(option)} style={[styles.rankingTab, ranking === option && styles.rankingTabSelected]}><Text style={[styles.rankingTabText, ranking === option && styles.rankingTabTextSelected]}>{option === 'artists' ? 'Artists' : 'Tracks'}</Text></Pressable>)}
          </View>
          {ranking === 'artists' ? (data.topArtists.length ? <View style={styles.artistList}>{data.topArtists.slice(0, 5).map((artist, index) => <View key={artist.artist} style={styles.artistRow}>
            <Text style={styles.artistRank}>{String(index + 1).padStart(2, '0')}</Text>
            {artist.artworkUrl ? <JourneyImage imageIdentity={`artist-${artist.artist}`} source={{ uri: artist.artworkUrl }} style={styles.artistArtwork} contentFit="cover" /> : <View style={styles.artistFallback}><Text style={styles.artistInitial}>{artist.artist.slice(0, 1).toUpperCase()}</Text></View>}
            <Text style={styles.artistName} numberOfLines={1}>{artist.artist}</Text>
            <Text style={styles.artistPlays}>{number(artist.plays, 0)} plays</Text>
          </View>)}</View> : <Empty text="Your artist ranking will grow with your listening archive." />) : (topTracks.length ? topTracks.slice(0, 5).map((track, index) => <View key={`${track.track}-${track.artist}`} style={styles.topTrackRow}><Text style={styles.artistRank}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.flexCard}><Text numberOfLines={1} style={styles.archiveTitle}>{track.track}</Text><Text accessibilityLabel={track.artist} numberOfLines={1} style={styles.archiveArtist}>{compactArtistCredit(track.artist)}</Text></View><Text style={styles.artistPlays}>{track.plays} plays</Text></View>) : <Empty text="Your most-played road songs will appear here." />)}
        </Panel>

        <View style={styles.insightCard}>
          <CardHeader title="Road insights" kicker="THIS WEEK" />
          <View style={styles.insightSummary}><View><Text style={styles.tourValue}>{number(data.tour.miles)}</Text><Text style={styles.tourUnit}>miles with a soundtrack</Text></View><View style={styles.weekSummary}><Text style={styles.weekSummaryValue}>{number(data.week.total, 0)}</Text><Text style={styles.tourUnit}>plays this week</Text></View></View>
          <RouteGlow />
          <Text style={[styles.change, (data.tour.changePercent ?? 0) < 0 && styles.changeDown]}>{data.tour.changePercent === null ? 'Your first week of matched journey music' : `${data.tour.changePercent >= 0 ? '↑' : '↓'} ${Math.abs(data.tour.changePercent)}% mileage vs last week`}</Text>
        </View>

        {data.mood.some(item => item.count > 0) ? <View style={styles.insightCard}>
          <CardHeader title="Mood by mile" kicker="WHEN YOU LISTEN" />
          <MoodBar items={data.mood} />
        </View> : null}

        {data.cities.length ? <View style={styles.insightCard}>
          <CardHeader title="Cities & sound" kicker="JOURNEY MATCHES" />
          <CityBars items={data.cities} />
        </View> : null}

        {data.daily.some(day => day.minutes > 0) ? <View style={styles.insightCard}>
          <CardHeader title="Listening time" kicker="LAST 7 DAYS" />
          <IntensityChart daily={data.daily.slice(-7)} />
          <Text style={styles.chartFootnote}>Minutes listened each day</Text>
        </View> : null}

        {!canOpenTracks ? <Text style={styles.linkFootnote}>Manual Song Recognition saves only the match and timestamp, so JourneyDeck leaves track taps inactive.</Text> : <Text style={styles.linkFootnote}>Tap any album to open it in {provider === 'lastfm' ? 'Spotify' : 'Apple Music'}.</Text>}
      </> : null}
    </ScrollView>
  );
}

function Metric({ symbol, label, value, detail, accent }: { symbol: SFSymbol; label: string; value: string; detail: string; accent: string }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const iconColor = theme.id === 'midnight-canopy' ? theme.palette.text : theme.color(accent, 'text');
  return <QuietInset radius={19} accent={accent} style={styles.metric}><View accessible={false} style={[styles.metricIconHalo, { borderColor: theme.color(`${accent}66`, 'border'), shadowColor: theme.color(accent, 'shadow') }]}><LinearGradient colors={theme.id === 'midnight-canopy' ? [symbol === 'flame.fill' ? theme.palette.rose : theme.palette.coral, symbol === 'flame.fill' ? theme.palette.rose : theme.palette.coral] : [theme.color(`${accent}66`, 'surface'), theme.color(`${accent}18`, 'surface')]} style={styles.metricIcon}><SymbolView name={symbol} tintColor={iconColor} type="hierarchical" weight="bold" style={styles.metricSymbol} /></LinearGradient></View><View style={styles.metricCopy}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, theme.id === 'midnight-canopy' && { color: theme.palette.amber }]}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View></QuietInset>;
}

function ArchiveRow({ entry, canOpenTracks, provider, onJourney }: {
  entry: MusicArchiveEntry; canOpenTracks: boolean; provider: MusicProvider; onJourney: (id: string) => void;
}) {
  const styles = useThemedStyles(darkStyles);
  const motion = useListRowMotion();
  return <Animated.View entering={motion.entering} exiting={motion.exiting} layout={motion.layout} style={styles.archiveRow}>
    <Pressable disabled={!canOpenTracks} onPress={() => void openTrack(entry, provider)} style={styles.archiveTrackButton}>
      {entry.artworkUrl ? <JourneyImage imageIdentity={`archive-${entry.key}`} source={{ uri: entry.artworkUrl }} style={styles.archiveArtwork} contentFit="cover" /> : <View style={styles.archiveArtworkFallback}><Text style={styles.archiveNote}>♪</Text></View>}
      <View style={styles.archiveCopy}><Text style={styles.archiveTitle} numberOfLines={1}>{entry.track}</Text><Text style={styles.archiveArtist} numberOfLines={1}>{entry.artist}{entry.album ? `  •  ${entry.album}` : ''}</Text><Text style={styles.archiveRoute} numberOfLines={1}>{entry.routeLabel}</Text></View>
    </Pressable>
    <Pressable onPress={() => onJourney(entry.journeyId)} style={styles.archiveJourneyButton}><Text style={styles.archiveJourneyText}>Journey ›</Text></Pressable>
  </Animated.View>;
}

function LatestSoundtrack({ track, enabled, onPress }: { track: SoundtrackTrack; enabled: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${track.track} by ${track.artist}`} accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={onPress} style={styles.latestSoundtrack}>
    {track.artworkUrl ? <JourneyImage imageIdentity={`latest-soundtrack-${track.track}-${track.artist}`} source={{ uri: track.artworkUrl }} style={styles.latestArtwork} contentFit="cover" /> : <View style={styles.latestArtworkFallback}><SymbolView name="music.note" tintColor={theme.palette.accent} weight="bold" style={styles.latestArtworkSymbol} /></View>}
    <View style={styles.latestCopy}><Text style={styles.latestKicker}>MOST RECENT PLAY</Text><Text numberOfLines={2} style={styles.latestTitle}>{track.track}</Text><Text numberOfLines={1} style={styles.latestArtist}>{compactArtistCredit(track.artist)}</Text>{track.album ? <Text numberOfLines={1} style={styles.latestAlbum}>{track.album}</Text> : null}</View>
    {enabled ? <SymbolView name="arrow.up.right" tintColor={theme.palette.accent} weight="semibold" style={styles.latestOpenIcon} /> : null}
  </Pressable>;
}

function SoundtracksHeroHeader() {
  return <PhoneTabTitle title="Soundtracks" />;
}

function Panel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  const styles = useThemedStyles(darkStyles);

  return <NeonWidget radius={24} style={styles.panel}><CardHeader title={title} kicker={kicker} />{children}</NeonWidget>;
}

function CardHeader({ title, kicker }: { title: string; kicker: string }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.cardHeader}><View style={styles.cardTitleGroup}><View style={styles.cardAccent} /><Text style={styles.cardTitle}>{title}</Text></View><Text style={styles.cardKicker}>{kicker}</Text></View>;
}

function Empty({ text }: { text: string }) {
  const styles = useThemedStyles(darkStyles);
 return <Text style={styles.empty}>{text}</Text>; }

function RouteGlow() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.routeGraphic}>
    <Svg width="100%" height="100%" viewBox="0 0 150 70">
      <Defs><SvgLinearGradient id="mileageRoad" x1="8" y1="58" x2="142" y2="12" gradientUnits="userSpaceOnUse"><Stop offset="0" stopColor={theme.color("#ff795b", 'accent')} /><Stop offset="0.55" stopColor={theme.color("#ff4d87", 'accent')} /><Stop offset="1" stopColor={theme.color("#b46cff", 'accent')} /></SvgLinearGradient></Defs>
      <Path d="M8 57 C35 57 34 20 65 21 C95 22 99 56 140 13" fill="none" stroke={theme.color("#28152f", 'accent')} strokeWidth="11" strokeLinecap="round" />
      <Path d="M8 57 C35 57 34 20 65 21 C95 22 99 56 140 13" fill="none" stroke="url(#mileageRoad)" strokeWidth="3" strokeLinecap="round" />
      <Path d="M15 54 C37 49 38 27 61 25 C87 23 101 48 133 18" fill="none" stroke={theme.color("#ffe3d8", 'accent')} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 7" opacity="0.78" />
      <Circle cx="8" cy="57" r="5" fill={theme.color("#ffb39d", 'accent')} stroke={theme.color("#fff2ec", 'accent')} strokeWidth="2" />
      <Circle cx="140" cy="13" r="6" fill={theme.color("#ff4d87", 'accent')} stroke={theme.color("#ffd9ea", 'accent')} strokeWidth="2" />
      <Circle cx="140" cy="13" r="11" fill="none" stroke={theme.color("#ff4d87", 'accent')} strokeWidth="2" opacity="0.23" />
    </Svg>
  </View>;
}

function MusicAtmosphere() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Svg pointerEvents="none" viewBox="0 0 430 1450" preserveAspectRatio="none" style={styles.atmosphere}>
    <Defs><SvgRadialGradient id="musicTopBloom" cx="50%" cy="4%" rx="68%" ry="31%"><Stop offset="0" stopColor={theme.color("#b72d92", 'accent')} stopOpacity="0.28" /><Stop offset="0.48" stopColor={theme.color("#7d247a", 'accent')} stopOpacity="0.1" /><Stop offset="1" stopColor={theme.color("#7d247a", 'accent')} stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="musicSideBloom" cx="100%" cy="48%" rx="75%" ry="34%"><Stop offset="0" stopColor={theme.color("#6250e8", 'accent')} stopOpacity="0.2" /><Stop offset="0.56" stopColor={theme.color("#6b36be", 'accent')} stopOpacity="0.06" /><Stop offset="1" stopColor={theme.color("#6b36be", 'accent')} stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="musicLowBloom" cx="0%" cy="86%" rx="80%" ry="30%"><Stop offset="0" stopColor={theme.color("#ff3f78", 'accent')} stopOpacity="0.13" /><Stop offset="1" stopColor={theme.color("#ff3f78", 'accent')} stopOpacity="0" /></SvgRadialGradient></Defs>
    <Rect width="430" height="1450" fill="url(#musicTopBloom)" /><Rect width="430" height="1450" fill="url(#musicSideBloom)" /><Rect width="430" height="1450" fill="url(#musicLowBloom)" />
  </Svg>;
}

function MoodBar({ items }: { items: MusicDashboardData['mood'] }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const palette = [colors.blue, '#7658dd', '#b34cd0', colors.pink];
  return <View style={styles.moodBlock}><View style={styles.moodBar}>{items.map((item, index) => <View key={item.label} style={{ flex: Math.max(item.percent, item.count ? 4 : 0.5), backgroundColor: theme.color(palette[index], 'surface') }} />)}</View><View style={styles.moodLegend}>{items.map((item, index) => <View key={item.label} style={styles.moodItem}><Text style={[styles.moodPercent, { color: theme.color(palette[index], 'text') }]}>{item.percent}%</Text><Text style={styles.moodLabel}>{item.label}</Text></View>)}</View><Text style={styles.moodFootnote}>Your real listening rhythm across the day</Text></View>;
}

function CityBars({ items }: { items: MusicDashboardData['cities'] }) {
  const styles = useThemedStyles(darkStyles);

  const maximum = Math.max(1, ...items.map(item => item.songs));
  return items.length ? <View style={styles.cityList}>{items.map(item => <View key={item.label} style={styles.cityRow}><Text style={styles.cityName} numberOfLines={1}>{item.label}</Text><View style={styles.cityTrack}><View style={[styles.cityFill, { width: `${Math.max(5, Math.round((item.songs / maximum) * 100))}%` }]} /></View><Text style={styles.cityCount}>{item.songs}</Text></View>)}<Text style={styles.cityAttribution}>City labels © OpenStreetMap contributors · coordinates reduced before leaving this iPhone</Text></View> : <Empty text="Pull to refresh to add privacy-safe city labels for journey music." />;
}

function IntensityChart({ daily }: { daily: MusicDashboardData['daily'] }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

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
            <Stop offset="0%" stopColor={theme.color("#ff6c50", 'accent')} stopOpacity="0.32" />
            <Stop offset="55%" stopColor={theme.color("#ff3f82", 'accent')} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={theme.color("#9b61ff", 'accent')} stopOpacity="0.0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="intensityLineGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={theme.color("#ff795b", 'accent')} />
            <Stop offset="50%" stopColor={theme.color("#ff4d87", 'accent')} />
            <Stop offset="100%" stopColor={theme.color("#b46cff", 'accent')} />
          </SvgLinearGradient>
        </Defs>
        {areaPath ? <Path d={areaPath} fill="url(#intensityAreaGrad)" /> : null}
        {points.map((point, index) => (
          <Path key={`guide-${index}`} d={`M ${point.x} ${point.y} L ${point.x} 100`} stroke={theme.color("#3b204e", 'accent')} strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
        ))}
        {linePath ? <Path d={linePath} fill="none" stroke="url(#intensityLineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((point, index) => (
          <Circle key={`dot-${index}`} cx={point.x} cy={point.y} r="4.5" fill={theme.color("#ff765a", 'accent')} stroke={theme.color("#fff0ea", 'accent')} strokeWidth="2" />
        ))}
      </Svg>
    ) : null}
  </View><View style={styles.chartLabels}>{daily.map(day => <Text key={day.date} style={styles.chartLabel}>{day.label.slice(0, 1)}</Text>)}</View></View>;
}

function WeekBars({ daily }: { daily: MusicDashboardData['daily'] }) {
  const styles = useThemedStyles(darkStyles);

  const maximum = Math.max(1, ...daily.map(day => day.count));
  return <View style={styles.weekBars}>{daily.map(day => <View key={day.date} style={styles.weekBarItem}><View style={styles.weekBarTrack}><View style={[styles.weekBarFill, { height: `${Math.max(day.count ? 10 : 2, Math.round((day.count / maximum) * 100))}%` }]} /></View><Text style={styles.weekBarLabel}>{day.label.slice(0, 1)}</Text></View>)}</View>;
}

function MusicHeaderScene() {
  const theme = useAppTheme();
  const musicHeaderStyles = useThemedStyles(darkMusicHeaderStyles);

  const bars = [26, 48, 76, 42, 92, 60, 105, 52, 82, 45, 68, 38, 74];
  return <>
    <LinearGradient pointerEvents="none" colors={theme.gradient(['#0c102c', '#1b0b29', '#100611'] as const)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 360 170" style={musicHeaderStyles.sceneCanvas}>
      <Defs>
        <SvgRadialGradient id="musicSceneGlow" cx="82%" cy="32%" rx="65%" ry="75%">
          <Stop offset="0" stopColor={theme.color("#ff3f82", 'accent')} stopOpacity="0.3" />
          <Stop offset="45%" stopColor={theme.color("#9b61ff", 'accent')} stopOpacity="0.1" />
          <Stop offset="1" stopColor={theme.color("#9b61ff", 'accent')} stopOpacity="0" />
        </SvgRadialGradient>
        <SvgLinearGradient id="soundwaveGrad1" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={theme.color("#ff795b", 'accent')} stopOpacity="0.8" />
          <Stop offset="50%" stopColor={theme.color("#ff3f82", 'accent')} stopOpacity="0.95" />
          <Stop offset="100%" stopColor={theme.color("#c57fff", 'accent')} stopOpacity="0.9" />
        </SvgLinearGradient>
        <SvgLinearGradient id="soundwaveGrad2" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={theme.color("#43e6ae", 'accent')} stopOpacity="0.4" />
          <Stop offset="50%" stopColor={theme.color("#7658dd", 'accent')} stopOpacity="0.75" />
          <Stop offset="100%" stopColor={theme.color("#ff3f82", 'accent')} stopOpacity="0.8" />
        </SvgLinearGradient>
      </Defs>
      <Rect width="360" height="170" fill="url(#musicSceneGlow)" />

      {/* Harmonic Wave Interference Lines */}
      <Path d="M 140 115 Q 185 45 235 95 T 310 70 T 360 110" fill="none" stroke="url(#soundwaveGrad2)" strokeWidth="1.5" opacity="0.4" strokeDasharray="3 3" />
      <Path d="M 155 90 Q 200 130 250 80 T 325 105 T 360 75" fill="none" stroke="url(#soundwaveGrad2)" strokeWidth="1.75" opacity="0.5" />

      {/* Primary Harmonic Neon Equalizer Beam */}
      <Path d="M 150 78 C 190 32, 220 120, 265 65 S 315 110, 355 60" fill="none" stroke={theme.color("#ff3f82", 'accent')} strokeWidth="8" opacity="0.18" strokeLinecap="round" />
      <Path d="M 150 78 C 190 32, 220 120, 265 65 S 315 110, 355 60" fill="none" stroke="url(#soundwaveGrad1)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Floating Audio Nodes / Constellation */}
      <Circle cx="210" cy="55" r="4" fill={theme.color("#ff795b", 'accent')} stroke={theme.color("#fff0ea", 'accent')} strokeWidth="1.5" />
      <Circle cx="265" cy="65" r="5.5" fill={theme.color("#ff3f82", 'accent')} stroke={theme.color("#fff", 'accent')} strokeWidth="2" />
      <Circle cx="265" cy="65" r="11" fill="none" stroke={theme.color("#ff3f82", 'accent')} strokeWidth="1" opacity="0.4" strokeDasharray="2 2" />
      <Circle cx="315" cy="88" r="4.5" fill={theme.color("#c57fff", 'accent')} stroke={theme.color("#f6efff", 'accent')} strokeWidth="1.5" />
      <Circle cx="348" cy="62" r="3.5" fill={theme.color("#43e6ae", 'accent')} stroke={theme.color("#eafff8", 'accent')} strokeWidth="1.5" />
    </Svg>
    <View pointerEvents="none" style={musicHeaderStyles.spectrum}>{bars.map((height, index) => <View key={`${height}-${index}`} style={[musicHeaderStyles.spectrumBar, { height }]} />)}</View>
    <View pointerEvents="none" style={musicHeaderStyles.rail}><View style={musicHeaderStyles.railCore} /></View>
  </>;
}

const darkMusicHeaderStyles = StyleSheet.create({
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

const darkStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  pageContent: { paddingHorizontal: 16, gap: 16 },
  atmosphere: { position: 'absolute', top: -45, left: -20, right: -20, height: 1460 },
  header: { minHeight: 142, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#482756', backgroundColor: '#110919', paddingHorizontal: 18, paddingVertical: 19, justifyContent: 'center', shadowColor: '#7f47c4', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  eyebrow: { color: '#c5a1ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.9, marginTop: 4 },
  pageTitle: { color: colors.text, fontSize: 37, lineHeight: 41, fontWeight: '900', marginTop: 7, letterSpacing: -0.8 },
  pageBody: { color: '#aca0b1', fontSize: 13, lineHeight: 20, marginTop: 3, maxWidth: 310 },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: colors.muted, fontSize: 12 },
  notice: { borderWidth: 1, borderColor: '#744152', backgroundColor: '#1a0b15', borderRadius: 18, padding: 15, gap: 7, shadowColor: '#ff4d82', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } }, noticeTitle: { color: '#ff9a83', fontWeight: '900', fontSize: 14 }, noticeBody: { color: '#ad9da8', fontSize: 12, lineHeight: 18 }, retry: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#3b1930', paddingHorizontal: 13, paddingVertical: 8, shadowColor: '#ff4d82', shadowOpacity: 0.35, shadowRadius: 10 }, retryText: { color: '#ff8bb6', fontWeight: '900', fontSize: 10 },
  sourceGuidance: { borderRadius: 17, borderWidth: 1, borderColor: '#493359', backgroundColor: '#120d19', paddingHorizontal: 15, paddingVertical: 13, gap: 5 }, sourceGuidanceKicker: { color: '#ff8f78', fontSize: 8, fontWeight: '900', letterSpacing: 1.15 }, sourceGuidanceText: { color: '#a79dad', fontSize: 11, lineHeight: 17 },
  latestSoundtrack: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 13, paddingTop: 2 }, latestArtwork: { width: 104, height: 104, borderRadius: 16 }, latestArtworkFallback: { width: 104, height: 104, borderRadius: 16, backgroundColor: '#24152f', alignItems: 'center', justifyContent: 'center' }, latestArtworkSymbol: { width: 38, height: 38 }, latestCopy: { flex: 1, minWidth: 0 }, latestKicker: { color: '#ff829d', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, latestTitle: { color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: '900', marginTop: 7 }, latestArtist: { color: '#b5a7bc', fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 5 }, latestAlbum: { color: '#82768a', fontSize: 9, lineHeight: 14, marginTop: 2 }, latestOpenIcon: { width: 18, height: 18 },
  metricRail: { gap: 10, paddingRight: 14 }, metric: { width: 148, minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 }, metricIconHalo: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, padding: 3, shadowOpacity: 0.68, shadowRadius: 13, shadowOffset: { width: 0, height: 0 } }, metricIcon: { flex: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, metricSymbol: { width: 22, height: 22 }, metricCopy: { flex: 1 }, metricLabel: { color: '#a79aae', fontSize: 9, lineHeight: 12, fontWeight: '700' }, metricValue: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 1, fontVariant: ['tabular-nums'] }, metricDetail: { color: '#958999', fontSize: 8, lineHeight: 11, marginTop: 1 },
  panel: { borderRadius: 20, borderWidth: 1, borderColor: '#633678', backgroundColor: colors.panel, padding: 14, overflow: 'hidden', shadowColor: '#a64dff', shadowOpacity: 0.15, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } }, cardHeader: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }, cardTitleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, cardAccent: { width: 3, height: 17, borderRadius: 2, backgroundColor: colors.coral, shadowColor: colors.coral, shadowOpacity: 0.55, shadowRadius: 7 }, cardTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' }, cardKicker: { color: '#ff829d', fontSize: 9, fontWeight: '800', letterSpacing: 0.65 },
  empty: { color: '#82778a', fontSize: 11, lineHeight: 17, paddingVertical: 12 },
  artistList: { gap: 3 }, artistRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#291932' }, artistRank: { width: 26, color: '#877a92', fontSize: 10 }, artistArtwork: { width: 42, height: 42, borderRadius: 21 }, artistFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#251634', borderWidth: 1, borderColor: '#4e2e68', alignItems: 'center', justifyContent: 'center' }, artistInitial: { color: '#c9aaff', fontSize: 16, fontWeight: '900' }, artistName: { flex: 1, color: '#f0e9f3', fontSize: 14, fontWeight: '800' }, artistPlays: { color: '#a296ab', fontSize: 10, fontWeight: '700' },
  rankingTabs: { flexDirection: 'row', gap: 4, borderRadius: 12, backgroundColor: '#09060f', padding: 3, marginBottom: 8 }, rankingTab: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, rankingTabSelected: { backgroundColor: '#2b1738', borderWidth: 1, borderColor: '#5f3972' }, rankingTabText: { color: '#897d91', fontSize: 11, fontWeight: '800' }, rankingTabTextSelected: { color: '#f5edf8' },
  insightPair: { flexDirection: 'row', gap: 10 }, flexCard: { flex: 1 }, insightCard: { minHeight: 0, borderRadius: 20, borderWidth: 1, borderColor: '#633678', backgroundColor: colors.panel, padding: 14, overflow: 'hidden', shadowColor: '#ff4d91', shadowOpacity: 0.25, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, insightSummary: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 3 }, weekSummary: { alignItems: 'flex-end', paddingTop: 3 }, weekSummaryValue: { color: '#ff829d', fontSize: 28, lineHeight: 33, fontWeight: '900', fontVariant: ['tabular-nums'] }, tourValue: { color: colors.text, fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 2, textShadowColor: '#ff4d9155', textShadowRadius: 8 }, tourUnit: { color: '#aa9db0', fontSize: 8 }, routeGraphic: { height: 70, marginTop: 1 }, change: { color: '#ff795c', fontSize: 8, lineHeight: 13, fontWeight: '800' }, changeDown: { color: '#ffb05c' },
  moodBlock: { flex: 1, justifyContent: 'space-between', paddingTop: 8 }, moodBar: { height: 17, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.track }, moodLegend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 12 }, moodItem: { width: '50%' }, moodPercent: { fontSize: 10, fontWeight: '900' }, moodLabel: { color: '#817589', fontSize: 7, marginTop: 3 }, moodFootnote: { color: '#ff765a', fontSize: 6.5, marginTop: 15 },
  cityList: { gap: 12, paddingTop: 2 }, cityRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, cityName: { width: 103, color: '#d8cfdd', fontSize: 9 }, cityTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#27172f', overflow: 'hidden' }, cityFill: { height: 6, borderRadius: 3, backgroundColor: colors.pink, shadowColor: colors.pink, shadowOpacity: 1, shadowRadius: 6 }, cityCount: { width: 25, color: '#b9a9c1', fontSize: 9, fontWeight: '800', textAlign: 'right' }, cityAttribution: { color: '#6f6476', fontSize: 7, lineHeight: 11, marginTop: 3 },
  chart: { height: 116, overflow: 'hidden' },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  chartLabel: { width: 16, textAlign: 'center', color: '#74697d', fontSize: 7 },
  chartFootnote: { color: '#ff876f', fontSize: 8, fontWeight: '700', marginTop: 8 },
  weekBars: { height: 105, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 3 }, weekBarItem: { flex: 1, height: 105, alignItems: 'center', justifyContent: 'flex-end' }, weekBarTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' }, weekBarFill: { width: '100%', minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.coral, shadowColor: colors.pink, shadowOpacity: 0.75, shadowRadius: 7 }, weekBarLabel: { color: '#81758a', fontSize: 7, marginTop: 7 }, weekTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 12 }, weekTotalValue: { color: colors.text, fontSize: 27, fontWeight: '900' }, weekTotalLabel: { flex: 1, color: '#8d8294', fontSize: 8 }, weekChange: { color: colors.coral, fontSize: 10, fontWeight: '900' },
  archiveSearch: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#472759', backgroundColor: '#09060f', color: colors.text, paddingHorizontal: 13, fontSize: 12, marginBottom: 9 },
  archiveRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2e1938', paddingVertical: 9, gap: 7 }, archiveTrackButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }, archiveArtwork: { width: 48, height: 48, borderRadius: 10 }, archiveArtworkFallback: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#26142f', alignItems: 'center', justifyContent: 'center' }, archiveNote: { color: colors.pink, fontSize: 21, fontWeight: '900' }, archiveCopy: { flex: 1, minWidth: 0 }, archiveTitle: { color: '#f3edf6', fontSize: 12, fontWeight: '900' }, archiveArtist: { color: '#9a8da1', fontSize: 9, marginTop: 3 }, archiveRoute: { color: '#776b80', fontSize: 8, marginTop: 4 }, archiveJourneyButton: { paddingHorizontal: 7, paddingVertical: 8, borderRadius: 9, backgroundColor: '#261632' }, archiveJourneyText: { color: '#c79be9', fontSize: 8, fontWeight: '900' }, topTrackRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2e1938' },
  sectionAction: { minHeight: 42, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#382044', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2 }, sectionActionText: { color: '#c79be9', fontSize: 11, fontWeight: '900' }, sectionActionIcon: { width: 12, height: 12 },
  linkFootnote: { color: '#766b7d', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 24, marginTop: 2 },
});
