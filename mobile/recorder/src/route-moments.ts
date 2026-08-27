export type RouteCoordinate = [number, number];

export type TimedRouteSample = {
  recordedAt: string;
  coordinate: RouteCoordinate;
  speedMph?: number | null;
  headingDegrees?: number | null;
  batteryPercent?: number | null;
};

export type SongRouteMoment = {
  index: number;
  coordinate: RouteCoordinate;
  track: string;
  artist: string;
  album: string | null;
  playedAt: string;
  durationMs: number | null;
  artworkUrl: string | null;
  externalUrl: string | null;
};

export type ReplayRoutePoint = {
  recordedAtEpochMs: number;
  coordinate: RouteCoordinate;
  speedMph: number | null;
  headingDegrees: number | null;
  batteryPercent: number | null;
};

export type ReplaySnapshot = ReplayRoutePoint & { progress: number };

type TimestampedTrack = {
  playedAt: string | null;
  track: string;
  artist: string;
  album?: string | null;
  durationMs?: number | null;
  artworkUrl?: string | null;
  externalUrl?: string | null;
  mapCoordinate?: RouteCoordinate | null;
};

function validCoordinate(value: unknown): value is RouteCoordinate {
  return Array.isArray(value)
    && value.length === 2
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && value[0] >= -180
    && value[0] <= 180
    && value[1] >= -90
    && value[1] <= 90;
}

/** Finds the closest recorded GPS breadcrumb to a timestamp. */
export function coordinateAtRecordedTime(samples: TimedRouteSample[], timestamp: string | null): RouteCoordinate | null {
  const target = timestamp ? Date.parse(timestamp) : Number.NaN;
  if (!Number.isFinite(target)) return null;
  let closest: RouteCoordinate | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const recorded = Date.parse(sample.recordedAt);
    if (!Number.isFinite(recorded) || !validCoordinate(sample.coordinate)) continue;
    const distance = Math.abs(recorded - target);
    if (distance < closestDistance) {
      closest = sample.coordinate;
      closestDistance = distance;
    }
  }
  return closest;
}

/**
 * Places soundtrack moments on the recorded line. Exact coordinates supplied by
 * timestamped on-device/server GPS samples win. Older journeys fall back to a
 * time-proportional point along their ordered route geometry.
 */
export function buildSongRouteMoments(
  tracks: TimestampedTrack[],
  routeCoordinates: RouteCoordinate[],
  startedAt: string,
  endedAt: string,
): SongRouteMoment[] {
  const coordinates = routeCoordinates.filter(validCoordinate);
  if (coordinates.length < 2) return [];
  const started = Date.parse(startedAt), ended = Date.parse(endedAt);
  const duration = ended - started;

  return tracks.flatMap((track, index) => {
    if (!track.playedAt) return [];
    let coordinate = validCoordinate(track.mapCoordinate) ? track.mapCoordinate : null;
    const played = Date.parse(track.playedAt);
    if (!coordinate && Number.isFinite(played) && Number.isFinite(duration) && duration > 0) {
      const progress = Math.max(0, Math.min(1, (played - started) / duration));
      const position = progress * (coordinates.length - 1);
      const lowerIndex = Math.floor(position), upperIndex = Math.min(coordinates.length - 1, Math.ceil(position));
      const fraction = position - lowerIndex;
      const lower = coordinates[lowerIndex]!, upper = coordinates[upperIndex]!;
      coordinate = [
        lower[0] + (upper[0] - lower[0]) * fraction,
        lower[1] + (upper[1] - lower[1]) * fraction,
      ];
    }
    return coordinate ? [{
      index: index + 1,
      coordinate,
      track: track.track,
      artist: track.artist,
      album: track.album ?? null,
      playedAt: track.playedAt,
      durationMs: track.durationMs ?? null,
      artworkUrl: track.artworkUrl ?? null,
      externalUrl: track.externalUrl ?? null,
    }] : [];
  });
}

function finiteOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function interpolateNumber(left: number | null, right: number | null, fraction: number) {
  if (left === null && right === null) return null;
  if (left === null) return right;
  if (right === null) return left;
  return left + (right - left) * fraction;
}

function headingDelta(from: number, to: number) {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

/** Great-circle distance used by the native nearby-music search and replay fallback. */
export function routeDistanceMiles(left: RouteCoordinate, right: RouteCoordinate) {
  const radians = Math.PI / 180;
  const latitudeDelta = (right[1] - left[1]) * radians;
  const longitudeDelta = (right[0] - left[0]) * radians;
  const leftLatitude = left[1] * radians;
  const rightLatitude = right[1] * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}

function routeHeading(left: RouteCoordinate, right: RouteCoordinate) {
  const radians = Math.PI / 180;
  const leftLatitude = left[1] * radians;
  const rightLatitude = right[1] * radians;
  const longitudeDelta = (right[0] - left[0]) * radians;
  const y = Math.sin(longitudeDelta) * Math.cos(rightLatitude);
  const x = Math.cos(leftLatitude) * Math.sin(rightLatitude)
    - Math.sin(leftLatitude) * Math.cos(rightLatitude) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

/**
 * Builds a complete replay timeline. Exact server/on-device telemetry wins;
 * coordinate-only cached journeys receive honest geometric estimates.
 */
export function buildReplayRoute(
  coordinates: RouteCoordinate[],
  samples: TimedRouteSample[] | undefined,
  startedAt: string,
  endedAt: string,
  startingBatteryPercent: number | null,
  endingBatteryPercent: number | null,
): ReplayRoutePoint[] {
  const validCoordinates = coordinates.filter(validCoordinate);
  if (validCoordinates.length < 2) return [];
  const parsedStart = Date.parse(startedAt);
  const parsedEnd = Date.parse(endedAt);
  const fallbackDuration = Math.max(1, validCoordinates.length - 1) * 60_000;
  const start = Number.isFinite(parsedStart)
    ? parsedStart
    : Number.isFinite(parsedEnd) ? parsedEnd - fallbackDuration : 0;
  const end = Number.isFinite(parsedEnd) && parsedEnd > start ? parsedEnd : start + fallbackDuration;
  const sampleCandidates = (samples ?? []).filter(sample => validCoordinate(sample.coordinate));
  const source: TimedRouteSample[] = sampleCandidates.length >= 2 ? sampleCandidates : validCoordinates.map((coordinate, index) => ({
    coordinate,
    recordedAt: new Date(start + ((end - start) * index / Math.max(1, validCoordinates.length - 1))).toISOString(),
  }));
  const normalized = source.map((sample, index) => {
    const parsed = Date.parse(sample.recordedAt);
    const recordedAtEpochMs = Number.isFinite(parsed)
      ? clamp(parsed, start, end)
      : start + ((end - start) * index / Math.max(1, source.length - 1));
    const progress = (recordedAtEpochMs - start) / Math.max(1, end - start);
    return {
      recordedAtEpochMs,
      coordinate: sample.coordinate,
      speedMph: finiteOrNull(sample.speedMph),
      headingDegrees: finiteOrNull(sample.headingDegrees),
      batteryPercent: finiteOrNull(sample.batteryPercent)
        ?? interpolateNumber(finiteOrNull(startingBatteryPercent), finiteOrNull(endingBatteryPercent), progress),
    } satisfies ReplayRoutePoint;
  }).sort((left, right) => left.recordedAtEpochMs - right.recordedAtEpochMs);

  return normalized.map((point, index) => {
    const previous = normalized[Math.max(0, index - 1)]!;
    const next = normalized[Math.min(normalized.length - 1, index + 1)]!;
    const elapsedHours = (next.recordedAtEpochMs - previous.recordedAtEpochMs) / 3_600_000;
    const estimatedSpeed = elapsedHours > 0 ? routeDistanceMiles(previous.coordinate, next.coordinate) / elapsedHours : null;
    const estimatedHeading = routeDistanceMiles(point.coordinate, next.coordinate) > 0.0005
      ? routeHeading(point.coordinate, next.coordinate)
      : routeHeading(previous.coordinate, point.coordinate);
    return {
      ...point,
      speedMph: point.speedMph ?? (estimatedSpeed !== null && estimatedSpeed <= 180 ? estimatedSpeed : null),
      headingDegrees: point.headingDegrees ?? estimatedHeading,
    };
  });
}

/** Interpolates location, heading, speed, and battery for the replay scrubber. */
export function replaySnapshotAt(points: ReplayRoutePoint[], timestampMs: number): ReplaySnapshot | null {
  if (!points.length) return null;
  const first = points[0]!, last = points.at(-1)!;
  const target = clamp(timestampMs, first.recordedAtEpochMs, last.recordedAtEpochMs);
  let rightIndex = points.findIndex(point => point.recordedAtEpochMs >= target);
  if (rightIndex < 0) rightIndex = points.length - 1;
  const leftIndex = Math.max(0, rightIndex - 1);
  const left = points[leftIndex]!, right = points[rightIndex]!;
  const fraction = clamp((target - left.recordedAtEpochMs) / Math.max(1, right.recordedAtEpochMs - left.recordedAtEpochMs), 0, 1);
  const leftHeading = finiteOrNull(left.headingDegrees), rightHeading = finiteOrNull(right.headingDegrees);
  let heading = interpolateNumber(leftHeading, rightHeading, fraction);
  if (leftHeading !== null && rightHeading !== null) heading = (leftHeading + headingDelta(leftHeading, rightHeading) * fraction + 360) % 360;
  return {
    recordedAtEpochMs: target,
    coordinate: [
      left.coordinate[0] + (right.coordinate[0] - left.coordinate[0]) * fraction,
      left.coordinate[1] + (right.coordinate[1] - left.coordinate[1]) * fraction,
    ],
    speedMph: interpolateNumber(left.speedMph, right.speedMph, fraction),
    headingDegrees: heading,
    batteryPercent: interpolateNumber(left.batteryPercent, right.batteryPercent, fraction),
    progress: (target - first.recordedAtEpochMs) / Math.max(1, last.recordedAtEpochMs - first.recordedAtEpochMs),
  };
}

export function songAtReplayTime(moments: SongRouteMoment[], timestampMs: number) {
  return moments.find(moment => {
    const start = Date.parse(moment.playedAt);
    const end = start + Math.max(1, moment.durationMs ?? 180_000);
    return Number.isFinite(start) && timestampMs >= start && timestampMs < end;
  }) ?? null;
}

export function nearbySongMoments(moments: SongRouteMoment[], coordinate: RouteCoordinate, radiusMiles: number) {
  return moments
    .map(moment => ({ ...moment, distanceMiles: routeDistanceMiles(coordinate, moment.coordinate) }))
    .filter(moment => moment.distanceMiles <= radiusMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles || left.index - right.index);
}
