import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { testTheme } from './theme-fixture.mts';
const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);

async function screen(available = true) {
  let listener: any, cancellations = 0, runs = 0, resolve: any;
  const pending = new Promise<any>(r => resolve = r);
  const native = { currentState: 'active', addEventListener: (_: string, fn: any) => { listener = fn; return { remove() {} }; } };
  const mocks: any = {
    'react-native': { AppState: native, ...Object.fromEntries(['ScrollView', 'Text', 'View'].map(n => [n, host(n)])) },
    '@expo/ui': Object.fromEntries(['Button', 'Column', 'Host'].map(n => [n, host(n)])),
    'expo-router': { useFocusEffect: (cb: any) => React.useEffect(cb, [cb]) },
    './app-theme': { useAppTheme: () => testTheme('grand-touring') },
    './siri-testing': { canShowSiriTesting: true, siriTesting: {
      status: async () => ({ model: available ? 'available' : 'newNativeBuildRequired', testing: available }),
      cases: async () => Array.from({ length: 100 }, (_, i) => ({ id: String(i), question: 'Synthetic ' + i })),
      run: async () => { runs++; return pending; }, cancel: async () => { cancellations++; },
    } },
  };
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/siri-testing-screen.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { exports, require: (id: string) => id in mocks ? mocks[id] : require(id) });
  let tree: any; await act(async () => { tree = create(React.createElement(exports.SiriTestingScreen)); });
  const button = (id: string) => tree.root.findAllByType('Button').find((b: any) => b.props.testID === id);
  return { tree, button, runs: () => runs, cancellations: () => cancellations,
    click: async (id: string) => { await act(() => button(id).props.onPress()); },
    finish: async (result = { status: 'passed', detail: 'Late result', question: 'Sample', elapsedMs: 25 } as any) => { await act(async () => resolve(result)); },
    background: async () => { await act(() => { native.currentState = 'background'; listener('background'); }); },
    text: () => tree.root.findAllByType('Text').map((t: any) => t.children.join('')).join('|'),
    close: async () => { await act(() => tree.unmount()); },
  };
}
test('old native builds show an explanation and cannot start the suite', async () => {
  const s = await screen(false);
  try { assert.equal(s.button('siri-full').props.disabled, true); assert.match(s.text(), /new signed V3 build/); assert.equal(s.runs(), 0); }
  finally { await s.close(); }
});
test('stopping cancels inference, ignores late results, and prevents the next case', async () => {
  const s = await screen();
  try {
    await s.click('siri-full'); assert.equal(s.runs(), 1);
    await s.click('siri-full'); assert.equal(s.runs(), 1);
    await s.click('siri-cancel'); await s.finish();
    assert.equal(s.runs(), 1); assert.equal(s.cancellations(), 1); assert.doesNotMatch(s.text(), /Late result/);
  } finally { await s.close(); }
});
test('backgrounding clears transient results and prevents late updates', async () => {
  const s = await screen();
  try { await s.click('siri-smoke'); await s.background(); await s.finish(); assert.equal(s.runs(), 1); assert.doesNotMatch(s.text(), /Late result/); }
  finally { await s.close(); }
});

test('failed synthetic queries show generated and expected plans and clear on background', async () => {
  const s = await screen();
  try {
    await s.click('siri-smoke');
    await s.finish({ status: 'failed', detail: 'invalid plan: metric is not supported for domain music',
      question: 'Synthetic music count', proposedPlan: { domain: 'music', metric: 'songPlays' },
      expectedPlan: { domain: 'music', metric: 'count' }, elapsedMs: 4100 });
    assert.equal(s.runs(), 13);
    assert.match(s.text(), /Generated query: .*songPlays/);
    assert.match(s.text(), /Expected query: .*count/);
    await s.background();
    assert.doesNotMatch(s.text(), /songPlays|Synthetic music count/);
  } finally { await s.close(); }
});
