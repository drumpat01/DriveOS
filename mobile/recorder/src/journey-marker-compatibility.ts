/** Explicit JS-only release for installed V3 preview.2; never enabled in native builds. */
export const MARKER_OTA_COMPAT = typeof process !== 'undefined'
  && process.env.EXPO_PUBLIC_JOURNEYDECK_MARKER_OTA_COMPAT === '1';
