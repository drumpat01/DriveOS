import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultTodayLayout, moveTodayCard, normalizeTodayLayout, toggleTodayCard } from '../src/today-layout.ts';

const all = ['ask', 'lastDrive', 'week', 'onThisDay', 'memories', 'fiftyStates', 'yourCar'] as const;

test('Today defaults put Ask first and keep optional cards hidden', () => {
  const layout = defaultTodayLayout([...all]);
  assert.deepEqual(layout.map(card => card.id), ['ask', 'lastDrive', 'week', 'onThisDay', 'memories', 'fiftyStates', 'yourCar']);
  assert.deepEqual(layout.filter(card => card.visible).map(card => card.id), ['ask', 'lastDrive', 'week', 'onThisDay', 'memories']);
});

test('saved layouts keep order and visibility, drop unavailable cards, and gain new ones', () => {
  const saved = [{ id: 'memories', visible: true }, { id: 'ask', visible: false }, { id: 'bogus', visible: true }, { id: 'yourCar', visible: true }, { id: 'memories', visible: false }];
  const layout = normalizeTodayLayout(saved, ['ask', 'lastDrive', 'week', 'onThisDay', 'memories', 'fiftyStates']);
  assert.deepEqual(layout.map(card => card.id), ['memories', 'ask', 'lastDrive', 'week', 'onThisDay', 'fiftyStates']);
  assert.equal(layout[1].visible, false, 'a hidden Ask stays hidden');
  assert.equal(layout.find(card => card.id === 'fiftyStates')?.visible, false);
  assert.deepEqual(normalizeTodayLayout('corrupt', ['week']).map(card => card.id), ['week']);
});

test('moving and toggling never lose a card', () => {
  const layout = defaultTodayLayout(['ask', 'lastDrive', 'week']);
  assert.deepEqual(moveTodayCard(layout, 'week', -1).map(card => card.id), ['ask', 'week', 'lastDrive']);
  assert.equal(moveTodayCard(layout, 'ask', -1), layout, 'the first card cannot move up');
  assert.equal(moveTodayCard(layout, 'week', 1), layout, 'the last card cannot move down');
  assert.equal(toggleTodayCard(layout, 'ask')[0].visible, false);
  assert.equal(toggleTodayCard(toggleTodayCard(layout, 'ask'), 'ask')[0].visible, true);
});
