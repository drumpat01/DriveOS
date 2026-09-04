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
  claimManualSessionForFailsafeFinish, completeSessionLocally, getLiveRecorderSnapshot,
} from './storage';
import { stopLocationTracking } from './tracking';

export function evaluateCurrentManualRecordingFailsafe(evaluatedAtMs = Date.now()) {
  const snapshot = getLiveRecorderSnapshot(500);
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
  const connection = knownConnection === undefined
    ? await loadConnection().catch(() => null)
    : knownConnection;
  // This compare-and-set is the ownership fence between a user tapping End
  // Journey and a background location callback reaching the timeout together.
  if (!claimManualSessionForFailsafeFinish(sessionId)) return false;
  completeSessionLocally(sessionId, Boolean(connection));
  await stopLocationTracking().catch(() => undefined);
  observeJourneyDeckEvent('recorder.journey_completed', {
    engine: 'manual_failsafe',
    reason: decision.reason,
  });
  await processPendingCompletionJobs({ connection, sessionId, limit: 8 }).catch(() => undefined);
  void queueLastFmForCompletedSession(sessionId);
  return true;
}
