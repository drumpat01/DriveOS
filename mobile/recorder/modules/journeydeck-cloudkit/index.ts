import { createCloudKitRequestGate } from './src/CloudKitRequestGate';
import JourneyDeckCloudKitModule from './src/JourneyDeckCloudKitModule';

export type {
  CloudKitAccountStatus, CloudKitCapabilities, CloudKitPullResult, CloudKitPushResult,
  CloudKitRecordFailure, CloudTransportRecord,
} from './src/JourneyDeckCloudKit.types';

const cloudRequest = createCloudKitRequestGate();

export const isJourneyDeckCloudKitAvailable = JourneyDeckCloudKitModule !== null;

export async function getCloudKitAccountStatus() {
  return JourneyDeckCloudKitModule ? cloudRequest(() => JourneyDeckCloudKitModule!.getAccountStatusAsync()) : 'could_not_determine' as const;
}

export async function getCloudKitCapabilities() {
  return JourneyDeckCloudKitModule?.getCapabilitiesAsync
    ? cloudRequest(() => JourneyDeckCloudKitModule!.getCapabilitiesAsync!())
    : { privateContentVersion: 1, transportVersion: 1, retryMetadata: false };
}

export async function ensureCloudKitPrivateZone(profileScope: string) {
  if (!JourneyDeckCloudKitModule) throw new Error('Private iCloud sync requires the JourneyDeck 1.9 native build.');
  return cloudRequest(() => JourneyDeckCloudKitModule!.ensurePrivateZoneAsync!(profileScope));
}

export async function deleteCloudKitPrivateZone(profileScope: string) {
  if (!JourneyDeckCloudKitModule?.deletePrivateZoneAsync) throw new Error('Private iCloud account deletion requires the next JourneyDeck native build.');
  return cloudRequest(() => JourneyDeckCloudKitModule!.deletePrivateZoneAsync!(profileScope));
}

export async function pushCloudKitRecords(profileScope: string, records: Parameters<NonNullable<typeof JourneyDeckCloudKitModule>['pushRecordsAsync']>[1]) {
  if (!JourneyDeckCloudKitModule) throw new Error('Private iCloud sync requires the JourneyDeck 1.9 native build.');
  return cloudRequest(() => JourneyDeckCloudKitModule!.pushRecordsAsync!(profileScope, records));
}

export async function pullCloudKitChanges(profileScope: string) {
  if (!JourneyDeckCloudKitModule) throw new Error('Private iCloud sync requires the JourneyDeck 1.9 native build.');
  return cloudRequest(() => JourneyDeckCloudKitModule!.pullChangesAsync!(profileScope));
}

export async function commitCloudKitChangeToken(profileScope: string) {
  if (JourneyDeckCloudKitModule?.commitChangeTokenAsync) await cloudRequest(() => JourneyDeckCloudKitModule!.commitChangeTokenAsync!(profileScope));
}

export async function resetCloudKitChangeToken(profileScope: string) {
  if (!JourneyDeckCloudKitModule) return;
  await cloudRequest(() => JourneyDeckCloudKitModule!.resetChangeTokenAsync!(profileScope));
}
