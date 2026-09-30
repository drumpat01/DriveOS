import assert from 'node:assert/strict';
import test from 'node:test';
import { V4_STEPS, nextV4Stage, previousV4Stage, v4Stage } from '../src/first-run-v4-flow.ts';

test('V4 onboarding is four steps: Welcome, Location, Soundtrack, See where you have been', () => {
  assert.deepEqual(V4_STEPS, ['welcome', 'location', 'music', 'photos']);
  assert.equal(nextV4Stage('welcome'), 'location');
  assert.equal(nextV4Stage('music'), 'photos');
  assert.equal(nextV4Stage('photos'), 'complete', 'the photo step finishes onboarding');
  assert.equal(previousV4Stage('welcome'), null);
  assert.equal(previousV4Stage('photos'), 'music');
});

test('progress saved by the older nine-step flow resumes at the nearest V4 step', () => {
  assert.equal(v4Stage('recording'), 'location');
  assert.equal(v4Stage('places'), 'music');
  assert.equal(v4Stage('membership'), 'photos');
  assert.equal(v4Stage('tessie'), 'photos');
  assert.equal(v4Stage('instructions'), 'photos');
});
