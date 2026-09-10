import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { decideRecovery } from '../src/recovery.ts';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const refreshSource = app.slice(app.indexOf('  const refresh = useCallback('), app.indexOf('  useEffect(() => subscribeRecordingMode'));
function recorderHarness({ native = false, permission = true, task = false, precise = true, reliable = true } = {}) {
  const state = {
    session: { id: native ? 'native_recording_manual_test' : 'legacy-test', status: 'recording' },
    native: { nativeModuleAvailable: native, statusReliable: reliable, recording: native, preciseTracking: precise, sessionId: native ? 'native_recording_manual_test' : null, paused: false, lastErrorCode: null },
    task, tracking: false, resumed: [] as string[], paused: [] as string[], notices: [] as string[],
  };
  const exports: any = {};
  const pause = async (id: string) => { state.paused.push(id); state.native.paused = true; state.native.recording = false; state.native.preciseTracking = false; return state.native; };
  vm.runInNewContext(ts.transpileModule(refreshSource + '\nexports.refresh = refresh;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, useCallback: (fn: any) => fn, refreshPending: { current: null }, runExclusive: (fn: any) => fn(), connection: null,
    initializeDatabase: () => {}, Location: { getForegroundPermissionsAsync: async () => ({ status: permission ? 'granted' : 'denied' }), getBackgroundPermissionsAsync: async () => ({ status: permission ? 'granted' : 'denied' }) },
    TaskManager: { isAvailableAsync: async () => true }, isLocationTrackingActive: async () => state.task, isAutomaticDetectionActive: async () => false,
    getNativeAutomaticRecorderStatus: async () => state.native, syncNativeRecorderInbox: async () => {}, configureNativeManualRecorder: async () => {},
    activeSession: () => state.session, getCurrentUser: () => ({ id: 'test-owner' }), isNativeAutomaticSession: (id: string) => id?.startsWith('native_recording_'),
    startLocationTracking: async () => { state.task = true; return true; }, stopLocationTracking: async () => { state.task = false; },
    evaluateCurrentManualRecordingFailsafe: () => ({ decision: { shouldFinish: false } }), decideRecovery,
    pauseNativeAutomaticJourney: pause, resumeNativeAutomaticJourney: async (id: string) => { state.resumed.push(id); state.native.recording = true; state.native.preciseTracking = true; return state.native; },
    setLocalStatus: (_id: string, status: string) => { state.session.status = status; }, observeJourneyDeckEvent: () => {}, captureCurrentPoint: async () => {}, sampleAppleMusicForActiveSession: async () => {},
    getLiveRecorderSnapshot: () => ({ session: null }), getSessionSummary: () => state.session,
    setSummary: () => {}, setDistanceMiles: () => {}, setForegroundPermission: () => {}, setBackgroundPermission: () => {}, setTaskAvailable: () => {},
    setTrackingActive: (value: boolean) => { state.tracking = value; }, setAutomaticDetectionActive: () => {}, setNotice: (value: string) => state.notices.push(value),
    NATIVE_AUTOMATIC_RECORDER_ENABLED: false, loadAutomaticDriveEvent: () => null, announcedAutomaticEvent: { current: '' },
  });
  return { state, refresh: exports.refresh };
}

test('revoked location permission pauses the durable legacy session even if iOS already stopped its task', async () => {
  const h = recorderHarness({ permission: false }); await h.refresh();
  assert.equal(h.state.session.status, 'paused'); assert.equal(h.state.task, false);
});

test('native recording is only shown as tracking when GPS is actually running', async () => {
  const h = recorderHarness({ native: true, precise: false }); await h.refresh();
  assert.deepEqual(h.state.resumed, [h.state.session.id]); assert.equal(h.state.tracking, true);
});

test('an unreadable native snapshot cannot trigger pause or resume of an unknown journey', async () => {
  const h = recorderHarness({ native: true, reliable: false, precise: false }); await h.refresh();
  assert.deepEqual(h.state.resumed, []); assert.deepEqual(h.state.paused, []); assert.equal(h.state.tracking, false);
});

test('a new Watch journey cannot be changed by recovery for an older JS mirror', async () => {
  const h = recorderHarness({ native: true, precise: false }); h.state.native.sessionId = 'native_recording_manual_new';
  await h.refresh(); assert.deepEqual(h.state.resumed, []); assert.deepEqual(h.state.paused, []); assert.equal(h.state.tracking, false);
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
