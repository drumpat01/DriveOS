import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { recordLocations } from './storage';
import { LOCATION_TASK_NAME } from './tracking';

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (!error && data?.locations?.length) recordLocations(data.locations);
});
