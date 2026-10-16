import { useEffect, useState } from 'react';

import { getCurrentUser } from './auth';
import {
  applyRecordedDrive,
  drivesAreFullyFree,
  initialCompletedDriveCount,
  parseCompletedDriveRecord,
  FREE_COMPLETED_DRIVES,
  type CompletedDriveRecord,
} from './completed-drive-count';
import { countJourneys, getJourney, getPrivatePreference, upsertPrivatePreference } from './local-store';
import { archivedJourneyIdForSession } from './storage';

const KEY = 'membership.completed-drives.v1';
const listeners = new Set<(count: number) => void>();

function notify(count: number) {
  for (const listener of listeners) listener(count);
}

function sessionMirrored(userId: string, sessionId: string): boolean {
  return getJourney(userId, archivedJourneyIdForSession(sessionId)) != null;
}

function write(userId: string, record: CompletedDriveRecord) {
  upsertPrivatePreference(userId, KEY, record);
}

/** Stored completed-drive count. The first read seeds it from journeys already on this iPhone. */
export function readCompletedDriveCount(userId: string): number {
  const stored = parseCompletedDriveRecord(getPrivatePreference(userId, KEY));
  if (stored) return stored.count;
  const seeded = { count: countJourneys(userId), sessionIds: [] } satisfies CompletedDriveRecord;
  write(userId, seeded);
  return seeded.count;
}

/**
 * Records one finished drive. Repeating the same session id does not advance
 * the count. `counted` is false when this call only seeds history that was
 * already on the iPhone, so a relaunch does not raise the trip-summary paywall.
 */
export function commitCompletedDrive(userId: string, sessionId: string): { count: number; counted: boolean } {
  if (!sessionId) return { count: readCompletedDriveCount(userId), counted: false };
  const stored = parseCompletedDriveRecord(getPrivatePreference(userId, KEY));
  const mirrored = sessionMirrored(userId, sessionId);
  const libraryCount = countJourneys(userId);
  if (!stored) {
    const record = {
      count: initialCompletedDriveCount(libraryCount, mirrored),
      sessionIds: [sessionId],
    } satisfies CompletedDriveRecord;
    write(userId, record);
    notify(record.count);
    return { count: record.count, counted: !mirrored };
  }
  const next = applyRecordedDrive(stored, sessionId, { mirrored, libraryCount });
  if (next.record !== stored) {
    write(userId, next.record);
    if (next.counted) notify(next.record.count);
  }
  return { count: next.record.count, counted: next.counted };
}

export function subscribeCompletedDriveCount(listener: (count: number) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Fail closed: until the stored count loads, the free-drive window stays shut. */
export function useCompletedDriveCount(): number {
  const [count, setCount] = useState(FREE_COMPLETED_DRIVES);
  useEffect(() => {
    try { setCount(readCompletedDriveCount(getCurrentUser().id)); } catch { /* stay fail-closed */ }
    return subscribeCompletedDriveCount(setCount);
  }, []);
  return count;
}

export function freeDriveWindowOpen(completedCount: number, subscribed: boolean): boolean {
  return !subscribed && drivesAreFullyFree(completedCount);
}
