import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fixture, completedNative } from './helpers/recording-storage-harness.mts';

const source = readFileSync(new URL('../modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift', import.meta.url), 'utf8');
const sessionSchema = source.match(/CREATE TABLE IF NOT EXISTS native_recording_sessions\([\s\S]*?\);/)![0];
const markerSchema = source.match(/CREATE TABLE native_journey_markers\([\s\S]*?\);/)![0];
const markerInsert = source.match(/"(INSERT INTO native_journey_markers[^"\n]*)"/)![1];
const markerExport = source.match(/"(SELECT id,captured_at,location_at,latitude,longitude,accuracy_meters FROM native_journey_markers[^"\n]*)"/)![1];

test('actual native marker SQL is durable, unique, and cascades only when its inbox session is acknowledged', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journeydeck-markers-')), path = join(directory, 'inbox.db');
  let db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys=ON;'); db.exec(sessionSchema); db.exec(markerSchema);
    db.prepare("INSERT INTO native_recording_sessions(id,owner_user_id,device_id,status,started_at,created_at,updated_at) VALUES('session','owner','phone','recording',?,?,?)").run('2026-09-17T12:00:00Z', '2026-09-17T12:00:00Z', '2026-09-17T12:00:00Z');
    db.prepare(markerInsert).run('marker_00000000-0000-4000-8000-000000000000', 'session', '2026-09-17T12:00:03Z', '2026-09-17T12:00:02Z', 0, 0, 5);
    db.close(); db = new DatabaseSync(path); db.exec('PRAGMA foreign_keys=ON;');
    assert.equal(db.prepare(markerExport).all('session').length, 1);
    assert.throws(() => db.prepare(markerInsert).run('marker_00000000-0000-4000-8000-000000000000', 'session', '2026-09-17T12:00:03Z', '2026-09-17T12:00:02Z', 0, 0, 5), /UNIQUE/);
    assert.throws(() => db.prepare(markerInsert).run('bad', 'session', '2026-09-17T12:00:03Z', '2026-09-17T12:00:02Z', 100, 0, 5), /CHECK/);
    db.prepare("DELETE FROM native_recording_sessions WHERE id=? AND status='completed'").run('session');
    assert.equal(db.prepare(markerExport).all('session').length, 1);
    db.exec("UPDATE native_recording_sessions SET status='completed',ended_at='2026-09-17T12:01:00Z'; DELETE FROM native_recording_sessions WHERE status='completed';");
    assert.equal(db.prepare(markerExport).all('session').length, 0);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('master marker and notes survive closing and reopening the actual SQLite file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'journeydeck-marker-archive-')), path = join(directory, 'archive.db');
  let h = fixture(path);
  try {
    const snapshot = completedNative();
    const id = 'marker_00000000-0000-4000-8000-000000000001';
    Object.assign(snapshot.sessions[0], { markers: [{ id, capturedAt: '2026-09-12T12:00:03.000Z', locationAt: '2026-09-12T12:00:02.000Z', latitude: 0, longitude: 0, accuracyMeters: 5 }] });
    h.storage.importNativeRecorderInbox(snapshot);
    h.database.prepare('UPDATE local_journey_markers SET notes=? WHERE id=?').run('Saved after a drive', id);
    h.database.close(); h = fixture(path);
    h.storage.importNativeRecorderInbox(snapshot);
    assert.equal(h.database.prepare('SELECT notes FROM local_journey_markers WHERE id=?').get(id)?.notes, 'Saved after a drive');
  } finally { h.database.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('native capture is serialized and fenced to a recording session, owner, token, and recent accurate GPS fix', () => {
  const capture = source.slice(source.indexOf('  func createMarker('), source.indexOf('  func exportInbox('));
  for (const check of ['workQueue.async', 'identity.owner', 'expectedToken ==', 'session.id == sessionID', 'session.status == "recording"', 'accuracy <= 100', 'capturedAt.timeIntervalSince(date) <= 30', 'date >= session.startedAt']) assert.ok(capture.includes(check), check);
  assert.doesNotMatch(capture, /startSession|startManual/);
});
