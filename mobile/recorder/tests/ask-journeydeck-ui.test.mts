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
function load(name: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : require(id) });
  return module.exports;
}
function deferred() {
  let resolve!: (value: any) => void, reject!: (error: Error) => void;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const ticket = 'b78cba9f-e125-4fb9-a76b-e1cd44583c75';
const result = (text = '19.8 miles across 2 journeys') => ({ status: 'answered', text, ticket, contextToken: ticket, profileId: 'a', evidence: [{ kind: 'journey', id: 'journey-a', label: 'Journey on Sep 15, 2026' }] });
async function screen(options: { available?: boolean; enabled?: boolean; ticket?: string } = {}) {
  let userID = 'a', blur: (() => void) | undefined, listener: (state: string) => void = () => {};
  let ask: (...args: any[]) => Promise<any> = async () => result();
  let resolve: (...args: any[]) => Promise<any> = async () => result();
  const calls: any[][] = [], resolutions: any[][] = [], pushes: any[] = [];
  const appState = { currentState: 'active', addEventListener: (_: string, callback: typeof listener) => { listener = callback; return { remove() {} }; } };
  const native = { AppState: appState, Keyboard: { dismiss() {} }, ...Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, host(name)])) };
  const component = load('ask-journeydeck-screen.tsx', {
    'react-native': native,
    '@expo/ui': { ...Object.fromEntries(['Button', 'Column', 'Host', 'TextInput'].map(name => [name, host(name)])), useNativeState: (value: any) => React.useRef({ value }).current },
    'expo-router': {
      Stack: { Screen: host('route-options') },
      router: { push: (path: any) => pushes.push(path), canGoBack: () => true, back: () => pushes.push('back'), replace: (path: any) => pushes.push(path) },
      useLocalSearchParams: () => ({ ticket: options.ticket }),
      useFocusEffect: (callback: () => () => void) => React.useEffect(() => { blur = callback(); return blur; }, [callback]),
    },
    './app-theme': { useAppTheme: () => testTheme('grand-touring') },
    './siri-testing': { canShowSiriTesting: false },
    './auth': { getCurrentUser: () => ({ id: userID }) },
    './release-features': { V3_ASK_JOURNEYDECK_ENABLED: options.enabled !== false },
    './ask-journeydeck': {
      ASK_EXAMPLES: ['How many miles did I drive this week?'],
      isAskJourneyDeckAvailable: options.available !== false,
      askJourneyDeck: (...args: any[]) => { calls.push(args); return ask(...args); },
      resolveJourneyDeckAnswer: (...args: any[]) => { resolutions.push(args); return resolve(...args); },
    },
  }).AskJourneyDeckScreen;
  let tree: any;
  await act(() => { tree = create(React.createElement(component)); });
  return {
    tree, calls, resolutions, pushes,
    text: () => tree.root.findAllByType('Text').map((node: any) => node.children.join('')).join('|'),
    input: () => tree.root.findByType('TextInput'),
    button: () => tree.root.findByType('Button'),
    ask: (fn: typeof ask) => { ask = fn; }, resolve: (fn: typeof resolve) => { resolve = fn; },
    submit: async (question: string) => { await act(() => { tree.root.findByType('TextInput').props.value.value = question; tree.root.findByType('Button').props.onPress(); }); },
    state: async (state: string) => { await act(() => { appState.currentState = state; listener(state); }); },
    profile: async (id: string) => { await act(() => { userID = id; tree.update(React.createElement(component)); }); },
    blur: async () => { await act(() => blur?.()); },
    close: async () => { await act(() => tree.unmount()); },
  };
}

test('Home widget exposes an accessible question entry and respects layout-editing disablement', async () => {
  let opened = 0, tree: any;
  const Widget = load('ask-journeydeck-widget.tsx', {
    'react-native': Object.fromEntries(['Pressable', 'Text', 'View'].map(name => [name, host(name)])),
    'expo-symbols': { SymbolView: host('Symbol') }, './app-theme': { useAppTheme: () => testTheme('dark') },
  }).AskJourneyDeckWidget;
  try {
    await act(() => { tree = create(React.createElement(Widget, { onPress: () => opened++ })); });
    const button = tree.root.findByType('Pressable');
    assert.equal(button.props.accessibilityLabel, 'Ask JourneyDeck');
    await act(() => button.props.onPress()); assert.equal(opened, 1);
    await act(() => tree.update(React.createElement(Widget, { onPress: () => opened++, disabled: true })));
    assert.equal(tree.root.findByType('Pressable').props.disabled, true);
  } finally { await act(() => tree?.unmount()); }
});

test('question sheet validates empty input, submits free text, suppresses duplicates and carries follow-up context', async () => {
  const s = await screen();
  try {
    await s.submit('  '); assert.equal(s.calls.length, 0); assert.match(s.text(), /Enter a question/);
    const pending = deferred(); s.ask(() => pending.promise);
    await s.submit(' How many miles did I drive this week? ');
    await s.submit('duplicate');
    assert.equal(s.calls.length, 1); assert.equal(s.calls[0][1], 'How many miles did I drive this week?');
    assert.equal(s.button().props.disabled, true);
    await act(() => pending.resolve(result()));
    assert.match(s.text(), /19.8 miles/); assert.equal(s.button().props.disabled, false);
    s.ask(async () => result('2 journeys this week'));
    await s.submit('And how many journeys was that?');
    assert.equal(s.calls[1][2], ticket); assert.match(s.text(), /2 journeys this week/);
  } finally { await s.close(); }
});

test('failed requests recover; a new request cannot inherit context from a failed answer', async () => {
  const s = await screen();
  try {
    await s.submit('How many miles?');
    s.ask(async () => { throw Error('native read failed'); });
    await s.submit('follow-up');
    assert.match(s.text(), /could not be answered/); assert.doesNotMatch(s.text(), /19.8 miles/);
    assert.equal(s.button().props.disabled, false);
    s.ask(async () => result()); await s.submit('How many miles?');
    assert.equal(s.calls[2][2], undefined);
  } finally { await s.close(); }
});

test('profile switches, backgrounding and dismissal discard answers and pending responses', async () => {
  for (const boundary of ['profile', 'background', 'blur']) {
    const s = await screen();
    try {
      await s.submit('How many miles?');
      const pending = deferred(); s.ask(() => pending.promise); await s.submit('When was my last journey?');
      if (boundary === 'profile') await s.profile('b');
      else if (boundary === 'background') await s.state('background');
      else await s.blur();
      assert.doesNotMatch(s.text(), /19.8 miles/); assert.equal(s.input().props.value.value, '');
      await act(() => pending.resolve(result('STALE PRIVATE ANSWER')));
      assert.doesNotMatch(s.text(), /STALE PRIVATE ANSWER/);
      if (boundary === 'background') await s.state('active');
      s.ask(async () => result()); await s.submit('How many miles?');
      assert.equal(s.calls.at(-1)[2], undefined);
    } finally { await s.close(); }
  }
});

test('supporting records are revalidated before navigation and deleted records cannot be opened', async () => {
  const s = await screen({ ticket });
  try {
    assert.deepEqual(s.resolutions[0], ['a', ticket]); assert.match(s.text(), /19.8 miles/);
    const evidence = () => s.tree.root.findAllByType('Pressable').find((node: any) => node.props.accessibilityLabel?.startsWith('Open Journey on'));
    s.resolve(async () => ({ ...result(), evidence: [] }));
    await act(() => evidence().props.onPress());
    assert.equal(s.pushes.length, 0); assert.match(s.text(), /no longer in this answer/);
    await s.submit('When was my last journey?'); s.resolve(async () => result());
    await act(() => evidence().props.onPress());
    assert.equal(s.pushes[0].pathname, '/journey/[id]'); assert.equal(s.pushes[0].params.id, 'journey-a');
  } finally { await s.close(); }
});

test('old installed runtimes and non-V3 routes fail closed; Done dismisses the prompt', async () => {
  const old = await screen({ available: false });
  try {
    assert.equal(old.button().props.disabled, true); assert.match(old.text(), /needs the new V3 native preview/);
    const done = old.tree.root.findByType('route-options').props.options.headerRight();
    await act(() => done.props.onPress()); assert.deepEqual(old.pushes, ['back']);
  } finally { await old.close(); }
  const production = await screen({ enabled: false, ticket });
  try {
    assert.equal(production.tree.root.findAllByType('TextInput').length, 0);
    assert.equal(production.resolutions.length, 0);
  } finally { await production.close(); }
});

test('JS-to-native bridge rejects profile changes and invalid links without querying another profile', async () => {
  let current = 'a', asked = 0, resolved = 0;
  const pending = deferred();
  const bridge = load('ask-journeydeck.ts', {
    expo: { requireOptionalNativeModule: () => ({ askJourneyDeckAsync: () => { asked++; return pending.promise; }, resolveJourneyDeckAnswerAsync: async () => { resolved++; return result(); } }) },
    'expo-crypto': { randomUUID: () => ticket },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    './ask-journeydeck-archive': { currentAskProfile: () => ({ id: current, epoch: 'epoch' }), readAskSnapshot: () => { throw new Error('Native fallback test'); } },
    './ask-journeydeck-local': { createLocalAskRuntime: () => ({ ask: async () => null, resolve: async () => null, clear() {} }) },
    './database-startup': { prepareJourneyDeckDatabase: async () => {} },
    '../modules/journeydeck-membership': { getMembershipStatus: async () => ({ nativeModuleAvailable: false, tier: 'free' }) },
    './local-store': { getActiveLocalUserId: () => current }, './release-features': { V3_ASK_JOURNEYDECK_ENABLED: true },
  });
  await assert.rejects(() => bridge.askJourneyDeck('b', 'How many miles?'), /profile changed/); assert.equal(asked, 0);
  const answer = bridge.askJourneyDeck('a', 'How many miles?'); current = 'b'; pending.resolve(result());
  await assert.rejects(() => answer, /profile changed/);
  current = 'a'; assert.equal((await bridge.resolveJourneyDeckAnswer('a', 'untrusted link')).status, 'unavailable'); assert.equal(resolved, 0);
  await bridge.resolveJourneyDeckAnswer('a', ticket); assert.equal(resolved, 1);
});
