export type StartupCoordinatorState = 'idle' | 'starting' | 'ready' | 'failed';

/** Framework-free single-flight state machine used by UI and headless tasks. */
export function createStartupCoordinator(start: () => Promise<void>) {
  let state: StartupCoordinatorState = 'idle';
  let running: Promise<void> | null = null;
  let failure: Error | null = null;

  const prepare = (): Promise<void> => {
    if (state === 'ready') return Promise.resolve();
    if (running) return running;
    state = 'starting';
    failure = null;
    const attempt = Promise.resolve().then(start).then(() => {
      state = 'ready';
      running = null;
    }).catch(error => {
      failure = error instanceof Error ? error : new Error('JourneyDeck could not prepare local storage.');
      state = 'failed';
      running = null;
      throw failure;
    });
    running = attempt;
    return attempt;
  };

  return {
    prepare,
    retry(): Promise<void> {
      if (state === 'ready') return Promise.resolve();
      if (state === 'starting') return prepare();
      state = 'idle';
      failure = null;
      running = null;
      return prepare();
    },
    state: () => state,
    failure: () => failure,
  };
}
