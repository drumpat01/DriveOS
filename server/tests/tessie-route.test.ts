import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTessieRouteCoordinates } from '../src/tessie-route.js';

test('Tessie historical states are requested privately and normalized into timestamped route coordinates', async () => {
  let requestedUrl: URL | null = null;
  let authorization = '';
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = new URL(String(input));
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    return Response.json({ results: [
      { timestamp: 1_000, latitude: 32.8, longitude: -97.4, speed: 42, heading: 275, battery_level: 71 },
      { timestamp: 1_001, latitude: 'invalid', longitude: -97.3 },
      { timestamp: 1_002, latitude: 32.9, longitude: -97.2 },
    ] });
  };

  const result = await loadTessieRouteCoordinates({ vin: 'VIN TEST/1', startedAtEpoch: 1_000, endedAtEpoch: 1_100 }, 'private-token', fetchImpl);
  assert.equal(requestedUrl?.pathname, '/VIN%20TEST%2F1/states');
  assert.equal(requestedUrl?.searchParams.get('from'), '940');
  assert.equal(requestedUrl?.searchParams.get('to'), '1160');
  assert.equal(requestedUrl?.searchParams.get('interval'), '1');
  assert.equal(authorization, 'Bearer private-token');
  assert.deepEqual(result, [
    { recordedAtEpochMs: 1_000_000, coordinate: [-97.4, 32.8], speedMph: 42, headingDegrees: 275, batteryPercent: 71 },
    { recordedAtEpochMs: 1_002_000, coordinate: [-97.2, 32.9], speedMph: null, headingDegrees: null, batteryPercent: null },
  ]);
});

test('invalid journeys do not make a Tessie request', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => { calls += 1; return Response.json({ results: [] }); };
  assert.deepEqual(await loadTessieRouteCoordinates({ vin: '', startedAtEpoch: 1_000, endedAtEpoch: 900 }, 'token', fetchImpl), []);
  assert.equal(calls, 0);
});
