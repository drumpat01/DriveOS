import { appDataClient } from './app-data';
import { loadLastFmUsername, loadMusicPreferences } from './music-preferences';
import {
  markLastFmSyncResult, pendingLastFmSyncs, queueLastFmSync, queueRecentCompletedLastFmSyncs,
} from './storage';

let automaticSyncInFlight: Promise<LastFmSyncSummary> | null = null;

export type LastFmSyncSummary = {
  attempted: number;
  succeeded: number;
  matchedTracks: number;
};

async function runPendingLastFmSync(force: boolean): Promise<LastFmSyncSummary> {
  const username = await loadLastFmUsername();
  if (!username) return { attempted: 0, succeeded: 0, matchedTracks: 0 };
  const rows = pendingLastFmSyncs({ force, limit: 5 });
  let succeeded = 0, matchedTracks = 0;
  for (const row of rows) {
    try {
      const result = await appDataClient.syncLastFm(row.sessionId, row.username || username);
      markLastFmSyncResult(row.sessionId, true);
      succeeded += 1;
      matchedTracks += result.synced;
    } catch {
      markLastFmSyncResult(row.sessionId, false);
    }
  }
  return { attempted: rows.length, succeeded, matchedTracks };
}

export function syncPendingLastFmBestEffort() {
  if (automaticSyncInFlight) return automaticSyncInFlight;
  const pending = runPendingLastFmSync(false).finally(() => {
    if (automaticSyncInFlight === pending) automaticSyncInFlight = null;
  });
  automaticSyncInFlight = pending;
  return pending;
}

export async function queueLastFmForCompletedSession(sessionId: string) {
  const [preferences, username] = await Promise.all([loadMusicPreferences(), loadLastFmUsername()]);
  if (preferences.provider !== 'lastfm' || !preferences.onboardingCompleted || !username) return false;
  if (!queueLastFmSync(sessionId, username)) return false;
  void syncPendingLastFmBestEffort();
  return true;
}

export async function syncRecentLastFmNow() {
  const username = await loadLastFmUsername();
  if (!username) throw new Error('Add your Last.fm username first.');
  if (automaticSyncInFlight) await automaticSyncInFlight;
  queueRecentCompletedLastFmSyncs(username, 5);
  return runPendingLastFmSync(true);
}
