export type StudioDrop = { kind: 'create'; journeyIds: string[] } | { kind: 'add'; memoryId: string; journeyIds: string[] };

export function phoneStudioLayout(width: number, height: number, fontScale = 1) {
  const usableHeight = Math.max(200, height);
  return {
    columns: width >= 320 && fontScale <= 1.2 ? 2 : 1,
    cardHeight: fontScale > 1.2 ? 250 : 210,
    collapsedTray: Math.min(96, Math.max(68, 68 * fontScale)),
    expandedTray: Math.min(330, usableHeight * 0.52, Math.max(180 * Math.min(fontScale, 1.5), usableHeight * 0.36)),
  };
}

export function clampStudioTrayHeight(height: number, collapsed: number, expanded: number): number {
  return Math.max(collapsed, Math.min(expanded, height));
}

/** PanResponder reports vertical velocity in points per millisecond. */
export function settleStudioTrayExpanded(height: number, collapsed: number, expanded: number, velocityY: number): boolean {
  if (velocityY <= -0.45) return true;
  if (velocityY >= 0.45) return false;
  return clampStudioTrayHeight(height, collapsed, expanded) >= (collapsed + expanded) / 2;
}

/** Only live, visible IDs can participate. Dropping onto itself is a cancellation. */
export function memoryStudioDrop(source: string, target: string, journeys: readonly string[], memories: readonly string[]): StudioDrop | null {
  if (!journeys.includes(source)) return null;
  if (target === 'new') return { kind: 'create', journeyIds: [source] };
  if (target.startsWith('journey:')) {
    const other = target.slice(8);
    return other !== source && journeys.includes(other) ? { kind: 'create', journeyIds: [other, source] } : null;
  }
  if (target.startsWith('memory:')) {
    const id = target.slice(7);
    return memories.includes(id) ? { kind: 'add', memoryId: id, journeyIds: [source] } : null;
  }
  return null;
}

export type StudioRect = { pageX: number; pageY: number; width: number; height: number };
export function containsStudioPoint(rect: StudioRect | null, x: number, y: number): boolean {
  'worklet';
  return !!rect && rect.width > 0 && rect.height > 0 && x >= rect.pageX && x <= rect.pageX + rect.width && y >= rect.pageY && y <= rect.pageY + rect.height;
}

export function studioEdgeVelocity(rect: StudioRect | null, x: number, y: number): number {
  'worklet';
  if (!containsStudioPoint(rect, x, y) || !rect) return 0;
  const edge = Math.min(56, rect.height / 4);
  if (y < rect.pageY + edge) return -420 * (1 - (y - rect.pageY) / edge);
  if (y > rect.pageY + rect.height - edge) return 420 * (1 - (rect.pageY + rect.height - y) / edge);
  return 0;
}
