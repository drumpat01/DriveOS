import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { appDataClient, type SavedPlaceCategory, type SavedPlaceIntelligence, type VehicleIntelligenceData, type VehicleIntelligencePreferences } from './app-data';

const categories: SavedPlaceCategory[] = ['home', 'work', 'school', 'favorite', 'custom'];
const tabs = ['overview', 'charging', 'places', 'efficiency'] as const;
type IntelligenceTab = typeof tabs[number];

function money(value: number) { return `$${value.toFixed(2)}`; }
function number(value: number, digits = 1) { return value.toLocaleString(undefined, { maximumFractionDigits: digits }); }
function duration(minutes: number) {
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}
function day(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(parsed)) : 'Unknown date';
}

export function VehicleIntelligenceScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<IntelligenceTab>('overview');
  const [data, setData] = useState<VehicleIntelligenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPlace, setExpandedPlace] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState('0.14');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const loaded = await appDataClient.vehicleIntelligence();
      setData(loaded); setRateDraft(String(loaded.preferences.electricityRatePerKwh));
    } catch (error) {
      Alert.alert('Vehicle data is not available yet', error instanceof Error ? error.message : 'Pull down to try again. Your saved local data was not changed.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (visible) void load(); }, [load, visible]);

  const savePreferences = useCallback(async (preferences: VehicleIntelligencePreferences) => {
    if (!data) return;
    const optimistic = { ...data, preferences };
    setData(optimistic);
    const saved = await appDataClient.saveVehicleIntelligencePreferences(preferences);
    setData(saved);
  }, [data]);

  const saveRate = useCallback(() => {
    if (!data) return;
    const rate = Number(rateDraft);
    if (!Number.isFinite(rate) || rate < 0.01 || rate > 5) {
      Alert.alert('Check the electricity rate', 'Enter a price between $0.01 and $5.00 per kWh.'); return;
    }
    void savePreferences({ ...data.preferences, electricityRatePerKwh: Math.round(rate * 10_000) / 10_000 });
  }, [data, rateDraft, savePreferences]);

  const toggleFavoriteChargingLocation = useCallback((locationKey: string) => {
    if (!data) return;
    const current = new Set(data.preferences.favoriteChargingLocationKeys);
    current.has(locationKey) ? current.delete(locationKey) : current.add(locationKey);
    void savePreferences({ ...data.preferences, favoriteChargingLocationKeys: [...current] });
  }, [data, savePreferences]);

  const updatePlace = useCallback((place: SavedPlaceIntelligence, update: Partial<{ name: string; category: SavedPlaceCategory }>) => {
    if (!data) return;
    const existing = data.preferences.placeOverrides.find(item => item.placeId === place.id);
    const replacement = { placeId: place.id, name: update.name?.trim() || existing?.name || place.name, category: update.category || existing?.category || place.category };
    const placeOverrides = [...data.preferences.placeOverrides.filter(item => item.placeId !== place.id), replacement];
    void savePreferences({ ...data.preferences, placeOverrides });
  }, [data, savePreferences]);

  const renamePlace = useCallback((place: SavedPlaceIntelligence) => {
    Alert.prompt('Name this place', 'This name stays in your private JourneyDeck data.', value => {
      const name = value?.trim(); if (name) updatePlace(place, { name });
    }, 'plain-text', place.name);
  }, [updatePlace]);

  const mergeDuplicate = useCallback((sourcePlaceId: string, targetPlaceId: string) => {
    if (!data) return;
    const source = data.places.find(place => place.id === sourcePlaceId), target = data.places.find(place => place.id === targetPlaceId);
    if (!source || !target) return;
    Alert.alert('Merge saved places?', `${source.name} will be combined into ${target.name}. Journey history is preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Merge', onPress: () => void savePreferences({
        ...data.preferences,
        placeOverrides: data.preferences.placeOverrides.some(item => item.placeId === target.id) ? data.preferences.placeOverrides : [...data.preferences.placeOverrides, { placeId: target.id, name: target.name, category: target.category }],
        placeMerges: [...data.preferences.placeMerges.filter(item => item.sourcePlaceId !== source.id), { sourcePlaceId: source.id, targetPlaceId: target.id }],
      }) },
    ]);
  }, [data, savePreferences]);

  const duplicates = useMemo(() => data?.duplicateCandidates.map(candidate => ({
    ...candidate,
    source: data.places.find(place => place.id === candidate.sourcePlaceId),
    target: data.places.find(place => place.id === candidate.targetPlaceId),
  })).filter(candidate => candidate.source && candidate.target) ?? [], [data]);

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View><Text style={styles.kicker}>VEHICLE + PLACE INTELLIGENCE</Text><Text style={styles.title}>Drive intelligence</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close vehicle intelligence" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <View style={styles.tabs}>{tabs.map(item => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'efficiency' ? 'Routes' : item[0]!.toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
      {loading && !data ? <View style={styles.center}><ActivityIndicator color="#ff7547" size="large" /><Text style={styles.muted}>Building your private on-device view…</Text></View> :
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#ff7547" />}>
          {!data ? <Empty title="No vehicle data yet" copy="Complete a journey or connect Tessie, then pull down to refresh." /> : <>
            {tab === 'overview' && <>
              <View style={styles.hero}>
                <Text style={styles.heroKicker}>LAST 30 DAYS</Text><Text style={styles.heroTitle}>{data.chargingSummary30Days.sessions ? `${number(data.chargingSummary30Days.energyAddedKwh)} kWh added` : 'Ready for your next charge'}</Text>
                <View style={styles.metricGrid}>
                  <Metric label="SESSIONS" value={String(data.chargingSummary30Days.sessions)} />
                  <Metric label="BATTERY GAIN" value={`${number(data.chargingSummary30Days.batteryGainedPercent, 0)}%`} />
                  <Metric label="CHARGE TIME" value={duration(data.chargingSummary30Days.durationMinutes)} />
                  <Metric label="COST" value={money(data.chargingSummary30Days.cost)} />
                </View>
              </View>
              <Section title="Favorite charging locations" detail={`${data.chargingLocations.filter(item => item.isFavorite).length} saved`} />
              {data.chargingLocations.filter(item => item.isFavorite).slice(0, 4).map(location => <ChargingLocation key={location.locationKey} location={location} onToggle={() => toggleFavoriteChargingLocation(location.locationKey)} />)}
              {!data.chargingLocations.some(item => item.isFavorite) && <Empty title="No favorite chargers yet" copy="Star a charging location to keep it close at hand." />}
              <Section title="Saved places" detail={`${data.places.length} places`} />
              {data.places.slice(0, 4).map(place => <PlaceCompact key={place.id} place={place} onOpen={() => { setTab('places'); setExpandedPlace(place.id); }} />)}
            </>}
            {tab === 'charging' && <>
              <Section title="Charging history" detail={`${data.chargingSessions.length} sessions`} />
              <View style={styles.rateCard}>
                <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Home electricity rate</Text><Text style={styles.cardCopy}>Used only when Tessie did not record a session cost.</Text></View>
                <View style={styles.rateRow}><Text style={styles.ratePrefix}>$</Text><TextInput accessibilityLabel="Electricity rate per kilowatt hour" value={rateDraft} onChangeText={setRateDraft} keyboardType="decimal-pad" selectTextOnFocus style={styles.rateInput} /><Text style={styles.rateSuffix}>/kWh</Text></View>
                <Pressable onPress={saveRate} style={styles.smallAction}><Text style={styles.smallActionText}>Save rate</Text></Pressable>
              </View>
              <Section title="Charging locations" detail="Tap the star to favorite" />
              {data.chargingLocations.map(location => <ChargingLocation key={location.locationKey} location={location} onToggle={() => toggleFavoriteChargingLocation(location.locationKey)} />)}
              <Section title="Sessions" detail="Newest first" />
              {data.chargingSessions.map(session => <View key={session.id} style={styles.card}>
                <View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{session.location}</Text><Text style={styles.cardCopy}>{day(session.startedAt)} · {duration(session.durationMinutes)}{session.isSupercharger ? ' · Supercharger' : ''}</Text></View><Text style={styles.cost}>{money(session.cost)}</Text></View>
                <View style={styles.inlineMetrics}><Text style={styles.inlineMetric}>{number(session.energyAddedKwh)} kWh added</Text><Text style={styles.inlineMetric}>{session.batteryGainedPercent == null ? 'Battery —' : `+${number(session.batteryGainedPercent, 0)}% battery`}</Text><Text style={styles.inlineMetric}>{session.costSource === 'recorded' ? 'Recorded cost' : 'Estimated cost'}</Text></View>
              </View>)}
              {!data.chargingSessions.length && <Empty title="No charging history yet" copy="Charging sessions imported from your connected vehicle will appear here and stay cached on this iPhone." />}
            </>}
            {tab === 'places' && <>
              <Section title="Saved places" detail={`${data.places.length} private places`} />
              <Text style={styles.privacy}>Place intelligence is calculated from your own journey endpoints. Cached Foursquare names are suggestions only.</Text>
              {duplicates.length > 0 && <View style={styles.duplicateBox}><Text style={styles.duplicateTitle}>Possible duplicates</Text>{duplicates.slice(0, 5).map(candidate => <View key={`${candidate.sourcePlaceId}:${candidate.targetPlaceId}`} style={styles.duplicateRow}><Text style={styles.duplicateCopy}>{candidate.source!.name} + {candidate.target!.name}{'\n'}<Text style={styles.mutedSmall}>{candidate.reason}</Text></Text><Pressable onPress={() => mergeDuplicate(candidate.sourcePlaceId, candidate.targetPlaceId)} style={styles.mergeButton}><Text style={styles.mergeText}>Merge</Text></Pressable></View>)}</View>}
              {data.places.map(place => <PlaceCard key={place.id} place={place} expanded={expandedPlace === place.id} onToggle={() => setExpandedPlace(expandedPlace === place.id ? null : place.id)} onRename={() => renamePlace(place)} onCategory={category => updatePlace(place, { category })} onSuggestion={() => place.foursquareSuggestion && updatePlace(place, { name: place.foursquareSuggestion.name })} />)}
              {!data.places.length && <Empty title="No saved places yet" copy="JourneyDeck will identify recurring starts and destinations as your history grows." />}
            </>}
            {tab === 'efficiency' && <>
              <Section title="Route efficiency" detail={`${data.routeComparisons.length} routes`} />
              <Text style={styles.privacy}>Energy and cost comparisons use journeys with both mileage and vehicle energy data, then stay cached locally on this iPhone.</Text>
              {data.routeComparisons.map((route, index) => <View key={`${route.startPlaceId}:${route.endPlaceId}`} style={styles.routeCard}>
                <Text style={styles.routeIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{route.startLabel} → {route.endLabel}</Text><Text style={styles.cardCopy}>{route.trips} {route.trips === 1 ? 'journey' : 'journeys'} · {number(route.miles)} mi · {number(route.energyKwh, 2)} kWh</Text><View style={styles.efficiencyBar}><View style={[styles.efficiencyFill, { width: `${Math.max(12, Math.min(100, 100 - (route.averageWhPerMile - route.bestWhPerMile) / Math.max(1, route.worstWhPerMile - route.bestWhPerMile) * 70))}%` }]} /></View><Text style={styles.inlineMetric}>{route.averageWhPerMile} Wh/mi average · best {route.bestWhPerMile} · {money(route.cost)}</Text></View>
              </View>)}
              {!data.routeComparisons.length && <Empty title="Efficiency is still learning" copy="Routes appear after journeys include both distance and energy-use data." />}
            </>}
          </>}
        </ScrollView>}
    </SafeAreaView>
  </Modal>;
}

function Section({ title, detail }: { title: string; detail: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionDetail}>{detail}</Text></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Empty({ title, copy }: { title: string; copy: string }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.cardCopy}>{copy}</Text></View>; }
function ChargingLocation({ location, onToggle }: { location: VehicleIntelligenceData['chargingLocations'][number]; onToggle: () => void }) { return <View style={styles.card}><View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{location.name}</Text><Text style={styles.cardCopy}>{location.sessions} sessions · {number(location.energyAddedKwh)} kWh · {money(location.cost)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={location.isFavorite ? 'Remove charging favorite' : 'Favorite charging location'} onPress={onToggle} style={[styles.star, location.isFavorite && styles.starActive]}><Text style={[styles.starText, location.isFavorite && styles.starTextActive]}>★</Text></Pressable></View></View>; }
function PlaceCompact({ place, onOpen }: { place: SavedPlaceIntelligence; onOpen: () => void }) { return <Pressable onPress={onOpen} style={styles.card}><View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{place.name}</Text><Text style={styles.cardCopy}>{place.category} · {place.visitCount} visits · last seen {day(place.lastSeenAt)}</Text></View><Text style={styles.chevron}>›</Text></View></Pressable>; }
function PlaceCard({ place, expanded, onToggle, onRename, onCategory, onSuggestion }: { place: SavedPlaceIntelligence; expanded: boolean; onToggle: () => void; onRename: () => void; onCategory: (category: SavedPlaceCategory) => void; onSuggestion: () => void }) {
  return <View style={styles.card}><Pressable onPress={onToggle} style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{place.name}</Text><Text style={styles.cardCopy}>{place.visitCount} visits · {place.arrivals} arrivals · {place.departures} departures</Text></View><Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text></Pressable>
    <View style={styles.categoryRow}>{categories.map(category => <Pressable key={category} onPress={() => onCategory(category)} style={[styles.category, place.category === category && styles.categoryActive]}><Text style={[styles.categoryText, place.category === category && styles.categoryTextActive]}>{category}</Text></Pressable>)}</View>
    {expanded && <View style={styles.details}>
      <Pressable onPress={onRename} style={styles.outlineAction}><Text style={styles.outlineText}>Rename place</Text></Pressable>
      {place.foursquareSuggestion && <View style={styles.suggestion}><View style={{ flex: 1 }}><Text style={styles.suggestionKicker}>FOURSQUARE SUGGESTION</Text><Text style={styles.cardTitle}>{place.foursquareSuggestion.name}</Text><Text style={styles.cardCopy}>{[place.foursquareSuggestion.category, place.foursquareSuggestion.address].filter(Boolean).join(' · ')}</Text></View><Pressable onPress={onSuggestion} style={styles.mergeButton}><Text style={styles.mergeText}>Use name</Text></Pressable></View>}
      <Text style={styles.detailLabel}>TIME OF DAY</Text><View style={styles.inlineMetrics}>{place.timeOfDay.map(item => <Text key={item.label} style={styles.inlineMetric}>{item.label} {item.visits}</Text>)}</View>
      <Text style={styles.detailLabel}>PLACE SOUNDTRACK</Text>{place.soundtrack.slice(0, 3).map(song => <Text key={`${song.track}:${song.artist}`} style={styles.detailLine}>{song.track} · {song.artist} <Text style={styles.mutedSmall}>×{song.plays}</Text></Text>)}{!place.soundtrack.length && <Text style={styles.cardCopy}>No songs linked yet.</Text>}
      <Text style={styles.detailLabel}>RELATED JOURNEYS</Text>{place.relatedJourneys.slice(0, 4).map(journey => <Text key={journey.id} style={styles.detailLine}>{day(journey.startedAt)} · {journey.startingLocation} → {journey.endingLocation} <Text style={styles.mutedSmall}>· {number(journey.miles)} mi</Text></Text>)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07060b' }, header: { minHeight: 82, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#35213d', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, kicker: { color: '#ff835d', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 }, title: { color: '#fff8ff', fontSize: 28, fontWeight: '900', letterSpacing: -0.7, marginTop: 4 }, close: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#5b3568', backgroundColor: '#1b1021', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#f7eefe', fontSize: 30, lineHeight: 33, fontWeight: '300' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 5, backgroundColor: '#0c0910' }, tab: { flex: 1, minHeight: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: '#2c1336', borderWidth: 1, borderColor: '#78418b' }, tabText: { color: '#877d8d', fontSize: 10, fontWeight: '800' }, tabTextActive: { color: '#ff9b73' }, scroll: { flex: 1 }, content: { padding: 16, paddingBottom: 50, gap: 10 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, muted: { color: '#887f8e', fontSize: 12 }, mutedSmall: { color: '#857b8b', fontSize: 10 },
  hero: { borderRadius: 24, padding: 18, backgroundColor: '#170b1d', borderWidth: 1, borderColor: '#713552', shadowColor: '#ff5635', shadowOpacity: 0.18, shadowRadius: 18 }, heroKicker: { color: '#bd8aff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, heroTitle: { color: '#fff7fb', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 6 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }, metric: { width: '48%', minHeight: 64, borderRadius: 15, padding: 11, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: '#322338' }, metricValue: { color: '#fff', fontSize: 18, fontWeight: '900' }, metricLabel: { color: '#977e9c', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 4 },
  section: { marginTop: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, sectionTitle: { color: '#f7effa', fontSize: 19, fontWeight: '900' }, sectionDetail: { color: '#8d7c93', fontSize: 10, fontWeight: '700' }, card: { borderRadius: 18, padding: 14, backgroundColor: '#110e15', borderWidth: 1, borderColor: '#2d2633' }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitle: { color: '#f7f1f9', fontSize: 14, fontWeight: '800' }, cardCopy: { color: '#948b9b', fontSize: 11, lineHeight: 16, marginTop: 4 }, cost: { color: '#ff8b60', fontSize: 17, fontWeight: '900' }, chevron: { color: '#bb8bc8', fontSize: 24 }, inlineMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, inlineMetric: { color: '#b8aebd', fontSize: 10, fontWeight: '700', backgroundColor: '#19141d', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  star: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#3d3343', alignItems: 'center', justifyContent: 'center' }, starActive: { backgroundColor: '#3a2030', borderColor: '#ff815a' }, starText: { color: '#655d69', fontSize: 18 }, starTextActive: { color: '#ff9b64' }, rateCard: { borderRadius: 18, padding: 14, backgroundColor: '#160e19', borderWidth: 1, borderColor: '#483150', gap: 10 }, rateRow: { flexDirection: 'row', alignItems: 'center' }, ratePrefix: { color: '#ff9a71', fontSize: 18, fontWeight: '900' }, rateInput: { color: '#fff', fontSize: 24, fontWeight: '900', minWidth: 82, paddingHorizontal: 5, paddingVertical: 5 }, rateSuffix: { color: '#968a9c', fontSize: 12 }, smallAction: { alignSelf: 'flex-start', borderRadius: 12, backgroundColor: '#ff6c3d', paddingHorizontal: 14, paddingVertical: 9 }, smallActionText: { color: '#180a08', fontSize: 11, fontWeight: '900' },
  empty: { borderRadius: 18, padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#332a38', backgroundColor: '#0d0b10' }, emptyTitle: { color: '#d9cedd', fontSize: 14, fontWeight: '800' }, privacy: { color: '#8f8394', fontSize: 11, lineHeight: 17, marginBottom: 4 }, duplicateBox: { borderRadius: 18, backgroundColor: '#1b101b', borderWidth: 1, borderColor: '#68314c', padding: 13, gap: 9 }, duplicateTitle: { color: '#ff9672', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }, duplicateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3e293a' }, duplicateCopy: { flex: 1, color: '#e8dfe9', fontSize: 11, lineHeight: 16 }, mergeButton: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#4c215b' }, mergeText: { color: '#e5c5ee', fontSize: 10, fontWeight: '900' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }, category: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#18141b', borderWidth: 1, borderColor: '#332b37' }, categoryActive: { backgroundColor: '#392042', borderColor: '#995eb0' }, categoryText: { color: '#817786', fontSize: 9, fontWeight: '800', textTransform: 'capitalize' }, categoryTextActive: { color: '#f1c8ff' }, details: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3a303e', gap: 8 }, outlineAction: { alignSelf: 'flex-start', borderRadius: 11, borderWidth: 1, borderColor: '#674272', paddingHorizontal: 12, paddingVertical: 8 }, outlineText: { color: '#cf9edd', fontSize: 10, fontWeight: '900' }, suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 11, backgroundColor: '#15101b' }, suggestionKicker: { color: '#a97fc1', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, detailLabel: { color: '#ff8e68', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 6 }, detailLine: { color: '#d3c9d6', fontSize: 11, lineHeight: 17 },
  routeCard: { flexDirection: 'row', gap: 12, borderRadius: 18, padding: 14, backgroundColor: '#110e15', borderWidth: 1, borderColor: '#302537' }, routeIndex: { color: '#8e559d', fontSize: 11, fontWeight: '900' }, efficiencyBar: { height: 5, borderRadius: 3, backgroundColor: '#28202d', marginTop: 11, overflow: 'hidden' }, efficiencyFill: { height: 5, borderRadius: 3, backgroundColor: '#ff7447' },
});
