import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/native-recorder-inbox.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function harness() {
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  const exports: any = {};
  const responseExports: any = {};
  const clock = { setTimeout: (fn: () => void) => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: (id: number) => timers.delete(id) };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/recorder-response.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: responseExports, ...clock });
  const state = { owner: 'owner', sessionId: 'a', reads: [] as ReturnType<typeof deferred>[],
    imports: [] as any[], acknowledgements: [] as string[][], failImport: false, hangAck: false, acks: [] as ReturnType<typeof deferred>[] };
  const dependencies: Record<string, any> = {
    './recorder-response': responseExports,
    './auth': { getCurrentUser: () => ({ id: state.owner }) },
    '../modules/journeydeck-recorder': {
      exportNativeRecorderInbox: () => { const pending = deferred(); state.reads.push(pending); return pending.promise; },
      acknowledgeNativeRecorderSessions: (ids: string[]) => {
        state.acknowledgements.push(ids);
        if (state.hangAck) { const pending = deferred(); state.acks.push(pending); return pending.promise; }
        return Promise.resolve({ acknowledged: ids.length, errorCode: null });
      },
    },
    './storage': {
      activeSession: () => ({ id: state.sessionId }), nativeRecorderInboxCursors: () => ({}),
      importNativeRecorderInbox: (snapshot: any) => {
        if (state.failImport) throw Error('SQLITE_FULL');
        state.imports.push(snapshot); return snapshot.sessions.filter((s: any) => s.status === 'completed').map((s: any) => s.id);
      },
    },
  };
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }, ...clock });
  return { sync: exports.syncNativeRecorderInbox, state, expire: async () => {
    for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } await flush();
  } };
}

test('a hung export times out, can retry, and its late snapshot is never imported', async () => {
  const h = harness();
  let failed = false;
  const shared = h.sync();
  const first = shared.catch(() => { failed = true; });
  assert.equal(h.sync(), shared);
  await h.expire();
  assert.equal(failed, true, 'the original read must stop blocking all later refreshes');
  await first;
  const next = h.sync();
  assert.equal(h.state.reads.length, 2);
  h.state.reads[1].resolve({ sessions: [{ id: 'b', status: 'recording' }] }); await next;
  h.state.reads[0].resolve({ sessions: [{ id: 'a', status: 'recording' }] }); await flush();
  assert.deepEqual(h.state.imports.map(s => s.sessions[0].id), ['b']);
});

test('failed imports are never acknowledged and a retry can finish', async () => {
  const h = harness(); h.state.failImport = true;
  const first = h.sync();
  h.state.reads[0].resolve({ sessions: [{ id: 'a', status: 'completed' }] });
  await assert.rejects(first, /SQLITE_FULL/);
  assert.equal(h.state.acknowledgements.length, 0);
  h.state.failImport = false;
  const next = h.sync(); h.state.reads[1].resolve({ sessions: [{ id: 'a', status: 'completed' }] });
  assert.equal((await next).acknowledged, 1);
});

test('a timed-out acknowledgement can be retried without applying a late export', async () => {
  const h = harness(); h.state.hangAck = true;
  let failed = false;
  const first = h.sync().catch(() => { failed = true; });
  h.state.reads[0].resolve({ sessions: [{ id: 'a', status: 'completed' }] }); await flush();
  await h.expire(); assert.equal(failed, true); await first;
  h.state.hangAck = false;
  const next = h.sync(); h.state.reads[1].resolve({ sessions: [] }); await next;
  h.state.acks[0].resolve({ acknowledged: 1, errorCode: null }); await flush();
  assert.equal(h.state.acknowledgements.length, 1);
});

test('a response crossing a profile change cannot import or acknowledge data', async () => {
  const h = harness(); const pending = h.sync();
  h.state.owner = 'other'; h.state.reads[0].resolve({ sessions: [{ id: 'a', status: 'completed' }] });
  await assert.rejects(pending, /profile_changed/);
  assert.equal(h.state.imports.length, 0);
  assert.equal(h.state.acknowledgements.length, 0);
});
