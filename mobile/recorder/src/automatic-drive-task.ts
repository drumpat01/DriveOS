import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import {
  emptyAutomaticDriveState, loadAutomaticDriveState, resetAutomaticDriveState, saveAutomaticDriveEvent, saveAutomaticDriveState,
} from './automatic-drive-state';
import {
  appendAutomaticDrivePreRollPoint, selectAutomaticDrivePreRoll, type AutomaticDrivePreRollPoint,
} from './automatic-drive-preroll';
import { loadConnection, loadOrCreateDeviceId } from './credentials';
import { evaluateDriveDetection } from './drive-detection';
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
import { observeJourneyDeckEvent } from './observability';

function preRollPoint(location: LocationObject): AutomaticDrivePreRollPoint {
  return {
    timestamp: location.timestamp,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? 10_000,
    altitudeMeters: location.coords.altitude,
    headingDegrees: location.coords.heading,
    speedMps: location.coords.speed,
  };
}

function locationFromPreRoll(point: AutomaticDrivePreRollPoint): LocationObject {
  return {
    timestamp: point.timestamp,
    coords: {
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracyMeters,
      altitude: point.altitudeMeters,
      altitudeAccuracy: null,
      heading: point.headingDegrees,
      speed: point.speedMps,
    },
  };
}

async function startDetectedJourney(preRoll: AutomaticDrivePreRollPoint[]) {
  if (activeSession()) return null;
  const ordered = [...preRoll].sort((left, right) => left.timestamp - right.timestamp);
  const session = beginLocalSession(await loadOrCreateDeviceId(), ordered[0]?.timestamp);
  saveAutomaticDriveState({ ...emptyAutomaticDriveState(), automaticSessionId: session.id });
  try {
    if (!(await startLocationTracking())) throw new Error('iOS did not confirm route tracking.');
    recordLocations(ordered.map(locationFromPreRoll));
    await Promise.allSettled([
      sampleAppleMusicForActiveSession({ force: true }),
      ...(TESSIE_INTEGRATION_ENABLED ? [sampleTessieMediaForActiveSession({ force: true })] : []),
    ]);
    saveAutomaticDriveEvent('started', session.id);
    observeJourneyDeckEvent('recorder.drive_confirmed', { engine: 'expo' });
    observeJourneyDeckEvent('recorder.preroll_recovered', {
      engine: 'expo',
      point_count: ordered.length,
      duration_seconds: ordered.length > 1 ? Math.round((ordered.at(-1)!.timestamp - ordered[0].timestamp) / 1000) : 0,
    });
    return session.id;
  } catch {
    abandonLocalSession(session.id);
    resetAutomaticDriveState();
    saveAutomaticDriveEvent('start_failed', session.id);
    observeJourneyDeckEvent('recorder.completion_failed', { engine: 'expo', stage: 'start' });
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
  observeJourneyDeckEvent('recorder.journey_completed', { engine: 'expo' });
}

export async function processAutomaticDriveLocations(locations: LocationObject[], locationAlreadyRecorded = false) {
  const preferences = loadRecordingModePreferences();
  if (!preferences.onboardingCompleted || preferences.mode !== 'automatic' || !locations.length) return;

  let detector = loadAutomaticDriveState();
  let current = activeSession();
  if (detector.automaticSessionId && detector.automaticSessionId !== current?.id) {
    detector = emptyAutomaticDriveState();
  }
  if (current && detector.automaticSessionId !== current.id) {
    saveAutomaticDriveState(emptyAutomaticDriveState());
    return;
  }

  let automaticSessionActive = Boolean(current?.status === 'recording' && detector.automaticSessionId === current.id);
  const ordered = [...locations].sort((left, right) => left.timestamp - right.timestamp);
  for (const location of ordered) {
    const previousCandidateSamples = detector.candidateSamples;
    const preStartLocations = automaticSessionActive
      ? []
      : appendAutomaticDrivePreRollPoint(detector.preStartLocations, preRollPoint(location));
    const result = evaluateDriveDetection(detector, {
      timestamp: location.timestamp,
      speedMps: Number.isFinite(location.coords.speed) ? location.coords.speed : null,
      accuracyMeters: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy : null,
      latitude: Number.isFinite(location.coords.latitude) ? location.coords.latitude : null,
      longitude: Number.isFinite(location.coords.longitude) ? location.coords.longitude : null,
    }, automaticSessionActive);
    detector = { ...result.state, automaticSessionId: detector.automaticSessionId, preStartLocations };
    saveAutomaticDriveState(detector);
    if (previousCandidateSamples === 0 && detector.candidateSamples === 1) {
      observeJourneyDeckEvent('recorder.candidate_started', { engine: 'expo' });
    }

    if (result.action === 'start' && !current) {
      const selectedPreRoll = selectAutomaticDrivePreRoll(preStartLocations, location.timestamp);
      const sessionId = await startDetectedJourney(selectedPreRoll.length ? selectedPreRoll : [preRollPoint(location)]);
      if (!sessionId) return;
      detector = { ...emptyAutomaticDriveState(), automaticSessionId: sessionId };
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
    observeJourneyDeckEvent('recorder.completion_failed', { engine: 'expo', stage: 'background_task' });
    // Automatic detection is additive. A background failure must never damage
    // an active local recording or escape the task boundary.
  }
});
