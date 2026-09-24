import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';


const root = path.resolve(import.meta.dirname, '../..');
const appData = fs.readFileSync(path.join(root, 'src', 'app-data.ts'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src', 'vehicle-intelligence-screen.tsx'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'shell.tsx'), 'utf8');
const tessie = fs.readFileSync(path.join(root, 'src', 'tessie-direct.ts'), 'utf8');
const connectionCard = fs.readFileSync(path.join(root, 'src', 'tessie-connection-card.tsx'), 'utf8');
const profileSecrets = fs.readFileSync(path.join(root, 'src', 'profile-secure-store.ts'), 'utf8');

test('Tessie now-playing is not used as a song recorder', () => {
  const capture = fs.readFileSync(path.join(root, 'src', 'music-capture.ts'), 'utf8');
  const automatic = fs.readFileSync(path.join(root, 'src', 'automatic-drive-task.ts'), 'utf8');
  const location = fs.readFileSync(path.join(root, 'src', 'location-task.ts'), 'utf8');
  for (const source of [capture, automatic, location]) assert.doesNotMatch(source, /sampleTessieMediaForActiveSession|tessieMediaObservation/);
});

test('dormant Tessie refresh remains local-first and privacy-edge bounded', () => {
  assert.match(appData, /vehicleIntelligenceCacheKey\(userId\)/);
  assert.match(appData, /refreshVehicleIntelligenceFromTessie/);
  assert.doesNotMatch(appData, /api\/recorder\/vehicle-intelligence/);
  assert.match(appData, /saveVehicleIntelligencePreferences/);
  assert.match(tessie, /loadProfileSecret\(TESSIE_TOKEN_KEY\)/);
  assert.match(profileSecrets, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
  assert.match(tessie, /\/api\/vehicle\/tessie\/sync/);
  assert.doesNotMatch(tessie, /requestJourneyDeckJson|loadConnection/);
});

test('dormant vehicle intelligence retains its requested data surfaces', () => {
  for (const phrase of [
    'Charging history', 'Home electricity rate', 'Favorite charging locations', 'Saved places',
    'Possible duplicates', 'FOURSQUARE SUGGESTION', 'TIME OF DAY', 'PLACE SOUNDTRACK',
    'RELATED JOURNEYS', 'Route efficiency', 'LIVE TESSIE SNAPSHOT',
  ]) assert.match(screen, new RegExp(phrase));
  for (const category of ['home', 'work', 'school', 'favorite', 'custom']) assert.match(screen, new RegExp(`'${category}'`));
});

test('V3 Tessie connection lives in Settings and keeps primary navigation stable', () => {
  assert.match(shell, /TessieConnectionCard/);
  assert.match(shell, /tessieContent/);
  assert.match(connectionCard, /token is stored in this device’s Keychain and sent securely to the privacy edge/);
  assert.doesNotMatch(shell, /id: 'vehicle'/);
  assert.doesNotMatch(shell, /id: 'charging'/);
  assert.doesNotMatch(shell, /id: 'places'/);
});
