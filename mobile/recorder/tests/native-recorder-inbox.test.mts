import assert from 'node:assert/strict';
import test from 'node:test';

import { nativeRouteImportIsComplete } from '../src/native-recorder-inbox-model.ts';

test('native recorder inbox is acknowledged only after every route point is present', () => {
  assert.equal(nativeRouteImportIsComplete(3, 3, 3), true);
  assert.equal(nativeRouteImportIsComplete(3, 2, 2), false, 'a partial export stays in the native inbox');
  assert.equal(nativeRouteImportIsComplete(3, 2, 3), false, 'a gap cannot be mistaken for a complete route');
  assert.equal(nativeRouteImportIsComplete(0, 0, 0), false, 'an empty completed route is retained for diagnosis');
});

test('a manually started journey can finish before the first GPS fix without leaving an active mirror', () => {
  assert.equal(nativeRouteImportIsComplete(0, 0, 0, true), true);
  assert.equal(nativeRouteImportIsComplete(2, 0, 0, true), false);
  assert.equal(nativeRouteImportIsComplete(0, 1, 1, true), false);
});
