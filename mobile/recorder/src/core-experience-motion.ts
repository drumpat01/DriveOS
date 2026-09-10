export type LiveMotionPoint = {
  latitude: number;
  longitude: number;
  speedMps: number | null;
  accuracyMeters: number | null;
};

function distanceMeters(a: LiveMotionPoint, b: LiveMotionPoint) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitude = radians(b.latitude - a.latitude);
  const longitude = radians(b.longitude - a.longitude);
  const chord = Math.sin(latitude / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitude / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(chord));
}

export function gpsConfidence(accuracyMeters: number | null | undefined) {
  if (accuracyMeters == null || !Number.isFinite(accuracyMeters)) return { label: 'Waiting', level: 'waiting' as const };
  if (accuracyMeters <= 15) return { label: 'Excellent', level: 'excellent' as const };
  if (accuracyMeters <= 40) return { label: 'Good', level: 'good' as const };
  return { label: 'Limited', level: 'limited' as const };
}

export function deriveLiveMotionMetrics(input: { startedAt?: string | null; points: LiveMotionPoint[]; now: number }) {
  const startedAt = input.startedAt ? Date.parse(input.startedAt) : Number.NaN;
  const elapsedSeconds = Number.isFinite(startedAt) ? Math.max(0, Math.floor((input.now - startedAt) / 1000)) : 0;
  const meters = input.points.slice(1).reduce((total, point, index) => total + distanceMeters(input.points[index]!, point), 0);
  const lastPoint = input.points.at(-1);
  return {
    elapsedSeconds,
    distanceMiles: meters / 1609.344,
    speedMph: Math.max(0, (lastPoint?.speedMps ?? 0) * 2.23694),
    gps: gpsConfidence(lastPoint?.accuracyMeters),
    routePointCount: input.points.length,
  };
}

export class JourneyCardEntryTracker {
  private readonly seen = new Set<string>();
  shouldAnimate(id: string) {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }
}
