import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bestPlaceLabelFromAddress,
  coordinatesShareSavedPlace,
  SAVED_PLACE_MATCH_RADIUS_METERS,
} from '../src/place-matching.ts';

test('saved place names survive realistic parking and GPS drift', () => {
  const named = { latitude: 32.93430, longitude: -97.07810 };
  const sameProperty = { latitude: 32.93565, longitude: -97.07665 };
  assert.equal(SAVED_PLACE_MATCH_RADIUS_METERS, 250);
  assert.equal(coordinatesShareSavedPlace(named, sameProperty), true);
});

test('saved place names do not spread to a different neighborhood', () => {
  const named = { latitude: 32.93430, longitude: -97.07810 };
  const elsewhere = { latitude: 32.94030, longitude: -97.07810 };
  assert.equal(coordinatesShareSavedPlace(named, elsewhere), false);
});

test('reverse geocoder labels prefer a useful place or street over city-only text', () => {
  assert.equal(bestPlaceLabelFromAddress({ name: 'Grapevine Lake', street: 'Oak Grove Loop', city: 'Grapevine', region: 'Texas' }), 'Grapevine Lake');
  assert.equal(bestPlaceLabelFromAddress({ streetNumber: '200', street: 'Main Street', city: 'Grapevine', region: 'Texas' }), '200 Main Street');
  assert.equal(bestPlaceLabelFromAddress({ city: 'Grapevine', region: 'Texas' }), 'Grapevine, Texas');
});
