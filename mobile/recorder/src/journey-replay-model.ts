import { replaySnapshotAt, type ReplayRoutePoint, type RouteCoordinate, type TimedRouteSample } from './route-moments.ts';

export type ReplayPhoto = { id: string; uri: string; capturedAt: string };
export type ReplayStop = { id: string; at: number; end: number; coordinate: RouteCoordinate };

/** Stationary recorded breadcrumbs only: never infer stops across missing GPS or estimated timing. */
export function recordedReplayStops(samples: readonly TimedRouteSample[]): ReplayStop[] {
  const stops: ReplayStop[] = [];
  let cluster: { at: number; end: number; coordinate: RouteCoordinate } | null = null;
  const finish = () => { if (cluster && cluster.end - cluster.at >= 60_000) stops.push({ ...cluster, id: `stop-${cluster.at}` }); cluster = null; };
  for (const sample of samples) {
    const at = Date.parse(sample.recordedAt), [lon, lat] = sample.coordinate;
    if (!Number.isFinite(at) || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90 || sample.speedMph == null || !Number.isFinite(sample.speedMph) || sample.speedMph > 3 || sample.speedMph < 0) { finish(); continue; }
    const distance = cluster ? Math.hypot((lon - cluster.coordinate[0]) * Math.cos(lat * Math.PI / 180) * 111195, (lat - cluster.coordinate[1]) * 111195) : 0;
    if (cluster && (at <= cluster.end || at - cluster.end > 90_000 || distance > 30)) finish();
    if (!cluster) cluster = { at, end: at, coordinate: [lon, lat] };
    else cluster.end = at;
  }
  finish(); return stops;
}

export function replayPhotoMoments(photos: readonly ReplayPhoto[], route: ReplayRoutePoint[]) {
  const first = route[0]?.recordedAtEpochMs, last = route.at(-1)?.recordedAtEpochMs;
  const seen = new Set<string>();
  return photos.flatMap(photo => {
    const at = Date.parse(photo.capturedAt);
    if (!photo.id || seen.has(photo.id) || !photo.uri || !Number.isFinite(at) || first == null || last == null || at < first || at > last) return [];
    seen.add(photo.id);
    const point = replaySnapshotAt(route, at);
    return point ? [{ ...photo, at, coordinate: point.coordinate }] : [];
  }).sort((a, b) => a.at - b.at);
}
