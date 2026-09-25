# JourneyDeck OTA Runbook

This is the canonical guide for AI agents publishing JourneyDeck mobile OTA
updates. Read this before any `eas update` work.

## First rule

Publishing an OTA changes remote state and can affect installed apps. Do not
publish unless Patrick explicitly authorizes the exact target.

Acceptable authorization examples:

- "Publish a V3 preview iOS OTA to `v3-preview`."
- "Publish a V3 TestFlight/live identity iOS OTA to `production`."

If the request does not name the target clearly, stop and ask. Do not infer the
target from the current Git branch.

## OTA-safe changes

OTA can carry compatible JavaScript, styling, copy, and bundled asset changes.

OTA cannot carry native changes. Use a new native build for Swift, native
modules, config plugins, entitlements, permissions, SDK upgrades, native
dependency changes, Watch, Siri, CloudKit identity, app icon identity,
background-mode changes, or runtime-version changes.

Never change `runtimeVersion` merely to make an update appear. The string
runtime is the compatibility boundary for installed builds.

## Current targets

| Target | Channel | Environment | `APP_VARIANT` | Notes |
| --- | --- | --- | --- | --- |
| `v3-preview` | `v3-preview` | `preview` | `v3-preview` | Current source targets the next native runtime `3.0.0-preview.6`. |
| `v3-testflight` | `production` | `production` | `v3-store` | Build 38 uses xprem and runtime `3.0.0-preview.6`; publish with `xprem:publish`. Requires explicit authorization. |

Phase 7 compatibility boundary: installed Build 35 uses `3.0.0-preview.4`
and its native Ask reader accepts archive schema 9 only. This source migrates
to schema 11 and updates that native reader; it must first ship in a new
`3.0.0-preview.5` native build. Do not retag this tree as preview.4 or use the
legacy marker compatibility override. See `tessie-v3-phase7.md` for the artifact
audit and release gates. Preserve the installed Last.fm flow when releasing.

The native-to-OTA Ask and Expo MediaLibrary changes advanced the current source
to `3.0.0-preview.6` in Build 38. Do not publish this source as an OTA for Build 36's
`3.0.0-preview.5` runtime.

Do not use the legacy `preview` channel for V3. Do not publish V3 preview code
to `production`. Do not publish V2 production OTA unless there is an urgent
customer-reported bug and Patrick explicitly authorizes that V2 release action.

## Existing Expo Updates builds

Build 36 and earlier binaries still check Expo Updates. Use the existing
`ota:publish` wrapper only for an explicitly authorized, runtime-compatible
Expo target. This checkout's `3.0.0-preview.6` source is not compatible with
Build 36's `3.0.0-preview.5` runtime.

### Preferred command

Use the guarded wrapper instead of composing raw EAS commands:

```powershell
cd mobile/recorder
npm run ota:publish -- --target v3-preview --message "Describe the change"
```

The wrapper defaults to dry-run and prints the exact command. To actually
publish after explicit authorization:

```powershell
cd mobile/recorder
npm run ota:publish -- --target v3-preview --message "Describe the change" --execute
```

For V3 TestFlight/live identity OTA, only with explicit authorization:

```powershell
cd mobile/recorder
npm run ota:publish -- --target v3-testflight --message "Describe the change" --execute
```

## Raw commands

Only use these when the wrapper is unavailable.

### V3 preview

```powershell
cd mobile/recorder
$env:APP_VARIANT = 'v3-preview'
$env:EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING = '1'
npx eas-cli update --channel v3-preview --environment preview --platform ios --message "Describe the change"
```

### V3 TestFlight/live identity

```powershell
cd mobile/recorder
$env:APP_VARIANT = 'v3-store'
$env:EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING = '0'
npx eas-cli update --channel production --environment production --platform ios --message "Describe the change"
```

## Preflight checklist

1. Run `git status` and `git log -5 --oneline`.
2. Confirm the only intended source changes are OTA-safe.
3. Confirm `mobile/recorder/app.config.js` still maps the target to the
   expected channel and runtime.
4. Run targeted tests for the changed behavior. Run `npm run typecheck` when
   TypeScript may be affected.
5. For asset or bundling-sensitive changes, run `npx expo export --platform ios`
   only when appropriate for the change and authorization.
6. Confirm the Expo account/project is `journeydeck`.

## Post-publish checklist

Record the update group/id, channel, environment, platform, runtime, commit,
and message in the handoff or release notes. Tell Patrick to fully terminate and
reopen the release build up to two times:

1. One cold launch can discover and download the update.
2. The next cold launch can run the downloaded update.

Never submit to App Review as part of OTA work.

## Future V3 builds using local xprem

New V3 preview and V3 TestFlight native builds made from this configuration use
`https://ota.journeydeck.me/manifest` and verify xprem signatures with
`certs/xprem-certificate.crt` (PEM-formatted public certificate). The `v3-preview` and `production` channels map
to branches of the same names on the local xprem server. V2 builds retain the
Expo Updates URL. Keep the computer, Docker Desktop, and the Cloudflare Tunnel
running for those new builds to check for updates; installed builds can still
launch their embedded bundle when the server is unavailable.

Build 38 uses xprem. Use the guarded xprem wrapper for compatible JavaScript
updates. It defaults to dry-run:

On Windows, pinned `eoas@3.2.2` currently emits backslashes in exported asset
paths, which xprem rejects during upload. Resolve that CLI/platform issue before
the next publish; switching Build 38 to `ota:publish` will not reach its xprem
client. A single-token `--message` also avoids the wrapper's Windows shell
argument splitting issue.

```powershell
cd mobile/recorder
npm run xprem:publish -- --target v3-preview --message "Describe the change"
```

For a separately authorized publish, set the app-scoped `EOO_TOKEN` in the
process environment and add `--execute`. The wrapper requires a clean Git
working tree, checks the selected app URL, channel, app ID, and signing
certificate, and pins `eoas` to the server version `3.2.2`. Never print or
commit the token. The local server's ignored
`C:\Users\patri\JourneyDeckv3-current\tools\xprem-local\.env` contains the
token; back it up with the Docker volumes. If the server version changes,
review and update the pinned CLI version before publishing.
