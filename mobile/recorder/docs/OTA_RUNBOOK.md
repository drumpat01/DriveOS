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
| `v3-preview` | `v3-preview` | `preview` | `v3-preview` | Patrick's internal V3 preview device path. Runtime `3.0.0-preview.4`. |
| `v3-testflight` | `production` | `production` | `v3-store` | V3 features on the live App Store identity for TestFlight only. Requires explicit authorization. |

Do not use the legacy `preview` channel for V3. Do not publish V3 preview code
to `production`. Do not publish V2 production OTA unless there is an urgent
customer-reported bug and Patrick explicitly authorizes that V2 release action.

## Preferred command

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
