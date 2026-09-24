import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { parseTessieRoute, parseTessieSnapshot } from '../src/tessie-contract.ts';
import { handleTessieRoute, handleTessieSync } from '../../../cloudflare/workers/oauth-tessie.ts';
import { opaqueKey } from '../../../cloudflare/workers/edge-policy.ts';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js') as (input: { config: Record<string, unknown> }) => { extra: { features: { tessieEnabled: boolean } } };
const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')) as { expo: Record<string, unknown> };
const ID = 'a'.repeat(32), VEHICLE = 'b'.repeat(32);
const start = '2026-09-22T18:00:00.000Z', end = '2026-09-22T18:30:00.000Z';

test('only V3 variants enable Tessie; V2 production stays closed', () => {
  const prior = process.env.APP_VARIANT;
  const priorProfile = process.env.EAS_BUILD_PROFILE;
  try {
    delete process.env.APP_VARIANT; delete process.env.EAS_BUILD_PROFILE;
    assert.equal(configure({ config: app.expo }).extra.features.tessieEnabled, false);
    process.env.APP_VARIANT = 'v2-preview';
    assert.equal(configure({ config: app.expo }).extra.features.tessieEnabled, false);
    process.env.APP_VARIANT = 'v3-preview';
    assert.equal(configure({ config: app.expo }).extra.features.tessieEnabled, true);
    process.env.APP_VARIANT = 'v3-store';
    assert.equal(configure({ config: app.expo }).extra.features.tessieEnabled, true);
  } finally {
    if (prior === undefined) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = prior;
    if (priorProfile === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = priorProfile;
  }
});

test('local vehicle, drive, charge, and route contracts keep only approved fields', () => {
  const snapshot = parseTessieSnapshot({
    generatedAt: end, accessToken: 'private-token', vin: 'SECRET-VIN',
    vehicles: [{ vehicleKey: VEHICLE, name: 'Juniper', status: 'online', batteryPercent: 75, rangeMiles: 210,
      chargingState: null, odometerMiles: 32_000, updatedAt: end, vin: 'SECRET-VIN' }],
    drives: [{ id: ID, vehicleKey: VEHICLE, vehicleName: 'Juniper', startedAt: start, endedAt: end,
      startingLocation: 'Home', endingLocation: 'Office', miles: 12, energyUsedKwh: 3,
      startingBatteryPercent: 80, endingBatteryPercent: 75, startingLatitude: 32.8 }],
    charges: [{ id: 'c'.repeat(32), locationKey: 'd'.repeat(32), location: 'Home charger', vehicleKey: VEHICLE,
      vehicleName: 'Juniper', startedAt: start, endedAt: end, isSupercharger: false, energyAddedKwh: 10,
      energyUsedKwh: 11, milesAdded: 40, startingBatteryPercent: 50, endingBatteryPercent: 75, recordedCost: null,
      latitude: 32.8 }],
  });
  assert.equal(snapshot.vehicles.length, 1);
  assert.equal(snapshot.drives.length, 1);
  assert.equal(snapshot.charges.length, 1);
  assert.doesNotMatch(JSON.stringify(snapshot), /SECRET-VIN|private-token|startingLatitude|latitude/);
  const route = parseTessieRoute({ driveId: ID, generatedAt: end, token: 'private-token', routePoints: [
    { recordedAt: start, latitude: 32.8, longitude: -97.4, speedMph: 42, headingDegrees: 275, batteryPercent: 79, vin: 'SECRET-VIN' },
  ] }, snapshot.drives[0]!);
  assert.deepEqual(route.routePoints[0], { recordedAt: start, latitude: 32.8, longitude: -97.4, speedMph: 42, headingDegrees: 275, batteryPercent: 79 });
  assert.doesNotMatch(JSON.stringify(route), /SECRET-VIN|private-token/);
  assert.throws(() => parseTessieRoute({ driveId: ID, generatedAt: end, routePoints: [
    { recordedAt: start, latitude: 91, longitude: -97.4, speedMph: null, headingDegrees: null, batteryPercent: null },
  ] }, snapshot.drives[0]!));
});

test('summary redacts a VIN used as a vehicle display name', async () => {
  const vin = '5YJ3E1EA7KF123456';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname === '/vehicles') return Response.json({ results: [{ vin, last_state: { display_name: vin } }] });
    if (url.pathname.endsWith('/charges') || url.pathname.endsWith('/drives')) return Response.json({ results: [] });
    throw new Error(`Unexpected path ${url.pathname}`);
  };
  try {
    const response = await handleTessieSync(new Request('https://edge.example/api/vehicle/tessie/sync', {
      method: 'POST', body: JSON.stringify({ accessToken: 'test-tessie-token-123456', from: new Date(Date.now() - 60_000).toISOString(), to: new Date().toISOString() }),
    }), { TESSIE_RATE_LIMITER: { limit: async () => ({ success: true }) } } as unknown as Env);
    assert.equal(response.status, 200);
    const payload = await response.json() as { vehicles: { name: string }[] };
    assert.equal(payload.vehicles[0]?.name, 'Tesla');
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(vin));
  } finally { globalThis.fetch = originalFetch; }
});

test('edge and cache distinguish absent energy from a measured zero', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname === '/vehicles') return Response.json({ results: [{ vin: '5YJ3E1EA7KF123456' }] });
    if (url.pathname.endsWith('/drives')) return Response.json({ results: [
      { id: 1, started_at: Date.parse(start) / 1000, ended_at: Date.parse(end) / 1000, odometer_distance: 10 },
      { id: 2, started_at: Date.parse(start) / 1000, ended_at: Date.parse(end) / 1000, odometer_distance: 10, energy_used: 0 },
    ] });
    if (url.pathname.endsWith('/charges')) return Response.json({ results: [
      { id: 3, started_at: Date.parse(start) / 1000, ended_at: Date.parse(end) / 1000 },
      { id: 4, started_at: Date.parse(start) / 1000, ended_at: Date.parse(end) / 1000, energy_added: 0 },
    ] });
    throw new Error(`Unexpected path ${url.pathname}`);
  };
  try {
    const response = await handleTessieSync(new Request('https://edge.example/api/vehicle/tessie/sync', {
      method: 'POST', body: JSON.stringify({ accessToken: 'test-tessie-token-123456', from: start, to: end }),
    }), { TESSIE_RATE_LIMITER: { limit: async () => ({ success: true }) } } as unknown as Env);
    assert.equal(response.status, 200);
    const snapshot = parseTessieSnapshot(await response.json());
    assert.deepEqual(snapshot.drives.map(drive => drive.energyUsedKnown), [false, true]);
    assert.deepEqual(snapshot.charges.map(charge => charge.energyAddedKnown), [false, true]);
  } finally { globalThis.fetch = originalFetch; }
});

test('edge route confirms an opaque drive and returns bounded historical states without VIN or token', async () => {
  const vin = '5YJ3E1EA7KF123456', token = 'test-tessie-token-123456';
  const vehicleKey = await opaqueKey('tessie-vehicle', vin);
  const driveId = await opaqueKey('tessie-drive', vehicleKey, '42');
  const originalFetch = globalThis.fetch;
  let statesCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${token}`);
    if (url.pathname === '/vehicles') return Response.json({ results: [{ vin }] });
    if (url.pathname.endsWith('/drives')) return Response.json({ results: [{ id: 42, started_at: Date.parse(start) / 1000, ended_at: Date.parse(end) / 1000 }] });
    if (url.pathname.endsWith('/states')) {
      statesCalls++;
      assert.equal(url.searchParams.get('interval'), '1');
      assert.equal(url.searchParams.get('condense'), 'false');
      return Response.json({ results: [
        { timestamp: Date.parse(start) / 1000 - 1, latitude: 32.7, longitude: -97.5 },
        { timestamp: Date.parse(start) / 1000, latitude: 32.8, longitude: -97.4, speed: 40, heading: 180, battery_level: 80 },
        { timestamp: Date.parse(end) / 1000, latitude: 32.9, longitude: -97.3, speed: 0 },
        { timestamp: Date.parse(end) / 1000 + 1, latitude: 33, longitude: -97.2 },
      ] });
    }
    throw new Error(`Unexpected path ${url.pathname}`);
  };
  try {
    const env = { TESSIE_RATE_LIMITER: { limit: async () => ({ success: true }) } } as unknown as Env;
    const request = (id: string) => new Request('https://edge.example/api/vehicle/tessie/route', {
      method: 'POST', body: JSON.stringify({ accessToken: token, driveId: id, startedAt: start, endedAt: end }),
    });
    const response = await handleTessieRoute(request(driveId), env);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    const payload = await response.json() as { routePoints: { recordedAt: string; latitude: number }[] };
    assert.equal(payload.routePoints.length, 2);
    assert.equal(payload.routePoints[0]?.recordedAt, start);
    assert.equal(payload.routePoints[1]?.recordedAt, end);
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(`${vin}|${token}`));
    assert.equal(statesCalls, 1);
    const unknown = await handleTessieRoute(request('f'.repeat(32)), env);
    assert.equal(unknown.status, 404);
    assert.equal(statesCalls, 1, 'unconfirmed drive never reaches historical states');
    const invalid = await handleTessieRoute(new Request('https://edge.example/api/vehicle/tessie/route', {
      method: 'POST', body: JSON.stringify({ accessToken: token, driveId, startedAt: '2026-08-01T00:00:00.000Z', endedAt: end }),
    }), env);
    assert.equal(invalid.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test('edge route caps dense historical states while retaining the final point', async () => {
  const vin = '5YJ3E1EA7KF123456', token = 'test-tessie-token-123456';
  const startedAt = new Date(Math.floor((Date.now() - 3 * 60 * 60_000) / 1_000) * 1_000).toISOString();
  const endedAt = new Date(Math.floor((Date.now() - 60 * 60_000) / 1_000) * 1_000).toISOString();
  const vehicleKey = await opaqueKey('tessie-vehicle', vin);
  const driveId = await opaqueKey('tessie-drive', vehicleKey, 'dense');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname === '/vehicles') return Response.json({ results: [{ vin }] });
    if (url.pathname.endsWith('/drives')) return Response.json({ results: [{ id: 'dense', started_at: Date.parse(startedAt) / 1_000, ended_at: Date.parse(endedAt) / 1_000 }] });
    if (url.pathname.endsWith('/states')) return Response.json({ results: Array.from({ length: 5_000 }, (_, index) => ({
      timestamp: Math.ceil(Date.parse(startedAt) / 1_000) + index, latitude: 32.8, longitude: -97.4,
    })) });
    throw new Error(`Unexpected path ${url.pathname}`);
  };
  try {
    const response = await handleTessieRoute(new Request('https://edge.example/api/vehicle/tessie/route', {
      method: 'POST', body: JSON.stringify({ accessToken: token, driveId, startedAt, endedAt }),
    }), { TESSIE_RATE_LIMITER: { limit: async () => ({ success: true }) } } as unknown as Env);
    assert.equal(response.status, 200);
    const payload = await response.json() as { routePoints: { recordedAt: string }[] };
    assert.ok(payload.routePoints.length <= 2_500);
    assert.equal(payload.routePoints.at(-1)?.recordedAt, new Date((Math.ceil(Date.parse(startedAt) / 1_000) + 4_999) * 1_000).toISOString());
  } finally { globalThis.fetch = originalFetch; }
});
