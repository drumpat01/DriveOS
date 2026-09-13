import {
  acknowledgeNativeRecorderSessions,
  exportNativeRecorderInbox,
} from '../modules/journeydeck-recorder';
import { activeSession, importNativeRecorderInbox, nativeRecorderInboxCursors } from './storage';
import { getCurrentUser } from './auth';
import { waitForRecorderResponse } from './recorder-response';

let pending: Promise<{ imported: number; acknowledged: number }> | null = null;

/**
 * Serializes the native-to-Expo handoff. The Swift module reads only its own
 * inbox database and returns value objects; Expo writes those objects through
 * the sole journeydeck-local.db connection owner.
 */
export function syncNativeRecorderInbox() {
  if (pending) return pending;
  const ownerUserId = getCurrentUser().id;
  const operation = (async () => {
    // Timeout only the response, so a late export cannot continue into import.
    const snapshot = await waitForRecorderResponse(
      exportNativeRecorderInbox(nativeRecorderInboxCursors(), activeSession()?.id), 'native_inbox_export_timeout');
    if (getCurrentUser().id !== ownerUserId) throw new Error('native_inbox_profile_changed');
    if (snapshot.errorCode && snapshot.errorCode !== 'native_module_unavailable') {
      throw new Error(snapshot.errorCode);
    }
    const completedSessionIds = importNativeRecorderInbox(snapshot);
    if (!completedSessionIds.length) return { imported: snapshot.sessions.length, acknowledged: 0 };
    // These exact IDs were fully committed above. A delayed acknowledgement
    // may delete only those completed native copies; retries are idempotent.
    const result = await waitForRecorderResponse(
      acknowledgeNativeRecorderSessions(completedSessionIds), 'native_inbox_ack_timeout');
    if (result.errorCode) throw new Error(result.errorCode);
    return { imported: snapshot.sessions.length, acknowledged: result.acknowledged };
  })();
  const tracked = operation.finally(() => {
    if (pending === tracked) pending = null;
  });
  pending = tracked;
  return tracked;
}
