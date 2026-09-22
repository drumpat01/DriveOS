# Current Handoff State

## Current objective

V3 version 3.0.0 build 35 was built and submitted to TestFlight on the
existing JourneyDeck App Store Connect app. Apple reports the build VALID and
IN_BETA_TESTING. Confirm individual tester access on device if needed.

## Repository state

- Build 35 was produced from `ca464d1` (PR #167 merged) plus the EAS
  archive and post-install fixes carried on `codex/work-from-main-ca464d1`.
- `.easignore` excludes `/.claude/` to avoid a Windows junction error
  during EAS archive creation. `package.json` invokes
  `scripts/diagnose-expo-modules-jsi.mjs` in the EAS post-install hook for
  `v3-testflight`, removing `-quiet` from the nested Xcode command.

## Now on main via #166

- OTA runbook: `mobile/recorder/docs/OTA_RUNBOOK.md`
- Dry-run-first wrapper: `mobile/recorder/scripts/publish-ota.mjs`
  (`npm run ota:publish`). Defaults to dry-run; `--execute` is required to
  publish after explicit authorization.
- V3 TestFlight live-listing docs: `mobile/recorder/docs/ios-v3-testflight.md`
- Gate: `mobile/recorder/scripts/v3-testflight-gate.mjs`
  (`npm run testflight:gate`)
- Pointers in `mobile/recorder/AGENTS.md` and this handoff.
- Release checklist also repeats the existing-app rule in
  `mobile/recorder/APP_STORE_RELEASE.md`.

## Locked V3 TestFlight facts

Preserve exactly. Do not invent alternatives.

- ASC `6806502526`
- Bundle `com.journeydeck.recorder`
- EAS profile `v3-testflight`
- `APP_VARIANT=v3-store`
- Channel/environment `production` / `production` for the TestFlight OTA
  target
- TestFlight only — never App Review from this stream
- Forbid a new ASC app, isolated preview ascAppId `6814695593`, and the
  `.v3` bundle for this TestFlight stream
- Preview OTA remains `v3-preview` / `preview` / `APP_VARIANT=v3-preview`
- Publish, build, and submit require explicit Patrick authorization.
  Wrappers dry-run / fail closed by default.

## Recent merges on main

- #166 — guarded OTA and V3 TestFlight agent process docs
- #165 — V3 TestFlight live listing
- #164 — Reanimated list skeletons
- #163 — soft navy frost

## Next steps

1. EAS build `dd07903d-29dc-44e7-be78-4f0f2ba361c6` FINISHED:
   version `3.0.0` build `35`, profile `v3-testflight`, live bundle
   `com.journeydeck.recorder`, source commit `ca464d1`. The post-install hook
   ran and the Watch policy test passed on the Mac worker.
2. EAS submission `9ae714d7-c12c-45c9-bbb6-20a5ca6f7503` FINISHED.
   `eas submit:status` reports ASC `6806502526`, processing `VALID`, internal
   state `IN_BETA_TESTING`, runtime `3.0.0-preview.4`. Existing public live
   version remains 2.0 build 31. No App Review submission or new ASC app.
3. Earlier build 34 failed because the nested ExpoModulesJSI Xcode command
   emitted `error: the following command failed with exit code 0 but produced
   no further output` despite reporting a built framework. Removing `-quiet`
   for build 35 produced a successful archive. Do not resubmit build 34.
4. Release checks: `npm run typecheck` and `npx expo export --platform ios`
   passed. `npm test` has a Windows CRLF-only assertion failure in
   `tests/v3-testflight-eas.test.mts`; targeted native release tests pass.
   `expo-doctor` reports 32 SDK 58 beta version mismatches.
5. Verify TestFlight installation on an internal tester device; EAS status
   does not prove access for a specific tester.
