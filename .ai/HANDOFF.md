# JourneyDeck current handoff

## Current objective

Rebase the approved first-trip Plus card onto main after the Tessie settings copy merged. Mark the pull request ready for review. Do not build, submit, or deploy.

## Checkout

- Branch `cursor/post-first-trip-plus-prompt-1783`, rebased onto main `b9c4031`.
- PR: https://github.com/drumpat01/DriveOS/pull/298. Ready for review.

## Material changes

- Onboarding still says Settings › Music & Connections, from #300.
- Title: Nice drive. That one’s saved.
- Trial body uses the StoreKit day count and a curly apostrophe in you’re.
- No-trial body: Your first 3 trips get everything in Plus, this one included. Plus keeps the Atlas, complete history and Ask JourneyDeck going after that.
- Close is labeled Close. The backdrop is hidden from accessibility. The title caps text growth at 1.4.
- The flag still defaults off.

## Verification

- `npm run typecheck` in `mobile/recorder` passed.
- `tests/first-trip-prompt.test.mts`: 8 passed.
- Full `npm test`: 1054 passed, 2 failed, 1 skipped. The failures are the Atlas Evening/Night timezone case and the missing `Migration 3 -- Phase 3.5` string. The skip is the absent shader golden frames.

## Unresolved

- No EAS build, submit, OTA, App Store Connect, or RevenueCat change.
- The flag stays off until a build profile sets `JOURNEYDECK_POST_FIRST_TRIP_PROMPT=on`.

## Next steps

1. Merge https://github.com/drumpat01/DriveOS/pull/298 when GitHub shows it mergeable.
2. Before turning the flag on, capture the next TestFlight build on iPhone: dark and light at 375 and 320, large text, and the no-trial version.
