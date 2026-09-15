# Next native build checklist

This is the living source of truth for native changes shipped in JourneyDeck iOS
Builds 24, 27, and 28 and candidates for later native builds. Release-candidate
Build 28 is version `2.0.0`, runtime `2.0.0-watch.7`, and requires iOS 17. Its
generic Minted bridge and SDK 57 patch set cannot receive or send updates for
Build 27. Keep implementation/build
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

Release-candidate result (September 14): the user explicitly lifted the build
hold and authorized a production TestFlight build and upload. EAS production
Build 28 (`ec98f55b-ce23-4716-b526-7d0366611358`) compiled and signed the
iPhone/iPad app and Watch extension. Submission
`4f95b46b-d18a-46ff-80cc-d92671ffd1eb` finished; Apple reports the build
`VALID` and `IN_BETA_TESTING`. The signed IPA verifies version `2.0.0` (28),
runtime `2.0.0-watch.7`, production channel/bundle/iCloud container, iPhone and
iPad device families, iOS 17 minimum, embedded Watch build 28, beta provisioning,
Minted/ArtworkCoin symbols, four alternate icon registrations, and privacy
manifests. No Git staging, commit, push, or OTA accompanied this build.

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
| NB-009 | Generic Minted OTA-artwork bridge: accept a downloaded local artwork URI, mint any achievement face with one fixed gold body/edge/reverse, and keep artwork names, theme mappings, and earning rules in the updateable JavaScript layer. | Included in Build 28; EAS Swift archive and TestFlight processing passed. Minted remains pinned to `1.1.1`; native catalog capability is version 3. Runtime is production `2.0.0-watch.7`. Signed IPA contains `JourneyDeckKeepsakes`, `ArtworkCoin`, and `Minted` symbols. | Verify all approved fronts appear face-forward in four themes on iPhone and iPad. Confirm the reverse and edge stay regular gold, offline cached artwork reopens, drag/idle motion works, Reduce Motion is honored, and an unavailable URI keeps the React Native fallback visible. |

## RC2 native changes and device acceptance

RC2 Build 30 (`31052a3a-ae42-4105-8890-d8dda77d2682`) now contains NB-013
and NB-012 on runtime `2.0.0-watch.8`. Apple reports `VALID` and
`IN_BETA_TESTING` after exact-build submission
`da871dc2-7cb2-4a2b-99a6-6b0fceda6e17`. Source/device acceptance remains
separate: the icon's system mask and Siri controls still need physical checks.

The user confirmed on September 15 that NB-013 and NB-012 are in scope for
release candidate 2. The iPad medallion presentation and iPhone/iPad replay
are accepted on device after the latest OTA. RC2 implementation/build and
device verification remain separate from those OTA confirmations.
The user also confirms the three remaining Build 28 smoke checks passed:
locked/backgrounded phone plus paired Watch recording and saved result,
offline local archive/iCloud recovery, and selected-song/Relive spacing with
large-text/iPad rotation. This does not claim every failure edge case was run.

### NB-013 — Grand Touring icon proportions match Rosewater (September 15)

Build 30 packaged an earlier Grand Touring design with an unwanted gold outside
border; physical review rejected it. The user then approved a centered,
border-free Grand Touring design with midnight navy matching the app, followed
by matching Warm Ivory, Rosewater and Cinematic designs. Current source includes
all four opaque 1024px images in the Settings picker and iOS/iPadOS native icon
catalog. Stable icon IDs, native names and Plus gating are unchanged. The primary
light/dark and Watch icon source share the approved Grand Touring navy image.

Verification: native alternate catalogs contain the exact approved source
pixels, the Watch generated primary contains the exact Grand Touring source
pixels, 17 focused icon/Watch/preference tests pass, TypeScript passes, and the
iOS export includes all four picker images. These changes are **not** in Build
30. The next signed build must verify all four Settings previews and actual
iPhone/iPad Home Screen icons after switching, switching back to primary, fresh
install and upgrade, plus the single Grand Touring Watch Home Screen icon.
watchOS does not offer a runtime alternate-icon API, so the Watch Home Screen
icon cannot follow the phone's selected alternate. OTA can change Settings
previews but cannot replace the installed system icons.

### NB-012 — Siri start and stop journey controls (September 15)

Implemented in signed RC2 Build 30; physical Siri discovery and journey-control
verification remain pending. Build 29 failed native compilation and was not
submitted; Build 30 compiled the corrected import and App Intents metadata.

- Add native Swift Start Journey and Stop Journey App Intents and an
  AppShortcutsProvider for phrases such as "Start a journey in JourneyDeck"
  and "Stop my journey in JourneyDeck".
- Use the existing native recorder command journal and state machine. Stop
  finishes and saves locally; repeated Start must not create a second journey.
  Preserve owner/session checks and report success only after durable confirmation.
- Handle missing Always location permission, incomplete profile setup, an
  already-active journey, and no journey to stop with clear Siri responses.
  Provide a foreground setup fallback when required.
- Verify Siri/Shortcuts discovery in the signed app, cold launch, background
  and locked-phone operation, actual GPS capture, local persistence, repeated
  commands, and races with phone/Watch controls on physical devices.
- Included in signed RC2 Build 30 with isolated `2.0.0-watch.8` runtime; this
  integration cannot ship through an OTA update alone.

## Native acceptance and later candidates

### NB-011 — Medallion correction moved to OTA (September 14)

The native capability-4 / `.watch.8` proposal was retired. Three.js replaces
the medal JS view using Expo DOM WebView, confirmed present in the signed
Build 28 IPA. Native sources remain unchanged; production runtime `.watch.7`
and preview `.preview.12` remain compatible. No new native build is needed.

After OTA delivery, verify all ten medals/four themes at face-on, quarter
turn, edge-on and reverse on iPhone and iPad. Check Memory Maker's complete
hands/photo, circular gold reverse, uninterrupted shading, visible thickness,
offline reopen, theme changes, drag/idle, Reduce Motion and VoiceOver. Browser
and source validation passed; physical device acceptance remains pending.

### NB-010 — Approved Grand Touring primary icon (September 14)

Included in production Build 28 (`.watch.7`): opaque
1024x1024 `icon-grand-touring-v2.png`, blue gradient, bold champagne symbol and
champagne outer edge. Primary light/dark and Watch assets use it. The existing
Grand Touring alternate name is retained, Cinematic gets a separate native
alternate, and Settings maps the primary icon to Grand Touring. The existing
tinted/clear mask remains. Settings previews the new artwork; onboarding keeps
the user-approved logo-free presentation.

Verification: TypeScript and 26 focused Welcome/icon/native-navigation/Watch
tests pass, including generated opaque icon catalogs and primary/alternate
selection restoration. The EAS archive compiled and Apple accepted it; the
signed app registers the Grand Touring primary icon and all four alternate icon
names. Check fresh install, upgrade from a selected
alternate, each icon choice, system light/dark/tinted appearances, and the border
under Apple's actual iPhone/iPad/Watch masks on physical devices.


These items remain proposals and are not included in Build 28.

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

- 2026-09-15: Shipped final icon production TestFlight Build 31 on isolated
  `2.0.0-watch.9` runtime. Four approved no-border icons are bundled for the
  Settings chooser and native iOS alternate icon catalog; Grand Touring navy
  is the primary and Watch icon. All current mobile changes since Build 30 are
  bundled; no OTA accompanied the build. EAS build
  `e81cad23-f011-49be-afb3-b4a1ac1ec6cf` and exact submission
  `990fddc2-1100-428b-b584-196bf0318a54` finished. Apple reports `VALID` /
  `IN_BETA_TESTING`. Physical icon/Siri and final visual acceptance remain.

- 2026-09-15: Shipped NB-012 Siri intents and NB-013 corrected Grand Touring
  artwork in production TestFlight Build 30. EAS archive and signed IPA checks
  passed; exact submission completed and Apple reports `VALID` /
  `IN_BETA_TESTING`. Native/device acceptance remains separate.

- 2026-09-15: Completed NB-013 Grand Touring artwork correction locally using
  Rosewater's symbol proportions. Native delivery and device acceptance pending.

- 2026-09-15: Queued NB-012 Siri Start/Stop Journey controls for the next native
  build at the user's request. Planning only; implementation remains pending.

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
