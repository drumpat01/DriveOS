import assert from 'node:assert/strict';
import test from 'node:test';
import { recorderAccessoryState, supportsTabAccessory } from '../src/recorder-accessory-model.ts';

const base = { startupPending: false, permissionsReady: true, status: null, clockTracking: false, automaticMode: false, automaticDetectionActive: false, justSaved: false, elapsed: '24:10', miles: 12.44 } as const;

test('the recorder bar mirrors every recorder state with one clear action', () => {
  assert.deepEqual(recorderAccessoryState(base), { tone: 'idle', title: 'Ready for your next drive', detail: 'Private and on this iPhone', action: 'start', actionLabel: 'Start' });
  assert.equal(recorderAccessoryState({ ...base, startupPending: true }).action, null);
  assert.equal(recorderAccessoryState({ ...base, permissionsReady: false }).action, 'enable');
  const live = recorderAccessoryState({ ...base, status: 'recording', clockTracking: true });
  assert.equal(live.title, 'Recording · 12.4 mi · 24:10');
  assert.equal(live.tone, 'live');
  assert.equal(live.action, 'end');
  assert.equal(recorderAccessoryState({ ...base, status: 'recording' }).tone, 'attention');
  assert.equal(recorderAccessoryState({ ...base, status: 'paused' }).action, 'resume');
  assert.equal(recorderAccessoryState({ ...base, status: 'finishing' }).action, null);
  assert.equal(recorderAccessoryState({ ...base, justSaved: true }).title, 'Journey saved');
  assert.equal(recorderAccessoryState({ ...base, automaticMode: true, automaticDetectionActive: true }).action, null, 'automatic mode never offers a manual start');
  assert.equal(recorderAccessoryState({ ...base, automaticMode: true }).tone, 'attention');
  assert.equal(recorderAccessoryState({ ...base, status: 'recording', clockTracking: true, permissionsReady: false }).action, 'end', 'an active journey can always be ended');
});

test('the accessory is used from iOS 26 on', () => {
  assert.equal(supportsTabAccessory('ios', '26.0'), true);
  assert.equal(supportsTabAccessory('ios', '27.1'), true);
  assert.equal(supportsTabAccessory('ios', '18.6'), false);
  assert.equal(supportsTabAccessory('android', 36), false);
});
