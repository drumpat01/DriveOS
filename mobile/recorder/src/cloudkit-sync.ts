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
 * 3. Exact GPS breadcrumbs sync only as integrity-checked private CloudKit assets.
 * 4. Conflict resolution is revision-first for private mutable content and routes.
 * 5. Sync runs non-blockingly in the background.
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import {
  LocalUserId,
  LocalJourney,
  LocalMusicEntry,
  LocalMemory,
  LocalPhoto,
  LocalPrivatePreference,
  LocalRouteArchive,
  journeysPendingSync,
  musicEntriesPendingSync,
  memoriesPendingSync,
  photosPendingSync,
  preferencesPendingSync,
  routeArchivesPendingSync,
  markJourneysSynced,
  markMusicEntriesSynced,
  markMemoryRevisionsSynced,
  markPhotoRevisionsSynced,
  markPreferenceRevisionsSynced,
  markRouteArchiveRevisionsSynced,
  upsertJourney,
  upsertMusicEntry,
  upsertMemory,
  upsertPhoto,
  upsertPrivatePreference,
  getJourney,
  getMemoryIncludingDeleted,
  getMusicEntry,
  getPhotoIncludingDeleted,
  listMemoriesIncludingDeleted,
  listPhotosIncludingDeleted,
  listPrivatePreferences,
  listJourneyGpsPoints,
  getRouteArchive,
  replaceJourneyGpsPointsFromCloud,
  quarantineCloudDeletions,
} from './local-store';
import { resolveVersionedPrivateConflict } from './private-content-conflicts';
import { parseRouteArchive, ROUTE_ARCHIVE_FORMAT_VERSION, serializeRouteArchive } from './route-archive';
import { isDirectJourneyMemoryId } from './memory-model';

export type CloudKitRecordType = 'Journey' | 'RouteArchive' | 'MusicEntry' | 'Collection' | 'Memory' | 'Photo' | 'PrivatePreference';

export interface CloudKitRecord {
  recordName: string;
  recordType: CloudKitRecordType;
  fields: Record<string, any>;
  assetFilePath?: string;
  modificationDate?: string;
}

export interface SyncState {
  lastSyncAt: string | null;
  syncInProgress: boolean;
  pendingUploadCount: number;
  lastError: string | null;
}

const syncStates = new Map<LocalUserId, SyncState>();

async function routeStagingDirectory(userId: LocalUserId): Promise<string> {
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error('JourneyDeck could not access its private route staging directory.');
  const profileDigest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, userId);
  return `${base}journeydeck-private-route-assets/${profileDigest}/`;
}

export async function deletePrivateRouteStagingAssets(userId: LocalUserId): Promise<void> {
  await FileSystem.deleteAsync(await routeStagingDirectory(userId), { idempotent: true });
}

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

export async function routeArchiveToCKRecord(archive: LocalRouteArchive): Promise<CloudKitRecord> {
  const points = listJourneyGpsPoints(archive.userId, archive.journeyId);
  if (points.length !== archive.pointCount) throw new Error('The local route changed while its private backup was being prepared.');
  const payload = serializeRouteArchive(archive.journeyId, points);
  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  const directory = await routeStagingDirectory(archive.userId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  // One stable staging file per journey prevents old route revisions from
  // accumulating in the app cache between iOS cache-pruning cycles.
  const journeyDigest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, archive.journeyId);
  const assetFilePath = `${directory}${journeyDigest}.json`;
  await FileSystem.writeAsStringAsync(assetFilePath, payload, { encoding: FileSystem.EncodingType.UTF8 });
  return {
    recordName: `route_${archive.journeyId}`,
    recordType: 'RouteArchive',
    assetFilePath,
    fields: {
      journeyId: archive.journeyId,
      formatVersion: ROUTE_ARCHIVE_FORMAT_VERSION,
      pointCount: archive.pointCount,
      sha256: checksum,
      deletedAt: null,
      syncRevision: archive.syncRevision,
      updatedAt: archive.updatedAt,
    },
    modificationDate: archive.updatedAt,
  };
}

async function readRouteArchiveRecord(record: CloudKitRecord): Promise<{
  journeyId: string;
  points: ReturnType<typeof parseRouteArchive>;
  syncRevision: number;
  updatedAt: string;
}> {
  const fields = record.fields;
  const journeyId = String(fields.journeyId || '');
  const pointCount = Number(fields.pointCount);
  const syncRevision = Math.max(1, Math.trunc(Number(fields.syncRevision) || 1));
  const updatedAt = String(fields.updatedAt || record.modificationDate || '');
  const expectedChecksum = String(fields.sha256 || '').toLowerCase();
  if (!journeyId || Number(fields.formatVersion) !== ROUTE_ARCHIVE_FORMAT_VERSION || !Number.isInteger(pointCount)
    || pointCount < 1 || !Number.isFinite(Date.parse(updatedAt)) || !/^[a-f0-9]{64}$/.test(expectedChecksum)
    || !record.assetFilePath) throw new Error('A private route backup record is incomplete.');
  const payload = await FileSystem.readAsStringAsync(record.assetFilePath, { encoding: FileSystem.EncodingType.UTF8 });
  const actualChecksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  if (actualChecksum.toLowerCase() !== expectedChecksum) throw new Error('A private route backup failed its integrity check.');
  return { journeyId, points: parseRouteArchive(payload, journeyId, pointCount), syncRevision, updatedAt };
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

export function memoryToCKRecord(memory: LocalMemory): CloudKitRecord {
  return {
    recordName: `memory_${memory.id}`, recordType: 'Memory',
    // CloudKit keeps the deployed field name, but the value is now direct Journey membership.
    fields: { id: memory.id, name: memory.name, notes: memory.notes, artworkKey: memory.artworkKey, coverPhotoId: memory.coverPhotoId, collectionIds: memory.journeyIds, deletedAt: memory.deletedAt, syncRevision: memory.syncRevision, createdAt: memory.createdAt, updatedAt: memory.updatedAt },
    modificationDate: memory.updatedAt,
  };
}

export function ckRecordToMemory(record: CloudKitRecord, userId: LocalUserId): LocalMemory {
  const f = record.fields;
  return {
    id: String(f.id), userId, name: String(f.name), notes: f.notes ? String(f.notes) : null,
    artworkKey: f.artworkKey ? String(f.artworkKey) : null, coverPhotoId: f.coverPhotoId ? String(f.coverPhotoId) : null, coverPhotoLocalPath: null,
    journeyIds: String(f.collectionIds || '[]'), syncedToCloud: 1,
    deletedAt: f.deletedAt ? String(f.deletedAt) : null,
    syncRevision: Math.max(1, Number(f.syncRevision) || 1),
    createdAt: String(f.createdAt || record.modificationDate || new Date().toISOString()),
    updatedAt: String(f.updatedAt || record.modificationDate || new Date().toISOString()),
  };
}

export function photoToCKRecord(photo: LocalPhoto): CloudKitRecord {
  return {
    recordName: `photo_${photo.id}`,
    recordType: 'Photo',
    assetFilePath: photo.deletedAt ? undefined : photo.localUri,
    fields: {
      id: photo.id, source: photo.source, collectionId: photo.collectionId, memoryId: photo.memoryId,
      fileName: photo.fileName, contentType: photo.contentType, byteLength: photo.byteLength,
      deletedAt: photo.deletedAt, syncRevision: photo.syncRevision, createdAt: photo.createdAt, updatedAt: photo.updatedAt,
    },
    modificationDate: photo.updatedAt,
  };
}

export function ckRecordToPhoto(record: CloudKitRecord, userId: LocalUserId): LocalPhoto {
  const f = record.fields, source = String(f.source) === 'collection' ? 'collection' : 'memory';
  return {
    id: String(f.id), userId, source,
    collectionId: source === 'collection' && f.collectionId ? String(f.collectionId) : null,
    memoryId: source === 'memory' && f.memoryId ? String(f.memoryId) : null,
    fileName: String(f.fileName || 'journeydeck-photo.jpg'),
    contentType: ['image/png', 'image/webp'].includes(String(f.contentType)) ? String(f.contentType) as LocalPhoto['contentType'] : 'image/jpeg',
    byteLength: Math.max(0, Number(f.byteLength) || 0), localUri: record.assetFilePath ?? '', syncedToCloud: 1,
    deletedAt: f.deletedAt ? String(f.deletedAt) : null, syncRevision: Math.max(1, Number(f.syncRevision) || 1),
    createdAt: String(f.createdAt || record.modificationDate || new Date().toISOString()),
    updatedAt: String(f.updatedAt || record.modificationDate || new Date().toISOString()),
  };
}

export function preferenceToCKRecord(preference: LocalPrivatePreference): CloudKitRecord {
  return {
    recordName: `preference_${encodeURIComponent(preference.key)}`, recordType: 'PrivatePreference',
    fields: { key: preference.key, valueJson: preference.valueJson, deletedAt: preference.deletedAt, syncRevision: preference.syncRevision, createdAt: preference.createdAt, updatedAt: preference.updatedAt },
    modificationDate: preference.updatedAt,
  };
}

export function ckRecordToPreference(record: CloudKitRecord, userId: LocalUserId): LocalPrivatePreference {
  const f = record.fields;
  return {
    userId, key: String(f.key), valueJson: String(f.valueJson || 'null'), syncedToCloud: 1,
    deletedAt: f.deletedAt ? String(f.deletedAt) : null, syncRevision: Math.max(1, Number(f.syncRevision) || 1),
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

export function resolvePrivateConflict<T extends { updatedAt: string; syncRevision: number; deletedAt: string | null }>(local: T, remote: T): T {
  return resolveVersionedPrivateConflict(local, remote);
}

// --- Sync Engine ------------------------------------------------------------

export class CloudKitSyncEngine {
  private userId: LocalUserId;
  private privateContentV2: boolean;
  private privateRouteAssets: boolean;
  private preparedRevisions = new Map<string, number>();

  constructor(userId: LocalUserId, options: { privateContentV2?: boolean; privateRouteAssets?: boolean } = {}) {
    this.userId = userId;
    this.privateContentV2 = options.privateContentV2 === true;
    this.privateRouteAssets = options.privateRouteAssets === true;
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
  public async preparePushPayload(limit = 50): Promise<CloudKitRecord[]> {
    const pendingJourneyIds = journeysPendingSync(this.userId, limit);
    const pendingMusicIds = musicEntriesPendingSync(this.userId, limit);
    const pendingMemoryIds = memoriesPendingSync(this.userId, limit).filter(isDirectJourneyMemoryId);
    const pendingPhotoIds = this.privateContentV2 ? photosPendingSync(this.userId, limit) : [];
    const pendingPreferenceKeys = this.privateContentV2 ? preferencesPendingSync(this.userId, limit) : [];
    const pendingRoutes = this.privateRouteAssets ? routeArchivesPendingSync(this.userId, Math.min(10, limit)) : [];
    const pendingJourneys = pendingJourneyIds.map(id => getJourney(this.userId, id)).filter((item): item is LocalJourney => Boolean(item));
    const pendingMusic = pendingMusicIds.map(id => getMusicEntry(this.userId, id)).filter((item): item is LocalMusicEntry => Boolean(item));
    const memories = listMemoriesIncludingDeleted(this.userId).filter(item => pendingMemoryIds.includes(item.id) && (this.privateContentV2 || !item.deletedAt));
    const memoryPhotos = listPhotosIncludingDeleted(this.userId).filter(item => item.source === 'memory' && isDirectJourneyMemoryId(item.memoryId) && pendingPhotoIds.includes(item.id));
    const routeRecords = await Promise.all(pendingRoutes.map(routeArchiveToCKRecord));
    const records = [
      ...pendingJourneys.map(journeyToCKRecord),
      ...routeRecords,
      ...pendingMusic.map(musicEntryToCKRecord),
      ...memories.map(memoryToCKRecord),
      ...memoryPhotos.map(photoToCKRecord),
      ...listPrivatePreferences(this.userId, true).filter(item => pendingPreferenceKeys.includes(item.key)).map(preferenceToCKRecord),
    ].slice(0, Math.max(1, Math.min(200, limit * 4)));
    for (const record of records) {
      const revision = Number(record.fields.syncRevision);
      if (Number.isFinite(revision)) this.preparedRevisions.set(record.recordName, revision);
      if (!this.privateContentV2 && record.recordType === 'Memory') {
        delete record.fields.deletedAt;
        delete record.fields.syncRevision;
        if (record.recordType === 'Memory') delete record.fields.coverPhotoId;
      }
    }
    return records;
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
    markMemoryRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'memory_', this.preparedRevisions));
    markPhotoRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'photo_', this.preparedRevisions));
    markPreferenceRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'preference_', this.preparedRevisions, true));
    markRouteArchiveRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'route_', this.preparedRevisions));
    for (const name of pushedRecordNames) this.preparedRevisions.delete(name);

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
  public async ingestRemoteRecords(remoteRecords: CloudKitRecord[]): Promise<{ updatedCount: number }> {
    let count = 0;
    const priority: Record<CloudKitRecordType, number> = { Journey: 0, RouteArchive: 1, MusicEntry: 2, Collection: 3, Memory: 4, Photo: 5, PrivatePreference: 6 };
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
      } else if (record.recordType === 'RouteArchive') {
        const remote = await readRouteArchiveRecord(record);
        const local = getRouteArchive(this.userId, remote.journeyId);
        if (!local) continue;
        const remoteVersion = { updatedAt: remote.updatedAt, syncRevision: remote.syncRevision, deletedAt: null };
        const localVersion = { updatedAt: local.updatedAt, syncRevision: local.syncRevision, deletedAt: null };
        if (local.pointCount > 0 && resolvePrivateConflict(localVersion, remoteVersion) !== remoteVersion) continue;
        replaceJourneyGpsPointsFromCloud(this.userId, remote.journeyId, remote.points, remote.syncRevision, remote.updatedAt);
        count++;
      } else if (record.recordType === 'MusicEntry') {
        const entry = ckRecordToMusicEntry(record, this.userId);
        upsertMusicEntry(entry, { syncedToCloud: 1, createdAt: entry.createdAt });
        count++;
      } else if (record.recordType === 'Memory') {
        const remote = ckRecordToMemory(record, this.userId);
        if (!isDirectJourneyMemoryId(remote.id)) continue;
        const local = getMemoryIncludingDeleted(this.userId, remote.id);
        if (!local || resolvePrivateConflict(local, remote) === remote) {
          upsertMemory(remote, { syncedToCloud: 1, deletedAt: remote.deletedAt, syncRevision: remote.syncRevision, createdAt: remote.createdAt, updatedAt: remote.updatedAt });
          count++;
        }
      } else if (record.recordType === 'Photo') {
        const remote = ckRecordToPhoto(record, this.userId), local = getPhotoIncludingDeleted(this.userId, remote.id);
        if (remote.source !== 'memory' || !isDirectJourneyMemoryId(remote.memoryId)) continue;
        if ((!local && !remote.deletedAt && !remote.localUri) || (local && resolvePrivateConflict(local, remote) !== remote)) continue;
        if (!remote.localUri && local) remote.localUri = local.localUri;
        upsertPhoto(remote, { syncedToCloud: 1, deletedAt: remote.deletedAt, syncRevision: remote.syncRevision, createdAt: remote.createdAt, updatedAt: remote.updatedAt });
        count++;
      } else if (record.recordType === 'PrivatePreference') {
        const remote = ckRecordToPreference(record, this.userId);
        const local = listPrivatePreferences(this.userId, true).find(item => item.key === remote.key);
        if (local && resolvePrivateConflict(local, remote) !== remote) continue;
        let value: unknown = null;
        try { value = JSON.parse(remote.valueJson); } catch { continue; }
        upsertPrivatePreference(this.userId, remote.key, value, { syncedToCloud: 1, deletedAt: remote.deletedAt, syncRevision: remote.syncRevision, createdAt: remote.createdAt, updatedAt: remote.updatedAt });
        count++;
      }
    }
    return { updatedCount: count };
  }

  public ingestRemoteDeletions(recordNames: string[]): void {
    // App-originated deletes are synced as versioned tombstones. A physical
    // CloudKit deletion has no application revision, so quarantine it and
    // re-queue any surviving local row instead of erasing the only copy.
    quarantineCloudDeletions(this.userId, recordNames);
  }

  private pendingCount(): number {
    const pendingPhotoIds = new Set(photosPendingSync(this.userId, 500));
    const pendingMemoryPhotoCount = listPhotosIncludingDeleted(this.userId)
      .filter(item => item.source === 'memory' && isDirectJourneyMemoryId(item.memoryId) && pendingPhotoIds.has(item.id)).length;
    const pendingDirectMemoryCount = memoriesPendingSync(this.userId, 500).filter(isDirectJourneyMemoryId).length;
    return journeysPendingSync(this.userId, 500).length + musicEntriesPendingSync(this.userId, 500).length +
      pendingDirectMemoryCount + pendingMemoryPhotoCount + preferencesPendingSync(this.userId, 500).length +
      (this.privateRouteAssets ? routeArchivesPendingSync(this.userId, 25).length : 0);
  }

  public setSyncCompleted(): void {
    syncStates.set(this.userId, {
      ...stateFor(this.userId),
      lastSyncAt: new Date().toISOString(),
      syncInProgress: false,
      lastError: null,
      pendingUploadCount: this.pendingCount(),
    });
  }
}

function recordIds(names: string[], prefix: string): string[] {
  return names.filter(name => name.startsWith(prefix)).map(name => name.slice(prefix.length));
}

function revisionAcks(names: string[], prefix: string, revisions: Map<string, number>, decode = false): Array<{ id: string; syncRevision: number }> {
  return names.filter(name => name.startsWith(prefix) && revisions.has(name)).map(name => ({
    id: decode ? decodeURIComponent(name.slice(prefix.length)) : name.slice(prefix.length),
    syncRevision: revisions.get(name)!,
  }));
}
