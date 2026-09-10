/**
 * V1 memories group journey IDs directly. The prefix keeps pre-V1 grouping
 * records dormant without requiring a destructive SQLite migration.
 */
export const DIRECT_JOURNEY_MEMORY_ID_PREFIX = 'memory_v1_';

export function isDirectJourneyMemoryId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(DIRECT_JOURNEY_MEMORY_ID_PREFIX);
}

/** Apply only the editor's selection changes to the latest complete membership.
 * History limits and partially loaded lists are views, never deletion intent.
 */
export function mergeMemoryJourneySelection(current: string[], previous: string[], selected: string[]): string[] {
  const before = new Set(previous), after = new Set(selected);
  return [...new Set([
    ...current.filter(id => !before.has(id) || after.has(id)),
    ...selected.filter(id => !before.has(id)),
  ])];
}
