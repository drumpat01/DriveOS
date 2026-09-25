# Current Handoff State

## Current V3 photo change (September 25, 2026)

- In the detached `5869905` worktree, uncommitted edits remove the optional SensitiveContentAnalysis check, framework link, status fields, and blocking copy from Photo Matching. Automatic suggestions still use time/location; the separate Memory Add Photo picker remains available for any user-chosen image within format and size limits.
- Focused photo tests: 16 passed. Mobile TypeScript typecheck and `git diff --check` passed. Swift was source-reviewed on Windows; a new iOS build and on-device check are needed before this change appears in TestFlight. No build, OTA, commit, or deployment was performed.

## Current V3 source and release (September 24, 2026)

- Main at 5869905 (PRs #174–175) combines the current website and server sources with the V3 mobile source used for Build 38, plus tools/xprem-local. The mobile master database schema is 11.
- Build 38 is the current native TestFlight build: EAS build a34d2a2a-1201-4b9e-bcc3-e6eeb79a6968, live bundle com.journeydeck.recorder, production channel, runtime 3.0.0-preview.6. EAS submission 47a2abe5-82ea-4c5f-b076-4fb71ed53ae2 finished and Apple accepted the upload. The IPA embeds the xprem HTTPS manifest URL, app ID, signing certificate, and production channel.
- Build 38 was produced from the previously dirty checkout C:\Users\patri\JourneyDeckv3-origin-main-20260922. Its handoff retains detailed Tessie, artwork, Ask, photo, Worker, OTA, and device-validation history. The current integration copied its mobile and Cloudflare source; the source checkout remains unmodified.
- Earlier Expo builds use runtime 3.0.0-preview.5 and Expo Updates. Do not publish the runtime .6 source to that older runtime. No xprem OTA has been published. The Last.fm image relay in Cloudflare source has not been deployed.
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
