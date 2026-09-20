import assert from 'node:assert/strict';
import test from 'node:test';
import { HAPTIC_COMMANDS, createHapticDispatcher } from '../src/haptics-system.ts';

test('semantic haptic intents map to restrained native feedback', () => {
  assert.deepEqual(HAPTIC_COMMANDS.success, { kind: 'notification', type: 'success' });
  assert.deepEqual(HAPTIC_COMMANDS['primary-action'], { kind: 'impact', style: 'medium' });
});

test('dispatcher throttles duplicates and contains native failure', async () => {
  let now = 1000;
  let calls = 0;
  const dispatch = createHapticDispatcher({ now: () => now, perform: async () => { calls += 1; if (calls === 2) throw new Error('unavailable'); } });
  assert.equal(await dispatch('selection'), true);
  now += 20;
  assert.equal(await dispatch('selection'), false);
  now += 200;
  assert.equal(await dispatch('error'), false);
  assert.equal(calls, 2);
});

test('dispatcher is silent outside the active app', async () => {
  let calls = 0;
  const dispatch = createHapticDispatcher({ isActive: () => false, perform: () => { calls += 1; } });
  assert.equal(await dispatch('primary-action'), false);
  assert.equal(calls, 0);
});
