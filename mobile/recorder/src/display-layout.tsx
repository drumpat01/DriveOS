import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import {
  JourneyDeckDisplayLayoutObserver, type NativeDisplayLayoutMetrics, type NativeLayoutRect,
} from '../modules/journeydeck-recorder';

export type LayoutRect = NativeLayoutRect;

export type DisplayLayoutMetrics = {
  measured: boolean;
  width: number;
  height: number;
  horizontalSizeClass: 'compact' | 'regular' | 'unspecified';
  verticalSizeClass: 'compact' | 'regular' | 'unspecified';
  divisionRegions: LayoutRect[];
  occlusionRegions: LayoutRect[];
};

const emptyMetrics: DisplayLayoutMetrics = {
  measured: false,
  width: 0,
  height: 0,
  horizontalSizeClass: 'unspecified',
  verticalSizeClass: 'unspecified',
  divisionRegions: [],
  occlusionRegions: [],
};

const DisplayLayoutContext = createContext<DisplayLayoutMetrics>(emptyMetrics);

const finiteDimension = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
const finiteCoordinate = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;

function normalizeRect(rect: NativeLayoutRect): LayoutRect | null {
  const width = finiteDimension(rect?.width);
  const height = finiteDimension(rect?.height);
  if (width <= 0 || height <= 0) return null;
  return { x: finiteCoordinate(rect.x), y: finiteCoordinate(rect.y), width, height };
}

export function normalizeDisplayLayoutMetrics(metrics: NativeDisplayLayoutMetrics): DisplayLayoutMetrics {
  return {
    measured: true,
    width: finiteDimension(metrics?.width),
    height: finiteDimension(metrics?.height),
    horizontalSizeClass: metrics?.horizontalSizeClass === 'compact' || metrics?.horizontalSizeClass === 'regular' ? metrics.horizontalSizeClass : 'unspecified',
    verticalSizeClass: metrics?.verticalSizeClass === 'compact' || metrics?.verticalSizeClass === 'regular' ? metrics.verticalSizeClass : 'unspecified',
    divisionRegions: (metrics?.divisionRegions ?? []).map(normalizeRect).filter((rect): rect is LayoutRect => rect !== null),
    occlusionRegions: (metrics?.occlusionRegions ?? []).map(normalizeRect).filter((rect): rect is LayoutRect => rect !== null),
  };
}

export function DisplayLayoutProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<DisplayLayoutMetrics>(emptyMetrics);
  const onDisplayLayoutChange = useCallback((event: { nativeEvent: NativeDisplayLayoutMetrics }) => {
    setMetrics(normalizeDisplayLayoutMetrics(event.nativeEvent));
  }, []);

  return <DisplayLayoutContext.Provider value={metrics}>
    {children}
    <JourneyDeckDisplayLayoutObserver
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      onDisplayLayoutChange={onDisplayLayoutChange}
    />
  </DisplayLayoutContext.Provider>;
}

export function useDisplayLayoutMetrics() {
  return useContext(DisplayLayoutContext);
}
