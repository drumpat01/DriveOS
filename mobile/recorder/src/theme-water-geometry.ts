export type ThemeTransitionOrigin = Readonly<{ x: number; y: number }>;
export type ThemeSnapshotFrame = Readonly<{ x: number; y: number; width: number; height: number }>;

// The approved eight-checkpoint preview runs for exactly 1,180 ms.
export const WATER_RIPPLE_DURATION = 1180;
export const WATER_RIPPLE_TIMEOUT = 4200;

export function waterRippleGeometry(frame: ThemeSnapshotFrame, tap?: ThemeTransitionOrigin) {
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  const x = tap && Number.isFinite(tap.x) ? Math.max(0, Math.min(width, tap.x - frame.x)) : width / 2;
  const y = tap && Number.isFinite(tap.y) ? Math.max(0, Math.min(height, tap.y - frame.y)) : height / 2;
  return {
    origin: [x, y] as const,
    size: [width, height] as const,
    radius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)),
  };
}
