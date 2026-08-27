import JourneyDeckCloudKitModule from './src/JourneyDeckCloudKitModule';

export type { CloudKitAccountStatus, CloudKitPullResult, CloudKitPushResult, CloudTransportRecord } from './src/JourneyDeckCloudKit.types';

export const isJourneyDeckCloudKitAvailable = JourneyDeckCloudKitModule !== null;

export async function getCloudKitAccountStatus() {
  return JourneyDeckCloudKitModule?.getAccountStatusAsync() ?? 'could_not_determine' as const;
}

export async function ensureCloudKitPrivateZone(profileScope: string) {
  if (!JourneyDeckCloudKitModule) throw new Error('Private iCloud sync requires the JourneyDeck 1.7 native build.');
  return JourneyDeckCloudKitModule.ensurePrivateZoneAsync(profileScope);
}

export async function pushCloudKitRecords(profileScope: string, records: Parameters<NonNullable<typeof JourneyDeckCloudKitModule>['pushRecordsAsync']>[1]) {
  if (!JourneyDeckCloudKitModule) throw new Error('Private iCloud sync requires the JourneyDeck 1.7 native build.');
  return JourneyDeckCloudKitModule.pushRecordsAsync(profileScope, records);
}

export async function pullCloudKitChanges(profileScope: string) {
  if (!JourneyDeckCloudKitModule) throw new Error('Private iCloud sync requires the JourneyDeck 1.7 native build.');
  return JourneyDeckCloudKitModule.pullChangesAsync(profileScope);
}

export async function resetCloudKitChangeToken(profileScope: string) {
  if (!JourneyDeckCloudKitModule) return;
  await JourneyDeckCloudKitModule.resetChangeTokenAsync(profileScope);
}
