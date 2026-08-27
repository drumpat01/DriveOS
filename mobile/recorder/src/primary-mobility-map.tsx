import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { loadJourneyDeckMapStyle, OPEN_FREE_MAP_DARK_STYLE, type JourneyDeckMapStyle } from './journey-map-theme';

type RouteLine = { id: string; coordinates: [number, number][] };
type MapPlace = { id: string; name: string; coordinate: [number, number]; count?: number };

export function PrimaryMobilityMap({
  routes,
  places = [],
  currentCoordinate,
  currentHeading = 0,
  height = 300,
  emptyMessage = 'A map will appear after JourneyDeck has recorded location data.',
}: {
  routes: RouteLine[];
  places?: MapPlace[];
  currentCoordinate?: [number, number] | null;
  currentHeading?: number | null;
  height?: number;
  emptyMessage?: string;
}) {
  const camera = useRef<CameraRef>(null), map = useRef<MapRef>(null);
  const [mapStyle, setMapStyle] = useState<JourneyDeckMapStyle | null>(null);
  const [failed, setFailed] = useState(false), [ready, setReady] = useState(false);
  const geometry = useMemo(() => buildGeometry(routes, places, currentCoordinate), [currentCoordinate, places, routes]);

  useEffect(() => {
    let mounted = true;
    void loadJourneyDeckMapStyle().then(style => { if (mounted) setMapStyle(style); });
    return () => { mounted = false; };
  }, []);

  const fit = useCallback(() => {
    if (!geometry.bounds) return;
    camera.current?.fitBounds(geometry.bounds, { padding: { top: 44, right: 38, bottom: 44, left: 38 }, duration: 450 });
  }, [geometry.bounds]);

  const zoomBy = useCallback(async (delta: number) => {
    try {
      const zoom = await map.current?.getZoom();
      if (typeof zoom === 'number') camera.current?.zoomTo(Math.max(2, Math.min(19, zoom + delta)), { duration: 220 });
    } catch { /* The view may be closing. */ }
  }, []);

  if (!geometry.bounds) return <View style={[styles.empty, { height }]}><Text style={styles.emptyTitle}>MAP WAITING FOR DATA</Text><Text style={styles.emptyBody}>{emptyMessage}</Text></View>;
  if (failed) return <View style={[styles.empty, { height }]}><Text style={styles.emptyTitle}>MAP TEMPORARILY UNAVAILABLE</Text><Text style={styles.emptyBody}>Your route data is still safe on this iPhone.</Text></View>;

  return <View style={[styles.frame, { height }]}>
    <Map
      ref={map}
      mapStyle={(mapStyle ?? OPEN_FREE_MAP_DARK_STYLE) as never}
      style={StyleSheet.absoluteFill}
      attribution={false}
      logo={false}
      compass={false}
      scaleBar={false}
      touchRotate={false}
      touchPitch={false}
      onDidFinishLoadingMap={() => setReady(true)}
      onDidFailLoadingMap={() => setFailed(true)}
    >
      <Camera ref={camera} initialViewState={{ bounds: geometry.bounds, padding: { top: 42, right: 36, bottom: 42, left: 36 } }} />
      {geometry.lines.features.length > 0 && <GeoJSONSource id="primary-mobility-routes" data={geometry.lines}>
        <Layer id="primary-route-glow" type="line" paint={{ 'line-color': '#a43fff', 'line-width': 14, 'line-opacity': 0.4, 'line-blur': 8 }} />
        <Layer id="primary-route-shadow" type="line" paint={{ 'line-color': '#5d236f', 'line-width': 8, 'line-opacity': 0.8 }} />
        <Layer id="primary-route-line" type="line" paint={{ 'line-color': '#ff6750', 'line-width': 4.5, 'line-opacity': 0.96 }} />
      </GeoJSONSource>}
      {places.map(place => <Marker key={place.id} id={`atlas-place-${place.id}`} lngLat={place.coordinate} anchor="center">
        <View style={styles.placeMarker}><Text style={styles.placeCount}>{place.count ?? '•'}</Text></View>
      </Marker>)}
      {currentCoordinate && <Marker id="live-position" lngLat={currentCoordinate} anchor="center">
        <View style={[styles.currentMarker, { transform: [{ rotate: `${currentHeading ?? 0}deg` }] }]}><Text style={styles.currentArrow}>▲</Text></View>
      </Marker>}
    </Map>
    <View pointerEvents="none" style={styles.tint} />
    <View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}>JOURNEYDECK MAP</Text></View>
    <View style={styles.controls}>
      <Pressable accessibilityLabel="Zoom in" style={styles.control} onPress={() => void zoomBy(1)}><Text style={styles.controlText}>＋</Text></Pressable>
      <Pressable accessibilityLabel="Zoom out" style={styles.control} onPress={() => void zoomBy(-1)}><Text style={styles.controlText}>−</Text></Pressable>
      <Pressable accessibilityLabel="Show all routes" style={styles.control} onPress={fit}><Text style={styles.controlTarget}>⌖</Text></Pressable>
    </View>
    {!ready && <View style={styles.loading}><ActivityIndicator color="#b993ff" /><Text style={styles.loadingText}>Opening your map…</Text></View>}
    <Text style={styles.attribution}>OpenFreeMap · © OpenStreetMap</Text>
  </View>;
}

function validCoordinate(value: [number, number]) {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

function buildGeometry(routes: RouteLine[], places: MapPlace[], currentCoordinate?: [number, number] | null) {
  const features: Feature<LineString>[] = [], all: [number, number][] = [];
  for (const route of routes) {
    const coordinates = route.coordinates.filter(validCoordinate);
    if (coordinates.length < 2) continue;
    all.push(...coordinates);
    features.push({ type: 'Feature', id: route.id, properties: {}, geometry: { type: 'LineString', coordinates } });
  }
  for (const place of places) if (validCoordinate(place.coordinate)) all.push(place.coordinate);
  if (currentCoordinate && validCoordinate(currentCoordinate)) all.push(currentCoordinate);
  const collection: FeatureCollection<LineString> = { type: 'FeatureCollection', features };
  if (!all.length) return { lines: collection, bounds: null as [number, number, number, number] | null };
  let west = all[0][0], east = all[0][0], south = all[0][1], north = all[0][1];
  for (const [longitude, latitude] of all.slice(1)) {
    west = Math.min(west, longitude); east = Math.max(east, longitude); south = Math.min(south, latitude); north = Math.max(north, latitude);
  }
  if (west === east) { west -= 0.01; east += 0.01; }
  if (south === north) { south -= 0.01; north += 0.01; }
  return { lines: collection, bounds: [west, south, east, north] as [number, number, number, number] };
}

const styles = StyleSheet.create({
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
  placeMarker: { minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8f45e8', borderWidth: 2, borderColor: '#d2a3ff', shadowColor: '#a653ff', shadowOpacity: 0.8, shadowRadius: 9 },
  placeCount: { color: '#fff', fontSize: 11, fontWeight: '900' },
  currentMarker: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff4d57', borderWidth: 3, borderColor: '#ffd6d7', shadowColor: '#ff334f', shadowOpacity: 0.9, shadowRadius: 12 },
  currentArrow: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
