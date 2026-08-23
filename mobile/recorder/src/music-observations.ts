export const musicObservationSources = ['apple_music', 'shazam', 'lastfm'] as const;
export type MusicObservationSource = typeof musicObservationSources[number];

export type MusicObservation = {
  observationId: string;
  source: MusicObservationSource;
  playedAt: string;
  track: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  artworkUrl: string | null;
  externalUrl: string | null;
  confidence: number | null;
};

export type AppleCurrentTrackSample = {
  available: boolean;
  sampledAt: string;
  estimatedStartedAt?: string;
  isPlaying: boolean;
  persistentId?: string;
  appleMusicId?: string;
  title?: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
};

export type AppleRecentSongSample = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  lastPlayedAt?: string;
  artworkUrl?: string;
  appleMusicUrl?: string;
};

export type ShazamMatch =
  | { status: 'no_match'; recognizedAt: string }
  | {
      status: 'matched';
      recognizedAt: string;
      title?: string;
      artist?: string;
      isrc?: string;
      shazamId?: string;
      appleMusicId?: string;
      artworkUrl?: string;
      appleMusicUrl?: string;
      shazamUrl?: string;
    };

const MAX_TEXT_LENGTH = 200;
const PLAYBACK_ID_BUCKET_MS = 30_000;

function cleanText(value: unknown, maximum = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function cleanHttpsUrl(value: unknown) {
  const text = cleanText(value, 2_048);
  if (!text) return null;
  try { return new URL(text).protocol === 'https:' ? text : null; }
  catch { return null; }
}

function finiteTimestamp(value: unknown) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableHash(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

function observationId(source: MusicObservationSource, identity: string, playedAtMs: number) {
  const bucket = Math.round(playedAtMs / PLAYBACK_ID_BUCKET_MS);
  return `music.${source}.${stableHash(`${identity.toLowerCase()}\0${bucket}`)}`;
}

function boundedDurationMilliseconds(seconds: unknown) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(3_600_000, Math.round(seconds * 1_000));
}

function sessionBoundedPlaybackTime(candidate: unknown, sampledAt: unknown, sessionStartedAt: string) {
  const sessionStart = finiteTimestamp(sessionStartedAt);
  const sampleTime = finiteTimestamp(sampledAt);
  if (sessionStart === null || sampleTime === null) return null;
  const candidateTime = finiteTimestamp(candidate);
  return Math.max(sessionStart, Math.min(candidateTime ?? sampleTime, sampleTime));
}

export function normalizeMusicObservation(value: MusicObservation): MusicObservation | null {
  if (!musicObservationSources.includes(value.source)) return null;
  const playedAt = finiteTimestamp(value.playedAt);
  const track = cleanText(value.track);
  const artist = cleanText(value.artist);
  if (playedAt === null || !track || !artist) return null;
  const suppliedId = cleanText(value.observationId, 120);
  const safeId = /^[A-Za-z0-9._:-]+$/.test(suppliedId)
    ? suppliedId
    : observationId(value.source, `${track}\0${artist}`, playedAt);
  const durationMs = typeof value.durationMs === 'number' && Number.isFinite(value.durationMs) && value.durationMs >= 0
    ? Math.min(3_600_000, Math.round(value.durationMs))
    : null;
  const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
    ? value.confidence
    : null;
  return {
    observationId: safeId,
    source: value.source,
    playedAt: new Date(playedAt).toISOString(),
    track,
    artist,
    album: cleanText(value.album) || null,
    durationMs,
    artworkUrl: cleanHttpsUrl(value.artworkUrl),
    externalUrl: cleanHttpsUrl(value.externalUrl),
    confidence,
  };
}

export function appleCurrentTrackObservation(sample: AppleCurrentTrackSample, sessionStartedAt: string): MusicObservation | null {
  if (!sample.available || !sample.isPlaying) return null;
  const track = cleanText(sample.title);
  const artist = cleanText(sample.artist);
  const playedAtMs = sessionBoundedPlaybackTime(sample.estimatedStartedAt, sample.sampledAt, sessionStartedAt);
  if (!track || !artist || playedAtMs === null) return null;
  const stableTrackId = cleanText(sample.appleMusicId, 100)
    || cleanText(sample.persistentId, 100)
    || `${track}\0${artist}`;
  return normalizeMusicObservation({
    observationId: observationId('apple_music', stableTrackId, playedAtMs),
    source: 'apple_music',
    playedAt: new Date(playedAtMs).toISOString(),
    track,
    artist,
    album: cleanText(sample.album) || null,
    durationMs: boundedDurationMilliseconds(sample.durationSeconds),
    artworkUrl: null,
    externalUrl: null,
    confidence: null,
  });
}

export function appleRecentSongObservation(sample: AppleRecentSongSample, sessionStartedAt: string, sessionEndedAt: string): MusicObservation | null {
  const start = finiteTimestamp(sessionStartedAt), end = finiteTimestamp(sessionEndedAt), playedAt = finiteTimestamp(sample.lastPlayedAt);
  const track = cleanText(sample.title), artist = cleanText(sample.artist);
  if (start === null || end === null || playedAt === null || playedAt < start - 120_000 || playedAt > end + 120_000 || !track || !artist) return null;
  const stableTrackId = cleanText(sample.id, 100) || `${track}\0${artist}`;
  return normalizeMusicObservation({
    observationId: observationId('apple_music', stableTrackId, playedAt),
    source: 'apple_music',
    playedAt: new Date(playedAt).toISOString(),
    track,
    artist,
    album: cleanText(sample.album) || null,
    durationMs: boundedDurationMilliseconds(sample.durationSeconds),
    artworkUrl: cleanHttpsUrl(sample.artworkUrl),
    externalUrl: cleanHttpsUrl(sample.appleMusicUrl),
    confidence: null,
  });
}

export function shazamMatchObservation(match: ShazamMatch, sessionStartedAt: string): MusicObservation | null {
  if (match.status !== 'matched') return null;
  const track = cleanText(match.title);
  const artist = cleanText(match.artist);
  const playedAtMs = sessionBoundedPlaybackTime(match.recognizedAt, match.recognizedAt, sessionStartedAt);
  if (!track || !artist || playedAtMs === null) return null;
  const stableTrackId = cleanText(match.shazamId, 100)
    || cleanText(match.appleMusicId, 100)
    || cleanText(match.isrc, 100)
    || `${track}\0${artist}`;
  return normalizeMusicObservation({
    observationId: observationId('shazam', stableTrackId, playedAtMs),
    source: 'shazam',
    playedAt: new Date(playedAtMs).toISOString(),
    track,
    artist,
    album: null,
    durationMs: null,
    artworkUrl: cleanHttpsUrl(match.artworkUrl),
    externalUrl: cleanHttpsUrl(match.appleMusicUrl) || cleanHttpsUrl(match.shazamUrl),
    confidence: null,
  });
}
