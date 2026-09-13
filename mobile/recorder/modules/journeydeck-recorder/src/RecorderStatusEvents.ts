import type { NativeRecorderStatusEvent } from './JourneyDeckRecorder.types';

type StatusEventSubscription = { remove(): void };
type StatusEventSource = {
  addListener?: (eventName: 'recorderStatusChanged', listener: (event: NativeRecorderStatusEvent) => void) => StatusEventSubscription;
};

export function subscribeRecorderStatusEvents(
  source: StatusEventSource | null,
  listener: (event: NativeRecorderStatusEvent) => void,
): () => void {
  try {
    const subscription = source?.addListener?.('recorderStatusChanged', listener);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      subscription?.remove();
    };
  } catch {
    return () => {};
  }
}
