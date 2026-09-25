# Current Handoff State

## Icon, Settings, and back-navigation V3 OTA (September 25, 2026)

- Autumn Drive now uses the existing borderless dark-green/gold icon-family master, resized to an opaque 1024×1024 `mobile/recorder/assets/icon-midnight-canopy-v1.png`. Its JourneyDeck ring/wave scale and dimensional treatment match the other alternate icons.
- The obsolete standalone Markers page and its Settings entries were removed on phone and iPad; route and unused page sources were deleted. Journey markers attached to individual journeys remain intact.
- Native stack headers now request minimal icon-only back buttons. Settings editors and utility screens replace text such as `‹ Appearance` and `‹ Tools` with the same 44-point circular SF Symbol chevron treatment used by detail screens.
- Commit `a5558f8` was published through xprem to Build 38's `production` branch/runtime `3.0.0-preview.6`. iOS update `17903619478771`, publish group `31cf0e1c-8e53-4fa1-8074-adb51f4fe9a1`, message `Polish_Autumn_icon_and_navigation`, deployed September 25 at 18:45:50 UTC. Public manifest returned HTTP 200. Fifty focused tests, TypeScript typecheck, publisher iOS export, and `git diff --check` passed. The Home Screen icon still requires a native build; the OTA updates its switcher preview.

## Autumn Drive icon preview V3 OTA (September 25, 2026)

- The user approved a new Autumn Drive app icon derived from `mobile/recorder/assets/theme-autumn-drive-road-v1.png` and the JourneyDeck pulse mark. The approved art now replaces `mobile/recorder/assets/icon-midnight-canopy-v1.png` as an opaque 1024×1024 PNG.
- The existing V3-only native slot remains `JourneyDeckMidnightCanopy`, presented to users as Autumn Drive, so no catalog or persistence IDs changed. Nine focused icon tests, TypeScript typecheck, and `git diff --check` passed.
- Commit `58d1c9c` was published through xprem to Build 38's `production` branch/runtime `3.0.0-preview.6` so the approved art appears in the icon switcher preview. iOS update `17903610171301`, publish group `072fb038-3684-4aad-8731-5c9abfc5048a`, message `Preview_Autumn_Drive_app_icon`, deployed September 25 at 18:30:19 UTC. Build 38 still cannot apply this icon to the Home Screen; that requires a new V3 TestFlight native build embedding the replacement icon set.

## Current V3 OTA (September 25, 2026)

- Commit `173c7cb` raises the expanded iPhone Journey Library tray, gives each journey two independently truncating lines (start on top; destination and compact metrics below), and evens Memory detail spacing with aligned section/card edges. The changes are OTA-safe layout/JS only.
- xprem iOS update `17903604981361`, publish group `1539de82-66aa-43ec-b2d9-e495bf780f95`, message `Improve_Memories_layout`, published September 25 at 18:21:40 UTC to branch/channel `production` for runtime `3.0.0-preview.6` and Build 38. Public manifest returned HTTP 200, update UUID `ba8bb96f-a5f6-d532-1813-1da9d4228549`, and a launch asset. Focused layout tests (48), TypeScript typecheck, diff check, and publisher iOS export passed. No native build, EAS OTA, or Git push.

## Prior legacy server retirement V3 OTA (September 25, 2026)

- Commit `e84c1c0` retires the legacy recorder-server path for new V3 users: the public server-address/key form and credential-save function are removed, native V3 journey imports no longer create remote completion jobs, and clean profiles show that their archive and backup path is local SQLite plus private iCloud. Existing profiles with previously stored legacy credentials may still load them to finish old migration work; no clean/new profile can configure this path.
- xprem iOS update `17903597103381`, publish group `b94fd4ba-7ad4-4e4a-bf5b-011fbb5264b2`, message `Retire_legacy_server_for_new_users`, published September 25 at 18:08:32 UTC to branch/channel `production` for runtime `3.0.0-preview.6` and Build 38. Public manifest returned HTTP 200, update UUID `3f6926e8-4ec7-32a3-2d83-a124204ce6ee`, and a launch asset. Focused tests (74), TypeScript typecheck, diff check, and publisher iOS export passed. No native build, EAS OTA, or Git push.

## Prior iCloud route status V3 OTA (September 25, 2026)

- Commit `39f04ea` corrects Data Health's conflated sync indicators: optional server GPS upload flags and remote completion jobs are shown separately from private iCloud work; the hardcoded recorder Connected label is replaced with the local archive status. A new iCloud route backups row counts completed-route GPS points acknowledged by CloudKit and routes still pending, without changing sync behavior. The screenshot before this change showed no saved recorder server for the active profile, 16,428 points with unset optional server upload flags, 3 total completion jobs, and Private iCloud Synced; it did not prove how many route points CloudKit had acknowledged.
- xprem iOS update `17903590834861`, publish group `2d20aec0-b7e2-40be-93c3-6edd213a171e`, message `Clarify_iCloud_route_backup_status`, published September 25 at 17:58:06 UTC to branch/channel `production` for runtime `3.0.0-preview.6` and Build 38. Public manifest returned HTTP 200, update UUID `6870b0f6-584a-68ab-97f3-ab218a618fc0`, and a launch asset. Focused tests (56), TypeScript typecheck, diff check, and publisher iOS export passed. Next: confirm on the device after two cold launches, read the new route backup row, then investigate any routes or local completion jobs still pending. No native build, EAS OTA, or Git push.

## Prior recorder destination V3 OTA (September 25, 2026)

- Commit `88af29d` adds a Data Health row showing only the saved recorder backup server host from the current iPhone profile's secure connection. It does not display the key, URL path, or account identity. This helps identify the destination of queued GPS points without changing sync behavior.
- xprem iOS update `17903585591291`, publish group `dd5f0b7c-9381-4ddf-85c2-e95ac472d116`, message `Show_recorder_backup_host`, published September 25 at 17:49:21 UTC to branch/channel `production` for runtime `3.0.0-preview.6` and Build 38. Public manifest returned HTTP 200, update UUID `1efbe5e2-c903-e76d-0ca3-fd6e934041d1`, and a launch asset. Focused UI tests (35), TypeScript typecheck, diff check, and publisher iOS export passed. Next: confirm on device after two cold launches; read the new destination row and investigate the recorder backlog. No native build, EAS OTA, or Git push.

## Prior Autumn Drive V3 OTA (September 25, 2026)

- Commit `b4ad907` rebuilds Autumn Drive around the 1536×1024 scenic road image `theme-autumn-drive-road-v1.png`, matching the other theme artwork dimensions. The switcher, welcome, and Home artwork use it; the palette and map colors use forest shadow, warm ivory, copper, and golden-hour light. The stored theme ID remains `midnight-canopy` for compatibility.
- xprem iOS update `17903548807231`, publish group `69352a2b-7c6e-49a1-975c-04fa4be1db27`, message `Autumn_Drive_artwork_and_palette`, published September 25 at 16:48:04 UTC to branch/channel `production` for runtime `3.0.0-preview.6` and live V3 TestFlight identity. Public manifest returned HTTP 200, update UUID `9ac9cca4-ee34-0d27-d1fc-5ccc8362452b`, and a launch asset. No native build, EAS OTA, or Git push was performed.
- Verification: 31 focused theme tests, TypeScript typecheck, `git diff --check`, V3 store iOS Expo export, and guarded publisher dry run passed. Confirm on a Build 38 device with two cold launches and inspect the theme switcher, welcome, Home, and map.

## Prior V3 OTA (September 25, 2026)

- Branch `codex/v3-testflight-ota-20260925` at `e84ed57` combines the photo-choice change (`fd85fc7`) with the post-Build-38 JS-only private iCloud sync backoff fix (`e84ed57`). The photo change removes optional SensitiveContentAnalysis native source and its framework link; the current Build 38 native binary is unchanged. OTA delivers the matching JavaScript and copy, plus the iCloud fix. Automatic suggestions still use time/location; Memory Add Photo remains available for any user-chosen image within format and size limits.
- xprem iOS update `17903454568571`, publish group `085dcaf9-cda4-44e8-84c5-01d62915521c`, message `V3_photo_choice_and_iCloud_sync_recovery`, published September 25 at 14:11:38 UTC to branch/channel `production` for runtime `3.0.0-preview.6` and live V3 TestFlight identity. Public manifest returns update UUID `73c3ed32-1988-3323-5405-9c84218b2fbe` with a launch asset. No EAS OTA, new native build, Git push, or App Review submission was performed.
- Combined validation: 79 focused mobile tests, TypeScript typecheck, `git diff --check`, and V3 store iOS Expo export passed. Swift was source-reviewed on Windows. Confirm the OTA on a Build 38 device with two cold launches and check photo choice and iCloud sync behavior there.
- The pinned Windows `eoas@3.2.2` CLI first rejected spaces in the message, then Windows asset paths. Publishing succeeded with a single-token message and a temporary path-normalization change in the npm-cached CLI; the cached CLI was restored. The ignored `mobile/recorder/dist` and `C:\Users\patri\AppData\Local\Temp\journeydeck-v3-ota-preflight-20260925` exports remain because recursive cleanup was blocked by tool policy. The temporary `node_modules` junction was removed.

## Current V3 source and release (September 24, 2026)

- Main at 5869905 (PRs #174–175) combines the current website and server sources with the V3 mobile source used for Build 38, plus tools/xprem-local. The mobile master database schema is 11.
- Build 38 is the current native TestFlight build: EAS build a34d2a2a-1201-4b9e-bcc3-e6eeb79a6968, live bundle com.journeydeck.recorder, production channel, runtime 3.0.0-preview.6. EAS submission 47a2abe5-82ea-4c5f-b076-4fb71ed53ae2 finished and Apple accepted the upload. The IPA embeds the xprem HTTPS manifest URL, app ID, signing certificate, and production channel.
- Build 38 was produced from the previously dirty checkout C:\Users\patri\JourneyDeckv3-origin-main-20260922. Its handoff retains detailed Tessie, artwork, Ask, photo, Worker, OTA, and device-validation history. The current integration copied its mobile and Cloudflare source; the source checkout remains unmodified.
- Earlier Expo builds use runtime 3.0.0-preview.5 and Expo Updates. Do not publish the runtime .6 source to that older runtime. The Last.fm image relay in Cloudflare source has not been deployed.
- V2 remains frozen. V3 TestFlight uses the existing live App Store identity and is not submitted to App Review without separate authorization.

## Local xprem environment

- tools/xprem-local runs xprem v3.2.2 and PostgreSQL with persistent local volumes. The optional Cloudflare Tunnel serves https://ota.journeydeck.me while this computer and Docker are running.
- Local credentials, keys, tunnel token, and publisher token are in ignored tools/xprem-local/.env; the public signing certificate is in ignored certificate.pem. Back up that file with both Docker volumes.
- Build 38 source configures xprem for V3 preview and live TestFlight, with a checked-in public certificate and guarded publisher. V2 retains Expo Updates.

## Local worktrees

- Six clean, inactive worktrees were removed on September 24: `.codex/tmp/journeydeck-testflight-0c40416`, `.codex/tmp/journeydeck-x-follow`, `JourneyDeckv2/.cache/grand-touring-web-beta-release`, `DriveOS-legal-deploy`, `JourneyDeckv3-site-private-journal-20260924`, and `JourneyDeckv3-site-soundtrack-20260923`. No branches or commits were deleted. The x-follow and private-journal directories retain only `node_modules` junctions to other checkouts after Git removed their worktrees.
- Twenty-one worktrees remain registered. Worktrees with uncommitted changes or ignored local data/artifacts were preserved, as were the current checkout and the `main` checkout. The standalone `JourneyDeck-v3-preview4-xcode27-20260918` clone is absent; `JourneyDeck-native-sim-trial` has untracked docs. The two site worktree commits match their live remote branches.
- The npm download cache was cleared with `npm cache clean --force`, freeing about 5.63 GB on C:. The remaining npm `_npx` cache is about 1.01 GB; direct deletion was blocked by tool policy. `pnpm store prune` found no unused packages.

## Verification and next step

- PR #174 passed JourneyDeck CI before merging. Mobile, server, and Cloudflare typechecks passed; all 903 mobile tests and 12 server API tests passed. The Build 38 V3 store iOS Expo export passed after clearing a stale cross-checkout Metro cache. Staged Gitleaks and git diff --check passed.
- Verify Build 38 on device and separately validate the new Ask/photo native bridges before another build or OTA. Do not infer on-device success from source tests.
