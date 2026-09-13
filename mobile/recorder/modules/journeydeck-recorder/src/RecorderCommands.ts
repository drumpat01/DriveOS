import type { NativeRecorderStatus, RecorderCommandOutcome } from './JourneyDeckRecorder.types';

type Action = 'start' | 'pause' | 'resume' | 'finish';
type Transport = {
  getStatusAsync(): Promise<NativeRecorderStatus>;
  executeCommandAsync(id: string, action: Action, sessionId: string, token: string, expiresAt: number): Promise<NativeRecorderStatus>;
  getCommandOutcomeAsync(id: string): Promise<RecorderCommandOutcome>;
};

export function createRecorderCommands(transport: Transport, uuid: () => string, timeoutMs = 10_000) {
  let pending: { id: string; action: Action; sessionId: string; expiresAt: number } | null = null;
  async function bounded<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Recorder response delayed. Refresh to confirm the command outcome.')), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  }
  function check(outcome: RecorderCommandOutcome) {
    if (outcome.state !== 'applied') throw new Error(outcome.errorCode ?? 'Recorder command is not yet confirmed.');
  }
  return async (action: Action, sessionId = '', operationId?: string): Promise<NativeRecorderStatus> => {
    if (pending) {
      const previous = pending;
      const outcome = await bounded(transport.getCommandOutcomeAsync(previous.id));
      if (outcome.state === 'pending' || (outcome.state === 'unknown' && Date.now() / 1000 <= previous.expiresAt)) {
        throw new Error('Recorder command is still pending. Refresh before issuing another command.');
      }
      if (pending === previous) pending = null;
      // Retrying the same user action returns the original result, including
      // Start after its session has already finished. Never silently replay it.
      if (previous.action === action && previous.sessionId === sessionId) {
        check(outcome);
        return bounded(transport.getStatusAsync());
      }
    }
    const status = await bounded(transport.getStatusAsync());
    if (status.statusReliable === false || !status.controlToken) throw new Error('Refresh the recorder before issuing a command.');
    if (action !== 'start' && (!sessionId || status.sessionId !== sessionId)) throw new Error('The recording session changed.');
    // Install the lock synchronously after the status await. A competing caller
    // must not replace an unresolved command while this one was reading status.
    if (pending) throw new Error('Recorder command is still pending.');
    const command = { id: operationId ?? uuid(), action, sessionId, expiresAt: Date.now() / 1000 + 30 };
    pending = command;
    const work = transport.executeCommandAsync(command.id, action, sessionId, status.controlToken, command.expiresAt);
    const result = await bounded(work);
    if (result.command?.state === 'applied' || result.command?.state === 'rejected') pending = null;
    check(result.command ?? { state: 'unknown' });
    return result;
  };
}
