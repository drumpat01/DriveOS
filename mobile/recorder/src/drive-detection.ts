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
};

export type DriveDetectionSample = {
  timestamp: number;
  speedMps: number | null;
  accuracyMeters: number | null;
};

export type DriveDetectionAction = 'none' | 'start' | 'finish';

export const emptyDriveDetectionState = (): DriveDetectionState => ({
  candidateStartedAt: null,
  candidateLastAt: null,
  candidateSamples: 0,
  stoppedSince: null,
});

function resetCandidate(state: DriveDetectionState): DriveDetectionState {
  return { ...state, candidateStartedAt: null, candidateLastAt: null, candidateSamples: 0 };
}

export function evaluateDriveDetection(
  current: DriveDetectionState,
  sample: DriveDetectionSample,
  automaticSessionActive: boolean,
): { state: DriveDetectionState; action: DriveDetectionAction } {
  const timestamp = Number(sample.timestamp);
  const speed = sample.speedMps;
  const accuracy = sample.accuracyMeters;
  if (!Number.isFinite(timestamp) || speed == null || !Number.isFinite(speed) || speed < 0
    || accuracy == null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > DRIVE_SPEED_MAXIMUM_ACCURACY_METERS) {
    return { state: current, action: 'none' };
  }

  if (automaticSessionActive) {
    const state = resetCandidate(current);
    if (speed > DRIVE_STOP_SPEED_MPS) return { state: { ...state, stoppedSince: null }, action: 'none' };
    const stoppedSince = state.stoppedSince ?? timestamp;
    if (timestamp - stoppedSince >= DRIVE_STOP_DURATION_MS) {
      return { state: { ...state, stoppedSince: null }, action: 'finish' };
    }
    return { state: { ...state, stoppedSince }, action: 'none' };
  }

  let state = { ...current, stoppedSince: null };
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
