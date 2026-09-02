import * as Updates from 'expo-updates';
import { Observe, type ObserveAttribute } from 'expo-observe';

export type JourneyDeckObserveEvent =
  | 'recorder.armed'
  | 'recorder.candidate_started'
  | 'recorder.drive_confirmed'
  | 'recorder.preroll_recovered'
  | 'recorder.journey_completed'
  | 'recorder.completion_failed'
  | 'music.artwork_cached'
  | 'cloudkit.sync_failed'
  | 'database.recovery_started';

const safeEventNames = new Set<JourneyDeckObserveEvent>([
  'recorder.armed',
  'recorder.candidate_started',
  'recorder.drive_confirmed',
  'recorder.preroll_recovered',
  'recorder.journey_completed',
  'recorder.completion_failed',
  'music.artwork_cached',
  'cloudkit.sync_failed',
  'database.recovery_started',
]);

const emittedOnce = new Set<string>();

function safeAttribute(value: unknown): ObserveAttribute | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(-1_000_000_000, Math.min(1_000_000_000, value));
  }
  if (typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(value)) return value;
  return null;
}

function safeAttributes(attributes: Record<string, unknown>) {
  const sanitized: Record<string, ObserveAttribute> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!/^[a-z][a-z0-9_.]{0,47}$/i.test(key)) continue;
    const safe = safeAttribute(value);
    if (safe !== null) sanitized[key] = safe;
  }
  return sanitized;
}

export function configureJourneyDeckObservability() {
  try {
    Observe.configure({
      environment: __DEV__ ? 'development' : 'production',
      dispatchInDebug: false,
      sampleRate: 1,
    });
    Observe.setGlobalAttributes({
      'journeydeck.release': 'N1.9-B13',
      'journeydeck.runtime': Updates.runtimeVersion ?? 'embedded',
      'journeydeck.embedded': Updates.isEmbeddedLaunch,
      ...(Updates.updateId ? { 'journeydeck.update': Updates.updateId } : {}),
    });
  } catch {
    // Diagnostics are additive and may never interfere with local recording.
  }
}

export function observeJourneyDeckEvent(event: JourneyDeckObserveEvent, attributes: Record<string, unknown> = {}) {
  if (!safeEventNames.has(event)) return;
  try {
    Observe.logEvent(event, {
      severity: event.endsWith('failed') ? 'warn' : 'info',
      attributes: safeAttributes(attributes),
    });
  } catch {
    // Diagnostics are best effort and never part of a recorder transaction.
  }
}

export function observeJourneyDeckEventOnce(event: JourneyDeckObserveEvent, key: string, attributes: Record<string, unknown> = {}) {
  const safeKey = `${event}:${key}`;
  if (emittedOnce.has(safeKey)) return;
  emittedOnce.add(safeKey);
  observeJourneyDeckEvent(event, attributes);
}
