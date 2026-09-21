# Expo CI and update-path assessment (V3 / SDK 58)

Patrick CEO-approved assessment. iOS-only. Free EAS tier. Do not merge to
`main`, do not deploy, and do not submit to App Store/TestFlight from this work.

## Current state (verified in this repository)

| Item | Finding |
| --- | --- |
| Expo SDK | `expo@~58.0.0-preview.3` in `mobile/recorder/package.json` (React Native `0.88.0-rc.0`, React 19.2.3) |
| `@expo/fingerprint` | Transitive **0.21.1** via `expo` / `expo-updates`. SDK 58 **balanced** preset exists and is now the default |
| Fingerprint adopted as CI? | Not before this PR. EAS Build already records fingerprints on past jobs; GHA always archived |
| `runtimeVersion` | Manual **string**, not `{ policy: "fingerprint" }`. V3 = `3.0.0-preview.4`; V2 preview = `2.0.0-preview.14`; production = `2.0.0-watch.9`; marker-compat OTA = `3.0.0-preview.2` |
| Updates URL | `https://u.expo.dev/ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4` (`app.json`, EAS project `journeydeck`) |
| `updates.requestHeaders` | Missing before this PR. GHA stamped `expo-channel-name: v3-preview` into `Expo.plist` after prebuild. EAS Build profiles already set `channel` |
| `eas.json` channels | `v3-preview`, `v3-development-simulator` → `v3-preview`; `v2-preview`; leftover V1 `preview` / `development`; `production` |
| GHA iOS native | `.github/workflows/ios-v3-device.yml` (`macos-26`, `workflow_dispatch`, ad hoc signed IPA, no EAS Build) |
| GHA other | `.github/workflows/journeydeck-ci.yml` (Windows DriveOS suite); `.github/workflows/tessie-readiness-audit.yml`. **No Android workflow in this repo** |
| `expo-updates` | `~58.0.5` installed. DIAG-11 diagnostics already read runtime/channel |
| `expo-observe` | Present as an SDK package. Do not enable paid Observe/Maestro |

`app.config.js` is authoritative. `app.json` runtime `1.9.0-build13` is historical and still locked by older tests.

Do **not** switch `runtimeVersion` to fingerprint policy on the installed V3 binary. That would mint a new compatibility hash and orphan runtime `3.0.0-preview.4` devices (GHA also fail-closes unless Expo.plist is exactly preview.4). Use fingerprint as a **build-decision** hash, keep the string runtime as the **OTA boundary**.

## What this PR implements

1. `fingerprint.config.js` pins `preset: 'balanced'` (SDK 58 default: skip version/string-runtime churn; hash native modules by name@version).
2. `scripts/ios-fingerprint-delta.mjs` compares the current iOS hash with `native-fingerprint.ios.json`.
3. `ios-v3-device.yml` runs that comparison after tests. Unchanged hash skips prebuild/archive/export and prints the authorized `eas update` command. Missing hash **fails closed** (archives). `force_native` overrides. The job never publishes and never calls EAS Build.
4. `app.config.js` embeds `updates.requestHeaders['expo-channel-name']` per variant so CNG, GHA, and future channel-surfing share the same header key.

Commit the hash from artifact `journeydeck-v3-ios-fingerprint` after the next successful native archive so later JS-only dispatches skip Xcode.

## Recommended Free-tier channel design

Keep the four live names. Do not add EAS Workflows (parallel paid compute) and do not add more channels.

| Channel | Branch (typical 1:1) | Who | Notes |
| --- | --- | --- | --- |
| `v3-preview` | `v3-preview` | Patrick's V3 iPhone / internal | Default V3 OTA. Runtime `3.0.0-preview.4` |
| `production` | `production` | App Store / TestFlight V2 | Frozen V2. Do not publish V3 here |
| `v2-preview` | `v2-preview` | Side-by-side V2 preview app | Frozen except urgent customer bugs |
| `preview` | `preview` | Legacy V1 profiles | Do not use for V3 |

`requestHeaders` / runtime override (already in SDK 58 `expo-updates`):

- **Build-time header:** now in app config. Required before `Updates.setUpdateRequestHeadersOverride()` can change `expo-channel-name`.
- **Channel surfing:** useful later so one internal binary can pull `v3-preview` vs a future `v3-qa` without rebuilding. Do not ship a hidden switcher until a second V3 channel is actually needed (Free-tier bandwidth).
- **URL + header override** (`setUpdateURLAndRequestHeadersOverride` + `disableAntiBrickingMeasures`): preview-only, anti-bricking off. Do not enable on production or on the daily V3 device.

OTA publish (Windows, authorized JS-only):

```powershell
cd mobile/recorder
$env:APP_VARIANT = 'v3-preview'
$env:EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING = '1'
npx eas-cli update --channel v3-preview --environment preview --platform ios --message "Describe the change"
```

Cold-launch twice on the phone. Native Swift, plugins, entitlements, permissions, or SDK bumps still need `.github/workflows/ios-v3-device.yml` (or EAS iOS), then bump the string `runtimeVersion` and record a new fingerprint.

## Daily feel-loop (document only)

Patrick has no Mac. Prefer the physical iPhone. Do not start from an Android emulator.

1. One-time: signed V3 runtime `3.0.0-preview.4` already on device (GHA ad hoc or TestFlight). Background GPS/Watch/Siri need that binary, not Expo Go.
2. Day-to-day JS/layout: from `mobile/recorder` on Windows, logged into the `journeydeck` EAS account:

   ```powershell
   $env:APP_VARIANT = 'v3-preview'
   $env:EXPO_UNSTABLE_TUNNEL_V2 = '1'
   npx expo start --tunnel --dev-client
   ```

   Tunnel v2 is account-signed (`on.expo.app`) and is the Windows-friendly path. Open the existing `expo-dev-client` V3 build (`v3-development-simulator` is simulator-only; use a device developmentClient build if Fast Refresh is required on the phone).
3. If no development client is installed, JS-only changes that stay inside preview.4 go out on `v3-preview` via EAS Update, then two cold launches.
4. `eas go` / Expo Go for SDK 58 is fine for throwaway UI shells that do not need background location, Watch, CloudKit, or custom native modules. It is not the JourneyDeck recorder acceptance path.
5. Do not use paid EAS Maestro, paid Observe dashboards, or a Mac-only Xcode loop.

## Release path (document only)

Extend the tools that already exist. Do not add a new CI product.

**V3 internal device (current):** `.github/workflows/ios-v3-device.yml` on `macos-26` with the existing six signing secrets. Fingerprint skip applies. Encrypted IPA artifact, local decrypt, temporary HTTPS install. Not TestFlight.

**V2 / public iOS (frozen):** EAS Build `production` + `eas submit --platform ios --profile production` from Windows. `eas.json` already has `submit.production.ios.ascAppId = 6806502526`. Reuse existing EAS Apple credentials / ASC API key. Do not add the `.p8` to git.

**ASC / TestFlight ops on runners:** use `asc` (already in the App Store preflight skill) with `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_PRIVATE_KEY` on the existing Mac GHA or locally on Windows — list builds, metadata pull, TestFlight state. Do not put keys in source. Preflight skill: `.claude/skills/app-store-preflight-skills/`.

Suggested authorized sequence when a native V3 cut is actually approved:

1. Confirm fingerprint delta says native-delta (or `force_native`).
2. Run `ios-v3-device.yml` **or** `eas build --platform ios --profile v3-preview` (EAS minutes count against Free; GHA macOS does not).
3. Record the new iOS hash into `native-fingerprint.ios.json`.
4. Only with explicit submit authorization: `eas submit --platform ios` against the correct ASC app record for that bundle ID, then `asc` for processing/TestFlight checks.
5. Never auto-submit from this workflow.

V3 bundle `com.journeydeck.recorder.v3` is not the production App Store listing (`com.journeydeck.recorder`). Do not submit V3 to ascAppId `6806502526`.

## Gaps vs the priority spec

| Spec | Gap | This PR |
| --- | --- | --- |
| Fingerprint balanced on Expo 58 | Present in toolchain, unused by CI | Pinned + GHA delta gate |
| JS-only prefers EAS Update | GHA always archived; no recorded hash | Skip path ready; first archive must record the hash |
| `requestHeaders` / runtime override | Header only stamped in GHA Expo.plist | App-config header; override APIs documented, not shipped as UI |
| Daily feel-loop | Tribal / handoff-only | Written below |
| Release path from Windows + `asc` | EAS submit exists; GHA does not submit | Written below; no submit job added |
| Android shipping | Out of scope; no Android GHA here | Left untouched |

## Exact next PRs / steps

1. Dispatch `ios-v3-device.yml` once (or reuse the next already-needed native archive). Commit `native-fingerprint.ios.json` hash from the fingerprint artifact. After that, JS-only dispatches skip Xcode.
2. Keep `runtimeVersion: "3.0.0-preview.4"` until a native cut that actually breaks OTA; then bump the string and re-record the hash together.
3. Optional follow-up: internal-only channel-surf control using `Updates.setUpdateRequestHeadersOverride`, still on `v3-preview` until a second V3 channel is justified.
4. Optional follow-up: `eas fingerprint:compare --build-id <last-eas-ios>` from Windows as a local preflight, still without EAS Workflows.
5. Do not add paid Maestro/Observe jobs. Do not merge this branch to `main` as part of this assessment.

## Lower-priority notes (quick)

- Expo/EAS skills are already in-repo (`3d07ace`). `expo-upgrade` is not needed until a newer 58 preview/stable; keep `.npmrc` `legacy-peer-deps` and `react-native-legacy-deep-imports` until then.
- Expo Router is already `~58.0.4`; no Router 58 migration work in this PR.
- Noxcturnal / TinyBase / oxlint remain optional spikes; not started.
