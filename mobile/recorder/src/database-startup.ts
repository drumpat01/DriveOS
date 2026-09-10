import { initializeAuth } from './auth';
import { prepareLocalStore } from './local-store';
import { initializeDatabase } from './storage';
import { createStartupCoordinator, type StartupCoordinatorState } from './database-startup-model';

export type DatabaseStartupState = StartupCoordinatorState;
export type DatabaseStartupIssue = {
  code: 'DB-LOCKED' | 'DB-INTEGRITY' | 'DB-NEWER-SCHEMA' | 'DB-STARTUP';
  title: string;
  detail: string;
};

const coordinator = createStartupCoordinator(async () => {
  await prepareLocalStore();
  initializeDatabase();
  initializeAuth();
});

/**
 * Opens the one Expo SQLite connection, completes every additive migration and
 * preservation check, then prepares identity and recorder queues. UI, CloudKit
 * and background services all share this single-flight promise.
 */
export function prepareJourneyDeckDatabase(): Promise<void> {
  return coordinator.prepare();
}

/** Failed startup is retryable without deleting, replacing or recreating data. */
export function retryJourneyDeckDatabase(): Promise<void> {
  return coordinator.retry();
}

export function journeyDeckDatabaseState(): DatabaseStartupState {
  return coordinator.state();
}

export function databaseStartupIssue(error: unknown): DatabaseStartupIssue {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('locked') || message.includes('busy')) {
    return {
      code: 'DB-LOCKED',
      title: 'Local storage is still finishing',
      detail: 'JourneyDeck will wait for the previous app session to release your archive. Your saved journeys remain untouched.',
    };
  }
  if (message.includes('quick_check') || message.includes('integrity') || message.includes('application id')) {
    return {
      code: 'DB-INTEGRITY',
      title: 'Your local archive needs attention',
      detail: 'JourneyDeck stopped before writing new data because the preservation check did not pass. Your existing archive has not been replaced.',
    };
  }
  if (message.includes('newer than this app')) {
    return {
      code: 'DB-NEWER-SCHEMA',
      title: 'A newer JourneyDeck is required',
      detail: 'This build will not change an archive created by a newer version. Install the latest available JourneyDeck build and try again.',
    };
  }
  return {
    code: 'DB-STARTUP',
    title: 'JourneyDeck could not open local storage',
    detail: 'The app stopped safely before loading your library or starting sync. Your saved journeys remain untouched.',
  };
}
