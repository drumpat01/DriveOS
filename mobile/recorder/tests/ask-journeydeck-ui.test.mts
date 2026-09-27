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
const askScreenSource = readFileSync(new URL('../src/ask-journeydeck-screen.tsx', import.meta.url), 'utf8');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
function load(name: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  // The V4 redesign is off in these classic-layout tests; its modules are stubbed.
  const v4Stubs: Record<string, unknown> = { './redesign-ui': { useRedesignColors: () => ({}) }, './device-layout': { isIpad: () => false }, './ask-journeydeck-v4': {}, './ask-chat-motion': {}, 'react-native-keyboard-controller': {}, './motion': { useMotionPreferences: () => ({ reduceMotion: false }) } };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : id in v4Stubs ? v4Stubs[id] : id.endsWith('.png') ? id : require(id) });
  return module.exports;
}
function deferred() {
  let resolve!: (value: any) => void, reject!: (error: Error) => void;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const ticket = 'b78cba9f-e125-4fb9-a76b-e1cd44583c75';
const result = (text = '19.8 miles across 2 journeys') => ({ status: 'answered', text, ticket, contextToken: ticket, profileId: 'a', evidence: [{ kind: 'journey', id: 'journey-a', label: 'Journey on Sep 15, 2026' }] });
async function screen(options: { available?: boolean; enabled?: boolean; ticket?: string; theme?: string; model?: string; tier?: 'free' | 'paid' } = {}) {
  let upgrades = 0;
  let userID = 'a', listener: (state: string) => void = () => {};
  let ask: (...args: any[]) => Promise<any> = async () => result();
  let resolve: (...args: any[]) => Promise<any> = async () => result();
  const calls: any[][] = [], resolutions: any[][] = [], pushes: any[] = [], scrolls: any[] = [];
  const appState = { currentState: 'active', addEventListener: (_: string, callback: typeof listener) => { listener = callback; return { remove() {} }; } };
  const native = { AppState: appState, Keyboard: { dismiss() {} }, StyleSheet: { create: (value: any) => value, hairlineWidth: 1 },
    ...Object.fromEntries(['ActivityIndicator', 'Image', 'KeyboardAvoidingView', 'Pressable', 'Text', 'TextInput', 'View'].map(name => [name, host(name)])),
    ScrollView: React.forwardRef(({ children, ...props }: any, ref: any) => { React.useImperativeHandle(ref, () => ({ scrollTo: (options: any) => scrolls.push(options) })); return React.createElement('ScrollView', props, children); }) };
  const component = load('ask-journeydeck-screen.tsx', {
    'react-native': native,
    'expo-symbols': { SymbolView: host('Symbol') },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 8, left: 0 }) },
    'expo-router': {
      Stack: { Screen: host('route-options') },
      router: { push: (path: any) => pushes.push(path), canGoBack: () => true, back: () => pushes.push('back'), replace: (path: any) => pushes.push(path) },
      useLocalSearchParams: () => ({ ticket: options.ticket }),
    },
    './app-theme': { useAppTheme: () => testTheme(options.theme ?? 'redline') },
    './siri-testing': { canShowSiriTesting: false },
    './native-navigation-context': { useJourneyDeckNavigation: () => ({ membership: { tier: options.tier ?? 'paid' }, showUpgrade: () => { upgrades++; } }) },
    './auth': { getCurrentUser: () => ({ id: userID }) },
    './release-features': { V3_ASK_JOURNEYDECK_ENABLED: options.enabled !== false },
    './ask-journeydeck': {
      ASK_EXAMPLES: ['How many miles did I drive this week?'],
      ASK_CANNOT_COMPUTE: "I couldn't complete that request. Please try again.",
      isAskJourneyDeckAvailable: options.available !== false,
      askJourneyDeckModelAvailability: async () => options.model ?? 'available',
      askJourneyDeck: (...args: any[]) => { calls.push(args); return ask(...args); },
      resolveJourneyDeckAnswer: (...args: any[]) => { resolutions.push(args); return resolve(...args); },
    },
  }).AskJourneyDeckScreen;
  let tree: any;
  await act(async () => { tree = create(React.createElement(component)); await Promise.resolve(); });
  return {
    tree, calls, resolutions, pushes, scrolls, upgrades: () => upgrades,
    text: () => tree.root.findAllByType('Text').map((node: any) => node.children.join('')).join('|'),
    input: () => tree.root.findByType('TextInput'),
    button: () => tree.root.findByProps({ testID: 'ask-submit' }),
    ask: (fn: typeof ask) => { ask = fn; }, resolve: (fn: typeof resolve) => { resolve = fn; },
    submit: async (question: string) => { await act(() => { tree.root.findByType('TextInput').props.onChangeText(question); }); await act(() => tree.root.findByProps({ testID: 'ask-submit' }).props.onPress()); },
    state: async (state: string) => { await act(async () => { appState.currentState = state; listener(state); await Promise.resolve(); }); },
    profile: async (id: string) => { await act(async () => { userID = id; tree.update(React.createElement(component)); await Promise.resolve(); }); },
    reopen: async () => { await act(() => tree.unmount()); await act(async () => { tree = create(React.createElement(component)); await Promise.resolve(); }); },
    contentSizeChange: async (height = 1200) => { await act(() => tree.root.findByType('ScrollView').props.onContentSizeChange(390, height)); },
    viewport: async (height: number) => { await act(() => tree.root.findByType('ScrollView').props.onLayout({ nativeEvent: { layout: { height } } })); },
    messageLayout: async (y: number, height: number) => { await act(() => tree.root.findAllByType('View').filter((node: any) => node.props.testID?.startsWith('ask-message-')).at(-1).props.onLayout({ nativeEvent: { layout: { y, height } } })); },
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

test('Ask JourneyDeck uses the shared theme palette for a full chatbot conversation surface', () => {
  assert.match(askScreenSource, /type ChatMessage/);
  assert.match(askScreenSource, /styles\.userBubble/);
  assert.match(askScreenSource, /styles\.assistantBubble/);
  assert.match(askScreenSource, /styles\.composerDock/);
  assert.match(askScreenSource, /SUPPORTING RECORDS/);
  assert.match(askScreenSource, /backgroundColor: c\.page/);
  assert.match(askScreenSource, /backgroundColor: c\.accent/);
  assert.match(askScreenSource, /backgroundColor: c\.card/);
  assert.match(askScreenSource, /backgroundColor: c\.inset/);
  assert.doesNotMatch(askScreenSource, /#[0-9a-f]{3,8}/i);
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
    assert.match(s.text(), /couldn't complete that request/); assert.match(s.text(), /19.8 miles/);
    assert.equal(s.button().props.disabled, false);
    s.ask(async () => result()); await s.submit('How many miles?');
    assert.equal(s.calls[2][2], undefined);
  } finally { await s.close(); }
});

test('profile switches isolate chat history and pending responses', async () => {
  const s = await screen();
  try {
    await s.submit('How many miles?');
    const pending = deferred(); s.ask(() => pending.promise); await s.submit('When was my last journey?');
    await s.profile('b');
    assert.doesNotMatch(s.text(), /19.8 miles/); assert.equal(s.input().props.value, '');
    await act(() => pending.resolve(result('STALE PRIVATE ANSWER')));
    assert.doesNotMatch(s.text(), /STALE PRIVATE ANSWER/);
    s.ask(async () => result()); await s.submit('How many miles?');
    assert.equal(s.calls.at(-1)[2], undefined);
  } finally { await s.close(); }
});

test('the transient inactive state used while iOS presents a sheet does not clear or dismiss Ask', async () => {
  const s = await screen();
  try {
    await s.submit('How many miles?');
    assert.match(s.text(), /19.8 miles/);
    await s.state('inactive');
    assert.match(s.text(), /19.8 miles/);
    assert.deepEqual(s.pushes, []);
    await s.state('active');
  } finally { await s.close(); }
});

test('chat bubbles remain through backgrounding and closing the sheet until the app process ends', async () => {
  const s = await screen();
  try {
    await s.submit('How many miles?');
    assert.match(s.text(), /How many miles/); assert.match(s.text(), /19.8 miles/);
    await s.state('background'); await s.state('active');
    assert.match(s.text(), /How many miles/); assert.match(s.text(), /19.8 miles/);
    await s.reopen();
    await s.contentSizeChange();
    assert.deepEqual(s.scrolls, [], 'reopening the iOS sheet must not auto-scroll restored bubbles out of view');
    assert.match(s.text(), /How many miles/); assert.match(s.text(), /19.8 miles/);
  } finally { await s.close(); }
});

test('a reply finishes in the same chat after the sheet is closed and reopened', async () => {
  const s = await screen();
  try {
    const pending = deferred();
    s.ask(() => pending.promise);
    await s.submit('How many journeys this week?');
    await s.reopen();
    assert.equal(s.button().props.disabled, true);
    await act(() => pending.resolve(result('2 journeys this week')));
    assert.match(s.text(), /How many journeys this week/);
    assert.match(s.text(), /2 journeys this week/);
    assert.equal(s.button().props.disabled, false);
  } finally { await s.close(); }
});

test('greeting, validation, pending reply and conversation retain one scroll viewport with explicit inset ownership', async () => {
  const s = await screen();
  try {
    const viewport = s.tree.root.findByType('ScrollView');
    assert.equal(viewport.props.contentInsetAdjustmentBehavior, 'never');
    assert.equal(viewport.props.automaticallyAdjustContentInsets, false);
    assert.equal(viewport.props.automaticallyAdjustKeyboardInsets, false);
    assert.equal(viewport.props.removeClippedSubviews, false);
    await s.viewport(700); await s.contentSizeChange(340);
    assert.deepEqual(s.scrolls, []);
    assert.match(s.text(), /Hello! I’m JourneyDeck/);
    assert.match(s.text(), /private on-device history/);
    assert.doesNotMatch(s.text(), /Where have we been/);
    assert.equal(s.tree.root.findAll((node: any) => node.props.accessibilityLabel?.startsWith('Ask:')).length, 0);
    await s.submit(' ');
    assert.equal(s.tree.root.findByType('ScrollView'), viewport);
    const pending = deferred(); s.ask(() => pending.promise);
    await s.submit('How many miles?');
    assert.equal(s.tree.root.findByType('ScrollView'), viewport);
    await act(() => pending.resolve(result()));
    assert.equal(s.tree.root.findByType('ScrollView'), viewport);
  } finally { await s.close(); }
});

test('a long answer scrolls to its beginning only after row, content and viewport have all been measured', async () => {
  const s = await screen();
  try {
    await s.submit('How far did I drive today?');
    await s.messageLayout(440, 1100);
    await s.contentSizeChange(1600);
    assert.deepEqual(s.scrolls, [], 'zero-height viewport cannot produce a scroll command');
    await s.viewport(700);
    assert.equal(s.scrolls.length, 1);
    assert.equal(s.scrolls[0].y, 428, 'show the answer text, not the end of its supporting-record list');
    assert.equal(s.scrolls[0].animated, false);
    await s.viewport(320); await s.contentSizeChange(1800); await s.messageLayout(440, 1300);
    await s.viewport(700); await s.contentSizeChange(1600);
    assert.equal(s.scrolls.length, 1, 'keyboard, rotation and content relayout cannot issue another scroll');
    assert.match(s.text(), /19.8 miles/);
  } finally { await s.close(); }
});

test('new replies wait for matching content height and stay inside the visible scroll range', async () => {
  const s = await screen();
  try {
    await s.viewport(700); await s.contentSizeChange(340);
    await s.submit('How many miles?');
    await s.messageLayout(440, 400);
    assert.deepEqual(s.scrolls, [], 'the greeting content height is too old for the new answer');
    await s.contentSizeChange(900);
    assert.equal(s.scrolls[0].y, 200, 'clamp to content height minus viewport height');
    await s.reopen();
    await s.contentSizeChange(900); await s.viewport(500); await s.messageLayout(440, 400);
    assert.equal(s.scrolls.length, 1, 'restoring the transcript does not request scrolling');
  } finally { await s.close(); }
});

test('content-size-first delivery handles a short answer without scrolling beyond zero', async () => {
  const s = await screen();
  try {
    await s.viewport(1000);
    await s.submit('How many miles?');
    await s.contentSizeChange(700);
    assert.deepEqual(s.scrolls, []);
    await s.messageLayout(440, 200);
    assert.equal(s.scrolls[0].y, 0);
  } finally { await s.close(); }
});

test('JourneyDeck uses the navigator avatar corresponding to each selected theme', async () => {
  const choices = {
    dark: 'navigator-cinematic-dark-256.png', light: 'navigator-warm-ivory-256.png', sakura: 'navigator-rosewater-256.png',
    redline: 'navigator-grand-touring-256.png', 'midnight-canopy': 'navigator-autumn-drive-256.png',
  };
  for (const [theme, filename] of Object.entries(choices)) {
    const s = await screen({ theme });
    try {
      assert.ok(s.tree.root.findAllByType('Image').length >= 2);
      assert.ok(s.tree.root.findAllByType('Image').every((node: any) => String(node.props.source).endsWith(filename)));
    } finally { await s.close(); }
  }
});

test('Apple Intelligence setup status is shown when it is disabled on the iPhone', async () => {
  const s = await screen({ model: 'appleIntelligenceNotEnabled' });
  try { assert.match(s.text(), /Turn on Apple Intelligence in iPhone Settings/); }
  finally { await s.close(); }
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

test('old installed runtimes and non-V3 routes fail closed; the native close control dismisses the prompt', async () => {
  const old = await screen({ available: false });
  try {
    assert.equal(old.button().props.disabled, true); assert.match(old.text(), /needs the V3 native question engine/);
    const done = old.tree.root.findAllByType('Pressable').find((node: any) => node.props.accessibilityLabel === 'Close Ask JourneyDeck');
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
  let nativeAnswer = () => pending.promise;
  let nativeResolution = async () => result();
  const bridge = load('ask-journeydeck.ts', {
    expo: { requireOptionalNativeModule: () => ({ askJourneyDeckAsync: () => { asked++; return nativeAnswer(); }, resolveJourneyDeckAnswerAsync: () => { resolved++; return nativeResolution(); } }) },
    './database-startup': { prepareJourneyDeckDatabase: async () => {} },
    './local-store': { getActiveLocalUserId: () => current }, './release-features': { V3_ASK_JOURNEYDECK_ENABLED: true },
  });
  await assert.rejects(() => bridge.askJourneyDeck('b', 'How many miles?'), /profile changed/); assert.equal(asked, 0);
  const answer = bridge.askJourneyDeck('a', 'How many miles?'); current = 'b'; pending.resolve(result());
  await assert.rejects(() => answer, /profile changed/);
  current = 'a'; nativeAnswer = async () => ({ status: 'unavailable', text: 'internal detail', evidence: [] });
  assert.equal((await bridge.askJourneyDeck('a', 'Unsupported question')).text, "I couldn't complete that request. Please try again.");
  current = 'a'; assert.equal((await bridge.resolveJourneyDeckAnswer('a', 'untrusted link')).status, 'unavailable'); assert.equal(resolved, 0);
  nativeResolution = async () => ({ status: 'clarify', text: 'ask another question', evidence: [] });
  assert.equal((await bridge.resolveJourneyDeckAnswer('a', ticket)).text, 'ask another question'); assert.equal(resolved, 1);
});

test('chat sends the original wording to the shared native engine and preserves failure categories', async () => {
  const queries = require('../modules/journeydeck-recorder/ios/AskResources/ask-query-engine.js');
  const { fixture } = require('../modules/journeydeck-recorder/ios/AskResources/ask-evaluation.js');
  const calls: string[] = [];
  let raw: any = { ...queries.defaults, operation: 'largest', metric: 'miles' };
  const bridge = load('ask-journeydeck.ts', {
    expo: { requireOptionalNativeModule: () => ({
      askJourneyDeckAsync: async (question: string) => {
        calls.push(question);
        const plan = queries.resolvePlan(question, raw, null, fixture().now);
        return { ...queries.execute(plan, fixture(), null), profileId: 'a' };
      }, resolveJourneyDeckAnswerAsync: async () => result(),
    }) },
    './database-startup': { prepareJourneyDeckDatabase: async () => {} },
    './local-store': { getActiveLocalUserId: () => 'a' }, './release-features': { V3_ASK_JOURNEYDECK_ENABLED: true },
  });
  for (const question of ['What is my longest drive?', 'What is my longest journey', 'Which outing took me the furthest?']) {
    const answer = await bridge.askJourneyDeck('a', question);
    assert.equal(answer.status, 'answered'); assert.match(answer.text, /Longest by distance:.*40.0 miles/);
    assert.equal(answer.evidence[0].id, 'j4'); assert.equal(calls.at(-1), question);
  }
  raw = { ...queries.defaults, decision: 'unsupported' };
  const unsupported = await bridge.askJourneyDeck('a', 'Find a photograph of a dog');
  assert.equal(unsupported.reason, 'unsupportedRequest'); assert.match(unsupported.text, /does not support yet/);
  assert.equal(unsupported.evidence.length, 0);
  raw = { ...queries.defaults, operation: 'largest', metric: 'fuel' };
  const invalid = await bridge.askJourneyDeck('a', 'Compare my petrol usage');
  assert.equal(invalid.reason, 'invalidPlan'); assert.match(invalid.text, /supported query/);
  const clarification = bridge.presentAskAnswer({ status: 'clarify', text: 'Distance or driving time?', evidence: result().evidence, ticket });
  assert.equal(clarification.text, 'Distance or driving time?'); assert.equal(clarification.evidence.length, 0); assert.equal(clarification.ticket, undefined);
  assert.match(bridge.presentAskAnswer(queries.planFailure('modelUnavailable')).text, /Apple Intelligence/);
  // Unknown native failures must not expose raw error details or credentials.
  assert.doesNotMatch(bridge.presentAskAnswer({ status: 'unavailable', reason: 'unknown', text: 'SECRET' }).text, /SECRET/);
});

test('Ask JourneyDeck shows the Plus upgrade prompt to free members and never asks the archive', async () => {
  const view = await screen({ tier: 'free' });
  assert.match(view.text(), /Included with JourneyDeck Plus/);
  assert.equal(view.tree.root.findAllByType('TextInput').length, 0);
  await act(() => view.tree.root.findByProps({ testID: 'ask-upgrade-button' }).props.onPress());
  assert.equal(view.upgrades(), 1);
  assert.equal(view.calls.length, 0);
  await view.close();
});
