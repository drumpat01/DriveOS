import Constants from 'expo-constants';
import { isMusicProviderAvailable, loadLastFmUsername, loadMusicPreferences, markLastFmConnected } from './music-preferences';
import {
  getSession, markLastFmSyncResult, pendingLastFmSyncs, queueLastFmSync, queueRecentCompletedLastFmSyncs, saveImportedMusicForCompletedSession,
} from './storage';
import { requestPrivacyEdgeJson } from './network-request';

let automaticSyncInFlight: Promise<LastFmSyncSummary> | null = null;

export type LastFmSyncSummary = {
  attempted: number;
  succeeded: number;
  matchedTracks: number;
};

type LastFmHistoryResponse = { tracks: { playedAt: string; track: string; artist: string; album: string | null; externalUrl: string | null }[]; attribution: string };

function privacyEdgeUrl() {
  const edge = Constants.expoConfig?.extra?.edge as { url?: unknown } | undefined;
  return typeof edge?.url === 'string' && /^https:\/\//.test(edge.url) ? edge.url.replace(/\/$/, '') : null;
}

export function isLastFmEdgeConfigured() { return Boolean(privacyEdgeUrl()); }

async function runPendingLastFmSync(force: boolean): Promise<LastFmSyncSummary> {
  if (!isMusicProviderAvailable('lastfm')) return { attempted: 0, succeeded: 0, matchedTracks: 0 };
  const username = await loadLastFmUsername();
  if (!username) return { attempted: 0, succeeded: 0, matchedTracks: 0 };
  const rows = pendingLastFmSyncs({ force, limit: 5 });
  let succeeded = 0, matchedTracks = 0;
  for (const row of rows) {
    try {
      const edgeUrl = privacyEdgeUrl(), session = getSession(row.sessionId);
      if (!edgeUrl) throw new Error('JourneyDeck privacy edge is not configured.');
      if (!session?.ended_at) throw new Error('That journey has not finished.');
      const result = await requestPrivacyEdgeJson<LastFmHistoryResponse>(edgeUrl, '/api/music/lastfm/recent', {
        username: row.username || username, from: session.started_at, to: session.ended_at,
      }, { reason: 'external_import', operation: 'Spotify history import', timeoutMs: 15_000, timeoutMessage: 'Last.fm took too long to respond.' });
      const imported = saveImportedMusicForCompletedSession(row.sessionId, 'lastfm', result.tracks);
      await markLastFmConnected(row.username || username);
      markLastFmSyncResult(row.sessionId, true);
      succeeded += 1;
      matchedTracks += imported;
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
  if (preferences.provider === 'spotify-direct' && preferences.onboardingCompleted && isMusicProviderAvailable('spotify-direct')) {
    void import('./spotify-direct').then(module => module.syncSpotifyDirectSessionBestEffort(sessionId)).catch(() => undefined);
    return true;
  }
  if (preferences.provider !== 'lastfm' || !preferences.onboardingCompleted || !username || !isMusicProviderAvailable('lastfm')) return false;
  if (!queueLastFmSync(sessionId, username)) return false;
  void syncPendingLastFmBestEffort();
  return true;
}

export async function syncRecentLastFmNow() {
  if (!isMusicProviderAvailable('lastfm')) throw new Error('Spotify history is available only in JourneyDeck internal preview builds.');
  const username = await loadLastFmUsername();
  if (!username) throw new Error('Add your Last.fm username first.');
  if (automaticSyncInFlight) await automaticSyncInFlight;
  queueRecentCompletedLastFmSyncs(username, 5);
  return runPendingLastFmSync(true);
}
