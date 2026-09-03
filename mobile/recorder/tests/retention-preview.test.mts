import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRetentionPreview, isGoogleTimelineJourney } from '../src/retention-preview.ts';

const now = new Date('2026-08-27T12:00:00.000Z');

test('recognizes only explicit Google Timeline provenance', () => {
  assert.equal(isGoogleTimelineJourney({ provider: 'google_timeline', legacyDriveId: null }), true);
  assert.equal(isGoogleTimelineJourney({ provider: null, legacyDriveId: 'google-timeline:123' }), true);
  assert.equal(isGoogleTimelineJourney({ provider: 'native_recorder', legacyDriveId: 'journey-1' }), false);
  assert.equal(isGoogleTimelineJourney({ provider: null, legacyDriveId: null }), false);
});

test('previews a conservative 30-day cleanup without removing protected content', () => {
  const preview = buildRetentionPreview({
    now,
    journeys: [
      { id: 'google-old', legacyDriveId: 'google-timeline:old', provider: 'google_timeline', startedAt: '2026-06-01T12:00:00.000Z', routePointCount: 100, matchedSongCount: 3 },
      { id: 'google-protected', legacyDriveId: 'google-timeline:protected', provider: 'google_timeline', startedAt: '2026-06-02T12:00:00.000Z', routePointCount: 50, matchedSongCount: 2 },
      { id: 'google-new', legacyDriveId: 'google-timeline:new', provider: 'google_timeline', startedAt: '2026-08-20T12:00:00.000Z', routePointCount: 25, matchedSongCount: 1 },
      { id: 'native-old', legacyDriveId: null, provider: 'native_recorder', startedAt: '2026-01-01T12:00:00.000Z', routePointCount: 200, matchedSongCount: 4 },
      { id: 'unknown-old', legacyDriveId: null, provider: null, startedAt: '2025-01-01T12:00:00.000Z', routePointCount: 10, matchedSongCount: 0 },
    ],
    protectedJourneyIds: new Set(['google-timeline:protected']),
    totalSongCount: 16,
    oldUnmatchedSpotifySongCount: 2,
    memoryCount: 4,
  });

  assert.deepEqual(preview.counts.journeys, { total: 5, kept: 4, removable: 1 });
  assert.deepEqual(preview.counts.routePoints, { total: 385, kept: 285, removable: 100 });
  assert.deepEqual(preview.counts.songs, { total: 16, kept: 11, removable: 5 });
  assert.deepEqual(preview.counts.memories, { total: 4, kept: 4, removable: 0 });
  assert.equal(preview.safeguards.nativeJourneyDeckJourneys, 1);
  assert.equal(preview.safeguards.memoryProtectedJourneys, 1);
  assert.equal(preview.safeguards.recentGoogleTimelineJourneys, 1);
  assert.equal(preview.safeguards.oldUnmatchedSpotifySongs, 2);
  assert.equal(preview.cutoffAt, '2026-07-28T12:00:00.000Z');
});

test('invalid dates and non-Google journeys fail closed and stay kept', () => {
  const preview = buildRetentionPreview({
    now,
    journeys: [
      { id: 'bad-date', legacyDriveId: 'google-timeline:bad', provider: 'google_timeline', startedAt: 'not-a-date', routePointCount: 9, matchedSongCount: 1 },
      { id: 'spotify-era', legacyDriveId: 'legacy', provider: 'spotify', startedAt: '2020-01-01T00:00:00.000Z', routePointCount: 0, matchedSongCount: 1 },
    ],
    protectedJourneyIds: new Set(),
    totalSongCount: 2,
    oldUnmatchedSpotifySongCount: 0,
    memoryCount: 0,
  });
  assert.equal(preview.counts.journeys.removable, 0);
  assert.equal(preview.counts.routePoints.removable, 0);
  assert.equal(preview.counts.songs.removable, 0);
});
