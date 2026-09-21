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
function harness() {
  const prefs = { reduceMotion: false, isAppActive: true };
  const timers = new Map<number, () => void>(); let timerId = 0;
  const builder = (kind: string): any => ({ kind, duration: (duration: number) => ({ ...builder(kind), ms: duration }), easing() { return this; }, withInitialValues(initial: any) { return { ...this, initial }; } });
  const mocks: any = {
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: (value: any) => value } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView', Text: 'AnimatedText' }, FadeInDown: builder('enter'), FadeOut: builder('exit'), LinearTransition: builder('layout') },
    // expo-symbols 58's Node entry imports a missing materialImageSource file; keep this harness off the real package.
    'expo-symbols': { SymbolView: 'SymbolView' },
    './app-theme': { useThemedStyles: (styles: any) => styles },
    './motion': { useMotionPreferences: () => prefs, MOTION_DURATIONS: { quick: 180, standard: 260, exit: 150 }, motionEasing: { enter: 'enter', standard: 'standard' } },
    './touch-feedback': { TouchPressable: 'Pressable' },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/memory-edit-motion.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id),
    setTimeout: (fn: () => void) => { timers.set(++timerId, fn); return timerId; }, clearTimeout: (id: number) => timers.delete(id) });
  return { ...module.exports, prefs, timers };
}
const journeys = ['a', 'b', 'c'].map(id => ({ id, title: `Journey ${id}`, detail: 'Monday · 10 mi' }));

test('membership moves into the collection in insertion order, and removal closes the gap without losing hidden links', async () => {
  const h = harness(); let tree: any; let ids = ['a', 'older'];
  const render = () => React.createElement(h.MemoryJourneyEditor, { journeys, selectedIds: ids, onToggle: (id: string) => { ids = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]; tree.update(render()); } });
  await act(() => { tree = create(render()); });
  assert.ok(tree.root.findAllByType('AnimatedView').every((view: any) => !view.props.entering));
  const press = (label: string) => tree.root.findAllByType('Pressable').find((view: any) => view.props.accessibilityLabel === label);
  await act(() => press('Add Journey b to Memory').props.onPress());
  assert.deepEqual(ids, ['a', 'older', 'b']);
  assert.ok(press('Remove Journey b from Memory').parent.props.entering);
  assert.ok(press('Remove Journey a from Memory').parent.props.layout);
  await act(() => press('Remove Journey a from Memory').props.onPress());
  assert.deepEqual(ids, ['older', 'b']);
  assert.ok(press('Add Journey a to Memory'));
  assert.ok(tree.root.findAllByType('Text').some((view: any) => view.children.join('').includes('1 older journey is')));
  await act(() => tree.unmount());
});

test('reduced motion and background disable membership movement, and busy state disables every action', async () => {
  const h = harness(); let tree: any;
  const render = () => React.createElement(h.MemoryJourneyEditor, { journeys, selectedIds: ['a'], onToggle: () => {}, disabled: true });
  await act(() => { tree = create(render()); });
  for (const mode of ['reduceMotion', 'isAppActive']) {
    h.prefs.reduceMotion = mode === 'reduceMotion'; h.prefs.isAppActive = mode !== 'isAppActive';
    await act(() => tree.update(render()));
    assert.ok(tree.root.findAllByType('AnimatedView').every((view: any) => !view.props.entering && !view.props.exiting && !view.props.layout));
    assert.ok(tree.root.findAllByType('Pressable').every((view: any) => view.props.disabled));
  }
  await act(() => tree.unmount());
});

test('save check appears only after confirmed success, expires, and never replays on background return or edit reversal', async () => {
  const h = harness(); let tree: any;
  const render = (saving: boolean, dirty: boolean, successVersion: number) => React.createElement(h.MemorySaveLabel, { saving, dirty, successVersion });
  await act(() => { tree = create(render(false, true, 0)); });
  await act(() => tree.update(render(true, true, 0)));
  assert.equal(tree.root.findAllByType('AnimatedText').length, 0);
  await act(() => tree.update(render(false, true, 0))); // rejected save
  assert.equal(tree.root.findAllByType('AnimatedText').length, 0);
  await act(() => tree.update(render(true, false, 1))); // persistence resolved, pending state has not settled
  assert.equal(tree.root.findAllByType('AnimatedText').length, 0);
  await act(() => tree.update(render(false, false, 1)));
  assert.equal(tree.root.findByType('AnimatedText').children.join(''), '✓ SAVED');
  await act(() => { for (const fn of h.timers.values()) fn(); });
  assert.equal(tree.root.findAllByType('AnimatedText').length, 0);
  await act(() => tree.update(render(false, true, 1)));
  await act(() => tree.update(render(false, false, 1)));
  assert.equal(tree.root.findAllByType('AnimatedText').length, 0);
  h.prefs.isAppActive = false; await act(() => tree.update(render(false, false, 1)));
  h.prefs.isAppActive = true; await act(() => tree.update(render(false, false, 1)));
  assert.equal(tree.root.findAllByType('AnimatedText').length, 0);
  h.prefs.reduceMotion = true; await act(() => tree.update(render(false, false, 2)));
  assert.equal(tree.root.findByType('AnimatedText').props.entering, undefined);
  await act(() => tree.unmount()); assert.equal(h.timers.size, 0);
});
