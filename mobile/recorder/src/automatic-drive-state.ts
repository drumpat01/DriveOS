import { emptyDriveDetectionState, type DriveDetectionState } from './drive-detection';
import {
  normalizeAutomaticDrivePreRollPoint, type AutomaticDrivePreRollPoint,
} from './automatic-drive-preroll';
import { readAppCache, writeAppCache } from './storage';

const STATE_KEY = 'automatic-drive-detection-state-v1';
const EVENT_KEY = 'automatic-drive-detection-event-v1';

export type AutomaticDriveState = DriveDetectionState & {
  automaticSessionId: string | null;
  preStartLocations: AutomaticDrivePreRollPoint[];
};

export function emptyAutomaticDriveState(): AutomaticDriveState {
  return { ...emptyDriveDetectionState(), automaticSessionId: null, preStartLocations: [] };
}

export type AutomaticDriveEvent = {
  kind: 'started' | 'finished' | 'start_failed' | 'finish_waiting';
  sessionId: string | null;
  occurredAt: string;
};

export function loadAutomaticDriveState(): AutomaticDriveState {
  const stored = readAppCache<Partial<AutomaticDriveState>>(STATE_KEY);
  const empty = emptyAutomaticDriveState();
  if (!stored) return empty;
  return {
    ...empty,
    candidateStartedAt: Number.isFinite(stored.candidateStartedAt) ? Number(stored.candidateStartedAt) : null,
    candidateLastAt: Number.isFinite(stored.candidateLastAt) ? Number(stored.candidateLastAt) : null,
    candidateSamples: Number.isFinite(stored.candidateSamples) ? Math.max(0, Number(stored.candidateSamples)) : 0,
    stoppedSince: Number.isFinite(stored.stoppedSince) ? Number(stored.stoppedSince) : null,
    lastLatitude: Number.isFinite(stored.lastLatitude) ? Number(stored.lastLatitude) : null,
    lastLongitude: Number.isFinite(stored.lastLongitude) ? Number(stored.lastLongitude) : null,
    lastPositionAt: Number.isFinite(stored.lastPositionAt) ? Number(stored.lastPositionAt) : null,
    lastPositionAccuracyMeters: Number.isFinite(stored.lastPositionAccuracyMeters)
      ? Number(stored.lastPositionAccuracyMeters) : null,
    automaticSessionId: typeof stored.automaticSessionId === 'string' ? stored.automaticSessionId : null,
    preStartLocations: Array.isArray(stored.preStartLocations)
      ? stored.preStartLocations.map(normalizeAutomaticDrivePreRollPoint).filter(point => point !== null)
      : [],
  };
}

export function saveAutomaticDriveState(state: AutomaticDriveState) {
  writeAppCache(STATE_KEY, state);
}

export function resetAutomaticDriveState() {
  saveAutomaticDriveState(emptyAutomaticDriveState());
}

export function saveAutomaticDriveEvent(kind: AutomaticDriveEvent['kind'], sessionId: string | null) {
  writeAppCache(EVENT_KEY, { kind, sessionId, occurredAt: new Date().toISOString() } satisfies AutomaticDriveEvent);
}

export function loadAutomaticDriveEvent() {
  return readAppCache<AutomaticDriveEvent>(EVENT_KEY);
}
