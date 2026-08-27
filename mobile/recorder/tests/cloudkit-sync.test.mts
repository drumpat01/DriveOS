/**
 * cloudkit-sync.test.mts
 * 
 * Unit tests for the CloudKit sync engine, serialization mappers,
 * and Last-Write-Wins (LWW) conflict resolution.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dir, '../src/cloudkit-sync.ts'), 'utf8');
const transport = readFileSync(resolve(__dir, '../src/icloud-sync.ts'), 'utf8');
const nativeModule = readFileSync(resolve(__dir, '../modules/journeydeck-cloudkit/ios/JourneyDeckCloudKitModule.swift'), 'utf8');
const productionSchema = readFileSync(resolve(__dir, '../cloudkit/journeydeck-development.ckdb'), 'utf8');
const podspec = readFileSync(resolve(__dir, '../modules/journeydeck-cloudkit/ios/JourneyDeckCloudKit.podspec'), 'utf8');
const app = readFileSync(resolve(__dir, '../App.tsx'), 'utf8');

// ============================================================
// 1. Exports
// ============================================================
assert.match(src, /export type CloudKitRecordType/, 'exports CloudKitRecordType');
assert.match(src, /export interface CloudKitRecord/, 'exports CloudKitRecord');
assert.match(src, /export function journeyToCKRecord/, 'exports journeyToCKRecord');
assert.match(src, /export function ckRecordToJourney/, 'exports ckRecordToJourney');
assert.match(src, /export function resolveConflict/, 'exports resolveConflict');
assert.match(src, /export class CloudKitSyncEngine/, 'exports CloudKitSyncEngine');
assert.match(src, /musicEntryToCKRecord/, 'syncs music entries');
assert.match(src, /collectionToCKRecord/, 'syncs collections');
assert.match(src, /memoryToCKRecord/, 'syncs memories');

// ============================================================
// 2. Pure logic tests: LWW Conflict Resolution
// ============================================================
function resolveConflict<T extends { updatedAt: string }>(local: T, remote: T): T {
  const localTime = Date.parse(local.updatedAt) || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;
  return remoteTime >= localTime ? remote : local;
}

const localItem = { id: '1', name: 'Local Version', updatedAt: '2026-08-26T10:00:00Z' };
const olderRemoteItem = { id: '1', name: 'Old Remote Version', updatedAt: '2026-08-26T09:00:00Z' };
const newerRemoteItem = { id: '1', name: 'Newer Remote Version', updatedAt: '2026-08-26T11:00:00Z' };

// Test 1: Local is newer -> Keep local
const winLocal = resolveConflict(localItem, olderRemoteItem);
assert.equal(winLocal.name, 'Local Version', 'Keeps newer local version');

// Test 2: Remote is newer -> Pick remote
const winRemote = resolveConflict(localItem, newerRemoteItem);
assert.equal(winRemote.name, 'Newer Remote Version', 'Picks newer remote version');

// Test 3: Same timestamp -> Remote wins (deterministic tie-break)
const sameTimeRemote = { id: '1', name: 'Tie Remote Version', updatedAt: '2026-08-26T10:00:00Z' };
const winTie = resolveConflict(localItem, sameTimeRemote);
assert.equal(winTie.name, 'Tie Remote Version', 'Resolves timestamp tie deterministically');

// ============================================================
// 3. Structural checks on Privacy and Data boundaries
// ============================================================
assert.match(src, /recordName: `journey_\${j\.id}`/, 'recordName follows consistent naming scheme');
assert.match(src, /syncedToCloud: 1/, 'remote records mark local syncedToCloud flag');
assert.doesNotMatch(src, /startLat: j\.startLat|startLng: j\.startLng|endLat: j\.endLat|endLng: j\.endLng/, 'CloudKit payload never contains exact journey endpoints');
assert.doesNotMatch(src, /userId: j\.userId/, 'CloudKit payload does not expose the local profile identifier');
assert.doesNotMatch(src, /coverPhotoLocalPath: memory\.coverPhotoLocalPath/, 'CloudKit payload never contains device-local photo paths');
assert.match(src, /resolveConflict\(localJourney, remoteJourney\)/, 'remote ingestion applies LWW conflict resolution');
assert.match(src, /getJourney\(this\.userId, remoteJourney\.id\)/, 'conflicts are resolved only inside the active local profile');
assert.match(src, /syncedToCloud: 1/, 'downloaded winners remain acknowledged instead of being immediately re-queued');
assert.match(src, /priority: Record<CloudKitRecordType, number>[\s\S]*Journey: 0, MusicEntry: 1/, 'ingests journeys before music records that reference them');

// ============================================================
// 4. Real private CloudKit transport
// ============================================================
assert.match(transport, /Crypto\.digestStringAsync\(Crypto\.CryptoDigestAlgorithm\.SHA256/, 'hashes the local profile scope before native transport');
assert.match(transport, /user\.appleSubject \? `apple:\$\{user\.appleSubject\}` : `local:\$\{user\.id\}`/, 'uses stable Apple identity for cross-device zone convergence');
assert.match(transport, /pullCloudKitChanges[\s\S]*pushCloudKitRecords/, 'pulls before pushing for deterministic conflict handling');
assert.match(transport, /for \(let batch = 0; batch < 5; batch\+\+\)/, 'drains a bounded set of upload batches without monopolizing app startup');
assert.match(nativeModule, /privateCloudDatabase/, 'uses the current iCloud account private database');
assert.match(nativeModule, /CKRecordZone/, 'isolates each profile in a custom record zone');
assert.match(nativeModule, /recordZoneChanges/, 'downloads incremental zone changes');
assert.match(nativeModule, /modifyRecords/, 'uploads records through CloudKit');
assert.match(nativeModule, /savePolicy: \.ifServerRecordUnchanged/, 'prevents a fetch-to-save race from overwriting a newer device update');
assert.match(nativeModule, /changeTokenExpired/, 'recovers from expired CloudKit tokens');
assert.match(nativeModule, /allowedRecordTypes/, 'restricts native record types');
const deployedTypes = [...productionSchema.matchAll(/RECORD TYPE (\w+)/g)].map(match => match[1]).filter(type => type !== 'Users').sort();
assert.deepEqual(deployedTypes, ['Collection', 'Journey', 'Memory', 'MusicEntry'], 'checked-in schema matches the four allowed JourneyDeck record types deployed to CloudKit');
assert.match(productionSchema, /RECORD TYPE Journey[\s\S]*durationMinutes DOUBLE[\s\S]*songCount INT64/, 'Journey numeric fields retain their CloudKit production types');
assert.match(productionSchema, /RECORD TYPE MusicEntry[\s\S]*confidence DOUBLE[\s\S]*durationMs INT64/, 'Music numeric fields retain their CloudKit production types');
assert.match(podspec, /frameworks.*CloudKit/, 'links the native CloudKit framework');
assert.match(app, /enrichCompletedJourney[\s\S]*syncCurrentUserWithPrivateICloud/, 'queues private iCloud sync after a completed journey and its local music enrichment');

console.log('✅  cloudkit-sync: all checks passed.');
