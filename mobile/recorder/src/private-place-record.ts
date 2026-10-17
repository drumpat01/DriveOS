import type { LocalPlace } from './local-store';

// Versioned payloads use the already deployed private preference envelope.
// These coordinates stay in the owner's private CloudKit zone, never exports.
export const PRIVATE_PLACE_PREFIX = 'library.place.v1.';
export type PrivatePlaceValue = Omit<LocalPlace, 'userId' | 'createdAt' | 'updatedAt'>;

export function privatePlaceValue(place: LocalPlace, id = place.id): PrivatePlaceValue {
  return { id, kind: place.kind, label: place.label, lat: place.lat, lng: place.lng,
    radiusMeters: place.radiusMeters, foursquareId: place.foursquareId, osmId: place.osmId,
    cachedUntil: place.cachedUntil };
}

const INCOMPLETE_PRIVATE_PLACE = 'A private place backup is incomplete. It will be retried without changing your saved places.';

export function parsePrivatePlace(valueJson: string): PrivatePlaceValue {
  const value = tryParsePrivatePlace(valueJson, { log: false });
  if (!value) throw new Error(INCOMPLETE_PRIVATE_PLACE);
  return value;
}

/** Returns null for invalid JSON or an incomplete place so one bad backup row cannot abort delete or a CloudKit pull. */
export function tryParsePrivatePlace(valueJson: string, options: { log?: boolean } = {}): PrivatePlaceValue | null {
  const log = options.log !== false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(valueJson);
  } catch {
    if (log) console.warn('Skipped a corrupt private place backup row', { reason: 'invalid-json' });
    return null;
  }
  const value = parsed as PrivatePlaceValue;
  if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 256
    || !['home', 'work', 'custom', 'geocoded'].includes(value.kind)
    || typeof value.label !== 'string' || !value.label.trim() || value.label.length > 200
    || typeof value.lat !== 'number' || !Number.isFinite(value.lat) || Math.abs(value.lat) > 90
    || typeof value.lng !== 'number' || !Number.isFinite(value.lng) || Math.abs(value.lng) > 180
    || typeof value.radiusMeters !== 'number' || !Number.isFinite(value.radiusMeters)
    || value.radiusMeters < 1 || value.radiusMeters > 50_000
    || [value.foursquareId, value.osmId, value.cachedUntil].some(item => item != null && typeof item !== 'string')) {
    if (log) console.warn('Skipped a corrupt private place backup row', { reason: 'invalid-shape' });
    return null;
  }
  return value;
}

export function savedPlaceLocalId(wireId: string, userId: string): string | undefined {
  const slot = /^saved-place-v1-(home|work|school)-/.exec(wireId)?.[1];
  return slot ? `saved-place-v1-${slot}-${userId}` : undefined;
}
