import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as catalog from '../src/app-icon-catalog.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);

test('native icon switching restores, handles every choice and survives a preference write failure', async () => {
  let stored = 'original', nativeName: string | null = 'JourneyDeckRosewater', control: any;
  let storageFails = false, nativeFails = false, mounts = 0;
  const requests: (string | null)[] = [];
  const module = { exports: {} as any };
  const status = () => ({ nativeModuleAvailable: true, supported: true, iconName: nativeName });
  const mocks: Record<string, any> = {
    './app-icon-catalog': catalog,
    'expo-secure-store': { getItem: () => stored, setItem: (_key: string, value: string) => { if (storageFails) throw Error('keychain unavailable'); stored = value; } },
    '../modules/journeydeck-app-icon': {
      getAppIconStatus: async () => status(),
      setNativeAppIcon: async (name: string | null) => {
        requests.push(name);
        if (nativeFails) throw Error('iOS rejected icon');
        nativeName = name; return status();
      },
    },
  };
  const code = ts.transpileModule(readFileSync(new URL('../src/app-icon-preference.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  function Content() { control = module.exports.useAppIconChoice(); React.useEffect(() => { mounts++; }, []); return null; }
  let tree: any;
  try {
    await act(async () => { tree = create(React.createElement(module.exports.AppIconProvider, null, React.createElement(Content))); });
    assert.equal(control.appIconId, 'rosewater', 'iOS takes precedence over stale saved choice');
    assert.equal(stored, 'rosewater');
    for (const id of ['grand-touring', 'warm-ivory', 'original', 'rosewater'] as const) {
      await act(async () => { await control.setAppIcon(id); });
      assert.equal(control.appIconId, id); assert.equal(stored, id);
      assert.equal(nativeName, catalog.appIconCatalog[id].nativeName);
    }
    assert.equal(mounts, 1, 'icon changes must not remount recorder content');
    nativeFails = true;
    await act(async () => { await assert.rejects(control.setAppIcon('original'), /iOS rejected/); });
    assert.equal(control.appIconId, 'rosewater'); assert.equal(control.changing, false);
    nativeFails = false; storageFails = true;
    const before = requests.length;
    await act(async () => { await Promise.all([control.setAppIcon('warm-ivory'), control.setAppIcon('grand-touring')]); });
    assert.equal(requests.length, before + 1, 'rapid taps cannot overlap native icon changes');
    assert.equal(control.appIconId, 'warm-ivory', 'a storage failure cannot misreport the applied native icon');
    assert.equal(control.changing, false);
  } finally { await act(async () => tree?.unmount()); }
});
