/**
 * cloudkit-sync.ts - Apple CloudKit Sync Engine
 * 
 * Manages private synchronization between on-device SQLite and the current
 * device iCloud account's CloudKit private database.
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
  LocalCollection,
  LocalMemory,
  journeysPendingSync,
  musicEntriesPendingSync,
  collectionsPendingSync,
  memoriesPendingSync,
  markJourneysSynced,
  markMusicEntriesSynced,
  markCollectionsSynced,
  markMemoriesSynced,
  upsertJourney,
  upsertMusicEntry,
  upsertCollection,
  upsertMemory,
  getJourney,
  listJourneys,
  listMusicEntries,
  listCollections,
  listMemories,
} from './local-store';

export type CloudKitRecordType = 'Journey' | 'MusicEntry' | 'Collection' | 'Memory';

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

const syncStates = new Map<LocalUserId, SyncState>();

function stateFor(userId: LocalUserId): SyncState {
  return syncStates.get(userId) ?? { lastSyncAt: null, syncInProgress: false, pendingUploadCount: 0, lastError: null };
}

// --- Mappers: SQLite <-> CloudKit -------------------------------------------

export function journeyToCKRecord(j: LocalJourney): CloudKitRecord {
  return {
    recordName: `journey_${j.id}`,
    recordType: 'Journey',
    fields: {
      id: j.id,
      legacyDriveId: j.legacyDriveId,
      startedAt: j.startedAt,
      endedAt: j.endedAt,
      durationMinutes: j.durationMinutes,
      miles: j.miles,
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

export function ckRecordToJourney(record: CloudKitRecord, userId: LocalUserId): LocalJourney {
  const f = record.fields;
  return {
    id: String(f.id),
    userId,
    legacyDriveId: f.legacyDriveId ? String(f.legacyDriveId) : null,
    startedAt: String(f.startedAt),
    endedAt: String(f.endedAt),
    durationMinutes: Number(f.durationMinutes) || 0,
    miles: Number(f.miles) || 0,
    startLat: null,
    startLng: null,
    endLat: null,
    endLng: null,
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

export function musicEntryToCKRecord(entry: LocalMusicEntry): CloudKitRecord {
  return {
    recordName: `music_${entry.id}`,
    recordType: 'MusicEntry',
    fields: {
      id: entry.id, journeyId: entry.journeyId, source: entry.source, playedAt: entry.playedAt,
      track: entry.track, artist: entry.artist, album: entry.album, durationMs: entry.durationMs,
      artworkUrl: entry.artworkUrl, externalUrl: entry.externalUrl, confidence: entry.confidence,
      createdAt: entry.createdAt, updatedAt: entry.createdAt,
    },
    modificationDate: entry.createdAt,
  };
}

export function ckRecordToMusicEntry(record: CloudKitRecord, userId: LocalUserId): LocalMusicEntry {
  const f = record.fields;
  return {
    id: String(f.id), userId, journeyId: f.journeyId ? String(f.journeyId) : null,
    source: String(f.source) as LocalMusicEntry['source'], playedAt: String(f.playedAt),
    track: String(f.track), artist: String(f.artist), album: f.album ? String(f.album) : null,
    durationMs: f.durationMs != null ? Number(f.durationMs) : null,
    artworkUrl: f.artworkUrl ? String(f.artworkUrl) : null, externalUrl: f.externalUrl ? String(f.externalUrl) : null,
    confidence: f.confidence != null ? Number(f.confidence) : null, syncedToCloud: 1,
    createdAt: String(f.createdAt || record.modificationDate || new Date().toISOString()),
  };
}

export function collectionToCKRecord(collection: LocalCollection): CloudKitRecord {
  return {
    recordName: `collection_${collection.id}`, recordType: 'Collection',
    fields: { id: collection.id, name: collection.name, description: collection.description, journeyIds: collection.journeyIds, createdAt: collection.createdAt, updatedAt: collection.updatedAt },
    modificationDate: collection.updatedAt,
  };
}

export function ckRecordToCollection(record: CloudKitRecord, userId: LocalUserId): LocalCollection {
  const f = record.fields;
  return {
    id: String(f.id), userId, name: String(f.name), description: f.description ? String(f.description) : null,
    journeyIds: String(f.journeyIds || '[]'), syncedToCloud: 1,
    createdAt: String(f.createdAt || record.modificationDate || new Date().toISOString()),
    updatedAt: String(f.updatedAt || record.modificationDate || new Date().toISOString()),
  };
}

export function memoryToCKRecord(memory: LocalMemory): CloudKitRecord {
  return {
    recordName: `memory_${memory.id}`, recordType: 'Memory',
    fields: { id: memory.id, name: memory.name, notes: memory.notes, artworkKey: memory.artworkKey, collectionIds: memory.collectionIds, createdAt: memory.createdAt, updatedAt: memory.updatedAt },
    modificationDate: memory.updatedAt,
  };
}

export function ckRecordToMemory(record: CloudKitRecord, userId: LocalUserId): LocalMemory {
  const f = record.fields;
  return {
    id: String(f.id), userId, name: String(f.name), notes: f.notes ? String(f.notes) : null,
    artworkKey: f.artworkKey ? String(f.artworkKey) : null, coverPhotoLocalPath: null,
    collectionIds: String(f.collectionIds || '[]'), syncedToCloud: 1,
    createdAt: String(f.createdAt || record.modificationDate || new Date().toISOString()),
    updatedAt: String(f.updatedAt || record.modificationDate || new Date().toISOString()),
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
    const current = stateFor(this.userId);
    return {
      ...current,
      pendingUploadCount: this.pendingCount(),
    };
  }

  public setSyncInProgress(): void {
    syncStates.set(this.userId, { ...stateFor(this.userId), syncInProgress: true, lastError: null, pendingUploadCount: this.pendingCount() });
  }

  public setSyncError(error: unknown): void {
    syncStates.set(this.userId, { ...stateFor(this.userId), syncInProgress: false, lastError: error instanceof Error ? error.message : 'Private iCloud sync failed.', pendingUploadCount: this.pendingCount() });
  }

  /**
   * Prepares local records that need to be pushed to CloudKit.
   */
  public preparePushPayload(limit = 50): CloudKitRecord[] {
    const pendingJourneyIds = journeysPendingSync(this.userId, limit);
    const pendingMusicIds = musicEntriesPendingSync(this.userId, limit);
    const pendingCollectionIds = collectionsPendingSync(this.userId, limit);
    const pendingMemoryIds = memoriesPendingSync(this.userId, limit);
    const { items: allJourneys } = listJourneys(this.userId, { limit: 100 });
    return [
      ...allJourneys.filter(item => pendingJourneyIds.includes(item.id)).map(journeyToCKRecord),
      ...listMusicEntries(this.userId, 500).filter(item => pendingMusicIds.includes(item.id)).map(musicEntryToCKRecord),
      ...listCollections(this.userId).filter(item => pendingCollectionIds.includes(item.id)).map(collectionToCKRecord),
      ...listMemories(this.userId).filter(item => pendingMemoryIds.includes(item.id)).map(memoryToCKRecord),
    ].slice(0, Math.max(1, Math.min(200, limit * 4)));
  }

  /**
   * Marks uploaded records as synced in local SQLite.
   */
  public acknowledgeSuccessfulPush(pushedRecordNames: string[]): void {
    const journeyIds = pushedRecordNames
      .filter(name => name.startsWith('journey_'))
      .map(name => name.replace('journey_', ''));

    if (journeyIds.length) {
      markJourneysSynced(this.userId, journeyIds);
    }
    markMusicEntriesSynced(this.userId, recordIds(pushedRecordNames, 'music_'));
    markCollectionsSynced(this.userId, recordIds(pushedRecordNames, 'collection_'));
    markMemoriesSynced(this.userId, recordIds(pushedRecordNames, 'memory_'));

    syncStates.set(this.userId, {
      ...stateFor(this.userId),
      lastSyncAt: new Date().toISOString(),
      syncInProgress: false,
      lastError: null,
      pendingUploadCount: this.pendingCount(),
    });
  }

  /**
   * Processes incoming records downloaded from CloudKit.
   */
  public ingestRemoteRecords(remoteRecords: CloudKitRecord[]): { updatedCount: number } {
    let count = 0;
    const priority: Record<CloudKitRecordType, number> = { Journey: 0, MusicEntry: 1, Collection: 2, Memory: 3 };
    for (const record of [...remoteRecords].sort((left, right) => priority[left.recordType] - priority[right.recordType])) {
      if (record.recordType === 'Journey') {
        const remoteJourney = ckRecordToJourney(record, this.userId);
        const localJourney = getJourney(this.userId, remoteJourney.id);
        const winner = localJourney ? resolveConflict(localJourney, remoteJourney) : remoteJourney;
        if (winner === remoteJourney) {
          upsertJourney(remoteJourney, {
            syncedToCloud: 1,
            createdAt: remoteJourney.createdAt,
            updatedAt: remoteJourney.updatedAt,
          });
          count++;
        }
      } else if (record.recordType === 'MusicEntry') {
        const entry = ckRecordToMusicEntry(record, this.userId);
        upsertMusicEntry(entry, { syncedToCloud: 1, createdAt: entry.createdAt });
        count++;
      } else if (record.recordType === 'Collection') {
        const remote = ckRecordToCollection(record, this.userId);
        const local = listCollections(this.userId).find(item => item.id === remote.id);
        if (!local || resolveConflict(local, remote) === remote) {
          upsertCollection(remote, { syncedToCloud: 1, createdAt: remote.createdAt, updatedAt: remote.updatedAt });
          count++;
        }
      } else if (record.recordType === 'Memory') {
        const remote = ckRecordToMemory(record, this.userId);
        const local = listMemories(this.userId).find(item => item.id === remote.id);
        if (!local || resolveConflict(local, remote) === remote) {
          upsertMemory(remote, { syncedToCloud: 1, createdAt: remote.createdAt, updatedAt: remote.updatedAt });
          count++;
        }
      }
    }
    return { updatedCount: count };
  }

  private pendingCount(): number {
    return journeysPendingSync(this.userId, 500).length + musicEntriesPendingSync(this.userId, 500).length +
      collectionsPendingSync(this.userId, 500).length + memoriesPendingSync(this.userId, 500).length;
  }
}

function recordIds(names: string[], prefix: string): string[] {
  return names.filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length));
}
