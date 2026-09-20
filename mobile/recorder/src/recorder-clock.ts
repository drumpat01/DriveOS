type ClockSession = { id: string; startedAt: string; endedAt: string | null; status: string };
export type RecorderClock = { sessionId: string; confirmedAtMs: number; stoppedAtMs: number; running: boolean };
export const RECORDER_CLOCK_CONFIRMATION_MS = 10_000;

export function recorderClockRunning(clock: RecorderClock | null, nowMs: number): boolean {
  return Boolean(clock?.running && nowMs >= clock.confirmedAtMs
    && nowMs - clock.confirmedAtMs < RECORDER_CLOCK_CONFIRMATION_MS);
}

export function updateRecorderClock(previous: RecorderClock | null, session: ClockSession | null,
  trackingConfirmed: boolean, nowMs: number, lastPointAt?: string | null): RecorderClock | null {
  if (!session) return null;
  const running = session.status === 'recording' && !session.endedAt && trackingConfirmed;
  const previousEnd = previous?.sessionId === session.id
    ? previous.running ? Math.min(nowMs, previous.confirmedAtMs + RECORDER_CLOCK_CONFIRMATION_MS) : previous.stoppedAtMs
    : Date.parse(lastPointAt ?? session.startedAt);
  return { sessionId: session.id, confirmedAtMs: nowMs, running,
    stoppedAtMs: session.endedAt ? Date.parse(session.endedAt) : running ? nowMs : previousEnd };
}

export function recorderDurationLabel(session: ClockSession | null, clock: RecorderClock | null, nowMs: number): string {
  if (!session || clock?.sessionId !== session.id) return '00:00:00';
  const endMs = session.endedAt ? Date.parse(session.endedAt) : clock.running
    ? Math.min(nowMs, clock.confirmedAtMs + RECORDER_CLOCK_CONFIRMATION_MS) : clock.stoppedAtMs;
  const elapsed = endMs - Date.parse(session.startedAt);
  const seconds = Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 1000)) : 0;
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
