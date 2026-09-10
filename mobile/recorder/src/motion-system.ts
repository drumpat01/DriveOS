export const MOTION_DURATIONS = {
  instant: 0,
  feedback: 120,
  exit: 150,
  quick: 180,
  standard: 260,
  settle: 340,
  emphasis: 360,
  deliberate: 420,
  sweep: 540,
  ambient: 22_000,
} as const;

export type MotionDuration = keyof typeof MOTION_DURATIONS;

export const MOTION_DELAYS = {
  none: 0,
  short: 150,
  sweep: 170,
  medium: 230,
  content: 270,
  long: 300,
  cascade: 380,
  stagger: 90,
} as const;

export const MOTION_EASING_POINTS = {
  standard: [0.2, 0, 0, 1],
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  linear: [0, 0, 1, 1],
} as const;

export type MotionSpringPreset = Readonly<{
  mass: number;
  damping: number;
  stiffness: number;
  overshootClamping: boolean;
  restDisplacementThreshold: number;
  restSpeedThreshold: number;
}>;

export const MOTION_SPRINGS = {
  responsive: {
    mass: 0.72,
    damping: 22,
    stiffness: 280,
    overshootClamping: false,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 2,
  },
  gentle: {
    mass: 0.9,
    damping: 20,
    stiffness: 190,
    overshootClamping: false,
    restDisplacementThreshold: 0.5,
    restSpeedThreshold: 2,
  },
} as const satisfies Record<string, MotionSpringPreset>;

export const NATIVE_MOTION_SPRINGS = {
  dock: { speed: 24, bounciness: 5 },
} as const;

export function motionDuration(duration: MotionDuration, reduceMotion: boolean) {
  return reduceMotion ? MOTION_DURATIONS.instant : MOTION_DURATIONS[duration];
}

export function motionDelay(delay: keyof typeof MOTION_DELAYS, reduceMotion: boolean) {
  return reduceMotion ? MOTION_DELAYS.none : MOTION_DELAYS[delay];
}

export type MotionAppState = 'active' | 'inactive' | 'background';

export type MotionSnapshot = Readonly<{
  appState: MotionAppState;
  isAppActive: boolean;
  reduceMotion: boolean;
  reduceMotionResolved: boolean;
  ambientMotionEnabled: boolean;
}>;

type RemoveListener = () => void;

export type MotionSystemAdapter = Readonly<{
  getCurrentAppState: () => string | null | undefined;
  readReduceMotion: () => Promise<boolean>;
  subscribeAppState: (listener: (state: string) => void) => RemoveListener;
  subscribeReduceMotion: (listener: (enabled: boolean) => void) => RemoveListener;
}>;

function normalizeAppState(state: string | null | undefined): MotionAppState {
  if (state === 'active' || state === 'background') return state;
  return 'inactive';
}

function createSnapshot(appState: MotionAppState, reduceMotion: boolean, reduceMotionResolved: boolean): MotionSnapshot {
  return Object.freeze({
    appState,
    isAppActive: appState === 'active',
    reduceMotion,
    reduceMotionResolved,
    ambientMotionEnabled: appState === 'active' && !reduceMotion,
  });
}

export function createMotionSystem(adapter: MotionSystemAdapter) {
  let snapshot = createSnapshot(normalizeAppState(adapter.getCurrentAppState()), true, false);
  let listeners = new Set<() => void>();
  let appStateCleanup: RemoveListener | null = null;
  let reduceMotionCleanup: RemoveListener | null = null;
  let generation = 0;
  let preferenceRevision = 0;

  const update = (next: Partial<Pick<MotionSnapshot, 'appState' | 'reduceMotion' | 'reduceMotionResolved'>>) => {
    const appState = next.appState ?? snapshot.appState;
    const reduceMotion = next.reduceMotion ?? snapshot.reduceMotion;
    const reduceMotionResolved = next.reduceMotionResolved ?? snapshot.reduceMotionResolved;
    if (appState === snapshot.appState && reduceMotion === snapshot.reduceMotion && reduceMotionResolved === snapshot.reduceMotionResolved) return;
    snapshot = createSnapshot(appState, reduceMotion, reduceMotionResolved);
    listeners.forEach(listener => listener());
  };

  const stop = () => {
    generation += 1;
    appStateCleanup?.();
    reduceMotionCleanup?.();
    appStateCleanup = null;
    reduceMotionCleanup = null;
  };

  const start = () => {
    if (appStateCleanup || reduceMotionCleanup) return;
    const currentGeneration = ++generation;
    const readRevision = preferenceRevision;
    update({ appState: normalizeAppState(adapter.getCurrentAppState()) });
    appStateCleanup = adapter.subscribeAppState(state => {
      if (currentGeneration !== generation) return;
      update({ appState: normalizeAppState(state) });
    });
    reduceMotionCleanup = adapter.subscribeReduceMotion(enabled => {
      if (currentGeneration !== generation) return;
      preferenceRevision += 1;
      update({ reduceMotion: enabled, reduceMotionResolved: true });
    });
    void adapter.readReduceMotion().then(enabled => {
      if (currentGeneration !== generation || readRevision !== preferenceRevision) return;
      update({ reduceMotion: enabled, reduceMotionResolved: true });
    }).catch(() => {
      if (currentGeneration !== generation || readRevision !== preferenceRevision) return;
      update({ reduceMotion: true, reduceMotionResolved: true });
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    dispose() {
      listeners = new Set();
      stop();
    },
  };
}
