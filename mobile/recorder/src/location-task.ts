import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { sampleAppleMusicForActiveSession, sampleTessieMediaForActiveSession } from './music-capture';
import { recordLocations } from './storage';
import { LOCATION_TASK_NAME } from './tracking';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const inserted = recordLocations(data.locations);
  if (inserted > 0) {
    // Build 11 automatic journeys are owned entirely by the native Swift
    // recorder. This Expo task remains the manual-recording transport only.
    await Promise.allSettled([
      sampleAppleMusicForActiveSession(),
      ...(TESSIE_INTEGRATION_ENABLED ? [sampleTessieMediaForActiveSession()] : []),
    ]);
  }
});
