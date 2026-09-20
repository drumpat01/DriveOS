import { validCapturedMarker, type CapturedJourneyMarker } from './journey-marker-model';

export type CompatMarker = CapturedJourneyMarker & {
  userId: string; sessionId: string; notes: string;
  media: { id: string; kind: 'photo' | 'voice'; fileName: string }[];
};
export const markerPreferencePrefix = (userId: string) => `journey.marker.v1:${encodeURIComponent(userId)}:`;
export const markerPreferenceKey = (userId: string, id: string) => markerPreferencePrefix(userId) + id;
export function parseCompatMarker(key: string, value: string): CompatMarker {
  const marker = JSON.parse(value) as CompatMarker;
  if (!marker || typeof marker.userId !== 'string' || typeof marker.sessionId !== 'string'
    || !marker.sessionId.startsWith('native_recording_') || key !== markerPreferenceKey(marker.userId, marker.id)
    || !validCapturedMarker(marker, '1970-01-01T00:00:00.000Z', null) || typeof marker.notes !== 'string'
    || marker.notes.length > 10000 || !Array.isArray(marker.media)
    || marker.media.some(item => !item || !/^[0-9a-f-]{36}$/.test(item.id)
      || !['photo', 'voice'].includes(item.kind) || item.fileName !== `${item.id}.${item.kind === 'photo' ? 'jpg' : 'm4a'}`)) {
    throw new Error('Saved marker data could not be read.');
  }
  return marker;
}

/** Runs inside migration 8's transaction; preserves OTA markers and relative media paths. */
export function migrateCompatMarkers(db: {
  getAllSync<T>(sql: string, ...args: any[]): T[];
  getFirstSync<T>(sql: string, ...args: any[]): T | null;
  runSync(sql: string, ...args: any[]): unknown;
}) {
  const rows = db.getAllSync<{ key: string; value: string }>("SELECT key,value FROM local_preferences WHERE key LIKE 'journey.marker.v1:%';");
  for (const row of rows) {
    const marker = parseCompatMarker(row.key, row.value);
    if (!db.getFirstSync('SELECT id FROM local_users WHERE id=?;', marker.userId)) continue;
    db.runSync(`INSERT OR IGNORE INTO local_journey_markers(id,user_id,session_id,root_journey_id,captured_at,location_at,latitude,longitude,accuracy_meters,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?);`, marker.id, marker.userId, marker.sessionId, `local_${marker.sessionId}`, marker.capturedAt, marker.locationAt, marker.latitude, marker.longitude, marker.accuracyMeters, marker.notes);
    for (const media of marker.media) db.runSync('INSERT OR IGNORE INTO local_marker_media(id,marker_id,kind,file_name,created_at) VALUES(?,?,?,?,?);', media.id, marker.id, media.kind, media.fileName, marker.capturedAt);
    db.runSync('DELETE FROM local_preferences WHERE key=?;', row.key);
  }
}
