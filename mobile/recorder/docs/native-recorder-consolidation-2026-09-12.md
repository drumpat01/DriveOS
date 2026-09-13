# Native recorder consolidation — September 12, 2026

The user requested a shared native transition path, SQLite recovery checkpoints,
and native status events for the phone clock. Source work and automated checks
are complete locally. On September 12 the user lifted the native build and
publication hold and authorized a production TestFlight build containing the
complete native and bundled OTA source. Until that build is accepted by Apple,
the installed app does not contain these native changes.

## Implemented source

- `RecorderStateMachine.swift` owns native lifecycle transitions and checkpoints.
  `RecorderCommandJournal.swift` delegates execution to it and emits callbacks
  only after pending receipts commit as applied.
- Native inbox schema 3 adds an owner-scoped checkpoint row with a nullable
  session reference. The native store remains separate from the Expo master
  archive. Point writes require an existing state-machine transaction, including
  the final point when inactivity finishes a journey.
- Profile changes pause old sessions before changing configuration. If the
  database fence fails, tracking stops and configuration is cleared so bootstrap
  cannot rearm the old profile. Returning to a profile fences its old session.
- `recorderStatusChanged` carries `streamId`, `sequence`, `journeyId`, `status`,
  and `occurredAt`. Native status snapshots revalidate identity, configuration,
  event sequence and tracking generation. Failure events are deduplicated.
- The React Native event subscription freezes matching Pause/Finish clocks and
  invalidates pending refreshes. New native engines recover their own transport;
  JS cannot manufacture Resume from an out-of-date inbox mirror. Older binaries
  retain capability-detected polling/control fallback.

## Executed verification

- **632/632 mobile tests passed** with `npm test`; log:
  `mobile/recorder/.cache/native-consolidation-full.log`.
- `npm run typecheck`, runner JavaScript syntax, and `git diff --check` passed.
- Thirteen real SQLite tests exercised production SQL constants: write rejection
  at session/checkpoint/point/receipt boundaries; idle-to-session checkpoint
  transfer rollback; owner isolation; receipt retention; and killed child
  processes before/after commit followed by database integrity checks.
- App refresh tests executed the actual refresh body with controlled native
  responses. They covered Watch Pause before inbox import, native recovery with
  GPS unconfirmed, and an event/profile switch while refresh was in flight.
- Additional Swift journal/state-machine tests were authored, **not executed**.
  `node scripts/test-native-command-journal.mjs` now runs the two independent
  harnesses on a host with Swift. This Windows host has no `swiftc`; no native
  compilation, Core Location execution, real phone/Watch, or CloudKit account
  was used for this milestone.

## Required invariants

- Phone and Watch commands, automatic detection, inactivity completion, and
  recovery use the same native session transition rules. A completed session
  cannot resume, and a command cannot affect a different owner or journey.
- A durable command intent may precede its execution. Its final receipt commits
  with the session transition and associated checkpoint changes. An uncertain
  response never authorizes blind replay of Start or Resume.
- Movement checkpoints use the native inbox SQLite database. A location batch
  and the resulting checkpoint commit together. A failed write preserves the
  last committed state for recovery.
- Legacy UserDefaults movement state is migration input only. Import requires
  matching ownership/session evidence; missing or ambiguous evidence starts a
  fresh observation interval, never an inferred stopped interval.
- Profile handoff fences the old recorder before commands for the new profile
  can become available. Status must describe a consistent configuration/session.
- Native transition events identify a journey and an ordered event stream.
  Pause/Finish freeze the matching clock immediately. Older event deliveries
  and in-flight status refreshes cannot restart that clock. Polling remains the
  recovery path for lost events, JS suspension, and older installed binaries.
- Events are local UI signals, not acknowledgement that route data has reached
  the master archive or iCloud. Existing local import/acknowledgement rules stay
  in force. Event payloads contain no coordinates, account credentials, or
  recorder control tokens.

## Verification matrix

| Case | Automated evidence to collect | Remaining native/device check |
| --- | --- | --- |
| Start/Pause/Resume/Finish from phone, Watch, detection, and recovery | Shared transition implementation and real SQLite transition tests | Compile native paths; exercise concurrent controls on paired Watch |
| Checkpoint or receipt write rejected | SQLite trigger failures roll back session/point/checkpoint/receipt together | Exercise genuine low-storage errors without losing the local archive |
| Process dies during transaction | Kill a disposable database writer; reopen and check integrity and pending intent | Kill/relaunch app around native callbacks |
| Process dies after durable intent | Reopen with pending Pause/Finish and verify one terminal outcome | Confirm Core Location shuts down and does not restart on relaunch |
| Legacy checkpoint migration | Source review: matching, absent, corrupt, and wrong-session state; reset stale command intervals; retry after failed write | Execute migration against a disposable previous native database; this Swift migration path was not run here |
| Late finish or pause event | Event order and in-flight refresh tests | Watch Stop while phone locked; foreground phone and compare clocks |
| New native event stream | Stream and profile handoff tests | JS reload and native process restart |
| Lost event or older binary | Subscription fallback and polling recovery tests | Suspend JS, resume after native completion, check immediate reconciliation |

These checks do not establish an exact wall-clock execution guarantee while iOS
suspends the app. The existing policy is ten minutes of observed inactivity,
with a separate 24-hour ceiling; this change does not impose a ten-minute cap
on a moving journey.

## Build and rollout gates

Keep the native automatic-recorder rollout flag unchanged until native/device
acceptance is complete. Existing Expo fallback paths remain necessary for the
installed binary and the current rollout. The shared state machine governs the
native engine; it does not make an OTA update capable of replacing that engine.

Before the next authorized build, choose a new native runtime, compile both
recorder and Watch targets, run the Swift unit harnesses, and perform the device
matrix in [the build checklist](next-native-build-checklist.md). Keep source
completion, executed automated tests, and device acceptance recorded separately.
