import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePrivatePlace, privatePlaceValue, tryParsePrivatePlace } from '../src/private-place-record.ts';

const validPlace = {
  id: 'saved-place-v1-home-driver',
  userId: 'driver',
  kind: 'home' as const,
  label: 'Home',
  lat: 32.8,
  lng: -97.3,
  radiusMeters: 300,
  foursquareId: null,
  osmId: null,
  cachedUntil: null,
  createdAt: '2026-10-05T00:00:00Z',
  updatedAt: '2026-10-05T00:00:00Z',
};

function captureWarnings<T>(run: () => T): { result: T; warnings: unknown[][] } {
  const warnings: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    return { result: run(), warnings };
  } finally {
    console.warn = warn;
  }
}

test('valid private place payloads still round-trip', () => {
  const encoded = privatePlaceValue(validPlace);
  const { result, warnings } = captureWarnings(() => tryParsePrivatePlace(JSON.stringify(encoded)));
  assert.deepEqual(result, encoded);
  assert.equal(warnings.length, 0);
  assert.deepEqual(parsePrivatePlace(JSON.stringify(encoded)), encoded);
});

test('corrupt JSON is skipped and logged without leaking coordinates', () => {
  const { result, warnings } = captureWarnings(() => tryParsePrivatePlace('{bad, lat: 32.8, lng: -97.3}'));
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], 'Skipped a corrupt private place backup row');
  assert.deepEqual(warnings[0][1], { reason: 'invalid-json' });
  assert.equal(JSON.stringify(warnings).includes('32.8'), false);
  assert.equal(JSON.stringify(warnings).includes('-97.3'), false);
  assert.throws(() => parsePrivatePlace('{bad'), /incomplete/);
});

test('well-formed JSON with an invalid place shape is skipped and logged', () => {
  const cases = [
    { id: '', kind: 'home', label: 'Home', lat: 32.8, lng: -97.3, radiusMeters: 300 },
    { id: 'home-1', kind: 'school', label: 'Home', lat: 32.8, lng: -97.3, radiusMeters: 300 },
    { id: 'home-1', kind: 'home', label: '  ', lat: 32.8, lng: -97.3, radiusMeters: 300 },
    { id: 'home-1', kind: 'home', label: 'Home', lat: 91, lng: -97.3, radiusMeters: 300 },
    { id: 'home-1', kind: 'home', label: 'Home', lat: 32.8, lng: -181, radiusMeters: 300 },
    { id: 'home-1', kind: 'home', label: 'Home', lat: 32.8, lng: -97.3, radiusMeters: 0 },
    { id: 'home-1', kind: 'home', label: 'Home', lat: Number.NaN, lng: -97.3, radiusMeters: 300 },
    { id: 'home-1', kind: 'home', label: 'Home', lat: 32.8, lng: -97.3, radiusMeters: 300, foursquareId: 12 },
  ];
  for (const payload of cases) {
    const { result, warnings } = captureWarnings(() => tryParsePrivatePlace(JSON.stringify(payload)));
    assert.equal(result, null, JSON.stringify(payload));
    assert.equal(warnings.length, 1, JSON.stringify(payload));
    assert.equal(warnings[0][0], 'Skipped a corrupt private place backup row');
    assert.deepEqual(warnings[0][1], { reason: 'invalid-shape' });
    assert.equal(JSON.stringify(warnings).includes('32.8'), false);
    assert.equal(JSON.stringify(warnings).includes('-97.3'), false);
    assert.throws(() => parsePrivatePlace(JSON.stringify(payload)), /incomplete/);
  }
});

test('parsePrivatePlace does not log when it throws for a caller that wants the strict error', () => {
  const { warnings } = captureWarnings(() => {
    assert.throws(() => parsePrivatePlace('{"id":"home-1"}'), /incomplete/);
  });
  assert.equal(warnings.length, 0);
});
