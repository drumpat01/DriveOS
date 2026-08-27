/**
 * local-store.test.mts
 *
 * Structural and logic tests for the on-device master SQLite store.
 * Follows the same pattern as other test files in this project:
 * file-text assertions + logic verification via Node test runner.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dir, '../src/local-store.ts'), 'utf8');
const recorderStorageSrc = readFileSync(resolve(__dir, '../src/storage.ts'), 'utf8');

// ============================================================
// 1. Type exports
// ============================================================

assert.match(src, /export type LocalUserId/, 'exports LocalUserId type');
assert.match(src, /export type LocalUser\s*=/, 'exports LocalUser type');
assert.match(src, /export type LocalJourney\s*=/, 'exports LocalJourney type');
assert.match(src, /export type LocalGpsPoint\s*=/, 'exports LocalGpsPoint type');
assert.match(src, /export type LocalMusicEntry\s*=/, 'exports LocalMusicEntry type');
assert.match(src, /export type LocalPlace\s*=/, 'exports LocalPlace type');
assert.match(src, /export type LocalCollection\s*=/, 'exports LocalCollection type');
assert.match(src, /export type LocalMemory\s*=/, 'exports LocalMemory type');
assert.match(src, /export type LocalAtlasSnapshot\s*=/, 'exports LocalAtlasSnapshot type');

// ============================================================
// 2. Database initialisation
// ============================================================

assert.match(src, /PRAGMA journal_mode = WAL/, 'enables WAL mode');
assert.match(src, /PRAGMA foreign_keys = ON/, 'enables foreign keys');
assert.match(src, /PRAGMA user_version/, 'uses additive migration via user_version');
assert.match(src, /MIGRATIONS/, 'migration array exists');
assert.match(src, /withTransactionSync/, 'migrations run inside transactions');

// ============================================================
// 3. Schema — table definitions
// ============================================================

assert.match(src, /CREATE TABLE IF NOT EXISTS local_users/, 'creates local_users table');
assert.match(src, /CREATE TABLE IF NOT EXISTS local_journeys/, 'creates local_journeys table');
assert.match(src, /CREATE TABLE IF NOT EXISTS local_gps_points/, 'creates local_gps_points table');
assert.match(src, /CREATE TABLE IF NOT EXISTS local_music_entries/, 'creates local_music_entries table');
assert.match(src, /CREATE TABLE IF NOT EXISTS local_places/, 'creates local_places table');
assert.match(src, /CREATE TABLE IF NOT EXISTS local_collections/, 'creates local_collections table');
assert.match(src, /CREATE TABLE IF NOT EXISTS local_memories/, 'creates local_memories table');
assert.match(src, /CREATE TABLE IF NOT EXISTS local_atlas_snapshots/, 'creates local_atlas_snapshots table');

// ============================================================
// 4. Schema — privacy-critical columns
// ============================================================

assert.match(src, /apple_subject TEXT UNIQUE/, 'local_users has apple_subject (Sign in with Apple)');
assert.match(src, /radius_meters/, 'local_places has privacy masking radius');
assert.match(src, /synced_to_cloud INTEGER NOT NULL DEFAULT 0/, 'sync flag defaults to unsynced');
assert.match(src, /kind TEXT NOT NULL CHECK\(kind IN \('home','work','custom','geocoded'\)\)/, 'place kind is constrained');

// ============================================================
// 5. Multi-user isolation: user_id FK on all major tables
// ============================================================

assert.match(src, /user_id TEXT NOT NULL REFERENCES local_users\(id\) ON DELETE CASCADE/, 'journeys cascade-delete on user removal');
// Check at least 3 tables use user_id FK (one match suffices since they all use same pattern)
const userFkCount = (src.match(/user_id TEXT NOT NULL REFERENCES local_users\(id\)/g) ?? []).length;
assert.ok(userFkCount >= 5, `at least 5 tables have user_id FK, found ${userFkCount}`);

// ============================================================
// 6. GPS points privacy (raw GPS stays local)
// ============================================================

assert.match(src, /journey_id TEXT NOT NULL REFERENCES local_journeys\(id\) ON DELETE CASCADE/, 'GPS points deleted when journey deleted');
assert.match(src, /PRIMARY KEY \(journey_id, sequence\)/, 'GPS points have composite PK');

// ============================================================
// 7. CRUD function exports
// ============================================================

assert.match(src, /export function initializeLocalStore/, 'exports initializeLocalStore');
assert.match(src, /export function ensureLocalUser/, 'exports ensureLocalUser');
assert.match(src, /export function listLocalUsers/, 'exports listLocalUsers');
assert.match(src, /export function upsertJourney/, 'exports upsertJourney');
assert.match(src, /export function listJourneys/, 'exports listJourneys');
assert.match(src, /export function getJourney/, 'exports getJourney');
assert.match(src, /export function insertGpsPoints/, 'exports insertGpsPoints');
assert.match(src, /export function getJourneyRoute/, 'exports getJourneyRoute');
assert.match(src, /export function upsertMusicEntry/, 'exports upsertMusicEntry');
assert.match(src, /export function listMusicEntries/, 'exports listMusicEntries');
assert.match(src, /export function upsertPlace/, 'exports upsertPlace');
assert.match(src, /export function getSensitivePlaces/, 'exports getSensitivePlaces');
assert.match(src, /export function findCachedPlace/, 'exports findCachedPlace');
assert.match(src, /export function upsertCollection/, 'exports upsertCollection');
assert.match(src, /export function listCollections/, 'exports listCollections');
assert.match(src, /export function upsertMemory/, 'exports upsertMemory');
assert.match(src, /export function listMemories/, 'exports listMemories');
assert.match(src, /export function writeAtlasSnapshot/, 'exports writeAtlasSnapshot');
assert.match(src, /export function readAtlasSnapshot/, 'exports readAtlasSnapshot');

// ============================================================
// 8. CloudKit sync helpers
// ============================================================

assert.match(src, /export function journeysPendingSync/, 'exports journeysPendingSync');
assert.match(src, /export function markJourneysSynced/, 'exports markJourneysSynced');
assert.match(src, /export function markMusicEntriesSynced/, 'exports markMusicEntriesSynced');

// ============================================================
// 9. Diagnostics
// ============================================================

assert.match(src, /export function localStoreDiagnostics/, 'exports localStoreDiagnostics');
assert.match(src, /schemaVersion/, 'diagnostics include schema version');
assert.match(src, /pendingSyncCount/, 'diagnostics include pending sync count');

// ============================================================
// 10. Upsert conflict resolution (ON CONFLICT DO UPDATE)
// ============================================================

const upsertCount = (src.match(/ON CONFLICT\(id\) DO UPDATE SET/g) ?? []).length;
assert.ok(upsertCount >= 4, `at least 4 tables use upsert, found ${upsertCount}`);

// ============================================================
// 11. Input bounds / guard function
// ============================================================

assert.match(src, /function guard/, 'guard helper for numeric bounds');
assert.match(src, /guard\(.*-90, 90\)/, 'latitude clamped to -90..90');
assert.match(src, /guard\(.*-180, 180\)/, 'longitude clamped to -180..180');

// ============================================================
// 12. Pagination pattern
// ============================================================

assert.match(src, /limit \+ 1/, 'pagination uses limit+1 probe for hasMore');
assert.match(src, /nextCursor/, 'pagination returns nextCursor');

// ============================================================
// 13. Deduplication of music entries
// ============================================================

assert.match(src, /45_000/, 'music dedup uses 45-second window');

// ============================================================
// 14. GeoJSON route output
// ============================================================

assert.match(src, /'LineString'/, 'getJourneyRoute returns GeoJSON LineString');
assert.match(src, /\[p\.longitude, p\.latitude\]/, 'GeoJSON uses [lng, lat] order');

// ============================================================
// 15. Haversine distance check in findCachedPlace
// ============================================================

assert.match(src, /6_371_000/, 'haversine uses Earth radius in meters');
assert.match(src, /Math\.asin/, 'haversine uses asin');

// ============================================================
// 16. Multi-user writes and sync acknowledgements enforce ownership
// ============================================================

assert.match(src, /function assertRowOwnership/, 'central ownership guard exists for ID-based upserts');
for (const table of ['local_journeys', 'local_music_entries', 'local_places', 'local_collections', 'local_memories']) {
  assert.match(src, new RegExp(`assertRowOwnership\\('${table}'`), `${table} upserts enforce local-user ownership`);
}
assert.match(src, /UPDATE local_journeys SET synced_to_cloud=1 WHERE user_id=\? AND id IN/, 'journey acknowledgements are scoped to the active user');
assert.match(src, /UPDATE local_music_entries SET synced_to_cloud=1 WHERE user_id=\? AND id IN/, 'music acknowledgements are scoped to the active user');

// ============================================================
// 17. Completed recorder sessions feed the master local store
// ============================================================

assert.match(recorderStorageSrc, /function mirrorCompletedSessionToLocalStore/, 'completed recordings have a local-master ingest path');
assert.match(recorderStorageSrc, /upsertJourney\(/, 'completed recordings persist a local journey summary');
assert.match(recorderStorageSrc, /insertGpsPoints\(/, 'completed recordings persist local GPS breadcrumbs');
assert.match(recorderStorageSrc, /upsertMusicEntry\(/, 'completed recordings persist local soundtrack observations');
assert.match(recorderStorageSrc, /mirrorCompletedSessionToLocalStore\(sessionId\)/, 'completion invokes local-master ingest');

console.log('✅  local-store: all 17 checks passed.');
