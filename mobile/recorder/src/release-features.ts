/** Tessie is enabled only in the V3 TestFlight manifest; V2 remains gated off. */
export const TESSIE_INTEGRATION_ENABLED: boolean = Constants.expoConfig?.extra?.features?.testflightTessieEnabled === true;

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

/** Atlas design testing is unlocked in V3 builds. */
export const PREVIEW_ATLAS_UNLOCKED: boolean = Constants.expoConfig?.extra?.features?.atlasUnlocked === true;

/** TestFlight V3 can exercise Plus features without a sandbox transaction. */
export const TESTFLIGHT_PLUS_UNLOCKED: boolean = Constants.expoConfig?.extra?.features?.testflightPlusUnlocked === true;
export const TESTFLIGHT_DATA_HEALTH_ENABLED: boolean = Constants.expoConfig?.extra?.features?.testflightDataHealth === true;

/** Source-only interaction lab exposed exclusively by the isolated V3 preview. */
export const V3_MARKERS_PROTOTYPE_ENABLED: boolean = Constants.expoConfig?.extra?.features?.markerPrototype === true;

/** Manual U.S. 50 States checklist and Home widget, isolated to V3 preview. */
export const V3_FIFTY_STATES_ENABLED: boolean = Constants.expoConfig?.extra?.features?.fiftyStates === true;

/** Native question engine and Home prompt, available only in the V3 preview. */
export const V3_ASK_JOURNEYDECK_ENABLED: boolean = Constants.expoConfig?.extra?.features?.askJourneyDeck === true;

/** Approved forest appearance and alternate icon, isolated to the V3 preview. */
export const V3_MIDNIGHT_CANOPY_ENABLED: boolean = Constants.expoConfig?.extra?.features?.midnightCanopy === true;
import Constants from 'expo-constants';
