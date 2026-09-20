import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as formatApi from '../src/theme-animation-diagnostics-format.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/theme-animation-diagnostics.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness() {
  let contents = '';
  let writes = 0;
  const timers = new Map<number, () => void>();
  let timerId = 0;
  class FakeFile {
    get exists() { return contents.length > 0; }
    get size() { return contents.length; }
    textSync() { return contents; }
    write(value: string) { writes += 1; contents = value; }
  }
  const module = { exports: {} as any };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id: string) => {
      if (id === 'expo-file-system') return { File: FakeFile, Paths: { cache: '/cache' } };
      if (id === './theme-animation-diagnostics-format') return formatApi;
      return require(id);
    },
    Date,
    JSON,
    Set,
    setTimeout: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: (id: number) => timers.delete(id),
  });
  return {
    api: module.exports,
    timers,
    get writes() { return writes; },
    entries: () => contents ? JSON.parse(contents) : [],
  };
}

test('theme breadcrumbs batch filesystem work until a terminal lifecycle event', () => {
  const h = harness();
  h.api.recordThemeAnimationEvent('request', 1, { theme: 'light' });
  h.api.recordThemeAnimationEvent('capture_start', 1);
  h.api.recordThemeAnimationEvent('water_started', 1, { duration_ms: 1180 });
  assert.equal(h.writes, 0, 'animation setup must not repeatedly perform synchronous file I/O');
  assert.equal(h.timers.size, 1, 'one deferred flush replaces earlier scheduled work');

  h.api.recordThemeAnimationEvent('water_finished', 1);
  assert.equal(h.writes, 0, 'the completion callback remains free of file I/O until the overlay clears');
  h.api.recordThemeAnimationEvent('overlay_cleared', 1);
  assert.equal(h.writes, 1);
  assert.deepEqual(h.entries().map((entry: any) => entry.event), [
    'request', 'capture_start', 'water_started', 'water_finished', 'overlay_cleared',
  ]);
  assert.equal(h.timers.size, 0);
});

test('reading diagnostics flushes pending breadcrumbs without waiting for the timer', () => {
  const h = harness();
  h.api.recordThemeAnimationEvent('request', 2, { path: '/private/secret.png' });
  const report = h.api.readThemeAnimationDiagnostics();
  assert.equal(h.writes, 1);
  assert.match(report, /attempt=2 request/);
  assert.doesNotMatch(report, /private|secret/);
});
