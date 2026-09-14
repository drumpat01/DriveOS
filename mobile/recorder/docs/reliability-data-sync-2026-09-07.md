# Local data and private iCloud reliability audit — September 7, 2026

Scope: release audit of the existing dirty `codex/journeydeck-v2` working tree, HEAD `9421e87`. No OTA, native build, deployment, staging, commit, or Git push. Existing product changes are preserved. Local schema remains version 6; no CloudKit schema change.

## Confirmed problems and changes

| Finding | Evidence and resulting behavior | Verification |
| --- | --- | --- |
| Journey/music uploads acknowledged IDs after the local content changed during the network request. | Real SQLite + `CloudKitSyncEngine` test failed before fix: an edited Journey became `syncedToCloud=1`. The engine now stores and compares the exact uploaded wire fields before acknowledging; same-timestamp edits, unsolicited acknowledgements and replayed acknowledgements remain pending. An unchanged retry is acknowledged. | Behavioral regression tests pass. |
| Pulling an old MusicEntry overwrote a pending local artwork/enrichment edit. Same-timestamp Journey conflicts also replaced dirty local content. | Real engine test restored the old cover URL / vehicle over the newer local value before fix. Dirty unversioned music conflicts and equal-time Journey conflicts are now preserved locally, reported as unresolved, and retain the download cursor. | Behavioral regression tests pass. See remaining music protocol limitation below. |
| Two callers waiting for another profile's sync could both enter native transport. | Reproduced three native pulls for two profiles. The coordinator now rechecks both current profile and active operation after waiting; only two pulls occur and the old profile's unfinished ingestion/ack is rejected. | Behavioral coordinator test passes. |
| An unavailable-account result with an empty queue was cached as a successful sync for 15 minutes. | Reproduced `no_account` returned again after mocked account recovery without any pull. Only available, completed results enter the success cooldown. | Behavioral coordinator test passes. |
| Account deletion could race an existing native upload, recreating the deleted cloud zone. A later local cleanup failure could also allow automatic backup to recreate it after restart. | `deletePrivateCloudDataForUser` previously called delete independently of `activeSync`. A device-only marker in existing `local_preferences` now blocks new work, drains in-flight work, and survives coordinator restart after deletion is dispatched, including a lost/uncertain native response. Final local user deletion removes the marker. Only a preflight failure before dispatch clears a newly created pause; all user rows remain intact on failure. | Mocked transport + real SQLite verifies upload settles before delete, no late acknowledgement, no restart reupload, uncertain deletion response, retryable deletion, unavailable account, and final marker cleanup. |
| Profile changes during network/file awaits could continue ingesting or acknowledging the old cloud scope. | The coordinator now checks local profile ID and Apple identity around transport boundaries, and the engine checks again after asynchronous route validation. | Behavioral tests cover profile switch with waiting callers and interruption during route validation. |
| Native pull ignored failed per-record results, then staged a change token covering them. | Code trace: `.success`-only loop over `modificationResultsByID` followed by `savePendingToken`. Native transport now throws on a per-record failure before token staging, leaving the prior committed cursor for retry. | Source invariant checked; native compilation and fault injection pending. Requires a future native build. |
| Native downloaded photos used a stable record-name path before JS conflict resolution. An older rejected remote photo could overwrite the file referenced by the winning local row. | Code trace: `dictionary(from:)` persisted/replaced the asset before `resolvePrivateConflict` ran. Downloads now use immutable SHA-256 content paths, published via a temporary copy + move. Replaying identical bytes reuses the same path. | Source invariant checked; native compilation/device test pending. Requires a future native build. |

The deletion marker contains only deletion state, lives in the device-only preferences table, and is not included in private CloudKit preference payloads. No user's actual account or cloud records were deleted during this audit.

Cross-review caught two gaps in the initial audit patch, each reproduced by a failing behavior test and corrected: same-timestamp Journey comparison now resolves missing place dependencies before mapping wire content (other batch records keep importing), and a rejected zone-delete response retains the pause once native deletion was dispatched (a lost response cannot prove the server retained the zone).

## Verified existing protections

- Real SQLite tests restore a phone fixture to a fresh iPad fixture with canonical places, journey summaries, checksummed exact routes, music, Memories, photos, preferences and derived Atlas statistics.
- Missing dependencies retain the cursor; replay restores them without duplicate places. Missing local photos remain pending while valid photos continue through the batch.
- Versioned private-content tombstones resist stale replay; unchanged uploaded revisions acknowledge correctly. Ownership checks reject another local profile's records.
- Master/recorder hardening tests enforce profile ownership, valid values, durable completion-job leases and duplicate active-recording constraints.
- Legacy-recorder migration test preserves the original SQLite source while copying data into the unified store.

## Meaning of the earlier 2,344 indicator

The supplied Data Health screenshot's hero count comes from `queuedPoints + queuedMusic + pendingCompletionJobCount` in `primary-sections.tsx`. Individual GPS points and music observations contribute to it; it is not a count of 2,344 private iCloud jobs. A screenshot alone cannot establish its composition or why those rows remained pending. The recorder audit covers those queue semantics separately.

`localStoreDiagnostics.pendingSyncCount` is a separate metric and currently includes dormant legacy Collections/Memory/photo rows. `CloudKitSyncEngine.pendingCount()` uses bounded lists, while eligibility for direct Journey Memories is filtered after SQL limits. These remain diagnostic/large-legacy-library follow-ups; no actual affected device database was available.

## Remaining limitations and device checks

1. **Music edit versioning is unresolved and deferred to V3:** the current schema has no durable monotonic revision on each music observation. Later enrichment timestamps resolve ordinary newer-artwork updates, while ambiguous conflicts remain pending locally instead of being overwritten. The September 14 product decision moves the additive music revision migration, deterministic conflict handling and full two-device convergence matrix to roadmap item V3-07; it is not a V2 release requirement.
2. **Native checks require a later build:** compile the CloudKit Swift changes, simulate a per-record pull failure and verify cursor retry, then download/reject an older Photo revision and verify the winning file's bytes remain unchanged. Windows has no Swift compiler or Apple CloudKit runtime. Structural tests are not substitutes for these checks.
3. **Two real devices:** edit a Memory/photo while another device syncs, switch the JourneyDeck profile during sync, exercise iCloud unavailable/available transitions, and restore a populated private library on iPad. Verify fields/route point counts and pending indicators, not only successful network completion.
4. **Account deletion test with disposable account only:** begin upload, delete, interrupt later local cleanup, relaunch, and verify the zone stays absent until deletion completes. Never use the user's real archive for destructive acceptance testing.
5. **iCloud account changes:** native token/asset namespaces use the profile zone name; the current iCloud account can change independently of the app's Apple identity. Real account-change behavior, expired cursor recovery and intended account linkage require device validation. No claim of demonstrated cross-account exposure is made.
6. Immutable native asset versions retain old bytes until explicit profile cleanup. Future garbage collection must consult actual SQLite references before deleting old versions; the safety patch deliberately avoids deleting potentially referenced content.

## Validation run

- `node --experimental-strip-types --test tests/private-library-sync.test.mts`: **23/23 passed**, executing real TypeScript store/engine/coordinator with SQLite and mocked native/network/filesystem boundaries, including both cross-review corrections.
- Private-library + database-hardening + unified-migration run: **26/26 passed** before the final additional route-handoff case (then the private-library suite reran 21/21).
- `npm run test:cloudkit-sync`, `npm run test:local-store`, `npm run test:private-content`: passed.
- `npm run test:phase3-native-release`: **3/3 passed** (source invariants, not a native compile).
- `npm run typecheck` and scoped `git diff --check`: passed.
- Root agent owns final combined validation and consolidated audit/handoff.
