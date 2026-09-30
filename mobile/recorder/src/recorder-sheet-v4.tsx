import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { readingColumnStyle, useReadingWidth } from './device-layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { captureJourneyMarker } from './journey-marker-capture';
import { syncNativeRecorderInbox } from './native-recorder-inbox';
import { haptics } from './haptics';
import { getLiveRecorderSnapshot } from './storage';
import type { RecorderSheetState } from './recorder-sheet-model';
import { V3_MARKERS_PROTOTYPE_ENABLED } from './release-features';
import { redesignStyles, RouteSketch, SERIF, StatGrid, Surface, useRedesignColors } from './redesign-ui';
import { TouchPressable } from './touch-feedback';

type Coordinate = [number, number];
type LiveDrive = { route: Coordinate[]; lastSong: { track: string; artist: string } | null; songs: number };
const HERO = 280;

/** Route and matched songs of the active journey, re-read while the sheet is open. */
function useLiveDrive(sessionId: string | null): LiveDrive {
  const [drive, setDrive] = useState<LiveDrive>({ route: [], lastSong: null, songs: 0 });
  useEffect(() => {
    if (!sessionId) { setDrive({ route: [], lastSong: null, songs: 0 }); return; }
    const read = () => {
      try {
        const snapshot = getLiveRecorderSnapshot();
        if (snapshot.session?.id !== sessionId) return;
        const last = snapshot.music.at(-1);
        setDrive({
          route: snapshot.route.map(point => [point.longitude, point.latitude] as Coordinate),
          lastSong: last ? { track: last.track, artist: last.artist } : null,
          songs: snapshot.music.length,
        });
      } catch { /* The next read retries; the recorder's own state is unaffected. */ }
    };
    read();
    const timer = setInterval(read, 5_000);
    return () => clearInterval(timer);
  }, [sessionId]);
  return drive;
}

function ToolTile({ symbol, title, detail, tint, fill, disabled, onPress, label }: { symbol: SFSymbol; title: string; detail: string; tint: string; fill: string; disabled?: boolean; onPress: () => void; label: string }) {
  const colors = useRedesignColors();
  return <TouchPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }, disabled && styles.disabled, pressed && redesignStyles.pressed]}>
    <View style={[styles.tileIcon, { backgroundColor: fill }]}><SymbolView name={symbol} tintColor={tint} size={18} weight="semibold" /></View>
    <Text style={[styles.tileTitle, { color: colors.text }]}>{title}</Text>
    <Text accessibilityLiveRegion="polite" numberOfLines={2} style={[styles.tileDetail, { color: colors.textSecondary }]}>{detail}</Text>
  </TouchPressable>;
}

/**
 * The V4 recorder sheet: the drive in progress over its own route, one stat
 * card, in-drive tools and thumb-height controls. Presentational; the
 * recorder keeps every start, pause, resume and finish decision.
 */
export function RecorderSheetV4({ state, sessionId, startedAt, elapsed, miles, points, busy, showIdentify, notice, children, onClose, onStart, onEnable, onPause, onResume, onEnd, onIdentify }: {
  state: RecorderSheetState; sessionId: string | null; startedAt: string | null; elapsed: string; miles: number; points: number; busy: boolean;
  showIdentify: boolean; notice?: ReactNode; children?: ReactNode;
  onClose: () => void; onStart: () => void; onEnable: () => void; onPause: () => void; onResume: () => void; onEnd: () => void; onIdentify: () => void;
}) {
  const colors = useRedesignColors();
  const insets = useSafeAreaInsets();
  const width = useReadingWidth();
  const drive = useLiveDrive(state.live ? sessionId : null);
  const [markerDetail, setMarkerDetail] = useState('Or ask Siri');
  const [markerSaving, setMarkerSaving] = useState(false);
  const markerBusy = useRef(false);
  useEffect(() => { setMarkerDetail('Or ask Siri'); }, [sessionId]);
  const recording = state.phase === 'recording' || state.phase === 'checking';
  const started = startedAt ? new Date(startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

  const addMarker = () => {
    if (!sessionId || markerBusy.current) return;
    markerBusy.current = true; setMarkerSaving(true);
    void (async () => {
      try {
        await captureJourneyMarker(sessionId);
        void haptics.selection();
        setMarkerDetail('Marker saved');
        // Capture is already durable even if foreground import must retry later.
        await syncNativeRecorderInbox().catch(() => undefined);
      } catch (error) { setMarkerDetail(error instanceof Error ? error.message : 'Could not save the marker.'); }
      finally { markerBusy.current = false; setMarkerSaving(false); }
    })();
  };
  const primaryLabel = state.primary === 'end' ? 'End journey' : state.primary === 'enable' ? 'Enable location' : 'Start journey';
  const primarySymbol: SFSymbol = state.primary === 'end' ? 'stop.fill' : state.primary === 'enable' ? 'location.fill' : 'record.circle';
  const runPrimary = () => { if (state.primary === 'end') onEnd(); else if (state.primary === 'enable') onEnable(); else onStart(); };

  return <View testID="recorder-sheet-v4" style={[styles.page, { backgroundColor: colors.page }]}>
    <ScrollView contentContainerStyle={[readingColumnStyle, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={[styles.hero, { backgroundColor: colors.surface }]}>
        {drive.route.length > 1
          ? <View accessible accessibilityLabel="Route so far" style={styles.heroRoute}><RouteSketch routes={[drive.route]} width={width} height={HERO} inks={[colors.accent]} strokeWidth={5} padding={48} /></View>
          : <View style={styles.heroEmpty}><SymbolView name={recording ? 'location.fill' : 'road.lanes'} tintColor={colors.textTertiary} size={30} /></View>}
        <LinearGradient pointerEvents="none" colors={colors.photoScrim} locations={[0, 0.45, 0.8, 1]} style={styles.heroScrim} />
      </View>
      {children ? <View style={styles.content}>{children}</View> : <View style={styles.content}>
        <View style={styles.titleBlock}>
          <View style={styles.kickerRow}>
            {recording ? <View style={[styles.liveDot, { backgroundColor: colors.accent, borderColor: colors.accentSoft }]} /> : null}
            <Text style={[styles.kicker, { color: state.phase === 'paused' ? colors.highlight : colors.accent }]}>{state.kicker.toUpperCase()}</Text>
            {busy ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{state.title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{state.live && started ? `Started ${started}. ${state.body}` : state.body}</Text>
        </View>
        {state.live ? <Surface style={styles.stats}>
          <StatGrid items={[{ value: elapsed, label: 'elapsed' }, { value: miles.toFixed(1), label: 'miles' }, { value: points.toLocaleString(), label: 'GPS points saved' }]} />
        </Surface> : null}
        {recording && (V3_MARKERS_PROTOTYPE_ENABLED || showIdentify) ? <View style={styles.tools}>
          <Text style={[styles.kicker, { color: colors.textSecondary }]}>WHILE YOU DRIVE</Text>
          <View style={styles.toolRow}>
            {V3_MARKERS_PROTOTYPE_ENABLED ? <ToolTile symbol="mappin.and.ellipse" label="Add a marker" title={markerSaving ? 'Saving…' : 'Add marker'} detail={markerDetail}
              tint={colors.accent} fill={colors.accentSoft} disabled={markerSaving || !sessionId} onPress={addMarker} /> : null}
            {showIdentify ? <ToolTile symbol="music.note" label="Identify song" title="Identify song" detail="One tap per song"
              tint={colors.highlight} fill={colors.highlightSoft} disabled={busy} onPress={onIdentify} /> : null}
          </View>
        </View> : null}
        {state.live && drive.lastSong ? <Surface radius={20} style={styles.song}>
          <View style={[styles.songIcon, { backgroundColor: colors.highlightSoft }]}><SymbolView name="music.note" tintColor={colors.highlight} size={16} /></View>
          <View style={redesignStyles.flex}>
            <Text numberOfLines={1} style={[styles.songMeta, { color: colors.textSecondary }]}>Last song · {drive.lastSong.artist}</Text>
            <Text numberOfLines={1} style={[styles.songTitle, { color: colors.text }]}>{drive.lastSong.track}</Text>
          </View>
          <Text style={[styles.songCount, { color: colors.accent }]}>{drive.songs} {drive.songs === 1 ? 'song' : 'songs'}</Text>
        </Surface> : null}
        {notice}
      </View>}
    </ScrollView>

    <View pointerEvents="box-none" style={[styles.top, { top: 10 }]}>
      <View style={[styles.grabber, { backgroundColor: colors.track }]} />
      <TouchPressable accessibilityRole="button" accessibilityLabel="Close recorder" onPress={onClose} hitSlop={6}
        style={({ pressed }) => [styles.close, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }, pressed && redesignStyles.pressed]}>
        <SymbolView name="chevron.down" tintColor={colors.text} size={16} weight="semibold" />
      </TouchPressable>
    </View>

    {!children && (state.primary || state.secondary) ? <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8, backgroundColor: colors.page }]}>
      {state.secondary ? <TouchPressable accessibilityRole="button" accessibilityLabel={state.secondary === 'pause' ? 'Pause journey' : 'Resume journey'} disabled={busy}
        onPress={() => { void haptics.selection(); (state.secondary === 'pause' ? onPause : onResume)(); }}
        style={({ pressed }) => [styles.round, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, busy && styles.disabled, pressed && redesignStyles.pressed]}>
        <SymbolView name={state.secondary === 'pause' ? 'pause.fill' : 'play.fill'} tintColor={colors.text} size={20} />
      </TouchPressable> : null}
      {state.primary ? <TouchPressable accessibilityRole="button" accessibilityLabel={primaryLabel} disabled={busy || state.phase === 'starting'} onPress={runPrimary}
        style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent }, (busy || state.phase === 'starting') && styles.disabled, pressed && redesignStyles.pressed]}>
        <SymbolView name={primarySymbol} tintColor={colors.onAccent} size={17} weight="bold" />
        <Text style={[styles.primaryText, { color: colors.onAccent }]}>{primaryLabel}</Text>
      </TouchPressable> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  hero: { height: HERO, overflow: 'hidden' },
  heroRoute: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroEmpty: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  content: { paddingHorizontal: 20, marginTop: -36, gap: 22 },
  titleBlock: { gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 0 },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1 },
  title: { fontFamily: SERIF, fontSize: 32, lineHeight: 36, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21 },
  stats: { padding: 16 },
  tools: { gap: 10 },
  toolRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, gap: 8, padding: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, minHeight: 124 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileTitle: { fontSize: 15, fontWeight: '700' },
  tileDetail: { fontSize: 12, lineHeight: 16 },
  song: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  songIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  songMeta: { fontSize: 12 },
  songTitle: { fontSize: 15, fontWeight: '700' },
  songCount: { fontSize: 13, fontWeight: '700' },
  top: { position: 'absolute', left: 16, right: 16, alignItems: 'flex-start' },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: 8 },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  round: { width: 58, height: 58, borderRadius: 29, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1, height: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { fontSize: 17, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
