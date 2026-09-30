import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAtlasStory, drivingStreak } from '../src/atlas-story-model.ts';

const track = (name: string, artist: string) => ({ playedAt: null, track: name, artist, album: null, durationMs: 180_000, artworkUrl: null, externalUrl: null, source: 'test', confidence: null });
const journey = (id: string, startedAt: string, start: string, end: string, songs: ReturnType<typeof track>[]) =>
  ({ id, startedAt, startingLocation: start, endingLocation: end, soundtrackPreview: songs }) as never;

test('streak counts back from today, or from yesterday before today’s drive', () => {
  const now = new Date(2026, 8, 30, 12);
  const days = (...offsets: number[]) => offsets.map(offset => ({ startedAt: new Date(2026, 8, 30 - offset, 9).toISOString() }));
  assert.equal(drivingStreak(days(0, 1, 2, 4), now), 3);
  assert.equal(drivingStreak(days(1, 2), now), 2);
  assert.equal(drivingStreak(days(3), now), 0);
});

test('ranks artists, finds songs across drives and first-visit places', () => {
  const older = journey('a', '2026-08-01T10:00:00Z', 'Home', 'Carmel', []);
  const one = journey('b', '2026-09-20T10:00:00Z', 'Home', 'Truckee', [track('Dreams', 'Fleetwood Mac'), track('Holocene', 'Bon Iver')]);
  const two = journey('c', '2026-09-21T10:00:00Z', 'Carmel', 'Point Reyes', [track('Dreams', 'Fleetwood Mac'), track('Tusk', 'Fleetwood Mac')]);
  const story = buildAtlasStory([two, one], [two, one, older], [], new Date(2026, 8, 30));
  assert.deepEqual(story.topArtists.map(artist => [artist.artist, artist.plays]), [['Fleetwood Mac', 3], ['Bon Iver', 1]]);
  assert.deepEqual(story.followedSongs.map(song => [song.track, song.drives]), [['Dreams', 2]]);
  assert.equal(story.plays, 4);
  assert.equal(story.listeningMinutes, 12);
  assert.deepEqual(story.newPlaces, ['Truckee', 'Point Reyes']);
});
