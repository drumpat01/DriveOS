import { getCurrentUser } from './auth';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';
import type { RecordingMode } from './recording-mode';

const FIRST_RUN_KEY = 'onboarding.first-run-v2';

export type FirstRunStage = 'welcome' | 'recording' | 'music' | 'instructions' | 'complete';

export type FirstRunProgress = {
  stage: FirstRunStage;
  recordingMode: RecordingMode | null;
};

function isStage(value: unknown): value is FirstRunStage {
  return value === 'welcome'
    || value === 'recording'
    || value === 'music'
    || value === 'instructions'
    || value === 'complete';
}

function isRecordingMode(value: unknown): value is RecordingMode {
  return value === 'automatic' || value === 'manual';
}

export function loadFirstRunProgress(): FirstRunProgress | null {
  const stored = getPrivatePreference<{ stage?: unknown; recordingMode?: unknown }>(getCurrentUser().id, FIRST_RUN_KEY);
  if (!stored || !isStage(stored.stage)) return null;
  return {
    stage: stored.stage,
    recordingMode: isRecordingMode(stored.recordingMode) ? stored.recordingMode : null,
  };
}

export function saveFirstRunProgress(progress: FirstRunProgress): FirstRunProgress {
  const normalized = {
    stage: isStage(progress.stage) ? progress.stage : 'welcome',
    recordingMode: isRecordingMode(progress.recordingMode) ? progress.recordingMode : null,
  } satisfies FirstRunProgress;
  upsertPrivatePreference(getCurrentUser().id, FIRST_RUN_KEY, normalized);
  return normalized;
}

export function completeFirstRun(recordingMode: RecordingMode): FirstRunProgress {
  return saveFirstRunProgress({ stage: 'complete', recordingMode });
}
