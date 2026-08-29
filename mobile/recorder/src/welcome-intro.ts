import { getCurrentUser } from './auth';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';

const WELCOME_INTRO_KEY = 'onboarding.welcome-intro';

/**
 * The welcome scene is a one-time, per-profile orientation. It lives with
 * private preferences so it does not reappear after a normal iCloud restore.
 */
export function hasCompletedWelcomeIntro(): boolean {
  return getPrivatePreference<{ completed?: unknown }>(getCurrentUser().id, WELCOME_INTRO_KEY)?.completed === true;
}

export function completeWelcomeIntro(): void {
  upsertPrivatePreference(getCurrentUser().id, WELCOME_INTRO_KEY, { completed: true });
}
