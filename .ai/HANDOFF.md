# Handoff: JourneyDeck Mobile Shell and Music Connections

## Summary

- Feature branch: `codex/journeydeck-mobile-shell`; implementation merged to `main` in PR #111 as `6eeac09`.
- Expanded the single-purpose Recorder into JourneyDeck 1.1.0 while keeping the existing bundle identity and local recording database.
- Added Home, Journeys, Record, and Connections tabs; first-run provider selection; offline dashboard/history caches; journey details with real route geometry; pagination; and Tessie/Last.fm capability status.
- Added Apple Music, ShazamKit, and Last.fm choices with explicit benefits, limitations, and privacy copy.
- Added a local Expo iOS module for Apple Music authorization/current and recent tracks plus bounded ShazamKit recognition. Raw microphone audio is never stored or uploaded.
- Added a separate local-first SQLite music queue. GPS safety and Finish never wait for music sync.
- Added authenticated server APIs for dashboard, journey history/detail, provider preferences, music observations, connection capabilities, and bounded Last.fm session reconciliation.
- Added `LASTFM_API_KEY` to the Render Blueprint as a server-only secret.

## Build and Verification

- Final traceable EAS internal iOS build succeeded: `09f10cad-0b10-4dca-b49e-d4f8d2a20539` from commit `da6518d`.
- App version/build: JourneyDeck `1.1.0 (2)`; internal preview; expires September 6, 2026.
- Build/install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/09f10cad-0b10-4dca-b49e-d4f8d2a20539`.
- Direct IPA: `https://expo.dev/artifacts/eas/Cw6jypBkPmRgQKLNqh8c8-jTXUVuK7qV1cZ0HUkIzGg.ipa`.
- Build `48505346-f059-4d40-89d4-4d744b5732b0` (`1.1.0 (1)`) is superseded because its ad-hoc profile was invalidated when Apple App Services changed.
- Mobile typecheck passed.
- Recorder recovery: 10 passed; sync presentation: 4 passed; music normalization: 6 passed.
- Expo Doctor: 21/21; iOS Metro export passed; EAS native Swift build passed.
- Full repository suite passed: 29 server tests, 9 browser tests, PowerShell analysis, secret scan, and HIGH/CRITICAL dependency scan.
- `git diff --check` passed (Windows line-ending warnings only).

### Onboarding authorization follow-up

- Fixed Apple Music onboarding so choosing Apple Music immediately invokes native authorization and persists the connected state. Commit `898b119` (`fix(mobile): authorize Apple Music during onboarding`) pushed to `origin/codex/journeydeck-mobile-shell`.
- Verification: `npm run typecheck`, `npm run test:music-observations` (6/6), and `git diff --check` passed.
- EAS build 3 completed successfully: `8e9d6be9-4ef8-485a-a6cd-2162539b9c7e`, version `1.1.0 (3)`. Install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/8e9d6be9-4ef8-485a-a6cd-2162539b9c7e`.

### EAS Update configuration

- Added `expo-updates` to the mobile app and configured the existing Expo project update URL with `runtimeVersion` policy `appVersion`.
- Added EAS channels/environments: `preview` for the preview/development profiles and `production` for the production profile. No update was published; the corresponding branches will appear after the first publish.

### Mobile dashboard preview

- Expanded the native Home dashboard with today/all-time cards, recorder status, quick actions, latest vehicle context, road soundtrack, two recent journeys, and data-health rows using the existing local-first dashboard response.
- Removed the temporary EAS preview marker; retained the automatic Shazam overlap guard and manual-button removal.
- Added an in-app downloaded-update alert with a safe `Restart now` action; the user verified the OTA prompt and immediate reload on the physical iPhone.
- Added the cinematic neon dashboard and published preview update group `2b395cc2-aa64-4c91-9935-7f903b6c021d` for runtime `1.1.0`.
- Fixed the seven-day pulse chart to page through the complete current seven-calendar-day journey window instead of using only the five-item dashboard preview. Weekly journeys are cached for offline display.
- Replaced the small route doodle with a larger car-agnostic neon open-road hero built from native views, so it remains OTA-compatible and suitable for public users. Published preview update group `b6a3c06d-3f3c-449b-a6d5-e4d4fa003b7e` for runtime `1.1.0`.
- Current verification: mobile typecheck, recovery (10), sync status (4), music observations (6), iOS Metro export, and `git diff --check` passed. Dashboard/Shazam/update-alert source changes remain uncommitted for review.

### Native Memories page (delivered to preview)

- Replaced the native Journeys tab with a three-level Memories page: animated Memory carousel, selected Memory Collections, then the Journey list.
- Added native creation/editing for Memories and Collections. Memory membership adds/removes Collections; Collection membership adds/removes Journeys with immediate durable saves.
- Added narrowly authenticated Recorder mobile endpoints for the shared `memories`, `memory_collections`, `journey_collections`, and `journey_collection_drives` tables. The phone receives no broader web-session authority.
- Added server coverage for unauthorized access, Collection creation/update, Memory creation, catalog reads, and membership removal.
- Verification: `npm run check:server`, `npm run lint:server`, `npm run test:server` (29/29), mobile `npm run typecheck`, recovery (10), sync status (4), music observations (6), iOS Metro export, and `git diff --check` passed.
- Delivered through PR #113, merged to `main` as `a40cd1f`. Render deploy `dep-da5q4r0u01pc7384a930` is live, and preview OTA group `f1f28552-ad9f-4a18-a19f-111915c12568` was published for runtime `1.1.0`.

### Automatic drive detection (pending review and physical-device validation)

- Added a first-run recording-mode picker before music onboarding with Automatic and Manual cards, honest benefits/drawbacks/privacy copy, and no duplicate JourneyDeck brand header.
- The choice is durable and editable under Connections. Automatic mode hides idle manual-start controls but still lets the user open/finish an active journey; Manual mode retains Start/Finish and unregisters the detection task.
- Automatic mode registers a separate background GPS watcher. It starts only after three accurate readings at or above 6.7 m/s (about 15 mph) spanning at least 20 seconds and inside a two-minute window. It finishes only after five continuous minutes at or below 2.2 m/s (about 5 mph). Missing or worse-than-100-meter accuracy is ignored.
- Automatically detected journeys remain local-first, use the established route task and recovery flow, sync best-effort, and keep retryable finishing data on-device when offline.
- When Shazam is the selected soundtrack method, recognition is attempted at journey start and no more than once per minute while recording. Audio is never stored.
- Added deterministic drive-policy tests: 9/9 passed. Mobile typecheck, recovery (10), sync status (4), music observations (6), Expo Doctor (21/21), iOS Metro export, and `git diff --check` passed.
- Rebuilt the native Home dashboard around the web reference dashboard: a full-bleed car-agnostic neon-road hero, live detector overlay, soundtrack waveform, hourly driving graph, glowing action dock, compact journey/health grid, weekly activity, and all-time rail. The project-bound generated asset is `mobile/recorder/assets/dashboard-neon-road-v2.png` (built-in image generation; prompt requested a premium vehicle-free midnight highway with coral, violet, and cyan glow). Preview OTA group `b41c17b0-1637-4497-a2eb-bd746343185c` was published for iOS runtime `1.1.0`.
- Branch/worktree: `codex/automatic-drive-detection` at `C:\Users\patri\DriveOS-auto-detection`. Feature commit `3f1c621` (`feat(recorder): add automatic drives and cinematic dashboard`) is pushed to `origin/codex/automatic-drive-detection`; it has not been merged. Earlier preview OTA groups `f7900733-bc9d-4ebb-995c-1c27321be567` (automatic detection) and `5aefeacc-8a39-4ca6-88de-1114f91b22ec` (hide manual start controls in Automatic mode) were published for iOS runtime `1.1.0`.
- Required physical test: choose Automatic, confirm Always location and Shazam microphone permission when applicable, lock the phone, drive above 15 mph for at least 30 seconds, confirm automatic start, then park for at least five minutes and confirm automatic finish/sync. Also verify traffic stops, passenger trips, manual override, offline finish, and force-quit recovery.

## Release State and Next Steps

### Memories and Collections photos (implemented locally, not deployed)

- Added iPhone photo-library uploads to both Collection and Memory editors. Images are resized/compressed on-device, bounded to 1.5 MB, signature-validated on the server, and stored in the existing Collection/Memory attachment tables.
- A Memory catalog now automatically includes images from every selected Collection without copying them. The Memory editor displays direct and inherited photos and persists an explicit card-cover selection; deleting a selected image safely clears affected covers.
- Added migration `0009_memory_cover_photo.sql`, narrow authenticated upload/read/delete routes, mobile image caching, real Collection thumbnails, and Memory hero cover rendering.
- App/runtime version is now `1.2.0`; `expo-image-picker` and `expo-image-manipulator` are new native dependencies. This cannot be delivered to the installed `1.1.0` binary by OTA. A fresh preview build is required after the server/migration is deployed.
- Verification passed: server typecheck/lint, all 29 server tests (including upload/inheritance/cover/delete/auth coverage), mobile typecheck, recovery 10/10, sync 4/4, music 6/6, drive detection 9/9, iOS Metro export, and `git diff --check`.
- Expo Doctor reports only six pre-existing SDK 57 patch-version mismatches (`expo`, crypto, dev-client, location, task-manager, updates); the two newly added photo packages match SDK 57.
- Work is uncommitted in `C:\Users\patri\DriveOS-auto-detection`. Next release order: review changes, commit/push if approved, deploy server so migration/API are live, then create/install an EAS preview build for runtime 1.2.0 and physically test uploads/inheritance/cover choice/deletion.

- The automatic-drive and cinematic-dashboard feature is pushed on `codex/automatic-drive-detection` at commit `3f1c621`; next Git step is review/PR, not reimplementation. Latest device preview is OTA group `b41c17b0-1637-4497-a2eb-bd746343185c`.
- PR #113 is merged. Render deploy `dep-da5q4r0u01pc7384a930` is live with the Memories API.
- Render already contains nonempty server-only Last.fm and Tessie secrets; neither secret is stored in or returned to the iPhone app.
- Apple Developer App Services MusicKit and ShazamKit are enabled for `com.journeydeck.recorder`.
- The Apple ad-hoc provisioning profile was regenerated, then uploaded to Expo as valid profile UUID `52f18699-e3d3-446e-804a-742026badb7c`; the final build was signed afterward.
- Install build `09f10cad` over the current Recorder app; do not delete the old app first. Test preserved connection/data, onboarding, dashboard/history, recording/recovery/finish, Apple Music permission and track capture, Shazam recognition, Last.fm sync, and Tessie status.
- Internal-preview security debt: the current single-phone recorder token now authorizes history and exact route reads. Before a public beta, replace it with revocable per-device credentials and separate ingest/read scopes.
