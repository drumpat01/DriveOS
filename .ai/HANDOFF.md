# JourneyDeck current handoff

## Current objective

Draft the one-time post-first-trip Plus card. Do not merge, build, submit, or deploy.

## Checkout

- Branch `cursor/post-first-trip-plus-prompt-1783`, based on main `ec46402`.
- Draft PR URL is recorded after the pull request is opened.

## Material changes

- Flag `postFirstTripPlusPrompt` is on only when `JOURNEYDECK_POST_FIRST_TRIP_PROMPT=on`. It defaults off in every variant.
- `shouldShowFirstTripPrompt` allows the card only for a counted 0 to 1 drive, with the flag on, tier free, Plus not unlocked, not already shown, and not the demo profile.
- The card waits until recording, finishing, saving, the saved-journey moment, and other sheets are gone.
- See Plus opens the existing StoreKit paywall. Not now dismisses it. A private preference records that it was shown.
- Trial copy uses StoreKit `introTrialDays`. If Apple reports no eligible trial, the body does not mention a trial.
- Drives 1 to 3 stay free. The trip-summary paywall still starts after drive 3.

## Verification

- `npm run typecheck` in `mobile/recorder` passed.
- `tests/first-trip-prompt.test.mts`: 8 passed.
- Full `npm test`: 1055 passed, 2 failed outside this change. Atlas insights expect Evening while this environment reads the `-05:00` fixture as Night. `private-content` looks for `Migration 3 -- Phase 3.5` in `local-store.ts`, which is not in this tree.
- No iOS simulator here. Light and dark web renders of the card are attached to the PR.

## Unresolved

- Do not merge. No EAS build, submit, OTA, App Store Connect, or RevenueCat change.
- The flag stays off until a build profile sets `JOURNEYDECK_POST_FIRST_TRIP_PROMPT=on`.

## Next steps

1. Leave the draft pull request open until the owner merges it.
2. To try it on TestFlight, set `JOURNEYDECK_POST_FIRST_TRIP_PROMPT=on` on that build profile only.
