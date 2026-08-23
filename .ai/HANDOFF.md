# Handoff: Recorder Permission-Loss Reconciliation

## Summary

- Active branch: `codex/recorder-permission-loss`, based on `origin/main` at `5ae1af9`.
- Physical iPhone verification of PR #108 passed: start, background, force-close/reopen recovery, finish, and JourneyDeck timeline ingestion all succeeded.
- The physical test exposed a long, unexplained finish spinner after the success message.
- Recorder now coalesces overlapping refresh requests, skips periodic refresh while an operation is active, and labels ordinary operations.
- Finish now shows explicit `Saving on this iPhone`, `Saved on this iPhone / Syncing`, `Synced to JourneyDeck`, and safe retry states.
- Added pure sync-presentation coverage in `tests/sync-status.test.mts`.
- Physical iPhone finish testing passed both online and offline/reconnect paths; offline completion retried automatically and cleared the queued point.
- Physical permission-revocation testing exposed that a registered native task could outrank denied permissions, leaving the local session logically recording with stale messaging.
- Recovery now prioritizes missing permission/task availability, best-effort stops the stale native task, pauses locally, and mirrors pause remotely.
- Offline retry copy now accurately explains that reconnection triggers an automatic retry.

## Verification

- `npm run typecheck`: passed.
- `npm run test:recovery`: 10 cases passed, including task-registered/permission-denied.
- `npm run test:sync-status`: 4 stages passed.
- `npx expo-doctor`: 21/21 checks passed.
- `git diff --check`: passed (line-ending warnings only).

## Next Steps

- Commit and open the focused permission-loss fix PR.
- Merge after checks, make a new iOS preview build, and repeat the permission-loss test.
- Expected physical result: permission revocation stops the native task, shows a safe paused/interrupted message, and remains paused after `Always` access is restored until the user taps Resume.
