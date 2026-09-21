import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from './app-theme';
import { getCurrentUser } from './auth';
import { DetailScreenFrame, useDetailViewportInsets } from './detail-screen-frame';
import { useJourneyDeckNavigation } from './native-navigation-context';
import { JourneyEditorMap } from './journey-editor-map';
import { loadJourneyEditor, commitJourneyEdit, getJourneyEditConflictChoices, resolveJourneyEditConflict } from './journey-editor-store';
import { previewJourneyEdit, type JourneyEditSelection, type JourneyEditorSnapshot } from './journey-editor-model';
import { clipEditorRoute, moveEditorHandle, sampleEditorRoute, type EditorHandle, type EditorRange } from './journey-editor-timeline';

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const minutes = (ms: number) => `${Math.floor(ms / 60000)}m ${Math.floor(ms / 1000) % 60}s`;

function StudioButton({ title, onPress, disabled = false, primary = false }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const c = useAppTheme().palette;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: primary ? c.accent : c.card, borderColor: primary ? c.accent : c.line, opacity: disabled ? .4 : pressed ? .7 : 1 }]}>
    <Text style={{ color: primary ? c.onAccent : c.text, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
  </Pressable>;
}

function triggerHandleHaptic() { void Haptics.selectionAsync().catch(() => {}); }

/**
 * The knob and the accent fill (owned by Editor via `dragValue`) move on the
 * UI thread for every frame of the drag. React state — and with it the map
 * preview and time labels — only updates once, on release, matching the
 * existing drag-to-reorder pattern in home-widget-grid.tsx.
 */
function RangeHandle({ handle, value, dragValue, bounds, range, width, disabled, reducedMotion, onChange }: {
  handle: EditorHandle; value: number; dragValue: SharedValue<number>; bounds: EditorRange; range: EditorRange; width: number;
  disabled: boolean; reducedMotion: boolean; onChange: (value: number) => void;
}) {
  const c = useAppTheme().palette;
  const scale = useSharedValue(1);
  const startAt = useSharedValue(value);
  const gesture = useMemo(() => Gesture.Pan()
    .enabled(!disabled)
    .minDistance(1)
    .maxPointers(1)
    .onBegin(() => {
      startAt.set(dragValue.get());
      if (!reducedMotion) scale.set(withSpring(1.18, { duration: 200, dampingRatio: 1 }));
      scheduleOnRN(triggerHandleHaptic);
    })
    .onUpdate(event => {
      dragValue.set(moveEditorHandle(handle, startAt.get(), event.translationX, width, bounds, range));
    })
    .onEnd(() => {
      scheduleOnRN(onChange, dragValue.get());
      scheduleOnRN(triggerHandleHaptic);
    })
    .onFinalize(() => {
      scale.set(withSpring(1, { duration: 200, dampingRatio: 1 }));
    }), [handle, width, bounds, range, disabled, reducedMotion, onChange, dragValue, scale, startAt]);
  const animatedStyle = useAnimatedStyle(() => {
    const progress = (dragValue.get() - bounds.startMs) / Math.max(1, bounds.endMs - bounds.startMs);
    return { left: progress * width - 22, transform: [{ scale: scale.get() }] };
  });
  return <GestureDetector gesture={gesture}>
    <Reanimated.View accessible accessibilityRole="adjustable"
      accessibilityLabel={handle === 'split' ? 'Split time' : `${handle === 'start' ? 'Start' : 'End'} trim time`}
      accessibilityValue={{ text: time(value), min: bounds.startMs, max: bounds.endMs, now: value }}
      accessibilityActions={[{ name: 'increment', label: 'Later by ten seconds' }, { name: 'decrement', label: 'Earlier by ten seconds' }]}
      onAccessibilityAction={event => { if (!disabled) onChange(moveEditorHandle(handle, value, event.nativeEvent.actionName === 'increment' ? 10_000 : -10_000, bounds.endMs - bounds.startMs, bounds, range)); }}
      style={[styles.handle, animatedStyle, { backgroundColor: c.accent, borderColor: c.page }]}>
      <View style={{ width: 3, height: 23, backgroundColor: c.onAccent, borderRadius: 2 }} />
    </Reanimated.View>
  </GestureDetector>;
}

function Editor({ snapshot, onSaved, onBack, premium }: { snapshot: JourneyEditorSnapshot; onSaved: (id: string) => Promise<void>; onBack: () => void; premium: boolean }) {
  const c = useAppTheme().palette, { width, height, fontScale } = useWindowDimensions(), insets = useDetailViewportInsets();
  const bounds = useMemo(() => snapshot.segments.find(s => s.id === snapshot.journeyId)!, [snapshot]);
  const [range, setRange] = useState<EditorRange>({ startMs: bounds.startMs, endMs: bounds.endMs });
  const [mode, setMode] = useState<'trim' | 'split'>('trim'), [splitMs, setSplitMs] = useState(Math.round((bounds.startMs + bounds.endMs) / 2));
  const [trackWidth, setTrackWidth] = useState(1), [reducedMotion, setReducedMotion] = useState(true);
  const [review, setReview] = useState<JourneyEditSelection | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const conflicts = useMemo(() => getJourneyEditConflictChoices(snapshot.userId, snapshot.journeyId), [snapshot]);
  const wide = width / fontScale >= 900;
  // Visual drag position, kept off React state so a trim/split drag never re-renders
  // the map preview mid-gesture. Synced back whenever the committed value changes
  // from elsewhere (release, +/-10s buttons, reset, mode switch).
  const startDragMs = useSharedValue(range.startMs);
  const endDragMs = useSharedValue(range.endMs);
  const splitDragMs = useSharedValue(splitMs);
  useEffect(() => { startDragMs.set(range.startMs); }, [range.startMs, startDragMs]);
  useEffect(() => { endDragMs.set(range.endMs); }, [range.endMs, endDragMs]);
  useEffect(() => { splitDragMs.set(splitMs); }, [splitMs, splitDragMs]);
  useEffect(() => { let active = true; void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion); return () => { active = false; sub.remove(); }; }, []);
  const trackFillStyle = useAnimatedStyle(() => {
    if (mode === 'split') return { left: 0, width: trackWidth };
    const total = Math.max(1, bounds.endMs - bounds.startMs);
    return {
      left: (startDragMs.get() - bounds.startMs) / total * trackWidth,
      width: (endDragMs.get() - startDragMs.get()) / total * trackWidth,
    };
  });
  const points = useMemo(() => clipEditorRoute(sampleEditorRoute(snapshot.original.points.map(p => ({ latitude: p.latitude, longitude: p.longitude, time: Date.parse(p.recordedAt) }))), bounds), [snapshot, bounds]);
  const selection: JourneyEditSelection = mode === 'trim' ? { kind: 'trim', ...range } : { kind: 'split', atMs: splitMs };
  const changed = mode === 'split' || range.startMs !== bounds.startMs || range.endMs !== bounds.endMs;
  const preview = useMemo(() => { if (!review) return null; try { return previewJourneyEdit(snapshot, review); } catch { return null; } }, [snapshot, review]);
  const close = () => {
    if (saving.current) return;
    if (changed) Alert.alert('Leave the editor?', 'Your preview has not been saved. The original recording is safe.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard preview', style: 'destructive', onPress: onBack }]);
    else onBack();
  };
  const beginReview = (next: JourneyEditSelection) => {
    try { previewJourneyEdit(snapshot, next); setReview(next); setError(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'That selection could not be previewed.'); }
  };
  const save = async () => {
    if (!review || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    let committed = false;
    try { const result = await commitJourneyEdit(snapshot, review); committed = true;
      await onSaved(result.rootJourneyId);
    } catch (failure) { setError(committed ? 'Your edit was saved. Reopen the journey to see the updated route.' : failure instanceof Error ? failure.message : 'The edit could not be saved. Your original is safe.');
    } finally { saving.current = false; setBusy(false); }
  };
  const resolveConflict = async (conflictId: string, choice: 'keep_current' | 'use_incoming') => {
    if (saving.current) return; saving.current = true; setBusy(true); setError(null);
    try { const result = await resolveJourneyEditConflict(snapshot, conflictId, choice); await onSaved(result.rootJourneyId); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Both edits remain saved. Reopen this journey to review the conflict.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const controls = <View style={[styles.inspector, wide && { width: 330 }, { backgroundColor: c.card, borderColor: c.line }]}>
    <Text style={[styles.eyebrow, { color: c.accent }]}>JOURNEY STUDIO · PLUS</Text>
    <Text style={[styles.title, { color: c.text }]}>{review?.kind === 'restore' ? 'Bring it all back.' : mode === 'trim' ? 'Make every mile count.' : 'Start a new chapter.'}</Text>
    <Text style={[styles.body, { color: c.muted }]}>Drag the handles to keep your favorite stretch. Your original recording stays safe.</Text>
    {conflicts.map(conflict => <View key={conflict.id} style={[styles.review, { borderColor: c.amber }]}>
      <Text style={{ color: c.text, fontWeight: '800' }}>Another device edited this journey.</Text>
      <Text style={{ color: c.muted }}>{new Date(conflict.createdAt).toLocaleString()} · {conflict.parts} parts · {Math.round(conflict.durationMinutes)} minutes. Both versions are saved.</Text>
      <StudioButton title="Review which version to use" disabled={busy} onPress={() => Alert.alert('Choose the saved version',
        `This device: ${snapshot.segments.length} parts, ${Math.round(snapshot.segments.reduce((n, s) => n + (s.endMs - s.startMs) / 60000, 0))} minutes.\nOther device: ${conflict.parts} parts, ${Math.round(conflict.durationMinutes)} minutes.\nYour unsaved preview will be discarded. Both saved operations are preserved.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Keep this device', onPress: () => { void resolveConflict(conflict.id, 'keep_current'); } }, { text: 'Use other device', onPress: () => { void resolveConflict(conflict.id, 'use_incoming'); } }])} />
    </View>)}
    <View style={styles.row}><StudioButton title="Trim" disabled={busy || !premium} onPress={() => { setMode('trim'); setReview(null); }} primary={mode === 'trim'} />
      <StudioButton title="Split" disabled={busy || !premium || bounds.endMs - bounds.startMs < 20_000} onPress={() => { setMode('split'); setReview(null); }} primary={mode === 'split'} /></View>
    {(mode === 'trim' ? ['start', 'end'] as const : ['split'] as const).map(handle => {
      const value = handle === 'start' ? range.startMs : handle === 'end' ? range.endMs : splitMs;
      const update = (next: number) => { setReview(null); if (handle === 'split') setSplitMs(next); else setRange(current => ({ ...current, [handle === 'start' ? 'startMs' : 'endMs']: next })); };
      return <View key={handle} style={[styles.timeRow, { borderColor: c.line }]}><View style={{ flex: 1 }}><Text style={{ color: c.muted, fontSize: 12 }}>{handle === 'split' ? 'Split at' : handle === 'start' ? 'Starts at' : 'Ends at'}</Text><Text style={{ color: c.text, fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '700' }}>{time(value)}</Text></View>
        <StudioButton title="−10s" disabled={busy || !premium} onPress={() => update(moveEditorHandle(handle, value, -10_000, bounds.endMs - bounds.startMs, bounds, range))} />
        <StudioButton title="+10s" disabled={busy || !premium} onPress={() => update(moveEditorHandle(handle, value, 10_000, bounds.endMs - bounds.startMs, bounds, range))} />
      </View>;
    })}
    <Text style={[styles.body, { color: c.accent }]}>{mode === 'trim' ? `${minutes(range.endMs - range.startMs)} kept · ${minutes(range.startMs - bounds.startMs + bounds.endMs - range.endMs)} trimmed` : `${minutes(splitMs - bounds.startMs)} + ${minutes(bounds.endMs - splitMs)} · two journeys`}</Text>
    {error && <Text accessibilityRole="alert" style={{ color: c.coral }}>{error}</Text>}
    {review && preview ? <View style={[styles.review, { borderColor: c.accent, backgroundColor: c.inset }]}>
      <Text accessibilityRole="header" style={[styles.body, { color: c.text, fontWeight: '800' }]}>Review changes</Text>
      {preview.segments.map((segment, i) => <Text key={segment.id} style={{ color: c.text }}>Part {i + 1}: {segment.miles.toFixed(1)} mi · {Math.round(segment.durationMinutes)} min · {segment.songCount} songs</Text>)}
      <Text style={{ color: c.muted }}>Memories and statistics will use these saved parts. {preview.removedSongCount ? `${preview.removedSongCount} outside song plays stay in your listening history. ` : ''}{review.kind === 'restore' ? 'All parts return to one original journey.' : 'You can restore the original later.'}</Text>
      <StudioButton title={busy ? 'Saving…' : review.kind === 'restore' ? 'Restore original' : 'Save changes'} disabled={busy || (!premium && review.kind !== 'restore')} primary onPress={() => { void save(); }} />
      <StudioButton title="Back to preview" disabled={busy} onPress={() => setReview(null)} />
    </View> : <StudioButton title="Review changes" primary disabled={!changed || busy || !premium} onPress={() => beginReview(selection)} />}
    <StudioButton title="Reset preview" disabled={busy} onPress={() => { setRange({ startMs: bounds.startMs, endMs: bounds.endMs }); setSplitMs(Math.round((bounds.startMs + bounds.endMs) / 2)); setReview(null); setError(null); }} />
    {snapshot.canRestore && <StudioButton title="Restore original recording" disabled={busy} onPress={() => beginReview({ kind: 'restore' })} />}
  </View>;
  const stage = <View style={[styles.stage, wide && { flex: 1 }]}>
    <View style={{ height: wide ? Math.max(310, height - insets.top - insets.bottom - 225) : Math.max(270, Math.min(420, height * .38)) }}>
      <JourneyEditorMap points={points} range={mode === 'trim' ? range : bounds} splitMs={mode === 'split' ? splitMs : null} reducedMotion={reducedMotion} />
    </View>
    <View style={[styles.timeline, { borderColor: c.line, backgroundColor: c.card }]}>
      <View style={styles.row}><Text style={{ color: c.muted, flex: 1 }}>{time(bounds.startMs)}</Text><Text style={{ color: c.muted }}>{time(bounds.endMs)}</Text></View>
      <View style={styles.trackArea} onLayout={event => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}>
        <View style={[styles.track, { backgroundColor: c.line }]} />
        <Reanimated.View pointerEvents="none" style={[styles.track, { backgroundColor: c.accent }, trackFillStyle]} />
        {(mode === 'trim' ? ['start', 'end'] as const : ['split'] as const).map(handle => <RangeHandle key={handle} handle={handle}
          value={handle === 'start' ? range.startMs : handle === 'end' ? range.endMs : splitMs}
          dragValue={handle === 'start' ? startDragMs : handle === 'end' ? endDragMs : splitDragMs}
          bounds={bounds} range={range} width={trackWidth} disabled={busy || !premium} reducedMotion={reducedMotion}
          onChange={value => { setReview(null); if (handle === 'split') setSplitMs(value); else setRange(current => ({ ...current, [handle === 'start' ? 'startMs' : 'endMs']: value })); }} />)}
      </View><Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{mode === 'trim' ? 'Pull either edge inward. Release to keep your selection.' : 'Drag the line to choose where the next chapter begins.'}</Text>
    </View>
  </View>;
  return <DetailScreenFrame title="Journey Studio" onBack={close}><ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 28 }}>
    <View style={[styles.layout, { flexDirection: wide ? 'row' : 'column' }]}>{stage}{controls}</View>
  </ScrollView></DetailScreenFrame>;
}

export function NativeJourneyEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(), nav = useJourneyDeckNavigation(), c = useAppTheme().palette;
  const [snapshot, setSnapshot] = useState<JourneyEditorSnapshot | null>(null), [error, setError] = useState<string | null>(null);
  const mounted = useRef(true), currentId = useRef(id); currentId.current = id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { let active = true; setSnapshot(null); setError(null);
    // Let the native transition settle before reading the exact route.
    const timer = setTimeout(() => { try { const value = loadJourneyEditor(getCurrentUser().id, id); if (active) setSnapshot(value); }
      catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'This journey cannot be edited right now.'); } }, 120);
    return () => { active = false; clearTimeout(timer); };
  }, [id]);
  const back = () => router.back();
  if (snapshot && (nav.membership.tier === 'paid' || snapshot.canRestore)) return <Editor key={`${snapshot.userId}-${id}-${snapshot.revision ?? 'original'}`} snapshot={snapshot} premium={nav.membership.tier === 'paid'} onBack={back}
    onSaved={async rootId => {
      if (!mounted.current || currentId.current !== id || getCurrentUser().id !== snapshot.userId) return;
      await nav.refreshArchive();
      if (mounted.current && currentId.current === id && getCurrentUser().id === snapshot.userId) router.replace({ pathname: '/journey/[id]', params: { id: rootId } });
    }} />;
  return <DetailScreenFrame title="Journey Studio" onBack={back}><View style={{ padding: 28, gap: 20 }}>
    {nav.membership.tier !== 'paid' ? <><Text style={[styles.title, { color: c.text }]}>Give your journeys the perfect cut.</Text><Text style={{ color: c.muted }}>Trim and split with JourneyDeck Plus. Your original recordings stay safe.</Text><StudioButton title="Explore Plus" primary onPress={nav.showUpgrade} /></>
      : error ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{error}</Text> : <ActivityIndicator color={c.accent} accessibilityLabel="Loading original journey" />}
  </View></DetailScreenFrame>;
}

const styles = StyleSheet.create({ layout: { gap: 20 }, stage: { minWidth: 0, gap: 15 }, inspector: { padding: 20, gap: 17, borderWidth: 1, borderRadius: 26 }, title: { fontSize: 28, fontWeight: '800', letterSpacing: -.7 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2 }, body: { fontSize: 14, lineHeight: 21 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }, button: { minHeight: 44, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 16, borderWidth: 1, justifyContent: 'center' }, timeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth }, timeline: { padding: 20, borderWidth: 1, borderRadius: 24, gap: 12 }, trackArea: { height: 68, marginHorizontal: 12 }, track: { position: 'absolute', top: 28, left: 0, right: 0, height: 12, borderRadius: 6 }, handle: { position: 'absolute', top: 6, width: 44, height: 56, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' }, review: { padding: 16, borderWidth: 1, borderRadius: 18, gap: 14 } });
