import { getPrivatePreference, upsertPrivatePreference } from './local-store';

export type JourneyVisibilityChoice = 'show' | 'hide';

// Recorder IDs end in a UUID. Keep keys inside the private-preference key limit,
// and retain the full identity in the value so different session prefixes cannot alias.
function preferenceKey(journeyId: string) {
  const match = /^local_(?:native_recording_(?:manual_)?|recording_)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(journeyId);
  return match ? `journey.visibility.${match[1]!.toLowerCase()}` : null;
}

export function journeyVisibilityChoice(userId: string, journeyId: string): JourneyVisibilityChoice | null {
  const key = preferenceKey(journeyId);
  const value = key ? getPrivatePreference<{ journeyId: string; choice: JourneyVisibilityChoice }>(userId, key) : null;
  return value?.journeyId === journeyId && (value.choice === 'show' || value.choice === 'hide') ? value.choice : null;
}

export function saveJourneyVisibilityChoice(userId: string, journeyId: string, choice: JourneyVisibilityChoice) {
  const key = preferenceKey(journeyId);
  if (!key || (choice !== 'show' && choice !== 'hide')) throw new Error('Invalid journey choice.');
  upsertPrivatePreference(userId, key, { journeyId, choice });
}
