export const DRIVE_START_SPEED_MPS = 6.7;
export const DRIVE_START_SAMPLE_COUNT = 3;
export const DRIVE_START_MINIMUM_SPAN_MS = 20_000;
export const DRIVE_START_SAMPLE_WINDOW_MS = 120_000;
export const DRIVE_STOP_SPEED_MPS = 2.2;
export const DRIVE_STOP_DURATION_MS = 5 * 60_000;
export const DRIVE_SPEED_MAXIMUM_ACCURACY_METERS = 100;

export type DriveDetectionState = {
  candidateStartedAt: number | null;
  candidateLastAt: number | null;
  candidateSamples: number;
  stoppedSince: number | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastPositionAt: number | null;
  lastPositionAccuracyMeters: number | null;
};

export type DriveDetectionSample = {
  timestamp: number;
  speedMps: number | null;
  accuracyMeters: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type DriveDetectionAction = 'none' | 'start' | 'finish';

export const emptyDriveDetectionState = (): DriveDetectionState => ({
  candidateStartedAt: null,
  candidateLastAt: null,
  candidateSamples: 0,
  stoppedSince: null,
  lastLatitude: null,
  lastLongitude: null,
  lastPositionAt: null,
  lastPositionAccuracyMeters: null,
});

function distanceMeters(leftLatitude: number, leftLongitude: number, rightLatitude: number, rightLongitude: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(rightLatitude - leftLatitude);
  const longitudeDelta = radians(rightLongitude - leftLongitude);
  const left = radians(leftLatitude);
  const right = radians(rightLatitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(left) * Math.cos(right) * Math.sin(longitudeDelta / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, haversine));
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

function withPosition(state: DriveDetectionState, sample: DriveDetectionSample) {
  const latitude = sample.latitude;
  const longitude = sample.longitude;
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return state;
  return {
    ...state,
    lastLatitude: latitude,
    lastLongitude: longitude,
    lastPositionAt: sample.timestamp,
    lastPositionAccuracyMeters: sample.accuracyMeters,
  };
}

function inferredSpeedMps(state: DriveDetectionState, sample: DriveDetectionSample) {
  const latitude = sample.latitude;
  const longitude = sample.longitude;
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || state.lastLatitude == null || state.lastLongitude == null || state.lastPositionAt == null
    || sample.timestamp <= state.lastPositionAt) return null;
  const elapsedSeconds = (sample.timestamp - state.lastPositionAt) / 1000;
  const distance = distanceMeters(state.lastLatitude, state.lastLongitude, latitude, longitude);
  const uncertainty = Math.max(sample.accuracyMeters ?? 0, state.lastPositionAccuracyMeters ?? 0);
  return Math.max(0, distance - uncertainty) / elapsedSeconds;
}

function resetCandidate(state: DriveDetectionState): DriveDetectionState {
  return { ...state, candidateStartedAt: null, candidateLastAt: null, candidateSamples: 0 };
}

export function evaluateDriveDetection(
  current: DriveDetectionState,
  sample: DriveDetectionSample,
  automaticSessionActive: boolean,
): { state: DriveDetectionState; action: DriveDetectionAction } {
  const timestamp = Number(sample.timestamp);
  const accuracy = sample.accuracyMeters;
  if (!Number.isFinite(timestamp) || accuracy == null || !Number.isFinite(accuracy)
    || accuracy < 0 || accuracy > DRIVE_SPEED_MAXIMUM_ACCURACY_METERS) {
    return { state: current, action: 'none' };
  }
  const nativeSpeed = sample.speedMps != null && Number.isFinite(sample.speedMps) && sample.speedMps >= 0
    ? sample.speedMps : null;
  const positionSpeed = inferredSpeedMps(current, { ...sample, timestamp });
  const speed = nativeSpeed == null ? positionSpeed : Math.max(nativeSpeed, positionSpeed ?? 0);
  const positionedState = withPosition(current, { ...sample, timestamp });

  if (automaticSessionActive) {
    const state = resetCandidate(positionedState);
    // Core Location commonly reports -1 (unknown) for speed after a vehicle
    // parks. An accurate stationary position is still evidence that the phone
    // is stopped, and prevents the parked timer from stalling indefinitely.
    // Once recording is active, displacement between accurate fixes is a more
    // reliable parking signal than Core Location's speed field. iOS can repeat
    // the last positive speed briefly after a vehicle stops. Starting still
    // uses the conservative maximum above, so GPS drift cannot start a drive.
    const effectiveSpeed = positionSpeed ?? nativeSpeed ?? (positionedState !== current ? 0 : null);
    if (effectiveSpeed == null) return { state, action: 'none' };
    if (effectiveSpeed > DRIVE_STOP_SPEED_MPS) return { state: { ...state, stoppedSince: null }, action: 'none' };
    const stoppedSince = state.stoppedSince ?? timestamp;
    if (timestamp - stoppedSince >= DRIVE_STOP_DURATION_MS) {
      return { state: { ...state, stoppedSince: null }, action: 'finish' };
    }
    return { state: { ...state, stoppedSince }, action: 'none' };
  }

  if (speed == null) return { state: positionedState, action: 'none' };
  let state = { ...positionedState, stoppedSince: null };
  if (speed < DRIVE_START_SPEED_MPS) return { state: resetCandidate(state), action: 'none' };
  const expired = state.candidateLastAt == null || state.candidateStartedAt == null || timestamp < state.candidateLastAt
    || timestamp - state.candidateLastAt > DRIVE_START_SAMPLE_WINDOW_MS
    || timestamp - state.candidateStartedAt > DRIVE_START_SAMPLE_WINDOW_MS;
  state = expired ? {
    ...state,
    candidateStartedAt: timestamp,
    candidateLastAt: timestamp,
    candidateSamples: 1,
  } : {
    ...state,
    candidateStartedAt: state.candidateStartedAt ?? timestamp,
    candidateLastAt: timestamp,
    candidateSamples: state.candidateSamples + 1,
  };
  const span = timestamp - (state.candidateStartedAt ?? timestamp);
  if (state.candidateSamples >= DRIVE_START_SAMPLE_COUNT && span >= DRIVE_START_MINIMUM_SPAN_MS) {
    return { state: resetCandidate(state), action: 'start' };
  }
  return { state, action: 'none' };
}
