# Current Handoff State — JourneyDeck V3

## Scope and release (September 26, 2026)

- The user declared V3 feature complete. Only emergency bug fixes are in scope. This policy is recorded in `GEMINI.md` and `mobile/recorder/AGENTS.md`. V2 remains frozen separately.
- V3 TestFlight Build 40 is version 3.0.0, runtime `3.0.0-preview.8`, on the live `com.journeydeck.recorder` app. EAS build `068e68d0-d786-48fe-8cb1-e54ce42e2e33` finished; exact-build submission `fc6d968c-86d6-49ce-91d1-23f1e0c24331` finished. Apple reports `VALID` and `IN_BETA_TESTING`. No App Review submission occurred.
- Build 40 used the dirty source in `C:\Users\patri\.codex\worktrees\4338\JourneyDeckv3-current` at base commit `5faaac7`; EAS's Git commit hash alone does not identify its full contents. The source changes are captured on `codex/ask-chat-viewport` under the user's Git integration authorization. Do not infer on-device acceptance from the successful native build.

## Build 40 source and verification

- Build 40 includes a shared Siri/in-app Ask plan resolver and executor, longest-journey distance and duration handling, distinct clarification/failure reasons, themed chat avatars, a full-screen Ask conversation and stable reply scrolling. It bundles prior Build 39 Siri supporting-details SQLite mitigation and context corrections.
- The V3 `JourneyMarker` and `MarkerPhoto` record types were deployed to the production CloudKit schema with separate user approval. Actual marker/photo upload, download, deletion, and two-device restore are still unverified on physical devices.
- Prior to the EAS archive: V3 gate, 940 mobile tests (one skipped), typecheck, focused Ask/AI tests, iOS export, and `git diff --check` passed. EAS compiled and signed the Swift app. During this integration, typecheck and 65 focused Ask/AI/navigation tests passed, and `git diff --check` found no whitespace errors.
- Build 40 was uploaded from a dirty worktree. The first EAS attempt failed Swift compilation and the corrected replacement build succeeded. Runtime `.8` must remain separate from older `.7` updates.

## Git and next steps

- The Build 40 source worktree is on `codex/ask-chat-viewport` from merged PR #178 (`5faaac7`). Recheck `git status`, recent history, and the remote merge state before further changes.
- PR #176 (`codex/icloud-sync-backoff`) remains open but its exact patch is already on `main` as `e84ed57`; `git cherry origin/main codex/icloud-sync-backoff` marks it equivalent. Do not duplicate it.
- `C:\Users\patri\JourneyDeckv3` is an older September 16 V3 preview checkout with superseded prototype changes, including a Time Capsule prototype removed from the current release. Keep that checkout untouched; it is not a Build 40 source.
- Physical-device checks remain for Ask/Siri answers and supporting-details links, chat reopen/keyboard/scroll behavior, theme icons, and marker/photo private iCloud sync and restore. No OTA, new native build, deployment, or App Review action is authorized by this Git integration.
