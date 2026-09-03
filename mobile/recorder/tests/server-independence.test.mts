import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
const automaticDrive = await readFile(new URL('../src/automatic-drive-task.ts', import.meta.url), 'utf8');
const locationTask = await readFile(new URL('../src/location-task.ts', import.meta.url), 'utf8');
const tracking = await readFile(new URL('../src/tracking.ts', import.meta.url), 'utf8');
const entrypoint = await readFile(new URL('../index.ts', import.meta.url), 'utf8');
const appData = await readFile(new URL('../src/app-data.ts', import.meta.url), 'utf8');
const primaryData = await readFile(new URL('../src/primary-sections-data.ts', import.meta.url), 'utf8');
const storage = await readFile(new URL('../src/storage.ts', import.meta.url), 'utf8');
const completionJobs = await readFile(new URL('../src/completion-jobs.ts', import.meta.url), 'utf8');
const databaseHardening = await readFile(new URL('../src/database-hardening.ts', import.meta.url), 'utf8');
const iCloud = await readFile(new URL('../src/icloud-sync.ts', import.meta.url), 'utf8');
const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const localArchiveEvents = await readFile(new URL('../src/local-archive-events.ts', import.meta.url), 'utf8');
const lastFm = await readFile(new URL('../src/lastfm-sync.ts', import.meta.url), 'utf8');
const spotify = await readFile(new URL('../src/spotify-direct.ts', import.meta.url), 'utf8');
const tessie = await readFile(new URL('../src/tessie-direct.ts', import.meta.url), 'utf8');
const musicCapture = await readFile(new URL('../src/music-capture.ts', import.meta.url), 'utf8');
const primarySections = await readFile(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
const releaseFeatures = await readFile(new URL('../src/release-features.ts', import.meta.url), 'utf8');
const credentials = await readFile(new URL('../src/credentials.ts', import.meta.url), 'utf8');
const profileSecrets = await readFile(new URL('../src/profile-secure-store.ts', import.meta.url), 'utf8');
const nativeRecorder = await readFile(new URL('../modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift', import.meta.url), 'utf8');

test('manual finish commits to the on-device archive before optional remote sync', () => {
  const finish = app.slice(app.indexOf('const finishSession'), app.indexOf('const finish =', app.indexOf('const finishSession')));
  assert.ok(finish.indexOf('completeSessionLocally(currentSummary.id, Boolean(connection))') >= 0);
  assert.ok(finish.indexOf('completeSessionLocally(currentSummary.id, Boolean(connection))') < finish.indexOf('enrichCompletedJourney(connection, currentSummary.id)'));
  assert.match(finish, /setSyncStage\('saved'\)/);
  assert.doesNotMatch(finish, /await completeRecording|await flushRecording/);
});

test('local completion invalidates the visible archive without a server refresh', () => {
  assert.match(storage, /notifyLocalArchiveChanged\(\)/);
  assert.match(shell, /subscribeLocalArchiveChanges\(\(\) => \{ void refreshPrimarySections\(false\); \}\)/);
  assert.match(localArchiveEvents, /const listeners = new Set<LocalArchiveListener>\(\)/);
});

test('active recording has no automatic JourneyDeck mirror loop', () => {
  assert.equal((app.match(/await flushRecording\(/g) ?? []).length, 1, 'only the explicit Sync saved data action may flush an active recording');
  assert.doesNotMatch(app, /setTimeout\([\s\S]{0,220}flushRecording/);
  assert.doesNotMatch(locationTask, /flushRecording|completeRecording/);
  assert.doesNotMatch(automaticDrive, /flushRecording|completeRecording/);
  assert.match(automaticDrive, /completeSessionLocally\(sessionId, Boolean\(connection\)\)/);
  assert.doesNotMatch(nativeRecorder, /https?:\/\/|URLSession|JourneyDeck credentials/);
});

test('completed sessions remain queued locally and remote retries stop after one connectivity failure', () => {
  assert.match(databaseHardening, /remote_completed INTEGER NOT NULL DEFAULT 0/);
  assert.match(storage, /sessionsPendingRemoteCompletion/);
  assert.match(storage, /status='completed' AND s\.remote_completed=0/);
  assert.match(api, /for \(const sessionId of sessionsPendingRemoteCompletion\(limit\)\)/);
  assert.match(api, /catch \{[\s\S]{0,240}break;/);
  assert.match(databaseHardening, /CREATE TABLE IF NOT EXISTS recording_jobs/);
  assert.match(storage, /claimNextCompletionJob/);
  assert.match(completionJobs, /markCompletionJobForRetry/);
  assert.match(completionJobs, /break;/);
});

test('normal archive navigation stays local even when the user refreshes', () => {
  assert.match(appData, /async dashboard\(_refreshRemote = false\)/);
  assert.match(appData, /async journeys\(limit = 25, cursor\?: string, _refreshRemote = false\)/);
  assert.match(appData, /async memories\(_refreshRemote = false\)/);
  assert.match(appData, /async musicDashboard\(refreshRemote = false, details: JourneyDetail\[\] = \[\]\)/);
  assert.match(primaryData, /appDataClient\.dashboard\(forceRefresh\)/);
  assert.match(primaryData, /loadJourneyArchive\(membership, forceRefresh\)/);
  assert.match(primaryData, /const seenCursors = new Set<string>\(\)/);
  assert.match(primaryData, /if \(seenCursors\.has\(result\.nextCursor\)\) break/);
  const normalDashboard = appData.slice(appData.indexOf('async dashboard('), appData.indexOf('async localDashboard('));
  const normalJourneys = appData.slice(appData.indexOf('async journeys('), appData.indexOf('async journey('));
  const normalMemories = appData.slice(appData.indexOf('async memories('), appData.indexOf('async musicDashboard('));
  assert.doesNotMatch(`${normalDashboard}${normalJourneys}${normalMemories}`, /request<|request\(/);
  assert.doesNotMatch(appData, /importLegacyOwnerArchive/, 'the retired hierarchy import is absent from V1');
});

test('clean profiles can record manually without JourneyDeck credentials', () => {
  assert.match(credentials, /export async function loadOrCreateDeviceId\(\)/);
  assert.match(app, /beginLocalSession\(deviceId\)/);
  assert.doesNotMatch(app, /Connect this recorder to JourneyDeck first/);
  assert.match(nativeRecorder, /private func startSession\(identity:/);
  assert.match(nativeRecorder, /INSERT INTO native_recording_sessions\(id,owner_user_id,device_id,status/);
  assert.doesNotMatch(nativeRecorder, /loadConnection|JourneyDeck credentials/);
});

test('Build 12 automatic journeys use the Expo safety fallback without sharing Swift SQLite', () => {
  assert.doesNotMatch(locationTask, /processAutomaticDriveLocations/);
  assert.match(releaseFeatures, /NATIVE_AUTOMATIC_RECORDER_ENABLED: boolean = false/);
  assert.match(entrypoint, /\.\/src\/automatic-drive-task/);
  assert.match(automaticDrive, /evaluateDriveDetection/);
  assert.match(automaticDrive, /startDetectedJourney/);
  assert.match(automaticDrive, /finishDetectedJourney/);
  assert.match(app, /configureNativeAutomaticRecorder\(false,[\s\S]*startAutomaticDetection\(\)/);
  assert.match(nativeRecorder, /journeydeck-native-inbox\.db/);
  assert.doesNotMatch(nativeRecorder, /journeydeck-local\.db/);
});

test('background GPS stays functional without opting into the persistent blue iOS indicator', () => {
  assert.match(tracking, /showsBackgroundLocationIndicator: false/);
  assert.doesNotMatch(tracking, /showsBackgroundLocationIndicator: true/);
  assert.match(nativeRecorder, /showsBackgroundLocationIndicator = false/);
  assert.doesNotMatch(nativeRecorder, /showsBackgroundLocationIndicator = true/);
  assert.match(entrypoint, /\.\/src\/automatic-drive-task/);
  assert.match(automaticDrive, /defineTask<\{ locations: LocationObject\[\] \}>\(AUTOMATIC_DETECTION_TASK_NAME/);
});

test('recorder sessions and screen caches are isolated by active profile', () => {
  assert.match(databaseHardening, /recording_sessions[\s\S]*?owner_user_id TEXT NOT NULL REFERENCES local_users/);
  assert.match(storage, /WHERE owner_user_id=\? AND status!='completed'/);
  assert.match(storage, /`user:\$\{getCurrentUser\(\)\.id\}:\$\{key\}`/);
  assert.match(storage, /__legacy_cache_owner_v1/);
  assert.match(credentials, /profileKey\(SERVER_KEY\)/);
  assert.match(credentials, /CONNECTION_OWNER_KEY/);
});

test('preferences and place names are private profile data, not normal server writes', () => {
  const places = appData.slice(appData.indexOf('async savePlaceAlias('), appData.indexOf('async memories('));
  const preferences = appData.slice(appData.indexOf('async providerPreferences('), appData.indexOf('async connectionCapabilities('));
  assert.match(places, /upsertPrivatePreference/);
  assert.match(preferences, /upsertPrivatePreference/);
  assert.doesNotMatch(`${places}${preferences}`, /request<|request\(/);
});

test('automatic iCloud checks are coalesced while explicit sync can force a pass', () => {
  assert.match(iCloud, /AUTOMATIC_SYNC_COOLDOWN_MS = 15 \* 60_000/);
  assert.match(iCloud, /!options\.force && recent/);
  assert.match(completionJobs, /syncCurrentUserWithPrivateICloud\(\{ force: true \}\)/);
});

test('internal Last.fm history is imported through the stateless privacy edge and saved on device', () => {
  assert.match(lastFm, /\/api\/music\/lastfm\/recent/);
  assert.match(lastFm, /saveImportedMusicForCompletedSession/);
  assert.doesNotMatch(lastFm, /appDataClient|\/api\/recorder\/sessions/);
});

test('direct Spotify remains a local owner capability with PKCE and no JourneyDeck server transport', () => {
  assert.match(spotify, /code_challenge_method: 'S256'/);
  assert.match(spotify, /loadProfileSecret\(TOKEN_KEY\)/);
  assert.match(profileSecrets, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
  assert.match(spotify, /user-read-recently-played/);
  assert.doesNotMatch(spotify, /requestJourneyDeckJson|loadConnection/);
});

test('version 1 disables Tessie and automatic recording for every membership tier', () => {
  assert.match(releaseFeatures, /TESSIE_INTEGRATION_ENABLED: boolean = false/);
  assert.match(tessie, /entitlementsForVerifiedMembership\(await getMembershipStatus\(\)\)\.tessieAccess/);
  assert.match(tessie, /TESSIE_VERIFIED_VEHICLE_KEY/);
  assert.match(tessie, /if \(vehicleCount < 1\) throw new Error\('Tessie did not find an active Tesla/);
  assert.match(tessie, /tessieDirectStatus[\s\S]*?tessieAutomaticRecordingEligible/);
  assert.match(tessie, /sampleTessieMedia[\s\S]*?if \(!\(await tessieAutomaticRecordingEligible\(\)\)\) return null/);
  assert.match(musicCapture, /sampleTessieMediaForActiveSession[\s\S]*?if \(!TESSIE_INTEGRATION_ENABLED\) return \{ status: 'unavailable' \}/);
  assert.match(automaticDrive, /!current && !\(await tessieAutomaticRecordingEligible\(\)\)/);
  assert.match(locationTask, /TESSIE_INTEGRATION_ENABLED \? \[sampleTessieMediaForActiveSession/);
  assert.match(appData, /if \(!TESSIE_INTEGRATION_ENABLED\) return localVehicleIntelligence\(userId\)/);
  assert.match(primarySections, /if \(!active \|\| !TESSIE_INTEGRATION_ENABLED\) return/);
  assert.doesNotMatch(shell, /from '\.\/tessie-direct'|Tessie Automatic Recording|Drive intelligence/i);
  assert.match(app, /const automaticMode = TESSIE_INTEGRATION_ENABLED &&/);
});
