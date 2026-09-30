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

test('Automatic that cannot run says what is missing and offers a manual Start instead of blaming location', async () => {
  const { recorderAccessoryState } = await import('../src/recorder-accessory-model.ts');
  const base = { startupPending: false, permissionsReady: true, status: null, clockTracking: false, automaticMode: false, automaticDetectionActive: false, justSaved: false, elapsed: '00:00:00', miles: 0 } as const;
  const plus = recorderAccessoryState({ ...base, automaticBlocker: 'plus' });
  assert.equal(plus.action, 'start');
  assert.equal(plus.detail, 'Automatic drives need Plus');
  const tessie = recorderAccessoryState({ ...base, automaticBlocker: 'tessie' });
  assert.equal(tessie.action, 'start');
  assert.equal(tessie.detail, 'Connect Tessie for automatic drives');
  assert.equal(recorderAccessoryState({ ...base }).detail, 'Private and on this iPhone');
  const sheet = recorderSheetState({ startupPending: false, permissionsReady: true, status: null, clockTracking: false, automaticMode: false, automaticDetectionActive: false, automaticBlocker: 'tessie' });
  assert.equal(sheet.primary, 'start');
  assert.match(sheet.body, /Connect Tessie/);
  // A working Automatic that is simply not running yet still points at location.
  const paused = recorderAccessoryState({ ...base, automaticMode: true, automaticDetectionActive: false });
  assert.match(paused.detail, /Always Allow location/);
});
