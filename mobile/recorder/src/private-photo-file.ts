import * as FileSystem from 'expo-file-system/legacy';
import { getPhotoIncludingDeleted, listLocalUsers, repairPhotoLocalUri, type LocalPhoto } from './local-store';
import { privateCloudProfileScope } from './private-cloud-profile';

export type PrivatePhotoFile = { localUri: string; status: 'available' | 'missing' | 'empty' | 'unreadable' };

/** Reconstruct only the exact app-authored document path, never search other profiles or filenames. */
export function currentPrivatePhotoUri(photo: LocalPhoto, documentDirectory: string | null): string | null {
  if (!documentDirectory || !/^local_[a-zA-Z0-9-]+$/.test(photo.id)) return null;
  const extension = photo.contentType === 'image/png' ? 'png' : photo.contentType === 'image/webp' ? 'webp' : 'jpg';
  const relative = `journeydeck-private-photos/${encodeURIComponent(photo.userId)}/${photo.id}.${extension}`;
  // Only repair a previously saved Documents path with the same owner and photo identity.
  if (!photo.localUri.startsWith('file:///') || !photo.localUri.endsWith(`/Documents/${relative}`)) return null;
  return `${documentDirectory.replace(/\/?$/, '/')}${relative}`;
}

/** Native CloudKit downloads live in Application Support, not Documents. */
export async function currentCloudPhotoUri(photo: LocalPhoto, documentDirectory: string | null): Promise<string | null> {
  if (!documentDirectory || !/^file:\/\/\/.*\/Documents\/?$/.test(documentDirectory)
    || !/^[a-zA-Z0-9_-]+$/.test(photo.id) || !photo.localUri.startsWith('file:///')) return null;
  const owner = listLocalUsers().find(user => user.id === photo.userId);
  if (!owner) return null;
  const scope = await privateCloudProfileScope(owner);
  const folder = `/Library/Application Support/JourneyDeckPrivateAssets/JourneyDeck-${scope}/Photo/`;
  let decoded: string;
  try { decoded = decodeURIComponent(photo.localUri); } catch { return null; }
  const position = decoded.lastIndexOf(folder);
  if (position < 0) return null;
  const filename = decoded.slice(position + folder.length);
  // Match only this owner's exact photo. Keep the native content digest and
  // extension; older native downloads used the same name without a digest.
  if (!new RegExp(`^photo_${photo.id}(?:-[a-f0-9]{64})?\\.(?:heic|heif|jpg|jpeg|png|webp)$`).test(filename)) return null;
  const root = documentDirectory.replace(/Documents\/?$/, '');
  return `${root}Library/Application%20Support/JourneyDeckPrivateAssets/JourneyDeck-${scope}/Photo/${filename}`;
}

async function fileStatus(localUri: string): Promise<PrivatePhotoFile['status']> {
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) return 'missing';
    if (info.isDirectory || !info.size) return 'empty';
    return 'available';
  } catch { return 'unreadable'; }
}

export async function resolvePrivatePhotoFile(photo: LocalPhoto): Promise<PrivatePhotoFile> {
  const originalStatus = await fileStatus(photo.localUri);
  if (photo.deletedAt || originalStatus === 'available') return { localUri: photo.localUri, status: originalStatus };
  const candidate = currentPrivatePhotoUri(photo, FileSystem.documentDirectory)
    ?? await currentCloudPhotoUri(photo, FileSystem.documentDirectory);
  if (candidate && candidate !== photo.localUri && await fileStatus(candidate) === 'available') {
    // Updating a device path is not a content edit and must not alter revision/ack state.
    if (repairPhotoLocalUri(photo.userId, photo.id, photo.localUri, candidate)) {
      return { localUri: candidate, status: 'available' };
    }
    const latest = getPhotoIncludingDeleted(photo.userId, photo.id);
    if (latest && !latest.deletedAt && latest.localUri === candidate) return { localUri: candidate, status: 'available' };
  }
  return { localUri: photo.localUri, status: originalStatus };
}
