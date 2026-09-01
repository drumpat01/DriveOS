import * as Location from 'expo-location';

export const LOCATION_TASK_NAME = 'journeydeck-recorder-location-v1';
export const AUTOMATIC_DETECTION_TASK_NAME = 'journeydeck-automatic-drive-detection-v1';

export async function isLocationTrackingActive() {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function startLocationTracking() {
  if (await isLocationTrackingActive()) return true;
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 15, timeInterval: 10_000,
    deferredUpdatesDistance: 50, deferredUpdatesInterval: 30_000, deferredUpdatesTimeout: 30_000,
    activityType: Location.ActivityType.AutomotiveNavigation, pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
  });
  return isLocationTrackingActive();
}

export async function stopLocationTracking() {
  if (await isLocationTrackingActive()) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function isAutomaticDetectionActive() {
  return Location.hasStartedLocationUpdatesAsync(AUTOMATIC_DETECTION_TASK_NAME);
}

export async function startAutomaticDetection() {
  // Re-register even when the detector is already active. Expo updates the
  // native task options in place, which lets an OTA remove the old persistent
  // blue background-location indicator without disabling automatic detection.
  await Location.startLocationUpdatesAsync(AUTOMATIC_DETECTION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 0,
    timeInterval: 15_000,
    // Parking needs timely samples. Do not defer this low-volume detector
    // stream into batches: iOS can otherwise hold the final stationary fixes
    // until after JourneyDeck's five-minute finish threshold.
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
  });
  return isAutomaticDetectionActive();
}

export async function stopAutomaticDetection() {
  if (await isAutomaticDetectionActive()) await Location.stopLocationUpdatesAsync(AUTOMATIC_DETECTION_TASK_NAME);
}
