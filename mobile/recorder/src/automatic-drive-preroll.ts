export type AutomaticDrivePreRollPoint = {
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitudeMeters: number | null;
  headingDegrees: number | null;
  speedMps: number | null;
};

export const AUTOMATIC_DRIVE_PRE_ROLL_RETENTION_MS = 4 * 60_000;
export const AUTOMATIC_DRIVE_PRE_ROLL_MAX_POINTS = 32;
const MAXIMUM_ACCURACY_METERS = 100;
const MOVEMENT_SPEED_MPS = 1.5;
const MAXIMUM_MOVEMENT_GAP_MS = 90_000;

function finite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeAutomaticDrivePreRollPoint(value: unknown): AutomaticDrivePreRollPoint | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<AutomaticDrivePreRollPoint>;
  const timestamp = finite(input.timestamp);
  const latitude = finite(input.latitude);
  const longitude = finite(input.longitude);
  const accuracyMeters = finite(input.accuracyMeters);
  if (timestamp === null || latitude === null || longitude === null || accuracyMeters === null
    || timestamp < 0 || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    || accuracyMeters < 0 || accuracyMeters > MAXIMUM_ACCURACY_METERS) return null;
  const altitude = finite(input.altitudeMeters);
  const heading = finite(input.headingDegrees);
  const speed = finite(input.speedMps);
  return {
    timestamp,
    latitude,
    longitude,
    accuracyMeters,
    altitudeMeters: altitude !== null && altitude >= -1_000 && altitude <= 100_000 ? altitude : null,
    headingDegrees: heading !== null && heading >= 0 && heading <= 360 ? heading : null,
    speedMps: speed !== null && speed >= 0 && speed <= 150 ? speed : null,
  };
}

export function appendAutomaticDrivePreRollPoint(
  current: readonly AutomaticDrivePreRollPoint[],
  value: unknown,
) {
  const point = normalizeAutomaticDrivePreRollPoint(value);
  if (!point) return [...current];
  const minimumTimestamp = point.timestamp - AUTOMATIC_DRIVE_PRE_ROLL_RETENTION_MS;
  return [...current.filter(candidate => candidate.timestamp >= minimumTimestamp && candidate.timestamp !== point.timestamp), point]
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-AUTOMATIC_DRIVE_PRE_ROLL_MAX_POINTS);
}

function distanceMeters(left: AutomaticDrivePreRollPoint, right: AutomaticDrivePreRollPoint) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, haversine));
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

function segmentShowsMovement(left: AutomaticDrivePreRollPoint, right: AutomaticDrivePreRollPoint) {
  const elapsedSeconds = (right.timestamp - left.timestamp) / 1_000;
  if (elapsedSeconds <= 0 || elapsedSeconds > MAXIMUM_MOVEMENT_GAP_MS / 1_000) return false;
  if ((left.speedMps ?? 0) >= MOVEMENT_SPEED_MPS || (right.speedMps ?? 0) >= MOVEMENT_SPEED_MPS) return true;
  const uncertainty = Math.max(left.accuracyMeters, right.accuracyMeters);
  return Math.max(0, distanceMeters(left, right) - uncertainty) / elapsedSeconds >= MOVEMENT_SPEED_MPS;
}

/**
 * Returns the continuous movement leading into a confirmed drive plus one
 * accurate stationary anchor. Confirmation stays conservative, but the saved
 * route starts where the owner actually pulled away rather than at the third
 * high-speed sample.
 */
export function selectAutomaticDrivePreRoll(
  current: readonly AutomaticDrivePreRollPoint[],
  confirmedAt: number,
) {
  const minimumTimestamp = confirmedAt - AUTOMATIC_DRIVE_PRE_ROLL_RETENTION_MS;
  const points = current
    .filter(point => point.timestamp >= minimumTimestamp && point.timestamp <= confirmedAt)
    .sort((left, right) => left.timestamp - right.timestamp);
  if (points.length <= 1) return points;

  let startIndex = points.length - 1;
  for (let index = points.length - 2; index >= 0; index -= 1) {
    if (!segmentShowsMovement(points[index], points[index + 1])) break;
    startIndex = index;
  }
  // The left side of the first moving segment is the accurate stationary
  // anchor, normally the driveway or parking space used for the start place.
  return points.slice(startIndex);
}
