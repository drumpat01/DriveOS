import JourneyDeckRecorderModule from './src/JourneyDeckRecorderModule';

export type { NativeRecorderAuthorization, NativeRecorderStatus } from './src/JourneyDeckRecorder.types';

const unavailableStatus = {
  nativeModuleAvailable: false,
  configured: false,
  enabled: false,
  significantMonitoring: false,
  preciseTracking: false,
  recording: false,
  paused: false,
  sessionId: null,
  authorization: 'not_determined',
  lastEvent: null,
  lastEventAt: null,
  lastErrorCode: 'native_module_unavailable',
} as const;

export const isJourneyDeckNativeRecorderAvailable = JourneyDeckRecorderModule !== null;

export async function configureNativeAutomaticRecorder(enabled: boolean, ownerUserId: string, deviceId: string) {
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  return JourneyDeckRecorderModule.configureAsync(enabled, ownerUserId, deviceId);
}

export async function getNativeAutomaticRecorderStatus() {
  return JourneyDeckRecorderModule?.getStatusAsync() ?? unavailableStatus;
}

export async function pauseNativeAutomaticJourney() {
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  return JourneyDeckRecorderModule.pauseActiveJourneyAsync();
}

export async function resumeNativeAutomaticJourney() {
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  return JourneyDeckRecorderModule.resumeActiveJourneyAsync();
}

export async function finishNativeAutomaticJourney() {
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  return JourneyDeckRecorderModule.finishActiveJourneyAsync();
}

export function isNativeAutomaticSession(sessionId: string | null | undefined) {
  return typeof sessionId === 'string' && sessionId.startsWith('native_recording_');
}
