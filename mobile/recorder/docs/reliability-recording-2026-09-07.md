# Recording reliability audit — September 7, 2026

Scope: the manual iPhone/Watch recorder, native-to-Expo inbox handoff, background/foreground recovery, completed-journey persistence and the completion worker. Existing uncommitted UI/artwork work is retained. No OTA, native build, deployment or Git staging/commit/push was performed.

## Confirmed and reproduced with executable regressions

The storage regressions transpile and execute the actual `src/storage.ts` against an in-memory Node SQLite database using the production recorder schema and hardening triggers. Native/file/provider edges are stubbed; the tests do not inspect or modify device records.

1. **Watch Stop A → Start B could permanently fail the next inbox import.** The native exporter lists active B before completed A. The master still holds A as recording; inserting B triggers the duplicate-active-session guard and rolls back the entire import. A completed backlog row could similarly roll back current B's updates. The importer now handles the existing active mirror first, then completed routes, then the next active route. It retains conflicting/partial sessions in native storage for later passes, preserving the single-active-session guard. Tests reproduced the actual SQLite abort before the fix and now verify A completed, B active and backlog deferred without rollback.

2. **An interior route gap could never repair itself.** With sequences 0 and 2 stored, the old cursor requested sequence 3 onward, permanently excluding missing sequence 1. Cursors now restart at 0 whenever point count differs from max sequence + 1. Existing points deduplicate under the real primary key. Acknowledgement requires both count and next sequence to equal the native snapshot's expected sequence exactly; out-of-range incoming samples are rejected. The regression verifies a finishing route stays unacknowledged, replays the missing point and then completes.

3. **A retry after native acknowledgement failure could steal a running completion job's lease.** Re-enqueuing existing jobs reset `running` to `pending`, allowing a second worker to claim the same work. Enqueue now inserts missing jobs only, retaining leases, retry schedules and completed results. The regression claims a job, reimports completion and verifies a second claim cannot run concurrently.

4. **Long routes could fail to appear in the archive.** `Math.max(...speedMph)` pushes one argument per GPS point onto the JS stack. Executing the real mirror with 150,000 points reproduced a failed mirror before the fix. Maximum speed now uses a reduction, and that same fixture archives successfully. Node provides evidence for the argument-count failure, not a measured Hermes threshold; native GPS/SQLite memory usage at this size still needs a device stress check.

5. **A slow expired worker could overwrite a newer worker's result.** Completion success and retry updates used only the job ID/profile, even when another worker had reclaimed its lease. Worker-result updates now compare the exact attempt count and lease expiration they acquired. Direct synchronous archive repair remains available. The regression expires/reclaims a real lease, rejects the old success and failure callbacks and accepts the new worker's success.

## Native source corrections requiring the next native build

Read the versioned [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) and [SDK 57 Location documentation](https://docs.expo.dev/versions/v57.0.0/sdk/location/) before changing the module, as required by the subsystem handbook. The build/runtime/dependencies were not changed in this audit.

- **Pause/Resume applied to the currently active journey rather than the one the user selected.** Stop already accepted an expected session ID. New optional `pauseJourneyIfMatchingAsync` and `resumeJourneyIfMatchingAsync` methods check the ID on the native serial recorder queue. The JS wrapper and App callers pass the captured ID. Existing Build 19 methods remain supported with a read-before-control check; that fallback reduces stale commands but is not atomic against a Watch command between the read and the mutation. Full prevention needs the new binary.
- **A failed pause write could stop GPS while SQLite still said recording; a failed resume write could start GPS for a paused journey.** Native GPS changes now follow reconciliation of the committed SQLite state on the same work queue rather than unconditional post-mutation Start/Stop calls. Paused state is explicitly reconciled to stopped precise GPS. Resume checks that location services and Always access are available before setting recording state. Pause/Resume now publish Watch state after finishing.
- **More than twenty native backlog sessions could hide the active master mirror from every export page.** A new optional export method prioritizes the requested master session ID ahead of the bounded twenty-session page. The production SQL is executed in a regression containing 26 finished sessions and another owner's session; it includes the requested mirror and excludes the other owner. Existing binaries retain their original export API; full backlog-priority correction needs the new binary.
- `NativeRecorderStatus.statusReliable` is represented in TypeScript (it was already emitted by Build 19 Swift); the unavailable-module fallback explicitly reports false. App recovery/control checks are maintained by the root audit and use matching IDs and confirmed precise-tracking state.

This Windows workstation has no Swift/Xcode compiler. JavaScript wrapper behavior and the native export SQL were executed. The changed Swift control flow was reviewed, but it was **not compiled or executed**. Existing Watch build tests validate generated Xcode objects and icon assets, not the changed iPhone Swift runtime. A future authorized native build must compile and physically validate these corrections before release.

## Verified existing protections and limits

- Swift uses a separate `journeydeck-native-inbox.db`; only the typed bridge writes into the Expo-owned master database. Native deletion follows successful master import/completion-job transaction, so acknowledgement failure keeps a native fallback.
- Native creation has a unique active-owner index and explicit Start request identity. Watch Stop carries the expected journey ID. Watch commands expire after thirty seconds and are not delivered later through a background command queue. Only control/session IDs and recording state cross WatchConnectivity.
- Profile switching disarms manual starts, imports outstanding native data and rejects switching with an active session before identity changes. Recheck on physical paired devices, especially simultaneous Watch Start.
- Manual inactivity policy distinguishes ten minutes of observed non-driving movement from missing/poor GPS and has a 24-hour ceiling. The JS policy tests cover boundaries, movement, walking, inaccurate fixes, gaps and paused sessions. The existing pure Swift policy harness still requires a Swift toolchain/device validation.
- The ten-minute safeguard is callback-based; iOS scheduling, lost GPS, reboot-before-first-unlock and user force-quit are not guaranteed uninterrupted recording scenarios.
- The older Expo automatic/Tessie path is gated off in the public release. Existing detection tests were retained; the audit did not enable automatic recording or modify membership gates.
- The earlier “2,344 waiting tasks” count included legacy remote point/music upload flags plus all pending completion jobs. It was not a CloudKit pending-record count. Public local-first users can have dormant remote-upload flags without unsaved local journeys. No rows or flags were cleared to make the indicator green. The root audit owns any Data Health presentation correction.

## Verification run

- `npm run typecheck`: passed after the recorder/source changes and App integration.
- `node --experimental-strip-types --test tests/native-recorder-controls.test.mts tests/native-recorder-activation.test.mts tests/native-recorder-inbox.test.mts tests/manual-recording-failsafe.test.mts tests/recovery.test.mts tests/recording-storage-runtime.test.mts tests/watch-build.test.mts tests/journey-completion.test.mts`: **40 test entries passed**, including the recovery file's ten policy assertions.
- The new production-storage regressions failed before the corresponding fixes and passed afterward.
- Final root validation passed 371/371 combined tests, TypeScript and a local iOS Hermes export. No native build or OTA was performed; the changed Swift code remains uncompiled.

## Physical-device release checks still required

1. Start on iPhone, lock it, drive a short route, stop on Watch and check the exact route and single archive entry after foregrounding. Repeat Start on Watch/Stop on phone.
2. With JS backgrounded, Stop journey A then immediately Start B from Watch. Reopen the phone while B is recording; A must be archived, B must keep recording and there must be no duplicate/stuck session. Repeat with multiple completed Watch journeys and with an interrupted first inbox import/acknowledgement.
3. Rapidly alternate phone Pause/Resume with Watch Stop/Start. Old phone actions must not control the newer journey in the next native build. Confirm the Watch reflects pause/resume promptly.
4. Revoke Always permission while recording and while paused; foreground the phone. Existing route stays saved, recording state reports the interruption, and denied Resume cannot claim active GPS. Restore permission and resume explicitly.
5. Drive, park for ten observed minutes with the phone locked, then walk. Verify one automatic completion; repeat with renewed driving, GPS loss/drift and airplane mode. Missing fixes must not count as parking.
6. Reboot/force-quit during recording, reopen after unlock and verify recovery disclosure, intact existing points and a bounded route gap. No local or Watch UI may promise uninterrupted recording after force-quit.
7. Test low disk space/native SQLite write failure during Pause, Resume and Finish. Failed writes must retain the prior durable state, and route/mirror retries must not acknowledge or remove incomplete native data.
8. Restore/import a long high-frequency route, including over 100,000 samples, and check memory, responsive UI, contiguous multi-page handoff and eventual archive completion. A native inbox with over twenty completed entries must prioritize its still-active master mirror in the next binary.
9. Attempt account switch/sign-out/deletion concurrently with Watch Start and while recording/paused. Verify active-session refusal and no cross-profile route ownership.
