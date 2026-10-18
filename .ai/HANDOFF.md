# JourneyDeck current handoff

## Current objective

Revise the post-first-trip Plus card copy and accessibility. Keep the draft pull request open. Do not merge, build, submit, or deploy.

## Checkout

- Branch `cursor/post-first-trip-plus-prompt-1783`, based on main `ec46402`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/298

## Material changes

- Trial body: Your first 3 trips get everything in Plus, this one included. Want to keep the Atlas, complete history and Ask JourneyDeck after that? Plus starts with a StoreKit day-count free trial whenever you're ready.
- No-trial body: Your first 3 trips get everything in Plus, this one included. Plus keeps the Atlas, complete history and Ask JourneyDeck going after that.
- Title: Nice drive. That one's saved.
- The close control is labeled Close. The backdrop is hidden from accessibility. Not now stays on the text button. The title caps text growth at 1.4.
- Who sees the card, the button order, and the paywall are unchanged. The flag still defaults off.

## Verification

- `npm run typecheck` in `mobile/recorder` passed.
- `tests/first-trip-prompt.test.mts`: 8 passed.
- Full `npm test`: 1054 passed, 2 failed, 1 skipped. The failures are the existing Atlas Evening/Night timezone case and the missing `Migration 3 -- Phase 3.5` string. The skip is the absent shader golden frames.
- No iOS simulator. Dark and light web renders at 375pt and 320pt are on the pull request.

## Unresolved

- Do not merge. No EAS build, submit, OTA, App Store Connect, or RevenueCat change.
- The flag stays off until a build profile sets `JOURNEYDECK_POST_FIRST_TRIP_PROMPT=on`.

## Next steps

1. Leave the draft pull request open until the owner merges it.
2. To try it on TestFlight, set `JOURNEYDECK_POST_FIRST_TRIP_PROMPT=on` on that build profile only.
