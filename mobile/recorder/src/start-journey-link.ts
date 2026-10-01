/**
 * "Start a Journey" requests from the Home Screen widget (journeydeck-recorder://start-journey).
 * The link can arrive before the recorder is ready, so the request waits here until the
 * recorder takes it, and expires after two minutes so a stale tap never starts a drive.
 */
const EXPIRES_MS = 120_000;
let requestedAt: number | null = null;
/** True when the request came from Start while the sample was open; the drive is recorded in the member's own library. */
let leftSample = false;
const listeners = new Set<() => void>();

export function requestStartJourney(now = Date.now(), fromSample = false) {
  requestedAt = now;
  leftSample = fromSample;
  for (const listener of listeners) listener();
}

/** Returns true once for a fresh request, then clears it. */
export function takeStartJourneyRequest(now = Date.now()) {
  const fresh = requestedAt !== null && now - requestedAt <= EXPIRES_MS;
  requestedAt = null;
  return fresh;
}

/** Whether the request just taken came from leaving the sample. Returns it once, then clears it. */
export function takeStartJourneyLeftSample() {
  const value = leftSample;
  leftSample = false;
  return value;
}

export function hasStartJourneyRequest(now = Date.now()) {
  return requestedAt !== null && now - requestedAt <= EXPIRES_MS;
}

export function subscribeStartJourneyRequests(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
