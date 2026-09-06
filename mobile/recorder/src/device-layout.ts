import { Platform } from 'react-native';

// Device identity stays stable when an iPad window is resized to phone width.
export const isIpad = () => Platform.OS === 'ios' && Platform.isPad === true;

export function ipadHomeColumns(width: number) {
  return { metrics: width >= 720 ? 4 : width >= 440 ? 2 : 1, widgets: width >= 720 ? 2 : 1, songs: width >= 1050 ? 4 : width >= 720 ? 3 : width >= 440 ? 2 : 1 };
}
