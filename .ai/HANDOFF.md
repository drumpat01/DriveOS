# Handoff: Recorder Recovery Reconciliation

## Summary

- Active branch: `ao/driveos-10/root`, based on current `origin/main` (`e45b6dd`).
- Added a serialized Recorder recovery coordinator that reconciles the persisted local session with Expo's native background-location task at startup, on foreground return, periodic refresh, and automatic sync.
- Recovery stops orphaned/paused/finishing tasks, resumes only persisted recording sessions after native confirmation and a fresh point, pauses safely when permission/task availability is missing, and retries finishing sessions when connected.
- The UI never labels a session `Recording` until native tracking is confirmed, and recovery messaging clearly preserves offline points while noting possible route gaps.
- Added deterministic recovery-decision coverage.
- Review follow-up: a recovery-triggered pause now best-effort mirrors `paused` to an already-created remote session without creating a new remote session.

## Verification

- `npm run typecheck` in `mobile/recorder`: passed.
- `npm run test:recovery` in `mobile/recorder`: 9 recovery decisions passed (Node emits a harmless module-type warning for the TypeScript source).
- `git diff --check`: passed.
- Review follow-up verification: `npm run typecheck` and `npm run test:recovery` passed again.

## Next Steps

- Run the physical-iPhone development-build scenarios: force-quit/reopen while recording, paused-with-task cleanup, orphaned-task cleanup, denied Always permission recovery, and offline finishing followed by reconnection.
- Commit, push, and open the Recorder recovery PR into `main`.
