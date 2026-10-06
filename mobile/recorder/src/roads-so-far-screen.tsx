import { DEVICE_NAME, readingColumnStyle } from './device-layout';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppTheme } from './app-theme';
import { getCurrentUser } from './auth';
import { showTodayCard } from './today-screen';
import { FiftyStatesMap } from './fifty-states-ui';
import { haptics } from './haptics';
import { headerImageSource } from './header-image-sources';
import { SERIF, useRedesignColors } from './redesign-ui';
import { tripDates, type FoundTrip, type RoadsSoFar } from './roads-so-far-model';
import { RoadsScanCancelled, requestRoadsAccess, saveFoundStates, saveTripsAsMemories, scanRoadsSoFar, type RoadsScanProgress } from './roads-so-far-scan';

type Phase =
  | { kind: 'offer' }
  | { kind: 'scanning'; progress: RoadsScanProgress }
  | { kind: 'results'; roads: RoadsSoFar }
  | { kind: 'saving' }
  | { kind: 'blocked' }
  | { kind: 'empty' }
  | { kind: 'error' };

/** Settings entry: the same step as a pushed page, for people who finished onboarding before it existed. */
export function RoadsSoFarRoute() {
  const c = useRedesignColors();
  const done = () => router.back();
  return <View style={[styles.screen, { backgroundColor: c.page }]}>
    <LinearGradient pointerEvents="none" colors={[c.glow, c.page]} style={styles.glow} />
    <RoadsSoFarStep onDone={done} header={<Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={done}
      style={({ pressed }) => [styles.back, { backgroundColor: c.surfaceStrong, borderColor: c.border }, pressed && styles.pressed]}>
      <SymbolView name="chevron.left" tintColor={c.text} size={18} weight="semibold" />
    </Pressable>} />
  </View>;
}

const OFFER_PHOTOS = {
  front: require('../assets/theme-grand-touring-home-v2.png'),
  left: require('../assets/home-header-light-v1.png'),
  right: require('../assets/theme-autumn-drive-road-v1.png'),
};

/**
 * Onboarding's last optional step: read the dates and places of the user's own photos,
 * on the iPhone, to show the states and road trips they have already driven, then save
 * the trips they choose as Memories so Today is not empty before the first drive.
 */
export function RoadsSoFarStep({ header, onDone }: { header: ReactNode; onDone: () => void }) {
  const c = useRedesignColors();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ kind: 'offer' });
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const start = async () => {
    void haptics.selection();
    cancelled.current = false;
    try {
      const permission = await requestRoadsAccess();
      if (permission !== 'full' && permission !== 'limited') { setPhase({ kind: 'blocked' }); return; }
      setPhase({ kind: 'scanning', progress: { photos: 0, places: 0, states: 0, phase: 'reading' } });
      const roads = await scanRoadsSoFar(progress => { if (!cancelled.current) setPhase({ kind: 'scanning', progress }); }, () => cancelled.current);
      if (cancelled.current) return;
      if (!roads.states.length && !roads.trips.length) { setPhase({ kind: 'empty' }); return; }
      saveFoundStates(roads.states);
      if (roads.states.length) showTodayCard(getCurrentUser().id, 'fiftyStates');
      setChosen(new Set(roads.trips.slice(0, 2).map(trip => trip.id)));
      void haptics.success();
      setPhase({ kind: 'results', roads });
    } catch (error) {
      if (!(error instanceof RoadsScanCancelled) && !cancelled.current) setPhase({ kind: 'error' });
    }
  };
  const cancel = () => { cancelled.current = true; setPhase({ kind: 'offer' }); };
  const save = async (roads: RoadsSoFar) => {
    const trips = roads.trips.filter(trip => chosen.has(trip.id));
    if (!trips.length) { onDone(); return; }
    setPhase({ kind: 'saving' });
    try { await saveTripsAsMemories(trips); void haptics.success(); } catch { /* Memories already saved stay saved. */ }
    onDone();
  };

  const primary = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.primary, { backgroundColor: c.accent, opacity: disabled ? 0.5 : 1 }, pressed && styles.pressed]}>
    <Text style={[styles.primaryText, { color: c.onAccent }]}>{label}</Text>
  </Pressable>;
  const secondary = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
    <Text style={[styles.secondaryText, { color: c.text }]}>{label}</Text>
  </Pressable>;
  const kicker = (text: string, color = c.textSecondary) => <Text style={[styles.kicker, { color }]}>{text}</Text>;
  const title = (text: string) => <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{text}</Text>;
  const body = (text: string) => <Text style={[styles.body, { color: c.textSecondary }]}>{text}</Text>;
  const card = { backgroundColor: c.surface, borderColor: c.border };

  const content = (() => {
    switch (phase.kind) {
      case 'offer': return <>
        <View style={styles.fan} accessible={false}>
          <PhotoTile source={headerImageSource(OFFER_PHOTOS.left, theme.id)} label="Big Sur, CA" style={styles.fanLeft} />
          <PhotoTile source={headerImageSource(OFFER_PHOTOS.right, theme.id)} label="Asheville, NC" style={styles.fanRight} />
          <PhotoTile source={headerImageSource(OFFER_PHOTOS.front, theme.id)} caption="ROAD TRIP FOUND" style={styles.fanFront} />
        </View>
        {kicker('OPTIONAL · TAKES ABOUT 30 SECONDS', c.accent)}
        {title("See where you've been.")}
        {body('JourneyDeck can use the dates and places in your photos to map your past road trips and the states you\'ve visited. Your first Memories are ready before your first drive.')}
        <View style={[styles.note, card]}>
          <SymbolView name="lock.fill" tintColor={c.accent} size={16} />
          <Text style={[styles.noteText, { color: c.textSecondary }]}>Happens only on this {DEVICE_NAME}. Photos are never uploaded or copied unless you choose to add them.</Text>
        </View>
        <View style={styles.spacer} />
        {primary('Look at my photos', () => void start())}
        {secondary('Not now', onDone)}
      </>;
      case 'scanning': {
        const { progress } = phase;
        return <>
          <View style={styles.center}>
            <View style={[styles.ringOuter, { borderColor: c.accentSoft }]}><View style={[styles.ringInner, { borderColor: c.accent }]}>
              <SymbolView name="map" tintColor={c.accent} size={44} />
            </View></View>
            {kicker('ON THIS IPHONE')}
            {title('Tracing your roads…')}
            {body('Reading only photo dates and places.')}
          </View>
          <View style={styles.steps}>
            <Step done={progress.photos > 0} label="Photos read" value={progress.photos.toLocaleString()} />
            <Step done={progress.places > 0} label="Places found" value={progress.places.toLocaleString()} />
            <Step done={progress.phase === 'grouping' && progress.states > 0} running={progress.phase === 'grouping'} label="Grouping road trips" />
          </View>
          <View style={styles.spacer} />
          {secondary('Cancel', cancel)}
        </>;
      }
      case 'results': {
        const { roads } = phase;
        return <>
          {kicker('YOUR ROADS SO FAR')}
          {title("You've been busy.")}
          <View style={[styles.mapCard, card]}>
            <FiftyStatesMap seen={roads.states} compact />
          </View>
          <View style={styles.stats}>
            <Stat value={String(roads.states.length)} label="of 50 states" />
            <Stat value={String(roads.trips.length)} label={roads.trips.length === 1 ? 'road trip' : 'road trips'} />
            <Stat value={roads.places.toLocaleString()} label="places" />
          </View>
          {roads.trips.length ? <>
            {kicker('SAVE AS MEMORIES')}
            <View style={[styles.list, card]}>
              {roads.trips.map((trip, index) => <TripRow key={trip.id} trip={trip} on={chosen.has(trip.id)} first={index === 0}
                onToggle={() => setChosen(current => { const next = new Set(current); if (next.has(trip.id)) next.delete(trip.id); else next.add(trip.id); return next; })} />)}
            </View>
          </> : body('No road trips stood out, but your states are already on your 50 States map.')}
          <View style={styles.spacer} />
          {primary(chosen.size ? `Save ${chosen.size} ${chosen.size === 1 ? 'Memory' : 'Memories'}` : 'Continue', () => void save(roads))}
          {chosen.size ? secondary('Skip for now', onDone) : null}
        </>;
      }
      case 'saving': return <View style={[styles.center, styles.fill]}>
        <ActivityIndicator color={c.accent} />
        {body('Saving your Memories…')}
      </View>;
      case 'blocked': return <>
        {title('Photos access is off.')}
        {body('Allow JourneyDeck to use your photos in iOS Settings to see where you\'ve been. You can also do this later.')}
        <View style={styles.spacer} />
        {primary('Open Settings', () => void Linking.openSettings().catch(() => undefined))}
        {secondary('Not now', onDone)}
      </>;
      case 'empty': return <>
        {title('No places in your photos yet.')}
        {body('Your photos don\'t include locations, so there is nothing to map yet. Your drives will fill this in from now on.')}
        <View style={styles.spacer} />
        {primary('Continue', onDone)}
      </>;
      case 'error': return <>
        {title('That didn\'t finish.')}
        {body('JourneyDeck could not read your photos this time. Nothing was changed.')}
        <View style={styles.spacer} />
        {primary('Try again', () => void start())}
        {secondary('Not now', onDone)}
      </>;
    }
  })();

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, readingColumnStyle, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16), marginLeft: insets.left, marginRight: insets.right }]} showsVerticalScrollIndicator={false}>
      {header}
      {content}
    </ScrollView>
  </View>;
}

function PhotoTile({ source, label, caption, style }: { source: ImageSourcePropType; label?: string; caption?: string; style: object }) {
  const c = useRedesignColors();
  return <View style={[styles.tile, { borderColor: c.border, backgroundColor: c.surfaceStrong, shadowColor: c.shadow }, style]}>
    <ExpoImage source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
    {caption ? <LinearGradient colors={c.photoScrim} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} /> : null}
    {label ? <View style={[styles.pin, { backgroundColor: c.photoChip }]}><SymbolView name="mappin" tintColor={c.accent} size={11} /><Text style={[styles.pinText, { color: c.text }]}>{label}</Text></View> : null}
    {caption ? <Text style={[styles.caption, { color: c.accent }]}>{caption}</Text> : null}
  </View>;
}

function Step({ done, running = false, label, value }: { done: boolean; running?: boolean; label: string; value?: string }) {
  const c = useRedesignColors();
  return <View style={[styles.step, { backgroundColor: c.surface, borderColor: c.border }]}>
    {done ? <View style={[styles.stepDot, { backgroundColor: c.accent }]}><SymbolView name="checkmark" tintColor={c.onAccent} size={11} weight="bold" /></View>
      : running ? <ActivityIndicator size="small" color={c.accent} style={styles.stepDot} />
      : <View style={[styles.stepDot, styles.stepIdle, { borderColor: c.border }]} />}
    <Text style={[styles.stepLabel, { color: done || running ? c.text : c.textSecondary }]}>{label}</Text>
    {value ? <Text style={[styles.stepValue, { color: c.text }]}>{value}</Text> : null}
  </View>;
}

function Stat({ value, label }: { value: string; label: string }) {
  const c = useRedesignColors();
  return <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.statValue, { color: c.text }]}>{value}</Text>
    <Text numberOfLines={1} style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
  </View>;
}

function TripRow({ trip, on, first, onToggle }: { trip: FoundTrip; on: boolean; first: boolean; onToggle: () => void }) {
  const c = useRedesignColors();
  const symbol: SFSymbol = on ? 'checkmark.circle.fill' : 'circle';
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Save ${trip.name}, ${tripDates(trip.startMs, trip.endMs)}, ${trip.photoIds.length} photos`}
    onPress={() => { void haptics.selection(); onToggle(); }}
    style={({ pressed }) => [styles.trip, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }, pressed && styles.pressed]}>
    <View style={[styles.tripIcon, { backgroundColor: c.accentSoft }]}><SymbolView name="car.fill" tintColor={c.accent} size={18} /></View>
    <View style={styles.flex}>
      <Text numberOfLines={1} style={[styles.tripName, { color: c.text }]}>{trip.name}</Text>
      <Text numberOfLines={1} style={[styles.tripDetail, { color: c.textSecondary }]}>{tripDates(trip.startMs, trip.endMs)} · {trip.photoIds.length} photos</Text>
    </View>
    <SymbolView name={symbol} tintColor={on ? c.accent : c.textTertiary} size={24} />
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  spacer: { flexGrow: 1, minHeight: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, marginTop: 6 },
  title: { fontFamily: SERIF, fontSize: 34, lineHeight: 40, fontWeight: '600', letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 23 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  primary: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '700' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  fan: { height: 250, marginTop: 8 },
  tile: { position: 'absolute', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 12 } },
  fanLeft: { left: 0, top: 30, width: 160, height: 196, transform: [{ rotate: '-8deg' }] },
  fanRight: { right: 0, top: 26, width: 160, height: 196, transform: [{ rotate: '8deg' }] },
  fanFront: { left: '50%', marginLeft: -86, top: 4, width: 172, height: 222 },
  pin: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pinText: { fontSize: 11, fontWeight: '600' },
  caption: { position: 'absolute', left: 12, bottom: 12, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  center: { alignItems: 'center', gap: 8, marginTop: 40 },
  ringOuter: { width: 200, height: 200, borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ringInner: { width: 136, height: 136, borderRadius: 68, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  steps: { gap: 10, marginTop: 20 },
  step: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepIdle: { borderWidth: 2 },
  stepLabel: { flex: 1, fontSize: 15 },
  stepValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mapCard: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  statValue: { fontFamily: SERIF, fontSize: 26, lineHeight: 31, fontWeight: '600' },
  statLabel: { fontSize: 12 },
  list: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  trip: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  tripIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tripName: { fontSize: 15, fontWeight: '600' },
  tripDetail: { fontSize: 13 },
});
