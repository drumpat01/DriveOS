import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, FlatList, Image, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { useAppTheme } from './app-theme';
import { photoMatchingLibrary, type MatchedPhotoImport, type PhotoLibraryPreview, type PhotoLibraryStatus } from './photo-matching-library';
import { PHOTO_MATCH_LIMITS, matchPhotosToJourneys, photoMatchWindows, preparePhotoMatchJourneys, type PhotoMatch, type PhotoMatchJourney } from './photo-matching-model';

export type PhotoMatchingScreenProps = {
  /** Owner and Memory identity. Changing it cancels all old reads and import callbacks. */
  reviewKey: string;
  memoryName: string;
  journeys: readonly PhotoMatchJourney[];
  /** Persist through the existing private Memory photo boundary; reject if owner/Memory changed. */
  onImport: (photo: MatchedPhotoImport, match: PhotoMatch) => Promise<void>;
  onClose: () => void;
};

function PhotoSuggestion({ scanId, match, width, selected, imported, disabled, reduceMotion, onToggle }: {
  scanId: string; match: PhotoMatch; width: number; selected: boolean; imported: boolean; disabled: boolean; reduceMotion: boolean; onToggle: () => void;
}) {
  const { palette: p } = useAppTheme();
  const [preview, setPreview] = useState<PhotoLibraryPreview | null>(null);
  const [attempt, setAttempt] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    setPreview(null);
    void photoMatchingLibrary.preview(scanId, match.asset.id).then(value => {
      if (live) setPreview(value);
    }).catch(() => { if (live) setPreview({ status: 'unavailable', checkedForNudity: false }); });
    return () => { live = false; fade.stopAnimation(); };
  }, [scanId, match.asset.id, attempt, fade]);
  useEffect(() => {
    fade.setValue(preview ? (reduceMotion ? 1 : 0) : 0);
    if (preview && !reduceMotion) Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    return () => fade.stopAnimation();
  }, [preview, reduceMotion, fade]);
  const ready = preview?.status === 'ready' && !!preview.dataUri;
  const label = imported ? 'Added to Memory' : selected ? 'Selected' : 'Select photo';
  return <View style={[s.tile, { width, backgroundColor: p.card, borderColor: selected ? p.accent : p.line }]}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`${label}. ${match.journeyTitle}. ${match.reason === 'time-and-place' ? 'Time and location match' : 'Time match only'}.`}
      accessibilityState={{ checked: selected || imported, disabled: !ready || disabled || imported }} disabled={!ready || disabled || imported}
      onPress={onToggle} style={s.photoButton}>
      {ready ? <Animated.View style={[s.photo, { opacity: fade }]}><Image source={{ uri: preview.dataUri }} style={s.photo} resizeMode="cover" /></Animated.View>
        : <View style={[s.photo, s.placeholder, { backgroundColor: p.inset }]}>{preview ? <Text style={[s.placeholderText, { color: p.muted }]}>{preview.status === 'sensitive' ? 'Potentially sensitive\nExcluded from suggestions' : 'Photo unavailable\nOpen it in Photos to download'}</Text> : <ActivityIndicator color={p.accent} />}</View>}
      <View style={[s.selection, { backgroundColor: selected || imported ? p.accent : p.page, borderColor: p.chrome }]}><Text style={{ color: selected || imported ? p.onAccent : p.text, fontWeight: '800' }}>{selected || imported ? '✓' : '+'}</Text></View>
    </Pressable>
    <View style={s.tileCopy}>
      <Text style={[s.eyebrow, { color: match.reason === 'time-and-place' ? p.accent : p.muted }]}>{imported ? 'ADDED' : match.reason === 'time-and-place' ? 'TIME + PLACE' : 'TIME ONLY'}</Text>
      <Text numberOfLines={2} style={[s.tileTitle, { color: p.text }]}>{match.journeyTitle}</Text>
      <Text style={[s.small, { color: p.muted }]}>{new Date(match.asset.createdAtUtc).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
      {match.timeOffsetMinutes > 0 && <Text style={[s.small, { color: p.muted }]}>Near the journey · {Math.ceil(match.timeOffsetMinutes)} min outside recording</Text>}
      {preview?.status === 'unavailable' && !disabled && <Pressable accessibilityRole="button" onPress={() => setAttempt(n => n + 1)} style={s.retry}><Text style={{ color: p.accent }}>Retry preview</Text></Pressable>}
    </View>
  </View>;
}

/** Free for every membership. No scan or photo import happens until the person chooses it. */
export function PhotoMatchingScreen(props: PhotoMatchingScreenProps) {
  // Owner/Memory changes remount before rendering, so old thumbnails cannot flash under a new profile.
  return <PhotoMatchingReview key={props.reviewKey} {...props} />;
}

function PhotoMatchingReview({ reviewKey, memoryName, journeys, onImport, onClose }: PhotoMatchingScreenProps) {
  const { palette: p } = useAppTheme(), { width } = useWindowDimensions(), insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PhotoLibraryStatus | null>(null);
  const [phase, setPhase] = useState<'intro' | 'scanning' | 'review' | 'importing'>('intro');
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [scanId, setScanId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const generation = useRef(0), scanRef = useRef(''), mounted = useRef(false), busy = useRef(false);
  const eligible = useMemo(() => preparePhotoMatchJourneys(journeys), [journeys]);
  const columns = width >= 900 ? 4 : width >= 650 ? 3 : 2;
  const contentWidth = Math.min(width - 40, 1160), tileWidth = (contentWidth - (columns - 1) * 12) / columns;
  const isCurrent = (run: number) => mounted.current && generation.current === run;
  const cancel = useCallback(() => {
    generation.current += 1;
    const id = scanRef.current; scanRef.current = ''; busy.current = false;
    if (id) void photoMatchingLibrary.cancel(id).catch(() => undefined);
  }, []);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    mounted.current = true;
    setPhase('intro'); setMatches([]); setSelected(new Set()); setImported(new Set()); setMessage('');
    let alive = true;
    void photoMatchingLibrary.getStatus().then(value => { if (alive) setStatus(value); }).catch(() => { if (alive) setMessage('Photos access could not be checked. Try again.'); });
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'background') return;
      cancel(); setPhase('intro'); setMatches([]); setSelected(new Set());
      setMessage('Photo review paused when JourneyDeck went into the background. Find matches again to continue.');
    });
    return () => { alive = false; mounted.current = false; cancel(); subscription.remove(); };
  }, [reviewKey, cancel]);

  async function findMatches() {
    if (busy.current || eligible.length === 0) return;
    cancel(); busy.current = true;
    const run = generation.current, id = Crypto.randomUUID();
    scanRef.current = id; setScanId(id); setPhase('scanning'); setMessage(''); setMatches([]); setSelected(new Set());
    try {
      const access = await photoMatchingLibrary.requestPermission();
      if (!isCurrent(run)) return;
      setStatus(access);
      if (access.permission !== 'full' && access.permission !== 'limited') {
        setPhase('intro'); return;
      }
      const scanned = await photoMatchingLibrary.scan(id, photoMatchWindows(eligible));
      if (!isCurrent(run)) { void photoMatchingLibrary.cancel(id).catch(() => undefined); return; }
      const next = matchPhotosToJourneys(scanned.assets, eligible);
      setMatches(next); setTruncated(scanned.truncated || next.length >= PHOTO_MATCH_LIMITS.suggestions); setPhase('review');
    } catch { if (isCurrent(run)) { setMessage('Photo matching could not finish. Your Memory has not changed. Try again.'); setPhase('intro'); } }
    finally { if (isCurrent(run)) busy.current = false; }
  }

  async function importSelection() {
    if (busy.current || !selected.size) return;
    busy.current = true; setPhase('importing'); setMessage('');
    const run = generation.current, id = scanRef.current;
    const chosen = matches.filter(m => selected.has(m.asset.id) && !imported.has(m.asset.id)).slice(0, PHOTO_MATCH_LIMITS.selection);
    let added = 0, failed = 0;
    for (const match of chosen) {
      if (!isCurrent(run)) break;
      try {
        const photo = await photoMatchingLibrary.export(id, match.asset.id);
        if (!isCurrent(run)) break;
        await onImport(photo, match);
        if (!isCurrent(run)) break;
        added += 1;
        setImported(previous => new Set(previous).add(match.asset.id));
        setSelected(previous => { const next = new Set(previous); next.delete(match.asset.id); return next; });
      } catch { if (isCurrent(run)) failed += 1; }
    }
    if (isCurrent(run)) {
      busy.current = false; setPhase('review');
      setMessage(`${added} photo${added === 1 ? '' : 's'} added to ${memoryName}.${failed ? ` ${failed} could not be added. Successful imports stay saved. Retry the remaining selection, or search again to refresh Photos access.` : ''}`);
    }
  }

  const manageLimited = async () => {
    cancel(); setPhase('intro'); setMatches([]); setSelected(new Set());
    const run = generation.current;
    try { await photoMatchingLibrary.manageLimitedSelection(); }
    catch { if (isCurrent(run)) setMessage('Open Settings → JourneyDeck → Photos to choose accessible photos.'); }
  };
  const toggle = (id: string) => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else if (next.size < PHOTO_MATCH_LIMITS.selection) next.add(id);
    return next;
  });
  const blocked = status?.permission === 'denied' || status?.permission === 'restricted';
  const unavailable = status?.permission === 'unavailable';
  const header = <View style={s.introduction}>
    <Text style={[s.eyebrow, { color: p.accent }]}>PHOTOS THAT BELONG HERE</Text>
    <Text style={[s.title, { color: p.text }]}>Find the moments{width >= 650 ? ' between the miles.' : '\nbetween the miles.'}</Text>
    <Text style={[s.body, { color: p.muted }]}>Match photos to the journeys in {memoryName}. Review every suggestion and choose what to add.</Text>
    <View style={[s.notice, { backgroundColor: p.card, borderColor: p.line }]}>
      <Text style={[s.noticeTitle, { color: p.text }]}>On your device. Always your choice.</Text>
      <Text style={[s.small, { color: p.muted }]}>We use photo dates and saved photo locations. Hidden photos and screenshots are excluded. Nothing is added automatically. Selected copies use your existing private Memory library and iCloud sync settings.</Text>
      <Text style={[s.small, { color: p.muted, marginTop: 9 }]}>{status?.sensitivityAvailable
        ? 'Apple’s on-device nudity check is available. Flagged photos are withheld; the check cannot identify every type of sensitive content.'
        : 'Automatic sensitive-content filtering is unavailable. Suggestions use time and location only; review photos before adding them.'}</Text>
    </View>
    {status?.permission === 'limited' && <View style={s.inline}><Text style={[s.small, { color: p.muted, flex: 1 }]}>Searching only the photos you allowed.</Text><Pressable disabled={phase === 'importing'} onPress={() => void manageLimited()}><Text style={{ color: p.accent }}>Choose photos</Text></Pressable></View>}
    {(journeys.length > eligible.length || eligible.length === PHOTO_MATCH_LIMITS.journeys) && <Text style={[s.small, { color: p.muted }]}>This review covers the {eligible.length} most recent eligible journeys. Use a Memory with fewer journeys to review older photos. Long or undated recordings are excluded.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[s.message, { color: p.text, borderColor: p.line }]}>{message}</Text>}
    {phase === 'intro' && <View style={s.introduction}>
      {unavailable ? <Text style={[s.body, { color: p.text }]}>Photo Matching becomes available with the next JourneyDeck app build. You can keep adding photos manually.</Text>
        : blocked ? <><Text style={[s.body, { color: p.text }]}>Allow Photos access in iOS Settings to find matches. You can choose a limited set of photos.</Text><Pressable style={[s.primary, { backgroundColor: p.accent }]} onPress={() => void Linking.openSettings().catch(() => setMessage('Open iOS Settings and select JourneyDeck → Photos.'))}><Text style={[s.primaryText, { color: p.onAccent }]}>Open iOS Settings</Text></Pressable></>
          : <Pressable disabled={!eligible.length} accessibilityRole="button" onPress={() => void findMatches()} style={[s.primary, { backgroundColor: p.accent, opacity: eligible.length ? 1 : 0.4 }]}><Text style={[s.primaryText, { color: p.onAccent }]}>{eligible.length ? 'Find matching photos' : 'Add a dated journey to this Memory first'}</Text></Pressable>}
      {blocked && <Pressable onPress={() => void findMatches()} style={s.retry}><Text style={{ color: p.accent }}>Check access again</Text></Pressable>}
    </View>}
    {phase === 'scanning' && <View style={s.loading}><ActivityIndicator color={p.accent} /><Text style={[s.body, { color: p.muted }]}>Looking through permitted photo dates…</Text></View>}
    {(phase === 'review' || phase === 'importing') && <View style={s.introduction}>
      <View style={s.inline}><Text style={[s.sectionTitle, { color: p.text }]}>{matches.length} suggestion{matches.length === 1 ? '' : 's'}</Text><Pressable disabled={phase === 'importing'} onPress={() => void findMatches()}><Text style={{ color: p.accent }}>Search again</Text></Pressable></View>
      <Text style={[s.small, { color: p.muted }]}>Time + place means the photo was taken near the recorded route. Time only means location was unavailable. Nearby arrival and departure photos include a 30-minute margin.</Text>
      {truncated && <Text style={[s.small, { color: p.muted }]}>Showing a bounded selection. Use a Memory with fewer journeys to narrow this search.</Text>}
      {!matches.length && <Text style={[s.body, { color: p.text }]}>No matching photos in the accessible library. Check the photo dates or allow more photos, then try again.</Text>}
    </View>}
  </View>;

  return <View style={[s.screen, { backgroundColor: p.page, paddingTop: insets.top }]}>
    <View style={[s.top, { borderBottomColor: p.line }]}><Text style={[s.topTitle, { color: p.text }]}>Photo Matching</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Photo Matching" disabled={phase === 'importing'} accessibilityState={{ disabled: phase === 'importing' }} onPress={() => { cancel(); onClose(); }} style={s.close}><Text style={{ color: p.accent, fontWeight: '700' }}>{phase === 'importing' ? 'Adding…' : 'Done'}</Text></Pressable></View>
    <FlatList key={columns} data={phase === 'review' || phase === 'importing' ? matches : []} numColumns={columns} keyExtractor={match => match.asset.id}
      ListHeaderComponent={header} columnWrapperStyle={{ gap: 12 }} contentContainerStyle={[s.content, { width: contentWidth, paddingBottom: 30 }]}
      initialNumToRender={8} maxToRenderPerBatch={6} windowSize={3} removeClippedSubviews={false}
      renderItem={({ item }) => <PhotoSuggestion scanId={scanId} match={item} width={tileWidth} selected={selected.has(item.asset.id)} imported={imported.has(item.asset.id)} disabled={phase === 'importing'} reduceMotion={reduceMotion} onToggle={() => toggle(item.asset.id)} />} />
    {(phase === 'review' || phase === 'importing') && <View style={[s.footer, { paddingBottom: Math.max(12, insets.bottom), backgroundColor: p.card, borderTopColor: p.line }]}>
      <Text style={[s.small, { color: p.muted }]}>{selected.size} of {PHOTO_MATCH_LIMITS.selection} selected · {imported.size} added</Text>
      <Pressable disabled={!selected.size || phase === 'importing'} accessibilityRole="button" onPress={() => void importSelection()} style={[s.primary, { backgroundColor: p.accent, opacity: !selected.size || phase === 'importing' ? 0.55 : 1 }]}>
        <Text style={[s.primaryText, { color: p.onAccent }]}>{phase === 'importing' ? 'Adding your selected photos…' : `Add ${selected.size || ''} selected photo${selected.size === 1 ? '' : 's'}`}</Text>
      </Pressable>
    </View>}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1 }, top: { paddingHorizontal: 20, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  topTitle: { fontSize: 18, fontWeight: '700' }, close: { padding: 12 }, content: { alignSelf: 'center', paddingTop: 24 }, introduction: { gap: 16, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  body: { fontSize: 16, lineHeight: 24 }, small: { fontSize: 12, lineHeight: 18 }, notice: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 8 }, noticeTitle: { fontSize: 16, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 20, padding: 14, borderWidth: 1, borderRadius: 14 }, primary: { borderRadius: 16, padding: 17, alignItems: 'center', minHeight: 52 }, primaryText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, sectionTitle: { fontSize: 22, fontWeight: '800' }, loading: { alignItems: 'center', gap: 16, padding: 25 },
  tile: { borderWidth: 1, borderRadius: 20, overflow: 'hidden', marginBottom: 14 }, photoButton: { aspectRatio: 1 }, photo: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: 12 }, placeholderText: { fontSize: 12, textAlign: 'center', lineHeight: 18 }, selection: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileCopy: { padding: 12, gap: 6 }, tileTitle: { fontSize: 14, fontWeight: '700' }, retry: { paddingVertical: 10, minHeight: 40 }, footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, gap: 10 },
});
