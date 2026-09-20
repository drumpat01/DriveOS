import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Map<string, (event: any) => void>();
let params: any = {}, focused = true, index = 1;
const pushes: any[] = [];
const navigation = {
  getState: () => ({ index }),
  addListener: (event: string, callback: (event: any) => void) => {
    listeners.set(event, callback);
    return () => listeners.delete(event);
  },
};
const module = { exports: {} as any };
const code = ts.transpileModule(readFileSync(new URL('../src/journey-card-action.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id === 'expo-router' ? {
  router: { push: (href: any) => pushes.push(href) }, useNavigation: () => navigation,
  useLocalSearchParams: () => params, useIsFocused: () => focused,
} : require(id) });
const { openJourneyCardAction, useJourneyCardAction } = module.exports;

test('Journey menu navigation uses exact IDs and a fresh request for repeated actions', () => {
  openJourneyCardAction('one', 'edit'); openJourneyCardAction('one', 'edit'); openJourneyCardAction('two', 'share');
  assert.deepEqual(pushes.map(p => [p.pathname, p.params.id, p.params.cardAction]), [
    ['/journey/[id]', 'one', 'edit'], ['/journey/[id]', 'one', 'edit'], ['/journey/[id]', 'two', 'share'],
  ]);
  assert.equal(new Set(pushes.map(p => p.params.cardActionRequest)).size, 3);
});

test('action waits for local readiness AND native transition, then never reopens on refresh/back', async () => {
  let tree: any, edits = 0, shares = 0;
  params = { cardAction: 'edit', cardActionRequest: 'request-one' };
  focused = true; index = 1;
  function Probe({ ready }: { ready: boolean }) {
    useJourneyCardAction(ready, () => edits++, () => shares++); return null;
  }
  await act(() => { tree = create(React.createElement(Probe, { ready: false })); });
  await act(() => listeners.get('transitionEnd')!({ data: { closing: false } }));
  assert.equal(edits, 0, 'missing or gated data cannot open the editor');
  await act(() => tree.update(React.createElement(Probe, { ready: true })));
  assert.equal(edits, 1);
  await act(() => tree.update(React.createElement(Probe, { ready: false })));
  await act(() => tree.update(React.createElement(Probe, { ready: true })));
  await act(() => listeners.get('transitionStart')!({ data: { closing: true } }));
  await act(() => listeners.get('transitionEnd')!({ data: { closing: false } }));
  assert.equal(edits, 1, 'refresh or returning must not reopen a dismissed editor');
  params = { cardAction: 'share', cardActionRequest: 'request-two' };
  await act(() => listeners.get('transitionStart')!({ data: { closing: false } }));
  await act(() => tree.update(React.createElement(Probe, { ready: true })));
  assert.equal(shares, 0, 'fast local reads still wait for native presentation');
  focused = false;
  await act(() => listeners.get('transitionEnd')!({ data: { closing: false } }));
  assert.equal(shares, 0, 'a background route cannot present a share card');
  focused = true;
  await act(() => tree.update(React.createElement(Probe, { ready: true })));
  assert.equal(shares, 1);
  params = { cardAction: 'delete', cardActionRequest: 'unknown' };
  await act(() => tree.update(React.createElement(Probe, { ready: true })));
  assert.equal(edits + shares, 2, 'unknown route actions are ignored');
  await act(() => tree.unmount());
  assert.equal(listeners.size, 0);
});

test('initial route with no push transition can consume an action once ready', async () => {
  let tree: any, shares = 0;
  params = { cardAction: 'share', cardActionRequest: 'initial' }; index = 0;
  function Probe() { useJourneyCardAction(true, () => {}, () => shares++); return null; }
  await act(() => { tree = create(React.createElement(Probe)); });
  assert.equal(shares, 1);
  await act(() => tree.unmount());
  index = 1;
});
