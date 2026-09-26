import * as Crypto from 'expo-crypto';

import {
  ensureCloudKitPrivateZone,
  deleteCloudKitPrivateZone,
  commitCloudKitChangeToken,
  getCloudKitCapabilities,
  getCloudKitAccountStatus,
  getCloudKitPrivateZoneScopes,
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
import { privateCloudProfileScope } from './private-cloud-profile';
import { clearPublishedProEntitlements } from './pro-entitlement-cache';
import {
  classifyPrivateICloudSyncError,
  nextPrivateICloudSyncBackoff,
  PrivateICloudSyncDeferredError,
  type PrivateICloudSyncBackoff,
} from './private-icloud-sync-policy';
export { privateCloudProfileScope } from './private-cloud-profile';
export {
  classifyPrivateICloudSyncError,
  PrivateICloudSyncDeferredError,
  type PrivateICloudSyncBackoff,
  type PrivateICloudSyncErrorCategory,
} from './private-icloud-sync-policy';

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
  /** True when a recent completed sync was returned without contacting CloudKit. */
  reused?: boolean;
};

let activeSync: { profileKey: string; userId: string; promise: Promise<PrivateICloudSyncResult> } | null = null;
const activeDeletions = new Map<string, Promise<void>>();
const recentSyncs = new Map<string, { completedAt: number; result: PrivateICloudSyncResult }>();
// Failed or partial syncs are never cached as recent. Without this schedule every
// automatic trigger (resume, membership refresh) re-ran the full sync.
const failureBackoffs = new Map<string, PrivateICloudSyncBackoff>();
const AUTOMATIC_SYNC_COOLDOWN_MS = 15 * 60_000;

export function isPrivateICloudNativeAvailable() {
  return isJourneyDeckCloudKitAvailable;
}

/** Lets small account metadata writes follow an in-flight archive sync. */
export async function waitForPrivateICloudSyncIdle(): Promise<void> {
  if (activeSync) await activeSync.promise.catch(() => undefined);
}

/** Active failure backoff for the current profile, or null when an automatic sync may run now. */
export function getPrivateICloudSyncBackoff(now = Date.now()): PrivateICloudSyncBackoff | null {
  const user = getCurrentUser();
  const backoff = failureBackoffs.get(user.appleSubject ?? user.id);
  return backoff && now < backoff.nextAttemptAt ? backoff : null;
}

/** Consecutive-failure record for the current profile, including an elapsed backoff. */
export function getPrivateICloudSyncFailureRecord(): PrivateICloudSyncBackoff | null {
  const user = getCurrentUser();
  return failureBackoffs.get(user.appleSubject ?? user.id) ?? null;
}

/** Separate zone keeps new editor assets out of older native clients. */
export async function privateCloudEditorScope(user: LocalUser): Promise<string> {
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `journeydeck-editing-v1:${await privateCloudProfileScope(user)}`)).slice(0, 48);
}

/** Separate zone prevents pre-Marker binaries from encountering unknown record types. */
export async function privateCloudMarkerScope(user: LocalUser): Promise<string> {
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `journeydeck-markers-v1:${await privateCloudProfileScope(user)}`)).slice(0, 48);
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
      const capabilities = await getCloudKitCapabilities();
      const scopes = [await privateCloudProfileScope(user)];
      const { canonicalScope, existingScopes } = await getCloudKitPrivateZoneScopes();
      if (user.appleSubject) scopes.push(canonicalScope);
      if (capabilities.privateContentVersion >= 4) scopes.push(await privateCloudEditorScope(user));
      if (capabilities.privateContentVersion >= 5) scopes.push(await privateCloudMarkerScope(user));
      // Native zone enumeration filters JourneyDeck-<48 hex>. Validate again
      // before passing a scope to the native deletion API.
      if (scopes.some(scope => !/^[0-9a-f]{48}$/i.test(scope))) {
        throw new Error('Private iCloud returned an invalid JourneyDeck zone scope.');
      }
      const uniqueScopes = [...new Set([...scopes, ...existingScopes.filter(scope => /^[0-9a-f]{48}$/i.test(scope))])];
      console.info('Deleting private CloudKit zones', { zoneCount: uniqueScopes.length });
      // A rejected native call can mean the server deleted the zone but its
      // response was lost. Keep the durable pause once deletion is dispatched.
      deleteDispatched = true;
      for (const scope of uniqueScopes) {
        await deleteCloudKitPrivateZone(scope);
      }
      // Native deleteZone clears both committed and pending change tokens, and
      // does the same when CloudKit reports an already-missing zone.
      clearPublishedProEntitlements(uniqueScopes);
      recentSyncs.delete(user.appleSubject ?? user.id);
      failureBackoffs.delete(user.appleSubject ?? user.id);
    } catch (error) {
      if (deleteDispatched) console.warn('Private CloudKit zone deletion failed', { code: cloudKitErrorCode(error) });
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
  if (!options.force && recent && Date.now() - recent.completedAt < AUTOMATIC_SYNC_COOLDOWN_MS) return { ...recent.result, reused: true };
  // A user-initiated (forced) sync always retries immediately; its outcome
  // then resets or extends the schedule like any other attempt.
  const backoff = failureBackoffs.get(profileKey);
  if (!options.force && backoff && Date.now() < backoff.nextAttemptAt) throw new PrivateICloudSyncDeferredError(backoff);
  const promise = performSync(user)
    .then(result => {
      if (result.available && result.accountStatus === 'available'
        && result.failedUploads === 0 && result.state.pendingUploadCount === 0) {
        recentSyncs.set(profileKey, { completedAt: Date.now(), result });
      } else {
        // An older complete sync must not answer automatic callers (and bypass
        // the backoff) after this newer attempt came back incomplete.
        recentSyncs.delete(profileKey);
      }
      if (result.failedUploads > 0) {
        failureBackoffs.set(profileKey, nextPrivateICloudSyncBackoff(failureBackoffs.get(profileKey), 'partial_upload', Date.now(), result.retryAfterSeconds));
      } else if (result.available && result.accountStatus === 'available') {
        failureBackoffs.delete(profileKey);
      }
      return result;
    }, error => {
      recentSyncs.delete(profileKey);
      failureBackoffs.set(profileKey, nextPrivateICloudSyncBackoff(failureBackoffs.get(profileKey), classifyPrivateICloudSyncError(error), Date.now()));
      throw error;
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
    privateMarkers: capabilities.privateContentVersion >= 5,
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

  // Never create a new private zone for a disposable local profile. Apple sign-in
  // is required before the iCloud account's canonical archive is selected.
  if (!user.appleSubject) {
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
    const zones = await getCloudKitPrivateZoneScopes();
    const canonicalScope = zones.canonicalScope;
    assertSyncProfileCurrent(user);
    await ensureCloudKitPrivateZone(canonicalScope);
    const deletedRecordNames: string[] = [];
    let downloaded = 0;
    let uploaded = 0;
    let failedUploads = 0;
    // Existing V2/V3 profile, editor and marker zones remain readable. Only the
    // account-stable canonical zone receives new writes.
    for (const scope of [...new Set([...zones.existingScopes, canonicalScope])]) {
      try {
        assertSyncProfileCurrent(user);
        const pulled = await pullCloudKitChanges(scope);
        assertSyncProfileCurrent(user);
        engine.ingestRemoteDeletions(pulled.deletedRecordNames);
        deletedRecordNames.push(...pulled.deletedRecordNames);
        const ingested = await engine.ingestRemoteRecords(pulled.records, () => assertSyncProfileCurrent(user));
        downloaded += ingested.updatedCount;
        failedUploads += ingested.deferredCount;
        // Keep a zone's old cursor when a dependent record has not arrived yet.
        if (ingested.deferredCount === 0) await commitCloudKitChangeToken(scope);
      } catch (error) {
        if (scope === canonicalScope) throw error;
        failedUploads++;
        console.warn('CloudKit zone pull failed', { code: cloudKitErrorCode(error) });
      }
    }
    let retryAfterSeconds: number | null = null;
    const failedThisPass = new Set<string>();
    for (let batch = 0; batch < 5; batch++) {
      assertSyncProfileCurrent(user);
      const pending = await engine.preparePushPayload(50 + failedThisPass.size, failedThisPass);
      assertSyncProfileCurrent(user);
      if (!pending.length) break;
      let savedThisBatch = 0;
      const recordTypes = new Map(pending.map(record => [record.recordName, record.recordType]));
      for (let offset = 0; offset < pending.length; offset += 25) {
        const chunk = pending.slice(offset, offset + 25);
        assertSyncProfileCurrent(user);
        let responses = [] as Awaited<ReturnType<typeof pushCloudKitRecords>>[];
        try {
          responses = [await pushCloudKitRecords(canonicalScope, chunk)];
        } catch (error) {
          const category = classifyPrivateICloudSyncError(error);
          if (['timeout', 'request_in_flight', 'account_unavailable', 'network', 'rate_limited', 'service_unavailable', 'zone_missing', 'change_cursor'].includes(category)) throw error;
          // A malformed asset or unsupported record type may reject the whole
          // batch. Retry its members individually so healthy records can land.
          for (const record of chunk) {
            try {
              responses.push(await pushCloudKitRecords(canonicalScope, [record]));
            } catch (individualError) {
              const individualCategory = classifyPrivateICloudSyncError(individualError);
              if (['timeout', 'request_in_flight', 'account_unavailable', 'network', 'rate_limited', 'service_unavailable', 'zone_missing', 'change_cursor'].includes(individualCategory)) throw individualError;
              const code = cloudKitErrorCode(individualError);
              console.warn('CloudKit record upload failed', { recordType: record.recordType, code });
              engine.recordUploadFailure(record.recordName, code);
              failedThisPass.add(record.recordName);
              failedUploads++;
            }
          }
        }
        for (const pushed of responses) {
          assertSyncProfileCurrent(user);
          if (pushed.remoteRecords.length) {
            const reconciled = await engine.ingestRemoteRecords(pushed.remoteRecords, () => assertSyncProfileCurrent(user));
            downloaded += reconciled.updatedCount;
            failedUploads += reconciled.deferredCount;
          }
          engine.acknowledgeSuccessfulPush(pushed.savedRecordNames);
          uploaded += pushed.savedRecordNames.length;
          savedThisBatch += pushed.savedRecordNames.length;
          failedUploads += pushed.failedRecordNames.length;
          for (const recordName of pushed.failedRecordNames) {
            const code = pushed.failedRecords?.find(failure => failure.recordName === recordName)?.code ?? 'cloudkit_unknown';
            console.warn('CloudKit record upload failed', { recordType: recordTypes.get(recordName) ?? 'Unknown', code });
            engine.recordUploadFailure(recordName, code);
            failedThisPass.add(recordName);
          }
          for (const failure of pushed.failedRecords ?? []) {
            if (failure.retryAfterSeconds != null) retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, failure.retryAfterSeconds);
          }
        }
      }
      if (!savedThisBatch && !failedThisPass.size) break;
    }
    failedUploads += engine.getPreparationFailureCount();
    if (downloaded) rebuildAtlasSnapshot(user.id);
    if (failedUploads) engine.setSyncError(new Error('private_cloud_partial'));
    else engine.setSyncCompleted();
    activity.finish({ outcome: failedUploads ? 'failed' : 'succeeded' });
    return result(true, accountStatus, downloaded, uploaded, failedUploads, retryAfterSeconds, [...new Set(deletedRecordNames)], engine, capabilities.privateContentVersion);
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

function cloudKitErrorCode(error: unknown): string {
  const value = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'cloudkit_unknown';
  return /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : 'cloudkit_unknown';
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
