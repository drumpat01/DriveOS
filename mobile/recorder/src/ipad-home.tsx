import { TouchPressable as Pressable } from './touch-feedback';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, useThemeChoice } from './app-theme';
import { ivoryPalette } from './theme-palette';
import { headerImageSource } from './header-image-sources';
import { IpadPageHeader } from './ipad-page-header';
import { IPAD_GRID_GAP, ipadGridColumns, ipadGridSpan } from './device-layout';
import { appDataClient, type JourneyMemory, type JourneyPhoto, type JourneySummary, type MusicDashboardData } from './app-data';
import { journeyDisplayTitle } from './journey-title';
import { useAdaptiveLayout, verticalFoldContentColumns } from './adaptive-layout';
import { HomeGridCell, HomeLayoutEditorSheet, useHomeWidgetLayout } from './home-widget-grid';
import { packHomeWidgetRows, type HomeWidgetId, type HomeWidgetPlacement } from './home-widget-layout';
import { FiftyStatesHomeWidget } from './fifty-states-ui';
import { AskJourneyDeckWidget } from './ask-journeydeck-widget';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';
import { ActiveJourneyDetailsSheet, JourneyInProgressWidget, YourCarWidget, type ActiveJourneyProgress } from './tessie-home-widgets';
import type { TessieVehicleSnapshot } from './tessie-contract';
import { V3_ASK_JOURNEYDECK_ENABLED } from './release-features';
import { router } from 'expo-router';
import { JourneyImage } from './journey-image';
import { journeyDeckSemanticColors } from './journeydeck-design-tokens';
import { openJourneyCardAction } from './journey-card-action';
import { lastPromptedShareJourneyId, markShareJourneyPrompted } from './share-prompt';

function ipadHomeColumns(width: number) {
  return { songs: width >= 1050 ? 4 : width >= 700 ? 3 : width >= 420 ? 2 : 1 };
}

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
  const elementTheme = useAppTheme();
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
  const theme = useAppTheme();
  const c = useColors();
  return <View style={[styles.widget, { backgroundColor: c.card, borderColor: c.line }]}>
    <View style={styles.widgetHeading}><SymbolView name={icon} tintColor={c.accent} style={styles.icon} /><Text accessibilityRole="header" style={[styles.widgetTitle, { color: theme.id === 'midnight-canopy' ? theme.palette.teal : c.text }]}>{title}</Text></View>
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

export function IpadHomeScreen({ userId, memories, journeys, music, recorder, loading, error, journeyProgress, vehicles = [], vehicleLoading = false, vehicleError = false, onMemory, onJourney, onFiftyStates }: {
  userId: string;
  memories: JourneyMemory[]; journeys: JourneySummary[]; music: MusicDashboardData | null;
  recorder: ReactNode; loading?: boolean; error?: string;
  journeyProgress?: ActiveJourneyProgress | null;
  vehicles?: TessieVehicleSnapshot[]; vehicleLoading?: boolean; vehicleError?: boolean;
  onMemory: (id: string) => void; onJourney: (id: string) => void; onFiftyStates?: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const adaptiveLayout = useAdaptiveLayout();
  const elementTheme = useAppTheme();
  const homeColors = journeyDeckSemanticColors(elementTheme.id, elementTheme.palette);
  const [width, setWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [activeJourneyVisible, setActiveJourneyVisible] = useState(false);
  const [promptedShareJourneyId, setPromptedShareJourneyId] = useState<string | null>(() => lastPromptedShareJourneyId());
  const latestJourney = journeys[0] ?? null;
  const showSharePrompt = Boolean(latestJourney && latestJourney.id !== promptedShareJourneyId);
  const dismissSharePrompt = () => {
    if (!latestJourney) return;
    markShareJourneyPrompted(latestJourney.id);
    setPromptedShareJourneyId(latestJourney.id);
  };
  const layoutClass = adaptiveLayout.isCompact || (width > 0 && width < 700) ? 'compact' : 'regular';
  const gridLayout = useHomeWidgetLayout(layoutClass, Boolean(onFiftyStates), V3_ASK_JOURNEYDECK_ENABLED, TESSIE_INTEGRATION_ENABLED);
  const placements = gridLayout.placements;
  const columns = ipadHomeColumns(width);
  const foldColumns = verticalFoldContentColumns(adaptiveLayout.fold, 24);
  const headerFoldColumns = verticalFoldContentColumns(adaptiveLayout.fold, 48);
  const metrics = [
    { id: 'miles' as const, title: 'Miles with music', value: music?.metrics.milesWithMusic, icon: 'road.lanes' as const, digits: 1 },
    { id: 'listening' as const, title: 'Listening hours', value: music?.metrics.listeningHours, icon: 'headphones' as const, digits: 1 },
    { id: 'songs' as const, title: 'Songs on the road', value: music?.metrics.songsOnRoad, icon: 'music.note' as const, digits: 0 },
    { id: 'streak' as const, title: 'Current streak', value: music?.metrics.currentStreak, icon: 'flame' as const, digits: 0 },
  ];
  // Native vertical controls and iPad's sidebar report their occupied edge as a
  // safe-area inset. Inset the viewport so onLayout measures usable canvas width.
  // ScrollView continues to own vertical insets for the top tab bar/status bar.
  const soundtrack = music?.recentSelections.slice(0, 4) ?? [];
  const songGrid = (tracks: typeof soundtrack) => <View style={styles.grid}>{tracks.map((track, index) => <View key={`${track.playedAt}-${index}`} style={{ width: foldColumns ? '100%' : `${100 / columns.songs}%`, padding: 6 }}>
    <View style={styles.song}>{track.artworkUrl ? <JourneyImage imageIdentity={`ipad-home-album-${track.playedAt}-${index}`} source={{ uri: track.artworkUrl }} style={styles.album} contentFit="cover" /> : <View style={[styles.album, styles.albumFallback, { backgroundColor: c.inset }]}><SymbolView name="music.note" tintColor={c.accent} style={styles.icon} /></View>}
      <View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.cardTitle, { color: c.text }]}>{track.track}</Text><Text numberOfLines={1} style={[styles.meta, { color: c.muted }]}>{track.artist}</Text></View>
    </View>
  </View>)}</View>;
  const renderPlacement = (placement: HomeWidgetPlacement) => {
    const common = { id: placement.id, editing, hidden: placement.hidden, span: placement.span, order: placement.order, width: `${(placement.span / 12) * 100}%` as `${number}%`, onMove: (offset: number) => gridLayout.move(placement.id, offset), onStartEditing: () => setEditing(true), onResize: (span?: number) => gridLayout.resize(placement.id, span), onToggle: () => gridLayout.toggle(placement.id) };
    const metric = metrics.find(item => item.id === placement.id);
    if (metric) return <EditableGridCell key={placement.id} {...common} title={metric.title}><View style={[styles.metric, { backgroundColor: c.card, borderColor: c.line }]}><View style={[styles.metricIcon, { backgroundColor: elementTheme.id === 'midnight-canopy' ? (metric.id === 'streak' ? elementTheme.palette.rose : elementTheme.palette.coral) : c.inset }]}><SymbolView name={metric.icon} tintColor={elementTheme.id === 'midnight-canopy' ? c.text : c.accent} style={styles.icon} /></View><View style={{ flex: 1 }}><Text style={[styles.metricLabel, { color: elementTheme.id === 'midnight-canopy' ? elementTheme.palette.teal : c.muted }]}>{metric.title}</Text><Text style={[styles.metricValue, { color: elementTheme.id === 'midnight-canopy' ? elementTheme.palette.amber : c.text }]}>{metric.value == null ? '—' : metric.value.toLocaleString(undefined, { maximumFractionDigits: metric.digits })}</Text></View></View></EditableGridCell>;
    if (placement.id === 'fiftyStates' && onFiftyStates) return <EditableGridCell key={placement.id} {...common} title="50 States"><FiftyStatesHomeWidget userId={userId} onPress={onFiftyStates} dense={placement.span < 12} disabled={editing} /></EditableGridCell>;
    if (placement.id === 'askJourneyDeck' && V3_ASK_JOURNEYDECK_ENABLED) return <EditableGridCell key={placement.id} {...common} title="Ask JourneyDeck"><AskJourneyDeckWidget onPress={() => router.push('/ask-journeydeck')} disabled={editing} /></EditableGridCell>;
    if (placement.id === 'yourCar' && TESSIE_INTEGRATION_ENABLED) return <EditableGridCell key={placement.id} {...common} title="Your car"><YourCarWidget vehicles={vehicles} loading={vehicleLoading} failed={vehicleError} /></EditableGridCell>;
    if (placement.id === 'journeyInProgress' && TESSIE_INTEGRATION_ENABLED) return <EditableGridCell key={placement.id} {...common} title="Journey in progress"><JourneyInProgressWidget progress={journeyProgress ?? null} onOpen={() => setActiveJourneyVisible(true)} /></EditableGridCell>;
    if (placement.id === 'memories') return <EditableGridCell key={placement.id} {...common} title="Recent memories"><Widget title="Recent memories" icon="photo.on.rectangle">{memories.length ? <View style={styles.memoryRow}>{memories.slice(0, 2).map(memory => <Pressable key={memory.id} accessibilityRole="button" accessibilityLabel={`Open memory ${memory.name}`} onPress={() => onMemory(memory.id)} style={({ pressed }) => [styles.memory, pressed && { opacity: 0.7 }]}><MemoryPhoto photo={memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? null} /><Text numberOfLines={2} style={[styles.cardTitle, { color: c.text }]}>{memory.name}</Text><Text style={[styles.meta, { color: c.muted }]}>{memory.journeyIds.length} journeys · {memory.photos.length} photos</Text></Pressable>)}</View> : <Empty>Your memories will appear here as your library grows.</Empty>}</Widget></EditableGridCell>;
    if (placement.id === 'journeys') return <EditableGridCell key={placement.id} {...common} title="Recent journeys"><Widget title="Recent journeys" icon="road.lanes">{journeys.length ? journeys.slice(0, 3).map(journey => <Pressable key={journey.id} accessibilityRole="button" accessibilityLabel={`Open journey ${journeyDisplayTitle(journey)}`} onPress={() => onJourney(journey.id)} style={({ pressed }) => [styles.journey, { borderColor: c.line }, pressed && { opacity: 0.7 }]}><View style={[styles.journeyIcon, { backgroundColor: c.inset }]}><SymbolView name="road.lanes" tintColor={c.accent} style={styles.icon} /></View><View style={{ flex: 1 }}><Text numberOfLines={2} style={[styles.cardTitle, { color: c.text }]}>{journeyDisplayTitle(journey)}</Text><Text style={[styles.meta, { color: c.muted }]}>{journey.miles.toFixed(1)} mi · {Math.round(journey.durationMinutes)} min</Text></View></Pressable>) : <Empty>Finish your first journey to see it here.</Empty>}</Widget></EditableGridCell>;
    return <EditableGridCell key={placement.id} {...common} title="Today's soundtrack"><Widget title="Today's soundtrack" icon="music.note">{soundtrack.length ? songGrid(soundtrack) : <Empty>Your latest journey soundtrack will appear here.</Empty>}</Widget></EditableGridCell>;
  };
  const foldRows = foldColumns ? packHomeWidgetRows(editing ? placements.map(item => ({ ...item, hidden: false })) : placements, 2) : [];
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}><ScrollView testID="ipad-home" style={{ flex: 1, backgroundColor: c.page }} contentInsetAdjustmentBehavior="automatic"
    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: insets.bottom + 28 }}>
    <View testID="ipad-home-canvas" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.canvas}>
      <IpadPageHeader title="Home" width={width} artwork={require('../assets/cinematic-home-main-photo-v1.jpg')} subtitle="Your roads. Your memories. Your music." split={headerFoldColumns} />
      <View testID="home-fixed-recorder" style={{ marginTop: 24 }}>{recorder}</View>
      {showSharePrompt && latestJourney && <View style={[styles.sharePrompt, { backgroundColor: c.card, borderColor: c.line }]}>
        <SymbolView name="square.and.arrow.up" tintColor={c.accent} style={styles.icon} />
        <Text style={[styles.cardTitle, styles.sharePromptText, { color: c.text }]}>Your drive is ready to share.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Share this drive" onPress={() => { markShareJourneyPrompted(latestJourney.id); setPromptedShareJourneyId(latestJourney.id); openJourneyCardAction(latestJourney.id, 'share'); }} style={[styles.sharePromptAction, { backgroundColor: c.accent }]}>
          <Text style={[styles.sharePromptActionText, { color: homeColors.onAccent }]}>Share</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss share prompt" hitSlop={8} onPress={dismissSharePrompt} style={styles.sharePromptDismiss}>
          <SymbolView name="xmark" tintColor={c.muted} style={styles.sharePromptDismissIcon} />
        </Pressable>
      </View>}
      {error ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{error}</Text> : null}
      {loading && !music ? <ActivityIndicator accessibilityLabel="Loading your library" color={c.accent} /> : null}
      {foldColumns ? <View testID="ipad-home-fold-grid" style={{ flexDirection: 'row', gap: foldColumns.gap }}><View testID="ipad-home-fold-before" style={[styles.widgetGrid, { width: foldColumns.beforeWidth }]}>{foldRows.filter(row => row.pane === 0).flatMap(row => row.placements).map(renderPlacement)}</View><View testID="ipad-home-fold-after" style={[styles.widgetGrid, { width: foldColumns.afterWidth }]}>{foldRows.filter(row => row.pane === 1).flatMap(row => row.placements).map(renderPlacement)}</View></View> : <View testID="ipad-home-widgets" style={styles.widgetGrid}>{placements.map(renderPlacement)}</View>}
    </View>
  </ScrollView>
  <HomeLayoutEditorSheet visible={editing} onClose={() => setEditing(false)} onReset={gridLayout.reset}>
    <View testID="ipad-home-layout-editor" style={styles.widgetGrid}>{placements.map(renderPlacement)}</View>
  </HomeLayoutEditorSheet>
  <ActiveJourneyDetailsSheet visible={activeJourneyVisible} progress={journeyProgress ?? null} onClose={() => setActiveJourneyVisible(false)} />
  </SafeAreaView>;
}


function EditableGridCell({ id, title, editing, hidden, movable = true, span, order, width, onMove, onResize, onToggle, onStartEditing, children }: { id: HomeWidgetId; title: string; editing: boolean; hidden?: boolean; movable?: boolean; span: number; order: number; width: number | `${number}%`; onMove: (offset: number) => void; onResize: (span?: number) => void; onStartEditing: () => void; onToggle: () => void; children: ReactNode }) {
  return <HomeGridCell placement={{ id, span, order, hidden }} title={title} editing={editing} movable={movable} width={width} onMove={onMove} onResize={onResize} onToggle={onToggle} onStartEditing={onStartEditing}>{children}</HomeGridCell>;
}

export function IpadRecorderControls({ status, busy, startLabel = 'Start Journey', onStart, onEnable, onEnd, onResume, onIdentify, notice }: {
  status: 'loading' | 'permission' | 'ready' | 'recording' | 'paused' | 'finishing' | 'automatic'; busy: boolean;
  startLabel?: string;
  onStart: () => void; onEnable: () => void; onEnd: () => void; onResume: () => void; onIdentify?: () => void; notice?: string;
}) {
  const c = useColors();
  const theme = useAppTheme();
  const homeColors = journeyDeckSemanticColors(theme.id, theme.palette);
  const action = status === 'permission' ? { label: 'Enable Location', onPress: onEnable } : status === 'recording' || status === 'paused' ? { label: 'End Journey', onPress: onEnd } : { label: status === 'loading' ? 'Preparing…' : status === 'finishing' ? 'Finishing…' : status === 'automatic' ? 'Journeys detected automatically' : startLabel, onPress: onStart };
  const disabled = busy || ['loading', 'finishing', 'automatic'].includes(status);
  if (startLabel === 'Record Journey' && (status === 'ready' || status === 'loading')) return <View style={styles.recorder}>
    <Pressable accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={action.onPress} style={({ pressed }) => [styles.start, { width: '100%', minHeight: 64, justifyContent: 'center', backgroundColor: homeColors.accent, borderColor: homeColors.accent, opacity: disabled || pressed ? 0.6 : 1 }]}>
      <Text style={[styles.startText, { color: homeColors.onAccent }]}>{action.label}</Text><SymbolView name="arrow.right" tintColor={homeColors.onAccent} style={styles.icon} />
    </Pressable>
    {notice ? <Text style={[styles.meta, { color: c.muted }]}>{notice}</Text> : null}
  </View>;
  return <View style={styles.recorder}>
    <View style={styles.recorderRow}><Text style={[styles.status, { color: c.accent }]}>{status === 'ready' ? '● READY' : status === 'recording' ? '● RECORDING' : status === 'paused' ? 'PAUSED' : status === 'automatic' ? '● WATCHING' : ''}</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={action.onPress} style={({ pressed }) => [styles.start, { backgroundColor: c.inset, borderColor: c.accent, opacity: disabled || pressed ? 0.6 : 1 }]}><Text style={[styles.startText, { color: c.accent }]}>{action.label}</Text><SymbolView name="arrow.right" tintColor={c.accent} style={styles.icon} /></Pressable>
    </View>
    {status === 'paused' && <Pressable accessibilityRole="button" onPress={onResume} disabled={busy} style={styles.secondaryAction}><Text style={{ color: c.accent }}>Resume Journey</Text></Pressable>}
    {status === 'recording' && onIdentify && <Pressable accessibilityRole="button" onPress={onIdentify} disabled={busy} style={styles.secondaryAction}><Text style={{ color: c.accent }}>Identify Song</Text></Pressable>}
    {notice ? <Text style={[styles.meta, { color: c.muted, maxWidth: 320 }]}>{notice}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 1400, alignSelf: 'center', gap: 16 },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  titleBlock: { minWidth: 250, flex: 1 }, heading: { fontSize: 34, fontWeight: '800', letterSpacing: 2 }, subtitle: { fontSize: 15, marginTop: 7 },
  hero: { width: '100%', borderRadius: 24, borderWidth: 1 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: IPAD_GRID_GAP },
  // Cells own their gutters inside percentage widths; an extra gap makes 6 + 6 wrap.
  widgetGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { borderRadius: 22, borderWidth: 1, padding: 16, minHeight: 102, flexDirection: 'row', alignItems: 'center', gap: IPAD_GRID_GAP, flex: 1 },
  metricIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, icon: { width: 22, height: 22 },
  metricLabel: { fontSize: 12, lineHeight: 17 }, metricValue: { fontSize: 27, fontWeight: '700', marginTop: 4 },
  widget: { borderRadius: 24, borderWidth: 1, padding: 20, gap: IPAD_GRID_GAP, flexGrow: 1 }, widgetHeading: { flexDirection: 'row', alignItems: 'center', gap: IPAD_GRID_GAP }, widgetTitle: { fontSize: 19, fontWeight: '600', flexShrink: 1 },
  memoryRow: { flexDirection: 'row', gap: IPAD_GRID_GAP }, memory: { flex: 1, gap: 7 }, memoryPhoto: { width: '100%', aspectRatio: 1.55, borderRadius: 16 },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 }, meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  journey: { flexDirection: 'row', gap: IPAD_GRID_GAP, alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth }, journeyIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  sharePrompt: { marginTop: 16, borderRadius: 20, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sharePromptText: { flex: 1, marginTop: 0, fontWeight: '600' },
  sharePromptAction: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  sharePromptActionText: { fontWeight: '800', fontSize: 14 },
  sharePromptDismiss: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sharePromptDismissIcon: { width: 14, height: 14 },
  empty: { fontSize: 15, lineHeight: 23, minHeight: 70, paddingVertical: 18 }, song: { flexDirection: 'row', gap: IPAD_GRID_GAP, alignItems: 'center' }, album: { width: 64, height: 76, borderRadius: 12 }, albumFallback: { alignItems: 'center', justifyContent: 'center' },
  recorder: { gap: IPAD_GRID_GAP, flexShrink: 1 }, recorderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: IPAD_GRID_GAP, alignItems: 'center' }, status: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  start: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: IPAD_GRID_GAP, alignItems: 'center' }, startText: { fontSize: 16, fontWeight: '600' }, secondaryAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 12 },
  settingsRow: { maxWidth: 640, borderRadius: 22, padding: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 18 },
});
