import assert from 'node:assert/strict';
import { testTheme } from './theme-fixture.mts';
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
const SafeArea = React.createContext({ top: 0, bottom: 0, left: 0, right: 0 });
let light = true;
const mocks: Record<string, unknown> = {
  'react-native': { View: host('view'), Text: host('text'), Pressable: host('button'), StyleSheet: { create: (s: unknown) => s, hairlineWidth: 0.5 } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => React.useContext(SafeArea) },
  'expo-symbols': { SymbolView: host('symbol') },
  './app-theme': { useAppTheme: () => testTheme(light) },
};
const module = { exports: {} as any };
const code = ts.transpileModule(readFileSync(new URL('../src/detail-screen-frame.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id in mocks ? mocks[id] : require(id) });
const { DetailViewportProvider, DetailScreenFrame } = module.exports;

test('detail geometry ignores destination safe-area changes but follows window changes', async () => {
  let tree: any, backed = 0;
  const render = (destinationTop: number, rootTop = 62, actions = false) =>
    React.createElement(SafeArea.Provider, { value: { top: rootTop, bottom: 34, left: 0, right: 0 } },
      React.createElement(DetailViewportProvider, null,
        React.createElement(SafeArea.Provider, { value: { top: destinationTop, bottom: 0, left: 0, right: 0 } },
          React.createElement(DetailScreenFrame, { title: 'Memory', onBack: () => backed++, actions: actions ? React.createElement('menu') : undefined }, React.createElement('content')))));
  await act(() => { tree = create(render(0)); });
  const screen = () => tree.root.findAllByType('view')[0];
  const header = () => tree.root.findAllByType('view')[1];
  const initialHeader = header().props.style;
  assert.equal(screen().props.style[1].paddingTop, 62);
  assert.equal(initialHeader.height, 52);
  await act(() => tree.update(render(106, 62, true)));
  assert.equal(screen().props.style[1].paddingTop, 62, 'UIKit finishing a zoom cannot move our header');
  assert.deepEqual(header().props.style, initialHeader, 'late menu content cannot resize the header');
  assert.equal(tree.root.findByType('menu').parent.props.style.height, 44);
  tree.root.findByType('button').props.onPress();
  assert.equal(backed, 1);
  assert.equal(tree.root.findByType('text').props.accessibilityRole, 'header');
  light = false;
  await act(() => tree.update(render(0, 0, true)));
  assert.equal(screen().props.style[1].paddingTop, 0, 'real window changes still update the layout');
  assert.equal(screen().props.style[1].backgroundColor, '#08070d');
  await act(() => tree.unmount());
});
