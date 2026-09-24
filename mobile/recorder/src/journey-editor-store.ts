/** Reversible editing: one SQLite transaction and one immutable private sync asset per operation. */
import * as Crypto from 'expo-crypto';
import { getMasterDatabase } from './database-owner';
import {
  findNamedPlace, getActiveLocalUserId, getJourney, getMusicEntry, getPlace, getRouteArchive, initializeLocalStore, isPrivateCloudDeletionPending,
  listJourneyGpsPoints, upsertJourney,
  type LocalJourney, type LocalMusicEntry,
} from './local-store';
import { notifyLocalArchiveChanged } from './local-archive-events';
import {
  editorSongSegment, MAX_EDITOR_POINTS, previewEditorSegments, previewJourneyEdit, validateEditorSegments,
  type JourneyEditSelection, type JourneyEditorOriginal, type JourneyEditorSegment, type JourneyEditorSnapshot,
} from './journey-editor-model';
import { parseRouteArchive, serializeRouteArchive } from './route-archive';

export type JourneyEditOperation = {
  version: 1; id: string; rootJourneyId: string; parentId: string | null; createdAt: string;
  kind: JourneyEditSelection['kind']; original: JourneyEditorOriginal; segments: JourneyEditorSegment[];
  resolves?: string[];
};
export type StoredJourneyEdit = { id: string; rootJourneyId: string; parentId: string | null; payload: string; createdAt: string; status: 'applied' | 'conflict' | 'resolved' };
export const MAX_JOURNEY_EDIT_ASSET_BYTES = 20 * 1024 * 1024;
// Do not resolve the native handle while route modules are being imported.
// Public operations assert local-store readiness before this facade is used.
const db = new Proxy({} as ReturnType<typeof getMasterDatabase>, {
  get(_target, property) {
    const database = getMasterDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});

function assertProfile(userId: string) {
  if (getActiveLocalUserId() !== userId || isPrivateCloudDeletionPending(userId)) {
    throw new Error('The active library changed. Reopen the journey before editing.');
  }
}

function assertRecorderIdle() {
  if (db.getFirstSync("SELECT id FROM recording_sessions WHERE status IN ('recording','paused','finishing') LIMIT 1;")) {
    throw new Error('Finish the current recording before editing a saved journey.');
  }
}

function head(userId: string, journeyId: string): StoredJourneyEdit | null {
  return db.getFirstSync<StoredJourneyEdit>(`SELECT o.id,o.root_id AS rootJourneyId,o.parent_id AS parentId,
    o.payload_json AS payload,o.created_at AS createdAt,o.status FROM local_journey_edit_operations o
    JOIN local_journey_edit_heads h ON h.operation_id=o.id AND h.user_id=o.user_id
    WHERE h.user_id=? AND h.root_id=COALESCE((SELECT root_id FROM local_journey_edit_members WHERE user_id=? AND journey_id=?),?);`,
  userId, userId, journeyId, journeyId);
}

function currentSongs(userId: string, original: JourneyEditorOriginal, segments: JourneyEditorSegment[]): LocalMusicEntry[] {
  const songs = new Map(original.songs.map(song => [song.id, getMusicEntry(userId, song.id) ?? song]));
  for (const segment of segments) for (const song of exactJourneySongs(userId, segment.id)) songs.set(song.id, song);
  return [...songs.values()].sort((a, b) => a.playedAt.localeCompare(b.playedAt) || a.id.localeCompare(b.id));
}

function exactJourneySongs(userId: string, journeyId: string): LocalMusicEntry[] {
  return db.getAllSync<{ id: string }>('SELECT id FROM local_music_entries WHERE user_id=? AND journey_id=? ORDER BY played_at,id;', userId, journeyId)
    .map(row => getMusicEntry(userId, row.id)!).filter(Boolean);
}

function versionToken(userId: string, revision: string | null, original: JourneyEditorOriginal, segments: JourneyEditorSegment[]) {
  const content = <T extends { syncedToCloud?: number }>(row: T | null) => {
    if (!row) return null;
    const { syncedToCloud: _acknowledgement, ...fields } = row;
    return fields;
  };
  return JSON.stringify({ revision, journeys: segments.map(segment => [content(getJourney(userId, segment.id)), content(getRouteArchive(userId, segment.id))]),
    songs: currentSongs(userId, original, segments).map(content) });
}

export function loadJourneyEditor(userId: string, journeyId: string): JourneyEditorSnapshot {
  initializeLocalStore(); assertProfile(userId); assertRecorderIdle();
  const journey = getJourney(userId, journeyId);
  if (!journey) throw new Error('This journey is no longer available in the selected library.');
  const prior = head(userId, journeyId);
  const operation = prior ? parseJourneyEditPayload(prior.payload, userId) : null;
  const rootJourneyId = operation?.rootJourneyId ?? journeyId;
  const original = operation?.original ?? { journey, points: listJourneyGpsPoints(userId, journeyId), songs: exactJourneySongs(userId, journeyId) };
  const segments = operation?.segments ?? [{ id: journeyId, startMs: Date.parse(journey.startedAt), endMs: Date.parse(journey.endedAt) }];
  validateEditorSegments(original, segments);
  // Keep newly discovered songs and artwork while older operation assets retain
  // immutable copies of the exact data available when each edit was made.
  const merged = { ...original, songs: currentSongs(userId, original, segments) };
  return { userId, journeyId, rootJourneyId, original: merged, segments, revision: prior?.id ?? null,
    versionToken: versionToken(userId, prior?.id ?? null, merged, segments), canRestore: Boolean(prior && operation?.kind !== 'restore'),
    splitJourneyId: `edited_${Crypto.randomUUID()}` };
}

function writeJourneyProjection(userId: string, operation: JourneyEditOperation) {
  const { original, segments } = operation;
  const historicalMembers = db.getAllSync<{ journey_id: string }>('SELECT journey_id FROM local_journey_edit_members WHERE user_id=? AND root_id=?;', userId, operation.rootJourneyId).map(row => row.journey_id);
  const previousIds = historicalMembers.length ? historicalMembers : [operation.rootJourneyId];
  const nextIds = segments.map(segment => segment.id);
  const priorOperation = head(userId, operation.rootJourneyId);
  const priorSegments: JourneyEditorSegment[] = priorOperation ? parseJourneyEditPayload(priorOperation.payload, userId).segments :
    [{ id: operation.rootJourneyId, startMs: Date.parse(original.journey.startedAt), endMs: Date.parse(original.journey.endedAt) }];
  const previews = previewEditorSegments(original, segments).segments;
  for (const segment of segments) {
    const owned = db.getFirstSync<{ user_id: string }>('SELECT user_id FROM local_journeys WHERE id=?;', segment.id);
    const member = db.getFirstSync<{ user_id: string; root_id: string }>('SELECT user_id,root_id FROM local_journey_edit_members WHERE journey_id=?;', segment.id);
    if ((owned && owned.user_id !== userId) || (member && (member.user_id !== userId || member.root_id !== operation.rootJourneyId))) {
      throw new Error('The edited journey identity belongs to a different library.');
    }
    if (segment.id !== operation.rootJourneyId && owned && !member) throw new Error('A different journey already uses this part identifier.');
    const preview = previews.find(item => item.id === segment.id)!;
    const restoring = operation.kind === 'restore';
    const points = restoring ? original.points.map(point => ({ ...point, journeyId: segment.id })) : preview.points;
    const maxSpeed = points.reduce<number | null>((value, point) => point.speedMps == null ? value : Math.max(value ?? 0, point.speedMps * 2.2369362921), null);
    const journey: LocalJourney = { ...original.journey, id: segment.id, userId,
      legacyDriveId: segment.id === operation.rootJourneyId ? original.journey.legacyDriveId : null,
      startedAt: new Date(segment.startMs).toISOString(), endedAt: new Date(segment.endMs).toISOString(),
      durationMinutes: restoring ? original.journey.durationMinutes : preview.durationMinutes,
      miles: restoring ? original.journey.miles : preview.miles,
      startLat: restoring ? original.journey.startLat : points[0]!.latitude, startLng: restoring ? original.journey.startLng : points[0]!.longitude,
      endLat: restoring ? original.journey.endLat : points.at(-1)!.latitude, endLng: restoring ? original.journey.endLng : points.at(-1)!.longitude,
      startPlaceId: segment.startMs === Date.parse(original.journey.startedAt) ? original.journey.startPlaceId : null,
      endPlaceId: segment.endMs === Date.parse(original.journey.endedAt) ? original.journey.endPlaceId : null,
      averageSpeedMph: restoring ? original.journey.averageSpeedMph : preview.miles / (preview.durationMinutes / 60),
      maxSpeedMph: restoring ? original.journey.maxSpeedMph : maxSpeed,
      songCount: preview.songCount, updatedAt: operation.createdAt, syncedToCloud: 1 };
    // Place identifiers are local. A remote device may not have the saved
    // place yet; keep exact private coordinates and let later enrichment name it.
    for (const key of ['startPlaceId', 'endPlaceId'] as const) if (journey[key]) {
      const lat = key === 'startPlaceId' ? journey.startLat : journey.endLat;
      const lng = key === 'startPlaceId' ? journey.startLng : journey.endLng;
      journey[key] = getPlace(userId, journey[key]!)?.id ?? (lat != null && lng != null ? findNamedPlace(userId, lat, lng)?.id ?? null : null);
    }
    upsertJourney(journey, { editorMutation: true, syncedToCloud: 1, createdAt: original.journey.createdAt, updatedAt: operation.createdAt });
    db.runSync('DELETE FROM local_gps_points WHERE journey_id=?;', segment.id);
    for (const point of points) db.runSync(`INSERT INTO local_gps_points(journey_id,sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps)
      VALUES(?,?,?,?,?,?,?,?,?);`, segment.id, point.sequence, point.recordedAt, point.latitude, point.longitude,
    point.accuracyMeters, point.altitudeMeters, point.headingDegrees, point.speedMps);
    db.runSync('UPDATE local_journeys SET route_synced_to_cloud=1,route_sync_revision=route_sync_revision+1,route_updated_at=? WHERE id=? AND user_id=?;', operation.createdAt, segment.id, userId);
    db.runSync(`INSERT INTO local_journey_edit_members(journey_id,user_id,root_id,active) VALUES(?,?,?,1)
      ON CONFLICT(journey_id) DO UPDATE SET active=1;`, segment.id, userId, operation.rootJourneyId);
  }
  // Assignment changes never duplicate listening-history rows. Outside-trim
  // playbacks remain saved with no journey association.
  const songs = currentSongs(userId, original, priorSegments);
  for (const song of songs) {
    const existing = db.getFirstSync<{ user_id: string }>('SELECT user_id FROM local_music_entries WHERE id=?;', song.id);
    const managed = db.getFirstSync<{ user_id: string; root_id: string }>('SELECT user_id,root_id FROM local_journey_edit_music WHERE music_id=?;', song.id);
    if ((existing && existing.user_id !== userId) || (managed && (managed.user_id !== userId || managed.root_id !== operation.rootJourneyId))) {
      throw new Error('A playback in this edit belongs to a different library.');
    }
    const journeyId = operation.kind === 'restore' ? operation.rootJourneyId : editorSongSegment(segments, song.playedAt);
    db.runSync(`INSERT INTO local_music_entries(id,user_id,journey_id,source,played_at,track,artist,album,duration_ms,artwork_url,external_url,confidence,synced_to_cloud,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET journey_id=excluded.journey_id,synced_to_cloud=1;`,
    song.id, userId, journeyId, song.source, song.playedAt, song.track, song.artist, song.album, song.durationMs,
    song.artworkUrl, song.externalUrl, song.confidence, song.createdAt);
    db.runSync('INSERT OR IGNORE INTO local_journey_edit_music(music_id,user_id,root_id) VALUES(?,?,?);', song.id, userId, operation.rootJourneyId);
  }
  // Delta-replace only affected IDs. Renames, photos, independently added
  // journeys and Memories created since the previous edit remain intact.
  for (const [table, column] of [['local_memories', 'collection_ids'], ['local_collections', 'journey_ids']] as const) {
    for (const row of db.getAllSync<{ id: string; ids: string }>(`SELECT id,${column} AS ids FROM ${table} WHERE user_id=? AND deleted_at IS NULL;`, userId)) {
      const ids = JSON.parse(row.ids) as string[];
      const replacements = new Map(priorSegments.map(old => [old.id, segments.filter(next => next.startMs < old.endMs && next.endMs > old.startMs).map(next => next.id)]));
      // A restored original also replaces any stale retired segment link.
      if (operation.kind === 'restore') for (const id of previousIds) replacements.set(id, [operation.rootJourneyId]);
      const next = [...new Set(ids.flatMap(id => replacements.get(id) ?? [id]))];
      if (JSON.stringify(next) !== row.ids) db.runSync(`UPDATE ${table} SET ${column}=?,updated_at=?,synced_to_cloud=0,sync_revision=sync_revision+1 WHERE id=? AND user_id=?;`, JSON.stringify(next), operation.createdAt, row.id, userId);
    }
  }
  for (const id of previousIds.filter(id => !nextIds.includes(id))) {
    db.runSync('UPDATE local_journey_edit_members SET active=0 WHERE user_id=? AND journey_id=?;', userId, id);
    db.runSync('DELETE FROM local_journeys WHERE user_id=? AND id=?;', userId, id);
  }
  for (const id of nextIds) db.runSync(`UPDATE local_journeys SET song_count=(SELECT COUNT(*) FROM local_music_entries WHERE user_id=? AND journey_id=?) WHERE user_id=? AND id=?;`, userId, id, userId, id);
  db.runSync('DELETE FROM local_atlas_snapshots WHERE user_id=?;', userId);
}

function saveOperation(userId: string, operation: JourneyEditOperation, synced: boolean, status: 'applied' | 'conflict') {
  db.runSync(`INSERT INTO local_journey_edit_operations(id,user_id,root_id,parent_id,payload_json,status,synced_to_cloud,created_at)
    VALUES(?,?,?,?,?,?,?,?);`, operation.id, userId, operation.rootJourneyId, operation.parentId, JSON.stringify(operation), status, synced ? 1 : 0, operation.createdAt);
}

export async function commitJourneyEdit(snapshot: JourneyEditorSnapshot, selection: JourneyEditSelection): Promise<{ rootJourneyId: string; journeyIds: string[]; revision: string }> {
  return commitReviewedJourneyEdit(snapshot, selection);
}

async function commitReviewedJourneyEdit(snapshot: JourneyEditorSnapshot, selection: JourneyEditSelection,
  resolution?: { conflictId: string; choice: 'keep_current' | 'use_incoming' }): Promise<{ rootJourneyId: string; journeyIds: string[]; revision: string }> {
  initializeLocalStore(); assertProfile(snapshot.userId);
  if (selection.kind !== 'restore' && !resolution) {
    const { getMembershipStatus } = await import('../modules/journeydeck-membership');
    const membership = await getMembershipStatus();
    const { TESTFLIGHT_PLUS_UNLOCKED } = await import('./release-features');
    if (!TESTFLIGHT_PLUS_UNLOCKED && (!membership.nativeModuleAvailable || membership.tier !== 'paid')) throw new Error('Journey Editing Studio requires JourneyDeck Plus.');
  }
  const { getNativeAutomaticRecorderStatus } = await import('../modules/journeydeck-recorder');
  const native = await getNativeAutomaticRecorderStatus();
  if (native.nativeModuleAvailable && (native.statusReliable === false || native.recording || native.paused || native.sessionId)) {
    throw new Error('Finish the current recording before editing a saved journey.');
  }
  assertProfile(snapshot.userId); assertRecorderIdle();
  const current = loadJourneyEditor(snapshot.userId, snapshot.journeyId);
  if (current.revision !== snapshot.revision || current.versionToken !== snapshot.versionToken) throw new Error('This journey changed while you were editing. Reopen it to review the latest recording.');
  const conflict = resolution ? db.getFirstSync<{ payload: string }>(`SELECT payload_json AS payload FROM local_journey_edit_operations
    WHERE user_id=? AND root_id=? AND id=? AND status='conflict';`, current.userId, current.rootJourneyId, resolution.conflictId) : null;
  if (resolution && !conflict) throw new Error('This edit conflict changed. Reopen the journey to review it.');
  const incoming = conflict ? parseJourneyEditPayload(conflict.payload, current.userId) : null;
  if (incoming && serializeRouteArchive(current.rootJourneyId, incoming.original.points) !== serializeRouteArchive(current.rootJourneyId, current.original.points)) throw new Error('These edits contain different original routes. Both copies are preserved for recovery.');
  const chosenSegments = resolution?.choice === 'use_incoming' ? incoming!.segments : current.segments;
  const preview = resolution ? previewEditorSegments(current.original, chosenSegments) : previewJourneyEdit({ ...current, splitJourneyId: snapshot.splitJourneyId }, selection);
  if (!resolution && JSON.stringify(preview.segments.map(({ id, startMs, endMs }) => ({ id, startMs, endMs }))) === JSON.stringify(current.segments) && selection.kind !== 'restore') {
    throw new Error('Move a trim handle or choose a split point before saving.');
  }
  const operation: JourneyEditOperation = { version: 1, id: Crypto.randomUUID(), rootJourneyId: current.rootJourneyId,
    parentId: current.revision, createdAt: new Date().toISOString(), kind: selection.kind, original: current.original,
    segments: preview.segments.map(({ id, startMs, endMs }) => ({ id, startMs, endMs })) };
  if (resolution) {
    const currentHead = head(current.userId, current.rootJourneyId);
    operation.kind = resolution.choice === 'use_incoming' ? incoming!.kind : currentHead ? parseJourneyEditPayload(currentHead.payload, current.userId).kind : 'restore';
    operation.resolves = [...new Set([resolution.conflictId, ...(current.revision ? [current.revision] : [])])];
    const currentIds = new Set(operation.original.songs.map(song => song.id));
    operation.original.songs.push(...incoming!.original.songs.filter(song => !currentIds.has(song.id)));
  }
  // Bound the actual UTF-8 asset too, before any local mutation takes place.
  if (new TextEncoder().encode(JSON.stringify(operation)).length > MAX_JOURNEY_EDIT_ASSET_BYTES) throw new Error('This recording is too large for a recoverable edit. Your original is unchanged.');
  // The same strict boundary is used for local saves and private downloads.
  // Never save an operation that a future restore could not decode.
  parseJourneyEditPayload(JSON.stringify(operation), current.userId);
  db.withTransactionSync(() => {
    assertProfile(current.userId); assertRecorderIdle();
    saveOperation(current.userId, operation, false, 'applied');
    writeJourneyProjection(current.userId, operation);
    db.runSync(`INSERT INTO local_journey_edit_heads(user_id,root_id,operation_id) VALUES(?,?,?)
      ON CONFLICT(user_id,root_id) DO UPDATE SET operation_id=excluded.operation_id;`, current.userId, current.rootJourneyId, operation.id);
    for (const id of operation.resolves ?? []) db.runSync("UPDATE local_journey_edit_operations SET status='resolved' WHERE user_id=? AND id=? AND status='conflict';", current.userId, id);
  });
  notifyLocalArchiveChanged();
  return { rootJourneyId: current.rootJourneyId, journeyIds: operation.segments.map(s => s.id), revision: operation.id };
}

export async function resolveJourneyEditConflict(snapshot: JourneyEditorSnapshot, conflictId: string, choice: 'keep_current' | 'use_incoming') {
  return commitReviewedJourneyEdit(snapshot, { kind: 'restore' }, { conflictId, choice });
}

export function getJourneyEditConflictChoices(userId: string, journeyId: string): Array<{ id: string; createdAt: string; kind: JourneyEditSelection['kind']; parts: number; durationMinutes: number }> {
  initializeLocalStore(); assertProfile(userId);
  const rootId = head(userId, journeyId)?.rootJourneyId ?? journeyId;
  return db.getAllSync<{ payload: string }>("SELECT payload_json AS payload FROM local_journey_edit_operations WHERE user_id=? AND root_id=? AND status='conflict' ORDER BY created_at;", userId, rootId).map(row => {
    const operation = parseJourneyEditPayload(row.payload, userId);
    return { id: operation.id, createdAt: operation.createdAt, kind: operation.kind, parts: operation.segments.length,
      durationMinutes: operation.segments.reduce((total, s) => total + (s.endMs - s.startMs) / 60_000, 0) };
  });
}

function safeId(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 255; }
export function parseJourneyEditPayload(raw: string, userId: string): JourneyEditOperation {
  if (raw.length > MAX_JOURNEY_EDIT_ASSET_BYTES) throw new Error('The private journey edit exceeds the supported size.');
  let operation: JourneyEditOperation;
  try { operation = JSON.parse(raw) as JourneyEditOperation; }
  catch { throw new Error('The private journey edit is not valid JSON.'); }
  if (!operation || operation.version !== 1 || !safeId(operation.id) || !safeId(operation.rootJourneyId) ||
    !(operation.parentId === null || safeId(operation.parentId)) || !Number.isFinite(Date.parse(operation.createdAt)) ||
    !['trim', 'split', 'restore'].includes(operation.kind) || !operation.original?.journey || !Array.isArray(operation.original.points) ||
    !Array.isArray(operation.original.songs) || operation.original.songs.length > 20_000 || !Array.isArray(operation.segments)) {
    throw new Error('The private journey edit is incomplete.');
  }
  if (operation.resolves && (!Array.isArray(operation.resolves) || operation.resolves.length > 32 || operation.resolves.some(id => !safeId(id)))) throw new Error('The private edit conflict resolution is invalid.');
  const original = operation.original, journey = original.journey;
  if (journey.id !== operation.rootJourneyId || !Number.isFinite(Date.parse(journey.startedAt)) || !Number.isFinite(Date.parse(journey.endedAt)) ||
    !Number.isFinite(Date.parse(journey.createdAt)) || !Number.isFinite(Date.parse(journey.updatedAt)) ||
    !Number.isFinite(journey.miles) || journey.miles < 0 || !Number.isFinite(journey.durationMinutes) || journey.durationMinutes < 0 ||
    original.points.length > MAX_EDITOR_POINTS || operation.segments[0]?.id !== operation.rootJourneyId) throw new Error('The private journey edit identity is invalid.');
  journey.userId = userId;
  original.points = parseRouteArchive(serializeRouteArchive(journey.id, original.points), journey.id, original.points.length)
    .map(point => ({ ...point, journeyId: journey.id }));
  const songIds = new Set<string>();
  for (const song of original.songs) {
    if (!safeId(song.id) || songIds.has(song.id) || !['apple_music', 'shazam', 'lastfm', 'spotify'].includes(song.source) ||
      !Number.isFinite(Date.parse(song.playedAt)) || typeof song.track !== 'string' || typeof song.artist !== 'string' ||
      (song.durationMs != null && (!Number.isFinite(song.durationMs) || song.durationMs < 0))) throw new Error('The private journey edit contains invalid music.');
    songIds.add(song.id); song.userId = userId;
  }
  if (operation.segments.some(segment => !safeId(segment.id))) throw new Error('The private journey part identifier is invalid.');
  validateEditorSegments(original, operation.segments);
  return operation;
}

export function journeyEditsPendingSync(userId: string, limit = 10): StoredJourneyEdit[] {
  initializeLocalStore();
  return db.getAllSync<StoredJourneyEdit>(`SELECT id,root_id AS rootJourneyId,parent_id AS parentId,payload_json AS payload,created_at AS createdAt,status
    FROM local_journey_edit_operations WHERE user_id=? AND synced_to_cloud=0 ORDER BY created_at,id LIMIT ?;`, userId, limit);
}

export function acknowledgeJourneyEdits(userId: string, ids: string[]) {
  initializeLocalStore();
  for (const id of ids) db.runSync('UPDATE local_journey_edit_operations SET synced_to_cloud=1 WHERE user_id=? AND id=?;', userId, id);
}

export function requeueDeletedJourneyEdits(userId: string, recordNames: string[]) {
  initializeLocalStore();
  for (const name of recordNames) if (name.startsWith('edit_')) db.runSync('UPDATE local_journey_edit_operations SET synced_to_cloud=0 WHERE user_id=? AND id=?;', userId, name.slice(5));
}

/** Competing branches are durable conflicts, never an automatic last-writer overwrite. */
export function ingestJourneyEdit(userId: string, raw: string): 'applied' | 'known' | 'conflict' | 'deferred' {
  initializeLocalStore();
  const operation = parseJourneyEditPayload(raw, userId);
  const existing = db.getFirstSync<{ user_id: string; payload_json: string; status: string }>('SELECT user_id,payload_json,status FROM local_journey_edit_operations WHERE id=?;', operation.id);
  if (existing) {
    if (existing.user_id !== userId || JSON.stringify(parseJourneyEditPayload(existing.payload_json, userId)) !== JSON.stringify(operation)) throw new Error('An immutable private edit changed unexpectedly.');
    acknowledgeJourneyEdits(userId, [operation.id]);
    return existing.status === 'conflict' ? 'conflict' : 'known';
  }
  if (db.getFirstSync("SELECT id FROM recording_sessions WHERE status IN ('recording','paused','finishing') LIMIT 1;")) return 'deferred';
  const current = head(userId, operation.rootJourneyId);
  if (operation.parentId && !db.getFirstSync('SELECT id FROM local_journey_edit_operations WHERE id=? AND user_id=? AND root_id=?;', operation.parentId, userId, operation.rootJourneyId)) return 'deferred';
  if ((current?.id ?? null) !== operation.parentId && !(current && operation.resolves?.includes(current.id))) {
    db.withTransactionSync(() => saveOperation(userId, operation, true, 'conflict'));
    return 'conflict';
  }
  if (current) {
    const before = parseJourneyEditPayload(current.payload, userId).original;
    if (serializeRouteArchive(operation.rootJourneyId, before.points) !== serializeRouteArchive(operation.rootJourneyId, operation.original.points)
      || before.journey.startedAt !== operation.original.journey.startedAt || before.journey.endedAt !== operation.original.journey.endedAt) {
      db.withTransactionSync(() => saveOperation(userId, operation, true, 'conflict'));
      return 'conflict';
    }
  }
  const local = getJourney(userId, operation.rootJourneyId);
  const localPoints = !current && local ? listJourneyGpsPoints(userId, local.id) : [];
  if (!current && local && (!local.syncedToCloud || (localPoints.length > 0 &&
    (!getRouteArchive(userId, local.id)?.syncedToCloud || serializeRouteArchive(local.id, localPoints) !== serializeRouteArchive(local.id, operation.original.points))))) {
    // Retain the competing operation so its original/route cannot disappear;
    // a dirty local recording must not be overwritten during its first backup.
    db.withTransactionSync(() => saveOperation(userId, operation, true, 'conflict'));
    return 'conflict';
  }
  db.withTransactionSync(() => {
    saveOperation(userId, operation, true, 'applied');
    writeJourneyProjection(userId, operation);
    db.runSync(`INSERT INTO local_journey_edit_heads(user_id,root_id,operation_id) VALUES(?,?,?)
      ON CONFLICT(user_id,root_id) DO UPDATE SET operation_id=excluded.operation_id;`, userId, operation.rootJourneyId, operation.id);
    for (const id of operation.resolves ?? []) db.runSync("UPDATE local_journey_edit_operations SET status='resolved' WHERE user_id=? AND id=? AND status='conflict';", userId, id);
  });
  notifyLocalArchiveChanged();
  return 'applied';
}

export function listJourneyEditConflicts(userId: string): Array<{ id: string; rootJourneyId: string; createdAt: string }> {
  initializeLocalStore();
  return db.getAllSync('SELECT id,root_id AS rootJourneyId,created_at AS createdAt FROM local_journey_edit_operations WHERE user_id=? AND status=\'conflict\' ORDER BY created_at DESC;', userId);
}
