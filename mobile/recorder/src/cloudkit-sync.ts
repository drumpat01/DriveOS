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
  preparePrivatePlaceSync,
  privateCloudPlaceId,
  getPlace,
  upsertPlace,
  deletePlace,
  isEditorManagedJourney,
  isEditorManagedMusic,
} from './local-store';
import { PRIVATE_PLACE_PREFIX, parsePrivatePlace } from './private-place-record';
import { resolvePrivatePhotoFile } from './private-photo-file';
import { resolveVersionedPrivateConflict } from './private-content-conflicts';
import { parseRouteArchive, ROUTE_ARCHIVE_FORMAT_VERSION, serializeRouteArchive } from './route-archive';
import { isDirectJourneyMemoryId } from './memory-model';
import { acknowledgeJourneyEdits, ingestJourneyEdit, journeyEditsPendingSync, listJourneyEditConflicts, requeueDeletedJourneyEdits,
  MAX_JOURNEY_EDIT_ASSET_BYTES, parseJourneyEditPayload, type StoredJourneyEdit } from './journey-editor-store';

export type CloudKitRecordType = 'Journey' | 'RouteArchive' | 'JourneyEdit' | 'MusicEntry' | 'Collection' | 'Memory' | 'Photo' | 'PrivatePreference';

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

export async function journeyEditToCKRecord(userId: LocalUserId, edit: StoredJourneyEdit): Promise<CloudKitRecord> {
  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, edit.payload);
  const directory = await routeStagingDirectory(userId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  // Operations and asset names are immutable, including while a push awaits.
  const assetFilePath = `${directory}edit-${checksum}.json`;
  await FileSystem.writeAsStringAsync(assetFilePath, edit.payload, { encoding: FileSystem.EncodingType.UTF8 });
  return { recordName: `edit_${edit.id}`, recordType: 'JourneyEdit', assetFilePath,
    fields: { id: edit.id, rootJourneyId: edit.rootJourneyId, parentId: edit.parentId, formatVersion: 1, sha256: checksum, syncRevision: 1, updatedAt: edit.createdAt },
    modificationDate: edit.createdAt };
}

async function readJourneyEditRecord(record: CloudKitRecord, userId: LocalUserId): Promise<string> {
  if (Number(record.fields.formatVersion) !== 1 || !record.assetFilePath || !/^[a-f0-9]{64}$/.test(String(record.fields.sha256))) {
    throw new Error('A private journey edit is missing its recovery asset.');
  }
  const info = await FileSystem.getInfoAsync(record.assetFilePath);
  if (!info.exists || !('size' in info) || info.size <= 0 || info.size > MAX_JOURNEY_EDIT_ASSET_BYTES) throw new Error('The private journey edit file is missing or too large.');
  const raw = await FileSystem.readAsStringAsync(record.assetFilePath, { encoding: FileSystem.EncodingType.UTF8 });
  const checksum = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  if (checksum !== record.fields.sha256) throw new Error('The private journey edit failed its integrity check.');
  const operation = parseJourneyEditPayload(raw, userId);
  if (operation.id !== record.fields.id || `edit_${operation.id}` !== record.recordName || operation.rootJourneyId !== record.fields.rootJourneyId
    || operation.parentId !== (record.fields.parentId ?? null)) {
    throw new Error('The private journey edit identity does not match its recovery asset.');
  }
  return raw;
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
      startPlaceId: privateCloudPlaceId(j.userId, j.startPlaceId),
      endPlaceId: privateCloudPlaceId(j.userId, j.endPlaceId),
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
    updatedAt: String(f.updatedAt || record.modificationDate || new Date().toISOString()),
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
  private privateJourneyEdits: boolean;
  private preparedRevisions = new Map<string, number>();
  private preparedSnapshots = new Map<string, string>();
  private preparationFailures = new Set<string>();
  private issues = new Map<string, string>();

  constructor(userId: LocalUserId, options: { privateContentV2?: boolean; privateRouteAssets?: boolean; privateJourneyEdits?: boolean } = {}) {
    this.userId = userId;
    this.privateContentV2 = options.privateContentV2 === true;
    this.privateRouteAssets = options.privateRouteAssets === true;
    this.privateJourneyEdits = options.privateJourneyEdits === true;
  }

  public getSyncState(): SyncState {
    const current = stateFor(this.userId);
    return {
      ...current,
      pendingUploadCount: this.pendingCount(),
    };
  }

  public setSyncInProgress(): void {
    if (this.privateContentV2) preparePrivatePlaceSync(this.userId);
    syncStates.set(this.userId, { ...stateFor(this.userId), syncInProgress: true, lastError: null, pendingUploadCount: this.pendingCount() });
  }

  public setSyncError(error: unknown): void {
    syncStates.set(this.userId, { ...stateFor(this.userId), syncInProgress: false, lastError: error instanceof Error ? error.message : 'Private iCloud sync failed.', pendingUploadCount: this.pendingCount() });
  }

  /**
   * Prepares local records that need to be pushed to CloudKit.
   */
  public async preparePushPayload(limit = 50): Promise<CloudKitRecord[]> {
    if (this.privateContentV2) preparePrivatePlaceSync(this.userId);
    const pendingJourneyIds = journeysPendingSync(this.userId, limit);
    const pendingMusicIds = musicEntriesPendingSync(this.userId, limit);
    const pendingMemoryIds = memoriesPendingSync(this.userId, limit).filter(isDirectJourneyMemoryId);
    const pendingPreferenceKeys = this.privateContentV2 ? preferencesPendingSync(this.userId, limit) : [];
    const pendingRoutes = this.privateRouteAssets ? routeArchivesPendingSync(this.userId, Math.min(10, limit)) : [];
    const pendingJourneys = pendingJourneyIds.map(id => getJourney(this.userId, id)).filter((item): item is LocalJourney => Boolean(item));
    const pendingMusic = pendingMusicIds.map(id => getMusicEntry(this.userId, id)).filter((item): item is LocalMusicEntry => Boolean(item));
    const memories = listMemoriesIncludingDeleted(this.userId).filter(item => pendingMemoryIds.includes(item.id) && (this.privateContentV2 || !item.deletedAt));
    const memoryPhotos = this.privateContentV2 ? listPhotosIncludingDeleted(this.userId).filter(item =>
      item.source === 'memory' && isDirectJourneyMemoryId(item.memoryId) && !item.syncedToCloud
      && !this.preparationFailures.has(`photo_${item.id}`)) : [];
    const memoryPhotoRecords: CloudKitRecord[] = [];
    for (const photo of memoryPhotos) {
      if (memoryPhotoRecords.length >= limit) break;
      if (!photo.deletedAt) {
        const file = await resolvePrivatePhotoFile(photo);
        if (file.status !== 'available') {
          this.preparationFailures.add(`photo_${photo.id}`);
          this.recordUploadFailure(`photo_${photo.id}`, `local_photo_${file.status}`);
          continue;
        }
        photo.localUri = file.localUri;
      }
      memoryPhotoRecords.push(photoToCKRecord(photo));
    }
    const routeRecords = await Promise.all(pendingRoutes.map(routeArchiveToCKRecord));
    const editRecords = this.privateJourneyEdits ? await Promise.all(journeyEditsPendingSync(this.userId, 4).map(edit => journeyEditToCKRecord(this.userId, edit))) : [];
    const records = [
      ...editRecords,
      ...listPrivatePreferences(this.userId, true).filter(item => pendingPreferenceKeys.includes(item.key)).map(preferenceToCKRecord),
      ...pendingJourneys.map(journeyToCKRecord),
      ...routeRecords,
      ...pendingMusic.map(musicEntryToCKRecord),
      ...memories.map(memoryToCKRecord),
      ...memoryPhotoRecords,
    ].filter(record => {
      // Preparing assets yields to JavaScript. An edit committed during that
      // wait takes ownership of the whole projection before these rows leave.
      if (record.recordType === 'Journey') return !isEditorManagedJourney(this.userId, String(record.fields.id));
      if (record.recordType === 'RouteArchive') return !isEditorManagedJourney(this.userId, String(record.fields.journeyId));
      if (record.recordType === 'MusicEntry') return !isEditorManagedMusic(this.userId, String(record.fields.id));
      return true;
    }).slice(0, Math.max(1, Math.min(200, limit * 4)));
    for (const record of records) {
      // Journey/music have no application revision in the deployed schema.
      // Retain the exact wire content, not just an ID or timestamp: enrichment
      // can update a row while the native upload is awaiting the network.
      if (record.recordType === 'Journey' || record.recordType === 'MusicEntry') {
        this.preparedSnapshots.set(record.recordName, JSON.stringify(record.fields));
      }
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

  public getPreparationFailureCount(): number {
    return this.preparationFailures.size;
  }

  /** Local UI only: never include file paths, coordinates, tokens, or raw native errors. */
  public recordUploadFailure(recordName: string, code: string): void {
    const reasons: Record<string, string> = {
      local_photo_missing: 'The saved photo file is missing on this device. Repeated Sync taps cannot upload a missing file.',
      local_photo_unreadable: 'The saved photo file could not be checked on this device.',
      local_photo_empty: 'The saved photo file is empty on this device.',
      network_failure: 'The connection failed during upload.',
      network_unavailable: 'A network connection is unavailable.',
      rate_limited: 'iCloud asked JourneyDeck to wait before retrying.',
      service_unavailable: 'The iCloud service is temporarily unavailable.',
      zone_busy: 'iCloud is busy processing this library.',
      account_temporarily_unavailable: 'The iCloud account is temporarily unavailable.',
      not_authenticated: 'iCloud requires account authentication.',
      quota_exceeded: 'The iCloud account has insufficient storage.',
      permission_failure: 'iCloud denied permission to upload this item.',
      limit_exceeded: 'This item exceeded an iCloud service limit.',
      asset_missing: 'iCloud could not access the file for this item.',
      asset_modified: 'The file changed while it was uploading.',
      server_record_changed: 'Another device changed this item during sync.',
      unversioned_local_conflict: 'A local edit is kept safely on this device. iCloud has different data without a newer reliable version; this item needs a sync-conflict review.',
      journey_edit_conflict: 'Two devices edited the same original. Both edits are preserved; open Journey Editing Studio to review the conflict before making further changes.',
      missing_dependency: 'A related place, journey, or Memory has not arrived yet. Sync the source device, then try again here.',
    };
    const reason = reasons[code] ?? (/^cloudkit_\d{1,4}$/.test(code) ? `iCloud returned error ${code.slice(9)}.` : 'iCloud did not provide a specific reason for this item.');
    // A stable reference identifies the item without exposing its raw record ID.
    let hash = 2166136261;
    for (const character of recordName) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    const reference = (hash >>> 0).toString(16).padStart(8, '0');
    let label = 'Library item';
    if (recordName.startsWith('photo_')) {
      const photo = getPhotoIncludingDeleted(this.userId, recordName.slice(6));
      const memory = photo?.memoryId ? getMemoryIncludingDeleted(this.userId, photo.memoryId) : null;
      const photos = photo?.memoryId ? listPhotosIncludingDeleted(this.userId).filter(item => item.memoryId === photo.memoryId && !item.deletedAt) : [];
      const position = photos.findIndex(item => item.id === photo?.id);
      label = `${photo?.deletedAt ? 'Removed photo' : position >= 0 ? `Photo ${position + 1}` : 'Photo'}${memory ? ` in “${memory.name.replace(/\s+/g, ' ').slice(0, 70)}”` : ''}`;
    } else if (recordName.startsWith('music_')) {
      const song = getMusicEntry(this.userId, recordName.slice(6));
      label = song ? `Song “${song.track.replace(/\s+/g, ' ').slice(0, 70)}”` : 'Song';
    } else if (recordName.startsWith('journey_')) label = 'Journey';
    else if (recordName.startsWith('route_')) label = 'Journey route';
    else if (recordName.startsWith('memory_')) {
      const memory = getMemoryIncludingDeleted(this.userId, recordName.slice(7));
      label = memory ? `Memory “${memory.name.replace(/\s+/g, ' ').slice(0, 70)}”` : 'Memory';
    } else if (recordName.startsWith('preference_library.place.v1.')) label = 'Saved place';
    else if (recordName.startsWith('preference_')) label = 'Private preference';
    this.issues.set(recordName, `${label} · Ref ${reference}\n${reason}`);
  }

  public getIssueDetails(): string[] {
    for (const conflict of listJourneyEditConflicts(this.userId)) this.recordUploadFailure(`edit_${conflict.id}`, 'journey_edit_conflict');
    const details = [...this.issues.values()].slice(0, 5);
    if (this.issues.size > 5) details.push(`${this.issues.size - 5} more items need attention.`);
    return details;
  }

  /**
   * Marks uploaded records as synced in local SQLite.
   */
  public acknowledgeSuccessfulPush(pushedRecordNames: string[]): void {
    const journeyIds = pushedRecordNames
      .filter(name => name.startsWith('journey_'))
      .filter(name => {
        const current = getJourney(this.userId, name.slice(8));
        return current && this.preparedSnapshots.get(name) === JSON.stringify(journeyToCKRecord(current).fields);
      })
      .map(name => name.slice(8));

    if (journeyIds.length) {
      markJourneysSynced(this.userId, journeyIds);
    }
    const musicIds = pushedRecordNames.filter(name => name.startsWith('music_')).filter(name => {
      const current = getMusicEntry(this.userId, name.slice(6));
      return current && this.preparedSnapshots.get(name) === JSON.stringify(musicEntryToCKRecord(current).fields);
    }).map(name => name.slice(6));
    // These reads and acknowledgements are synchronous on the one master
    // SQLite owner, so a JavaScript edit cannot interleave between them.
    markMusicEntriesSynced(this.userId, musicIds);
    markMemoryRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'memory_', this.preparedRevisions));
    markPhotoRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'photo_', this.preparedRevisions));
    markPreferenceRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'preference_', this.preparedRevisions, true));
    markRouteArchiveRevisionsSynced(this.userId, revisionAcks(pushedRecordNames, 'route_', this.preparedRevisions));
    acknowledgeJourneyEdits(this.userId, revisionAcks(pushedRecordNames, 'edit_', this.preparedRevisions).map(ack => ack.id));
    for (const name of pushedRecordNames) {
      this.preparedRevisions.delete(name);
      this.preparedSnapshots.delete(name);
    }

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
  public async ingestRemoteRecords(remoteRecords: CloudKitRecord[], assertProfileCurrent: () => void = () => {}): Promise<{ updatedCount: number; deferredCount: number }> {
    let count = 0;
    let deferredCount = 0;
    const priority: Record<CloudKitRecordType, number> = { Journey: 0, RouteArchive: 1, JourneyEdit: 2, MusicEntry: 3, Collection: 4, Memory: 5, Photo: 6, PrivatePreference: -1 };
    const editsById = new Map(remoteRecords.filter(record => record.recordType === 'JourneyEdit').map(record => [String(record.fields.id), record]));
    const editDepth = (record: CloudKitRecord, seen = new Set<string>()): number => {
      const parentId = String(record.fields.parentId ?? '');
      if (!parentId || seen.has(parentId) || seen.size >= 256 || !editsById.has(parentId)) return 0;
      seen.add(parentId);
      return 1 + editDepth(editsById.get(parentId)!, seen);
    };
    for (const record of [...remoteRecords].sort((left, right) => priority[left.recordType] - priority[right.recordType]
      || (left.recordType === 'JourneyEdit' ? editDepth(left) - editDepth(right) : 0))) {
      assertProfileCurrent();
      if (record.recordType === 'Journey') {
        const remoteJourney = ckRecordToJourney(record, this.userId);
        if (isEditorManagedJourney(this.userId, remoteJourney.id)) continue;
        const localJourney = getJourney(this.userId, remoteJourney.id);
        const winner = localJourney ? resolveConflict(localJourney, remoteJourney) : remoteJourney;
        if (winner === remoteJourney) {
          const start = remoteJourney.startPlaceId ? getPlace(this.userId, remoteJourney.startPlaceId) : null;
          const end = remoteJourney.endPlaceId ? getPlace(this.userId, remoteJourney.endPlaceId) : null;
          if ((remoteJourney.startPlaceId && !start) || (remoteJourney.endPlaceId && !end)) {
            this.recordUploadFailure(record.recordName, 'missing_dependency');
            deferredCount++;
            continue;
          }
          remoteJourney.startPlaceId = start?.id ?? null;
          remoteJourney.endPlaceId = end?.id ?? null;
          // Resolve incoming place identities before comparing wire content:
          // an out-of-order dependency must defer this record, not abort the batch.
          if (localJourney && !localJourney.syncedToCloud
            && Date.parse(localJourney.updatedAt) === Date.parse(remoteJourney.updatedAt)
            && JSON.stringify(journeyToCKRecord(localJourney).fields) !== JSON.stringify(journeyToCKRecord(remoteJourney).fields)) {
            this.recordUploadFailure(record.recordName, 'unversioned_local_conflict');
            deferredCount++;
            continue;
          }
          upsertJourney(remoteJourney, {
            syncedToCloud: 1,
            createdAt: remoteJourney.createdAt,
            updatedAt: remoteJourney.updatedAt,
          });
          count++;
        }
      } else if (record.recordType === 'RouteArchive') {
        if (isEditorManagedJourney(this.userId, String(record.fields.journeyId))) continue;
        const remote = await readRouteArchiveRecord(record);
        assertProfileCurrent();
        const local = getRouteArchive(this.userId, remote.journeyId);
        if (!local) { this.recordUploadFailure(record.recordName, 'missing_dependency'); deferredCount++; continue; }
        const remoteVersion = { updatedAt: remote.updatedAt, syncRevision: remote.syncRevision, deletedAt: null };
        const localVersion = { updatedAt: local.updatedAt, syncRevision: local.syncRevision, deletedAt: null };
        if (local.pointCount > 0 && resolvePrivateConflict(localVersion, remoteVersion) !== remoteVersion) continue;
        replaceJourneyGpsPointsFromCloud(this.userId, remote.journeyId, remote.points, remote.syncRevision, remote.updatedAt);
        count++;
      } else if (record.recordType === 'JourneyEdit') {
        const raw = await readJourneyEditRecord(record, this.userId);
        assertProfileCurrent();
        const result = ingestJourneyEdit(this.userId, raw);
        if (result === 'deferred') { this.recordUploadFailure(record.recordName, 'missing_dependency'); deferredCount++; }
        else if (result === 'conflict') this.recordUploadFailure(record.recordName, 'journey_edit_conflict');
        else if (result === 'applied') count++;
      } else if (record.recordType === 'MusicEntry') {
        const entry = ckRecordToMusicEntry(record, this.userId);
        if (isEditorManagedMusic(this.userId, entry.id)) continue;
        const local = getMusicEntry(this.userId, entry.id);
        // The deployed MusicEntry schema uses createdAt as updatedAt. It cannot
        // order later artwork/enrichment edits. Preserve dirty local content
        // and report the conflict rather than silently replacing the only copy.
        if (local && !local.syncedToCloud
          && JSON.stringify(musicEntryToCKRecord(local).fields) !== JSON.stringify(musicEntryToCKRecord(entry).fields)) {
          this.recordUploadFailure(record.recordName, 'unversioned_local_conflict');
          deferredCount++;
          continue;
        }
        if (entry.journeyId && !getJourney(this.userId, entry.journeyId)) { this.recordUploadFailure(record.recordName, 'missing_dependency'); deferredCount++; continue; }
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
        if (remote.memoryId && !getMemoryIncludingDeleted(this.userId, remote.memoryId)) { this.recordUploadFailure(record.recordName, 'missing_dependency'); deferredCount++; continue; }
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
        if (remote.key.startsWith(PRIVATE_PLACE_PREFIX)) {
          const place = parsePrivatePlace(remote.valueJson);
          if (remote.deletedAt) deletePlace(this.userId, place.id, { fromCloud: true });
          else upsertPlace({ ...place, userId: this.userId }, { fromCloud: true, createdAt: remote.createdAt, updatedAt: remote.updatedAt });
        }
        upsertPrivatePreference(this.userId, remote.key, value, { syncedToCloud: 1, deletedAt: remote.deletedAt, syncRevision: remote.syncRevision, createdAt: remote.createdAt, updatedAt: remote.updatedAt });
        count++;
      }
    }
    return { updatedCount: count, deferredCount };
  }

  public ingestRemoteDeletions(recordNames: string[]): void {
    // App-originated deletes are synced as versioned tombstones. A physical
    // CloudKit deletion has no application revision, so quarantine it and
    // re-queue any surviving local row instead of erasing the only copy.
    quarantineCloudDeletions(this.userId, recordNames);
    requeueDeletedJourneyEdits(this.userId, recordNames);
  }

  private pendingCount(): number {
    const pendingPhotoIds = new Set(photosPendingSync(this.userId, 500));
    const pendingMemoryPhotoCount = listPhotosIncludingDeleted(this.userId)
      .filter(item => item.source === 'memory' && isDirectJourneyMemoryId(item.memoryId) && pendingPhotoIds.has(item.id)).length;
    const pendingDirectMemoryCount = memoriesPendingSync(this.userId, 500).filter(isDirectJourneyMemoryId).length;
    return journeysPendingSync(this.userId, 500).length + musicEntriesPendingSync(this.userId, 500).length +
      pendingDirectMemoryCount + pendingMemoryPhotoCount + preferencesPendingSync(this.userId, 500).length +
      (this.privateRouteAssets ? routeArchivesPendingSync(this.userId, 25).length : 0) + journeyEditsPendingSync(this.userId, 500).length;
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

function revisionAcks(names: string[], prefix: string, revisions: Map<string, number>, decode = false): Array<{ id: string; syncRevision: number }> {
  return names.filter(name => name.startsWith(prefix) && revisions.has(name)).map(name => ({
    id: decode ? decodeURIComponent(name.slice(prefix.length)) : name.slice(prefix.length),
    syncRevision: revisions.get(name)!,
  }));
}
