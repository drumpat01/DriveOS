import { randomUUID } from 'expo-crypto';
import { createRecorderCommands } from './src/RecorderCommands';
import JourneyDeckRecorderModule from './src/JourneyDeckRecorderModule';
import type { NativeRecorderInboxExport, NativeRecorderStatus, NativeRecorderStatusEvent } from './src/JourneyDeckRecorder.types';
import { createLatestNativeRecorderConfiguration } from './src/LatestNativeRecorderConfiguration';
import { subscribeRecorderStatusEvents } from './src/RecorderStatusEvents';

export type {
  NativeMapKitPointOfInterest, NativeRecorderAuthorization, NativeRecorderInboxExport,
  NativeRecorderInboxPoint, NativeRecorderInboxSession, NativeRecorderStatus,
  NativeRecorderStatusEvent,
} from './src/JourneyDeckRecorder.types';

export function subscribeNativeRecorderStatus(listener: (event: NativeRecorderStatusEvent) => void): () => void {
  // Builds predating recorder events continue to use the foreground status poll.
  return subscribeRecorderStatusEvents(JourneyDeckRecorderModule, listener);
}

const unavailableStatus: NativeRecorderStatus = {
  nativeModuleAvailable: false,
  statusReliable: false,
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
export const isNativeManualRecorderAvailable = typeof JourneyDeckRecorderModule?.startManualJourneyAsync === 'function';
let manualProfileTransition = false;
export function setNativeManualProfileTransition(active: boolean) { manualProfileTransition = active; }

export async function configureNativeManualRecorder(ready: boolean, ownerUserId: string, legacyActive: boolean) {
  return JourneyDeckRecorderModule?.configureManualAsync?.(ready && !manualProfileTransition, ownerUserId, legacyActive) ?? unavailableStatus;
}

const journalCommands = JourneyDeckRecorderModule?.executeCommandAsync && JourneyDeckRecorderModule?.getCommandOutcomeAsync
  ? createRecorderCommands({
    getStatusAsync: () => JourneyDeckRecorderModule!.getStatusAsync(),
    executeCommandAsync: (...args) => JourneyDeckRecorderModule!.executeCommandAsync!(...args),
    getCommandOutcomeAsync: id => JourneyDeckRecorderModule!.getCommandOutcomeAsync!(id),
  }, randomUUID) : null;

export async function startNativeManualJourney(requestId: string) {
  if (journalCommands) return journalCommands('start', '', requestId);
  return JourneyDeckRecorderModule?.startManualJourneyAsync?.(requestId) ?? unavailableStatus;
}

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

export async function pauseNativeAutomaticJourney(sessionId?: string) {
  if (journalCommands) return journalCommands('pause', sessionId);
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  if (sessionId && JourneyDeckRecorderModule.pauseJourneyIfMatchingAsync) {
    return JourneyDeckRecorderModule.pauseJourneyIfMatchingAsync(sessionId);
  }
  if (sessionId) {
    const status = await JourneyDeckRecorderModule.getStatusAsync();
    if (status.statusReliable === false || status.sessionId !== sessionId) {
      return { ...status, lastErrorCode: status.lastErrorCode ?? 'session_changed' };
    }
  }
  return JourneyDeckRecorderModule.pauseActiveJourneyAsync();
}

export async function resumeNativeAutomaticJourney(sessionId?: string) {
  if (journalCommands) return journalCommands('resume', sessionId);
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  if (sessionId && JourneyDeckRecorderModule.resumeJourneyIfMatchingAsync) {
    return JourneyDeckRecorderModule.resumeJourneyIfMatchingAsync(sessionId);
  }
  if (sessionId) {
    const status = await JourneyDeckRecorderModule.getStatusAsync();
    if (status.statusReliable === false || status.sessionId !== sessionId || status.authorization !== 'always') {
      return { ...status, lastErrorCode: status.lastErrorCode ?? (status.authorization !== 'always' ? 'always_location_required' : 'session_changed') };
    }
  }
  return JourneyDeckRecorderModule.resumeActiveJourneyAsync();
}

export async function finishNativeAutomaticJourney(sessionId?: string) {
  if (journalCommands) return journalCommands('finish', sessionId);
  if (!JourneyDeckRecorderModule) return unavailableStatus;
  if (sessionId && JourneyDeckRecorderModule.finishJourneyIfMatchingAsync) return JourneyDeckRecorderModule.finishJourneyIfMatchingAsync(sessionId);
  if (sessionId) {
    const status = await JourneyDeckRecorderModule.getStatusAsync();
    if (status.statusReliable === false || status.sessionId !== sessionId) {
      return { ...status, lastErrorCode: status.lastErrorCode ?? 'session_changed' };
    }
  }
  return JourneyDeckRecorderModule.finishActiveJourneyAsync();
}

export async function exportNativeRecorderInbox(afterSequences: Record<string, number>, preferredSessionId?: string): Promise<NativeRecorderInboxExport> {
  if (!JourneyDeckRecorderModule) return { sessions: [], errorCode: 'native_module_unavailable' };
  if (preferredSessionId && JourneyDeckRecorderModule.exportInboxForSessionAsync) {
    return JourneyDeckRecorderModule.exportInboxForSessionAsync(afterSequences, preferredSessionId);
  }
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
