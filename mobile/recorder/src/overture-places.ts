import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { requestPrivacyEdgeJson } from './network-request';
import { areJourneyDeckRequestsBlocked } from './network-activity';
import { overtureTileKey, parseOvertureTile, selectOverturePlace, OVERTURE_TILE_TTL_MS, OVERTURE_MAX_TILE_BYTES } from './overture-place-model';

// Public tiles are expendable, bounded cache files, never personal SQLite data
// or CloudKit content. The OS can reclaim them without losing saved places.
const directory = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}overture-public-v1/` : null;
const MAX_CACHED_TILES = 24;
let edgeRetryAfter = 0;

async function pruneCache() {
  if (!directory) return;
  const names = (await FileSystem.readDirectoryAsync(directory)).filter(name => /^\d+_\d+\.json$/.test(name));
  const files = await Promise.all(names.map(async name => ({ name, info: await FileSystem.getInfoAsync(directory + name) })));
  files.sort((a, b) => (b.info.exists ? b.info.modificationTime ?? 0 : 0) - (a.info.exists ? a.info.modificationTime ?? 0 : 0));
  for (const file of files.slice(MAX_CACHED_TILES)) await FileSystem.deleteAsync(directory + file.name, { idempotent: true });
}

export async function lookupOverturePlace(latitude: number, longitude: number, canContinue: () => boolean) {
  const tile = overtureTileKey(latitude, longitude);
  if (!tile || !canContinue()) return null;
  const path = directory ? `${directory}${tile}.json` : null;
  if (path) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && info.size <= OVERTURE_MAX_TILE_BYTES && Date.now() - (info.modificationTime ?? 0) * 1000 < OVERTURE_TILE_TTL_MS) {
        const cached = parseOvertureTile(JSON.parse(await FileSystem.readAsStringAsync(path)), tile);
        if (cached && canContinue()) return selectOverturePlace(cached, latitude, longitude);
      }
    } catch { /* Cache eviction or corruption cannot block native fallback. */ }
  }
  const edge = Constants.expoConfig?.extra?.edge as { url?: unknown } | undefined;
  if (typeof edge?.url !== 'string' || !/^https:\/\//.test(edge.url)
    || areJourneyDeckRequestsBlocked() || Date.now() < edgeRetryAfter || !canContinue()) return null;
  try {
    const raw = await requestPrivacyEdgeJson<unknown>(edge.url, '/api/places/us-tile', { tile }, {
      operation: 'Public US place directory', timeoutMs: 4000, maxResponseBytes: OVERTURE_MAX_TILE_BYTES,
    });
    const result = parseOvertureTile(raw, tile);
    if (!result) throw new Error('Invalid public directory response');
    if (path && directory && canContinue()) {
      try {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        await FileSystem.writeAsStringAsync(path, JSON.stringify(result));
        await pruneCache();
      } catch { /* Saving a public cache is optional. */ }
    }
    return canContinue() ? selectOverturePlace(result, latitude, longitude) : null;
  } catch {
    edgeRetryAfter = Date.now() + 5 * 60_000;
    return null;
  }
}
