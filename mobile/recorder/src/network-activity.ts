export type NetworkActivityCategory = 'journeydeck_server' | 'private_icloud';
export type NetworkActivityReason =
  | 'connection_check'
  | 'archive_refresh'
  | 'recorder_mirror'
  | 'user_content'
  | 'preferences'
  | 'external_import'
  | 'private_sync';
export type NetworkActivityOutcome = 'active' | 'succeeded' | 'failed' | 'blocked' | 'skipped';

export type NetworkActivityEvent = {
  id: string;
  category: NetworkActivityCategory;
  reason: NetworkActivityReason;
  operation: string;
  method: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  uploadBytes: number;
  downloadBytes: number;
  statusCode: number | null;
  outcome: NetworkActivityOutcome;
};

export type NetworkActivitySnapshot = {
  sessionStartedAt: string;
  journeyDeckRequestsBlocked: boolean;
  totalOperations: number;
  activeOperations: number;
  succeededOperations: number;
  failedOperations: number;
  blockedOperations: number;
  uploadBytes: number;
  downloadBytes: number;
  journeyDeckOperations: number;
  privateICloudOperations: number;
  byReason: Partial<Record<NetworkActivityReason, number>>;
  recentEvents: NetworkActivityEvent[];
};

type BeginNetworkActivityInput = Pick<NetworkActivityEvent, 'category' | 'reason' | 'operation' | 'method'> & {
  uploadBytes?: number;
};
type FinishNetworkActivityInput = {
  outcome: Exclude<NetworkActivityOutcome, 'active'>;
  statusCode?: number | null;
  downloadBytes?: number;
};

const MAX_EVENTS = 80;
const listeners = new Set<(snapshot: NetworkActivitySnapshot) => void>();
const policyListeners = new Set<(blocked: boolean) => void>();
let sessionStartedAt = new Date().toISOString();
let journeyDeckRequestsBlocked = false;
let events: NetworkActivityEvent[] = [];
let sequence = 0;
let totals = emptyTotals();
let pendingEmit: ReturnType<typeof setTimeout> | null = null;

function emptyTotals() {
  return {
    totalOperations: 0,
    activeOperations: 0,
    succeededOperations: 0,
    failedOperations: 0,
    blockedOperations: 0,
    uploadBytes: 0,
    downloadBytes: 0,
    journeyDeckOperations: 0,
    privateICloudOperations: 0,
    byReason: {} as Partial<Record<NetworkActivityReason, number>>,
  };
}

function snapshot(): NetworkActivitySnapshot {
  return {
    sessionStartedAt,
    journeyDeckRequestsBlocked,
    ...totals,
    byReason: { ...totals.byReason },
    recentEvents: [...events].reverse().slice(0, 12),
  };
}

function emitNow() {
  if (pendingEmit) {
    clearTimeout(pendingEmit);
    pendingEmit = null;
  }
  if (!listeners.size) return;
  const current = snapshot();
  for (const listener of listeners) listener(current);
}

function scheduleEmit() {
  if (!listeners.size || pendingEmit) return;
  pendingEmit = setTimeout(() => {
    pendingEmit = null;
    if (!listeners.size) return;
    const current = snapshot();
    for (const listener of listeners) listener(current);
  }, 200);
}

export function getNetworkActivitySnapshot() {
  return snapshot();
}

export function subscribeNetworkActivity(listener: (snapshot: NetworkActivitySnapshot) => void) {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
    if (!listeners.size && pendingEmit) {
      clearTimeout(pendingEmit);
      pendingEmit = null;
    }
  };
}

export function setJourneyDeckRequestsBlocked(blocked: boolean) {
  if (journeyDeckRequestsBlocked === blocked) return;
  journeyDeckRequestsBlocked = blocked;
  emitNow();
  for (const listener of policyListeners) listener(blocked);
}

export function areJourneyDeckRequestsBlocked() {
  return journeyDeckRequestsBlocked;
}

export function subscribeJourneyDeckRequestPolicy(listener: (blocked: boolean) => void) {
  policyListeners.add(listener);
  return () => { policyListeners.delete(listener); };
}

export function resetNetworkActivity() {
  events = [];
  totals = emptyTotals();
  sessionStartedAt = new Date().toISOString();
  emitNow();
}

export function beginNetworkActivity(input: BeginNetworkActivityInput) {
  const started = Date.now();
  const event: NetworkActivityEvent = {
    id: `network_${started.toString(36)}_${(sequence++).toString(36)}`,
    category: input.category,
    reason: input.reason,
    operation: input.operation,
    method: input.method.toUpperCase(),
    startedAt: new Date(started).toISOString(),
    completedAt: null,
    durationMs: null,
    uploadBytes: Math.max(0, Math.round(input.uploadBytes ?? 0)),
    downloadBytes: 0,
    statusCode: null,
    outcome: 'active',
  };
  events = [...events.slice(-(MAX_EVENTS - 1)), event];
  totals.totalOperations += 1;
  totals.activeOperations += 1;
  totals.uploadBytes += event.uploadBytes;
  totals.journeyDeckOperations += event.category === 'journeydeck_server' ? 1 : 0;
  totals.privateICloudOperations += event.category === 'private_icloud' ? 1 : 0;
  totals.byReason[event.reason] = (totals.byReason[event.reason] ?? 0) + 1;
  scheduleEmit();
  let finished = false;
  return {
    finish(result: FinishNetworkActivityInput) {
      if (finished) return;
      finished = true;
      const completed = Date.now();
      const downloadBytes = Math.max(0, Math.round(result.downloadBytes ?? 0));
      totals.activeOperations = Math.max(0, totals.activeOperations - 1);
      totals.succeededOperations += result.outcome === 'succeeded' ? 1 : 0;
      totals.failedOperations += result.outcome === 'failed' ? 1 : 0;
      totals.blockedOperations += result.outcome === 'blocked' ? 1 : 0;
      totals.downloadBytes += downloadBytes;
      events = events.map(current => current.id === event.id ? {
        ...current,
        completedAt: new Date(completed).toISOString(),
        durationMs: Math.max(0, completed - started),
        downloadBytes,
        statusCode: result.statusCode ?? null,
        outcome: result.outcome,
      } : current);
      scheduleEmit();
    },
  };
}

export function recordBlockedJourneyDeckRequest(input: Omit<BeginNetworkActivityInput, 'category'>) {
  const activity = beginNetworkActivity({ ...input, category: 'journeydeck_server' });
  activity.finish({ outcome: 'blocked' });
}

function templatePath(path: string) {
  const pathname = path.split('?')[0] || '/';
  return pathname
    .replace(/(\/api\/recorder\/sessions\/)[^/]+/i, '$1:session')
    .replace(/(\/api\/recorder\/journeys\/)[^/]+/i, '$1:journey')
    .replace(/(\/api\/recorder\/photos\/)[^/]+/i, '$1:photo')
    .replace(/(\/api\/recorder\/preferences\/)[^/]+/i, '$1:device');
}

export function classifyJourneyDeckRequest(path: string, method = 'GET'): {
  operation: string;
  reason: NetworkActivityReason;
} {
  const route = templatePath(path);
  const upperMethod = method.toUpperCase();
  if (route === '/api/recorder/status' || route === '/api/recorder/connections/status') {
    return { operation: 'Connection status', reason: 'connection_check' };
  }
  if (/\/lastfm\/sync$/.test(route)) return { operation: 'Spotify history import', reason: 'external_import' };
  if (/^\/api\/recorder\/sessions(?:\/|$)/.test(route)) return { operation: 'Recorder mirror', reason: 'recorder_mirror' };
  if (/^\/api\/recorder\/(?:collections|memories|photos)(?:\/|$)/.test(route) && upperMethod !== 'GET') {
    return { operation: 'Memory content', reason: 'user_content' };
  }
  if (/^\/api\/recorder\/(?:preferences|places\/alias|vehicle-intelligence\/preferences)(?:\/|$)/.test(route)) {
    return { operation: 'Preference sync', reason: 'preferences' };
  }
  if (/^\/api\/recorder\/photos(?:\/|$)/.test(route)) return { operation: 'Memory photo', reason: 'user_content' };
  return { operation: 'Archive refresh', reason: 'archive_refresh' };
}
