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
function flatten(style: any): any { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style?.evaluate ? style.evaluate() : style ?? {}; }
function harness() {
  const prefs = { reduceMotion: false, isAppActive: true };
  const values: any[] = [];
  const animations: any[] = [];
  const host = (name: string) => React.forwardRef(({ children, ...props }: any, ref) => React.createElement(name, { ...props, ref }, children));
  const native = { View: host('View'), Pressable: host('Pressable'), StyleSheet: { flatten } };
  const mocks: any = {
    'react-native': native,
    './motion': { useMotionPreferences: () => prefs, MOTION_DURATIONS: { feedback: 120, standard: 260 }, motionEasing: { standard: 'standard' } },
    'react-native-reanimated': { __esModule: true,
      default: { View: host('AnimatedView'), createAnimatedComponent: (component: any) => component },
      useSharedValue: (initial: any) => React.useState(() => {
        const value: any = { current: initial, target: initial, get: () => value.current, set: (next: any) => {
          value.target = next?.timing ? next.target : next;
          if (next?.timing) animations.push({ from: value.current, to: next.target }); else value.current = next;
        } }; values.push(value); return value;
      })[0],
      useAnimatedStyle: (evaluate: any) => ({ evaluate }), withTiming: (target: any) => ({ timing: true, target }),
    },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL('../src/touch-feedback.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  return { ...module.exports, prefs, values, animations };
}

test('press cancellation releases without activation and preserves styles, handlers and disabled state', async () => {
  const h = harness(); let presses = 0, ins = 0, outs = 0; let tree: any;
  const props = { onPress: () => presses++, onPressIn: () => ins++, onPressOut: () => outs++,
    style: ({ pressed }: any) => ({ borderRadius: 20, opacity: pressed ? .8 : 1, transform: [{ translateX: 3 }] }) };
  await act(() => { tree = create(React.createElement(h.TouchPressable, props)); });
  const press = () => tree.root.findByType('Pressable');
  await act(() => press().props.onPressIn({}));
  assert.equal(flatten(press().props.style).transform.at(-1).scale, .97);
  assert.equal(flatten(press().props.style).transform[0].translateX, 3);
  await act(() => press().props.onPressOut({}));
  assert.equal(flatten(press().props.style).transform.at(-1).scale, 1);
  assert.equal(presses, 0); assert.equal(ins, 1); assert.equal(outs, 1);
  await act(() => press().props.onPress({})); assert.equal(presses, 1);
  await act(() => { tree.update(React.createElement(h.TouchPressable, { ...props, disabled: true })); });
  await act(() => press().props.onPressIn({}));
  assert.equal(press().props.disabled, true); assert.equal(flatten(press().props.style).transform.at(-1).scale, 1);
  await act(() => tree.unmount());
});

test('press motion settles when backgrounded or Reduce Motion is enabled', async () => {
  const h = harness(); let tree: any;
  await act(() => { tree = create(React.createElement(h.TouchPressable)); });
  await act(() => tree.root.findByType('Pressable').props.onPressIn({}));
  h.prefs.isAppActive = false;
  await act(() => tree.update(React.createElement(h.TouchPressable)));
  assert.equal(flatten(tree.root.findByType('Pressable').props.style).transform.at(-1).scale, 1);
  h.prefs.isAppActive = true; h.prefs.reduceMotion = true;
  await act(() => tree.update(React.createElement(h.TouchPressable)));
  await act(() => tree.root.findByType('Pressable').props.onPressIn({}));
  assert.equal(flatten(tree.root.findByType('Pressable').props.style).transitionDuration, 0);
  assert.equal(flatten(tree.root.findByType('Pressable').props.style).transform.at(-1).scale, 1);
  await act(() => tree.unmount());
});

test('selection uses measured positions and retargets from its current frame across wrapped rows', async () => {
  const h = harness(); let tree: any;
  const element = (selectedIndex: number) => React.createElement(h.SlidingSelection, { selectedIndex, highlightStyle: { backgroundColor: 'red' } }, ['First', 'Second']);
  await act(() => { tree = create(element(0)); });
  const items = tree.root.findAllByType('View').filter((item: any) => item.props.onLayout);
  await act(() => { items[0].props.onLayout({ nativeEvent: { layout: { x: 8, y: 0, width: 80, height: 40 } } }); items[1].props.onLayout({ nativeEvent: { layout: { x: 8, y: 48, width: 120, height: 64 } } }); });
  assert.equal(h.values[0].current.join(','), '8,0,80,40');
  await act(() => tree.update(element(1)));
  assert.equal(h.values[0].target.join(','), '8,48,120,64');
  h.values[0].current = [8, 24, 100, 52];
  await act(() => tree.update(element(0)));
  assert.equal(h.animations.at(-1).from.join(','), '8,24,100,52');
  h.prefs.reduceMotion = true;
  await act(() => tree.update(element(1)));
  assert.equal(h.values[0].current.join(','), '8,48,120,64');
  await act(() => tree.unmount());
});

test('expansion measures changing content and hides closed actions immediately during reversal', async () => {
  const h = harness(); let tree: any;
  const element = (expanded: boolean) => React.createElement(h.ExpandingSection, { expanded }, 'Details');
  await act(() => { tree = create(element(false)); });
  await act(() => tree.root.findByType('View').props.onLayout({ nativeEvent: { layout: { height: 150 } } }));
  assert.equal(h.values[0].target, 0);
  await act(() => tree.update(element(true)));
  assert.equal(h.values[0].target, 150);
  h.values[0].current = 70;
  await act(() => tree.update(element(false)));
  assert.equal(h.animations.at(-1).from, 70); assert.equal(h.values[0].target, 0);
  assert.equal(tree.root.findByType('AnimatedView').props.pointerEvents, 'none');
  assert.equal(tree.root.findByType('AnimatedView').props.accessibilityElementsHidden, true);
  h.prefs.reduceMotion = true;
  await act(() => tree.update(element(true)));
  await act(() => tree.root.findByType('View').props.onLayout({ nativeEvent: { layout: { height: 230 } } }));
  assert.equal(h.values[0].current, 230);
  await act(() => tree.unmount());
});
