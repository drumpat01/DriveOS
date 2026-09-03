import {
  deletePlace,
  getPlace,
  getPrivatePreference,
  upsertPlace,
  upsertPrivatePreference,
  type LocalPlace,
  type LocalUserId,
} from './local-store';
import { notifyLocalArchiveChanged } from './local-archive-events';

export type SavedPlaceSlot = 'home' | 'work' | 'school';

export const SAVED_PLACE_SLOTS: ReadonlyArray<{ id: SavedPlaceSlot; label: string; symbol: string }> = [
  { id: 'home', label: 'Home', symbol: 'house.fill' },
  { id: 'work', label: 'Work', symbol: 'briefcase.fill' },
  { id: 'school', label: 'School', symbol: 'graduationcap.fill' },
];

type StoredSavedPlace = {
  enabled: boolean;
  latitude?: number;
  longitude?: number;
};

const SAVED_PLACE_RADIUS_METERS = 300;

function preferenceKey(slot: SavedPlaceSlot) {
  return `saved-place.v1.${slot}`;
}

function placeId(userId: LocalUserId, slot: SavedPlaceSlot) {
  return `saved-place-v1-${slot}-${userId}`;
}

function placeLabel(slot: SavedPlaceSlot) {
  return slot === 'home' ? 'Home' : slot === 'work' ? 'Work' : 'School';
}

function hasValidCoordinate(value: Pick<StoredSavedPlace, 'latitude' | 'longitude'>): value is { latitude: number; longitude: number } {
  return typeof value.latitude === 'number' && Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180;
}

function materializeSavedPlace(userId: LocalUserId, slot: SavedPlaceSlot, stored: StoredSavedPlace): LocalPlace | null {
  const id = placeId(userId, slot);
  if (!stored.enabled) {
    deletePlace(userId, id);
    return null;
  }
  if (!hasValidCoordinate(stored)) return null;
  const label = placeLabel(slot);
  const kind = slot === 'school' ? 'custom' : slot;
  const existing = getPlace(userId, id);
  if (existing && existing.kind === kind && existing.label === label
    && existing.lat === stored.latitude && existing.lng === stored.longitude
    && existing.radiusMeters === SAVED_PLACE_RADIUS_METERS) return existing;
  return upsertPlace({
    id,
    userId,
    kind,
    label,
    lat: stored.latitude,
    lng: stored.longitude,
    radiusMeters: SAVED_PLACE_RADIUS_METERS,
    foursquareId: null,
    osmId: null,
    cachedUntil: null,
  });
}

export function loadSavedPlaces(userId: LocalUserId): Record<SavedPlaceSlot, LocalPlace | null> {
  const result = { home: null, work: null, school: null } as Record<SavedPlaceSlot, LocalPlace | null>;
  for (const slot of SAVED_PLACE_SLOTS) {
    const stored = getPrivatePreference<StoredSavedPlace>(userId, preferenceKey(slot.id));
    result[slot.id] = stored ? materializeSavedPlace(userId, slot.id, stored) : getPlace(userId, placeId(userId, slot.id));
  }
  return result;
}

export function saveSavedPlace(userId: LocalUserId, slot: SavedPlaceSlot, latitude: number, longitude: number): LocalPlace {
  if (!hasValidCoordinate({ latitude, longitude })) throw new Error('That location is not valid.');
  const stored: StoredSavedPlace = { enabled: true, latitude, longitude };
  const place = materializeSavedPlace(userId, slot, stored);
  if (!place) throw new Error('JourneyDeck could not save that place.');
  upsertPrivatePreference(userId, preferenceKey(slot), stored);
  notifyLocalArchiveChanged();
  return place;
}

export function removeSavedPlace(userId: LocalUserId, slot: SavedPlaceSlot): void {
  upsertPrivatePreference(userId, preferenceKey(slot), { enabled: false } satisfies StoredSavedPlace);
  deletePlace(userId, placeId(userId, slot));
  notifyLocalArchiveChanged();
}
