import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { getMasterDatabase } from './database-owner';
import { getActiveLocalUserId, initializeLocalStore, isPrivateCloudDeletionPending } from './local-store';
import { notifyLocalArchiveChanged } from './local-archive-events';
import type { CapturedJourneyMarker } from './journey-marker-model';

export type JourneyMarker = CapturedJourneyMarker & { notes: string; sessionId: string };
export type JourneyMarkerSyncRecord = JourneyMarker & {
  userId: string; rootJourneyId: string;
  deletedAt: string | null; syncedToCloud: number;
  syncRevision: number; createdAt: string; updatedAt: string;
};
export type MarkerMedia = { id: string; kind: 'photo'; fileName: string };
export type MarkerPhotoSyncRecord = MarkerMedia & {
  markerId: string; userId: string; deletedAt: string | null;
  syncedToCloud: number; syncRevision: number; createdAt: string; updatedAt: string;
};

function ownedDatabase(userId: string) {
  initializeLocalStore();
  if (getActiveLocalUserId() !== userId || isPrivateCloudDeletionPending(userId)) throw new Error('The active profile changed.');
  return getMasterDatabase();
}
const columns = `m.id,m.user_id AS userId,m.root_journey_id AS rootJourneyId,
 m.captured_at AS capturedAt,m.location_at AS locationAt,m.latitude,m.longitude,
 m.accuracy_meters AS accuracyMeters,m.notes,m.session_id AS sessionId,m.deleted_at AS deletedAt,
 m.synced_to_cloud AS syncedToCloud,m.sync_revision AS syncRevision,m.created_at AS createdAt,m.updated_at AS updatedAt`;

export function listMarkerJourneys(userId: string) {
  return ownedDatabase(userId).getAllSync<{ id: string; startedAt: string }>(`SELECT j.id,j.started_at AS startedAt
    FROM local_journeys j LEFT JOIN local_journey_edit_members e ON e.journey_id=j.id AND e.user_id=j.user_id
    WHERE j.user_id=? AND EXISTS (SELECT 1 FROM local_journey_markers m
      WHERE m.user_id=j.user_id AND m.root_journey_id=COALESCE(e.root_id,j.id) AND m.deleted_at IS NULL
        AND m.captured_at>=j.started_at AND m.captured_at<=j.ended_at)
    ORDER BY j.started_at DESC;`, userId);
}

export function listJourneyMarkers(userId: string, journeyId: string): JourneyMarker[] {
  const db = ownedDatabase(userId);
  // Resolve the immutable original through trim/split membership. Markers outside
  // the visible time range stay saved for Restore Original, without false map pins.
  return db.getAllSync<JourneyMarker>(`SELECT ${columns} FROM local_journey_markers m
    JOIN local_journeys j ON j.user_id=m.user_id AND j.id=?
    LEFT JOIN local_journey_edit_members e ON e.journey_id=j.id AND e.user_id=j.user_id
    WHERE m.user_id=? AND m.deleted_at IS NULL AND m.root_journey_id=COALESCE(e.root_id,j.id)
      AND m.captured_at>=j.started_at AND m.captured_at<=j.ended_at
      AND NOT EXISTS (SELECT 1 FROM local_journeys next JOIN local_journey_edit_members n ON n.journey_id=next.id
        WHERE n.user_id=m.user_id AND n.root_id=m.root_journey_id AND n.active=1
          AND next.started_at=m.captured_at AND next.started_at>j.started_at)
    ORDER BY m.captured_at,m.id;`, journeyId, userId);
}

export function listSessionMarkers(userId: string, sessionId: string): JourneyMarker[] {
  return ownedDatabase(userId).getAllSync<JourneyMarker>(`SELECT ${columns} FROM local_journey_markers m
    WHERE user_id=? AND session_id=? AND deleted_at IS NULL ORDER BY captured_at,id;`, userId, sessionId);
}

function assertMarker(userId: string, markerId: string) {
  const db = ownedDatabase(userId);
  if (!db.getFirstSync('SELECT id FROM local_journey_markers WHERE user_id=? AND id=? AND deleted_at IS NULL;', userId, markerId)) {
    throw new Error('This marker is no longer available.');
  }
  return db;
}
function assertEditingAllowed(userId: string, markerId: string) {
  const db = assertMarker(userId, markerId);
  if (db.getFirstSync("SELECT id FROM recording_sessions WHERE owner_user_id=? AND status<>'completed';", userId)) {
    throw new Error('Finish your journey before adding notes or media.');
  }
  return db;
}
export function saveMarkerNotes(userId: string, markerId: string, notes: string) {
  if (notes.length > 10000) throw new Error('Notes can contain up to 10,000 characters.');
  const timestamp = new Date().toISOString();
  assertEditingAllowed(userId, markerId).runSync(`UPDATE local_journey_markers
    SET notes=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1
    WHERE user_id=? AND id=? AND notes<>?;`, notes, timestamp, userId, markerId, notes);
  notifyLocalArchiveChanged();
}
export function listMarkerMedia(userId: string, markerId: string): MarkerMedia[] {
  return assertMarker(userId, markerId).getAllSync<MarkerMedia>(`SELECT id,kind,file_name AS fileName,deleted_at AS deletedAt,
    synced_to_cloud AS syncedToCloud,sync_revision AS syncRevision,created_at AS createdAt,updated_at AS updatedAt
    FROM local_marker_media WHERE marker_id=? AND kind='photo' AND deleted_at IS NULL ORDER BY created_at,id;`, markerId);
}
function mediaDirectory(userId: string) {
  if (!FileSystem.documentDirectory) throw new Error('Private storage is unavailable.');
  return `${FileSystem.documentDirectory}journeydeck-marker-media/${encodeURIComponent(userId)}/`;
}
export function markerMediaUri(userId: string, media: MarkerMedia) {
  ownedDatabase(userId);
  if (!/^[0-9a-f-]{36}\.jpg$/.test(media.fileName)) throw new Error('Invalid marker attachment.');
  return mediaDirectory(userId) + media.fileName;
}
export async function addMarkerMedia(userId: string, markerId: string, kind: MarkerMedia['kind'], sourceUri: string) {
  assertEditingAllowed(userId, markerId);
  if (!sourceUri.startsWith('file://')) throw new Error('Select a file on this device.');
  const id = randomUUID(), fileName = `${id}.jpg`;
  const destination = mediaDirectory(userId) + fileName;
  await FileSystem.makeDirectoryAsync(mediaDirectory(userId), { intermediates: true });
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    const info = await FileSystem.getInfoAsync(destination);
    if (!info.exists || info.isDirectory || !info.size || info.size > 10 * 1024 * 1024) throw new Error('Attachment must be between 1 byte and 10 MB.');
    // Recheck profile/recorder after the asynchronous file copy.
    const timestamp = new Date().toISOString();
    assertEditingAllowed(userId, markerId).runSync(`INSERT INTO local_marker_media(
      id,marker_id,kind,file_name,created_at,synced_to_cloud,deleted_at,sync_revision,updated_at
    ) VALUES(?,?,?,?,?,0,NULL,1,?);`, id, markerId, kind, fileName, timestamp, timestamp);
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw error;
  }
  notifyLocalArchiveChanged();
}
export async function removeMarkerMedia(userId: string, markerId: string, media: MarkerMedia) {
  assertEditingAllowed(userId, markerId);
  const stored = listMarkerMedia(userId, markerId).find(item => item.id === media.id);
  if (!stored) return;
  const localUri = markerMediaUri(userId, stored);
  const timestamp = new Date().toISOString();
  assertEditingAllowed(userId, markerId).runSync(`UPDATE local_marker_media
    SET deleted_at=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1
    WHERE marker_id=? AND id=? AND deleted_at IS NULL;`, timestamp, timestamp, markerId, stored.id);
  // The tombstone is the durable user action. File cleanup is best effort so a
  // transient filesystem error cannot leave a live row pointing at no bytes.
  await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
  notifyLocalArchiveChanged();
}

export function listMarkersPendingPrivateSync(userId: string, limit = 50): JourneyMarkerSyncRecord[] {
  return ownedDatabase(userId).getAllSync<JourneyMarkerSyncRecord>(`SELECT ${columns} FROM local_journey_markers m
    WHERE m.user_id=? AND m.synced_to_cloud=0 ORDER BY m.updated_at,m.id LIMIT ?;`, userId, limit);
}

export function listMarkerPhotosPendingPrivateSync(userId: string, limit = 50): MarkerPhotoSyncRecord[] {
  return ownedDatabase(userId).getAllSync<MarkerPhotoSyncRecord>(`SELECT media.id,media.kind,media.file_name AS fileName,
    media.deleted_at AS deletedAt,media.synced_to_cloud AS syncedToCloud,media.sync_revision AS syncRevision,
    media.created_at AS createdAt,media.updated_at AS updatedAt,media.marker_id AS markerId,m.user_id AS userId
    FROM local_marker_media media JOIN local_journey_markers m ON m.id=media.marker_id
    WHERE m.user_id=? AND media.kind='photo' AND media.synced_to_cloud=0
    ORDER BY media.updated_at,media.id LIMIT ?;`, userId, limit);
}

export function getMarkerIncludingDeleted(userId: string, markerId: string): JourneyMarkerSyncRecord | null {
  return ownedDatabase(userId).getFirstSync<JourneyMarkerSyncRecord>(`SELECT ${columns} FROM local_journey_markers m
    WHERE m.user_id=? AND m.id=?;`, userId, markerId) ?? null;
}

export function getMarkerPhotoIncludingDeleted(userId: string, photoId: string): MarkerPhotoSyncRecord | null {
  return ownedDatabase(userId).getFirstSync<MarkerPhotoSyncRecord>(`SELECT media.id,media.kind,media.file_name AS fileName,
    media.deleted_at AS deletedAt,media.synced_to_cloud AS syncedToCloud,media.sync_revision AS syncRevision,
    media.created_at AS createdAt,media.updated_at AS updatedAt,media.marker_id AS markerId,m.user_id AS userId
    FROM local_marker_media media JOIN local_journey_markers m ON m.id=media.marker_id
    WHERE m.user_id=? AND media.id=?;`, userId, photoId) ?? null;
}

function sameMarkerIdentity(local: JourneyMarkerSyncRecord, remote: JourneyMarkerSyncRecord) {
  return local.id === remote.id && local.userId === remote.userId && local.sessionId === remote.sessionId
    && local.rootJourneyId === remote.rootJourneyId && local.capturedAt === remote.capturedAt
    && local.locationAt === remote.locationAt && local.latitude === remote.latitude
    && local.longitude === remote.longitude && local.accuracyMeters === remote.accuracyMeters
    && local.createdAt === remote.createdAt;
}

/** Applies an already conflict-resolved private record without creating a new local revision. */
export function upsertMarkerFromPrivateCloud(userId: string, remote: JourneyMarkerSyncRecord): void {
  const db = ownedDatabase(userId);
  const owned = db.getFirstSync<{ userId: string }>('SELECT user_id AS userId FROM local_journey_markers WHERE id=?;', remote.id);
  if (owned && owned.userId !== userId) throw new Error('This Marker is owned by another profile.');
  const local = getMarkerIncludingDeleted(userId, remote.id);
  if (local && !sameMarkerIdentity(local, remote)) throw new Error('The private Marker capture identity does not match this device.');
  db.runSync(`INSERT INTO local_journey_markers(
      id,user_id,session_id,root_journey_id,captured_at,location_at,latitude,longitude,accuracy_meters,notes,
      deleted_at,synced_to_cloud,sync_revision,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)
    ON CONFLICT(id) DO UPDATE SET notes=excluded.notes,deleted_at=excluded.deleted_at,
      synced_to_cloud=1,sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;`,
  remote.id, userId, remote.sessionId, remote.rootJourneyId, remote.capturedAt, remote.locationAt,
  remote.latitude, remote.longitude, remote.accuracyMeters, remote.notes, remote.deletedAt,
  remote.syncRevision, remote.createdAt, remote.updatedAt);
  notifyLocalArchiveChanged();
}

function assertRemotePhotoIdentity(local: MarkerPhotoSyncRecord, remote: MarkerPhotoSyncRecord) {
  if (local.id !== remote.id || local.userId !== remote.userId || local.markerId !== remote.markerId
    || local.kind !== 'photo' || remote.kind !== 'photo' || local.fileName !== remote.fileName
    || local.createdAt !== remote.createdAt) {
    throw new Error('The private Marker photo identity does not match this device.');
  }
}

/** Copies a downloaded CloudKit asset into app-owned storage before acknowledging it locally. */
export async function upsertMarkerPhotoFromPrivateCloud(
  userId: string,
  remote: MarkerPhotoSyncRecord,
  sourceUri: string | null,
  expectedByteLength: number,
): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(remote.id) || remote.fileName !== `${remote.id}.jpg`) {
    throw new Error('The private Marker photo identity is invalid.');
  }
  const db = ownedDatabase(userId);
  const marker = getMarkerIncludingDeleted(userId, remote.markerId);
  if (!marker) throw new Error('The private Marker photo is missing its Marker.');
  const owned = db.getFirstSync<{ userId: string }>(`SELECT marker.user_id AS userId FROM local_marker_media media
    JOIN local_journey_markers marker ON marker.id=media.marker_id WHERE media.id=?;`, remote.id);
  if (owned && owned.userId !== userId) throw new Error('This Marker photo is owned by another profile.');
  const local = getMarkerPhotoIncludingDeleted(userId, remote.id);
  if (local) assertRemotePhotoIdentity(local, remote);
  const localVersion = local ? `${local.syncRevision}|${local.updatedAt}|${local.deletedAt ?? ''}` : null;

  const destination = mediaDirectory(userId) + remote.fileName;
  if (remote.deletedAt) {
    db.runSync(`INSERT INTO local_marker_media(
        id,marker_id,kind,file_name,created_at,synced_to_cloud,deleted_at,sync_revision,updated_at
      ) VALUES(?,?,?,?,?,1,?,?,?)
      ON CONFLICT(id) DO UPDATE SET synced_to_cloud=1,deleted_at=excluded.deleted_at,
        sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;`,
    remote.id, remote.markerId, 'photo', remote.fileName, remote.createdAt, remote.deletedAt, remote.syncRevision, remote.updatedAt);
    await FileSystem.deleteAsync(destination, { idempotent: true });
    notifyLocalArchiveChanged();
    return;
  }

  if (!sourceUri?.startsWith('file://')) throw new Error('A private Marker photo is missing its restored asset.');
  const source = await FileSystem.getInfoAsync(sourceUri);
  if (!source.exists || source.isDirectory || !source.size || source.size > 10 * 1024 * 1024 || source.size !== expectedByteLength) {
    throw new Error('A restored Marker photo must be between 1 byte and 10 MB.');
  }
  await FileSystem.makeDirectoryAsync(mediaDirectory(userId), { intermediates: true });
  const existingDestination = await FileSystem.getInfoAsync(destination);
  let createdDestination = false;
  if (existingDestination.exists && (existingDestination.isDirectory || existingDestination.size !== expectedByteLength)) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
  }
  if (!existingDestination.exists || existingDestination.isDirectory || existingDestination.size !== expectedByteLength) {
    const temporary = `${destination}.restore-${randomUUID()}`;
    try {
      await FileSystem.copyAsync({ from: sourceUri, to: temporary });
      const copied = await FileSystem.getInfoAsync(temporary);
      if (!copied.exists || copied.isDirectory || copied.size !== source.size) throw new Error('The restored Marker photo copy is incomplete.');
      ownedDatabase(userId);
      await FileSystem.moveAsync({ from: temporary, to: destination });
      createdDestination = true;
    } catch (error) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      throw error;
    }
  }
  try {
    const current = getMarkerPhotoIncludingDeleted(userId, remote.id);
    const currentVersion = current ? `${current.syncRevision}|${current.updatedAt}|${current.deletedAt ?? ''}` : null;
    if (currentVersion !== localVersion) throw new Error('The Marker photo changed while its private backup was restoring.');
    ownedDatabase(userId).runSync(`INSERT INTO local_marker_media(
        id,marker_id,kind,file_name,created_at,synced_to_cloud,deleted_at,sync_revision,updated_at
      ) VALUES(?,?,?,?,?,1,NULL,?,?)
      ON CONFLICT(id) DO UPDATE SET synced_to_cloud=1,deleted_at=NULL,
        sync_revision=excluded.sync_revision,updated_at=excluded.updated_at;`,
    remote.id, remote.markerId, 'photo', remote.fileName, remote.createdAt, remote.syncRevision, remote.updatedAt);
  } catch (error) {
    if (createdDestination) await FileSystem.deleteAsync(destination, { idempotent: true });
    throw error;
  }
  notifyLocalArchiveChanged();
}

function markRevisionsSynced(table: 'local_journey_markers' | 'local_marker_media', userId: string, acknowledgements: Array<{ id: string; syncRevision: number }>) {
  const db = ownedDatabase(userId);
  db.withTransactionSync(() => {
    for (const item of acknowledgements) {
      if (table === 'local_journey_markers') {
        db.runSync('UPDATE local_journey_markers SET synced_to_cloud=1 WHERE user_id=? AND id=? AND sync_revision=?;', userId, item.id, item.syncRevision);
      } else {
        db.runSync(`UPDATE local_marker_media SET synced_to_cloud=1 WHERE id=? AND sync_revision=?
          AND EXISTS(SELECT 1 FROM local_journey_markers marker WHERE marker.id=local_marker_media.marker_id AND marker.user_id=?);`,
        item.id, item.syncRevision, userId);
      }
    }
  });
}

export function markMarkerRevisionsSynced(userId: string, acknowledgements: Array<{ id: string; syncRevision: number }>) {
  markRevisionsSynced('local_journey_markers', userId, acknowledgements);
}

export function markMarkerPhotoRevisionsSynced(userId: string, acknowledgements: Array<{ id: string; syncRevision: number }>) {
  markRevisionsSynced('local_marker_media', userId, acknowledgements);
}

export function requeueDeletedMarkerCloudRecords(userId: string, recordNames: string[]): void {
  const db = ownedDatabase(userId);
  db.withTransactionSync(() => {
    for (const recordName of new Set(recordNames)) {
      if (recordName.startsWith('journey_marker_')) {
        db.runSync('UPDATE local_journey_markers SET synced_to_cloud=0 WHERE user_id=? AND id=?;', userId, recordName.slice('journey_marker_'.length));
      } else if (recordName.startsWith('marker_photo_')) {
        db.runSync(`UPDATE local_marker_media SET synced_to_cloud=0 WHERE id=?
          AND EXISTS(SELECT 1 FROM local_journey_markers marker WHERE marker.id=local_marker_media.marker_id AND marker.user_id=?);`,
        recordName.slice('marker_photo_'.length), userId);
      }
    }
  });
}
export async function deleteMarkerMediaForProfile(userId: string) {
  initializeLocalStore();
  if (getActiveLocalUserId() !== userId) throw new Error('The active profile changed.');
  // Fixed app-owned directory, escaped profile component. No user-provided paths.
  await FileSystem.deleteAsync(mediaDirectory(userId), { idempotent: true });
}
