import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app-data.ts', import.meta.url), 'utf8');
function evaluate(code: string, globals: Record<string, unknown>) {
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...globals });
  return exports;
}
test('a saved trim beats a larger cached original; retired split parts cannot reappear from cache', async () => {
  let local: any = { id: 'edited', startedAt: 'new-start', songCount: 0, soundtrack: [], route: { coordinates: [[0, 0], [1, 1]] } };
  const client = evaluate(`const client = {${source.slice(source.indexOf('  async journey(id:'), source.indexOf('  async vehicleIntelligence('))}}; exports.client = client;`, {
    loadSavedPlaces() {}, getCurrentUser: () => ({ id: 'owner' }), localAtlasClient: { journey: () => local },
    isEditorManagedJourney: () => true, applyLocalPlaceAliases: (value: unknown) => value,
    readAppCache: () => { throw new Error('Managed routes must not read stale cache'); },
  }).client;
  assert.equal((await client.journey('edited')).route.coordinates.length, 2);
  assert.equal(client.localOrCachedJourney('edited').songCount, 0);
  local = null;
  await assert.rejects(client.journey('retired'), /restored or replaced/);
  assert.equal(client.localOrCachedJourney('retired'), null);
});
test('journey lists preserve trimmed endpoint blanks and omit retired cached parts', () => {
  const block = source.slice(source.indexOf('function mergeLocalJourneyPage('), source.indexOf('export type ConnectionCapabilities'));
  const merge = evaluate(block + '\nexports.merge = mergeLocalJourneyPage;', {
    getCurrentUser: () => ({ id: 'owner' }), isEditorManagedJourney: (_owner: string, id: string) => ['edited', 'retired'].includes(id),
  }).merge;
  const local = { items: [{ id: 'edited', startedAt: '2026-06-01', startingLocation: null, endingLocation: null, soundtrackPreview: [] }], nextCursor: null };
  const cached = { items: [{ id: 'edited', startedAt: '2026-06-01', startingLocation: 'Old start', soundtrackPreview: ['old song'] }, { id: 'retired', startedAt: '2026-06-01' }, { id: 'untouched', startedAt: '2026-05-01' }], nextCursor: null };
  const result = merge(local, cached, 25);
  assert.equal(result.items.length, 2); assert.equal(result.items[0].startingLocation, null);
  assert.equal(result.items[0].soundtrackPreview.length, 0); assert.equal(result.items[1].id, 'untouched');
});
test('photo persistence rechecks profile and Memory after asynchronous file writes and cleans abandoned files', async () => {
  const block = source.slice(source.indexOf('async function savePrivateMemoryPhoto('), source.indexOf('function removeCachedPhoto('));
  for (const scenario of ['profile', 'deleted', 'success']) {
    let owner = 'owner', deleted = false, inserts = 0, cleaned = 0, caches = 0;
    const save = evaluate(block + '\nexports.save = savePrivateMemoryPhoto;', {
      getCurrentUser: () => ({ id: owner }), getMemoryIncludingDeleted: () => ({ id: 'memory', deletedAt: deleted ? 'now' : null }),
      Crypto: { randomUUID: () => 'photo' },
      FileSystem: { documentDirectory: 'private/', EncodingType: { Base64: 'base64' }, makeDirectoryAsync: async () => {},
        writeAsStringAsync: async () => { if (scenario === 'profile') owner = 'other'; if (scenario === 'deleted') deleted = true; },
        deleteAsync: async () => { cleaned++; } },
      upsertPhoto: () => { inserts++; }, readAppCache: () => null, MEMORIES_CACHE_KEY: 'cache', writeAppCache: () => { caches++; },
    }).save;
    const pending = save('memory', { fileName: 'matched.jpg', contentType: 'image/jpeg', dataBase64: 'aGVsbG8=' });
    if (scenario === 'success') { await pending; assert.equal(inserts, 1); assert.equal(caches, 1); assert.equal(cleaned, 0); }
    else { await assert.rejects(pending, /profile or Memory changed/); assert.equal(inserts, 0); assert.equal(caches, 0); assert.equal(cleaned, 1); }
  }
});

test('native config isolates the new runtime and preserves manual Shazam permission without recap recording/background audio', async () => {
  const { createRequire } = await import('node:module'); const require = createRequire(import.meta.url);
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const prior = process.env.APP_VARIANT; delete process.env.APP_VARIANT;
  try {
    const config = require('../app.config.js')({ config: app });
    assert.equal(config.runtimeVersion, '2.0.0-watch.7');
    assert.equal(config.ios.deploymentTarget, '17.0');
    assert.equal(config.ios.config.usesNonExemptEncryption, false);
    assert.match(config.ios.infoPlist.NSPhotoLibraryUsageDescription, /dates and locations/);
    assert.equal(config.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-image-picker')[1].photosPermission, config.ios.infoPlist.NSPhotoLibraryUsageDescription);
    const audio = config.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-audio')[1];
    assert.equal(audio.microphonePermission, app.ios.infoPlist.NSMicrophoneUsageDescription);
    assert.equal(audio.enableBackgroundPlayback, false); assert.equal(audio.enableBackgroundRecording, false); assert.equal(audio.recordAudioAndroid, false);
  } finally { if (prior == null) delete process.env.APP_VARIANT; else process.env.APP_VARIANT = prior; }
});
