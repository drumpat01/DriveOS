import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { tessieMediaObservation } from '../../src/music-observations.ts';

const root = path.resolve(import.meta.dirname, '../..');
const appData = fs.readFileSync(path.join(root, 'src', 'app-data.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src', 'vehicle-intelligence-screen.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'shell.tsx'), 'utf8');
const tessie = fs.readFileSync(path.join(root, 'src', 'tessie-direct.ts'), 'utf8');
const profileSecrets = fs.readFileSync(path.join(root, 'src', 'profile-secure-store.ts'), 'utf8');

test('dormant Tessie media places Tesla built-in playback at its estimated route time', () => {
  const observation = tessieMediaObservation({
    available: true,
    isPlaying: true,
    sampledAt: '2026-08-30T15:05:48.000Z',
    track: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We’re Dreaming',
    source: 'AppleMusic',
    durationMs: 243_000,
    elapsedMs: 48_000,
  }, '2026-08-30T15:00:00.000Z');

  assert.ok(observation);
  assert.equal(observation.playedAt, '2026-08-30T15:05:00.000Z');
  assert.equal(observation.source, 'apple_music');
  assert.equal(observation.durationMs, 243_000);
});

test('dormant Tessie media rejects paused, unavailable, and incomplete playback', () => {
  assert.equal(tessieMediaObservation({ available: true, isPlaying: false, sampledAt: '2026-08-30T15:05:00.000Z', track: 'Song', artist: 'Artist' }, '2026-08-30T15:00:00.000Z'), null);
  assert.equal(tessieMediaObservation({ available: false, isPlaying: true, sampledAt: '2026-08-30T15:05:00.000Z', track: 'Song', artist: 'Artist' }, '2026-08-30T15:00:00.000Z'), null);
  assert.equal(tessieMediaObservation({ available: true, isPlaying: true, sampledAt: '2026-08-30T15:05:00.000Z', track: 'Song' }, '2026-08-30T15:00:00.000Z'), null);
});

test('dormant Tessie refresh remains local-first and privacy-edge bounded', () => {
  assert.match(appData, /vehicleIntelligenceCacheKey\(userId\)/);
  assert.match(appData, /refreshVehicleIntelligenceFromTessie/);
  assert.doesNotMatch(appData, /api\/recorder\/vehicle-intelligence/);
  assert.match(appData, /saveVehicleIntelligencePreferences/);
  assert.match(tessie, /loadProfileSecret\(TESSIE_TOKEN_KEY\)/);
  assert.match(profileSecrets, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
  assert.match(tessie, /\/api\/vehicle\/tessie\/sync/);
  assert.doesNotMatch(tessie, /requestJourneyDeckJson|loadConnection/);
});

test('dormant vehicle intelligence retains its requested data surfaces', () => {
  for (const phrase of [
    'Charging history', 'Home electricity rate', 'Favorite charging locations', 'Saved places',
    'Possible duplicates', 'FOURSQUARE SUGGESTION', 'TIME OF DAY', 'PLACE SOUNDTRACK',
    'RELATED JOURNEYS', 'Route efficiency', 'LIVE TESSIE SNAPSHOT',
  ]) assert.match(screen, new RegExp(phrase));
  for (const category of ['home', 'work', 'school', 'favorite', 'custom']) assert.match(screen, new RegExp(`'${category}'`));
});

test('dormant vehicle intelligence remains outside primary navigation', () => {
  assert.match(shell, /VehicleIntelligenceScreen/);
  assert.match(shell, /Drive intelligence/);
  assert.match(shell, /token in this iPhone Keychain/);
  assert.doesNotMatch(shell, /id: 'vehicle'/);
  assert.doesNotMatch(shell, /id: 'charging'/);
  assert.doesNotMatch(shell, /id: 'places'/);
});
