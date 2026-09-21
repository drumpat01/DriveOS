# Current Handoff State

## Current objective

Expo CI and EAS Update path assessment for JourneyDeck V3 (iOS-only, Expo 58 beta, Free EAS). Draft PR `cursor/expo-ci-update-path-ec81`. Do not merge to main, deploy, or submit.

## Material changes

- Pinned `@expo/fingerprint` **balanced** in `mobile/recorder/fingerprint.config.js`.
- GHA `.github/workflows/ios-v3-device.yml` now compares iOS fingerprint delta and skips native archive when unchanged (`force_native` override). Missing hash fails closed.
- `app.config.js` embeds `updates.requestHeaders['expo-channel-name']` per variant.
- Assessment, feel-loop, and release plan: `mobile/recorder/docs/expo-ci-update-path.md`.

## Active tree

- Branch: `cursor/expo-ci-update-path-ec81` off `main`.
- V3 runtime remains string `3.0.0-preview.4` on channel `v3-preview`. Do not switch `runtimeVersion` to fingerprint policy while preview.4 binaries are installed.
- V2 remains frozen. Production channel/bundle stay untouched.

## Verification

- Targeted: `node --experimental-strip-types --test tests/ios-fingerprint-delta.test.mts tests/ios-device-build.test.mts` (run from `mobile/recorder`).
- No EAS Update published, no native archive, no App Store/TestFlight submit.

## Unresolved

- `native-fingerprint.ios.json` hash is still null until the next successful V3 native archive; then commit that hash so JS-only GHA runs skip Xcode.
- Physical-device / tunnel feel-loop is documented only.
- Siri AI remains paused pending Apple Small Business Program / Private Cloud Compute confirmation.

## Next steps

1. Review the draft PR; do not merge.
2. After the next needed native V3 archive, record the iOS fingerprint hash.
3. JS-only V3 work continues via authorized `eas update --channel v3-preview --environment preview --platform ios`.
