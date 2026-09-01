import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  NativeMapKitPointOfInterest, NativeRecorderInboxExport, NativeRecorderStatus,
} from './JourneyDeckRecorder.types';

declare class JourneyDeckRecorderModule extends NativeModule<{}> {
  configureAsync(enabled: boolean, ownerUserId: string, deviceId: string): Promise<NativeRecorderStatus>;
  getStatusAsync(): Promise<NativeRecorderStatus>;
  pauseActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  resumeActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  finishActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  exportInboxAsync(afterSequences: Record<string, number>): Promise<NativeRecorderInboxExport>;
  acknowledgeCompletedSessionsAsync(sessionIds: string[]): Promise<{ acknowledged: number; errorCode: string | null }>;
  nearbyPointsOfInterestAsync(latitude: number, longitude: number, radiusMeters: number): Promise<NativeMapKitPointOfInterest[]>;
}

export default requireOptionalNativeModule<JourneyDeckRecorderModule>('JourneyDeckRecorder');
