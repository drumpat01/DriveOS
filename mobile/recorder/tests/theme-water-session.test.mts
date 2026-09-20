import assert from 'node:assert/strict';
import test from 'node:test';
import { createWaterThemeSession, type WaterThemeFrame } from '../src/theme-water-session.ts';
import { WATER_RIPPLE_TIMEOUT } from '../src/theme-water-geometry.ts';

type Theme = 'dark' | 'light' | 'rose';
type Image = Readonly<{ name: string }>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const oldImage: Image = { name: 'old' };
const newImage: Image = { name: 'new' };

function fixture() {
  const state = {
    current: 'dark' as Theme,
    animated: true,
    storageError: null as Error | null,
    applyGate: null as ReturnType<typeof deferred<void>> | null,
    events: [] as string[],
    frames: [] as WaterThemeFrame<Image>[],
    captures: [] as ReturnType<typeof deferred<Image>>[],
  };
  const session = createWaterThemeSession<Theme, Image>({
    current: () => state.current,
    persist: theme => {
      state.events.push(`persist:${theme}`);
      if (state.storageError) throw state.storageError;
    },
    apply: theme => {
      state.events.push(`apply:${theme}`);
      state.current = theme;
      return state.applyGate?.promise ?? Promise.resolve();
    },
    capture: () => {
      const capture = deferred<Image>();
      state.captures.push(capture);
      state.events.push(`capture:${state.captures.length}`);
      return capture.promise;
    },
    show: frame => {
      state.frames.push(frame);
      state.events.push(frame.playing ? 'show:water' : 'show:old');
    },
    clear: () => { state.events.push('clear'); },
    canAnimate: () => state.animated,
  });
  return { state, session };
}

test('failed persistence stays synchronous and prevents capture, application, and transition locking', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  const failure = new Error('Keychain unavailable');
  state.storageError = failure;
  assert.throws(() => session.start('light'), error => error === failure);
  assert.deepEqual(state.events, ['persist:light']);
  assert.equal(state.current, 'dark');
  assert.equal(session.busy, false);

  state.storageError = null;
  session.start('light');
  assert.deepEqual(state.events, ['persist:light', 'persist:light', 'capture:1']);
  assert.equal(session.busy, true);
  await flush();
});

test('same-theme and duplicate presses leave the original transition and persistence untouched', t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  session.start('dark');
  assert.deepEqual(state.events, []);
  session.start('light');
  session.start('light');
  session.start('rose');
  assert.deepEqual(state.events, ['persist:light', 'capture:1']);
  assert.equal(session.busy, true);
});

test('the old frame covers the screen before the live theme commits and water begins', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  const origin = { x: 42, y: 317 };
  state.applyGate = deferred<void>();
  session.start('light', origin);
  assert.deepEqual(state.events, ['persist:light', 'capture:1']);

  state.captures[0].resolve(oldImage);
  await flush();
  assert.deepEqual(state.events, ['persist:light', 'capture:1', 'show:old']);
  assert.equal(state.current, 'dark');
  assert.equal(state.frames[0].before, oldImage);
  assert.equal(state.frames[0].playing, false);
  assert.equal(state.frames[0].origin, origin);

  state.frames[0].onReady();
  await flush();
  assert.deepEqual(state.events, ['persist:light', 'capture:1', 'show:old', 'apply:light']);
  assert.equal(state.captures.length, 1, 'the safe path uses exactly one whole-window capture');

  state.applyGate.resolve();
  await flush();
  assert.equal(state.events.at(-1), 'show:water');
  assert.equal(state.frames[1].before, oldImage);
  assert.equal(state.frames[1].playing, true);
  assert.equal(state.frames[1].origin, origin);
  assert.equal(session.busy, true);

  state.frames[1].onFinished();
  assert.equal(session.busy, false);
  assert.deepEqual(state.events, [
    'persist:light', 'capture:1', 'show:old', 'apply:light', 'show:water', 'clear',
  ]);
  state.frames[0].onReady();
  state.frames[0].onFinished();
  state.frames[1].onFinished();
  await flush();
  assert.equal(state.events.filter(event => event === 'clear').length, 1);
  assert.equal(state.events.filter(event => event === 'apply:light').length, 1);
});

test('disabled motion applies the persisted theme directly without capturing or mounting an overlay', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  state.animated = false;
  session.start('light');
  await flush();
  assert.deepEqual(state.events, ['persist:light', 'apply:light']);
  assert.equal(state.current, 'light');
  assert.equal(session.busy, false);
});

test('backgrounding during the first capture applies the selection and ignores the late image', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  session.start('light');
  session.settle();
  assert.equal(state.current, 'light');
  assert.equal(session.busy, false);
  state.captures[0].resolve(oldImage);
  await flush();
  assert.deepEqual(state.events, ['persist:light', 'capture:1', 'apply:light', 'clear']);
  assert.deepEqual(state.frames, []);
});

test('backgrounding while the old frame waits for readiness cannot restart from a stale callback', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  session.start('light');
  state.captures[0].resolve(oldImage);
  await flush();
  session.settle();
  const settled = [...state.events];
  state.frames[0].onReady();
  state.frames[0].onFinished();
  await flush();
  assert.equal(state.current, 'light');
  assert.equal(session.busy, false);
  assert.deepEqual(state.events, settled);
});

test('backgrounding while the new theme commits applies it only once and prevents a subsequent capture', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  state.applyGate = deferred<void>();
  session.start('light');
  state.captures[0].resolve(oldImage);
  await flush();
  state.frames[0].onReady();
  await flush();
  session.settle();
  state.applyGate.resolve();
  await flush();
  assert.equal(state.current, 'light');
  assert.equal(session.busy, false);
  assert.deepEqual(state.events, ['persist:light', 'capture:1', 'show:old', 'apply:light', 'clear']);
});

test('a failed old screenshot still applies the saved selection and permits a later selection', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  session.start('light');
  state.captures[0].reject(new Error('Snapshot unavailable'));
  await flush();
  assert.deepEqual(state.events, ['persist:light', 'capture:1', 'apply:light', 'clear']);
  assert.equal(session.busy, false);
  session.start('rose');
  assert.deepEqual(state.events.slice(-2), ['persist:rose', 'capture:2']);
});

test('callbacks from a settled transition cannot clear or advance its replacement', async t => {
  const { state, session } = fixture();
  t.after(() => session.dispose());
  session.start('light');
  state.captures[0].resolve(oldImage);
  await flush();
  const stale = state.frames[0];
  session.settle();
  session.start('rose');
  const replacement = [...state.events];
  stale.onReady();
  stale.onFinished();
  await flush();
  assert.deepEqual(state.events, replacement);
  assert.equal(session.busy, true);
  state.captures[1].resolve(newImage);
  await flush();
  assert.equal(state.frames.length, 2);
  assert.equal(state.frames[1].before, newImage);
});

test('disposing during capture suppresses late work and permanently rejects new transitions', async () => {
  const { state, session } = fixture();
  session.start('light');
  session.dispose();
  const disposed = [...state.events];
  state.captures[0].resolve(oldImage);
  session.start('rose');
  session.settle();
  session.dispose();
  await flush();
  assert.deepEqual(state.events, disposed);
  assert.equal(state.current, 'dark', 'unmounted provider must not receive a late theme application');
  assert.equal(session.busy, false);
});

test('disposing a mounted cover makes its readiness and completion callbacks inert', async () => {
  const { state, session } = fixture();
  session.start('light');
  state.captures[0].resolve(oldImage);
  await flush();
  session.dispose();
  const disposed = [...state.events];
  state.frames[0].onReady();
  state.frames[0].onFinished();
  await flush();
  assert.deepEqual(state.events, disposed);
  assert.equal(state.current, 'dark');
  assert.equal(session.busy, false);
});

test('the timeout releases a hung capture and applies the saved selection exactly once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { state, session } = fixture();
  t.after(() => session.dispose());
  session.start('light');
  t.mock.timers.tick(WATER_RIPPLE_TIMEOUT - 1);
  assert.equal(session.busy, true);
  assert.equal(state.current, 'dark');
  t.mock.timers.tick(1);
  assert.equal(session.busy, false);
  assert.equal(state.current, 'light');
  state.captures[0].reject(new Error('Late capture failure'));
  await flush();
  t.mock.timers.tick(WATER_RIPPLE_TIMEOUT);
  assert.deepEqual(state.events, ['persist:light', 'capture:1', 'apply:light', 'clear']);
});

test('the timeout removes a drawn ripple that never reports completion without reapplying the theme', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { state, session } = fixture();
  t.after(() => session.dispose());
  session.start('light');
  state.captures[0].resolve(oldImage);
  await flush();
  state.frames[0].onReady();
  await flush();
  assert.equal(state.frames[1].playing, true);
  t.mock.timers.tick(WATER_RIPPLE_TIMEOUT);
  const expired = [...state.events];
  state.frames[1].onFinished();
  await flush();
  assert.deepEqual(state.events, expired);
  assert.equal(session.busy, false);
  assert.equal(state.events.filter(event => event === 'apply:light').length, 1);
  assert.equal(state.events.filter(event => event === 'clear').length, 1);
});
