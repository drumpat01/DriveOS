# JourneyDeck current handoff, October 15, 2026

## Current objective

Open a draft PR for iOS 4.5.1: three free completed drives, annual-only trip-summary paywall, and one rating request after the third trip replay. Do not merge. Leave draft PRs #264–#267, #269, and #277 untouched.

## Checkout

- Branch `cursor/free-drives-annual-paywall-40e0` off `main`.
- App: `mobile/recorder` (bundle `com.journeydeck.recorder`). `app.config.js` is the version source; `app.json` stays historical.

## Material changes

- Completed-drive count persists in private preference `membership.completed-drives.v1`. The first read seeds it from local journeys. The same session id counts once.
- While the stored count is 0, 1, or 2, Plus features (except Tessie) are open without changing StoreKit `status.tier`. Siri reads UserDefaults `JourneyDeckFreeDriveAccess`.
- The paywall opens on the trip summary when the count passes 3 and the member is not subscribed. V4 first run and launch do not show it. Demo drives do not count.
- V4 offers only `com.journeydeck.recorder.pro.annual`. Trial and price copy come from StoreKit `introTrialDays` and `displayPrice`. No eligible intro offer falls back to the regular price. Weekly and monthly stay recognized for current subscribers.
- `expo-store-review` asks once after the third replay that plays to the end. Scrubbing does not count. Demo replays do not count.
- Version and runtime `4.5.1`. Local iOS `buildNumber` `52`. `eas.json` `production` sets `APP_VARIANT=v4-store`, channel `production`, image `macos-tahoe-26.6-xcode-27.0`. `appVersionSource` remains `remote`.

## Verification

- `npm run typecheck` in `mobile/recorder` passed.
- Targeted tests passed: completed-drive count, subscription offer, trip-replay review, membership entitlements, membership store, v4 connector config, journey replay, app theme, v3 TestFlight EAS, recorder startup, tab runtime, and `scripts/v4-release-preflight.mjs`.
- Full `npm test`: the failures introduced here (recorder startup, tab runtime) were fixed and re-run green. Two failures are already on `main`: `atlas-insights` expects Evening and gets Night under UTC, and `private-content` still looks for the Migration 3 comment removed in #280.

## Unresolved

- Do not build, submit, or merge from this branch.
- EAS remote version must be set to `4.5.1` with a build number above 51 before `eas build --profile production`. Local `52` is only the source floor.
- App Store Connect still needs the annual 7-day intro offer, and weekly removed from sale.

## Next steps

1. Review the draft PR. Do not merge.
2. When the owner asks to ship: from `mobile/recorder`, set the remote version, then `eas build -p ios --profile production` and `eas submit -p ios --profile production --latest`.
