import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as recorder from '../src/startup-error-recorder.ts';

test('boot diagnostics survives reopening, records locally and chains the fatal handler', () => {
  let persisted: string | null = null, forwarded = 0;
  let handler = (_error: Error, _fatal?: boolean) => { forwarded++; };
  class File {
    constructor(root: string, name: string) { assert.equal(root, 'cache'); assert.equal(name, 'journeydeck-last-js-failure.json'); }
    get exists() { return persisted !== null; }
    get size() { return persisted?.length ?? 0; }
    write(value: string) { persisted = value; }
    textSync() { return persisted!; }
    delete() { persisted = null; }
  }
  const code = ts.transpileModule(readFileSync(new URL('../src/startup-diagnostics.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const load = () => {
    const module = { exports: {} as any };
    vm.runInNewContext(code, { module, exports: module.exports,
      ErrorUtils: { getGlobalHandler: () => handler, setGlobalHandler: (next: typeof handler) => { handler = next; } },
      require: (id: string) => {
        if (id === 'expo-file-system') return { File, Paths: { cache: 'cache' } };
        if (id === './startup-error-recorder') return recorder;
        if (id === 'expo-updates') return { runtimeVersion: '2.0.0-watch.2', updateId: 'update-under-test', isEmbeddedLaunch: false };
        throw Error(`Unexpected module: ${id}`);
      },
    });
    return module.exports;
  };
  const first = load();
  assert.equal(persisted, null, 'ordinary launches do not create diagnostic files');
  handler(new TypeError('boot module failed'), true);
  assert.equal(forwarded, 1);
  assert.match(first.readStartupFailure(), /boot module failed/);
  handler = () => { forwarded++; }; // A new JS runtime; disk survives.
  const reopened = load();
  assert.match(reopened.readStartupFailure(), /update-under-test/);
  persisted = JSON.stringify({ captured: '2020-01-01', context: 'old', error: 'old' });
  assert.match(reopened.readStartupFailure(), /No recent/);
  assert.equal(persisted, null);
  persisted = 'invalid json';
  assert.match(reopened.readStartupFailure(), /Could not read/);
  const entry = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
  assert.ok(entry.indexOf("import './src/startup-diagnostics'") < entry.indexOf("import './src/location-task'"));
});
