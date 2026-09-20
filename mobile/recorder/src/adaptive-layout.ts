import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDisplayLayoutMetrics, type LayoutRect } from './display-layout';

export type AdaptivePresentation = 'compact' | 'regular';
export type AdaptiveOrientation = 'portrait' | 'landscape';
export type FoldAxis = 'vertical' | 'horizontal';

export type LayoutInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type AdaptiveLayout = {
  presentation: AdaptivePresentation;
  orientation: AdaptiveOrientation;
  windowWidth: number;
  windowHeight: number;
  availableWidth: number;
  availableHeight: number;
  fontScale: number;
  isCompact: boolean;
  isRegular: boolean;
  isShort: boolean;
  horizontalSizeClass: 'compact' | 'regular' | 'unspecified';
  verticalSizeClass: 'compact' | 'regular' | 'unspecified';
  divisionRegions: LayoutRect[];
  occlusionRegions: LayoutRect[];
  occlusionInsets: LayoutInsets;
  fold: null | {
    axis: FoldAxis;
    frame: LayoutRect;
    before: LayoutRect;
    after: LayoutRect;
  };
};

type AdaptiveLayoutInput = {
  width: number;
  height: number;
  fontScale?: number;
  insets?: Partial<LayoutInsets>;
  horizontalSizeClass?: AdaptiveLayout['horizontalSizeClass'];
  verticalSizeClass?: AdaptiveLayout['verticalSizeClass'];
  divisionRegions?: LayoutRect[];
  occlusionRegions?: LayoutRect[];
};

// React Native doesn't expose UIKit size classes yet. These are minimum usable
// content dimensions, not device checks: both axes must support the richer
// presentation so a conventional iPhone in landscape stays compact while an
// iPad window or a foldable inner display can reveal additional hierarchy.
export const REGULAR_MIN_WIDTH = 700;
export const REGULAR_MIN_HEIGHT = 500;
export const SHORT_MAX_HEIGHT = 500;

const finiteDimension = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const finiteCoordinate = (value: number) => Number.isFinite(value) ? value : 0;

function clippedRect(rect: LayoutRect, bounds: LayoutRect): LayoutRect | null {
  const x = finiteCoordinate(rect.x);
  const y = finiteCoordinate(rect.y);
  const left = Math.max(bounds.x, x);
  const top = Math.max(bounds.y, y);
  const right = Math.min(bounds.x + bounds.width, x + finiteDimension(rect.width));
  const bottom = Math.min(bounds.y + bounds.height, y + finiteDimension(rect.height));
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function foldForRegions(regions: LayoutRect[], bounds: LayoutRect): AdaptiveLayout['fold'] {
  const candidates = regions.map(region => clippedRect(region, bounds)).filter((region): region is LayoutRect => region !== null);
  if (!candidates.length) return null;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const frame = candidates.sort((a, b) => {
    const aDistance = a.height >= a.width ? Math.abs(a.x + a.width / 2 - centerX) : Math.abs(a.y + a.height / 2 - centerY);
    const bDistance = b.height >= b.width ? Math.abs(b.x + b.width / 2 - centerX) : Math.abs(b.y + b.height / 2 - centerY);
    return aDistance - bDistance;
  })[0]!;
  const axis: FoldAxis = frame.height >= frame.width ? 'vertical' : 'horizontal';
  if (axis === 'vertical') {
    return {
      axis,
      frame,
      before: { x: bounds.x, y: bounds.y, width: Math.max(0, frame.x - bounds.x), height: bounds.height },
      after: { x: frame.x + frame.width, y: bounds.y, width: Math.max(0, bounds.x + bounds.width - frame.x - frame.width), height: bounds.height },
    };
  }
  return {
    axis,
    frame,
    before: { x: bounds.x, y: bounds.y, width: bounds.width, height: Math.max(0, frame.y - bounds.y) },
    after: { x: bounds.x, y: frame.y + frame.height, width: bounds.width, height: Math.max(0, bounds.y + bounds.height - frame.y - frame.height) },
  };
}

function edgeInsetsForRegions(regions: LayoutRect[], bounds: LayoutRect): LayoutInsets {
  const edgeTolerance = 1;
  return regions.reduce<LayoutInsets>((insets, region) => {
    const right = region.x + region.width;
    const bottom = region.y + region.height;
    if (region.y <= bounds.y + edgeTolerance) insets.top = Math.max(insets.top, bottom - bounds.y);
    if (region.x <= bounds.x + edgeTolerance) insets.left = Math.max(insets.left, right - bounds.x);
    if (right >= bounds.x + bounds.width - edgeTolerance) insets.right = Math.max(insets.right, bounds.x + bounds.width - region.x);
    if (bottom >= bounds.y + bounds.height - edgeTolerance) insets.bottom = Math.max(insets.bottom, bounds.y + bounds.height - region.y);
    return insets;
  }, { top: 0, right: 0, bottom: 0, left: 0 });
}

export function verticalFoldContentColumns(fold: NonNullable<AdaptiveLayout['fold']> | null, horizontalPadding: number) {
  if (!fold || fold.axis !== 'vertical') return null;
  const padding = finiteDimension(horizontalPadding);
  return {
    beforeWidth: Math.max(0, fold.before.width - padding),
    afterWidth: Math.max(0, fold.after.width - padding),
    gap: fold.frame.width,
  };
}

export function adaptiveLayoutForFrame({
  width, height, fontScale = 1, insets = {}, horizontalSizeClass = 'unspecified', verticalSizeClass = 'unspecified',
  divisionRegions = [], occlusionRegions = [],
}: AdaptiveLayoutInput): AdaptiveLayout {
  const windowWidth = finiteDimension(width);
  const windowHeight = finiteDimension(height);
  const horizontalInsets = finiteDimension(insets.left ?? 0) + finiteDimension(insets.right ?? 0);
  const verticalInsets = finiteDimension(insets.top ?? 0) + finiteDimension(insets.bottom ?? 0);
  const availableWidth = Math.max(0, windowWidth - horizontalInsets);
  const availableHeight = Math.max(0, windowHeight - verticalInsets);
  const nativeRegular = horizontalSizeClass === 'regular' && verticalSizeClass === 'regular';
  const isRegular = nativeRegular || (availableWidth >= REGULAR_MIN_WIDTH && availableHeight >= REGULAR_MIN_HEIGHT);
  const usableBounds = { x: finiteDimension(insets.left ?? 0), y: finiteDimension(insets.top ?? 0), width: availableWidth, height: availableHeight };
  const clippedDivisions = divisionRegions.map(region => clippedRect(region, usableBounds)).filter((region): region is LayoutRect => region !== null);
  const clippedOcclusions = occlusionRegions.map(region => clippedRect(region, usableBounds)).filter((region): region is LayoutRect => region !== null);

  return {
    presentation: isRegular ? 'regular' : 'compact',
    orientation: availableWidth >= availableHeight ? 'landscape' : 'portrait',
    windowWidth,
    windowHeight,
    availableWidth,
    availableHeight,
    fontScale: Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1,
    isCompact: !isRegular,
    isRegular,
    isShort: availableHeight < SHORT_MAX_HEIGHT,
    horizontalSizeClass,
    verticalSizeClass,
    divisionRegions: clippedDivisions,
    occlusionRegions: clippedOcclusions,
    occlusionInsets: edgeInsetsForRegions(clippedOcclusions, usableBounds),
    fold: foldForRegions(clippedDivisions, usableBounds),
  };
}

export function useAdaptiveLayout(): AdaptiveLayout {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const display = useDisplayLayoutMetrics();
  return adaptiveLayoutForFrame({
    width, height, fontScale, insets,
    horizontalSizeClass: display.horizontalSizeClass,
    verticalSizeClass: display.verticalSizeClass,
    divisionRegions: display.divisionRegions,
    occlusionRegions: display.occlusionRegions,
  });
}
