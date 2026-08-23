import {
  getAppleMusicRecentSongs,
  getCurrentAppleMusicTrack,
  isJourneyDeckMusicNativeAvailable,
  recognizeMusic,
} from '../modules/journeydeck-music';
import { loadMusicPreferences } from './music-preferences';
import { appleCurrentTrackObservation, appleRecentSongObservation, shazamMatchObservation, type MusicObservation } from './music-observations';
import { activeSession, getSession, queueMusicObservation } from './storage';

const APPLE_SAMPLE_INTERVAL_MS = 20_000;
const lastAppleSampleAttempt = new Map<string, number>();
let appleSampleInFlight: Promise<MusicCaptureResult> | null = null;

export type MusicCaptureResult = {
  status: 'queued' | 'duplicate' | 'no_match' | 'skipped' | 'unavailable';
  observation?: MusicObservation;
};

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
      const observation = appleCurrentTrackObservation(sample, session.started_at);
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
    throw new Error('Choose automatic recognition in Music Connections first.');
  }
  if (!isJourneyDeckMusicNativeAvailable) throw new Error('Automatic recognition requires a new native JourneyDeck build.');

  const result = await recognizeMusic(durationMilliseconds);
  if (result.status === 'no_match') return { status: 'no_match' };
  const observation = shazamMatchObservation(result, session.started_at);
  if (!observation || !getSession(session.id)) return { status: 'no_match' };
  return { status: queueMusicObservation(session.id, observation) ? 'queued' : 'duplicate', observation };
}

export async function captureAppleMusicHistoryForSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session?.ended_at || !isJourneyDeckMusicNativeAvailable) return 0;
  const preferences = await loadMusicPreferences();
  if (!preferences.onboardingCompleted || preferences.provider !== 'apple-music') return 0;
  try {
    const songs = await getAppleMusicRecentSongs(50);
    let queued = 0;
    for (const song of songs) {
      const observation = appleRecentSongObservation(song, session.started_at, session.ended_at);
      if (observation && queueMusicObservation(sessionId, observation)) queued += 1;
    }
    return queued;
  } catch {
    return 0;
  }
}
