import { WATER_RIPPLE_TIMEOUT, type ThemeTransitionOrigin } from './theme-water-geometry.ts';

export type WaterThemeFrame<Image> = Readonly<{
  before: Image;
  playing: boolean;
  origin?: ThemeTransitionOrigin;
  onReady: () => void;
  onFinished: () => void;
}>;

type WaterThemeHost<Theme, Image> = Readonly<{
  current: () => Theme;
  persist: (theme: Theme) => void;
  apply: (theme: Theme) => Promise<void>;
  capture: () => Promise<Image>;
  show: (frame: WaterThemeFrame<Image>) => void;
  clear: () => void;
  canAnimate: () => boolean;
}>;

/** Orders native snapshots and React commits; no per-frame work lives here. */
export function createWaterThemeSession<Theme, Image>(host: WaterThemeHost<Theme, Image>) {
  type Active = {
    next: Theme;
    applied: boolean;
    ended: boolean;
    cancelWait: () => void;
    cancelled: Promise<void>;
    timeout?: ReturnType<typeof setTimeout>;
  };
  let active: Active | null = null;
  let disposed = false;

  function end(session: Active, apply = true) {
    if (session.ended) return;
    session.ended = true;
    clearTimeout(session.timeout);
    session.cancelWait();
    if (active === session) active = null;
    if (apply && !session.applied) void host.apply(session.next).catch(() => undefined);
    host.clear();
    // Image references are released with the unmounted Canvas. Do not dispose
    // a shared SkImage while Skia's render thread may still be sampling it.
  }

  async function run(session: Active, origin?: ThemeTransitionOrigin) {
    const wait = <T>(work: Promise<T>) => Promise.race([work, session.cancelled.then(() => undefined)]);
    try {
      const before = await wait(host.capture());
      if (session.ended || before === undefined) return;
      let ready!: () => void;
      const covered = new Promise<void>(resolve => { ready = resolve; });
      const onFinished = () => end(session);
      const baseFrame = { before, origin, onReady: ready, onFinished };
      host.show({ ...baseFrame, playing: false });
      await wait(covered);
      if (session.ended) return;

      // The old frame is already drawn above native navigation. Commit the new
      // live theme below it, then make the old frame transparent through water.
      session.applied = true;
      await wait(host.apply(session.next));
      if (session.ended) return;
      host.show({ ...baseFrame, playing: true });
    } catch {
      // A screenshot/GPU failure must never prevent a saved theme from applying.
      end(session);
    }
  }

  return {
    activate() { disposed = false; },
    start(next: Theme, origin?: ThemeTransitionOrigin) {
      if (disposed || active || next === host.current()) return;
      // Keep storage errors synchronous for the picker's existing error alert.
      host.persist(next);
      if (!host.canAnimate()) {
        void host.apply(next).catch(() => undefined);
        return;
      }
      let cancelWait!: () => void;
      const cancelled = new Promise<void>(resolve => { cancelWait = resolve; });
      const session: Active = { next, applied: false, ended: false, cancelWait, cancelled };
      active = session;
      session.timeout = setTimeout(() => end(session), WATER_RIPPLE_TIMEOUT);
      void run(session, origin);
    },
    settle() { if (active) end(active); },
    dispose() {
      disposed = true;
      if (active) end(active, false);
    },
    get busy() { return active !== null; },
  };
}
