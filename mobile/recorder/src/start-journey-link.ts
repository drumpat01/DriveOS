/**
 * "Start a Journey" requests from the Home Screen widget (journeydeck-recorder://start-journey).
 * The link can arrive before the recorder is ready, so the request waits here until the
 * recorder takes it, and expires after two minutes so a stale tap never starts a drive.
 */
const EXPIRES_MS = 120_000;
let requestedAt: number | null = null;
const listeners = new Set<() => void>();

export function requestStartJourney(now = Date.now()) {
  requestedAt = now;
  for (const listener of listeners) listener();
}

/** Returns true once for a fresh request, then clears it. */
export function takeStartJourneyRequest(now = Date.now()) {
  const fresh = requestedAt !== null && now - requestedAt <= EXPIRES_MS;
  requestedAt = null;
  return fresh;
}

export function hasStartJourneyRequest(now = Date.now()) {
  return requestedAt !== null && now - requestedAt <= EXPIRES_MS;
}

export function subscribeStartJourneyRequests(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
