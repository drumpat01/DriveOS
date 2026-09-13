import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  NativeMapKitPointOfInterest, NativeRecorderInboxExport, NativeRecorderStatus, NativeRecorderStatusEvent, RecorderCommandOutcome,
} from './JourneyDeckRecorder.types';

type JourneyDeckRecorderEvents = {
  recorderStatusChanged: (event: NativeRecorderStatusEvent) => void;
};

declare class JourneyDeckRecorderModule extends NativeModule<JourneyDeckRecorderEvents> {
  executeCommandAsync?(id: string, action: 'start' | 'pause' | 'resume' | 'finish', sessionId: string, token: string, expiresAt: number): Promise<NativeRecorderStatus>;
  getCommandOutcomeAsync?(id: string): Promise<RecorderCommandOutcome>;
  configureAsync(enabled: boolean, ownerUserId: string, deviceId: string): Promise<NativeRecorderStatus>;
  getStatusAsync(): Promise<NativeRecorderStatus>;
  configureManualAsync?(ready: boolean, ownerUserId: string, legacyActive: boolean): Promise<NativeRecorderStatus>;
  startManualJourneyAsync?(requestId: string): Promise<NativeRecorderStatus>;
  pauseActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  resumeActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  pauseJourneyIfMatchingAsync?(sessionId: string): Promise<NativeRecorderStatus>;
  resumeJourneyIfMatchingAsync?(sessionId: string): Promise<NativeRecorderStatus>;
  finishActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  finishJourneyIfMatchingAsync?(sessionId: string): Promise<NativeRecorderStatus>;
  exportInboxAsync(afterSequences: Record<string, number>): Promise<NativeRecorderInboxExport>;
  exportInboxForSessionAsync?(afterSequences: Record<string, number>, sessionId: string): Promise<NativeRecorderInboxExport>;
  acknowledgeCompletedSessionsAsync(sessionIds: string[]): Promise<{ acknowledged: number; errorCode: string | null }>;
  nearbyPointsOfInterestAsync(latitude: number, longitude: number, radiusMeters: number): Promise<NativeMapKitPointOfInterest[]>;
}

export default requireOptionalNativeModule<JourneyDeckRecorderModule>('JourneyDeckRecorder');
