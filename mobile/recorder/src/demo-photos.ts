// Cover photos for the sample library's Memories. The images are bundled (Unsplash License: free to use, no attribution
// required; see assets/demo/CREDITS.md) and copied into the sample profile's private photo folder like any added photo.
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { getMemoryIncludingDeleted, upsertMemory, upsertPhoto, type LocalUserId } from './local-store';

const PHOTOS: readonly { memoryKey: string; fileName: string; source: number }[] = [
  { memoryKey: 'coast-weekend', fileName: 'coast-pacifica.jpg', source: require('../assets/demo/coast-pacifica.jpg') },
  { memoryKey: 'big-sur', fileName: 'coast-big-sur.jpg', source: require('../assets/demo/coast-big-sur.jpg') },
  { memoryKey: 'zion', fileName: 'zion-canyon.jpg', source: require('../assets/demo/zion-canyon.jpg') },
];

/** Adds one cover photo to each sample Memory. A photo that fails to copy is skipped; the Memory keeps its generated cover. */
export async function seedDemoPhotos(userId: LocalUserId): Promise<void> {
  const base = FileSystem.documentDirectory;
  if (!base) return;
  const directory = `${base}journeydeck-private-photos/${encodeURIComponent(userId)}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  for (const photo of PHOTOS) {
    try {
      const memory = getMemoryIncludingDeleted(userId, `demo_memory_${photo.memoryKey}`);
      if (!memory || memory.deletedAt) continue;
      const asset = Asset.fromModule(photo.source);
      await asset.downloadAsync();
      if (!asset.localUri) continue;
      const id = `demo_photo_${photo.memoryKey}`, localUri = `${directory}${id}.jpg`;
      await FileSystem.copyAsync({ from: asset.localUri, to: localUri });
      const info = await FileSystem.getInfoAsync(localUri);
      const byteLength = info.exists && typeof info.size === 'number' ? info.size : 150_000;
      upsertPhoto({ id, userId, source: 'memory', collectionId: null, memoryId: memory.id, fileName: photo.fileName, contentType: 'image/jpeg', byteLength, localUri }, { syncedToCloud: 1 });
      upsertMemory({ id: memory.id, userId, name: memory.name, notes: memory.notes, artworkKey: memory.artworkKey, coverPhotoId: id, coverPhotoLocalPath: memory.coverPhotoLocalPath, journeyIds: memory.journeyIds }, { syncedToCloud: 1 });
    } catch { /* keep the generated cover */ }
  }
}
