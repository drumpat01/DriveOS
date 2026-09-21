import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file: string, mocks: Record<string, any>) {
  const module = { exports: {} as any };
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: (name: string) => name in mocks ? mocks[name] : require(name) });
  return module.exports;
}

test('the share prompt remembers the last journey it was shown for, per profile', () => {
  const stored = new Map<string, unknown>();
  const api = load('share-prompt.ts', {
    './auth': { getCurrentUser: () => ({ id: 'driver-1' }) },
    './local-store': {
      getPrivatePreference: (userId: string, key: string) => stored.get(`${userId}:${key}`) ?? null,
      upsertPrivatePreference: (userId: string, key: string, value: unknown) => { stored.set(`${userId}:${key}`, value); },
    },
  });
  assert.equal(api.lastPromptedShareJourneyId(), null, 'a fresh profile has never been prompted');
  api.markShareJourneyPrompted('journey-1');
  assert.equal(api.lastPromptedShareJourneyId(), 'journey-1');
  api.markShareJourneyPrompted('journey-2');
  assert.equal(api.lastPromptedShareJourneyId(), 'journey-2', 'a newer journey replaces the remembered one');
});
