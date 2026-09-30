import type { LocalSessionStatus } from './storage';

export type RecorderSheetInput = {
  startupPending: boolean;
  permissionsReady: boolean;
  /** Status of the active journey, or null when none is active. */
  status: LocalSessionStatus | null;
  clockTracking: boolean;
  automaticMode: boolean;
  automaticDetectionActive: boolean;
};

export type RecorderSheetState = {
  phase: 'starting' | 'enable' | 'automatic' | 'ready' | 'recording' | 'checking' | 'paused' | 'finishing';
  kicker: string;
  title: string;
  body: string;
  /** Wide accent button at the bottom of the sheet. */
  primary: 'start' | 'enable' | 'end' | null;
  /** Round button beside the primary one. */
  secondary: 'pause' | 'resume' | null;
  /** Live stats, route and in-drive tools apply. */
  live: boolean;
};

/** What the V4 recorder sheet shows for the recorder's current state. */
export function recorderSheetState(input: RecorderSheetInput): RecorderSheetState {
  const { status } = input;
  if (status === 'finishing') return { phase: 'finishing', kicker: 'Finishing', title: 'Saving your drive.', body: 'Recording has stopped. Your journey is being saved on this device.', primary: null, secondary: null, live: true };
  if (status === 'paused') return { phase: 'paused', kicker: 'Paused', title: 'Your drive is paused.', body: 'GPS capture is stopped. Every point so far is saved.', primary: 'end', secondary: 'resume', live: true };
  if (status === 'recording') {
    return input.clockTracking
      ? { phase: 'recording', kicker: 'Recording', title: 'Your drive is being remembered.', body: 'You can lock your phone. Add a marker while you drive.', primary: 'end', secondary: 'pause', live: true }
      : { phase: 'checking', kicker: 'Checking recording', title: 'Confirming the recorder.', body: 'Saved GPS points are safe while iOS confirms background tracking.', primary: 'end', secondary: 'pause', live: true };
  }
  if (input.startupPending) return { phase: 'starting', kicker: 'Getting ready', title: 'Getting the recorder ready.', body: 'This takes a moment after JourneyDeck opens.', primary: 'start', secondary: null, live: false };
  if (!input.permissionsReady) return { phase: 'enable', kicker: 'Location needed', title: 'Allow location to record drives.', body: 'JourneyDeck needs Always location access to keep recording while your device is locked.', primary: 'enable', secondary: null, live: false };
  if (input.automaticMode) {
    return input.automaticDetectionActive
      ? { phase: 'automatic', kicker: 'Tesla automation', title: 'Drives start on their own.', body: 'Journeys are detected automatically. Your active drive will appear here.', primary: null, secondary: null, live: false }
      : { phase: 'automatic', kicker: 'Tesla automation', title: 'Automatic detection is paused.', body: 'Check Always Allow location access in Settings.', primary: null, secondary: null, live: false };
  }
  return { phase: 'ready', kicker: 'Ready', title: 'Ready for your next drive.', body: 'Start when you begin driving. You can lock your phone.', primary: 'start', secondary: null, live: false };
}
