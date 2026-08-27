import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReplayRoute, buildSongRouteMoments, coordinateAtRecordedTime, nearbySongMoments,
  replaySnapshotAt, songAtReplayTime,
} from '../src/route-moments.ts';

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
