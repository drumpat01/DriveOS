import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { CloudKitAccountStatus, CloudKitCapabilities, CloudKitPullResult, CloudKitPushResult, CloudTransportRecord } from './JourneyDeckCloudKit.types';

declare class JourneyDeckCloudKitModule extends NativeModule<{}> {
  getAccountStatusAsync(): Promise<CloudKitAccountStatus>;
  getCapabilitiesAsync?(): Promise<CloudKitCapabilities>;
  ensurePrivateZoneAsync(profileScope: string): Promise<{ ready: true }>;
  pushRecordsAsync(profileScope: string, records: CloudTransportRecord[]): Promise<CloudKitPushResult>;
  pullChangesAsync(profileScope: string): Promise<CloudKitPullResult>;
  commitChangeTokenAsync?(profileScope: string): Promise<void>;
  resetChangeTokenAsync(profileScope: string): Promise<void>;
}

export default requireOptionalNativeModule<JourneyDeckCloudKitModule>('JourneyDeckCloudKit');
