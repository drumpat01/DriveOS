# JourneyDeck V3 TestFlight (wiring only)

V3 TestFlight is **not** the frozen V2 App Store listing. Do not build or
submit until Patrick or CoS give written clear. This repository only wires
the EAS profile and a fail-closed GitHub skeleton.

| Item | V3 TestFlight | V2 listing (frozen) |
| --- | --- | --- |
| Bundle | `com.journeydeck.recorder.v3` | `com.journeydeck.recorder` |
| EAS build profile | `v3-testflight` (store / App Store) | `production` |
| EAS submit profile | `v3-testflight` | `production` |
| `ascAppId` | `6814695593` | `6806502526` |
| Channel | `v3-preview` | `production` |
| Runtime | manual string `3.0.0-preview.4` | V2 production runtime |
| `APP_VARIANT` | `v3-preview` | unset / production |

`submit.v3-testflight.ios.ascAppId` is the V3 App Store Connect Apple ID
`6814695593`. **Never** copy `6806502526` into the V3 submit profile.

## How this differs from the ad hoc path

`.github/workflows/ios-v3-device.yml` (PR #161 path) signs an ad hoc IPA on
`macos-26` with local distribution secrets. Leave that workflow alone.

V3 TestFlight uses **EAS-managed credentials** for store distribution. Do not
reuse the ad hoc `.p12` / provisioning-profile secrets.

## GitHub skeleton

`.github/workflows/ios-v3-testflight.yml` is **JourneyDeck V3 TestFlight**.
`workflow_dispatch` only. Standard `ubuntu-latest` runner. It documents
`EXPO_TOKEN` and the intended commands, then fails closed while the
authorize box is unchecked. It never runs `eas build` or `eas submit`.

Intended commands after written Patrick/CoS clear (Windows, from
`mobile/recorder`):

```powershell
$env:APP_VARIANT = 'v3-preview'
$env:EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING = '1'
npx eas-cli build --platform ios --profile v3-testflight --non-interactive
npx eas-cli submit --platform ios --profile v3-testflight --non-interactive
```

`EXPO_TOKEN` is required for non-interactive `eas-cli`. Keep it in GitHub
Actions secrets or the local Expo login; do not commit it.
