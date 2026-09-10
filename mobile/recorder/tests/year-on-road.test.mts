import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildYearOnRoadRecap, recapRoutePath, type YearOnRoadData, type YearOnRoadJourney } from '../src/year-on-road-model.ts';
import { renderYearOnRoadScore } from '../src/year-on-road-score.ts';

const now = new Date(2026, 8, 7, 12);
const journey = (id: string, startedAt: string, extra: Partial<YearOnRoadJourney> = {}): YearOnRoadJourney => ({ id, startedAt, miles: 10, durationMinutes: 30, ...extra });
const localDate = (year: number, month: number, day: number, hour = 12) => new Date(year, month, day, hour).toISOString();
const fixture = (): YearOnRoadData => ({ journeys: [], songs: [], memories: [] });

test('calendar-year boundaries follow journey start and exclude invalid/future observations', () => {
  const data = fixture();
  data.journeys = [journey('prior', localDate(2025, 11, 31, 23), { endedAt: localDate(2026, 0, 1, 1) }),
    journey('first', localDate(2026, 0, 1, 0)), journey('now', now.toISOString()),
    journey('future', localDate(2026, 9, 1)), journey('broken', 'invalid')];
  const recap = buildYearOnRoadRecap(data, 2026, now);
  assert.equal(recap.journeyCount, 2);
  assert.equal(recap.miles, 20);
  assert.equal(recap.soFar, true);
  assert.deepEqual(recap.years, [2026, 2025]);
  assert.equal(buildYearOnRoadRecap(data, 2025, now).journeyCount, 1);
  assert.equal(buildYearOnRoadRecap(data, 2025, now).soFar, false);
});

test('repeated pages count IDs once and keep a route-bearing copy; distinct IDs at the same time remain distinct', () => {
  const data = fixture(), date = localDate(2026, 1, 1);
  data.journeys = [journey('one', date), journey('one', date, { route: { coordinates: [[10, 20], [11, 21]] } }), journey('two', date)];
  const recap = buildYearOnRoadRecap(data, 2026, now);
  assert.equal(recap.journeyCount, 2);
  assert.equal(recap.activeDays, 1);
  assert.equal(recap.longestJourney?.route?.coordinates.length, 2);
});

test('missing or invalid measurements are never replaced with invented driving time', () => {
  const data = fixture();
  data.journeys = [journey('a', localDate(2026, 0, 2), { miles: NaN, durationMinutes: null }),
    journey('b', localDate(2026, 0, 3), { miles: -1, durationMinutes: Infinity }),
    journey('c', localDate(2026, 0, 4), { miles: 0, durationMinutes: 0 }),
    journey('d', localDate(2026, 0, 5), { miles: 13.5, durationMinutes: 42 })];
  const recap = buildYearOnRoadRecap(data, 2026, now);
  assert.equal(recap.journeyCount, 4);
  assert.equal(recap.miles, 13.5);
  assert.equal(recap.drivingMinutes, 42);
  assert.equal(recap.measuredDurationJourneys, 2);
  assert.equal(recap.longestJourney?.id, 'd');
});

test('monthly/daypart counts use local starts and calendar dates across a leap day', () => {
  const data = fixture();
  data.journeys = [journey('early', localDate(2024, 1, 29, 1)), journey('morning', localDate(2024, 1, 29, 8)),
    journey('afternoon', localDate(2024, 2, 1, 13)), journey('evening', localDate(2024, 2, 1, 20))];
  const recap = buildYearOnRoadRecap(data, 2024, now);
  assert.equal(recap.activeDays, 2);
  assert.equal(recap.months[1].journeys, 2);
  assert.deepEqual(recap.dayparts.map(part => part.journeys), [1, 1, 1, 1]);
  assert.equal(recap.busiestMonth, recap.months[1].label);
});

test('cross-provider duplicate song plays deduplicate without collapsing later repeat plays', () => {
  const data = fixture();
  data.journeys = [journey('j', localDate(2026, 3, 1))];
  const base = { journeyId: 'j', playedAt: localDate(2026, 3, 1), track: 'The Road', artist: 'A Person', durationMs: 180_000 };
  data.songs = [{ ...base, id: 'one' }, { ...base, id: 'two', track: ' THE road ' },
    { ...base, id: 'one' }, { ...base, id: 'three', playedAt: new Date(Date.parse(base.playedAt) + 600_000).toISOString() },
    { ...base, id: 'unlinked', journeyId: null }, { ...base, id: 'other-year', journeyId: 'not-in-recap' }];
  const recap = buildYearOnRoadRecap(data, 2026, now);
  assert.equal(recap.songPlays, 2);
  assert.equal(recap.distinctSongs, 1);
  assert.equal(recap.topSongs[0].plays, 2);
  assert.equal(recap.knownSongMinutes, 6);
  assert.equal(recap.journeysWithMusic, 1);
});

test('durations remain partial, untimed observations require durable IDs, and blank tracks are excluded', () => {
  const data = fixture();
  data.journeys = [journey('j', localDate(2026, 3, 1))];
  data.songs = [
    { id: 'a', journeyId: 'j', playedAt: null, track: 'Known', artist: 'Artist', durationMs: 240_000 },
    { id: 'b', journeyId: 'j', playedAt: null, track: 'Missing', artist: 'Artist', durationMs: null },
    { id: 'c', journeyId: 'j', playedAt: null, track: 'Invalid', artist: '', durationMs: -4 },
    { journeyId: 'j', playedAt: null, track: 'Cannot distinguish', artist: 'Artist', durationMs: 80_000 },
    { id: 'empty', journeyId: 'j', playedAt: null, track: ' ', artist: 'Artist', durationMs: 80_000 },
  ];
  const recap = buildYearOnRoadRecap(data, 2026, now);
  assert.equal(recap.songPlays, 3);
  assert.equal(recap.knownSongMinutes, 4);
  assert.equal(recap.songsWithDuration, 1);
  assert.equal(recap.topArtists[0].plays, 2);
});

test('New Year song events stay with the associated journey year', () => {
  const data = fixture();
  data.journeys = [journey('j', localDate(2025, 11, 31, 23), { endedAt: localDate(2026, 0, 1, 1) })];
  data.songs = [{ id: 'song', journeyId: 'j', playedAt: localDate(2026, 0, 1, 0), track: 'After midnight', artist: 'Artist', durationMs: null }];
  assert.equal(buildYearOnRoadRecap(data, 2025, now).songPlays, 1);
  assert.equal(buildYearOnRoadRecap(data, 2026, now).songPlays, 0);
});

test('Memory totals count only unique Memories with journeys belonging to the selected year', () => {
  const data = fixture(); data.journeys = [journey('j', localDate(2026, 0, 1))];
  data.memories = [{ id: 'one', name: 'Trip', journeyIds: ['j', 'j', 'old'] },
    { id: 'one', name: 'Trip', journeyIds: ['j', 'j', 'old'] }, { id: 'old', name: 'Prior', journeyIds: ['old'] }];
  const recap = buildYearOnRoadRecap(data, 2026, now);
  assert.equal(recap.memories.length, 1);
  assert.deepEqual(recap.memories[0].journeyIds, ['j']);
  assert.deepEqual(data.memories[0].journeyIds, ['j', 'j', 'old'], 'input remains unchanged');
});

test('empty and invalid-year requests stay honest', () => {
  const recap = buildYearOnRoadRecap(fixture(), 2040, now);
  assert.equal(recap.year, 2026);
  assert.equal(recap.journeyCount, 0);
  assert.equal(recap.longestJourney, null);
  assert.equal(recap.busiestMonth, null);
  assert.equal(recap.knownSongMinutes, 0);
  assert.deepEqual(recap.topSongs, []);
});

test('route drawing is finite, bounded and handles antimeridian crossings without a global detour', () => {
  assert.equal(recapRoutePath([]), null);
  assert.equal(recapRoutePath([[NaN, 10], [90, 95]]), null);
  const path = recapRoutePath([[179.95, 15], [-179.95, 15.01], [-179.9, 15.02]]);
  assert.ok(path);
  assert.doesNotMatch(path, /NaN|Infinity/);
  const points = [...path.matchAll(/([\d.]+),([\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  for (const [x, y] of points) { assert.ok(x >= 19 && x <= 301); assert.ok(y >= 19 && y <= 201); }
  const big = recapRoutePath(Array.from({ length: 150_000 }, (_, index) => [10 + index * 0.000001, 20 + index * 0.000001]));
  assert.ok((big?.match(/L/g)?.length ?? Infinity) <= 160);
});

test('bundled original score is reproducible PCM with a smooth boundary and safe finite samples', () => {
  for (const [file, id] of [
    ['year-on-road-midnight-velocity-v1.wav', 'dark'],
    ['year-on-road-sunlit-coast-v1.wav', 'light'],
    ['year-on-road-champagne-apex-v1.wav', 'redline'],
    ['year-on-road-petal-rush-v1.wav', 'sakura'],
    ['year-on-road-accent-v1.wav', 'accent'],
  ] as const) {
    const bytes = renderYearOnRoadScore(id);
    assert.deepEqual(Buffer.from(bytes), readFileSync(new URL(`../assets/${file}`, import.meta.url)));
    const view = new DataView(bytes.buffer);
    assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'RIFF');
    assert.equal(view.getUint16(22, true), 1);
    assert.equal(view.getUint32(24, true), 22_050);
    assert.equal(view.getUint32(40, true), bytes.length - 44);
    assert.equal(view.getInt16(44, true), 0);
    assert.equal(view.getInt16(bytes.length - 2, true), 0);
    let peak = 0;
    for (let i = 44; i < bytes.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    assert.ok(peak > 1000 && peak < 30_000);
  }
});
