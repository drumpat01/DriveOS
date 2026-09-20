import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { previewJourneyEdit, editorSongSegment } from '../src/journey-editor-model.ts';

const require = createRequire(import.meta.url), ts = require('typescript');
const directory = fileURLToPath(new URL('../src/', import.meta.url));
const clone = (value: any) => JSON.parse(JSON.stringify(value));

function fixture() {
  const database = new DatabaseSync(':memory:');
  const state = { userId: '', paid: true, recording: false, notices: 0 };
  const db = {
    execSync: (sql: string) => database.exec(sql),
    runSync: (sql: string, ...params: any[]) => database.prepare(sql).run(...params),
    getFirstSync: (sql: string, ...params: any[]) => database.prepare(sql).get(...params) ?? null,
    getAllSync: (sql: string, ...params: any[]) => database.prepare(sql).all(...params),
    withTransactionSync(work: () => void) {
      database.exec('BEGIN IMMEDIATE');
      try { work(); database.exec('COMMIT'); } catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
  const loaded = new Map<string, any>();
  const overrides: Record<string, any> = {
    'expo-crypto': { randomUUID },
    './auth': { getCurrentUser: () => ({ id: state.userId }) },
    './database-owner': { getMasterDatabase: () => db },
    './local-archive-events': { notifyLocalArchiveChanged: () => state.notices++ },
    '../modules/journeydeck-membership': { getMembershipStatus: async () => ({ nativeModuleAvailable: true, tier: state.paid ? 'paid' : 'free' }) },
    '../modules/journeydeck-recorder': { getNativeAutomaticRecorderStatus: async () => ({ nativeModuleAvailable: true, statusReliable: true, recording: state.recording, paused: false, sessionId: null }) },
  };
  function load(path: string): any {
    if (loaded.has(path)) return loaded.get(path);
    const exports: any = {};
    loaded.set(path, exports);
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(compiled, { exports, Date, Math, JSON, Map, Set, TextEncoder, console,
      require: (id: string) => id in overrides ? overrides[id] : load(resolve(dirname(path), `${id}.ts`)) });
    return exports;
  }
  const store = load(resolve(directory, 'local-store.ts'));
  store.initializeLocalStore();
  state.userId = store.ensureLocalUser({ displayName: 'Test driver' }).id;
  store.setActiveLocalUserId(state.userId);
  const editor = load(resolve(directory, 'journey-editor-store.ts'));
  const start = Date.parse('2026-09-07T12:00:00.000Z');
  const journey = { id: 'root_journey', userId: state.userId, legacyDriveId: null,
    startedAt: new Date(start).toISOString(), endedAt: new Date(start + 600_000).toISOString(),
    durationMinutes: 10, miles: 4, startLat: 0, startLng: 0, endLat: 0, endLng: .01,
    startPlaceId: null, endPlaceId: null, averageSpeedMph: 24, maxSpeedMph: 30,
    songCount: 4, vehicleName: 'Test car', provider: 'native_recorder' };
  store.upsertJourney(journey, { syncedToCloud: 1 });
  const points = Array.from({ length: 11 }, (_, sequence) => ({ sequence, recordedAt: new Date(start + sequence * 60_000).toISOString(),
    latitude: 0, longitude: sequence * .001, accuracyMeters: 5, altitudeMeters: null, headingDegrees: 90, speedMps: 10 }));
  store.insertGpsPoints(state.userId, journey.id, points);
  database.exec('UPDATE local_journeys SET route_synced_to_cloud=1;');
  for (const minute of [0, 2, 5, 10]) store.upsertMusicEntry({ id: `song_${minute}`, userId: state.userId, journeyId: journey.id,
    source: 'apple_music', playedAt: new Date(start + minute * 60_000).toISOString(), track: `Song ${minute}`, artist: 'Test artist',
    album: null, durationMs: 60_000, artworkUrl: null, externalUrl: null, confidence: 1 }, { syncedToCloud: 1 });
  store.upsertMemory({ id: 'journey_memory_test', userId: state.userId, name: 'Original Memory', notes: null, artworkKey: null,
    coverPhotoId: null, coverPhotoLocalPath: null, journeyIds: JSON.stringify([journey.id, 'unrelated']) });
  return { database, state, store, editor, start, journey,
    snapshot: () => editor.loadJourneyEditor(state.userId, journey.id), close: () => database.close() };
}

test('trim interpolates endpoints live and commit keeps the complete original recoverable', async () => {
  const f = fixture();
  try {
    const snapshot = f.snapshot(), originalPoints = clone(snapshot.original.points);
    const selection = { kind: 'trim' as const, startMs: f.start + 90_000, endMs: f.start + 390_000 };
    const preview = previewJourneyEdit(snapshot, selection);
    assert.ok(Math.abs(preview.segments[0]!.points[0]!.longitude - .0015) < 1e-10);
    assert.equal(preview.segments[0]?.durationMinutes, 5);
    assert.equal(preview.segments[0]?.songCount, 2);
    await f.editor.commitJourneyEdit(snapshot, selection);
    assert.equal(f.store.getJourney(f.state.userId, f.journey.id).durationMinutes, 5);
    assert.equal(f.store.getMusicEntry(f.state.userId, 'song_0').journeyId, null);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_music_entries').get()?.n, 4);
    assert.deepEqual(clone(f.snapshot().original.points), originalPoints);
    assert.equal(f.store.journeysPendingSync(f.state.userId).length, 0);
    assert.equal(f.store.routeArchivesPendingSync(f.state.userId).length, 0);
    assert.equal(f.store.musicEntriesPendingSync(f.state.userId).length, 0);
    assert.equal(f.editor.journeyEditsPendingSync(f.state.userId).length, 1);
    f.state.paid = false;
    await f.editor.commitJourneyEdit(f.snapshot(), { kind: 'restore' });
    assert.deepEqual(clone(f.store.listJourneyGpsPoints(f.state.userId, f.journey.id)), originalPoints);
    assert.equal(f.store.getJourney(f.state.userId, f.journey.id).miles, 4);
    assert.equal(f.store.getMusicEntry(f.state.userId, 'song_0').journeyId, f.journey.id);
  } finally { f.close(); }
});

test('cached boundary GPS fixes remain exactly recoverable after trim and restore', async () => {
  const f = fixture();
  try {
    f.database.prepare('UPDATE local_gps_points SET recorded_at=? WHERE journey_id=? AND sequence=0').run(new Date(f.start - 1_000).toISOString(), f.journey.id);
    f.database.prepare('UPDATE local_gps_points SET recorded_at=? WHERE journey_id=? AND sequence=10').run(new Date(f.start + 601_000).toISOString(), f.journey.id);
    const snapshot = f.snapshot(), originalPoints = clone(snapshot.original.points);
    await f.editor.commitJourneyEdit(snapshot, { kind: 'trim', startMs: f.start + 60_000, endMs: f.start + 540_000 });
    assert.deepEqual(clone(f.snapshot().original.points), originalPoints);
    const visible = f.store.listJourneyGpsPoints(f.state.userId, f.journey.id);
    assert.equal(visible[0].recordedAt, new Date(f.start + 60_000).toISOString());
    assert.equal(visible.at(-1).recordedAt, new Date(f.start + 540_000).toISOString());
    await f.editor.commitJourneyEdit(f.snapshot(), { kind: 'restore' });
    assert.deepEqual(clone(f.store.listJourneyGpsPoints(f.state.userId, f.journey.id)), originalPoints);
    assert.deepEqual(clone(f.snapshot().original.points), originalPoints);
  } finally { f.close(); }
});

test('split counts boundary songs once and preserves sibling edits and Memory deltas', async () => {
  const f = fixture();
  try {
    const result = await f.editor.commitJourneyEdit(f.snapshot(), { kind: 'split', atMs: f.start + 300_000 });
    const second = result.journeyIds[1];
    assert.equal(result.journeyIds.length, 2);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n,SUM(duration_minutes) AS minutes,SUM(song_count) AS songs FROM local_journeys').get()?.n, 2);
    assert.equal(f.store.getMusicEntry(f.state.userId, 'song_5').journeyId, second);
    assert.equal(f.store.getMusicEntry(f.state.userId, 'song_10').journeyId, second);
    assert.deepEqual(JSON.parse(f.store.listMemories(f.state.userId)[0].journeyIds), [f.journey.id, second, 'unrelated']);
    const first = f.snapshot();
    await f.editor.commitJourneyEdit(first, { kind: 'trim', startMs: f.start + 60_000, endMs: f.start + 240_000 });
    assert.equal(f.store.getJourney(f.state.userId, second).durationMinutes, 5);
    const memory = f.store.listMemories(f.state.userId)[0];
    f.store.upsertMemory({ ...memory, name: 'Renamed independently', journeyIds: JSON.stringify([second, 'unrelated', 'later']) });
    await f.editor.commitJourneyEdit(f.snapshot(), { kind: 'restore' });
    assert.equal(f.store.getJourney(f.state.userId, second), null);
    const restored = f.store.listMemories(f.state.userId)[0];
    assert.equal(restored.name, 'Renamed independently');
    assert.deepEqual(JSON.parse(restored.journeyIds), [f.journey.id, 'unrelated', 'later']);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_journeys').get()?.n, 1);
  } finally { f.close(); }
});

test('paywall, native recording and stale review block before mutation', async () => {
  const f = fixture();
  try {
    const selection = { kind: 'trim', startMs: f.start + 60_000, endMs: f.start + 540_000 };
    f.state.paid = false;
    await assert.rejects(f.editor.commitJourneyEdit(f.snapshot(), selection), /Plus/);
    f.state.paid = true; f.state.recording = true;
    await assert.rejects(f.editor.commitJourneyEdit(f.snapshot(), selection), /recording/);
    f.state.recording = false;
    const stale = f.snapshot();
    f.database.prepare('UPDATE local_journeys SET miles=20 WHERE id=?').run(f.journey.id);
    await assert.rejects(f.editor.commitJourneyEdit(stale, selection), /changed/);
    assert.equal(f.editor.journeyEditsPendingSync(f.state.userId).length, 0);
    const other = f.store.ensureLocalUser({ displayName: 'Other driver' }).id;
    assert.throws(() => f.editor.loadJourneyEditor(other, f.journey.id), /active library/);
  } finally { f.close(); }
});

test('SQLite failure rolls back original snapshot, route, songs and Memory together', async () => {
  const f = fixture();
  try {
    const before = clone(f.snapshot());
    f.database.exec("CREATE TRIGGER injected_failure BEFORE UPDATE OF collection_ids ON local_memories BEGIN SELECT RAISE(ABORT,'disk fixture'); END;");
    await assert.rejects(f.editor.commitJourneyEdit(f.snapshot(), { kind: 'split', atMs: f.start + 300_000 }), /disk fixture/);
    assert.equal(f.editor.journeyEditsPendingSync(f.state.userId).length, 0);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_journeys').get()?.n, 1);
    assert.deepEqual(clone(f.snapshot().original), before.original);
  } finally { f.close(); }
});

test('remote operation restores atomically, defers missing parent and rejects stale ordinary records', async () => {
  const a = fixture(), b = fixture();
  try {
    await a.editor.commitJourneyEdit(a.snapshot(), { kind: 'split', atMs: a.start + 300_000 });
    const split = a.editor.journeyEditsPendingSync(a.state.userId)[0];
    await a.editor.commitJourneyEdit(a.snapshot(), { kind: 'restore' });
    const restore = a.editor.journeyEditsPendingSync(a.state.userId).find((row: any) => row.id !== split.id);
    assert.equal(b.editor.ingestJourneyEdit(b.state.userId, restore.payload), 'deferred');
    assert.equal(b.editor.ingestJourneyEdit(b.state.userId, split.payload), 'applied');
    assert.equal(b.editor.ingestJourneyEdit(b.state.userId, restore.payload), 'applied');
    const retired = JSON.parse(split.payload).segments[1].id;
    b.store.upsertJourney({ ...b.journey, id: retired, durationMinutes: 500 });
    b.store.upsertJourney({ ...b.journey, durationMinutes: 500 });
    b.store.insertGpsPoints(b.state.userId, b.journey.id, [{ sequence: 100, recordedAt: new Date(b.start).toISOString(), latitude: 0, longitude: 0, accuracyMeters: 1, altitudeMeters: null, headingDegrees: null, speedMps: 0 }]);
    assert.equal(b.store.getJourney(b.state.userId, retired), null);
    assert.equal(b.store.getJourney(b.state.userId, b.journey.id).durationMinutes, 10);
    assert.equal(b.store.listJourneyGpsPoints(b.state.userId, b.journey.id).length, 11);
    const memory = b.store.listMemories(b.state.userId)[0];
    b.store.upsertMemory({ ...memory, journeyIds: JSON.stringify([retired]) });
    assert.deepEqual(JSON.parse(b.store.listMemories(b.state.userId)[0].journeyIds), [b.journey.id]);
  } finally { a.close(); b.close(); }
});

test('concurrent device edits retain both copies and an explicit resolution converges', async () => {
  const a = fixture(), b = fixture();
  try {
    await a.editor.commitJourneyEdit(a.snapshot(), { kind: 'trim', startMs: a.start + 60_000, endMs: a.start + 540_000 });
    await b.editor.commitJourneyEdit(b.snapshot(), { kind: 'split', atMs: b.start + 300_000 });
    const first = a.editor.journeyEditsPendingSync(a.state.userId)[0], second = b.editor.journeyEditsPendingSync(b.state.userId)[0];
    assert.equal(a.editor.ingestJourneyEdit(a.state.userId, second.payload), 'conflict');
    assert.equal(b.editor.ingestJourneyEdit(b.state.userId, first.payload), 'conflict');
    assert.equal(a.editor.getJourneyEditConflictChoices(a.state.userId, a.journey.id).length, 1);
    const chosen = await a.editor.resolveJourneyEditConflict(a.snapshot(), second.id, 'use_incoming');
    const resolution = a.editor.journeyEditsPendingSync(a.state.userId).find((row: any) => row.id === chosen.revision);
    assert.equal(b.editor.ingestJourneyEdit(b.state.userId, resolution.payload), 'applied');
    assert.deepEqual(clone(a.snapshot().segments), clone(b.snapshot().segments));
    assert.equal(a.editor.listJourneyEditConflicts(a.state.userId).length, 0);
    assert.equal(b.editor.listJourneyEditConflicts(b.state.userId).length, 0);
    assert.equal(a.database.prepare('SELECT COUNT(*) AS n FROM local_journey_edit_operations').get()?.n, 3);
  } finally { a.close(); b.close(); }
});

test('split rejects tiny sections and timestamp boundary assignment is deterministic', () => {
  const f = fixture();
  try {
    assert.throws(() => previewJourneyEdit(f.snapshot(), { kind: 'split', atMs: f.start + 5_000 }), /ten seconds/);
    const segments = [{ id: 'a', startMs: 0, endMs: 10_000 }, { id: 'b', startMs: 10_000, endMs: 20_000 }];
    assert.equal(editorSongSegment(segments, new Date(10_000).toISOString()), 'b');
    assert.equal(editorSongSegment(segments, new Date(20_000).toISOString()), 'b');
  } finally { f.close(); }
});

test('a split part can be split again and late-discovered music is preserved through restore', async () => {
  const f = fixture();
  try {
    const split = await f.editor.commitJourneyEdit(f.snapshot(), { kind: 'split', atMs: f.start + 300_000 });
    const second = split.journeyIds[1];
    const another = await f.editor.commitJourneyEdit(f.editor.loadJourneyEditor(f.state.userId, second), { kind: 'split', atMs: f.start + 450_000 });
    assert.equal(another.journeyIds.length, 3);
    f.store.upsertMusicEntry({ id: 'late_play', userId: f.state.userId, journeyId: f.journey.id, source: 'apple_music',
      playedAt: new Date(f.start + 480_000).toISOString(), track: 'Late discovered', artist: 'Artist', album: null,
      durationMs: 60_000, artworkUrl: null, externalUrl: null, confidence: 1 });
    assert.equal(f.store.getMusicEntry(f.state.userId, 'late_play').journeyId, another.journeyIds[2]);
    f.store.upsertMusicEntry({ ...f.store.getMusicEntry(f.state.userId, 'song_10'), journeyId: f.journey.id });
    assert.equal(f.store.getMusicEntry(f.state.userId, 'song_10').journeyId, another.journeyIds[2], 'old recorder replay cannot reassign an edited song');
    await f.editor.commitJourneyEdit(f.snapshot(), { kind: 'restore' });
    assert.equal(f.store.getMusicEntry(f.state.userId, 'late_play').journeyId, f.journey.id);
    assert.equal(f.store.getJourney(f.state.userId, f.journey.id).songCount, 5);
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM local_music_entries').get()?.n, 5);
  } finally { f.close(); }
});

test('backup acknowledgements do not invalidate a preview and originals are database-immutable', async () => {
  const f = fixture();
  try {
    f.database.exec('UPDATE local_journeys SET synced_to_cloud=0,route_synced_to_cloud=0; UPDATE local_music_entries SET synced_to_cloud=0;');
    const snapshot = f.snapshot();
    f.database.exec('UPDATE local_journeys SET synced_to_cloud=1,route_synced_to_cloud=1; UPDATE local_music_entries SET synced_to_cloud=1;');
    const edit = await f.editor.commitJourneyEdit(snapshot, { kind: 'trim', startMs: f.start + 60_000, endMs: f.start + 540_000 });
    assert.throws(() => f.database.prepare('UPDATE local_journey_edit_operations SET payload_json=\'{}\' WHERE id=?').run(edit.revision), /cannot be overwritten/);
    assert.equal(f.database.prepare('PRAGMA user_version').get()?.user_version, 9);
    assert.deepEqual(f.database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { f.close(); }
});
