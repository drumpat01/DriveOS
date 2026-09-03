/**
 * local-atlas-client.test.mts
 *
 * Structural tests for the Phase 1.4 localAtlasClient export in app-data.ts.
 * Verifies the client is correctly wired to local-store.ts and local-atlas.ts,
 * exposes the right API surface, and has the correct offline-first semantics.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dir, '../src/app-data.ts'), 'utf8');
const placeMatchingSrc = readFileSync(resolve(__dir, '../src/place-matching.ts'), 'utf8');

// ============================================================
// 1. localAtlasClient is exported
// ============================================================

assert.match(src, /export const localAtlasClient/, 'exports localAtlasClient');

// ============================================================
// 2. Imports from the correct on-device modules
// ============================================================

assert.match(src, /from '\.\/local-store'/, 'imports from local-store');
assert.match(src, /from '\.\/local-atlas'/, 'imports from local-atlas');
assert.match(src, /initializeLocalStore/, 'imports initializeLocalStore');
assert.match(src, /ensureLocalUser/, 'imports ensureLocalUser');
assert.match(src, /listJourneys/, 'imports listJourneys');
assert.match(src, /getJourney/, 'imports getJourney');
assert.match(src, /listMusicEntries/, 'imports listMusicEntries');
assert.match(src, /listMemories/, 'imports listMemories');
assert.match(src, /readAtlasSnapshot/, 'imports readAtlasSnapshot');
assert.match(src, /localStoreDiagnostics/, 'imports localStoreDiagnostics');
assert.match(src, /rebuildAtlasSnapshot/, 'imports rebuildAtlasSnapshot');
assert.match(src, /computeAllTime/, 'imports computeAllTime');
assert.match(src, /computeLast7Days/, 'imports computeLast7Days');
assert.match(src, /computeWeeklyTour/, 'imports computeWeeklyTour');
assert.match(src, /computeDrivingStreak/, 'imports computeDrivingStreak');
assert.match(src, /computeMusicMetrics/, 'imports computeMusicMetrics');
assert.match(src, /computeTopArtists/, 'imports computeTopArtists');
assert.match(src, /computeMoodBreakdown/, 'imports computeMoodBreakdown');

// ============================================================
// 3. API surface of localAtlasClient
// ============================================================

assert.match(src, /ensureUser\(appleSubject\?/, 'client.ensureUser() accepts optional appleSubject');
assert.match(src, /dashboard\(userId: LocalUserId\)/, 'client.dashboard() takes userId');
assert.match(src, /journeys\(userId: LocalUserId/, 'client.journeys() takes userId');
assert.match(src, /journey\(userId: LocalUserId, journeyId: string\)/, 'client.journey() takes userId + journeyId');
assert.match(src, /musicDashboard\(userId: LocalUserId\)/, 'client.musicDashboard() takes userId');
assert.match(src, /memories\(userId: LocalUserId\)/, 'client.memories() takes userId');
assert.match(src, /diagnostics\(userId: LocalUserId\)/, 'client.diagnostics() takes userId');
assert.match(src, /rebuildAtlas\(userId: LocalUserId\)/, 'client.rebuildAtlas() takes userId');

// ============================================================
// 4. Return types match existing appDataClient types
// ============================================================

assert.match(src, /: AppDashboard \{/, 'dashboard() returns AppDashboard');
assert.match(src, /: JourneyDetail \| null/, 'journey() returns JourneyDetail | null');
assert.match(src, /: MusicDashboardData \{/, 'musicDashboard() returns MusicDashboardData');
assert.match(src, /: MemoriesCatalog \{/, 'memories() returns MemoriesCatalog');
assert.match(src, /satisfies JourneyMemory/, 'memories mapped to JourneyMemory');
assert.match(src, /JSON\.parse\(m\.journeyIds\)/, 'Memories read direct Journey membership');
assert.doesNotMatch(src, /JourneyCollection/, 'Collections are not part of the V1 product data model');

// ============================================================
// 5. Offline-first behaviour
// ============================================================

assert.match(src, /ATLAS_STALE_MS = 5 \* 60_000/, 'snapshot freshness threshold is 5 minutes');
assert.match(src, /readAtlasSnapshot\(userId\) \?\? rebuildAtlasSnapshot/, 'rebuilds snapshot if missing using ?? pattern');
assert.match(src, /Date\.now\(\) - Date\.parse\(freshSnapshot\.generatedAt\)/, 'computes snapshot age');
assert.match(src, /recorder: localRecorderHealth\(false\)/, 'dashboard reports connected:false (offline by default)');

// ============================================================
// 6. localJourneyToSummary shape
// ============================================================

assert.match(src, /function localJourneyToSummary/, 'localJourneyToSummary mapper exists');
assert.match(src, /soundtrackPreview: \[\]/, 'soundtrackPreview defaults to empty array (no server needed)');
assert.match(src, /const startingPlace = j\.startPlaceId \? getPlace/, 'resolves startPlaceId through the canonical place table');
assert.match(src, /const endingPlace = j\.endPlaceId \? getPlace/, 'resolves endPlaceId through the canonical place table');
assert.match(src, /startingLocation: startingPlace\?\.label/, 'maps the canonical start label into the journey');
assert.match(src, /endingLocation: endingPlace\?\.label/, 'maps the canonical destination label into the journey');
assert.match(src, /coordinatePlaceAliasIdentity/, 'creates a stable local identity for GPS-only endpoints');
assert.match(placeMatchingSrc, /latitude\.toFixed\(3\).*longitude\.toFixed\(3\)/, 'coarsens the exact endpoint identity');
assert.match(src, /findNamedPlace/, 'resolves user-named places by nearby GPS distance');
assert.match(src, /startingLocationKey,\s*endingLocationKey,/, 'includes stable endpoint keys in local journey summaries');
assert.match(src, /startingLocationKey: startKey/, 'rehydrates the same start key when local aliases are applied');
assert.match(src, /endingLocationKey: endKey/, 'rehydrates the same destination key when local aliases are applied');

// ============================================================
// 7. MusicDashboard offline fields
// ============================================================

assert.match(src, /cities: \[\]/, 'local engine starts with an offline-safe city list');
assert.match(src, /daily: \[\]/, 'daily empty pending Phase 1.5 aggregation');
assert.match(src, /loadMusicCitySummary/, 'music dashboard enriches city labels through the privacy-safe Phase 3 boundary');

// ============================================================
// 8. Pagination support
// ============================================================

assert.match(src, /nextCursor: result\.nextCursor/, 'journeys() propagates nextCursor for pagination');

// ============================================================
// 9. JourneyDetail local shape
// ============================================================

assert.match(src, /startingBatteryPercent: null/, 'battery data not available locally');
assert.match(src, /energyUsedKwh: null/, 'energy data not available locally');
assert.match(src, /tessieTag: null/, 'tessie tag not available locally');
assert.match(src, /const route = getJourneyRoute\(userId, j\.id\)/, 'journey detail loads its exact on-device route');
assert.match(src, /listMusicEntriesForJourney\(userId, j\.id\)/, 'journey detail loads its on-device soundtrack');
assert.match(src, /coordinateAtRecordedTime\(samples, entry\.playedAt\)/, 'song moments use timestamped on-device GPS breadcrumbs');

// ============================================================
// 10. appDataClient is still present (not replaced)
// ============================================================

assert.match(src, /export const appDataClient/, 'original appDataClient still exported');
assert.match(src, /async dashboard\(_refreshRemote = false\)/, 'appDataClient.dashboard() stays local even when the user refreshes');
assert.doesNotMatch(src, /importLegacyOwnerArchive/, 'the retired hierarchy import is not exposed in V1');
assert.match(src, /localAtlasClient[\s\S]*dashboard\(userId/, 'localAtlasClient.dashboard is sync (local-first)');
assert.match(src, /localAtlasClient\.dashboard\(getCurrentUser\(\)\.id\)/, 'live dashboard falls back to the on-device Atlas client');
assert.match(src, /localAtlasClient\.journeys\(getCurrentUser\(\)\.id/, 'live journey history falls back to the on-device store');
assert.match(src, /localAtlasClient\.musicDashboard\(userId\)/, 'live music dashboard is built from on-device analytics');

console.log('✅  local-atlas-client: all 10 check groups passed.');
