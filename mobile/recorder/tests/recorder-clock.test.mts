import assert from 'node:assert/strict';
import test from 'node:test';
import { recorderClockRunning, recorderDurationLabel, updateRecorderClock } from '../src/recorder-clock.ts';

const start = Date.parse('2026-09-12T12:00:00Z');
const session = { id: 'native_recording_manual_a', startedAt: new Date(start).toISOString(), endedAt: null, status: 'recording' };

test('confirmed recording ticks each second and caps a hung/failed status refresh', () => {
  const clock = updateRecorderClock(null, session, true, start + 60_000);
  assert.equal(recorderDurationLabel(session, clock, start + 61_000), '00:01:01');
  assert.equal(recorderDurationLabel(session, clock, start + 3600_000), '00:01:10');
  assert.equal(recorderClockRunning(clock, start + 3600_000), false);
});

test('native stop with a stale recording mirror freezes without declaring the route saved', () => {
  const clock = updateRecorderClock(null, session, true, start + 60_000);
  const stopped = updateRecorderClock(clock, session, false, start + 65_000);
  assert.equal(recorderDurationLabel(session, stopped, start + 600_000), '00:01:05');
  assert.equal(recorderClockRunning(stopped, start + 66_000), false);
  assert.equal(session.status, 'recording');
});

test('pause stays frozen across polls; completion uses the stored end timestamp', () => {
  const clock = updateRecorderClock(null, session, true, start + 60_000);
  const paused = { ...session, status: 'paused' };
  const frozen = updateRecorderClock(clock, paused, false, start + 65_000);
  const next = updateRecorderClock(frozen, paused, false, start + 90_000);
  assert.equal(recorderDurationLabel(paused, next, start + 600_000), '00:01:05');
  const completed = { ...session, status: 'finishing', endedAt: new Date(start + 63_000).toISOString() };
  assert.equal(recorderDurationLabel(completed, next, start + 600_000), '00:01:03');
  assert.equal(updateRecorderClock(next, null, false, start + 600_000), null);
});

test('relaunch while paused uses the last point and a new journey never inherits the old timer', () => {
  const paused = { ...session, status: 'paused' };
  const clock = updateRecorderClock(null, paused, false, start + 600_000, new Date(start + 60_000).toISOString());
  assert.equal(recorderDurationLabel(paused, clock, start + 600_000), '00:01:00');
  const nextSession = { ...session, id: 'b', startedAt: new Date(start + 600_000).toISOString() };
  const next = updateRecorderClock(clock, nextSession, true, start + 600_000);
  assert.equal(recorderDurationLabel(nextSession, next, start + 601_000), '00:00:01');
});
