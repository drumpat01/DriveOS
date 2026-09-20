import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveVersionedPrivateConflict, uploadAcknowledgementMatches } from '../src/private-content-conflicts.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const localStore = readFileSync(resolve(__dir, '../src/local-store.ts'), 'utf8');
const cloudSync = readFileSync(resolve(__dir, '../src/cloudkit-sync.ts'), 'utf8');
const iCloudSync = readFileSync(resolve(__dir, '../src/icloud-sync.ts'), 'utf8');
const appData = readFileSync(resolve(__dir, '../src/app-data.ts'), 'utf8');
const nativeModule = readFileSync(resolve(__dir, '../modules/journeydeck-cloudkit/ios/JourneyDeckCloudKitModule.swift'), 'utf8');
const shell = readFileSync(resolve(__dir, '../src/shell.tsx'), 'utf8');

const base = { id: 'memory_1', updatedAt: '2026-08-27T12:00:00Z', syncRevision: 4, deletedAt: null as string | null };
const clockSkewedNewerRevision = { ...base, updatedAt: '2026-08-26T12:00:00Z', syncRevision: 5 };
assert.equal(resolveVersionedPrivateConflict(base, clockSkewedNewerRevision), clockSkewedNewerRevision, 'revision wins despite a device clock running behind');

const sameRevisionDelete = { ...base, deletedAt: '2026-08-27T11:59:00Z' };
assert.equal(resolveVersionedPrivateConflict(base, sameRevisionDelete), sameRevisionDelete, 'a tombstone wins an equal-revision edit/delete race');

const intentionalRestore = { ...sameRevisionDelete, deletedAt: null, syncRevision: 5, updatedAt: '2026-08-27T12:01:00Z' };
assert.equal(resolveVersionedPrivateConflict(sameRevisionDelete, intentionalRestore), intentionalRestore, 'a later revision can intentionally restore content');

assert.equal(uploadAcknowledgementMatches(7, 7), true, 'the uploaded revision can be acknowledged');
assert.equal(uploadAcknowledgementMatches(8, 7), false, 'an edit made during upload remains pending');

assert.match(localStore, /Migration 3 -- Phase 3\.5/, 'private content uses an additive SQLite migration');
assert.match(localStore, /CREATE TABLE IF NOT EXISTS local_photos/, 'photo metadata has a user-scoped local master table');
assert.match(localStore, /CREATE TABLE IF NOT EXISTS local_private_preferences/, 'preferences have a user-scoped local master table');
assert.match(localStore, /CREATE TABLE IF NOT EXISTS local_cloud_deletion_quarantine/, 'unversioned remote deletions are quarantined');
assert.doesNotMatch(localStore, /DELETE FROM local_(?:collections|memories|photos)/, 'user content is never hard-deleted during normal app operations');
assert.match(localStore, /UPDATE local_collections SET deleted_at=/, 'dormant legacy Collection rows retain safe tombstones');
assert.match(localStore, /UPDATE local_memories SET deleted_at=/, 'Memory deletion writes a tombstone');
assert.match(localStore, /UPDATE local_photos SET deleted_at=/, 'photo deletion writes a tombstone');
assert.match(localStore, /AND sync_revision=\?/, 'sync acknowledgement is conditional on the exact uploaded revision');

assert.match(cloudSync, /resolveVersionedPrivateConflict/, 'private CloudKit conflicts use revision-aware ordering');
assert.match(cloudSync, /privateContentV2/, 'new record types are gated from older native builds');
assert.match(iCloudSync, /getCloudKitCapabilities/, 'the sync session negotiates native private-content support');
assert.match(iCloudSync, /ingestRemoteDeletions/, 'physical CloudKit deletions enter the recovery path');
assert.match(iCloudSync, /ingestRemoteRecords[\s\S]*commitCloudKitChangeToken/, 'downloaded rows commit before advancing the CloudKit change token');

assert.match(appData, /FileSystem\.writeAsStringAsync\(localUri/, 'selected photos are persisted in the app document sandbox before sync');
const memorySave = appData.slice(appData.indexOf('async saveMemory('), appData.indexOf('async uploadMemoryPhoto('));
assert.doesNotMatch(memorySave, /request\(/, 'Memory edits do not write to the JourneyDeck server');
assert.doesNotMatch(appData, /async saveCollection|async uploadCollectionPhoto|async deleteCollection/, 'Collections have no V1 app-data API');
assert.match(appData, /return savePrivateMemoryPhoto\(memoryId/, 'Memory photos no longer require the JourneyDeck server');
assert.match(appData, /upsertPrivatePreference\(userId, 'vehicle\.preferences'/, 'vehicle preferences join the private sync model');
assert.match(nativeModule, /CKAsset\(fileURL:/, 'native CloudKit transport uploads photos as CKAsset');
assert.match(nativeModule, /JourneyDeckPrivateAssets/, 'downloaded CloudKit assets are copied out of the temporary staging area');
assert.match(nativeModule, /maximumPhotoAssetBytes/, 'native photo transport enforces a size boundary');
assert.match(nativeModule, /remoteDeleted != localDeleted \? remoteDeleted/, 'native conflict handling makes equal-revision tombstones authoritative');
assert.match(nativeModule, /serverRecordChangedWinner/, 'server-record-changed conflicts return the server winner for immediate local ingestion');
assert.match(nativeModule, /savePendingToken[\s\S]*commitPendingToken/, 'native change tokens use two-phase acknowledgement');
assert.match(shell, /<MemoriesScreen[\s\S]*onRefresh=\{\(\) => \{ void refreshMemories\(false\); void refreshPrimarySections\(false\); \}\}/, 'private-content saves refresh the narrow local catalog even if another dashboard section fails');

console.log('✅  private-content: conflict, deletion, photo, and preference safety checks passed.');
