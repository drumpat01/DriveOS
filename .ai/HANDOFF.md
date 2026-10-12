# JourneyDeck current handoff, October 12, 2026

## Current objective

Catch recorder DB failures in the Expo background location task so GPS points are not silently dropped. Open a PR only; do not merge. Do not touch Render or website deploy config.

## Checkout

- Branch `cursor/location-task-db-resilience-eb64` off `main`.
- PR: https://github.com/drumpat01/DriveOS/pull/267
- Backlog source: item 3 / ranked item 4 in `docs/ios-backlog-2026-10-12.md` on PR #264.

## Material changes

- `mobile/recorder/src/location-task.ts`: catch write failures at the task boundary; retry `prepareJourneyDeckDatabase` via `retryJourneyDeckDatabase`; retry `recordLocations` once; buffer unsaved points (cap 1_200) and flush on the next healthy tick; log `recorder.completion_failed` with `stage` and `buffered`. Native automatic sessions still do not persist Expo GPS.
- `mobile/recorder/tests/location-task.test.mts`: VM-harness coverage for retry, buffer/flush, startup recovery, native discard, and no re-buffer after a successful write.

## Verification

- `node --experimental-strip-types --test tests/location-task.test.mts` (7 pass)
- Source-inspection suites that read `location-task.ts`: database-startup, manual-recording-failsafe, server-independence, phase3-native-release, public-release-integrity, startup-diagnostics (51 pass)

## Unresolved / owner decisions

- In-memory buffer is lost if iOS kills the JS process before the next healthy tick. Durable buffering would need a `storage.ts` change; the backlog asked to keep the catch at the task boundary.
- Full `npm run typecheck` in `mobile/recorder/` was not run here (Expo `node_modules` not installed in this environment).

## Next steps

1. Keep PR 267 open for review. Do not merge or deploy from this session.
