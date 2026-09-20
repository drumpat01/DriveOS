# Native operation recovery — September 12, 2026

Implemented locally at the user's request. **Do not build or publish yet.**
This work changes native source and cannot be delivered completely by OTA.
No real phone, user archive, CloudKit account, or production service was used.

## Recorder commands

- `RecorderCommandJournal.swift` adds `native_recorder_commands` to the separate
  native inbox (schema 2). An operation ID binds an immutable owner, device,
  action, and session. Reusing an ID with different arguments is rejected.
- Intent is committed before execution. Session mutation and the applied/rejected
  receipt commit in one SQLite transaction. A failed receipt write rolls back the
  transition while retaining the intent for recovery.
- Phone controls, Watch Start/Stop, and older bridge entry points use the journal.
  Responses include the command outcome separately from the current recorder
  status; receipts can also be queried by operation ID for the current owner.
- Reconciliation drains pending commands before session reads and GPS processing.
  Pending Pause/Finish apply only to their original owner/session. Interrupted
  Start/Resume are rejected rather than starting GPS after restart. An applied
  command sequence invalidates stale movement state even if a crash interrupted
  the subsequent UserDefaults write.
- A persisted Pause/Finish intent schedules GPS shutdown for its matching active
  session even if its transition cannot commit. The pending intent remains.
- Receipts survive completed-inbox acknowledgement, so replaying Start cannot
  recreate a journey that has already been imported and removed from that inbox.
  Receipts store local IDs, actions, timestamps, and reason codes, without GPS
  coordinates, music, credentials, or Apple identity.
- New phone commands have a 30-second native acceptance window. The JS caller
  waits at most ten seconds for a response, then reconciles the same operation
  instead of issuing another mutation. An unknown outcome remains fenced until
  its acceptance window expires, including when the bridge promise rejected.
- Configure is not journaled; its existing serialized configuration path remains.
  A crash before the first intent write still cannot preserve an unreceived
  command. OS suspension can defer execution and timers.

## CloudKit requests

- `CloudKitRequests.swift` replaces the async database convenience calls with
  explicit CKOperations: 30-second request timeout, 90-second resource timeout,
  and a 95-second cancellation watchdog. Account-status callbacks have a separate
  30-second one-shot deadline. These apply while iOS permits execution.
- A lock protects each continuation against double completion. Expired callbacks
  cannot advance a transport method into its next step. Watchdogs weakly capture
  operations to avoid retaining a cycle through completion callbacks.
- A native process-wide guard prevents concurrent bridge calls, including across
  JS reload, and protects token mutations. A JS gate bounds caller responses at
  120 seconds while retaining the unresolved native request until it settles.
  Retry attempts during that interval return a recoverable error.
- The full sync may involve several requests/pages; request deadlines are not a
  promise that the entire library sync finishes in 95 seconds. A long healthy
  native call may outlast the JS caller; its late result is discarded and the
  gate is reusable after native completion. Large-library acceptance is pending.
- Existing optimistic record conflict checks and exact upload acknowledgements
  remain. Timed-out responses cannot mark local records as uploaded. The next
  sync pulls first to reconcile an ambiguous remote outcome.
- Zone deletion requires an explicit per-zone result. An absent zone is safe to
  retry; other failures propagate. The existing durable deletion pause remains
  set after dispatch, including across relaunch, until local account cleanup.
- Network/permission errors fetching a zone no longer trigger attempted zone
  creation. Server retry delays over 30 seconds or non-finite values are surfaced
  instead of leaving a worker asleep indefinitely. Missing/nonadvancing pull
  tokens fail while retaining the committed cursor.
- Cancellation does not prove a server mutation was undone. This implementation
  uses the existing version/conflict protocol and deletion barrier, not a claim
  of exactly-once CloudKit delivery. Older binaries lack native cancellation and
  may require an app restart if their native request never settles.

## Verification and remaining checks

Final local verification: **609/609 mobile tests passed**, TypeScript passed,
the standalone Swift runner's JavaScript syntax check passed, and
`git diff --check` passed (existing CRLF notices). Test log:
`mobile/recorder/.cache/native-hardening-full.log`. No `swiftc` is available here;
the Swift unit harness and the native app have not been compiled or run.

Local tests execute production JS command/gate/bridge/coordinator code with
controlled native promises and real SQLite. The journal SQL tests extract the
actual Swift SQL, inject a real SQLite trigger failure between transition and
receipt, and kill a child process during an on-disk Finish transaction. Reopening
preserves database integrity, the prior committed session, and the pending intent.
These SQL tests do not execute the Swift control flow or Core Location/CloudKit.

Standalone Swift tests are provided in
`tests/swift/RecorderCommandJournalTests.swift`; the runner extracts the production
database class and uses disposable files. Run on a Mac before the app build:

```text
node scripts/test-native-command-journal.mjs
node scripts/test-watch-native-policy.mjs
```

Local regression commands (from `mobile/recorder`, individually):

```text
node --experimental-strip-types --test tests/native-command-recovery.test.mts tests/native-command-journal-sql.test.mts tests/native-recorder-controls.test.mts tests/private-library-sync.test.mts tests/cloudkit-sync.test.mts tests/watch-build.test.mts
npm run typecheck
npm test
```

Swift compilation, iPhone/Watch GPS behavior, actual CloudKit cancellation, and
device upgrade/rollback behavior remain unverified. No app build or Expo export
was performed. The native inbox schema upgrade requires the next native runtime;
the master archive and CloudKit record schemas are unchanged.

Implementation references: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[CloudKit resource timeout](https://developer.apple.com/documentation/cloudkit/ckoperation/configuration-swift.class/timeoutintervalforresource),
and [CloudKit zone-change callbacks](https://developer.apple.com/documentation/cloudkit/ckfetchrecordzonechangesoperation).
