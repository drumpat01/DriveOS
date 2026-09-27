# Current Handoff State — V4 Production Preparation

## Objective and branch (September 26, 2026)

- The owner wants Claude to finish V4 and operate its Expo/GitHub production path. V4 connector, Aurora Glass, and release handoff changes merged to `main` in PR #181 (`48e38f4`) after GitHub CI passed. This checkout is `D:\JourneyDeckV4`; verify its current branch and remote head before acting.
- V3 is feature complete except emergency fixes; V2 remains frozen. `origin/main` contains V3 Build 40 source, runtime `3.0.0-preview.8`; Build 40 is valid and in TestFlight beta testing on the live app. V4 stays a distinct runtime `4.0.0-preview.1` and `v4-testflight` update branch.
- No V4 TestFlight build, App Store submission, CloudKit Production schema deployment, or V4 OTA has occurred. No records or zones were deleted.

## V4 implementation

- Aurora Glass is an opt-in V4 Plus theme, not the default. `mobile/recorder/docs/v4-aurora-glass-theme-brief.md` contains the design decision, Appllama research, mockups, implementation status, and device review list. Native glass, frosted surfaces, scenery, map palette, and Reduce Transparency behavior are implemented in source but have not been seen on a physical device.
- CloudKit derives one canonical `JourneyDeck-<48 hex>` zone from the iCloud user record, reads legacy JourneyDeck zones, and writes new records to the canonical zone. V4 waits for Apple sign-in and isolates record-specific batch failures. Marker/photo local queues and migration 9 backfill existing records. Account deletion enumerates all JourneyDeck zones and preserves retry state on failure.
- `MarkerPhoto.rootJourneyId` and `Entitlement` were added to the Development schema. StoreKit publishes verified Pro subscription state as `entitlement_pro` and avoids unchanged writes. The checked-in V3 docs previously said marker types were absent from Production; the newer V3 handoff says they are present. Inspect the **live** Production schema, then deploy any missing fields/types before V4 sync testing. `mobile/recorder/docs/v4-public-connector.md` has the full contract.
- `v4-testflight` in `mobile/recorder/eas.json` targets the existing live bundle, iCloud container, and App Store Connect app. `mobile/recorder/docs/mockups/mcp-pro-onboarding.png` is a concept only; MCP entitlement enforcement and purchase-flow wiring remain unimplemented.

## Production handoff and access

- Read `mobile/recorder/docs/v4-production-handoff.md` for exact GitHub Actions commands, Expo identity, credential locations, CloudKit work, OTA boundary, and release checks. `.github/workflows/ios-v4-testflight.yml` provides manual validation and a main-only TestFlight build/upload path; `mobile/recorder/scripts/v4-release-preflight.mjs` checks the V4 target.
- GitHub environment `v4-release` exists and accepts deployments from `main` only. Its `EXPO_TOKEN` environment secret is **missing**. Local `gh` and EAS CLI logins work for the current operator; Claude must recheck auth in its session. EAS production lists the RevenueCat Apple SDK key name. EAS-managed iOS signing and App Store Connect API key have not been verified for V4 noninteractive use. Never put key values in Git, chat, or logs.
- V4 OTA still points to the separate xprem server. The GitHub workflow does not publish OTA. Read `mobile/recorder/docs/OTA_RUNBOOK.md` and establish V4 xprem signing/branch access before OTA work.

## Verification and next steps

- V4 release identity preflight, TypeScript typecheck, full mobile suite, workflow YAML parse, and PR #181 GitHub CI passed. The stale Fifty States source assertion was fixed. Manual **validate-only** run `36289303256` found that the Atlas insight test fixture assumes America/Chicago local time; the workflow now sets that time zone for validation, and rerun `36289551202` passed. No EAS build was dispatched. Swift and glass rendering require a macOS native build and physical iPhone/iPad review.
- Next: provision the missing Expo environment secret and verify EAS Apple credentials. Inspect/deploy CloudKit Production schema and run the connector's two-device TestFlight checks before any public V4 release.
