import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAtlasInsights } from '../src/atlas-insights.ts';
import type { JourneyDetail, JourneySummary, SoundtrackTrack } from '../src/app-data.ts';

const now = new Date('2026-09-04T12:00:00-05:00');

function track(name: string, artist: string, playedAt: string, artworkUrl: string | null = null): SoundtrackTrack {
  return { playedAt, track: name, artist, album: null, durationMs: 180_000, artworkUrl, externalUrl: null, source: 'apple_music', confidence: 1 };
}

function journey(input: Partial<JourneySummary> & Pick<JourneySummary, 'id' | 'startedAt' | 'startingLocation' | 'endingLocation'>): JourneySummary {
  return {
    legacyDriveId: null,
    provider: 'manual',
    vehicleName: null,
    endedAt: input.startedAt,
    durationMinutes: 30,
    miles: 10,
    averageSpeedMph: null,
    maxSpeedMph: null,
    songCount: 0,
    soundtrackPreview: [],
    ...input,
  };
}

function detail(summary: JourneySummary, coordinates: [number, number][], soundtrack: SoundtrackTrack[] = []): JourneyDetail {
  return {
    ...summary,
    startingBatteryPercent: null,
    endingBatteryPercent: null,
    energyUsedKwh: null,
    tessieTag: null,
    driverProfile: null,
    soundtrack,
    route: { type: 'LineString', coordinates },
  };
}

const cells = (indexes: number[]) => indexes.map(index => [-87 + index * 0.004, 41] as [number, number]);

test('Atlas derives all five insights from the selected local journey window', () => {
  const j1 = journey({ id: 'j1', startedAt: '2026-09-03T08:00:00-05:00', startingLocation: 'Home', endingLocation: 'Work', durationMinutes: 30, miles: 10, songCount: 2 });
  const j2 = journey({ id: 'j2', startedAt: '2026-09-03T17:00:00-05:00', startingLocation: 'Home', endingLocation: 'Work', durationMinutes: 40, miles: 12, songCount: 1 });
  const j3 = journey({ id: 'j3', startedAt: '2026-09-02T17:30:00-05:00', startingLocation: 'Gym', endingLocation: 'Home', durationMinutes: 16, miles: 4 });
  const old = journey({ id: 'old', startedAt: '2026-05-01T08:00:00-05:00', startingLocation: 'Home', endingLocation: 'Airport', durationMinutes: 50, miles: 35 });
  const details = [
    detail(j1, cells([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), [track('One', 'Artist A', '2026-09-03T08:04:00-05:00', 'https://example.com/a.jpg'), track('Two', 'Artist A', '2026-09-03T08:08:00-05:00')]),
    detail(j2, cells([0, 1, 2, 3, 4, 10, 11, 12, 13, 14]), [track('Three', 'Artist B', '2026-09-03T17:05:00-05:00', 'https://example.com/b.jpg')]),
    detail(j3, cells([15, 16, 17, 18, 19])),
    detail(old, cells([20, 21, 22])),
  ];

  const result = buildAtlasInsights([j1, j2, j3, old], details, '30d', now);

  assert.equal(result.journeyCount, 3);
  assert.equal(result.miles, 26);
  assert.equal(result.mappedJourneyCount, 3);
  assert.equal(result.songCount, 3);
  assert.equal(result.activeDays, 2);

  assert.equal(result.routeDna.ready, true);
  assert.equal(result.routeDna.established, true);
  assert.equal(result.routeDna.bidirectional, false);
  assert.equal(result.routeDna.startLabel, 'Home');
  assert.equal(result.routeDna.endLabel, 'Work');
  assert.equal(result.routeDna.trips, 2);
  assert.equal(result.routeDna.averageMinutes, 35);
  assert.equal(result.routeDna.quickestMinutes, 30);
  assert.equal(result.routeDna.durationSpreadMinutes, 10);
  assert.equal(result.routeDna.averageMiles, 11);

  assert.equal(result.drivingRhythms.ready, true);
  assert.equal(result.drivingRhythms.leadingDay, 'Thu');
  assert.equal(result.drivingRhythms.leadingDayJourneys, 2);
  assert.equal(result.drivingRhythms.leadingTime, 'Evening');

  assert.equal(result.exploration.ready, true);
  assert.equal(result.exploration.mappedAreas, 20);
  assert.equal(result.exploration.oneJourneyAreas, 15);
  assert.equal(result.exploration.score, 75);

  assert.equal(result.placeRelationships.ready, true);
  assert.equal(result.placeRelationships.startLabel, 'Home');
  assert.equal(result.placeRelationships.endLabel, 'Work');
  assert.equal(result.placeRelationships.trips, 2);

  assert.equal(result.soundtrack.ready, true);
  assert.equal(result.soundtrack.plays, 3);
  assert.equal(result.soundtrack.uniqueSongs, 3);
  assert.equal(result.soundtrack.topArtist, 'Artist A');
  assert.equal(result.soundtrack.topArtistPlays, 2);
  assert.equal(result.soundtrack.journeyMatchPercent, 67);
  assert.deepEqual(result.soundtrack.artworkUrls, ['https://example.com/b.jpg', 'https://example.com/a.jpg']);
});

test('Atlas shows the first Route DNA signal while keeping multi-journey conclusions in learning state', () => {
  const only = journey({ id: 'only', startedAt: '2026-09-03T08:00:00-05:00', startingLocation: 'Unknown start', endingLocation: 'Work' });
  const result = buildAtlasInsights([only], [detail(only, cells([0, 1, 2]))], '30d', now);

  assert.equal(result.routeDna.ready, true);
  assert.equal(result.routeDna.established, false);
  assert.equal(result.drivingRhythms.ready, false);
  assert.equal(result.exploration.ready, false);
  assert.equal(result.exploration.score, null);
  assert.equal(result.placeRelationships.ready, false);
  assert.equal(result.soundtrack.ready, false);
  assert.equal(result.soundtrack.journeyMatchPercent, 0);
});

test('Route DNA fills from the first journey and combines both directions of the same corridor', () => {
  const outbound = journey({ id: 'outbound', startedAt: '2026-09-03T08:00:00-05:00', startingLocation: 'Home', endingLocation: 'Work', durationMinutes: 30, miles: 10 });
  const firstSignal = buildAtlasInsights([outbound], [detail(outbound, cells([0, 1, 2]))], '30d', now).routeDna;

  assert.equal(firstSignal.ready, true);
  assert.equal(firstSignal.established, false);
  assert.equal(firstSignal.trips, 1);
  assert.equal(firstSignal.startLabel, 'Home');
  assert.equal(firstSignal.endLabel, 'Work');
  assert.equal(firstSignal.route.length, 3);

  const inbound = journey({ id: 'inbound', startedAt: '2026-09-03T17:00:00-05:00', startingLocation: 'Work', endingLocation: 'Home', durationMinutes: 40, miles: 12 });
  const corridor = buildAtlasInsights([outbound, inbound], [detail(outbound, cells([0, 1, 2])), detail(inbound, cells([2, 1, 0]))], '30d', now).routeDna;

  assert.equal(corridor.ready, true);
  assert.equal(corridor.established, true);
  assert.equal(corridor.bidirectional, true);
  assert.equal(corridor.trips, 2);
  assert.equal(corridor.averageMinutes, 35);
  assert.equal(corridor.startLabel, 'Work');
  assert.equal(corridor.endLabel, 'Home');
});

test('Route DNA uses truthful generic endpoints when the latest journey is not named yet', () => {
  const unnamed = journey({ id: 'unnamed', startedAt: '2026-09-03T08:00:00-05:00', startingLocation: 'Unknown start', endingLocation: 'Your destination', durationMinutes: 18, miles: 5 });
  const result = buildAtlasInsights([unnamed], [detail(unnamed, cells([0, 1, 2]))], '30d', now).routeDna;

  assert.equal(result.ready, true);
  assert.equal(result.established, false);
  assert.equal(result.startLabel, 'Recorded start');
  assert.equal(result.endLabel, 'Recorded destination');
  assert.equal(result.trips, 1);
});

test('Atlas all-time mode includes older journeys without manufacturing unavailable route data', () => {
  const recent = journey({ id: 'recent', startedAt: '2026-09-03T08:00:00-05:00', startingLocation: 'Home', endingLocation: 'Work', miles: 4 });
  const old = journey({ id: 'old', startedAt: '2025-01-03T08:00:00-06:00', startingLocation: 'Home', endingLocation: 'Work', miles: 8 });

  const limited = buildAtlasInsights([recent, old], [], '30d', now);
  const complete = buildAtlasInsights([recent, old], [], 'all', now);

  assert.equal(limited.journeyCount, 1);
  assert.equal(complete.journeyCount, 2);
  assert.equal(complete.miles, 12);
  assert.equal(complete.routeDna.ready, true);
  assert.deepEqual(complete.routeDna.route, []);
  assert.equal(complete.exploration.ready, false);
  assert.equal(complete.exploration.score, null);
});

test('Atlas ignores Home-to-Home and Work-to-Work journeys but keeps either anchor at one endpoint', () => {
  const homeLoop = journey({ id: 'home-loop', startedAt: '2026-09-03T08:00:00-05:00', startingLocation: 'Home', endingLocation: 'Home', miles: 20 });
  const workLoop = journey({ id: 'work-loop', startedAt: '2026-09-03T09:00:00-05:00', startingLocation: 'Work', endingLocation: 'Work', miles: 12 });
  const outbound = journey({ id: 'outbound', startedAt: '2026-09-03T10:00:00-05:00', startingLocation: 'Home', endingLocation: 'Cafe', miles: 4 });
  const inbound = journey({ id: 'inbound', startedAt: '2026-09-03T11:00:00-05:00', startingLocation: 'Gym', endingLocation: 'Work', miles: 6 });

  const result = buildAtlasInsights([homeLoop, workLoop, outbound, inbound], [], '30d', now);

  assert.equal(result.journeyCount, 2);
  assert.equal(result.miles, 10);
  assert.deepEqual(result.placeRelationships.connections.map(connection => `${connection.startLabel} → ${connection.endLabel}`), ['Gym → Work', 'Home → Cafe']);
});
