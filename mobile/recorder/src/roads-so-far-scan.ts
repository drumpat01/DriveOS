import * as Crypto from 'expo-crypto';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { appDataClient } from './app-data';
import { getCurrentUser } from './auth';
import { loadFiftyStates, saveFiftyStates } from './fifty-states-store';
import type { USStateCode } from './fifty-states-model';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { photoMatchingLibrary, type PhotoLibraryPermission } from './photo-matching-library';
import { V4_REDESIGN_ENABLED } from './release-features';
import { summarizeRoads, tripDates, type FoundTrip, type PlacedPhoto, type RoadsSoFar } from './roads-so-far-model';

type ExpoMediaLibrary = typeof import('expo-media-library/legacy');

/** Newest photos read, at most. Enough for several years of road trips on most libraries. */
const MAX_PHOTOS = 6000;
const PAGE = 500;
/** Photos copied into each saved Memory; the rest stay in the user's library. */
const PHOTOS_PER_MEMORY = 6;

export const ROADS_SCAN_AVAILABLE = requireOptionalNativeModule('ExpoMediaLibrary') !== null;
/** The "See where you've been" onboarding step: V4 builds that can read Photos. */
export const ROADS_STEP_ENABLED = V4_REDESIGN_ENABLED && ROADS_SCAN_AVAILABLE;

export type RoadsScanProgress = { photos: number; places: number; states: number; phase: 'reading' | 'grouping' };

export class RoadsScanCancelled extends Error {}

/** Asks for Photos access through the same path Photo Matching uses. */
export async function requestRoadsAccess(): Promise<PhotoLibraryPermission> {
  if (!ROADS_SCAN_AVAILABLE) return 'unavailable';
  return (await photoMatchingLibrary.requestPermission()).permission;
}

/**
 * Reads only the date and location of the newest photos, on the device, and
 * summarizes them. Nothing is copied or uploaded here.
 */
export async function scanRoadsSoFar(onProgress: (progress: RoadsScanProgress) => void, isCancelled: () => boolean): Promise<RoadsSoFar> {
  const library = require('expo-media-library/legacy') as ExpoMediaLibrary;
  const photos: PlacedPhoto[] = [];
  const cells = new Set<string>();
  let after: string | undefined;
  let read = 0;
  while (read < MAX_PHOTOS) {
    const page = await library.getAssetsAsync({ mediaType: 'photo', first: PAGE, after, sortBy: [['creationTime', false]] });
    if (isCancelled()) throw new RoadsScanCancelled();
    for (const asset of page.assets) {
      read += 1;
      const latitude = asset.location?.latitude, longitude = asset.location?.longitude;
      if (asset.mediaSubtypes?.includes('screenshot') || typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(asset.creationTime)) continue;
      photos.push({ id: asset.id, takenAtMs: asset.creationTime, latitude, longitude });
      cells.add(`${Math.floor(latitude * 10)}:${Math.floor(longitude * 10)}`);
    }
    onProgress({ photos: read, places: cells.size, states: 0, phase: 'reading' });
    if (!page.hasNextPage || !page.assets.length) break;
    after = page.endCursor;
  }
  onProgress({ photos: read, places: cells.size, states: 0, phase: 'grouping' });
  await new Promise(resolve => setTimeout(resolve, 0));
  const roads = summarizeRoads(photos);
  if (isCancelled()) throw new RoadsScanCancelled();
  onProgress({ photos: read, places: roads.places, states: roads.states.length, phase: 'grouping' });
  return roads;
}

/** Adds the found states to 50 States without removing any the user already checked. */
export function saveFoundStates(states: readonly USStateCode[]) {
  const userId = getCurrentUser().id;
  const seen = loadFiftyStates(userId);
  return saveFiftyStates(userId, [...new Set([...seen, ...states])]);
}

/**
 * Saves each chosen trip as a Memory with a few of its photos. Photos are copied
 * through Photo Matching's existing private import path, so they sync like any
 * photo a person adds. A trip whose photos cannot be copied is still saved.
 */
export async function saveTripsAsMemories(trips: readonly FoundTrip[]) {
  const saved: string[] = [];
  for (const trip of trips) {
    const memory = await appDataClient.saveMemory({ name: trip.name, notes: `Found in your photos · ${tripDates(trip.startMs, trip.endMs)}`, journeyIds: [] });
    saved.push(memory.id);
    try {
      const scanId = Crypto.randomUUID();
      const startMs = trip.startMs - 60_000;
      const endMs = Math.min(trip.endMs + 60_000, startMs + 30 * 86_400_000);
      const scan = await photoMatchingLibrary.scan(scanId, [{ startMs, endMs }]);
      const allowed = new Set(scan.assets.map(asset => asset.id));
      const chosen = spread(trip.photoIds.filter(id => allowed.has(id)), PHOTOS_PER_MEMORY);
      let coverPhotoId: string | null = null;
      for (const assetId of chosen) {
        try {
          const photo = await photoMatchingLibrary.export(scanId, assetId);
          const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${memory.id}\n${assetId}`);
          const stored = await appDataClient.uploadMemoryPhoto(memory.id, { ...photo, fileName: `roads-${digest}.jpg` });
          coverPhotoId ??= stored.id;
        } catch { /* One photo that will not copy never blocks the Memory. */ }
      }
      void photoMatchingLibrary.cancel(scanId).catch(() => undefined);
      if (coverPhotoId) await appDataClient.saveMemory({ id: memory.id, name: memory.name, notes: memory.notes, coverPhotoId, journeyIds: [] });
    } catch { /* The Memory stays saved without photos. */ }
  }
  notifyLocalArchiveChanged();
  return saved;
}

/** Evenly spaced picks, so a Memory's photos span the whole trip. */
function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, index) => items[Math.round((index * (items.length - 1)) / (count - 1))]!);
}
