import { Platform } from 'react-native';

// Device identity stays stable when an iPad window is resized to phone width.
export const isIpad = () => Platform.OS === 'ios' && Platform.isPad === true;

export const IPAD_GRID_COLUMNS = 6;
export const IPAD_GRID_GAP = 12;

export function effectiveLayoutWidth(width: number, fontScale = 1) {
  return Math.max(0, width) / Math.max(1, fontScale);
}

export function ipadGridColumns(width: number, fontScale = 1): 1 | 2 | 3 | 6 {
  const available = effectiveLayoutWidth(width, fontScale);
  return available >= 900 ? 6 : available >= 540 ? 3 : available >= 330 ? 2 : 1;
}

export function ipadGridSpan(width: number, span: number, columns = IPAD_GRID_COLUMNS, gap = IPAD_GRID_GAP) {
  const safeColumns = Math.max(1, Math.round(columns));
  const safeSpan = Math.max(1, Math.min(safeColumns, Math.round(span)));
  const track = Math.max(0, width - gap * (safeColumns - 1)) / safeColumns;
  return track * safeSpan + gap * (safeSpan - 1);
}
