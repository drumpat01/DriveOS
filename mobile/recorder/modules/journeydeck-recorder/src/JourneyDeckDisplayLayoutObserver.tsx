import { type ComponentType } from 'react';
import { type NativeSyntheticEvent, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';

import JourneyDeckRecorderModule from './JourneyDeckRecorderModule';

export type NativeLayoutRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NativeDisplayLayoutMetrics = {
  width: number;
  height: number;
  horizontalSizeClass: 'compact' | 'regular' | 'unspecified';
  verticalSizeClass: 'compact' | 'regular' | 'unspecified';
  divisionRegions: NativeLayoutRect[];
  occlusionRegions: NativeLayoutRect[];
};

type NativeObserverProps = ViewProps & {
  onDisplayLayoutChange?: (event: NativeSyntheticEvent<NativeDisplayLayoutMetrics>) => void;
};

let NativeObserver: ComponentType<NativeObserverProps> | null = null;

export const isNativeDisplayLayoutObserverAvailable = JourneyDeckRecorderModule?.displayLayoutObserverAvailable === true;

export function JourneyDeckDisplayLayoutObserver(props: NativeObserverProps) {
  if (!isNativeDisplayLayoutObserverAvailable) return null;
  NativeObserver ??= requireNativeView<NativeObserverProps>('JourneyDeckRecorder');
  return <NativeObserver {...props} />;
}
