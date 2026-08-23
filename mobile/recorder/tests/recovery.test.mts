import assert from 'node:assert/strict';
import { decideRecovery, type RecoveryAction, type RecoveryStatus } from '../src/recovery.ts';

const cases: Array<[RecoveryStatus, boolean, boolean, RecoveryAction]> = [
  [null, true, true, 'stop-orphaned-task'],
  ['completed', true, true, 'stop-orphaned-task'],
  ['recording', true, true, 'continue-recording'],
  ['recording', false, true, 'restart-recording'],
  ['recording', false, false, 'pause-interrupted-recording'],
  ['paused', true, true, 'stop-paused-task'],
  ['paused', false, true, 'remain-paused'],
  ['finishing', true, true, 'stop-and-finish'],
  ['finishing', false, false, 'stop-and-finish'],
];

for (const [status, taskRunning, available, expected] of cases) {
  assert.equal(decideRecovery(status, taskRunning, available), expected, `${status}/${taskRunning}/${available}`);
}

console.log(`recovery decisions: ${cases.length} passed`);
