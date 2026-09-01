import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  coordinateFromPlaceAliasIdentity, coordinatePlaceAliasIdentity, coordinatesShareSavedPlace,
  distanceBetweenCoordinatesMeters, SAVED_PLACE_MATCH_RADIUS_METERS,
} from '../src/place-matching.ts';

const sourceRoot = new URL('../', import.meta.url);
const musicCapture = await readFile(new URL('src/music-capture.ts', sourceRoot), 'utf8');
const app = await readFile(new URL('App.tsx', sourceRoot), 'utf8');
const automaticDrive = await readFile(new URL('src/automatic-drive-task.ts', sourceRoot), 'utf8');
const completionJobs = await readFile(new URL('src/completion-jobs.ts', sourceRoot), 'utf8');
const storage = await readFile(new URL('src/storage.ts', sourceRoot), 'utf8');
const databaseOwner = await readFile(new URL('src/database-owner.ts', sourceRoot), 'utf8');
const unifiedMigration = await readFile(new URL('src/unified-data-migration.ts', sourceRoot), 'utf8');
const localStore = await readFile(new URL('src/local-store.ts', sourceRoot), 'utf8');
const localAtlas = await readFile(new URL('src/local-atlas.ts', sourceRoot), 'utf8');
const nativeMusic = await readFile(new URL('modules/journeydeck-music/ios/JourneyDeckMusicModule.swift', sourceRoot), 'utf8');

test('ordinary GPS drift resolves to one user-named place while distinct places stay separate', () => {
  const driveway = { latitude: 32.93412, longitude: -97.07821 };
  const nextArrival = { latitude: 32.93448, longitude: -97.07856 };
  const otherPlace = { latitude: 32.939, longitude: -97.07821 };
  assert.ok(distanceBetweenCoordinatesMeters(driveway, nextArrival) < SAVED_PLACE_MATCH_RADIUS_METERS);
  assert.equal(coordinatesShareSavedPlace(driveway, nextArrival), true);
  assert.equal(coordinatesShareSavedPlace(driveway, otherPlace), false);
  const identity = coordinatePlaceAliasIdentity(driveway.latitude, driveway.longitude);
  assert.ok(identity);
  assert.deepEqual(coordinateFromPlaceAliasIdentity(identity!), { latitude: 32.934, longitude: -97.078 });
});

test('every journey completion path repairs and disk-caches compact Apple Music artwork', () => {
  const completion = musicCapture.slice(musicCapture.indexOf('export async function captureAppleMusicHistoryForSession'), musicCapture.indexOf('export async function refreshRecentAppleMusicArtwork'));
  assert.match(completion, /const journeyId = archivedJourneyIdForSession\(sessionId\)/);
  assert.match(completion, /resolveMissingAppleMusicArtwork\(15, \{ journeyId \}\)/);
  assert.match(completion, /cacheJourneyArtworkOnDisk\(sessionId\)/);
  assert.match(musicCapture, /listMusicEntriesForJourney\(getCurrentUser\(\)\.id, journeyId\)/);
  assert.match(musicCapture, /Image\.prefetch\(urls, 'disk'\)/);
  assert.match(musicCapture, /markArtworkUrlsCached\(getCurrentUser\(\)\.id, urls\)/);
  assert.match(nativeMusic, /artwork\?\.url\(width: 256, height: 256\)/);
  assert.match(app, /function enrichCompletedJourney\(connection: Connection \| null/);
  assert.match(app, /completeSessionLocally\(current\.id,[\s\S]*?enrichCompletedJourney\(connection, current\.id\)/);
  assert.match(app, /completeSessionLocally\(currentSummary\.id,[\s\S]*?enrichCompletedJourney\(connection, currentSummary\.id\)/);
  assert.match(automaticDrive, /completeSessionLocally\(sessionId,[\s\S]*?processPendingCompletionJobs\(\{ connection, sessionId/);
  assert.match(completionJobs, /captureAppleMusicHistoryForSession\(job\.sessionId\)/);
});

test('completion is retryable and recorder/archive use one unified live SQLite handle', () => {
  const completion = storage.slice(storage.indexOf('export function completeSessionLocally'), storage.indexOf('export function refreshCompletedSessionLocalMirror'));
  assert.match(completion, /db\.withTransactionSync/);
  assert.match(completion, /enqueueCompletionJobInTransaction\(sessionId, session\.owner_user_id, 'archive_mirror'/);
  assert.match(completion, /enqueueCompletionJobInTransaction\(sessionId, session\.owner_user_id, 'apple_music_history'/);
  assert.match(storage, /lease_expired/);
  assert.match(completionJobs, /markCompletionJobForRetry/);
  assert.match(databaseOwner, /getMasterDatabase/);
  assert.match(databaseOwner, /function getRecorderDatabase[\s\S]*?return getMasterDatabase\(\)/);
  assert.match(unifiedMigration, /ATTACH DATABASE \? AS legacy_recorder/);
  assert.match(unifiedMigration, /legacy\.closeSync\(\)/);
  assert.doesNotMatch(unifiedMigration, /DELETE FROM legacy_recorder|DROP TABLE legacy_recorder/);
  assert.match(unifiedMigration, /local_migration_state/);
  assert.doesNotMatch(localStore, /openDatabaseSync/);
  assert.doesNotMatch(localAtlas, /openDatabaseSync/);
  assert.doesNotMatch(storage, /openDatabaseSync/);
});
