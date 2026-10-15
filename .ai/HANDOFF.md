# JourneyDeck current handoff, October 15, 2026

## Current objective

Keep draft PR #291 open after merging `main`. Do not merge it. The 4.5.1 free-drive, annual paywall, and rating behavior stays.

## Checkout

- Branch `cursor/free-drives-annual-paywall-40e0`.
- `origin/main` (`cc92fbc`, PR #290 Tesla journal page) is merged in. The only conflict was `.ai/HANDOFF.md`.

## Material changes

- Completed-drive count persists in `membership.completed-drives.v1`. Counts 0–2 unlock Plus features without changing StoreKit `status.tier`. Tessie stays on a verified entitlement. Siri reads `JourneyDeckFreeDriveAccess`.
- The annual paywall (`com.journeydeck.recorder.pro.annual`) opens on the trip summary once the count passes 3 for a non-subscriber. V4 launch does not show it. Offer copy comes from StoreKit. Weekly is not offered.
- `expo-store-review` runs once after the third replay that plays to the end.
- Version and runtime `4.5.1`. Local iOS build floor `52`. `eas.json` `production` builds `v4-store`.
- From main: `web/tesla-drive-journal.html` has no "Tesla journal" nav link, a `step-note` Tessie fees line, and `public-page.css?v=grand-tour-5`. Homepage hero is "A road trip journal" / "for your iPhone."

## Verification

- `npm run typecheck` in `mobile/recorder` passed after the merge.
- `npm test` in `mobile/recorder`: 1040 pass, 2 fail. Both failures are already on `main`: Atlas expects Evening and gets Night under UTC, and private-content still looks for the Migration 3 comment removed in #280.
- Root `node_modules` is not installed here, so server tests were not rerun. The merge did not change server or web source beyond `main`.

## Unresolved

- Do not build, submit, or merge PR #291.
- EAS remote version must be `4.5.1` with a build number above 51 before `eas build --profile production`.
- App Store Connect still needs the annual 7-day intro offer, and weekly removed from sale.
- Homepage Plus still says US$24.99 a year. The Tesla page says $39.99 a year. This merge did not change either price.

## Next steps

1. Push the merge commit. Leave PR #291 open for the owner to merge.
2. When asked to ship: from `mobile/recorder`, set the remote version, then `eas build -p ios --profile production` and `eas submit -p ios --profile production --latest`.
