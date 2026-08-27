import type { LocalGpsPoint } from './local-store';

export const ROUTE_ARCHIVE_FORMAT_VERSION = 1;
export const MAX_ROUTE_ARCHIVE_POINTS = 100_000;

type EncodedPoint = [number, string, number, number, number | null, number | null, number | null, number | null];
type EncodedArchive = { version: 1; journeyId: string; points: EncodedPoint[] };

function finiteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function nullableNumber(value: unknown, minimum: number, maximum: number): number | null {
  if (value == null) return null;
  if (!finiteInRange(value, minimum, maximum)) throw new Error('The private route archive contains invalid telemetry.');
  return value;
}

export function serializeRouteArchive(journeyId: string, points: LocalGpsPoint[]): string {
  if (!journeyId || journeyId.length > 255) throw new Error('The private route archive journey identifier is invalid.');
  if (!points.length || points.length > MAX_ROUTE_ARCHIVE_POINTS) throw new Error('The private route archive has an invalid point count.');
  const encoded: EncodedArchive = {
    version: ROUTE_ARCHIVE_FORMAT_VERSION,
    journeyId,
    points: points.map(point => [
      point.sequence, point.recordedAt, point.latitude, point.longitude, point.accuracyMeters,
      point.altitudeMeters, point.headingDegrees, point.speedMps,
    ]),
  };
  // JSON number serialization preserves the exact JavaScript doubles stored in SQLite.
  return JSON.stringify(encoded);
}

export function parseRouteArchive(raw: string, expectedJourneyId: string, expectedPointCount: number): Omit<LocalGpsPoint, 'journeyId'>[] {
  let archive: unknown;
  try { archive = JSON.parse(raw); }
  catch { throw new Error('The private route archive is not valid JSON.'); }
  if (!archive || typeof archive !== 'object') throw new Error('The private route archive is invalid.');
  const candidate = archive as Partial<EncodedArchive>;
  if (candidate.version !== ROUTE_ARCHIVE_FORMAT_VERSION || candidate.journeyId !== expectedJourneyId || !Array.isArray(candidate.points)) {
    throw new Error('The private route archive identity or format does not match.');
  }
  if (!candidate.points.length || candidate.points.length !== expectedPointCount || candidate.points.length > MAX_ROUTE_ARCHIVE_POINTS) {
    throw new Error('The private route archive point count does not match.');
  }
  let priorSequence = -1;
  return candidate.points.map(point => {
    if (!Array.isArray(point) || point.length !== 8) throw new Error('The private route archive contains a malformed point.');
    const [sequence, recordedAt, latitude, longitude, accuracyMeters, altitudeMeters, headingDegrees, speedMps] = point;
    if (!Number.isInteger(sequence) || sequence < 0 || sequence <= priorSequence) throw new Error('The private route archive sequence is invalid.');
    if (typeof recordedAt !== 'string' || !Number.isFinite(Date.parse(recordedAt))) throw new Error('The private route archive timestamp is invalid.');
    if (!finiteInRange(latitude, -90, 90) || !finiteInRange(longitude, -180, 180)) throw new Error('The private route archive coordinate is invalid.');
    priorSequence = sequence;
    return {
      sequence,
      recordedAt,
      latitude,
      longitude,
      accuracyMeters: nullableNumber(accuracyMeters, 0, 10_000),
      altitudeMeters: nullableNumber(altitudeMeters, -1000, 100_000),
      headingDegrees: nullableNumber(headingDegrees, 0, 360),
      speedMps: nullableNumber(speedMps, 0, 150),
    };
  });
}
