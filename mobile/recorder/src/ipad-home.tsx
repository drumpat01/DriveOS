import { TouchPressable as Pressable } from './touch-feedback';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, useThemeChoice } from './app-theme';
import { ivoryPalette } from './theme-palette';
import { headerImageSource } from './header-image-sources';
import { IpadPageHeader } from './ipad-page-header';
import { IPAD_GRID_GAP, ipadGridColumns, ipadGridSpan } from './device-layout';
import { appDataClient, type JourneyMemory, type JourneyPhoto, type JourneySummary, type MusicDashboardData } from './app-data';
import { journeyDisplayTitle } from './journey-title';
import { JourneyImage } from './journey-image';

function useColors() {
  const theme = useAppTheme();
  return theme.resolvePalette(theme.isLight ? { page: ivoryPalette.page, card: ivoryPalette.surface, text: ivoryPalette.text, muted: ivoryPalette.secondary, accent: ivoryPalette.violet, line: ivoryPalette.border, inset: ivoryPalette.lilac }
    : { page: '#08070d', card: '#120d1a', text: '#fff6ed', muted: '#b6a6c1', accent: '#b795e5', line: '#49304f', inset: '#291735' });
}

export function IpadBlankScreen() {
  const colors = useColors();
  return <View testID="ipad-blank-screen" style={{ flex: 1, backgroundColor: colors.page }} />;
}

export function IpadSettingsScreen() {
  const colors = useColors();
  const { theme, setMode } = useThemeChoice();
  const insets = useSafeAreaInsets();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.page }}><ScrollView style={{ flex: 1, backgroundColor: colors.page }} contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={{ padding: 28, paddingBottom: insets.bottom + 28 }}>
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text, marginBottom: 24 }]}>Settings</Text>
    <View style={[styles.settingsRow, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <SymbolView name={theme.isLight ? 'sun.max' : 'moon'} tintColor={colors.accent} style={styles.icon} />
      <Text style={[styles.widgetTitle, { color: colors.text, flex: 1 }]}>Light Mode</Text>
      <Switch accessibilityLabel="Light Mode" value={theme.isLight} trackColor={{ false: '#49304f', true: '#934367' }}
        onValueChange={enabled => { try { setMode(enabled ? 'light' : 'dark'); } catch { Alert.alert('Appearance could not be saved', 'Please try again.'); } }} />
    </View>
  </ScrollView></SafeAreaView>;
}

function Widget({ title, icon, children }: { title: string; icon: SFSymbol; children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.widget, { backgroundColor: c.card, borderColor: c.line }]}>
    <View style={styles.widgetHeading}><SymbolView name={icon} tintColor={c.accent} style={styles.icon} /><Text accessibilityRole="header" style={[styles.widgetTitle, { color: c.text }]}>{title}</Text></View>
    {children}
  </View>;
}

function Empty({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.empty, { color: c.muted }]}>{children}</Text>;
}

function MemoryPhoto({ photo }: { photo: JourneyPhoto | null }) {
  const theme = useAppTheme();
  const [loaded, setLoaded] = useState<{ id: string; uri: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (photo) void appDataClient.photoDataUrl(photo).then(uri => { if (alive && uri) setLoaded({ id: photo.id, uri }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [photo?.id]);
  const source = photo && loaded?.id === photo.id ? { uri: loaded.uri } : headerImageSource(require('../assets/cinematic-memory-polaroids-photo-v1.jpg'), theme.id);
  const sourceKey = photo && loaded?.id === photo.id ? `memory-photo-${photo.id}` : `default-memory-${theme.id}`;
  return <JourneyImage key={sourceKey} imageIdentity={sourceKey} source={source} contentFit="cover" style={styles.memoryPhoto} />;
}

export function IpadHomeScreen({ memories, journeys, music, recorder, loading, error, onMemory, onJourney }: {
  memories: JourneyMemory[]; journeys: JourneySummary[]; music: MusicDashboardData | null;
  recorder: ReactNode; loading?: boolean; error?: string;
  onMemory: (id: string) => void; onJourney: (id: string) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const gridColumns = ipadGridColumns(width, fontScale);
  const cell = (span: number) => width ? ipadGridSpan(width, span, gridColumns) : '100%';
  const metricSpans = gridColumns === 6 ? [2, 2, 1, 1] : gridColumns === 3 ? [2, 1, 2, 1] : [1, 1, 1, 1];
  const featureSpan = gridColumns === 6 ? 3 : gridColumns;
  const songSpan = gridColumns === 6 ? 2 : 1;
  const soundtrackCount = gridColumns === 1 ? 2 : 3;
  const metrics = [
    { title: 'Miles with music', value: music?.metrics.milesWithMusic, icon: 'road.lanes' as const, digits: 1 },
    { title: 'Listening hours', value: music?.metrics.listeningHours, icon: 'headphones' as const, digits: 1 },
    { title: 'Songs on the road', value: music?.metrics.songsOnRoad, icon: 'music.note' as const, digits: 0 },
    { title: 'Current streak', value: music?.metrics.currentStreak, icon: 'flame' as const, digits: 0 },
  ];
  // The native sidebar overlays the screen and reports its occupied width as a
  // safe-area inset. Inset the viewport so onLayout measures usable canvas width.
  // ScrollView continues to own vertical insets for the top tab bar/status bar.
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}><ScrollView testID="ipad-home" style={{ flex: 1, backgroundColor: c.page }} contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: insets.bottom + 28 }}>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.canvas}>
      <IpadPageHeader title="Home" width={width} artwork={require('../assets/cinematic-home-main-photo-v1.jpg')} subtitle="Your roads. Your memories. Your music." fullHeightActions>
        {recorder}
      </IpadPageHeader>
      {error ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{error}</Text> : null}
      {loading && !music ? <ActivityIndicator accessibilityLabel="Loading your library" color={c.accent} /> : null}
      <View testID="ipad-home-metrics" style={styles.grid}>{metrics.map((metric, index) => <View testID={`ipad-home-metric-${index}`} key={metric.title} style={{ width: cell(metricSpans[index]) }}>
        <View style={[styles.metric, { backgroundColor: c.card, borderColor: c.line }]}>
          <View style={[styles.metricIcon, { backgroundColor: c.inset }]}><SymbolView name={metric.icon} tintColor={c.accent} style={styles.icon} /></View>
          <View style={{ flex: 1 }}><Text style={[styles.metricLabel, { color: c.muted }]}>{metric.title}</Text><Text style={[styles.metricValue, { color: c.text }]}>{metric.value == null ? '—' : metric.value.toLocaleString(undefined, { maximumFractionDigits: metric.digits })}</Text></View>
        </View>
      </View>)}</View>
      <View style={styles.grid}>
        <View testID="ipad-home-memories" style={{ width: cell(featureSpan) }}><Widget title="Recent memories" icon="photo.on.rectangle">
          {memories.length ? <View style={styles.memoryRow}>{memories.slice(0, 2).map(memory => <Pressable key={memory.id} accessibilityRole="button" accessibilityLabel={`Open memory ${memory.name}`} onPress={() => onMemory(memory.id)} style={({ pressed }) => [styles.memory, pressed && { opacity: 0.7 }]}>
            <MemoryPhoto photo={memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? null} />
            <Text numberOfLines={2} style={[styles.cardTitle, { color: c.text }]}>{memory.name}</Text>
            <Text style={[styles.meta, { color: c.muted }]}>{memory.journeyIds.length} journeys · {memory.photos.length} photos</Text>
          </Pressable>)}</View> : <Empty>Your memories will appear here as your library grows.</Empty>}
        </Widget></View>
        <View testID="ipad-home-journeys" style={{ width: cell(featureSpan) }}><Widget title="Recent journeys" icon="road.lanes">
          {journeys.length ? journeys.slice(0, 3).map(journey => <Pressable key={journey.id} accessibilityRole="button" accessibilityLabel={`Open journey ${journeyDisplayTitle(journey)}`} onPress={() => onJourney(journey.id)} style={({ pressed }) => [styles.journey, { borderColor: c.line }, pressed && { opacity: 0.7 }]}>
            <View style={[styles.journeyIcon, { backgroundColor: c.inset }]}><SymbolView name="road.lanes" tintColor={c.accent} style={styles.icon} /></View>
            <View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.cardTitle, { color: c.text }]}>{journeyDisplayTitle(journey)}</Text><Text style={[styles.meta, { color: c.muted }]}>{journey.miles.toFixed(1)} mi · {Math.round(journey.durationMinutes)} min</Text></View>
          </Pressable>) : <Empty>Finish your first journey to see it here.</Empty>}
        </Widget></View>
      </View>
      <Widget title="Today's soundtrack" icon="music.note">
        {music?.recentSelections.length ? <View style={styles.grid}>{music.recentSelections.slice(0, soundtrackCount).map((track, index) => <View key={`${track.playedAt}-${index}`} style={{ width: cell(songSpan) }}>
          <View style={styles.song}>{track.artworkUrl ? <JourneyImage imageIdentity={`ipad-home-album-${track.playedAt}-${index}`} source={{ uri: track.artworkUrl }} style={styles.album} contentFit="cover" /> : <View style={[styles.album, styles.albumFallback, { backgroundColor: c.inset }]}><SymbolView name="music.note" tintColor={c.accent} style={styles.icon} /></View>}
            <View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.cardTitle, { color: c.text }]}>{track.track}</Text><Text numberOfLines={1} style={[styles.meta, { color: c.muted }]}>{track.artist}</Text></View>
          </View>
        </View>)}</View> : <Empty>Your latest journey soundtrack will appear here.</Empty>}
      </Widget>
    </View>
  </ScrollView></SafeAreaView>;
}

export function IpadRecorderControls({ status, busy, onStart, onEnable, onEnd, onResume, onIdentify, notice }: {
  status: 'loading' | 'permission' | 'ready' | 'recording' | 'paused' | 'finishing' | 'automatic'; busy: boolean;
  onStart: () => void; onEnable: () => void; onEnd: () => void; onResume: () => void; onIdentify?: () => void; notice?: string;
}) {
  const c = useColors();
  const action = status === 'permission' ? { label: 'Enable Location', onPress: onEnable } : status === 'recording' || status === 'paused' ? { label: 'End Journey', onPress: onEnd } : { label: status === 'loading' ? 'Preparing…' : status === 'finishing' ? 'Finishing…' : status === 'automatic' ? 'Automatic recording' : 'Start Journey', onPress: onStart };
  const disabled = busy || ['loading', 'finishing', 'automatic'].includes(status);
  return <View style={styles.recorder}>
    <View style={styles.recorderRow}><Text style={[styles.status, { color: c.accent }]}>{status === 'ready' ? '● READY' : status === 'recording' ? '● RECORDING' : status === 'paused' ? 'PAUSED' : ''}</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={action.onPress} style={({ pressed }) => [styles.start, { backgroundColor: c.inset, borderColor: c.accent, opacity: disabled || pressed ? 0.6 : 1 }]}><Text style={[styles.startText, { color: c.accent }]}>{action.label}</Text><SymbolView name="arrow.right" tintColor={c.accent} style={styles.icon} /></Pressable>
    </View>
    {status === 'paused' && <Pressable accessibilityRole="button" onPress={onResume} disabled={busy} style={styles.secondaryAction}><Text style={{ color: c.accent }}>Resume Journey</Text></Pressable>}
    {status === 'recording' && onIdentify && <Pressable accessibilityRole="button" onPress={onIdentify} disabled={busy} style={styles.secondaryAction}><Text style={{ color: c.accent }}>Identify Song</Text></Pressable>}
    {notice ? <Text style={[styles.meta, { color: c.muted, maxWidth: 320 }]}>{notice}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 1400, alignSelf: 'center', gap: IPAD_GRID_GAP },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  titleBlock: { minWidth: 250, flex: 1 }, heading: { fontSize: 34, fontWeight: '800', letterSpacing: 2 }, subtitle: { fontSize: 15, marginTop: 7 },
  hero: { width: '100%', borderRadius: 24, borderWidth: 1 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: IPAD_GRID_GAP },
  metric: { borderRadius: 22, borderWidth: 1, padding: 16, minHeight: 102, flexDirection: 'row', alignItems: 'center', gap: IPAD_GRID_GAP, flex: 1 },
  metricIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, icon: { width: 22, height: 22 },
  metricLabel: { fontSize: 12, lineHeight: 17 }, metricValue: { fontSize: 27, fontWeight: '700', marginTop: 4 },
  widget: { borderRadius: 24, borderWidth: 1, padding: 20, gap: IPAD_GRID_GAP, flexGrow: 1 }, widgetHeading: { flexDirection: 'row', alignItems: 'center', gap: IPAD_GRID_GAP }, widgetTitle: { fontSize: 19, fontWeight: '600', flexShrink: 1 },
  memoryRow: { flexDirection: 'row', gap: IPAD_GRID_GAP }, memory: { flex: 1, gap: 7 }, memoryPhoto: { width: '100%', aspectRatio: 1.55, borderRadius: 16 },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 }, meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  journey: { flexDirection: 'row', gap: IPAD_GRID_GAP, alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth }, journeyIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: 15, lineHeight: 23, minHeight: 70, paddingVertical: 18 }, song: { flexDirection: 'row', gap: IPAD_GRID_GAP, alignItems: 'center' }, album: { width: 64, height: 76, borderRadius: 12 }, albumFallback: { alignItems: 'center', justifyContent: 'center' },
  recorder: { gap: IPAD_GRID_GAP, flexShrink: 1 }, recorderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: IPAD_GRID_GAP, alignItems: 'center' }, status: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  start: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: IPAD_GRID_GAP, alignItems: 'center' }, startText: { fontSize: 16, fontWeight: '600' }, secondaryAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 12 },
  settingsRow: { maxWidth: 640, borderRadius: 22, padding: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 18 },
});
