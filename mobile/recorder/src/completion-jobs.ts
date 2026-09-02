import type { Connection } from './credentials';
import { completeRecording } from './api';
import { syncCurrentUserWithPrivateICloud } from './icloud-sync';
import { captureAppleMusicHistoryForSession } from './music-capture';
import { areJourneyDeckRequestsBlocked } from './network-activity';
import {
  claimNextCompletionJob,
  markCompletionJobForRetry,
  markCompletionJobSucceeded,
  markSessionRemoteCompleted,
  refreshCompletedSessionLocalMirror,
  type CompletionJob,
} from './storage';
import { observeJourneyDeckEvent } from './observability';

export type CompletionJobRunReport = {
  attempted: number;
  completed: number;
  deferred: number;
};

class DeferredCompletionError extends Error {
  constructor(message: string, readonly minimumDelayMs: number) { super(message); }
}

async function performCompletionJob(job: CompletionJob, connection: Connection | null): Promise<void> {
  if (job.kind === 'archive_mirror') {
    if (!refreshCompletedSessionLocalMirror(job.sessionId)) throw new Error('archive_mirror_failed');
    return;
  }
  if (job.kind === 'apple_music_history') {
    const enriched = await captureAppleMusicHistoryForSession(job.sessionId);
    if (!refreshCompletedSessionLocalMirror(job.sessionId)) throw new Error('archive_mirror_failed');
    if (enriched > 0) observeJourneyDeckEvent('music.artwork_cached', { enriched_count: enriched });
    return;
  }
  if (job.kind === 'private_cloud_sync') {
    const result = await syncCurrentUserWithPrivateICloud({ force: true });
    if (result.failedUploads > 0) {
      throw new DeferredCompletionError('private_cloud_partial', Math.max(0, result.retryAfterSeconds ?? 0) * 1000);
    }
    return;
  }
  if (!connection || areJourneyDeckRequestsBlocked()) throw new Error('remote_unavailable');
  const remote = await completeRecording(connection, job.sessionId);
  markSessionRemoteCompleted(job.sessionId, remote.driveId ?? null);
}

function failureCode(job: CompletionJob, error: unknown): string {
  if (error instanceof Error && /^[a-z0-9_]{1,64}$/.test(error.message)) return error.message;
  return `${job.kind}_failed`;
}

/**
 * Drains a bounded number of durable completion jobs in dependency order.
 * Every failure is converted into persisted retry state; network and provider
 * errors never reopen a completed journey or escape a background task.
 */
export async function processPendingCompletionJobs(options: {
  connection?: Connection | null;
  sessionId?: string;
  limit?: number;
} = {}): Promise<CompletionJobRunReport> {
  const report: CompletionJobRunReport = { attempted: 0, completed: 0, deferred: 0 };
  const limit = Math.max(1, Math.min(20, Math.trunc(options.limit ?? 8)));
  for (let index = 0; index < limit; index += 1) {
    const includeRemote = Boolean(options.connection && !areJourneyDeckRequestsBlocked());
    const job = claimNextCompletionJob({ sessionId: options.sessionId, includeRemote });
    if (!job) break;
    report.attempted += 1;
    try {
      await performCompletionJob(job, options.connection ?? null);
      markCompletionJobSucceeded(job.id);
      report.completed += 1;
    } catch (error) {
      markCompletionJobForRetry(job.id, failureCode(job, error), job.attemptCount,
        error instanceof DeferredCompletionError ? error.minimumDelayMs : 0);
      report.deferred += 1;
      observeJourneyDeckEvent(job.kind === 'private_cloud_sync' ? 'cloudkit.sync_failed' : 'recorder.completion_failed', {
        stage: job.kind,
        attempt_count: job.attemptCount,
        error_code: failureCode(job, error),
      });
      // Later jobs may depend on this one. Stop this pass and retry from the
      // persisted queue rather than allowing enrichment to overtake storage.
      break;
    }
  }
  return report;
}
