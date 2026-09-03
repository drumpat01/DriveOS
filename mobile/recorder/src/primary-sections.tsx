import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, InteractionManager, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { HeaderArtwork, HeaderEdgeBleed, HeaderEdgeFeather, HEADER_ARTWORK_ASPECT_RATIO } from './header-artwork';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import type { AppDashboard, JourneySummary, ProviderPreferences, SavedPlaceIntelligence } from './app-data';
import { getLiveRecorderSnapshot, recorderDatabaseIntegrityReport, type LiveRecorderSnapshot } from './storage';
import {
  saveAtlasPatternReview, searchPrimarySections, type AtlasPattern, type PrimarySectionsData,
  type SearchRecord, type StatisticsData, type TimelineDay, type TimelineItem,
} from './primary-sections-data';
import { PrimaryMobilityMap } from './primary-mobility-map';
import {
  getNetworkActivitySnapshot, resetNetworkActivity, setJourneyDeckRequestsBlocked, subscribeNetworkActivity,
  type NetworkActivityEvent,
} from './network-activity';
import { getCurrentUser, isIsolationTestProfile } from './auth';
import { localDatabaseIntegrityReport, localStoreDiagnostics, previewLocalRetention, type LocalUser } from './local-store';
import type { LocalRetentionPreview, RetentionCount } from './retention-preview';
import { isInternalTestingBuild } from './internal-testing';
import { NeonWidget, NeonWidgetOutline, QuietInset } from './neon-widget-outline';
import { loadRecordingModePreferences } from './recording-mode';
import { syncTessieDirect, tessieDirectStatus, type TessieVehicleSnapshot } from './tessie-direct';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';
import { forceRefreshAllAppleMusicArtworkForDiagnostics } from './music-capture';
import { buildSongRouteMoments } from './route-moments';

export type PrimaryDataState = { status: 'loading' | 'ready' | 'error'; data: PrimarySectionsData | null; message?: string };
export type MoreDestination = 'menu' | 'health' | 'settings';

const accentForKind: Record<SearchRecord['kind'], string> = {
  journey: '#ff6d55', song: '#b86cff', artist: '#ff5e91', place: '#67d6bd', memory: '#8ba6ff',
};

function ScreenScaffold({ eyebrow, title, subtitle, headerImage, onRefresh, leadingAction, headerPresentation = 'default', pageTone = 'default', headerTone = 'default', children }: {
  eyebrow: string; title: string; subtitle: string; headerImage?: number; onRefresh: () => void | Promise<void>; leadingAction?: { label: string; onPress: () => void };
  headerPresentation?: 'default' | 'centered'; pageTone?: 'default' | 'black'; headerTone?: 'default' | 'live' | 'atlas' | 'statistics'; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const refreshFromGesture = async () => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setManualRefreshing(false);
    }
  };
  const headerSpill = headerTone === 'live'
    ? ['rgba(13,43,72,0.34)', 'rgba(77,17,55,0.18)', 'rgba(3,1,5,0)'] as const
    : headerTone === 'atlas'
      ? ['rgba(62,14,65,0.3)', 'rgba(18,32,65,0.17)', 'rgba(3,1,5,0)'] as const
      : headerTone === 'statistics'
        ? ['rgba(55,13,57,0.27)', 'rgba(11,27,54,0.18)', 'rgba(3,1,5,0)'] as const
        : ['rgba(79,14,91,0.22)', 'rgba(28,8,35,0.12)', 'rgba(3,1,5,0)'] as const;
  return <View style={styles.screen}>
    <LinearGradient colors={pageTone === 'black' ? ['#060309', '#030106', '#020104'] : ['#19051f', '#07020a', '#020104']} locations={[0, 0.34, 1]} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={headerSpill} locations={[0, 0.54, 1]} style={styles.headerSpill} />
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 17 }]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={() => void refreshFromGesture()} tintColor="#b889ff" />}
    >
      {leadingAction && <Pressable accessibilityRole="button" accessibilityLabel={leadingAction.label} onPress={leadingAction.onPress} style={styles.utilityBack}><Text style={styles.utilityBackText}>‹  {leadingAction.label}</Text></Pressable>}
      {headerImage
        ? <>{headerPresentation === 'centered' && <Text style={styles.statsPageTitle}>{title}</Text>}<View style={styles.artHeader}><HeaderArtwork source={headerImage} /></View></>
        : headerPresentation === 'centered'
          ? <Text style={styles.statsPageTitle}>{title}</Text>
          : <><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></>}
      {children}
    </ScrollView>
  </View>;
}

function DataNotice({ state }: { state: PrimaryDataState }) {
  if (state.status === 'loading' && !state.data) return <View style={styles.loadingCard}><NeonWidgetOutline radius={18} /><ActivityIndicator color="#b989ff" /><Text style={styles.noticeText}>Building this view from your JourneyDeck archive…</Text></View>;
  if (state.status === 'error') return <View style={styles.warningCard}><NeonWidgetOutline radius={18} /><Text style={styles.warningTitle}>USING SAVED DATA</Text><Text style={styles.noticeText}>{state.message || 'Some sources could not refresh. Existing local data remains available.'}</Text></View>;
  return null;
}

export function LiveScreen({ state, active, onRefresh, onRecord, onJourney }: {
  state: PrimaryDataState; active: boolean; onRefresh: () => void; onRecord: () => void; onJourney: (id: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<LiveRecorderSnapshot>(() => state.data?.live ?? getLiveRecorderSnapshot());
  const [tessieVehicle, setTessieVehicle] = useState<TessieVehicleSnapshot | null>(null);
  const [tessieConnected, setTessieConnected] = useState(false);
  const [tessieState, setTessieState] = useState<'idle' | 'loading' | 'unavailable' | 'error'>('idle');
  const data = state.data;
  const automaticMode = loadRecordingModePreferences().mode === 'automatic';
  const vehicleName = data?.dashboard.latestJourney?.vehicleName || data?.journeys.find(journey => journey.vehicleName)?.vehicleName || 'Your vehicle';
  useEffect(() => { if (state.data) setSnapshot(state.data.live); }, [state.data]);
  useEffect(() => {
    if (!active) return;
    const refresh = () => setSnapshot(getLiveRecorderSnapshot());
    refresh();
    const timer = setInterval(refresh, 4_000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    let cancelled = false;
    if (!active || !TESSIE_INTEGRATION_ENABLED) return;
    const loadTessie = async () => {
      const connection = await tessieDirectStatus().catch(() => 'not_connected' as const);
      if (connection !== 'connected') {
        if (!cancelled) { setTessieVehicle(null); setTessieConnected(false); setTessieState('unavailable'); }
        return;
      }
      if (!cancelled) { setTessieConnected(true); setTessieState('loading'); }
      try {
        const result = await syncTessieDirect();
        if (cancelled) return;
        setTessieVehicle(result.vehicles.find(vehicle => vehicle.name === vehicleName) ?? result.vehicles[0] ?? null);
        setTessieState(result.vehicles.length ? 'idle' : 'unavailable');
      } catch {
        if (!cancelled) { setTessieVehicle(null); setTessieState('error'); }
      }
    };
    void loadTessie();
    return () => { cancelled = true; };
  }, [active, vehicleName]);
  const lastPoint = snapshot.lastPoint;
  const speed = Math.max(0, (lastPoint?.speedMps ?? 0) * 2.23694);
  const driving = Boolean(snapshot.session && snapshot.session.status === 'recording' && speed >= 3);
  const latestDetail = data?.details.find(detail => detail.id === data.dashboard.latestJourney?.id) ?? data?.details[0];
  const parkedRoute = latestDetail?.route?.coordinates ?? [];
  const visibleRoute = snapshot.route.length > 1 ? snapshot.route.map(point => [point.longitude, point.latitude] as [number, number]) : parkedRoute;
  const visibleCoordinate = lastPoint ? [lastPoint.longitude, lastPoint.latitude] as [number, number] : parkedRoute.at(-1) ?? null;
  const visibleSoundtrack = snapshot.session ? snapshot.music : latestDetail?.soundtrack ?? [];
  const visibleSongMoments = buildSongRouteMoments(
    visibleSoundtrack,
    visibleRoute,
    snapshot.session?.startedAt ?? latestDetail?.startedAt ?? new Date().toISOString(),
    snapshot.session?.endedAt ?? latestDetail?.endedAt ?? new Date().toISOString(),
  );
  const battery = tessieVehicle?.batteryPercent ?? latestDetail?.endingBatteryPercent;
  const range = tessieVehicle?.rangeMiles ?? null;
  const vehicleNote = tessieVehicle
    ? `Tessie ${tessieVehicle.status || 'vehicle'} · updated ${relativeTime(tessieVehicle.updatedAt ?? undefined)}`
    : tessieState === 'loading' ? 'Refreshing Tessie live vehicle data…'
      : tessieState === 'error' ? 'Tessie could not refresh right now. Your iPhone recorder is unaffected.'
        : 'Tessie is connected. Vehicle data will appear after the next successful refresh.';
  const elapsedMinutes = snapshot.session ? Math.max(0, (Date.now() - Date.parse(snapshot.session.startedAt)) / 60_000) : 0;
  const miles = routeMiles(snapshot.route.map(point => [point.longitude, point.latitude]));
  const liveTrack = snapshot.music.at(-1) ?? data?.music.recentSelections[0];
  const liveKicker = driving ? 'DRIVING · IPHONE RECORDER' : snapshot.session ? `${snapshot.session.status.toUpperCase()} · IPHONE RECORDER` : automaticMode ? 'WATCHING · ON THIS IPHONE' : 'READY · ON THIS IPHONE';
  const liveTitle = driving ? 'Your journey is live' : snapshot.session ? 'Journey in progress' : automaticMode ? 'Ready for your next drive' : 'Your next journey starts here';
  const liveCopy = snapshot.session
    ? 'Your route and time are being captured privately. Apple Music is automatic; for any other source, open the recorder and tap Identify Song for each track.'
    : automaticMode
      ? 'JourneyDeck is ready to recognize driving. Apple Music builds soundtracks automatically after each journey.'
      : 'Start a journey to capture its route and time. Apple Music adds the automatic soundtrack.';
  return <ScreenScaffold eyebrow="NOW ON THE ROAD" title="LIVE" subtitle={automaticMode ? 'Tessie-powered automatic routes and Apple Music soundtracks, captured privately.' : 'Start and finish each route yourself. Apple Music builds the soundtrack while you record.'} headerImage={require('../assets/live-header-cinematic-v1.png')} headerPresentation="centered" pageTone="black" headerTone="live" onRefresh={onRefresh}>
    <DataNotice state={state} />
    {(snapshot.session || !automaticMode) && <View style={styles.liveHero}><NeonWidgetOutline radius={24} tone="hero" />
      <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.cardEyebrow}>{liveKicker}</Text><Text style={styles.heroTitle}>{liveTitle}</Text></View><View style={[styles.liveDot, snapshot.session && styles.liveDotActive]} /></View>
      <Text style={styles.liveStateCopy}>{liveCopy}</Text>
      {snapshot.session && <View style={styles.metricRow}>
        <Metric value={`${Math.round(speed)}`} unit="mph" label="SPEED" />
        <Metric value={miles.toFixed(1)} unit="mi" label="DISTANCE" />
        <Metric value={`${Math.round(elapsedMinutes)}`} unit="min" label="ELAPSED" />
      </View>}
      <Pressable onPress={onRecord} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{snapshot.session ? 'Open recorder' : 'Start a journey'}</Text></Pressable>
    </View>}
    <PrimaryMobilityMap
      routes={visibleRoute.length > 1 ? [{ id: snapshot.session?.id ?? latestDetail?.id ?? 'last-known', coordinates: visibleRoute }] : []}
      currentCoordinate={visibleCoordinate}
      currentHeading={lastPoint?.headingDegrees}
      height={310}
      cameraPitch={45}
      cameraPadding={58}
      minimumBoundsSpan={0.055}
      emptyMessage={automaticMode ? 'Your route will appear when JourneyDeck detects your next drive.' : 'Start recording to see your route and current location here.'}
      songMoments={visibleSongMoments}
    />
    {TESSIE_INTEGRATION_ENABLED && tessieConnected && <>
      <SectionTitle title="Connected vehicle" detail="Optional Tessie enhancement" />
      <View style={styles.tessieCard}><NeonWidgetOutline radius={20} />
        <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.cardEyebrow}>TESSIE VEHICLE</Text><Text style={styles.itemTitle}>{tessieVehicle?.name || vehicleName}</Text></View><Text style={styles.tessieStatus}>{tessieVehicle?.chargingState || tessieVehicle?.status || 'CONNECTED'}</Text></View>
        <View style={styles.metricRow}>
          <Metric value={battery === null || battery === undefined ? '—' : `${Math.round(battery)}%`} label="BATTERY" />
          <Metric value={range === null || range === undefined ? '—' : `${Math.round(range)}`} unit={range === null || range === undefined ? undefined : 'mi'} label="RANGE" />
        </View>
        <Text style={styles.honestNote}>{vehicleNote}</Text>
      </View>
    </>}
    <SectionTitle title="Live soundtrack" detail={snapshot.music.length ? `${snapshot.music.length} captured` : 'Apple Music automatic · Shazam manual'} />
    {liveTrack ? <Pressable style={styles.trackCard} onPress={() => data?.dashboard.latestJourney && onJourney(data.dashboard.latestJourney.id)}><NeonWidgetOutline radius={18} />
      {liveTrack.artworkUrl ? <Image source={{ uri: liveTrack.artworkUrl }} style={styles.artwork} cachePolicy="memory-disk" contentFit="cover" /> : <View style={[styles.artwork, styles.artworkBlank]}><Text style={styles.artworkNote}>♪</Text></View>}
      <View style={styles.flex}><Text style={styles.itemTitle} numberOfLines={1}>{liveTrack.track}</Text><Text style={styles.itemDetail} numberOfLines={1}>{liveTrack.artist}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable> : <EmptyCard text="Apple Music appears automatically. For radio, Spotify, CDs, or another phone, open the recorder and tap Identify Song for each track." />}
    <View style={styles.healthStrip}><Text style={styles.healthStripTitle}>{snapshot.session ? snapshot.session.status.toUpperCase() : automaticMode ? 'WATCHING' : 'READY'}</Text><Text style={styles.healthStripText}>{snapshot.session ? `${snapshot.session.pointCount} GPS captured · ${snapshot.session.queuedCount} waiting safely` : automaticMode ? 'Automatic recording mode is selected.' : 'The on-device recorder is ready.'}</Text></View>
  </ScreenScaffold>;
}

export function AtlasScreen({ state, onRefresh, onJourney, onBack }: { state: PrimaryDataState; onRefresh: () => void; onJourney: (id: string) => void; onBack?: () => void }) {
  const data = state.data;
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, AtlasPattern['review']>>({});
  const places = useMemo(() => data?.vehicle.places ?? [], [data?.vehicle.places]);
  const selectedPlace = useMemo(() => places.find(place => place.id === selectedPlaceId) ?? places[0], [places, selectedPlaceId]);
  const routes = useMemo(() => (data?.details ?? []).filter(detail => detail.route?.coordinates.length).map(detail => ({ id: detail.id, coordinates: detail.route!.coordinates })), [data?.details]);
  const mapPlaces = useMemo(() => places.filter(place => place.latitude !== null && place.longitude !== null).map(place => ({ id: place.id, name: place.name, coordinate: [place.longitude!, place.latitude!] as [number, number], count: place.visitCount })), [places]);
  const patterns = useMemo(() => (data?.atlasPatterns ?? []).filter(pattern => (reviews[pattern.id] ?? pattern.review) !== 'dismissed'), [data?.atlasPatterns, reviews]);
  const reviewPattern = (id: string, review: 'confirmed' | 'dismissed') => { saveAtlasPatternReview(id, review); setReviews(current => ({ ...current, [id]: review })); };
  return <ScreenScaffold eyebrow="YOUR MOBILITY UNIVERSE" title="ATLAS" subtitle="Your complete journey map, favorite places, repeated routes, and travel patterns—all built from your private archive." headerImage={require('../assets/atlas-header-cinematic-v1.png')} headerPresentation="centered" pageTone="black" headerTone="atlas" onRefresh={onRefresh} leadingAction={onBack ? { label: 'Statistics', onPress: onBack } : undefined}>
    <DataNotice state={state} />
    <PrimaryMobilityMap routes={routes} places={mapPlaces} height={355} emptyMessage="Recorded route geometry will build your long-term Atlas." />
    <View style={styles.mapLegend}><Text style={styles.legendLine}>━  Recorded routes</Text><Text style={styles.legendPlace}>●  Frequently visited places</Text></View>
    <SectionTitle title="Frequent places" detail={`${places.length} discovered`} />
    {places.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
      {places.slice(0, 12).map(place => <Pressable key={place.id} onPress={() => setSelectedPlaceId(place.id)} style={[styles.placeChip, selectedPlace?.id === place.id && styles.placeChipActive]}>{selectedPlace?.id === place.id && <NeonWidgetOutline radius={19} tone="selected" />}
        <Text style={styles.placeCategory}>{place.category.toUpperCase()}</Text><Text style={styles.placeName} numberOfLines={1}>{place.name}</Text><Text style={styles.placeVisits}>{place.visitCount} visits</Text>
      </Pressable>)}
    </ScrollView> : <EmptyCard text="Places are discovered from journey starts and destinations." />}
    {selectedPlace && <PlaceDetails place={selectedPlace} onJourney={onJourney} />}
    <SectionTitle title="Recurring patterns" detail="Confirm what feels meaningful" />
    {patterns.length ? patterns.slice(0, 8).map(pattern => <View key={pattern.id} style={styles.patternCard}><NeonWidgetOutline radius={18} /><View style={styles.patternContent}>
      <Text style={styles.cardEyebrow}>{pattern.trips} REPEATED TRIPS</Text><Text style={styles.itemTitle}>{formatAtlasPatternRoute(pattern.startLabel, pattern.endLabel)}</Text>
      <Text style={styles.itemDetail}>{pattern.miles.toFixed(1)} mi total{pattern.averageWhPerMile > 0 ? ` · ${Math.round(pattern.averageWhPerMile)} Wh/mi average` : ' · energy appears when vehicle telemetry is available'}</Text>
      <View style={styles.inlineButtons}>
        <PatternAction symbol="✓" label="Confirm" active={(reviews[pattern.id] ?? pattern.review) === 'confirmed'} onPress={() => reviewPattern(pattern.id, 'confirmed')} />
        <PatternAction symbol="×" label="Dismiss" onPress={() => reviewPattern(pattern.id, 'dismissed')} />
      </View>
    </View></View>) : <EmptyCard text="Recurring routes will appear after JourneyDeck sees the same place-to-place pattern at least twice." />}
    <SectionTitle title="Representative routes" detail={`${routes.length} routes cached`} />
    {(data?.details ?? []).slice(0, 8).map(journey => <JourneyRow key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />)}
  </ScreenScaffold>;
}

function PlaceDetails({ place, onJourney }: { place: SavedPlaceIntelligence; onJourney: (id: string) => void }) {
  return <View style={styles.card}><NeonWidgetOutline radius={22} />
    <Text style={styles.cardEyebrow}>PLACE DETAILS · {place.category.toUpperCase()}</Text><Text style={styles.heroTitle}>{place.name}</Text>
    <Text style={styles.itemDetail}>{place.arrivals} arrivals · {place.departures} departures · last seen {new Date(place.lastSeenAt).toLocaleDateString()}</Text>
    {place.soundtrack[0] && <Text style={styles.placeSoundtrack}>♪ {place.soundtrack[0].track} · {place.soundtrack[0].artist}</Text>}
    <View style={styles.placeRouteThread}><LinearGradient pointerEvents="none" colors={['#ff7d62', '#b35cff', '#9d6cff'] as const} style={styles.routeThreadRail} />
      {place.relatedJourneys.slice(0, 3).map((journey, index) => <Pressable key={journey.id} onPress={() => onJourney(journey.id)} style={[styles.compactRow, index === 0 && styles.compactRowFirst]}>
        <View style={[styles.routeThreadNode, index === 0 && styles.routeThreadNodeStart]} /><Text style={styles.compactTitle} numberOfLines={1}>{journey.startingLocation} → {journey.endingLocation}</Text><Text style={styles.compactValue}>{journey.miles.toFixed(1)} mi</Text>
      </Pressable>)}
    </View>
  </View>;
}

function PatternAction({ symbol, label, active = false, onPress }: { symbol: string; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={styles.patternAction}><View style={[styles.patternActionIcon, active && styles.patternActionIconActive]}><Text style={[styles.patternActionSymbol, active && styles.patternActionSymbolActive]}>{symbol}</Text></View><Text style={[styles.patternActionText, active && styles.patternActionTextActive]}>{label}</Text></Pressable>;
}

export function TimelineScreen({ state, onRefresh, onJourney, onBack }: { state: PrimaryDataState; onRefresh: () => void; onJourney: (id: string) => void; onBack?: () => void }) {
  const days = state.data?.timeline ?? [];
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  useEffect(() => { if (!selectedKey && days[0]) setSelectedKey(days[0].key); }, [days, selectedKey]);
  const selected = days.find(day => day.key === selectedKey) ?? days[0];
  return <ScreenScaffold eyebrow="EVERY MOMENT IN ORDER" title="Timeline" subtitle="Journeys, songs, charging, vehicle readings, and real route maps in one daily chronology." headerImage={require('../assets/timeline-header-hero-v2.jpg')} onRefresh={onRefresh} leadingAction={onBack ? { label: 'Tools', onPress: onBack } : undefined}>
    <DataNotice state={state} />
    {days.length ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRail}>{days.slice(0, 30).map(day => <Pressable key={day.key} onPress={() => setSelectedKey(day.key)} style={[styles.dayChip, selected?.key === day.key && styles.dayChipActive]}><Text style={styles.dayNumber}>{new Date(`${day.key}T12:00:00`).getDate()}</Text><Text style={styles.dayLabel}>{new Date(`${day.key}T12:00:00`).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text></Pressable>)}</ScrollView>
      <Text style={styles.selectedDay}>{selected?.label}</Text>
      <PrimaryMobilityMap routes={selected?.routes ?? []} height={270} emptyMessage="This day has events but no route geometry cached yet." />
      <View style={styles.timelineList}>{selected?.items.map(item => <Pressable key={item.id} disabled={!item.journeyId} onPress={() => item.journeyId && onJourney(item.journeyId)} style={styles.timelineItem}>
        <View style={[styles.timelineIcon, { backgroundColor: timelineColor(item.kind) }]}><Text style={styles.timelineIconText}>{timelineGlyph(item.kind)}</Text></View>
        <View style={styles.flex}><Text style={styles.timelineTime}>{formatClock(item.occurredAt)} · {item.kind.toUpperCase()}</Text><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemDetail}>{item.detail}</Text></View>
        {item.journeyId && <Text style={styles.chevron}>›</Text>}
      </Pressable>)}</View>
    </> : <EmptyCard text="Your daily chronology will appear after the first completed journey or charging session." />}
  </ScreenScaffold>;
}

export function StatisticsScreen({ state, onRefresh, onJourney, onBack, onUpgrade, onAtlas, historyDays = 45 }: {
  state: PrimaryDataState; onRefresh: () => void; onJourney: (id: string) => void; onBack?: () => void; onUpgrade?: () => void; onAtlas?: () => void; historyDays?: number | null;
}) {
  const statistics = state.data?.statistics;
  const [visibleTimelineCount, setVisibleTimelineCount] = useState(10);
  const timelineItems = useMemo(() => {
    const cutoff = historyDays === null ? Number.NEGATIVE_INFINITY : Date.now() - historyDays * 86_400_000;
    return (state.data?.timeline ?? [])
      .flatMap(day => day.items)
      .filter(item => timelineEpoch(item.occurredAt) >= cutoff)
      .sort((a, b) => timelineEpoch(b.occurredAt) - timelineEpoch(a.occurredAt));
  }, [historyDays, state.data?.timeline]);
  useEffect(() => setVisibleTimelineCount(10), [historyDays, state.data?.loadedAt]);
  const visibleTimeline = timelineItems.slice(0, visibleTimelineCount);
  const hasMoreTimeline = visibleTimelineCount < timelineItems.length;
  const longestRoute = statistics?.story.longestDrive
    ? timelineItems.find(item => item.kind === 'journey' && item.journeyId === statistics.story.longestDrive?.journeyId)?.route
    : undefined;
  const earliestVisibleEpoch = timelineItems.length ? Math.min(...timelineItems.map(item => timelineEpoch(item.occurredAt)).filter(Boolean)) : Date.now();
  const historyDay = statistics ? Math.min(statistics.windowDays, Math.max(1, Math.floor((Date.now() - earliestVisibleEpoch) / 86_400_000) + 1)) : 1;
  return <ScreenScaffold eyebrow="" title="STATISTICS" subtitle="" headerPresentation="centered" pageTone="black" headerTone="statistics" onRefresh={onRefresh} leadingAction={onBack ? { label: 'Tools', onPress: onBack } : undefined}>
    <DataNotice state={state} />
    {statistics ? <>
      <View style={styles.storyStatsHero}>
        <HeaderEdgeBleed />
        <Image source={require('../assets/statistics-story-hero-v1.png')} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(4,3,10,0.97)', 'rgba(8,4,15,0.74)', 'rgba(7,2,13,0.05)']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <HeaderEdgeFeather />
        <View style={styles.storyStatsHeroCopy}>
          <Text style={styles.storyStatsKicker}>THE ROAD YOU’VE LIVED</Text>
          <Text style={styles.storyStatsHeadline}>{statistics.current.miles.value.toFixed(1)} miles. {Math.round(statistics.current.songs.value)} songs.{`\n`}A month worth{`\n`}<Text style={styles.storyStatsHeroAccent}>remembering.</Text></Text>
        </View>
      </View>

      <View style={styles.storyStatsCards}>
        <Pressable disabled={!statistics.story.longestDrive} onPress={() => statistics.story.longestDrive && onJourney(statistics.story.longestDrive.journeyId)} style={styles.storyStatsFeatureCard}>
          <View style={styles.storyStatsInsightIcon}><TimelineRouteThumbnail coordinates={longestRoute ?? []} /></View>
          <View style={styles.flex}><Text style={styles.storyStatsInsightLabel}>Longest drive</Text><Text style={styles.storyStatsFeatureValue}>{statistics.story.longestDrive ? `${statistics.story.longestDrive.miles.toFixed(1)} mi` : '—'}</Text></View>
        </Pressable>
        <View style={styles.storyStatsFeatureCard}>
          <View style={[styles.storyStatsInsightIcon, styles.storyStatsInsightIconPurple]}><SymbolView name="music.note" tintColor="#c17aff" size={25} /></View>
          <View style={styles.flex}><Text style={styles.storyStatsInsightLabel}>Most-played</Text><Text style={styles.storyStatsFeatureValue} numberOfLines={2}>{statistics.story.topArtist?.artist ?? '—'}</Text></View>
        </View>
        <View style={styles.storyStatsFeatureCard}>
          <View style={[styles.storyStatsInsightIcon, styles.storyStatsInsightIconSun]}><SymbolView name="sun.horizon.fill" tintColor="#ff8065" size={25} /></View>
          <View style={styles.flex}><Text style={styles.storyStatsInsightLabel}>Favorite time</Text><Text style={[styles.storyStatsFeatureValue, styles.storyStatsFeatureValueCompact]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.78}>{statistics.story.favoriteTime?.label ?? 'Still forming'}</Text></View>
        </View>
      </View>

      <View style={styles.storyStatsRhythmCard}>
        <Text style={styles.storyStatsRhythmLabel}>{historyDays === null ? 'COMPLETE HISTORY' : `FREE HISTORY  ·  ${statistics.windowDays} DAYS`}</Text>
        <View style={styles.storyStatsHistoryRow}>
          <View style={styles.storyStatsRhythmBars}>{statistics.dailyMiles.map(day => <View key={day.date} style={[styles.storyStatsRhythmBar, (day.miles > 0 || day.songs > 0) && styles.storyStatsRhythmBarActive]} />)}</View>
          <Text style={styles.storyStatsHistoryDay}>{historyDays === null ? `${timelineItems.length} MOMENTS` : `DAY ${historyDay} OF ${statistics.windowDays}`}</Text>
        </View>
        {historyDays !== null && onUpgrade && <Pressable accessibilityRole="button" accessibilityLabel="Unlock Atlas and complete history" onPress={onUpgrade} style={styles.storyStatsUnlock}><Text style={styles.storyStatsUnlockText}>UNLOCK ATLAS + COMPLETE HISTORY</Text><Text style={styles.storyStatsUnlockArrow}>›</Text></Pressable>}
        {historyDays === null && onAtlas && <Pressable accessibilityRole="button" accessibilityLabel="Open Atlas" onPress={onAtlas} style={styles.storyStatsUnlock}><Text style={styles.storyStatsUnlockText}>OPEN YOUR ATLAS</Text><Text style={styles.storyStatsUnlockArrow}>›</Text></Pressable>}
      </View>

      <View style={styles.storyTimelineHeader}><Text style={styles.storyTimelineHeaderTitle}>RECENT TIMELINE</Text><Text style={styles.storyTimelineHeaderCount}>{Math.min(visibleTimelineCount, timelineItems.length)} MOMENTS</Text></View>
      {visibleTimeline.length ? <View style={styles.storyTimelineList}>{visibleTimeline.map((item, index) => <StoryTimelineRow key={item.id} item={item} onJourney={onJourney} first={index === 0} last={index === visibleTimeline.length - 1} />)}</View> : <EmptyCard text="Journeys and songs will collect here as your story unfolds." />}
      {hasMoreTimeline && <Pressable accessibilityRole="button" accessibilityLabel="Show 10 more timeline items" onPress={() => setVisibleTimelineCount(count => Math.min(count + 10, timelineItems.length))} style={styles.storyTimelineMore}><LinearGradient colors={['#ff6b57', '#f14f50']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.storyTimelineMoreFill}><Text style={styles.storyTimelineMoreText}>SHOW 10 MORE</Text></LinearGradient></Pressable>}
    </> : <EmptyCard text="Statistics will be calculated locally from your journey archive." />}
  </ScreenScaffold>;
}

function StoryTimelineRow({ item, onJourney, first, last }: { item: TimelineItem; onJourney: (id: string) => void; first: boolean; last: boolean }) {
  const song = item.kind === 'song';
  return <View style={styles.storyTimelineShell}>
    <View style={styles.storyTimelineRail}>
      {!first && <View style={[styles.storyTimelineConnector, styles.storyTimelineConnectorTop]} />}
      {!last && <View style={[styles.storyTimelineConnector, styles.storyTimelineConnectorBottom]} />}
      <View style={[styles.storyTimelineRailIcon, song && styles.storyTimelineRailIconSong]}><SymbolView name={song ? 'music.note' : item.kind === 'journey' ? 'mappin' : item.kind === 'charging' ? 'bolt.fill' : 'car.fill'} tintColor={song ? '#c17aff' : '#ff8069'} size={17} /></View>
    </View>
    <Pressable disabled={!item.journeyId} onPress={() => item.journeyId && onJourney(item.journeyId)} style={styles.storyTimelineCard}>
      {song && item.artworkUrl
        ? <Image source={{ uri: item.artworkUrl }} style={styles.storyTimelineArtwork} contentFit="cover" cachePolicy="memory-disk" />
        : item.kind === 'journey'
          ? <View style={styles.storyTimelineRoute}><TimelineRouteThumbnail coordinates={item.route ?? []} /></View>
          : <View style={[styles.storyTimelineArtwork, styles.artworkBlank]}><Text style={styles.artworkNote}>{timelineGlyph(item.kind)}</Text></View>}
      <View style={styles.storyTimelineCopy}><Text style={[styles.storyTimelineKind, song && styles.storyTimelineKindSong]}>{song ? 'Song' : item.kind === 'journey' ? 'Drive' : item.kind === 'charging' ? 'Charging' : 'Vehicle'}</Text><Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.itemDetail} numberOfLines={1}>{item.detail}</Text></View>
      <Text style={styles.storyTimelineClock}>{formatClock(item.occurredAt)}</Text>
    </Pressable>
  </View>;
}

function TimelineRouteThumbnail({ coordinates }: { coordinates: [number, number][] }) {
  const path = compactRoutePath(coordinates);
  return <Svg width="100%" height="100%" viewBox="0 0 92 58">
    <Defs><SvgGradient id="timelineRoute" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#ff8b54" /><Stop offset="0.55" stopColor="#ff5f70" /><Stop offset="1" stopColor="#a66dff" /></SvgGradient></Defs>
    {path ? <><Path d={path} fill="none" stroke="#ff5f63" strokeWidth={7} opacity={0.16} strokeLinecap="round" strokeLinejoin="round" /><Path d={path} fill="none" stroke="url(#timelineRoute)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></> : <Path d="M 18 45 C 29 38, 36 42, 44 31 S 65 21, 75 11" fill="none" stroke="#5b345f" strokeWidth={3} strokeLinecap="round" />}
  </Svg>;
}

function compactRoutePath(coordinates: [number, number][]) {
  const points = coordinates.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  if (points.length < 2) return '';
  const longitudes = points.map(point => point[0]), latitudes = points.map(point => point[1]);
  const minLongitude = Math.min(...longitudes), maxLongitude = Math.max(...longitudes), minLatitude = Math.min(...latitudes), maxLatitude = Math.max(...latitudes);
  const rangeLongitude = Math.max(maxLongitude - minLongitude, 0.000001), rangeLatitude = Math.max(maxLatitude - minLatitude, 0.000001);
  const scale = Math.min(80 / rangeLongitude, 46 / rangeLatitude);
  const usedWidth = rangeLongitude * scale, usedHeight = rangeLatitude * scale;
  const offsetX = (92 - usedWidth) / 2, offsetY = (58 - usedHeight) / 2;
  return points.map(([longitude, latitude], index) => `${index ? 'L' : 'M'} ${(offsetX + (longitude - minLongitude) * scale).toFixed(1)} ${(offsetY + (maxLatitude - latitude) * scale).toFixed(1)}`).join(' ');
}

function timelineEpoch(value: string) {
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : 0;
}

export function SearchScreen({ state, onRefresh, onJourney, onBack }: { state: PrimaryDataState; onRefresh: () => void; onJourney: (id: string) => void; onBack?: () => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchPrimarySections(state.data?.search ?? [], query), [query, state.data?.search]);
  return <ScreenScaffold eyebrow="FIND ANYTHING" title="Search" subtitle="Search Journeys, Memories, songs, artists, and places from one private index." onRefresh={onRefresh} leadingAction={onBack ? { label: 'Tools', onPress: onBack } : undefined}>
    <DataNotice state={state} />
    <View style={styles.searchBox}><SymbolView name="magnifyingglass" tintColor="#9b8ba4" size={20} /><TextInput value={query} onChangeText={setQuery} placeholder="Route, song, artist, place…" placeholderTextColor="#756d7c" autoCapitalize="none" autoCorrect={false} style={styles.searchInput} clearButtonMode="while-editing" /></View>
    <Text style={styles.resultCount}>{query.trim() ? `${results.length} RESULTS` : 'RECENT + FREQUENT'}</Text>
    {results.length ? results.map(record => <Pressable key={record.id} disabled={!record.journeyId} onPress={() => record.journeyId && onJourney(record.journeyId)} style={styles.searchResult}>
      {record.artworkUrl ? <Image source={{ uri: record.artworkUrl }} style={styles.searchArtwork} cachePolicy="memory-disk" contentFit="cover" /> : <View style={[styles.searchKind, { backgroundColor: accentForKind[record.kind] }]}><Text style={styles.searchKindText}>{kindGlyph(record.kind)}</Text></View>}
      <View style={styles.flex}><Text style={styles.searchType}>{record.kind.toUpperCase()}</Text><Text style={styles.itemTitle} numberOfLines={1}>{record.title}</Text><Text style={styles.itemDetail} numberOfLines={1}>{record.subtitle}</Text></View>{record.journeyId && <Text style={styles.chevron}>›</Text>}
    </Pressable>) : <EmptyCard text="No JourneyDeck items match that search yet." />}
  </ScreenScaffold>;
}

export function DataHealthScreen({ active, state, dashboard, privateCloud, appleIdentityStatus, providerCapabilities, currentUser, profiles, onRefresh, onCloudSync, onCreateProfileTest, onSwitchProfile, onBack }: {
  active: boolean;
  state: PrimaryDataState;
  dashboard: AppDashboard;
  privateCloud: { status: string; detail: string };
  appleIdentityStatus: string;
  providerCapabilities: { lastFmConfigured: boolean; tessieConfigured: boolean };
  currentUser: LocalUser;
  profiles: LocalUser[];
  onRefresh: () => void;
  onCloudSync: () => void;
  onCreateProfileTest: () => void;
  onSwitchProfile: (userId: string) => void;
  onBack?: () => void;
}) {
  const updates = Updates.useUpdates();
  const running = updates.currentlyRunning;
  const configuredRelease = Constants.expoConfig?.extra?.release as { label?: string; sequence?: string } | undefined;
  const launchKind = __DEV__ ? 'Live Metro' : running.isEmbeddedLaunch ? 'Embedded build' : 'Published OTA';
  const updateIdentity = running.updateId ? running.updateId.slice(0, 8) : (__DEV__ ? 'development' : 'embedded');
  const nativeVersion = Constants.expoConfig?.version ?? 'Unknown';
  const nativeBuild = Constants.platform?.ios?.buildNumber ?? 'Unknown';
  const runtime = running.runtimeVersion ?? Updates.runtimeVersion ?? 'Unknown';
  const channel = running.channel ?? Updates.channel;
  const releaseLabel = configuredRelease?.label ?? 'JourneyDeck release';
  const provider = dashboard.providerPreferences;
  const [network, setNetwork] = useState(() => getNetworkActivitySnapshot());
  const [retentionDays, setRetentionDays] = useState<7 | 30>(30);
  const [retentionRefresh, setRetentionRefresh] = useState(0);
  const [retentionPreview, setRetentionPreview] = useState<LocalRetentionPreview | null>(null);
  const [retentionPreviewState, setRetentionPreviewState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [artworkRefreshState, setArtworkRefreshState] = useState<'idle' | 'running' | 'complete' | 'warning' | 'error'>('idle');
  const [artworkRefreshDetail, setArtworkRefreshDetail] = useState('Re-check Apple Music and retry missing exact-match cover artwork on this iPhone.');
  const profileDiagnostics = useMemo(() => localStoreDiagnostics(currentUser.id), [currentUser.id, state.data?.loadedAt]);
  const masterIntegrity = useMemo(() => localDatabaseIntegrityReport(), [currentUser.id, state.data?.loadedAt]);
  const recorderIntegrity = useMemo(() => recorderDatabaseIntegrityReport(), [currentUser.id, state.data?.loadedAt]);
  const unifiedIntegrityIssueCount = masterIntegrity.foreignKeyViolationCount + masterIntegrity.ownershipViolationCount
    + masterIntegrity.invalidValueCount + recorderIntegrity.duplicateActiveOwnerCount + recorderIntegrity.invalidValueCount;
  const queued = dashboard.recorder.queuedPoints + dashboard.recorder.queuedMusic + recorderIntegrity.pendingCompletionJobCount;
  const testProfile = isIsolationTestProfile(currentUser);
  const profileIsClean = profileDiagnostics.journeyCount === 0 && profileDiagnostics.gpsPointCount === 0
    && profileDiagnostics.musicEntryCount === 0 && profileDiagnostics.memoryCount === 0
    && dashboard.recorder.queuedPoints === 0 && dashboard.recorder.queuedMusic === 0;
  useEffect(() => active ? subscribeNetworkActivity(setNetwork) : undefined, [active]);
  useEffect(() => {
    if (!active) return;
    setRetentionPreviewState('loading');
    const task = InteractionManager.runAfterInteractions(() => {
      try {
        setRetentionPreview(previewLocalRetention(getCurrentUser().id, { retentionDays }));
        setRetentionPreviewState('ready');
      } catch {
        setRetentionPreview(null);
        setRetentionPreviewState('error');
      }
    });
    return () => task.cancel();
  }, [active, retentionDays, retentionRefresh, state.data?.loadedAt]);
  const forceArtworkRefresh = async () => {
    if (artworkRefreshState === 'running') return;
    setArtworkRefreshState('running');
    setArtworkRefreshDetail('Checking Apple Music history and retrying missing covers…');
    try {
      const report = await forceRefreshAllAppleMusicArtworkForDiagnostics();
      const result = report.missingBefore === 0
        ? `No covers were missing. ${report.enriched} stored artwork ${report.enriched === 1 ? 'record was' : 'records were'} refreshed.`
        : `${report.enriched} artwork ${report.enriched === 1 ? 'record was' : 'records were'} updated. ${report.missingAfter} of ${report.missingBefore} missing ${report.missingBefore === 1 ? 'cover remains' : 'covers remain'}.`;
      const catalogRetry = report.failed ? ` ${report.failed} catalog ${report.failed === 1 ? 'request needs' : 'requests need'} another retry.` : '';
      setArtworkRefreshDetail(`${result}${catalogRetry}${report.historyWarning ? ` ${report.historyWarning}` : ''}`);
      setArtworkRefreshState(report.historyWarning || report.failed ? 'warning' : 'complete');
      onRefresh();
    } catch (error) {
      setArtworkRefreshDetail(error instanceof Error ? error.message : 'Apple Music artwork could not refresh yet.');
      setArtworkRefreshState('error');
    }
  };
  return <ScreenScaffold eyebrow="LOCAL-FIRST CONFIDENCE" title="Data Health" subtitle="A plain-language view of what is saved, fresh, queued, and safe to retry." onRefresh={onRefresh} leadingAction={onBack ? { label: 'Tools', onPress: onBack } : undefined}>
    <SectionTitle title="Version & update" detail="What is running now" />
    <View style={styles.releaseCard}><NeonWidgetOutline radius={24} />
      <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.releaseSequence}>{configuredRelease?.sequence ?? 'RELEASE'}</Text><Text style={styles.releaseLabel}>{releaseLabel}</Text></View><View style={styles.releaseKindBadge}><Text style={styles.releaseKindText}>{launchKind.toUpperCase()}</Text></View></View>
      <View style={styles.releaseGrid}>
        <ReleaseMetric label="APP" value={nativeVersion} detail={`native build ${nativeBuild}`} />
        <ReleaseMetric label="RUNTIME" value={runtime} detail={channel ? `${channel} channel` : 'no fixed channel'} />
        <ReleaseMetric label="UPDATE ID" value={updateIdentity} detail={running.updateId ? running.updateId : 'No published OTA UUID in Metro'} wide />
      </View>
      <Text style={styles.releaseDate}>{running.createdAt ? `Published ${formatReleaseDate(running.createdAt)}` : 'Loaded directly from the local development server'}</Text>
      {updates.isUpdatePending && <Text style={styles.releasePending}>A newer update is downloaded. Restart JourneyDeck to run it.</Text>}
      <Text style={styles.releaseHelp}>Use the release label and short Update ID when reporting what you are testing.</Text>
    </View>
    <View style={styles.healthHero}><NeonWidgetOutline radius={26} /><Text style={styles.healthHeroValue}>{queued === 0 && privateCloud.status !== 'error' && masterIntegrity.ok && recorderIntegrity.ok ? 'Healthy' : 'Needs a look'}</Text><Text style={styles.itemDetail}>{queued ? `${queued} local tasks are waiting to finish or sync. They remain safe on this iPhone.` : masterIntegrity.ok && recorderIntegrity.ok ? 'The unified on-device database passed structural and profile-isolation checks.' : 'The unified on-device database needs an integrity review.'}</Text></View>
    <HealthRow title="Unified JourneyDeck database" status={masterIntegrity.ok && recorderIntegrity.ok ? 'Verified' : 'Needs review'} detail={`Schema ${masterIntegrity.schemaVersion} · ${unifiedIntegrityIssueCount} integrity issues · ${recorderIntegrity.pendingCompletionJobCount} completion jobs waiting`} healthy={masterIntegrity.ok && recorderIntegrity.ok} />
    <HealthRow title="On-device recorder" status={dashboard.recorder.state === 'ready' ? 'Ready' : dashboard.recorder.state} detail={`${dashboard.recorder.capturedPoints} GPS captured · ${dashboard.recorder.queuedPoints} queued`} healthy />
    <HealthRow title="JourneyDeck connection" status={dashboard.recorder.connected ? 'Connected' : 'Offline'} detail={dashboard.recorder.connected ? `Archive refreshed ${relativeTime(state.data?.loadedAt)}` : 'Local recording and cached history still work.'} healthy={dashboard.recorder.connected} />
    <HealthRow title="Private iCloud" status={privateCloud.status.replace('_', ' ')} detail={privateCloud.detail} healthy={privateCloud.status === 'synced' || privateCloud.status === 'idle'} />
    <HealthRow title="Apple identity" status={appleIdentityStatus === 'authorized' ? 'Linked' : appleIdentityStatus} detail="Identity selects the local profile; iCloud sync uses the iPhone’s iCloud account." healthy={appleIdentityStatus === 'authorized'} />
    <SectionTitle title="Providers" detail="Connection freshness" />
    <ProviderHealth provider={provider} capabilities={providerCapabilities} />
    <SectionTitle title="Apple Music artwork" detail="Manual diagnostic" />
    <View style={styles.artworkRefreshCard}><NeonWidgetOutline radius={20} />
      <View style={styles.flex}><Text style={styles.cardEyebrow}>FORCE ARTWORK REFRESH</Text><Text style={styles.artworkRefreshTitle}>Retry missing album covers</Text><Text style={[styles.artworkRefreshDetail, artworkRefreshState === 'warning' && styles.artworkRefreshWarning, artworkRefreshState === 'error' && styles.artworkRefreshError]}>{artworkRefreshDetail}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Force Apple Music artwork refresh" disabled={artworkRefreshState === 'running'} onPress={() => void forceArtworkRefresh()} style={[styles.artworkRefreshButton, artworkRefreshState === 'running' && styles.artworkRefreshButtonDisabled]}><Text style={styles.artworkRefreshButtonText}>{artworkRefreshState === 'running' ? 'Refreshing…' : 'Refresh artwork now'}</Text></Pressable>
    </View>
    <SectionTitle title="Network boundary" detail="This app session" />
    <View style={styles.networkCard}><NeonWidgetOutline radius={22} />
      <View style={styles.networkGrid}>
        <NetworkMetric label="JOURNEYDECK" value={`${Math.max(0, network.journeyDeckOperations - network.blockedOperations)}`} detail="server requests sent" />
        <NetworkMetric label="PRIVATE ICLOUD" value={`${network.privateICloudOperations}`} detail="sync attempts" />
        <NetworkMetric label="PRIVATE EDGE" value={`${network.privacyEdgeOperations}`} detail="provider + city requests" />
        <NetworkMetric label="TRANSFERRED" value={formatBytes(network.uploadBytes + network.downloadBytes)} detail={`${formatBytes(network.uploadBytes)} up · ${formatBytes(network.downloadBytes)} down`} />
        <NetworkMetric label="BLOCKED" value={`${network.blockedOperations}`} detail="local-only test" />
      </View>
      <View style={styles.networkReasonRow}>
        <Text style={styles.networkReasonText}>Archive {network.byReason.archive_refresh ?? 0}</Text>
        <Text style={styles.networkReasonText}>Recorder {network.byReason.recorder_mirror ?? 0}</Text>
        <Text style={styles.networkReasonText}>Imports {network.byReason.external_import ?? 0}</Text>
        <Text style={styles.networkReasonText}>Cities {network.byReason.place_lookup ?? 0}</Text>
        <Text style={styles.networkReasonText}>Writes {(network.byReason.user_content ?? 0) + (network.byReason.preferences ?? 0)}</Text>
      </View>
      {network.recentEvents.length ? <View style={styles.networkEvents}>{network.recentEvents.slice(0, 6).map(event => <NetworkEventRow key={event.id} event={event} />)}</View>
        : <Text style={styles.networkEmpty}>No observed JourneyDeck, private edge, or private iCloud activity since these counters started.</Text>}
      <Text style={styles.networkNote}>Only privacy-safe categories, timing, status, and byte totals are retained in memory. Tokens, record contents, coordinates, URLs, and personal identifiers are never recorded. City labels use coordinates reduced on this iPhone to an approximately one-kilometer grid before transmission. Last.fm imports send only the public username and bounded journey time window. Direct Spotify tokens stay in this iPhone Keychain. When MusicKit omits a cover, JourneyDeck can send only its song title and artist directly to Apple's public catalog and cache an exact-match artwork URL on this iPhone. Native map tiles, normal MusicKit artwork, Shazam, and Expo updates bypass JourneyDeck and are not included in these byte totals.</Text>
    </View>
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: network.journeyDeckRequestsBlocked }}
      onPress={() => setJourneyDeckRequestsBlocked(!network.journeyDeckRequestsBlocked)}
      style={[styles.networkPolicyButton, network.journeyDeckRequestsBlocked && styles.networkPolicyButtonActive]}
    >
      <Text style={[styles.networkPolicyTitle, network.journeyDeckRequestsBlocked && styles.networkPolicyTitleActive]}>{network.journeyDeckRequestsBlocked ? 'Local-only test is ON' : 'Test without JourneyDeck server'}</Text>
      <Text style={styles.networkPolicyDetail}>{network.journeyDeckRequestsBlocked ? 'Server requests are blocked until restart or until you turn this off. Local fallbacks remain available.' : 'Temporarily block only JourneyDeck server requests. Private iCloud and external map/media services remain unchanged.'}</Text>
    </Pressable>
    <Pressable style={styles.networkReset} onPress={resetNetworkActivity}><Text style={styles.networkResetText}>Reset session counters</Text></Pressable>
    {isInternalTestingBuild() && <>
      <SectionTitle title="Profile Test Lab" detail="Internal · non-destructive" />
      <View style={styles.profileLabCard}><NeonWidgetOutline radius={22} />
      <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.profileLabEyebrow}>{testProfile ? 'TEST PROFILE ACTIVE' : 'CURRENT PROFILE'}</Text><Text style={styles.profileLabTitle}>{currentUser.displayName || 'Unnamed local profile'}</Text></View>{testProfile && <Text style={[styles.profileLabResult, profileIsClean && styles.profileLabResultGood]}>{profileIsClean ? 'CLEAN' : 'HAS DATA'}</Text>}</View>
      <Text style={styles.profileLabDetail}>{testProfile ? 'Private iCloud is paused for this synthetic profile so the empty-profile check cannot download existing records.' : 'Create a separate local profile to verify that journeys, recorder state, screen caches, and owner backup do not carry over.'}</Text>
      <View style={styles.profileLabGrid}>
        <ProfileLabMetric label="JOURNEYS" value={profileDiagnostics.journeyCount} />
        <ProfileLabMetric label="GPS POINTS" value={profileDiagnostics.gpsPointCount} />
        <ProfileLabMetric label="SONGS" value={profileDiagnostics.musicEntryCount} />
        <ProfileLabMetric label="MEMORIES" value={profileDiagnostics.memoryCount} />
        <ProfileLabMetric label="RECORDER QUEUE" value={dashboard.recorder.queuedPoints + dashboard.recorder.queuedMusic} />
      </View>
      {testProfile ? <>
        <Text style={styles.profileLabNote}>A clean result means all six values are zero. Browse Home, Live, Memories, Atlas, Search, and Settings before returning.</Text>
        {profiles.filter(profile => !isIsolationTestProfile(profile)).map(profile => <Pressable key={profile.id} style={styles.profileLabPrimary} onPress={() => onSwitchProfile(profile.id)}><Text style={styles.profileLabPrimaryText}>Return to {profile.displayName || 'original profile'}</Text></Pressable>)}
      </> : <>
        <Pressable style={styles.profileLabPrimary} onPress={onCreateProfileTest}><Text style={styles.profileLabPrimaryText}>Create clean test profile</Text></Pressable>
        <Text style={styles.profileLabNote}>This never deletes, merges, or edits your current data. The test profile remains separate until this temporary lab is removed.</Text>
      </>}
      </View>
    </>}
    <SectionTitle title="Retention preview" detail="Read-only · this iPhone" />
    <View style={styles.retentionCard}><NeonWidgetOutline radius={22} />
      <View style={styles.retentionChoiceRow}>
        {([30, 7] as const).map(days => <Pressable
          key={days}
          accessibilityRole="button"
          accessibilityState={{ selected: retentionDays === days }}
          onPress={() => setRetentionDays(days)}
          style={[styles.retentionChoice, retentionDays === days && styles.retentionChoiceActive]}
        ><Text style={[styles.retentionChoiceText, retentionDays === days && styles.retentionChoiceTextActive]}>Keep {days} days</Text></Pressable>)}
      </View>
      {retentionPreviewState === 'loading' ? <View style={styles.retentionLoading}><ActivityIndicator color="#bb79ef" /><Text style={styles.retentionNote}>Counting local rows without changing them…</Text></View>
        : retentionPreviewState === 'error' || !retentionPreview ? <View style={styles.warningCard}><Text style={styles.warningTitle}>PREVIEW UNAVAILABLE</Text><Text style={styles.noticeText}>JourneyDeck could not read the local counts. No data was changed.</Text></View>
          : <>
            <View style={styles.retentionHeader}><View style={styles.flex}><Text style={styles.retentionTitle}>{retentionDays}-day detailed history</Text><Text style={styles.retentionCutoff}>Items before {formatRetentionDate(retentionPreview.cutoffAt)} are evaluated</Text></View><Text style={styles.readOnlyBadge}>READ ONLY</Text></View>
            <View style={styles.retentionColumnLabels}><Text style={styles.retentionItemLabel}>ITEM</Text><View style={styles.retentionNumbers}><Text style={styles.retentionKeptLabel}>KEEP</Text><Text style={styles.retentionRemoveLabel}>REMOVE</Text></View></View>
            <RetentionRow label="Journeys" count={retentionPreview.counts.journeys} />
            <RetentionRow label="Route points" count={retentionPreview.counts.routePoints} />
            <RetentionRow label="Songs" count={retentionPreview.counts.songs} />
            <RetentionRow label="Memories" count={retentionPreview.counts.memories} />
            <Text style={styles.retentionSafeguards}>{formatCount(retentionPreview.safeguards.nativeJourneyDeckJourneys)} native recordings protected · {formatCount(retentionPreview.safeguards.memoryProtectedJourneys)} Memory-linked journeys protected</Text>
            <Text style={styles.retentionNote}>Only old Google Timeline journeys and old unmatched direct-Spotify plays qualify. Memories, native recordings, recent history, and Memory-linked journeys stay. These are exact counts for the active profile’s on-device master; private iCloud and the legacy JourneyDeck archive are unchanged and are not included in this card.</Text>
          </>}
      <Pressable style={styles.retentionRefresh} onPress={() => setRetentionRefresh(value => value + 1)}><Text style={styles.retentionRefreshText}>Recalculate preview</Text></Pressable>
    </View>
    <View style={styles.safeActions}><Pressable style={styles.primaryButton} onPress={onRefresh}><Text style={styles.primaryButtonText}>Refresh saved data</Text></Pressable><Pressable style={styles.secondaryButton} onPress={onCloudSync}><Text style={styles.secondaryButtonText}>Retry private iCloud sync</Text></Pressable></View>
    <Text style={styles.privacyNote}>Safe retries never erase local data. Exact routes can be backed up only to your private iCloud database; they never go to JourneyDeck’s server or privacy edge. Saved-place labels, Apple credentials, and local photo paths stay on this iPhone.</Text>
  </ScreenScaffold>;
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatReleaseDate(value: Date) {
  return value.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ReleaseMetric({ label, value, detail, wide = false }: { label: string; value: string; detail: string; wide?: boolean }) {
  return <View style={[styles.releaseMetric, wide && styles.releaseMetricWide]}><Text style={styles.releaseMetricLabel}>{label}</Text><Text style={styles.releaseMetricValue}>{value}</Text><Text style={styles.releaseMetricDetail} numberOfLines={wide ? 1 : 2}>{detail}</Text></View>;
}

function NetworkMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.networkMetric}><Text style={styles.networkMetricLabel}>{label}</Text><Text style={styles.networkMetricValue}>{value}</Text><Text style={styles.networkMetricDetail}>{detail}</Text></View>;
}

function ProfileLabMetric({ label, value }: { label: string; value: number }) {
  return <View style={styles.profileLabMetric}><Text style={styles.profileLabMetricLabel}>{label}</Text><Text style={styles.profileLabMetricValue}>{Math.max(0, value).toLocaleString()}</Text></View>;
}

function RetentionRow({ label, count }: { label: string; count: RetentionCount }) {
  return <View style={styles.retentionRow}><View style={styles.flex}><Text style={styles.retentionRowTitle}>{label}</Text><Text style={styles.retentionRowTotal}>{formatCount(count.total)} total</Text></View><View style={styles.retentionNumbers}><Text style={styles.retentionKept}>{formatCount(count.kept)}</Text><Text style={styles.retentionRemove}>{formatCount(count.removable)}</Text></View></View>;
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString();
}

function formatRetentionDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function NetworkEventRow({ event }: { event: NetworkActivityEvent }) {
  const outcome = event.outcome === 'succeeded' ? 'DONE' : event.outcome === 'active' ? 'ACTIVE' : event.outcome.toUpperCase();
  const source = event.category === 'private_icloud' ? 'Apple private service' : event.category === 'privacy_edge' ? 'JourneyDeck private edge' : event.reason.replaceAll('_', ' ');
  return <View style={styles.networkEventRow}><View style={styles.flex}><Text style={styles.compactTitle}>{event.operation}</Text><Text style={styles.networkEventDetail}>{source} · {event.method}{event.statusCode ? ` · ${event.statusCode}` : ''}</Text></View><Text style={[styles.networkEventOutcome, event.outcome === 'succeeded' && styles.networkEventOutcomeGood, event.outcome === 'blocked' && styles.networkEventOutcomeBlocked]}>{outcome}</Text></View>;
}

function ProviderHealth({ provider, capabilities }: { provider: ProviderPreferences | null; capabilities: { lastFmConfigured: boolean; tessieConfigured: boolean } }) {
  const rows = [
    ['Apple Music', provider?.connections.appleMusic ?? 'not_connected'], ['Manual Song Recognition', provider?.connections.shazam ?? 'not_enabled'],
    ['Spotify history', capabilities.lastFmConfigured ? (provider?.connections.lastFm ?? 'ready') : 'not_connected'],
    ...(TESSIE_INTEGRATION_ENABLED ? [['Tessie on this iPhone', capabilities.tessieConfigured ? 'connected' : 'not_connected']] : []),
  ];
  return <View style={styles.card}>{rows.map(([name, status]) => <View key={name} style={styles.providerRow}><Text style={styles.compactTitle}>{name}</Text><Text style={[styles.providerStatus, /connected|enabled/.test(status) && styles.providerStatusGood]}>{status.replaceAll('_', ' ')}</Text></View>)}</View>;
}

export function MoreScreen({
  active, requested, onRequestedChange, state, dashboard, privateCloud, appleIdentityStatus, onRefresh, onCloudSync,
  providerCapabilities, currentUser, profiles, onCreateProfileTest, onSwitchProfile, settings, onClose,
}: {
  active: boolean; requested: MoreDestination; onRequestedChange: (destination: MoreDestination) => void; state: PrimaryDataState; dashboard: AppDashboard;
  privateCloud: { status: string; detail: string }; appleIdentityStatus: string; onRefresh: () => void; onCloudSync: () => void;
  providerCapabilities: { lastFmConfigured: boolean; tessieConfigured: boolean };
  currentUser: LocalUser; profiles: LocalUser[]; onCreateProfileTest: () => void; onSwitchProfile: (userId: string) => void;
  settings: ReactNode; onClose: () => void;
}) {
  const destination = requested;
  const backToTools = () => onRequestedChange('menu');
  let content: ReactNode;
  if (destination !== 'menu') {
    const child = destination === 'health'
      ? <DataHealthScreen active={active} state={state} dashboard={dashboard} privateCloud={privateCloud} appleIdentityStatus={appleIdentityStatus} providerCapabilities={providerCapabilities} currentUser={currentUser} profiles={profiles} onRefresh={onRefresh} onCloudSync={onCloudSync} onCreateProfileTest={onCreateProfileTest} onSwitchProfile={onSwitchProfile} onBack={backToTools} />
      : settings;
    content = child;
  } else {
    content = <ScreenScaffold eyebrow="JOURNEYDECK UTILITIES" title="Tools" subtitle="Data confidence and app controls." onRefresh={onRefresh} leadingAction={{ label: 'Close', onPress: onClose }}>
      <View style={styles.moreGrid}>
        <MoreTile symbol="checkmark.shield" fallback="✓" title="Data Health" detail="Sync confidence" color="#58d5b6" onPress={() => onRequestedChange('health')} />
        <MoreTile symbol="gearshape" fallback="⚙" title="Settings" detail="Accounts + app" color="#8ca4ff" onPress={() => onRequestedChange('settings')} />
      </View>
      <View style={styles.localFirstCard}><NeonWidgetOutline radius={21} /><Text style={styles.cardEyebrow}>LOCAL-FIRST BY DESIGN</Text><Text style={styles.itemTitle}>Your iPhone does the everyday work.</Text><Text style={styles.itemDetail}>Data Health explains what is saved and safe to retry. Settings contains account, recording, and provider controls.</Text></View>
    </ScreenScaffold>;
  }
  return <View style={styles.screen}>{content}</View>;
}

function MoreTile({ symbol, fallback, title, detail, color, onPress }: { symbol: SFSymbol; fallback: string; title: string; detail: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.moreTile}><NeonWidgetOutline radius={23} /><View style={[styles.moreIcon, { backgroundColor: `${color}20`, borderColor: `${color}66` }]}><SymbolView name={symbol} tintColor={color} size={24} fallback={<Text style={{ color, fontSize: 22 }}>{fallback}</Text>} /></View><Text style={styles.moreTileTitle}>{title}</Text><Text style={styles.moreTileDetail}>{detail}</Text></Pressable>;
}

function HealthRow({ title, status, detail, healthy }: { title: string; status: string; detail: string; healthy: boolean }) {
  return <View style={styles.healthRow}><NeonWidgetOutline radius={19} /><View style={[styles.healthDot, healthy && styles.healthDotGood]} /><View style={styles.flex}><View style={styles.rowBetween}><Text style={styles.itemTitle}>{title}</Text><Text style={[styles.healthStatus, healthy && styles.healthStatusGood]}>{status.toUpperCase()}</Text></View><Text style={styles.itemDetail}>{detail}</Text></View></View>;
}

function MilesChart({ statistics }: { statistics: StatisticsData }) {
  const width = 330, height = 126, max = Math.max(1, ...statistics.dailyMiles.map(day => day.miles));
  const points = statistics.dailyMiles.map((day, index) => [10 + index * ((width - 20) / 29), height - 15 - (day.miles / max) * (height - 35)] as const);
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return <NeonWidget radius={20} style={styles.chartCard}><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Defs><SvgGradient id="milesLine" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#9e54ff" /><Stop offset="1" stopColor="#ff6b4f" /></SvgGradient></Defs><Path d={`${line} L ${width - 10} ${height - 10} L 10 ${height - 10} Z`} fill="#8e46de" opacity={0.12} /><Path d={line} fill="none" stroke="url(#milesLine)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></Svg><View style={styles.chartLabels}>{statistics.dailyMiles.filter((_, index) => index % 5 === 0).map(day => <Text key={day.date} style={styles.chartLabel}>{day.label}</Text>)}</View></NeonWidget>;
}

function StatCard({ label, metric: value, format }: { label: string; metric: StatisticsData['current']['miles']; format: (value: number) => string }) {
  const change = value.changePercent;
  return <QuietInset radius={17} accent="#a66cff" style={styles.statCard}><Text style={styles.cardEyebrow}>{label}</Text><Text style={styles.statValue}>{format(value.value)}</Text><Text style={[styles.change, change !== null && change < 0 && styles.changeDown]}>{change === null ? 'NEW' : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%`} <Text style={styles.changePeriod}>vs prior 30d</Text></Text></QuietInset>;
}

function JourneyRow({ journey, onPress }: { journey: JourneySummary; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.journeyRow}><NeonWidgetOutline radius={18} /><Text style={styles.routeGlyph}>⌁</Text><View style={styles.flex}><Text style={styles.itemTitle} numberOfLines={1}>{journey.startingLocation || 'Unknown start'} → {journey.endingLocation || 'Unknown destination'}</Text><Text style={styles.itemDetail}>{new Date(journey.startedAt).toLocaleDateString()} · {journey.miles.toFixed(1)} mi · {journey.songCount} songs</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function Metric({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return <View style={styles.metric}><LinearGradient pointerEvents="none" colors={['#ff7a61', '#bc66ff', '#5ca7ff'] as const} style={styles.metricAccent} /><Text style={styles.metricValue}>{value}<Text style={styles.metricUnit}>{unit ? ` ${unit}` : ''}</Text></Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function SectionTitle({ title, detail }: { title: string; detail: string }) { return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text><Text style={styles.sectionDetail}>{detail}</Text></View>; }
function EmptyCard({ text }: { text: string }) { return <NeonWidget radius={18} style={styles.emptyCard}><Text style={styles.noticeText}>{text}</Text></NeonWidget>; }
function timelineGlyph(kind: string) { return kind === 'journey' ? '⌁' : kind === 'song' ? '♪' : kind === 'charging' ? 'ϟ' : '◉'; }
function timelineColor(kind: string) { return kind === 'journey' ? '#ff6a54' : kind === 'song' ? '#a85cff' : kind === 'charging' ? '#5bd6b9' : '#678cff'; }
function kindGlyph(kind: SearchRecord['kind']) { return kind === 'journey' ? '⌁' : kind === 'song' ? '♪' : kind === 'artist' ? '♬' : kind === 'place' ? '●' : '✦'; }
function formatClock(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Time unavailable'; }
function relativeTime(value?: string) { if (!value) return 'from saved data'; const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000)); return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`; }
function routeMiles(coordinates: [number, number][]) { let meters = 0; for (let index = 1; index < coordinates.length; index += 1) { const [aLng, aLat] = coordinates[index - 1], [bLng, bLat] = coordinates[index], rad = Math.PI / 180; const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad; const chord = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2; meters += 12_742_000 * Math.asin(Math.sqrt(chord)); } return meters / 1609.344; }
const atlasStateNames = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
]);
function compactAtlasPlaceLabel(value: string) { return value.replace(/,\s*(?:United States(?: of America)?|USA|US)\.?\s*$/i, '').replace(/\s+\d{5}(?:-\d{4})?(?=,|$)/g, '').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim(); }
function atlasPlaceParts(value: string) {
  const parts = compactAtlasPlaceLabel(value).split(',').map(part => part.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  return atlasStateNames.has(last.toLowerCase())
    ? { place: parts.slice(0, -1).join(', '), state: last }
    : { place: parts.join(', '), state: null };
}
function formatAtlasPatternRoute(start: string, end: string) {
  const origin = atlasPlaceParts(start), destination = atlasPlaceParts(end);
  if (origin.state && destination.state && origin.state.toLowerCase() === destination.state.toLowerCase()) return `${origin.place} → ${destination.place}`;
  const format = ({ place, state }: { place: string; state: string | null }) => state ? `${place}, ${state}` : place;
  return `${format(origin)} → ${format(destination)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030105' },
  headerSpill: { position: 'absolute', top: 0, left: 0, right: 0, height: 430 },
  content: { paddingHorizontal: 20, paddingBottom: 150 }, artHeader: { position: 'relative', zIndex: 0, alignSelf: 'stretch', marginBottom: 22 },
  utilityBack: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 3, marginBottom: 8 },
  utilityBackText: { color: '#c99bff', fontSize: 14, fontWeight: '800' },
  eyebrow: { color: '#ff806a', fontSize: 10, fontWeight: '900', letterSpacing: 2.6 },
  title: { color: '#fff', fontSize: 37, lineHeight: 42, fontWeight: '900', letterSpacing: -1.3, marginTop: 7 },
  subtitle: { color: '#9c91a4', fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22, maxWidth: 350 },
  statsPageTitle: { position: 'relative', zIndex: 10, elevation: 10, width: '100%', alignSelf: 'center', color: '#fff', fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: 5.2, textAlign: 'center', marginBottom: 17, textShadowColor: 'rgba(255,255,255,0.32)', textShadowRadius: 8 },
  loadingCard: { minHeight: 100, borderRadius: 22, backgroundColor: '#0d0712', borderWidth: 1, borderColor: '#34203d', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, marginBottom: 16 },
  warningCard: { borderRadius: 19, backgroundColor: '#21120d', borderWidth: 1, borderColor: '#6f432e', padding: 16, marginBottom: 15 },
  warningTitle: { color: '#ff9b67', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
  noticeText: { color: '#9a8fa3', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  liveHero: { borderRadius: 27, padding: 20, marginBottom: 13, backgroundColor: '#100816', shadowColor: '#a73dff', shadowOpacity: 0.16, shadowRadius: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardEyebrow: { color: '#c493f6', fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginBottom: 7 },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '900', letterSpacing: -0.5 },
  liveDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#4b4350', borderWidth: 3, borderColor: '#211825' },
  liveDotActive: { backgroundColor: '#5be0ba', borderColor: '#244c42', shadowColor: '#5be0ba', shadowOpacity: 1, shadowRadius: 10 },
  metricRow: { flexDirection: 'row', gap: 8, marginTop: 19 },
  metric: { flex: 1, minHeight: 70, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingTop: 13, paddingBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#3a3043', backgroundColor: 'rgba(255,255,255,0.025)' },
  metricAccent: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5, borderRadius: 2, opacity: 0.8 },
  metricValue: { color: '#fff', fontSize: 21, lineHeight: 24, fontWeight: '900', letterSpacing: -0.4, textAlign: 'center', fontVariant: ['tabular-nums'] },
  metricUnit: { color: '#b5a6bc', fontSize: 10, fontWeight: '800' },
  metricLabel: { color: '#a295aa', fontSize: 9, lineHeight: 11, fontWeight: '800', letterSpacing: 0.75, marginTop: 4, textAlign: 'center' },
  liveStateCopy: { color: '#a89dad', fontSize: 13, lineHeight: 19, marginTop: 12 },
  honestNote: { color: '#746b7b', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 16 },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 28, marginBottom: 12 },
  sectionHeading: { color: '#f8f4fa', fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sectionDetail: { color: '#806f88', fontSize: 10, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  card: { borderRadius: 22, backgroundColor: '#0c0710', borderWidth: 1, borderColor: '#35203e', padding: 17, marginBottom: 12 },
  tessieCard: { borderRadius: 22, backgroundColor: '#071119', padding: 17, marginBottom: 12 },
  tessieStatus: { color: '#69d8f5', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase', textAlign: 'right', maxWidth: 120 },
  primaryButton: { minHeight: 48, borderRadius: 16, backgroundColor: '#8c48e8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 17 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: '#6d3e82', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 10 },
  secondaryButtonText: { color: '#dcb7ef', fontSize: 13, fontWeight: '800' },
  trackCard: { minHeight: 82, borderRadius: 20, backgroundColor: '#0d0711', borderWidth: 1, borderColor: '#382042', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  artwork: { width: 58, height: 58, borderRadius: 13 },
  artworkBlank: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#29132f' },
  artworkNote: { color: '#df89ff', fontSize: 24 },
  flex: { flex: 1 },
  itemTitle: { color: '#f7f1f9', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  itemDetail: { color: '#897f90', fontSize: 11, lineHeight: 17, marginTop: 3 },
  chevron: { color: '#8d7698', fontSize: 26, fontWeight: '300' },
  healthStrip: { marginTop: 13, borderRadius: 17, backgroundColor: '#091713', borderWidth: 1, borderColor: '#1d4d40', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  healthStripTitle: { color: '#5ed9b9', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  healthStripText: { color: '#79a99d', fontSize: 9, flex: 1, textAlign: 'right' },
  mapLegend: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 9 },
  legendLine: { color: '#ff755f', fontSize: 9, fontWeight: '700' },
  legendPlace: { color: '#ad6df4', fontSize: 9, fontWeight: '700' },
  horizontalCards: { gap: 10, paddingRight: 20 },
  placeChip: { width: 145, minHeight: 101, borderRadius: 19, padding: 14, overflow: 'hidden', backgroundColor: '#0c0710', borderWidth: StyleSheet.hairlineWidth, borderColor: '#382340' },
  placeChipActive: { backgroundColor: 'rgba(104, 41, 27, 0.62)', borderWidth: 0, shadowColor: '#ff713e', shadowOpacity: 0.38, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  placeCategory: { color: '#b79aca', fontSize: 9, fontWeight: '800', letterSpacing: 1.05 },
  placeName: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 9 },
  placeVisits: { color: '#7d7185', fontSize: 10, marginTop: 5 },
  placeSoundtrack: { color: '#d49af3', fontSize: 11, marginTop: 13 },
  placeRouteThread: { position: 'relative', marginTop: 14, paddingLeft: 19 },
  routeThreadRail: { position: 'absolute', left: 5, top: 13, bottom: 13, width: 2, borderRadius: 2, opacity: 0.9 },
  routeThreadNode: { position: 'absolute', left: -18, top: 17, width: 11, height: 11, borderRadius: 6, backgroundColor: '#ab67f5', borderWidth: 1, borderColor: '#d5a6ff', shadowColor: '#a95cff', shadowOpacity: 0.85, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  routeThreadNodeStart: { backgroundColor: '#ff8066', borderColor: '#ffb09a', shadowColor: '#ff735a' },
  compactRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(179, 135, 205, 0.2)', gap: 8 },
  compactRowFirst: { borderTopWidth: 0 },
  compactTitle: { color: '#d9d0dc', fontSize: 11, fontWeight: '700', flex: 1, paddingRight: 6 },
  compactValue: { color: '#b99ad0', fontSize: 10, fontWeight: '800', minWidth: 38, textAlign: 'right' },
  patternCard: { borderRadius: 20, backgroundColor: '#100817', borderWidth: 1, borderColor: '#452353', padding: 17, marginBottom: 10 },
  patternContent: { zIndex: 1 },
  inlineButtons: { flexDirection: 'row', gap: 23, marginTop: 15, alignItems: 'center' },
  patternAction: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  patternActionIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#393044', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 8, 16, 0.72)' },
  patternActionIconActive: { borderColor: '#2e735f', backgroundColor: 'rgba(13, 43, 35, 0.8)' },
  patternActionSymbol: { color: '#a79ba9', fontSize: 16, lineHeight: 18, fontWeight: '700' },
  patternActionSymbolActive: { color: '#77d8bd' },
  patternActionText: { color: '#928598', fontSize: 11, fontWeight: '800' },
  patternActionTextActive: { color: '#b6d7cc' },
  journeyRow: { minHeight: 72, borderRadius: 18, backgroundColor: '#0b070e', borderWidth: 1, borderColor: '#302038', padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  routeGlyph: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#25122d', color: '#d474ff', textAlign: 'center', textAlignVertical: 'center', fontSize: 25 },
  emptyCard: { borderRadius: 19, borderWidth: 1, borderColor: '#302037', backgroundColor: '#0a060d', padding: 22, marginBottom: 10 },
  dayRail: { gap: 8, paddingRight: 18, marginBottom: 17 },
  dayChip: { width: 58, height: 69, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0710', borderWidth: 1, borderColor: '#34203c' },
  dayChipActive: { backgroundColor: '#2a1517', borderColor: '#ff824e', shadowColor: '#ff713e', shadowOpacity: 0.58, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  dayNumber: { color: '#fff', fontSize: 20, fontWeight: '900' },
  dayLabel: { color: '#9e8aa8', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  selectedDay: { color: '#eee6f1', fontSize: 16, fontWeight: '800', marginBottom: 11 },
  timelineList: { marginTop: 17 },
  timelineItem: { flexDirection: 'row', gap: 12, minHeight: 88, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#312038' },
  timelineIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  timelineIconText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  timelineTime: { color: '#b17fce', fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginBottom: 5 },
  storyStatsHero: { width: '100%', alignSelf: 'center', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO, overflow: 'visible', justifyContent: 'center', marginBottom: 9 },
  storyStatsHeroCopy: { width: '72%', paddingHorizontal: 17, paddingVertical: 14 },
  storyStatsKicker: { color: '#ff8069', fontSize: 8, fontWeight: '900', letterSpacing: 1.7, marginBottom: 8 },
  storyStatsHeadline: { color: '#fff8ff', fontFamily: 'Georgia', fontSize: 22, lineHeight: 25, fontWeight: '700', letterSpacing: -0.75 },
  storyStatsHeroAccent: { color: '#ff7b6c' },
  storyStatsCards: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  storyStatsFeatureCard: { flex: 1, minWidth: 0, minHeight: 87, borderRadius: 17, backgroundColor: '#0e0915', borderWidth: 1, borderColor: '#35233e', paddingHorizontal: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7, overflow: 'hidden' },
  storyStatsInsightIcon: { width: 36, height: 36, flexShrink: 0, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1b1021', borderWidth: 1, borderColor: '#ff6e62', padding: 2 },
  storyStatsInsightIconPurple: { borderColor: '#9659d4', backgroundColor: '#20102b' },
  storyStatsInsightIconSun: { borderColor: '#ff7c69', backgroundColor: '#231016' },
  storyStatsInsightLabel: { color: '#a89baa', fontSize: 8, lineHeight: 11, fontWeight: '700' },
  storyStatsFeatureValue: { color: '#fff8ff', fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: -0.3, marginTop: 3 },
  storyStatsFeatureValueCompact: { fontSize: 11, lineHeight: 13, letterSpacing: -0.2 },
  storyStatsRhythmCard: { minHeight: 58, borderRadius: 17, backgroundColor: '#0c0710', borderWidth: 1, borderColor: '#382140', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 22 },
  storyStatsHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  storyStatsUnlock: { minHeight: 39, borderRadius: 12, borderWidth: 1, borderColor: '#7a4053', backgroundColor: '#271018', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 10 },
  storyStatsUnlockText: { color: '#ff9b7d', fontSize: 8, fontWeight: '900', letterSpacing: 1.25 },
  storyStatsUnlockArrow: { color: '#ff9b7d', fontSize: 20, lineHeight: 21 },
  storyStatsRhythmBars: { flex: 1, height: 15, flexDirection: 'row', alignItems: 'center', gap: 2 },
  storyStatsRhythmBar: { flex: 1, height: 10, minWidth: 1.4, borderRadius: 3, backgroundColor: '#28212f' },
  storyStatsRhythmBarActive: { backgroundColor: '#ff6e61', shadowColor: '#ff675a', shadowOpacity: 0.75, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  storyStatsRhythmLabel: { color: '#9d8fa3', fontSize: 8, fontWeight: '800', letterSpacing: 1.25 },
  storyStatsHistoryDay: { color: '#97889e', fontSize: 8, fontWeight: '800', letterSpacing: 0.5, flexShrink: 0 },
  storyTimelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9, paddingHorizontal: 3 },
  storyTimelineHeaderTitle: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: 2.2 },
  storyTimelineHeaderCount: { color: '#81728a', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  storyTimelineList: { backgroundColor: 'transparent' },
  storyTimelineShell: { minHeight: 78, flexDirection: 'row' },
  storyTimelineRail: { width: 36, alignItems: 'center', justifyContent: 'center' },
  storyTimelineConnector: { position: 'absolute', left: 17, width: 2, backgroundColor: '#43344e' },
  storyTimelineConnectorTop: { top: 0, bottom: '50%' },
  storyTimelineConnectorBottom: { top: '50%', bottom: 0 },
  storyTimelineRailIcon: { zIndex: 1, width: 27, height: 27, borderRadius: 14, backgroundColor: '#321824', borderWidth: 1, borderColor: '#6c3447', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff625d', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  storyTimelineRailIconSong: { backgroundColor: '#24132f', borderColor: '#583174', shadowColor: '#a95cff' },
  storyTimelineCard: { flex: 1, minHeight: 70, borderRadius: 14, backgroundColor: '#0d0912', borderWidth: StyleSheet.hairlineWidth, borderColor: '#2d2334', padding: 7, marginVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 9, overflow: 'hidden' },
  storyTimelineArtwork: { width: 70, height: 54, borderRadius: 9, backgroundColor: '#25122d' },
  storyTimelineRoute: { width: 70, height: 54, borderRadius: 9, backgroundColor: '#170c1d', borderWidth: 1, borderColor: '#42294a', overflow: 'hidden', padding: 2 },
  storyTimelineCopy: { flex: 1, minWidth: 0 },
  storyTimelineKind: { color: '#ff7b69', fontSize: 9, lineHeight: 12, fontWeight: '800' },
  storyTimelineKindSong: { color: '#c27aff' },
  storyTimelineClock: { color: '#8c7e93', fontSize: 10, flexShrink: 0, paddingHorizontal: 3 },
  storyTimelineMore: { minHeight: 50, borderRadius: 15, overflow: 'hidden', marginTop: 11, marginLeft: 36, marginBottom: 7 },
  storyTimelineMoreFill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  storyTimelineMoreText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  scoreCard: { borderRadius: 25, padding: 17, backgroundColor: '#12081a', flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreRing: { width: 94, height: 94, borderRadius: 47, borderWidth: 7, borderColor: '#a95feb', backgroundColor: '#0a050e', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { color: '#fff', fontSize: 31, fontWeight: '900', letterSpacing: -1 },
  scoreUnit: { color: '#8d7d95', fontSize: 8, fontWeight: '800' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  statCard: { width: '48.5%', minHeight: 112, borderRadius: 20, padding: 15 },
  statValue: { color: '#fff', fontSize: 23, fontWeight: '900', marginTop: 3 },
  change: { color: '#56d1ad', fontSize: 10, fontWeight: '900', marginTop: 9 },
  changeDown: { color: '#ff806c' },
  changePeriod: { color: '#716878', fontWeight: '600' },
  chartCard: { borderRadius: 22, backgroundColor: '#0c0710', borderWidth: 1, borderColor: '#34203d', padding: 14 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 7 },
  chartLabel: { color: '#6f6576', fontSize: 8, fontWeight: '800' },
  streakValue: { color: '#fff', fontSize: 30, fontWeight: '900' },
  streakFlame: { color: '#ff6b51', fontSize: 35 },
  highlightRow: { minHeight: 78, borderRadius: 18, backgroundColor: '#0d0710', borderWidth: 1, borderColor: '#35203d', padding: 15, marginBottom: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  monthRow: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#34203b', paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  monthMiles: { color: '#e0aff7', fontSize: 15, fontWeight: '900' },
  searchBox: { minHeight: 58, borderRadius: 19, backgroundColor: '#0e0812', borderWidth: 1, borderColor: '#51305c', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 11 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 },
  resultCount: { color: '#936ba8', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 22, marginBottom: 9 },
  searchResult: { minHeight: 75, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#302037', paddingVertical: 10 },
  searchArtwork: { width: 49, height: 49, borderRadius: 13 },
  searchKind: { width: 49, height: 49, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  searchKindText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  searchType: { color: '#a77abc', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  healthHero: { borderRadius: 26, backgroundColor: '#0b1714', borderWidth: 1, borderColor: '#255a4c', padding: 22, marginBottom: 12 },
  releaseCard: { borderRadius: 24, backgroundColor: '#100918', borderWidth: 1, borderColor: '#6e3c8a', padding: 17, marginBottom: 14 },
  releaseSequence: { color: '#cf8cff', fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 5 },
  releaseLabel: { color: '#fff7ff', fontSize: 18, lineHeight: 23, fontWeight: '900', paddingRight: 8 },
  releaseKindBadge: { borderRadius: 999, borderWidth: 1, borderColor: '#8051a0', backgroundColor: '#21102d', paddingHorizontal: 9, paddingVertical: 6 },
  releaseKindText: { color: '#d9a6ff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  releaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  releaseMetric: { width: '48.5%', borderRadius: 15, backgroundColor: '#09050d', borderWidth: 1, borderColor: '#302039', padding: 10 },
  releaseMetricWide: { width: '100%' },
  releaseMetricLabel: { color: '#9f79b2', fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  releaseMetricValue: { color: '#fff8ff', fontSize: 17, fontWeight: '900', marginTop: 3 },
  releaseMetricDetail: { color: '#807086', fontSize: 9, lineHeight: 13, marginTop: 2 },
  releaseDate: { color: '#b6a5bc', fontSize: 11, fontWeight: '700', marginTop: 13 },
  releasePending: { color: '#ffbc6f', fontSize: 11, lineHeight: 16, fontWeight: '800', marginTop: 9 },
  releaseHelp: { color: '#746879', fontSize: 10, lineHeight: 15, marginTop: 8 },
  healthHeroValue: { color: '#5de0b9', fontSize: 31, fontWeight: '900', letterSpacing: -0.7 },
  healthRow: { borderRadius: 19, backgroundColor: '#0b070f', borderWidth: 1, borderColor: '#302038', padding: 15, marginBottom: 9, flexDirection: 'row', gap: 12 },
  healthDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#ff7b62', marginTop: 5 },
  healthDotGood: { backgroundColor: '#55d7b3' },
  healthStatus: { color: '#ff8f79', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  healthStatusGood: { color: '#5dd4b5' },
  providerRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2c1c33', gap: 10 },
  providerStatus: { color: '#a798af', fontSize: 9, textTransform: 'uppercase', fontWeight: '800' },
  providerStatusGood: { color: '#59d4b3' },
  safeActions: { marginTop: 6 },
  privacyNote: { color: '#6f6675', fontSize: 10, lineHeight: 16, marginTop: 18, textAlign: 'center' },
  artworkRefreshCard: { borderRadius: 20, backgroundColor: '#100917', borderWidth: 1, borderColor: '#684075', padding: 15, gap: 13 },
  artworkRefreshTitle: { color: '#fff5ff', fontSize: 16, fontWeight: '900', marginTop: 5 },
  artworkRefreshDetail: { color: '#a89bae', fontSize: 11, lineHeight: 17, marginTop: 5 },
  artworkRefreshWarning: { color: '#f0bd7d' },
  artworkRefreshError: { color: '#ffab91' },
  artworkRefreshButton: { minHeight: 45, borderRadius: 14, backgroundColor: '#8c48e8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  artworkRefreshButtonDisabled: { opacity: 0.55 },
  artworkRefreshButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  networkCard: { borderRadius: 22, backgroundColor: '#09060d', borderWidth: 1, borderColor: '#392343', padding: 13, marginBottom: 10 },
  networkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  networkMetric: { width: '48.5%', minHeight: 88, borderRadius: 16, backgroundColor: '#120b18', borderWidth: 1, borderColor: '#2f1d39', padding: 11 },
  networkMetricLabel: { color: '#9d78b3', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  networkMetricValue: { color: '#f8effc', fontSize: 22, fontWeight: '900', marginTop: 4 },
  networkMetricDetail: { color: '#74687c', fontSize: 9, lineHeight: 13, marginTop: 2 },
  networkReasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  networkReasonText: { color: '#a892b4', fontSize: 9, fontWeight: '700', backgroundColor: '#160d1c', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  networkEvents: { marginTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#35203f' },
  networkEventRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2b1a34' },
  networkEventDetail: { color: '#756a7c', fontSize: 9, lineHeight: 13, textTransform: 'capitalize' },
  networkEventOutcome: { color: '#c88f72', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  networkEventOutcomeGood: { color: '#58d5b6' },
  networkEventOutcomeBlocked: { color: '#f6b85d' },
  networkEmpty: { color: '#817387', fontSize: 10, lineHeight: 15, marginTop: 12 },
  networkNote: { color: '#675d6d', fontSize: 9, lineHeight: 14, marginTop: 12 },
  networkPolicyButton: { borderRadius: 19, borderWidth: 1, borderColor: '#68447a', backgroundColor: '#140b1a', padding: 15, marginTop: 2 },
  networkPolicyButtonActive: { borderColor: '#b9763c', backgroundColor: '#211208' },
  networkPolicyTitle: { color: '#dcb7ef', fontSize: 13, fontWeight: '900' },
  networkPolicyTitleActive: { color: '#ffc27a' },
  networkPolicyDetail: { color: '#8d7e94', fontSize: 10, lineHeight: 15, marginTop: 4 },
  networkReset: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 9, marginTop: 4 },
  networkResetText: { color: '#9876aa', fontSize: 10, fontWeight: '800' },
  profileLabCard: { borderRadius: 22, backgroundColor: '#0b0710', borderWidth: 1, borderColor: '#68468b', padding: 16, marginBottom: 13, gap: 12 },
  profileLabEyebrow: { color: '#c48aff', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  profileLabTitle: { color: '#fff7ff', fontSize: 18, fontWeight: '900', marginTop: 4 },
  profileLabDetail: { color: '#a99caf', fontSize: 12, lineHeight: 18 },
  profileLabResult: { color: '#ffb266', backgroundColor: '#2b160b', borderWidth: 1, borderColor: '#73401e', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, fontSize: 9, fontWeight: '900' },
  profileLabResultGood: { color: '#68e5be', backgroundColor: '#082019', borderColor: '#23664f' },
  profileLabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileLabMetric: { width: '31.5%', minHeight: 62, borderRadius: 14, backgroundColor: '#130b19', borderWidth: 1, borderColor: '#35213f', padding: 9 },
  profileLabMetricLabel: { color: '#9f79b2', fontSize: 7, fontWeight: '900', letterSpacing: 0.9 },
  profileLabMetricValue: { color: '#fff8ff', fontSize: 18, fontWeight: '900', marginTop: 5 },
  profileLabPrimary: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8b48e8', paddingHorizontal: 14 },
  profileLabPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  profileLabNote: { color: '#817386', fontSize: 10, lineHeight: 15 },
  retentionCard: { borderRadius: 22, backgroundColor: '#0b0710', borderWidth: 1, borderColor: '#4b2b59', padding: 14, marginBottom: 13 },
  retentionChoiceRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  retentionChoice: { flex: 1, minHeight: 38, borderRadius: 13, borderWidth: 1, borderColor: '#35203e', backgroundColor: '#110a16', alignItems: 'center', justifyContent: 'center' },
  retentionChoiceActive: { borderColor: '#a45dda', backgroundColor: '#281137' },
  retentionChoiceText: { color: '#8b7a92', fontSize: 10, fontWeight: '900' },
  retentionChoiceTextActive: { color: '#e4b5ff' },
  retentionLoading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 10 },
  retentionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 13 },
  retentionTitle: { color: '#f7effa', fontSize: 15, fontWeight: '900' },
  retentionCutoff: { color: '#807287', fontSize: 9, marginTop: 4 },
  readOnlyBadge: { color: '#64d9ba', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, borderRadius: 999, borderWidth: 1, borderColor: '#346b5d', backgroundColor: '#0b1d18', paddingHorizontal: 8, paddingVertical: 5 },
  retentionColumnLabels: { minHeight: 25, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3b2545' },
  retentionItemLabel: { flex: 1, color: '#75677d', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  retentionNumbers: { width: 128, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  retentionKeptLabel: { width: 58, color: '#58cbae', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, textAlign: 'right' },
  retentionRemoveLabel: { width: 62, color: '#eea45f', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, textAlign: 'right' },
  retentionRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2b1b32' },
  retentionRowTitle: { color: '#e8deeB', fontSize: 11, fontWeight: '800' },
  retentionRowTotal: { color: '#706675', fontSize: 8, marginTop: 2 },
  retentionKept: { width: 58, color: '#74d9bd', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  retentionRemove: { width: 62, color: '#f0ad6d', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  retentionSafeguards: { color: '#bea3ca', fontSize: 9, lineHeight: 14, fontWeight: '800', marginTop: 12 },
  retentionNote: { color: '#756a7c', fontSize: 9, lineHeight: 14, marginTop: 8 },
  retentionRefresh: { minHeight: 39, borderRadius: 13, borderWidth: 1, borderColor: '#553063', alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  retentionRefreshText: { color: '#c99add', fontSize: 10, fontWeight: '900' },
  moreSearch: { minHeight: 60, borderRadius: 20, backgroundColor: '#150a1c', borderWidth: 1, borderColor: '#613375', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 17, marginBottom: 13 },
  moreSearchText: { color: '#eee6f1', fontSize: 14, fontWeight: '800', flex: 1 },
  moreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moreTile: { width: '48.5%', minHeight: 151, borderRadius: 23, backgroundColor: '#0d0711', borderWidth: 1, borderColor: '#35203e', padding: 16 },
  moreIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moreTileTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 13 },
  moreTileDetail: { color: '#776d7e', fontSize: 10, marginTop: 4 },
  localFirstCard: { borderRadius: 21, backgroundColor: '#10170f', borderWidth: 1, borderColor: '#344e31', padding: 18, marginTop: 13 },
});
