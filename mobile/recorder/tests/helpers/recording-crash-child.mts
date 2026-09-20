import { fixture, location, completedNative } from './recording-storage-harness.mts';

const [path, action, stopPhase, stopIndexText] = process.argv.slice(2);
const h = fixture(path);
const stopIndex = Number(stopIndexText);
let index = 0;
const checkpoint = (phase: string, sql: string) => {
  if (phase !== stopPhase || ++index !== stopIndex) return;
  process.send?.({ checkpoint: true, sql: sql.slice(0, 80) });
  // Parent terminates this child while SQLite is open; no finally/close runs.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
};
h.hooks.before = sql => checkpoint('before', sql);
h.hooks.after = sql => checkpoint('after', sql);
if (action === 'points') h.storage.recordLocations([location(Date.now() - 1), location(Date.now())]);
else if (action === 'import') h.storage.importNativeRecorderInbox(completedNative());
else {
  const id = h.storage.activeSession().id;
  h.storage.claimManualSessionForFailsafeFinish(id);
  h.storage.completeSessionLocally(id, false);
}
h.database.close();
process.send?.({ completed: true });
process.disconnect?.();
