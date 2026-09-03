export type ShareRouteSongPoint = {
  index: number;
  coordinate: [number, number];
};

export type PrivateShareRoute = {
  route: [number, number][];
  songPoints: ShareRouteSongPoint[];
  trimmedStart: boolean;
  trimmedEnd: boolean;
};

export const PRIVATE_SHARE_ROUTE_DISTANCE_METERS = 1_609.344;
const EARTH_RADIUS_METERS = 6_371_000;

function isPrivateLabel(value: string | null) {
  return /^(home|work|school)$/i.test(value?.trim() ?? '');
}

function validCoordinate(value: [number, number]) {
  return Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180
    && Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90;
}

function distanceMeters(left: [number, number], right: [number, number]) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLatitude = toRadians(right[1] - left[1]);
  const dLongitude = toRadians(right[0] - left[0]);
  const value = Math.sin(dLatitude / 2) ** 2
    + Math.cos(toRadians(left[1])) * Math.cos(toRadians(right[1])) * Math.sin(dLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value));
}

function closestRouteIndex(route: [number, number][], coordinate: [number, number]) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const distance = distanceMeters(point, coordinate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * Removes the portion of a share route nearest a Home, Work, or School endpoint.
 *
 * The cut is deterministic: it uses the first recorded point at least one
 * mile from the private endpoint, or the nearest outer soundtrack moment when
 * that hides more of the route. Randomized endpoints are intentionally avoided
 * because repeated cards could otherwise reveal the center of the hidden area.
 */
export function trimPrivateShareRoute({
  route,
  songPoints,
  startLabel,
  endLabel,
  minimumDistanceMeters = PRIVATE_SHARE_ROUTE_DISTANCE_METERS,
}: {
  route: [number, number][];
  songPoints: ShareRouteSongPoint[];
  startLabel: string | null;
  endLabel: string | null;
  minimumDistanceMeters?: number;
}): PrivateShareRoute {
  const validRoute = route.filter(validCoordinate);
  if (validRoute.length < 2) return { route: [], songPoints: [], trimmedStart: false, trimmedEnd: false };

  const locatedSongs = songPoints.filter(point => validCoordinate(point.coordinate));
  const songRouteIndexes = locatedSongs.map(point => ({ point, routeIndex: closestRouteIndex(validRoute, point.coordinate) }));
  const trimmedStart = isPrivateLabel(startLabel);
  const trimmedEnd = isPrivateLabel(endLabel);
  let startIndex = 0;
  let endIndex = validRoute.length - 1;

  if (trimmedStart) {
    const endpoint = validRoute[0]!;
    const mileIndex = validRoute.findIndex(point => distanceMeters(endpoint, point) >= minimumDistanceMeters);
    startIndex = mileIndex >= 0 ? mileIndex : endIndex;
    const firstSong = songRouteIndexes.reduce<typeof songRouteIndexes[number] | null>((selected, item) => {
      if (!selected || item.point.index < selected.point.index) return item;
      return selected;
    }, null);
    if (firstSong && distanceMeters(endpoint, firstSong.point.coordinate) > distanceMeters(endpoint, validRoute[startIndex]!)) {
      startIndex = Math.max(startIndex, firstSong.routeIndex);
    }
  }

  if (trimmedEnd) {
    const endpoint = validRoute.at(-1)!;
    let mileIndex = -1;
    for (let index = validRoute.length - 1; index >= 0; index -= 1) {
      if (distanceMeters(endpoint, validRoute[index]!) >= minimumDistanceMeters) { mileIndex = index; break; }
    }
    endIndex = mileIndex >= 0 ? mileIndex : 0;
    const lastSong = songRouteIndexes.reduce<typeof songRouteIndexes[number] | null>((selected, item) => {
      if (!selected || item.point.index > selected.point.index) return item;
      return selected;
    }, null);
    if (lastSong && distanceMeters(endpoint, lastSong.point.coordinate) > distanceMeters(endpoint, validRoute[endIndex]!)) {
      endIndex = Math.min(endIndex, lastSong.routeIndex);
    }
  }

  if (startIndex >= endIndex) return { route: [], songPoints: [], trimmedStart, trimmedEnd };
  const visibleSongs = songRouteIndexes
    .filter(item => item.routeIndex >= startIndex && item.routeIndex <= endIndex)
    .map(item => item.point);
  return {
    route: validRoute.slice(startIndex, endIndex + 1),
    songPoints: visibleSongs,
    trimmedStart,
    trimmedEnd,
  };
}
