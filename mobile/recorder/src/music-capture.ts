import {
  getAppleMusicRecentSongs,
  getCurrentAppleMusicTrack,
  isJourneyDeckMusicNativeAvailable,
  recognizeMusic,
  type AppleMusicRecentSong,
  type CurrentAppleMusicTrack,
} from '../modules/journeydeck-music';
import { Image } from 'expo-image';
import { loadMusicPreferences } from './music-preferences';
import { appleCurrentTrackObservation, appleRecentSongObservation, shazamMatchObservation, tessieMediaObservation, type MusicObservation } from './music-observations';
import { activeSession, archivedJourneyIdForSession, getSession, queueMusicObservation, readAppCache, recentCompletedSessionIds, refreshCompletedSessionLocalMirror, writeAppCache } from './storage';
import { sampleTessieMedia } from './tessie-direct';
import { getCurrentUser } from './auth';
import { enrichMusicEntriesWithArtwork, listMusicEntries, listMusicEntriesForJourney } from './local-store';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { resolveMissingAppleMusicArtwork } from './apple-artwork-lookup';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';

const APPLE_SAMPLE_INTERVAL_MS = 20_000;
const TESSIE_SAMPLE_INTERVAL_MS = 30_000;
const lastAppleSampleAttempt = new Map<string, number>();
let appleSampleInFlight: Promise<MusicCaptureResult> | null = null;
let tessieSampleInFlight: Promise<MusicCaptureResult> | null = null;
let shazamInFlight: Promise<MusicCaptureResult> | null = null;
let recentAppleSongsCache: { loadedAt: number; songs: AppleMusicRecentSong[] } | null = null;
const FORCED_ARTWORK_REFRESH_KEY = 'apple-music.artwork-refresh.2026-08-30.v3';

export type MusicCaptureResult = {
  status: 'queued' | 'duplicate' | 'no_match' | 'skipped' | 'unavailable';
  observation?: MusicObservation;
};

function sameAppleMusicTrack(sample: CurrentAppleMusicTrack, song: AppleMusicRecentSong) {
  if (sample.appleMusicId && sample.appleMusicId === song.id) return true;
  return sample.title?.trim().toLocaleLowerCase() === song.title.trim().toLocaleLowerCase()
    && sample.artist?.trim().toLocaleLowerCase() === song.artist.trim().toLocaleLowerCase();
}

async function recentAppleSongs(maxAgeMs = 60_000) {
  if (recentAppleSongsCache && Date.now() - recentAppleSongsCache.loadedAt < maxAgeMs) return recentAppleSongsCache.songs;
  const songs = await getAppleMusicRecentSongs(50);
  recentAppleSongsCache = { loadedAt: Date.now(), songs };
  return songs;
}

export async function sampleAppleMusicForActiveSession(options: { force?: boolean } = {}): Promise<MusicCaptureResult> {
  const session = activeSession();
  if (!session || session.status !== 'recording') return { status: 'skipped' };
  const preferences = await loadMusicPreferences();
  if (!preferences.onboardingCompleted || preferences.provider !== 'apple-music') return { status: 'skipped' };
  if (!isJourneyDeckMusicNativeAvailable) return { status: 'unavailable' };

  const now = Date.now();
  if (!options.force && now - (lastAppleSampleAttempt.get(session.id) || 0) < APPLE_SAMPLE_INTERVAL_MS) {
    return { status: 'skipped' };
  }
  if (appleSampleInFlight) return appleSampleInFlight;
  lastAppleSampleAttempt.set(session.id, now);

  appleSampleInFlight = (async () => {
    try {
      const sample = await getCurrentAppleMusicTrack();
      const catalogMatch = sample.available && sample.isPlaying
        ? await recentAppleSongs().then(songs => songs.find(song => sameAppleMusicTrack(sample, song))).catch(() => undefined)
        : undefined;
      const observation = appleCurrentTrackObservation({
        ...sample,
        artworkUrl: catalogMatch?.artworkUrl,
        appleMusicUrl: catalogMatch?.appleMusicUrl,
      }, session.started_at);
      if (!observation) return { status: 'skipped' };
      return { status: queueMusicObservation(session.id, observation) ? 'queued' : 'duplicate', observation };
    } catch {
      // Apple Music metadata is additive; a native or permission failure must
      // never escape into the background location recorder.
      return { status: 'unavailable' };
    }
  })();

  try { return await appleSampleInFlight; }
  finally { appleSampleInFlight = null; }
}

export async function recognizeAndQueueActiveSessionMusic(durationMilliseconds = 10_000, options: { allowAdHoc?: boolean } = {}): Promise<MusicCaptureResult> {
  const session = activeSession();
  if (!session || session.status !== 'recording') throw new Error('Start a journey before identifying music.');
  const preferences = await loadMusicPreferences();
  if ((!preferences.onboardingCompleted || preferences.provider !== 'shazam') && !options.allowAdHoc) {
    throw new Error('Choose Manual Song Recognition in Settings first.');
  }
  if (!isJourneyDeckMusicNativeAvailable) throw new Error('Manual Song Recognition requires the installed JourneyDeck app.');
  if (shazamInFlight) return { status: 'skipped' };

  shazamInFlight = (async () => {
    const result = await recognizeMusic(durationMilliseconds);
    if (result.status === 'no_match') return { status: 'no_match' };
    const observation = shazamMatchObservation(result, session.started_at);
    if (!observation || !getSession(session.id)) return { status: 'no_match' };
    return { status: queueMusicObservation(session.id, observation) ? 'queued' : 'duplicate', observation };
  })();
  try { return await shazamInFlight; }
  finally { shazamInFlight = null; }
}

export async function sampleTessieMediaForActiveSession(options: { force?: boolean } = {}): Promise<MusicCaptureResult> {
  if (!TESSIE_INTEGRATION_ENABLED) return { status: 'unavailable' };
  const session = activeSession();
  if (!session || session.status !== 'recording') return { status: 'skipped' };
  const preferences = await loadMusicPreferences();
  if (!preferences.onboardingCompleted || preferences.provider !== 'apple-music') return { status: 'skipped' };
  const now = Date.now();
  const cacheKey = `tessie-media-sample-attempt-${session.id}`;
  const lastAttempt = readAppCache<number>(cacheKey) ?? 0;
  if (!options.force && now - lastAttempt < TESSIE_SAMPLE_INTERVAL_MS) {
    return { status: 'skipped' };
  }
  if (tessieSampleInFlight) return tessieSampleInFlight;
  writeAppCache(cacheKey, now);

  tessieSampleInFlight = (async () => {
    try {
      const sample = await sampleTessieMedia();
      if (!sample) return { status: 'skipped' };
      const observation = tessieMediaObservation(sample, session.started_at);
      if (!observation) return { status: 'no_match' };
      return { status: queueMusicObservation(session.id, observation) ? 'queued' : 'duplicate', observation };
    } catch {
      // Vehicle media is an optional enhancement. Network, Tessie, or vehicle
      // availability must never escape into the background route recorder.
      return { status: 'unavailable' };
    }
  })();

  try { return await tessieSampleInFlight; }
  finally { tessieSampleInFlight = null; }
}

function captureAppleMusicSongsForSession(sessionId: string, songs: AppleMusicRecentSong[]) {
  const session = getSession(sessionId);
  if (!session?.ended_at) return 0;
  let enriched = 0;
  for (const song of songs) {
    const observation = appleRecentSongObservation(song, session.started_at, session.ended_at);
    if (observation && queueMusicObservation(sessionId, observation)) enriched += 1;
  }
  return enriched;
}

async function cacheJourneyArtworkOnDisk(sessionId: string) {
  const journeyId = archivedJourneyIdForSession(sessionId);
  const urls = [...new Set(listMusicEntriesForJourney(getCurrentUser().id, journeyId)
    .map(entry => entry.artworkUrl)
    .filter((url): url is string => Boolean(url?.startsWith('https://'))))];
  if (!urls.length) return 0;
  await Image.prefetch(urls, 'disk');
  return urls.length;
}

export async function captureAppleMusicHistoryForSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session?.ended_at || !isJourneyDeckMusicNativeAvailable) return 0;
  const preferences = await loadMusicPreferences();
  if (!preferences.onboardingCompleted || preferences.provider !== 'apple-music') return 0;
  let captured = 0;
  try { captured = captureAppleMusicSongsForSession(sessionId, await recentAppleSongs(0)); }
  catch { /* The exact-match public catalog fallback below can still repair existing plays. */ }
  const journeyId = archivedJourneyIdForSession(sessionId);
  const searched = await resolveMissingAppleMusicArtwork(15, { journeyId }).catch(() => ({ enriched: 0 }));
  await cacheJourneyArtworkOnDisk(sessionId).catch(() => 0);
  return captured + searched.enriched;
}

export async function refreshRecentAppleMusicArtwork(limit = 8, options: { replaceExisting?: boolean; reportFailure?: boolean } = {}) {
  if (!isJourneyDeckMusicNativeAvailable) return 0;
  const preferences = await loadMusicPreferences();
  if (!preferences.onboardingCompleted || preferences.provider !== 'apple-music') return 0;
  try {
    const songs = await recentAppleSongs(0);
    let enriched = enrichMusicEntriesWithArtwork(getCurrentUser().id, songs.flatMap(song => song.artworkUrl ? [{
      track: song.title,
      artist: song.artist,
      album: song.album ?? null,
      artworkUrl: song.artworkUrl,
      externalUrl: song.appleMusicUrl ?? null,
    }] : []), { replaceExisting: options.replaceExisting });
    for (const sessionId of recentCompletedSessionIds(limit)) {
      const sessionEnriched = captureAppleMusicSongsForSession(sessionId, songs);
      enriched += sessionEnriched;
      if (sessionEnriched > 0) refreshCompletedSessionLocalMirror(sessionId);
    }
    if (enriched > 0) notifyLocalArchiveChanged();
    return enriched;
  } catch {
    if (options.reportFailure) throw new Error('Apple Music artwork could not refresh yet.');
    return 0;
  }
}

/** Runs once per local profile for this OTA generation, without requiring the Soundtracks tab. */
export async function forceAppleMusicArtworkRefreshAfterUpdate() {
  if (readAppCache<boolean>(FORCED_ARTWORK_REFRESH_KEY)) return 0;
  if (!isJourneyDeckMusicNativeAvailable) return 0;
  const preferences = await loadMusicPreferences();
  if (!preferences.onboardingCompleted || preferences.provider !== 'apple-music') return 0;
  const refreshed = await refreshRecentAppleMusicArtwork(10, { replaceExisting: true });
  const searched = await resolveMissingAppleMusicArtwork();
  if (searched.failed > 0) throw new Error('Some Apple artwork lookups will retry later.');
  writeAppCache(FORCED_ARTWORK_REFRESH_KEY, true);
  return refreshed + searched.enriched;
}

export async function refreshAllAppleMusicArtwork() {
  const refreshed = await refreshRecentAppleMusicArtwork();
  const searched = await resolveMissingAppleMusicArtwork();
  return refreshed + searched.enriched;
}

export type AppleMusicArtworkRefreshReport = {
  missingBefore: number;
  missingAfter: number;
  enriched: number;
  searched: number;
  failed: number;
  historyWarning: string | null;
};

function appleMusicHistoryWarning(error: unknown) {
  const message = error instanceof Error ? error.message.toLocaleLowerCase() : String(error ?? '').toLocaleLowerCase();
  if (/authoriz|permission|denied|restricted/.test(message)) {
    return 'Apple Music history access needs to be reauthorized. The online catalog fallback still ran.';
  }
  if (/network|internet|offline|connection|timed? ?out|urlsession|not connected/.test(message)) {
    return 'Apple Music history was temporarily unreachable because of a network or Apple service response. The online catalog fallback still ran.';
  }
  if (/subscription|account|storefront|cloud library|media services/.test(message)) {
    return 'Apple Music history was unavailable for the current Media & Purchases account. The online catalog fallback still ran.';
  }
  return 'Apple Music history was temporarily unavailable. The online catalog fallback still ran.';
}

/** Explicit Data Health diagnostic; bypasses the normal artwork retry cooldown. */
export async function forceRefreshAllAppleMusicArtworkForDiagnostics(): Promise<AppleMusicArtworkRefreshReport> {
  if (!isJourneyDeckMusicNativeAvailable) throw new Error('Apple Music artwork refresh requires the installed JourneyDeck app.');
  const preferences = await loadMusicPreferences();
  if (!preferences.onboardingCompleted || preferences.provider !== 'apple-music') {
    throw new Error('Choose and connect Apple Music before running the artwork test.');
  }
  const userId = getCurrentUser().id;
  const missing = () => listMusicEntries(userId, 500).filter(entry => entry.source === 'apple_music' && !entry.artworkUrl).length;
  const missingBefore = missing();
  let catalogEnriched = 0;
  let historyWarning: string | null = null;
  let songs: AppleMusicRecentSong[] | null = null;
  try {
    songs = await recentAppleSongs(0);
  } catch (error) {
    historyWarning = appleMusicHistoryWarning(error);
  }
  if (songs) {
    catalogEnriched = enrichMusicEntriesWithArtwork(userId, songs.flatMap(song => song.artworkUrl ? [{
      track: song.title,
      artist: song.artist,
      album: song.album ?? null,
      artworkUrl: song.artworkUrl,
      externalUrl: song.appleMusicUrl ?? null,
    }] : []), { replaceExisting: true });
    if (catalogEnriched > 0) notifyLocalArchiveChanged();
  }
  const searched = await resolveMissingAppleMusicArtwork(15, { force: true });
  const missingAfter = missing();
  return {
    missingBefore,
    missingAfter,
    enriched: catalogEnriched + searched.enriched,
    searched: searched.attempted,
    failed: searched.failed,
    historyWarning,
  };
}
