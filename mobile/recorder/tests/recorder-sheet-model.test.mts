import assert from 'node:assert/strict';
import test from 'node:test';
import { recorderSheetState, type RecorderSheetInput } from '../src/recorder-sheet-model.ts';

const base: RecorderSheetInput = { startupPending: false, permissionsReady: true, status: null, clockTracking: false, automaticMode: false, automaticDetectionActive: false };
const state = (patch: Partial<RecorderSheetInput>) => recorderSheetState({ ...base, ...patch });

test('an idle recorder offers Start, or Enable location first', () => {
  assert.deepEqual([state({}).phase, state({}).primary, state({}).live], ['ready', 'start', false]);
  assert.equal(state({ permissionsReady: false }).primary, 'enable');
  assert.equal(state({ startupPending: true }).phase, 'starting');
});

test('recording offers Pause and End, and says when tracking is still unconfirmed', () => {
  const live = state({ status: 'recording', clockTracking: true });
  assert.deepEqual([live.phase, live.primary, live.secondary, live.live], ['recording', 'end', 'pause', true]);
  assert.equal(state({ status: 'recording' }).phase, 'checking');
});

test('paused offers Resume; finishing offers nothing to press', () => {
  assert.deepEqual([state({ status: 'paused' }).secondary, state({ status: 'paused' }).primary], ['resume', 'end']);
  const finishing = state({ status: 'finishing' });
  assert.deepEqual([finishing.primary, finishing.secondary], [null, null]);
});

test('an active journey wins over setup states and Tesla automation', () => {
  assert.equal(state({ status: 'recording', clockTracking: true, permissionsReady: false, startupPending: true }).phase, 'recording');
  assert.equal(state({ automaticMode: true, automaticDetectionActive: true }).primary, null);
  assert.match(state({ automaticMode: true }).title, /paused/);
});
