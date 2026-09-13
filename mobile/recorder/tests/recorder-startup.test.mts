import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { decideRecovery } from '../src/recovery.ts';
import { updateRecorderClock, recorderDurationLabel, type RecorderClock } from '../src/recorder-clock.ts';
import { waitForRecorderResponse } from '../src/recorder-response.ts';
import { recorderRefreshMayPublish } from '../src/recorder-status-events.ts';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const refreshSource = app.slice(app.indexOf('  const refresh = useCallback('), app.indexOf('  useEffect(() => subscribeRecordingMode'));
function recorderHarness({ native = false, permission = true, task = false, precise = true, reliable = true, hangStatus = false } = {}) {
  const epoch = { current: 0 };
  const state = {
    session: { id: native ? 'native_recording_manual_test' : 'legacy-test', status: 'recording', startedAt: new Date(Date.now() - 60_000).toISOString(), endedAt: null },
    native: { nativeModuleAvailable: native, statusReliable: reliable, recording: native, preciseTracking: precise, sessionId: native ? 'native_recording_manual_test' : null, paused: false, lastErrorCode: null },
    task, tracking: false, resumed: [] as string[], paused: [] as string[], notices: [] as string[],
    clock: null as RecorderClock | null,
    hangStatus,
    profileId: 'test-owner',
    beforeConfigure: null as (() => void) | null,
    eventStreamId: undefined as string | undefined,
  };
  const exports: any = {};
  const pause = async (id: string) => { state.paused.push(id); state.native.paused = true; state.native.recording = false; state.native.preciseTracking = false; return state.native; };
  vm.runInNewContext(ts.transpileModule(refreshSource + '\nexports.refresh = refresh;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, useCallback: (fn: any) => fn, refreshPending: { current: null }, runExclusive: (fn: any) => fn(), connection: null,
    statusEventEpoch: epoch, statusEventState: { current: null }, recorderRefreshMayPublish,
    waitForRecorderResponse: (response: Promise<any>, code: string) => waitForRecorderResponse(response, code, hangStatus ? 1 : 10_000),
    initializeDatabase: () => {}, Location: { getForegroundPermissionsAsync: async () => ({ status: permission ? 'granted' : 'denied' }), getBackgroundPermissionsAsync: async () => ({ status: permission ? 'granted' : 'denied' }) },
    TaskManager: { isAvailableAsync: async () => true }, isLocationTrackingActive: async () => state.task, isAutomaticDetectionActive: async () => false,
    getNativeAutomaticRecorderStatus: async () => state.hangStatus ? new Promise(() => {}) : { ...state.native, eventStreamId: state.eventStreamId },
    syncNativeRecorderInbox: async () => {}, configureNativeManualRecorder: async () => { state.beforeConfigure?.(); },
    activeSession: () => state.session, getCurrentUser: () => ({ id: state.profileId }), isNativeAutomaticSession: (id: string) => id?.startsWith('native_recording_'),
    startLocationTracking: async () => { state.task = true; return true; }, stopLocationTracking: async () => { state.task = false; },
    evaluateCurrentManualRecordingFailsafe: () => ({ decision: { shouldFinish: false } }), decideRecovery,
    pauseNativeAutomaticJourney: pause, resumeNativeAutomaticJourney: async (id: string) => { state.resumed.push(id); state.native.recording = true; state.native.preciseTracking = true; return state.native; },
    setLocalStatus: (_id: string, status: string) => { state.session.status = status; }, observeJourneyDeckEvent: () => {}, captureCurrentPoint: async () => {}, sampleAppleMusicForActiveSession: async () => {},
    getLiveRecorderSnapshot: () => ({ session: state.session, route: [], lastPoint: null }), getSessionSummary: () => state.session,
    routeDistanceMiles: () => 0, updateRecorderClock,
    setRecorderClock: (update: (clock: RecorderClock | null) => RecorderClock | null) => { state.clock = update(state.clock); },
    setSummary: () => {}, setDistanceMiles: () => {}, setForegroundPermission: () => {}, setBackgroundPermission: () => {}, setTaskAvailable: () => {},
    setTrackingActive: (value: boolean) => { state.tracking = value; }, setAutomaticDetectionActive: () => {}, setNotice: (value: string) => state.notices.push(value),
    NATIVE_AUTOMATIC_RECORDER_ENABLED: false, loadAutomaticDriveEvent: () => null, announcedAutomaticEvent: { current: '' },
  });
  return { state, epoch, refresh: exports.refresh };
}

test('revoked location permission pauses the durable legacy session even if iOS already stopped its task', async () => {
  const h = recorderHarness({ permission: false }); await h.refresh();
  assert.equal(h.state.session.status, 'paused'); assert.equal(h.state.task, false);
});

test('native recording is only shown as tracking when GPS is actually running', async () => {
  const h = recorderHarness({ native: true, precise: false }); await h.refresh();
  assert.deepEqual(h.state.resumed, [h.state.session.id]); assert.equal(h.state.tracking, true);
});

test('consolidated native recovery never synthesizes Resume from a stale JS mirror', async () => {
  const h = recorderHarness({ native: true, precise: false });
  h.state.eventStreamId = 'native-stream';
  await h.refresh();
  assert.deepEqual(h.state.resumed, []);
  assert.equal(h.state.tracking, false);
});

test('a fresh native Pause is authoritative even before the JS inbox mirror catches up', async () => {
  const h = recorderHarness({ native: true, precise: false });
  h.state.native.recording = false;
  h.state.native.paused = true;
  await h.refresh();
  assert.deepEqual(h.state.resumed, []);
  assert.equal(h.state.tracking, false);
});

test('an event during refresh cancels stale recovery commands and cannot restart a frozen clock', async () => {
  const h = recorderHarness({ native: true, precise: false });
  h.state.beforeConfigure = () => {
    h.epoch.current += 1;
    h.state.native.recording = false;
    h.state.native.paused = true;
    h.state.tracking = false;
    h.state.clock = updateRecorderClock(h.state.clock, h.state.session, false, Date.now());
  };
  await h.refresh();
  assert.deepEqual(h.state.resumed, []);
  assert.deepEqual(h.state.paused, []);
  assert.equal(h.state.clock?.running, false);
});

test('profile change during refresh cancels commands for the old journey', async () => {
  const h = recorderHarness({ native: true, precise: false });
  h.state.beforeConfigure = () => { h.state.profileId = 'new-owner'; };
  await h.refresh();
  assert.deepEqual(h.state.resumed, []);
  assert.deepEqual(h.state.paused, []);
});

test('an unreadable native snapshot cannot trigger pause or resume of an unknown journey', async () => {
  const h = recorderHarness({ native: true, reliable: false, precise: false }); await h.refresh();
  assert.deepEqual(h.state.resumed, []); assert.deepEqual(h.state.paused, []); assert.equal(h.state.tracking, false);
});

test('a new Watch journey cannot be changed by recovery for an older JS mirror', async () => {
  const h = recorderHarness({ native: true, precise: false }); h.state.native.sessionId = 'native_recording_manual_new';
  await h.refresh(); assert.deepEqual(h.state.resumed, []); assert.deepEqual(h.state.paused, []); assert.equal(h.state.tracking, false);
});

test('refresh freezes a native-completed journey clock while the inbox mirror still says recording', async () => {
  const h = recorderHarness({ native: true });
  await h.refresh();
  assert.equal(h.state.clock?.running, true);
  h.state.native.sessionId = null;
  h.state.native.recording = false;
  h.state.native.preciseTracking = false;
  await h.refresh();
  assert.equal(h.state.clock?.running, false);
  const now = Date.now();
  assert.equal(recorderDurationLabel(h.state.session, h.state.clock, now),
    recorderDurationLabel(h.state.session, h.state.clock, now + 600_000));
  assert.deepEqual(h.state.resumed, []);
});

test('a missing native status response releases refresh for a later confirmed read without resuming blindly', async () => {
  const h = recorderHarness({ native: true, hangStatus: true });
  await h.refresh();
  assert.equal(h.state.tracking, false); assert.equal(h.state.clock?.running, false);
  assert.deepEqual(h.state.resumed, []);
  h.state.hangStatus = false;
  await h.refresh();
  assert.equal(h.state.tracking, true); assert.equal(h.state.clock?.running, true);
});

test('credential initialization retries a locked Keychain on foreground and stops after unmount', async () => {
  const tree = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effectSource = '';
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes('loadOrCreateDeviceId()')) effectSource = node.arguments[0].getText(tree);
    ts.forEachChild(node, walk);
  };
  walk(tree); assert.ok(effectSource);
  const events = new Set<(value: string) => void>(), ids: string[] = [], notices: string[] = [];
  let fail = true, attempts = 0;
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(`exports.effect = ${effectSource}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, loadOrCreateDeviceId: async () => { attempts++; if (fail) throw Error('locked'); return 'durable-device'; }, loadConnection: async () => null,
    setDeviceId: (id: string) => ids.push(id), setConnection: () => {}, setServerUrl: () => {}, setNotice: (notice: string) => notices.push(notice),
    AppState: { addEventListener: (_: string, fn: (value: string) => void) => { events.add(fn); return { remove: () => events.delete(fn) }; } },
  });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const cleanup = exports.effect(); await flush();
  assert.equal(ids.length, 0); assert.equal(notices.length, 1);
  fail = false; for (const event of events) event('active'); await flush();
  assert.deepEqual(ids, ['durable-device']);
  for (const event of events) event('active'); await flush(); assert.equal(attempts, 2);
  cleanup(); assert.equal(events.size, 0);
});
