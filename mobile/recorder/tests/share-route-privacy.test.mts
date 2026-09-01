import assert from 'node:assert/strict';
import test from 'node:test';

import { trimPrivateShareRoute } from '../src/share-route-privacy.ts';

const route = Array.from({ length: 8 }, (_, index) => [-97 + index * 0.01, 32] as [number, number]);
const songs = [
  { index: 1, coordinate: route[1]! },
  { index: 2, coordinate: route[3]! },
  { index: 3, coordinate: route[5]! },
  { index: 4, coordinate: route[6]! },
];

test('an ordinary share route remains complete', () => {
  const result = trimPrivateShareRoute({ route, songPoints: songs, startLabel: 'Coffee shop', endLabel: 'City park' });
  assert.deepEqual(result.route, route);
  assert.deepEqual(result.songPoints, songs);
  assert.equal(result.trimmedStart, false);
  assert.equal(result.trimmedEnd, false);
});

test('a private destination cuts at the last song when it is farther than one mile away', () => {
  const soundtrack = [1, 2, 3, 4].map((index) => ({ index, coordinate: route[index]! }));
  const result = trimPrivateShareRoute({ route, songPoints: soundtrack, startLabel: 'Office', endLabel: 'HOME' });
  assert.equal(result.trimmedEnd, true);
  assert.deepEqual(result.route.at(-1), route[4]);
  assert.deepEqual(result.songPoints.map(point => point.index), [1, 2, 3, 4]);
});

test('a one-mile boundary wins when the last song is too close to Home', () => {
  const closeSong = [{ index: 1, coordinate: route[6]! }];
  const result = trimPrivateShareRoute({ route, songPoints: closeSong, startLabel: 'Office', endLabel: 'Home' });
  assert.ok(result.route.length >= 2);
  assert.notDeepEqual(result.route.at(-1), route[6]);
  assert.deepEqual(result.songPoints, []);
});

test('a private start uses the farther of one mile or the first song', () => {
  const soundtrack = [{ index: 1, coordinate: route[3]! }, ...songs.slice(1)];
  const result = trimPrivateShareRoute({ route, songPoints: soundtrack, startLabel: 'WORK', endLabel: 'Restaurant' });
  assert.equal(result.trimmedStart, true);
  assert.deepEqual(result.route[0], route[3]);
  assert.deepEqual(result.songPoints.map(point => point.index), [1, 2, 3, 4]);
});

test('a short route between two private endpoints exports no reconstructable geometry', () => {
  const result = trimPrivateShareRoute({ route: route.slice(0, 3), songPoints: [], startLabel: 'Home', endLabel: 'Work' });
  assert.deepEqual(result.route, []);
  assert.deepEqual(result.songPoints, []);
  assert.equal(result.trimmedStart, true);
  assert.equal(result.trimmedEnd, true);
});
