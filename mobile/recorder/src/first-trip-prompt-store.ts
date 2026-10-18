import { getCurrentUser } from './auth';
import { FIRST_TRIP_PROMPT_PREFERENCE_KEY, firstTripPromptWasRecorded } from './first-trip-prompt';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';

export function firstTripPromptWasShown(userId = getCurrentUser().id): boolean {
  return firstTripPromptWasRecorded(getPrivatePreference(userId, FIRST_TRIP_PROMPT_PREFERENCE_KEY));
}

export function markFirstTripPromptShown(userId = getCurrentUser().id): void {
  upsertPrivatePreference(userId, FIRST_TRIP_PROMPT_PREFERENCE_KEY, { shown: true });
}
