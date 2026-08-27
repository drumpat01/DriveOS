import * as Crypto from 'expo-crypto';

import {
  ensureCloudKitPrivateZone,
  getCloudKitAccountStatus,
  isJourneyDeckCloudKitAvailable,
  pullCloudKitChanges,
  pushCloudKitRecords,
  type CloudKitAccountStatus,
} from '../modules/journeydeck-cloudkit';
import { getCurrentUser } from './auth';
import type { LocalUser } from './local-store';
import { CloudKitSyncEngine, type SyncState } from './cloudkit-sync';
import { rebuildAtlasSnapshot } from './local-atlas';
import { beginNetworkActivity } from './network-activity';

export type PrivateICloudSyncResult = {
  available: boolean;
  accountStatus: CloudKitAccountStatus;
  downloaded: number;
  uploaded: number;
  failedUploads: number;
  deletedRecordNames: string[];
  state: SyncState;
};

let activeSync: { profileKey: string; promise: Promise<PrivateICloudSyncResult> } | null = null;
const recentSyncs = new Map<string, { completedAt: number; result: PrivateICloudSyncResult }>();
const AUTOMATIC_SYNC_COOLDOWN_MS = 15 * 60_000;

export function isPrivateICloudNativeAvailable() {
  return isJourneyDeckCloudKitAvailable;
}

export async function syncCurrentUserWithPrivateICloud(options: { force?: boolean } = {}): Promise<PrivateICloudSyncResult> {
  const user = getCurrentUser();
  const profileKey = user.appleSubject ?? user.id;
  if (activeSync?.profileKey === profileKey) return activeSync.promise;
  if (activeSync) await activeSync.promise.catch(() => undefined);
  const recent = recentSyncs.get(profileKey);
  if (!options.force && recent && Date.now() - recent.completedAt < AUTOMATIC_SYNC_COOLDOWN_MS) return recent.result;
  const promise = performSync(user)
    .then(result => {
      recentSyncs.set(profileKey, { completedAt: Date.now(), result });
      return result;
    })
    .finally(() => {
      if (activeSync?.promise === promise) activeSync = null;
    });
  activeSync = { profileKey, promise };
  return promise;
}

async function performSync(user: LocalUser): Promise<PrivateICloudSyncResult> {
  const engine = new CloudKitSyncEngine(user.id);
  const activity = beginNetworkActivity({
    category: 'private_icloud',
    reason: 'private_sync',
    operation: 'Private iCloud sync',
    method: 'SYNC',
  });
  if (!isJourneyDeckCloudKitAvailable) {
    activity.finish({ outcome: 'skipped' });
    return result(false, 'could_not_determine', 0, 0, 0, [], engine);
  }

  try {
    const accountStatus = await getCloudKitAccountStatus();
    if (accountStatus !== 'available') {
      activity.finish({ outcome: 'skipped' });
      return result(true, accountStatus, 0, 0, 0, [], engine);
    }

    engine.setSyncInProgress();
    const stableIdentity = user.appleSubject ? `apple:${user.appleSubject}` : `local:${user.id}`;
    const profileScope = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `journeydeck-profile:${stableIdentity}`)).slice(0, 48);
    await ensureCloudKitPrivateZone(profileScope);
    const pulled = await pullCloudKitChanges(profileScope);
    let downloaded = engine.ingestRemoteRecords(pulled.records).updatedCount;
    let uploaded = 0;
    let failedUploads = 0;
    for (let batch = 0; batch < 5; batch++) {
      const pending = engine.preparePushPayload(50);
      if (!pending.length) break;
      const pushed = await pushCloudKitRecords(profileScope, pending);
      if (pushed.remoteRecords.length) downloaded += engine.ingestRemoteRecords(pushed.remoteRecords).updatedCount;
      engine.acknowledgeSuccessfulPush(pushed.savedRecordNames);
      uploaded += pushed.savedRecordNames.length;
      failedUploads += pushed.failedRecordNames.length;
      if (pushed.failedRecordNames.length || !pushed.savedRecordNames.length) break;
    }
    if (downloaded) rebuildAtlasSnapshot(user.id);
    activity.finish({ outcome: failedUploads ? 'failed' : 'succeeded' });
    return result(true, accountStatus, downloaded, uploaded, failedUploads, pulled.deletedRecordNames, engine);
  } catch (error) {
    activity.finish({ outcome: 'failed' });
    engine.setSyncError(error);
    throw error;
  }
}

function result(
  available: boolean,
  accountStatus: CloudKitAccountStatus,
  downloaded: number,
  uploaded: number,
  failedUploads: number,
  deletedRecordNames: string[],
  engine: CloudKitSyncEngine,
): PrivateICloudSyncResult {
  return { available, accountStatus, downloaded, uploaded, failedUploads, deletedRecordNames, state: engine.getSyncState() };
}
