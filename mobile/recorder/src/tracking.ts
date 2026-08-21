import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'journeydeck-recorder-location-v1';

export async function startLocationTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 15, timeInterval: 10_000,
    deferredUpdatesDistance: 50, deferredUpdatesInterval: 30_000,
    activityType: Location.ActivityType.AutomotiveNavigation, pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

export async function stopLocationTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
