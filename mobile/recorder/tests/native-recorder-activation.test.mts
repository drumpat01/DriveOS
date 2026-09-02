import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLatestNativeRecorderConfiguration, type NativeRecorderConfigurationTarget,
} from '../modules/journeydeck-recorder/src/LatestNativeRecorderConfiguration.ts';

const target = (enabled: boolean): NativeRecorderConfigurationTarget => ({
  enabled,
  ownerUserId: 'owner-1',
  deviceId: 'iphone-1',
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

test('a stale launch-time disable cannot finish after a newer enable request', async () => {
  const first = deferred<{ enabled: boolean }>();
  const applied: boolean[] = [];
  const coordinator = createLatestNativeRecorderConfiguration(async request => {
    applied.push(request.enabled);
    if (applied.length === 1) return first.promise;
    return { enabled: request.enabled };
  });

  const staleDisable = coordinator.request(target(false));
  await Promise.resolve();
  const finalEnable = coordinator.request(target(true));
  first.resolve({ enabled: false });

  assert.deepEqual(await staleDisable, { enabled: false });
  assert.deepEqual(await finalEnable, { enabled: true });
  assert.deepEqual(applied, [false, true]);
});

test('queued intermediate states are coalesced and settle with the newest applied state', async () => {
  const first = deferred<{ enabled: boolean }>();
  const applied: boolean[] = [];
  const coordinator = createLatestNativeRecorderConfiguration(async request => {
    applied.push(request.enabled);
    if (applied.length === 1) return first.promise;
    return { enabled: request.enabled };
  });

  const initial = coordinator.request(target(false));
  await Promise.resolve();
  const superseded = coordinator.request(target(false));
  const newest = coordinator.request(target(true));
  first.resolve({ enabled: false });

  assert.deepEqual(await initial, { enabled: false });
  assert.deepEqual(await superseded, { enabled: true });
  assert.deepEqual(await newest, { enabled: true });
  assert.deepEqual(applied, [false, true]);
});

test('a failed stale request does not prevent a newer desired state from applying', async () => {
  const first = deferred<{ enabled: boolean }>();
  const applied: boolean[] = [];
  const coordinator = createLatestNativeRecorderConfiguration(async request => {
    applied.push(request.enabled);
    if (applied.length === 1) return first.promise;
    return { enabled: request.enabled };
  });

  const failedDisable = coordinator.request(target(false));
  await Promise.resolve();
  const finalEnable = coordinator.request(target(true));
  first.reject(new Error('stale failure'));

  await assert.rejects(failedDisable, /stale failure/);
  assert.deepEqual(await finalEnable, { enabled: true });
  assert.deepEqual(applied, [false, true]);
});
