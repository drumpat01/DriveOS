import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, location, seedLegacy, completedNative } from './helpers/recording-storage-harness.mts';

function assertHealthy(h: ReturnType<typeof fixture>) {
  assert.equal(h.database.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
  assert.equal(h.database.prepare('PRAGMA foreign_key_check').all().length, 0);
}

for (const operation of ['start', 'points', 'pause', 'finish', 'import'] as const) {
  test(`each failed write during ${operation} preserves prior durable state and permits retry`, () => {
    let checked = 0;
    // Enumerate each write plus BEGIN/COMMIT; every iteration uses a new DB.
    for (let failAt = 1; failAt < 30; failAt++) {
      const h = fixture();
      try {
        const session = operation === 'start' || operation === 'import' ? null : seedLegacy(h);
        const work = () => {
          if (operation === 'start') return h.storage.beginLocalSession('test-phone');
          if (operation === 'points') return h.storage.recordLocations([location(Date.now() - 500), location(Date.now())]);
          if (operation === 'pause') return h.storage.setLocalStatus(session.id, 'paused');
          if (operation === 'finish') return h.storage.completeSessionLocally(session.id, false);
          return h.storage.importNativeRecorderInbox(completedNative());
        };
        let writes = 0, injected = false;
        h.hooks.before = () => { if (++writes === failAt) { injected = true; throw new Error('SQLITE_IOERR'); } };
        try { work(); } catch (error) { assert.match(String(error), /SQLITE_IOERR/); }
        h.hooks.before = () => {};
        assertHealthy(h);
        if (!injected) break;
        checked++;
        if (operation === 'start' || operation === 'import') assert.equal(h.storage.activeSession(), null);
        if (session) {
          assert.equal(h.database.prepare('SELECT COUNT(*) AS n FROM recording_points WHERE session_id=?').get(session.id)?.n, 2);
          // A job-status write can fail after completion has already committed.
          const status = h.storage.getSession(session.id).status;
          assert.ok(status === 'recording' || operation === 'finish' && status === 'completed');
        }
        work();
        assertHealthy(h);
        if (operation === 'finish') { assert.equal(h.storage.activeSession(), null); assert.equal(h.archive.size, 1); }
        if (operation === 'import') assert.equal(h.storage.getSession(completedNative().sessions[0].id).status, 'completed');
      } finally { h.database.close(); }
    }
    assert.ok(checked > 0);
  });
}

test('a real SQLITE_FULL rolls back a GPS batch without consuming its sequence numbers', () => {
  const h = fixture();
  try {
    const session = seedLegacy(h);
    const pages = h.database.prepare('PRAGMA page_count').get()!.page_count;
    h.database.exec(`PRAGMA max_page_count=${pages}`);
    const batch = Array.from({ length: 5000 }, () => location(Date.now()));
    assert.throws(() => h.storage.recordLocations(batch), /full/);
    assert.equal(h.storage.getSession(session.id).next_sequence, 2);
    assert.equal(h.database.prepare('SELECT COUNT(*) AS n FROM recording_points').get()?.n, 2);
    h.database.exec('PRAGMA max_page_count=100000');
    assert.equal(h.storage.recordLocations([location(Date.now())]), 1);
    assert.equal(h.storage.getSession(session.id).next_sequence, 3);
    assertHealthy(h);
  } finally { h.database.close(); }
});

test('an archive failure retains the completed recording and a retryable mirror job', () => {
  const h = fixture();
  try {
    const session = seedLegacy(h);
    h.hooks.archive = () => { throw Error('SQLITE_FULL'); };
    assert.equal(h.storage.completeSessionLocally(session.id, false), false);
    assert.equal(h.storage.activeSession(), null);
    assert.equal(h.database.prepare("SELECT status FROM recording_jobs WHERE kind='archive_mirror'").get()?.status, 'retry');
    h.hooks.archive = () => {};
    assert.equal(h.storage.refreshCompletedSessionLocalMirror(session.id), true);
    assert.equal(h.archive.size, 1);
    assertHealthy(h);
  } finally { h.database.close(); }
});

test('a malformed GPS timestamp cannot discard the valid fixes in the same batch', () => {
  const h = fixture();
  try {
    seedLegacy(h);
    assert.equal(h.storage.recordLocations([location(Date.now()), location(NaN), location(Date.now())]), 2);
    assert.equal(h.database.prepare('SELECT COUNT(*) AS n FROM recording_points').get()?.n, 4);
    assertHealthy(h);
  } finally { h.database.close(); }
});
