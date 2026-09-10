import assert from 'node:assert/strict';
import test from 'node:test';
import { MOTION_DELAYS, MOTION_DURATIONS, MOTION_EASING_POINTS, MOTION_SPRINGS, createMotionSystem, motionDelay, motionDuration } from '../src/motion-system.ts';

test('motion tokens stay restrained and Reduce Motion is deterministic', () => {
  assert.deepEqual(MOTION_EASING_POINTS.standard, [0.2, 0, 0, 1]);
  assert.ok(MOTION_DURATIONS.feedback < MOTION_DURATIONS.quick);
  assert.ok(MOTION_DURATIONS.quick < MOTION_DURATIONS.standard);
  assert.ok(MOTION_DURATIONS.standard < MOTION_DURATIONS.deliberate);
  assert.ok(MOTION_SPRINGS.responsive.damping >= 20);
  assert.equal(motionDuration('deliberate', true), 0);
  assert.equal(motionDelay('cascade', false), MOTION_DELAYS.cascade);
  assert.equal(motionDelay('cascade', true), 0);
});

test('shared store observes preferences and AppState and cleans up', async () => {
  let appState = 'active';
  let appCleanups = 0;
  let motionCleanups = 0;
  const appListeners = new Set<(state: string) => void>();
  const motionListeners = new Set<(enabled: boolean) => void>();
  const store = createMotionSystem({
    getCurrentAppState: () => appState,
    readReduceMotion: async () => false,
    subscribeAppState: listener => { appListeners.add(listener); return () => { appCleanups += 1; appListeners.delete(listener); }; },
    subscribeReduceMotion: listener => { motionListeners.add(listener); return () => { motionCleanups += 1; motionListeners.delete(listener); }; },
  });
  const unsubscribe = store.subscribe(() => undefined);
  assert.equal(store.getSnapshot().reduceMotion, true);
  await Promise.resolve();
  assert.equal(store.getSnapshot().ambientMotionEnabled, true);
  appState = 'background';
  appListeners.forEach(listener => listener(appState));
  assert.equal(store.getSnapshot().ambientMotionEnabled, false);
  appState = 'active';
  appListeners.forEach(listener => listener(appState));
  motionListeners.forEach(listener => listener(true));
  assert.equal(store.getSnapshot().reduceMotion, true);
  unsubscribe();
  assert.equal(appCleanups, 1);
  assert.equal(motionCleanups, 1);
});

test('multiple consumers share one native subscription pair', () => {
  let subscriptions = 0;
  let cleanups = 0;
  const subscribe = () => { subscriptions += 1; return () => { cleanups += 1; }; };
  const store = createMotionSystem({ getCurrentAppState: () => 'active', readReduceMotion: async () => false, subscribeAppState: subscribe, subscribeReduceMotion: subscribe });
  const first = store.subscribe(() => undefined);
  const second = store.subscribe(() => undefined);
  assert.equal(subscriptions, 2);
  first();
  assert.equal(cleanups, 0);
  second();
  assert.equal(cleanups, 2);
});
