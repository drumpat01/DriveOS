import assert from 'node:assert/strict';
import test from 'node:test';
import { journeyDisplayTitle, journeyFallbackTitle } from '../src/journey-title.ts';

const base = { startedAt: '2026-08-29T14:00:00' };

test('saved place names identify a journey more specifically than a city', () => {
  assert.equal(journeyDisplayTitle({ ...base, startingLocation: 'Home', endingLocation: 'Work' }, 'Saginaw, Michigan'), 'Home → Work');
  assert.equal(journeyDisplayTitle({ ...base, endingLocation: 'School' }, 'Saginaw, Michigan'), 'School');
});

test('a privacy-safe reverse lookup supplies a city drive title', () => {
  assert.equal(journeyDisplayTitle(base, 'Saginaw, Michigan'), 'Saginaw drive');
});

test('journeys remain distinct and useful without network or city data', () => {
  assert.equal(journeyFallbackTitle('not-a-date'), 'Recent drive');
  assert.match(journeyDisplayTitle(base), /^Saturday (morning|afternoon|evening|night|late-night) drive$/);
});
