import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
import sharp from 'sharp';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(path: string, imports: Record<string, any> = {}) {
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, require: (id: string) => {
    if (id in imports) return imports[id];
    if (id.startsWith('../assets/')) {
      const url = new URL(id, new URL('../src/medallion-artwork.ts', import.meta.url));
      assert.ok(existsSync(url), `bundled asset exists: ${id}`);
      return id.endsWith('.json') ? JSON.parse(readFileSync(url, 'utf8')) : url;
    }
    throw new Error(`Unexpected import ${id}`);
  } });
  return module.exports;
}
const model = load('../src/fifty-states-model.ts');
const all = model.US_STATES.map(([code]: [string]) => code);
const date = '2026-09-18T12:00:00.000Z';

test('only fifty distinct valid states unlock; reset and recompletion retain the first date', () => {
  const incomplete = model.updateFiftyStatesProgress(null, [...all.slice(0, 49), 'AL', 'XX'], date);
  assert.equal(incomplete.completedAt, null);
  const complete = model.updateFiftyStatesProgress(incomplete, all, date);
  assert.equal(complete.completedAt, date);
  const reset = model.updateFiftyStatesProgress(complete, [], '2026-09-19T12:00:00Z');
  assert.equal(reset.seen.length, 0);
  assert.equal(reset.completedAt, date);
  assert.equal(model.updateFiftyStatesProgress(reset, all, '2026-09-20T12:00:00Z').completedAt, date);
});

test('existing completed checklists recover their saved date without writes or invented dates', () => {
  assert.equal(model.normalizeFiftyStatesProgress({ seen: all, updatedAt: date }).completedAt, date);
  assert.equal(model.normalizeFiftyStatesProgress({ seen: all.slice(1), updatedAt: date }).completedAt, null);
  assert.equal(model.normalizeFiftyStatesProgress({ seen: all, updatedAt: 'bad', completedAt: 'bad' }).completedAt, null);
});

test('award persists across reloads, notifies mounted consumers, isolates profiles, and stays dormant in V2', async () => {
  const preferences = new Map<string, unknown>();
  let reads = 0;
  let rejectWrite = false;
  const imports = {
    react: React,
    './auth': { getCurrentUser: () => ({ id: 'alice' }) },
    './fifty-states-model': model,
    './local-store': {
      getPrivatePreference: (user: string, key: string) => { reads++; return preferences.get(`${user}:${key}`); },
      upsertPrivatePreference: (user: string, key: string, value: unknown) => {
        if (rejectWrite) throw new Error('disk unavailable');
        preferences.set(`${user}:${key}`, JSON.parse(JSON.stringify(value)));
      },
    },
  };
  const store = load('../src/fifty-states-store.ts', imports);
  const renders: any[] = [];
  function Consumer({ user, enabled = true }: { user: string; enabled?: boolean }) {
    const progress = store.useFiftyStates(user, enabled);
    renders.push(progress);
    return React.createElement('progress', progress);
  }
  let tree: any;
  await act(() => { tree = create(React.createElement(Consumer, { user: 'alice', enabled: false })); });
  assert.equal(reads, 0);
  await act(() => tree.update(React.createElement(Consumer, { user: 'alice' })));
  await act(() => store.saveFiftyStates('alice', all.slice(1)));
  assert.equal(renders.at(-1).completedAt, null);
  rejectWrite = true;
  assert.throws(() => store.saveFiftyStates('alice', all), /disk unavailable/);
  assert.equal(renders.at(-1).completedAt, null);
  rejectWrite = false;
  await act(() => store.saveFiftyStates('alice', all));
  const earnedAt = renders.at(-1).completedAt;
  assert.ok(earnedAt);
  const reloaded = load('../src/fifty-states-store.ts', imports);
  assert.equal(reloaded.loadFiftyStatesProgress('alice').completedAt, earnedAt);
  const start = renders.length;
  await act(() => tree.update(React.createElement(Consumer, { user: 'bob' })));
  for (const render of renders.slice(start)) {
    assert.equal(render.completedAt, null, 'no previous-profile award flashes during the switch');
    assert.equal(render.seen.length, 0);
  }
  await act(() => store.saveFiftyStates('alice', []));
  assert.equal(renders.at(-1).completedAt, null);
  assert.equal(store.loadFiftyStatesProgress('alice').completedAt, earnedAt);
  await act(() => tree.unmount());
});

test('all five generated faces use detected circular frames and lossless authored pixels', async () => {
  const artwork = load('../src/medallion-artwork.ts');
  assert.equal(artwork.isApprovedMedallion('all-fifty'), true);
  for (const [theme, url] of Object.entries(artwork.medallionArtwork['all-fifty'])) {
    const frame = artwork.getMedallionFrame('all-fifty', theme);
    assert.ok(frame.x > 0 && frame.x < 0.08);
    assert.ok(frame.y > 0 && frame.y < 0.08);
    assert.ok(frame.width > 0.85 && frame.width < 1);
    assert.ok(frame.height > 0.85 && frame.height < 1);
    const metadata = await sharp(readFileSync(url as URL)).metadata();
    assert.ok(metadata.width! >= 1040);
    assert.equal(metadata.height, metadata.width);
    const original = await sharp(readFileSync(new URL(`../assets/medallions-v3/all-fifty-${theme}.png`, import.meta.url))).ensureAlpha().raw().toBuffer();
    const decoded = await sharp(readFileSync(url as URL)).ensureAlpha().raw().toBuffer();
    assert.equal(decoded.length, original.length);
    for (let i = 0; i < original.length; i += 4) {
      assert.equal(decoded[i + 3], original[i + 3]);
      if (original[i + 3] !== 0) {
        assert.equal(decoded[i], original[i]);
        assert.equal(decoded[i + 1], original[i + 1]);
        assert.equal(decoded[i + 2], original[i + 2]);
      }
    }
  }
});
