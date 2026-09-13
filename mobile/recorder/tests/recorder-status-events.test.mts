import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { acceptRecorderStatusEvent, recorderEventStopTime, recorderRefreshMayPublish, recorderStatusEventNeedsRefresh, recorderStatusEventStopsClock } from '../src/recorder-status-events.ts';
import { subscribeRecorderStatusEvents } from '../modules/journeydeck-recorder/src/RecorderStatusEvents.ts';

const at = '2026-09-12T12:01:00.000Z';
const current = { profileId: 'owner-a', sessionId: 'native_recording_a', streamId: 'stream-a', sequence: 7 };

test('status events reject stale sequence and profile or session handoff', () => {
  assert.equal(acceptRecorderStatusEvent(current, { streamId: 'stream-a', sequence: 7, journeyId: 'native_recording_a', status: 'paused', occurredAt: at }), null);
  assert.equal(acceptRecorderStatusEvent(current, { streamId: 'stream-b', sequence: 8, journeyId: 'native_recording_a', status: 'paused', occurredAt: at }), null);
  assert.equal(acceptRecorderStatusEvent(current, { streamId: 'stream-a', sequence: 8, journeyId: 'native_recording_b', status: 'paused', occurredAt: at }), null);
  assert.deepEqual(acceptRecorderStatusEvent(current, { streamId: 'stream-a', sequence: 8, journeyId: 'native_recording_a', status: 'paused', occurredAt: at }), { ...current, sequence: 8 });
  assert.deepEqual(acceptRecorderStatusEvent({ ...current, streamId: null, sequence: -1 }, { streamId: 'stream-new', sequence: 0, journeyId: 'native_recording_a', status: 'paused', occurredAt: at }), { ...current, streamId: null, sequence: -1 });
});

test('only terminal transport states freeze the clock', () => {
  assert.equal(recorderStatusEventStopsClock({ streamId: 'stream-a', sequence: 8, journeyId: 'native_recording_a', status: 'recording', occurredAt: at }), false);
  assert.equal(recorderStatusEventStopsClock({ streamId: 'stream-a', sequence: 8, journeyId: 'native_recording_a', status: 'failed', occurredAt: at }), false);
  for (const status of ['paused', 'finished'] as const) {
    assert.equal(recorderStatusEventStopsClock({ streamId: 'stream-a', sequence: 8, journeyId: 'native_recording_a', status, occurredAt: at }), true);
  }
});

test('terminal event freezes at its transition time and never in the future', () => {
  const now = Date.parse('2026-09-12T12:02:00.000Z');
  assert.equal(recorderEventStopTime({ streamId: 's', sequence: 1, journeyId: 'j', status: 'paused', occurredAt: at }, now), Date.parse(at));
  assert.equal(recorderEventStopTime({ streamId: 's', sequence: 2, journeyId: 'j', status: 'finished', occurredAt: '2026-09-12T12:03:00.000Z' }, now), now);
});

test('a refresh that started before a terminal event cannot resurrect tracking', () => {
  assert.equal(recorderRefreshMayPublish(4, 4), true);
  assert.equal(recorderRefreshMayPublish(4, 5), false);
  assert.equal(recorderRefreshMayPublish(4, 4, 'owner-a', 'owner-b'), false);
});

test('an event before the status baseline invalidates refresh without trusting an old stream', () => {
  const afterProfileSwitch = { profileId: 'owner-b', sessionId: 'native_recording_a', streamId: null, sequence: -1 };
  const event = { streamId: 'previous-profile-stream', sequence: 99, journeyId: 'native_recording_a', status: 'finished' as const, occurredAt: at };
  const accepted = acceptRecorderStatusEvent(afterProfileSwitch, event);
  assert.deepEqual(accepted, afterProfileSwitch);
  assert.equal(accepted?.streamId, null);
  assert.equal(recorderStatusEventNeedsRefresh(afterProfileSwitch, event), true);
  assert.equal(recorderStatusEventNeedsRefresh(current, { ...event, streamId: 'stream-a', sequence: 7 }), false);
});

test('a start for a new journey invalidates an in-flight empty-mirror refresh', async () => {
  const empty = { profileId: 'owner-a', sessionId: null, streamId: 'stream-a', sequence: 3 };
  const started = { streamId: 'stream-a', sequence: 4, journeyId: 'native_recording_new', status: 'recording' as const, occurredAt: at };
  let epoch = 2;
  const refreshEpoch = epoch;
  await Promise.resolve();
  if (recorderStatusEventNeedsRefresh(empty, started)) epoch += 1;
  assert.equal(recorderRefreshMayPublish(refreshEpoch, epoch), false);
  assert.equal(acceptRecorderStatusEvent(empty, started), null);
});

test('subscription tolerates old binaries and removes a native listener exactly once', () => {
  assert.doesNotThrow(() => subscribeRecorderStatusEvents(null, () => {})());
  assert.doesNotThrow(() => subscribeRecorderStatusEvents({}, () => {})());
  assert.doesNotThrow(() => subscribeRecorderStatusEvents({ addListener: () => { throw new Error('unsupported'); } }, () => {})());
  let removals = 0;
  const unsubscribe = subscribeRecorderStatusEvents({ addListener: (name) => {
    assert.equal(name, 'recorderStatusChanged');
    return { remove: () => { removals += 1; } };
  } }, () => {});
  unsubscribe();
  unsubscribe();
  assert.equal(removals, 1);
});

test('native delivery emits only committed recovered receipts and token-scopes teardown', () => {
  const moduleSource = readFileSync(new URL('../modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift', import.meta.url), 'utf8');
  const journalSource = readFileSync(new URL('../modules/journeydeck-recorder/ios/RecorderCommandJournal.swift', import.meta.url), 'utf8');
  assert.match(journalSource, /if result\.applied \{ onApplied\?\(action, sessionID\) \}/);
  assert.doesNotMatch(journalSource, /onApplied\?\(action, sessionID\)[\s\S]*let result/);
  assert.match(moduleSource, /case "pause": saveEvent\("paused"/);
  assert.match(moduleSource, /case "resume": saveEvent\("resumed"/);
  assert.match(moduleSource, /guard self\.transitionObserver\?\.token == token else \{ return \}/);
  assert.match(moduleSource, /removeTransitionObserver\(token: token\)/);
  assert.match(moduleSource, /guard previous != code else \{ return \}/);
  assert.match(moduleSource, /workQueue\.async\(execute: apply\)/);
  assert.match(moduleSource, /saveEvent\("status_failed", sessionID:/);
  assert.match(moduleSource, /locationManagerDidChangeAuthorization[\s\S]*stopPreciseTracking\(\)[\s\S]*setLastError\("always_location_required"\)/);
});

test('native status snapshots defaults on its recorder queue and revalidates tracking generation', () => {
  const source = readFileSync(new URL('../modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift', import.meta.url), 'utf8');
  const status = source.slice(source.indexOf('  func status() async'), source.indexOf('  private func legacyCommand'));
  assert.match(status, /workQueue\.async[\s\S]*controlToken = self\.defaults/);
  assert.match(status, /self\.reconcilePersistedSession\(\)/);
  assert.match(status, /identity\?\.owner == snapshot\.owner[\s\S]*eventStreamID == snapshot\.streamID/);
  assert.match(status, /locationStateGeneration == locationState\.3/);
});
