import { randomUUID } from 'node:crypto';
import { createRecorderCommands } from '../modules/journeydeck-recorder/src/RecorderCommands.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createLatestNativeRecorderConfiguration } from '../modules/journeydeck-recorder/src/LatestNativeRecorderConfiguration.ts';
import { subscribeRecorderStatusEvents } from '../modules/journeydeck-recorder/src/RecorderStatusEvents.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync(new URL('../modules/journeydeck-recorder/index.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const status = { nativeModuleAvailable: true, statusReliable: true, configured: true,
  enabled: false, significantMonitoring: false, preciseTracking: false, recording: false,
  paused: true, sessionId: 'native_recording_manual_current', authorization: 'always',
  lastEvent: null, lastEventAt: null, lastErrorCode: null };

function controls(native: any) {
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    if (name === 'expo-crypto') return { randomUUID };
    if (name === './src/RecorderCommands') return { createRecorderCommands };
    if (name === './src/JourneyDeckRecorderModule') return { __esModule: true, default: native };
    if (name === './src/LatestNativeRecorderConfiguration') return { createLatestNativeRecorderConfiguration };
    if (name === './src/RecorderStatusEvents') return { subscribeRecorderStatusEvents };
    if (name === './src/JourneyDeckDisplayLayoutObserver') return {};
    throw new Error(`unexpected dependency: ${name}`);
  } });
  return exports;
}

test('journal-capable binaries route Start/Pause/Resume/Finish through durable operation IDs', async () => {
  const calls: { id: string; action: string; session: string }[] = [];
  const api = controls({
    getStatusAsync: async () => ({ ...status, controlToken: 'fixture-token' }),
    executeCommandAsync: async (id: string, action: string, session: string, token: string) => {
      assert.equal(token, 'fixture-token'); calls.push({ id, action, session });
      return { ...status, command: { state: 'applied', operationId: id } };
    },
    getCommandOutcomeAsync: async () => ({ state: 'unknown' }),
    startManualJourneyAsync: () => assert.fail('bypassed journal'),
    pauseJourneyIfMatchingAsync: () => assert.fail('bypassed journal'),
    resumeJourneyIfMatchingAsync: () => assert.fail('bypassed journal'),
    finishJourneyIfMatchingAsync: () => assert.fail('bypassed journal'),
  });
  await api.startNativeManualJourney('start-operation');
  await api.pauseNativeAutomaticJourney(status.sessionId);
  await api.resumeNativeAutomaticJourney(status.sessionId);
  await api.finishNativeAutomaticJourney(status.sessionId);
  assert.deepEqual(calls.map(c => c.action), ['start', 'pause', 'resume', 'finish']);
  assert.equal(calls[0].id, 'start-operation');
  assert.equal(new Set(calls.map(c => c.id)).size, 4);
  assert.ok(calls.slice(1).every(c => c.session === status.sessionId));
});

test('new binaries receive the requested journey ID in both native pause and resume commands', async () => {
  const calls: string[] = [];
  const api = controls({
    pauseJourneyIfMatchingAsync: async (id: string) => { calls.push(`pause:${id}`); return status; },
    resumeJourneyIfMatchingAsync: async (id: string) => { calls.push(`resume:${id}`); return status; },
    pauseActiveJourneyAsync: () => assert.fail('must use native atomic ownership fence'),
    resumeActiveJourneyAsync: () => assert.fail('must use native atomic ownership fence'),
  });
  await api.pauseNativeAutomaticJourney(status.sessionId);
  await api.resumeNativeAutomaticJourney(status.sessionId);
  assert.deepEqual(calls, [`pause:${status.sessionId}`, `resume:${status.sessionId}`]);
});

test('older binaries do not apply a stale phone control to a newer Watch journey', async () => {
  const api = controls({ getStatusAsync: async () => status,
    pauseActiveJourneyAsync: () => assert.fail('stale pause changed a newer journey'),
    resumeActiveJourneyAsync: () => assert.fail('stale resume changed a newer journey'),
  });
  assert.equal((await api.pauseNativeAutomaticJourney('native_recording_manual_old')).lastErrorCode, 'session_changed');
  assert.equal((await api.resumeNativeAutomaticJourney('native_recording_manual_old')).lastErrorCode, 'session_changed');
});

test('older binary Finish refuses a stale journey ID or an unreadable status', async () => {
  for (const current of [status, { ...status, statusReliable: false, sessionId: 'native_recording_manual_old' }]) {
    const api = controls({ getStatusAsync: async () => current,
      finishActiveJourneyAsync: () => assert.fail('stale Finish stopped an unconfirmed journey') });
    assert.ok((await api.finishNativeAutomaticJourney('native_recording_manual_old')).lastErrorCode);
  }
});

test('Finish uses the native identity fence when present and preserves a matching older binary', async () => {
  const calls: string[] = [];
  const fenced = controls({ finishJourneyIfMatchingAsync: async (id: string) => { calls.push(id); return status; } });
  await fenced.finishNativeAutomaticJourney(status.sessionId);
  const older = controls({ getStatusAsync: async () => status,
    finishActiveJourneyAsync: async () => { calls.push('legacy'); return { ...status, sessionId: null, paused: false }; } });
  assert.equal((await older.finishNativeAutomaticJourney(status.sessionId)).sessionId, null);
  assert.deepEqual(calls, [status.sessionId, 'legacy']);
});

test('unreadable native state or revoked location access does not resume a paused journey', async () => {
  for (const override of [{ statusReliable: false }, { authorization: 'denied' }]) {
    const api = controls({ getStatusAsync: async () => ({ ...status, ...override }),
      resumeActiveJourneyAsync: () => assert.fail('unconfirmed recorder was resumed'),
    });
    assert.ok((await api.resumeNativeAutomaticJourney(status.sessionId)).lastErrorCode);
  }
});

test('older binaries retain working pause and resume when the current journey is confirmed', async () => {
  const calls: string[] = [];
  const api = controls({ getStatusAsync: async () => status,
    pauseActiveJourneyAsync: async () => { calls.push('pause'); return status; },
    resumeActiveJourneyAsync: async () => { calls.push('resume'); return { ...status, recording: true, paused: false }; },
  });
  assert.equal((await api.pauseNativeAutomaticJourney(status.sessionId)).paused, true);
  assert.equal((await api.resumeNativeAutomaticJourney(status.sessionId)).recording, true);
  assert.deepEqual(calls, ['pause', 'resume']);
});

test('missing recorder module returns explicitly unreliable control state', async () => {
  const api = controls(null);
  assert.equal((await api.getNativeAutomaticRecorderStatus()).statusReliable, false);
  assert.equal((await api.pauseNativeAutomaticJourney(status.sessionId)).nativeModuleAvailable, false);
});

test('the active master mirror is requested first when a native inbox contains many finished journeys', async () => {
  const api = controls({ exportInboxForSessionAsync: async (cursors: Record<string, number>, id: string) => {
    assert.equal(id, status.sessionId);
    assert.equal(cursors[id], 12);
    return { sessions: [], errorCode: null };
  }, exportInboxAsync: () => assert.fail('must prioritize the still-active mirror') });
  assert.equal((await api.exportNativeRecorderInbox({ [status.sessionId]: 12 }, status.sessionId)).errorCode, null);
});

test('the native export SQL retains the requested mirror within the twenty-session page and isolates owners', () => {
  const swift = readFileSync(new URL('../modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift', import.meta.url), 'utf8');
  const sql = swift.match(/SELECT id,owner_user_id,device_id,status,started_at,ended_at,next_sequence,created_at,updated_at\s+FROM native_recording_sessions[\s\S]+?LIMIT 20;/)?.[0];
  assert.ok(sql, 'test must execute the query used by the Swift exporter');
  const database = new DatabaseSync(':memory:');
  try {
    database.exec('CREATE TABLE native_recording_sessions(id TEXT PRIMARY KEY,owner_user_id TEXT,device_id TEXT,status TEXT,started_at TEXT,ended_at TEXT,next_sequence INTEGER,created_at TEXT,updated_at TEXT)');
    const insert = database.prepare('INSERT INTO native_recording_sessions VALUES(?,?,?,?,?,?,0,?,?)');
    for (let i = 0; i < 25; i += 1) insert.run(`old-${i}`, 'owner', 'phone', 'completed', 'start', 'end', String(i).padStart(2, '0'), 'update');
    insert.run('wanted', 'owner', 'phone', 'completed', 'start', 'end', '99', 'update');
    insert.run('foreign', 'other', 'phone', 'recording', 'start', null, '00', 'update');
    const rows = database.prepare(sql).all('owner', 'wanted');
    assert.equal(rows.length, 20);
    assert.equal(rows[0].id, 'wanted');
    assert.ok(rows.every(row => row.owner_user_id === 'owner'));
  } finally { database.close(); }
});
