import { getCurrentUser } from './auth';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';

const SHARE_PROMPT_KEY = 'home.share-prompt';

/**
 * The Home share prompt should surface once per newly completed journey,
 * not on every render, and must not reappear after the user has already
 * acted on (or dismissed) that journey.
 */
export function lastPromptedShareJourneyId(): string | null {
  const stored = getPrivatePreference<{ journeyId?: unknown }>(getCurrentUser().id, SHARE_PROMPT_KEY);
  return typeof stored?.journeyId === 'string' ? stored.journeyId : null;
}

export function markShareJourneyPrompted(journeyId: string): void {
  upsertPrivatePreference(getCurrentUser().id, SHARE_PROMPT_KEY, { journeyId });
}
