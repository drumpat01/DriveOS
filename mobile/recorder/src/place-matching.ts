export type PlaceCoordinate = { latitude: number; longitude: number };

// A recorded endpoint can move noticeably between visits because the phone is
// parked on a different side of a property, GPS settles late, or the compact
// coordinate identity below rounds the original sample. Keep user-created
// place names local to the same property without requiring an exact GPS match.
export const SAVED_PLACE_MATCH_RADIUS_METERS = 250;
export const GEOCODED_PLACE_MATCH_RADIUS_METERS = 150;

export type ReverseGeocodedAddressLike = {
  name?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  formattedAddress?: string | null;
};

function cleanAddressPart(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || null;
}

/** Builds the shortest useful on-device label returned by Apple's geocoder. */
export function bestPlaceLabelFromAddress(address: ReverseGeocodedAddressLike) {
  const name = cleanAddressPart(address.name);
  const street = cleanAddressPart(address.street);
  const streetNumber = cleanAddressPart(address.streetNumber);
  const streetLine = [streetNumber, street].filter(Boolean).join(' ') || null;
  const formatted = cleanAddressPart(address.formattedAddress);
  const city = cleanAddressPart(address.city);
  const region = cleanAddressPart(address.region);

  // On iOS `name` is either a point-of-interest name or the composed street
  // address. Both are more useful than a city-only journey label.
  if (name && name.toLocaleLowerCase() !== street?.toLocaleLowerCase()) return name;
  if (streetLine) return streetLine;
  if (formatted) return formatted.split(',').slice(0, 2).map(part => part.trim()).filter(Boolean).join(', ');
  return [city, region].filter(Boolean).join(', ') || null;
}

export function coordinatePlaceAliasIdentity(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
  // This identity remains useful for exact lookups. Nearby propagation uses
  // real distance so ordinary GPS drift cannot split one address into two.
  return `coordinate:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

export function coordinateFromPlaceAliasIdentity(location: string): PlaceCoordinate | null {
  const match = /^coordinate:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(location.trim());
  if (!match) return null;
  const latitude = Number(match[1]), longitude = Number(match[2]);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ? { latitude, longitude }
    : null;
}

export function distanceBetweenCoordinatesMeters(left: PlaceCoordinate, right: PlaceCoordinate) {
  const radius = 6_371_000;
  const dLat = ((right.latitude - left.latitude) * Math.PI) / 180;
  const dLng = ((right.longitude - left.longitude) * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos((left.latitude * Math.PI) / 180) * Math.cos((right.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

export function coordinatesShareSavedPlace(left: PlaceCoordinate, right: PlaceCoordinate, radiusMeters = SAVED_PLACE_MATCH_RADIUS_METERS) {
  return distanceBetweenCoordinatesMeters(left, right) <= radiusMeters;
}
