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
const platform = { OS: 'ios', Version: '26.0' };
let change: (value: boolean) => void, resolvePreference: (value: boolean) => void;
let subscriptions = 0, removals = 0, navigation: any[] = [], bounds: any;
const journeyActions: any[] = [];
// Use the installed Slot merge that Expo wraps. A plain clone misses its
// object-spread of style callbacks, which caused card padding to disappear.
const { Slot } = require('@radix-ui/react-slot');
function Link({ href, children }: any) {
  const items = React.Children.toArray(children) as any[];
  const trigger = items.find(child => child.type !== Link.Menu);
  const menu = items.find(child => child.type === Link.Menu);
  return React.createElement(React.Fragment, null,
    React.createElement(Slot, { style: {}, onPress: () => navigation.push(href) }, trigger), menu);
}
Link.AppleZoom = ({ children, ...props }: any) => React.createElement('zoom', {}, React.createElement(Slot, props, children));
Link.Trigger = ({ children, ...props }: any) => React.createElement(Slot, props, children);
Link.Menu = ({ children }: any) => React.createElement('menu', {}, children);
Link.MenuAction = (props: any) => React.createElement('action', props);
const source = readFileSync(new URL('../src/card-detail-link.tsx', import.meta.url), 'utf8');
const module = { exports: {} as any };
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
  if (id === 'react-native') return { Platform: platform, AccessibilityInfo: {
    addEventListener: (_event: string, callback: (value: boolean) => void) => { subscriptions++; change = callback; return { remove: () => removals++ }; },
    isReduceMotionEnabled: () => new Promise(resolve => { resolvePreference = resolve; }),
  } };
  if (id === 'expo-router') return { Link, usePreventZoomTransitionDismissal: (options: any) => { bounds = options; } };
  if (id === './journey-card-action') return { openJourneyCardAction: (id: string, action: string) => journeyActions.push({ id, action }) };
  return require(id);
} });
const { CardMotionProvider, CardDetailLink, useCardDetailDismissal } = module.exports;

test('zoom uses the exact tapped ID once, keeps card layout, and preserves source on updates', async () => {
  let tree: any, fallbackCalls = 0, selections = 0;
  navigation = []; subscriptions = 0;
  const style = { width: 250, borderRadius: 20 };
  const render = (name: string) => React.createElement(CardMotionProvider, {}, ['first', 'second'].map(id =>
    React.createElement(CardDetailLink, { key: id, id, kind: 'memory', onSelect: () => selections++ },
      React.createElement('card', { style, name, onPress: () => fallbackCalls++ }))));
  await act(() => { tree = create(render('Original')); });
  assert.equal(tree.root.findAllByType('zoom').length, 0, 'stay quiet until accessibility is known');
  await act(async () => { resolvePreference(false); await Promise.resolve(); });
  assert.equal(subscriptions, 1, 'one listener for the whole navigation tree');
  const sources = tree.root.findAllByType('zoom');
  const card = tree.root.findAllByType('card')[1];
  assert.equal(card.props.style, style);
  assert.equal(card.props.collapsable, false);
  await act(() => card.props.onPress());
  assert.equal(navigation.length, 1);
  assert.equal(navigation[0].pathname, '/memory/[id]');
  assert.equal(navigation[0].params.id, 'second');
  assert.equal(fallbackCalls, 0, 'old imperative navigation must not also fire');
  assert.equal(selections, 1);
  await act(() => tree.update(render('Refreshed')));
  assert.equal(tree.root.findAllByType('zoom')[1], sources[1], 'refresh must not replace the return source');
  await act(() => tree.unmount());
});

test('card menus keep tap zoom separate from edit/share and bind the held Memory', async () => {
  let tree: any, edited: string[] = [], shared: string[] = [];
  navigation = [];
  const style = ({ pressed }: any) => [{ padding: 16 }, pressed && { opacity: 0.7 }];
  const render = () => React.createElement(CardMotionProvider, {}, ['one', 'two'].map(id =>
    React.createElement(CardDetailLink, { key: id, id, kind: 'memory', actions: [
      { id: 'edit', title: 'Edit Memory', icon: 'pencil', onPress: () => edited.push(id) },
      { id: 'share', title: 'Create share card', icon: 'square.and.arrow.up', onPress: () => shared.push(id) },
    ] }, React.createElement('card', { style }))));
  await act(() => { tree = create(render()); });
  assert.equal(tree.root.findAllByType('menu').length, 2, 'menus work while Reduce Motion preference is loading');
  await act(async () => { resolvePreference(false); await Promise.resolve(); });
  const sources = tree.root.findAllByType('zoom');
  const menu = tree.root.findAllByType('menu')[1];
  menu.findAllByType('action')[0].props.onPress();
  menu.findAllByType('action')[1].props.onPress();
  assert.deepEqual(edited, ['two']); assert.deepEqual(shared, ['two']);
  assert.equal(navigation.length, 0, 'selecting an action does not commit the link');
  const card = tree.root.findAllByType('card')[1];
  assert.equal(card.props.style, style, 'Trigger and menu composition preserve Pressable style functions');
  card.props.onPress();
  assert.equal(navigation.length, 1);
  assert.equal(navigation[0].params.id, 'two');
  await act(() => tree.update(render()));
  assert.equal(tree.root.findAllByType('zoom')[1], sources[1]);
  assert.doesNotMatch(source, /<Link\.Preview/, 'menu does not pre-render a destination or change zoom presentation');
  await act(() => tree.unmount());
});

test('Journey context actions target the held card; placeholders and Android have no menu', async () => {
  let tree: any;
  journeyActions.length = 0;
  const render = (id: string | null, disabled = false) => React.createElement(CardMotionProvider, {},
    React.createElement(CardDetailLink, { kind: 'journey', id }, React.createElement('card', { disabled })));
  await act(() => { tree = create(render('held-journey')); });
  const actions = tree.root.findAllByType('action');
  actions[0].props.onPress(); actions[1].props.onPress();
  assert.deepEqual(journeyActions, [{ id: 'held-journey', action: 'edit' }, { id: 'held-journey', action: 'share' }]);
  await act(() => tree.update(render(null)));
  assert.equal(tree.root.findAllByType('menu').length, 0);
  await act(() => tree.update(render('held-journey', true)));
  assert.equal(tree.root.findAllByType('menu').length, 0);
  platform.OS = 'android';
  await act(() => tree.update(render('held-journey')));
  assert.equal(tree.root.findAllByType('menu').length, 0);
  platform.OS = 'ios';
  await act(() => tree.unmount());
});

test('Reduce Motion changes win over an older async read and restore normal navigation', async () => {
  let tree: any, fallbackCalls = 0;
  const render = React.createElement(CardMotionProvider, {}, React.createElement(CardDetailLink, { id: 'drive', kind: 'journey' },
    React.createElement('card', { onPress: () => fallbackCalls++ })));
  await act(() => { tree = create(render); });
  await act(() => change(true));
  await act(async () => { resolvePreference(false); await Promise.resolve(); });
  assert.equal(tree.root.findAllByType('zoom').length, 0);
  tree.root.findByType('card').props.onPress();
  assert.equal(fallbackCalls, 1);
  await act(() => change(false));
  assert.equal(tree.root.findAllByType('zoom').length, 1);
  navigation = [];
  tree.root.findByType('card').props.onPress();
  assert.equal(navigation[0].pathname, '/journey/[id]');
  await act(() => tree.unmount());
  assert.ok(removals >= 2);
});

test('older iOS, other platforms, disabled cards and empty placeholders keep original behavior', async () => {
  for (const [os, version, id, disabled] of [['ios', '17.7', 'drive', false], ['android', 36, 'drive', false], ['ios', '26', null, false], ['ios', '26', 'drive', true]] as const) {
    platform.OS = os; platform.Version = String(version);
    let tree: any;
    await act(() => { tree = create(React.createElement(CardMotionProvider, {}, React.createElement(CardDetailLink,
      { id, kind: 'journey' }, React.createElement('card', { disabled })))); });
    await act(async () => { resolvePreference(false); await Promise.resolve(); });
    assert.equal(tree.root.findAllByType('zoom').length, 0);
    assert.equal(tree.root.findByType('card').props.disabled, disabled);
    await act(() => tree.unmount());
  }
  platform.OS = 'ios'; platform.Version = '26.0';
});

test('detail dismissal stays at the edge so route maps retain pan gestures', () => {
  useCardDetailDismissal();
  assert.equal(bounds.unstable_dismissalBoundsRect.maxX, 32);
  assert.equal(bounds.unstable_dismissalBoundsRect.maxY, undefined);
});

test('real Slot composition preserves dynamic Journey padding and pressed appearance', async () => {
  let tree: any;
  const base = { paddingHorizontal: 12, paddingVertical: 10, gap: 7, borderRadius: 16 };
  const style = ({ pressed }: { pressed: boolean }) => [base, pressed && { opacity: 0.8 }];
  await act(() => { tree = create(React.createElement(CardMotionProvider, {}, React.createElement(CardDetailLink,
    { kind: 'journey', id: 'padded' }, React.createElement('card', { style })))); });
  await act(async () => { resolvePreference(false); await Promise.resolve(); });
  const card = tree.root.findByType('card');
  assert.equal(typeof card.props.style, 'function');
  assert.equal(card.props.style, style);
  assert.deepEqual(card.props.style({ pressed: false }), [base, false]);
  assert.deepEqual(card.props.style({ pressed: true }), [base, { opacity: 0.8 }]);
  await act(() => tree.unmount());
});
