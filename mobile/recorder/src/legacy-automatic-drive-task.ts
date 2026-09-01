import * as TaskManager from 'expo-task-manager';

import { AUTOMATIC_DETECTION_TASK_NAME } from './tracking';

// Build 10 may leave this Expo background task registered on an upgraded
// phone. Keep a harmless definition long enough for App.tsx to unregister it;
// all Build 11 automatic recording is owned by JourneyDeckRecorder.swift.
TaskManager.defineTask(AUTOMATIC_DETECTION_TASK_NAME, async () => undefined);
