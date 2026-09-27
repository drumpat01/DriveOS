import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dateRangeLabel, daypartOf, driveSongs, driveTitle, formatMilesShort, formatMinutesShort, memoryIdFromSearch,
  memoryStats, memoryYearGroups, newestJourney, onThisDay, placeName, relativeTime, routeLabel, searchSections,
  smartCollections, soundtrackSummary, weekSummary,
} from '../src/redesign-model.ts';

const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const song = (track: string, artist = 'Neon Dreams', playedAt: string | null = null, durationMs: number | null = 200_000) =>
  ({ playedAt, track, artist, album: null, durationMs, artworkUrl: null, externalUrl: null, source: 'test', confidence: 1 });
const journey = (id: string, startedAt: string, miles: number, tracks = [song('Coastline')], start = 'Pacifica, CA', end = 'Half Moon Bay, CA') => ({
  id, legacyDriveId: null, provider: null, vehicleName: null, startedAt, endedAt: startedAt, durationMinutes: 30,
  miles, startingLocation: start, endingLocation: end, averageSpeedMph: 40, maxSpeedMph: 60,
  songCount: tracks.length, soundtrackPreview: tracks,
});
const memory = (id: string, journeyIds: string[], createdAtUtc = '2026-01-01T00:00:00Z') =>
  ({ id, name: id, notes: '', artworkKey: 'road-trips', coverPhotoId: null, photos: [], journeyIds, createdAtUtc, updatedAtUtc: createdAtUtc });

test('labels read like the approved design', () => {
  assert.equal(placeName('Pacifica, CA, USA'), 'Pacifica');
  assert.equal(placeName('  '), null);
  assert.equal(routeLabel({ startingLocation: 'Pacifica, CA', endingLocation: 'Half Moon Bay, CA' }), 'Pacifica → Half Moon Bay');
  assert.equal(routeLabel({ startingLocation: null, endingLocation: 'Carmel' }), 'Arrived near Carmel');
  assert.equal(routeLabel({ startingLocation: 'Carmel', endingLocation: 'Carmel' }), 'Around Carmel');
  assert.equal(driveTitle(local(2026, 9, 25, 18, 42)), 'Friday evening drive');
  assert.equal(driveTitle(local(2026, 9, 26, 2)), 'Saturday late-night drive');
  assert.equal(formatMilesShort(28.44), '28.4 mi');
  assert.equal(formatMilesShort(1234.5), '1,235 mi');
  assert.equal(formatMinutesShort(47), '47 min');
  assert.equal(formatMinutesShort(312), '5h 12m');
  assert.equal(formatMinutesShort(120), '2h');
});

test('relative time covers minutes, hours, days and dates', () => {
  const now = new Date(2026, 8, 27, 20, 0).getTime();
  assert.equal(relativeTime(local(2026, 9, 27, 19, 55), now), '5 min ago');
  assert.equal(relativeTime(local(2026, 9, 27, 18, 0), now), '2h ago');
  assert.equal(relativeTime(local(2026, 9, 26, 18, 0), now), 'yesterday');
  assert.equal(relativeTime(local(2026, 9, 23, 18, 0), now), '4 days ago');
  assert.equal(relativeTime(local(2026, 9, 1, 18, 0), now), 'Sep 1');
});

test('the week card compares seven local days with the seven before', () => {
  const now = new Date(2026, 8, 27, 20, 0).getTime();
  const summary = weekSummary([
    journey('a', local(2026, 9, 27, 9), 10),
    journey('b', local(2026, 9, 25, 18), 20, [song('A'), song('B')]),
    journey('c', local(2026, 9, 21, 8), 5),
    journey('old', local(2026, 9, 18, 8), 25),
    journey('older', local(2026, 9, 1, 8), 99),
  ] as never, now);
  assert.equal(summary.days.length, 7);
  assert.equal(summary.days[6].isToday, true);
  assert.equal(summary.days[6].miles, 10);
  assert.equal(summary.days[0].miles, 5);
  assert.equal(summary.miles, 35);
  assert.equal(summary.drives, 3);
  assert.equal(summary.songs, 4);
  assert.equal(summary.maxMiles, 20);
  assert.equal(summary.changePercent, 40);
  assert.equal(weekSummary([], now).changePercent, null);
  assert.equal(newestJourney([journey('x', local(2026, 1, 1), 1), journey('y', local(2026, 2, 1), 1)] as never)?.id, 'y');
});

test('On this day finds the nearest earlier year within the window', () => {
  const now = new Date(2026, 8, 27, 12).getTime();
  const journeys = [
    journey('y1', local(2025, 9, 26), 50), journey('y2', local(2024, 9, 27), 50),
    journey('far', local(2025, 10, 20), 50), journey('this-year', local(2026, 9, 27), 50),
  ];
  const memories = [memory('two-years', ['y2']), memory('last-year', ['y1']), memory('october', ['far']), memory('today', ['this-year'])];
  const result = onThisDay(memories, journeys as never, now);
  assert.equal(result?.memory.id, 'last-year');
  assert.equal(result?.yearsAgo, 1);
  assert.equal(onThisDay([memory('october', ['far'])], journeys as never, now), null);
});

test('memory stats total drives and rank the soundtrack', () => {
  const journeys = [
    journey('fri', local(2026, 9, 12, 17), 121, [song('Midnight Odyssey'), song('Midnight Odyssey'), song('Low Tide', 'Pacific Set')], 'San Francisco, CA', 'Carmel, CA'),
    journey('sat', local(2026, 9, 13, 9), 68, [song('Coastline', 'Harbor Lights'), song('Midnight Odyssey')], 'Carmel, CA', 'Ragged Point, CA'),
    journey('other', local(2026, 9, 20, 9), 5),
  ];
  const stats = memoryStats(memory('m', ['sat', 'fri']), journeys as never, []);
  assert.deepEqual(stats.journeys.map(item => item.id), ['fri', 'sat']);
  assert.equal(stats.drives, 2);
  assert.equal(stats.miles, 189);
  assert.equal(stats.minutes, 60);
  assert.equal(stats.songs, 5);
  assert.equal(stats.dateLabel, 'Sep 12–13, 2026');
  assert.deepEqual(stats.places, ['San Francisco', 'Carmel', 'Ragged Point']);
  assert.equal(stats.topTracks[0].track, 'Midnight Odyssey');
  assert.equal(stats.topTracks[0].plays, 3);
  assert.equal(stats.topTracks[0].drives, 2);
  assert.equal(stats.topTrackByJourney.fri.track, 'Midnight Odyssey');
  assert.equal(stats.topTrackByJourney.fri.plays, 2);
});

test('date ranges collapse shared months and years', () => {
  assert.equal(dateRangeLabel(local(2026, 9, 12), local(2026, 9, 12, 18)), 'Sep 12, 2026');
  assert.equal(dateRangeLabel(local(2026, 8, 30), local(2026, 9, 2)), 'Aug 30 – Sep 2, 2026');
  assert.equal(dateRangeLabel(local(2025, 12, 30), local(2026, 1, 2)), 'Dec 30, 2025 – Jan 2, 2026');
  assert.equal(dateRangeLabel(null, null), '');
});

test('memories group by year of their first drive, newest first', () => {
  const journeys = [journey('a', local(2026, 9, 12), 100), journey('b', local(2026, 6, 1), 20), journey('c', local(2025, 10, 5), 40)];
  const groups = memoryYearGroups([memory('june', ['b']), memory('autumn', ['c']), memory('sept', ['a']), memory('empty', [], '2024-03-01T12:00:00Z')], journeys as never);
  assert.deepEqual(groups.map(group => group.year), [2026, 2025, 2024]);
  assert.deepEqual(groups[0].items.map(item => item.memory.id), ['sept', 'june']);
  assert.equal(groups[0].miles, 120);
  assert.equal(groups[2].items[0].drives, 0);
});

test('smart collections appear only when they have drives', () => {
  const journeys = [
    journey('1', local(2026, 9, 1, 22), 3, [], 'Home', 'Work'), journey('2', local(2026, 9, 2, 8), 50, [], 'Home', 'Work'),
    journey('3', local(2026, 9, 3, 13), 9, [], 'Store', 'Park'),
  ];
  const collections = smartCollections(journeys as never);
  assert.deepEqual(collections.map(item => item.id), ['favorites', 'night', 'longest']);
  assert.deepEqual(collections[0].journeyIds, ['1', '2']);
  assert.deepEqual(collections[1].journeyIds, ['1']);
  assert.deepEqual(collections[2].journeyIds, ['2', '3', '1']);
  assert.deepEqual(smartCollections([journey('x', local(2026, 9, 1, 9), 1)] as never), []);
});

test('the soundtrack summary ranks songs, artists, dayparts and places within the range', () => {
  const now = new Date(2026, 8, 27, 21).getTime();
  const journeys = [
    journey('a', local(2026, 9, 25, 18), 20, [song('Midnight Odyssey', 'Neon Dreams', local(2026, 9, 25, 18, 5)), song('Coastline', 'Harbor Lights', local(2026, 9, 25, 18, 9))], 'Pacifica', 'Half Moon Bay'),
    journey('b', local(2026, 9, 26, 8), 10, [song('Midnight Odyssey', 'Neon Dreams', local(2026, 9, 26, 8, 2), null)], 'Home', 'Pacifica'),
    journey('silent', local(2026, 9, 26, 12), 10, []),
    journey('old', local(2026, 6, 1, 12), 99, [song('Old Song')]),
  ];
  const week = soundtrackSummary(journeys as never, [], 'week', now);
  assert.equal(week.drives, 3);
  assert.equal(week.plays, 3);
  assert.equal(week.distinctSongs, 2);
  assert.equal(week.listeningMinutes, 7);
  assert.equal(week.musicMilesPercent, 75);
  assert.equal(week.anthem?.track, 'Midnight Odyssey');
  assert.equal(week.anthem?.drives, 2);
  assert.equal(week.anthem?.miles, 30);
  assert.equal(week.topArtists[0].artist, 'Neon Dreams');
  assert.deepEqual(week.dayparts.map(part => part.plays), [1, 0, 2, 0]);
  assert.deepEqual(week.places.map(place => place.place), ['Half Moon Bay', 'Pacifica']);
  assert.equal(soundtrackSummary(journeys as never, [], 'all', now).plays, 4);
  assert.equal(soundtrackSummary([], [], 'month', now).anthem, null);
  assert.equal(daypartOf(4), 'night');
  assert.equal(daypartOf(12), 'afternoon');
});

test('drive songs carry the mile they started at when the route is timed', () => {
  const base = Date.UTC(2026, 8, 25, 18, 0);
  const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();
  const points = [0, 10, 20].map((minutes, index) => ({ recordedAt: at(minutes), coordinate: [-122.5, 37.6 + index * 0.1] }));
  const trip = journey('a', at(0), 14, [song('Second', 'A', at(12)), song('First', 'A', at(1))]);
  const songs = driveSongs(trip as never, { ...trip, soundtrack: trip.soundtrackPreview, route: { type: 'LineString', coordinates: [], points } } as never);
  assert.deepEqual(songs.map(item => item.track), ['First', 'Second']);
  assert.equal(songs[0].mile, 0);
  assert.ok(songs[1].mile! > 6.8 && songs[1].mile! < 7.0);
  assert.equal(driveSongs(trip as never, null)[0].mile, null);
});

test('search results group into sections and recognise memory records', () => {
  const records = [
    { id: 'song:1', kind: 'song', title: 'Coastline', subtitle: '', keywords: '' },
    { id: 'memory:m1', kind: 'memory', title: 'Big Sur', subtitle: '', keywords: '' },
  ] as never;
  assert.deepEqual(searchSections(records).map(section => section.title), ['Memories', 'Songs']);
  assert.equal(memoryIdFromSearch({ id: 'memory:m1', kind: 'memory' }), 'm1');
  assert.equal(memoryIdFromSearch({ id: 'journey:j1', kind: 'journey' }), null);
});
