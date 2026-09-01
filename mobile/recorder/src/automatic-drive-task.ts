import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import {
  loadAutomaticDriveState, resetAutomaticDriveState, saveAutomaticDriveEvent, saveAutomaticDriveState,
} from './automatic-drive-state';
import { loadConnection, loadOrCreateDeviceId } from './credentials';
import { emptyDriveDetectionState, evaluateDriveDetection } from './drive-detection';
import { queueLastFmForCompletedSession } from './lastfm-sync';
import {
  sampleAppleMusicForActiveSession, sampleTessieMediaForActiveSession,
} from './music-capture';
import { loadRecordingModePreferences } from './recording-mode';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';
import {
  abandonLocalSession, activeSession, beginLocalSession, completeSessionLocally, recordFinishingLocation, recordLocations, setLocalStatus,
} from './storage';
import {
  AUTOMATIC_DETECTION_TASK_NAME, startLocationTracking, stopLocationTracking,
} from './tracking';
import { processPendingCompletionJobs } from './completion-jobs';

async function startDetectedJourney(location: LocationObject) {
  if (activeSession()) return null;
  const session = beginLocalSession(await loadOrCreateDeviceId());
  saveAutomaticDriveState({ ...emptyDriveDetectionState(), automaticSessionId: session.id });
  try {
    if (!(await startLocationTracking())) throw new Error('iOS did not confirm route tracking.');
    recordLocations([{ ...location, timestamp: Math.max(location.timestamp, Date.now()) }]);
    await Promise.allSettled([
      sampleAppleMusicForActiveSession({ force: true }),
      ...(TESSIE_INTEGRATION_ENABLED ? [sampleTessieMediaForActiveSession({ force: true })] : []),
    ]);
    saveAutomaticDriveEvent('started', session.id);
    return session.id;
  } catch {
    abandonLocalSession(session.id);
    resetAutomaticDriveState();
    saveAutomaticDriveEvent('start_failed', session.id);
    return null;
  }
}

async function finishDetectedJourney(sessionId: string, location: LocationObject, locationAlreadyRecorded = false) {
  // Mark the session as non-recording before awaiting a native stop call. This
  // makes a concurrently delivered location batch harmless instead of allowing
  // two task invocations to finish the same journey.
  setLocalStatus(sessionId, 'finishing');
  if (!locationAlreadyRecorded) recordFinishingLocation(sessionId, location);
  await stopLocationTracking().catch(() => {});
  const connection = await loadConnection();
  completeSessionLocally(sessionId, Boolean(connection));
  resetAutomaticDriveState();
  // The bounded worker persists every unfinished step before this background
  // callback returns, so iOS termination can delay enrichment but cannot lose it.
  await processPendingCompletionJobs({ connection, sessionId, limit: 8 }).catch(() => undefined);
  void queueLastFmForCompletedSession(sessionId);
  saveAutomaticDriveEvent('finished', sessionId);
}

export async function processAutomaticDriveLocations(locations: LocationObject[], locationAlreadyRecorded = false) {
  const preferences = loadRecordingModePreferences();
  if (!preferences.onboardingCompleted || preferences.mode !== 'automatic' || !locations.length) return;

  let detector = loadAutomaticDriveState();
  let current = activeSession();
  if (detector.automaticSessionId && detector.automaticSessionId !== current?.id) {
    detector = { ...emptyDriveDetectionState(), automaticSessionId: null };
  }
  if (current && detector.automaticSessionId !== current.id) {
    saveAutomaticDriveState({ ...emptyDriveDetectionState(), automaticSessionId: null });
    return;
  }

  let automaticSessionActive = Boolean(current?.status === 'recording' && detector.automaticSessionId === current.id);
  const ordered = [...locations].sort((left, right) => left.timestamp - right.timestamp);
  for (const location of ordered) {
    const result = evaluateDriveDetection(detector, {
      timestamp: location.timestamp,
      speedMps: Number.isFinite(location.coords.speed) ? location.coords.speed : null,
      accuracyMeters: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy : null,
      latitude: Number.isFinite(location.coords.latitude) ? location.coords.latitude : null,
      longitude: Number.isFinite(location.coords.longitude) ? location.coords.longitude : null,
    }, automaticSessionActive);
    detector = { ...result.state, automaticSessionId: detector.automaticSessionId };
    saveAutomaticDriveState(detector);

    if (result.action === 'start' && !current) {
      const sessionId = await startDetectedJourney(location);
      if (!sessionId) return;
      detector = { ...emptyDriveDetectionState(), automaticSessionId: sessionId };
      current = activeSession();
      automaticSessionActive = true;
      continue;
    }
    if (result.action === 'finish' && automaticSessionActive && current) {
      await finishDetectedJourney(current.id, location, locationAlreadyRecorded);
      return;
    }
  }
}

TaskManager.defineTask<{ locations: LocationObject[] }>(AUTOMATIC_DETECTION_TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  try { await processAutomaticDriveLocations(data.locations); }
  catch {
    // Automatic detection is additive. A background failure must never damage
    // an active local recording or escape the task boundary.
  }
});
