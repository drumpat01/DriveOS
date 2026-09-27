import {
  ensureCloudKitPrivateZone,
  getCloudKitAccountStatus,
  getCloudKitPrivateZoneScopes,
  isJourneyDeckCloudKitAvailable,
  pushCloudKitRecords,
} from '../modules/journeydeck-cloudkit';
import type { JourneyDeckMembershipStatus } from '../modules/journeydeck-membership';
import { getCurrentUser } from './auth';
import { isPrivateCloudDeletionPending } from './local-store';
import { classifyPrivateICloudSyncError } from './private-icloud-sync-policy';
import { waitForPrivateICloudSyncIdle } from './icloud-sync';
import { lastPublishedProEntitlements } from './pro-entitlement-cache';

let publishQueue: Promise<void> = Promise.resolve();

function errorCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'cloudkit_unknown';
  return code === 'cloudkit_unknown' ? classifyPrivateICloudSyncError(error)
    : /^[A-Za-z0-9_.-]{1,80}$/.test(code) ? code : 'cloudkit_unknown';
}

/** Called after every verified StoreKit refresh or transaction update. */
export function publishProEntitlement(status: JourneyDeckMembershipStatus): Promise<void> {
  publishQueue = publishQueue.catch(() => undefined).then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await writeProEntitlement(status); }
      catch (error) {
        if (classifyPrivateICloudSyncError(error) === 'request_in_flight' && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 5_000));
          continue;
        }
        console.warn('CloudKit record upload failed', { recordType: 'Entitlement', code: errorCode(error) });
        throw error;
      }
    }
  });
  return publishQueue;
}

async function writeProEntitlement(status: JourneyDeckMembershipStatus): Promise<void> {
  const user = getCurrentUser();
  const productId = status.tier === 'paid' ? status.activeProductId : status.mostRecentProductId;
  const environment = status.tier === 'paid' ? status.environment : status.mostRecentEnvironment;
  const expiresAt = status.tier === 'paid' ? status.expirationDate : status.mostRecentExpirationDate;
  if (!isJourneyDeckCloudKitAvailable || status.nativeModuleAvailable !== true || !user.appleSubject || isPrivateCloudDeletionPending(user.id)
    || !productId || !status.originalTransactionId || !environment || !/^\d+$/.test(status.originalTransactionId)) return;
  await waitForPrivateICloudSyncIdle();
  if (getCurrentUser().id !== user.id || isPrivateCloudDeletionPending(user.id)) return;
  if (await getCloudKitAccountStatus() !== 'available') return;
  const { canonicalScope } = await getCloudKitPrivateZoneScopes();
  const fingerprint = JSON.stringify([productId, status.originalTransactionId, expiresAt, status.tier === 'paid', environment]);
  const previous = lastPublishedProEntitlements.get(canonicalScope);
  if (previous?.fingerprint === fingerprint && Date.now() - previous.at < 86_400_000) return;
  if (getCurrentUser().id !== user.id || getCurrentUser().appleSubject !== user.appleSubject) return;
  const environmentName = { production: 'Production', sandbox: 'Sandbox', xcode: 'Xcode' }[environment];
  const record = {
    recordName: 'entitlement_pro',
    recordType: 'Entitlement' as const,
    fields: {
      productId,
      originalTransactionId: status.originalTransactionId,
      expiresAt: expiresAt ?? null,
      isActive: status.tier === 'paid' ? 1 : 0,
      environment: environmentName,
      updatedAt: new Date().toISOString(),
    },
  };
  await ensureCloudKitPrivateZone(canonicalScope);
  const result = await pushCloudKitRecords(canonicalScope, [record]);
  if (result.failedRecordNames.length) throw Object.assign(new Error('Entitlement upload failed'), { code: result.failedRecords?.[0]?.code ?? 'cloudkit_unknown' });
  if (!result.savedRecordNames.length && !result.remoteRecords.length) throw new Error('Entitlement upload was not confirmed');
  lastPublishedProEntitlements.set(canonicalScope, { fingerprint, at: Date.now() });
}
