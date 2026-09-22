# Current Handoff State

## Current objective

Teach future agents the safe JourneyDeck OTA and V3 TestFlight paths. Added a
canonical OTA runbook, dry-run-first OTA wrapper, and stronger existing-app
TestFlight instructions; no OTA, build, or submit was performed.

## Repository state

- `HEAD` is detached at `origin/main`.
- Current commit: `4e11d28` — `Draft: soft navy frost on stop/review sheets over imagery (#163)`.
- Working tree has local documentation/tooling changes for OTA guidance plus
  this handoff update.
- No staging, commit, push, deploy, EAS, TestFlight, or App Store action was
  performed in this session.

## Local changes from this task

- `mobile/recorder/docs/OTA_RUNBOOK.md`: canonical target matrix, authorization
  rules, OTA-safe vs native-change boundary, raw fallback commands, preflight,
  and post-publish checklist.
- `mobile/recorder/scripts/publish-ota.mjs`: guarded `eas update` wrapper.
  Defaults to dry-run; requires `--execute` to publish.
- `mobile/recorder/package.json`: adds `npm run ota:publish`.
- `mobile/recorder/package.json`: adds `npm run testflight:gate`.
- `mobile/recorder/AGENTS.md`: points OTA work to the runbook/wrapper and V3
  TestFlight work to the live-listing docs/gate.
- `mobile/recorder/docs/ios-v3-testflight.md`: adds the explicit existing-app
  rule. Agents must not create a new ASC app, use `.v3`, use ascAppId
  `6814695593`, or submit this stream to App Review.
- `mobile/recorder/APP_STORE_RELEASE.md`: repeats the existing-app rule at the
  top of the release checklist.

## Recent changes now on main

### #163 — Soft navy frost sheets

- Added soft navy Skia frost / `BackdropBlur` presentation for stop and review
  sheets over imagery.
- `mobile/recorder/src/navy-frost-policy.ts` defines the navy frost recipe,
  Reduce Transparency solid navy fallback, and frost vs opaque policy.
- `mobile/recorder/src/navy-frost.tsx` provides live `BlurView`, Skia stills,
  and solid fallback surfaces.
- `NativeSheet` supports transparent `surface="frost"` over imagery while the
  default opaque sheet stays `pageSheet`.
- Wired into journey marker review and Relive stop/review over-map flows.

### #164 — Reanimated list skeletons

- Added shared list skeleton bones and shared list enter/exit/layout motion.
- Reduce Motion and background state disable animation.
- Applied to Soundtracks archive, Journeys list empty load, Memories empty
  initial load, and JourneyCard row motion.

### #165 — V3 TestFlight live listing

- `APP_VARIANT=v3-store` with EAS profile `v3-testflight` targets the live App
  Store listing for TestFlight without changing bundle, Watch, or CloudKit
  identity.
- `v3-preview` remains isolated on separate identifiers.
- Gate fails closed without Patrick/CoS clearance. TestFlight only; no App
  Store review submit from that stream.

## Verification known from prior handoff

- Prior targeted checks for #163 included navy-frost, native-interactions,
  journey-markers-ui, journey-replay-stage, tab-runtime, and typecheck.
- `npm run ota:publish -- --target v3-preview --message "Dry run validation only"`
  passed dry-run and did not publish.
- `npm run ota:publish -- --target v3-testflight --message "Dry run validation only"`
  passed dry-run and did not publish.
- `npm run testflight:gate` intentionally failed closed because
  `AUTHORIZE_EAS_BUILD_AND_SUBMIT` was not set, while confirming ascAppId
  `6806502526`.
- No device stills, EAS, OTA, or release actions are recorded here.

## Next useful steps

1. Review and commit the OTA runbook/wrapper if accepted.
2. For visual review, capture native stills with `NavyFrostStill` over journey
   photo/map frames.
3. Keep V2 frozen except urgent customer bugs; route new non-urgent work to V3.
