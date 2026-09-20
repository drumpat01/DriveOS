import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { validCapturedMarker } from '../src/journey-marker-model.ts';

const compiled = ts.transpileModule(readFileSync(new URL('../src/journey-marker-capture.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture() {
  const state = { userId: 'owner', nativeSession: 'native_recording_test', recording: true, pointAge: 1000, changeProfile: false, saved: [] as any[] };
  const deps: Record<string, any> = {
    'expo-crypto': { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    './journey-marker-compatibility': { MARKER_OTA_COMPAT: true }, './auth': { getCurrentUser: () => ({ id: state.userId }) },
    './native-recorder-inbox': { syncNativeRecorderInbox: async () => {} },
    '../modules/journeydeck-recorder': { getNativeAutomaticRecorderStatus: async () => {
      if (state.changeProfile) state.userId = 'other';
      return { statusReliable: true, recording: state.recording, sessionId: state.nativeSession };
    }, captureNativeJourneyMarker: () => { throw Error('Old binary cannot call the new native capture method'); } },
    './storage': { getLiveRecorderSnapshot: () => ({ session: { id: 'native_recording_test', status: 'recording', startedAt: new Date(Date.now() - 600000).toISOString() },
      lastPoint: { recordedAt: new Date(Date.now() - state.pointAge).toISOString(), latitude: 0, longitude: 0, accuracyMeters: 5 } }) },
    './journey-marker-model': { validCapturedMarker }, './journey-marker-compat-store': { saveForegroundMarker: (user: string, marker: any) => state.saved.push({ user, marker }) },
  };
  const exports: any = {};
  vm.runInNewContext(compiled, { exports, Date, Error, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return { state, capture: () => exports.captureJourneyMarker('native_recording_test') };
}
test('OTA captures a real foreground marker using only the installed native status/inbox APIs', async () => {
  const f = fixture(); await f.capture();
  assert.equal(f.state.saved.length, 1); assert.equal(f.state.saved[0].user, 'owner');
  assert.equal(f.state.saved[0].marker.sessionId, 'native_recording_test');
});
test('OTA refuses stale GPS, changed sessions, pause and profile changes without saving', async () => {
  for (const patch of [{ pointAge: 31000 }, { nativeSession: 'different' }, { recording: false }, { changeProfile: true }]) {
    const f = fixture(); Object.assign(f.state, patch);
    await assert.rejects(f.capture()); assert.equal(f.state.saved.length, 0);
  }
});
