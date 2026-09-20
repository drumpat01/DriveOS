import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MANUAL_RECORDING_INACTIVITY_LIMIT_MS,
  MANUAL_RECORDING_MAXIMUM_DURATION_MS,
  evaluateManualRecordingFailsafe,
} from '../src/manual-recording-failsafe.ts';

const startedAtMs = Date.parse('2026-09-04T12:00:00.000Z');
const session = (overrides: Record<string, unknown> = {}) => ({
  id: 'recording_manual', status: 'recording' as const,
  startedAt: new Date(startedAtMs).toISOString(), ...overrides,
});
const point = (minutes: number, latitude: number, speedMps: number | null = null, accuracyMeters = 5) => ({
  recordedAt: new Date(startedAtMs + minutes * 60_000).toISOString(),
  latitude, longitude: -97.3308, accuracyMeters, speedMps,
});
const parked = (from: number, to: number, latitude = 32.7555) =>
  Array.from({ length: Math.round((to - from) * 2) + 1 }, (_, i) => point(from + i / 2, latitude, 0));

test('finishes a forgotten manual journey at ten minutes of observed inactivity', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: parked(0, 10),
    evaluatedAtMs: startedAtMs + MANUAL_RECORDING_INACTIVITY_LIMIT_MS,
  });
  assert.equal(decision.shouldFinish, true);
  assert.equal(decision.reason, 'stationary_timeout');
});

test('meaningful movement resets the inactivity clock', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: [...parked(0, 8), point(8.5, 32.8055, 8), ...parked(9, 17.5, 32.8055)],
    evaluatedAtMs: startedAtMs + 17.5 * 60_000,
  });
  assert.equal(decision.shouldFinish, false);
  assert.equal(decision.inactiveForMs, 9 * 60_000);
});

test('does not finish a long manual journey that is still moving', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: [point(0, 32.7555, 0), point(60, 33.0555, 20), point(180, 33.6555, 20)],
    evaluatedAtMs: startedAtMs + 180 * 60_000,
  });
  assert.equal(decision.shouldFinish, false);
});

test('ordinary walking after parking does not restart the driving clock', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: [
      point(0, 32.7555, 12),
      point(1, 32.7655, 12),
      ...Array.from({ length: 31 }, (_, i) => point(1.5 + i / 2, 32.7655 + i * 0.00035, 1.4)),
    ],
    evaluatedAtMs: startedAtMs + 16.5 * 60_000,
  });
  assert.equal(decision.shouldFinish, true);
  assert.equal(decision.reason, 'stationary_timeout');
});

test('the twenty-four-hour ceiling closes even a moving or paused recording', () => {
  for (const status of ['recording', 'paused'] as const) {
    const decision = evaluateManualRecordingFailsafe({
      session: session({ status }),
      route: [point(0, 32.7555, 10), point(1_440, 33.7555, 10)],
      evaluatedAtMs: startedAtMs + MANUAL_RECORDING_MAXIMUM_DURATION_MS,
    });
    assert.equal(decision.shouldFinish, true);
    assert.equal(decision.reason, 'maximum_duration');
  }
});

test('paused sessions do not use the inactivity timer', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session({ status: 'paused' }), route: [],
    evaluatedAtMs: startedAtMs + MANUAL_RECORDING_INACTIVITY_LIMIT_MS * 2,
  });
  assert.equal(decision.shouldFinish, false);
});

test('native and known automatic sessions are never owned by the manual failsafe', () => {
  const native = evaluateManualRecordingFailsafe({
    session: session({ id: 'native_recording_123' }), route: [],
    evaluatedAtMs: startedAtMs + MANUAL_RECORDING_MAXIMUM_DURATION_MS * 2,
  });
  const automatic = evaluateManualRecordingFailsafe({
    session: session({ id: 'recording_automatic' }), automaticSessionId: 'recording_automatic', route: [],
    evaluatedAtMs: startedAtMs + MANUAL_RECORDING_MAXIMUM_DURATION_MS * 2,
  });
  assert.equal(native.shouldFinish, false);
  assert.equal(automatic.shouldFinish, false);
});

test('poor or missing GPS is unknown, not evidence that the car has stopped', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: [...parked(0, 9), point(10, 33.7555, 30, 500)],
    evaluatedAtMs: startedAtMs + MANUAL_RECORDING_INACTIVITY_LIMIT_MS,
  });
  assert.equal(decision.shouldFinish, false);
  assert.equal(evaluateManualRecordingFailsafe({ session: session(), route: [], evaluatedAtMs: startedAtMs + 20 * 60_000 }).shouldFinish, false);
});

test('a GPS gap resets the observed inactivity interval', () => {
  assert.equal(evaluateManualRecordingFailsafe({ session: session(), route: [...parked(0, 8), ...parked(12, 20)],
    evaluatedAtMs: startedAtMs + 20 * 60_000 }).shouldFinish, false);
});

test('stationary GPS drift and stale positive speed do not keep a journey open', () => {
  const route = parked(0, 10).map((fix, i) => ({ ...fix, latitude: fix.latitude + (i % 2) * 0.00002, speedMps: 8 }));
  assert.equal(evaluateManualRecordingFailsafe({ session: session(), route, evaluatedAtMs: startedAtMs + 10 * 60_000 }).shouldFinish, true);
});

test('dense fixes from a moving car do not look stationary after accuracy subtraction', () => {
  const route = Array.from({ length: 901 }, (_, i) => point(i / 60, 32.75 + i * 0.00005, 5, 10));
  assert.equal(evaluateManualRecordingFailsafe({ session: session(), route, evaluatedAtMs: startedAtMs + 15 * 60_000 }).shouldFinish, false);
});

test('moderate GPS uncertainty can resolve over a longer baseline while parked or walking', () => {
  for (const speed of [0, 1.4]) {
    const route = Array.from({ length: 721 }, (_, second) =>
      point(second / 60, second * speed / 111_195, speed, 50));
    assert.equal(evaluateManualRecordingFailsafe({ session: session(), route,
      evaluatedAtMs: startedAtMs + 720_000 }).shouldFinish, true);
  }
});

test('background and foreground paths both enforce the same atomic failsafe', async () => {
  const sourceRoot = new URL('../', import.meta.url);
  const locationTask = await readFile(new URL('src/location-task.ts', sourceRoot), 'utf8');
  const app = await readFile(new URL('App.tsx', sourceRoot), 'utf8');
  const storage = await readFile(new URL('src/storage.ts', sourceRoot), 'utf8');
  const runtime = await readFile(new URL('src/manual-recording-failsafe-runtime.ts', sourceRoot), 'utf8');
  assert.match(locationTask, /evaluateCurrentManualRecordingFailsafe/);
  assert.match(locationTask, /finishManualRecordingForFailsafe/);
  assert.match(app, /const manualFailsafe = evaluateCurrentManualRecordingFailsafe\(\)/);
  assert.match(runtime, /claimManualSessionForFailsafeFinish/);
  assert.match(storage, /status IN \('recording','paused'\)/);
  assert.match(storage, /status<>'completed'/);
});

test('generated GPS sampling and accuracy combinations distinguish driving from walking/parking', () => {
  for (const accuracy of [5, 20, 50]) for (const interval of [1, 5, 15, 30]) for (const speed of [0, 1.4, 2.3, 5, 25]) {
    const route = Array.from({ length: Math.floor(720 / interval) + 1 }, (_, i) =>
      point(i * interval / 60, i * interval * speed / 111_195, speed, accuracy));
    assert.equal(evaluateManualRecordingFailsafe({ session: session(), route,
      evaluatedAtMs: startedAtMs + 720_000 }).shouldFinish, speed <= 1.4,
    `accuracy=${accuracy}, interval=${interval}, speed=${speed}`);
  }
});

test('driving resumed just before the deadline is not averaged away by the longer accuracy baseline', () => {
  const route = Array.from({ length: 601 }, (_, second) =>
    point(second / 60, Math.max(0, second - 590) * 15 / 111_195, second > 590 ? 15 : 0, 50));
  assert.equal(evaluateManualRecordingFailsafe({ session: session(), route,
    evaluatedAtMs: startedAtMs + 600_000 }).shouldFinish, false);
});
