type LocalArchiveListener = () => void;

const listeners = new Set<LocalArchiveListener>();

export function subscribeLocalArchiveChanges(listener: LocalArchiveListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyLocalArchiveChanged() {
  for (const listener of listeners) listener();
}
