import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated as NativeAnimated, AppState, Keyboard, KeyboardAvoidingView, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition, measure, runOnJS, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useFrameCallback, useSharedValue, withSpring, withTiming, type AnimatedRef, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { ThemeMaterial } from './theme-material';
import { IpadPageHeader } from './ipad-page-header';
import { PhoneTabTitle } from './phone-tab-title';
import { HeaderArtwork } from './header-artwork';
import { CardDetailLink } from './card-detail-link';
import { NativeActionMenu } from './native-action-menu';
import { openJourneyCardAction } from './journey-card-action';
import { filterJourneyLibrary, journeyRouteLabel } from './library-model';
import { clampStudioTrayHeight, containsStudioPoint, memoryStudioDrop, phoneStudioLayout, settleStudioTrayExpanded, studioEdgeVelocity, type StudioRect } from './memory-studio-model';
import type { JourneyMemory, JourneySummary } from './app-data';

type DragState = {
  compact: boolean;
  source: SharedValue<string>; target: SharedValue<string>; active: SharedValue<boolean>;
  x: SharedValue<number>; y: SharedValue<number>; originX: SharedValue<number>; originY: SharedValue<number>;
  rootX: SharedValue<number>; rootY: SharedValue<number>; scale: SharedValue<number>; opacity: SharedValue<number>;
  destination: SharedValue<StudioRect | null>; root: AnimatedRef<View>; enabled: boolean; dragging: boolean; reduceMotion: boolean;
  begin: (id: string) => void; finish: (source: string, target: string) => void;
};
const DragContext = createContext<DragState>(null!);
const ViewportContext = createContext<AnimatedRef<ScrollView> | null>(null);
const spring = { damping: 23, stiffness: 240, mass: 0.8 };

function DropZone({ id, children, style }: { id: string; children: ReactNode; style?: any }) {
  const d = useContext(DragContext), viewport = useContext(ViewportContext);
  const ref = useAnimatedRef<View>();
  const theme = useAppTheme();
  const accent = theme.palette.accent;
  const frame = useFrameCallback(() => {
    if (!d.active.value) return;
    const rect = measure(ref);
    const withinViewport = !viewport || containsStudioPoint(measure(viewport), d.x.value, d.y.value);
    const hit = id !== `journey:${d.source.value}` && withinViewport && containsStudioPoint(rect, d.x.value, d.y.value);
    if (hit) { d.target.value = id; d.destination.value = rect; }
    else if (d.target.value === id) { d.target.value = ''; d.destination.value = null; }
  }, false);
  useEffect(() => { frame.setActive(d.dragging && d.enabled); return () => frame.setActive(false); }, [d.dragging, d.enabled]);
  useEffect(() => () => { if (d.target.value === id) { d.target.value = ''; d.destination.value = null; } }, [id]);
  const highlight = useAnimatedStyle(() => ({
    opacity: withTiming(d.active.value && d.target.value === id ? 1 : 0, { duration: d.reduceMotion ? 0 : 120 }),
  }));
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(d.active.value && d.target.value === id && !d.reduceMotion ? 1.015 : 1, spring) }] }));
  return <Animated.View testID={`studio-drop-${id}`} ref={ref} collapsable={false} style={[style, lift]}>
    {children}
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dropOutline, { borderColor: accent }, highlight]}>
      <View style={[styles.dropLabel, { backgroundColor: accent }]}><Text style={[styles.dropLabelText, { color: theme.palette.onAccent }]}>{id.startsWith('memory:') ? 'Release to add' : 'Release to create Memory'}</Text></View>
    </Animated.View>
  </Animated.View>;
}

/** Scroll and hit testing share screen coordinates, including native sidebar changes. */
function StudioScroll({ children, label }: { children: ReactNode; label: string }) {
  const d = useContext(DragContext);
  const ref = useAnimatedRef<ScrollView>();
  const offset = useSharedValue(0), contentHeight = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(event => { offset.value = event.contentOffset.y; });
  const frameLoop = useFrameCallback(frame => {
    if (!d.active.value) return;
    const rect = measure(ref);
    const velocity = studioEdgeVelocity(rect, d.x.value, d.y.value);
    if (!rect || !velocity) return;
    const next = Math.max(0, Math.min(contentHeight.value - rect.height, offset.value + velocity * Math.min(frame.timeSincePreviousFrame ?? 16, 32) / 1000));
    scrollTo(ref, 0, next, false);
  }, false);
  useEffect(() => { frameLoop.setActive(d.dragging && d.enabled); return () => frameLoop.setActive(false); }, [d.dragging, d.enabled]);
  return <ViewportContext.Provider value={ref}><Animated.ScrollView ref={ref} accessibilityLabel={label}
    onScroll={onScroll} scrollEventThrottle={16} onContentSizeChange={(_w, h) => { contentHeight.value = h; }}
    contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
    {children}
  </Animated.ScrollView></ViewportContext.Provider>;
}

function JourneyFace({ journey, floating = false, compact = false }: { journey: JourneySummary; floating?: boolean; compact?: boolean }) {
  const theme = useAppTheme();
  return <View style={[styles.journeyFace, compact && styles.phoneJourneyFace, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }, floating && styles.floatingFace]}>
    <ThemeMaterial radius={18} />
    <View style={styles.row}><SymbolView name="road.lanes" tintColor={theme.palette.accent} style={styles.icon} />
      <Text style={[styles.eyebrow, { color: theme.palette.accent }]}>{new Date(journey.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
      <View style={{ flex: 1 }} /><SymbolView name="line.3.horizontal" tintColor={theme.palette.muted} style={styles.smallIcon} /></View>
    <Text numberOfLines={2} style={[styles.journeyTitle, compact && { fontSize: 15, lineHeight: 20 }, { color: theme.palette.text }]}>{journeyRouteLabel(journey)}</Text>
    <Text style={[styles.meta, { color: theme.palette.muted }]}>{journey.miles.toFixed(1)} mi  ·  {Math.round(journey.durationMinutes)} min  ·  {journey.songCount} songs</Text>
  </View>;
}

function DraggableJourney({ journey, selected, onSelect, onOpen }: { journey: JourneySummary; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  const d = useContext(DragContext), ref = useAnimatedRef<View>();
  const theme = useAppTheme();
  const pan = Gesture.Pan().enabled(d.enabled).activateAfterLongPress(260).maxPointers(1)
    .onStart(event => {
      const rect = measure(ref), root = measure(d.root);
      if (!rect || !root || d.source.value) return;
      d.rootX.value = root.pageX; d.rootY.value = root.pageY;
      d.originX.value = rect.pageX + rect.width / 2; d.originY.value = rect.pageY + 62;
      d.x.value = event.absoluteX; d.y.value = event.absoluteY;
      d.target.value = ''; d.destination.value = null; d.source.value = journey.id; d.active.value = true;
      d.opacity.value = 1; d.scale.value = d.reduceMotion ? 1 : withSpring(1.04, spring);
      runOnJS(d.begin)(journey.id);
    })
    .onUpdate(event => { if (d.active.value && d.source.value === journey.id) { d.x.value = event.absoluteX; d.y.value = event.absoluteY; } })
    .onEnd(event => {
      if (!d.active.value || d.source.value !== journey.id) return;
      d.active.value = false;
      const dest = containsStudioPoint(d.destination.value, event.absoluteX, event.absoluteY) ? d.destination.value : null;
      const target = dest ? d.target.value : '', source = journey.id;
      d.x.value = withSpring(dest ? dest.pageX + dest.width / 2 : d.originX.value, spring);
      d.y.value = withSpring(dest ? dest.pageY + dest.height / 2 : d.originY.value, spring);
      d.scale.value = withTiming(dest && !d.reduceMotion ? 0.8 : 1, { duration: 180 });
      d.opacity.value = withTiming(0, { duration: d.reduceMotion ? 0 : 240 }, finished => { if (finished) runOnJS(d.finish)(source, target); });
    })
    .onFinalize((_event, success) => {
      if (success || d.source.value !== journey.id || !d.active.value) return;
      d.active.value = false; d.target.value = '';
      d.x.value = withSpring(d.originX.value, spring); d.y.value = withSpring(d.originY.value, spring);
      d.opacity.value = withTiming(0, { duration: d.reduceMotion ? 0 : 180 }, () => runOnJS(d.finish)(journey.id, ''));
    });
  const fade = useAnimatedStyle(() => ({ opacity: d.source.value === journey.id ? 0.35 : 1 }));
  return <DropZone id={`journey:${journey.id}`} style={styles.journeyWrap}>
    <GestureDetector gesture={pan}><Animated.View testID={`studio-source-${journey.id}`} ref={ref} collapsable={false} style={fade}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Select ${journeyRouteLabel(journey)}`}
        accessibilityHint="Select journeys to organize, or hold and drag this card onto a Memory or another journey."
        onPress={onSelect} style={selected ? { borderRadius: 18, borderWidth: 2, borderColor: theme.palette.accent } : undefined}>
        <JourneyFace journey={journey} compact={d.compact} />
      </Pressable>
    </Animated.View></GestureDetector>
    <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={`Open journey ${journeyRouteLabel(journey)}`} onPress={onOpen} style={[styles.openJourney, { flex: 1 }]}>
      <Text style={{ color: theme.palette.accent, fontWeight: '600' }}>{selected ? '✓ Selected' : 'View journey'}  ›</Text>
    </Pressable>
      {d.compact && <NativeActionMenu compact label={`Actions for ${journeyRouteLabel(journey)}`} actions={[
        { id: 'edit', title: 'Edit locations', image: 'pencil', attributes: { disabled: !d.enabled }, onSelect: () => { if (d.enabled && !d.source.value) openJourneyCardAction(journey.id, 'edit'); } },
        { id: 'share', title: 'Create share card', image: 'square.and.arrow.up', attributes: { disabled: !d.enabled }, onSelect: () => { if (d.enabled && !d.source.value) openJourneyCardAction(journey.id, 'share'); } },
      ]} />}
    </View>
  </DropZone>;
}

export function IpadMemoriesScreen({ memories, journeys, renderArtwork, onCreate, onAdd, onEdit, onShare, onMemory, onJourney, onRefresh, loading, error, historyLimited, onUpgrade, busy = false, presentation = 'ipad' }: {
  memories: JourneyMemory[]; journeys: JourneySummary[]; renderArtwork: (memory: JourneyMemory) => ReactNode;
  onCreate: (ids: string[]) => void; onAdd: (memoryId: string, ids: string[]) => Promise<void>;
  onEdit: (memory: JourneyMemory) => void; onShare: (memory: JourneyMemory) => void;
  onMemory: (id: string) => void; onJourney: (id: string) => void; onRefresh: () => void;
  loading: boolean; error?: string; historyLimited: boolean; onUpgrade: () => void; busy?: boolean; presentation?: 'ipad' | 'iphone';
}) {
  const theme = useAppTheme(), focused = useIsFocused(), window = useWindowDimensions();
  const phone = presentation === 'iphone';
  const [phoneHeight, setPhoneHeight] = useState(window.height - 150), [trayExpanded, setTrayExpanded] = useState(true);
  const c = theme.resolvePalette(theme.isLight ? { page: '#fffaf0', card: '#fffcf6', text: '#291d26', muted: '#685461', accent: '#754487', line: '#d8c5ba', inset: '#eee2ef' }
    : { page: '#08070d', card: '#120d1a', text: '#fff6ed', muted: '#b6a6c1', accent: '#c5a0f4', line: '#49304f', inset: '#291735' });
  const [width, setWidth] = useState(0), [query, setQuery] = useState(''), [memoryQuery, setMemoryQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]), [dragged, setDragged] = useState<JourneySummary | null>(null);
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('Hold a journey and drag it onto a Memory, or another journey.');
  const [reduceMotion, setReduceMotion] = useState(true);
  const [journeyLimit, setJourneyLimit] = useState(30), [memoryLimit, setMemoryLimit] = useState(20);
  const locked = useRef(false), mounted = useRef(true);
  const phoneLayout = phoneStudioLayout(width, phoneHeight, window.fontScale ?? 1);
  const trayHeight = useRef(new NativeAnimated.Value(phoneLayout.expandedTray)).current;
  const trayLiveHeight = useRef(phoneLayout.expandedTray), trayStartHeight = useRef(phoneLayout.expandedTray);
  const trayDragging = useRef(false), settleTray = useRef<() => void>(() => {});
  const source = useSharedValue(''), target = useSharedValue(''), active = useSharedValue(false);
  const x = useSharedValue(0), y = useSharedValue(0), originX = useSharedValue(0), originY = useSharedValue(0);
  const rootX = useSharedValue(0), rootY = useSharedValue(0), scale = useSharedValue(1), opacity = useSharedValue(0);
  const destination = useSharedValue<StudioRect | null>(null), root = useAnimatedRef<View>();
  const pageScroll = useAnimatedRef<ScrollView>(), pageOffset = useSharedValue(0), pageContentHeight = useSharedValue(0);
  const pageOnScroll = useAnimatedScrollHandler(event => { pageOffset.value = event.contentOffset.y; });
  // In a narrow split window the panels stack. Allow a held card to travel
  // between them without requiring a second finger to move the outer page.
  const pageFrame = useFrameCallback(frame => {
    if (!active.value) return;
    const rect = measure(pageScroll), velocity = studioEdgeVelocity(rect, x.value, y.value);
    if (!rect || !velocity) return;
    const next = Math.max(0, Math.min(pageContentHeight.value - rect.height, pageOffset.value + velocity * Math.min(frame.timeSincePreviousFrame ?? 16, 32) / 1000));
    scrollTo(pageScroll, 0, next, false);
  }, false);
  useEffect(() => { pageFrame.setActive(!phone && width < 700 && Boolean(dragged) && focused && !busy); return () => pageFrame.setActive(false); }, [phone, width, dragged, focused, busy]);
  const cancel = () => { active.value = false; source.value = ''; target.value = ''; destination.value = null; opacity.value = 0; setDragged(null); };
  useEffect(() => {
    mounted.current = true;
    let valid = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (valid) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const state = AppState.addEventListener('change', value => { if (value !== 'active') { cancel(); trayDragging.current = false; settleTray.current(); } });
    return () => {
      valid = false; mounted.current = false;
      // An animation may already have queued its JS completion. Invalidate the
      // source before leaving so it cannot save through an old profile/workspace.
      active.value = false; source.value = ''; target.value = ''; destination.value = null; opacity.value = 0;
      trayDragging.current = false; trayHeight.stopAnimation();
      motion.remove(); state.remove();
    };
  }, []);
  useEffect(() => { cancel(); }, [focused, width, window.height, phoneHeight, busy]);
  useEffect(() => {
    setSelected(ids => ids.filter(id => journeys.some(j => j.id === id)));
    if (source.value && !journeys.some(j => j.id === source.value)) cancel();
  }, [journeys]);
  const visibleJourneys = useMemo(() => filterJourneyLibrary(journeys, query, 'all', 'newest'), [journeys, query]);
  const visibleMemories = memories.filter(m => `${m.name} ${m.notes}`.toLowerCase().includes(memoryQuery.trim().toLowerCase()));
  const selectedLive = selected.filter(id => journeys.some(j => j.id === id));
  const add = async (memoryId: string, ids: string[]) => {
    if (!mounted.current || locked.current || busy || !ids.length) return;
    locked.current = true; setSaving(true);
    try {
      await onAdd(memoryId, ids);
      if (!mounted.current) return;
      setSelected([]); setMessage(`Journeys added. Saved on this ${phone ? 'iPhone' : 'iPad'}.`);
      AccessibilityInfo.announceForAccessibility('Journeys added to Memory');
    } catch (error) { if (mounted.current) Alert.alert('Memory not updated', error instanceof Error ? error.message : 'Your journeys remain saved. Please try again.'); }
    finally { locked.current = false; if (mounted.current) setSaving(false); }
  };
  const finish = (id: string, dropTarget: string) => {
    // A cancelled/rotated/backgrounded drag must never become a late write.
    if (!mounted.current || source.value !== id) return;
    cancel();
    if (locked.current || busy || !focused) return;
    const drop = memoryStudioDrop(id, dropTarget, journeys.map(j => j.id), memories.map(m => m.id));
    if (drop?.kind === 'create') onCreate(drop.journeyIds);
    if (drop?.kind === 'add') void add(drop.memoryId, drop.journeyIds);
  };
  const d: DragState = { compact: phone, source, target, active, x, y, originX, originY, rootX, rootY, scale, opacity, destination, root, reduceMotion,
    enabled: focused && !saving && !busy, dragging: Boolean(dragged), begin: id => { if (mounted.current && focused && !busy && source.value === id) setDragged(journeys.find(j => j.id === id) ?? null); }, finish };
  const floating = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: x.value - rootX.value - 145 }, { translateY: y.value - rootY.value - 62 }, { scale: scale.value }] }));
  const wide = width >= 700, galleryColumns = width >= 1050 ? 2 : 1;
  const panelHeight = Math.max(420, window.height - 330);
  const disabled = saving || busy;
  const animateTray = useCallback((expand: boolean) => {
    const next = expand ? phoneLayout.expandedTray : phoneLayout.collapsedTray;
    trayLiveHeight.current = next;
    trayHeight.stopAnimation();
    if (reduceMotion) trayHeight.setValue(next);
    else NativeAnimated.spring(trayHeight, { toValue: next, damping: 23, stiffness: 240, mass: 0.8, useNativeDriver: false }).start();
  }, [phoneLayout.expandedTray, phoneLayout.collapsedTray, reduceMotion, trayHeight]);
  useEffect(() => {
    settleTray.current = () => animateTray(trayExpanded);
    trayDragging.current = false;
    animateTray(trayExpanded);
  }, [animateTray, trayExpanded, focused, disabled, width, window.height, phoneHeight]);
  const trayResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => phone && focused && !disabled && !dragged
      && Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      if (!mounted.current || !phone || !focused || disabled || dragged) return;
      trayDragging.current = true;
      Keyboard.dismiss(); cancel();
      trayHeight.stopAnimation(value => { trayStartHeight.current = value; trayLiveHeight.current = value; });
    },
    onPanResponderMove: (_event, gesture) => {
      if (!mounted.current || !trayDragging.current) return;
      const next = clampStudioTrayHeight(trayStartHeight.current - gesture.dy, phoneLayout.collapsedTray, phoneLayout.expandedTray);
      trayLiveHeight.current = next; trayHeight.setValue(next);
    },
    onPanResponderRelease: (_event, gesture) => {
      if (!mounted.current || !trayDragging.current) return;
      trayDragging.current = false;
      const expand = settleStudioTrayExpanded(trayLiveHeight.current, phoneLayout.collapsedTray, phoneLayout.expandedTray, gesture.vy);
      animateTray(expand); setTrayExpanded(expand);
    },
    onPanResponderTerminate: () => { if (!mounted.current || !trayDragging.current) return; trayDragging.current = false; animateTray(trayExpanded); },
    onPanResponderTerminationRequest: () => true,
  }), [animateTray, disabled, dragged, focused, phone, phoneLayout.collapsedTray, phoneLayout.expandedTray, trayExpanded, trayHeight]);
  if (phone) return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: c.page }}>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}><DragContext.Provider value={d}><Animated.View testID="studio-drag-root" ref={root} collapsable={false}
      onLayout={event => { setWidth(event.nativeEvent.layout.width); setPhoneHeight(event.nativeEvent.layout.height); }} style={styles.phoneRoot}>
      <View testID="iphone-memory-gallery" style={{ flex: 1, minHeight: 0 }}><StudioScroll label="Memory gallery">
        <PhoneTabTitle title="Memories" />
        <View style={styles.phoneHeader}>
          <HeaderArtwork source={require('../assets/cinematic-memories-polaroids-photo-v1.jpg')} />
        </View>
        <View style={styles.phoneSearchRow}>
          <TextInput accessibilityLabel="Search Memories" value={memoryQuery} onChangeText={setMemoryQuery} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} placeholder="Search Memories" placeholderTextColor={c.muted} style={[styles.phoneSearch, { color: c.text, borderColor: c.line }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="New Memory" disabled={disabled} onPress={() => onCreate(selectedLive)} style={[styles.phonePlus, { backgroundColor: c.accent }]}>
            <SymbolView name="plus" tintColor={theme.palette.onAccent} style={styles.icon} />
          </Pressable>
        </View>
        <View style={styles.phoneSectionHeading}><Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>Your Memories</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh Memories" disabled={disabled || loading} onPress={onRefresh} style={styles.phoneRefresh}><SymbolView name="arrow.clockwise" tintColor={c.accent} style={styles.smallIcon} /></Pressable>
        </View>
        {loading && <ActivityIndicator accessibilityLabel="Refreshing Memories" color={c.accent} />}
        {error && <Text accessibilityRole="alert" style={[styles.phoneNotice, { color: c.accent }]}>{error}</Text>}
        <View testID="iphone-memory-grid" style={styles.grid}>{visibleMemories.slice(0, memoryLimit).map(memory => <Animated.View key={memory.id}
          layout={reduceMotion ? undefined : LinearTransition.springify().damping(24)} style={{ width: phoneLayout.columns === 2 ? '50%' : '100%', padding: 5 }}>
          <DropZone id={`memory:${memory.id}`}><CardDetailLink kind="memory" id={memory.id} actions={[
            { id: 'edit', title: 'Edit Memory', icon: 'pencil', onPress: () => onEdit(memory) },
            { id: 'share', title: 'Create share card', icon: 'square.and.arrow.up', onPress: () => onShare(memory) },
          ]}><Pressable accessibilityRole="button" accessibilityLabel={`Open Memory ${memory.name}`} disabled={disabled} onPress={() => onMemory(memory.id)} style={[styles.memoryCard, { height: phoneLayout.cardHeight, backgroundColor: c.inset }]}>
            {renderArtwork(memory)}<LinearGradient pointerEvents="none" colors={theme.isCustom ? [`${c.card}00`, `${c.card}f5`] : ['#10091800', '#100918e8']} style={StyleSheet.absoluteFill} />
            <View style={styles.phoneMemoryCopy}><Text numberOfLines={2} style={[styles.phoneMemoryTitle, theme.isCustom && { color: c.text }]}>{memory.name}</Text>
              <Text style={[styles.memoryMeta, theme.isCustom && { color: c.muted }]}>{memory.journeyIds.length} {memory.journeyIds.length === 1 ? 'journey' : 'journeys'}</Text>
            </View>
          </Pressable></CardDetailLink></DropZone>
          {selectedLive.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Add selected journeys to ${memory.name}`} disabled={disabled} onPress={() => void add(memory.id, selectedLive)} style={[styles.addSelected, { backgroundColor: c.inset }]}><Text style={{ color: c.accent, fontWeight: '600' }}>+ Add {selectedLive.length} selected</Text></Pressable>}
        </Animated.View>)}</View>
        {!visibleMemories.length && <Text style={[styles.empty, { color: c.muted }]}>{memoryQuery ? 'No Memories match this search.' : 'Make a Memory from the journeys you want to keep together.'}</Text>}
        <View style={{ margin: 5 }}><DropZone id="new"><Pressable accessibilityRole="button" accessibilityLabel="Create Memory from journeys" disabled={disabled} onPress={() => onCreate(selectedLive)} style={[styles.phoneNewMemory, { borderColor: c.accent, backgroundColor: c.inset }]}>
          <SymbolView name="rectangle.stack.badge.plus" tintColor={c.accent} style={styles.icon} /><Text style={{ color: c.accent, fontWeight: '600', flexShrink: 1 }}>Drop here to start a new Memory</Text>
        </Pressable></DropZone></View>
        {visibleMemories.length > memoryLimit && <Pressable accessibilityRole="button" onPress={() => setMemoryLimit(n => n + 20)} style={styles.action}><Text style={{ color: c.accent }}>Show more Memories</Text></Pressable>}
        {historyLimited && <Pressable accessibilityRole="button" onPress={onUpgrade} style={[styles.history, { backgroundColor: c.inset, margin: 5 }]}><Text style={{ color: c.accent }}>Latest 45 days · Unlock complete history  ›</Text></Pressable>}
        {message.startsWith('Journeys added') && <Text accessibilityLiveRegion="polite" style={[styles.phoneNotice, { color: c.accent }]}>{message}</Text>}
      </StudioScroll></View>
      <NativeAnimated.View testID="iphone-journey-tray" style={[styles.phoneTray, { backgroundColor: c.card, borderColor: c.line }, { height: trayHeight }]}>
        <View testID="iphone-journey-tray-grabber" {...trayResponder.panHandlers}>
        <Pressable accessibilityRole="button" accessibilityLabel={trayExpanded ? 'Collapse journey library' : 'Expand journey library'} accessibilityState={{ expanded: trayExpanded }} disabled={Boolean(dragged)}
          accessibilityHint="Tap or pull the handle to move the Journey library."
          onPress={() => { Keyboard.dismiss(); cancel(); const expand = !trayExpanded; animateTray(expand); setTrayExpanded(expand); }} style={styles.phoneTrayHeader}>
          <View style={[styles.trayHandle, { backgroundColor: c.line }]} />
          <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.phoneTrayTitle, { color: c.text }]}>Journey library</Text><Text style={[styles.phoneTrayHint, { color: c.muted }]}>{saving ? 'Saving…' : trayExpanded ? 'Hold and drag to build your story' : `${visibleJourneys.length} journeys · Tap or pull up`}</Text></View>
            <SymbolView name={trayExpanded ? 'chevron.down' : 'chevron.up'} tintColor={c.accent} style={styles.smallIcon} />
          </View>
        </Pressable>
        </View>
        <View testID="iphone-journey-tray-body" accessibilityElementsHidden={!trayExpanded} importantForAccessibility={trayExpanded ? 'auto' : 'no-hide-descendants'} pointerEvents={trayExpanded ? 'auto' : 'none'} style={{ flex: 1, minHeight: 0 }}>
          <StudioScroll label="Journey library">
            <TextInput accessibilityLabel="Search journeys" value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} placeholder="Search journeys" placeholderTextColor={c.muted} style={[styles.phoneSearch, { color: c.text, borderColor: c.line, marginHorizontal: 6, marginBottom: 5 }]} />
            {selectedLive.length > 0 && <View style={[styles.selection, { backgroundColor: c.inset, marginHorizontal: 6 }]}><Pressable accessibilityRole="button" disabled={disabled} onPress={() => onCreate(selectedLive)} style={styles.action}><Text style={{ color: c.accent, fontWeight: '600' }}>Create with {selectedLive.length} selected</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setSelected([])} style={styles.action}><Text style={{ color: c.accent }}>Clear</Text></Pressable></View>}
            {visibleJourneys.slice(0, journeyLimit).map(journey => <DraggableJourney key={journey.id} journey={journey} selected={selectedLive.includes(journey.id)}
              onSelect={() => { if (!disabled && !source.value) setSelected(ids => ids.includes(journey.id) ? ids.filter(id => id !== journey.id) : [...ids, journey.id]); }} onOpen={() => { if (!disabled && !source.value) onJourney(journey.id); }} />)}
            {!visibleJourneys.length && <Text style={[styles.empty, { color: c.muted }]}>{query ? 'No journeys match this search.' : 'Your completed journeys will appear here, ready to organize.'}</Text>}
            {visibleJourneys.length > journeyLimit && <Pressable accessibilityRole="button" onPress={() => setJourneyLimit(n => n + 30)} style={styles.action}><Text style={{ color: c.accent }}>Show more journeys</Text></Pressable>}
          </StudioScroll>
        </View>
      </NativeAnimated.View>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.floating, floating]}>{dragged && <JourneyFace journey={dragged} floating compact />}</Animated.View>
    </Animated.View></DragContext.Provider></KeyboardAvoidingView>
  </SafeAreaView>;
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
    <DragContext.Provider value={d}><Animated.View testID="studio-drag-root" ref={root} collapsable={false} style={{ flex: 1 }}>
      <Animated.ScrollView ref={pageScroll} onScroll={pageOnScroll} scrollEventThrottle={16} onContentSizeChange={(_w, h) => { pageContentHeight.value = h; }}
        testID="ipad-memories" contentInsetAdjustmentBehavior="automatic" scrollEnabled={!dragged} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        <View testID="ipad-memories-canvas" onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.canvas}>
          <IpadPageHeader title="Memories" width={width} artwork={require('../assets/cinematic-memories-polaroids-photo-v1.jpg')} subtitle="Your journeys. Your stories. Brought together.">
            <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onCreate(selectedLive)} style={[styles.button, { backgroundColor: c.accent }]}><Text style={[styles.buttonText, { color: theme.palette.onAccent }]}>+ New Memory</Text></Pressable>
          </IpadPageHeader>
          <View style={styles.toolbar}><Text accessibilityLiveRegion="polite" style={[styles.hint, { color: c.muted }]}>{saving ? 'Saving your Memory…' : message}</Text>
            <Pressable accessibilityRole="button" disabled={loading || disabled} onPress={onRefresh} style={styles.action}><Text style={{ color: c.accent }}>Refresh</Text></Pressable></View>
          {error ? <Text accessibilityRole="alert" style={{ color: c.accent }}>{error}</Text> : null}
          {loading && <ActivityIndicator accessibilityLabel="Refreshing Memories" color={c.accent} />}
          {historyLimited && <Pressable accessibilityRole="button" onPress={onUpgrade} style={[styles.history, { backgroundColor: c.inset }]}><Text style={{ color: c.accent }}>Latest 45 days · Unlock your complete history  ›</Text></Pressable>}
          <View testID="ipad-memory-studio" style={[styles.workspace, { flexDirection: wide ? 'row' : 'column' }]}>
            <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.line, height: panelHeight }, wide && { flex: 1.6 }]}>
              <View style={styles.panelHeader}><Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>Your Memories</Text><Text style={{ color: c.muted }}>{memories.length}</Text></View>
              <TextInput accessibilityLabel="Search Memories" value={memoryQuery} onChangeText={setMemoryQuery} placeholder="Search Memories" placeholderTextColor={c.muted} style={[styles.search, { color: c.text, borderColor: c.line }]} />
              <StudioScroll label="Memory gallery"><View style={styles.grid}>
                {visibleMemories.slice(0, memoryLimit).map(memory => <Animated.View key={memory.id} layout={reduceMotion ? undefined : LinearTransition.springify().damping(24)} style={{ width: galleryColumns === 2 ? '50%' : '100%', padding: 6 }}>
                  <DropZone id={`memory:${memory.id}`}>
                    <CardDetailLink kind="memory" id={memory.id} actions={[
                      { id: 'edit', title: 'Edit Memory', icon: 'pencil', onPress: () => onEdit(memory) },
                      { id: 'share', title: 'Create share card', icon: 'square.and.arrow.up', onPress: () => onShare(memory) },
                    ]}><Pressable accessibilityRole="button" accessibilityLabel={`Open Memory ${memory.name}`} disabled={disabled} onPress={() => onMemory(memory.id)} style={[styles.memoryCard, { backgroundColor: c.inset }]}>
                      {renderArtwork(memory)}
                      <LinearGradient pointerEvents="none" colors={['#10091800', '#100918e8']} style={StyleSheet.absoluteFill} />
                      <View style={styles.memoryCopy}><Text numberOfLines={2} style={styles.memoryTitle}>{memory.name}</Text><Text style={styles.memoryMeta}>{memory.journeyIds.length} journeys · {memory.photos.length} photos</Text></View>
                    </Pressable></CardDetailLink>
                  </DropZone>
                  {selectedLive.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Add selected journeys to ${memory.name}`} disabled={disabled} onPress={() => void add(memory.id, selectedLive)} style={[styles.addSelected, { backgroundColor: c.inset }]}><Text style={{ color: c.accent, fontWeight: '600' }}>+ Add {selectedLive.length} selected</Text></Pressable>}
                </Animated.View>)}
                <View style={{ width: galleryColumns === 2 ? '50%' : '100%', padding: 6 }}><DropZone id="new">
                  <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onCreate(selectedLive)} style={[styles.newCard, { backgroundColor: c.inset, borderColor: c.accent }]}>
                    <SymbolView name="rectangle.stack.badge.plus" tintColor={c.accent} style={{ width: 38, height: 38 }} /><Text style={[styles.heading, { color: c.accent }]}>A new chapter</Text><Text style={[styles.meta, { color: c.muted, textAlign: 'center' }]}>Drop a journey here, or tap to choose journeys.</Text>
                  </Pressable></DropZone></View>
              </View>
                {!visibleMemories.length && !!memoryQuery && <Text style={[styles.empty, { color: c.muted }]}>No Memories match this search.</Text>}
                {visibleMemories.length > memoryLimit && <Pressable accessibilityRole="button" onPress={() => setMemoryLimit(n => n + 20)} style={styles.action}><Text style={{ color: c.accent }}>Show more Memories</Text></Pressable>}
              </StudioScroll>
            </View>
            <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.line, height: panelHeight }, wide && { flex: 1 }]}>
              <View style={styles.panelHeader}><Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>Journey library</Text><Text style={{ color: c.muted }}>{visibleJourneys.length}</Text></View>
              <TextInput accessibilityLabel="Search journeys" value={query} onChangeText={setQuery} placeholder="Search places, songs, dates" placeholderTextColor={c.muted} style={[styles.search, { color: c.text, borderColor: c.line }]} />
              {selectedLive.length > 0 && <View style={[styles.selection, { backgroundColor: c.inset }]}>
                <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onCreate(selectedLive)} style={styles.action}><Text style={{ color: c.accent, fontWeight: '600' }}>Create with {selectedLive.length} selected</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => setSelected([])} style={styles.action}><Text style={{ color: c.accent }}>Clear</Text></Pressable>
              </View>}
              <StudioScroll label="Journey library">
                {visibleJourneys.slice(0, journeyLimit).map(journey => <DraggableJourney key={journey.id} journey={journey} selected={selectedLive.includes(journey.id)}
                  onSelect={() => { if (!disabled && !source.value) setSelected(ids => ids.includes(journey.id) ? ids.filter(id => id !== journey.id) : [...ids, journey.id]); }} onOpen={() => { if (!disabled && !source.value) onJourney(journey.id); }} />)}
                {!visibleJourneys.length && <Text style={[styles.empty, { color: c.muted }]}>{query ? 'No journeys match this search.' : 'Your recorded journeys will appear here. Sync your iPhone library to start making Memories.'}</Text>}
                {visibleJourneys.length > journeyLimit && <Pressable accessibilityRole="button" onPress={() => setJourneyLimit(n => n + 30)} style={styles.action}><Text style={{ color: c.accent }}>Show more journeys</Text></Pressable>}
              </StudioScroll>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.floating, floating]}>{dragged && <JourneyFace journey={dragged} floating />}</Animated.View>
    </Animated.View></DragContext.Provider>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  // NativeTabs provides per-screen safe-area insets, including its bottom bar.
  // SafeAreaView above consumes that inset; only add a small visual gutter here.
  phoneRoot: { flex: 1, minHeight: 0, marginHorizontal: 12, marginBottom: 8, gap: 8 },
  phoneHeader: { marginHorizontal: -4 },
  phoneSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 5, marginTop: 5 },
  phoneSearch: { flexGrow: 1, flexShrink: 1, minHeight: 44, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, fontSize: 15 },
  phonePlus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  phoneSectionHeading: { paddingLeft: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phoneRefresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  phoneMemoryCopy: { padding: 12, gap: 6 }, phoneMemoryTitle: { color: '#fff6ed', fontSize: 21, lineHeight: 25, fontWeight: '700' },
  phoneNewMemory: { minHeight: 64, borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  phoneTray: { flexShrink: 0, overflow: 'hidden', borderWidth: 1, borderRadius: 24 },
  phoneTrayHeader: { minHeight: 66, paddingHorizontal: 16, paddingTop: 7, paddingBottom: 9, gap: 7 },
  trayHandle: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center' },
  phoneTrayTitle: { fontSize: 17, fontWeight: '700' }, phoneTrayHint: { fontSize: 11, marginTop: 3 },
  phoneJourneyFace: { padding: 11, gap: 5 }, phoneNotice: { padding: 12, fontSize: 13, lineHeight: 19 },
  page: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 36 }, canvas: { width: '100%', gap: 14 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12 }, hint: { flex: 1, fontSize: 14, lineHeight: 21 },
  workspace: { gap: 18, alignItems: 'stretch' }, panel: { borderWidth: 1, borderRadius: 24, paddingTop: 18, minWidth: 0, overflow: 'hidden' },
  panelHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { fontSize: 20, fontWeight: '700', flexShrink: 1 }, search: { margin: 14, padding: 13, borderWidth: 1, borderRadius: 14, fontSize: 15 },
  scrollContent: { padding: 8, paddingBottom: 28 }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
  memoryCard: { height: 246, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  memoryCopy: { padding: 18, gap: 6 }, memoryTitle: { color: '#fff6ed', fontSize: 24, fontWeight: '800' }, memoryMeta: { color: '#f0e1ee', fontSize: 13 },
  newCard: { height: 246, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: 22, gap: 14, justifyContent: 'center', alignItems: 'center' },
  journeyWrap: { margin: 6, borderRadius: 18, overflow: 'visible' }, journeyFace: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, icon: { width: 21, height: 21 }, smallIcon: { width: 16, height: 16 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1 }, journeyTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' }, meta: { fontSize: 13, lineHeight: 19 },
  openJourney: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  dropOutline: { borderRadius: 20, borderWidth: 3, justifyContent: 'flex-end', alignItems: 'center' },
  dropLabel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginBottom: 8 }, dropLabelText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  floating: { position: 'absolute', left: 0, top: 0, width: 290, zIndex: 100, shadowColor: '#180822', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 20 }, floatingFace: { borderWidth: 2 },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 15 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  action: { minHeight: 44, padding: 12, justifyContent: 'center' }, history: { padding: 14, borderRadius: 14 },
  selection: { marginHorizontal: 14, borderRadius: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  addSelected: { padding: 12, minHeight: 44, borderRadius: 12, marginTop: 7 }, empty: { padding: 18, fontSize: 15, lineHeight: 23 },
});
