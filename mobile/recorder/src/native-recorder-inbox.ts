import {
  acknowledgeNativeRecorderSessions,
  exportNativeRecorderInbox,
} from '../modules/journeydeck-recorder';
import { importNativeRecorderInbox, nativeRecorderInboxCursors } from './storage';

let pending: Promise<{ imported: number; acknowledged: number }> | null = null;

/**
 * Serializes the native-to-Expo handoff. The Swift module reads only its own
 * inbox database and returns value objects; Expo writes those objects through
 * the sole journeydeck-local.db connection owner.
 */
export function syncNativeRecorderInbox() {
  if (pending) return pending;
  const operation = (async () => {
    const snapshot = await exportNativeRecorderInbox(nativeRecorderInboxCursors());
    if (snapshot.errorCode && snapshot.errorCode !== 'native_module_unavailable') {
      throw new Error(snapshot.errorCode);
    }
    const completedSessionIds = importNativeRecorderInbox(snapshot);
    if (!completedSessionIds.length) return { imported: snapshot.sessions.length, acknowledged: 0 };
    const result = await acknowledgeNativeRecorderSessions(completedSessionIds);
    if (result.errorCode) throw new Error(result.errorCode);
    return { imported: snapshot.sessions.length, acknowledged: result.acknowledged };
  })();
  const tracked = operation.finally(() => {
    if (pending === tracked) pending = null;
  });
  pending = tracked;
  return tracked;
}
