import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReplayRoute, buildSongRouteMoments, coordinateAtRecordedTime, nearbySongMoments,
  replaySnapshotAt, songAtReplayTime, travelledReplayCoordinates, type ReplayRoutePoint,
} from '../src/route-moments.ts';

test('frame samples follow recorded corners and stationary segments without cutting across them', () => {
  const points: ReplayRoutePoint[] = [
    { recordedAtEpochMs: 0, coordinate: [0, 0], headingDegrees: 350, speedMph: 10, batteryPercent: 80 },
    { recordedAtEpochMs: 50, coordinate: [1, 0], headingDegrees: 10, speedMph: 10, batteryPercent: 80 },
    { recordedAtEpochMs: 100, coordinate: [1, 1], headingDegrees: 10, speedMph: 0, batteryPercent: 80 },
    { recordedAtEpochMs: 200, coordinate: [1, 1], headingDegrees: 10, speedMph: 0, batteryPercent: 80 },
  ];
  const before = structuredClone(points);
  assert.deepEqual(replaySnapshotAt(points, 25)?.coordinate, [.5, 0]);
  assert.equal(replaySnapshotAt(points, 25)?.headingDegrees, 0, 'heading crosses north by the short turn');
  assert.deepEqual(replaySnapshotAt(points, 50)?.coordinate, [1, 0]);
  assert.deepEqual(replaySnapshotAt(points, 75)?.coordinate, [1, .5]);
  assert.deepEqual(replaySnapshotAt(points, 175)?.coordinate, [1, 1]);
  assert.deepEqual(points, before, 'presentation never rewrites saved geometry or telemetry');
});

test('frame lookup handles duplicate timestamps, empty routes and long journeys', () => {
  assert.equal(replaySnapshotAt([], 0), null);
  const point = (time: number, x: number): ReplayRoutePoint => ({ recordedAtEpochMs: time, coordinate: [x, 0], headingDegrees: 0, speedMph: 10, batteryPercent: 80 });
  const points = [point(0, 0), point(100, 1), point(100, 2), point(200, 3)];
  assert.deepEqual(replaySnapshotAt(points, 100)?.coordinate, [1, 0]);
  assert.deepEqual(replaySnapshotAt(points, 150)?.coordinate, [2.5, 0]);
  assert.deepEqual(replaySnapshotAt([points[0]], 200)?.coordinate, [0, 0]);
  const longRoute = Array.from({ length: 100_000 }, (_, i) => point(i * 1000, i / 1000));
  let reads = 0;
  const counted = new Proxy(longRoute, { get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, receiver);
  } });
  assert.ok(Math.abs(replaySnapshotAt(counted, 98_765_500)!.coordinate[0] - 98.7655) < 1e-10);
  assert.ok(reads < 30, `lookup used ${reads} point reads`);
});

test('song moments use the closest timestamped GPS breadcrumb when one is available', () => {
  const coordinate = coordinateAtRecordedTime([
    { recordedAt: '2026-08-26T12:00:00.000Z', coordinate: [-97.4, 32.8] },
    { recordedAt: '2026-08-26T12:05:00.000Z', coordinate: [-97.3, 32.9] },
  ], '2026-08-26T12:04:40.000Z');
  assert.deepEqual(coordinate, [-97.3, 32.9]);
});

test('song moments preserve exact coordinates and interpolate legacy timestamp-only tracks', () => {
  const route: [number, number][] = [[-97.4, 32.8], [-97.3, 32.9], [-97.2, 33.0]];
  const moments = buildSongRouteMoments([
    { playedAt: '2026-08-26T12:02:00.000Z', track: 'Exact', artist: 'Artist', mapCoordinate: [-97.35, 32.85] },
    { playedAt: '2026-08-26T12:05:00.000Z', track: 'Legacy', artist: 'Artist' },
  ], route, '2026-08-26T12:00:00.000Z', '2026-08-26T12:10:00.000Z');

  assert.deepEqual(moments[0]?.coordinate, [-97.35, 32.85]);
  assert.deepEqual(moments[1]?.coordinate, [-97.3, 32.9]);
});

test('Tessie songs require a nearby timed breadcrumb and never fall back to invented route progress', () => {
  const points = [
    { recordedAt: '2026-08-26T12:00:00.000Z', coordinate: [-97.4, 32.8] as [number, number] },
    { recordedAt: '2026-08-26T12:30:00.000Z', coordinate: [-97.3, 32.9] as [number, number] },
  ];
  assert.equal(coordinateAtRecordedTime(points, '2026-08-26T12:15:00.000Z', 120_000), null);
  const nearby = coordinateAtRecordedTime(points, '2026-08-26T12:29:00.000Z', 120_000);
  const moments = buildSongRouteMoments([
    { playedAt: '2026-08-26T12:15:00.000Z', track: 'No GPS', artist: 'Artist', requiresTimedCoordinate: true },
    { playedAt: '2026-08-26T12:29:00.000Z', track: 'GPS', artist: 'Artist', requiresTimedCoordinate: true, mapCoordinate: nearby },
  ], points.map(p => p.coordinate), points[0].recordedAt, points[1].recordedAt);
  assert.equal(moments.length, 1);
  assert.deepEqual(moments[0].coordinate, [-97.3, 32.9]);
});

test('tracks without usable timestamps are omitted instead of inventing a location', () => {
  assert.deepEqual(buildSongRouteMoments([
    { playedAt: null, track: 'Unknown', artist: 'Artist' },
  ], [[-97.4, 32.8], [-97.3, 32.9]], '2026-08-26T12:00:00.000Z', '2026-08-26T12:10:00.000Z'), []);
});

test('journey replay preserves telemetry and interpolates a smooth snapshot', () => {
  const route = buildReplayRoute(
    [[-97.4, 32.8], [-97.3, 32.9]],
    [
      { recordedAt: '2026-08-26T12:00:00.000Z', coordinate: [-97.4, 32.8], speedMph: 20, headingDegrees: 350, batteryPercent: 80 },
      { recordedAt: '2026-08-26T12:10:00.000Z', coordinate: [-97.3, 32.9], speedMph: 40, headingDegrees: 10, batteryPercent: 78 },
    ],
    '2026-08-26T12:00:00.000Z',
    '2026-08-26T12:10:00.000Z',
    80,
    78,
  );
  const snapshot = replaySnapshotAt(route, Date.parse('2026-08-26T12:05:00.000Z'));
  assert.deepEqual(snapshot?.coordinate, [-97.35, 32.849999999999994]);
  assert.equal(snapshot?.speedMph, 30);
  assert.equal(snapshot?.headingDegrees, 0);
  assert.equal(snapshot?.batteryPercent, 79);
  assert.equal(snapshot?.progress, 0.5);
  assert.deepEqual(travelledReplayCoordinates(route, Date.parse('2026-08-26T12:05:00.000Z')), [
    [-97.4, 32.8],
    [-97.35, 32.849999999999994],
  ]);
});

test('travelled replay route clamps cleanly to its first and last positions', () => {
  const route = buildReplayRoute(
    [[-97.4, 32.8], [-97.3, 32.9], [-97.2, 33]],
    undefined,
    '2026-08-26T12:00:00.000Z',
    '2026-08-26T12:10:00.000Z',
    null,
    null,
  );
  assert.deepEqual(travelledReplayCoordinates(route, 0), [[-97.4, 32.8]]);
  assert.deepEqual(travelledReplayCoordinates(route, Number.MAX_SAFE_INTEGER), route.map(point => point.coordinate));
});

test('coordinate-only cached routes receive a usable estimated replay timeline', () => {
  const route = buildReplayRoute(
    [[-97.4, 32.8], [-97.399, 32.801], [-97.398, 32.802]],
    undefined,
    'invalid',
    'also-invalid',
    72,
    70,
  );
  assert.equal(route.length, 3);
  assert.equal(route[0]?.recordedAtEpochMs, 0);
  assert.ok(Number.isFinite(route[1]?.speedMph));
  assert.ok(Number.isFinite(route[1]?.headingDegrees));
  assert.equal(route[2]?.batteryPercent, 70);
});

test('nearby music sorts by distance and replay resolves the current track', () => {
  const moments = buildSongRouteMoments([
    { playedAt: '2026-08-26T12:00:00.000Z', durationMs: 180_000, track: 'First', artist: 'Artist', mapCoordinate: [-97.4, 32.8] },
    { playedAt: '2026-08-26T12:05:00.000Z', durationMs: 180_000, track: 'Second', artist: 'Artist', mapCoordinate: [-97.39, 32.8] },
  ], [[-97.4, 32.8], [-97.3, 32.9]], '2026-08-26T12:00:00.000Z', '2026-08-26T12:10:00.000Z');
  assert.deepEqual(nearbySongMoments(moments, [-97.399, 32.8], 1).map(moment => moment.track), ['First', 'Second']);
  assert.equal(songAtReplayTime(moments, Date.parse('2026-08-26T12:06:00.000Z'))?.track, 'Second');
});
