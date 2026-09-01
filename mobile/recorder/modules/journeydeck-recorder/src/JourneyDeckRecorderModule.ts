import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { NativeRecorderStatus } from './JourneyDeckRecorder.types';

declare class JourneyDeckRecorderModule extends NativeModule<{}> {
  configureAsync(enabled: boolean, ownerUserId: string, deviceId: string): Promise<NativeRecorderStatus>;
  getStatusAsync(): Promise<NativeRecorderStatus>;
  pauseActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  resumeActiveJourneyAsync(): Promise<NativeRecorderStatus>;
  finishActiveJourneyAsync(): Promise<NativeRecorderStatus>;
}

export default requireOptionalNativeModule<JourneyDeckRecorderModule>('JourneyDeckRecorder');
