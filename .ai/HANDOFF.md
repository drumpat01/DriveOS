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

### Native Memories page (pending review/deploy)

- Replaced the native Journeys tab with a three-level Memories page: animated Memory carousel, selected Memory Collections, then the Journey list.
- Added native creation/editing for Memories and Collections. Memory membership adds/removes Collections; Collection membership adds/removes Journeys with immediate durable saves.
- Added narrowly authenticated Recorder mobile endpoints for the shared `memories`, `memory_collections`, `journey_collections`, and `journey_collection_drives` tables. The phone receives no broader web-session authority.
- Added server coverage for unauthorized access, Collection creation/update, Memory creation, catalog reads, and membership removal.
- Verification: `npm run check:server`, `npm run lint:server`, `npm run test:server` (29/29), mobile `npm run typecheck`, recovery (10), sync status (4), music observations (6), iOS Metro export, and `git diff --check` passed.
- Important delivery order: review and deploy the server endpoint changes before publishing the corresponding preview OTA; the production server does not know these new routes yet. No commit, push, server deploy, or Memories OTA has been performed.

## Release State and Next Steps

- PR #111 is merged. Render deploy `dep-da5gs2bbc2fs73ar7pf0` is live; `/readyz`, the authenticated mobile dashboard, Last.fm capability, and Tessie capability were verified in production.
- Render already contains nonempty server-only Last.fm and Tessie secrets; neither secret is stored in or returned to the iPhone app.
- Apple Developer App Services MusicKit and ShazamKit are enabled for `com.journeydeck.recorder`.
- The Apple ad-hoc provisioning profile was regenerated, then uploaded to Expo as valid profile UUID `52f18699-e3d3-446e-804a-742026badb7c`; the final build was signed afterward.
- Install build `09f10cad` over the current Recorder app; do not delete the old app first. Test preserved connection/data, onboarding, dashboard/history, recording/recovery/finish, Apple Music permission and track capture, Shazam recognition, Last.fm sync, and Tessie status.
- Internal-preview security debt: the current single-phone recorder token now authorizes history and exact route reads. Before a public beta, replace it with revocable per-device credentials and separate ingest/read scopes.
