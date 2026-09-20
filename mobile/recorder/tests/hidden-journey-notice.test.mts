import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
function load(path: string, stubs: Record<string, any>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => stubs[id] ?? require(id) });
  return module.exports;
}

test('visibility choices persist per profile and recording identity across module reloads', () => {
  const rows = new Map<string, unknown>();
  const stubs = { './local-store': {
    getPrivatePreference: (user: string, key: string) => rows.get(`${user}:${key}`) ?? null,
    upsertPrivatePreference: (user: string, key: string, value: unknown) => {
      assert.ok(key.length <= 64);
      rows.set(`${user}:${key}`, structuredClone(value));
    },
  } };
  const id = 'local_native_recording_manual_12345678-1234-1234-1234-123456789abc';
  let api = load('../src/journey-visibility-preference.ts', stubs);
  api.saveJourneyVisibilityChoice('owner-a', id, 'show');
  api = load('../src/journey-visibility-preference.ts', stubs);
  assert.equal(api.journeyVisibilityChoice('owner-a', id), 'show');
  assert.equal(api.journeyVisibilityChoice('owner-b', id), null);
  assert.equal(api.journeyVisibilityChoice('owner-a', id.replace('manual_', '')), null);
  api.saveJourneyVisibilityChoice('owner-b', id, 'hide');
  assert.equal(api.journeyVisibilityChoice('owner-a', id), 'show');
  assert.equal(api.journeyVisibilityChoice('owner-b', id), 'hide');
});

async function mount(initialReady = true) {
  const listeners = new Set<() => void>();
  const state = { userId: 'owner-a', ready: initialReady, choice: '', fail: false };
  const pending = { userId: 'owner-a', journeyId: 'journey-a', anchor: 'Home' };
  const api = load('../src/hidden-journey-notice.tsx', {
    './app-data': {
      pendingHiddenJourneyChoice: () => state.ready && !state.choice && state.userId === pending.userId ? pending : null,
      decideHiddenJourney: (target: any, choice: string) => {
        assert.equal(target.journeyId, pending.journeyId);
        if (state.fail) throw new Error('disk full');
        state.choice = choice;
        listeners.forEach(listener => listener());
      },
    },
    './app-theme': { useThemedStyles: (styles: any) => styles },
    './auth': { getCurrentUser: () => ({ id: state.userId }) },
    './local-archive-events': { subscribeLocalArchiveChanges: (listener: () => void) => {
      listeners.add(listener); return () => listeners.delete(listener);
    } },
    'react-native': {
      AppState: { addEventListener: () => ({ remove() {} }) },
      StyleSheet: { create: (styles: any) => styles },
      View: host('View'), Text: host('Text'), Pressable: host('Pressable'),
    },
  });
  let tree: any;
  const render = (enabled = true) => React.createElement(api.HiddenJourneyNotice, { enabled, notice: 'Journey saved.' });
  await act(() => { tree = create(render()); });
  return {
    tree, state,
    buttons: () => tree.root.findAllByType('Pressable'),
    update: async (enabled = true) => act(() => tree.update(render(enabled))),
    notify: async () => act(() => listeners.forEach(listener => listener())),
    text: () => JSON.stringify(tree.toJSON()),
    close: async () => act(() => tree.unmount()),
  };
}

test('a delayed archive mirror reveals an inline choice and Show dismisses it with confirmation', async () => {
  const h = await mount(false);
  try {
    assert.equal(h.buttons().length, 0);
    h.state.ready = true;
    await h.notify();
    assert.match(h.text(), /hidden from Memories/);
    assert.equal(h.buttons().length, 2);
    await act(() => h.buttons()[0].props.onPress());
    assert.equal(h.state.choice, 'show');
    assert.equal(h.buttons().length, 0);
    assert.match(h.text(), /Journey added to Memories/);
    await h.notify();
    assert.equal(h.buttons().length, 0);
  } finally { await h.close(); }
});

test('Keep hidden remembers the choice and a write failure keeps both choices available', async () => {
  const h = await mount();
  try {
    h.state.fail = true;
    await act(() => h.buttons()[1].props.onPress());
    assert.equal(h.state.choice, '');
    assert.equal(h.buttons().length, 2);
    assert.match(h.text(), /could not be saved/);
    h.state.fail = false;
    await act(() => h.buttons()[1].props.onPress());
    assert.equal(h.state.choice, 'hide');
    assert.match(h.text(), /recording is still saved/);
    assert.equal(h.buttons().length, 0);
  } finally { await h.close(); }
});

test('recording suppresses the prompt and a stale choice cannot write into another profile', async () => {
  const h = await mount();
  try {
    const stalePress = h.buttons()[0].props.onPress;
    await h.update(false);
    assert.equal(h.buttons().length, 0);
    await h.update(true);
    assert.equal(h.buttons().length, 2);
    h.state.userId = 'owner-b';
    await act(() => stalePress());
    assert.equal(h.state.choice, '');
    await h.update();
    assert.equal(h.buttons().length, 0);
    assert.doesNotMatch(h.text(), /started and ended at/);
  } finally { await h.close(); }
});
