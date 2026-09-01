/**
 * A native session is safe to acknowledge only after the Expo-owned database
 * contains its complete, contiguous zero-based route. The native database
 * remains the durable fallback until this predicate succeeds.
 */
export function nativeRouteImportIsComplete(
  expectedNextSequence: number,
  pointCount: number,
  nextPointSequence: number,
): boolean {
  return Number.isInteger(expectedNextSequence)
    && expectedNextSequence > 0
    && Number.isInteger(pointCount)
    && pointCount >= expectedNextSequence
    && Number.isInteger(nextPointSequence)
    && nextPointSequence >= expectedNextSequence;
}
