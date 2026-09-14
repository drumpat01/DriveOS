# Next native build checklist

This is the living source of truth for native changes shipped in JourneyDeck iOS
Builds 24 and 27 and candidates for later native builds. Build 27 is version
`2.0.0`, runtime `2.0.0-watch.6`, and requires iOS 17. The next source candidate
uses runtime `2.0.0-watch.7` (`2.0.0-preview.12`) so its generic Minted bridge
and SDK 57 patch set cannot receive or send updates for Build 27. Keep implementation/build
state and device verification separate: a successful archive does not mean the
behavior has passed on an iPhone, iPad, or Apple Watch.

**Release authorization:** On September 12 the user explicitly lifted the prior
hold and authorized committing, pushing, building, and submitting one production
TestFlight build containing all listed native work and bundled OTA advancements.

Release result (September 12): source commit `33bbd4a` is pushed. EAS production
Build 24 (`e5c41645-7467-48ba-bae0-0c2a5b00fc27`) compiled and signed the iPhone
app and Watch extension successfully. Submission
`1f1dd476-0ee6-4a83-8433-2bd68905bfaf` succeeded; Apple reports the build
`VALID` and `IN_BETA_TESTING`. The build bundles all committed OTA advancements;
no separate OTA was published. Physical-device acceptance remains pending.

Latest release result (September 12): EAS production Build 27
(`f3cf1d44-e1d6-4200-9ceb-b52d9da210e5`) compiled and signed the Minted keepsake,
iPhone/iPad app, and Watch extension. Submission
`e9b06d03-7d3f-477a-834e-a2dae356ea2f` succeeded; Apple reports the build
`VALID` and `IN_BETA_TESTING`. No Git staging, commit, push, or OTA accompanied
this build.

Current release-candidate preparation (September 14): source only. The user has
kept native/EAS builds on hold while the full medallion set is completed. Do not
start the next build or submit it until that hold is explicitly lifted.

## Required changes

| ID | Native change | State | Required verification |
| --- | --- | --- | --- |
| NB-001 | Harden the Swift ten-minute manual inactivity policy with an accuracy-aware observation baseline and an independent recent-movement check, so accepted GPS uncertainty can resolve parking without hiding a departure near the cutoff. | Included in Build 24; EAS Swift archive passed. | Test parking/walking, resumed driving near ten minutes, GPS drift/loss/recovery, and airplane-mode recovery on a device. |
| NB-002 | Make native recorder status and persisted-session reconciliation finish a fresh, already-confirmed inactivity interval. This closes the case where no new location callback arrives at the exact cutoff but a later native status/recovery entry point runs. | Included in Build 24; EAS Swift archive passed. | With the phone locked, confirm the native session, GPS indicator, phone clock, and Watch state all stop once. Foreground after the boundary and repeat with Pause/Resume and rapid Watch Stop/Start. |
| NB-003 | Durable native recorder command journal with operation IDs and queryable outcomes for Start, Pause, Resume, and Finish, including phone, Watch, and legacy bridge entry points. | Included in Build 24; EAS Swift archive passed. Native inbox schema 2 adds durable intents and atomic transition receipts. Interrupted Start/Resume intents are rejected; Pause/Finish recover against the exact owner/session. Configure retains its existing serialized path. | Test lost responses, database-full writes, relaunch, expired commands, and rapid phone/Watch controls. Confirm a replayed Start cannot recreate an acknowledged journey. |
| NB-004 | CloudKit stuck-operation recovery (promoted from NC-001): cancellable native requests, bounded responses, late-result suppression, and guards against overlapping unresolved work. | Included in Build 24; EAS Swift archive passed. Native transport version 6. Existing durable deletion pause, conflict checks, and commit-after-import cursors are preserved. | Inject delayed/cancelled CloudKit callbacks on a disposable account. Verify timeout/retry, JS reload during a request, deletion after an uncertain response, missing zone results, and a large multi-page restore. Confirm queued records are not acknowledged from late responses. |
| NB-005 | One native recording state machine for phone/Watch Start, Pause, Resume, Finish, automatic start/stop, inactivity completion, profile handoff, and persisted-session recovery. | Included in Build 24; EAS Swift archive passed. Terminal/owner/session fences and receipt validation live in `RecorderStateMachine.swift`. Native status reconciles committed active transport; new native engines no longer receive speculative Resume from a stale UI mirror. | Test phone/Watch races, profile switches, interrupted Finish, and relaunch. |
| NB-006 | Store recovery-critical movement checkpoints in native SQLite with session state, point writes, and command receipts. | Included in Build 24; EAS Swift archive passed. Native inbox schema 3 adds an owner-scoped checkpoint with an optional session for idle detection candidates. Matching legacy UserDefaults state is migration input only; stale command intervals reset. | Upgrade a disposable old database. Inject point/checkpoint/receipt failures and terminate between writes. Verify a failed profile fence cannot restart the previous profile. |
| NB-007 | Native recorder status events update the React Native clock immediately, with polling retained for recovery. | Included in Build 24; EAS Swift archive passed. Start/Resume, Pause, Finish and failure signals use journey identity, stream ID and sequence. UI rejects stale events/status work; subscriptions support older binaries and remove their listeners. | Exercise Watch Pause/Finish with a locked phone, JS suspension/reload, lost events, rapid new journeys, and a profile switch during status reads. Verify phone/Watch clock agreement after foregrounding. |
| NB-008 | Minted milestone keepsakes: compile a local `JourneyDeckKeepsakes` Expo module, pin Minted to exact version `1.1.1`, and turn the bundled `The First Track` gold-vinyl artwork into an interactive `ArtworkCoin` in Memories. | Included in Build 27; EAS Swift archive and TestFlight processing passed. Runtime is production `2.0.0-watch.6`; the app deployment target is iOS 17.0 because Minted requires iOS 17. A static React Native artwork fallback remains available when the native view is absent. Build `f3cf1d44-e1d6-4200-9ceb-b52d9da210e5`, submission `e9b06d03-7d3f-477a-834e-a2dae356ea2f`. | Confirm relief and metallic depth, drag rotation, resumed idle rotation, VoiceOver labeling, fallback rendering, and phone/iPad layout after the first journey. |
| NB-009 | Generic Minted OTA-artwork bridge: accept a downloaded local artwork URI, mint any achievement face with one fixed gold body/edge/reverse, and keep artwork names, theme mappings, and earning rules in the updateable JavaScript layer. | Implemented in source for the next candidate. Minted remains pinned to `1.1.1`; native catalog capability is version 3. Runtime is isolated at production `2.0.0-watch.7` and preview `2.0.0-preview.12`. No build or device acceptance yet. | Compile the production archive, inspect the signed runtime and Minted symbols, then verify all approved fronts download and appear face-forward in four themes on iPhone and iPad. Confirm the reverse and edge stay regular gold, offline cached artwork reopens, drag/idle motion works, Reduce Motion is honored, and an unavailable URI keeps the React Native fallback visible. |

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

- 2026-09-14: Prepared NB-009 as the next release-candidate native delta. Bumped
  the runtime to `2.0.0-watch.7` / `2.0.0-preview.12`, aligned SDK 57 patch
  dependencies, and kept the build hold in place. Native compilation and device
  acceptance remain required.

- 2026-09-12: Shipped NB-008 in production TestFlight Build 27. EAS compiled
  Minted and the local Expo bridge, exported the signed iPhone/iPad plus Watch
  IPA, and Apple reports `VALID` / `IN_BETA_TESTING`. Signed-package inspection
  confirmed iOS 17.0, runtime `2.0.0-watch.6`, both Minted and JourneyDeck
  resource bundles, and SHA-256
  `EF502E16FF561128B4F9E1997DA71E2C50E75A7DE74ECA24EA1EDB63C60F4A72`.
- 2026-09-12: Shipped NB-001 through NB-007 in production TestFlight Build 24
  from commit `33bbd4a`. EAS build and submission succeeded; Apple reports
  `VALID` / `IN_BETA_TESTING`. All committed OTA advancements are bundled in the
  binary; no standalone OTA was published. Physical-device acceptance remains.
- 2026-09-12: Added implemented source items NB-005 through NB-007 at the user's
  request. The user subsequently authorized the combined TestFlight release.
  Architecture, test evidence,
  and device gates: [native-recorder-consolidation-2026-09-12.md](native-recorder-consolidation-2026-09-12.md).
- 2026-09-12: Implemented NB-003 and promoted NC-001 to implemented NB-004 at the
  user's request. No build or publication. Detailed behavior, test commands,
  and remaining validation: [native-operation-hardening-2026-09-12.md](native-operation-hardening-2026-09-12.md).
- 2026-09-12: Created the ledger with two locally implemented recorder fixes,
  one proposed durable-command change, and two candidates requiring design.
