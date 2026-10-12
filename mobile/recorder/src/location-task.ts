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
import { prepareJourneyDeckDatabase, retryJourneyDeckDatabase } from './database-startup';

/** Keep the newest points so a long outage cannot grow unbounded in JS. */
const LOCATION_WRITE_BUFFER_LIMIT = 1_200;
const pendingWrite: LocationObject[] = [];

function rememberLocations(locations: LocationObject[]) {
  const seen = new Set(pendingWrite.map(point => point.timestamp));
  for (const location of locations) {
    if (seen.has(location.timestamp)) continue;
    seen.add(location.timestamp);
    pendingWrite.push(location);
  }
  pendingWrite.sort((left, right) => left.timestamp - right.timestamp);
  if (pendingWrite.length > LOCATION_WRITE_BUFFER_LIMIT) {
    pendingWrite.splice(0, pendingWrite.length - LOCATION_WRITE_BUFFER_LIMIT);
  }
}

function takeLocationsToWrite(incoming: LocationObject[]) {
  if (!pendingWrite.length) return incoming;
  rememberLocations(incoming);
  return pendingWrite.splice(0, pendingWrite.length);
}

function recordLocationsResilient(locations: LocationObject[]) {
  try { return recordLocations(locations); }
  catch { return recordLocations(locations); }
}

function noteWriteFailure(stage: 'database_startup' | 'record_locations' | 'background_task') {
  observeJourneyDeckEvent('recorder.completion_failed', {
    engine: 'manual', stage, buffered: 1, point_count: pendingWrite.length,
  });
}

export async function runLocationTask(
  { data, error }: { data?: { locations?: LocationObject[] }; error?: unknown },
) {
  if (error || !data?.locations?.length) return;
  const incoming = data.locations;
  try {
    try { await prepareJourneyDeckDatabase(); }
    catch {
      try { await retryJourneyDeckDatabase(); }
      catch {
        rememberLocations(incoming);
        noteWriteFailure('database_startup');
        return;
      }
    }
    if (isNativeAutomaticSession(activeSession()?.id)) {
      pendingWrite.length = 0;
      try {
        await syncNativeRecorderInbox();
        if (!activeSession()) { await stopLocationTracking(); return; }
        await sampleAppleMusicForActiveSession();
      } catch {
        observeJourneyDeckEvent('recorder.completion_failed', { engine: 'manual', stage: 'background_task' });
      }
      return;
    }
    const locations = takeLocationsToWrite(incoming);
    let inserted = 0;
    try { inserted = recordLocationsResilient(locations); }
    catch {
      rememberLocations(locations);
      noteWriteFailure('record_locations');
      return;
    }
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
      try { await sampleAppleMusicForActiveSession(); }
      catch {
        observeJourneyDeckEvent('recorder.completion_failed', { engine: 'manual', stage: 'background_task' });
      }
    }
  } catch {
    rememberLocations(incoming);
    noteWriteFailure('background_task');
  }
}

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK_NAME, runLocationTask);
