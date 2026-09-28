import * as SecureStore from 'expo-secure-store';

export const PLUS_TRIAL_DAYS = 7;
const DAY_MS = 86_400_000;

// The Keychain outlives a reinstall, so deleting the app does not restart the trial.
// intents/AskJourneyDeckIntent.swift reads this same item for Siri.
export const PLUS_TRIAL_KEY = 'journeydeck.plus-trial.started-at';
const trialOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'journeydeck.plus-trial',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** The trial end for a start time. A clock set before the start ends the trial rather than extending it. */
export function plusTrialEndsAt(startedAt: number, now = Date.now()): number | null {
  if (!Number.isFinite(startedAt) || now < startedAt) return null;
  return startedAt + PLUS_TRIAL_DAYS * DAY_MS;
}

/** Reads when this device's trial started, starting it now on first launch. */
export async function loadOrStartPlusTrial(now = Date.now()): Promise<number> {
  const saved = Number(await SecureStore.getItemAsync(PLUS_TRIAL_KEY, trialOptions));
  if (Number.isFinite(saved) && saved > 0) return saved;
  await SecureStore.setItemAsync(PLUS_TRIAL_KEY, String(now), trialOptions);
  return now;
}
