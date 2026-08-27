import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMusicArchive, favoriteRoutes, filterJourneyLibrary, filterMusicArchive, topArchiveTracks } from '../src/library-model.ts';

const journey = (id: string, start: string, end: string, miles: number, track = 'Song') => ({
  id, legacyDriveId: null, provider: 'tessie', vehicleName: 'Juniper', startedAt: `2026-08-${id.padStart(2, '0')}T12:00:00Z`, endedAt: `2026-08-${id.padStart(2, '0')}T12:30:00Z`, durationMinutes: 30,
  miles, startingLocation: start, endingLocation: end, averageSpeedMph: 35, maxSpeedMph: 55, songCount: 1,
  soundtrackPreview: [{ playedAt: null, track, artist: 'Artist', album: 'Album', durationMs: null, artworkUrl: null, externalUrl: null, source: 'test', confidence: 1 }],
});

test('journey library searches, filters, and sorts cached journeys', () => {
  const items = [journey('1', 'Home', 'Work', 8), journey('2', 'School', 'Home', 20, 'Highway')];
  assert.deepEqual(filterJourneyLibrary(items, 'highway', 'all', 'newest').map(item => item.id), ['2']);
  assert.deepEqual(filterJourneyLibrary(items, '', 'long', 'distance').map(item => item.id), ['2']);
});

test('favorite routes require repeated normalized endpoints', () => {
  const routes = favoriteRoutes([journey('1', 'Home', 'Work', 10), journey('2', ' home ', 'WORK', 14), journey('3', 'Store', 'Home', 4)]);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].count, 2);
  assert.equal(routes[0].averageMiles, 12);
});

test('music archive ties searchable plays to their journey and ranks tracks', () => {
  const journeys = [journey('1', 'Home', 'Work', 10, 'First Date'), journey('2', 'Work', 'Home', 10, 'First Date')];
  const archive = buildMusicArchive(journeys, []);
  assert.equal(archive.length, 2);
  assert.equal(filterMusicArchive(archive, 'work').length, 2);
  assert.deepEqual(topArchiveTracks(archive)[0], { track: 'First Date', artist: 'Artist', artworkUrl: null, plays: 2 });
});
