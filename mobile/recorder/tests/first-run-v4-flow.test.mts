import assert from 'node:assert/strict';
import test from 'node:test';
import { V4_STEPS, haveAccountStage, nextV4Stage, previousV4Stage, v4Stage, v4Steps } from '../src/first-run-v4-flow.ts';

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

test('iPad onboarding skips the recording steps because drives are recorded on iPhone', () => {
  assert.deepEqual([...v4Steps(true)], ['welcome', 'sync', 'photos']);
  assert.equal(nextV4Stage('welcome', true), 'sync');
  assert.equal(nextV4Stage('sync', true), 'photos');
  assert.equal(nextV4Stage('photos', true), 'complete');
  assert.equal(previousV4Stage('photos', true), 'sync');
  assert.equal(v4Stage('recording', true), 'sync');
  assert.equal(v4Stage('membership', true), 'photos');
  assert.equal(v4Stage('welcome', true), 'welcome');
});

test('"I have an account" skips only the welcome deck on iPhone and finishes on iPad', () => {
  // iPhone still sets up location and music, so the pre-V4 pickers never appear.
  assert.equal(haveAccountStage(), 'location');
  assert.equal(haveAccountStage(true), 'complete');
});
