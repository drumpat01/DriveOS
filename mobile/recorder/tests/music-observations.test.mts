import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appleCurrentTrackObservation,
  appleRecentSongObservation,
  normalizeMusicObservation,
  shazamMatchObservation,
} from '../src/music-observations.ts';
import { musicTrackDestination } from '../src/music-destination.ts';

test('Apple Music samples of the same playback produce one stable observation identity', () => {
  const first = appleCurrentTrackObservation({
    available: true,
    isPlaying: true,
    sampledAt: '2026-08-23T15:00:40.000Z',
    estimatedStartedAt: '2026-08-23T15:00:00.400Z',
    persistentId: '12345',
    title: ' Night Drive ',
    artist: ' Example Artist ',
    album: 'Road Songs',
    durationSeconds: 181.234,
  }, '2026-08-23T14:59:00.000Z');
  const later = appleCurrentTrackObservation({
    available: true,
    isPlaying: true,
    sampledAt: '2026-08-23T15:01:01.000Z',
    estimatedStartedAt: '2026-08-23T14:59:59.800Z',
    persistentId: '12345',
    title: 'Night Drive',
    artist: 'Example Artist',
    album: 'Road Songs',
    durationSeconds: 181.234,
  }, '2026-08-23T14:59:00.000Z');

  assert.ok(first);
  assert.ok(later);
  assert.equal(first.observationId, later.observationId);
  assert.equal(first.track, 'Night Drive');
  assert.equal(first.durationMs, 181_234);
});

test('Apple Music recent history enriches an in-window journey with artwork and catalog links', () => {
  const observation = appleRecentSongObservation({
    id: 'apple-song-7', title: 'Road Song', artist: 'Example Artist', album: 'Open Highway',
    lastPlayedAt: '2026-08-23T15:03:00.000Z', durationSeconds: 202.4,
    artworkUrl: 'https://example.com/artwork.jpg', appleMusicUrl: 'https://music.apple.com/song/7',
  }, '2026-08-23T15:00:00.000Z', '2026-08-23T15:10:00.000Z');
  assert.ok(observation);
  assert.equal(observation.artworkUrl, 'https://example.com/artwork.jpg');
  assert.equal(observation.externalUrl, 'https://music.apple.com/song/7');
  assert.equal(appleRecentSongObservation({
    id: 'late', title: 'Later', artist: 'Artist', lastPlayedAt: '2026-08-23T16:00:00.000Z',
  }, '2026-08-23T15:00:00.000Z', '2026-08-23T15:10:00.000Z'), null);
});

test('Apple Music playback is associated with the journey start when the song began earlier', () => {
  const observation = appleCurrentTrackObservation({
    available: true,
    isPlaying: true,
    sampledAt: '2026-08-23T15:10:00.000Z',
    estimatedStartedAt: '2026-08-23T15:00:00.000Z',
    appleMusicId: 'apple-1',
    title: 'Long Song',
    artist: 'Example Artist',
  }, '2026-08-23T15:09:30.000Z');

  assert.equal(observation?.playedAt, '2026-08-23T15:09:30.000Z');
});

test('Apple Music does not queue paused, unavailable, or incomplete metadata', () => {
  assert.equal(appleCurrentTrackObservation({
    available: true, isPlaying: false, sampledAt: '2026-08-23T15:00:00.000Z', title: 'Song', artist: 'Artist',
  }, '2026-08-23T14:59:00.000Z'), null);
  assert.equal(appleCurrentTrackObservation({
    available: false, isPlaying: true, sampledAt: '2026-08-23T15:00:00.000Z', title: 'Song', artist: 'Artist',
  }, '2026-08-23T14:59:00.000Z'), null);
  assert.equal(appleCurrentTrackObservation({
    available: true, isPlaying: true, sampledAt: '2026-08-23T15:00:00.000Z', title: 'Song',
  }, '2026-08-23T14:59:00.000Z'), null);
});

test('Shazam matches keep only bounded metadata and HTTPS links', () => {
  const observation = shazamMatchObservation({
    status: 'matched',
    recognizedAt: '2026-08-23T15:00:10.000Z',
    shazamId: 'shazam-123',
    title: '  Found   Song ',
    artist: ' Found Artist ',
    artworkUrl: 'http://example.com/art.jpg',
    appleMusicUrl: 'https://music.apple.com/song/123',
  }, '2026-08-23T15:00:00.000Z');

  assert.ok(observation);
  assert.equal(observation.track, 'Found Song');
  assert.equal(observation.artist, 'Found Artist');
  assert.equal(observation.artworkUrl, null);
  assert.equal(observation.externalUrl, 'https://music.apple.com/song/123');
  assert.equal(shazamMatchObservation({ status: 'no_match', recognizedAt: '2026-08-23T15:00:10.000Z' }, '2026-08-23T15:00:00.000Z'), null);
});

test('normalization replaces an unsafe id and rejects missing playback metadata', () => {
  const normalized = normalizeMusicObservation({
    observationId: 'unsafe id with spaces',
    source: 'lastfm',
    playedAt: '2026-08-23T15:00:10Z',
    track: 'Song',
    artist: 'Artist',
    album: null,
    durationMs: null,
    artworkUrl: null,
    externalUrl: null,
    confidence: null,
  });
  assert.match(normalized?.observationId || '', /^[A-Za-z0-9._:-]+$/);
  assert.equal(normalizeMusicObservation({
    observationId: 'valid', source: 'lastfm', playedAt: 'not-a-time', track: 'Song', artist: 'Artist',
    album: null, durationMs: null, artworkUrl: null, externalUrl: null, confidence: null,
  }), null);
});

test('music track destinations follow only the selected playback service', () => {
  const track = { track: 'Night Drive', artist: 'The Test Pilots', externalUrl: 'https://open.spotify.com/track/spotify-id' };
  assert.equal(musicTrackDestination(track, 'lastfm'), track.externalUrl);
  assert.equal(musicTrackDestination(track, 'spotify-direct'), track.externalUrl);
  assert.equal(musicTrackDestination(track, 'apple-music'), 'https://music.apple.com/us/search?term=Night%20Drive%20The%20Test%20Pilots');
  assert.equal(musicTrackDestination(track, 'shazam'), null);
  assert.equal(musicTrackDestination({ ...track, externalUrl: 'https://music.apple.com/us/song/apple-id' }, 'apple-music'), 'https://music.apple.com/us/song/apple-id');
  assert.equal(musicTrackDestination({ ...track, externalUrl: null }, 'lastfm'), 'https://open.spotify.com/search/Night%20Drive%20The%20Test%20Pilots');
});
