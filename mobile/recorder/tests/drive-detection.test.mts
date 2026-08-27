import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DRIVE_STOP_DURATION_MS, emptyDriveDetectionState, evaluateDriveDetection,
} from '../src/drive-detection.ts';

const sample = (timestamp: number, speedMps: number | null, accuracyMeters: number | null = 10) => ({ timestamp, speedMps, accuracyMeters });
const positionedSample = (timestamp: number, speedMps: number | null, latitude: number, longitude: number) => ({
  timestamp, speedMps, accuracyMeters: 10, latitude, longitude,
});

test('does not start from a single GPS speed spike', () => {
  const result = evaluateDriveDetection(emptyDriveDetectionState(), sample(0, 20), false);
  assert.equal(result.action, 'none');
  assert.equal(result.state.candidateSamples, 1);
});

test('starts only after three driving samples spanning twenty seconds', () => {
  let state = emptyDriveDetectionState();
  let result = evaluateDriveDetection(state, sample(1_000, 8), false);
  state = result.state;
  result = evaluateDriveDetection(state, sample(11_000, 9), false);
  assert.equal(result.action, 'none');
  result = evaluateDriveDetection(result.state, sample(21_000, 10), false);
  assert.equal(result.action, 'start');
});

test('slow movement resets a possible driving start', () => {
  let result = evaluateDriveDetection(emptyDriveDetectionState(), sample(1_000, 8), false);
  result = evaluateDriveDetection(result.state, sample(11_000, 1), false);
  assert.equal(result.state.candidateSamples, 0);
  result = evaluateDriveDetection(result.state, sample(21_000, 8), false);
  assert.equal(result.state.candidateSamples, 1);
});

test('ignores speed readings with poor GPS accuracy', () => {
  const result = evaluateDriveDetection(emptyDriveDetectionState(), sample(1_000, 30, 250), false);
  assert.equal(result.action, 'none');
  assert.equal(result.state.candidateSamples, 0);
});

test('ignores speed readings without an accuracy estimate', () => {
  const result = evaluateDriveDetection(emptyDriveDetectionState(), sample(1_000, 30, null), false);
  assert.equal(result.action, 'none');
  assert.equal(result.state.candidateSamples, 0);
});

test('requires all driving samples to stay inside the two-minute window', () => {
  let result = evaluateDriveDetection(emptyDriveDetectionState(), sample(1_000, 8), false);
  result = evaluateDriveDetection(result.state, sample(101_000, 8), false);
  result = evaluateDriveDetection(result.state, sample(151_000, 8), false);
  assert.equal(result.action, 'none');
  assert.equal(result.state.candidateSamples, 1);
});

test('does not finish during an ordinary traffic-light stop', () => {
  let result = evaluateDriveDetection(emptyDriveDetectionState(), sample(1_000, 0), true);
  result = evaluateDriveDetection(result.state, sample(1_000 + DRIVE_STOP_DURATION_MS - 1, 0), true);
  assert.equal(result.action, 'none');
});

test('movement resets the parked timer', () => {
  let result = evaluateDriveDetection(emptyDriveDetectionState(), sample(1_000, 0), true);
  result = evaluateDriveDetection(result.state, sample(121_000, 8), true);
  assert.equal(result.state.stoppedSince, null);
  result = evaluateDriveDetection(result.state, sample(181_000, 0), true);
  assert.equal(result.action, 'none');
  assert.equal(result.state.stoppedSince, 181_000);
});

test('finishes after five continuously parked minutes', () => {
  let result = evaluateDriveDetection(emptyDriveDetectionState(), sample(1_000, 0), true);
  result = evaluateDriveDetection(result.state, sample(1_000 + DRIVE_STOP_DURATION_MS, 0), true);
  assert.equal(result.action, 'finish');
  assert.equal(result.state.stoppedSince, null);
});

test('finishes when iOS reports unknown speed after parking', () => {
  let result = evaluateDriveDetection(emptyDriveDetectionState(), positionedSample(1_000, -1, 32.7555, -97.3308), true);
  assert.equal(result.action, 'none');
  result = evaluateDriveDetection(result.state,
    positionedSample(1_000 + DRIVE_STOP_DURATION_MS, -1, 32.7555, -97.3308), true);
  assert.equal(result.action, 'finish');
});

test('position movement prevents an unknown speed from looking parked', () => {
  let result = evaluateDriveDetection(emptyDriveDetectionState(), positionedSample(1_000, -1, 32.7555, -97.3308), true);
  result = evaluateDriveDetection(result.state, positionedSample(61_000, -1, 32.7655, -97.3308), true);
  assert.equal(result.action, 'none');
  assert.equal(result.state.stoppedSince, null);
});
