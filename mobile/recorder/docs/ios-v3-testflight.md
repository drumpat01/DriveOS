# JourneyDeck V3 TestFlight (live listing, wiring only)

V3 TestFlight targets the **LIVE** App Store listing
(`com.journeydeck.recorder`, ascAppId `6806502526`). It is **TestFlight
only** — never submit this stream for App Store review. Do not build or
submit until Patrick or CoS give written clear. This repository only wires
the EAS profile and a fail-closed GitHub skeleton.

## Existing-app rule

V3 TestFlight is an update to the existing JourneyDeck app in App Store
Connect. It is not a new app.

Agents must stop immediately if their plan includes any of these actions:

- Creating a new App Store Connect app.
- Creating an app named `V3`, `JourneyDeck V3`, or similar in App Store
  Connect.
- Changing the live bundle id away from `com.journeydeck.recorder`.
- Using `com.journeydeck.recorder.v3` for this TestFlight stream.
- Using isolated V3 preview ascAppId `6814695593`.
- Pointing `submit.v3-testflight.ios.ascAppId` anywhere except `6806502526`.
- Setting `APP_VARIANT=v3-preview` for `v3-testflight`.
- Submitting the resulting build to App Review.

Correct target:

- Existing App Store Connect app: JourneyDeck live listing.
- App Store Connect app id: `6806502526`.
- Bundle id: `com.journeydeck.recorder`.
- EAS build profile: `v3-testflight`.
- EAS submit profile: `v3-testflight`.
- `APP_VARIANT`: `v3-store`.
- EAS channel/environment: `production` / `production`.
- Destination: TestFlight only.

Production CloudKit (`iCloud.com.journeydeck.recorder`) is shared with the
live app. That is accepted for this stream.

| Item | V3 TestFlight (this stream) | Isolated V3 preview (do not use here) |
| --- | --- | --- |
| Bundle | `com.journeydeck.recorder` | `com.journeydeck.recorder.v3` |
| Watch | `com.journeydeck.recorder.watchkitapp` | `com.journeydeck.recorder.v3.watchkitapp` |
| iCloud | `iCloud.com.journeydeck.recorder` | `iCloud.com.journeydeck.recorder.v3` |
| EAS build profile | `v3-testflight` (store / App Store) | `v3-preview` (internal) |
| EAS submit profile | `v3-testflight` | n/a |
| `ascAppId` | `6806502526` | `6814695593` — **never** this stream |
| Channel | `production` | `v3-preview` |
| Environment | `production` | `preview` |
| Runtime | next native build `3.0.0-preview.6` (Build 36 uses `.5`) | next native build `3.0.0-preview.6` |
| `APP_VARIANT` | `v3-store` (V3 features, live identity) | `v3-preview` (forces `.v3` identity) |
| `INTERNAL_TESTING` | `0` | `1` |

`submit.v3-testflight.ios.ascAppId` is the live listing Apple ID
`6806502526`. **Never** copy `6814695593` into this submit profile.
**Never** set `APP_VARIANT=v3-preview` on this profile; that forces the
`.v3` bundle, Watch container, and CloudKit container.

V3 product features stay **on** via `APP_VARIANT=v3-store`. That split does
not switch bundle, Watch, or iCloud identity.

## How this differs from the ad hoc path

`.github/workflows/ios-v3-device.yml` (PR #161 path) signs an ad hoc IPA on
`macos-26` with local distribution secrets for `com.journeydeck.recorder.v3`.
Leave that workflow alone.

V3 TestFlight uses **EAS-managed credentials** for store distribution onto
the live listing. Do not reuse the ad hoc `.p12` / provisioning-profile
secrets. Do not use the internal `v3-preview` distribution profile for this
stream.

## GitHub skeleton

`.github/workflows/ios-v3-testflight.yml` is **JourneyDeck V3 TestFlight**.
`workflow_dispatch` only. Standard `ubuntu-latest` runner. It documents
`EXPO_TOKEN` and the intended commands, then fails closed while the
authorize box is unchecked. It never runs `eas build` or `eas submit`.

Intended commands after written Patrick/CoS clear (Windows, from
`mobile/recorder`). These land a TestFlight build on the live listing.
**Never** promote this stream to App Store review:

```powershell
npm run testflight:gate
$env:APP_VARIANT = 'v3-store'
$env:EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING = '0'
npx eas-cli build --platform ios --profile v3-testflight --non-interactive
npx eas-cli submit --platform ios --profile v3-testflight --non-interactive
```

`EXPO_TOKEN` is required for non-interactive `eas-cli`. Keep it in GitHub
Actions secrets or the local Expo login; do not commit it.
