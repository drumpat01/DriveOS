import assert from 'node:assert/strict';
import test from 'node:test';

import { MAX_ROUTE_ARCHIVE_POINTS, parseRouteArchive, serializeRouteArchive } from '../src/route-archive.ts';

const points = [
  { journeyId: 'journey_1', sequence: 0, recordedAt: '2026-08-27T12:00:00.123Z', latitude: 32.7554881234567, longitude: -97.3307657654321, accuracyMeters: 4.25, altitudeMeters: 198.125, headingDegrees: 271.75, speedMps: 13.375 },
  { journeyId: 'journey_1', sequence: 1, recordedAt: '2026-08-27T12:00:01.123Z', latitude: 32.7554999999999, longitude: -97.3307000000001, accuracyMeters: null, altitudeMeters: null, headingDegrees: null, speedMps: null },
];

test('exact route archive round-trips every stored JavaScript double', () => {
  const restored = parseRouteArchive(serializeRouteArchive('journey_1', points), 'journey_1', points.length);
  assert.deepEqual(restored, points.map(({ journeyId: _, ...point }) => point));
});

test('route archive rejects identity, count, order, coordinate, and size corruption', () => {
  const valid = serializeRouteArchive('journey_1', points);
  assert.throws(() => parseRouteArchive(valid, 'journey_2', points.length), /identity or format/);
  assert.throws(() => parseRouteArchive(valid, 'journey_1', points.length + 1), /point count/);
  assert.throws(() => parseRouteArchive('{"version":1,"journeyId":"journey_1","points":[[1,"2026-08-27T12:00:00Z",32,-97,null,null,null,null],[1,"2026-08-27T12:00:01Z",32,-97,null,null,null,null]]}', 'journey_1', 2), /sequence/);
  assert.throws(() => parseRouteArchive('{"version":1,"journeyId":"journey_1","points":[[0,"2026-08-27T12:00:00Z",132,-97,null,null,null,null]]}', 'journey_1', 1), /coordinate/);
  assert.throws(() => parseRouteArchive(JSON.stringify({ version: 1, journeyId: 'journey_1', points: Array(MAX_ROUTE_ARCHIVE_POINTS + 1).fill([0, '2026-08-27T12:00:00Z', 32, -97, null, null, null, null]) }), 'journey_1', MAX_ROUTE_ARCHIVE_POINTS + 1), /point count/);
});
