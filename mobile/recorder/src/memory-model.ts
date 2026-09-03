/**
 * V1 memories group journey IDs directly. The prefix keeps pre-V1 grouping
 * records dormant without requiring a destructive SQLite migration.
 */
export const DIRECT_JOURNEY_MEMORY_ID_PREFIX = 'memory_v1_';

export function isDirectJourneyMemoryId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(DIRECT_JOURNEY_MEMORY_ID_PREFIX);
}
