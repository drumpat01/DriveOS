import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const journal = readFileSync(new URL('../modules/journeydeck-recorder/ios/RecorderCommandJournal.swift', import.meta.url), 'utf8');
const machine = readFileSync(new URL('../modules/journeydeck-recorder/ios/RecorderStateMachine.swift', import.meta.url), 'utf8');
const recorder = readFileSync(new URL('../modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift', import.meta.url), 'utf8');
const sql = (name: string) => {
  const source = name === 'schema' ? journal : machine;
  const value = source.match(new RegExp(`static let ${name} = """([\\s\\S]*?)"""`))?.[1]
    ?? source.match(new RegExp(`static let ${name} = "([^"\\r\\n]*)"`))?.[1];
  assert.ok(value, `use actual Swift SQL for ${name}`); return value;
};
const sessionSchema = recorder.match(/CREATE TABLE IF NOT EXISTS native_recording_sessions\([\s\S]*?\);/)![0];
const timestamp = '2026-09-12T12:00:00Z';
function seed(db: DatabaseSync) {
  db.exec(sessionSchema); db.exec(sql('schema')); db.exec(sql('checkpointSchema'));
  db.prepare("INSERT INTO native_recorder_commands(operation_id,owner_user_id,device_id,action,session_id,issued_at) VALUES('start','owner','device','start','session',?)").run(timestamp);
  db.exec('BEGIN IMMEDIATE');
  db.prepare(sql('startSQL')).run('session', 'owner', 'device', timestamp, timestamp, timestamp);
  db.prepare(sql('receiptSQL')).run('applied', null, 'start', 'owner'); db.exec('COMMIT');
  db.prepare("INSERT INTO native_recorder_commands(operation_id,owner_user_id,device_id,action,session_id,issued_at) VALUES('finish','owner','device','finish','session',?)").run(timestamp);
}

test('native Finish and its receipt roll back together on a real SQLite write failure', () => {
  const db = new DatabaseSync(':memory:');
  try {
    seed(db);
    db.exec("CREATE TRIGGER reject_receipt BEFORE UPDATE ON native_recorder_commands BEGIN SELECT RAISE(ABORT,'injected write failure'); END;");
    db.exec('BEGIN IMMEDIATE');
    db.prepare(sql('finishSQL')).run(timestamp, timestamp, 'session', 'owner');
    assert.throws(() => db.prepare(sql('receiptSQL')).run('applied', null, 'finish', 'owner'), /injected/);
    db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT status FROM native_recording_sessions').get()!.status, 'recording');
    assert.equal(db.prepare("SELECT state FROM native_recorder_commands WHERE operation_id='finish'").get()!.state, 'pending');
    db.exec('DROP TRIGGER reject_receipt'); db.exec('BEGIN IMMEDIATE');
    db.prepare(sql('finishSQL')).run(timestamp, timestamp, 'session', 'owner');
    db.prepare(sql('receiptSQL')).run('applied', null, 'finish', 'owner'); db.exec('COMMIT');
    assert.equal(db.prepare('SELECT status FROM native_recording_sessions').get()!.status, 'completed');
    // Inbox acknowledgement deletes only session rows, retaining receipts.
    db.exec('DELETE FROM native_recording_sessions');
    assert.equal(db.prepare("SELECT state FROM native_recorder_commands WHERE operation_id='start'").get()!.state, 'applied');
    assert.throws(() => db.prepare("INSERT INTO native_recorder_commands(operation_id,owner_user_id,device_id,action,session_id,issued_at) VALUES('start','owner','device','start','other',?)").run(timestamp), /UNIQUE/);
  } finally { db.close(); }
});

test('native transition SQL cannot touch another profile or reopen a completed session', () => {
  const db = new DatabaseSync(':memory:');
  try {
    seed(db);
    assert.equal(db.prepare(sql('transitionSQL')).run('paused', timestamp, 'session', 'other').changes, 0);
    assert.equal(db.prepare(sql('finishSQL')).run(timestamp, timestamp, 'session', 'other').changes, 0);
    db.prepare(sql('finishSQL')).run(timestamp, timestamp, 'session', 'owner');
    assert.equal(db.prepare(sql('transitionSQL')).run('recording', timestamp, 'session', 'owner').changes, 0);
    assert.equal(db.prepare('SELECT ended_at FROM native_recording_sessions').get()!.ended_at, timestamp);
  } finally { db.close(); }
});

test('process termination between native Finish and receipt preserves a durable retryable intent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'journeydeck-native-journal-'));
  const path = join(dir, 'journal.db');
  try {
    const db = new DatabaseSync(path);
    try { db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;'); seed(db); }
    finally { db.close(); }
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(${JSON.stringify(path)});
      db.exec('PRAGMA synchronous=FULL; BEGIN IMMEDIATE');
      db.prepare(${JSON.stringify(sql('finishSQL'))}).run(${JSON.stringify(timestamp)},${JSON.stringify(timestamp)},'session','owner');
      process.kill(process.pid, 'SIGKILL');
    `], { timeout: 10_000 });
    assert.notEqual(child.status, 0);
    const reopened = new DatabaseSync(path);
    try {
      assert.equal(reopened.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
      assert.equal(reopened.prepare('SELECT status FROM native_recording_sessions').get()!.status, 'recording');
      assert.equal(reopened.prepare("SELECT state FROM native_recorder_commands WHERE operation_id='finish'").get()!.state, 'pending');
    } finally { reopened.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
