# Handoff: JourneyDeck Mobile Shell and Music Connections

## Summary

- Active branch: `codex/journeydeck-mobile-shell`, based on `origin/main` at `ccead5b`.
- Expanded the single-purpose Recorder into JourneyDeck 1.1.0 while keeping the existing bundle identity and local recording database.
- Added Home, Journeys, Record, and Connections tabs; first-run provider selection; offline dashboard/history caches; journey details with real route geometry; pagination; and Tessie/Last.fm capability status.
- Added Apple Music, ShazamKit, and Last.fm choices with explicit benefits, limitations, and privacy copy.
- Added a local Expo iOS module for Apple Music authorization/current and recent tracks plus bounded ShazamKit recognition. Raw microphone audio is never stored or uploaded.
- Added a separate local-first SQLite music queue. GPS safety and Finish never wait for music sync.
- Added authenticated server APIs for dashboard, journey history/detail, provider preferences, music observations, connection capabilities, and bounded Last.fm session reconciliation.
- Added `LASTFM_API_KEY` to the Render Blueprint as a server-only secret.

## Build and Verification

- EAS internal iOS build succeeded: `45668099-d473-49f9-9d27-7d44b9d412e8`.
- Build/install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/45668099-d473-49f9-9d27-7d44b9d412e8`.
- Direct IPA: `https://expo.dev/artifacts/eas/cgS0Xs3MzQNECvOEPeoUybS0R8XM1W9q66ZCESROZ9w.ipa`.
- Mobile typecheck passed.
- Recorder recovery: 10 passed; sync presentation: 4 passed; music normalization: 6 passed.
- Expo Doctor: 21/21; iOS Metro export passed; EAS native Swift build passed.
- Full repository suite passed: 29 server tests, 9 browser tests, PowerShell analysis, secret scan, and HIGH/CRITICAL dependency scan.
- `git diff --check` passed (Windows line-ending warnings only).

## Release State and Next Steps

- Commit and push the working tree, open/merge a PR, then verify the Render main-branch deployment and `/readyz`.
- Set the existing local `LASTFM_API_KEY` value in the Render service environment without exposing it. `render.yaml` declares the variable but does not contain its value.
- In Apple Developer, enable the MusicKit and ShazamKit App Services for identifier `com.journeydeck.recorder` before physical-device music testing.
- Install the successful preview over the current Recorder app; do not delete the old app first. Test preserved connection/data, onboarding, dashboard/history, recording/recovery/finish, Apple Music permission and track capture, Shazam recognition, Last.fm sync, and Tessie status.
- Internal-preview security debt: the current single-phone recorder token now authorizes history and exact route reads. Before a public beta, replace it with revocable per-device credentials and separate ingest/read scopes.
