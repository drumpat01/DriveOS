# Build 39 preflight and Siri review

Reviewed September 25, 2026 for the user-authorized V3 TestFlight build.
Target: existing app `6806502526`, bundle `com.journeydeck.recorder`,
profile `v3-testflight`, runtime `3.0.0-preview.7`, database schema 11.
Public App Review submission is outside this release.

## Resolved findings

- Isolated Build 39 from Build 38's `.6` OTA runtime so an older published chat
  cannot replace the new bundled implementation.
- Fixed the recorder's remaining preview-bundle-only marker guard. Both the
  Siri facade and durable recorder now require the explicit V3 marker capability.
- Replaced the preview-only Siri supporting-details URL with the actual configured
  app scheme, verified as `journeydeck-recorder` for the live TestFlight app.
- Kept Start, Stop, and Marker shortcut discovery available before iOS 26 by
  guarding only the Ask shortcut. The conditional shortcut provider needs iOS 17.4;
  the Ask App Intent and Foundation Models need iOS 26 or later.
- Put Siri recorder entry points on the main actor for Core Location initialization.
- Bound model success, failure, and fallback reads to the requesting profile and
  epoch. A switch during inference cannot answer from the new profile.
- Extended the query context as well as the ticket for in-app session follow-ups.
  Siri context retains its five-minute limit; lock/profile changes invalidate access.
  The bounded ticket cache evicts its oldest entry rather than all prior answers.
- Added deterministic period follow-ups for previous model queries, including
  when the model becomes unavailable. Requested metrics and filters are preserved.
- Preserved explicit numeric and written top-list sizes rather than forcing one result.
- Fixed initialization/recovery recreating retired server jobs for native journeys.
  Native completion now marks that optional server work unnecessary atomically;
  the legacy job backfill excludes native sessions. Crash tests verify the three
  local/iCloud jobs across termination and reopening at every write boundary.

## Reviewed behavior

- Start/Stop use the durable native command journal, active session, permission,
  profile readiness, and control-token checks. Success speech requires a matching
  applied receipt. Marker requires an active recording and a recent durable GPS fix.
- Ask requires local device authentication, reads SQLite without writes, uses
  profile-scoped allowlisted SQL, and rechecks account/lock state after inference.
  No archive rows, coordinates, notes, photos, or generated SQL go to the model.
- Foundation Models interprets the question on the device. Validated queries calculate
  facts; unavailable/busy models can use supported local rules. All nonanswers use
  exactly `Beep Boop. Can not compute.` Siri speech still follows iOS settings.
- The app chat shares the native answer service, keeps per-profile in-memory bubbles,
  retains in-flight replies across sheet closes, and uses each theme's matching icon.
- All Siri features are membership free. TestFlight unlocks Plus features; Data Health
  and the synthetic Siri testing screen remain hidden in this non-internal build.
- All five light icons and five dark icons are RGB PNGs without alpha, 1024×1024.
  Asset-generation tests verify exact approved pixels and Any/Dark catalog entries.
- The build includes removal of optional SensitiveContentAnalysis from photo selection.
- The live CloudKit/Watch identities and existing signing target remain consistent.
  React Native's CocoaPods privacy aggregation includes the app's UserDefaults reason.

## Verification

- Focused Siri, query, chat, shortcut, icon, and build configuration tests pass.
- TypeScript typecheck, iOS production export, authorized TestFlight gate, config
  introspection, public privacy/support URL checks, and whitespace checks pass.
- Online Expo Doctor: 19/20. The sole warning recommends newer packages than this
  pinned SDK 58 preview. The installed preview's bundled version check passes.
  Keep the known Build 38 dependency set for this release; do not suppress the warning.
- Full mobile suite: 928 passed, zero failed, one optional visual test skipped.
  Cloud Xcode archive results are recorded in the handoff after completion.
- Windows cannot run the iOS prebuild/Swift compiler. EAS uses the verified Build 38
  image `macos-tahoe-26.6-xcode-27.0` to perform actual generation and compilation.
- One optional image-golden test has no private reference frames on this computer.

## Build and archive result

- EAS Build 39 `79a20176-3607-42bb-99ea-766370d62172` finished successfully.
  Xcode 27 generated, compiled, linked, archived, and signed the app and Watch target.
  The Foundation Models `GenerationOptions(sampling:)` initializer produced a
  deprecation warning; it remains compatible with the iOS 26 implementation.
- Signed IPA inspection verified version 3.0.0 / build 39, runtime `.7`, live bundle,
  production CloudKit entitlement, Watch identity, all five alternate icon names,
  Ask/Marker flags, actual URL scheme, packaged query engine, and privacy manifest.
- Extracted App Intents metadata contains Start, Stop, Marker, and Ask shortcuts,
  each with `openAppWhenRun: false`. This App Shortcuts integration does not use a
  non-shortcut SiriKit Intents extension. See Apple's [Siri entitlement scope](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.siri).
- The executable weak-links Foundation Models and does not link SensitiveContentAnalysis.
  Generated light/dark catalog inputs are covered by the icon tests; actual Home
  Screen rendering remains part of device acceptance.
- IPA SHA256: `a0299983a61ae1b5071a115b5f1e0b4c06833f03402f56755604850a16d5a530`.
  Local inspection receipt: `artifacts/build39/ipa-inspection.json` (ignored).
- TestFlight submission `001dc6db-a7b3-419d-9860-9767f8f519e0` uploaded
  Build 39 to App Store Connect. The EAS worker later reported `ERRORED` when
  its processing-status poll received an ASC 401 after about 22 minutes.
  A fresh ASC status query confirms the exact build is `VALID` and
  `IN_BETA_TESTING` for internal testers, runtime `.7`, on existing app
  `6806502526`. The EAS error is a stale status-check result, not an upload
  or binary failure. Do not retry or rebuild; no public App Review requested.

## Device acceptance after installation

Check Siri Start/Stop/Marker, Ask spoken answers and its supporting-details link;
ask a follow-up after five minutes inside the app; test account switching and device
locking during inference; check model-disabled fallback, all icon appearances, and
chat layout/VoiceOver on iPhone and iPad. Automated/source checks do not prove these
physical-device behaviors or model interpretation accuracy.
