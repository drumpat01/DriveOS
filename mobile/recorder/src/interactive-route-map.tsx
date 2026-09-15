import { JourneyReplayStage, ReplayPosition } from './journey-replay-stage';
import { JourneyReplayMarker, REPLAY_TICK_MS } from './journey-replay-marker';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';
import { recordedReplayStops, replayPhotoMoments, type ReplayPhoto } from './journey-replay-model';
import { useAppTheme, useThemedStyles } from './app-theme';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Linking, PanResponder, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type MapRef, type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { Feature, LineString } from 'geojson';
import { journeyDeckMapPalette, loadJourneyDeckMapStyle, OPEN_FREE_MAP_DARK_STYLE, OPEN_FREE_MAP_LIGHT_STYLE, type JourneyDeckMapStyle } from './journey-map-theme';
import {
  buildReplayRoute, nearbySongMoments, replaySnapshotAt, songAtReplayTime, travelledReplayCoordinates,
  type RouteCoordinate, type SongRouteMoment, type TimedRouteSample,
} from './route-moments';
import { useSettleWhenAppInactive } from './motion';
import { AdaptiveGlassSurface } from './delight-ui';
import { useCoreMotion } from './use-core-motion';

type InteractiveRouteMapProps = {
  coordinates: RouteCoordinate[];
  routeSamples?: TimedRouteSample[];
  photos?: ReplayPhoto[];
  songMoments: SongRouteMoment[];
  totalSongCount: number;
  startedAt: string;
  endedAt: string;
  startingBatteryPercent: number | null;
  endingBatteryPercent: number | null;
  startLabel: string | null;
  endLabel: string | null;
  selectedSongIndex?: number | null;
  onSelectSong?: (index: number | null) => void;
  fallback: ReactNode;
};

const EMPTY_PHOTOS: ReplayPhoto[] = [];
const replayRates = [1, 4, 12] as const;
const nearbyRadii = [0.5, 1, 2, 5] as const;
const REPLAY_CHASE_ZOOM = 15.5;
const REPLAY_CHASE_PITCH = 52;

export function InteractiveRouteMap({
  coordinates,
  routeSamples,
  photos = EMPTY_PHOTOS,
  songMoments,
  totalSongCount,
  startedAt,
  endedAt,
  startingBatteryPercent,
  endingBatteryPercent,
  startLabel,
  endLabel,
  selectedSongIndex = null,
  onSelectSong,
  fallback,
}: InteractiveRouteMapProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const mapPalette = journeyDeckMapPalette(theme.id);
  const focused = useIsFocused();
  const motion = useCoreMotion(focused);

  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const replayClockRef = useRef<number | null>(null);
  const replayZoomRef = useRef(REPLAY_CHASE_ZOOM);
  const mapGestureRef = useRef(false);
  const [mapStyle, setMapStyle] = useState<JourneyDeckMapStyle | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [terminalSelection, setTerminalSelection] = useState<'start' | 'end' | null>(null);
  const [queryCoordinate, setQueryCoordinate] = useState<RouteCoordinate | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState<(typeof nearbyRadii)[number]>(1);
  const [replayTimestamp, setReplayTimestamp] = useState(() => Date.parse(startedAt));
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const [replayEngaged, setReplayEngaged] = useState(false);
  const [replayRate, setReplayRate] = useState<(typeof replayRates)[number] | 'story'>(4);
  const [replayCameraMode, setReplayCameraMode] = useState<'chase' | 'overview'>('chase');
  const [stageHeight, setStageHeight] = useState(250);
  const [scrubberWidth, setScrubberWidth] = useState(1);
  const settleReplay = useCallback(() => {
    replayClockRef.current = null;
    setReplayPlaying(false);
  }, []);
  useSettleWhenAppInactive(settleReplay);
  useEffect(() => { if (!focused) settleReplay(); }, [focused, settleReplay]);

  const route = useMemo(() => buildRouteData(coordinates), [coordinates]);
  const replayRoute = useMemo(() => buildReplayRoute(
    coordinates,
    routeSamples,
    startedAt,
    endedAt,
    startingBatteryPercent,
    endingBatteryPercent,
  ), [coordinates, endedAt, endingBatteryPercent, routeSamples, startedAt, startingBatteryPercent]);
  const stops = useMemo(() => recordedReplayStops(routeSamples ?? []), [routeSamples]);
  const photoMoments = useMemo(() => replayPhotoMoments(photos, replayRoute), [photos, replayRoute]);
  const reachedStops = stops.filter(stop => stop.at <= replayTimestamp);
  const firstReplayTime = replayRoute[0]?.recordedAtEpochMs ?? Date.parse(startedAt);
  const lastReplayTime = replayRoute.at(-1)?.recordedAtEpochMs ?? Date.parse(endedAt);
  const canReplay = Number.isFinite(firstReplayTime) && Number.isFinite(lastReplayTime) && lastReplayTime > firstReplayTime;
  const effectiveReplayRate = replayRate === 'story' ? Math.max(1, (lastReplayTime - firstReplayTime) / 60_000) : replayRate;
  const currentPhoto = replayEngaged ? photoMoments.filter(photo => !failedPhotos.includes(photo.id) && photo.at <= replayTimestamp && replayTimestamp - photo.at < Math.max(90_000, effectiveReplayRate * 4000)).at(-1) : null;
  const activeStop = replayEngaged ? reachedStops.filter(stop => replayTimestamp <= Math.max(stop.end, stop.at + effectiveReplayRate * 3000)).at(-1) ?? null : null;
  const replaySnapshot = useMemo(
    () => replaySnapshotAt(replayRoute, replayTimestamp),
    [replayRoute, replayTimestamp],
  );
  const replaySong = useMemo(
    () => songAtReplayTime(songMoments, replayTimestamp),
    [replayTimestamp, songMoments],
  );
  const travelledRoute = useMemo(() => buildTravelledRouteData(
    travelledReplayCoordinates(replayRoute, replayTimestamp),
  ), [replayRoute, replayTimestamp]);
  const nearbySongs = useMemo(
    () => queryCoordinate ? nearbySongMoments(songMoments, queryCoordinate, nearbyRadius) : [],
    [nearbyRadius, queryCoordinate, songMoments],
  );
  const selectedSong = songMoments.find(moment => moment.index === selectedSongIndex) ?? null;

  useEffect(() => {
    let mounted = true;
    void loadJourneyDeckMapStyle(fetch, theme.id).then(style => {
      if (mounted) setMapStyle(style);
    });
    return () => { mounted = false; };
  }, [theme.id]);

  useEffect(() => {
    setReplayTimestamp(Number.isFinite(firstReplayTime) ? firstReplayTime : Date.now());
    setReplayPlaying(false);
    setReplayCameraMode('chase');
    setReplayEngaged(false);
    replayZoomRef.current = REPLAY_CHASE_ZOOM;
    setQueryCoordinate(null);
  }, [firstReplayTime, startedAt]);

  useEffect(() => {
    if (!replayPlaying || !Number.isFinite(lastReplayTime) || lastReplayTime <= firstReplayTime) return;
    replayClockRef.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - (replayClockRef.current ?? now);
      replayClockRef.current = now;
      setReplayTimestamp(current => {
        const next = current + elapsed * effectiveReplayRate;
        if (next >= lastReplayTime) {
          setReplayPlaying(false);
          return lastReplayTime;
        }
        return next;
      });
    }, REPLAY_TICK_MS);
    return () => {
      clearInterval(timer);
      replayClockRef.current = null;
    };
  }, [firstReplayTime, lastReplayTime, replayPlaying, effectiveReplayRate]);

  useEffect(() => {
    if (replayPlaying && replaySnapshot && replayCameraMode === 'chase' && motion.animate && !mapGestureRef.current) {
      cameraRef.current?.easeTo({
        center: replaySnapshot.coordinate,
        duration: REPLAY_TICK_MS,
        easing: 'linear',
        zoom: replayZoomRef.current,
        pitch: REPLAY_CHASE_PITCH,
        bearing: replaySnapshot.headingDegrees ?? 0,
        padding: { top: 110, right: 0, bottom: replayEngaged ? stageHeight + 40 : 20, left: 0 },
      });
    }
  }, [replayCameraMode, replayPlaying, replaySnapshot, motion.animate, replayEngaged, stageHeight]);

  useEffect(() => {
    if (!selectedSong) return;
    setTerminalSelection(null);
    setQueryCoordinate(null);
    cameraRef.current?.easeTo({ center: selectedSong.coordinate, duration: motion.animate ? 500 : 0, zoom: 14.5 });
  }, [selectedSong, motion.animate]);

  const fitRoute = useCallback(() => {
    if (!route) return;
    setReplayCameraMode('overview');
    cameraRef.current?.fitBounds(route.bounds, { padding: { top: 52, right: 44, bottom: replayEngaged ? stageHeight + 40 : 52, left: 44 }, duration: motion.animate ? 500 : 0 });
  }, [route, motion.animate, replayEngaged, stageHeight]);

  useEffect(() => {
    if (replayEngaged && motion.reduceMotion && motion.active) fitRoute();
  }, [replayEngaged, motion.reduceMotion, motion.active, fitRoute]);

  const followReplay = useCallback(() => {
    if (!replaySnapshot) return;
    setReplayCameraMode('chase');
    cameraRef.current?.easeTo({
      center: replaySnapshot.coordinate,
      duration: motion.animate ? 500 : 0,
      zoom: replayZoomRef.current,
      pitch: REPLAY_CHASE_PITCH,
      bearing: replaySnapshot.headingDegrees ?? 0,
      padding: { top: 110, right: 0, bottom: replayEngaged ? stageHeight + 40 : 20, left: 0 },
    });
  }, [replaySnapshot, motion.animate, replayEngaged, stageHeight]);

  const rememberReplayCamera = useCallback((event: { nativeEvent: ViewStateChangeEvent }) => {
    const { userInteraction, zoom } = event.nativeEvent;
    if (userInteraction && Number.isFinite(zoom)) replayZoomRef.current = Math.max(2, Math.min(19, zoom));
  }, []);

  const zoomBy = useCallback(async (delta: number) => {
    try {
      const zoom = await mapRef.current?.getZoom();
      if (typeof zoom === 'number') {
        const nextZoom = Math.max(2, Math.min(19, zoom + delta));
        replayZoomRef.current = nextZoom;
        cameraRef.current?.zoomTo(nextZoom, { duration: 240 });
      }
    } catch {
      // The map may be leaving the screen while a control press finishes.
    }
  }, []);

  const selectReplayProgress = useCallback((progress: number) => {
    if (!Number.isFinite(firstReplayTime) || !Number.isFinite(lastReplayTime)) return;
    setReplayPlaying(false);
    setReplayEngaged(true);
    setReplayTimestamp(firstReplayTime + Math.max(0, Math.min(1, progress)) * Math.max(1, lastReplayTime - firstReplayTime));
  }, [firstReplayTime, lastReplayTime]);

  const scrubberResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => selectReplayProgress(event.nativeEvent.locationX / scrubberWidth),
    onPanResponderMove: event => selectReplayProgress(event.nativeEvent.locationX / scrubberWidth),
  }), [scrubberWidth, selectReplayProgress]);

  const toggleReplay = () => {
    if (!canReplay) return;
    setReplayEngaged(true); setQueryCoordinate(null); setTerminalSelection(null); onSelectSong?.(null);
    if (replayTimestamp >= lastReplayTime) setReplayTimestamp(firstReplayTime);
    if (!replayPlaying) setReplayCameraMode('chase');
    setReplayPlaying(current => !current);
  };
  const watchStory = () => {
    if (!canReplay) return;
    setReplayRate('story'); setReplayTimestamp(firstReplayTime); setReplayEngaged(true); setReplayPlaying(true);
    setReplayCameraMode('chase'); setQueryCoordinate(null); setTerminalSelection(null); onSelectSong?.(null);
  };
  if (!route) return <>{fallback}</>;

  const locatedCount = songMoments.length;
  const replayProgress = replaySnapshot?.progress ?? 0;
  const replayProgressPercent = Math.max(0, Math.min(100, replayProgress * 100));
  const replayAccent = theme.color('#ff765c', 'accent');
  const replayAccentInk = theme.id === 'light' ? theme.palette.text : theme.palette.onAccent;
  const journeyStartColor = theme.color('#43e6ae', 'accent');
  const journeyEndColor = theme.color('#ff5f67', 'accent');
  const popupSong = selectedSong;

  return <View style={styles.experience}>
    <View style={[styles.mapFrame, replayEngaged && { height: Math.max(580, stageHeight + 320) }]} accessibilityLabel="Interactive journey map">
      {mapFailed ? fallback : <Map
        ref={mapRef}
        mapStyle={(mapStyle ?? (theme.isLight ? OPEN_FREE_MAP_LIGHT_STYLE : OPEN_FREE_MAP_DARK_STYLE)) as never}
        style={StyleSheet.absoluteFill}
        attribution={false}
        logo={false}
        compass={false}
        scaleBar={false}
        dragPan
        touchZoom
        doubleTapZoom
        touchRotate={false}
        touchPitch={false}
        onRegionWillChange={event => {
          if (event.nativeEvent.userInteraction) mapGestureRef.current = true;
          rememberReplayCamera(event);
        }}
        onRegionIsChanging={rememberReplayCamera}
        onRegionDidChange={event => {
          rememberReplayCamera(event);
          if (event.nativeEvent.userInteraction) mapGestureRef.current = false;
        }}
        onPress={event => {
          const lngLat = event.nativeEvent.lngLat;
          if (!lngLat || lngLat.length !== 2) return;
          setQueryCoordinate([lngLat[0], lngLat[1]]);
          setTerminalSelection(null);
          onSelectSong?.(null);
        }}
        onDidFinishLoadingMap={() => setMapReady(true)}
        onDidFailLoadingMap={() => setMapFailed(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ bounds: route.bounds, padding: { top: 48, right: 38, bottom: 48, left: 38 } }}
        />
        <GeoJSONSource id="journey-route" data={route.line}>
          <Layer id="journey-route-bloom" type="line" paint={{ 'line-color': mapPalette.routeGlow, 'line-width': 16, 'line-opacity': replayEngaged ? 0.12 : 0.52, 'line-blur': 9 }} />
          <Layer id="journey-route-shadow" type="line" paint={{ 'line-color': mapPalette.routeShadow, 'line-width': 9, 'line-opacity': replayEngaged ? 0.2 : 0.7 }} />
          <Layer id="journey-route-line" type="line" paint={{ 'line-color': mapPalette.routeLine, 'line-width': 5, 'line-opacity': replayEngaged ? 0.22 : 0.98 }} />
        </GeoJSONSource>
        {travelledRoute && <GeoJSONSource id="journey-route-travelled" data={travelledRoute}>
          <Layer id="journey-route-travelled-bloom" type="line" paint={{ 'line-color': mapPalette.routeGlow, 'line-width': 20, 'line-opacity': 0.72, 'line-blur': 10 }} />
          <Layer id="journey-route-travelled-line" type="line" paint={{ 'line-color': '#fff4db', 'line-width': 5.5, 'line-opacity': 1 }} />
        </GeoJSONSource>}
        <Marker id="journey-start" lngLat={route.start} anchor="center" onPress={event => {
          event.stopPropagation();
          setTerminalSelection('start');
          onSelectSong?.(null);
        }}><TerminalMarker kind="start" /></Marker>
        {(!replayEngaged || replayTimestamp >= lastReplayTime) && <Marker id="journey-end" lngLat={route.end} anchor="center" onPress={event => {
          event.stopPropagation();
          setTerminalSelection('end');
          onSelectSong?.(null);
        }}><TerminalMarker kind="end" /></Marker>}
        {songMoments.filter(moment => !replayEngaged || Date.parse(moment.playedAt) <= replayTimestamp).map(moment => <Marker
          id={`journey-song-${moment.index}`}
          key={`${moment.index}-${moment.playedAt}`}
          lngLat={moment.coordinate}
          anchor="center"
          onPress={event => {
            event.stopPropagation();
            setTerminalSelection(null);
            setQueryCoordinate(null);
            onSelectSong?.(moment.index);
          }}
        ><Animated.View entering={replayEngaged && motion.animate ? FadeIn.duration(260) : undefined}><SongMarker index={moment.index} selected={moment.index === selectedSongIndex || (replayEngaged && moment.index === replaySong?.index)} /></Animated.View></Marker>)}
        {replayEngaged && reachedStops.map((stop, index) => <Marker key={stop.id} id={stop.id} lngLat={stop.coordinate} anchor="center"><Animated.View entering={motion.animate ? FadeIn.duration(260) : undefined} accessibilityLabel={`Stop ${index + 1}`} style={[styles.songMarker, { backgroundColor: theme.palette.inset }]}><Text style={styles.songMarkerText}>Ⅱ</Text></Animated.View></Marker>)}
        {replayEngaged && photoMoments.filter(photo => photo.at <= replayTimestamp).map(photo => <Marker key={photo.id} id={`replay-photo-${photo.id}`} lngLat={photo.coordinate} anchor="center"><Animated.View entering={motion.animate ? FadeIn.duration(260) : undefined} accessibilityLabel="Journey photo" style={styles.songMarker}><Text style={styles.songMarkerText}>▣</Text></Animated.View></Marker>)}
        {queryCoordinate && <Marker id="journey-nearby-query" lngLat={queryCoordinate} anchor="center"><View style={styles.queryMarker}><View style={styles.queryMarkerCore} /></View></Marker>}
        {replaySnapshot && <JourneyReplayMarker points={replayRoute} timestamp={replayTimestamp} playing={replayPlaying} animate={motion.animate}><ReplayPosition heading={(replaySnapshot.headingDegrees ?? 0) - (replayCameraMode === 'chase' && replayPlaying && motion.animate ? replaySnapshot.headingDegrees ?? 0 : 0)} playing={replayPlaying} animate={motion.animate} /></JourneyReplayMarker>}
      </Map>}
      {!mapFailed && <View pointerEvents="none" style={styles.mapTint} />}
      <View pointerEvents="none" style={styles.mapStatus}><Text style={styles.mapStatusText}>{coordinates.length} route points · {locatedCount}/{totalSongCount} songs located</Text></View>
      {!mapFailed && <AdaptiveGlassSurface reduceTransparency={motion.reduceTransparency} style={styles.mapControls}>
        <Pressable accessibilityLabel="Zoom in" onPress={() => void zoomBy(1)} style={styles.mapControl}><Text style={styles.mapControlText}>＋</Text></Pressable>
        <Pressable accessibilityLabel="Zoom out" onPress={() => void zoomBy(-1)} style={styles.mapControl}><Text style={styles.mapControlText}>−</Text></Pressable>
        <Pressable accessibilityLabel={replayCameraMode === 'chase' ? 'Show the full route' : 'Follow journey replay'} onPress={replayCameraMode === 'chase' ? fitRoute : followReplay} style={styles.mapControl}><Text style={styles.mapControlArrow}>{replayCameraMode === 'chase' ? '⌖' : '▲'}</Text></Pressable>
      </AdaptiveGlassSurface>}
      {!mapReady && !mapFailed && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={theme.color("#a98cff", 'text')} /><Text style={styles.loadingText}>Styling your route…</Text></View>}
      {!replayEngaged && <View pointerEvents="box-none" style={styles.overviewOverlays}>
        {(popupSong || terminalSelection) && <View style={styles.popup}>
          {popupSong ? <>
            {popupSong.artworkUrl ? <Image source={popupSong.artworkUrl} style={styles.popupArtwork} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[styles.popupArtwork, styles.popupArtworkFallback]}><Text style={styles.popupArtworkNote}>♪</Text></View>}
            <View style={styles.popupCopy}><Text style={styles.popupKicker}>SONG {popupSong.index} · {formatClock(popupSong.playedAt)}</Text><Text style={styles.popupTitle} numberOfLines={1}>{popupSong.track}</Text><Text style={styles.popupDetail} numberOfLines={1}>{popupSong.artist}</Text></View>
          </> : <View style={styles.popupCopy}>
            <Text style={styles.popupKicker}>{terminalSelection === 'start' ? 'JOURNEY START' : 'JOURNEY END'}</Text>
            <Text style={styles.popupTitle} numberOfLines={2}>{terminalSelection === 'start' ? (startLabel ?? 'Starting point') : (endLabel ?? 'Destination')}</Text>
            <Text style={styles.popupDetail}>{formatClock(terminalSelection === 'start' ? startedAt : endedAt)}</Text>
          </View>}
        </View>}
        {replaySnapshot && canReplay && <Pressable accessibilityRole="button" accessibilityLabel="Watch journey story" onPress={watchStory} style={[styles.replayStoryButton, { backgroundColor: theme.palette.accent }]}><Text style={[styles.replayStoryButtonText, { color: theme.palette.onAccent }]}>▶  Relive this journey</Text></Pressable>}
      </View>}
      {replayEngaged && replaySnapshot && <View onLayout={event => setStageHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
        <JourneyReplayStage playing={replayPlaying} complete={replayTimestamp >= lastReplayTime} animate={motion.animate} timestamp={replayTimestamp}
          song={replaySong} photo={currentPhoto} stop={activeStop} progress={replayProgress}
          onSeek={selectReplayProgress} onToggle={toggleReplay} onRestart={() => { setReplayTimestamp(firstReplayTime); setReplayPlaying(true); }}
          onExplore={() => { setReplayPlaying(false); setReplayEngaged(false); setReplayTimestamp(firstReplayTime); fitRoute(); }}
          onPhotoError={() => { if (currentPhoto) setFailedPhotos(ids => ids.includes(currentPhoto.id) ? ids : [...ids, currentPhoto.id]); }} />
      </View>}
    </View>

    <View style={styles.attributionRow}>
      <Text style={styles.attribution}>Built with </Text><AttributionLink label="MapLibre" url="https://maplibre.org/" />
      <Text style={styles.attribution}> · </Text><AttributionLink label="OpenFreeMap" url="https://openfreemap.org/" />
      <Text style={styles.attribution}> · © </Text><AttributionLink label="OpenStreetMap" url="https://www.openstreetmap.org/copyright" />
    </View>
    <View style={styles.legend}>
      <LegendItem color={theme.color('#ff765c', 'accent')} label="Exact recorded route" line />
      <LegendItem color={theme.color('#a565ff', 'accent')} label="Song start" numbered />
      <LegendItem color={journeyStartColor} label="Start" />
      <LegendItem color={journeyEndColor} label="End" />
    </View>
    <Text style={styles.mapHint} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{replayCameraMode === 'chase' ? 'Tap map for music · Pinch to zoom · 3D follows' : 'Tap ▲ to follow the replay'}</Text>

    {queryCoordinate && <View style={styles.nearbyPanel}>
      <View style={styles.nearbyHeader}><View><Text style={styles.panelKicker}>NEARBY MUSIC</Text><Text style={styles.panelTitle}>{nearbySongs.length ? `${nearbySongs.length} soundtrack moment${nearbySongs.length === 1 ? '' : 's'}` : 'No songs in this radius'}</Text></View><Pressable onPress={() => setQueryCoordinate(null)}><Text style={styles.closeText}>×</Text></Pressable></View>
      <View style={styles.radiusRow}>{nearbyRadii.map(radius => <Pressable key={radius} onPress={() => setNearbyRadius(radius)} style={[styles.radiusChip, radius === nearbyRadius && styles.radiusChipActive]}><Text style={[styles.radiusText, radius === nearbyRadius && styles.radiusTextActive]}>{radius} mi</Text></Pressable>)}</View>
      {nearbySongs.slice(0, 8).map(moment => <Pressable key={`${moment.index}-${moment.playedAt}`} onPress={() => onSelectSong?.(moment.index)} style={styles.nearbySong}>
        <View style={styles.nearbyNumber}><Text style={styles.nearbyNumberText}>{moment.index}</Text></View><View style={styles.flex}><Text style={styles.nearbyTrack} numberOfLines={1}>{moment.track}</Text><Text style={styles.nearbyArtist} numberOfLines={1}>{moment.artist}</Text></View><Text style={styles.nearbyDistance}>{moment.distanceMiles < 0.1 ? '<0.1' : moment.distanceMiles.toFixed(1)} mi</Text>
      </Pressable>)}
    </View>}

    {replaySnapshot && <AdaptiveGlassSurface reduceTransparency={motion.reduceTransparency} style={styles.replayPanel}>
      <View style={styles.telemetryRow}>
        <Telemetry value={replaySnapshot.speedMph == null ? '—' : `${Math.round(replaySnapshot.speedMph)}`} label="MPH" />
        <Telemetry value={`${Math.round(replayProgress * 100)}%`} label="JOURNEY" last />
      </View>
      <View style={styles.journeyTimeline}>
        <View style={styles.journeyTimelineHeader}>
          <Text style={styles.journeyTimelineTitle}>JOURNEY PROGRESS</Text>
          <Text style={styles.journeyTimelineClock}>{formatClock(startedAt)} — {formatClock(endedAt)}</Text>
        </View>
        <View style={styles.journeyTimelineRail}>
          <View style={[styles.journeyEndpoint, { backgroundColor: journeyStartColor }]}><View style={[styles.journeyEndpointCore, { backgroundColor: theme.palette.page }]} /></View>
          <View accessible accessibilityRole="adjustable" accessibilityLabel="Journey replay position" accessibilityValue={{ min: 0, max: 100, now: Math.round(replayProgressPercent) }} accessibilityActions={[{ name: 'increment', label: 'Forward' }, { name: 'decrement', label: 'Back' }]} onAccessibilityAction={event => selectReplayProgress(replayProgress + (event.nativeEvent.actionName === 'increment' ? .05 : -.05))} onLayout={event => setScrubberWidth(Math.max(1, event.nativeEvent.layout.width))} style={styles.scrubberHitArea} {...scrubberResponder.panHandlers}>
            <View style={styles.scrubberTrack}>
              <View style={[styles.scrubberFill, { width: `${replayProgressPercent}%`, backgroundColor: replayAccent }]} />
              <View style={[styles.scrubberThumb, { left: `${replayProgressPercent}%`, backgroundColor: theme.palette.page, borderColor: replayAccent }]} />
            </View>
          </View>
          <View style={[styles.journeyEndpoint, { backgroundColor: journeyEndColor }]}><View style={[styles.journeyEndpointCore, { backgroundColor: theme.palette.page }]} /></View>
        </View>
        <View style={styles.journeyTimelineLabels}>
          <Text style={[styles.journeyEndpointLabel, { color: journeyStartColor }]}>START</Text>
          <Text style={styles.journeyProgressLabel}>{Math.round(replayProgressPercent)}% COMPLETE</Text>
          <Text style={[styles.journeyEndpointLabel, styles.journeyEndpointLabelEnd, { color: journeyEndColor }]}>END</Text>
        </View>
      </View>
      <View style={styles.replayControls}>
        <View style={styles.transportControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Restart replay" onPress={() => { setReplayEngaged(true); setReplayPlaying(false); setReplayTimestamp(firstReplayTime); }} style={styles.replayButton}><Text style={styles.replayButtonText}>↺</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!canReplay} accessibilityState={{ disabled: !canReplay }} accessibilityLabel={replayPlaying ? 'Pause replay' : 'Play replay'} onPress={toggleReplay} style={[styles.replayPrimary, { backgroundColor: replayAccent, shadowColor: replayAccent }]}><Text style={[styles.replayPrimaryText, { color: replayAccentInk }]}>{replayPlaying ? 'Ⅱ' : '▶'}</Text></Pressable>
        </View>
        <View style={styles.replayControlDivider} />
        <View style={styles.speedControls}>
          <Text style={styles.speedLabel}>REPLAY SPEED</Text>
          <View style={styles.rateRow}>{(['story', ...replayRates] as const).map(rate => {
            const selected = rate === replayRate;
            return <Pressable key={rate} accessibilityRole="button" accessibilityLabel={rate === 'story' ? 'One minute story speed' : `${rate} times replay speed`} accessibilityState={{ selected }} onPress={() => setReplayRate(rate)} style={[styles.rateButton, selected && { backgroundColor: replayAccent, borderColor: replayAccent }]}><Text style={[styles.rateText, selected && { color: replayAccentInk }]}>{rate === 'story' ? 'Story' : `${rate}×`}</Text></Pressable>;
          })}</View>
        </View>
      </View>
      <Text style={styles.replayFootnote}>{routeSamples && routeSamples.length >= 2 ? 'Replay uses recorded journey location and speed.' : 'Replay timing, speed, and heading are estimated from this saved route.'}</Text>
    </AdaptiveGlassSurface>}
  </View>;
}

function TerminalMarker({ kind }: { kind: 'start' | 'end' }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const markerColor = theme.color(kind === 'start' ? '#43e6ae' : '#ff5f67', 'accent');
  const glowColor = theme.color(kind === 'start' ? '#43e6ae44' : '#ff5f6744', 'accent');

  return <View style={[styles.terminalGlow, { backgroundColor: glowColor }]}><View style={[styles.terminalCore, { backgroundColor: markerColor, borderColor: theme.palette.page }]} /></View>;
}

function SongMarker({ index, selected }: { index: number; selected: boolean }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={[styles.songMarkerGlow, selected && styles.songMarkerGlowSelected]}><View style={[styles.songMarker, selected && styles.songMarkerSelected]}><Text style={styles.songMarkerText}>{index}</Text></View></View>;
}

function AttributionLink({ label, url }: { label: string; url: string }) {
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={() => void Linking.openURL(url)}><Text style={styles.attributionLink}>{label}</Text></Pressable>;
}

function LegendItem({ color, label, line, numbered }: { color: string; label: string; line?: boolean; numbered?: boolean }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.legendItem}>{line ? <View style={[styles.legendLine, { backgroundColor: color }]} /> : <View style={[styles.legendDot, { backgroundColor: color }]}>{numbered && <Text style={styles.legendNumber}>1</Text>}</View>}<Text style={styles.legendText}>{label}</Text></View>;
}

function Telemetry({ value, label, last = false }: { value: string; label: string; last?: boolean }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={[styles.telemetry, last && styles.telemetryLast]}><Text style={styles.telemetryValue}>{value}</Text><Text style={styles.telemetryLabel}>{label}</Text></View>;
}

function formatClock(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function buildRouteData(coordinates: RouteCoordinate[]) {
  const valid = coordinates.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  if (valid.length < 2) return null;
  const longitudes = valid.map(([longitude]) => longitude);
  const latitudes = valid.map(([, latitude]) => latitude);
  let west = Math.min(...longitudes), east = Math.max(...longitudes);
  let south = Math.min(...latitudes), north = Math.max(...latitudes);
  if (east - west < 0.004) { west -= 0.002; east += 0.002; }
  if (north - south < 0.004) { south -= 0.002; north += 0.002; }
  const line: Feature<LineString> = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: valid } };
  return { line, start: valid[0]!, end: valid.at(-1)!, bounds: [west, south, east, north] as [number, number, number, number] };
}

function buildTravelledRouteData(coordinates: RouteCoordinate[]): Feature<LineString> | null {
  if (coordinates.length < 2) return null;
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}

const darkStyles = StyleSheet.create({
  experience: { gap: 12 },
  mapFrame: { height: 430, borderRadius: 18, overflow: 'hidden', backgroundColor: '#010104', borderWidth: 1, borderColor: '#40204d' },
  mapTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 2, 18, 0.08)' },
  mapStatus: { position: 'absolute', left: 12, top: 12, maxWidth: '72%', borderRadius: 999, backgroundColor: '#08050de8', borderWidth: 1, borderColor: '#6d387d', paddingHorizontal: 10, paddingVertical: 6 },
  mapStatusText: { color: '#b9a8c2', fontSize: 9, fontWeight: '800', letterSpacing: 0.25 },
  mapControls: { position: 'absolute', right: 12, top: 12, overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#63356d' },
  mapControl: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#5e3b66' },
  mapControlText: { color: '#f2e9f5', fontSize: 24, fontWeight: '500' },
  mapControlArrow: { color: '#e9d9ef', fontSize: 20, fontWeight: '900' },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#050208ee' },
  loadingText: { color: '#c2b2c8', fontSize: 11, fontWeight: '800' },
  overviewOverlays: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 10 },
  popup: { marginRight: 56, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1, borderColor: '#71437a', backgroundColor: '#09050ff2', paddingHorizontal: 10, paddingVertical: 8 },
  popupArtwork: { width: 48, height: 48, borderRadius: 9 },
  popupArtworkFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a1238' },
  popupArtworkNote: { color: '#d6b7ff', fontSize: 19, fontWeight: '900' },
  popupCopy: { flex: 1, minWidth: 0 },
  popupKicker: { color: '#ff8d72', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  popupTitle: { color: '#fff7ff', fontSize: 15, fontWeight: '900', marginTop: 4 },
  popupDetail: { color: '#aa9caf', fontSize: 11, fontWeight: '700', marginTop: 3 },
  terminalGlow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  terminalCore: { width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  songMarkerGlow: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#7c38d955', alignItems: 'center', justifyContent: 'center' },
  songMarkerGlowSelected: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ff604f55' },
  songMarker: { minWidth: 27, height: 27, borderRadius: 14, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9a55ef', borderWidth: 2, borderColor: '#cba4ff' },
  songMarkerSelected: { minWidth: 31, height: 31, borderRadius: 16, backgroundColor: '#ff765c', borderColor: '#fff4ef' },
  songMarkerText: { color: '#100518', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  queryMarker: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#ff765c33', borderWidth: 2, borderColor: '#ff765c', alignItems: 'center', justifyContent: 'center' },
  queryMarkerCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff5f0' },
  carMarker: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#09050f', borderWidth: 2, borderColor: '#ff765c', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff5f67', shadowOpacity: 0.8, shadowRadius: 8 },
  carMarkerText: { color: '#ff765c', fontSize: 16, fontWeight: '900' },
  attributionRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  attribution: { color: '#6f6577', fontSize: 9 },
  attributionLink: { color: '#a780bf', fontSize: 9, textDecorationLine: 'underline' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  legendLine: { width: 25, height: 3, borderRadius: 2 },
  legendDot: { width: 13, height: 13, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f7edff' },
  legendNumber: { color: '#13051b', fontSize: 7, fontWeight: '900' },
  legendText: { color: '#8d8094', fontSize: 9, fontWeight: '700' },
  mapHint: { color: '#c77bf2', fontSize: 11, textAlign: 'center', fontWeight: '800' },
  nearbyPanel: { borderRadius: 18, borderWidth: 1, borderColor: '#45264f', backgroundColor: '#0b0710', padding: 14, gap: 10 },
  nearbyHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  panelKicker: { color: '#c799ff', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  panelTitle: { color: '#f5eff8', fontSize: 14, fontWeight: '900', marginTop: 4 },
  closeText: { color: '#a98eae', fontSize: 26, lineHeight: 27 },
  radiusRow: { flexDirection: 'row', gap: 7 },
  radiusChip: { borderRadius: 999, borderWidth: 1, borderColor: '#4f3658', paddingHorizontal: 11, paddingVertical: 7 },
  radiusChipActive: { backgroundColor: '#ff765c', borderColor: '#ff9a82' },
  radiusText: { color: '#a796ac', fontSize: 10, fontWeight: '800' },
  radiusTextActive: { color: '#19070b' },
  nearbySong: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  nearbyNumber: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9a55ef' },
  nearbyNumberText: { color: '#100518', fontSize: 10, fontWeight: '900' },
  nearbyTrack: { color: '#ece6ef', fontSize: 11, fontWeight: '800' },
  nearbyArtist: { color: '#817687', fontSize: 9, marginTop: 2 },
  nearbyDistance: { color: '#bd92d3', fontSize: 9, fontWeight: '800' },
  replayStoryButton: { minHeight: 44, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  replayStoryButtonText: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  replayPanel: { borderRadius: 20, borderWidth: 1, borderColor: '#4e2d58', padding: 15, gap: 13, overflow: 'hidden' },
  replayNowPlaying: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  replayArtwork: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#211729' },
  replayArtworkFallback: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#24152f', alignItems: 'center', justifyContent: 'center' },
  replayArtworkNote: { color: '#c49aff', fontSize: 24, fontWeight: '900' },
  replayTrack: { color: '#fff7ff', fontSize: 14, fontWeight: '900', marginTop: 4 },
  replayArtist: { color: '#95899a', fontSize: 10, fontWeight: '700', marginTop: 3 },
  telemetryRow: { flexDirection: 'row', borderRadius: 14, backgroundColor: '#130d18', paddingVertical: 10 },
  telemetry: { flex: 1, alignItems: 'center', gap: 3, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#4b374e' },
  telemetryLast: { borderRightWidth: 0 },
  telemetryValue: { color: '#f6eff8', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  telemetryLabel: { color: '#806f84', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  journeyTimeline: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#45354d', backgroundColor: '#100b15', paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10, gap: 7 },
  journeyTimelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  journeyTimelineTitle: { color: '#c7b9cc', fontSize: 8, fontWeight: '900', letterSpacing: 1.05 },
  journeyTimelineClock: { color: '#7f7185', fontSize: 8, fontWeight: '800', fontVariant: ['tabular-nums'] },
  journeyTimelineRail: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 9 },
  journeyEndpoint: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  journeyEndpointCore: { width: 5, height: 5, borderRadius: 3 },
  scrubberHitArea: { flex: 1, paddingVertical: 13 },
  scrubberTrack: { height: 6, borderRadius: 3, backgroundColor: '#302538' },
  scrubberFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  scrubberThumb: { position: 'absolute', top: -5, marginLeft: -7, width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  journeyTimelineLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyEndpointLabel: { width: 42, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  journeyEndpointLabelEnd: { textAlign: 'right' },
  journeyProgressLabel: { color: '#8f8195', fontSize: 7, fontWeight: '900', letterSpacing: 0.65, textAlign: 'center' },
  replayControls: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13 },
  transportControls: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  replayControlDivider: { width: StyleSheet.hairlineWidth, height: 38, backgroundColor: '#4b374e' },
  speedControls: { alignItems: 'center', gap: 6 },
  speedLabel: { color: '#806f84', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  replayButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1220', borderWidth: StyleSheet.hairlineWidth, borderColor: '#49344f' },
  replayButtonText: { color: '#d7c8db', fontSize: 21, fontWeight: '800' },
  replayPrimary: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.42, shadowRadius: 9 },
  replayPrimaryText: { fontSize: 18, fontWeight: '900' },
  rateRow: { flexDirection: 'row', gap: 6 },
  rateButton: { minWidth: 39, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#49344f' },
  rateText: { color: '#8c7e91', fontSize: 10, fontWeight: '900' },
  replayFootnote: { color: '#655c6a', fontSize: 8, lineHeight: 12, textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
