import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('Build 13 isolates Swift recording while the proven safety fallback owns automatic start', () => {
  const config = JSON.parse(source('app.json'));
  const moduleConfig = JSON.parse(source('modules/journeydeck-recorder/expo-module.config.json'));
  const swift = source('modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift');
  const subscriber = source('modules/journeydeck-recorder/ios/JourneyDeckRecorderAppDelegateSubscriber.swift');
  const app = source('App.tsx');
  const entrypoint = source('index.ts');
  const automaticTask = source('src/automatic-drive-task.ts');
  const releaseFeatures = source('src/release-features.ts');
  const manualTask = source('src/location-task.ts');
  const storage = source('src/storage.ts');
  const inbox = source('src/native-recorder-inbox.ts');

  assert.equal(config.expo.version, '1.9.0');
  assert.equal(config.expo.runtimeVersion, '1.9.0-build13');
  assert.deepEqual(moduleConfig.apple.modules, ['JourneyDeckRecorderModule']);
  assert.deepEqual(moduleConfig.apple.appDelegateSubscribers, ['JourneyDeckRecorderAppDelegateSubscriber']);
  assert.match(subscriber, /didFinishLaunchingWithOptions/);
  assert.match(subscriber, /JourneyDeckNativeRecorder\.shared\.bootstrap/);
  assert.match(swift, /startMonitoringSignificantLocationChanges/);
  assert.match(swift, /startUpdatingLocation/);
  assert.match(swift, /driveStartConfirmationGrace: TimeInterval = 90/);
  assert.match(swift, /startConfirmationBurstIfAuthorized/);
  assert.match(swift, /DispatchQueue\.main\.asyncAfter\(deadline: \.now\(\) \+ driveStartConfirmationGrace/);
  const nativeStartEvaluation = swift.slice(swift.indexOf('private func evaluateStart'), swift.indexOf('private func recordAndEvaluate'));
  const nonqualifyingSpeedBranch = nativeStartEvaluation.slice(nativeStartEvaluation.indexOf('guard let speed'), nativeStartEvaluation.indexOf('let timestamp'));
  assert.doesNotMatch(nonqualifyingSpeedBranch, /stopPreciseTracking/);
  assert.match(nativeStartEvaluation, /appendPreRoll\(location\)/);
  assert.match(swift, /allowsBackgroundLocationUpdates = true/);
  assert.match(swift, /journeydeck-native-inbox\.db/);
  assert.doesNotMatch(swift, /journeydeck-local\.db/);
  assert.match(swift, /PRAGMA journal_mode=DELETE/);
  assert.match(swift, /native_recording_sessions/);
  assert.match(swift, /native_recording_points/);
  assert.match(swift, /exportInboxAsync/);
  assert.match(swift, /acknowledgeCompletedSessionsAsync/);
  assert.doesNotMatch(swift, /INSERT INTO recording_jobs/);
  assert.match(swift, /BEGIN IMMEDIATE/);
  assert.match(swift, /native_recording_/);
  assert.match(swift, /sequence>=\?/);
  assert.match(swift, /FileProtectionType\.completeUntilFirstUserAuthentication/);
  assert.match(storage, /archive_mirror.*apple_music_history.*private_cloud_sync.*remote_completion/s);
  const configureBridge = swift.slice(swift.indexOf('AsyncFunction("configureAsync")'), swift.indexOf('AsyncFunction("getStatusAsync")'));
  assert.doesNotMatch(configureBridge, /runOnQueue/, 'Expo async bridge functions cannot use the synchronous queue modifier');
  assert.match(releaseFeatures, /NATIVE_AUTOMATIC_RECORDER_ENABLED: boolean = false/);
  assert.match(app, /configureNativeAutomaticRecorder\(false,[\s\S]*startAutomaticDetection\(\)/);
  assert.match(entrypoint, /\.\/src\/automatic-drive-task/);
  assert.match(automaticTask, /defineTask<\{ locations: LocationObject\[\] \}>\(AUTOMATIC_DETECTION_TASK_NAME/);
  assert.match(app, /syncNativeRecorderInbox/);
  assert.match(storage, /importNativeRecorderInbox/);
  assert.match(storage, /nativeRecorderInboxCursors/);
  assert.match(storage, /nativeRouteImportIsComplete/);
  assert.match(storage, /status='completed'[\s\S]*enqueueCompletionJobInTransaction[\s\S]*completed\.push/);
  assert.match(storage, /Build 12 never lets Swift touch this file again/);
  assert.match(inbox, /exportNativeRecorderInbox[\s\S]*importNativeRecorderInbox[\s\S]*acknowledgeNativeRecorderSessions/);
  assert.doesNotMatch(manualTask, /processAutomaticDriveLocations/);
});

test('Build 13 enriches unnamed journey endpoints with native MapKit POI and geocoder fallback', () => {
  const swift = source('modules/journeydeck-recorder/ios/JourneyDeckRecorderModule.swift');
  const podspec = source('modules/journeydeck-recorder/ios/JourneyDeckRecorder.podspec');
  const module = source('modules/journeydeck-recorder/index.ts');
  const enrichment = source('src/journey-place-enrichment.ts');

  assert.match(swift, /import MapKit/);
  assert.match(swift, /MKLocalPointsOfInterestRequest/);
  assert.match(swift, /pointOfInterestFilter = \.includingAll/);
  assert.match(swift, /nearbyPointsOfInterestAsync/);
  assert.match(podspec, /'MapKit'/);
  assert.match(module, /lookupNearbyMapKitPointsOfInterest/);
  assert.match(enrichment, /MAPKIT_POI_SEARCH_RADIUS_METERS = 250/);
  assert.match(enrichment, /MAPKIT_POI_MAX_MATCH_DISTANCE_METERS = 160/);
  assert.match(enrichment, /pointOfInterest\?\.name \?\? \(address \? bestPlaceLabelFromAddress/);
  assert.match(enrichment, /findNamedPlace[\s\S]*findCachedPlace/);
});

test('CloudKit transport stages tokens, preserves assets atomically, and reports bounded retry metadata', () => {
  const swift = source('modules/journeydeck-cloudkit/ios/JourneyDeckCloudKitModule.swift');
  const orchestration = source('src/icloud-sync.ts');
  const engine = source('src/cloudkit-sync.ts');

  assert.match(swift, /savePendingToken/);
  assert.match(swift, /commitPendingToken/);
  assert.match(swift, /changeTokenExpired/);
  assert.match(swift, /retrying<T>/);
  assert.match(swift, /CKErrorRetryAfterKey/);
  assert.match(swift, /replaceItemAt/);
  assert.match(swift, /failedRecords/);
  assert.match(orchestration, /retryAfterSeconds/);
  assert.match(orchestration, /engine\.setSyncCompleted\(\)/);
  assert.match(engine, /public setSyncCompleted/);
});
