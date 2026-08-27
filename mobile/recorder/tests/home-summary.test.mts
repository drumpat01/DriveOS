import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHomeSummary } from '../src/home-summary.ts';

test('Home summarizes the already-built local sections without a network model', () => {
  const data = {
    journeys: [
      { id: 'j1', startingLocation: 'Home', endingLocation: 'Work', startingLocationKey: 'home', endingLocationKey: 'work', miles: 10, durationMinutes: 20, startedAt: '2026-08-26T12:00:00Z', soundtrackPreview: [{ playedAt: null, track: 'First Date', artist: 'blink-182', album: null, artworkUrl: null }] },
      { id: 'j2', startingLocation: 'Home', endingLocation: 'Work', startingLocationKey: 'home', endingLocationKey: 'work', miles: 12, durationMinutes: 22, startedAt: '2026-08-25T12:00:00Z', soundtrackPreview: [{ playedAt: null, track: 'First Date', artist: 'blink-182', album: null, artworkUrl: null }] },
    ],
    details: [],
    memories: { memories: [{ id: 'm1', name: 'Summer roads', collectionIds: ['c1'], photos: [], updatedAtUtc: '2026-08-26T12:00:00Z' }], collections: [{ id: 'c1', driveIds: ['j1', 'j2'] }] },
    vehicle: { places: [{ id: 'p1', name: 'Work', visitCount: 5, lastSeenAt: '2026-08-26T12:00:00Z' }], chargingSummary30Days: { sessions: 3, energyAddedKwh: 42, cost: 6.5 } },
    statistics: { score: 87 }, timeline: [{ items: [{}, {}] }],
  };
  const summary = buildHomeSummary(data as never);
  assert.deepEqual(summary.archive, { journeys: 2, collections: 1, memories: 1, places: 1 });
  assert.equal(summary.memorySpotlight?.journeys, 2);
  assert.equal(summary.topTrack?.plays, 2);
  assert.equal(summary.favoriteRoute?.count, 2);
  assert.equal(summary.topPlace?.name, 'Work');
  assert.equal(summary.timelineEvents, 2);
});
