import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { processAutomaticDriveLocations } from './automatic-drive-task';
import { sampleAppleMusicForActiveSession, sampleShazamForActiveSession } from './music-capture';
import { recordLocations } from './storage';
import { LOCATION_TASK_NAME } from './tracking';

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const inserted = recordLocations(data.locations);
  if (inserted > 0) {
    // Once an automatic journey has begun, this is the live, high-fidelity
    // recording stream. Feeding it into the detector prevents iOS from leaving
    // a journey open just because its separate low-priority detector stream
    // goes quiet after the phone becomes stationary.
    try { await processAutomaticDriveLocations(data.locations, true); } catch {
      // The route has already been saved. Detection must never make the core
      // recorder task fail or discard a captured point.
    }
    await sampleAppleMusicForActiveSession();
    await sampleShazamForActiveSession();
  }
});
