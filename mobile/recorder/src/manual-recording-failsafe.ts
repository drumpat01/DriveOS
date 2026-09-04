export const MANUAL_RECORDING_INACTIVITY_LIMIT_MS = 15 * 60_000;
export const MANUAL_RECORDING_MAXIMUM_DURATION_MS = 24 * 60 * 60_000;
export const MANUAL_RECORDING_MOVEMENT_SPEED_MPS = 2.2;
export const MANUAL_RECORDING_MAXIMUM_ACCURACY_METERS = 100;

export type ManualRecordingFailsafeReason = 'stationary_timeout' | 'maximum_duration';

export type ManualRecordingFailsafeDecision = {
  shouldFinish: boolean;
  reason: ManualRecordingFailsafeReason | null;
  inactiveForMs: number;
};

type FailsafeSession = {
  id: string;
  status: 'recording' | 'paused' | 'finishing' | 'completed';
  startedAt: string;
};

type FailsafePoint = {
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMps: number | null;
};

const continueRecording = (inactiveForMs = 0): ManualRecordingFailsafeDecision => ({
  shouldFinish: false,
  reason: null,
  inactiveForMs,
});

function distanceMeters(left: FailsafePoint, right: FailsafePoint): number {
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

function validAccuratePoint(point: FailsafePoint, startedAtMs: number, evaluatedAtMs: number) {
  const recordedAtMs = Date.parse(point.recordedAt);
  return Number.isFinite(recordedAtMs) && recordedAtMs >= startedAtMs && recordedAtMs <= evaluatedAtMs
    && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
    && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180
    && point.accuracyMeters != null && Number.isFinite(point.accuracyMeters)
    && point.accuracyMeters >= 0 && point.accuracyMeters <= MANUAL_RECORDING_MAXIMUM_ACCURACY_METERS;
}

function lastMeaningfulMovementAt(points: FailsafePoint[], startedAtMs: number, evaluatedAtMs: number) {
  let lastMovementAt = startedAtMs;
  let previous: FailsafePoint | null = null;
  for (const point of [...points].sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt))) {
    if (!validAccuratePoint(point, startedAtMs, evaluatedAtMs)) continue;
    const recordedAtMs = Date.parse(point.recordedAt);
    const nativeSpeed = point.speedMps != null && Number.isFinite(point.speedMps)
      && point.speedMps >= 0 && point.speedMps <= 150 ? point.speedMps : null;
    let inferredSpeed: number | null = null;
    if (previous) {
      const previousAtMs = Date.parse(previous.recordedAt);
      const elapsedSeconds = (recordedAtMs - previousAtMs) / 1000;
      if (elapsedSeconds > 0) {
        const uncertainty = Math.max(previous.accuracyMeters ?? 0, point.accuracyMeters ?? 0);
        inferredSpeed = Math.max(0, distanceMeters(previous, point) - uncertainty) / elapsedSeconds;
      }
    }
    // Once two trustworthy positions exist, displacement is more reliable than
    // iOS briefly repeating a positive speed after the vehicle has parked.
    const effectiveSpeed = inferredSpeed ?? nativeSpeed;
    if (effectiveSpeed != null && effectiveSpeed > MANUAL_RECORDING_MOVEMENT_SPEED_MPS) {
      lastMovementAt = recordedAtMs;
    }
    previous = point;
  }
  return lastMovementAt;
}

export function evaluateManualRecordingFailsafe(input: {
  session: FailsafeSession | null;
  route: FailsafePoint[];
  evaluatedAtMs?: number;
  automaticSessionId?: string | null;
}): ManualRecordingFailsafeDecision {
  const { session } = input;
  if (!session || session.status === 'completed' || session.status === 'finishing'
    || session.id.startsWith('native_recording_') || session.id === input.automaticSessionId) {
    return continueRecording();
  }
  const evaluatedAtMs = input.evaluatedAtMs ?? Date.now();
  const startedAtMs = Date.parse(session.startedAt);
  if (!Number.isFinite(evaluatedAtMs) || !Number.isFinite(startedAtMs) || evaluatedAtMs < startedAtMs) {
    return continueRecording();
  }
  const durationMs = evaluatedAtMs - startedAtMs;
  if (durationMs >= MANUAL_RECORDING_MAXIMUM_DURATION_MS) {
    return { shouldFinish: true, reason: 'maximum_duration', inactiveForMs: durationMs };
  }
  if (session.status !== 'recording') return continueRecording();
  const lastMovementAt = lastMeaningfulMovementAt(input.route, startedAtMs, evaluatedAtMs);
  const inactiveForMs = Math.max(0, evaluatedAtMs - lastMovementAt);
  if (inactiveForMs >= MANUAL_RECORDING_INACTIVITY_LIMIT_MS) {
    return { shouldFinish: true, reason: 'stationary_timeout', inactiveForMs };
  }
  return continueRecording(inactiveForMs);
}

export function manualRecordingFailsafeNotice(reason: ManualRecordingFailsafeReason): string {
  return reason === 'maximum_duration'
    ? 'Journey finished automatically at the 24-hour safety limit.'
    : 'Journey finished automatically after 15 minutes without driving.';
}
