import type { Connection } from './credentials';
import { loadConnection } from './credentials';
import { loadAutomaticDriveState } from './automatic-drive-state';
import { queueLastFmForCompletedSession } from './lastfm-sync';
import {
  evaluateManualRecordingFailsafe, type ManualRecordingFailsafeDecision,
} from './manual-recording-failsafe';
import { observeJourneyDeckEvent } from './observability';
import { processPendingCompletionJobs } from './completion-jobs';
import {
  claimManualSessionForFailsafeFinish, completeSessionLocally, getManualRecordingFailsafeSnapshot,
} from './storage';
import { stopLocationTracking } from './tracking';

export function evaluateCurrentManualRecordingFailsafe(evaluatedAtMs = Date.now()) {
  const snapshot = getManualRecordingFailsafeSnapshot(evaluatedAtMs);
  return {
    sessionId: snapshot.session?.id ?? null,
    decision: evaluateManualRecordingFailsafe({
      session: snapshot.session,
      route: snapshot.route,
      evaluatedAtMs,
      automaticSessionId: loadAutomaticDriveState().automaticSessionId,
    }),
  };
}

export async function finishManualRecordingForFailsafe(
  sessionId: string | null,
  decision: ManualRecordingFailsafeDecision,
  knownConnection?: Connection | null,
): Promise<boolean> {
  if (!sessionId || !decision.shouldFinish || !decision.reason) return false;
  // This compare-and-set is the ownership fence between a user tapping End
  // Journey and a background location callback reaching the timeout together.
  if (!claimManualSessionForFailsafeFinish(sessionId)) return false;
  // Keychain availability is not a prerequisite for stopping local capture.
  // Unknown credentials retain a retryable remote job until resolved.
  try {
    completeSessionLocally(sessionId, knownConnection !== null);
  } finally {
    // The durable finishing fence already owns this journey. Even if the
    // completion transaction fails, stop capture and leave saving retryable.
    await stopLocationTracking().catch(() => undefined);
  }
  observeJourneyDeckEvent('recorder.journey_completed', {
    engine: 'manual_failsafe',
    reason: decision.reason,
  });
  // Optional enrichment must never hold the recorder refresh/clock open.
  void (async () => {
    const connection = knownConnection === undefined ? await loadConnection().catch(() => null) : knownConnection;
    await processPendingCompletionJobs({ connection, sessionId, limit: 8 });
  })().catch(() => undefined);
  void queueLastFmForCompletedSession(sessionId);
  return true;
}
