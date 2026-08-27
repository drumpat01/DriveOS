import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { flushAllQueuedMusicBestEffort, syncPendingCompletedRecordingsBestEffort } from './api';
import {
  loadAutomaticDriveState, resetAutomaticDriveState, saveAutomaticDriveEvent, saveAutomaticDriveState,
} from './automatic-drive-state';
import { loadConnection, loadOrCreateDeviceId } from './credentials';
import { emptyDriveDetectionState, evaluateDriveDetection } from './drive-detection';
import { syncCurrentUserWithPrivateICloud } from './icloud-sync';
import { queueLastFmForCompletedSession } from './lastfm-sync';
import {
  captureAppleMusicHistoryForSession, sampleAppleMusicForActiveSession, sampleShazamForActiveSession,
} from './music-capture';
import { loadRecordingModePreferences } from './recording-mode';
import {
  activeSession, beginLocalSession, completeSessionLocally, recordLocations, refreshCompletedSessionLocalMirror, setLocalStatus,
} from './storage';
import {
  AUTOMATIC_DETECTION_TASK_NAME, startLocationTracking, stopLocationTracking,
} from './tracking';

async function startDetectedJourney(location: LocationObject) {
  if (activeSession()) return null;
  const session = beginLocalSession(await loadOrCreateDeviceId());
  saveAutomaticDriveState({ ...emptyDriveDetectionState(), automaticSessionId: session.id });
  try {
    if (!(await startLocationTracking())) throw new Error('iOS did not confirm route tracking.');
    recordLocations([{ ...location, timestamp: Math.max(location.timestamp, Date.now()) }]);
    await sampleAppleMusicForActiveSession({ force: true });
    await sampleShazamForActiveSession({ force: true });
    saveAutomaticDriveEvent('started', session.id);
    return session.id;
  } catch {
    completeSessionLocally(session.id, false);
    resetAutomaticDriveState();
    saveAutomaticDriveEvent('start_failed', session.id);
    return null;
  }
}

async function finishDetectedJourney(sessionId: string, location: LocationObject) {
  recordLocations([location]);
  await stopLocationTracking().catch(() => {});
  setLocalStatus(sessionId, 'finishing');
  const connection = await loadConnection();
  completeSessionLocally(sessionId, Boolean(connection));
  resetAutomaticDriveState();
  void captureAppleMusicHistoryForSession(sessionId)
    .catch(() => undefined)
    .finally(() => {
      refreshCompletedSessionLocalMirror(sessionId);
      if (connection) void flushAllQueuedMusicBestEffort(connection);
      void syncCurrentUserWithPrivateICloud({ force: true }).catch(() => {});
    });
  void queueLastFmForCompletedSession(sessionId);
  if (connection) void syncPendingCompletedRecordingsBestEffort(connection);
  saveAutomaticDriveEvent('finished', sessionId);
}

export async function processAutomaticDriveLocations(locations: LocationObject[]) {
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
      await finishDetectedJourney(current.id, location);
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
