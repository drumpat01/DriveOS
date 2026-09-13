export const MANUAL_RECORDING_INACTIVITY_LIMIT_MS = 10 * 60_000;
export const MANUAL_RECORDING_MAXIMUM_DURATION_MS = 24 * 60 * 60_000;
export const MANUAL_RECORDING_MOVEMENT_SPEED_MPS = 2.2;
export const MANUAL_RECORDING_MAXIMUM_ACCURACY_METERS = 50;

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
  let stationarySince: number | null = null;
  let previous: FailsafePoint | null = null;
  let recentMovementAnchor: FailsafePoint | null = null;
  let latestAt: number | null = null;
  for (const point of [...points].sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt))) {
    const recordedAtMs = Date.parse(point.recordedAt);
    if (!Number.isFinite(recordedAtMs) || recordedAtMs < startedAtMs || recordedAtMs > evaluatedAtMs
      || (latestAt != null && recordedAtMs <= latestAt)) continue;
    if (!validAccuratePoint(point, startedAtMs, evaluatedAtMs)) {
      stationarySince = null; previous = null; recentMovementAnchor = null; latestAt = recordedAtMs;
      continue;
    }
    if (latestAt != null && recordedAtMs - latestAt > 120_000) { stationarySince = null; previous = null; recentMovementAnchor = null; }
    latestAt = recordedAtMs;
    // A separate short baseline catches a fresh departure before a longer
    // uncertainty baseline can average it together with the parked interval.
    if (recentMovementAnchor) {
      const recentSeconds = (recordedAtMs - Date.parse(recentMovementAnchor.recordedAt)) / 1000;
      if (recentSeconds >= 15) {
        const lowerSpeed = Math.max(0, distanceMeters(recentMovementAnchor, point)
          - Math.max(recentMovementAnchor.accuracyMeters ?? 0, point.accuracyMeters ?? 0)) / recentSeconds;
        recentMovementAnchor = point;
        if (lowerSpeed > MANUAL_RECORDING_MOVEMENT_SPEED_MPS) {
          stationarySince = null; previous = point;
          continue;
        }
      }
    } else recentMovementAnchor = point;
    if (!previous) {
      previous = point;
      stationarySince = point.speedMps != null && point.speedMps >= 0 && point.speedMps <= 2.2 ? recordedAtMs : null;
      continue;
    }
    const previousAtMs = Date.parse(previous.recordedAt);
    const elapsedSeconds = (recordedAtMs - previousAtMs) / 1000;
    if (elapsedSeconds < 15) continue;
    const uncertainty = Math.max(previous.accuracyMeters ?? 0, point.accuracyMeters ?? 0);
    const distance = distanceMeters(previous, point);
    const lowerSpeed = Math.max(0, distance - uncertainty) / elapsedSeconds;
    // Give accepted GPS uncertainty time to resolve (up to 100 seconds at
    // 50m). Replacing the anchor every 15 seconds can classify a parked
    // phone as ambiguous forever. Clear confirmed driving immediately.
    if (lowerSpeed > MANUAL_RECORDING_MOVEMENT_SPEED_MPS) {
      stationarySince = null; previous = point;
      continue;
    }
    if (elapsedSeconds < Math.max(15, uncertainty / 0.5)) continue;
    const upperSpeed = (distance + uncertainty) / elapsedSeconds;
    if (upperSpeed <= MANUAL_RECORDING_MOVEMENT_SPEED_MPS) {
      stationarySince ??= previousAtMs;
    } else {
      stationarySince = null;
    }
    previous = point;
  }
  return latestAt != null && evaluatedAtMs - latestAt <= 60_000 ? stationarySince : null;
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
  if (lastMovementAt === null) return continueRecording();
  const inactiveForMs = Math.max(0, evaluatedAtMs - lastMovementAt);
  if (inactiveForMs >= MANUAL_RECORDING_INACTIVITY_LIMIT_MS) {
    return { shouldFinish: true, reason: 'stationary_timeout', inactiveForMs };
  }
  return continueRecording(inactiveForMs);
}

export function manualRecordingFailsafeNotice(reason: ManualRecordingFailsafeReason): string {
  return reason === 'maximum_duration'
    ? 'Journey finished automatically at the 24-hour safety limit.'
    : 'Journey finished automatically after 10 minutes without driving.';
}
