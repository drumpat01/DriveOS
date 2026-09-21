# Current Handoff State

## Current objective

Wire 1Password `load-secrets-action` into `ios-v3-device.yml` so signing blobs
are not stored in the GitHub Secrets UI. Draft PR only. Do not merge, dispatch,
or submit to TestFlight/App Store.

## Material changes

- `.github/workflows/ios-v3-device.yml` loads the six existing `IOS_*` names
  from `op://JourneyDeck-CI/ios-v3-device/...` via
  `1password/load-secrets-action@v5` (`export-env: true`) after the fingerprint
  decision and only when `NATIVE_REBUILD` is true.
- The only GitHub secret this job may use is `OP_SERVICE_ACCOUNT_TOKEN`.
  `${{ secrets.IOS_* }}` bindings are removed from preflight/install/encrypt.
- Docs: `mobile/recorder/docs/ios-github-device-build.md` secrets section,
  new Key Master note `mobile/recorder/docs/ios-1password-ci.md` (ad hoc
  profiles required; store file blobs as already-base64 text).
- Fingerprint delta, `force_native`, no EAS Build, and `runtimeVersion` string
  policy are unchanged.

## Active tree

- Branch: `cursor/ios-v3-1password-secrets-5e2e` off `main`.
- V3 runtime remains string `3.0.0-preview.4` on channel `v3-preview`.

## Verification

- Targeted: `node --experimental-strip-types --test tests/ios-fingerprint-delta.test.mts tests/ios-device-build.test.mts` (from `mobile/recorder`).
- No workflow dispatch. No native archive. No App Store/TestFlight submit.

## Unresolved

- Key Master must create vault `JourneyDeck-CI`, item `ios-v3-device`, and
  GitHub secret `OP_SERVICE_ACCOUNT_TOKEN` before a native archive can succeed.
- `native-fingerprint.ios.json` hash is still null until the next successful
  V3 native archive.

## Next steps

1. Review the draft PR; do not merge.
2. Populate 1Password fields and the thin GitHub token secret.
3. Do not re-dispatch this workflow as part of the secrets wiring.
