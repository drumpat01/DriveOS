import type { JourneyMarker } from './journey-marker-store';
import { SymbolView } from 'expo-symbols';
import { useAppTheme, useThemedStyles } from './app-theme';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  Animated as MapLibreAnimated, Camera, GeoJSONSource, Layer, LayerAnnotation, Map, Marker,
  type CameraRef, type MapRef,
} from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { journeyDeckMapPalette, loadJourneyDeckMapStyle, OPEN_FREE_MAP_DARK_STYLE, OPEN_FREE_MAP_LIGHT_STYLE, type JourneyDeckMapStyle } from './journey-map-theme';
import { NeonWidgetOutline } from './neon-widget-outline';

type RouteLine = { id: string; coordinates: [number, number][] };
type MapPlace = { id: string; name: string; coordinate: [number, number]; count?: number };
type MapSongMoment = { index: number; coordinate: [number, number]; track: string; artist: string; artworkUrl: string | null };

function AnimatedLiveRoute({ route, palette }: { route: RouteLine; palette: ReturnType<typeof journeyDeckMapPalette> }) {
  const animation = useMemo(() => {
    const first = route.coordinates[0] ?? [0, 0] as [number, number];
    const coordinates = new MapLibreAnimated.CoordinatesArray([first, first]);
    return {
      coordinates,
      data: new MapLibreAnimated.GeoJSON({ type: 'LineString', coordinates }),
    };
  }, [route.id]);

  useEffect(() => {
    const transition = animation.coordinates.timing({
      toValue: route.coordinates,
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    transition.start();
    return () => transition.stop();
  }, [animation, route.coordinates]);

  return <MapLibreAnimated.GeoJSONSource id="primary-live-route" data={animation.data}>
    <Layer id="primary-live-route-glow" type="line" paint={{ 'line-color': palette.routeGlow, 'line-width': 16, 'line-opacity': 0.5, 'line-blur': 9 }} />
    <Layer id="primary-live-route-shadow" type="line" paint={{ 'line-color': palette.routeShadow, 'line-width': 8, 'line-opacity': 0.84 }} />
    <Layer id="primary-live-route-line" type="line" paint={{ 'line-color': palette.routeLine, 'line-width': 4.8, 'line-opacity': 1 }} />
  </MapLibreAnimated.GeoJSONSource>;
}

export function PrimaryMobilityMap({
  routes,
  places = [],
  songMoments = [],
  markers = [],
  animateLiveRoute = false,
  currentCoordinate,
  currentHeading = 0,
  height = 300,
  cameraPitch = 0,
  cameraPadding = 42,
  minimumBoundsSpan = 0.01,
  emptyMessage = 'A map will appear after JourneyDeck has recorded location data.',
}: {
  routes: RouteLine[];
  places?: MapPlace[];
  songMoments?: MapSongMoment[];
  markers?: JourneyMarker[];
  animateLiveRoute?: boolean;
  currentCoordinate?: [number, number] | null;
  currentHeading?: number | null;
  height?: number;
  cameraPitch?: number;
  cameraPadding?: number;
  minimumBoundsSpan?: number;
  emptyMessage?: string;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const mapPalette = journeyDeckMapPalette(theme.id);

  const camera = useRef<CameraRef>(null), map = useRef<MapRef>(null);
  const [mapStyle, setMapStyle] = useState<JourneyDeckMapStyle | null>(null);
  const [failed, setFailed] = useState(false), [ready, setReady] = useState(false);
  const [selectedSongIndex, setSelectedSongIndex] = useState<number | null>(null);
  const validSongMoments = useMemo(() => songMoments.filter(moment => validCoordinate(moment.coordinate)), [songMoments]);
  const selectedSong = validSongMoments.find(moment => moment.index === selectedSongIndex) ?? null;
  const liveRoute = animateLiveRoute && routes[0]?.coordinates.length > 1 ? routes[0] : null;
  const staticRoutes = liveRoute ? routes.slice(1) : routes;
  const viewportGeometry = useMemo(() => buildGeometry(routes, places, validSongMoments.map(moment => moment.coordinate), currentCoordinate, minimumBoundsSpan), [currentCoordinate, minimumBoundsSpan, places, routes, validSongMoments]);
  const geometry = useMemo(() => {
    const visible = buildGeometry(staticRoutes, places, validSongMoments.map(moment => moment.coordinate), currentCoordinate, minimumBoundsSpan);
    return { ...visible, bounds: viewportGeometry.bounds };
  }, [currentCoordinate, minimumBoundsSpan, places, staticRoutes, validSongMoments, viewportGeometry.bounds]);

  useEffect(() => {
    let mounted = true;
    void loadJourneyDeckMapStyle(fetch, theme.id).then(style => { if (mounted) setMapStyle(style); });
    return () => { mounted = false; };
  }, [theme.id]);

  const fit = useCallback(() => {
    if (!geometry.bounds) return;
    camera.current?.fitBounds(geometry.bounds, { padding: { top: cameraPadding, right: cameraPadding, bottom: cameraPadding, left: cameraPadding }, duration: 450 });
  }, [cameraPadding, geometry.bounds]);

  const zoomBy = useCallback(async (delta: number) => {
    try {
      const zoom = await map.current?.getZoom();
      if (typeof zoom === 'number') camera.current?.zoomTo(Math.max(2, Math.min(19, zoom + delta)), { duration: 220 });
    } catch { /* The view may be closing. */ }
  }, []);

  if (!geometry.bounds) return <View style={[styles.empty, { height }]}><NeonWidgetOutline radius={25} /><Text style={styles.emptyTitle}>MAP WAITING FOR DATA</Text><Text style={styles.emptyBody}>{emptyMessage}</Text></View>;
  if (failed) return <View style={[styles.empty, { height }]}><NeonWidgetOutline radius={25} /><Text style={styles.emptyTitle}>MAP TEMPORARILY UNAVAILABLE</Text><Text style={styles.emptyBody}>Your route data is still safe on this iPhone.</Text></View>;

  return <View style={[styles.frame, { height }]}><NeonWidgetOutline radius={25} tone="hero" />
    <Map
      ref={map}
      mapStyle={(mapStyle ?? (theme.isLight ? OPEN_FREE_MAP_LIGHT_STYLE : OPEN_FREE_MAP_DARK_STYLE)) as never}
      style={StyleSheet.absoluteFill}
      attribution={false}
      logo={false}
      compass={false}
      scaleBar={false}
      touchRotate={false}
      touchPitch={false}
      onPress={() => setSelectedSongIndex(null)}
      onDidFinishLoadingMap={() => setReady(true)}
      onDidFailLoadingMap={() => setFailed(true)}
    >
      <Camera ref={camera} initialViewState={{ bounds: geometry.bounds, pitch: cameraPitch, padding: { top: cameraPadding, right: cameraPadding, bottom: cameraPadding, left: cameraPadding } }} />
      {geometry.lines.features.length > 0 && <GeoJSONSource id="primary-mobility-routes" data={geometry.lines}>
        <Layer id="primary-route-glow" type="line" paint={{ 'line-color': mapPalette.routeGlow, 'line-width': 14, 'line-opacity': 0.46, 'line-blur': 8 }} />
        <Layer id="primary-route-shadow" type="line" paint={{ 'line-color': mapPalette.routeShadow, 'line-width': 8, 'line-opacity': 0.8 }} />
        <Layer id="primary-route-line" type="line" paint={{ 'line-color': mapPalette.routeLine, 'line-width': 4.5, 'line-opacity': 0.98 }} />
      </GeoJSONSource>}
      {liveRoute && <AnimatedLiveRoute key={liveRoute.id} route={liveRoute} palette={mapPalette} />}
      {geometry.points.features.length > 0 && <GeoJSONSource id="primary-mobility-places" data={geometry.points} cluster clusterRadius={44} clusterMaxZoom={13}>
        <Layer id="primary-place-cluster-glow" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': '#a653ff', 'circle-radius': ['step', ['get', 'point_count'], 25, 10, 31, 50, 38, 250, 46], 'circle-blur': 0.72, 'circle-opacity': 0.62 }} />
        <Layer id="primary-place-cluster" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': '#8f45e8', 'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 50, 26, 250, 31], 'circle-stroke-color': '#d2a3ff', 'circle-stroke-width': 2, 'circle-opacity': 0.94 }} />
        <Layer id="primary-place-cluster-count" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': ['to-string', ['get', 'point_count_abbreviated']], 'text-size': 11, 'text-font': ['Noto Sans Regular'] }} paint={{ 'text-color': '#ffffff' }} />
        <Layer id="primary-place-dot" type="circle" filter={['!', ['has', 'point_count']]} paint={{ 'circle-color': '#8f45e8', 'circle-radius': 13, 'circle-stroke-color': '#d2a3ff', 'circle-stroke-width': 2, 'circle-opacity': 0.94 }} />
        <Layer id="primary-place-count" type="symbol" filter={['!', ['has', 'point_count']]} layout={{ 'text-field': ['to-string', ['get', 'count']], 'text-size': 10, 'text-font': ['Noto Sans Regular'] }} paint={{ 'text-color': '#ffffff' }} />
      </GeoJSONSource>}
      {currentCoordinate && <LayerAnnotation id="live-position" lngLat={currentCoordinate} animated={animateLiveRoute} animationDuration={900} animationEasingFunction={Easing.out(Easing.cubic)}>
        <Layer id="live-position-glow" type="circle" paint={{ 'circle-color': '#ff334f', 'circle-radius': 23, 'circle-blur': 0.68, 'circle-opacity': 0.76 }} />
        <Layer id="live-position-body" type="circle" paint={{ 'circle-color': '#ff4d57', 'circle-radius': 17, 'circle-stroke-color': '#ffd6d7', 'circle-stroke-width': 3, 'circle-opacity': 1 }} />
        <Layer id="live-position-arrow" type="symbol" layout={{ 'text-field': '▲', 'text-size': 17, 'text-rotate': currentHeading ?? 0, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true }} paint={{ 'text-color': '#ffffff' }} />
      </LayerAnnotation>}
      {markers.map((marker, index) => <Marker id={`live-marker-${marker.id}`} key={marker.id} lngLat={[marker.longitude, marker.latitude]} anchor="bottom">
        <View accessibilityLabel={`Saved marker ${index + 1}`} style={{ width: 38, height: 44, borderRadius: 6, borderWidth: 2, borderColor: mapPalette.routeLine, backgroundColor: theme.palette.card, alignItems: 'center', justifyContent: 'center', shadowColor: mapPalette.routeGlow, shadowOpacity: 0.95, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } }}>
          <SymbolView name="photo" tintColor={theme.palette.accent} size={24} />
        </View>
      </Marker>)}
      {validSongMoments.map(moment => <Marker
        id={`live-song-${moment.index}`}
        key={`${moment.index}-${moment.coordinate.join(',')}`}
        lngLat={moment.coordinate}
        anchor="center"
        onPress={event => { event.stopPropagation(); setSelectedSongIndex(moment.index); }}
      ><View style={[styles.songMarkerGlow, selectedSongIndex === moment.index && styles.songMarkerGlowSelected]}><View style={[styles.songMarker, selectedSongIndex === moment.index && styles.songMarkerSelected]}><Text style={styles.songMarkerText}>{moment.index}</Text></View></View></Marker>)}
    </Map>
    <View pointerEvents="none" style={styles.tint} />
    <View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}>JOURNEYDECK MAP</Text></View>
    <View style={styles.controls}>
      <Pressable accessibilityLabel="Zoom in" style={styles.control} onPress={() => void zoomBy(1)}><Text style={styles.controlText}>＋</Text></Pressable>
      <Pressable accessibilityLabel="Zoom out" style={styles.control} onPress={() => void zoomBy(-1)}><Text style={styles.controlText}>−</Text></Pressable>
      <Pressable accessibilityLabel="Show all routes" style={styles.control} onPress={fit}><Text style={styles.controlTarget}>⌖</Text></Pressable>
    </View>
    {selectedSong && <View style={styles.songPopup}>
      {selectedSong.artworkUrl ? <Image source={selectedSong.artworkUrl} style={styles.songArtwork} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[styles.songArtwork, styles.songArtworkFallback]}><Text style={styles.songArtworkNote}>♪</Text></View>}
      <View style={styles.songCopy}><Text style={styles.songTrack} numberOfLines={1}>{selectedSong.track}</Text><Text style={styles.songArtist} numberOfLines={1}>{selectedSong.artist}</Text></View>
    </View>}
    {!ready && <View style={styles.loading}><ActivityIndicator color={theme.color("#b993ff", 'text')} /><Text style={styles.loadingText}>Opening your map…</Text></View>}
    <Text style={styles.attribution}>OpenFreeMap · © OpenStreetMap</Text>
  </View>;
}

function validCoordinate(value: [number, number]) {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

function buildGeometry(routes: RouteLine[], places: MapPlace[], songCoordinates: [number, number][], currentCoordinate?: [number, number] | null, minimumBoundsSpan = 0.01) {
  const features: Feature<LineString>[] = [], pointFeatures: Feature<Point, { count: number }>[] = [], all: [number, number][] = [];
  for (const route of routes) {
    const coordinates = route.coordinates.filter(validCoordinate);
    if (coordinates.length < 2) continue;
    all.push(...coordinates);
    features.push({ type: 'Feature', id: route.id, properties: {}, geometry: { type: 'LineString', coordinates } });
  }
  for (const place of places) {
    if (!validCoordinate(place.coordinate)) continue;
    all.push(place.coordinate);
    pointFeatures.push({ type: 'Feature', id: place.id, properties: { count: place.count ?? 1 }, geometry: { type: 'Point', coordinates: place.coordinate } });
  }
  all.push(...songCoordinates.filter(validCoordinate));
  if (currentCoordinate && validCoordinate(currentCoordinate)) all.push(currentCoordinate);
  const collection: FeatureCollection<LineString> = { type: 'FeatureCollection', features };
  const points: FeatureCollection<Point, { count: number }> = { type: 'FeatureCollection', features: pointFeatures };
  if (!all.length) return { lines: collection, points, bounds: null as [number, number, number, number] | null };
  let west = all[0][0], east = all[0][0], south = all[0][1], north = all[0][1];
  for (const [longitude, latitude] of all.slice(1)) {
    west = Math.min(west, longitude); east = Math.max(east, longitude); south = Math.min(south, latitude); north = Math.max(north, latitude);
  }
  if (west === east) { west -= minimumBoundsSpan; east += minimumBoundsSpan; }
  if (south === north) { south -= minimumBoundsSpan; north += minimumBoundsSpan; }
  return { lines: collection, points, bounds: [west, south, east, north] as [number, number, number, number] };
}

const darkStyles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: 25, borderWidth: 1, borderColor: '#4b255f', backgroundColor: '#040107' },
  empty: { borderRadius: 25, borderWidth: 1, borderColor: '#392346', backgroundColor: '#09050e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: '#bc8cff', fontSize: 11, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  emptyBody: { color: '#81788b', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,2,27,0.12)' },
  badge: { position: 'absolute', left: 14, top: 14, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(8,2,12,0.86)', borderWidth: 1, borderColor: '#63327a' },
  badgeText: { color: '#f2dffc', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  controls: { position: 'absolute', right: 13, top: 13, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#543064' },
  control: { width: 42, height: 39, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,3,12,0.9)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#543064' },
  controlText: { color: '#d9c5e2', fontSize: 22, fontWeight: '300' },
  controlTarget: { color: '#d9c5e2', fontSize: 18 },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,1,6,0.76)', gap: 10 },
  loadingText: { color: '#b9a8c4', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  attribution: { position: 'absolute', left: 12, bottom: 8, color: '#7b6b84', fontSize: 8 },
  currentMarker: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff4d57', borderWidth: 3, borderColor: '#ffd6d7', shadowColor: '#ff334f', shadowOpacity: 0.9, shadowRadius: 12 },
  currentArrow: { color: '#fff', fontSize: 17, fontWeight: '900' },
  songMarkerGlow: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7c38d955', alignItems: 'center', justifyContent: 'center' },
  songMarkerGlowSelected: { backgroundColor: '#ff604f66' },
  songMarker: { minWidth: 25, height: 25, borderRadius: 13, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9a55ef', borderWidth: 2, borderColor: '#d6b7ff' },
  songMarkerSelected: { backgroundColor: '#ff765c', borderColor: '#fff4ef' },
  songMarkerText: { color: '#100518', fontSize: 10, fontWeight: '900', fontVariant: ['tabular-nums'] },
  songPopup: { position: 'absolute', left: 13, right: 68, bottom: 23, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: '#71437a', backgroundColor: '#09050ff2', padding: 8 },
  songArtwork: { width: 40, height: 40, borderRadius: 8 },
  songArtworkFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a1238' },
  songArtworkNote: { color: '#d6b7ff', fontSize: 18, fontWeight: '900' },
  songCopy: { flex: 1, minWidth: 0 },
  songTrack: { color: '#fff7ff', fontSize: 13, fontWeight: '900' },
  songArtist: { color: '#aa9caf', fontSize: 10, fontWeight: '700', marginTop: 3 },
});
