import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fixture, seedLegacy, completedNative } from './helpers/recording-storage-harness.mts';

async function crashAt(path: string, action: string, phase: string, index: number): Promise<boolean> {
  return new Promise((done, reject) => {
    const child = fork(fileURLToPath(new URL('./helpers/recording-crash-child.mts', import.meta.url)),
      [path, action, phase, String(index)], { execArgv: ['--experimental-strip-types'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
    let checkpoint = false, completed = false, errorOutput = '';
    child.stderr?.on('data', data => { errorOutput += String(data); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Crash child did not reach its checkpoint')); }, 10_000);
    child.on('message', (message: any) => {
      if (message.checkpoint) { checkpoint = true; child.kill('SIGKILL'); }
      if (message.completed) completed = true;
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', () => {
      clearTimeout(timer);
      if (!checkpoint && !completed) reject(Error(errorOutput)); else done(checkpoint);
    });
  });
}

for (const action of ['points', 'finish', 'import']) {
  for (const phase of ['before', 'after']) {
    test(`terminate and reopen the same WAL database ${phase} every ${action} write`, async () => {
      let crashes = 0;
      for (let index = 1; index < 25; index++) {
        const directory = mkdtempSync(join(tmpdir(), 'journeydeck-crash-'));
        const path = join(directory, 'test.sqlite');
        try {
          const setup = fixture(path);
          const id = action === 'import' ? completedNative().sessions[0].id : seedLegacy(setup).id;
          setup.database.close();
          const crashed = await crashAt(path, action, phase, index);
          const h = fixture(path);
          try {
            assert.equal(h.database.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
            assert.equal(h.database.prepare('PRAGMA foreign_key_check').all().length, 0);
            if (action === 'points') {
              const n = Number(h.database.prepare('SELECT COUNT(*) AS n FROM recording_points').get()?.n);
              assert.ok(n === 2 || n === 4, 'the batch commits entirely or rolls back');
              assert.equal(h.storage.getSession(id).next_sequence, n);
            } else if (action === 'finish') {
              assert.equal(h.database.prepare('SELECT COUNT(*) AS n FROM recording_points').get()?.n, 2);
              const session = h.storage.getSession(id);
              assert.ok(['recording', 'finishing', 'completed'].includes(session.status));
              if (session.status !== 'completed') h.storage.completeSessionLocally(id, false);
              else h.storage.refreshCompletedSessionLocalMirror(id);
              assert.equal(h.storage.activeSession(), null);
              assert.equal(h.archive.size, 1);
              assert.equal(h.storage.recordLocations([]), 0);
              const jobs = h.database.prepare('SELECT kind,COUNT(*) AS n FROM recording_jobs GROUP BY kind').all();
              assert.ok(jobs.length >= 3); assert.ok(jobs.every(row => row.n === 1));
            } else {
              // Simulate the still-retained native snapshot being offered again.
              const ack = h.storage.importNativeRecorderInbox(completedNative());
              assert.deepEqual(Array.from(ack), [id]);
              assert.equal(h.storage.getSession(id).status, 'completed');
              assert.equal(h.database.prepare('SELECT COUNT(*) AS n FROM recording_points').get()?.n, 3);
              assert.equal(h.database.prepare('SELECT COUNT(*) AS n FROM recording_sessions').get()?.n, 1);
              const jobs = h.database.prepare('SELECT kind FROM recording_jobs ORDER BY kind').all();
              assert.deepEqual(jobs.map(row => row.kind), ['apple_music_history', 'archive_mirror', 'private_cloud_sync']);
              assert.equal(h.storage.getSession(id).remote_completed, 1, 'native completion does not create retired server work after recovery');
            }
          } finally { h.database.close(); }
          if (!crashed) break;
          crashes++;
        } finally {
          const target = resolve(directory);
          assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('journeydeck-crash-'));
          rmSync(target, { recursive: true, force: true });
        }
      }
      assert.ok(crashes > 0);
    });
  }
}

test('a real competing SQLite writer blocks a pause safely and releases for retry', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journeydeck-crash-lock-'));
  const path = join(directory, 'test.sqlite');
  const h = fixture(path);
  const other = new DatabaseSync(path);
  try {
    const session = seedLegacy(h);
    h.database.exec('PRAGMA busy_timeout=0');
    other.exec('BEGIN IMMEDIATE');
    assert.throws(() => h.storage.setLocalStatus(session.id, 'paused'), /locked/);
    assert.equal(h.storage.getSession(session.id).status, 'recording');
    other.exec('ROLLBACK');
    h.storage.setLocalStatus(session.id, 'paused');
    assert.equal(h.storage.getSession(session.id).status, 'paused');
  } finally {
    other.close(); h.database.close();
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && target.includes('journeydeck-crash-lock-'));
    rmSync(target, { recursive: true, force: true });
  }
});
