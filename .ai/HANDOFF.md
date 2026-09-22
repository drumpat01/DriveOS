# Current Handoff State

## Current objective

Draft-only EAS + GitHub wiring for JourneyDeck V3 TestFlight on PR #162.
Do not merge. Do not run `eas build` / `eas submit`. Do not touch PR #161
/ `ios-v3-device.yml`.

## Material changes

- `mobile/recorder/eas.json`: store-distribution build profile `v3-testflight`
  (`channel`/`environment` `v3-preview`, `APP_VARIANT=v3-preview`).
  Submit `ascAppId` is the wired V3 id `6814695593`.
  V2 `submit.production` stays `6806502526` only.
- Gate still fails closed without Patrick/CoS clear. It accepts `6814695593`
  and rejects V2 `6806502526` and leftover TBD placeholders.
- `app.config.js` accepts `v3-testflight` as a V3 profile. Runtime remains
  the manual string `3.0.0-preview.4`.
- `.github/workflows/ios-v3-testflight.yml` remains dispatch-only on
  `ubuntu-latest` and does not invoke EAS.

## Active tree

- Branch: `cursor/v3-testflight-eas-wiring-ea52` (draft PR #162).
- V3 runtime stays `3.0.0-preview.4` on channel `v3-preview`.

## Verification

- Targeted: `tests/v3-testflight-eas.test.mts` (run from `mobile/recorder`).
- No EAS Build, no EAS Submit, no App Store/TestFlight upload.

## Unresolved

- Build/submit still require written Patrick/CoS clear. This skeleton never
  invokes `eas build` or `eas submit`.

## Next steps

1. Review draft PR #162; do not merge.
2. Do not dispatch a live EAS job from this skeleton.
