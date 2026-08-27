import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { CloudKitAccountStatus, CloudKitPullResult, CloudKitPushResult, CloudTransportRecord } from './JourneyDeckCloudKit.types';

declare class JourneyDeckCloudKitModule extends NativeModule<{}> {
  getAccountStatusAsync(): Promise<CloudKitAccountStatus>;
  ensurePrivateZoneAsync(profileScope: string): Promise<{ ready: true }>;
  pushRecordsAsync(profileScope: string, records: CloudTransportRecord[]): Promise<CloudKitPushResult>;
  pullChangesAsync(profileScope: string): Promise<CloudKitPullResult>;
  resetChangeTokenAsync(profileScope: string): Promise<void>;
}

export default requireOptionalNativeModule<JourneyDeckCloudKitModule>('JourneyDeckCloudKit');
