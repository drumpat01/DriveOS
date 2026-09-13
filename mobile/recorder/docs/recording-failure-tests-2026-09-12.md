# Automated recording failure tests — September 12, 2026

User authorized local failure testing and fixes without a real phone. TestFlight
and OTA publication remain on hold. No real journey databases, cloud accounts,
device permissions, production services or secrets were used by these tests.

## Reproduced problems and fixes

1. **Hung native inbox export/acknowledgement blocked all later refreshes.**
   Each response now has a ten-second deadline. Expired export responses cannot
   continue into import; the pending lock clears so a later attempt can proceed.
   Acknowledgements contain only the exact completed IDs already committed to the
   master store. A late acknowledgement is safe to repeat. A response crossing a
   profile change is rejected before import. App native-status reads use the same
   bounded response helper and leave tracking unconfirmed on timeout.
2. **A failed completion transaction after a successful finishing claim skipped
   GPS shutdown.** Shutdown now runs in `finally`; the durable finishing state
   remains for recovery and success is not reported for the failed completion.
3. **One NaN GPS timestamp rolled back valid fixes in its batch.** Non-finite
   timestamps are skipped before constructing dates; valid points still commit.
4. **The earlier accuracy baseline could hide a fresh departure.** A generated
   fixture parked for 590 seconds then drove at 15m/s for ten seconds with 50m
   accuracy. The longer baseline incorrectly reached the inactivity cutoff.
   Independent short displacement checks now clear the parked interval when new
   driving is confirmed. JavaScript regression passed after failing before the
   correction. Swift uses the same correction and has a matching harness case.
5. **Older-binary Finish ignored the requested journey ID.** The fallback now
   reads status and rejects a mismatched ID or unreliable snapshot, matching the
   existing Pause/Resume fallback. New binaries retain the atomic native method.

## What actually ran

- Production TypeScript recorder/inbox/App-refresh code executed with controlled
  promises, including missing responses, late/out-of-order exports, concurrent
  callers, failed imports, profile changes and delayed acknowledgements.
- Production `storage.ts` executed against real Node SQLite with the production
  recorder schema and hardening triggers. Tests enumerated failures across writes
  and transaction boundaries in Start, GPS batch, Pause, Finish and native import.
- `PRAGMA max_page_count` forced an actual SQLite database-full error. A second
  connection holding `BEGIN IMMEDIATE` produced an actual write lock. Recovery
  preserved committed points and sequence counters, and subsequent writes worked.
- Child processes opened disposable on-disk WAL databases and were forcibly
  terminated before/after persistence steps during GPS writes, Finish and import.
  The parent reopened the same files and checked SQLite integrity/foreign keys,
  atomic GPS batches, retained prior points, retryable completion and unique
  session/job rows. Native import was reoffered after restart as an unacknowledged
  device snapshot would be. A Finish interrupted before its first durable write
  requires retrying the request; the test does not invent persisted stop intent.
- Sixty generated GPS combinations covered 3 accuracy levels, 4 sampling rates
  and 5 speeds, in addition to the departure regression and existing gap/drift tests.
- Full mobile suite: **595/595 passed**. TypeScript passed. Local iOS export passed:
  2,504 modules, 77 assets, 8.5MB Hermes bundle at `.cache/recording-recovery-export`.
  `git diff --check` passed with existing line-ending notices.

Focused commands from `mobile/recorder` (run individually):

```text
node --experimental-strip-types --test tests/native-inbox-recovery.test.mts tests/recorder-startup.test.mts tests/native-recorder-controls.test.mts
node --experimental-strip-types --test tests/recording-write-failures.test.mts tests/manual-recording-failsafe-runtime.test.mts
node --experimental-strip-types --test tests/recording-crash-recovery.test.mts
node --experimental-strip-types --test tests/manual-recording-failsafe.test.mts
```

## Evidence boundaries / next work

- The crash tests run real storage SQL but substitute archive enrichment, music,
  identity and device bridges. The archive adapter is an in-memory map, so these
  tests do not prove full-library/photo/iCloud restoration. Existing separate
  local-store and CloudKit tests also passed in the full suite.
- Simulated I/O failures throw at the adapter boundary; the database-full and
  competing-writer cases are real SQLite errors. Forced process termination is
  not a physical power-loss or iOS filesystem test.
- Deadlines do not cancel native execution. They are deliberately confined to
  reads and idempotent acknowledgements of committed data. Hanging native Start,
  Pause, Resume, configuration, or cloud mutation calls must not be blindly retried;
  stronger cancellation/expiry needs native coordination and separate validation.
- An older binary still has a read-to-mutation race in its control fallback.
  The atomic identity-aware native methods remain the complete protection.
- Swift cannot compile on this workstation with the available tools. Its harness
  and native iPhone/Watch behavior remain unverified. Before an authorized release,
  compile/run the Swift policy and test locked-phone GPS, renewed driving near the
  deadline, pause/resume, Watch rapid Stop/Start and permissions on hardware.
- No native build, OTA, stage, commit or push occurred. Continue from the dirty
  `codex/journeydeck-v2` tree and preserve unrelated changes.
