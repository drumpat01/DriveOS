export type RecoveryStatus = 'recording' | 'paused' | 'finishing' | 'completed' | null;
export type RecoveryAction =
  | 'stop-orphaned-task'
  | 'continue-recording'
  | 'restart-recording'
  | 'pause-interrupted-recording'
  | 'stop-paused-task'
  | 'remain-paused'
  | 'stop-and-finish'
  | 'none';

/** Pure reconciliation policy for the persisted session and native location task. */
export function decideRecovery(status: RecoveryStatus, taskRunning: boolean, trackingAvailable: boolean): RecoveryAction {
  if (!status || status === 'completed') return taskRunning ? 'stop-orphaned-task' : 'none';
  if (status === 'recording') {
    if (!trackingAvailable) return 'pause-interrupted-recording';
    if (taskRunning) return 'continue-recording';
    return 'restart-recording';
  }
  if (status === 'paused') return taskRunning ? 'stop-paused-task' : 'remain-paused';
  return taskRunning ? 'stop-and-finish' : 'stop-and-finish';
}
