import assert from 'node:assert/strict';
import test from 'node:test';
import { installStartupErrorRecorder, formatStartupFailure, type StartupFailure } from '../src/startup-error-recorder.ts';

test('fatal errors persist redacted original details and still reach the existing handler', () => {
  const calls: unknown[] = [];
  let handler: (error: Error, fatal?: boolean) => void = (error, fatal) => { calls.push([error, fatal]); };
  let record: StartupFailure | undefined;
  const error = new TypeError('broken module token=private-value user@example.com 32.123456');
  installStartupErrorRecorder({ getGlobalHandler: () => handler, setGlobalHandler: h => { handler = h; } },
    value => { record = value; }, () => 'Update: 01a0792b-3d62-7e32-ad6f-6f1c3cb0fa20');
  handler(error, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [error, true]);
  assert.match(record!.error, /TypeError: broken module/);
  assert.doesNotMatch(record!.error, /private-value|user@example|32\.123456/);
  assert.match(formatStartupFailure(record), /01a0792b/);
  handler(new Error('later nonfatal'), false);
  assert.equal(calls.length, 2);
  assert.match(record!.error, /broken module/);
});

test('storage and metadata failures never swallow the original fatal exception', () => {
  const error = new Error('original');
  let handler: (error: Error, fatal?: boolean) => void = value => { throw value; };
  installStartupErrorRecorder({ getGlobalHandler: () => handler, setGlobalHandler: h => { handler = h; } },
    () => { throw new Error('disk unavailable'); }, () => { throw new Error('metadata unavailable'); });
  assert.throws(() => handler(error, true), value => value === error);
});

test('reports are bounded, expire after 24 hours, and reject malformed records', () => {
  const now = Date.now();
  const record = { captured: new Date(now).toISOString(), context: 'embedded', error: 'x'.repeat(20000) };
  assert.ok(formatStartupFailure(record, now).length <= 14000);
  assert.match(formatStartupFailure(record, now + 86400001), /No recent/);
  for (const value of [null, {}, { ...record, captured: 'invalid' }, { ...record, error: 7 }]) {
    assert.match(formatStartupFailure(value, now), /No recent/);
  }
});
