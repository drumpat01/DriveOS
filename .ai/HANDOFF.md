# Current Handoff State

## Current objective

Keep agents pointed at the safe OTA and V3 TestFlight paths now on `main`.
Refresh this handoff again after material Eng or Release process changes.
Do not invent process.

## Repository state

- On `main` at `8078d05` (PR #166 merged).
- Clean remote `main` for this purpose. Do not treat this file as a local
  session journal.

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

1. Keep this handoff current after material Eng or Release process changes.
2. Do not invent process.
3. Docs work does not authorize OTA publish, EAS build, TestFlight submit,
   or App Review.
