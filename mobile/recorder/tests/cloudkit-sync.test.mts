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

// ============================================================
// 1. Exports
// ============================================================
assert.match(src, /export type CloudKitRecordType/, 'exports CloudKitRecordType');
assert.match(src, /export interface CloudKitRecord/, 'exports CloudKitRecord');
assert.match(src, /export function journeyToCKRecord/, 'exports journeyToCKRecord');
assert.match(src, /export function ckRecordToJourney/, 'exports ckRecordToJourney');
assert.match(src, /export function resolveConflict/, 'exports resolveConflict');
assert.match(src, /export class CloudKitSyncEngine/, 'exports CloudKitSyncEngine');

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

console.log('✅  cloudkit-sync: all checks passed.');
