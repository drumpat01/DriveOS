/** What the V4 recorder bar says and offers, derived from the recorder's own state. */
export type RecorderAccessoryInput = {
  startupPending: boolean;
  permissionsReady: boolean;
  status: 'recording' | 'paused' | 'finishing' | null;
  clockTracking: boolean;
  automaticMode: boolean;
  automaticDetectionActive: boolean;
  justSaved: boolean;
  elapsed: string;
  miles: number;
};

export type RecorderAccessoryTone = 'idle' | 'live' | 'paused' | 'attention' | 'saved';
export type RecorderAccessoryAction = 'start' | 'enable' | 'end' | 'resume' | null;

export type RecorderAccessoryState = {
  tone: RecorderAccessoryTone;
  title: string;
  detail: string;
  action: RecorderAccessoryAction;
  actionLabel: string | null;
};

const ACTION_LABEL: Record<Exclude<RecorderAccessoryAction, null>, string> = { start: 'Start', enable: 'Enable', end: 'End', resume: 'Resume' };

function state(tone: RecorderAccessoryTone, title: string, detail: string, action: RecorderAccessoryAction): RecorderAccessoryState {
  return { tone, title, detail, action, actionLabel: action ? ACTION_LABEL[action] : null };
}

export function recorderAccessoryState(input: RecorderAccessoryInput): RecorderAccessoryState {
  const progress = `${input.miles.toFixed(1)} mi · ${input.elapsed}`;
  if (input.status === 'finishing') return state('attention', 'Saving your journey', 'Points are safe on this iPhone', null);
  if (input.status === 'recording') {
    return input.clockTracking
      ? state('live', `Recording · ${progress}`, 'Tap for markers and song ID', 'end')
      : state('attention', 'Checking recording', 'Saved GPS points are safe', 'end');
  }
  if (input.status === 'paused') return state('paused', `Paused · ${progress}`, 'GPS capture is stopped', 'resume');
  if (input.startupPending) return state('idle', 'Preparing the recorder', 'Private and on this iPhone', null);
  if (!input.permissionsReady) return state('attention', 'Location access needed', 'Allow Always to record drives', 'enable');
  if (input.justSaved) return state('saved', 'Journey saved', 'Tap to see it', null);
  if (input.automaticMode) {
    return input.automaticDetectionActive
      ? state('idle', 'Watching for your next drive', 'Automatic recording is on', null)
      : state('attention', 'Automatic detection paused', 'Check Always Allow location access', null);
  }
  return state('idle', 'Ready for your next drive', 'Private and on this iPhone', 'start');
}

/** iOS 26 introduced the tab bar bottom accessory; earlier systems show the bar on Today. */
export function supportsTabAccessory(os: string, version: string | number) {
  return os === 'ios' && Number.parseInt(String(version), 10) >= 26;
}
