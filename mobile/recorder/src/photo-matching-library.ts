import { requireOptionalNativeModule } from 'expo-modules-core';
import type { PhotoLibraryAsset } from './photo-matching-model';

export type PhotoLibraryPermission = 'undetermined' | 'limited' | 'full' | 'denied' | 'restricted' | 'unavailable';
export type PhotoLibraryStatus = { permission: PhotoLibraryPermission; sensitivityAvailable: boolean };
export type PhotoLibraryScan = { scanId: string; assets: PhotoLibraryAsset[]; truncated: boolean };
export type PhotoLibraryPreview = { status: 'ready' | 'sensitive' | 'unavailable'; dataUri?: string; checkedForNudity: boolean };
export type MatchedPhotoImport = { fileName: string; contentType: 'image/jpeg'; dataBase64: string };
type PhotoLibraryBridge = {
  getStatusAsync(): Promise<PhotoLibraryStatus>;
  requestPermissionAsync(): Promise<PhotoLibraryStatus>;
  manageLimitedSelectionAsync(): Promise<void>;
  scanAsync(scanId: string, windows: { startMs: number; endMs: number }[]): Promise<PhotoLibraryScan>;
  previewAsync(scanId: string, assetId: string): Promise<PhotoLibraryPreview>;
  exportAsync(scanId: string, assetId: string): Promise<MatchedPhotoImport>;
  cancelAsync(scanId: string): Promise<void>;
};
const native = requireOptionalNativeModule<PhotoLibraryBridge>('JourneyDeckPhotoLibrary');
const unavailable: PhotoLibraryStatus = { permission: 'unavailable', sensitivityAvailable: false };
function required() {
  if (!native) throw new Error('Photo Matching needs the next JourneyDeck app build. Your existing photos remain available.');
  return native;
}
export const photoMatchingLibrary = {
  getStatus: () => native?.getStatusAsync() ?? Promise.resolve(unavailable),
  requestPermission: () => native?.requestPermissionAsync() ?? Promise.resolve(unavailable),
  manageLimitedSelection: () => required().manageLimitedSelectionAsync(),
  scan: (scanId: string, windows: { startMs: number; endMs: number }[]) => required().scanAsync(scanId, windows),
  preview: (scanId: string, assetId: string) => required().previewAsync(scanId, assetId),
  export: (scanId: string, assetId: string) => required().exportAsync(scanId, assetId),
  cancel: (scanId: string) => native?.cancelAsync(scanId) ?? Promise.resolve(),
};
