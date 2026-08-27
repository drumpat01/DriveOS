import assert from 'node:assert/strict';
import test from 'node:test';
import { cityGridCoordinate, nearestRecordedCoordinate, summarizeCitySongs } from '../src/city-summary.ts';

test('city grid removes neighborhood-level precision before transmission', () => {
  assert.deepEqual(cityGridCoordinate([-97.330812, 32.755521]), {
    key: '32.76,-97.33', latitude: '32.76', longitude: '-97.33',
  });
  assert.equal(cityGridCoordinate([181, 32]), null);
});

test('song locations use the nearest recorded route point', () => {
  const samples = [
    { recordedAt: '2026-08-27T12:00:00.000Z', coordinate: [-97.4, 32.7] as [number, number] },
    { recordedAt: '2026-08-27T12:05:00.000Z', coordinate: [-97.3, 32.8] as [number, number] },
  ];
  assert.deepEqual(nearestRecordedCoordinate(samples, '2026-08-27T12:04:30.000Z'), [-97.3, 32.8]);
});

test('city song totals combine grid cells that resolve to the same city', () => {
  const labels = { '32.76,-97.33': 'Fort Worth, Texas', '32.75,-97.34': 'Fort Worth, Texas', '32.74,-97.11': 'Arlington, Texas' };
  assert.deepEqual(summarizeCitySongs([
    { coordinate: [-97.3308, 32.7555], songs: 3 },
    { coordinate: [-97.3401, 32.7501], songs: 2 },
    { coordinate: [-97.1101, 32.7401], songs: 1 },
  ], labels), [
    { label: 'Fort Worth, Texas', songs: 5 },
    { label: 'Arlington, Texas', songs: 1 },
  ]);
});
