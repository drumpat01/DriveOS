import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { lookupNearbyMapKitPointsOfInterest } from '../modules/journeydeck-recorder';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { lookupOverturePlace } from './overture-places';
import { findSensitivePlace } from './privacy-masker';
import { activeSession } from './storage';
import {
  getActiveLocalUserId,
  getSensitivePlaces,
  findCachedPlace,
  findNamedPlace,
  upsertPlace,
  type LocalUserId,
} from './local-store';
import {
  bestPlaceLabelFromAddress,
  coordinatePlaceAliasIdentity,
  GEOCODED_PLACE_MATCH_RADIUS_METERS,
  SAVED_PLACE_MATCH_RADIUS_METERS,
  type PlaceCoordinate,
} from './place-matching';

type JourneyWithRoute = {
  id: string;
  startedAt: string;
  route: { coordinates: [number, number][] } | null;
};

const CACHE_DAYS = 30;
const MAX_LOOKUPS_PER_PASS = 4;
const FAILURE_RETRY_MS = 60 * 60 * 1_000;
const MAPKIT_POI_SEARCH_RADIUS_METERS = 250;
const MAPKIT_POI_MAX_MATCH_DISTANCE_METERS = 160;
const recentFailures = new Map<string, number>();
const pendingByUser = new Map<string, Promise<number>>();

function endpointCoordinates(journey: JourneyWithRoute) {
  const coordinates = journey.route?.coordinates;
  if (!coordinates?.length) return [];
  const endpoints = [coordinates[0], coordinates[coordinates.length - 1]];
  return endpoints
    .filter((pair): pair is [number, number] => Boolean(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([longitude, latitude]) => ({ latitude, longitude }));
}

function candidateKey(coordinate: PlaceCoordinate) {
  return coordinatePlaceAliasIdentity(coordinate.latitude, coordinate.longitude)
    ?? `${coordinate.latitude},${coordinate.longitude}`;
}

async function runEnrichment(userId: LocalUserId, journeys: JourneyWithRoute[]) {
  // Expo explicitly discourages geocoding in the background. JourneyDeck waits
  // until the archive is visible, then resolves a small sequential batch.
  const canRun = () => (!AppState.currentState || AppState.currentState === 'active')
    && getActiveLocalUserId() === userId && !activeSession();
  if (!canRun()) return 0;
  const canResolve = (coordinate: PlaceCoordinate) => canRun()
    && !findSensitivePlace({ lat: coordinate.latitude, lng: coordinate.longitude }, getSensitivePlaces(userId))
    && !findNamedPlace(userId, coordinate.latitude, coordinate.longitude, SAVED_PLACE_MATCH_RADIUS_METERS);

  const seen = new Set<string>();
  const candidates: PlaceCoordinate[] = [];
  const sorted = [...journeys].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  for (const journey of sorted) {
    for (const coordinate of endpointCoordinates(journey)) {
      const key = candidateKey(coordinate);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!canResolve(coordinate)) continue;
      if (findCachedPlace(userId, coordinate.latitude, coordinate.longitude, GEOCODED_PLACE_MATCH_RADIUS_METERS)) continue;
      if ((recentFailures.get(`${userId}:${key}`) ?? 0) > Date.now() - FAILURE_RETRY_MS) continue;
      candidates.push(coordinate);
      if (candidates.length >= MAX_LOOKUPS_PER_PASS) break;
    }
    if (candidates.length >= MAX_LOOKUPS_PER_PASS) break;
  }

  let enriched = 0;
  for (const coordinate of candidates) {
    if (!canRun()) break;
    if (!canResolve(coordinate)) continue;
    const key = candidateKey(coordinate);
    const failureKey = `${userId}:${key}`;
    try {
      // Country comes from this stop, never the driver's locale or account.
      // A failed country lookup safely leaves MapKit in charge everywhere.
      const [address] = await Location.reverseGeocodeAsync(coordinate).catch(() => []);
      if (!canResolve(coordinate)) continue;
      const overture = address?.isoCountryCode?.toUpperCase() === 'US'
        ? await lookupOverturePlace(coordinate.latitude, coordinate.longitude, () => canResolve(coordinate)) : null;
      if (!canResolve(coordinate)) continue;
      const nearby = overture ? [] : await lookupNearbyMapKitPointsOfInterest(
        coordinate.latitude,
        coordinate.longitude,
        MAPKIT_POI_SEARCH_RADIUS_METERS,
      ).catch(() => []);
      if (!canResolve(coordinate)) continue;
      const pointOfInterest = nearby.find(candidate => candidate.distanceMeters <= MAPKIT_POI_MAX_MATCH_DISTANCE_METERS);
      const label = overture?.[1] ?? pointOfInterest?.name ?? (address ? bestPlaceLabelFromAddress(address) : null);
      if (!label) {
        recentFailures.set(failureKey, Date.now());
        continue;
      }
      upsertPlace({
        // local_places ids are database-wide, so the profile must be part of a
        // deterministic geocoder cache id even when two drivers share a stop.
        // GERS identity travels in the existing private place/alias envelope;
        // no new native SQLite schema or CloudKit record type is required.
        id: overture ? `overture-poi-${userId}-${overture[0]}` : `${pointOfInterest ? 'mapkit-poi' : 'geocoded'}-${userId}-${key}`,
        userId,
        kind: 'geocoded',
        label,
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        radiusMeters: GEOCODED_PLACE_MATCH_RADIUS_METERS,
        foursquareId: null,
        osmId: null,
        cachedUntil: new Date(Date.now() + CACHE_DAYS * 86_400_000).toISOString(),
      });
      enriched += 1;
    } catch {
      recentFailures.set(failureKey, Date.now());
    }
  }
  for (const [key, time] of recentFailures) if (time < Date.now() - FAILURE_RETRY_MS) recentFailures.delete(key);
  if (enriched > 0) notifyLocalArchiveChanged();
  return enriched;
}

/**
 * Resolves a small foreground-only batch using US Overture then native fallback. Results
 * stay in the private local place cache; user-created names always win.
 */
export function enrichJourneyEndpointPlaces(userId: LocalUserId, journeys: JourneyWithRoute[]) {
  const existing = pendingByUser.get(userId);
  if (existing) return existing;
  const pending = runEnrichment(userId, journeys).finally(() => pendingByUser.delete(userId));
  pendingByUser.set(userId, pending);
  return pending;
}
