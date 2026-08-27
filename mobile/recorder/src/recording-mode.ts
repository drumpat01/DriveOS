import { readAppCache, writeAppCache } from './storage';
import { getCurrentUser } from './auth';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';

const RECORDING_MODE_KEY = 'recording-mode-preferences-v1';

export type RecordingMode = 'automatic' | 'manual';
export type RecordingModePreferences = {
  mode: RecordingMode | null;
  onboardingCompleted: boolean;
};

const emptyPreferences: RecordingModePreferences = { mode: null, onboardingCompleted: false };
const listeners = new Set<(preferences: RecordingModePreferences) => void>();

function isRecordingMode(value: unknown): value is RecordingMode {
  return value === 'automatic' || value === 'manual';
}

export function loadRecordingModePreferences(): RecordingModePreferences {
  const stored = getPrivatePreference<Partial<RecordingModePreferences>>(getCurrentUser().id, 'recording.mode') ?? readAppCache<Partial<RecordingModePreferences>>(RECORDING_MODE_KEY);
  if (!stored || !isRecordingMode(stored.mode)) return emptyPreferences;
  return { mode: stored.mode, onboardingCompleted: stored.onboardingCompleted === true };
}

export function saveRecordingModePreferences(preferences: RecordingModePreferences) {
  const next = {
    mode: isRecordingMode(preferences.mode) ? preferences.mode : null,
    onboardingCompleted: preferences.onboardingCompleted === true && isRecordingMode(preferences.mode),
  } satisfies RecordingModePreferences;
  writeAppCache(RECORDING_MODE_KEY, next);
  upsertPrivatePreference(getCurrentUser().id, 'recording.mode', next);
  listeners.forEach(listener => listener(next));
  return next;
}

export function subscribeRecordingMode(listener: (preferences: RecordingModePreferences) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
