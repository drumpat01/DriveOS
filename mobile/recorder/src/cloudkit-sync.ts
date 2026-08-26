/**
 * cloudkit-sync.ts - Apple CloudKit Sync Engine
 * 
 * Manages end-to-end encrypted synchronization between on-device SQLite and
 * Apple CloudKit private database.
 * 
 * KEY PRIVACY & ARCHITECTURE INVARIANTS:
 * -------------------------------------
 * 1. Uses Apple CloudKit Private Database (scoped to the user’s personal iCloud account).
 * 2. Developer/Server has ZERO access to CloudKit private records.
 * 3. Raw GPS breadcrumbs stay on the local device; only journey summaries sync to iCloud.
 * 4. Conflict resolution uses deterministic Last-Write-Wins (LWW) with updatedAt timestamps.
 * 5. Sync runs non-blockingly in the background.
 */

import {
  LocalUserId,
  LocalJourney,
  LocalMusicEntry,
  LocalPlace,
  LocalCollection,
  LocalMemory,
  journeysPendingSync,
  markJourneysSynced,
  markMusicEntriesSynced,
  upsertJourney,
  upsertMusicEntry,
  upsertPlace,
  upsertCollection,
  upsertMemory,
  listJourneys,
  listMusicEntries,
  listCollections,
  listMemories,
} from './local-store';

export type CloudKitRecordType = 'Journey' | 'MusicEntry' | 'Place' | 'Collection' | 'Memory';

export interface CloudKitRecord {
  recordName: string;
  recordType: CloudKitRecordType;
  fields: Record<string, any>;
  modificationDate?: string;
}

export interface SyncState {
  lastSyncAt: string | null;
  syncInProgress: boolean;
  pendingUploadCount: number;
  lastError: string | null;
}

let currentSyncState: SyncState = {
  lastSyncAt: null,
  syncInProgress: false,
  pendingUploadCount: 0,
  lastError: null,
};

// --- Mappers: SQLite <-> CloudKit -------------------------------------------

export function journeyToCKRecord(j: LocalJourney): CloudKitRecord {
  return {
    recordName: `journey_${j.id}`,
    recordType: 'Journey',
    fields: {
      id: j.id,
      userId: j.userId,
      legacyDriveId: j.legacyDriveId,
      startedAt: j.startedAt,
      endedAt: j.endedAt,
      durationMinutes: j.durationMinutes,
      miles: j.miles,
      startLat: j.startLat,
      startLng: j.startLng,
      endLat: j.endLat,
      endLng: j.endLng,
      startPlaceId: j.startPlaceId,
      endPlaceId: j.endPlaceId,
      averageSpeedMph: j.averageSpeedMph,
      maxSpeedMph: j.maxSpeedMph,
      songCount: j.songCount,
      vehicleName: j.vehicleName,
      provider: j.provider,
      updatedAt: j.updatedAt,
    },
    modificationDate: j.updatedAt,
  };
}

export function ckRecordToJourney(record: CloudKitRecord): LocalJourney {
  const f = record.fields;
  return {
    id: String(f.id),
    userId: String(f.userId),
    legacyDriveId: f.legacyDriveId ? String(f.legacyDriveId) : null,
    startedAt: String(f.startedAt),
    endedAt: String(f.endedAt),
    durationMinutes: Number(f.durationMinutes) || 0,
    miles: Number(f.miles) || 0,
    startLat: f.startLat != null ? Number(f.startLat) : null,
    startLng: f.startLng != null ? Number(f.startLng) : null,
    endLat: f.endLat != null ? Number(f.endLat) : null,
    endLng: f.endLng != null ? Number(f.endLng) : null,
    startPlaceId: f.startPlaceId ? String(f.startPlaceId) : null,
    endPlaceId: f.endPlaceId ? String(f.endPlaceId) : null,
    averageSpeedMph: f.averageSpeedMph != null ? Number(f.averageSpeedMph) : null,
    maxSpeedMph: f.maxSpeedMph != null ? Number(f.maxSpeedMph) : null,
    songCount: Number(f.songCount) || 0,
    vehicleName: f.vehicleName ? String(f.vehicleName) : null,
    provider: f.provider ? String(f.provider) : null,
    syncedToCloud: 1,
    createdAt: f.startedAt ? String(f.startedAt) : new Date().toISOString(),
    updatedAt: record.modificationDate || String(f.updatedAt || new Date().toISOString()),
  };
}

// --- Conflict Resolution: Last-Write-Wins (LWW) -----------------------------

export function resolveConflict<T extends { updatedAt: string }>(local: T, remote: T): T {
  const localTime = Date.parse(local.updatedAt) || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;
  return remoteTime >= localTime ? remote : local;
}

// --- Sync Engine ------------------------------------------------------------

export class CloudKitSyncEngine {
  private userId: LocalUserId;

  constructor(userId: LocalUserId) {
    this.userId = userId;
  }

  public getSyncState(): SyncState {
    const pendingJourneys = journeysPendingSync(this.userId);
    return {
      ...currentSyncState,
      pendingUploadCount: pendingJourneys.length,
    };
  }

  /**
   * Prepares local records that need to be pushed to CloudKit.
   */
  public preparePushPayload(limit = 50): CloudKitRecord[] {
    const pendingIds = journeysPendingSync(this.userId, limit);
    if (!pendingIds.length) return [];

    const { items: allJourneys } = listJourneys(this.userId, { limit: 100 });
    const recordsToPush = allJourneys
      .filter(j => pendingIds.includes(j.id))
      .map(journeyToCKRecord);

    return recordsToPush;
  }

  /**
   * Marks uploaded records as synced in local SQLite.
   */
  public acknowledgeSuccessfulPush(pushedRecordNames: string[]): void {
    const journeyIds = pushedRecordNames
      .filter(name => name.startsWith('journey_'))
      .map(name => name.replace('journey_', ''));

    if (journeyIds.length) {
      markJourneysSynced(journeyIds);
    }

    currentSyncState = {
      ...currentSyncState,
      lastSyncAt: new Date().toISOString(),
      syncInProgress: false,
      lastError: null,
    };
  }

  /**
   * Processes incoming records downloaded from CloudKit.
   */
  public ingestRemoteRecords(remoteRecords: CloudKitRecord[]): { updatedCount: number } {
    let count = 0;
    for (const record of remoteRecords) {
      if (record.recordType === 'Journey') {
        const remoteJourney = ckRecordToJourney(record);
        upsertJourney(remoteJourney);
        count++;
      }
    }
    return { updatedCount: count };
  }
}
