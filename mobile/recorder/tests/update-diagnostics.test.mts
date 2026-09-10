import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUpdateLogs, redactUpdateLog } from '../src/update-diagnostics-format.ts';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { formatThemeAnimationDiagnostics, retainThemeAnimationDiagnostics } from '../src/theme-animation-diagnostics-format.ts';

test('update reports redact common private values but retain the error and update UUID', () => {
  const result = redactUpdateLog('TypeError 01a078a6-7df7-7d98-9c64-da8be97459ea https://example.com/?token=abc Bearer xyz user@example.com 32.123456 -97.654321 token=abc /private/var/user/file');
  assert.match(result, /TypeError 01a078a6/);
  for (const secret of ['example.com', 'xyz', '32.123456', '-97.654321', 'abc', '/private/var']) assert.ok(!result.includes(secret));
});
test('errors survive noisy info logs and formatting does not reorder the input', () => {
  const error = { timestamp: 1, level: 'error', code: 'JSRuntimeError', message: 'TypeError: undefined is not a function' };
  const logs = [error, ...Array.from({ length: 100 }, (_, i) => ({ timestamp: i + 2, level: 'info', code: 'None', message: 'info' }))];
  const report = formatUpdateLogs(logs);
  assert.match(report.split('\n')[0], /error JSRuntimeError/);
  assert.equal(logs[0], error);
  assert.ok(report.length <= 60000);
});
test('empty native logs are reported explicitly', () => assert.match(formatUpdateLogs([]), /No Expo update log entries/));

test('quoted credentials cannot leak through JSON or multiword error values', () => {
  const report = redactUpdateLog(`{"token": "private token value", "password":"another private value"} authorization='Bearer private-value'`);
  assert.doesNotMatch(report, /private|another/);
});

test('theme animation breadcrumbs reject private values, expire, and stay bounded', () => {
  const now = Date.now();
  const entries = Array.from({ length: 100 }, (_, index) => ({
    at: new Date(now - index * 10).toISOString(), event: 'capture_complete', attempt: index,
    details: { theme: 'light', path: '/private/var/mobile/secret.png', coordinate: 32.123456, allowed: true },
  }));
  const retained = retainThemeAnimationDiagnostics(entries, now);
  assert.equal(retained.length, 80);
  const report = formatThemeAnimationDiagnostics(entries, now);
  assert.match(report, /capture_complete/);
  assert.match(report, /theme=light/);
  assert.doesNotMatch(report, /private|secret|32\.123456/);
  assert.match(formatThemeAnimationDiagnostics([{ ...entries[0], at: new Date(now - 86400001).toISOString() }], now), /No theme animation events/);
});

test('diagnostics only reads on request, shares explicitly, and handles native read failure', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let reads = 0; let shares = 0; let fail = false;
  const require = createRequire(import.meta.url);
  const module = { exports: {} as any };
  const updates = { useUpdates: () => ({ downloadedUpdate: { updateId: 'pending' } }),
    updateId: 'running', runtimeVersion: '2.0.0-watch.1', channel: 'production', isEmbeddedLaunch: false, isEmergencyLaunch: false,
    readLogEntriesAsync: async (age: number) => { reads++; assert.equal(age, 86400000); if (fail) throw new Error('native read unavailable'); return []; } };
  const mocks: Record<string, any> = {
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', Share: { share: async () => { shares++; } } },
    'expo-updates': updates, './app-theme': { useAppTheme: () => ({ color: (c: string) => c }) },
    './update-diagnostics-format': { formatUpdateLogs, redactUpdateLog },
    './startup-diagnostics': { readStartupFailure: () => 'Last fatal JavaScript error: test failure' },
    './theme-animation-diagnostics': { readThemeAnimationDiagnostics: () => 'Theme animation diagnostics\nrequest capture_start overlay_ready' },
  };
  const code = ts.transpileModule(readFileSync(new URL('../src/update-diagnostics.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  let tree: any;
  await act(async () => { tree = create(React.createElement(module.exports.UpdateDiagnostics)); });
  assert.equal(reads, 0); assert.equal(shares, 0);
  await act(async () => { tree.root.findAllByType('Pressable')[0].props.onPress(); });
  assert.equal(reads, 1); assert.equal(shares, 0);
  assert.match(JSON.stringify(tree.toJSON()), /Running: running/);
  assert.match(JSON.stringify(tree.toJSON()), /Last fatal JavaScript error: test failure/);
  assert.match(JSON.stringify(tree.toJSON()), /capture_start overlay_ready/);
  await act(async () => { tree.root.findAllByType('Pressable')[1].props.onPress(); });
  assert.equal(shares, 1);
  fail = true;
  await act(async () => { tree.root.findAllByType('Pressable')[0].props.onPress(); });
  assert.match(JSON.stringify(tree.toJSON()), /native read unavailable/);
  await act(async () => tree.unmount());
});
