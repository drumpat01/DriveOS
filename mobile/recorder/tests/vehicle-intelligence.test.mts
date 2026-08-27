import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const appData = fs.readFileSync(path.join(root, 'src', 'app-data.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src', 'vehicle-intelligence-screen.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'shell.tsx'), 'utf8');

test('Phase 5 is a local-first private cache with deferred preference sync', () => {
  assert.match(appData, /vehicleIntelligenceCacheKey\(userId\)/);
  assert.match(appData, /preferencesDirty: true/);
  assert.match(appData, /if \(!connection \|\| !refreshRemote\) return cached\?\.data \?\? localVehicleIntelligence\(userId\)/);
  assert.match(appData, /api\/recorder\/vehicle-intelligence\?timezoneOffsetMinutes/);
  assert.match(appData, /saveVehicleIntelligencePreferences/);
});

test('Phase 5 includes all requested vehicle, charging, place, and route surfaces', () => {
  for (const phrase of [
    'Charging history', 'Home electricity rate', 'Favorite charging locations', 'Saved places',
    'Possible duplicates', 'FOURSQUARE SUGGESTION', 'TIME OF DAY', 'PLACE SOUNDTRACK',
    'RELATED JOURNEYS', 'Route efficiency',
  ]) assert.match(screen, new RegExp(phrase));
  for (const category of ['home', 'work', 'school', 'favorite', 'custom']) assert.match(screen, new RegExp(`'${category}'`));
});

test('Phase 5 is launched only from Settings and does not add a primary tab', () => {
  assert.match(shell, /VehicleIntelligenceScreen/);
  assert.match(shell, /Drive intelligence/);
  assert.doesNotMatch(shell, /id: 'vehicle'/);
  assert.doesNotMatch(shell, /id: 'charging'/);
  assert.doesNotMatch(shell, /id: 'places'/);
});
