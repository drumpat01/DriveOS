import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { lookupNearbyMapKitPointsOfInterest } from '../modules/journeydeck-recorder';
import { notifyLocalArchiveChanged } from './local-archive-events';
import {
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
  if (AppState.currentState && AppState.currentState !== 'active') return 0;

  const seen = new Set<string>();
  const candidates: PlaceCoordinate[] = [];
  const sorted = [...journeys].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  for (const journey of sorted) {
    for (const coordinate of endpointCoordinates(journey)) {
      const key = candidateKey(coordinate);
      if (seen.has(key)) continue;
      seen.add(key);
      if (findNamedPlace(userId, coordinate.latitude, coordinate.longitude, SAVED_PLACE_MATCH_RADIUS_METERS)) continue;
      if (findCachedPlace(userId, coordinate.latitude, coordinate.longitude, GEOCODED_PLACE_MATCH_RADIUS_METERS)) continue;
      if ((recentFailures.get(key) ?? 0) > Date.now() - FAILURE_RETRY_MS) continue;
      candidates.push(coordinate);
      if (candidates.length >= MAX_LOOKUPS_PER_PASS) break;
    }
    if (candidates.length >= MAX_LOOKUPS_PER_PASS) break;
  }

  let enriched = 0;
  for (const coordinate of candidates) {
    const key = candidateKey(coordinate);
    try {
      const nearby = await lookupNearbyMapKitPointsOfInterest(
        coordinate.latitude,
        coordinate.longitude,
        MAPKIT_POI_SEARCH_RADIUS_METERS,
      );
      const pointOfInterest = nearby.find(candidate => candidate.distanceMeters <= MAPKIT_POI_MAX_MATCH_DISTANCE_METERS);
      const [address] = pointOfInterest ? [] : await Location.reverseGeocodeAsync(coordinate);
      const label = pointOfInterest?.name ?? (address ? bestPlaceLabelFromAddress(address) : null);
      if (!label) {
        recentFailures.set(key, Date.now());
        continue;
      }
      upsertPlace({
        // local_places ids are database-wide, so the profile must be part of a
        // deterministic geocoder cache id even when two drivers share a stop.
        id: `${pointOfInterest ? 'mapkit-poi' : 'geocoded'}-${userId}-${key}`,
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
      recentFailures.set(key, Date.now());
    }
  }
  if (enriched > 0) notifyLocalArchiveChanged();
  return enriched;
}

/**
 * Resolves a small foreground-only batch through the device geocoder. Results
 * stay in the private local place cache; user-created names always win.
 */
export function enrichJourneyEndpointPlaces(userId: LocalUserId, journeys: JourneyWithRoute[]) {
  const existing = pendingByUser.get(userId);
  if (existing) return existing;
  const pending = runEnrichment(userId, journeys).finally(() => pendingByUser.delete(userId));
  pendingByUser.set(userId, pending);
  return pending;
}
