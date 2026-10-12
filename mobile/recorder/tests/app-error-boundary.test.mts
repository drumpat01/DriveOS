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

function loadBoundary(updates: { reloadAsync: () => Promise<void> }) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL('../src/app-error-boundary.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id: string) => {
      if (id === 'expo-updates') return updates;
      if (id === 'react-native') {
        return {
          Pressable: host('Pressable'),
          SafeAreaView: host('SafeAreaView'),
          StyleSheet: { create: (styles: any) => styles },
          Text: host('Text'),
          View: host('View'),
          useColorScheme: () => 'dark',
        };
      }
      return require(id);
    },
  });
  return module.exports as {
    AppErrorBoundary: typeof React.Component;
    AppErrorFallback: (props: { onReload: () => void }) => React.ReactElement;
    reloadAppRoot: (remount: () => void, reload?: () => Promise<void>) => Promise<void>;
  };
}

function textOf(tree: any) {
  return tree.root.findAllByType('Text').map((node: any) => node.children.join('')).join('|');
}

test('reloadAppRoot remounts when the JS runtime cannot reload', async () => {
  const { reloadAppRoot } = loadBoundary({ reloadAsync: async () => { throw new Error('unused'); } });
  let remounts = 0;
  await reloadAppRoot(() => { remounts += 1; }, async () => { throw new Error('updates unavailable'); });
  assert.equal(remounts, 1);
});

test('reloadAppRoot prefers a successful Expo Updates reload over remount', async () => {
  const { reloadAppRoot } = loadBoundary({ reloadAsync: async () => { throw new Error('unused'); } });
  let remounts = 0;
  let reloads = 0;
  await reloadAppRoot(() => { remounts += 1; }, async () => { reloads += 1; });
  assert.equal(reloads, 1);
  assert.equal(remounts, 0);
});

test('App.tsx wraps the root tree in AppErrorBoundary', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /import \{ AppErrorBoundary \} from '\.\/src\/app-error-boundary'/);
  assert.match(app, /<AppErrorBoundary><GestureHandlerRootView/);
  assert.match(app, /<\/GestureHandlerRootView><\/AppErrorBoundary>/);
});

test('an uncaught render error shows the on-brand fallback instead of a blank tree', async () => {
  const reloads: string[] = [];
  const api = loadBoundary({
    reloadAsync: async () => { reloads.push('reload'); throw new Error('keep tree mounted for remount'); },
  });
  let fail = true;
  const Probe = () => {
    if (fail) throw new Error('bad row');
    return React.createElement('Ready', null, 'ready');
  };
  const errors: unknown[] = [];
  const onError = (error: unknown) => { errors.push(error); };
  const previous = console.error;
  console.error = () => {};
  let tree: any;
  try {
    await act(() => {
      tree = create(React.createElement(api.AppErrorBoundary, null, React.createElement(Probe)));
    });
  } catch (error) {
    onError(error);
  } finally {
    console.error = previous;
  }
  assert.equal(errors.length, 0, 'the boundary must swallow the render error');
  assert.match(textOf(tree), /Something unexpected happened/);
  assert.match(textOf(tree), /still saved on this iPhone/);
  assert.match(textOf(tree), /JD/);
  const button = tree.root.findByProps({ testID: 'app-error-reload' });
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.accessibilityLabel, 'Reload JourneyDeck');
  fail = false;
  await act(() => button.props.onPress());
  assert.equal(reloads.length, 1);
  assert.match(JSON.stringify(tree.toJSON()), /ready/);
});
