import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import { planTessieJourneys, tessieJourneyId } from '../src/tessie-journey-plan.ts';
import type { TessieDriveSnapshot, TessieSnapshot } from '../src/tessie-contract.ts';

const require = createRequire(import.meta.url), ts = require('typescript');
const directory = fileURLToPath(new URL('../src/', import.meta.url));
function loadPure(path: string): any {
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Map, Math, Error, require: (id: string) => loadPure(resolve(dirname(path), `${id}.ts`)) });
  return exports;
}
const { fetchTessieSnapshotAdaptive } = loadPure(resolve(directory, 'tessie-window-sync.ts'));
const at = (minute: number) => new Date(Date.parse('2026-09-21T12:00:00.000Z') + minute * 60_000).toISOString();
const vehicleKey = 'a'.repeat(32);
const drive = (id: string, start: number, end: number, vehicle = vehicleKey): TessieDriveSnapshot => ({
  id, vehicleKey: vehicle, vehicleName: 'Test Tesla', startedAt: at(start), endedAt: at(end),
  startingLocation: 'Origin', endingLocation: 'Destination', miles: 20, energyUsedKwh: 5,
  startingBatteryPercent: 80, endingBatteryPercent: 70,
});
const charge = (id: string, start: number, end: number, vehicle = vehicleKey) => ({
  id, locationKey: 'c'.repeat(32), location: 'Supercharger', vehicleKey: vehicle, vehicleName: 'Test Tesla',
  startedAt: at(start), endedAt: at(end), isSupercharger: true, energyAddedKwh: 28, energyUsedKwh: 30,
  milesAdded: 110, startingBatteryPercent: 69, endingBatteryPercent: 90, recordedCost: null,
});
const snapshot = (drives: TessieDriveSnapshot[], charges: ReturnType<typeof charge>[]): TessieSnapshot => ({
  generatedAt: at(180), vehicles: [], drives, charges,
});

test('deduplicates partial drives and matches a between-drive Supercharger to the preceding vehicle journey', () => {
  const first = drive('1'.repeat(32), 0, 30), partial = drive('2'.repeat(32), 2, 20);
  const next = drive('3'.repeat(32), 65, 95), other = drive('4'.repeat(32), 0, 25, 'b'.repeat(32));
  const plans = planTessieJourneys(snapshot([next, partial, first, first, other], [
    charge('5'.repeat(32), 32, 60), charge('5'.repeat(32), 32, 60),
    charge('6'.repeat(32), 31, 40, 'b'.repeat(32)), charge('7'.repeat(32), 100, 115, 'c'.repeat(32)),
  ]));
  assert.equal(plans.length, 3);
  assert.equal(plans.find(plan => plan.drive.id === first.id)?.charges.length, 1);
  assert.equal(plans.find(plan => plan.drive.id === other.id)?.charges.length, 1);
  assert.equal(plans.find(plan => plan.drive.id === next.id)?.charges.length, 0);
  assert.equal(plans.some(plan => plan.drive.id === partial.id), false);
});

test('ambiguous charging that overlaps the next drive is not attached', () => {
  const first = drive('8'.repeat(32), 0, 30), next = drive('9'.repeat(32), 50, 70);
  const plans = planTessieJourneys(snapshot([first, next], [charge('a'.repeat(32), 32, 58)]));
  assert.equal(plans.reduce((total, plan) => total + plan.charges.length, 0), 0);
});

test('saturated history splits into shorter windows and deduplicates boundary rows', async () => {
  let calls = 0;
  const d = drive('b'.repeat(32), 0, 30), c = charge('c'.repeat(32), 32, 60);
  const payload = { generatedAt: at(180), vehicles: [{ vehicleKey, name: 'Test Tesla', status: 'online', batteryPercent: 80,
    rangeMiles: 200, chargingState: null, odometerMiles: 1000, updatedAt: at(180) }], drives: [d], charges: [c] };
  const result = await fetchTessieSnapshotAdaptive(new Date(at(0)), new Date(at(180)), async (from, to) => {
    calls++;
    if (Date.parse(to) - Date.parse(from) > 60 * 60_000) throw new Error('Tessie history window is too large; retry a shorter window');
    return payload;
  });
  assert.ok(calls > 1);
  assert.equal(result.drives.length, 1);
  assert.equal(result.charges.length, 1);
  await assert.rejects(() => fetchTessieSnapshotAdaptive(new Date(at(0)), new Date(at(180)), async () => {
    throw new Error('Tessie access was not authorized');
  }), /not authorized/);
  let saturatedCalls = 0;
  await assert.rejects(() => fetchTessieSnapshotAdaptive(new Date(at(0)), new Date(Date.parse(at(0)) + 30 * 24 * 60 * 60_000), async (from, to) => {
    saturatedCalls++;
    if (Date.parse(to) - Date.parse(from) > 6 * 60 * 60_000) throw new Error('Tessie history window is too large; retry a shorter window');
    return payload;
  }), /too many windows/);
  assert.equal(saturatedCalls, 32);
});

function fixture() {
  const database = new DatabaseSync(':memory:');
  const db = {
    execSync: (sql: string) => database.exec(sql),
    runSync: (sql: string, ...args: any[]) => database.prepare(sql).run(...args),
    getFirstSync: (sql: string, ...args: any[]) => database.prepare(sql).get(...args) ?? null,
    getAllSync: (sql: string, ...args: any[]) => database.prepare(sql).all(...args),
    withTransactionSync(work: () => void) { database.exec('BEGIN IMMEDIATE'); try { work(); database.exec('COMMIT'); } catch (error) { database.exec('ROLLBACK'); throw error; } },
  };
  const loaded = new Map<string, any>();
  const overrides: Record<string, any> = {
    'expo-crypto': { randomUUID }, './database-owner': { getMasterDatabase: () => db },
    './local-archive-events': { notifyLocalArchiveChanged: () => {} },
    './auth': { getCurrentUser: () => ({ id: 'unused' }) },
  };
  function load(path: string): any {
    if (loaded.has(path)) return loaded.get(path);
    const exports: any = {}; loaded.set(path, exports);
    vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { exports, process, Date, Math, JSON, Map, Set, TextEncoder, console, require: (id: string) => id in overrides ? overrides[id] : load(resolve(dirname(path), `${id}.ts`)) });
    return exports;
  }
  const store = load(resolve(directory, 'local-store.ts'));
  store.initializeLocalStore();
  const userId = store.ensureLocalUser({ displayName: 'Driver' }).id;
  return { database, store, userId, close: () => database.close() };
}

test('persists car GPS and charge metadata once, repairs a missing route, and isolates profiles', () => {
  const f = fixture();
  try {
    const d = drive('d'.repeat(32), 0, 30), plan = { drive: d, charges: [charge('e'.repeat(32), 32, 60)] };
    const id = tessieJourneyId(f.userId, d.id);
    assert.equal(f.store.persistTessieJourney(f.userId, plan, null), 'created');
    assert.equal(f.store.getJourney(f.userId, id).provider, 'tessie');
    assert.equal(f.store.listJourneyGpsPoints(f.userId, id).length, 0);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, id)[0].latitude, null);
    assert.equal(f.store.tessieJourneyNeedsRoute(f.userId, d.id), true);
    f.store.markTessieRouteAttempt(f.userId, d.id);
    assert.equal(f.store.tessieJourneyNeedsRoute(f.userId, d.id), false);
    const route = { driveId: d.id, generatedAt: at(180), routePoints: [
      { recordedAt: at(0), latitude: 32.8, longitude: -97.4, speedMph: 25, headingDegrees: 90, batteryPercent: 80 },
      { recordedAt: at(30), latitude: 32.9, longitude: -97.3, speedMph: 0, headingDegrees: 90, batteryPercent: 70 },
    ] };
    assert.equal(f.store.persistTessieJourney(f.userId, plan, route), 'updated');
    assert.equal(f.store.listJourneyGpsPoints(f.userId, id).length, 2);
    const marker = f.store.listTessieChargeMarkers(f.userId, id)[0];
    assert.equal(marker.longitude, -97.3);
    assert.equal(marker.arrivalBatteryPercent, 69);
    assert.equal(marker.departureBatteryPercent, 90);
    assert.equal(marker.energyAddedKwh, 28);
    assert.equal((Date.parse(marker.endedAt) - Date.parse(marker.startedAt)) / 60_000, 28);
    assert.equal(f.store.getTessieDriveMetadata(f.userId, id).energyUsedKwh, 5);
    assert.equal(f.store.persistTessieJourney(f.userId, plan, route), 'unchanged');
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_journeys').get()?.n, 1);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_gps_points').get()?.n, 2);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_tessie_charge_markers').get()?.n, 1);
    const second = f.store.ensureLocalUser({ displayName: 'Other driver' }).id;
    assert.notEqual(tessieJourneyId(f.userId, d.id), tessieJourneyId(second, d.id));
    assert.equal(f.store.persistTessieJourney(second, plan, null), 'created');
    assert.equal(f.store.listTessieChargeMarkers(second, tessieJourneyId(second, d.id)).length, 1);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, id).length, 1);
    assert.throws(() => f.database.prepare(`INSERT INTO local_tessie_charge_markers(
      id,user_id,journey_id,started_at,ended_at,location,energy_added_kwh,updated_at
    ) VALUES(?,?,?,?,?,?,?,?)`).run('cross-profile', second, id, at(32), at(60), 'Wrong owner', 28, at(180)), /another profile/);
  } finally { f.close(); }
});

test('a later duplicate drive ID attaches its charge to the earlier Tessie journey', () => {
  const f = fixture();
  try {
    const partial = drive('1'.repeat(32), 2, 20);
    const full = drive('2'.repeat(32), 0, 30);
    f.store.persistTessieJourney(f.userId, { drive: partial, charges: [] }, null);
    assert.equal(f.store.persistTessieJourney(f.userId, { drive: full, charges: [charge('3'.repeat(32), 32, 60)] }, null), 'updated');
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_journeys').get()?.n, 1);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, tessieJourneyId(f.userId, partial.id)).length, 1);
    assert.equal(f.store.getJourney(f.userId, tessieJourneyId(f.userId, full.id)), null);
  } finally { f.close(); }
});

test('full drive replays enrich the durable journey and do not regress its route or charge endpoint', () => {
  const f = fixture();
  try {
    const partial = drive('1'.repeat(32), 2, 20), full = drive('2'.repeat(32), 0, 30);
    const id = tessieJourneyId(f.userId, partial.id);
    const route = (d: TessieDriveSnapshot, minutes: number[]) => ({ driveId: d.id, generatedAt: at(180), routePoints: minutes.map(m => ({
      recordedAt: at(m), latitude: 32 + m / 100, longitude: -97, speedMph: null, headingDegrees: null, batteryPercent: null,
    })) });
    const c = charge('3'.repeat(32), 32, 60);
    f.store.persistTessieJourney(f.userId, { drive: partial, charges: [] }, route(partial, [2, 20]));
    f.database.prepare('UPDATE local_journeys SET synced_to_cloud=1,route_synced_to_cloud=1 WHERE id=?').run(id);
    f.store.persistTessieJourney(f.userId, { drive: full, charges: [c] }, null);
    assert.equal(f.store.findTessieJourneyForDrive(f.userId, full).id, id);
    assert.equal(f.store.getJourney(f.userId, id).startedAt, at(0));
    assert.equal(f.store.getJourney(f.userId, id).endedAt, at(30));
    assert.equal(f.store.tessieJourneyNeedsRoute(f.userId, full.id, id), true);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, id)[0].latitude, null, 'partial route does not invent charger position');
    f.store.persistTessieJourney(f.userId, { drive: full, charges: [c] }, route(full, [0, 15, 30]));
    assert.equal(f.store.tessieJourneyNeedsRoute(f.userId, full.id, id), false);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, id)[0].latitude, 32.3);
    assert.equal(f.database.prepare('SELECT synced_to_cloud FROM local_journeys WHERE id=?').get(id)?.synced_to_cloud, 0);
    f.store.persistTessieJourney(f.userId, { drive: partial, charges: [c] }, route(partial, [2, 20]));
    assert.equal(f.store.listJourneyGpsPoints(f.userId, id).length, 3);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, id)[0].latitude, 32.3);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_journeys').get()?.n, 1);
  } finally { f.close(); }
});

test('a one-point partial car route is repaired when Tessie later has the complete route', () => {
  const f = fixture();
  try {
    const d = drive('6'.repeat(32), 0, 30), plan = { drive: d, charges: [] };
    const id = tessieJourneyId(f.userId, d.id);
    f.store.persistTessieJourney(f.userId, plan, { driveId: d.id, generatedAt: at(180), routePoints: [
      { recordedAt: at(0), latitude: 32.8, longitude: -97.4, speedMph: null, headingDegrees: null, batteryPercent: null },
    ] });
    assert.equal(f.store.tessieJourneyNeedsRoute(f.userId, d.id), true);
    assert.equal(f.store.persistTessieJourney(f.userId, plan, { driveId: d.id, generatedAt: at(180), routePoints: [
      { recordedAt: at(0), latitude: 32.8, longitude: -97.4, speedMph: null, headingDegrees: null, batteryPercent: null },
      { recordedAt: at(30), latitude: 32.9, longitude: -97.3, speedMph: null, headingDegrees: null, batteryPercent: null },
    ] }), 'updated');
    assert.equal(f.store.listJourneyGpsPoints(f.userId, id).length, 2);
    assert.equal(f.store.tessieJourneyNeedsRoute(f.userId, d.id), false);
  } finally { f.close(); }
});

test('overlapping manual journey remains untouched by a Tessie drive', () => {
  const f = fixture();
  try {
    const d = drive('f'.repeat(32), 0, 30);
    f.store.upsertJourney({ id: 'manual', userId: f.userId, legacyDriveId: null, startedAt: at(1), endedAt: at(29),
      durationMinutes: 28, miles: 18, startLat: 1, startLng: 2, endLat: 3, endLng: 4,
      startPlaceId: null, endPlaceId: null, averageSpeedMph: 35, maxSpeedMph: 50, songCount: 2,
      vehicleName: null, provider: 'native_recorder' });
    assert.equal(f.store.persistTessieJourney(f.userId, { drive: d, charges: [charge('9'.repeat(32), 32, 60)] }, null), 'overlap');
    assert.equal(f.store.getJourney(f.userId, 'manual').songCount, 2);
    assert.equal(f.store.getJourney(f.userId, tessieJourneyId(f.userId, d.id)), null);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_tessie_charge_markers').get()?.n, 0);
  } finally { f.close(); }
});

test('a short manual fragment does not suppress a longer Tessie drive', () => {
  const f = fixture();
  try {
    const d = drive('7'.repeat(32), 0, 30);
    f.store.upsertJourney({ id: 'fragment', userId: f.userId, legacyDriveId: null, startedAt: at(10), endedAt: at(15),
      durationMinutes: 5, miles: 2, startLat: null, startLng: null, endLat: null, endLng: null,
      startPlaceId: null, endPlaceId: null, averageSpeedMph: null, maxSpeedMph: null, songCount: 0,
      vehicleName: null, provider: 'native_recorder' });
    assert.equal(f.store.persistTessieJourney(f.userId, { drive: d, charges: [] }, null), 'created');
    assert.ok(f.store.getJourney(f.userId, 'fragment'));
  } finally { f.close(); }
});

test('statistics source queries keep Tessie drives and road charges separate and profile scoped', () => {
  const f = fixture();
  try {
    const d = drive('a'.repeat(32), 0, 30), c = charge('b'.repeat(32), 32, 60);
    const plan = { drive: d, charges: [c] };
    f.store.persistTessieJourney(f.userId, plan, null);
    f.store.persistTessieJourney(f.userId, plan, null);
    const other = f.store.ensureLocalUser({ displayName: 'Other' }).id;
    f.store.persistTessieJourney(other, plan, null);
    const driving = f.store.readTessieStatisticsRows(f.userId, at(0), at(31));
    assert.equal(driving.drives.length, 1);
    assert.equal(driving.drives[0].sourceDriveId, d.id);
    assert.equal(driving.drives[0].energyUsedKwh, 5);
    assert.equal(driving.charges.length, 0);
    const charging = f.store.readTessieStatisticsRows(f.userId, at(31), at(180));
    assert.equal(charging.drives.length, 0);
    assert.equal(charging.charges.length, 1);
    assert.equal(charging.charges[0].energyAddedKwh, 28);
    assert.equal(charging.charges[0].journeyId, tessieJourneyId(f.userId, d.id));
  } finally { f.close(); }
});

test('imported energy preserves unknown and observed zero across repeat syncs', () => {
  const f = fixture();
  try {
    const d = { ...drive('c'.repeat(32), 0, 30), energyUsedKwh: 0, energyUsedKnown: false };
    const c = { ...charge('d'.repeat(32), 32, 60), energyAddedKwh: 0, energyAddedKnown: false };
    f.store.persistTessieJourney(f.userId, { drive: d, charges: [c] }, null);
    const rows = () => f.store.readTessieStatisticsRows(f.userId, at(0), at(180));
    assert.equal(rows().drives[0].energyUsedKwh, null);
    assert.equal(rows().charges[0].energyAddedKwh, null);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, tessieJourneyId(f.userId, d.id))[0].energyAddedKwh, null);
    f.store.persistTessieJourney(f.userId, { drive: { ...d, energyUsedKnown: true },
      charges: [{ ...c, energyAddedKnown: true }] }, null);
    assert.equal(rows().drives[0].energyUsedKwh, 0);
    assert.equal(rows().charges[0].energyAddedKwh, 0);
    assert.equal(f.store.listTessieChargeMarkers(f.userId, tessieJourneyId(f.userId, d.id))[0].energyAddedKwh, 0);
    assert.equal(rows().drives.length, 1);
    assert.equal(rows().charges.length, 1);
  } finally { f.close(); }
});
