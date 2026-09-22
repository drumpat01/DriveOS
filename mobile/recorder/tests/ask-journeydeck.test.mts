import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const resource = 'modules/journeydeck-recorder/ios/AskResources/';
const engine = require(resolve(root, resource, 'ask-engine.js'));
const queries = JSON.parse(readFileSync(resolve(root, resource, 'ask-queries.json'), 'utf8'));
const analysisQueries = JSON.parse(readFileSync(resolve(root, resource, 'ask-analysis-queries.json'), 'utf8'));
const now = new Date(2026, 8, 16, 12).getTime();
const iso = (day: number, hour = 10) => new Date(2026, 8, day, hour).toISOString();
function fixture() {
  const db = new DatabaseSync(':memory:');
  const adapter = {
    execSync: (sql: string) => db.exec(sql),
    runSync: (sql: string, ...args: any[]) => db.prepare(sql).run(...args),
    getFirstSync: (sql: string, ...args: any[]) => db.prepare(sql).get(...args) ?? null,
    getAllSync: (sql: string, ...args: any[]) => db.prepare(sql).all(...args),
    withTransactionSync(fn: () => void) { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
  const loaded = new Map<string, any>();
  function load(path: string): any {
    if (loaded.has(path)) return loaded.get(path);
    const exports = {}; loaded.set(path, exports);
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(compiled, { exports, console, require: (id: string) => id === 'expo-crypto' ? { randomUUID } : id === './database-owner' ? { getMasterDatabase: () => adapter } : load(resolve(dirname(path), `${id}.ts`)) });
    return exports;
  }
  const store = load(resolve(root, 'src/local-store.ts'));
  const a = store.ensureLocalUser({ displayName: 'A' }).id, b = store.ensureLocalUser({ displayName: 'B' }).id;
  store.setActiveLocalUserId(a);
  const journey = (id: string, userId: string, day: number, miles: number) => store.upsertJourney({ id, userId, startedAt: iso(day), endedAt: iso(day, 11), miles, durationMinutes: 60, songCount: 0, provider: 'native' });
  journey('a-first', a, 5, 30); journey('a-week', a, 14, 12.5); journey('a-last', a, 15, 7.25); journey('b-secret', b, 16, 999);
  const play = (id: string, journeyId: string, day: number, artist: string, userId = a) => store.upsertMusicEntry({
    id, userId, journeyId, source: 'apple_music', playedAt: new Date(new Date(iso(day)).getTime() + 300000).toISOString(),
    track: `Track ${id}`, artist, album: null, durationMs: 180000, artworkUrl: null, externalUrl: null, confidence: 1,
  });
  play('one', 'a-week', 14, 'Example Artist'); play('two', 'a-last', 15, 'Example Artist'); play('three', 'a-first', 5, 'Other Artist');
  play('other-user', 'b-secret', 16, 'PRIVATE PROFILE ARTIST', b);
  store.upsertMemory({ id: 'memory-a', userId: a, name: '123 Private Road', notes: 'secret note', journeyIds: '["a-week"]' }, { createdAt: iso(14) });
  store.upsertMemory({ id: 'memory-b', userId: b, name: 'other profile', journeyIds: '[]' }, { createdAt: iso(14) });
  store.upsertMemory({ id: 'memory-deleted', userId: a, name: 'deleted', journeyIds: '[]' }, { createdAt: iso(14), deletedAt: iso(15) });
  const read = (user = a, cutoff = now - 45 * 86400000) => {
    const args = [user, new Date(cutoff).toISOString(), new Date(now).toISOString()];
    return { now, cutoff, journeys: db.prepare(queries.journeys).all(...args), memories: db.prepare(queries.memories).all(...args), music: db.prepare(queries.music).all(...args), sensitiveLabels: db.prepare(queries.sensitiveLabels).all(user) };
  };
  return { db, store, a, b, read, journey, play };
}

test('AI analysis SQL is read-only, profile scoped, and excludes marker content while preserving attachment counts', () => {
  const f = fixture();
  try {
    const marker = f.db.prepare('INSERT INTO local_journey_markers(id,user_id,session_id,root_journey_id,captured_at,location_at,latitude,longitude,accuracy_meters,notes) VALUES(?,?,?,?,?,?,?,?,?,?)');
    marker.run('marker-a', f.a, 'session', 'a-last', iso(15), iso(15), 0, 0, 10, 'SECRET NOTE');
    marker.run('marker-b', f.b, 'other', 'b-secret', iso(16), iso(16), 0, 0, 10, 'OTHER SECRET');
    f.db.prepare('INSERT INTO local_marker_media(id,marker_id,kind,file_name,created_at) VALUES(?,?,?,?,?)').run('media', 'marker-a', 'voice', 'private-file.m4a', iso(15));
    const values = [f.a, new Date(now - 45 * 86400000).toISOString(), new Date(now).toISOString()];
    const data = Object.fromEntries(Object.entries(analysisQueries).map(([key, sql]) => [key, f.db.prepare(sql as string).all(...(key === 'places' ? [f.a] : values))]));
    assert.equal(data.journeys.length, 3); assert.equal(data.music.length, 3); assert.equal(data.memories.length, 1);
    assert.equal(data.memoryJourneys.length, 1); assert.equal(data.memoryJourneys[0].journeyId, 'a-week');
    assert.equal(data.markers.length, 1); assert.equal(data.markers[0].photos, 0);
    assert.doesNotMatch(JSON.stringify(data), /SECRET|private-file|123 Private Road|latitude|longitude|999/);
    f.db.prepare('UPDATE local_journey_markers SET deleted_at=? WHERE id=?').run(iso(16), 'marker-a');
    assert.equal(f.db.prepare(analysisQueries.markers).all(...values).length, 0);
  } finally { f.db.close(); }
});

test('three representative questions and a same-period follow-up execute the exact native engine and SQL', () => {
  const f = fixture();
  try {
    const data = f.read();
    const miles = engine.answer('How many miles did I drive this week?', data, null);
    assert.equal(miles.status, 'answered'); assert.match(miles.text, /19.8 miles across 2 journeys this week/);
    assert.deepEqual(miles.evidence.map((e: any) => e.id), ['a-last', 'a-week']);
    const last = engine.answer('When was my last journey?', data, null);
    assert.match(last.text, /Sep 15, 2026.*7.3 miles/); assert.equal(last.evidence[0].id, 'a-last');
    const artist = engine.answer('What was my top artist this month?', data, null);
    assert.match(artist.text, /Example Artist.*2 recorded song plays this month/);
    const followup = engine.answer('And how many journeys was that?', data, miles.context);
    assert.match(followup.text, /2 journeys this week/);
    assert.equal(followup.context.range.start, miles.context.range.start);
    assert.match(engine.answer('What about last week?', data, miles.context).text, /0.0 miles/);
  } finally { f.db.close(); }
});

test('profile reads exclude other users, future/incomplete journeys, deleted Memories and orphan music', () => {
  const f = fixture();
  try {
    f.journey('future', f.a, 20, 777);
    f.play('orphan', null as any, 15, 'Orphan Artist');
    const data = f.read();
    assert.equal(data.journeys.length, 3); assert.equal(data.memories.length, 1); assert.equal(data.music.length, 3);
    assert.doesNotMatch(JSON.stringify(data), /999|PRIVATE PROFILE|123 Private Road|secret note|Orphan Artist/);
    assert.equal(f.read(f.b).journeys.length, 1);
    assert.match(engine.answer('How many Memories did I create this month?', data, null).text, /1 Memory/);
    assert.match(engine.answer('How many songs did I listen to this month?', data, null).text, /3 recorded song plays/);
    f.store.softDeleteMemory(f.a, 'memory-a');
    assert.equal(f.read().memories.length, 0);
    f.db.prepare('DELETE FROM local_journeys WHERE id=?').run('a-last');
    assert.equal(f.read().music.length, 2);
  } finally { f.db.close(); }
});

test('profile lifecycle rotates native epochs and blocks Siri throughout transitions', () => {
  const f = fixture();
  try {
    const profile = () => f.db.prepare(queries.profile).get();
    const first = profile()!; assert.equal(first.id, f.a);
    f.store.setActiveLocalUserId(f.a); assert.equal(profile()!.epoch, first.epoch, 'unchanged cold bootstrap preserves background Siri details');
    f.store.setAskProfileBlocked(true); assert.equal(profile(), undefined);
    f.store.setActiveLocalUserId(f.a); assert.notEqual(profile()!.epoch, first.epoch, 'same-profile authentication transition invalidates tickets');
    f.store.setActiveLocalUserId(f.b); assert.equal(profile()!.id, f.b);
    f.store.setActiveLocalUserId(f.a); assert.notEqual(profile()!.epoch, first.epoch);
    f.store.setAskProfileBlocked(true); f.store.setAskProfileBlocked(false); assert.equal(profile()!.id, f.a);
    f.store.deleteLocalUserData(f.a); assert.equal(profile(), undefined);
  } finally { f.db.close(); }
});

test('unknown filters and compound questions ask for clarification instead of producing broad answers', () => {
  const f = fixture();
  try {
    for (const question of ['How many miles did I drive to Dallas this week?', 'How many miles did I drive excluding Monday?', 'How many miles and songs this week?', 'Tell me my home address', 'DROP TABLE local_users', 'Who is my favorite artist?', 'How many miles did I drive on 2026-02-30?', 'How many journeys tomorrow?', 'a'.repeat(501)]) {
      assert.equal(engine.answer(question, f.read(), null).status, 'clarify', question);
    }
    assert.equal(engine.answer('And how many journeys was that?', f.read(), null).status, 'clarify');
    const old = engine.answer('How many miles did I drive this week?', f.read(), null).context;
    old.expiresAt = now - 1;
    assert.equal(engine.answer('What about last week?', f.read(), old).status, 'clarify');
  } finally { f.db.close(); }
});

test('history access cannot silently truncate an explicitly requested range', () => {
  const f = fixture();
  try {
    assert.equal(engine.answer('How many miles did I drive all time?', f.read(), null).status, 'historyLimited');
    assert.equal(engine.answer('How many miles did I drive this month?', f.read(f.a, new Date(iso(10)).getTime()), null).status, 'historyLimited');
    assert.match(engine.answer('How many miles did I drive all time?', f.read(f.a, 0), null).text, /49.8 miles/);
    const empty = { ...f.read(), journeys: [], memories: [], music: [] };
    assert.match(engine.answer('When was my last journey?', empty, null).text, /No completed journeys/);
  } finally { f.db.close(); }
});

test('redaction omits private metadata, addresses, coordinates and sensitive place labels from music answers', () => {
  const f = fixture();
  try {
    for (const privateName of ['123 Private Road', '32.812345, -97.123456', 'https://private.example', 'secret@domain.com', 'My Secret Studio']) {
      const data = f.read(); data.music.forEach((m: any) => { m.artist = privateName; m.track = privateName; });
      data.sensitiveLabels = [{ label: 'Secret Studio' }];
      const a = engine.answer('What was my top artist this month?', data, null);
      assert.doesNotMatch(a.text, new RegExp(privateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(a.text, /private music title/);
    }
  } finally { f.db.close(); }
});

test('local calendar boundaries include the first instant and exclude the next day; ISO offsets are honored', () => {
  const f = fixture();
  try {
    const data = f.read(f.a, 0);
    const start = new Date(2026, 8, 15), end = new Date(2026, 8, 16);
    data.journeys = [start.getTime() - 1, start.getTime(), end.getTime() - 1, end.getTime()].map((ms, i) => ({ id: `${i}`, startedAt: new Date(ms).toISOString(), miles: 1 }));
    assert.match(engine.answer('How many journeys on 2026-09-15?', data, null).text, /2 journeys/);
    const week = engine.plan('How many miles did I drive this week?', data, null).range;
    assert.equal(new Date(week.start).getDay(), 1);
    assert.equal(new Date(week.start).getHours(), 0);
  } finally { f.db.close(); }
});

test('tie and large-library responses are deterministic and do not claim complete totals from a partial read', () => {
  const f = fixture();
  try {
    const data = f.read(); data.music = data.music.slice(0, 2); data.music[0].artist = 'A'; data.music[1].artist = 'B';
    assert.match(engine.answer('What is my top artist?', data, null).text, /A is tied.*1 other artists/);
    data.journeys = Array(20001).fill(data.journeys[0]);
    assert.equal(engine.answer('How many journeys this month?', data, null).status, 'unavailable');
  } finally { f.db.close(); }
});

test('invalid distances fail safely and absent metadata is not confused with absent listening', () => {
  const f = fixture();
  try {
    for (const invalid of [null, -1, Infinity, 'not a distance']) {
      const data = f.read(); data.journeys[0].miles = invalid;
      for (const question of ['How many miles did I drive this week?', 'When was my last journey?', 'What was my longest journey?']) {
        assert.equal(engine.answer(question, data, null).status, 'unavailable');
      }
    }
    const data = f.read(); data.music.forEach((m: any) => { m.artist = ''; });
    assert.match(engine.answer('What is my top artist?', data, null).text, /No recorded artist metadata/);
    assert.match(engine.answer('How many songs?', data, null).text, /3 recorded song plays/);
    assert.match(engine.answer('When was my first journey?', data, null).text, /Sep 5, 2026/);
    assert.match(engine.answer('What was my longest journey?', data, null).text, /30.0 miles/);
    assert.match(engine.answer('When was my last Memory?', data, null).text, /Sep 14, 2026/);
  } finally { f.db.close(); }
});

test('native source contracts require local authentication, read-only bounded queries and profile/lock rechecks', () => {
  // Source checks, not a substitute for compiling or exercising iOS App Intents.
  const service = readFileSync(resolve(root, 'modules/journeydeck-recorder/ios/JourneyDeckAskService.swift'), 'utf8');
  const intent = readFileSync(resolve(root, 'intents/AskJourneyDeckIntent.swift'), 'utf8');
  const pod = readFileSync(resolve(root, 'modules/journeydeck-recorder/ios/JourneyDeckRecorder.podspec'), 'utf8');
  assert.match(service, /SQLITE_OPEN_READONLY \| SQLITE_OPEN_FULLMUTEX/);
  assert.doesNotMatch(service, /SQLITE_OPEN_CREATE|URLSession|NSLog|print\(/);
  assert.match(service, /sqlite3_stmt_readonly/); assert.match(service, /sqlite3_bind_text/);
  assert.match(service, /result.count <= 20000/);
  assert.match(service, /protectedDataWillBecomeUnavailableNotification/);
  assert.match(service, /isProtectedDataAvailable/); assert.match(service, /generation == lockGeneration/);
  assert.match(service, /current.id == result.1 && current.epoch == result.2/);
  assert.match(service, /stored.expires > Date\(\)/);
  assert.match(service, /case \.verified/); assert.match(service, /45 \* 86400/);
  assert.equal((intent.match(/requiresLocalDeviceAuthentication/g) ?? []).length, 2);
  assert.match(intent, /^internal import JourneyDeckRecorder$/m);
  assert.match(intent, /ShowsSnippetIntent/); assert.match(intent, /AskJourneyDeckAnswerSnippet: SnippetIntent/);
  assert.ok(intent.includes('Summary("Ask JourneyDeck \\(\\.$question)")'));
  assert.match(intent, /dialog: "\\\(text\)"/);
  assert.match(intent, /journeydeck-v3:\/\/ask-journeydeck\?ticket=/);
  assert.doesNotMatch(intent, /\?question=|\?user/);
  assert.match(pod, /resource_bundles.*JourneyDeckAsk/);
  for (const name of ['journeys', 'memories', 'music']) {
    assert.match(queries[name], /user_id=\?/); assert.match(queries[name], /LIMIT 20001/);
    assert.doesNotMatch(queries[name], /\b(?:lat|lng|route|notes|name|email|apple_subject|title|place_id)\b/);
  }
});

test('V3 native intent metadata is added once to the app target and excluded from production configuration', () => {
  const plugin = require('../plugins/with-ask-journeydeck.js');
  const siriPlugin = require('../plugins/with-journeydeck-siri.js');
  const siriSource = readFileSync(resolve(root, 'siri/JourneyDeckSiriIntents.swift'), 'utf8');
  const mergedShortcuts = siriPlugin.addAskShortcutToSiriSource(siriSource);
  assert.equal(siriPlugin.addAskShortcutToSiriSource(mergedShortcuts), mergedShortcuts);
  assert.equal((`${mergedShortcuts}\n${readFileSync(resolve(root, 'intents/AskJourneyDeckIntent.swift'), 'utf8')}`.match(/AppShortcutsProvider/g) ?? []).length, 1);
  assert.match(mergedShortcuts, /@available\(iOS 26\.0, \*\)\nstruct JourneyDeckAppShortcuts/);
  assert.match(mergedShortcuts, /AppShortcut\(intent: AskJourneyDeckIntent\(\)/);
  const project = require('xcode').project(resolve(root, 'node_modules/react-native-view-shot/ios/RNViewShot.xcodeproj/project.pbxproj'));
  project.parseSync(); plugin.addIntentSource(project, 'JourneyDeckV3');
  const once = project.writeSync(); plugin.addIntentSource(project, 'JourneyDeckV3');
  assert.equal(project.writeSync(), once);
  assert.match(once, /AskJourneyDeckIntent.swift in Sources/);
  assert.match(once, /AppIntents.framework/);
  const configSource = readFileSync(resolve(root, 'app.config.js'), 'utf8');
  for (const variant of ['v3-preview', 'v3-store', 'v2-preview', 'production']) {
    const module = { exports: {} as any };
    vm.runInNewContext(configSource, { module, process: { env: { APP_VARIANT: variant } } });
    const config = module.exports({ config: { name: 'JourneyDeck', ios: { bundleIdentifier: 'com.journeydeck.recorder', infoPlist: {} } } });
    const v3Features = variant === 'v3-preview' || variant === 'v3-store';
    assert.equal(config.extra.features.askJourneyDeck, v3Features);
    assert.equal(config.extra.features.midnightCanopy, v3Features);
    assert.equal(config.plugins.includes('./plugins/with-ask-journeydeck'), v3Features);
    assert.equal(config.ios.bundleIdentifier, variant === 'v3-preview' ? 'com.journeydeck.recorder.v3' : variant === 'v2-preview' ? 'com.journeydeck.recorder.v2' : 'com.journeydeck.recorder');
  }
});
