import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAtlasTravelStories } from '../src/atlas-travel-stories.ts';
import type { JourneyDetail, SoundtrackTrack } from '../src/app-data.ts';
import type { TessieStatisticsCharge, TessieStatisticsDrive } from '../src/tessie-statistics-model.ts';

const base = Date.parse('2026-09-20T08:00:00.000Z');
const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();
const route: [number, number][] = [[-87, 41], [-86.9, 41.1]];
function drive(id: string, start: number, end: number, from: string, to: string, vehicleKey = 'car-a'): TessieStatisticsDrive {
  return { journeyId: id, sourceDriveId: id, vehicleKey, vehicleName: null, startedAt: at(start), endedAt: at(end), miles: 12,
    energyUsedKwh: null, startingLocation: from, endingLocation: to, startingBatteryPercent: null, endingBatteryPercent: null };
}
function song(name: string, minute: number, source = 'apple_music'): SoundtrackTrack {
  return { playedAt: at(minute), track: name, artist: 'Artist', album: null, durationMs: null, artworkUrl: null, externalUrl: null, source, confidence: null };
}
function detail(drive: TessieStatisticsDrive, soundtrack: SoundtrackTrack[], coordinates = route): JourneyDetail {
  return { id: drive.journeyId, legacyDriveId: null, provider: 'tessie', vehicleName: null, startedAt: drive.startedAt, endedAt: drive.endedAt,
    durationMinutes: (Date.parse(drive.endedAt) - Date.parse(drive.startedAt)) / 60_000, miles: drive.miles, startingLocation: drive.startingLocation,
    endingLocation: drive.endingLocation, averageSpeedMph: null, maxSpeedMph: null, songCount: soundtrack.length, soundtrackPreview: [],
    startingBatteryPercent: null, endingBatteryPercent: null, energyUsedKwh: null, tessieTag: null, driverProfile: null,
    soundtrack, route: { type: 'LineString', coordinates } };
}
const charge = (journeyId: string, start: number, end: number): TessieStatisticsCharge => ({ id: `charge-${journeyId}`, journeyId,
  startedAt: at(start), endedAt: at(end), location: 'Supercharger', energyAddedKwh: 20, arrivalBatteryPercent: 30, departureBatteryPercent: 60 });

test('song travel uses only explicit in-drive Apple Music and Last.fm timestamps', () => {
  const out = drive('out', 0, 40, 'Home', 'Lake');
  const back = drive('back', 120, 160, 'Lake', 'Home');
  const stories = buildAtlasTravelStories([out, back], [], [
    detail(out, [song('Road', 3), song('Road', 5, 'lastfm'), song('Wrong clock', 55), song('Manual', 9, 'shazam'), { ...song('Local time', 10), playedAt: '2026-09-20T08:10:00' }]),
    detail(back, [song('Road', 130, 'lastfm')]),
  ], new Set(), new Set(), new Date(at(200)));
  assert.equal(stories.songs.length, 1);
  assert.equal(stories.songs[0].track, 'Road');
  assert.deepEqual(stories.songs[0].journeys.map(item => item.journeyId), ['out', 'back']);
  assert.deepEqual(stories.songs[0].journeys[0].route, route);
});

test('drive home requires the next same-vehicle drive to reverse named endpoints, and shows only a between-drive charge', () => {
  const out = drive('out', 0, 40, 'Home', 'Lake');
  const back = drive('back', 120, 160, 'Lake', 'Home');
  const otherCar = drive('other', 70, 90, 'Gym', 'Cafe', 'car-b');
  const stories = buildAtlasTravelStories([out, otherCar, back], [charge('out', 45, 80), charge('back', 165, 180)],
    [detail(out, []), detail(back, [])], new Set(), new Set(), new Date(at(200)));
  assert.equal(stories.driveHome?.outwardId, 'out');
  assert.equal(stories.driveHome?.returnId, 'back');
  assert.equal(stories.driveHome?.charge?.id, 'charge-out');
  const detour = drive('detour', 80, 100, 'Lake', 'Market');
  assert.equal(buildAtlasTravelStories([out, detour, back], [], [], new Set(), new Set(), new Date(at(200))).driveHome, null);
  assert.equal(buildAtlasTravelStories([out, { ...back, vehicleKey: 'car-b' }], [], [], new Set(), new Set(), new Date(at(200))).driveHome, null);
  assert.equal(buildAtlasTravelStories([{ ...out, startingLocation: 'Airport' }, { ...back, endingLocation: 'Airport' }], [], [], new Set(), new Set(), new Date(at(200))).driveHome, null);
  assert.equal(buildAtlasTravelStories([out, { ...back, startedAt: at(1200), endedAt: at(1240) }], [], [], new Set(), new Set(), new Date(at(1300))).driveHome, null);
});

test('quiet moments describe missing records and memory prompts wait, expire, and respect dismissal or saved history', () => {
  const out = drive('out', 0, 50, 'Home', 'Lake');
  const gaps = buildAtlasTravelStories([out], [], [detail(out, [song('First', 5), song('Last', 35)])], new Set(), new Set(), new Date(at(80)));
  assert.equal(gaps.quietMoments[0].minutes, 30);
  assert.equal(gaps.quietMoments[0].entireDrive, false);
  assert.equal(gaps.rememberDrive?.journeyId, 'out');
  const none = buildAtlasTravelStories([out], [], [detail(out, [])], new Set(), new Set(), new Date(at(65)));
  assert.equal(none.quietMoments[0].entireDrive, true);
  assert.equal(none.rememberDrive, null, 'prompt waits twenty minutes after drive end');
  assert.equal(buildAtlasTravelStories([out], [], [], new Set(), new Set(['out']), new Date(at(80))).rememberDrive, null);
  assert.equal(buildAtlasTravelStories([out], [], [], new Set(['out']), new Set(), new Date(at(80))).rememberDrive, null);
  assert.equal(buildAtlasTravelStories([out], [], [], new Set(), new Set(), new Date(at(3000))).rememberDrive, null);
});
