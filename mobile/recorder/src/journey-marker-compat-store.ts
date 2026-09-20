import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { getMasterDatabase } from './database-owner';
import { getActiveLocalUserId, initializeLocalStore, isPrivateCloudDeletionPending } from './local-store';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { markerPreferenceKey, markerPreferencePrefix, parseCompatMarker, type CompatMarker } from './journey-marker-compat-data';
import type { JourneyMarker, MarkerMedia } from './journey-marker-sql-store';
import { markerMediaUri } from './journey-marker-sql-store';
export { markerMediaUri, deleteMarkerMediaForProfile } from './journey-marker-sql-store';

function owned(userId: string) {
  initializeLocalStore();
  if (getActiveLocalUserId() !== userId || isPrivateCloudDeletionPending(userId)) throw new Error('The active profile changed.');
  return getMasterDatabase();
}
function records(userId: string): CompatMarker[] {
  const prefix = markerPreferencePrefix(userId);
  return owned(userId).getAllSync<{ key: string; value: string }>('SELECT key,value FROM local_preferences WHERE substr(key,1,?)=?;', prefix.length, prefix)
    .map(row => parseCompatMarker(row.key, row.value)).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}
function get(userId: string, id: string) {
  const row = owned(userId).getFirstSync<{ value: string }>('SELECT value FROM local_preferences WHERE key=?;', markerPreferenceKey(userId, id));
  if (!row) throw new Error('This marker is no longer available.');
  return parseCompatMarker(markerPreferenceKey(userId, id), row.value);
}
function put(marker: CompatMarker) {
  const key = markerPreferenceKey(marker.userId, marker.id), value = JSON.stringify(marker);
  parseCompatMarker(key, value);
  owned(marker.userId).runSync(`INSERT INTO local_preferences(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;`, key, value, new Date().toISOString());
  notifyLocalArchiveChanged();
}
function editable(userId: string, id: string) {
  const db = owned(userId);
  if (db.getFirstSync("SELECT id FROM recording_sessions WHERE owner_user_id=? AND status<>'completed';", userId)) throw new Error('Finish your journey before adding notes or media.');
  return get(userId, id);
}
export function saveForegroundMarker(userId: string, marker: JourneyMarker) {
  const db = owned(userId);
  if (!db.getFirstSync("SELECT id FROM recording_sessions WHERE owner_user_id=? AND id=? AND status='recording';", userId, marker.sessionId)) throw new Error('The active journey changed. Please try again.');
  if (!db.getFirstSync('SELECT key FROM local_preferences WHERE key=?;', markerPreferenceKey(userId, marker.id))) put({ ...marker, userId, media: [] });
}
export function listSessionMarkers(userId: string, sessionId: string): JourneyMarker[] {
  return records(userId).filter(marker => marker.sessionId === sessionId);
}
export function listJourneyMarkers(userId: string, journeyId: string): JourneyMarker[] {
  const db = owned(userId);
  const journey = db.getFirstSync<{ root: string; start: string; end: string }>(`SELECT COALESCE(e.root_id,j.id) AS root,j.started_at AS start,j.ended_at AS end
    FROM local_journeys j LEFT JOIN local_journey_edit_members e ON e.user_id=j.user_id AND e.journey_id=j.id WHERE j.user_id=? AND j.id=?;`, userId, journeyId);
  if (!journey) return [];
  return records(userId).filter(marker => `local_${marker.sessionId}` === journey.root && marker.capturedAt >= journey.start && marker.capturedAt <= journey.end
    && !db.getFirstSync(`SELECT j.id FROM local_journeys j JOIN local_journey_edit_members e ON e.journey_id=j.id
      WHERE e.user_id=? AND e.root_id=? AND e.active=1 AND j.started_at=? AND j.started_at>?;`, userId, journey.root, marker.capturedAt, journey.start));
}
export function listMarkerJourneys(userId: string) {
  const roots = [...new Set(records(userId).map(marker => `local_${marker.sessionId}`))];
  const db = owned(userId);
  return roots.flatMap(root => db.getAllSync<{ id: string; startedAt: string }>(`SELECT j.id,j.started_at AS startedAt FROM local_journeys j
    LEFT JOIN local_journey_edit_members e ON e.journey_id=j.id AND e.user_id=j.user_id
    WHERE j.user_id=? AND COALESCE(e.root_id,j.id)=?;`, userId, root))
    .filter(journey => listJourneyMarkers(userId, journey.id).length > 0).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export function saveMarkerNotes(userId: string, id: string, notes: string) { put({ ...editable(userId, id), notes }); }
export function listMarkerMedia(userId: string, id: string): MarkerMedia[] {
  return get(userId, id).media.filter((item): item is MarkerMedia => item.kind === 'photo');
}
export async function addMarkerMedia(userId: string, markerId: string, kind: MarkerMedia['kind'], uri: string) {
  editable(userId, markerId);
  if (!uri.startsWith('file://')) throw new Error('Select a file on this device.');
  const id = randomUUID(), media: MarkerMedia = { id, kind, fileName: `${id}.jpg` };
  const destination = markerMediaUri(userId, media);
  await FileSystem.makeDirectoryAsync(destination.slice(0, destination.lastIndexOf('/') + 1), { intermediates: true });
  try {
    await FileSystem.copyAsync({ from: uri, to: destination });
    const info = await FileSystem.getInfoAsync(destination);
    if (!info.exists || info.isDirectory || !info.size || info.size > 100 * 1024 * 1024) throw new Error('Photo could not be saved.');
    const current = editable(userId, markerId);
    put({ ...current, media: [...current.media, media] });
  } catch (error) { await FileSystem.deleteAsync(destination, { idempotent: true }); throw error; }
}
export async function removeMarkerMedia(userId: string, markerId: string, media: MarkerMedia) {
  const current = editable(userId, markerId), stored = current.media.find((item): item is MarkerMedia => item.id === media.id && item.kind === 'photo');
  if (!stored) return;
  await FileSystem.deleteAsync(markerMediaUri(userId, stored), { idempotent: true });
  const refreshed = editable(userId, markerId);
  put({ ...refreshed, media: refreshed.media.filter(item => item.id !== media.id) });
}
