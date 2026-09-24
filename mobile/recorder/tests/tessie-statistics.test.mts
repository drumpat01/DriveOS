import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTessieStatistics, type TessieStatisticsDrive, type TessieStatisticsCharge } from '../src/tessie-statistics-model.ts';

const range = { startInclusive: '2026-09-01T00:00:00.000Z', endExclusive: '2026-10-01T00:00:00.000Z' };
const drive = (journeyId: string, startedAt: string, overrides: Partial<TessieStatisticsDrive> = {}): TessieStatisticsDrive => ({
  journeyId, sourceDriveId: journeyId, vehicleKey: 'vehicle-one', vehicleName: 'Car', startedAt,
  endedAt: Number.isFinite(Date.parse(startedAt)) ? new Date(Date.parse(startedAt) + 30 * 60_000).toISOString() : startedAt,
  miles: 20, energyUsedKwh: 5,
  startingLocation: ' Home ', endingLocation: ' Office ', startingBatteryPercent: 80, endingBatteryPercent: 70,
  ...overrides,
});
const charge = (id: string, startedAt: string, overrides: Partial<TessieStatisticsCharge> = {}): TessieStatisticsCharge => ({
  id, journeyId: 'first', startedAt, endedAt: new Date(Date.parse(startedAt) + 20 * 60_000).toISOString(),
  location: 'Supercharger', energyAddedKwh: 12, arrivalBatteryPercent: 20, departureBatteryPercent: 40,
  ...overrides,
});

test('weighted driving efficiency and repeated routes use each imported journey once', () => {
  const first = drive('first', '2026-09-05T12:00:00.000Z');
  const second = drive('second', '2026-09-06T12:00:00.000Z', { miles: 10, energyUsedKwh: 4,
    startingLocation: 'home', endingLocation: 'office' });
  const result = buildTessieStatistics(range, [first, first, second,
    drive('other-car', '2026-09-07T12:00:00.000Z', { vehicleKey: 'vehicle-two' })], []);
  assert.equal(result.drivingEfficiency.journeys, 3);
  assert.equal(result.drivingEfficiency.whPerMile, 14_000 / 50);
  assert.equal(result.drivingEfficiency.energyUsedKwh, 14);
  assert.equal(result.repeatedRoutes.length, 1);
  assert.deepEqual(result.repeatedRoutes[0]?.journeyIds, ['second', 'first']);
  assert.equal(result.repeatedRoutes[0]?.averageWhPerMile, 300);
  assert.equal(result.repeatedRoutes[0]?.bestWhPerMile, 250);
  assert.equal(result.repeatedRoutes[0]?.worstWhPerMile, 400);
});

test('replayed source IDs and substantially overlapping drives do not add energy twice', () => {
  const first = drive('first', '2026-09-05T12:00:00.000Z');
  const replay = drive('replay', '2026-09-05T12:00:00.000Z', { sourceDriveId: 'first' });
  const partial = drive('partial', '2026-09-05T12:05:00.000Z', { miles: 9, energyUsedKwh: 2 });
  const result = buildTessieStatistics(range, [first, replay, partial], []);
  assert.equal(result.drivingEfficiency.journeys, 1);
  assert.equal(result.drivingEfficiency.energyUsedKwh, 5);
});

test('missing energy stays null while measured zero remains zero', () => {
  const missing = drive('missing', '2026-09-05T12:00:00.000Z', { energyUsedKwh: null });
  const zero = drive('zero', '2026-09-06T12:00:00.000Z', { energyUsedKwh: 0 });
  const stationary = drive('stationary', '2026-09-07T12:00:00.000Z', { miles: 0, energyUsedKwh: 2 });
  const result = buildTessieStatistics(range, [missing, zero, stationary], []);
  assert.equal(result.energyByJourney.find(row => row.journeyId === 'missing')?.whPerMile, null);
  assert.equal(result.energyByJourney.find(row => row.journeyId === 'zero')?.whPerMile, 0);
  assert.equal(result.energyByJourney.find(row => row.journeyId === 'stationary')?.whPerMile, null);
  assert.equal(result.drivingEfficiency.measuredJourneys, 1);
  assert.equal(result.drivingEfficiency.energyUsedKwh, 0);
  assert.equal(result.drivingEfficiency.whPerMile, 0);
  assert.equal(buildTessieStatistics(range, [missing], []).drivingEfficiency.energyUsedKwh, null);
});

test('road charging counts unique sessions by charge start, even when the preceding drive is outside the range', () => {
  const inside = charge('one', '2026-09-01T00:00:00.000Z');
  const missing = charge('two', '2026-09-10T00:00:00.000Z', { energyAddedKwh: null, arrivalBatteryPercent: null });
  const result = buildTessieStatistics(range, [], [inside, inside, missing,
    charge('before', '2026-08-31T23:59:59.000Z'), charge('after', range.endExclusive)]);
  assert.equal(result.chargingOnRoad.sessions, 2);
  assert.equal(result.chargingOnRoad.measuredSessions, 1);
  assert.equal(result.chargingOnRoad.energyAddedKwh, 12);
  assert.equal(result.chargingOnRoad.durationMinutes, 40);
  assert.equal(result.chargingOnRoad.charges.find(row => row.id === 'two')?.batteryGainedPercent, null);
  assert.equal(result.chargingOnRoad.charges.find(row => row.id === 'one')?.batteryGainedPercent, 20);
  assert.equal(buildTessieStatistics(range, [], [missing]).chargingOnRoad.energyAddedKwh, null);
});

test('invalid source rows and ranges cannot enter calculations', () => {
  const good = drive('good', '2026-09-05T12:00:00.000Z');
  const result = buildTessieStatistics(range, [good,
    drive('before', '2026-08-31T12:00:00.000Z'), drive('after', range.endExclusive),
    drive('negative', '2026-09-05T12:00:00.000Z', { miles: -1 }),
    drive('bad-time', 'invalid'), drive('bad-energy', '2026-09-05T12:00:00.000Z', { energyUsedKwh: Number.NaN }),
  ], [charge('bad', '2026-09-05T12:00:00.000Z', { energyAddedKwh: -1 })]);
  assert.equal(result.drivingEfficiency.journeys, 1);
  assert.equal(result.chargingOnRoad.sessions, 0);
  assert.throws(() => buildTessieStatistics({ startInclusive: range.endExclusive, endExclusive: range.startInclusive }, [], []), /date range/);
});
