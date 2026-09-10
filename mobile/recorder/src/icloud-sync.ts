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
import { isPrivateCloudDeletionPending, setPrivateCloudDeletionPending, type LocalUser } from './local-store';
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

let activeSync: { profileKey: string; userId: string; promise: Promise<PrivateICloudSyncResult> } | null = null;
const activeDeletions = new Map<string, Promise<void>>();
const recentSyncs = new Map<string, { completedAt: number; result: PrivateICloudSyncResult }>();
const AUTOMATIC_SYNC_COOLDOWN_MS = 15 * 60_000;

export function isPrivateICloudNativeAvailable() {
  return isJourneyDeckCloudKitAvailable;
}

export async function privateCloudProfileScope(user: LocalUser): Promise<string> {
  const stableIdentity = user.appleSubject ? `apple:${user.appleSubject}` : `local:${user.id}`;
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `journeydeck-profile:${stableIdentity}`)).slice(0, 48);
}

/** Separate zone keeps new editor assets out of older native clients. */
export async function privateCloudEditorScope(user: LocalUser): Promise<string> {
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `journeydeck-editing-v1:${await privateCloudProfileScope(user)}`)).slice(0, 48);
}

export async function deletePrivateCloudDataForUser(user: LocalUser): Promise<void> {
  if (!isJourneyDeckCloudKitAvailable) throw new Error('Private iCloud deletion requires the next JourneyDeck native build.');
  const existing = activeDeletions.get(user.id);
  if (existing) return existing;
  const alreadyPending = isPrivateCloudDeletionPending(user.id);
  setPrivateCloudDeletionPending(user.id, true);
  const deletion = (async () => {
    let deleteDispatched = false;
    try {
      // A native push already in flight must settle before deleting its zone.
      // New syncs are blocked by the persisted barrier, including after a
      // restart if the subsequent local-file/Keychain cleanup needs a retry.
      if (activeSync?.userId === user.id) await activeSync.promise.catch(() => undefined);
      const accountStatus = await getCloudKitAccountStatus();
      if (accountStatus !== 'available') throw new Error('Private iCloud must be available before this account can be deleted safely.');
      const scope = await privateCloudProfileScope(user);
      // A rejected native call can mean the server deleted the zone but its
      // response was lost. Keep the durable pause once deletion is dispatched.
      deleteDispatched = true;
      await deleteCloudKitPrivateZone(scope);
      const capabilities = await getCloudKitCapabilities();
      if (capabilities.privateContentVersion >= 4) await deleteCloudKitPrivateZone(await privateCloudEditorScope(user));
      recentSyncs.delete(user.appleSubject ?? user.id);
    } catch (error) {
      if (!alreadyPending && !deleteDispatched) setPrivateCloudDeletionPending(user.id, false);
      throw error;
    } finally {
      activeDeletions.delete(user.id);
    }
  })();
  activeDeletions.set(user.id, deletion);
  return deletion;
}

export async function syncCurrentUserWithPrivateICloud(options: { force?: boolean } = {}): Promise<PrivateICloudSyncResult> {
  const user = getCurrentUser();
  assertSyncProfileCurrent(user);
  const profileKey = user.appleSubject ?? user.id;
  if (activeSync?.profileKey === profileKey) return activeSync.promise;
  if (activeSync) {
    await activeSync.promise.catch(() => undefined);
    // Another waiting caller may already have started this profile's sync.
    // Re-read both the active profile and lock before entering native CloudKit.
    return syncCurrentUserWithPrivateICloud(options);
  }
  const recent = recentSyncs.get(profileKey);
  if (!options.force && recent && Date.now() - recent.completedAt < AUTOMATIC_SYNC_COOLDOWN_MS) return recent.result;
  const promise = performSync(user)
    .then(result => {
      if (result.available && result.accountStatus === 'available'
        && result.failedUploads === 0 && result.state.pendingUploadCount === 0) {
        recentSyncs.set(profileKey, { completedAt: Date.now(), result });
      }
      return result;
    })
    .finally(() => {
      if (activeSync?.promise === promise) activeSync = null;
    });
  activeSync = { profileKey, userId: user.id, promise };
  return promise;
}

async function performSync(user: LocalUser): Promise<PrivateICloudSyncResult> {
  const capabilities = await getCloudKitCapabilities();
  const engine = new CloudKitSyncEngine(user.id, {
    privateContentV2: capabilities.privateContentVersion >= 2,
    privateRouteAssets: capabilities.privateContentVersion >= 3,
    privateJourneyEdits: capabilities.privateContentVersion >= 4,
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
    assertSyncProfileCurrent(user);
    if (accountStatus !== 'available') {
      activity.finish({ outcome: 'skipped' });
      return result(true, accountStatus, 0, 0, 0, null, [], engine, capabilities.privateContentVersion);
    }

    engine.setSyncInProgress();
    const profileScope = await privateCloudProfileScope(user);
    assertSyncProfileCurrent(user);
    await ensureCloudKitPrivateZone(profileScope);
    assertSyncProfileCurrent(user);
    const pulled = await pullCloudKitChanges(profileScope);
    assertSyncProfileCurrent(user);
    engine.ingestRemoteDeletions(pulled.deletedRecordNames);
    const ingested = await engine.ingestRemoteRecords(pulled.records, () => assertSyncProfileCurrent(user));
    assertSyncProfileCurrent(user);
    let downloaded = ingested.updatedCount;
    // Keep the old cursor until every dependent record has been restored.
    // A source device may upload the missing place/journey in its next batch.
    if (capabilities.privateContentVersion >= 2 && ingested.deferredCount === 0) await commitCloudKitChangeToken(profileScope);
    let uploaded = 0;
    let failedUploads = ingested.deferredCount;
    const editorScope = capabilities.privateContentVersion >= 4 ? await privateCloudEditorScope(user) : null;
    if (editorScope) {
      assertSyncProfileCurrent(user);
      await ensureCloudKitPrivateZone(editorScope);
      const edits = await pullCloudKitChanges(editorScope);
      assertSyncProfileCurrent(user);
      engine.ingestRemoteDeletions(edits.deletedRecordNames);
      const restored = await engine.ingestRemoteRecords(edits.records, () => assertSyncProfileCurrent(user));
      downloaded += restored.updatedCount;
      failedUploads += restored.deferredCount;
      if (!restored.deferredCount) await commitCloudKitChangeToken(editorScope);
    }
    let retryAfterSeconds: number | null = null;
    for (let batch = 0; batch < 5; batch++) {
      assertSyncProfileCurrent(user);
      const pending = await engine.preparePushPayload(50);
      assertSyncProfileCurrent(user);
      if (!pending.length) break;
      const batches = [
        { scope: profileScope, records: pending.filter(record => record.recordType !== 'JourneyEdit') },
        { scope: editorScope, records: pending.filter(record => record.recordType === 'JourneyEdit') },
      ].filter(item => item.scope && item.records.length);
      let savedThisBatch = 0, failedThisBatch = 0;
      for (const item of batches) {
        assertSyncProfileCurrent(user);
        const pushed = await pushCloudKitRecords(item.scope!, item.records);
        assertSyncProfileCurrent(user);
        if (pushed.remoteRecords.length) {
          const reconciled = await engine.ingestRemoteRecords(pushed.remoteRecords, () => assertSyncProfileCurrent(user));
          assertSyncProfileCurrent(user);
          downloaded += reconciled.updatedCount;
          failedUploads += reconciled.deferredCount;
        }
        engine.acknowledgeSuccessfulPush(pushed.savedRecordNames);
        uploaded += pushed.savedRecordNames.length;
        savedThisBatch += pushed.savedRecordNames.length;
        failedThisBatch += pushed.failedRecordNames.length;
        failedUploads += pushed.failedRecordNames.length;
        for (const recordName of pushed.failedRecordNames) {
          engine.recordUploadFailure(recordName, pushed.failedRecords?.find(failure => failure.recordName === recordName)?.code ?? 'cloudkit_unknown');
        }
        for (const failure of pushed.failedRecords ?? []) {
          if (failure.retryAfterSeconds != null) retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, failure.retryAfterSeconds);
        }
      }
      if (failedThisBatch || !savedThisBatch) break;
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

function assertSyncProfileCurrent(user: LocalUser): void {
  if (isPrivateCloudDeletionPending(user.id)) {
    throw new Error('Private iCloud sync is paused while this account deletion finishes. Retry account deletion to finish removing this profile.');
  }
  const current = getCurrentUser();
  if (current.id !== user.id || current.appleSubject !== user.appleSubject) {
    throw new Error('The active profile changed during private iCloud sync. Its local records remain queued safely.');
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
