import assert from 'node:assert/strict';
import test from 'node:test';
import { stateForPoint, summarizeRoads, tripName, type PlacedPhoto } from '../src/roads-so-far-model.ts';

test('photo coordinates land in the same state shapes the 50 States map draws', () => {
  const cities: [string, number, number, string][] = [
    ['Denver', 39.7392, -104.9903, 'CO'], ['Austin', 30.2672, -97.7431, 'TX'], ['Charlotte', 35.2271, -80.8431, 'NC'],
    ['New York', 40.7128, -74.006, 'NY'], ['Los Angeles', 34.0522, -118.2437, 'CA'], ['Seattle', 47.6062, -122.3321, 'WA'],
    ['Miami', 25.7617, -80.1918, 'FL'], ['Chicago', 41.8781, -87.6298, 'IL'], ['Boston', 42.3601, -71.0589, 'MA'],
    ['Salt Lake City', 40.7608, -111.891, 'UT'], ['Anchorage', 61.2181, -149.9003, 'AK'], ['Honolulu', 21.3069, -157.8583, 'HI'],
    ['Asheville', 35.5951, -82.5515, 'NC'], ['Las Vegas', 36.1699, -115.1398, 'NV'], ['Phoenix', 33.4484, -112.074, 'AZ'],
  ];
  for (const [name, lat, lon, code] of cities) assert.equal(stateForPoint(lat, lon), code, name);
  assert.equal(stateForPoint(51.5072, -0.1276), null, 'London is outside the 50 states');
  assert.equal(stateForPoint(35, -40), null, 'the Atlantic is outside the 50 states');
});

test('road trips are runs of days away from home, named by their states', () => {
  const day = 86_400_000, start = Date.UTC(2025, 5, 1, 18);
  const photos: PlacedPhoto[] = [];
  // Home in Charlotte: many photos.
  for (let i = 0; i < 30; i++) photos.push({ id: `home-${i}`, takenAtMs: start - 40 * day + i * day, latitude: 35.2271, longitude: -80.8431 });
  // A three-day trip: Asheville then Knoxville.
  for (let i = 0; i < 4; i++) photos.push({ id: `a-${i}`, takenAtMs: start + i * 3600_000, latitude: 35.5951, longitude: -82.5515 });
  for (let i = 0; i < 4; i++) photos.push({ id: `k-${i}`, takenAtMs: start + 2 * day + i * 3600_000, latitude: 35.9606, longitude: -83.9207 });
  // Two stray photos far away: too few for a trip.
  photos.push({ id: 'x-1', takenAtMs: start + 60 * day, latitude: 40.7128, longitude: -74.006 });
  photos.push({ id: 'x-2', takenAtMs: start + 60 * day + 60_000, latitude: 40.7128, longitude: -74.006 });
  const roads = summarizeRoads(photos, 0);
  assert.deepEqual(roads.states, ['NC', 'NY', 'TN']);
  assert.equal(roads.trips.length, 1);
  assert.equal(roads.trips[0]!.name, 'North Carolina & Tennessee');
  assert.equal(roads.trips[0]!.photoIds.length, 8);
  assert.ok(roads.places >= 4);
});

test('trip names stay short', () => {
  assert.equal(tripName([]), 'Road trip');
  assert.equal(tripName(['CA']), 'California road trip');
  assert.equal(tripName(['CA', 'NV', 'UT', 'AZ']), 'California, Nevada & 2 more');
});
