import { deleteAppCache, readAppCache, writeAppCache } from './storage';
import { parseTessieRoute, parseTessieSnapshot, type TessieDriveRoute, type TessieDriveSnapshot, type TessieSnapshot } from './tessie-contract';

// Profile-scoped SQLite cache. Neither these rows nor the Tessie token enter
// JourneyDeck's server or private CloudKit sync. Exact points stay on device.
const SNAPSHOT_KEY = 'tessie.snapshot.v1';
const ROUTE_INDEX_KEY = 'tessie.route-index.v1';
const MAX_CACHED_ROUTES = 12;
const routeKey = (driveId: string) => `tessie.route.v1.${driveId}`;

function routeIds(): string[] {
  const value = readAppCache<unknown>(ROUTE_INDEX_KEY);
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id)).slice(0, MAX_CACHED_ROUTES) : [];
}

export function saveTessieLocalSnapshot(value: unknown): TessieSnapshot {
  const snapshot = parseTessieSnapshot(value);
  writeAppCache(SNAPSHOT_KEY, snapshot);
  const currentDrives = new Set(snapshot.drives.map(drive => drive.id));
  const retained = routeIds().filter(id => currentDrives.has(id));
  for (const id of routeIds()) if (!currentDrives.has(id)) deleteAppCache(routeKey(id));
  writeAppCache(ROUTE_INDEX_KEY, retained);
  return snapshot;
}

export function readTessieLocalSnapshot(): TessieSnapshot | null {
  const value = readAppCache<unknown>(SNAPSHOT_KEY);
  if (!value) return null;
  try { return parseTessieSnapshot(value); } catch { return null; }
}

export function saveTessieLocalRoute(value: unknown, drive: TessieDriveSnapshot): TessieDriveRoute {
  const route = parseTessieRoute(value, drive);
  const ids = [drive.id, ...routeIds().filter(id => id !== drive.id)];
  // Index first so a failed route write cannot leave unindexed precise points.
  writeAppCache(ROUTE_INDEX_KEY, ids.slice(0, MAX_CACHED_ROUTES));
  writeAppCache(routeKey(drive.id), route);
  for (const id of ids.slice(MAX_CACHED_ROUTES)) deleteAppCache(routeKey(id));
  return route;
}

export function readTessieLocalRoute(drive: TessieDriveSnapshot): TessieDriveRoute | null {
  const value = readAppCache<unknown>(routeKey(drive.id));
  if (!value) return null;
  try { return parseTessieRoute(value, drive); } catch { return null; }
}

export function clearTessieLocalData() {
  for (const id of routeIds()) deleteAppCache(routeKey(id));
  deleteAppCache(ROUTE_INDEX_KEY);
  deleteAppCache(SNAPSHOT_KEY);
}
