import type { NativeRecorderStatusEvent } from '../modules/journeydeck-recorder';

export type RecorderStatusEventState = Readonly<{
  profileId: string;
  sessionId: string | null;
  streamId: string | null;
  sequence: number;
}>;

export function recorderStatusEventNeedsRefresh(previous: RecorderStatusEventState,
  event: NativeRecorderStatusEvent): boolean {
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0 || !event.streamId
    || !Number.isFinite(Date.parse(event.occurredAt))
    || !['recording', 'paused', 'finished', 'failed'].includes(event.status)) return false;
  if (previous.streamId === event.streamId && event.sequence <= previous.sequence) return false;
  return previous.streamId !== event.streamId || previous.sessionId !== event.journeyId
    || event.sequence > previous.sequence;
}

export function acceptRecorderStatusEvent(
  previous: RecorderStatusEventState,
  event: NativeRecorderStatusEvent,
): RecorderStatusEventState | null {
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0
    || typeof event.streamId !== 'string' || !event.streamId
    || typeof event.occurredAt !== 'string' || !Number.isFinite(Date.parse(event.occurredAt))
    || !['recording', 'paused', 'finished', 'failed'].includes(event.status)) return null;
  if (event.journeyId !== previous.sessionId) return null;
  if (previous.streamId === null) return previous;
  if (event.streamId !== previous.streamId) return null;
  if (event.streamId === previous.streamId && event.sequence <= previous.sequence) return null;
  return { ...previous, streamId: event.streamId, sequence: event.sequence };
}

export function recorderStatusEventStopsClock(event: NativeRecorderStatusEvent): boolean {
  return event.status === 'paused' || event.status === 'finished';
}

export function recorderRefreshMayPublish(startEpoch: number, currentEpoch: number,
  startProfileId?: string, currentProfileId?: string): boolean {
  return startEpoch === currentEpoch && (startProfileId === undefined || startProfileId === currentProfileId);
}

export function recorderEventStopTime(event: NativeRecorderStatusEvent, nowMs: number): number {
  const occurredAtMs = Date.parse(event.occurredAt);
  return Number.isFinite(occurredAtMs) ? Math.min(nowMs, occurredAtMs) : nowMs;
}
