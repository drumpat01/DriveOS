import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../src/use-update-restart.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function harness(initial: Partial<{ ready: boolean; recorderState: string; recorderBusy: boolean }> = {}) {
  let props = { ready: true, recorderState: 'ready', recorderBusy: false, ...initial };
  const state = {
    local: null as any, localThrows: false, native: { recording: false, paused: false, sessionId: null as string | null },
    nativeRead: null as null | (() => Promise<any>), reloadFails: false, reloads: 0, nativeReads: 0,
    update: { isUpdatePending: true, downloadedUpdate: { updateId: 'update-a' } },
  };
  const alerts: any[][] = [], listeners = new Set<(state: string) => void>();
  const appState = { currentState: 'active', addEventListener: (_name: string, fn: (state: string) => void) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
  const mocks: Record<string, any> = {
    'react-native': { Alert: { alert: (...args: any[]) => alerts.push(args) }, AppState: appState },
    'expo-updates': { isEnabled: true, useUpdates: () => state.update, reloadAsync: async () => { state.reloads++; if (state.reloadFails) throw Error('reload failure'); } },
    './storage': { activeSession: () => { if (state.localThrows) throw Error('database locked'); return state.local; } },
    '../modules/journeydeck-recorder': { getNativeAutomaticRecorderStatus: async () => { state.nativeReads++; return state.nativeRead ? state.nativeRead() : state.native; } },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  function Content() { module.exports.useUpdateRestart(props); return null; }
  let tree: any;
  return { state, alerts,
    mount: () => act(async () => { tree = create(React.createElement(Content)); }),
    render: (next = {}) => act(async () => { props = { ...props, ...next }; tree.update(React.createElement(Content)); }),
    foreground: (value: string) => act(async () => { appState.currentState = value; for (const listener of listeners) listener(value); }),
    press: (alert = alerts.find(item => item[0] === 'JourneyDeck update ready')) => act(async () => { alert[2][1].onPress(); }),
    close: () => act(async () => { tree?.unmount(); }),
  };
}

test('restart prompt waits for startup reconciliation, recorder idle and foreground', async () => {
  const h = harness({ ready: false });
  try {
    await h.mount(); assert.equal(h.alerts.length, 0);
    await h.render({ ready: true, recorderState: 'paused' }); assert.equal(h.alerts.length, 0);
    await h.render({ recorderState: 'finishing' }); assert.equal(h.alerts.length, 0);
    await h.render({ recorderState: 'ready', recorderBusy: true }); assert.equal(h.alerts.length, 0);
    await h.foreground('background');
    await h.render({ recorderBusy: false }); assert.equal(h.alerts.length, 0);
    await h.foreground('active'); assert.equal(h.alerts.length, 1);
    await h.press(); assert.equal(h.state.reloads, 1);
  } finally { await h.close(); }
});

test('fresh local and native recorder status override a stale ready dashboard', async () => {
  for (const owner of ['local', 'native-recording', 'native-paused']) {
    const h = harness();
    if (owner === 'local') h.state.local = { status: 'recording' };
    else h.state.native = { recording: owner === 'native-recording', paused: owner === 'native-paused', sessionId: 'watch-journey' };
    try { await h.mount(); assert.equal(h.alerts.length, 0, owner); } finally { await h.close(); }
  }
});

test('a Watch journey starting after the alert blocks the old Restart button', async () => {
  const h = harness();
  try {
    await h.mount(); assert.equal(h.alerts.length, 1);
    h.state.native = { recording: true, paused: false, sessionId: 'from-watch' };
    await h.press(); assert.equal(h.state.reloads, 0); assert.equal(h.alerts.at(-1)?.[0], 'Update can wait');
  } finally { await h.close(); }
});

test('readiness is rechecked after an in-flight native status read', async () => {
  const h = harness(); let finish: any;
  try {
    await h.mount();
    h.state.nativeRead = () => new Promise(resolve => { finish = resolve; });
    await h.press();
    h.state.local = { status: 'recording' };
    await act(async () => finish({ recording: false, paused: false, sessionId: null }));
    assert.equal(h.state.reloads, 0);
  } finally { await h.close(); }
});

test('status failures defer the update and never escape as startup failures', async () => {
  const h = harness();
  try {
    h.state.nativeRead = async () => { throw Error('native unavailable'); };
    await h.mount(); assert.equal(h.alerts.length, 0);
    h.state.nativeRead = null; h.state.localThrows = true;
    await h.foreground('active'); assert.equal(h.alerts.length, 0);
    h.state.localThrows = false;
    await h.foreground('active'); assert.equal(h.alerts.length, 1);
  } finally { await h.close(); }
});

test('a native database read failure returned as status cannot be mistaken for an idle recorder', async () => {
  const h = harness();
  h.state.nativeRead = async () => ({ nativeModuleAvailable: true, statusReliable: false, recording: false, paused: false, sessionId: null });
  try { await h.mount(); assert.equal(h.alerts.length, 0); } finally { await h.close(); }
});

test('an old update alert cannot restart a newer update, and Later is not repeatedly prompted', async () => {
  const h = harness();
  try {
    await h.mount(); const old = h.alerts[0];
    await h.foreground('active'); assert.equal(h.alerts.length, 1);
    h.state.update = { isUpdatePending: true, downloadedUpdate: { updateId: 'update-b' } };
    await h.render();
    await h.press(old); assert.equal(h.state.reloads, 0);
  } finally { await h.close(); }
});

test('duplicate Restart taps serialize and a failed reload can be retried', async () => {
  const h = harness(); let finish: any;
  try {
    await h.mount();
    h.state.nativeRead = () => new Promise(resolve => { finish = resolve; });
    const reads = h.state.nativeReads;
    await h.press(); await h.press(); assert.equal(h.state.nativeReads, reads + 1);
    h.state.reloadFails = true;
    await act(async () => finish({ recording: false, paused: false, sessionId: null }));
    assert.equal(h.state.reloads, 1); assert.equal(h.alerts.at(-1)?.[0], 'Update will wait');
    h.state.nativeRead = null; h.state.reloadFails = false;
    await h.foreground('active'); await h.press(); assert.equal(h.state.reloads, 2);
  } finally { await h.close(); }
});

test('an unmounted shell cannot reload from an old alert or delayed status response', async () => {
  const h = harness();
  await h.mount(); await h.close(); await h.press(); assert.equal(h.state.reloads, 0);
});
