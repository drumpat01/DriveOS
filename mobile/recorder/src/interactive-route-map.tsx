import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Linking, PanResponder, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type MapRef,
} from '@maplibre/maplibre-react-native';
import type { Feature, LineString } from 'geojson';
import { loadJourneyDeckMapStyle, OPEN_FREE_MAP_DARK_STYLE, type JourneyDeckMapStyle } from './journey-map-theme';
import {
  buildReplayRoute, nearbySongMoments, replaySnapshotAt, songAtReplayTime,
  type RouteCoordinate, type SongRouteMoment, type TimedRouteSample,
} from './route-moments';

type InteractiveRouteMapProps = {
  coordinates: RouteCoordinate[];
  routeSamples?: TimedRouteSample[];
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

const replayRates = [1, 4, 12] as const;
const nearbyRadii = [0.5, 1, 2, 5] as const;

export function InteractiveRouteMap({
  coordinates,
  routeSamples,
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
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const replayClockRef = useRef<number | null>(null);
  const [mapStyle, setMapStyle] = useState<JourneyDeckMapStyle | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [terminalSelection, setTerminalSelection] = useState<'start' | 'end' | null>(null);
  const [queryCoordinate, setQueryCoordinate] = useState<RouteCoordinate | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState<(typeof nearbyRadii)[number]>(1);
  const [replayTimestamp, setReplayTimestamp] = useState(() => Date.parse(startedAt));
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayRate, setReplayRate] = useState<(typeof replayRates)[number]>(4);
  const [scrubberWidth, setScrubberWidth] = useState(1);

  const route = useMemo(() => buildRouteData(coordinates), [coordinates]);
  const replayRoute = useMemo(() => buildReplayRoute(
    coordinates,
    routeSamples,
    startedAt,
    endedAt,
    startingBatteryPercent,
    endingBatteryPercent,
  ), [coordinates, endedAt, endingBatteryPercent, routeSamples, startedAt, startingBatteryPercent]);
  const firstReplayTime = replayRoute[0]?.recordedAtEpochMs ?? Date.parse(startedAt);
  const lastReplayTime = replayRoute.at(-1)?.recordedAtEpochMs ?? Date.parse(endedAt);
  const replaySnapshot = useMemo(
    () => replaySnapshotAt(replayRoute, replayTimestamp),
    [replayRoute, replayTimestamp],
  );
  const replaySong = useMemo(
    () => songAtReplayTime(songMoments, replayTimestamp),
    [replayTimestamp, songMoments],
  );
  const nearbySongs = useMemo(
    () => queryCoordinate ? nearbySongMoments(songMoments, queryCoordinate, nearbyRadius) : [],
    [nearbyRadius, queryCoordinate, songMoments],
  );
  const selectedSong = songMoments.find(moment => moment.index === selectedSongIndex) ?? null;

  useEffect(() => {
    let mounted = true;
    void loadJourneyDeckMapStyle().then(style => {
      if (mounted) setMapStyle(style);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setReplayTimestamp(Number.isFinite(firstReplayTime) ? firstReplayTime : Date.now());
    setReplayPlaying(false);
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
        const next = current + elapsed * replayRate;
        if (next >= lastReplayTime) {
          setReplayPlaying(false);
          return lastReplayTime;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [firstReplayTime, lastReplayTime, replayPlaying, replayRate]);

  useEffect(() => {
    if (replayPlaying && replaySnapshot) {
      cameraRef.current?.easeTo({ center: replaySnapshot.coordinate, duration: 110, zoom: 14 });
    }
  }, [replayPlaying, replaySnapshot]);

  useEffect(() => {
    if (!selectedSong) return;
    setTerminalSelection(null);
    setQueryCoordinate(null);
    cameraRef.current?.easeTo({ center: selectedSong.coordinate, duration: 500, zoom: 14.5 });
  }, [selectedSong]);

  const fitRoute = useCallback(() => {
    if (!route) return;
    cameraRef.current?.fitBounds(route.bounds, { padding: { top: 52, right: 44, bottom: 52, left: 44 }, duration: 500 });
  }, [route]);

  const zoomBy = useCallback(async (delta: number) => {
    try {
      const zoom = await mapRef.current?.getZoom();
      if (typeof zoom === 'number') cameraRef.current?.zoomTo(Math.max(2, Math.min(19, zoom + delta)), { duration: 240 });
    } catch {
      // The map may be leaving the screen while a control press finishes.
    }
  }, []);

  const selectReplayProgress = useCallback((progress: number) => {
    if (!Number.isFinite(firstReplayTime) || !Number.isFinite(lastReplayTime)) return;
    setReplayTimestamp(firstReplayTime + Math.max(0, Math.min(1, progress)) * Math.max(1, lastReplayTime - firstReplayTime));
  }, [firstReplayTime, lastReplayTime]);

  const scrubberResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => selectReplayProgress(event.nativeEvent.locationX / scrubberWidth),
    onPanResponderMove: event => selectReplayProgress(event.nativeEvent.locationX / scrubberWidth),
  }), [scrubberWidth, selectReplayProgress]);

  if (!route) return <>{fallback}</>;

  const locatedCount = songMoments.length;
  const replayProgress = replaySnapshot?.progress ?? 0;
  const popupSong = selectedSong;

  return <View style={styles.experience}>
    <View style={styles.mapFrame} accessibilityLabel="Interactive journey map">
      {mapFailed ? fallback : <Map
        ref={mapRef}
        mapStyle={(mapStyle ?? OPEN_FREE_MAP_DARK_STYLE) as never}
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
          <Layer id="journey-route-bloom" type="line" paint={{ 'line-color': '#ff3d75', 'line-width': 16, 'line-opacity': 0.52, 'line-blur': 9 }} />
          <Layer id="journey-route-shadow" type="line" paint={{ 'line-color': '#5b143d', 'line-width': 9, 'line-opacity': 0.7 }} />
          <Layer id="journey-route-line" type="line" paint={{ 'line-color': '#ff684f', 'line-width': 5, 'line-opacity': 0.95 }} />
        </GeoJSONSource>
        <Marker id="journey-start" lngLat={route.start} anchor="center" onPress={event => {
          event.stopPropagation();
          setTerminalSelection('start');
          onSelectSong?.(null);
        }}><TerminalMarker kind="start" /></Marker>
        <Marker id="journey-end" lngLat={route.end} anchor="center" onPress={event => {
          event.stopPropagation();
          setTerminalSelection('end');
          onSelectSong?.(null);
        }}><TerminalMarker kind="end" /></Marker>
        {songMoments.map(moment => <Marker
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
        ><SongMarker index={moment.index} selected={moment.index === selectedSongIndex} /></Marker>)}
        {queryCoordinate && <Marker id="journey-nearby-query" lngLat={queryCoordinate} anchor="center"><View style={styles.queryMarker}><View style={styles.queryMarkerCore} /></View></Marker>}
        {replaySnapshot && <Marker id="journey-replay-position" lngLat={replaySnapshot.coordinate} anchor="center"><View style={[styles.carMarker, { transform: [{ rotate: `${replaySnapshot.headingDegrees ?? 0}deg` }] }]}><Text style={styles.carMarkerText}>▲</Text></View></Marker>}
      </Map>}
      {!mapFailed && <View pointerEvents="none" style={styles.mapTint} />}
      <View pointerEvents="none" style={styles.mapStatus}><Text style={styles.mapStatusText}>{coordinates.length} route points · {locatedCount}/{totalSongCount} songs located</Text></View>
      {!mapFailed && <View style={styles.mapControls}>
        <Pressable accessibilityLabel="Zoom in" onPress={() => void zoomBy(1)} style={styles.mapControl}><Text style={styles.mapControlText}>＋</Text></Pressable>
        <Pressable accessibilityLabel="Zoom out" onPress={() => void zoomBy(-1)} style={styles.mapControl}><Text style={styles.mapControlText}>−</Text></Pressable>
        <Pressable accessibilityLabel="Show the full route" onPress={fitRoute} style={styles.mapControl}><Text style={styles.mapControlArrow}>⌖</Text></Pressable>
      </View>}
      {!mapReady && !mapFailed && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#a98cff" /><Text style={styles.loadingText}>Styling your route…</Text></View>}
      {(popupSong || terminalSelection) && <View style={styles.popup}>
        {popupSong ? <>
          <Text style={styles.popupKicker}>SONG {popupSong.index} · {formatClock(popupSong.playedAt)}</Text>
          <Text style={styles.popupTitle} numberOfLines={1}>{popupSong.track}</Text>
          <Text style={styles.popupDetail} numberOfLines={1}>{popupSong.artist}</Text>
        </> : <>
          <Text style={styles.popupKicker}>{terminalSelection === 'start' ? 'JOURNEY START' : 'JOURNEY END'}</Text>
          <Text style={styles.popupTitle} numberOfLines={2}>{terminalSelection === 'start' ? (startLabel ?? 'Starting point') : (endLabel ?? 'Destination')}</Text>
          <Text style={styles.popupDetail}>{formatClock(terminalSelection === 'start' ? startedAt : endedAt)}</Text>
        </>}
      </View>}
    </View>

    <View style={styles.attributionRow}>
      <Text style={styles.attribution}>Built with </Text><AttributionLink label="MapLibre" url="https://maplibre.org/" />
      <Text style={styles.attribution}> · </Text><AttributionLink label="OpenFreeMap" url="https://openfreemap.org/" />
      <Text style={styles.attribution}> · © </Text><AttributionLink label="OpenStreetMap" url="https://www.openstreetmap.org/copyright" />
    </View>
    <View style={styles.legend}>
      <LegendItem color="#ff765c" label="Exact recorded route" line />
      <LegendItem color="#a565ff" label="Song start" numbered />
      <LegendItem color="#43e6ae" label="Start" />
      <LegendItem color="#ff5f67" label="End" />
    </View>
    <Text style={styles.mapHint}>Tap anywhere on the map for nearby music</Text>

    {queryCoordinate && <View style={styles.nearbyPanel}>
      <View style={styles.nearbyHeader}><View><Text style={styles.panelKicker}>NEARBY MUSIC</Text><Text style={styles.panelTitle}>{nearbySongs.length ? `${nearbySongs.length} soundtrack moment${nearbySongs.length === 1 ? '' : 's'}` : 'No songs in this radius'}</Text></View><Pressable onPress={() => setQueryCoordinate(null)}><Text style={styles.closeText}>×</Text></Pressable></View>
      <View style={styles.radiusRow}>{nearbyRadii.map(radius => <Pressable key={radius} onPress={() => setNearbyRadius(radius)} style={[styles.radiusChip, radius === nearbyRadius && styles.radiusChipActive]}><Text style={[styles.radiusText, radius === nearbyRadius && styles.radiusTextActive]}>{radius} mi</Text></Pressable>)}</View>
      {nearbySongs.slice(0, 8).map(moment => <Pressable key={`${moment.index}-${moment.playedAt}`} onPress={() => onSelectSong?.(moment.index)} style={styles.nearbySong}>
        <View style={styles.nearbyNumber}><Text style={styles.nearbyNumberText}>{moment.index}</Text></View><View style={styles.flex}><Text style={styles.nearbyTrack} numberOfLines={1}>{moment.track}</Text><Text style={styles.nearbyArtist} numberOfLines={1}>{moment.artist}</Text></View><Text style={styles.nearbyDistance}>{moment.distanceMiles < 0.1 ? '<0.1' : moment.distanceMiles.toFixed(1)} mi</Text>
      </Pressable>)}
    </View>}

    <Text style={styles.privacyCopy}>Route and song coordinates stay in your local JourneyDeck library. OpenFreeMap supplies only the basemap underneath them.</Text>

    {replaySnapshot && <View style={styles.replayPanel}>
      <View style={styles.replayNowPlaying}>
        {replaySong?.artworkUrl ? <Image source={replaySong.artworkUrl} style={styles.replayArtwork} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.replayArtworkFallback}><Text style={styles.replayArtworkNote}>♪</Text></View>}
        <View style={styles.flex}><Text style={styles.panelKicker}>JOURNEY REPLAY · {formatClock(new Date(replayTimestamp).toISOString())}</Text><Text style={styles.replayTrack} numberOfLines={1}>{replaySong?.track ?? 'Between soundtrack moments'}</Text><Text style={styles.replayArtist} numberOfLines={1}>{replaySong?.artist ?? 'Follow the recorded route'}</Text></View>
      </View>
      <View style={styles.telemetryRow}>
        <Telemetry value={replaySnapshot.speedMph == null ? '—' : `${Math.round(replaySnapshot.speedMph)}`} label="MPH" />
        <Telemetry value={replaySnapshot.batteryPercent == null ? '—' : `${Math.round(replaySnapshot.batteryPercent)}%`} label="BATTERY" />
        <Telemetry value={`${Math.round(replayProgress * 100)}%`} label="JOURNEY" />
      </View>
      <View onLayout={event => setScrubberWidth(Math.max(1, event.nativeEvent.layout.width))} style={styles.scrubberHitArea} {...scrubberResponder.panHandlers}>
        <View style={styles.scrubberTrack}><View style={[styles.scrubberFill, { width: `${Math.max(0, Math.min(100, replayProgress * 100))}%` }]} /><View style={[styles.scrubberThumb, { left: `${Math.max(0, Math.min(100, replayProgress * 100))}%` }]} /></View>
      </View>
      <View style={styles.replayControls}>
        <Pressable accessibilityLabel="Restart replay" onPress={() => { setReplayPlaying(false); setReplayTimestamp(firstReplayTime); }} style={styles.replayButton}><Text style={styles.replayButtonText}>↺</Text></Pressable>
        <Pressable accessibilityLabel={replayPlaying ? 'Pause replay' : 'Play replay'} onPress={() => {
          if (replayTimestamp >= lastReplayTime) setReplayTimestamp(firstReplayTime);
          setReplayPlaying(current => !current);
        }} style={styles.replayPrimary}><Text style={styles.replayPrimaryText}>{replayPlaying ? 'Ⅱ' : '▶'}</Text></Pressable>
        <View style={styles.rateRow}>{replayRates.map(rate => <Pressable key={rate} onPress={() => setReplayRate(rate)} style={[styles.rateButton, rate === replayRate && styles.rateButtonActive]}><Text style={[styles.rateText, rate === replayRate && styles.rateTextActive]}>{rate}×</Text></Pressable>)}</View>
      </View>
      <Text style={styles.replayFootnote}>{routeSamples && routeSamples.length >= 2 ? 'Replay uses recorded vehicle telemetry.' : 'Replay timing, speed, and heading are estimated from this saved route.'}</Text>
    </View>}
  </View>;
}

function TerminalMarker({ kind }: { kind: 'start' | 'end' }) {
  return <View style={[styles.terminalGlow, kind === 'end' && styles.terminalGlowEnd]}><View style={[styles.terminalCore, kind === 'end' && styles.terminalCoreEnd]} /></View>;
}

function SongMarker({ index, selected }: { index: number; selected: boolean }) {
  return <View style={[styles.songMarkerGlow, selected && styles.songMarkerGlowSelected]}><View style={[styles.songMarker, selected && styles.songMarkerSelected]}><Text style={styles.songMarkerText}>{index}</Text></View></View>;
}

function AttributionLink({ label, url }: { label: string; url: string }) {
  return <Pressable onPress={() => void Linking.openURL(url)}><Text style={styles.attributionLink}>{label}</Text></Pressable>;
}

function LegendItem({ color, label, line, numbered }: { color: string; label: string; line?: boolean; numbered?: boolean }) {
  return <View style={styles.legendItem}>{line ? <View style={[styles.legendLine, { backgroundColor: color }]} /> : <View style={[styles.legendDot, { backgroundColor: color }]}>{numbered && <Text style={styles.legendNumber}>1</Text>}</View>}<Text style={styles.legendText}>{label}</Text></View>;
}

function Telemetry({ value, label }: { value: string; label: string }) {
  return <View style={styles.telemetry}><Text style={styles.telemetryValue}>{value}</Text><Text style={styles.telemetryLabel}>{label}</Text></View>;
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

const styles = StyleSheet.create({
  experience: { gap: 12 },
  mapFrame: { height: 430, borderRadius: 18, overflow: 'hidden', backgroundColor: '#010104', borderWidth: 1, borderColor: '#40204d' },
  mapTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 2, 18, 0.08)' },
  mapStatus: { position: 'absolute', left: 12, top: 12, maxWidth: '72%', borderRadius: 999, backgroundColor: '#08050de8', borderWidth: 1, borderColor: '#6d387d', paddingHorizontal: 10, paddingVertical: 6 },
  mapStatusText: { color: '#b9a8c2', fontSize: 9, fontWeight: '800', letterSpacing: 0.25 },
  mapControls: { position: 'absolute', right: 12, top: 12, overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#63356d', backgroundColor: '#09050ee8' },
  mapControl: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#5e3b66' },
  mapControlText: { color: '#f2e9f5', fontSize: 24, fontWeight: '500' },
  mapControlArrow: { color: '#e9d9ef', fontSize: 20, fontWeight: '900' },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#050208ee' },
  loadingText: { color: '#c2b2c8', fontSize: 11, fontWeight: '800' },
  popup: { position: 'absolute', left: 12, right: 68, bottom: 14, minHeight: 72, borderRadius: 15, borderWidth: 1, borderColor: '#71437a', backgroundColor: '#09050ff2', paddingHorizontal: 13, paddingVertical: 11 },
  popupKicker: { color: '#ff8d72', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  popupTitle: { color: '#fff7ff', fontSize: 15, fontWeight: '900', marginTop: 4 },
  popupDetail: { color: '#aa9caf', fontSize: 11, fontWeight: '700', marginTop: 3 },
  terminalGlow: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#43e6ae44', alignItems: 'center', justifyContent: 'center' },
  terminalGlowEnd: { backgroundColor: '#ff5f6744' },
  terminalCore: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#43e6ae', borderWidth: 2, borderColor: '#eafff8' },
  terminalCoreEnd: { backgroundColor: '#ff5f67', borderColor: '#fff0f1' },
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
  privacyCopy: { color: '#716778', fontSize: 10, lineHeight: 15, paddingHorizontal: 4 },
  replayPanel: { borderRadius: 20, borderWidth: 1, borderColor: '#4e2d58', backgroundColor: '#0b0710', padding: 15, gap: 13 },
  replayNowPlaying: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  replayArtwork: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#211729' },
  replayArtworkFallback: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#24152f', alignItems: 'center', justifyContent: 'center' },
  replayArtworkNote: { color: '#c49aff', fontSize: 24, fontWeight: '900' },
  replayTrack: { color: '#fff7ff', fontSize: 14, fontWeight: '900', marginTop: 4 },
  replayArtist: { color: '#95899a', fontSize: 10, fontWeight: '700', marginTop: 3 },
  telemetryRow: { flexDirection: 'row', borderRadius: 14, backgroundColor: '#130d18', paddingVertical: 10 },
  telemetry: { flex: 1, alignItems: 'center', gap: 3, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#4b374e' },
  telemetryValue: { color: '#f6eff8', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  telemetryLabel: { color: '#806f84', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  scrubberHitArea: { paddingVertical: 10 },
  scrubberTrack: { height: 5, borderRadius: 3, backgroundColor: '#302538' },
  scrubberFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: '#ff765c' },
  scrubberThumb: { position: 'absolute', top: -5, marginLeft: -7, width: 15, height: 15, borderRadius: 8, backgroundColor: '#fff4ef', borderWidth: 3, borderColor: '#ff765c' },
  replayControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  replayButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1220' },
  replayButtonText: { color: '#d7c8db', fontSize: 21, fontWeight: '800' },
  replayPrimary: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff765c', shadowColor: '#ff5f67', shadowOpacity: 0.5, shadowRadius: 10 },
  replayPrimaryText: { color: '#19070b', fontSize: 18, fontWeight: '900' },
  rateRow: { flexDirection: 'row', gap: 5 },
  rateButton: { minWidth: 34, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#49344f' },
  rateButtonActive: { backgroundColor: '#9a55ef', borderColor: '#c49aff' },
  rateText: { color: '#8c7e91', fontSize: 9, fontWeight: '900' },
  rateTextActive: { color: '#13051b' },
  replayFootnote: { color: '#655c6a', fontSize: 8, lineHeight: 12, textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
