import { requireOptionalNativeModule } from 'expo-modules-core';
import { PHOTO_MATCH_LIMITS, type PhotoLibraryAsset } from './photo-matching-model';

export type PhotoLibraryPermission = 'undetermined' | 'limited' | 'full' | 'denied' | 'restricted' | 'unavailable';
export type PhotoLibraryStatus = { permission: PhotoLibraryPermission };
export type PhotoLibraryScan = { scanId: string; assets: PhotoLibraryAsset[]; truncated: boolean };
export type PhotoLibraryPreview = { status: 'ready' | 'unavailable'; dataUri?: string };
export type MatchedPhotoImport = { fileName: string; contentType: 'image/jpeg'; dataBase64: string };
type Window = { startMs: number; endMs: number };
type PhotoLibraryBridge = {
  getStatusAsync?(): Promise<PhotoLibraryStatus>;
  requestPermissionAsync?(): Promise<PhotoLibraryStatus>;
  manageLimitedSelectionAsync?(): Promise<void>;
  scanAsync?(scanId: string, windows: Window[]): Promise<PhotoLibraryScan>;
  adoptScanAsync?(scanId: string, windows: Window[], assetIDs: string[]): Promise<string[]>;
  previewAsync(scanId: string, assetId: string): Promise<PhotoLibraryPreview>;
  exportAsync(scanId: string, assetId: string): Promise<MatchedPhotoImport>;
  cancelAsync(scanId: string): Promise<void>;
};
type ExpoMediaLibrary = typeof import('expo-media-library/legacy');
const native = requireOptionalNativeModule<PhotoLibraryBridge>('JourneyDeckPhotoLibrary');
const expoAvailable = requireOptionalNativeModule('ExpoMediaLibrary') !== null;
const unavailable: PhotoLibraryStatus = { permission: 'unavailable' };
const cancelledScans = new Set<string>();

// Load only after checking the installed binary. Build 36 lacks ExpoMediaLibrary
// and keeps using its embedded PhotoKit scanner after a compatible OTA.
function expoLibrary(): ExpoMediaLibrary {
  return require('expo-media-library/legacy') as ExpoMediaLibrary;
}
function required() {
  if (!native) throw new Error('Photo Matching needs the next JourneyDeck app build. Your existing photos remain available.');
  return native;
}
function permissionOf(response: Awaited<ReturnType<ExpoMediaLibrary['getPermissionsAsync']>>): PhotoLibraryPermission {
  if (response.accessPrivileges === 'limited') return 'limited';
  if (response.granted) return 'full';
  return response.status === 'denied' ? 'denied' : response.status === 'undetermined' ? 'undetermined' : 'restricted';
}
async function expoStatus(request: boolean): Promise<PhotoLibraryStatus> {
  const library = expoLibrary();
  const access = request ? await library.requestPermissionsAsync(false) : await library.getPermissionsAsync(false);
  return { permission: permissionOf(access) };
}
function validWindows(windows: Window[]) {
  return Array.isArray(windows) && windows.length > 0 && windows.length <= PHOTO_MATCH_LIMITS.journeys &&
    windows.every(w => Number.isFinite(w.startMs) && Number.isFinite(w.endMs) &&
      w.endMs >= w.startMs && w.endMs - w.startMs <= 31 * 86_400_000);
}
async function expoScan(scanId: string, windows: Window[]): Promise<PhotoLibraryScan> {
  if (!scanId || scanId.length > 100 || !validWindows(windows) || cancelledScans.has(scanId)) {
    throw new Error('This photo review has ended. Start a fresh search.');
  }
  const bridge = required();
  if (!bridge.adoptScanAsync) throw new Error('Photo Matching needs the next JourneyDeck app build.');
  const library = expoLibrary();
  const permission = await library.getPermissionsAsync(false);
  if (!permission.granted || cancelledScans.has(scanId)) throw new Error('Allow access to selected photos before looking for matches.');
  const seen = new Set<string>(), assets: PhotoLibraryAsset[] = [];
  let truncated = false;
  for (const [index, window] of windows.entries()) {
    // The legacy batch query includes GPS and iOS photo subtypes. SDK 58's
    // new lightweight Query metadata omits GPS and would require hundreds
    // of separate native calls for journey proximity matching.
    const page = await library.getAssetsAsync({ mediaType: 'photo', first: PHOTO_MATCH_LIMITS.assets + 1,
      createdAfter: window.startMs - 1, createdBefore: window.endMs + 1, sortBy: [['creationTime', false]] });
    if (cancelledScans.has(scanId)) throw new Error('This photo review has ended. Start a fresh search.');
    truncated ||= page.hasNextPage || page.assets.length > PHOTO_MATCH_LIMITS.assets;
    for (const photo of page.assets) {
      if (seen.has(photo.id) || photo.mediaSubtypes?.includes('screenshot') ||
          !Number.isFinite(photo.creationTime) || photo.creationTime < window.startMs || photo.creationTime > window.endMs) continue;
      seen.add(photo.id);
      assets.push({ id: photo.id, createdAtUtc: new Date(photo.creationTime).toISOString(),
        width: photo.width, height: photo.height,
        latitude: photo.location?.latitude, longitude: photo.location?.longitude });
      if (assets.length >= PHOTO_MATCH_LIMITS.assets) { truncated = true; break; }
    }
    if (assets.length >= PHOTO_MATCH_LIMITS.assets) { if (index < windows.length - 1) truncated = true; break; }
  }
  // PhotoKit revalidates IDs, permission, hidden/screenshot state and dates;
  // only approved IDs can later be previewed or exported.
  const allowed = new Set(await bridge.adoptScanAsync(scanId, windows, assets.map(asset => asset.id)));
  if (cancelledScans.has(scanId)) throw new Error('This photo review has ended. Start a fresh search.');
  return { scanId, assets: assets.filter(asset => allowed.has(asset.id)), truncated };
}

export const photoMatchingLibrary = {
  getStatus: () => expoAvailable && native?.adoptScanAsync ? expoStatus(false) : native?.getStatusAsync?.() ?? Promise.resolve(unavailable),
  requestPermission: () => expoAvailable && native?.adoptScanAsync ? expoStatus(true) : native?.requestPermissionAsync?.() ?? Promise.resolve(unavailable),
  manageLimitedSelection: () => expoAvailable && native?.adoptScanAsync
    ? expoLibrary().presentPermissionsPickerAsync(['photo']) : required().manageLimitedSelectionAsync!(),
  scan: (scanId: string, windows: Window[]) => expoAvailable && native?.adoptScanAsync
    ? expoScan(scanId, windows) : required().scanAsync!(scanId, windows),
  preview: (scanId: string, assetId: string) => required().previewAsync(scanId, assetId),
  export: (scanId: string, assetId: string) => required().exportAsync(scanId, assetId),
  cancel: (scanId: string) => {
    cancelledScans.add(scanId);
    if (cancelledScans.size > 256) cancelledScans.delete(cancelledScans.values().next().value!);
    return native?.cancelAsync(scanId) ?? Promise.resolve();
  },
};
