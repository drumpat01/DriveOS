import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, LineString } from 'geojson';
import { useAppTheme } from './app-theme';
import { loadJourneyDeckMapStyle, OPEN_FREE_MAP_DARK_STYLE, OPEN_FREE_MAP_LIGHT_STYLE, type JourneyDeckMapStyle } from './journey-map-theme';
import { RouteSketch, useRedesignColors } from './redesign-ui';

type MemoryRoute = { id: string; coordinates: [number, number][]; color: string };

/** A single map and route layer for every recorded drive in a Memory. */
export function MemoryRouteMap({ routes, width, height = 220 }: { routes: MemoryRoute[]; width: number; height?: number }) {
  const theme = useAppTheme();
  const colors = useRedesignColors();
  const [mapStyle, setMapStyle] = useState<JourneyDeckMapStyle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const geometry = useMemo(() => {
    const features: FeatureCollection<LineString>['features'] = [];
    const points: [number, number][] = [];
    for (const route of routes) {
      const coordinates = route.coordinates.filter(([longitude, latitude]) =>
        Number.isFinite(longitude) && Number.isFinite(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90);
      if (coordinates.length < 2) continue;
      points.push(...coordinates);
      features.push({ type: 'Feature', id: route.id, properties: { color: route.color }, geometry: { type: 'LineString', coordinates } });
    }
    if (!points.length) return null;
    let west = points[0][0], east = points[0][0];
    let south = points[0][1], north = points[0][1];
    for (const [longitude, latitude] of points.slice(1)) {
      west = Math.min(west, longitude); east = Math.max(east, longitude);
      south = Math.min(south, latitude); north = Math.max(north, latitude);
    }
    const longitudeMargin = Math.max((east - west) * 0.08, 0.002);
    const latitudeMargin = Math.max((north - south) * 0.08, 0.002);
    return {
      lines: { type: 'FeatureCollection', features } as FeatureCollection<LineString>,
      bounds: [west - longitudeMargin, south - latitudeMargin, east + longitudeMargin, north + latitudeMargin] as [number, number, number, number],
    };
  }, [routes]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setFailed(false);
    void loadJourneyDeckMapStyle(fetch, theme.id).then(style => { if (active) setMapStyle(style); });
    return () => { active = false; };
  }, [theme.id]);

  if (!geometry) return null;
  return <View testID="memory-route-map" style={[styles.frame, { height, backgroundColor: colors.surfaceStrong }]}>
    <View pointerEvents="none" style={styles.fallback}>
      <RouteSketch routes={routes.map(route => route.coordinates)} width={width} height={height} inks={routes.map(route => route.color)} strokeWidth={3.6} padding={22} />
    </View>
    {!failed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}>
      <Map mapStyle={(mapStyle ?? (theme.isLight ? OPEN_FREE_MAP_LIGHT_STYLE : OPEN_FREE_MAP_DARK_STYLE)) as never}
        style={StyleSheet.absoluteFill} attribution={false} logo={false} compass={false} scaleBar={false}
        onDidFinishLoadingMap={() => setReady(true)} onDidFailLoadingMap={() => setFailed(true)}>
        <Camera initialViewState={{ bounds: geometry.bounds, padding: { top: 24, right: 24, bottom: 24, left: 24 } }} />
        <GeoJSONSource id="memory-routes" data={geometry.lines}>
          <Layer id="memory-route-shadow" type="line" paint={{ 'line-color': colors.page, 'line-width': 7, 'line-opacity': 0.8 }} />
          <Layer id="memory-route-line" type="line" paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 1 }} />
        </GeoJSONSource>
      </Map>
    </View> : null}
    {ready && !failed ? <Text pointerEvents="none" style={[styles.attribution, { color: colors.textSecondary, backgroundColor: colors.photoChip }]}>OpenFreeMap · © OpenStreetMap</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  fallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  attribution: { position: 'absolute', right: 8, bottom: 6, fontSize: 9, paddingHorizontal: 4, borderRadius: 3 },
});
