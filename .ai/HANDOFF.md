# Current Handoff State

## Current objective

Draft-only retarget of JourneyDeck V3 TestFlight onto the LIVE App Store
listing. Do not merge. Do not run `eas build` / `eas submit`. Do not touch
polish PRs #163/#164 or `ios-v3-device.yml`.

## Material changes

- `APP_VARIANT=v3-store` (and EAS profile `v3-testflight`) enables V3
  product features without switching bundle, Watch, or CloudKit identity.
- `mobile/recorder/eas.json` `v3-testflight`: store distribution, channel
  `production`, environment `production`, `APP_VARIANT=v3-store`,
  `INTERNAL_TESTING=0`. Submit `ascAppId` is live `6806502526`.
- Isolated preview `APP_VARIANT=v3-preview` still forces
  `com.journeydeck.recorder.v3` / `iCloud.com.journeydeck.recorder.v3` and
  is not used by this profile.
- Gate fails closed without Patrick/CoS clear. It accepts `6806502526` and
  rejects isolated preview `6814695593`. TestFlight only — never App Store
  review submit from this stream.
- Ask/Siri plugins key off V3 feature flags, not the `.v3` bundle.

## Active tree

- Branch: `cursor/v3-testflight-live-listing-bf20` (draft PR, this change).
- V3 store TF runtime stays `3.0.0-preview.4` on channel `production`.

## Verification

- Targeted from `mobile/recorder`: `v3-testflight-eas` 7/7,
  `ask-journeydeck` 12/12, `time-capsule-prototype` 3/3,
  `siri-native-build` 3/3.
- Resolved `EAS_BUILD_PROFILE=v3-testflight`: live bundle + CloudKit +
  Watch, submit `6806502526`, channel `production`, V3 features on.
- No EAS Build, no EAS Submit, no App Store/TestFlight upload.

## Unresolved

- Build/submit still require written Patrick/CoS clear. This skeleton never
  invokes `eas build` or `eas submit`. Never promote this stream to review.

## Next steps

1. Review the draft PR; do not merge.
2. Do not dispatch a live EAS job from this skeleton.
