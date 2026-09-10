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
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
let prompt: any[] = [], keyboardDismissals = 0;
const platform = { OS: 'ios' };
const mocks: Record<string, unknown> = {
  'react-native': { Modal: host('modal'), View: host('view'), Text: host('text'), Pressable: host('button'), ScrollView: host('scroll'),
    StyleSheet: { create: (styles: unknown) => styles }, Platform: platform,
    Alert: { alert: (...args: any[]) => { prompt = args; } }, Keyboard: { dismiss: () => keyboardDismissals++ } },
  './app-theme': { useAppTheme: () => ({ color: (value: string) => value }), useThemedStyles: (styles: unknown) => styles },
  '@expo/ui/community/menu': { MenuView: host('menu') },
  'expo-symbols': { SymbolView: host('symbol') },
};
function load(file: string) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : require(id) });
  return module.exports;
}
const { NativeSheet, requestSheetClose } = load('native-sheet.tsx');
const { NativeActionMenu } = load('native-action-menu.tsx');

test('unsaved sheets require explicit discard; busy sheets cannot close', () => {
  let closed = 0;
  prompt = []; keyboardDismissals = 0;
  requestSheetClose(true, true, () => closed++);
  assert.equal(prompt.length, 0); assert.equal(closed, 0);
  requestSheetClose(true, false, () => closed++);
  assert.equal(closed, 0);
  assert.equal(prompt[2][0].style, 'cancel');
  assert.equal(prompt[2][0].onPress, undefined, 'Keep editing preserves the draft');
  prompt[2][1].onPress();
  assert.equal(closed, 1); assert.equal(keyboardDismissals, 1);
  requestSheetClose(false, false, () => closed++);
  assert.equal(closed, 2);
});

test('native sheet swipe and button dismissal share draft/busy protection', async () => {
  let tree: any, closed = 0;
  for (const [dirty, busy] of [[false, false], [true, false], [false, true]]) {
    const render = React.createElement(NativeSheet, { visible: true, title: 'Edit Memory', kicker: 'MEMORY', dirty, busy, onClose: () => closed++ });
    await act(() => { if (tree) tree.update(render); else tree = create(render); });
    const modal = tree.root.findByType('modal');
    assert.equal(modal.props.presentationStyle, 'pageSheet');
    assert.equal(modal.props.transparent, false);
    assert.equal(modal.props.allowSwipeDismissal, false, 'fast content scrolling must never begin native sheet dismissal');
    const before = closed;
    modal.props.onRequestClose();
    assert.equal(closed, before + (!dirty && !busy ? 1 : 0));
    const close = tree.root.findAllByType('button').find((button: any) => button.props.accessibilityLabel === 'Close sheet');
    assert.equal(close.props.disabled, busy);
    assert.equal(tree.root.findAllByType('button').filter((button: any) => button.props.accessibilityLabel === 'Dismiss keyboard').length, 0);
    assert.equal(tree.root.findAllByType('text').filter((text: any) => text.children.includes('Done')).length, 0);
    assert.equal(tree.root.findByType('scroll').props.automaticallyAdjustKeyboardInsets, true);
    assert.equal(tree.root.findByType('scroll').props.bounces, false);
  }
  await act(() => tree.unmount());
});

test('follow-up presentations wait for native iOS dismissal, with Android fallback', async () => {
  let tree: any, dismissed = 0;
  const onDismiss = () => dismissed++;
  const render = (visible: boolean) => React.createElement(NativeSheet, { visible, onDismiss, onClose: () => {}, title: 'Organize', kicker: 'MEMORY' });
  platform.OS = 'ios';
  await act(() => { tree = create(render(true)); });
  await act(() => tree.update(render(false)));
  assert.equal(dismissed, 0);
  tree.root.findByType('modal').props.onDismiss();
  assert.equal(dismissed, 1);
  platform.OS = 'android';
  await act(() => tree.update(render(true)));
  await act(() => tree.update(render(false)));
  assert.equal(dismissed, 2);
  await act(() => tree.unmount());
  platform.OS = 'ios';
});

test('system menu preserves checkmarks and only invokes valid enabled actions', async () => {
  let tree: any, selected = '';
  await act(() => { tree = create(React.createElement(NativeActionMenu, { label: 'Sort: Newest', actions: [
    { id: 'newest', title: 'Newest', state: 'on', onSelect: () => { selected = 'newest'; } },
    { id: 'oldest', title: 'Oldest', state: 'off', onSelect: () => { selected = 'oldest'; } },
    { id: 'disabled', title: 'Unavailable', attributes: { disabled: true }, onSelect: () => { selected = 'wrong'; } },
  ] })); });
  const menu = tree.root.findByType('menu');
  assert.equal(menu.props.actions[0].state, 'on');
  assert.equal(menu.props.actions[0].onSelect, undefined, 'callbacks must not cross the native bridge');
  menu.props.onPressAction({ nativeEvent: { event: 'oldest' } });
  assert.equal(selected, 'oldest');
  for (const event of ['disabled', 'unknown']) menu.props.onPressAction({ nativeEvent: { event } });
  assert.equal(selected, 'oldest');
  await act(() => tree.unmount());
});
