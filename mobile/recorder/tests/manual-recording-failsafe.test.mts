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

test('finishes a forgotten manual journey after fifteen minutes without driving', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: [point(0, 32.7555, 0), point(15, 32.7555, 0)],
    evaluatedAtMs: startedAtMs + MANUAL_RECORDING_INACTIVITY_LIMIT_MS,
  });
  assert.equal(decision.shouldFinish, true);
  assert.equal(decision.reason, 'stationary_timeout');
});

test('meaningful movement resets the inactivity clock', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: [point(0, 32.7555, 0), point(10, 32.8055, 8), point(24, 32.8055, 0)],
    evaluatedAtMs: startedAtMs + 24 * 60_000,
  });
  assert.equal(decision.shouldFinish, false);
  assert.equal(decision.inactiveForMs, 14 * 60_000);
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
      point(10, 32.7715, 1.4),
      point(16, 32.7755, 1.4),
    ],
    evaluatedAtMs: startedAtMs + 16 * 60_000,
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

test('poor GPS fixes cannot falsely reset the inactivity clock', () => {
  const decision = evaluateManualRecordingFailsafe({
    session: session(),
    route: [point(0, 32.7555, 0), point(29, 33.7555, 30, 500)],
    evaluatedAtMs: startedAtMs + MANUAL_RECORDING_INACTIVITY_LIMIT_MS,
  });
  assert.equal(decision.shouldFinish, true);
  assert.equal(decision.reason, 'stationary_timeout');
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
