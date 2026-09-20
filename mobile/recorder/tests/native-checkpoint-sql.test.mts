import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

// Execute the SQL used by the Swift implementation, against disposable real
// SQLite databases. These tests do not execute Swift or Core Location.
const machine = readFileSync(new URL('../modules/journeydeck-recorder/ios/RecorderStateMachine.swift', import.meta.url), 'utf8');
const recorder = readFileSync(new URL('../modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift', import.meta.url), 'utf8');
const journal = readFileSync(new URL('../modules/journeydeck-recorder/ios/RecorderCommandJournal.swift', import.meta.url), 'utf8');
function sql(name: string, source = machine): string {
  const value = source.match(new RegExp(`static let ${name} = """([\\s\\S]*?)"""`))?.[1]
    ?? source.match(new RegExp(`static let ${name} = "([^"\\r\\n]*)"`))?.[1];
  assert.ok(value, `production SQL ${name} exists`);
  return value;
}
const sessionSchema = recorder.match(/CREATE TABLE IF NOT EXISTS native_recording_sessions\([\s\S]*?\);/)![0];
const pointSchema = recorder.match(/CREATE TABLE IF NOT EXISTS native_recording_points\([\s\S]*?\);/)![0];
const at = '2026-09-12T12:00:00Z';
const pointSQL = "INSERT INTO native_recording_points(session_id,sequence,recorded_at,latitude,longitude) VALUES('session',0,?,0,0);";
const oldCheckpoint = JSON.stringify({ candidateSamples: 0, stationarySince: 1 });
const newCheckpoint = JSON.stringify({ candidateSamples: 0, stationarySince: null });

function seed(db: DatabaseSync, idle = false) {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
  db.exec(sessionSchema);
  db.exec(pointSchema);
  db.exec(sql('schema', journal));
  db.exec(sql('checkpointSchema'));
  if (!idle) db.prepare(sql('startSQL')).run('session', 'owner', 'device', at, at, at);
  db.prepare(sql('checkpointSQL')).run('owner', idle ? null : 'session', oldCheckpoint, at);
  db.prepare("INSERT INTO native_recorder_commands(operation_id,owner_user_id,device_id,action,session_id,issued_at) VALUES('op','owner','device',?,'session',?);").run(idle ? 'start' : 'pause', at);
}

function snapshot(db: DatabaseSync) {
  return {
    sessions: db.prepare('SELECT * FROM native_recording_sessions ORDER BY id').all(),
    points: db.prepare('SELECT * FROM native_recording_points ORDER BY session_id,sequence').all(),
    checkpoints: db.prepare('SELECT * FROM native_recorder_checkpoints ORDER BY owner_user_id').all(),
    commands: db.prepare('SELECT * FROM native_recorder_commands ORDER BY sequence').all(),
  };
}

function pauseWrites(db: DatabaseSync) {
  db.prepare(sql('transitionSQL')).run('paused', at, 'session', 'owner');
  db.prepare(sql('checkpointSQL')).run('owner', 'session', newCheckpoint, at);
  db.prepare(pointSQL).run(at);
  db.prepare(sql('receiptSQL')).run('applied', null, 'op', 'owner');
}

for (const [table, operation] of [
  ['native_recording_sessions', 'UPDATE'],
  ['native_recorder_checkpoints', 'INSERT'],
  ['native_recording_points', 'INSERT'],
  ['native_recorder_commands', 'UPDATE'],
] as const) {
  test(`SQLite rejection at ${table} keeps the entire recorder transaction unchanged`, () => {
    const db = new DatabaseSync(':memory:');
    try {
      seed(db);
      const before = snapshot(db);
      db.exec(`CREATE TRIGGER fail_write BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'injected failure'); END;`);
      db.exec('BEGIN IMMEDIATE');
      assert.throws(() => pauseWrites(db), /injected failure/);
      db.exec('ROLLBACK');
      assert.deepEqual(snapshot(db), before);
      db.exec('DROP TRIGGER fail_write; BEGIN IMMEDIATE;');
      pauseWrites(db);
      db.exec('COMMIT');
      assert.equal(db.prepare('SELECT status FROM native_recording_sessions').get()!.status, 'paused');
      assert.equal(db.prepare('SELECT state_json FROM native_recorder_checkpoints').get()!.state_json, newCheckpoint);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM native_recording_points').get()!.count, 1);
      assert.equal(db.prepare('SELECT state FROM native_recorder_commands').get()!.state, 'applied');
    } finally { db.close(); }
  });
}

test('an idle candidate and new session transfer atomically with the Start receipt', () => {
  const db = new DatabaseSync(':memory:');
  try {
    seed(db, true);
    const before = snapshot(db);
    db.exec("CREATE TRIGGER fail_receipt BEFORE UPDATE ON native_recorder_commands BEGIN SELECT RAISE(ABORT,'injected failure'); END;");
    db.exec('BEGIN IMMEDIATE');
    db.prepare(sql('startSQL')).run('session', 'owner', 'device', at, at, at);
    db.prepare(sql('checkpointSQL')).run('owner', 'session', newCheckpoint, at);
    assert.throws(() => db.prepare(sql('receiptSQL')).run('applied', null, 'op', 'owner'), /injected failure/);
    db.exec('ROLLBACK');
    assert.deepEqual(snapshot(db), before);
    assert.equal(db.prepare('SELECT session_id FROM native_recorder_checkpoints').get()!.session_id, null);
  } finally { db.close(); }
});

test('Finish removes only its owner checkpoint and foreign receipts remain pending', () => {
  const db = new DatabaseSync(':memory:');
  try {
    seed(db);
    db.prepare(sql('checkpointSQL')).run('other-owner', null, oldCheckpoint, at);
    assert.equal(db.prepare(sql('receiptSQL')).run('applied', null, 'op', 'other-owner').changes, 0);
    db.exec('BEGIN IMMEDIATE');
    db.prepare(sql('finishSQL')).run(at, at, 'session', 'owner');
    db.prepare(sql('deleteCheckpointSQL')).run('owner');
    db.prepare(sql('receiptSQL')).run('applied', null, 'op', 'owner');
    db.exec('COMMIT');
    assert.deepEqual(db.prepare('SELECT owner_user_id FROM native_recorder_checkpoints').all().map(row => row.owner_user_id), ['other-owner']);
    db.exec("DELETE FROM native_recording_sessions WHERE id='session'");
    assert.equal(db.prepare('SELECT state FROM native_recorder_commands').get()!.state, 'applied');
  } finally { db.close(); }
});

for (const phase of ['checkpoint', 'point', 'receipt', 'commit'] as const) {
  test(`process death after ${phase} recovers one coherent recorder state`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'journeydeck-checkpoint-'));
    const file = join(directory, 'recorder.db');
    try {
      const db = new DatabaseSync(file);
      let before: ReturnType<typeof snapshot>;
      try { seed(db); before = snapshot(db); }
      finally { db.close(); }
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { DatabaseSync } from 'node:sqlite';
        import { writeSync } from 'node:fs';
        const db = new DatabaseSync(${JSON.stringify(file)});
        db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;');
        db.prepare(${JSON.stringify(sql('transitionSQL'))}).run('paused',${JSON.stringify(at)},'session','owner');
        db.prepare(${JSON.stringify(sql('checkpointSQL'))}).run('owner','session',${JSON.stringify(newCheckpoint)},${JSON.stringify(at)});
        ${phase !== 'checkpoint' ? `db.prepare(${JSON.stringify(pointSQL)}).run(${JSON.stringify(at)});` : ''}
        ${['receipt', 'commit'].includes(phase) ? `db.prepare(${JSON.stringify(sql('receiptSQL'))}).run('applied',null,'op','owner');` : ''}
        ${phase === 'commit' ? "db.exec('COMMIT');" : ''}
        writeSync(1, 'reached-crash-boundary');
        process.kill(process.pid, 'SIGKILL');
      `], { encoding: 'utf8', timeout: 10_000 });
      assert.match(child.stdout, /reached-crash-boundary/, child.stderr);
      assert.notEqual(child.status, 0);
      const recovered = new DatabaseSync(file);
      try {
        assert.equal(recovered.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
        if (phase === 'commit') {
          assert.equal(recovered.prepare('SELECT status FROM native_recording_sessions').get()!.status, 'paused');
          assert.equal(recovered.prepare('SELECT state_json FROM native_recorder_checkpoints').get()!.state_json, newCheckpoint);
          assert.equal(recovered.prepare('SELECT state FROM native_recorder_commands').get()!.state, 'applied');
          assert.equal(recovered.prepare('SELECT COUNT(*) AS count FROM native_recording_points').get()!.count, 1);
        } else assert.deepEqual(snapshot(recovered), before);
      } finally { recovered.close(); }
    } finally {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
