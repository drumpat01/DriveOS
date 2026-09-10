import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE local_journeys(id TEXT PRIMARY KEY,user_id TEXT,started_at TEXT,ended_at TEXT,miles REAL,duration_minutes REAL,start_place_id TEXT,end_place_id TEXT);
    CREATE TABLE local_places(id TEXT PRIMARY KEY,user_id TEXT,label TEXT);
    CREATE TABLE local_music_entries(id TEXT PRIMARY KEY,user_id TEXT,journey_id TEXT,played_at TEXT,track TEXT,artist TEXT,album TEXT,duration_ms REAL,artwork_url TEXT,song_id TEXT);
    CREATE TABLE local_songs(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,artist TEXT,album_id TEXT,artwork_id TEXT,duration_ms REAL);
    CREATE TABLE local_albums(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,artwork_id TEXT);
    CREATE TABLE local_artworks(id TEXT PRIMARY KEY,user_id TEXT,remote_url TEXT);
    CREATE TABLE local_gps_points(journey_id TEXT,sequence INTEGER,latitude REAL,longitude REAL,PRIMARY KEY(journey_id,sequence));
    INSERT INTO local_journeys VALUES('j','owner','2025-07-01T10:00:00Z','2025-07-01T11:00:00Z',10,60,null,null);
    INSERT INTO local_journeys VALUES('other','other-owner','2025-07-01T10:00:00Z','2025-07-01T11:00:00Z',999,60,null,null);
    INSERT INTO local_music_entries VALUES('song','owner','j','2025-07-01T10:10:00Z','Before edit','Artist','Album',180000,null,null);
    INSERT INTO local_music_entries VALUES('private-song','other-owner','other','2025-07-01T10:10:00Z','Other profile','Artist','Album',180000,null,null);
    INSERT INTO local_gps_points VALUES('j',0,20,20),('j',1,20.01,20.01),('other',0,30,30),('other',1,30.01,30.01);
  `);
  let inTransaction = false, transactions = 0, owner = 'owner', afterJourneyRead: (() => void) | null = null;
  const queries: string[] = [];
  const db = {
    withTransactionSync(work: () => void) {
      transactions++; inTransaction = true; sql.exec('BEGIN');
      try { work(); sql.exec('COMMIT'); } catch (error) { sql.exec('ROLLBACK'); throw error; }
      finally { inTransaction = false; }
    },
    getAllSync(query: string, ...params: any[]) {
      assert.equal(inTransaction, true, 'all recap database reads belong to one transaction');
      queries.push(query); const value = sql.prepare(query).all(...params);
      if (/SELECT j.id,j.started_at/.test(query) && afterJourneyRead) queueMicrotask(afterJourneyRead);
      return value;
    },
    getFirstSync(query: string, ...params: any[]) {
      assert.equal(inTransaction, true); queries.push(query); return sql.prepare(query).get(...params);
    },
  };
  const dependencies: Record<string, any> = {
    './auth': { getCurrentUser: () => ({ id: owner }) }, './database-owner': { getMasterDatabase: () => db },
    './journey-visibility': { isVisibleJourney: () => true },
    './local-store': { initializeLocalStore() {},
      listMemories: () => { assert.equal(inTransaction, true); return [{ id: 'memory', name: 'Trip', journeyIds: '["j"]', coverPhotoId: 'cover' }]; },
      getPhotoIncludingDeleted: () => { assert.equal(inTransaction, true); return { deletedAt: null, memoryId: 'memory', localUri: 'file:///private/cover.jpg' }; },
    },
  };
  const module = { exports: {} as any };
  class SnapshotDate extends Date { static now() { return Date.parse('2025-08-01T00:00:00Z'); } }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/feature-archive-data.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (name: string) => {
    assert.ok(dependencies[name], name); return dependencies[name];
  }, Date: SnapshotDate, Math, JSON });
  return { sql, queries, load: module.exports.loadYearOnRoadData as (user: string, cancel: () => boolean) => Promise<any>,
    owner: (value: string) => { owner = value; }, transactions: () => transactions,
    afterJourneyRead: (fn: () => void) => { afterJourneyRead = fn; },
  };
}

test('year loader returns one coherent journey/music/Memory snapshot even when an edit is queued during its read', async () => {
  const h = fixture();
  try {
    h.afterJourneyRead(() => h.sql.exec("UPDATE local_journeys SET miles=20 WHERE id='j'; UPDATE local_music_entries SET track='After edit' WHERE id='song';"));
    const data = await h.load('owner', () => false);
    assert.equal(h.transactions(), 1); assert.equal(data.journeys.length, 1); assert.equal(data.songs.length, 1);
    assert.equal(data.journeys[0].miles, 10); assert.equal(data.songs[0].track, 'Before edit');
    assert.equal(data.memories[0].photoUri, 'file:///private/cover.jpg');
    assert.equal(h.sql.prepare("SELECT miles FROM local_journeys WHERE id='j'").get()!.miles, 20, 'queued edit proceeds after snapshot');
  } finally { h.sql.close(); }
});

test('future/invalid-distance journeys cannot steal the eligible longest route; raw GPS rows are bounded in SQL', async () => {
  const h = fixture();
  try {
    h.sql.exec("INSERT INTO local_journeys VALUES('future','owner','2025-12-01','2025-12-02',999999,60,null,null); INSERT INTO local_journeys VALUES('invalid','owner','2025-07-02','2025-07-03',-1,60,null,null);");
    const insert = h.sql.prepare("INSERT INTO local_gps_points VALUES('j',?,?,?)");
    h.sql.exec('BEGIN'); for (let i = 2; i < 150_000; i++) insert.run(i, 20 + i / 1_000_000, 20 + i / 1_000_000); h.sql.exec('COMMIT');
    const data = await h.load('owner', () => false);
    const coordinates = data.journeys.find((j: any) => j.id === 'j').route.coordinates;
    assert.ok(coordinates.length >= 2 && coordinates.length <= 321);
    assert.deepEqual(Array.from(coordinates[0]), [20, 20]);
    assert.deepEqual(Array.from(coordinates.at(-1)), [20.149999, 20.149999]);
    assert.equal(data.journeys.find((j: any) => j.id === 'future').route, undefined);
    assert.equal(data.journeys.find((j: any) => j.id === 'invalid').route, undefined);
    assert.equal(h.queries.filter(q => /MAX\(p.sequence\)/.test(q)).length, 1);
  } finally { h.sql.close(); }
});

test('owner changes or a closed screen reject the recap before a private query runs', async () => {
  const h = fixture();
  try {
    h.owner('other-owner'); await assert.rejects(h.load('owner', () => false), /profile changed/);
    h.owner('owner'); await assert.rejects(h.load('owner', () => true), /closed/);
    assert.equal(h.queries.length, 0); assert.equal(h.transactions(), 0);
  } finally { h.sql.close(); }
});
