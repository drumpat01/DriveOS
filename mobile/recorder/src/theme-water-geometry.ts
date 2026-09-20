export type ThemeTransitionOrigin = Readonly<{ x: number; y: number }>;
export type ThemeSnapshotFrame = Readonly<{ x: number; y: number; width: number; height: number }>;

// The approved eight-checkpoint preview runs for exactly 1,180 ms.
export const WATER_RIPPLE_DURATION = 1180;
export const WATER_RIPPLE_TIMEOUT = 4200;
export const WATER_RIPPLE_PREPARE_TIMEOUT = 650;
// A transition snapshot is sampled for barely more than a second and does not
// need the device's 2x/3x backing-store resolution. Keeping it near one logical
// pixel per point avoids decoding a multi-megapixel PNG over image-heavy tabs.
export const WATER_CAPTURE_MAX_PIXELS = 1_200_000;

export function waterCaptureSize(frame: Pick<ThemeSnapshotFrame, 'width' | 'height'>) {
  const width = Math.max(1, Math.round(Number.isFinite(frame.width) ? frame.width : 1));
  const height = Math.max(1, Math.round(Number.isFinite(frame.height) ? frame.height : 1));
  const scale = Math.min(1, Math.sqrt(WATER_CAPTURE_MAX_PIXELS / (width * height)));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

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
