export type PlaybackIdentity = {
  source: string;
  playedAt: string;
  track: string;
  artist: string;
  durationMs?: number | null;
};

const MINIMUM_WINDOW_MS = 90_000;
const UNKNOWN_DURATION_WINDOW_MS = 6 * 60_000;
const PLAYBACK_TIMESTAMP_GRACE_MS = 90_000;
const MAXIMUM_WINDOW_MS = 15 * 60_000;

function normalized(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function duration(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(MAXIMUM_WINDOW_MS, Math.round(value))
    : null;
}

export function sameTrackIdentity(left: PlaybackIdentity, right: PlaybackIdentity) {
  return left.source === right.source
    && normalized(left.track) === normalized(right.track)
    && normalized(left.artist) === normalized(right.artist);
}

export function playbackDuplicateWindowMs(left: PlaybackIdentity, right: PlaybackIdentity) {
  const knownDuration = Math.max(duration(left.durationMs) ?? 0, duration(right.durationMs) ?? 0);
  return Math.min(MAXIMUM_WINDOW_MS, knownDuration > 0
    ? Math.max(MINIMUM_WINDOW_MS, knownDuration + PLAYBACK_TIMESTAMP_GRACE_MS)
    : UNKNOWN_DURATION_WINDOW_MS);
}

/**
 * Finds an already-saved row representing the same continuous playback.
 *
 * Apple can report the live position as zero, making every poll look newly
 * started, while recent-history timestamps may describe the end of that same
 * song. Duration-aware matching joins those timestamps. A different song
 * between two identical titles proves that the later title is a real replay.
 */
export function findDuplicatePlayback<T extends PlaybackIdentity>(candidate: PlaybackIdentity, existing: readonly T[]): T | null {
  const candidateTime = timestamp(candidate.playedAt);
  if (candidateTime === null) return null;
  const byDistance = existing
    .filter(row => sameTrackIdentity(candidate, row) && timestamp(row.playedAt) !== null)
    .sort((left, right) => Math.abs(timestamp(left.playedAt)! - candidateTime) - Math.abs(timestamp(right.playedAt)! - candidateTime));

  for (const matching of byDistance) {
    const matchingTime = timestamp(matching.playedAt)!;
    if (Math.abs(matchingTime - candidateTime) > playbackDuplicateWindowMs(candidate, matching)) continue;
    const lower = Math.min(matchingTime, candidateTime), upper = Math.max(matchingTime, candidateTime);
    const differentTrackBetween = existing.some(row => {
      const rowTime = timestamp(row.playedAt);
      return rowTime !== null && rowTime > lower && rowTime < upper && !sameTrackIdentity(candidate, row);
    });
    if (!differentTrackBetween) return matching;
  }
  return null;
}

export function partitionDuplicatePlaybacks<T extends PlaybackIdentity>(rows: readonly T[]) {
  const kept: T[] = [];
  const duplicates: Array<{ keep: T; remove: T }> = [];
  [...rows].sort((left, right) => (timestamp(left.playedAt) ?? 0) - (timestamp(right.playedAt) ?? 0)).forEach(row => {
    const duplicate = findDuplicatePlayback(row, kept);
    if (duplicate) duplicates.push({ keep: duplicate, remove: row });
    else kept.push(row);
  });
  return { kept, duplicates };
}
