import * as Crypto from 'expo-crypto';

import {
  ensureCloudKitPrivateZone,
  deleteCloudKitPrivateZone,
  commitCloudKitChangeToken,
  getCloudKitCapabilities,
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
  issueDetails: string[];
  retryAfterSeconds: number | null;
  deletedRecordNames: string[];
  privateContentVersion: number;
  state: SyncState;
};

let activeSync: { profileKey: string; promise: Promise<PrivateICloudSyncResult> } | null = null;
const recentSyncs = new Map<string, { completedAt: number; result: PrivateICloudSyncResult }>();
const AUTOMATIC_SYNC_COOLDOWN_MS = 15 * 60_000;

export function isPrivateICloudNativeAvailable() {
  return isJourneyDeckCloudKitAvailable;
}

export async function privateCloudProfileScope(user: LocalUser): Promise<string> {
  const stableIdentity = user.appleSubject ? `apple:${user.appleSubject}` : `local:${user.id}`;
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `journeydeck-profile:${stableIdentity}`)).slice(0, 48);
}

export async function deletePrivateCloudDataForUser(user: LocalUser): Promise<void> {
  if (!isJourneyDeckCloudKitAvailable) throw new Error('Private iCloud deletion requires the next JourneyDeck native build.');
  const accountStatus = await getCloudKitAccountStatus();
  if (accountStatus !== 'available') throw new Error('Private iCloud must be available before this account can be deleted safely.');
  await deleteCloudKitPrivateZone(await privateCloudProfileScope(user));
  recentSyncs.delete(user.appleSubject ?? user.id);
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
      if (result.failedUploads === 0 && result.state.pendingUploadCount === 0) recentSyncs.set(profileKey, { completedAt: Date.now(), result });
      return result;
    })
    .finally(() => {
      if (activeSync?.promise === promise) activeSync = null;
    });
  activeSync = { profileKey, promise };
  return promise;
}

async function performSync(user: LocalUser): Promise<PrivateICloudSyncResult> {
  const capabilities = await getCloudKitCapabilities();
  const engine = new CloudKitSyncEngine(user.id, {
    privateContentV2: capabilities.privateContentVersion >= 2,
    privateRouteAssets: capabilities.privateContentVersion >= 3,
  });
  const activity = beginNetworkActivity({
    category: 'private_icloud',
    reason: 'private_sync',
    operation: 'Private iCloud sync',
    method: 'SYNC',
  });
  if (!isJourneyDeckCloudKitAvailable) {
    activity.finish({ outcome: 'skipped' });
    return result(false, 'could_not_determine', 0, 0, 0, null, [], engine, capabilities.privateContentVersion);
  }

  try {
    const accountStatus = await getCloudKitAccountStatus();
    if (accountStatus !== 'available') {
      activity.finish({ outcome: 'skipped' });
      return result(true, accountStatus, 0, 0, 0, null, [], engine, capabilities.privateContentVersion);
    }

    engine.setSyncInProgress();
    const profileScope = await privateCloudProfileScope(user);
    await ensureCloudKitPrivateZone(profileScope);
    const pulled = await pullCloudKitChanges(profileScope);
    engine.ingestRemoteDeletions(pulled.deletedRecordNames);
    const ingested = await engine.ingestRemoteRecords(pulled.records);
    let downloaded = ingested.updatedCount;
    // Keep the old cursor until every dependent record has been restored.
    // A source device may upload the missing place/journey in its next batch.
    if (capabilities.privateContentVersion >= 2 && ingested.deferredCount === 0) await commitCloudKitChangeToken(profileScope);
    let uploaded = 0;
    let failedUploads = ingested.deferredCount;
    let retryAfterSeconds: number | null = null;
    for (let batch = 0; batch < 5; batch++) {
      const pending = await engine.preparePushPayload(50);
      if (!pending.length) break;
      const pushed = await pushCloudKitRecords(profileScope, pending);
      if (pushed.remoteRecords.length) {
        const reconciled = await engine.ingestRemoteRecords(pushed.remoteRecords);
        downloaded += reconciled.updatedCount;
        failedUploads += reconciled.deferredCount;
      }
      engine.acknowledgeSuccessfulPush(pushed.savedRecordNames);
      uploaded += pushed.savedRecordNames.length;
      failedUploads += pushed.failedRecordNames.length;
      for (const recordName of pushed.failedRecordNames) {
        engine.recordUploadFailure(recordName, pushed.failedRecords?.find(failure => failure.recordName === recordName)?.code ?? 'cloudkit_unknown');
      }
      for (const failure of pushed.failedRecords ?? []) {
        if (failure.retryAfterSeconds != null) retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, failure.retryAfterSeconds);
      }
      if (pushed.failedRecordNames.length || !pushed.savedRecordNames.length) break;
    }
    failedUploads += engine.getPreparationFailureCount();
    if (downloaded) rebuildAtlasSnapshot(user.id);
    if (failedUploads) engine.setSyncError(new Error('private_cloud_partial'));
    else engine.setSyncCompleted();
    activity.finish({ outcome: failedUploads ? 'failed' : 'succeeded' });
    return result(true, accountStatus, downloaded, uploaded, failedUploads, retryAfterSeconds, pulled.deletedRecordNames, engine, capabilities.privateContentVersion);
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
  retryAfterSeconds: number | null,
  deletedRecordNames: string[],
  engine: CloudKitSyncEngine,
  privateContentVersion: number,
): PrivateICloudSyncResult {
  return { available, accountStatus, downloaded, uploaded, failedUploads, issueDetails: engine.getIssueDetails(), retryAfterSeconds, deletedRecordNames, privateContentVersion, state: engine.getSyncState() };
}
