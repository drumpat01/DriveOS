import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const appData = fs.readFileSync(path.join(root, 'src', 'app-data.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src', 'vehicle-intelligence-screen.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'shell.tsx'), 'utf8');
const tessie = fs.readFileSync(path.join(root, 'src', 'tessie-direct.ts'), 'utf8');

test('Bundle B refreshes Tessie through the privacy edge and keeps the durable cache on device', () => {
  assert.match(appData, /vehicleIntelligenceCacheKey\(userId\)/);
  assert.match(appData, /refreshVehicleIntelligenceFromTessie/);
  assert.doesNotMatch(appData, /api\/recorder\/vehicle-intelligence/);
  assert.match(appData, /saveVehicleIntelligencePreferences/);
  assert.match(tessie, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
  assert.match(tessie, /\/api\/vehicle\/tessie\/sync/);
  assert.doesNotMatch(tessie, /requestJourneyDeckJson|loadConnection/);
});

test('Phase 5 includes all requested vehicle, charging, place, and route surfaces', () => {
  for (const phrase of [
    'Charging history', 'Home electricity rate', 'Favorite charging locations', 'Saved places',
    'Possible duplicates', 'FOURSQUARE SUGGESTION', 'TIME OF DAY', 'PLACE SOUNDTRACK',
    'RELATED JOURNEYS', 'Route efficiency',
    'LIVE TESSIE SNAPSHOT',
  ]) assert.match(screen, new RegExp(phrase));
  for (const category of ['home', 'work', 'school', 'favorite', 'custom']) assert.match(screen, new RegExp(`'${category}'`));
});

test('Phase 5 is launched only from Settings and does not add a primary tab', () => {
  assert.match(shell, /VehicleIntelligenceScreen/);
  assert.match(shell, /Drive intelligence/);
  assert.match(shell, /token in this iPhone Keychain/);
  assert.doesNotMatch(shell, /id: 'vehicle'/);
  assert.doesNotMatch(shell, /id: 'charging'/);
  assert.doesNotMatch(shell, /id: 'places'/);
});
