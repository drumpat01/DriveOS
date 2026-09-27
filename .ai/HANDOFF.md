# Current Handoff State — V3 Complete, V4 Ready

## Release and scope (September 26, 2026)

- The user declared JourneyDeck V3 feature complete. Only emergency bug fixes are in scope. `GEMINI.md` and `mobile/recorder/AGENTS.md` record this policy. V2 remains frozen separately.
- V3 TestFlight Build 40 is version 3.0.0, runtime `3.0.0-preview.8`, on the live `com.journeydeck.recorder` app. EAS build `068e68d0-d786-48fe-8cb1-e54ce42e2e33` and exact-build submission `fc6d968c-86d6-49ce-91d1-23f1e0c24331` finished. Apple reports `VALID` and `IN_BETA_TESTING`. No App Review submission occurred.
- Main contains the Build 39 update source, Build 40 Ask/Siri/full-screen chat source, and the private iCloud sync backoff fix. Build 40's source was captured from its EAS worktree in PR #179; the EAS Git commit hash alone does not identify the dirty source that was uploaded.
- Production CloudKit has `JourneyMarker` and `MarkerPhoto` record types. Physical-device marker/photo upload, download, deletion, and two-device restore remain unverified. Ask/Siri answer accuracy, supporting details, chat layout, and theme icons also need device acceptance.

## Git and environment

- PR #179 merged into `main` at `e427b83`; its GitHub validation passed. The separate local `main` worktree at `C:\Users\patri\.codex\worktrees\journeydeck-grand-touring-homepage` was fast-forwarded and clean. Recheck the remote head before V4 work.
- Draft PRs #161 (1Password ad hoc signing) and #177 (Cloud Agent environment) were closed without merging and their remote branches deleted. Duplicate PR #176 was closed because its exact iCloud patch is already on main as `e84ed57`. There were no other open PRs before this handoff update.
- Old V3 preview, Build 38, temporary TestFlight, Build 39, Build 40, and Ask OTA worktrees were removed. The old Build 38 source and Last.fm/onboarding edits were preserved only in local Git stashes `b12476987a1e8b6a36bdb36e8a444843007aab72` and `ff70535eefa80dba77e2648ce8db6e248a934640`, respectively. They were not merged or pushed.
- One empty directory remains at `C:\Users\patri\.codex\worktrees\4338\JourneyDeckv3-current`: Git deregistered that worktree, but Windows held the directory open and direct removal was blocked. It contains no files.

## Next steps

- Start any V4 work from the latest `origin/main` in a new branch or worktree. Keep V3 TestFlight and native runtime boundaries separate from V4.
- Do not infer on-device success from source tests or EAS compilation. No new OTA, native build, deployment, or App Review submission occurred during this cleanup.
