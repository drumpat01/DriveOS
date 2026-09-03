function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function navigationGeometry(width: number, count: number, padding: number, gap: number) {
  const safeCount = Math.max(1, count);
  const usableWidth = Math.max(0, width - (padding * 2) - (gap * (safeCount - 1)));
  const itemWidth = usableWidth / safeCount;
  return {
    itemWidth,
    stride: itemWidth + gap,
    minimumX: padding,
    maximumX: padding + ((safeCount - 1) * (itemWidth + gap)),
  };
}

export function navigationIndexAtX(locationX: number, width: number, count: number, padding: number, gap: number) {
  const geometry = navigationGeometry(width, count, padding, gap);
  const firstCenter = geometry.minimumX + (geometry.itemWidth / 2);
  return clamp(Math.round((locationX - firstCenter) / geometry.stride), 0, Math.max(0, count - 1));
}

export function navigationIndicatorX(locationX: number, width: number, count: number, padding: number, gap: number) {
  const geometry = navigationGeometry(width, count, padding, gap);
  return clamp(locationX - (geometry.itemWidth / 2), geometry.minimumX, geometry.maximumX);
}

export function navigationTabX(index: number, width: number, count: number, padding: number, gap: number) {
  const geometry = navigationGeometry(width, count, padding, gap);
  return geometry.minimumX + (clamp(index, 0, Math.max(0, count - 1)) * geometry.stride);
}

export function navigationProgressAtX(locationX: number, width: number, count: number, padding: number, gap: number) {
  const geometry = navigationGeometry(width, count, padding, gap);
  if (geometry.stride <= 0) return 0;
  const indicatorX = navigationIndicatorX(locationX, width, count, padding, gap);
  return clamp((indicatorX - geometry.minimumX) / geometry.stride, 0, Math.max(0, count - 1));
}

export function circularPagerTransition(currentIndex: number, nextIndex: number, count: number, reduceMotion = false) {
  const lastIndex = Math.max(0, count - 1);
  const current = clamp(currentIndex, 0, lastIndex);
  const next = clamp(nextIndex, 0, lastIndex);
  if (!reduceMotion && current === 0 && next === lastIndex) return { targetPosition: 0, canonicalSnapPosition: count };
  if (!reduceMotion && current === lastIndex && next === 0) return { targetPosition: count + 1, canonicalSnapPosition: 1 };
  return { targetPosition: next + 1, canonicalSnapPosition: null };
}

export function circularPagerTabIndex(position: number, count: number) {
  if (position <= 0) return Math.max(0, count - 1);
  if (position >= count + 1) return 0;
  return clamp(position - 1, 0, Math.max(0, count - 1));
}

export function circularPagerProgress(position: number, offset: number) {
  return position + offset - 1;
}

export function tabPageMotion(progress: number, index: number, reduceMotion: boolean) {
  'worklet';
  if (reduceMotion) return { opacity: 1, scale: 1 };
  const distance = Math.min(1, Math.abs(progress - index));
  return {
    opacity: 1 - (distance * 0.08),
    scale: 1 - (distance * 0.015),
  };
}
