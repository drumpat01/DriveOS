/** Compile-time gate. Production bundles must not expose destructive/internal test surfaces. */
export function isInternalTestingBuild(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING === '1';
}
