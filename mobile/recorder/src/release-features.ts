import Constants from 'expo-constants';

/**
 * Public version-1 release gates.
 *
 * V2 is deliberately manual-recording only. Tessie is enabled by the V3 app
 * variant; no V2 runtime, entitlement, onboarding step, setting, or screen
 * may expose it.
 */
export const TESSIE_INTEGRATION_ENABLED: boolean = Constants.expoConfig?.extra?.features?.tessieEnabled === true;
export const TESTFLIGHT_PLUS_UNLOCKED: boolean = Constants.expoConfig?.extra?.features?.testflightPlusUnlocked === true;

/** Preserve the approved Build 35 Last.fm flow without changing frozen V2. */
export const V3_LASTFM_ENABLED: boolean = Constants.expoConfig?.extra?.features?.lastFmEnabled === true;

/**
 * Build 13 safety fallback.
 *
 * The native recorder remains available for inbox import and an already-active
 * native journey, but its idle significant-location trigger is not reliable
 * enough for release. Keep automatic start/park ownership in the proven Expo
 * task while Build 13 physically validates the corrected native confirmation
 * burst. The native engine ships dormant so it can be enabled only after a
 * controlled TestFlight drive and disabled again through OTA if necessary.
 */
export const NATIVE_AUTOMATIC_RECORDER_ENABLED: boolean = false;

/** Atlas design testing is unlocked only by the isolated V3 preview build. */
export const PREVIEW_ATLAS_UNLOCKED: boolean = Constants.expoConfig?.extra?.features?.atlasUnlocked === true;

/** Source-only interaction lab exposed exclusively by the isolated V3 preview. */
export const V3_MARKERS_PROTOTYPE_ENABLED: boolean = Constants.expoConfig?.extra?.features?.markerPrototype === true;

/** Manual U.S. 50 States checklist and Home widget, isolated to V3 preview. */
export const V3_FIFTY_STATES_ENABLED: boolean = Constants.expoConfig?.extra?.features?.fiftyStates === true;

/** Native question engine and Home prompt, available only in the V3 preview. */
export const V3_ASK_JOURNEYDECK_ENABLED: boolean = Constants.expoConfig?.extra?.features?.askJourneyDeck === true;

/** Approved forest appearance and alternate icon, isolated to the V3 preview. */
export const V3_MIDNIGHT_CANOPY_ENABLED: boolean = Constants.expoConfig?.extra?.features?.midnightCanopy === true;
