# Current Handoff State

## Current objective

Draft-only EAS + GitHub wiring for JourneyDeck V3 TestFlight. Do not merge.
Do not run `eas build` / `eas submit`. Do not touch PR #161 / `ios-v3-device.yml`.

## Material changes

- `mobile/recorder/eas.json`: store-distribution build profile `v3-testflight`
  (`channel`/`environment` `v3-preview`, `APP_VARIANT=v3-preview`,
  `autoIncrement`, device not simulator). Submit profile uses
  `ascAppId: TBD-V3-ASC-APP-ID`. V2 `submit.production` stays `6806502526`.
- `app.config.js` accepts `v3-testflight` as a V3 profile. Runtime remains
  the manual string `3.0.0-preview.4`.
- `.github/workflows/ios-v3-testflight.yml` (`JourneyDeck V3 TestFlight`):
  `workflow_dispatch` only, `ubuntu-latest`, documents `EXPO_TOKEN` and
  intended EAS commands, fail-closed via `scripts/v3-testflight-gate.mjs`.
- Docs: `mobile/recorder/docs/ios-v3-testflight.md`.

## Active tree

- Branch: `cursor/v3-testflight-eas-wiring-ea52` off `main`.
- V3 runtime stays `3.0.0-preview.4` on channel `v3-preview`.
- V2 listing / production submit id unchanged.

## Verification

- Targeted: `tests/v3-testflight-eas.test.mts` (run from `mobile/recorder`).
- No EAS Build, no EAS Submit, no App Store/TestFlight upload.

## Unresolved

- Real V3 App Store Connect Apple ID does not exist yet; submit is blocked.
- Build/submit still require written Patrick/CoS clear after that id is set.

## Next steps

1. Review the draft PR; do not merge.
2. Do not dispatch a live EAS job from this skeleton.
3. When a V3 ASC app exists, replace `TBD-V3-ASC-APP-ID` with that numeric id
   only (never `6806502526`) and wait for explicit clear before submit.
