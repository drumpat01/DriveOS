/** PhotoKit metadata is used only on this device. Never include these values in diagnostics. */
export type PhotoMatchPoint = { latitude: number; longitude: number; timestampUtc?: string | null };
export type PhotoMatchJourney = {
  id: string; title: string; startTimeUtc: string; endTimeUtc: string; route: readonly PhotoMatchPoint[];
};
export type PhotoLibraryAsset = {
  id: string; createdAtUtc: string; latitude?: number | null; longitude?: number | null;
  width: number; height: number;
};
export type PhotoMatch = {
  asset: PhotoLibraryAsset; journeyId: string; journeyTitle: string;
  reason: 'time-and-place' | 'time'; distanceMeters: number | null; timeOffsetMinutes: number;
};
export const PHOTO_MATCH_LIMITS = { journeys: 30, assets: 400, suggestions: 120, selection: 24, paddingMinutes: 30, radiusMeters: 600 } as const;
const paddingMs = PHOTO_MATCH_LIMITS.paddingMinutes * 60_000;
const maxJourneyMs = 30 * 86400_000;
const finiteDate = (value: string) => typeof value === 'string' ? Date.parse(value) : NaN;
const validLocation = (p: { latitude?: number | null; longitude?: number | null }): p is PhotoMatchPoint =>
  typeof p.latitude === 'number' && typeof p.longitude === 'number' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

export function preparePhotoMatchJourneys(journeys: readonly PhotoMatchJourney[]): PhotoMatchJourney[] {
  const seen = new Set<string>();
  return journeys.filter(j => {
    const start = finiteDate(j.startTimeUtc), end = finiteDate(j.endTimeUtc);
    if (!j.id || seen.has(j.id) || !Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > maxJourneyMs) return false;
    seen.add(j.id); return true;
  }).sort((a, b) => finiteDate(b.startTimeUtc) - finiteDate(a.startTimeUtc)).slice(0, PHOTO_MATCH_LIMITS.journeys);
}

export function photoMatchWindows(journeys: readonly PhotoMatchJourney[]) {
  return preparePhotoMatchJourneys(journeys).map(j => ({
    startMs: finiteDate(j.startTimeUtc) - paddingMs,
    endMs: finiteDate(j.endTimeUtc) + paddingMs,
  }));
}

/** Local tangent plane centered on the photo; wrap longitude at the antimeridian. */
function xy(point: PhotoMatchPoint, origin: PhotoMatchPoint, longitudeScale: number): [number, number] {
  const lon = ((point.longitude - origin.longitude + 540) % 360) - 180;
  return [lon * longitudeScale, (point.latitude - origin.latitude) * 111_195];
}
type PreparedPoint = PhotoMatchPoint & { connectsPrevious: boolean };
function prepareRoute(route: readonly PhotoMatchPoint[]): PreparedPoint[] {
  const prepared: PreparedPoint[] = [];
  let previous: PhotoMatchPoint | null = null;
  const stride = Math.max(1, Math.ceil(route.length / 2000));
  for (let i = 0; i < route.length; i += stride) {
    const point = route[i];
    if (!validLocation(point)) { previous = null; continue; }
    const dt = previous && point.timestampUtc && previous.timestampUtc ? finiteDate(point.timestampUtc) - finiteDate(previous.timestampUtc) : 0;
    prepared.push({ ...point, connectsPrevious: !!previous && (!Number.isFinite(dt) || (dt >= 0 && dt <= 300_000)) });
    previous = point;
  }
  const last = route[route.length - 1];
  if (last && validLocation(last) && last !== previous) prepared.push({ ...last, connectsPrevious: false });
  return prepared;
}
function routeDistance(location: PhotoMatchPoint, route: readonly PreparedPoint[]): number | null {
  let distance = Infinity;
  let previous: [number, number] | null = null;
  const longitudeScale = Math.cos(location.latitude * Math.PI / 180) * 111_195;
  for (const point of route) {
    const [x, y] = xy(point, location, longitudeScale);
    distance = Math.min(distance, Math.hypot(x, y));
    if (previous && point.connectsPrevious) {
      const [px, py] = previous, dx = x - px, dy = y - py;
      const lengthSquared = dx * dx + dy * dy;
      // Do not invent a matching corridor across a recording gap or long jump.
      if (lengthSquared > 0 && lengthSquared <= 25_000_000) {
        const t = Math.max(0, Math.min(1, -(px * dx + py * dy) / lengthSquared));
        distance = Math.min(distance, Math.hypot(px + t * dx, py + t * dy));
      }
    }
    previous = [x, y];
    if (distance < 1) return 0;
  }
  return Number.isFinite(distance) ? distance : null;
}

/** GPS disagreement is excluded; missing GPS stays an explicitly weaker time-only suggestion. */
export function matchPhotosToJourneys(assets: readonly PhotoLibraryAsset[], input: readonly PhotoMatchJourney[]): PhotoMatch[] {
  const journeys = preparePhotoMatchJourneys(input), seen = new Set<string>();
  const routes = new Map(journeys.map(journey => [journey.id, prepareRoute(journey.route)]));
  const matches: PhotoMatch[] = [];
  for (const asset of assets.slice(0, PHOTO_MATCH_LIMITS.assets)) {
    const taken = finiteDate(asset.createdAtUtc);
    if (!asset.id || seen.has(asset.id) || !Number.isFinite(taken)) continue;
    seen.add(asset.id);
    const possible: PhotoMatch[] = [];
    for (const journey of journeys) {
      const start = finiteDate(journey.startTimeUtc), end = finiteDate(journey.endTimeUtc);
      if (taken < start - paddingMs || taken > end + paddingMs) continue;
      const distance = validLocation(asset) ? routeDistance(asset, routes.get(journey.id)!) : null;
      if (distance !== null && distance > PHOTO_MATCH_LIMITS.radiusMeters) continue;
      possible.push({ asset, journeyId: journey.id, journeyTitle: journey.title, reason: distance === null ? 'time' : 'time-and-place',
        distanceMeters: distance === null ? null : Math.round(distance), timeOffsetMinutes: Math.max(start - taken, taken - end, 0) / 60_000 });
    }
    possible.sort((a, b) => Number(b.reason === 'time-and-place') - Number(a.reason === 'time-and-place')
      || a.timeOffsetMinutes - b.timeOffsetMinutes || (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) || a.journeyId.localeCompare(b.journeyId));
    if (possible[0]) matches.push(possible[0]);
  }
  return matches.sort((a, b) => Number(b.reason === 'time-and-place') - Number(a.reason === 'time-and-place')
    || a.timeOffsetMinutes - b.timeOffsetMinutes || finiteDate(a.asset.createdAtUtc) - finiteDate(b.asset.createdAtUtc))
    .slice(0, PHOTO_MATCH_LIMITS.suggestions);
}
