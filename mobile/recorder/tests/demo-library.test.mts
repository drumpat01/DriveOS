import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const calls: { name: string; input: any; options: any }[] = [];
const store = {
  upsertJourney: (input: any, options: any) => calls.push({ name: 'journey', input, options }),
  upsertMusicEntry: (input: any, options: any) => calls.push({ name: 'music', input, options }),
  upsertMemory: (input: any, options: any) => calls.push({ name: 'memory', input, options }),
  upsertPlace: (input: any) => calls.push({ name: 'place', input, options: {} }),
  insertGpsPoints: (userId: string, journeyId: string, points: any[]) => calls.push({ name: 'gps', input: { userId, journeyId, points }, options: {} }),
  upsertPrivatePreference: (userId: string, key: string, value: unknown, options: any) => calls.push({ name: 'preference', input: { userId, key, value }, options }),
};
const source = readFileSync(new URL('../src/demo-library.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} as any };
vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id === './local-store' ? store : (() => { throw new Error(id); })() });
const demo = module.exports;
const of = (name: string) => calls.filter(call => call.name === name);

test('the sample library writes recorded-looking drives, songs, places and Memories for one profile', () => {
  calls.length = 0;
  demo.seedDemoLibrary('user_demo', Date.UTC(2026, 8, 30, 12));
  assert.equal(of('journey').length, demo.demoJourneyCount());
  assert.ok(of('journey').every(call => call.input.userId === 'user_demo' && call.input.miles > 3 && call.input.durationMinutes > 0));
  assert.ok(of('journey').every(call => call.input.songCount > 0 && call.input.startPlaceId && call.input.endPlaceId));
  assert.equal(of('gps').length, of('journey').length);
  assert.ok(of('gps').every(call => call.input.points.length > 20 && call.input.points.every((point: any, index: number) => point.sequence === index)));
  assert.ok(of('music').length >= of('journey').length * 3);
  assert.equal(of('memory').length, 3);
  for (const memory of of('memory')) assert.ok(JSON.parse(memory.input.journeyIds).length >= 1);
  const ids = new Set(of('journey').map(call => call.input.id));
  assert.ok(of('music').every(call => ids.has(call.input.journeyId)));
});

test('nothing in the sample can upload: every row is written as already synced, and onboarding is skipped', () => {
  calls.length = 0;
  demo.seedDemoLibrary('user_demo', Date.UTC(2026, 8, 30, 12));
  for (const call of [...of('journey'), ...of('music'), ...of('memory'), ...of('preference')]) assert.equal(call.options.syncedToCloud, 1, call.name);
  const keys = of('preference').map(call => call.input.key).sort();
  assert.deepEqual(keys, ['music.capture', 'onboarding.first-run-v2', 'recording.mode']);
  assert.equal(of('preference').find(call => call.input.key === 'onboarding.first-run-v2')!.input.value.stage, 'complete');
});

test('the sample has recent drives for Today and a Memory from a year ago for On this day', () => {
  calls.length = 0;
  const now = Date.UTC(2026, 8, 30, 12);
  demo.seedDemoLibrary('user_demo', now);
  const ages = of('journey').map(call => (now - Date.parse(call.input.startedAt)) / 86_400_000);
  assert.ok(ages.some(age => age < 2), 'a drive from the last two days');
  assert.ok(ages.some(age => age > 360), 'a drive from about a year ago');
});

test('routes are continuous and haversine miles are sane', () => {
  const route = demo.demoRoute([[37.6, -122.5], [37.5, -122.4]]);
  assert.ok(route.length > 20);
  for (let i = 1; i < route.length; i++) assert.ok(demo.haversineMiles(route[i - 1], route[i]) < 0.6, 'no jumps between points');
  assert.ok(Math.abs(demo.haversineMiles([0, 0], [0, 1]) - 69.09) < 0.2);
});
