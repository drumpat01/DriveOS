# V4 production control handoff

Current owner intent (September 26, 2026): Claude should be able to finish V4 and operate its Expo/GitHub release path. This file records the exact setup and remaining access work. It does not contain credentials. Read root `GEMINI.md`, mobile `AGENTS.md`, the current `.ai/HANDOFF.md`, [Aurora Glass brief](v4-aurora-glass-theme-brief.md), and [connector contract](v4-public-connector.md) for the work at hand.

## Identity and boundaries

- Repository: `drumpat01/DriveOS`; Expo project `@journeydeck/journeydeck` (`ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4`).
- V4 uses EAS build/submit profile `v4-testflight`, `APP_VARIANT=v4-store`, iOS bundle `com.journeydeck.recorder`, CloudKit container `iCloud.com.journeydeck.recorder`, existing App Store Connect app `6806502526`, and runtime `4.0.0-preview.1`.
- The V4 TestFlight build uses the **existing live listing**. `eas submit` uploads to App Store Connect/TestFlight; it does not submit an app version for App Review. Do not create another app or use the isolated `.v3` bundle.
- V4's `expo-updates` URL points to the project's **xprem** server and `v4-testflight` branch. EAS Build/Submit automation below does not publish OTA updates. Read `docs/OTA_RUNBOOK.md` and verify xprem V4 branch/signing before any V4 OTA work.
- The CloudKit Production schema was deployed on September 27, 2026 (`MarkerPhoto.rootJourneyId` and the `Entitlement` type) and now matches the connector contract. Future schema changes must be applied in the Console's Development environment before deployment. Editing the checked-in `.ckdb` alone changes nothing.
- V4 must not replace V3 in TestFlight: V4 builds are a separate Version 4.0.0 on the same app. Do not add V4 builds to the External group until the owner authorizes external testers. The internal group auto-distributes uploads.

## GitHub Actions entry point

`.github/workflows/ios-v4-testflight.yml` is a manual workflow. Its default `validate` operation installs mobile dependencies, checks V4 identity, typechecks, and runs mobile tests. `verify-credentials` (main only, `v4-release` environment) exercises `EXPO_TOKEN` with read-only `eas whoami`, `eas project:info`, and `eas build:list`; it never builds, submits, or publishes. `testflight` is restricted to `main`, requires the literal confirmation `V4_TESTFLIGHT`, and uses the `v4-release` GitHub environment. The environment allows deployments from `main` only. It requires `EXPO_TOKEN` as an environment secret. A successful dispatch queues an EAS iOS store build with the `v4-testflight` profile and auto-submits that build to the matching EAS submit profile. Read the EAS build and submission IDs/status afterward; a green Actions job means the request was queued, not that Apple finished processing it.

From a GitHub-authorized local shell, after the V4 work is merged to `main`:

```powershell
gh workflow run ios-v4-testflight.yml --ref main -f operation=validate
gh workflow run ios-v4-testflight.yml --ref main -f operation=verify-credentials
gh workflow run ios-v4-testflight.yml --ref main -f operation=testflight -f confirm_target=V4_TESTFLIGHT
gh run list --workflow ios-v4-testflight.yml --limit 5
```

The same local preflight is `node mobile/recorder/scripts/v4-release-preflight.mjs`. It checks the bundle, CloudKit container, runtime, channel, V4 feature flag, build environment, and App Store Connect ID without reading secrets.

## Credential locations and readiness

| Capability | Where it belongs | Current state / next action |
| --- | --- | --- |
| GitHub code, PRs, Actions | Local `gh` login or an appropriately scoped GitHub App/PAT; Actions uses its built-in `GITHUB_TOKEN` | Local `gh` is authenticated as `drumpat01`; Claude can use it only in a session where that login is available. No token value belongs in the repository. |
| Expo EAS CI | `EXPO_TOKEN` in the GitHub `v4-release` **environment secret** | **Verified for read-only project access.** Workflow run `36293057575` passed `eas whoami`, `eas project:info`, and `eas build:list` without building or submitting. Do not reuse or print the local Expo session token. |
| Expo local operations | Expo CLI login or `EXPO_TOKEN` in local secret storage | The local EAS CLI reported account access to `@journeydeck/journeydeck`; recheck `eas whoami` when Claude starts. Do not copy login files into Git. |
| iOS signing and App Store Connect upload | EAS-managed iOS credentials and App Store Connect API key for the existing app | **Verified by V4 Build 41** (EAS build `5590c259-42b1-4b72-ae57-9ffd38500a48`, submission `076ac273-a9a0-4c4b-886e-a54e28a285b0`). The distribution certificate and profile expire 2027-08-21. Keep `.p8`, `.p12`, and provisioning profiles out of Git and Actions logs. |
| RevenueCat Apple SDK key | EAS **production** environment variable `REVENUECAT_PRODUCTION_APPLE_API_KEY` | The variable name is listed in the EAS production environment. Its value was not displayed or verified; it is a client SDK key, not a server secret. |
| CloudKit Production schema | Apple CloudKit Console with the appropriate Apple Developer role | **Deployed September 27, 2026** after a live read and a reviewed deploy diff. Treat CloudKit record contents and customer coordinates as private. |
| V4 OTA signing and xprem | The existing xprem host's private signing key and service credentials | **Not configured for GitHub Actions.** The checked-in certificate is public verification material only. Establish V4 branch and a guarded publish path separately if OTA control is required. |
| Future server connectors/API calls | Service-specific secret stores (for example GitHub environment, Cloudflare, or Expo), scoped to the service | Inventory each new integration when implemented. Never put server credentials in `EXPO_PUBLIC_` variables, mobile source, EAS app config, or this handoff. |

To rotate the Expo token without placing it in shell history or chat, use the GitHub repository Settings → Environments → `v4-release` → Environment secrets → `EXPO_TOKEN` interface. A local authenticated operator can also use `gh secret set EXPO_TOKEN --env v4-release` and provide the value securely on stdin. Verify only the secret's **name**, never its value.

Expo environment variables for remote builds are maintained in the EAS **production** environment. `v4-testflight` already selects that environment in `eas.json`. Variables embedded in client code, including `EXPO_PUBLIC_` values and the RevenueCat SDK key, must be treated as public even when stored as EAS sensitive variables.

## Before any production action

1. Fetch current `main` and reconcile the V4 branch without discarding either line of work; inspect `git status`, recent history, and focused diffs.
2. Fix any failed mobile/CI tests and run `node scripts/v4-release-preflight.mjs` from `mobile/recorder` against the intended release commit.
3. Verify the GitHub `v4-release` environment and Expo token are present, EAS iOS signing and ASC API key work noninteractively, and the `v4-testflight` build profile resolves to the live identity.
4. Confirm the CloudKit Production schema still matches the connector contract, then perform the connector's two-device TestFlight checks and the Aurora Glass device review. Windows typecheck cannot validate Swift or glass rendering; the EAS build is the native compile check.
5. Dispatch the workflow only for the intended V4 commit. Record build ID, submission ID, Apple processing state, and device result in the current handoff. App Review submission and public release remain separate steps.

The setup intentionally grants Claude a repeatable route to build and upload V4 through managed credentials. Access to an account is not permission to expose credential values in source, logs, chat, or generated artifacts.
