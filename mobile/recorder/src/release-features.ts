/**
 * Public version-1 release gates.
 *
 * Keep the Tessie implementation in the repository, but do not expose or run
 * it in version 1. In particular, no Tessie work may share either background
 * location task used for automatic drive detection and route recording.
 */
export const TESSIE_INTEGRATION_ENABLED: boolean = false;

/**
 * Build 12 safety fallback.
 *
 * The native recorder remains available for inbox import and an already-active
 * native journey, but its idle significant-location trigger is not reliable
 * enough for release. Keep automatic start/park ownership in the proven Expo
 * task until the native confirmation-burst state machine ships in a new build.
 */
export const NATIVE_AUTOMATIC_RECORDER_ENABLED: boolean = false;
