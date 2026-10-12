import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/location-task.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function location(timestamp: number, latitude = 32.7555) {
  return { timestamp, coords: { latitude, longitude: -97.3308, accuracy: 5, altitude: null, heading: null, speed: 8 } };
}

function fixture(options: {
  prepareFails?: number;
  recordFails?: number;
  sessionId?: string | null;
  inserted?: number;
  musicThrows?: boolean;
} = {}) {
  const events: Array<{ name: string; attributes: Record<string, unknown> }> = [];
  const recorded: Array<ReturnType<typeof location>[]> = [];
  let prepareAttempts = 0;
  let recordAttempts = 0;
  let sessionId = options.sessionId === undefined ? 'recording_manual' : options.sessionId;
  let prepareFails = options.prepareFails ?? 0;
  let recordFails = options.recordFails ?? 0;
  const dependencies: Record<string, unknown> = {
    'expo-task-manager': { defineTask() {} },
    './music-capture': {
      sampleAppleMusicForActiveSession: async () => {
        if (options.musicThrows) throw new Error('music_unavailable');
      },
    },
    './manual-recording-failsafe-runtime': {
      evaluateCurrentManualRecordingFailsafe: () => ({
        sessionId: sessionId ?? 'recording_manual',
        decision: { shouldFinish: false },
      }),
      finishManualRecordingForFailsafe: async () => false,
    },
    './storage': {
      activeSession: () => (sessionId ? { id: sessionId, status: 'recording' } : null),
      recordLocations: (batch: ReturnType<typeof location>[]) => {
        recordAttempts += 1;
        if (recordAttempts <= recordFails) throw new Error('JourneyDeck recorder queue failed SQLite quick_check.');
        recorded.push(batch);
        return options.inserted ?? batch.length;
      },
    },
    './tracking': { LOCATION_TASK_NAME: 'journeydeck-recorder-location-v1', stopLocationTracking: async () => {} },
    '../modules/journeydeck-recorder': {
      isNativeAutomaticSession: (id?: string) => Boolean(id?.startsWith('native_recording_')),
    },
    './native-recorder-inbox': { syncNativeRecorderInbox: async () => {} },
    './observability': {
      observeJourneyDeckEvent: (name: string, attributes: Record<string, unknown> = {}) => {
        events.push({ name, attributes });
      },
    },
    './database-startup': {
      prepareJourneyDeckDatabase: async () => {
        prepareAttempts += 1;
        if (prepareAttempts <= prepareFails) throw new Error('database is locked');
      },
      retryJourneyDeckDatabase: async () => {
        prepareAttempts += 1;
        if (prepareAttempts <= prepareFails) throw new Error('database is locked');
      },
    },
  };
  const exports: Record<string, { runLocationTask: (event: { data?: { locations?: ReturnType<typeof location>[] }; error?: unknown }) => Promise<void> }> = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return {
    run: exports.runLocationTask,
    events,
    recorded,
    prepareAttempts: () => prepareAttempts,
    recordAttempts: () => recordAttempts,
    setSessionId: (id: string | null) => { sessionId = id; },
    setPrepareFails: (count: number) => { prepareFails = count; prepareAttempts = 0; },
  };
}

test('a recorder write failure is retried immediately so the tick is not dropped', async () => {
  const h = fixture({ recordFails: 1 });
  const batch = [location(1_000), location(2_000)];
  await h.run({ data: { locations: batch } });
  assert.equal(h.recordAttempts(), 2);
  assert.deepEqual(h.recorded, [batch]);
  assert.equal(h.events.length, 0);
});

test('a persistent recorder write failure is logged, buffered, and flushed on the next healthy tick', async () => {
  const h = fixture({ recordFails: 2 });
  const first = [location(1_000), location(2_000)];
  const second = [location(3_000)];
  await assert.doesNotReject(() => h.run({ data: { locations: first } }));
  assert.equal(h.recorded.length, 0);
  assert.equal(h.events.at(-1)?.name, 'recorder.completion_failed');
  assert.equal(h.events.at(-1)?.attributes.stage, 'record_locations');
  assert.equal(h.events.at(-1)?.attributes.buffered, 1);
  assert.equal(h.events.at(-1)?.attributes.point_count, 2);
  await h.run({ data: { locations: second } });
  assert.equal(h.recorded.length, 1);
  assert.deepEqual(h.recorded[0].map(point => point.timestamp), [1_000, 2_000, 3_000]);
});

test('a failed database startup is retried before the GPS batch is abandoned', async () => {
  const h = fixture({ prepareFails: 1 });
  const batch = [location(4_000)];
  await h.run({ data: { locations: batch } });
  assert.equal(h.prepareAttempts(), 2);
  assert.deepEqual(h.recorded, [batch]);
  assert.equal(h.events.length, 0);
});

test('startup that stays down buffers the tick and flushes it after the database recovers', async () => {
  const h = fixture({ prepareFails: 4 });
  const first = [location(5_000)];
  const second = [location(6_000)];
  await assert.doesNotReject(() => h.run({ data: { locations: first } }));
  assert.equal(h.recorded.length, 0);
  assert.equal(h.events.at(-1)?.attributes.stage, 'database_startup');
  assert.equal(h.events.at(-1)?.attributes.buffered, 1);
  h.setPrepareFails(0);
  await h.run({ data: { locations: second } });
  assert.deepEqual(h.recorded[0].map(point => point.timestamp), [5_000, 6_000]);
});

test('native automatic sessions do not persist Expo GPS and discard a stale write buffer', async () => {
  const h = fixture({ recordFails: 2, sessionId: 'recording_manual' });
  await h.run({ data: { locations: [location(7_000)] } });
  assert.equal(h.recorded.length, 0);
  h.setSessionId('native_recording_1');
  await h.run({ data: { locations: [location(8_000)] } });
  assert.equal(h.recorded.length, 0);
  h.setSessionId('recording_manual');
  await h.run({ data: { locations: [location(9_000)] } });
  assert.deepEqual(h.recorded[0]?.map(point => point.timestamp), [9_000]);
});

test('a music failure after a successful write does not re-buffer the persisted points', async () => {
  const h = fixture({ musicThrows: true });
  const batch = [location(10_000)];
  await assert.doesNotReject(() => h.run({ data: { locations: batch } }));
  assert.deepEqual(h.recorded, [batch]);
  await h.run({ data: { locations: [location(11_000)] } });
  assert.deepEqual(h.recorded[1]?.map(point => point.timestamp), [11_000]);
});

test('an empty or error tick leaves the write path untouched', async () => {
  const h = fixture();
  await h.run({ error: new Error('location') });
  await h.run({ data: { locations: [] } });
  await h.run({});
  assert.equal(h.recordAttempts(), 0);
  assert.equal(h.prepareAttempts(), 0);
});
