import { US_STATE_PATHS } from './fifty-states-map-data.ts';
import { US_STATES, type USStateCode } from './fifty-states-model.ts';

/** A photo reduced to what "See where you've been" uses: when and where it was taken. */
export type PlacedPhoto = { id: string; takenAtMs: number; latitude: number; longitude: number };

export type FoundTrip = {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  photoIds: string[];
  states: USStateCode[];
};

export type RoadsSoFar = {
  states: USStateCode[];
  places: number;
  trips: FoundTrip[];
  photosWithPlaces: number;
};

export const ROADS_SO_FAR_LIMITS = {
  /** Photos farther than this from the most-photographed area count as away from home. */
  awayKm: 80,
  /** Away days this close together belong to the same trip. */
  maxGapDays: 1,
  minTripPhotos: 5,
  maxTrips: 12,
  /** Size of a "place": photos in the same ~11 km cell count once. */
  placeCellDegrees: 0.1,
} as const;

const DEG = Math.PI / 180;
type Conic = { n: number; c: number; r0: number; k: number; tx: number; ty: number; cx: number; cy: number; rotate: number };

// The 50 States map (us-atlas states-albers-10m) is drawn with d3's geoAlbersUsa at
// scale 1300, translate [487.5, 305]. Projecting a coordinate the same way lets a photo
// be placed inside the same state shapes the app shows, with no network lookup.
function conic(parallels: [number, number], rotate: number, center: [number, number], k: number, tx: number, ty: number): Conic {
  const sy0 = Math.sin(parallels[0] * DEG);
  const n = (sy0 + Math.sin(parallels[1] * DEG)) / 2;
  const c = 1 + sy0 * (2 * n - sy0);
  const r0 = Math.sqrt(c) / n;
  const raw = (lambda: number, phi: number) => {
    const r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
    return [r * Math.sin(lambda * n), r0 - r * Math.cos(lambda * n)] as const;
  };
  const [cx, cy] = raw(center[0] * DEG, center[1] * DEG);
  return { n, c, r0, k, tx, ty, cx, cy, rotate };
}

function project(p: Conic, longitude: number, latitude: number): [number, number] {
  let lambda = (longitude + p.rotate) * DEG;
  if (lambda > Math.PI) lambda -= 2 * Math.PI;
  if (lambda < -Math.PI) lambda += 2 * Math.PI;
  const r = Math.sqrt(p.c - 2 * p.n * Math.sin(latitude * DEG)) / p.n;
  const x = r * Math.sin(lambda * p.n), y = p.r0 - r * Math.cos(lambda * p.n);
  return [p.tx + p.k * (x - p.cx), p.ty - p.k * (y - p.cy)];
}

const K = 1300, TX = 487.5, TY = 305;
const LOWER48 = conic([29.5, 45.5], 96, [-0.6, 38.7], K, TX, TY);
const ALASKA = conic([55, 65], 154, [-2, 58.5], 0.35 * K, TX - 0.307 * K, TY + 0.201 * K);
const HAWAII = conic([8, 18], 157, [-3, 19.9], K, TX - 0.205 * K, TY + 0.212 * K);

type Ring = number[];
let shapes: { code: USStateCode; rings: Ring[]; box: [number, number, number, number] }[] | null = null;

function stateShapes() {
  if (shapes) return shapes;
  shapes = (Object.entries(US_STATE_PATHS) as [USStateCode, string][]).map(([code, d]) => {
    const rings: Ring[] = [];
    let ring: Ring = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const part of d.match(/[MLZ][^MLZ]*/g) ?? []) {
      if (part[0] === 'M') { if (ring.length) rings.push(ring); ring = []; }
      if (part[0] === 'Z') { if (ring.length) rings.push(ring); ring = []; continue; }
      const numbers = part.slice(1).split(/[ ,]+/).filter(Boolean).map(Number);
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const x = numbers[i]!, y = numbers[i + 1]!;
        ring.push(x, y);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    if (ring.length) rings.push(ring);
    return { code, rings, box: [minX, minY, maxX, maxY] as [number, number, number, number] };
  });
  return shapes;
}

function insideRings(rings: Ring[], x: number, y: number) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i]!, yi = ring[i + 1]!, xj = ring[j]!, yj = ring[j + 1]!;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** The U.S. state containing a coordinate, or null outside the 50 states (or offshore). */
export function stateForPoint(latitude: number, longitude: number): USStateCode | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const inAlaska = latitude > 50 && longitude < -129;
  const inHawaii = latitude > 18 && latitude < 23 && longitude > -161 && longitude < -154;
  const [x, y] = project(inAlaska ? ALASKA : inHawaii ? HAWAII : LOWER48, longitude, latitude);
  for (const shape of stateShapes()) {
    if ((shape.code === 'AK') !== inAlaska || (shape.code === 'HI') !== inHawaii) continue;
    const [minX, minY, maxX, maxY] = shape.box;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    if (insideRings(shape.rings, x, y)) return shape.code;
  }
  return null;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = (bLat - aLat) * DEG, dLon = (bLon - aLon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const cell = (latitude: number, longitude: number) => {
  const size = ROADS_SO_FAR_LIMITS.placeCellDegrees;
  return `${Math.floor(latitude / size)}:${Math.floor(longitude / size)}`;
};

const STATE_NAMES = Object.fromEntries(US_STATES.map(([code, name]) => [code, name])) as Record<USStateCode, string>;

/** "California", "California & Nevada", "California, Nevada & Utah", or a place-free fallback. */
export function tripName(states: readonly USStateCode[]) {
  const names = states.map(code => STATE_NAMES[code]);
  if (!names.length) return 'Road trip';
  if (names.length === 1) return `${names[0]} road trip`;
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`;
}

/** Local calendar day number, so a trip that crosses midnight stays one day at a time. */
const dayNumber = (ms: number, offsetMinutes: number) => Math.floor((ms - offsetMinutes * 60_000) / 86_400_000);

/**
 * Turns located photos into states visited, distinct places, and road trips.
 * Home is the most-photographed ~11 km area; a trip is a run of days with at least
 * one photo far from home, separated by no more than one quiet day.
 */
export function summarizeRoads(photos: readonly PlacedPhoto[], offsetMinutes = new Date().getTimezoneOffset()): RoadsSoFar {
  const located = photos.filter(p => Number.isFinite(p.takenAtMs) && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && !(p.latitude === 0 && p.longitude === 0));
  const states = new Set<USStateCode>(), places = new Set<string>(), counts = new Map<string, { n: number; lat: number; lon: number }>();
  const stateOf = new Map<string, USStateCode | null>();
  for (const photo of located) {
    const key = cell(photo.latitude, photo.longitude);
    places.add(key);
    const entry = counts.get(key);
    if (entry) entry.n += 1; else counts.set(key, { n: 1, lat: photo.latitude, lon: photo.longitude });
    const state = stateForPoint(photo.latitude, photo.longitude);
    stateOf.set(photo.id, state);
    if (state) states.add(state);
  }
  let home: { lat: number; lon: number } | null = null, best = 0;
  for (const entry of counts.values()) if (entry.n > best) { best = entry.n; home = entry; }

  const away = home ? located.filter(p => distanceKm(home!.lat, home!.lon, p.latitude, p.longitude) > ROADS_SO_FAR_LIMITS.awayKm) : [];
  away.sort((a, b) => a.takenAtMs - b.takenAtMs);
  const trips: FoundTrip[] = [];
  let current: PlacedPhoto[] = [];
  const flush = () => {
    if (current.length >= ROADS_SO_FAR_LIMITS.minTripPhotos) {
      const tripStates = [...new Set(current.map(p => stateOf.get(p.id)).filter((s): s is USStateCode => Boolean(s)))];
      trips.push({ id: `trip-${current[0]!.id}`, name: tripName(tripStates), startMs: current[0]!.takenAtMs, endMs: current.at(-1)!.takenAtMs,
        photoIds: current.map(p => p.id), states: tripStates });
    }
    current = [];
  };
  for (const photo of away) {
    const last = current.at(-1);
    if (last && dayNumber(photo.takenAtMs, offsetMinutes) - dayNumber(last.takenAtMs, offsetMinutes) > ROADS_SO_FAR_LIMITS.maxGapDays + 1) flush();
    current.push(photo);
  }
  flush();
  trips.sort((a, b) => b.photoIds.length - a.photoIds.length);
  return {
    states: [...states].sort(),
    places: places.size,
    trips: trips.slice(0, ROADS_SO_FAR_LIMITS.maxTrips).sort((a, b) => b.startMs - a.startMs),
    photosWithPlaces: located.length,
  };
}

/** "Jun 3 – 9, 2025", "Dec 30, 2024 – Jan 2, 2025", or one day. */
export function tripDates(startMs: number, endMs: number) {
  const a = new Date(startMs), b = new Date(endMs);
  const day = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (a.toDateString() === b.toDateString()) return `${day(a)}, ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${day(a)}, ${a.getFullYear()} – ${day(b)}, ${b.getFullYear()}`;
  if (a.getMonth() === b.getMonth()) return `${day(a)} – ${b.getDate()}, ${a.getFullYear()}`;
  return `${day(a)} – ${day(b)}, ${a.getFullYear()}`;
}
