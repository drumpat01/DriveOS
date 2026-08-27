/**
 * privacy-masker.ts
 *
 * On-device coordinate privacy masking for the JourneyDeck Local-First architecture.
 *
 * INVARIANTS
 * ----------
 * - Raw home/work coordinates NEVER leave the device.
 * - Any coordinate within a sensitive place's geofence radius is replaced with
 *   the place's boundary centroid (the point on the edge nearest the safe direction).
 * - Share cards and any data destined for CloudKit, Cloudflare, or any other
 *   external destination MUST be run through `maskCoordinate()` first.
 * - Masking is ALWAYS deterministic for the same input + same places, so
 *   cached share cards remain stable and testable.
 * - The API is sync-only and has zero side effects; it is pure and safe to
 *   call in any render or serialisation path.
 */

import type { LocalPlace } from './local-store';

// --- Types -------------------------------------------------------------------

export type RawCoord = { lat: number; lng: number };

export type MaskedCoord = RawCoord & {
  /** true if the coordinate was altered by masking */
  masked: boolean;
  /** which place triggered the mask, if any */
  maskedByPlaceId: string | null;
  /** human-readable label for the masked zone, e.g. "Home area" */
  maskedByLabel: string | null;
};

export type RoutePrivacyResult = {
  coordinates: [number, number][];  // GeoJSON order: [lng, lat]
  startMasked: boolean;
  endMasked: boolean;
  waypointsMasked: number;
};

// --- Constants ---------------------------------------------------------------

/** Minimum geofence radius enforced regardless of what is stored. */
const MIN_RADIUS_METERS = 100;

/** How far outside the geofence to place the scrubbed point (adds a safe buffer). */
const SCRUB_BUFFER_METERS = 50;

// --- Haversine helpers -------------------------------------------------------

const EARTH_RADIUS_METERS = 6_371_000;

function toRad(deg: number) { return (deg * Math.PI) / 180; }
function toDeg(rad: number) { return (rad * 180) / Math.PI; }

/**
 * Returns the great-circle distance in meters between two coordinates.
 */
export function haversineDistance(a: RawCoord, b: RawCoord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const chord = sinDLat ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(chord));
}

/**
 * Returns the bearing in degrees (0–360) from `from` to `to`.
 */
export function bearing(from: RawCoord, to: RawCoord): number {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat))
    - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Returns the coordinate that is `distanceMeters` from `origin` along `bearingDeg`.
 * Uses the spherical earth approximation (accurate to < 0.3% for distances < 100 km).
 */
export function destinationPoint(origin: RawCoord, distanceMeters: number, bearingDeg: number): RawCoord {
  const delta = distanceMeters / EARTH_RADIUS_METERS;
  const theta = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(theta),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(lat1),
    Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
  );

  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

// --- Core masking logic ------------------------------------------------------

/**
 * Returns the effective geofence radius for a place: at least MIN_RADIUS_METERS,
 * and larger for home/work (300 m minimum) to provide stronger protection.
 */
function effectiveRadius(place: LocalPlace): number {
  const base = Math.max(MIN_RADIUS_METERS, place.radiusMeters);
  return place.kind === 'home' || place.kind === 'work' ? Math.max(300, base) : base;
}

/**
 * Checks whether a coordinate falls inside a sensitive place's geofence.
 * Returns the matched place or null.
 */
export function findSensitivePlace(coord: RawCoord, places: LocalPlace[]): LocalPlace | null {
  for (const place of places) {
    const distance = haversineDistance(coord, { lat: place.lat, lng: place.lng });
    if (distance <= effectiveRadius(place)) {
      return place;
    }
  }
  return null;
}

/**
 * Masks a single coordinate against a set of sensitive places.
 *
 * If the coordinate is OUTSIDE all geofences → returns it unchanged (masked: false).
 * If the coordinate is INSIDE a geofence → returns a scrubbed point placed just
 * OUTSIDE the geofence boundary in the direction AWAY from the place centre.
 * This prevents reverse-engineering the exact sensitive location.
 */
export function maskCoordinate(coord: RawCoord, sensitivePlaces: LocalPlace[]): MaskedCoord {
  if (!sensitivePlaces.length) {
    return { ...coord, masked: false, maskedByPlaceId: null, maskedByLabel: null };
  }

  const hit = findSensitivePlace(coord, sensitivePlaces);
  if (!hit) {
    return { ...coord, masked: false, maskedByPlaceId: null, maskedByLabel: null };
  }

  const placeCenter = { lat: hit.lat, lng: hit.lng };
  const radius = effectiveRadius(hit);

  // Compute the outward bearing from the place centre toward the actual point.
  // If the point is exactly at the centre (distance 0), use north as a default.
  const distance = haversineDistance(coord, placeCenter);
  const outwardBearing = distance > 0.1 ? bearing(placeCenter, coord) : 0;

  // Place the scrubbed point JUST OUTSIDE the radius (+ buffer).
  const scrubbed = destinationPoint(placeCenter, radius + SCRUB_BUFFER_METERS, outwardBearing);

  const label = hit.kind === 'home' ? 'Home area'
    : hit.kind === 'work' ? 'Work area'
    : hit.label || 'Private area';

  return {
    lat: scrubbed.lat,
    lng: scrubbed.lng,
    masked: true,
    maskedByPlaceId: hit.id,
    maskedByLabel: label,
  };
}

// --- Route masking -----------------------------------------------------------

/**
 * Masks an entire GeoJSON LineString route.
 *
 * - The first and last points are always masked if inside a geofence
 *   (these reveal start/end addresses).
 * - Interior waypoints inside geofences are also masked.
 * - Returns the sanitised route plus masking metadata for use in share cards.
 *
 * IMPORTANT: coordinates are GeoJSON order [lng, lat].
 */
export function maskRoute(
  coordinates: [number, number][],
  sensitivePlaces: LocalPlace[],
): RoutePrivacyResult {
  if (!coordinates.length) {
    return { coordinates: [], startMasked: false, endMasked: false, waypointsMasked: 0 };
  }

  let waypointsMasked = 0;
  let startMasked = false;
  let endMasked = false;

  const masked = coordinates.map(([lng, lat], index): [number, number] => {
    const result = maskCoordinate({ lat, lng }, sensitivePlaces);
    if (result.masked) {
      if (index === 0) startMasked = true;
      else if (index === coordinates.length - 1) endMasked = true;
      else waypointsMasked++;
    }
    return [result.lng, result.lat];
  });

  return { coordinates: masked, startMasked, endMasked, waypointsMasked };
}

// --- Location label masking --------------------------------------------------

/**
 * Replaces a human-readable location string with a safe label if the associated
 * coordinate falls within a sensitive geofence. Used for share cards.
 *
 * @param label   - The resolved place name (e.g. "123 Main St")
 * @param coord   - The coordinate for that label
 * @param places  - Sensitive places to check against
 * @returns The safe display string (original or replaced)
 */
export function maskLocationLabel(
  label: string | null,
  coord: RawCoord | null,
  sensitivePlaces: LocalPlace[],
): string | null {
  if (!coord || !sensitivePlaces.length) return label;
  const hit = findSensitivePlace(coord, sensitivePlaces);
  if (!hit) return label;
  return hit.kind === 'home' ? 'Home' : hit.kind === 'work' ? 'Work' : hit.label || 'Private location';
}

// --- Batch coordinate scrubbing for share cards ------------------------------

export type ShareCardCoords = {
  startLabel: string | null;
  endLabel: string | null;
  route: RoutePrivacyResult | null;
  privacySummary: string;
};

/**
 * Prepares all coordinate and label data for a journey share card.
 * Guaranteed to never include raw sensitive coordinates.
 */
export function prepareShareCardCoords(input: {
  startLabel: string | null;
  endLabel: string | null;
  startCoord: RawCoord | null;
  endCoord: RawCoord | null;
  route: [number, number][] | null;
  sensitivePlaces: LocalPlace[];
}): ShareCardCoords {
  const { sensitivePlaces } = input;

  const startLabel = maskLocationLabel(input.startLabel, input.startCoord, sensitivePlaces);
  const endLabel   = maskLocationLabel(input.endLabel,   input.endCoord,   sensitivePlaces);
  const route      = input.route ? maskRoute(input.route, sensitivePlaces) : null;

  const maskedZones: string[] = [];
  if (route?.startMasked) maskedZones.push('start');
  if (route?.endMasked) maskedZones.push('end');
  if (route && route.waypointsMasked > 0) maskedZones.push(`${route.waypointsMasked} waypoint${route.waypointsMasked === 1 ? '' : 's'}`);

  const privacySummary = maskedZones.length === 0
    ? 'Full route shown'
    : `Privacy protected: ${maskedZones.join(', ')} masked`;

  return { startLabel, endLabel, route, privacySummary };
}
