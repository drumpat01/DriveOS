import * as FileSystem from 'expo-file-system/legacy';
import { getPhotoIncludingDeleted, repairPhotoLocalUri, type LocalPhoto } from './local-store';

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
  const candidate = currentPrivatePhotoUri(photo, FileSystem.documentDirectory);
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
