# Next native build checklist

This is the living source of truth for native changes intended for the next
JourneyDeck iOS build after Build 23 (`2.0.0`, runtime `2.0.0-watch.4`). Add new
items here as they are approved or discovered. Keep implementation state and
device verification separate: source completion does not mean the behavior has
passed on an iPhone, iPad, or Apple Watch.

**Release authorization:** On September 12 the user explicitly lifted the prior
hold and authorized committing, pushing, building, and submitting one production
TestFlight build containing all listed native work and bundled OTA advancements.

Latest local validation (September 12): **632/632 tests and TypeScript passed**,
including real SQLite rollback/process-termination checks and UI recovery races.
Swift compilation and physical-device acceptance remain pending. No build was run.

## Required changes

| ID | Native change | State | Required verification |
| --- | --- | --- | --- |
| NB-001 | Harden the Swift ten-minute manual inactivity policy with an accuracy-aware observation baseline and an independent recent-movement check, so accepted GPS uncertainty can resolve parking without hiding a departure near the cutoff. | Implemented locally; Swift is uncompiled. | Run the Swift policy harness, compile in Xcode/EAS, then test parking/walking, resumed driving near ten minutes, GPS drift/loss/recovery, and airplane-mode recovery. |
| NB-002 | Make native recorder status and persisted-session reconciliation finish a fresh, already-confirmed inactivity interval. This closes the case where no new location callback arrives at the exact cutoff but a later native status/recovery entry point runs. | Implemented locally; Swift is uncompiled. | With the phone locked, confirm the native session, GPS indicator, phone clock, and Watch state all stop once. Foreground after the boundary and repeat with Pause/Resume and rapid Watch Stop/Start. |
| NB-003 | Durable native recorder command journal with operation IDs and queryable outcomes for Start, Pause, Resume, and Finish, including phone, Watch, and legacy bridge entry points. | Implemented locally on September 12; Swift is uncompiled. Native inbox schema 2 adds durable intents and atomic transition receipts. Interrupted Start/Resume intents are rejected; Pause/Finish recover against the exact owner/session. Configure retains its existing serialized path. | Run `node scripts/test-native-command-journal.mjs` on a Mac, compile the app, and test lost responses, database-full writes, relaunch, expired commands, and rapid phone/Watch controls. Confirm a replayed Start cannot recreate an acknowledged journey. |
| NB-004 | CloudKit stuck-operation recovery (promoted from NC-001): cancellable native requests, bounded responses, late-result suppression, and guards against overlapping unresolved work. | Implemented locally on September 12; Swift is uncompiled. Native transport version 6. Existing durable deletion pause, conflict checks, and commit-after-import cursors are preserved. | Compile and inject delayed/cancelled CloudKit callbacks on a disposable account. Verify timeout/retry, JS reload during a request, deletion after an uncertain response, missing zone results, and a large multi-page restore. Confirm queued records are not acknowledged from late responses. |
| NB-005 | One native recording state machine for phone/Watch Start, Pause, Resume, Finish, automatic start/stop, inactivity completion, profile handoff, and persisted-session recovery. | Implemented locally; Swift is uncompiled. Terminal/owner/session fences and receipt validation live in `RecorderStateMachine.swift`. Native status reconciles committed active transport; new native engines no longer receive speculative Resume from a stale UI mirror. | Run both Swift harnesses with `node scripts/test-native-command-journal.mjs`; compile recorder and Watch; test phone/Watch races, profile switches, interrupted Finish, and relaunch. |
| NB-006 | Store recovery-critical movement checkpoints in native SQLite with session state, point writes, and command receipts. | Implemented locally; Swift is uncompiled. Native inbox schema 3 adds an owner-scoped checkpoint with an optional session for idle detection candidates. Matching legacy UserDefaults state is migration input only; stale command intervals reset. | Run migration/rollback harnesses, then upgrade a disposable old database. Inject point/checkpoint/receipt failures and terminate between writes. Verify a failed profile fence cannot restart the previous profile. |
| NB-007 | Native recorder status events update the React Native clock immediately, with polling retained for recovery. | Implemented locally; Swift is uncompiled. Start/Resume, Pause, Finish and failure signals use journey identity, stream ID and sequence. UI rejects stale events/status work; subscriptions support older binaries and remove their listeners. | Exercise Watch Pause/Finish with a locked phone, JS suspension/reload, lost events, rapid new journeys, and a profile switch during status reads. Verify phone/Watch clock agreement after foregrounding. |

## Native candidates pending design

These items are not yet committed to the build. Move an item into **Required
changes** when its design shows that native code is necessary.

| ID | Candidate | Decision needed |
| --- | --- | --- |
| NC-002 | Native, privacy-safe recorder diagnostic ring buffer. | Prefer JavaScript diagnostics first. Add native logging only if device failures occur below the bridge; retain reason codes and timestamps without coordinates, profile data, tokens, or secrets. |

## Build gate

Before submitting the combined build:

- Reconcile this list against the actual Swift/config/plugin diff and mark every
  included item with its commit or immutable build source reference.
- Run the complete mobile tests, TypeScript checks, Swift policy harness, native
  capability/source checks, and an iOS archive build.
- Inspect the signed app/Watch package and confirm the runtime/version/build
  numbers are isolated from older OTA runtimes.
- Assign the next native runtime before building. Recorder inbox schema 3 cannot
  be opened by older schema-1/schema-2 recorder code after an upgrade; do not plan
  a binary rollback to Build 23 or reduce the schema version. The master archive
  schema and CloudKit production schema are unchanged by these recorder changes.
- Keep the current native automatic-recorder rollout flag disabled until its
  device matrix is complete. The existing Expo fallback remains for installed
  binaries and the current rollout.
- Complete the recorder device matrix on iPhone and paired Watch, including a
  locked phone, background operation, force-quit/relaunch disclosure, GPS loss,
  low storage, Pause/Resume, and rapid Stop/Start.
- Verify iPhone and iPad launch, rotation, Dynamic Type, account isolation, local
  archive integrity, and private iCloud sync before any wider TestFlight release.

## Change log

- 2026-09-12: Added implemented source items NB-005 through NB-007 at the user's
  request. The user subsequently authorized the combined TestFlight release.
  Architecture, test evidence,
  and device gates: [native-recorder-consolidation-2026-09-12.md](native-recorder-consolidation-2026-09-12.md).
- 2026-09-12: Implemented NB-003 and promoted NC-001 to implemented NB-004 at the
  user's request. No build or publication. Detailed behavior, test commands,
  and remaining validation: [native-operation-hardening-2026-09-12.md](native-operation-hardening-2026-09-12.md).
- 2026-09-12: Created the ledger with two locally implemented recorder fixes,
  one proposed durable-command change, and two candidates requiring design.
