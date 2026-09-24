import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { sampleAppleMusicForActiveSession } from './music-capture';
import {
  evaluateCurrentManualRecordingFailsafe, finishManualRecordingForFailsafe,
} from './manual-recording-failsafe-runtime';
import { activeSession, recordLocations } from './storage';
import { LOCATION_TASK_NAME, stopLocationTracking } from './tracking';
import { isNativeAutomaticSession } from '../modules/journeydeck-recorder';
import { syncNativeRecorderInbox } from './native-recorder-inbox';
import { observeJourneyDeckEvent } from './observability';
import { prepareJourneyDeckDatabase } from './database-startup';

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  try { await prepareJourneyDeckDatabase(); }
  catch {
    observeJourneyDeckEvent('recorder.completion_failed', { engine: 'manual', stage: 'database_startup' });
    return;
  }
  if (isNativeAutomaticSession(activeSession()?.id)) {
    await syncNativeRecorderInbox();
    if (!activeSession()) { await stopLocationTracking(); return; }
    await sampleAppleMusicForActiveSession();
    return;
  }
  const inserted = recordLocations(data.locations);
  try {
    const failsafe = evaluateCurrentManualRecordingFailsafe();
    if (failsafe.decision.shouldFinish
      && await finishManualRecordingForFailsafe(failsafe.sessionId, failsafe.decision)) return;
  } catch {
    observeJourneyDeckEvent('recorder.completion_failed', { engine: 'manual_failsafe', stage: 'background_task' });
  }
  if (inserted > 0) {
    // Build 11 automatic journeys are owned entirely by the native Swift
    // recorder. This Expo task remains the manual-recording transport only.
    await sampleAppleMusicForActiveSession();
  }
});
