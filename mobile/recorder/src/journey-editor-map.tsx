import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type MapRef } from '@maplibre/maplibre-react-native';
import { BlurMask, Canvas, Circle } from '@shopify/react-native-skia';
import Svg, { Polyline } from 'react-native-svg';
import type { Feature, LineString } from 'geojson';
import { useAppTheme } from './app-theme';
import { loadJourneyDeckMapStyle, type JourneyDeckMapStyle } from './journey-map-theme';
import { clipEditorRoute, type EditorDrawPoint, type EditorRange } from './journey-editor-timeline';

type Puff = { x: number; y: number; born: number; seed: number };
const line = (points: EditorDrawPoint[]): Feature<LineString> => ({ type: 'Feature', properties: {},
  geometry: { type: 'LineString', coordinates: points.map(p => [p.longitude, p.latitude]) } });

export function JourneyEditorMap({ points, range, splitMs, reducedMotion }: {
  points: EditorDrawPoint[]; range: EditorRange; splitMs: number | null; reducedMotion: boolean;
}) {
  const theme = useAppTheme(), c = theme.palette;
  const map = useRef<MapRef>(null), alive = useRef(true), generation = useRef(0);
  const [style, setStyle] = useState<JourneyDeckMapStyle | null>(null), [failed, setFailed] = useState(false);
  const [puffs, setPuffs] = useState<Puff[]>([]), [clock, setClock] = useState(0);
  const [layout, setLayout] = useState({ width: 400, height: 340 });
  const [ghost, setGhost] = useState<{ points: EditorDrawPoint[]; born: number } | null>(null);
  const previous = useRef(range), lastBurst = useRef(0);
  const kept = useMemo(() => clipEditorRoute(points, range), [points, range.startMs, range.endMs]);
  const first = useMemo(() => splitMs == null ? kept : clipEditorRoute(kept, { startMs: range.startMs, endMs: splitMs }), [kept, splitMs, range.startMs]);
  const second = useMemo(() => splitMs == null ? [] : clipEditorRoute(kept, { startMs: splitMs, endMs: range.endMs }), [kept, splitMs, range.endMs]);
  const bounds = useMemo(() => {
    const lngs = points.map(p => p.longitude), lats = points.map(p => p.latitude);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] as [number, number, number, number];
  }, [points]);
  useEffect(() => { let active = true; setStyle(null); setFailed(false);
    void loadJourneyDeckMapStyle(fetch, theme.id).then(value => { if (active) { setStyle(value); if (!value) setFailed(true); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [theme.id]);
  useEffect(() => { alive.current = true; const sub = AppState.addEventListener('change', state => {
    if (state !== 'active') { generation.current++; setPuffs([]); setGhost(null); }
  }); return () => { alive.current = false; generation.current++; sub.remove(); }; }, []);
  useEffect(() => {
    const before = previous.current; previous.current = range;
    if (reducedMotion || splitMs != null) { setPuffs([]); setGhost(null); return; }
    const now = Date.now();
    if (now - lastBurst.current < 70) return;
    const removed = range.startMs > before.startMs ? clipEditorRoute(points, { startMs: before.startMs, endMs: range.startMs })
      : range.endMs < before.endMs ? clipEditorRoute(points, { startMs: range.endMs, endMs: before.endMs }) : [];
    if (!removed.length) return;
    lastBurst.current = now; setClock(now); setGhost({ points: removed, born: now });
    const token = generation.current;
    const samples = removed.filter((_, i) => i % Math.max(1, Math.floor(removed.length / 6)) === 0).slice(0, 6);
    const projectFallback = (p: EditorDrawPoint): [number, number] => {
      const scale = Math.min(layout.width / 400, layout.height / 340);
      return [(layout.width - 400 * scale) / 2 + (30 + (p.longitude - bounds[0]) / Math.max(.00001, bounds[2] - bounds[0]) * 340) * scale,
        (layout.height - 340 * scale) / 2 + (310 - (p.latitude - bounds[1]) / Math.max(.00001, bounds[3] - bounds[1]) * 280) * scale];
    };
    void Promise.all(samples.map(p => style && !failed ? map.current?.project([p.longitude, p.latitude]).catch(() => undefined) : Promise.resolve(projectFallback(p)))).then(pixels => {
      if (!alive.current || token !== generation.current) return;
      const additions = pixels.flatMap((pixel, i) => pixel ? [0, 1, 2].map(n => ({ x: pixel[0], y: pixel[1], born: Date.now(), seed: i * 3 + n })) : []);
      setPuffs(current => [...current.filter(p => now - p.born < 700), ...additions].slice(-36));
    });
  }, [points, range, splitMs, reducedMotion, layout, bounds, style, failed]);
  const animating = puffs.length > 0 || ghost !== null;
  useEffect(() => {
    if (!animating) return;
    // Bounded 30fps only while a cut dissipates; no worklet or perpetual frame loop.
    const timer = setInterval(() => { const now = Date.now(); setClock(now);
      setPuffs(current => current.filter(p => now - p.born < 700));
      setGhost(current => current && now - current.born < 500 ? current : null);
    }, 33); return () => clearInterval(timer);
  }, [animating]);
  const fallbackPoints = (route: EditorDrawPoint[]) => route.map(p => `${30 + (p.longitude - bounds[0]) / Math.max(.00001, bounds[2] - bounds[0]) * 340},${310 - (p.latitude - bounds[1]) / Math.max(.00001, bounds[3] - bounds[1]) * 280}`).join(' ');
  return <View onLayout={event => { setLayout(event.nativeEvent.layout); generation.current++; setPuffs([]); setGhost(null); }} style={[styles.frame, { backgroundColor: c.inset, borderColor: c.line }]} accessibilityLabel="Journey trim preview. Highlighted route is kept.">
    {style && !failed ? <Map ref={map} style={StyleSheet.absoluteFill} mapStyle={style as never} attribution logo={false} compass={false}
      touchRotate={false} touchPitch={false} onDidFailLoadingMap={() => setFailed(true)}
      onRegionWillChange={() => { generation.current++; setPuffs([]); setGhost(null); }}>
      <Camera initialViewState={{ bounds, padding: { top: 65, right: 42, bottom: 55, left: 42 } }} />
      {first.length >= 2 && <GeoJSONSource id="editor-kept" data={line(first)}>
        <Layer id="editor-glow" type="line" paint={{ 'line-color': c.accent, 'line-width': 17, 'line-blur': 8, 'line-opacity': .6 }} />
        <Layer id="editor-route" type="line" paint={{ 'line-color': c.accent, 'line-width': 5 }} />
      </GeoJSONSource>}
      {second.length >= 2 && <GeoJSONSource id="editor-second" data={line(second)}>
        <Layer id="editor-second-glow" type="line" paint={{ 'line-color': c.teal, 'line-width': 16, 'line-blur': 8, 'line-opacity': .5 }} />
        <Layer id="editor-second-route" type="line" paint={{ 'line-color': c.teal, 'line-width': 5 }} />
      </GeoJSONSource>}
      {ghost && ghost.points.length >= 2 && <GeoJSONSource id="editor-cut" data={line(ghost.points)}>
        <Layer id="editor-cut-smoke" type="line" paint={{ 'line-color': c.chrome, 'line-width': 5 + Math.max(0, clock - ghost.born) / 45,
          'line-blur': 3 + Math.max(0, clock - ghost.born) / 60, 'line-opacity': Math.max(0, 1 - (clock - ghost.born) / 500) * .75 }} />
      </GeoJSONSource>}
    </Map> : <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 400 340">
        <Polyline points={fallbackPoints(first)} stroke={c.accent} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Polyline points={fallbackPoints(second)} stroke={c.teal} strokeWidth={4} fill="none" strokeLinecap="round" />
      </Svg><Text style={[styles.offline, { color: c.muted }]}>{failed ? 'Offline route preview' : 'Route preview · Loading map'}</Text>
    </View>}
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">{puffs.map((p, i) => {
      const t = Math.max(0, Math.min(1, (clock - p.born) / 700)), angle = p.seed * 2.4;
      return <Circle key={`${p.born}-${p.seed}-${i}`} cx={p.x + Math.sin(angle) * t * 24} cy={p.y - t * (25 + p.seed % 5 * 5)} r={3 + t * 12}
        color={p.seed % 3 === 0 ? c.accent : c.chrome} opacity={(1 - t) ** 2 * .7}><BlurMask blur={2 + t * 5} style="normal" /></Circle>;
    })}</Canvas>
    <View pointerEvents="none" style={[styles.badge, { backgroundColor: c.card, borderColor: c.line }]}><Text style={{ color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>{splitMs == null ? 'KEEP THE GOOD PART' : 'ONE JOURNEY. TWO CHAPTERS.'}</Text></View>
  </View>;
}
const styles = StyleSheet.create({ frame: { flex: 1, minHeight: 270, borderRadius: 28, borderWidth: 1, overflow: 'hidden' }, badge: { position: 'absolute', top: 18, left: 18, padding: 12, borderRadius: 18, borderWidth: 1 }, offline: { position: 'absolute', bottom: 15, alignSelf: 'center', fontSize: 12 } });
