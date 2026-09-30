// Photos for the sample library's Memories. The images are bundled (Unsplash License: free to use, no attribution
// required; see assets/demo/CREDITS.md) and copied into the sample profile's private photo folder like any added photo.
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { demoMemoryId } from './demo-library';
import { getMemoryIncludingDeleted, upsertMemory, upsertPhoto, type LocalUserId } from './local-store';

type DemoPhoto = { fileName: string; source: number };
/** The first photo of each memory is its cover. */
const MEMORY_PHOTOS: Record<string, readonly DemoPhoto[]> = {
  'coast-weekend': [
    { fileName: 'coast-pacifica.jpg', source: require('../assets/demo/coast-pacifica.jpg') },
    { fileName: 'sf-fog-bridge.jpg', source: require('../assets/demo/sf-fog-bridge.jpg') },
    { fileName: 'coast-big-sur.jpg', source: require('../assets/demo/coast-big-sur.jpg') },
  ],
  'big-sur': [
    { fileName: 'bixby-sunny.jpg', source: require('../assets/demo/bixby-sunny.jpg') },
    { fileName: 'bixby-ocean.jpg', source: require('../assets/demo/bixby-ocean.jpg') },
    { fileName: 'bixby-cars.jpg', source: require('../assets/demo/bixby-cars.jpg') },
  ],
  zion: [
    { fileName: 'zion-canyon.jpg', source: require('../assets/demo/zion-canyon.jpg') },
    { fileName: 'zion-road.jpg', source: require('../assets/demo/zion-road.jpg') },
  ],
  'wine-country': [
    { fileName: 'vineyard-rows.jpg', source: require('../assets/demo/vineyard-rows.jpg') },
    { fileName: 'wine-country-farm.jpg', source: require('../assets/demo/wine-country-farm.jpg') },
  ],
};

export const DEMO_PHOTO_COUNT = Object.values(MEMORY_PHOTOS).reduce((sum, photos) => sum + photos.length, 0);

/**
 * Adds the bundled photos to each sample Memory and sets the first as its cover. Returns how many were added;
 * it throws when none could be, so a sample without photos is reported instead of shown half-empty.
 */
export async function seedDemoPhotos(userId: LocalUserId): Promise<number> {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('JourneyDeck cannot access its private photo folder on this device.');
  const directory = `${base}journeydeck-private-photos/${encodeURIComponent(userId)}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  let added = 0;
  let firstError: unknown = null;
  for (const [memoryKey, photos] of Object.entries(MEMORY_PHOTOS)) {
    const memory = getMemoryIncludingDeleted(userId, demoMemoryId(memoryKey));
    if (!memory || memory.deletedAt) continue;
    let coverId: string | null = null;
    for (const [index, photo] of photos.entries()) {
      try {
        const asset = Asset.fromModule(photo.source);
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error(`The bundled photo ${photo.fileName} is unavailable.`);
        const id = `demo_photo_${memoryKey}_${index + 1}`, localUri = `${directory}${id}.jpg`;
        await FileSystem.copyAsync({ from: asset.localUri, to: localUri });
        const info = await FileSystem.getInfoAsync(localUri);
        if (!info.exists) throw new Error(`The photo ${photo.fileName} could not be saved.`);
        const byteLength = typeof info.size === 'number' ? info.size : 150_000;
        upsertPhoto({ id, userId, source: 'memory', collectionId: null, memoryId: memory.id, fileName: photo.fileName, contentType: 'image/jpeg', byteLength, localUri }, { syncedToCloud: 1 });
        coverId ??= id;
        added += 1;
      } catch (error) { firstError ??= error; }
    }
    if (coverId) upsertMemory({ id: memory.id, userId, name: memory.name, notes: memory.notes, artworkKey: memory.artworkKey, coverPhotoId: coverId, coverPhotoLocalPath: memory.coverPhotoLocalPath, journeyIds: memory.journeyIds }, { syncedToCloud: 1 });
  }
  if (!added) throw firstError instanceof Error ? firstError : new Error('The sample photos could not be added.');
  return added;
}
