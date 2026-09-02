import JourneyDeckRecorderModule from './src/JourneyDeckRecorderModule';
import type { NativeRecorderInboxExport } from './src/JourneyDeckRecorder.types';
import { createLatestNativeRecorderConfiguration } from './src/LatestNativeRecorderConfiguration';

export type {
  NativeMapKitPointOfInterest, NativeRecorderAuthorization, NativeRecorderInboxExport,
  NativeRecorderInboxPoint, NativeRecorderInboxSession, NativeRecorderStatus,
} from './src/JourneyDeckRecorder.types';

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

const nativeRecorderConfiguration = createLatestNativeRecorderConfiguration(async target => {
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  return JourneyDeckRecorderModule.configureAsync(target.enabled, target.ownerUserId, target.deviceId);
});

export async function configureNativeAutomaticRecorder(enabled: boolean, ownerUserId: string, deviceId: string) {
  return nativeRecorderConfiguration.request({ enabled, ownerUserId, deviceId });
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

export async function exportNativeRecorderInbox(afterSequences: Record<string, number>): Promise<NativeRecorderInboxExport> {
  if (!JourneyDeckRecorderModule) return { sessions: [], errorCode: 'native_module_unavailable' };
  return JourneyDeckRecorderModule.exportInboxAsync(afterSequences);
}

export async function acknowledgeNativeRecorderSessions(sessionIds: string[]) {
  if (!JourneyDeckRecorderModule) return { acknowledged: 0, errorCode: 'native_module_unavailable' } as const;
  return JourneyDeckRecorderModule.acknowledgeCompletedSessionsAsync(sessionIds);
}

export async function lookupNearbyMapKitPointsOfInterest(latitude: number, longitude: number, radiusMeters = 250) {
  if (!JourneyDeckRecorderModule) return [];
  return JourneyDeckRecorderModule.nearbyPointsOfInterestAsync(latitude, longitude, radiusMeters);
}

export function isNativeAutomaticSession(sessionId: string | null | undefined) {
  return typeof sessionId === 'string' && sessionId.startsWith('native_recording_');
}
