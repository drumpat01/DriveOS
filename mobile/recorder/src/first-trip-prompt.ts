export type FirstTripPromptTier = 'free' | 'paid';

export type FirstTripPromptInput = {
  enabled: boolean;
  previousCount: number;
  nextCount: number;
  counted: boolean;
  tier: FirstTripPromptTier;
  plusUnlocked: boolean;
  alreadyShown: boolean;
  demo: boolean;
};

/** Private preference key. One shown marker per profile, synced with the other private preferences. */
export const FIRST_TRIP_PROMPT_PREFERENCE_KEY = 'membership.first-trip-prompt.v1';

/**
 * Soft Plus card after the first counted trip.
 * A free trial is tier `paid`. TestFlight Plus unlock is `plusUnlocked`.
 * Drives 1 to 3 stay free either way; this never decides the paywall.
 */
export function shouldShowFirstTripPrompt(input: FirstTripPromptInput): boolean {
  if (!input.enabled || input.demo || input.alreadyShown || input.plusUnlocked) return false;
  if (input.tier === 'paid') return false;
  if (!input.counted) return false;
  if (!Number.isInteger(input.previousCount) || !Number.isInteger(input.nextCount)) return false;
  return input.previousCount === 0 && input.nextCount === 1;
}

export type FirstTripPromptChrome = {
  recording: boolean;
  finishing: boolean;
  saving: boolean;
  completionVisible: boolean;
  otherSheetVisible: boolean;
};

/** The card waits until the recorder is idle and no other sheet is up. */
export function firstTripPromptReadyToPresent(chrome: FirstTripPromptChrome): boolean {
  return !chrome.recording && !chrome.finishing && !chrome.saving && !chrome.completionVisible && !chrome.otherSheetVisible;
}

export type FirstTripPromptCopy = {
  kicker: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
};

/**
 * Trial length comes from StoreKit `introTrialDays`.
 * Null means Apple did not report an eligible free trial, so the body does not mention one.
 */
export function firstTripPromptCopy(introTrialDays: number | null): FirstTripPromptCopy {
  const days = typeof introTrialDays === 'number' && Number.isInteger(introTrialDays) && introTrialDays > 0
    ? introTrialDays
    : null;
  return {
    kicker: 'FIRST TRIP SAVED',
    title: "Nice drive. That one’s saved.",
    body: days == null
      ? 'Your first 3 trips get everything in Plus, this one included. Plus keeps the Atlas, complete history and Ask JourneyDeck going after that.'
      : `Your first 3 trips get everything in Plus, this one included. Want to keep the Atlas, complete history and Ask JourneyDeck after that? Plus starts with a ${days}-day free trial whenever you’re ready.`,
    primary: 'See Plus',
    secondary: 'Not now',
  };
}

/** Longest eligible StoreKit intro trial among the loaded products, or null when none is eligible. */
export function eligibleIntroTrialDays(products: readonly { introTrialDays?: number | null }[] | null | undefined): number | null {
  if (!products || products.length === 0) return null;
  let days: number | null = null;
  for (const product of products) {
    const trial = product.introTrialDays;
    if (typeof trial === 'number' && Number.isInteger(trial) && trial > 0 && (days == null || trial > days)) days = trial;
  }
  return days;
}

export function firstTripPromptWasRecorded(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return (value as { shown?: unknown }).shown === true;
}
