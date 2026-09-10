# JourneyDeck release reliability audit — September 7, 2026

## Outcome and scope

Confirmed reliability defects were reproduced and fixed across startup/update activation, recording and Watch handoff, local data/iCloud, purchases/access, and interface lifecycle. Existing theme, artwork, map, icon and Settings work was preserved in the dirty `codex/journeydeck-v2` working tree, based on HEAD `9421e87`.

**Nothing was published. No OTA, native build, TestFlight submission, database migration, staging, commit or Git push was performed.** The iOS export below is a local JavaScript/Hermes compilation check, not an installable native build. No actual user archive, iCloud account or App Store transaction was modified by the test fixtures.

This audit distinguishes executable reproductions from native source review. Passing Node/React/SQLite tests and a Hermes export do not establish that the app launches or records correctly on a physical device. The earlier DIAG-8 crash history was considered, but this audit did not obtain the missing original JS exception or prove its exact cause.

## Highest-priority fixes

| Area | Confirmed problem and change | Evidence |
| --- | --- | --- |
| Memory data loss | Editing a Memory through the free-history filtered detail view replaced its complete journey list with only visible journeys. Saves now apply explicit selection changes to the latest stored membership, preserving hidden and concurrently added links. Stale editors cannot resurrect deleted Memories. | Actual `saveMemory` method executed with persistence-boundary fixtures; pre-fix hidden/concurrent links were lost, fixed cases pass. |
| Recording handoff | Watch Stop A then Start B while JS slept could abort every native import against the single-active-session constraint. Imports now settle the existing active mirror first, retain deferred native records, then import the next active journey. | Actual production recorder code and SQLite triggers reproduce the abort and verify A completes while B remains active. |
| Incomplete routes | An interior missing GPS sequence was permanently skipped by the next import cursor. Replays now start at zero when a gap exists, deduplicate points and require exact contiguous completion before acknowledgement. | Real SQLite gap/replay regression; incomplete routes remain retained natively. |
| Long-route failure | Spreading 150,000 speeds into `Math.max` overflowed the argument stack and prevented archive mirroring. Maximum speed now uses a reduction. | Same production mirror fixture fails before and archives after the change; actual Hermes memory limits still need stress testing. |
| Completion jobs | Reimport could reset a running job lease; a slow expired worker could overwrite its successor's state. Existing jobs keep their leases and worker completion/retry writes compare the acquired lease. | Real SQLite concurrent-claim/reclaim tests. |
| Sync data loss | Upload acknowledgements marked edited records as backed up; stale downloads overwrote dirty music and equal-version Journey edits. Acknowledgements now compare exact sent content. Unresolved edits remain local and are reported. | Real SQLite plus production sync-engine tests with delayed transport. |
| Cloud deletion | Sync could race account deletion and recreate the deleted backup, including after interrupted cleanup. A persistent device-only deletion pause drains active work and blocks new work until cleanup completes. It survives a lost native deletion response; only preflight failures can clear a newly created pause. | Production coordinator with mocked transport and real SQLite; no real account deletion performed. |
| Native CloudKit | Per-record pull errors could advance the cursor; rejected remote photo revisions could overwrite the winning file before conflict resolution. Pull now fails before staging the cursor, and downloaded assets use immutable content-derived paths. | Native source trace and source invariants only; next native build and physical fault injection required. |

## Startup, update activation and recorder recovery

- Extracted the optional OTA prompt into `src/use-update-restart.ts`. The old effect offered restart while initial recorder state was still loading or paused, and its button retained stale readiness after recording started. The new hook requires a loaded, idle foreground recorder and checks both the current SQLite session and native Watch recorder before prompting and again when Restart is tapped. It rechecks after the asynchronous native read. Old update IDs, unmounted screens, duplicate taps and unreliable native status cannot trigger reload.
- Native status failures defer the optional update. A reload failure retains a retry path. A Watch command could still race the final status-read/reload boundary; this is not a claim of an atomic native restart lock.
- Concurrent first-run credential calls previously generated different device IDs. A shared in-flight read/create/write now returns the same persisted ID. Failed writes do not report a volatile ID as saved and can retry.
- Startup credential loading had no rejection handler/retry, leaving the recorder unavailable after a Keychain error. It now reports the interruption and retries on foreground without mutating journey data or updating an unmounted screen.
- A legacy recording whose location task had already stopped was not marked paused after permissions were revoked. Recovery now persists the interrupted state even without a running task.
- Native controls/recovery now require reliable status for the expected session, and active recording requires confirmed precise tracking. Stale Watch/session snapshots cannot drive a different journey. New optional native Pause/Resume methods enforce session matching on the native queue and reconcile GPS from committed database state; the existing binary has only a non-atomic checked fallback.
- Native inbox export gains an optional priority-session argument so more than twenty backlog sessions cannot continually hide the existing active master mirror. This improvement needs the next native binary.
- Finish messaging now says the journey is saved on-device while its library entry is prepared, avoiding a promise that a queued mirror is already visible.

Sync cross-review also reproduced missing Journey place dependencies throwing before conflict comparison. Dependency resolution now precedes comparison, deferring that record while allowing unrelated records in the batch to continue.

Executable regressions are in `tests/update-restart.test.mts`, `recorder-credentials.test.mts`, `recorder-startup.test.mts`, `memory-edit-reliability.test.mts`, `recording-storage-runtime.test.mts`, and `native-recorder-controls.test.mts`. Native and network boundaries are mocked where physical APIs are unavailable.

## Purchases and interface lifecycle

- Membership reads, transaction events, purchases and restores now reject superseded responses. Reproduced cases included an old free response relocking approved access and an old paid response undoing a newer free verification. Purchase/restore and polling are coordinated; an outcome saying “purchased” cannot close the paywall as unlocked without an active verified entitlement.
- Known subscription expiration schedules a fresh StoreKit read. Access is not revoked from the date alone; the native verified status remains authoritative.
- **The implementation uses the custom native StoreKit 2 module, not RevenueCat.** No RevenueCat integration was added.
- Delayed Memory drag completion could invoke a save after its workspace unmounted. Cleanup now invalidates shared drag state and guards delayed callbacks. A save that already began still belongs to the persistence layer.
- Stale tray callbacks after root/keyboard geometry changes could restore old dimensions. Layout, focus, busy and background changes cancel/settle the gesture and ignore obsolete move/release callbacks. The already device-tested PanResponder tray architecture is retained.
- Existing executable theme/icon/Settings tests verify independent icon choice, serial icon changes, retained child state, draft/search/selection persistence and category navigation. This does not verify native hit testing, frame rate, visual layout or iOS icon confirmation behavior.

## Verification

- Final combined `npm test`: **371 passed, zero failed, zero skipped** after both cross-review corrections.
- `npm run typecheck`: passed.
- Each required subsystem script was executed independently and passed: `test:tab-runtime`, `test:local-store`, `test:local-atlas`, `test:privacy-masker`, `test:local-atlas-client`, `test:cloudkit-sync`, `test:cloudflare-workers`, `test:auth`, `test:recovery`, `test:sync-status`, `test:music-observations`, `test:drive-detection`, `test:navigation-motion`, `test:native-capabilities`.
- Final local iOS validation: `npx expo export --platform ios --output-dir .cache/reliability-audit-export --max-workers 4` passed, bundling 2,417 modules into `index-f6eb4a38f1e693c2388000f408e4fdf7.hbc`. No EAS build/update command was run.
- `git diff --check`: passed; existing Windows line-ending warnings are informational.
- Independent reviewers cross-checked startup/Memory/credentials and recording/data changes after implementation. Findings from that review were incorporated before completion.

Local logs are under `mobile/recorder/.cache/reliability-*.log`; they are diagnostic artifacts, not source or release inputs. Full-suite output is `.cache/reliability-audit-tests.log`. Tests mix behavioral executions, pure policy cases and existing source invariants; the total is not a count of physical-device scenarios.

## Unresolved issues and release acceptance

1. **Music sync versioning remains incomplete.** Existing music records expose immutable `createdAt` as the sync update version. The fix retains/reports conflicting edits but cannot reliably converge every cross-device music edit. Add durable revision metadata with the next compatible schema/runtime design. Schema remains 6 so existing rollback bundles can still open it.
2. **Native corrections are uncompiled on this Windows workstation.** Queue-atomic controls, backlog prioritization, CloudKit token fencing and immutable asset paths require a future authorized native build and device validation. Older binaries retain fallbacks and do not gain these native guarantees from JavaScript alone.
3. **Recording/device matrix:** on paired iPhone/Watch, exercise Stop A/Start B while JS sleeps, repeated pause/resume vs Watch stop/start, native acknowledgement interruption, permission revocation, locked phone, reboot/force-quit, low storage and a long route. Verify route counts, one archive entry, honest interruption status and preserved native fallback.
4. **Two-device sync:** test simultaneous Memory/music/photo edits, missing dependencies, failed per-record pulls, iCloud/account switches and retry after interrupted deletion using a disposable account. Compare stored content and route points, not just a success banner.
5. **Purchase sandbox:** monthly/annual, cancellation, pending approval, restore on the second device, offline relaunch, expiration, refund, renewal and billing grace need actual StoreKit acceptance.
6. **UI/device matrix:** test tray finger-following and keyboard/background interruption, iPad portrait/landscape and Split View, larger text/VoiceOver, Settings drafts, every theme and independent icon while a journey remains active.
7. **Earlier 2,344 “tasks” display:** the count combines recorder points, music observations and completion jobs; it is not 2,344 iCloud jobs. The device database was unavailable, so its actual composition and delay are unverified. No queue flags were cleared merely to improve the indicator. Diagnostic count/large legacy-library cleanup remains a follow-up.

## Detailed subsystem evidence

- [Recording and Watch handoff](reliability-recording-2026-09-07.md)
- [Local data and iCloud](reliability-data-sync-2026-09-07.md)
- [Purchases and access](reliability-purchases-2026-09-07.md)
- [Themes, icons, Settings and gestures](reliability-ui-2026-09-07.md)
