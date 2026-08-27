import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const primarySections = await readFile(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');

test('Data Health identifies the exact native, runtime, and OTA release under test', () => {
  assert.equal(appConfig.expo.extra.release.sequence, 'P3.3');
  assert.match(appConfig.expo.extra.release.label, /music independence/i);
  assert.match(primarySections, /Updates\.useUpdates\(\)/);
  assert.match(primarySections, /Live Metro/);
  assert.match(primarySections, /Published OTA/);
  assert.match(primarySections, /Embedded build/);
  assert.match(primarySections, /UPDATE ID/);
  assert.match(primarySections, /native build/);
  assert.match(primarySections, /Use the release label and short Update ID/);
});
