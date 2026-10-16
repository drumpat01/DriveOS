/** First completed drives stay fully free. The trip-summary paywall starts on the next one. */
export const FREE_COMPLETED_DRIVES = 3;
const MAX_SESSION_IDS = 48;

export type CompletedDriveRecord = {
  count: number;
  sessionIds: string[];
};

export function emptyCompletedDriveRecord(count = 0): CompletedDriveRecord {
  return { count: normalizeCount(count), sessionIds: [] };
}

export function parseCompletedDriveRecord(value: unknown): CompletedDriveRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { count?: unknown; sessionIds?: unknown };
  if (typeof record.count !== 'number' || !Number.isInteger(record.count) || record.count < 0) return null;
  const sessionIds = Array.isArray(record.sessionIds)
    ? record.sessionIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 80).slice(-MAX_SESSION_IDS)
    : [];
  return { count: record.count, sessionIds };
}

/**
 * First write, before a stored counter exists. A journey already mirrored into
 * the library is inside `libraryCount`; a completion that has not been mirrored
 * yet still counts once.
 */
export function initialCompletedDriveCount(libraryCount: number, sessionMirrored: boolean): number {
  const library = normalizeCount(libraryCount);
  return sessionMirrored ? library : library + 1;
}

/**
 * A session already inside the seeded library must not advance the count again.
 * A new completion, including one not mirrored into the library yet, does.
 */
export function applyRecordedDrive(
  record: CompletedDriveRecord,
  sessionId: string,
  context: { mirrored?: boolean; libraryCount?: number } = {},
): { record: CompletedDriveRecord; counted: boolean } {
  if (!sessionId || record.sessionIds.includes(sessionId)) return { record, counted: false };
  const libraryCount = context.libraryCount;
  const alreadySeeded = context.mirrored === true
    && typeof libraryCount === 'number'
    && Number.isInteger(libraryCount)
    && libraryCount >= 0
    && record.count >= libraryCount;
  const sessionIds = [...record.sessionIds, sessionId].slice(-MAX_SESSION_IDS);
  if (alreadySeeded) return { counted: false, record: { count: record.count, sessionIds } };
  return { counted: true, record: { count: record.count + 1, sessionIds } };
}

const COUNTED_FINISH_KINDS = new Set(['finished', 'manual_finished', 'manual_auto_finished']);

/**
 * Session id for a drive that actually finished. Cancelled, failed, and
 * not-yet-saved starts do not count. The finish event keeps the id because
 * the active native session is cleared before the next status poll.
 */
export function sessionIdForFinishedDrive(input: {
  kind?: string | null;
  eventSessionId?: string | null;
  activeSessionId?: string | null;
}): string | null {
  if (!input.kind || !COUNTED_FINISH_KINDS.has(input.kind)) return null;
  const sessionId = (input.eventSessionId || input.activeSessionId || '').trim();
  return sessionId.length > 0 ? sessionId : null;
}

/** Drives 1–3, while fewer than three completions are stored. */
export function drivesAreFullyFree(completedCount: number): boolean {
  return Number.isInteger(completedCount) && completedCount >= 0 && completedCount < FREE_COMPLETED_DRIVES;
}

/** Trip summary after the 4th completed drive onward, for someone who is not subscribed. */
export function shouldShowTripSummaryPaywall(completedCount: number, subscribed: boolean): boolean {
  return !subscribed && Number.isInteger(completedCount) && completedCount > FREE_COMPLETED_DRIVES;
}

function normalizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
}
