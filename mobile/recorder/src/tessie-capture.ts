import Constants from 'expo-constants';
import { getAppleMusicRecentSongs, isJourneyDeckMusicNativeAvailable } from '../modules/journeydeck-music';
import { getCurrentUser } from './auth';
import { rebuildAtlasSnapshot } from './local-atlas';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { findTessieJourneyForDrive, getMusicEntry, markTessieRouteAttempt, persistTessieJourney, refreshJourneySongCount, tessieJourneyNeedsRoute, tessieRouteAttemptedAt, upsertMusicEntry } from './local-store';
import { appleRecentSongObservation } from './music-observations';
import { isMusicProviderAvailable, loadLastFmUsername, loadMusicPreferences } from './music-preferences';
import { requestPrivacyEdgeJson } from './network-request';
import type { TessieDriveRoute, TessieDriveSnapshot, TessieSnapshot } from './tessie-contract';
import { planTessieJourneys, tessieJourneyId } from './tessie-journey-plan';
import { readAppCache, writeAppCache } from './storage';

const MAX_ROUTE_FETCHES_PER_SYNC = 4;
const MAX_MUSIC_JOURNEYS_PER_SYNC = 8;
const MUSIC_ATTEMPTS_KEY = 'tessie.music-attempts.v1';

/** A historical play belongs to exactly one half-open UTC drive interval. */
function playedDuringDrive(value: string | null | undefined, drive: TessieDriveSnapshot) {
  if (!value || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return false;
  const played = Date.parse(value);
  return Number.isFinite(played) && played >= Date.parse(drive.startedAt) && played < Date.parse(drive.endedAt);
}

function stableId(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(36);
}

async function captureSongs(userId: string, drives: TessieDriveSnapshot[], current: () => boolean) {
  if (!drives.length) return 0;
  const preferences = await loadMusicPreferences();
  if (!current() || !preferences.onboardingCompleted) return 0;
  let imported = 0;
  if (preferences.provider === 'apple-music' && isJourneyDeckMusicNativeAvailable) {
    const songs = await getAppleMusicRecentSongs(50);
    if (!current() || (await loadMusicPreferences()).provider !== preferences.provider || !current()) return imported;
    for (const drive of drives) {
      if (!current()) return imported;
      const journey = findTessieJourneyForDrive(userId, drive);
      if (journey?.provider !== 'tessie') continue;
      const journeyId = journey.id;
      for (const song of songs) {
        if (!playedDuringDrive(song.lastPlayedAt, drive)) continue;
        const observation = appleRecentSongObservation(song, drive.startedAt, drive.endedAt);
        if (!observation) continue;
        const id = `${journeyId}_${observation.observationId}`;
        if (!getMusicEntry(userId, id)) { upsertMusicEntry({ ...observation, id, userId, journeyId }); imported++; }
      }
      refreshJourneySongCount(userId, journeyId);
    }
  } else if (preferences.provider === 'lastfm' && isMusicProviderAvailable('lastfm')) {
    const username = await loadLastFmUsername();
    if (!current()) return imported;
    const edge = Constants.expoConfig?.extra?.edge as { url?: unknown } | undefined;
    if (!username || typeof edge?.url !== 'string' || !/^https:\/\//.test(edge.url)) return 0;
    const previousAttempts = readAppCache<Record<string, number>>(MUSIC_ATTEMPTS_KEY) ?? {};
    // Rotate a bounded batch so older drives and late scrobbles are not starved
    // by repeatedly refreshing only the newest eight journeys.
    const attempts = Object.fromEntries(drives.map(drive => [drive.id, Number(previousAttempts[drive.id]) || 0]));
    const selected = drives.filter(drive => findTessieJourneyForDrive(userId, drive)?.provider === 'tessie')
      .sort((a, b) => attempts[a.id] - attempts[b.id]).slice(0, MAX_MUSIC_JOURNEYS_PER_SYNC);
    for (const drive of selected) {
      if (!current()) return imported;
      const journey = findTessieJourneyForDrive(userId, drive);
      if (journey?.provider !== 'tessie') continue;
      const journeyId = journey.id;
      try {
        const result = await requestPrivacyEdgeJson<{ tracks: { playedAt: string; track: string; artist: string; album: string | null; artworkUrl?: string | null; externalUrl: string | null }[] }>(
          edge.url.replace(/\/$/, ''), '/api/music/lastfm/recent',
          { username, from: drive.startedAt, to: drive.endedAt },
          { reason: 'external_import', operation: 'Last.fm journey history', timeoutMs: 15_000 },
        );
        if (!current() || (await loadMusicPreferences()).provider !== preferences.provider || !current()) return imported;
        for (const track of result.tracks ?? []) {
          const played = Date.parse(track.playedAt);
          if (!playedDuringDrive(track.playedAt, drive)
            || !track.track?.trim() || !track.artist?.trim()) continue;
          const identity = `${track.track.toLowerCase()}\0${track.artist.toLowerCase()}\0${played}`;
          const id = `${journeyId}_lastfm_${stableId(identity)}`;
          const existing = getMusicEntry(userId, id);
          if (existing?.artworkUrl || (existing && !track.artworkUrl)) continue;
          upsertMusicEntry({ id, userId, journeyId, source: 'lastfm',
            playedAt: new Date(played).toISOString(), track: track.track, artist: track.artist, album: track.album ?? null,
            durationMs: null, artworkUrl: track.artworkUrl ?? null, externalUrl: track.externalUrl ?? null, confidence: null });
          if (!existing) imported++;
        }
        refreshJourneySongCount(userId, journeyId);
      } catch { /* Music history is optional; retry on the next refresh. */ }
      finally {
        if (current()) { attempts[drive.id] = Date.now(); writeAppCache(MUSIC_ATTEMPTS_KEY, attempts); }
      }
    }
  }
  return imported;
}

export async function captureTessieJourneys(
  snapshot: TessieSnapshot,
  loadRoute: (drive: TessieDriveSnapshot) => Promise<TessieDriveRoute>,
  connectionIsCurrent: () => boolean = () => true,
): Promise<{ created: number; routes: number; overlaps: number }> {
  const userId = getCurrentUser().id;
  const current = () => getCurrentUser().id === userId && connectionIsCurrent();
  if (!current()) return { created: 0, routes: 0, overlaps: 0 };
  const plans = planTessieJourneys(snapshot);
  let created = 0, routes = 0, overlaps = 0, updated = 0;
  for (const plan of plans) {
    if (!current()) return { created, routes, overlaps };
    const outcome = persistTessieJourney(userId, plan, null);
    if (outcome === 'created') created++;
    if (outcome === 'updated') updated++;
    if (outcome === 'overlap') overlaps++;
  }
  const newestFirst = [...plans].sort((a, b) => b.drive.endedAt.localeCompare(a.drive.endedAt) || a.drive.id.localeCompare(b.drive.id));
  const journeyIdFor = (drive: TessieDriveSnapshot) => findTessieJourneyForDrive(userId, drive)?.id ?? tessieJourneyId(userId, drive.id);
  for (const plan of newestFirst.filter(plan => findTessieJourneyForDrive(userId, plan.drive)?.provider === 'tessie'
    && tessieJourneyNeedsRoute(userId, plan.drive.id, journeyIdFor(plan.drive)))
    .sort((a, b) => tessieRouteAttemptedAt(userId, a.drive.id, journeyIdFor(a.drive)) - tessieRouteAttemptedAt(userId, b.drive.id, journeyIdFor(b.drive)))
    .slice(0, MAX_ROUTE_FETCHES_PER_SYNC)) {
    if (!current()) break;
    try {
      const route = await loadRoute(plan.drive);
      if (!current()) break;
      if (route.routePoints.length && persistTessieJourney(userId, plan, route) === 'updated') routes++;
    } catch { /* Preserve the summary and retry this route on a later sync. */ }
    finally { if (current()) markTessieRouteAttempt(userId, plan.drive.id, journeyIdFor(plan.drive)); }
  }
  const songs = current() ? await captureSongs(userId, newestFirst.map(plan => plan.drive), current).catch(() => 0) : 0;
  if (current() && (created || routes || songs || updated)) {
    rebuildAtlasSnapshot(userId);
    notifyLocalArchiveChanged();
  }
  return { created, routes, overlaps };
}
