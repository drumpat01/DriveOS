# JourneyDeck current handoff, October 16, 2026

## Current objective

iOS paywall QA fixes on one unmerged PR, now at V4 version and runtime 4.5.2, with main merged in. Do not merge.

## Checkout

- Branch `cursor/ios-451-paywall-qa-9c78`. Main through `3355503` (PR #294, App Store campaign tokens) is merged. PR: https://github.com/drumpat01/DriveOS/pull/295

## Material changes

- Native auto-finish keeps `lastEventSessionId`. JS counts `finished`, `manual_finished`, and `manual_auto_finished` from that id when the active session is already cleared. A seeded library journey does not increment again. The paywall opens only when the count increases.
- A StoreKit 1-week free trial is 7 days. Ineligible, paid, month, and year offers stay null.
- The V4 paywall states price, period, auto-renew, the 24-hour renewal charge, and trial forfeiture, plus Privacy and Apple's standard EULA. A missing product does not invent a price.
- Restore returns the verified tier and closes the trip-summary paywall when that tier is paid.
- V4 `version` and `runtimeVersion` are `4.5.2` in `mobile/recorder/app.config.js`. The local iOS build-number floor stays 52.

## Verification

- After the merge and version bump, `npx tsc --noEmit` in `mobile/recorder` passed.
- 35 tests passed: completed-drive-count, subscription-offer, trip-replay-review, membership-entitlements, membership-store, and v4-connector-config.

## Unresolved

- Do not merge PR #295. The rating prompt and the absence of a launch paywall were verified in code and unit tests, not on a simulator.
- `planName` still returns `Weekly` for the weekly product id. V4 does not offer that product. Atlas "Weekly" stats are not a Plus plan.
- Build 54 does not persist `lastEventSessionId`. A finish while JS is suspended needs the 4.5.2 native binary.

## Next steps

1. Leave PR #295 open until the owner merges it.
2. Ship a 4.5.2 native binary before relying on the persisted session id for a background auto-finish.
