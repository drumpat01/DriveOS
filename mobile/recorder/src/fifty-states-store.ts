import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser } from './auth';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';
import { normalizeFiftyStatesProgress, updateFiftyStatesProgress, toggleSeenState, type FiftyStatesProgress, type USStateCode } from './fifty-states-model';

const PREFERENCE_KEY = 'game.fifty-states.v1';
type StoredChecklist = { seen: USStateCode[]; updatedAt: string; completedAt?: string | null };
const EMPTY_PROGRESS: FiftyStatesProgress = { seen: [], completedAt: null };
type Listener = { userId: string; notify: () => void };
const listeners = new Set<Listener>();

export function loadFiftyStates(userId: string): USStateCode[] {
  return loadFiftyStatesProgress(userId).seen;
}

export function loadFiftyStatesProgress(userId: string): FiftyStatesProgress {
  return normalizeFiftyStatesProgress(getPrivatePreference<StoredChecklist>(userId, PREFERENCE_KEY));
}

export function saveFiftyStates(userId: string, seen: readonly USStateCode[]): USStateCode[] {
  const next = updateFiftyStatesProgress(getPrivatePreference<StoredChecklist>(userId, PREFERENCE_KEY), seen, new Date().toISOString());
  upsertPrivatePreference(userId, PREFERENCE_KEY, next satisfies StoredChecklist);
  for (const listener of listeners) if (listener.userId === userId) listener.notify();
  return next.seen;
}

export function useFiftyStates(userId = getCurrentUser().id, enabled = true) {
  const read = () => enabled ? loadFiftyStatesProgress(userId) : EMPTY_PROGRESS;
  const [snapshot, setSnapshot] = useState(() => ({ userId, enabled, progress: read() }));
  useEffect(() => {
    if (!enabled) return;
    const listener = { userId, notify: () => setSnapshot({ userId, enabled, progress: loadFiftyStatesProgress(userId) }) };
    listeners.add(listener);
    listener.notify();
    return () => { listeners.delete(listener); };
  }, [userId, enabled]);
  const toggle = useCallback((code: USStateCode) => saveFiftyStates(userId, toggleSeenState(loadFiftyStates(userId), code)), [userId]);
  const reset = useCallback(() => saveFiftyStates(userId, []), [userId]);
  const progress = snapshot.userId === userId && snapshot.enabled === enabled ? snapshot.progress : read();
  return { ...progress, toggle, reset };
}
