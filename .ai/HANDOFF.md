# Current Handoff State: Zero-Cost Multi-User Local-First Architecture

## Complete ten-medallion collection approved and integrated — September 14, 2026

- The user approved the final 4 Journey / 3 Music / 3 Memory collection and all
  four theme variants. The set is The First Track, Long Way Home, Thousand Mile
  Club, Grand Tourer, First Note, Long Play, Soundtrack 100, Memory Maker, Picture
  This, and Story Collector. Road Regular, Century Road, Halfway There, Explorer,
  Open Road, and After Dark are not part of the final ten.
- Saved the six new gold concept sheets, selected gold masters, four-theme sheets,
  and 24 new fronts under `mobile/recorder/assets/medallion-concepts`. Updated all
  four First Journey fronts so `FIRST JOURNEY` appears only on the upper arc. All
  40 active fronts are straight-on 520x520 RGBA circles with a 10px transparent
  safety margin; the Minted body, edge, and reverse remain regular gold.
- Updated Achievements to the final lineup. First Note unlocks on the first journey
  with at least one saved song; Long Play requires 10 plays in one journey;
  Picture This retains the earliest valid photo-add date; Story Collector retains
  the fifth valid Memory creation date.
- Verification passes: TypeScript, focused achievement/Minted tests 8/8, complete
  mobile suite 647/647, and iOS JavaScript export with 2,660 modules, an 8.7 MB
  Hermes bundle, 117 assets, and all 40 active fronts.
- No native/EAS build, OTA publish, demo-site update, Git commit, or Git push was
  performed. The next release gates are real App Store screenshots, corrected
  privacy-page deployment, App Store Connect state confirmation, then Build 28
  and TestFlight acceptance after the build hold is lifted.

## Long Way Home medallion approved and integrated — September 14, 2026

- Replaced **After Dark** with **Long Way Home — First journey over 25 miles**.
  The rule unlocks on the earliest individual journey whose distance is strictly
  greater than 25 miles; an exact 25.0-mile journey does not unlock it.
- The user approved option 7: a vintage highway shield above a straight mountain
  road. Grand Touring uses the app's navy/champagne palette with a blank red
  shield cap, blue lower field, and white `25 MI`. The other approved fronts are
  Rosewater, Cinematic Dark, and Warm Ivory. The regular gold body, edge, and
  reverse remain unchanged.
- Saved the concept sheet, gold master, four-theme sheet, and four transparent
  520x520 fronts under `mobile/recorder/assets/medallion-concepts/long-way-home`.
  Added the four fronts to the generic Minted OTA artwork catalog. Six of ten
  medallions are now approved; Explorer, Open Road, Thousand Mile Club, and Grand
  Tourer remain.
- Verification passes: TypeScript, focused achievement/Minted tests 6/6, complete
  mobile suite 645/645, and iOS JavaScript export with 101 assets including all
  24 approved theme fronts. The unfinished set was subsequently changed to Grand
  Tourer, Thousand Mile Club, Halfway There, and Long Play. No native/EAS build,
  OTA publish, or demo-site update was performed.

## Requested medallion list — September 13, 2026

- Recorded the user's ten medallion names and milestones, in order, in
  `docs/medallions.md`. Scope is recording the list; artwork and implementation
  remain future work.
- Branch `codex/journeydeck-v2`, HEAD `3f7f035`; existing mobile changes preserved.
  Documentation only; list read back for accuracy. No runtime tests needed.
- Next step when requested: use this list for medallion creation.
- Design preference: each medallion may use any of the app's four current themes
  and its corresponding color palette; recorded in `docs/medallions.md`.
- Generated the first 10-concept review batch for `The First Track` under
  `mobile/recorder/assets/medallion-concepts/the-first-track/`: two gold
  monochrome, two Grand Touring, two Rosewater, two Cinematic Dark, and two Warm
  Ivory. `README.md` maps concepts 01–10 to their palette and visual direction.
  These are review concepts only and are not wired into the app.
- Selected concept 01 as a theme-variant demonstration and generated four
  palette exports under its `option-01-theme-variants/` folder. The README maps
  visual regions and runtime theme IDs. Restored verified transparent alpha from
  the original master after the generator painted checkerboards. The variants
  remain review assets and are not wired into the app; production exports should
  use deterministic layers/masks for pixel-identical geometry.
- User approved concept 01's four theme treatments and explicitly directed that
  no app/native builds occur until all medallions are complete. Created a
  separate static review site in `medallion-demo-site/` with theme switching,
  drag/momentum/idle rotation, modeled edge depth, reverse face, responsive
  layout, keyboard controls, and placeholders for the remaining nine medals.
  Privately published version 2 at
  `https://journeydeck-medallion-review.drumpat01.chatgpt.site`. The browser
  presentation approximates Minted; exact SwiftUI/SceneKit lighting remains an
  iOS acceptance item for the eventual combined build. No mobile app source was
  changed for the demo and no native, Expo, or EAS build was run.

## Compact Memory journeys and Settings Achievements — September 13, 2026

- Replaced the multi-row Journey library cards in Memories with one-line rows:
  date, route, miles, duration, and songs truncate on the left while a persistent
  `View ›` link sits on the right. Selection, drag/drop, and phone action menus
  remain available.
- Removed the First Track achievement banner from both phone and iPad Memories.
  Added an Achievements category to phone and iPad Settings with eight milestone
  badges. Locked badges are greyed out with their names and lock status beneath.
- Tapping any badge presents the existing native Expo UI bottom sheet at half or
  full height. The detail includes How, When, and Why context; its medallion can
  be dragged horizontally to rotate, respects Reduce Motion, and shows a reverse
  face. Milestones retain the exact journey/date that crossed each threshold.
- Screenshot follow-up explicitly stretches the bottom-sheet scroll surface to
  the full page width and centers the medallion within it. TypeScript and focused
  Achievements/Settings tests pass 5/5. This centering adjustment has not yet
  been published by OTA.
- Added milestone, detail-sheet, Settings routing, single-line row, and removal
  regression coverage. Focused tests pass 15/15, TypeScript passes, the full
  mobile suite passes **644/644**, `git diff --check` has no errors, and a
  production iOS export passes (2,613 modules, 78 assets).
- No package/config/native changes were needed; this uses the Expo UI native
  module already embedded in Build 27 runtime `2.0.0-watch.6`. Published to the
  iOS `production` branch: group `a7d0c299-4a0a-4e28-b47b-feaed551e30b`, update
  `01a09c5b-bc3c-7f4c-aa54-d1bdf37144fa`, message
  `Add Settings achievements and compact journey rows`. `update:view` and
  `update:list` confirmed it as production head. No native build, Git staging,
  commit, or push was performed. Physical-device bottom-sheet and medallion
  gesture validation remains pending.

## Statistics Liquid Glass and complete outlines — September 13, 2026 (published OTA)

- Replaced simulated `ThemeMaterial` lighting on every Statistics widget with
  the existing `AdaptiveGlassSurface`: native `GlassView` on supported iOS 26
  devices, blur fallback on older supported iOS, and an opaque surface when
  Reduce Transparency is enabled.
- Removed the Statistics metric and panel left-edge accent rails. Metric cards,
  analysis panels, Atlas, and Year on the Road now use thin, evenly colored
  complete perimeter outlines with balanced glow.
- Updated both Statistics render harnesses. Focused tests pass 12/12, TypeScript
  passes, the full mobile suite passes 642/642, `git diff --check` has no errors,
  and production iOS export passes (2,515 modules, 78 assets).
- Published to the iOS `production` branch for existing Build 27 runtime
  `2.0.0-watch.6`: group `e44e892b-2962-43ba-9ad3-9a8ef715958d`, update
  `01a09c3d-4461-7f10-b1e5-c9451aeaea81`, message
  `Add Liquid Glass statistics widgets`. `update:view` and `update:list`
  confirmed it as production head. No native build, Git staging, commit, or push.
  Physical iOS 26 glass rendering remains unverified.

## Concise Journey Details copy — September 13, 2026 (published OTA)

- Simplified the Journey Details page copy: one-line Route and Soundtrack
  headings, a short empty-soundtrack prompt, concise location-name guidance,
  and no redundant soundtrack placeholder sentence. Behavior and data are
  unchanged.
- TypeScript, focused Journey Details tests (32/32), full mobile suite (642/642),
  diff whitespace validation, and production iOS export passed (2,515 modules,
  78 assets).
- Published to the iOS `production` branch for Build 27 runtime
  `2.0.0-watch.6`: group `a88e9e3d-36d4-4d9d-adfd-ceda76fdf006`, update
  `01a09c0a-8374-791f-bb8f-683fb3995883`, message
  `Simplify Journey details copy`.
- Screenshot follow-up removed the map privacy paragraph, forced the concise map
  instruction to one line, and reduced the gold Relive control to one compact
  44-point row without its description. Focused tests (32/32), TypeScript, diff
  whitespace validation, and a fresh production iOS export passed. Replacement
  production group `bb5494e9-2c86-423b-ba6e-7df72f87e78b`, update
  `01a09c10-97f5-77ee-877f-b4af29d9f76f`, message
  `Compact Journey map controls`; `update:view` and `update:list` confirmed it as
  the production head. No native build, Git staging, commit, or push.

## Memory photo repair after TestFlight updates — September 12, 2026

- User reports existing Memory photos disappear after each TestFlight update.
  Reproduced a concrete gap: `private-photo-file.ts` repaired Documents paths
  but not native iCloud downloads under Library/Application Support. A regression
  with real SQLite metadata and a simulated relocated asset failed before the fix.
- Added exact-owner/exact-photo Application Support path repair for native
  content-addressed and legacy filenames. It preserves content revisions,
  timestamps, backup acknowledgement, extension and payload digest, without
  searching other profiles or downloading. Extracted unchanged CloudKit profile
  scope derivation to `private-cloud-profile.ts` for reuse without a sync cycle.
- Repeated-container relocation and invalid-owner/file/traversal tests pass;
  focused private-library/content tests 33/33, TypeScript and iOS export passed.
  Updated one structural test to read the moved scope helper; full mobile suite
  **639/639** passed. No native code, schema, Git staging/commit/push changes.
  Previous inline-journey choice work remains intact. Logs under
  `mobile/recorder/.cache/photo-relocation-{tests,export}.log`.
- Published production iOS OTA on Build 24 runtime `2.0.0-watch.5`: group
  `e346fd63-976a-4b43-ac4a-1fc9797b0452`, update
  `01a09874-b4ac-73d5-b5a5-2e6c1c929444`, message
  `Reconnect Memory photos after TestFlight updates`. Read-back confirmed the
  production head and iOS update ID. Physical-device
  recovery remains unverified; this repairs existing files with stale paths,
  not files that have actually been removed from the device.

## Inline hidden-journey choice — September 12, 2026

- User requested a small inline message below Start Journey, with a choice when
  a saved Home-to-Home/Work-to-Work journey is hidden. Implemented phone/iPad
  `HiddenJourneyNotice`: Show in Memories or Keep hidden, no modal. It checks
  the latest completed recorder session after archive mirroring/foregrounding,
  preserves the recording for either choice, and reports write failures inline.
- Per-journey choices use existing owner-scoped private preferences (full
  recording identity retained). Show overrides the presentation filter across
  library/dashboard/primary sections and Atlas insights. No native/schema change.
- Branch `codex/journeydeck-v2`, HEAD `3f7f035`. TypeScript, 14 focused tests,
  full mobile suite **637/637**, diff whitespace validation and iOS export passed.
  Published production iOS OTA for Build 24 runtime `2.0.0-watch.5`:
  group `d8d15b80-0d53-4726-97c7-873c47c979f0`, update
  `01a09868-6274-75f8-a67f-779c643287c6`, message
  `Add inline choice for hidden Home and Work journeys`;
  `update:list` and `update:view` confirmed the production head and iOS ID.
  no Git staging/commit/push. Logs: `.cache/hidden-journey-choice-tests.log` and
  `.cache/hidden-journey-choice-export.log` under `mobile/recorder`.
- Physical iPhone/iPad/Dynamic Type checks remain pending. Confirm the couch
  recording resolves to Home at both ends; choose Show and verify Memories,
  then test Keep hidden and relaunch persistence on another recording.

## Couch auto-finish expectation — September 12, 2026

- User subsequently supplied a screenshot showing READY and native auto-finish
  notice, with an older Latest memory. Code review found `journey-visibility.ts`
  intentionally hides Home-to-Home and Work-to-Work records from app-data and
  primary sections while retaining storage. This likely explains a couch test
  if both endpoints resolved to Home; device record/import state is unverified.
  No product changes made; do not remove the established filter without direction.
- Read-only code review confirms manual journeys should finish after ten minutes
  of observed inactivity, conditional on usable, continuing location observations;
  this is not an exact ten-minute wall-clock deadline. Indoor poor accuracy,
  ambiguous movement or observation gaps can reset/delay that interval.
- Verified Swift policy and native finish/reconciliation paths on branch
  `codex/journeydeck-v2`, HEAD `3f7f035`; working tree was clean. No code changes
  or tests run. Build 24 release is recorded above/below; installed-device version
  and couch/locked-phone acceptance remain unverified.

## Combined native + OTA TestFlight release — September 12, 2026

- The user explicitly lifted the earlier hold and authorized commit, push, a new
  production TestFlight build, and submission with all current native changes
  and bundled OTA advancements. Source runtime advances from Build 23's
  `2.0.0-watch.4` to `2.0.0-watch.5`; preview source advances to preview.10.
- Release source commit `33bbd4a9d72ebb542372de56ec3c465d2243c653`
  (`feat: harden JourneyDeck V2 native recording`) is pushed to
  `origin/codex/journeydeck-v2`. The build contains the complete committed native
  and JavaScript/TypeScript/asset snapshot; no separate OTA was published.
- EAS production iOS Build 24 succeeded: build ID
  `e5c41645-7467-48ba-bae0-0c2a5b00fc27`, runtime `2.0.0-watch.5`, App Store
  distribution, iPhone app plus Watch extension. Automatic submission ID
  `1f1dd476-0ee6-4a83-8433-2bd68905bfaf` succeeded. Apple reports Build 24
  `VALID` and `IN_BETA_TESTING` for internal TestFlight users.
- Preflight evidence: 632/632 mobile tests, mobile TypeScript, production iOS
  Hermes export, server typecheck, 34/34 server tests, server lint, staged
  whitespace check, and staged gitleaks scan passed. The EAS archive provides
  the first successful Swift compilation/signing result for NB-001 through
  NB-007. Physical iPhone/Watch acceptance and injected live CloudKit/device
  failure testing remain pending. Public App Store release was not requested;
  its privacy/support URL metadata preflight remains separate.

## Native recording consolidation — September 12, 2026 (local only)

- User explicitly requested one native recording state machine, SQLite movement
  checkpoints, and native status events. Implemented using directed Sol/Luna
  subagents with root integration/review. **No build, Expo export, OTA,
  TestFlight, staging, commit or push.** Branch `codex/journeydeck-v2`, HEAD
  `6aad3b4`; broad preexisting dirty work remains intact.
- `mobile/recorder/modules/journeydeck-recorder/ios/RecorderStateMachine.swift`
  now owns lifecycle/checkpoint transactions. Journal commands, automatic
  start/stop, inactivity and recovery share owner/session/terminal fences.
  Native inbox schema **3** adds owner-scoped checkpoints (nullable session for
  idle candidates); point+checkpoint and final-point+completion writes are
  atomic. Legacy UserDefaults is migration input only, with matching-session
  and applied-command sequence checks before inactivity decisions.
- Profile handoff fences outgoing and incoming old sessions; database failure
  stops GPS and clears configuration so old-owner bootstrap cannot rearm.
  Native status snapshots revalidate identity, config, event sequence and
  tracking generation. Token-scoped module observers emit ordered, sanitized
  lifecycle/failure events. Failed status reconciliation is marked unreliable.
- TS event wrapper/helper and `App.tsx` freeze matching Pause/Finish clocks,
  reject stale event streams, cancel stale refresh recovery mutations and queue
  a fresh read. New native engines own transport recovery; a stale JS mirror
  cannot send Resume over a Watch Pause. Older-binary fallback and the disabled
  native automatic-recorder rollout flag remain.
- Verification: **632/632 mobile tests**, TypeScript, Swift runner JS syntax,
  and diff whitespace check passed. Log:
  `mobile/recorder/.cache/native-consolidation-full.log`. Includes 13 actual
  SQLite transaction/process-death checks plus actual App refresh code with
  controlled bridge responses. Both Swift harnesses are wired into
  `node scripts/test-native-command-journal.mjs`, but were **not compiled/run**;
  `swiftc` is unavailable. No real phone, Watch, or CloudKit execution.
- Updated `mobile/recorder/docs/next-native-build-checklist.md` with NB-005,
  NB-006, NB-007 (source implemented, device acceptance pending). Details and
  evidence: `mobile/recorder/docs/native-recorder-consolidation-2026-09-12.md`.
  Next authorized build must use a new runtime; inbox schema 3 cannot roll back
  to schema-1/2 binaries. Compile recorder/Watch, run Swift tests, execute legacy
  migration and locked-phone/Watch/profile/storage-failure acceptance. Master
  archive and CloudKit production schemas were not changed in this milestone.
- Test processes exited. Cleanup was policy-blocked for five disposable folders
  under `C:/Users/patri/AppData/Local/Temp`: `journeydeck-checkpoint-rRmyFg`,
  `journeydeck-checkpoint-OnUNRq`, `journeydeck-checkpoint-njl9JE`,
  `journeydeck-checkpoint-YXTsl5`, `journeydeck-native-journal-ZxL0w5`. They contain
  only synthetic test databases; subsequent tests cleaned their own folders.

## Durable recorder commands and CloudKit recovery — September 12, 2026 (local only)

- User explicitly requested implementation of Start/Pause/Resume/Finish operation
  IDs and CloudKit stuck-operation recovery, with **no build yet**. Implemented
  both; no native build, Expo export, OTA, staging, commit, push or publication.
  Branch remains `codex/journeydeck-v2`; unrelated dirty work is preserved.
- Recorder: new `RecorderCommandJournal.swift` adds native inbox schema 2 with
  committed intent and atomic session/receipt writes. Phone, Watch and legacy
  bridge controls use it; owner/session checks, replay receipts after inbox ack,
  expired/unknown response fencing, restart rejection of stale Start/Resume,
  recoverable Pause/Finish and matching GPS shutdown are included. Configure
  retains its existing serialized path. Source lives under
  `mobile/recorder/modules/journeydeck-recorder/`.
- CloudKit: new `CloudKitRequests.swift` uses explicit cancellable operations,
  one-shot completion, native request/resource/watchdog deadlines and a native
  process-wide request guard. `CloudKitRequestGate.ts` bounds JS callers while
  holding unresolved native work. Late results cannot acknowledge uploads;
  missing deletion results and nonadvancing tokens fail safely; existing durable
  deletion pause, cursor ingestion rules and optimistic conflict checks remain.
- Verification: **609/609 mobile tests**, TypeScript, JS syntax for the new Swift
  runner, and diff whitespace checks passed. Added controlled bridge/coordinator
  tests, real journal SQL write-failure tests, and killed a child during native
  Finish SQL before reopening its disposable database. Log:
  `mobile/recorder/.cache/native-hardening-full.log`. No actual Swift/CloudKit/GPS
  execution: `swiftc` is unavailable. Native unit runner for a Mac:
  `node scripts/test-native-command-journal.mjs` from `mobile/recorder`.
- Updated `mobile/recorder/docs/next-native-build-checklist.md`: NB-003 implemented;
  NC-001 promoted to implemented NB-004. Detailed behavior/limits in
  `mobile/recorder/docs/native-operation-hardening-2026-09-12.md`. Next authorized
  build must choose a new runtime, compile both modules, and validate on devices.
  Inbox schema 2 cannot be opened by Build 23's schema-1 recorder after upgrade;
  master archive and CloudKit production schemas were not changed.

## Next native build ledger — September 12, 2026

- Created `mobile/recorder/docs/next-native-build-checklist.md` as the living
  source of truth for changes to include in the next native build after Build 23.
  It now records the implemented-but-uncompiled recorder changes, durable recorder
  command journal, CloudKit recovery, candidate native diagnostics, and the
  combined build/device gates. See the implementation milestone above.
- The user's TestFlight hold remains active. Creating this ledger did not build,
  submit, publish, stage, commit, or push anything.

## Automated crash/write/stuck-operation hardening — September 12, 2026 (local only)

- User authorized all feasible testing/fixes without their real phone. The explicit TestFlight/OTA HOLD remains active; no build, publication, staging, commit or push. Branch `codex/journeydeck-v2`; unrelated dirty changes preserved.
- Reproduced and fixed: hung native inbox responses retaining the shared pending lock; completion-write failure skipping GPS shutdown after a durable finish claim; NaN GPS timestamps rolling back valid batch points; the earlier long accuracy baseline hiding driving resumed ten seconds before timeout; older-binary Finish failing to check the requested journey ID. Added read/committed-ack deadlines with late-export suppression, profile-change rejection, and App status-read timeouts. Mutating native calls are deliberately not blindly retried after a timeout.
- Added disposable SQLite write-failure enumeration, real SQLITE_FULL/competing-writer tests, and actual child-process termination/reopen tests around every exercised GPS/Finish/import write. Added 60 generated GPS combinations, native response/late-response cases, App refresh recovery and Finish identity regressions. Swift departure detection and matching harness updated but remain uncompiled here.
- Verification passed: full mobile suite **595/595**, TypeScript, iOS local export (2,504 modules/77 assets/8.5MB Hermes at `.cache/recording-recovery-export`), and `git diff --check` (existing CRLF notices). Test child processes exited and temporary databases were cleaned up. No phone or actual user/cloud data used.
- Evidence boundaries and commands: `mobile/recorder/docs/recording-failure-tests-2026-09-12.md`. Recorder SQL/schema are real; archive enrichment and device edges are stubbed. Full-library restore, Swift compilation and hardware validation remain pending. Old binary read-before-Finish reduces stale commands but retains a read-to-mutation race; atomic native methods are required for full protection.

## Recording failsafe audit — September 12, 2026 (local only; publication HOLD)

- User explicitly said **do not push a new TestFlight yet** during this audit. No native build, OTA, staging, commit or Git push was performed. This hold supersedes the default publication preference below for this work.
- On `codex/journeydeck-v2`, preserved existing dirty work. Fixed manual inactivity accuracy/anchor starvation in JS and Swift, replaced the legacy 500-point safety input with a 15-minute storage query, added native status/recovery evaluation of fresh confirmed inactivity, and removed Keychain/enrichment waits from local failsafe completion.
- Added `src/recorder-clock.ts` and wired the phone Home/detailed recorder to confirmed transport state, persisted end times and an explicit one-second tick. Paused/finishing/unconfirmed clocks freeze; a hung refresh can extrapolate only ten seconds. A native-completed session with a stale local mirror no longer keeps the UI clock running or triggers a resume.
- Verification: full mobile suite 570/570; TypeScript and local iOS export passed; diff whitespace check passed with existing CRLF notices. Added behavioral policy/runtime/clock/App-refresh tests and an actual SQLite dense-route regression. Swift harness expanded but unavailable here (`Swift compiler unavailable`); native source remains uncompiled and needs the next authorized native build plus locked-phone/Watch acceptance.
- Detailed findings, remaining callback/GPS limitations and exact next checks: `mobile/recorder/docs/recording-failsafe-2026-09-12.md`. The rule is still ten minutes of observed inactivity, with a 24-hour ceiling, not a hard ten-minute journey cap. Do not claim a 100% wall-clock guarantee or that the installed TestFlight app contains these changes.
- Follow-up hardening discussion: inspected current startup preservation, completion leases, native inbox serialization and diagnostics. Recommended next work is bounded recovery for hung native calls (without duplicate late mutations), injected write/crash failures, real native/device acceptance, restore drills and local reason-coded recorder diagnostics. These are recommendations, not implemented fixes or confirmed failures on the user's device; publication remains on hold.

## V2 OTA handoff runbook (EAS / TestFlight production flow)

This section is the authoritative V2 JavaScript/TypeScript/asset release procedure from this workspace.

Scope:
- Only use for **Expo OTA** updates to the existing V2 binary in TestFlight.
- Do not use for native build changes, app icon/bundle changes, permission additions, native module/plugin changes, or App Store metadata work.
- If native changes are needed, stop after Step 7 and hand off to a native-build path.

Preflight (must complete before every OTA attempt):
1. Confirm workspace and branch
   - `git status`
   - `git log -5 --oneline`
   - `Set-Location C:\Users\patri\JourneyDeckv2`
2. Read repo handoff constraints (already required):
   - `Get-Content .ai/HANDOFF.md`
   - `Get-Content GEMINI.md`
   - `Get-Content mobile/recorder/AGENTS.md`
3. Confirm EAS CLI and login:
   - `npx eas --version`
   - `npx eas whoami`
   - `npx eas project:info --json`
4. Confirm EAS targets:
   - `npx eas build:list --limit 5 --platform ios`
   - `npx eas update:list --platform ios --branch production --limit 20`

Publish steps (default V2 production OTA):
5. Run production iOS export from the current dirty-but-authorized worktree only after validation:
   - `npx eas update --platform ios --branch production --message "<short release summary>" --non-interactive`
   - If a profile is required in this session, use `--profile production`.
6. Save the returned group/update IDs immediately in `.ai/HANDOFF.md`:
   - group UUID
   - iOS update UUID
   - runtime version
   - message

Post-publish verification:
7. Verify publication landed to the active production channel:
   - `npx eas update:list --platform ios --branch production --limit 5`
   - `npx eas update:view --platform ios --branch production --id <update-id>`
   - Confirm:
     - branch = `production`
     - runtime matches expected TestFlight runtime (currently `2.0.0-watch.4` unless updated)
     - status is published and visible as latest
8. Confirm app-level runtime in TestFlight:
   - ensure TestFlight app is currently on runtime `2.0.0-watch.4`
   - cold-launch once; reopen twice if needed for propagation
9. Device sanity checks before handoff:
   - open Home, Soundtracks, Memories, Statistics, Settings
   - test iPad landscape and portrait, native sidebar both sides, 1/2 Split View, and largest Dynamic Type
   - validate theme transition and theme access flows
   - validate plus/content gating that was in scope for the update

Risk controls:
- Do not call OTA for any native-required work.
- Do not push partial or mixed branches.
- If app behavior is unstable after publish, stop at the last-known-good published update and reopen from that same branch state with the next run.
- Keep `.ai/HANDOFF.md` as the source of truth for current group/update IDs and pending review items.

One-time handoff note:
- The V2 production app is expected on `runtime 2.0.0-watch.4`.
- User preference remains: if the source change is JS/TS/styling/asset and verified, publish by default.

Troubleshooting appendix (handoff-safe recovery):
1. `npx eas whoami` fails or returns the wrong account
   - Confirm local credentials:
     - `npx eas logout`
     - `npx eas login`
   - Re-run:
     - `npx eas whoami`
     - `npx eas project:info --json`
   - If the project info does not show `JourneyDeckV2` (or equivalent expected slug), stop and confirm the active workspace/project mapping before continuing.

2. OTA publish command succeeds but update is not visible
   - Verify branch readback:
     - `npx eas update:list --platform ios --branch production --limit 20`
   - Re-run the same list command after ~60–120s.
   - If still missing, confirm network and account project access, then confirm there is no pending interactive prompt by re-running publish with `--non-interactive`.

3. App shows old runtime after publication
   - Confirm expected runtime in EAS:
     - `npx eas update:list --platform ios --branch production --limit 5`
   - Confirm TestFlight version/runtime in use:
     - verify TestFlight app version is still `2.0.0-watch.4` unless intentionally moved
   - Cold-launch app twice and reopen.
   - If mismatch continues, perform a controlled reinstall from TestFlight for propagation before escalating.

4. `eas update` succeeds but Data Health/test update marker is absent
   - Confirm manifest path and branch:
     - `npx eas update:view --platform ios --branch production --id <latest-update-id>`
   - Confirm app launched after publish and after restart.
   - If still absent, temporarily review previous known-good update in `.ai/HANDOFF.md` and confirm whether runtime changed unexpectedly.

5. Native behavior changed by mistake after publish
   - Immediately stop the lane and document in handoff:
     - “possible regression: native-required behavior changed”
   - Capture reproduction notes and revert to previous published OTA only for same-source class fixes.
   - For true native code/module changes, request explicit native-build lane before any new publish attempt.

6. Access/permissions errors while uploading
   - Do not retry in a tight loop.
   - Validate project/session once:
     - `npx eas whoami`
     - `npx eas project:info --json`
   - If still blocked, confirm App Store Connect credentials (if needed), then try again after clearing local CLI cache/session context.

7. Conflicting or stale handoff metadata
   - If the handoff file has stale IDs, update it immediately from verified readback.
   - Add a short note:
     - “earlier IDs stale due handoff, do not re-run older update IDs”
   - Keep only latest published `group`, latest iOS `update`, and runtime for the active lane.

If any step is unclear or blocked:
- Stop OTA progression.
- Make the smallest possible handoff note with current branch, branch list, last known-good update ID, and exact command output errors.
- Resume only after explicit confirmation of required lane (OTA vs native build).

## User delivery preference — September 11, 2026

- After a verified V2 JavaScript, TypeScript, styling, or bundled-asset change, publish an iOS OTA to the current TestFlight app by default. Skip publication only when the user explicitly says not to publish or when the change requires a new native build; in the latter case, explain that boundary instead of publishing an incompatible update.

## Equalize Home screen card gaps and margins OTA — September 11, 2026

- Published the verified Home screen card spacing equalization to the current V2 TestFlight app on iOS `production`, runtime `2.0.0-watch.4`, with message `Equalize Home screen card gaps and margins`.
- EAS group `4ac2dafd-6991-49ad-8f12-8340bee36245`; iOS update `01a09354-ca71-7c4c-8913-fb90d5cdce77`. Production branch readback via `eas update:list` and `eas update:view` confirmed this group is the newest active production update.
- Cold-launch the app once or twice in TestFlight to ensure update propagation and verify spacing on an iPhone.
- No native build, staging, commit, or Git push was performed.

## Equalize Home screen card gaps and margins — September 11, 2026 (implementation)

- User requested that all circled gaps on the iPhone Home screen match the exact same distance:
  1. Card left screen margin: `paddingHorizontal: 16` (reduced from `24` in `approvedHomeContent`).
  2. Card right screen margin: `paddingHorizontal: 16` (reduced from `24` in `approvedHomeContent`).
  3. Vertical gap between Start Journey portal card and Latest memory card: `gap: 16` (standardized from `12` in `homeRecorderStack` and `14` in `approvedHomePanels`).
  4. Vertical gap between Latest memory card and Latest song played card: `gap: 16` (in `approvedHomePanels`).
  5. Bottom gap between the bottom card and the native bottom tab bar: `paddingBottom: insets.bottom + 16` (adjusted from `insets.bottom + 28` in `approvedHomeContent` ScrollView).
- Consolidated Home and Journey header and default memory artwork with `<JourneyImage>` per shared image hardening.
- Reconciled `tests/tab-runtime.test.mts` assertions to match the current implementation.
- Files changed:
  - `mobile/recorder/src/shell.tsx`: Home card padding, vertical panel gap, scrollview bottom inset, and header image hardening.
  - `mobile/recorder/App.tsx`: Standardized `homeRecorderStack` gap to 16pt.
  - `mobile/recorder/tests/tab-runtime.test.mts`: Synchronized header image and first-run/navigation test assertions.
- Verification passed:
  - TypeScript (`tsc --noEmit`): 0 errors.
  - Complete test suite: 555/555 passing (`npm test` in `mobile/recorder`).
  - Standalone Expo iOS export: 2,503 modules, 77 assets (`.cache/gap-export`).
- Next steps / physical review:
  - Cold-launch the TestFlight app on iPhone to verify that all 5 circled spacing dimensions match at 16pt.
  - Validate scroll-to-bottom resting gap above the native tab bar.

## Shared image loading polish — September 11, 2026 (source only)

- Added a focused `JourneyImage` surface over the existing Expo Image dependency. Every migrated bitmap keeps a theme-colored painted frame while loading, uses a source-specific recycling identity and memory/disk caching, checks the persistent disk cache before choosing whether to animate, and crossfades only a newly loaded remote image. Bundled/local and already displayed or disk-cached images appear immediately; Reduce Motion disables the fade. Stale cache checks cannot replace a newer source.
- Migrated shared phone/iPad header layers, the Home and journey-detail header imagery, Soundtracks album carousel, phone/iPad Music artwork, iPad Home soundtrack covers, and default Memory artwork including the iPad Home fallback. The carousel retains its saved lower-resolution thumbnail while an upgraded Apple CDN cover loads or falls back; existing failure recovery, card depth/press motion, user photos, accessibility labels, responsive dimensions, theme resolution, and Memory flip readiness remain intact.
- Added focused rendering/structural regression coverage for cache identity and disk hits, one-time fades, Reduce Motion, failed images, interrupted source changes, all-theme Memory identity, narrow/resized dimensions, header layers, album thumbnail fallback, and each migrated surface. Verification passed: focused image/layout/theme tests 69/69; TypeScript; complete mobile suite 554/554; iOS Expo export with 2,503 modules and 77 assets at `mobile/recorder/.cache/shared-image-export`; `git diff --check` (line-ending notices only).
- Native review remains cold/warm image loading and rapid theme switching on iPhone/iPad, especially offline HQ album fallback, Memories defaults, Dynamic Type, rotation, and narrow Split View. No dependency, OTA, native build, stage, commit, or Git push was performed.
- Published the combined shared-image and ripple-resilience source to the iOS `production` channel for runtime `2.0.0-watch.4`: group `1e35a170-f2e8-4309-8930-d90754e4ed86`, update `01a091f6-5295-7d98-ac74-f830f9c75558`, message `Harden ripple and image loading`. Server readback confirmed the branch, runtime, platform, and update ID. No native build, stage, commit, or Git push was performed.

## Theme water-ripple resilience — September 11, 2026 (source only)

- Preserved the approved Skia water shader and 1,180 ms UI-thread timing while reducing capture pressure. Each transition still takes exactly one whole-window snapshot, now rendered at logical window size and proportionally capped at 1.2 megapixels instead of decoding a Retina-resolution PNG. Capture duration and bounded image dimensions are recorded with the existing privacy-safe diagnostic vocabulary.
- Existing same-theme/duplicate rejection, stable overlay identity, persistence ordering, background/rotation settlement, stale-callback protection, 4.2-second failsafe and Reduce Motion direct path remain intact. Reduce Transparency now changes refraction without cancelling and restarting an in-progress ripple. Temporary capture files are queued for release immediately after overlay teardown rather than held for an extra quarter-second.
- Theme diagnostic events are buffered in memory and written once when the overlay clears (or after a quiet two-second fallback), removing repeated synchronous cache reads/writes from transition startup and playback. Opening Data Health explicitly flushes pending events; event sanitization, 24-hour retention and 80-entry cap are unchanged.
- Added focused coverage for logical/bounded capture sizing, capture options, Reduce Transparency interruption, and batched privacy-safe diagnostics. Verification passed: ripple/diagnostic focused tests 32/32; TypeScript; complete mobile suite 547/547; iOS Expo export with 2,501 modules and 77 assets at `mobile/recorder/.cache/ripple-resilience-export`; `git diff --check` (line-ending notices only). Native review remains repeated paid-theme switching after long Music/Memories sessions on iPhone/iPad, including rapid taps, rotation, background/return, Reduce Motion and Reduce Transparency. No OTA, native build, stage, commit, or Git push was performed.

## Static first-run welcome — September 11, 2026 (source only)

- User selected welcome mockup option 1 and rejected the duplicated-logo treatment in option 5. Replaced the unfinished timed/Reanimated opening with a static first-run welcome: one tintable JourneyDeck emblem, `Welcome to JourneyDeck`, `Every mile has a story.`, one `Start` button, and a small `JOURNEYDECK` wordmark.
- The shared layout uses the active theme palette and theme-specific existing road artwork for Cinematic Dark, Grand Touring, Warm Ivory and Rosewater. It advances only through direct Start activation; there is no timer, autoplay or entrance animation. Safe-area sizing and a bounded 560pt canvas support iPhone and iPad.
- Removed `src/journey-opening.tsx`, its focused animation test, and the obsolete `onboarding-welcome-approved.webp` / poster assets. Added `src/first-run-welcome-screen.tsx` and a focused four-theme activation test; updated the first-run integration and runtime assertions.
- Verification passed: focused welcome 1/1, tab runtime 31/31, TypeScript, complete mobile suite 541/541, iOS Expo export with 2,501 modules and 77 assets at `.cache/static-welcome-export`, and `git diff --check` (line-ending notices only). No OTA, native build, stage, commit, or Git push was performed.

## Wide iPad Today’s Soundtrack OTA — September 11, 2026

- Published the verified wide Soundtrack layout to the current V2 TestFlight app on iOS `production` / production environment, runtime `2.0.0-watch.4`, with message `Widen iPad Today's Soundtrack`.
- EAS group `bd05e796-ed8b-4bcd-820a-bc1a00809283`; iOS update `01a09074-7be3-73a5-99f6-7a4935109ffa`. Production branch readback confirmed this group is the newest update.
- Published from detached baseline `6aad3b4` with the already-live production fixes plus the wide Soundtrack source. The unfinished opening animation was excluded. Isolated TypeScript and EAS iOS export passed; EAS bundled 2,501 modules and uploaded no new assets. Main focused tests passed 3/3 and the complete suite passed 541/541 before isolation.
- No native build, TestFlight binary upload, staging, commit, or Git push was performed. Cold-launch up to twice, then inspect Soundtracks in normal iPad landscape/sidebar and narrow Split View.

## Wide iPad Today’s Soundtrack layout — September 11, 2026 (source only)

- Removed the tall two-column Today’s Soundtrack rail from normal iPad landscape. The album carousel now fills a shallow six-column panel, followed by one six-column metric row using exact `2+2+1+1` spans and an analysis row using `3+3` for Top Artists and Listening Time. Listening History remains six columns.
- Narrow Split View and large Dynamic Type retain the existing stacked layout. The carousel component, artwork depth motion, selection/open behavior, data, provider wording and persistence are unchanged.
- Changed `src/ipad-music-screen.tsx` and `tests/ipad-music.test.mts`. Verification passed: focused Music tests 3/3, TypeScript, complete mobile suite 541/541, iOS Expo export with 2,500 modules and 76 assets at `.cache/ipad-music-wide-soundtrack-export`, and `git diff --check` (line-ending notices only). No OTA, native build, stage, commit, or Git push was performed.

## Six-column iPad grid and album-history OTA — September 10, 2026

- Published the shared six-column iPad landscape layout and Soundtracks listening-history Album column to the current V2 TestFlight app on iOS `production` / production environment, runtime `2.0.0-watch.4`, with message `Align iPad layouts and add album history`.
- EAS group `22d654f4-05d9-45dc-9eb4-a93c1afc87fd`; iOS update `01a08e04-7b83-752a-b5c2-61f14d2744f3`. Independent production branch readback confirmed this exact group is the newest production update.
- Published from detached baseline `6aad3b4` with the already-live production fixes plus the verified six-column and album-history source. The unfinished opening animation was excluded. Isolated TypeScript and iOS Expo export passed; EAS bundled 2,501 modules and found no new assets to upload. The main complete suite passed 541/541 before isolation.
- No native build, TestFlight binary upload, staging, commit, or Git push was performed. Cold-launch up to twice, then review Home, Soundtracks, Memories, Statistics and Settings in iPad landscape/sidebar and narrow Split View. Listening History should show a dedicated Album column at table widths and album text beneath the artist when compact.

## Listening-history album column — September 10, 2026 (source only)

- Soundtracks listening history now uses its landscape width for a dedicated Album column between Song / Artist and Journey. Missing album metadata is labeled `Album unavailable`.
- Compact and large-Dynamic-Type rows keep the album directly beneath the artist when the table collapses, and the existing search continues to match album names.
- Changed `src/ipad-music-screen.tsx` and `tests/ipad-music.test.mts`. Verification passed: TypeScript, focused Music tests 3/3, and complete mobile suite 541/541. No OTA, native build, stage, commit, or Git push was performed.

## Shared six-column iPad landscape grid — September 10, 2026 (source only)

- Added one responsive iPad grid model in `src/device-layout.ts`: normal landscape uses six equal tracks with 12pt gutters; narrower effective widths collapse to three, two, or one track for Split View and Dynamic Type.
- Applied whole-track spans across the five primary iPad tabs. Home uses exact metric/widget/song spans and a two-track Start Journey portal; Soundtracks is 2+4 with its four KPIs aligned as 2+2 inside the summary; Memories is 4+2; Settings is 2+4; Statistics now uses exact 4+2 and 2+2+2 compositions instead of fractional flex ratios. The native Apple sidebar remains untouched.
- Added layout IDs and focused assertions for column arithmetic, normal landscape, sidebar-width resizing, large text collapse, and mounted-state preservation. Updated `mobile/recorder/AGENTS.md` so future iPad work preserves the six-column rule.
- Verification passed: TypeScript; focused iPad/Statistics/runtime tests 61/61; complete mobile suite 541/541; final Statistics check 7/7; iOS Expo export at `.cache/ipad-six-column-export-final` (2,500 modules, 76 assets); `git diff --check` reports no whitespace errors beyond existing line-ending notices.
- Physical review remains pending on iPad landscape with the expanded native sidebar, portrait, narrow Split View, rotation, and largest Dynamic Type. No OTA, native build, stage, commit, or Git push was performed for this pass.

## V2 iPad landscape release polish OTA — September 10, 2026

- Published the verified iPad layout pass to the current V2 TestFlight app on iOS `production` / production environment, runtime `2.0.0-watch.4`, with message `Improve iPad landscape layouts`.
- EAS group `7c9f81e9-fe6e-4660-8200-ba68b06c1f16`; iOS update `01a08d8b-37af-7ab6-ab05-523794f00b04`. Independent `update:view` and `update:list` readback confirmed this exact group is the production head.
- Published from detached baseline `6aad3b4` with the already-live theme carousel, iPad header/sidebar/Home changes and iCloud artwork reconciliation plus the new responsive iPad layout files. The unfinished opening animation was excluded. Isolated TypeScript and 78 focused release tests passed; EAS bundled 2,501 modules and uploaded no new assets. The main complete suite passed 541/541 before isolation.
- Temporary release worktree was removed. No native build, TestFlight upload, stage, commit, or Git push was performed. Cold-launch up to twice, then review ordinary landscape/sidebar plus narrow Split View; Settings should keep the three-column layout at normal width and use its horizontal category strip only when the content canvas is narrow.

## V2 iPad landscape release polish — September 10, 2026 (implementation)

- iPad layout acceptance is now an explicit V2 release priority in `mobile/recorder/AGENTS.md`: verify portrait, landscape with Apple's native sidebar, rotation, narrow Split View, and Dynamic Type while preserving the native sidebar.
- Home, Soundtracks, and Memories now choose responsive card/table/panel density from the measured content canvas adjusted for Dynamic Type. Normal landscape retains its richer multi-column layouts; large accessibility text steps down before cards or table content become cramped. Statistics already followed this model and remains unchanged.
- Settings retains the approved three-column allocation at ordinary portrait and landscape widths. Below 680 effective points, including narrow Split View or large accessibility text, its internal category rail becomes an accessible horizontal strip and the selected detail uses the full canvas. The same mounted detail tree and category selection survive resizing.
- Changed `src/device-layout.ts`, `src/ipad-home.tsx`, `src/ipad-music-screen.tsx`, `src/ipad-memories-screen.tsx`, `src/ipad-settings-screen.tsx`, their focused iPad tests, and the mobile subsystem instructions. Verification passed: TypeScript; focused iPad suite 30/30; complete mobile suite 541/541; iOS Expo export at `.cache/ipad-layout-release-audit-20260910` (2,500 modules, 76 assets); `git diff --check` found no whitespace errors beyond existing line-ending notices.
- Physical iPad review remains pending for normal landscape/sidebar, portrait, 1/2 and 1/3 Split View, rotation with a selected Settings category or active search/selection, and largest Dynamic Type. Publication is recorded above; no native build, stage, commit, or Git push was performed.

## Apple artwork/iCloud false-conflict OTA — September 10, 2026

- Published the verified music-metadata reconciliation fix to the current V2 TestFlight app on iOS `production` / production environment, runtime `2.0.0-watch.4`, with message `Resolve iCloud artwork sync conflicts`.
- EAS group `b659acf0-1bc0-40d9-985e-11cc6e775751`; iOS update `01a08d63-425a-70b1-a319-dd2db6100069`. Independent `update:view` and `update:list` readback confirmed this exact group is the production head.
- Published from detached baseline `6aad3b4` with all already-live carousel/iPad changes plus `cloudkit-sync.ts` and `local-store.ts`. Unfinished opening-animation and unrelated dirty work were excluded. Isolated TypeScript and iOS export passed; EAS bundled 2,501 modules and uploaded no new assets. Main complete suite passed 540/540.
- Temporary release worktree was removed. No native build, TestFlight upload, database migration, stage, commit or Git push was performed. Cold-launch up to twice, then tap Sync now on the iPad; the six artwork-only notices should upload and clear. Confirm iPhone sync afterward.

## Apple artwork/iCloud false-conflict fix — September 10, 2026 (source only)

- User's iPad showed six `unversioned_local_conflict` items after artwork recovery, primarily separate “Loser, Baby” playbacks. Cause: the repair correctly marked each playback dirty but `MusicEntry.updatedAt` was always serialized as its original `createdAt`, so CloudKit could not recognize the metadata repair as newer.
- `local-store.ts` now derives a music entry's effective update time from its shared canonical song metadata timestamp without a database migration. `cloudkit-sync.ts` carries that timestamp over the existing deployed `updatedAt` field and automatically keeps a newer local metadata repair queued only when the playback identity is unchanged. Track/artist, journey, source, play time, creation-time or ID differences still use the existing quarantine path.
- After the OTA is published, a normal Sync now pass should replace the older cloud copies, acknowledge the local rows and clear these six notices. No data deletion, CloudKit schema change, native change or database-version change is involved.
- Added focused coverage for the screenshot's newer-artwork case and retained protection for a newer true identity conflict. Verification passed: TypeScript; focused CloudKit/private-library tests 29/29; complete mobile suite 540/540; iOS Expo export at `.cache/cloud-music-reconcile-ios`; `git diff --check` clean apart from existing line-ending notices. No OTA, native build, stage, commit or Git push was performed.

## Large animated iPad Start Journey portal OTA — September 10, 2026

- Published the verified iPad Home portal to the current V2 TestFlight app on iOS `production` / production environment, runtime `2.0.0-watch.4`, with message `Enlarge iPad Start Journey portal`.
- EAS group `2f8fa6b0-b59c-4805-a99e-97a14216e9cb`; iOS update `01a08d4f-e3ae-7035-bb25-1ece2c8255de`. Independent `update:view` and `update:list` readback confirmed this exact group is the production head.
- Published from detached baseline `6aad3b4` with the already-live theme carousel, landscape/sidebar and Settings-column fixes plus the new `App.tsx` and iPad Home/header changes. The unfinished native opening animation and unrelated dirty work were excluded. Isolated TypeScript and iOS export passed; EAS bundled 2,501 modules and uploaded no new assets. The main complete suite passed 539/539 before isolation.
- Temporary release worktree was removed. No native build, TestFlight upload, stage, commit or Git push was performed. Cold-launch up to twice, then review the idle/loading portal in portrait, landscape/sidebar and Split View, along with the transition into recording.

## Large animated iPad Start Journey portal — September 10, 2026 (source only)

- Home on iPad now reuses the existing iPhone `HomeRecorderStartPortal` for idle and startup-loading states. The iPad presentation keeps the existing 236pt width but grows to the 190pt artwork-header height, with the same breathing rings, radial atmosphere/haze, moving light sweep, themed glow, press compression and haptic response.
- The shared iPad header can opt into full-height actions. At widths of 520pt and above the portal reaches the artwork's top and bottom edges; narrow Split View removes that edge extension and stacks safely. The compact portal omits the default helper sentence to protect Dynamic Type space, while real recorder notices can still appear on two lines.
- Existing permission, automatic-recording, active recording, paused and finishing controls are unchanged. The shared motion lifecycle still honors Reduce Motion and backgrounding, and accessibility exposes the same direct Start Journey button with an iPad-specific hint.
- Changed `mobile/recorder/App.tsx`, `src/ipad-home.tsx`, `src/ipad-page-header.tsx`, `tests/ipad-home.test.mts` and `tests/tab-runtime.test.mts`. Verification passed: TypeScript; focused motion/iPad tests 46/46; complete mobile suite 539/539; iOS Expo export at `.cache/ipad-home-start-portal-export`; `git diff --check` found no errors beyond existing line-ending notices. No OTA, native build, stage, commit or Git push was performed.
- Physical iPad review remains pending across all four themes, portrait and landscape with the sidebar, narrow Split View, largest Dynamic Type, Reduce Motion, startup/loading and the transition into active recording.

## iPad Settings column rebalance OTA — September 10, 2026

- Published the verified column rebalance to the current V2 TestFlight app on iOS `production` / production environment, runtime `2.0.0-watch.4`, with message `Rebalance iPad Settings columns`.
- EAS group `1e8d2a90-4162-43a6-8e40-4d94d5b52dd6`; iOS update `01a08d38-1c14-7451-ba12-ca534da3c0b2`. Independent `update:view` and `update:list` readback confirmed this exact group is the production head.
- Published from detached baseline `6aad3b4` with the already-live carousel, landscape-title and native-sidebar fixes plus the new Settings sizing only. Isolated TypeScript and diff checks passed; EAS bundled 2,501 modules and uploaded no new assets. No native build, TestFlight upload, stage, commit, or Git push was performed. Cold-launch up to twice, then physically review the three-column balance in landscape, portrait and Split View.

## iPad Settings column rebalance — September 10, 2026 (source only)

- Reviewed the annotated 1280×890 landscape screenshot. The far-left region is UIKit's native adaptive tab sidebar; Expo Native Tabs provides no supported way to insert JourneyDeck content into its trailing whitespace or change its internal row alignment. It remains untouched for future Duo-style adaptation.
- Rebalanced JourneyDeck's two Settings panes instead: the landscape category rail now uses 33% of its available canvas up to 326pt, versus 26%/286pt previously. At the screenshot's approximate 976pt post-system-sidebar canvas it grows from about 254pt to 322pt, while the Appearance/detail pane gives up the same 68pt. Portrait retains its existing 28%/238pt cap and narrow landscape retains a 206pt floor.
- The wider rail gives category names and account/iCloud summaries more room; the responsive theme carousel continues to size from the remaining detail viewport. Renamed local layout variables to distinguish the app category rail from UIKit's sidebar and kept the corrected padded header width.
- Verification passed: TypeScript; focused iPad and carousel tests 22/22; complete mobile suite 538/538; iOS Expo export with 2,500 modules and 76 assets at `mobile/recorder/.cache/ipad-settings-columns-export`; `git diff --check` found no errors beyond existing line-ending notices. Physical iPad review remains pending. No OTA, native build, stage, commit, or Git push was performed.

## iPad landscape and native sidebar OTA — September 10, 2026

- Published the verified Settings landscape-title correction and iPad-only native translucent scroll-edge policy to the current V2 TestFlight app on iOS `production` / production environment, runtime `2.0.0-watch.4`. Message: `Fix iPad landscape layout and soften native sidebar`.
- EAS group `08494e82-bbbd-4dd8-ad66-6500bd910c8d`; iOS update `01a08d2f-582c-7318-b958-c8ddc16a5fcc`. Independent `update:list` and `update:view` readback confirmed this exact group is the production head.
- Published from a detached baseline `6aad3b4` containing the already-live card carousel plus only `ipad-page-header.tsx`, `ipad-settings-screen.tsx`, and `native-navigation.tsx`, excluding unfinished opening-animation and unrelated dirty work. Isolated TypeScript passed; the main complete mobile suite previously passed 538/538; EAS bundled 2,501 modules and uploaded no new assets. No native build, TestFlight upload, stage, commit, or Git push was performed.
- Physical iPad review remains required because UIKit controls the exact sidebar opacity. Cold-launch up to twice, then verify the Settings title, sidebar leading/trailing positions, light/dark themes, scroll edge versus scrolled content, rotation, Split View, and Duo-style layouts.

## Native iPad sidebar width decision — September 10, 2026

- User asked to make the expanded left native tab sidebar narrower. Apple documents `UITabBarController.Sidebar` width as system-managed and exposes no supported width property; Expo Native Tabs likewise exposes sidebar enablement, not width.
- User explicitly rejected replacing it with a custom rail because that could create future iPhone Duo layout problems. Preserve the native adaptive sidebar and its system-managed width. No sidebar code changed. The separate Settings title fix remains appropriate because it adapts only content beside the native sidebar.

## iPad landscape Settings title fix — September 10, 2026 (source only)

- User screenshot showed the artwork title in the middle Settings column rendering as `SETTING` / `S` when the iPad navigation sidebar was visible in landscape. The Settings column passed its outer width into `IpadPageHeader` even though its ScrollView padding made the actual header narrower.
- `ipad-settings-screen.tsx` now passes the true padded content width. The shared `ipad-page-header.tsx` uses slightly tighter 24pt typography and 16pt horizontal hero padding below 300pt, keeps the decorative uppercase title to one line, and allows bounded iOS fit so larger text cannot orphan the last letter. Normal and wide iPad headers retain their existing 28pt/36pt sizing.
- Added focused coverage in `ipad-home.test.mts`, updated responsive expectations in `ipad-settings.test.mts` and `ipad-music.test.mts`. TypeScript passed; focused iPad tests 11/11; complete mobile suite 538/538; iOS Expo export passed at `.cache/ipad-settings-header-fix`, bundle `index-c1d4c594bdb2fb465d93433ddbbbe384.hbc`. No OTA, native build, stage, commit or push. Landscape device confirmation remains pending.

## Card theme carousel OTA — September 10, 2026

- User explicitly requested delivery to the current V2 TestFlight app. Published iOS to the `production` channel / `production` environment for runtime `2.0.0-watch.4` with message `Add card-based theme carousel`.
- EAS group `799af2c3-187e-4187-9c7c-1201e37b185d`; update `01a08d13-ce7f-7a52-99e7-9a102b07f66b`. `update:view` confirms branch `production`, platform iOS and the expected runtime.
- Publication used a temporary detached worktree at baseline `6aad3b4` containing only `src/theme-picker.tsx` and new `src/theme-picker-model.ts`, preventing unfinished opening-animation changes and test/docs edits from entering the OTA. Production RevenueCat environment loaded successfully. Isolated TypeScript passed and EAS bundled 2,501 modules; no new assets were uploaded. Temporary worktree removed after verification.
- Main V2 working tree remains dirty as recorded below; no staging, commit, Git push, native build or App Store submission. TestFlight users may need up to two cold launches for the update to download and apply.

## Card theme carousel — September 10, 2026 (source only)

- Replaced the Settings theme grid with a horizontally scrolling, center-snapping React Native/Reanimated card carousel based on the licensed `CardsThemeSwitch.swift` interaction reference. The existing TypeScript catalog remains authoritative with stable IDs/order `dark`, `redline`, `light`, `sakura`; existing artwork, palette swatches, names, appearance modes and descriptions populate the cards.
- Scroll position drives only temporary card depth and the animated four-page indicator. A settled snap commits once through the existing `transitionTheme` flow; taps and VoiceOver adjustments commit immediately and center the card. Secure-persistence failure returns to the committed theme and reports the failure. Interrupted drags cancel stale delayed commits.
- Added responsive card geometry for narrow iPhones, iPad and Split View. Center card is full scale/opacity; neighbors remain visible at reduced scale/opacity. Reduce Motion removes scale/lift and animated centering while retaining snapping and selection. Cards are individually accessible radios, plus a coordinate-free adjustable control with complete theme/position/appearance/description announcements. Text is not line-clamped for Dynamic Type.
- Changed `mobile/recorder/src/theme-picker.tsx`, added `src/theme-picker-model.ts`, expanded `tests/premium-themes.test.mts`, and added `tests/theme-picker-carousel.test.mts`. No theme catalog, persistence, recorder ownership, recording state, dependency or native configuration changes.
- Verification: TypeScript passed; focused picker/water tests 20/20; complete mobile suite 537/537; final iOS Expo export succeeded to `.cache/theme-carousel-ios-export-final` with bundle `index-5b8cc57fbd3e7af9905f25da03fcd432.hbc`; `git diff --check` passed (line-ending warnings only). Branch `codex/journeydeck-v2`, HEAD `6aad3b4`. No stage, commit, push, OTA or native build. Native review remains for snap feel, card sizing at largest accessibility text, VoiceOver rotor/adjustment, Reduce Motion, rotation/Split View and water-transition origin.

## Theme decision saved, implementation on hold — September 10, 2026

- User approved Grand Touring as the future default. Free themes: Grand Touring and Warm Ivory. Plus themes: Cinematic Dark and Rosewater.
- User explicitly said to remember this but not change anything yet. Do not implement default or paywall changes until requested. Only this decision note was added; app behavior remains unchanged.

## Selected horizon revision — September 10, 2026

- User chose option 4, requested larger elements and a spinning vinyl sun rising. Created revised mockup .cache/opening-preview/concepts/04-vinyl-horizon.gif (110 frames, 360x680). Enlarged road, record, title and tagline; groove highlights and label rotate during rise. Preview only; native implementation still awaiting design acceptance.

## Five revised opening concepts — September 10, 2026

- User rejected first preview as cluttered; requested five simple GIF layout/motion mockups. Created route, deck, frame, horizon and wordmark concepts in .cache/opening-preview/concepts, each 360x680 with navy/ivory/gold palette. These are design mockups, not application recordings or implemented changes. Await user direction before replacing native opening.

## Opening GIF preview — September 10, 2026

- Created .cache/opening-preview/journeydeck-opening.gif (390x844, 25fps) as a rendered approximation of native opening composition/timings, with extra final hold for looping. Not an iPhone capture; system font/rendering differs. No application changes or deployment.

## Native welcome opening — September 10, 2026 (source only)

- User explicitly requested a new React Native/Expo opening replacing video. Added journey-opening.tsx: native Reanimated CSS route segments/destination dots, memory illustration and music card enter, wordmark/tagline, theme colors, safe areas and Continue. No media dependency or new package/native change. Replaces animated WebP WelcomeAnimation in first-run-onboarding-screen.tsx; other onboarding stages and completion flags unchanged (existing users are not forced through onboarding again).
- Motion pauses in background, completion timer clears/restarts on foreground, latest callback + once guard, Reduce Motion static with manual Continue. 3.2s normal auto handoff. Tests cover lifecycle/skip/latest callback; full529 tests/typecheck pass. Obsolete WebP wiring assertions updated; original assets preserved. Device visual acceptance pending. No OTA/build/Git action.

## V2 scope confirmed — September 10, 2026

- User: V2 is feature complete; only minor fixes and tweaks from now on. Recorded persistent scope in mobile/recorder/AGENTS.md. No application code or deployment changes in this turn. Preserve other ongoing V3/baseline work recorded below.

## V2 feature-complete baseline / V3 worktree — September 10, 2026

- User declared V2 feature complete aside from minor UI tweaks and authorized committing the full current tree as the V3 baseline, then creating `codex/journeydeck-v3` at `C:\Users\patri\JourneyDeckv3`.
- Baseline verification: mobile TypeScript passed; 528/528 tests passed; iOS Expo export passed. `git diff --check` is clean after whitespace cleanup. Gitleaks reports only the known historical false-positive EAS submission ID in commit `eab40a3`; staged content is scanned separately before commit.
- V3’s first planned task is a size-based adaptive layout foundation for iPhone Duo. No Duo implementation has begun.

## iPhone Duo open-book JourneyDeck concept — September 10, 2026

- Researched Apple’s official iPhone Duo open dimensions/display and generated a cinematic JourneyDeck dual-pane UI/product mockup in a partially open book pose.
- Added `docs/design/iphone-duo-open-book/journeydeck-iphone-duo-open-book-v1.png` and closed outer-screen variant `journeydeck-iphone-duo-closed-v1.png` (preview/design artifacts only). No application code, tests, Git staging, commit, or push.

## Statistics cache fix OTA published — September 10, 2026

- User requested OTA to current TestFlight app. Published iOS production / production environment, runtime2.0.0-watch.4 (build23). Group899fffb4-4702-4db7-ab66-3ce41f15748e, update01a08ad1-ff12-7ebe-a169-34c5d584f5e7; message Fix Statistics loading after large iCloud archive restore. channel:view production verified group/runtime. RevenueCat production public key loaded.
- Export succeeded; existing528 tests/typecheck pass. No native change/build/Git action. Device cold launch and Statistics recovery confirmation pending. Preview channel untouched.

## Statistics oversized snapshot fix — September 10, 2026 (source only)

- User screenshot after iCloud restore shows recorder cache value invalid/too large and empty Statistics. Found loadPrimarySectionsData writes full archive details to an unused primary.sections cache; JSON >4,194,304 chars throws after data calculation and prevents return. Removed unused snapshot key/write, retained actual storage and strict cache limit.
- Added executable loader regression with >4MB route detail and throwing cache mock; verifies returned journeys/details/totals. Updated obsolete structural cache assertion. Typecheck and 528/528 tests pass. No OTA/build/commit/push for this fix; installed build23 still needs update.
- Changed primary-sections-data.ts, tests/primary-data-large-archive.test.mts, tests/tab-runtime.test.mts. RevenueCat test purchase reached dashboard, but device paid Atlas access still awaiting confirmation.

## RevenueCat sandbox transaction verified — September 10, 2026

- User reports test-account purchase. Dashboard with Sandbox data enabled shows 1 active subscription and recent JourneyDeck Monthly App Store transaction (Renewal, about one minute old), plus imported older sandbox history. This confirms purchase data reached RevenueCat.
- Customer detail page remained Loading; specific active pro entitlement not independently verified. Ask user to confirm Atlas/paid history unlocked, then test Restore Purchases. No claim of full lifecycle or server notification validation. No code/build changes.

## RevenueCat build 23 verified in TestFlight — September 10, 2026

- EAS build 6b7726a5-c62d-4b5f-bcb8-782dc47b9961 FINISHED; submission dec59cd8-8b57-44a7-aedf-557ae16f02a2 FINISHED.
- Apple submit:status confirms version2.0.0 build23 processing VALID, internal IN_BETA_TESTING, external READY_FOR_BETA_SUBMISSION, runtime2.0.0-watch.4. No external/public release performed.
- Next: install main JourneyDeck build23 via TestFlight and exercise sandbox purchase/restore; verify customer transaction appears in RevenueCat. Device installation and end-to-end billing remain unverified.

## RevenueCat build 23 dispatched — September 10, 2026

- User authorized connect SDK key and prepare TestFlight build. Set public REVENUECAT_PRODUCTION_APPLE_API_KEY in EAS production project @journeydeck/journeydeck. Preview key untouched. Production export passed, existing 527 tests/typecheck passed earlier. Native Watch test requires macOS and runs in EAS post-install.
- Store production build 2.0.0 (23), runtime watch.4, ID 6b7726a5-c62d-4b5f-bcb8-782dc47b9961, uploaded/queued. Main + Watch existing signing credentials used. Source dirty branch codex/journeydeck-v2 HEAD9421e87.
- Scheduled submission dec59cd8-8b57-44a7-aedf-557ae16f02a2 for that exact build, ASC6806502526. Existing EAS submit credentials used. Submission waiting (terminal21811); build and Apple acceptance NOT yet complete. No public App Store release or OTA.
- Follow build:view / submit:view/status; do not duplicate builds. Native runtime compatibility and sandbox device purchase verification still pending.

## RevenueCat products connected — September 10, 2026

- Verified both user-uploaded Apple IAP and App Store Connect API credentials show Valid credentials for production app app064d9747e1, bundle com.journeydeck.recorder. Vendor number empty. No private keys read/uploaded by agent.
- Imported both existing Apple products: monthly prod94126af83c and annual prod88d95ef84d. Both Apple statuses Waiting for Review. Created entitlement pro / JourneyDeck Pro (entl6c9d3f285a) and attached both; dashboard confirmed Products attached successfully.
- No offering created yet. Next: public SDK key configuration in EAS, preview app isolation if testing V2, Apple server notifications and new native build/device verification. No publish/build/Git actions. Browser deliverable is entitlement detail.

## RevenueCat dashboard project created — September 10, 2026

- User has an account but no project. Created JourneyDeck project `a9a220ad` through authenticated Chrome dashboard. Category Navigation; Native Apple and React Native platforms. Skipped suggested test/lifetime products; catalog currently empty.
- Apple app form prepared for `com.journeydeck.recorder`, but save requires an App Store Connect In-App Purchase P8 key, Key ID and Issuer ID. App configuration NOT saved. No credentials accessed/uploaded, public Apple SDK key unavailable, no EAS changes/build/publish.
- Chrome handoff tab is https://app.revenuecat.com/projects/a9a220ad/new-app/app_store with bundle ID populated. User must supply/upload Apple IAP key directly to RevenueCat to continue. Remaining product/key/build work from previous entry still applies.

## RevenueCat preparation — September 10, 2026

- User requested RevenueCat setup. Account/project question pending; no dashboard access/key configured. No OTA/build/submission/Git staging/commit/push performed.
- Installed react-native-purchases 10.9.0. `src/revenuecat.ts` configures optional iOS observer mode (MY_APP/StoreKit2), anonymous identity, no attribution identifiers/diagnostics. `revenuecat-observer.ts` deduplicates historical purchase sync using a Keychain success marker; failures never affect Apple membership. Existing membership bridge starts observer and requests sync on paid reads, completed purchase and explicit restore. Native StoreKit remains verifier and transaction finisher. Existing hook/paywall preserved.
- `app.config.js` uses distinct REVENUECAT_PREVIEW_APPLE_API_KEY / REVENUECAT_PRODUCTION_APPLE_API_KEY (public appl_ keys only, no cross-environment fallback). Missing key disables integration. Native dependency requires new source runtimes preview.9 / watch.4; DO NOT publish to installed preview.8. AGENTS and runtime assertions updated.
- Setup steps appended to mobile/recorder/SUBSCRIPTION_SETUP.md. Privacy draft/worksheet updated for future configured release, not published. Product IDs unchanged; preview App Store products must be checked separately from production.
- Verified TypeScript, 19 targeted purchase tests, full 527/527 tests, iOS export `.cache/revenuecat-preview-20260910`; logs `.cache/revenuecat-tests.log` and `.cache/revenuecat-export.log`. Native compilation and sandbox transactions not verified on Windows.
- Next: resolve user account/project response, connect Apple app/credentials inside RevenueCat, import existing monthly/annual products and attach pro entitlement, set public SDK keys in appropriate EAS environments, review restore behavior/server notifications and privacy disclosures; then new native build and device purchase/restore/renewal/offline acceptance. Existing large dirty tree preserved on codex/journeydeck-v2, HEAD 9421e87.

## Replay / Memory / artwork OTA — September 10, 2026

- User explicitly requested OTA. Published iOS v2-preview, preview environment, runtime 2.0.0-preview.8: `Add immersive journey replay, animated Memory editing and artwork recovery`.
- Group `6c4ecb94-b242-4e3e-afe0-7e85547d37f6`; update `01a08963-36b6-72ff-8d82-5bce8a8c3d92`. Published bundle basename matches validated export `index-998ab42a73da6fafa7f74852e9364d85.hbc`; existing assets reused. Includes pending Apple artwork resolver and one-time repair pass. Prior 524 tests, TypeScript and export passed.
- No production publish/native changes/Git commit or push. Device acceptance pending. Supersedes source-only statuses below.


## Replay stage + animated Memory editing — September 10, 2026 (source only)

- User said earlier replay did not feel richer and explicitly requested concurrent Memory editing work. Root implemented replay; concurrent memory_edit_motion agent implemented Memory editor. No separate user task created.
- Replay: new `journey-replay-stage.tsx` puts 88px album art, 112px timed photo, stop arrival and destination cards directly over the map with transport + tap/VoiceOver progress controls. Prominent Relive this journey action starts a 60-second story (shorter drives remain real time); 1x/4x/12x retained. Bright pulsing position puck/shortest-turn interpolation and faded untravelled route emphasize progress. Camera padding measures the stage; Reduce Motion fits the complete route above it instead of chasing. Exit returns to exploration. Cards/stops/reached markers still derive from the saved timestamp; pause/rewind/restart/background lifecycle retained. Photo display lasts at least four playback seconds at accelerated rates.
- Memory: new `memory-edit-motion.tsx`, integrated in shell Memory editor, separates In this Memory from Add journeys. Selected rows enter in insertion order; removed rows fade while neighbors close gaps. Hidden older memberships retained. Save label gives a 1.2-second check only after awaited save success, with cleanup on edits/background; error/discard/disabled/save boundaries and accepted Memory/Atlas Flip unchanged.
- Tests: new stage theme/media/error/accessibility/loop tests, expanded replay integration includes one-minute completion, new Memory membership/Reduce Motion/pending-save/success tests, updated obsolete structural assertions. Final **524/524 tests**, TypeScript and iOS export pass; earlier diff check passed. Bundle `index-998ab42a73da6fafa7f74852e9364d85.hbc` (6.9 MB), `.cache/replay-memory-motion-preview-20260910`; logs `.cache/replay-memory-motion-tests.log`, `.cache/replay-memory-motion-export.log`.
- No OTA/stage/commit/push/native changes. Branch codex/journeydeck-v2, HEAD9421e87, existing dirty work retained. Bundle also includes pending Apple artwork recovery. Latest published OTA remains group a0b00159-ce78-4cb6-8954-f62b7c3ba529 unless another task publishes. Next: device review of stage/camera framing, movement, large text, Memory list reflow and save check; publish only when requested. Older photos still lack capture time—agent verified createdAt is import time, so no fabricated photo timing added.


## Missing Apple artwork recovery — September 10, 2026 (source only)

- User requested the fix for repeatedly missing Loser, Baby artwork. Live reproduced search failure; direct catalog lookup ID 6789638005 returns correct recording/cover. New `apple-artwork-resolver.ts` first resolves song IDs from trusted Apple URLs, then retains exact title/full-credit search, then searches the lead artist and queries up to five exact-name artist IDs in one bounded catalog lookup (200 limit). Exact track/full-credit matching remains mandatory and original local identity is retained for database enrichment. No hardcoded song IDs in app code.
- Live-tested resolver with screenshot's full Keith David/Blake Roman/Andrew Underberg/Hazbin Hotel/Sam Haft credit and **no saved ID**: artist-catalog fallback retrieved correct Hazbin Hotel cover. Multiple Keith David artist IDs required the bounded batch fallback.
- Current-playback observations now preserve a numeric Apple catalog ID as a canonical Apple song URL when native URL is absent. Apple network allowlist permits only iTunes search/lookup endpoints. Lookup cooldown cache bumped to v2; one-time artwork recovery generation bumped to 2026-09-10.v4 so existing missing images retry after install. Guard profile changes before async enrichment/cache writes.
- Verification: four new resolver tests, updated network-boundary assertion; **519/519 full tests**, TypeScript and iOS preview export pass. Export `.cache/artwork-recovery-preview-20260910`, bundle `index-9e7d0ab1f41716e64fc0974e0bc2c79c.hbc` (6.9 MB). Live resolver returned valid Apple artwork URL. No OTA, native changes, Git staging/commit/push. Branch remains codex/journeydeck-v2; existing dirty work preserved. Next: publish when requested and verify repair on user's phone. Latest OTA remains replay group a0b00159-ce78-4cb6-8954-f62b7c3ba529 unless another task published.


## Artist credits + replay OTA — September 9, 2026

- User explicitly requested OTA publication. Published iOS `v2-preview`, preview environment, runtime `2.0.0-preview.8`, message `Compact artist credits and enrich journey replay`.
- Group `a0b00159-ce78-4cb6-8954-f62b7c3ba529`; update `01a08947-0f26-70f3-a686-3d7095dfadcb`. EAS publication succeeded; bundle matches validated export `index-6dd3f87cf717bea1d465f176041777f4.hbc` (2470 modules). Prior 515 tests, TypeScript and export passed.
- No production publication, native changes, staging, commit or Git push. Native device review pending. Supersedes source-only status below.


## Artist credits + richer journey replay — September 9, 2026 (source only)

- Phone Soundtracks Top tracks artist credits now show first two comma-separated names + remaining count on one line, retaining the full accessibility label and original music identity. New `artist-credit.ts`.
- Existing moving-position marker, traced route and replay clock now reveal song markers, detected stops, photo markers and destination chronologically after playback/scrubbing starts. Overview retains all songs. Timed song/photo cards enter gently; rewind/restart removes future moments; playback pauses on route blur/background. Added adjustable accessibility scrubbing and Reduce Motion camera settling. Journey map keyed by journey identity.
- `journey-replay-model.ts` detects stops only from at least 60 seconds of nearby (30 m) stationary recorded samples, never across >90-second GPS gaps or estimated/missing speed. Photos require valid capture timestamps inside route bounds; display for 90 journey seconds. Failed local photo images are omitted.
- Photo Matching import now preserves selected photo capture time/journey association in profile-scoped **device-only app cache** via `journey-replay-photos.ts`. No PhotoKit asset IDs, raw photo locations, scans, uploads or new permissions added by replay. Existing matched photos can backfill timing by matching again; import dates are never substituted. Only photos in surviving Memories still linked to the journey are eligible. Timing is not synced to another device and may disappear if cache is cleared. No native/schema change.
- Verification: TypeScript, **515/515 full tests**, final focused replay suite (including accessible backward scrub), `git diff --check`, iOS preview export passed. Bundle `index-6dd3f87cf717bea1d465f176041777f4.hbc` (6.9 MB), `.cache/journey-replay-preview-20260909`; logs `.cache/journey-replay-tests.log`, `.cache/journey-replay-export.log`. Added five replay/credit/model/owner/UI tests; adapted iPad music loader for real credit helper.
- Branch `codex/journeydeck-v2`, existing dirty changes preserved. No commit/push/OTA. Next: native review of map marker/media entrances, photo import/backfill, large text/VoiceOver, Reduce Motion and stops with actual recorded GPS. Latest OTA remains artwork/touch group `6085a04c-c018-4930-9bbb-649971e52598` unless another task publishes.


## Artwork + touch feedback OTA — September 9, 2026

- User explicitly requested publishing both pending changes together. Published iOS `v2-preview`, preview environment, runtime `2.0.0-preview.8`, message `Improve album artwork and add consistent touch feedback`.
- Group `6085a04c-c018-4930-9bbb-649971e52598`; update `01a08927-7e6a-7f5e-bfc2-c1bc33c574cf`. Verified `channel:view v2-preview` points to this group. Bundle basename matches validated local export: `index-de8f52987df24b25099beef96698064f.hbc`; EAS uploaded bundle and reused existing assets. Includes 800px Apple artwork/fallback plus shared press, selection and expansion feedback.
- Prior 510 tests, TypeScript and iOS export passed. No native configuration changes or production publish; no Git staging/commit/push. Native device feel/accessibility review remains pending. This publication supersedes the source-only status immediately below.


## Shared touch feedback — September 9, 2026 (source only)

- Added reusable `src/touch-feedback.tsx`: native press/ref forwarding with .97 compression/120-ms release; measured sliding selection background/260 ms; measured expanding section/260 ms. Shared motion preferences stop transform motion for Reduce Motion/background; closed sections disable touch/accessibility immediately while clipping the closing contents.
- Integrated into phone Home/Settings, iPad Home/Settings, phone/iPad Soundtracks, shared Statistics and vehicle/place controls. Sliding highlights: Statistics ranges, iPad Settings categories, vehicle tabs. Expansions: phone/iPad Advanced Support and place details. Existing JourneyCard spring, AlbumCarousel, Memory Flip, Atlas Flip and native menu/navigation behavior preserved.
- Added four mounted shared-control tests plus a fixture for screen tests; adapted existing screen/structural assertions to measured filter wrappers and collapsed-content behavior. `npm run typecheck`, all **510/510 tests**, and preview iOS export passed. `git diff --check` passed (line-ending warnings only).
- Branch remains `codex/journeydeck-v2`, HEAD `9421e87`; all pre-existing dirty work preserved, including concurrent roadmap/handoff updates. No staging/commit/push/OTA. Export `.cache/touch-feedback-preview-20260909`, bundle `index-de8f52987df24b25099beef96698064f.hbc` (6.9 MB), includes pending higher-quality album artwork. Logs `.cache/touch-feedback-tests.log` and `.cache/touch-feedback-export.log`.
- Next: user device check for press cancellation, range selection/wrapping, Settings/category selection, expansion, large text and VoiceOver. Publish to isolated `v2-preview` runtime `2.0.0-preview.8` only when requested; latest published album-carousel OTA remains group `9747587c-fb37-46cc-9160-3879963c9c6c` unless another task has since published.


## Emergency V2.5 iPhone Duo roadmap — September 9, 2026

- User moved foldable-device support out of V3 and requested it as an emergency JourneyDeck V2.5 addition named iPhone Duo support. Added a dedicated V2.5 list with one tightly scoped compatibility feature covering adaptive layouts, fold/unfold continuity, recording, maps, editors, media, accessibility, battery and physical-device gates. V2.5 explicitly must not pull unrelated V3 features forward.
- Renumbered Badges from V3-07 to V3-06, updated the roadmap decision table/source record and integrity assertions. Roadmap/test/handoff only; no implementation, build, OTA, App Store or service change.

## V3 badges roadmap addition — September 9, 2026

- Added badges to the confirmed JourneyDeck V3 feature scope as V3-07. The roadmap covers private, data-backed milestones for journeys, distance, exploration, Memories and music; progress/unlock explanations; backup/restore; privacy; retroactive award decisions; accessibility; and an explicit ban on rewarding unsafe driving or phone interaction while moving.
- Updated the existing V3 roadmap integrity test. Roadmap/test/handoff changes only; no implementation, dependency, build, OTA, App Store or service change.

## Higher-quality carousel artwork — September 9, 2026 (source only)

- User reported pixelated enlarged album covers and requested high-quality downloads. Found iTunes enrichment stores `artworkUrl100`, while native MusicKit currently requests 256x256; a 220-point carousel cover can require 660 physical pixels. Added `src/album-artwork.ts` to request 800x800 for recognized HTTPS Apple mzstatic square-thumbnail URLs at display time, including existing saved history. Larger originals, non-square/unknown URL forms and other providers remain untouched.
- Carousel retains memory/disk caching and uses the saved thumbnail as loading placeholder. If HQ fails, it retries the original; only failure of both shows the note icon. Artwork URL changes recover cleanly; provider destinations and carousel motion are unchanged. No native module/config or stored-data changes.
- Verified public Apple CDN sample downloaded at actual 800x800 (100,229 bytes). TypeScript and **506/506** mobile tests passed, including URL handling and mounted HQ/thumbnail/failure recovery. Local preview iOS Hermes export passed: 2,466 modules, 78 assets, 6.9 MB `index-cb52ea79dc8c2f88ecf8eb4cad64dd69.hbc`, `.cache/album-artwork-preview-20260909`. Diff check passed.
- Existing dirty `codex/journeydeck-v2`, HEAD `9421e87`, preserved. No OTA, native build, Git staging/commit/push or production changes. Next: publish to iOS V2 preview if requested, then check actual user covers and offline fallback. Native sharpness acceptance pending.

## Soundtracks carousel preview OTA published — September 9, 2026

- User authorized "push ota". Published iOS `v2-preview`, EAS environment `preview`, explicit `APP_VARIANT=v2-preview`, runtime `2.0.0-preview.8`, project `ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4`.
- Group `9747587c-fb37-46cc-9160-3879963c9c6c`, update `01a088fd-c0db-7f85-b32e-bc0e6b402602`, message `Add Soundtracks album depth carousel and press feedback`. Dashboard: https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/9747587c-fb37-46cc-9160-3879963c9c6c . Publish export passed with 2,465 modules; bundle basename `index-517100c430dd861f2fe04a58bafdd354.hbc` matches the verified local export. Preceding TypeScript and 504/504 mobile tests apply; no runtime changes this turn.
- EAS readback verifies preview head; production remains group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`, checked before/after. Existing dirty branch `codex/journeydeck-v2`, HEAD `9421e87`, preserved. No Git staging/commit/push, native build or production mutation; publish process finished.
- Next: up to two cold launches of JourneyDeck V2. Data Health should show `01a088fd`; check cover centering/depth, swipe versus tap, app return, rotation, large text and Reduce Motion on device. Native acceptance remains pending.

## Soundtracks album carousel implemented — September 9, 2026 (source only)

- User accepted the preceding Statistics result ("Perfect") and requested centered album depth plus gentle compression before opening. Added shared `mobile/recorder/src/album-carousel.tsx` and `album-carousel-model.ts`, integrated into phone/iPad Soundtracks. Centered cover lifts 8 points; neighbors shrink and turn inward with bounded UI-thread scroll transforms. Native snapping centers first/last entries; press-in compresses to .97 over 120 ms, committed press uses the existing track-opening callback without delay.
- Measured responsive width, stable identity through rotation/refresh, native horizontal virtualization, themed cached artwork/failure fallback, accessible track labels, disabled source behavior, and shared Reduce Motion/focus/activity handling. iPad recent-song paging becomes a carousel containing all recent selections; listening-history paging, source links, journey links and refresh remain intact. Removed obsolete phone album component/styles. Updated motion docs and replaced obsolete fixed-album source assertions with coverage for the new shared carousel.
- Verification: TypeScript passed; full mobile suite **504/504** passed (4 new carousel tests plus existing integration coverage). Diff whitespace check passed with existing CRLF notices. Final preview-configured local iOS Hermes export passed: 2,465 modules, 78 assets, 6.9 MB `index-517100c430dd861f2fe04a58bafdd354.hbc`, `.cache/album-carousel-preview-20260909`. Export process finished.
- Branch `codex/journeydeck-v2`, HEAD `9421e87`, pre-existing dirty work preserved. No OTA, native build, Git staging/commit/push or production mutation. Next: if user requests publishing, target iOS `v2-preview` / environment `preview` / runtime `2.0.0-preview.8`; then check swipe/snapping, first/last covers, quick taps versus drags, music app return, rotation, larger text, VoiceOver and Reduce Motion on device. Native animation feel is not yet accepted.

## Statistics animations preview OTA published — September 9, 2026

- User authorized publishing with "Push to ota". Published iOS only to `v2-preview`, EAS environment `preview`, explicit `APP_VARIANT=v2-preview`, runtime `2.0.0-preview.8`, project `ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4`.
- Group `6f28d092-2114-4245-9e8a-0fffa7ac0328`, iOS update `01a088e7-3bd6-7008-8ed5-b43a7e7b7688`, message `Animate Statistics charts, totals, and day journeys`. Dashboard: https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/6f28d092-2114-4245-9e8a-0fffa7ac0328 . Publish export passed (2,463 modules); bundle basename `index-02460f5687697fd387ef463dbd747b3d.hbc` matches the preceding local export. Prior TypeScript, full 500/500 tests and final targeted 12/12 tests apply; no runtime code changes this turn.
- EAS channel readback verifies the preview head. Production remains group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`, checked before/after. No native build, Git staging/commit/push or production changes; dirty `codex/journeydeck-v2` preserved at `9421e87`.
- Next: up to two cold launches of JourneyDeck V2; Data Health should show `01a088e7`. Native acceptance remains pending for rapid ranges, rolling digits, chart morphs, calendar/day-bar selection, empty/dense days, larger text, rotation and Reduce Motion. Publish process finished.

## Statistics animations implemented — September 9, 2026 (source only)

- User requested Statistics range/value animations and selected-day journey reveals using lessons from Atlas Flip. Added `mobile/recorder/src/statistics-motion.tsx` and `statistics-motion-model.ts`; integrated into the shared phone/iPad Statistics screen. Uses Atlas's morph curve with shared 260-ms everyday timing, animated daily/hourly and distance-band bars, exact-vertex sparkline morphs, measured rolling digits for period/day/secondary totals, native day-content reveal/reflow, and one semantic haptic per changed range/day.
- Shared-value transitions preserve mid-flight position on rapid retargets, settle on Reduce Motion/background/tab blur and cancel on unmount. Initial data renders directly. Final formatted totals remain accessible while decorative digit strips are hidden. Existing native navigation, history gates, themes, data calculations, and accepted Atlas/Memory flips are preserved. Motion documentation updated.
- Verification: TypeScript passed; full mobile suite **500/500** passed, including 5 new mounted/geometry Statistics-motion tests and existing responsive/all-theme Statistics coverage. Final review corrected the hourly chart's nonselectable-bar highlight; both targeted suites passed **12/12** afterward. Targeted diff whitespace check passed (existing CRLF notices only). Latest local `APP_VARIANT=v2-preview` iOS Hermes export passed: 2,463 modules, 78 assets, 6.9 MB bundle `index-02460f5687697fd387ef463dbd747b3d.hbc`, output `.cache/statistics-motion-preview-20260909`.
- Branch `codex/journeydeck-v2`, HEAD `9421e87`; substantial pre-existing dirty work preserved. No staging/commit/push, OTA, native build submission, or production mutation. Export process finished. Next: obtain V2 preview OTA authorization if requested, then physically check rapid range changes, day/bar selection, empty/dense days, More journeys, large text, rotation, Reduce Motion and background/return. Code tests/export do not certify native rendering or animation feel.

## Animation opportunities review — September 9, 2026

- User asked what additional animation work could improve the app. Reviewed mobile motion guidance and current Statistics, Atlas, Soundtracks, Memory, and shared motion implementations; this was an ideas review, not an implementation request.
- Suggested priority: animated Statistics data/range changes, Soundtracks album interactions, and consistent press/selection feedback; possible later work includes additional requested Atlas Flip cards and richer journey replay. Existing route tracing, metric motion, Memory depth, and accepted flips should be extended rather than duplicated.
- Repository remains on `codex/journeydeck-v2`, HEAD `9421e87`, with substantial pre-existing tracked/untracked changes preserved. Inspected status, recent history, diff summary, and relevant Statistics/Soundtracks diffs. No runtime edits or tests, Git staging/commit/push, OTA, or deployment in this review. Next: choose a concrete animation pass before implementation.

## Atlas Flip open-source repository published — September 9, 2026

- User explicitly requested a new public GitHub repository with reusable Atlas Flip code, minimal human instructions, AI-agent guidance, and their supplied recording plus a GIF. Created an independent repository at `C:\Users\patri\Atlas-Flip`, public https://github.com/drumpat01/Atlas-Flip , branch `main`, commit `cef0655`. GitHub author uses the account's no-reply address. No JourneyDeck history, app data, secrets, or backend configuration copied.
- Clean `src/` component preserves the 650/520-ms measured two-face trajectory, actual foreground boundary, modal/readiness handoff, reverse close, Reduce Motion, timeouts/stale callbacks, and lifecycle cancellation. Generic demo uses fictional content, two palettes, floating/full-window modal targets. The app-specific Memory snapshot/native-route adapter is documented but is NOT shipped as part of the public core.
- Published short README, integration/API guide, AGENTS.md, MIT code/docs license, media terms, dependency audit note, 14 regression tests and GitHub Actions. Supplied 6.72s video converted to 60fps H.264 MP4 (1.14 MB) and 20fps looping GIF (4.87 MB); metadata/audio stripped, on-screen user-authorized content retained. Public browser player: https://drumpat01.github.io/Atlas-Flip/ . Pages uses `main:/docs`.
- Verification: TypeScript, 14/14 tests, Expo dependency check, iOS (956 modules) and Android (954 modules) Hermes exports passed. GitHub Check run `34419417304` and Pages deployment `34419432191` succeeded. Anonymous browser verified public README/GIF dimensions and video playback through 0:06. Both media files fully decoded with FFmpeg. `npm audit` has 10 moderate transitive Expo/xcode/uuid entries, no high/critical; documented, no incompatible forced SDK downgrade. Standalone native extraction has no physical device acceptance yet.
- JourneyDeck runtime unchanged; only handoff/motion documentation updated here. Existing dirty `codex/journeydeck-v2` work preserved at HEAD `9421e87`; no JourneyDeck staging/commit/push, EAS update, native build, or production change. Tool-only FFmpeg wheel installed under ignored `.cache/atlas-media-tools`.
- User's preceding "Oh it worked!!! Everything looks so good" accepts the latest preview Statistics sizing/order and Memory Flip implementation (group `003eaa50-29fd-48f5-a34d-aca2d5192a0c`); supersedes acceptance-pending notes below. This is not blanket acceptance of every device/theme or of the standalone extraction. Next: work on public Atlas Flip in its own folder; test copied integrations on a device before claiming identical rendering.

## Statistics / Atlas sizing / Memory Flip preview OTA published — September 9, 2026

- User explicitly authorized publishing the preceding source-only work ("Push to ota"). Used the EAS Update skill and published only iOS `v2-preview`, EAS environment `preview`, explicit `APP_VARIANT=v2-preview`, runtime `2.0.0-preview.8`, project `ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4`.
- Update group `003eaa50-29fd-48f5-a34d-aca2d5192a0c`, iOS update `01a08882-7678-7230-9ba5-b9d8979c9d90`, message `Reorder Statistics, align Atlas cards, and trial Memory Flip`. Dashboard: https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/003eaa50-29fd-48f5-a34d-aca2d5192a0c . Publish-time export passed (2,461 modules; bundle `index-c817c0a2ca210fce455928c892f8202d.hbc` matches the verified local export); prior TypeScript and 495/495 tests remain applicable, no runtime source changes this turn.
- Independent EAS readback confirms this is the preview head. Production was checked before and after and remains group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. No native build/submission, Git staging/commit/push, or production mutation. Existing dirty work preserved at HEAD `9421e87`.
- Next: up to two cold launches of the V2 preview app; Data Health should show `01a08882`. Physical device acceptance of the resized Atlas cards and new Memory opening/full-screen handoff is still pending. Follow the device checks in the implementation milestone below; the previously approved Driving Rhythms baseline is not a blanket acceptance of the new Memory trial.

## Statistics order, equal Atlas cards, and full-screen Memory Flip — September 9, 2026 (source only)

- Implemented the user's request to exchange Atlas and Year on the Road on the shared phone/iPad Statistics page. Atlas is now the first feature card, Year on the Road follows the statistics. Both use the same themed card styling; existing Atlas/paywall and recap callbacks are retained.
- Standardized all four Atlas insight cards with identical unpadded equal-width cells and a common height measured from the tallest intrinsic content. Content can shrink after rotation/text-size changes without a stretch-measure feedback loop. Driving Rhythms' footer remains at the bottom. Its approved timing, foreground isolation, measured-source geometry and modal handoff are unchanged; the moving duplicate does not report grid measurements.
- Added `mobile/recorder/src/memory-flip.tsx` and connected Memory-card taps through `card-detail-link.tsx` and the native stack. This is a Memory-only opening trial using the approved Atlas Flip curve/geometry to reach the entire window. The front uses a temporary local card-only snapshot to preserve loaded photos; the full real Memory detail page travels on the reverse. Start waits for modal presentation and loaded front/hero images, with one haptic and no white pressed state. At completion, the normal native Memory route mounts underneath without a second entrance; the overlay remains until destination layout and hero readiness. Normal back gesture, editing/sharing, photo matching, and nested journeys remain native. Closing an already-open Memory is still the ordinary native back transition, not a new reverse flip.
- Added duplicate/stale/capture/error/background/rotation safeguards and temporary capture cleanup. No new native dependency, config, persistence, network, recorder, or desktop changes. Documented the adaptation as **not yet device accepted** in `mobile/recorder/docs/motion.md`.
- Verification: TypeScript passed; full mobile suite **495/495** passed (new Memory Flip lifecycle, four-theme/full-screen geometry, real Slot/context-menu composition, native destination readiness, Statistics order, and equal Atlas grid tests); targeted diff whitespace check passed with existing CRLF notices only. Latest preview-configured iOS Hermes export passed: 2,461 modules, 78 assets, 6.9 MB bundle, `.cache/memory-flip-preview-20260909`, bundle `index-c817c0a2ca210fce455928c892f8202d.hbc`.
- Branch `codex/journeydeck-v2`, HEAD `9421e87`; pre-existing dirty work preserved. **No OTA, build service submission, staging, commit, push, or production mutation in this task.** Ask for/receive V2 preview OTA publish authorization before publishing this new trial. Then test a photo-backed and default-art Memory on-device: tap delay, full flip, final handoff, native back, nested journey return, edit/share, Reduce Motion, and all themes. Also verify the resized Driving Rhythms opening/closing. Prior device acceptance of Driving Rhythms does not certify this new Memory adaptation.

## Atlas Flip accepted and saved for reuse — September 9, 2026

- The user confirmed the latest Driving Rhythms fix on their iPhone ("yes finally!") and then explicitly asked to remember the animation for repeated reuse. This closes the original device-acceptance item below for update `01a08811-7731-7aab-9890-35e8a61968f2` / group `4d0924ae-eb06-40c3-b25f-1ec1e0f87550`; it does not imply every theme/device combination was physically tested.
- Saved the canonical **Atlas Flip** pattern in `mobile/recorder/docs/motion.md`, including exact timing/curve/geometry, source handoff, required native foreground boundary, theme behavior, accessibility, known failed approaches, reference functions, tests, and accepted OTA provenance. Added a discoverable instruction in `mobile/recorder/AGENTS.md` to consult and reuse it for future requested widgets.
- Documentation-only milestone: runtime code and OTA unchanged. Branch remains `codex/journeydeck-v2`, HEAD `9421e87`; existing dirty work preserved. Previous implementation verification remains 483/483 tests plus TypeScript/iOS export. No new tests needed for documentation, no commit/push/deploy. Next: reuse the approved pattern when the user selects another widget, preserving the current Driving Rhythms behavior.

## Driving Rhythms rollback and layer isolation OTA — September 9, 2026

- The user rejected update `01a08802-1003-79fe-b979-81a0d0134c02` as worse and authorized reverting that attempt and trying again. Removed its simplified front colors/glyph/bars, mid-animation `display` switch, empty rotating shell, separate late details fade, and dark backdrop override. Restored the complete compact/expanded faces and the approved continuous 650-ms open / 520-ms close path. The earlier moving duplicate's outline suppression remains; other widgets are unchanged.
- Corrected the prior diagnosis: Skia/SVG/gradient tile explanations below were hypotheses, not proven causes. Reinspection of the supplied 15:58 recording shows a uniformly tinted half-card switching sides with rotation, consistent with the backdrop intersecting the receding half of a 3D sibling. Both rotating faces now sit inside an untransformed native foreground `View` with `collapsable={false}` and `zIndex: 1`, keeping their scene separate from the backdrop. Full chart details move with the reverse face. Opacity stays clamped, with no per-frame layout changes or new rasterization.
- Fixed an independently verified lifecycle error: the source was hidden as soon as React mounted the modal, while UIKit presentation completed later. The installed RN 0.86.3 native source emits `onShow` after presentation completion. The source now stays visible until that event; the flip and one soft haptic start there. Opening, invalid measurements, and duplicate close requests are guarded.
- Verification: seven new mounted-component tests cover modal readiness, single haptic, repeated taps, interrupted closing, source restoration, all four themed card faces, a retained native foreground boundary, continuous centers/sizes and valid opacity throughout the flip, and Reduce Motion. TypeScript, tab-runtime 31/31, and full mobile suite 483/483 passed. Preview iOS export passed (2,460 modules, 78 assets); the preview-environment publish export also passed. These checks do not verify Core Animation pixels or physical animation feel; device acceptance remains pending.
- Published only to iOS `v2-preview`, environment `preview`, runtime `2.0.0-preview.8`: group `4d0924ae-eb06-40c3-b25f-1ec1e0f87550`, update `01a08811-7731-7aab-9890-35e8a61968f2`, message `Restore Rhythm flip and isolate backdrop`. Independent readback confirms preview head; production remains `880f20d3-c0ee-4435-b887-b725515536ac`. Branch is still `codex/journeydeck-v2`, HEAD `9421e87`, with the pre-existing dirty worktree preserved. No staging, commit, push, native build, or production deployment. Next: cold-launch V2 Build 11 up to twice and verify the initial tap plus both halves of opening/closing on the phone; do not label the visual defect resolved before that confirmation.

## Driving Rhythms native-compositing removal OTA — September 9, 2026

- Frame-sampled the user's third 8.4-second, roughly 60-fps Rosewater device recording and corrected the earlier incomplete diagnosis. Two independent artifacts remained: the themed modal backdrop was translating the dark scrim into translucent white on light themes, producing the immediate tap flash; and native gradient/SVG/symbol descendants were still being transformed in 3D, producing a rectangular vertical haze as iOS flattened the expanded card near the end of the flip.
- The modal now uses an explicit dark translucent scrim on light themes. Only flat React Native surfaces are transformed: the moving compact face suppresses Skia, native gradients and the SF Symbol while using the theme's real card color and simple View-rendered bars; it is removed from composition just past the midpoint. The moving reverse face is now an empty themed shell. The real chart, heat map, symbols and details stay untransformed at their final geometry and fade in over the shell from 82–100% progress. The approved 650-ms open, 520-ms close, UI-thread easing and haptic remain intact.
- Verification passed: TypeScript; tab-runtime 31/31; complete mobile suite 476/476; preview-configured iOS Hermes export with 2,460 modules, 78 assets and a 6.8 MB bundle. Published only to iOS `v2-preview`, runtime `2.0.0-preview.8`: group `68ca413a-75c3-46d4-b54f-ce39ea1d5d50`, update `01a08802-1003-79fe-b979-81a0d0134c02`, message `Eliminate Driving Rhythms white compositing`. Independent readback confirms it is the preview head; production remains group `880f20d3-c0ee-4435-b887-b725515536ac`. No native build, TestFlight/App Store action, CloudKit change, staging, commit, push, or production OTA occurred. Physical device acceptance remains required.

## Driving Rhythms white-flash removal OTA — September 9, 2026

- Removed the two white flashes visible in the Rosewater device test without changing the approved motion or haptic. Root cause was the animated compact-face duplicate mounting its own Skia `NeonWidgetOutline`; that native drawing surface could briefly clear white when created at tap and again while its transformed layer finished compositing. `AtlasInsightShell` now supports suppressing only that outline, and the moving duplicate uses the ordinary themed card border/gradient without a Skia canvas. Resting Atlas widgets retain their normal neon outline.
- Verification passed: TypeScript; tab-runtime 31/31; complete mobile suite 476/476; preview-configured iOS Hermes export with 2,460 modules, 78 assets and a 6.8 MB bundle. Published only to iOS `v2-preview`, runtime `2.0.0-preview.8`: group `65eff723-3c1e-475c-887f-d241d6f26613`, update `01a087f5-044f-7c12-a2b6-77e522656693`, message `Remove Driving Rhythms transition flash`. Independent readback confirms it is the preview head; production remains group `880f20d3-c0ee-4435-b887-b725515536ac`. No native build, TestFlight/App Store action, CloudKit change, staging, commit, push, or production OTA occurred. Physical device acceptance remains required.

## Continuous Driving Rhythms morph-path OTA — September 9, 2026

- Frame-sampled the user's second 119.98-fps device recording and confirmed that the remaining pop was the face handoff itself: the outgoing compact face completed its center movement before the midpoint while the incoming expanded face restarted at the compact source center, and their displayed heights did not match. Closing exposed the same discontinuity in reverse; its old exit curve also accelerated into the last frame.
- Rebuilt the transform math so both faces share one continuous center and displayed-size trajectory for the entire animation. The compact face scales from its measured source bounds toward the expanded bounds while the expanded face uses the exact inverse ratios; both occupy the same geometry at the 90-degree midpoint. Opening remains 650 ms, closing is now 520 ms, and both directions use the prescribed `Easing.bezier(0.77, 0, 0.175, 1)` on the UI thread. Reduce Motion remains a short fade/scale.
- Verification passed: TypeScript; tab-runtime 31/31; complete mobile suite 476/476; preview-configured iOS Hermes export with 2,460 modules, 78 assets and a 6.8 MB bundle. Published only to iOS `v2-preview`, runtime `2.0.0-preview.8`: group `c3dc806a-719e-441a-ba44-5f0efc20f211`, update `01a087ed-121a-7c07-959f-bd2bd8f63660`, message `Smooth Driving Rhythms morph path`. Independent readback confirms it is the preview head; production remains group `880f20d3-c0ee-4435-b887-b725515536ac`. No native build, TestFlight/App Store action, CloudKit change, staging, commit, push, or production OTA occurred. Physical acceptance remains required because animation feel can only be verified on the release device.

## Driving Rhythms flip timing polish OTA — September 9, 2026

- Slowed the normal-motion Driving Rhythms opening transition from 430 ms to 650 ms while preserving the short Reduce Motion path. Removed the visible close-end swap by extracting one exact compact widget face and reusing it for both the resting card and animated front; the resting source stays hidden until modal teardown. Added hidden back faces and guarded duplicate dismissals so overlapping close requests cannot restart the reversal.
- Verification passed: TypeScript; tab-runtime 31/31; complete mobile suite 476/476; preview-configured iOS Hermes export with 2,460 modules, 78 assets and a 6.8 MB bundle; `git diff --check` with existing CRLF notices only.
- Published only to iOS `v2-preview`, runtime `2.0.0-preview.8`: group `6112069f-ed96-446b-bb44-eeb5352ef79d`, update `01a087e1-149a-7a9f-9064-1d75efec506c`, message `Polish Driving Rhythms flip timing`. Independent readback confirms it is the preview head; production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. No native build, TestFlight/App Store action, CloudKit change, staging, commit, push, or production OTA occurred. Physical acceptance should cold-launch Build 11 up to twice, then confirm the slower open and seamless return to the compact card.

## Expanded Atlas Driving Rhythms flip-card OTA — September 9, 2026

- Made only the compact Driving Rhythms Atlas widget interactive. A tap measures its on-screen frame, lifts its front face into a standard transparent modal, moves/scales it toward center while rotating through a UI-thread Reanimated Y-axis flip, then reveals a large reverse face. Closing reverses the same spatial transition; Reduce Motion receives a short fade/scale instead, and opening emits one restrained soft haptic.
- The expanded view implements the approved combined concept from real selected-window data: a 12-segment two-hour radial activity clock, Monday–Sunday 12-column heatmap, journey/mileage/average-duration metrics, and a data-derived leading-day/daypart insight. Rosewater uses mauve-plum `#79566F` for secondary activity instead of green; every other theme resolves through its own active palette. Other Atlas widgets and MapLibre remain unchanged.
- Verification passed: TypeScript; targeted Atlas/local Atlas; tab-runtime 31/31; motion 3/3; haptics 3/3; theme/Atlas/premium group 18/18; complete mobile suite 476/476; preview-configured iOS Hermes export with 2,460 modules, 78 assets and a 6.8 MB bundle; `git diff --check` with existing CRLF notices only.
- Published only to iOS `v2-preview`, runtime `2.0.0-preview.8`: group `65db38a4-3a03-4b41-a6a7-b845fb4b72ae`, update `01a087d6-1ff9-7397-8b90-072af5aa5afd`, message `Add expanded Driving Rhythms flip card`. Independent readback confirms it is preview head; production remains group `880f20d3-c0ee-4435-b887-b725515536ac`. No native build, TestFlight/App Store action, CloudKit change, staging, commit, push, or production OTA occurred. Physical acceptance should check opening/closing alignment, midpoint face swap, scroll containment, all four themes, Dynamic Type, and Reduce Motion.

## V2 preview Atlas test unlock — September 9, 2026

- Unlocked only `atlasAccess` for the side-by-side JourneyDeck V2 EAS identity through an app-config feature flag. StoreKit tier remains truthful, the free 45-day history boundary remains in force, and Tessie plus every other paid capability remain locked. Production resolves the flag false.
- Verification passed: TypeScript; tab-runtime 31/31; membership 11/11; theme/navigation 15/15; Atlas/local-Atlas 7/7 plus 13 checks; preview-configured iOS Hermes export with 2,460 modules, 78 assets and a 6.8 MB bundle. Public preflight reached only the expected missing App Store Privacy Policy and Support URL environment checks.
- Published only to iOS `v2-preview`, runtime `2.0.0-preview.8`: group `33f1a0af-5382-403d-b52a-28449ec07c7b`, update `01a087a8-6421-7c57-869b-99222aee0cce`, message `Unlock Atlas in V2 preview`. Independent readback confirms it is the preview head; production remains group `880f20d3-c0ee-4435-b887-b725515536ac` on runtime `2.0.0-watch.3`. No native build, TestFlight/App Store action, CloudKit change, staging, commit, push, or production OTA occurred.

## Confirmed JourneyDeck V3 additions — September 9, 2026 (roadmap only)

- Added a dedicated confirmed V3 scope section to the product roadmap. Alongside Tessie/vehicle intelligence, V3 now explicitly includes Live Activities with Dynamic Island, a limited safety-constrained CarPlay companion, one new red-led theme, one separate green-led theme, and foldable iPhone support.
- Dynamic Island now has explicit compact/minimal/expanded presentation scope rather than appearing only as a Live Activity detail. Foldable support is a separate adaptive-layout/continuity target covering recording, navigation, maps, replay, editors, Memories and media; exact breakpoints, hinge geometry, safe areas and posture behavior must wait for shipping hardware and public Apple SDK guidance rather than relying on guessed dimensions.
- CarPlay remains scoped as a driver-safe companion rather than the full dashboard, with entitlement/template/real-vehicle gates. The theme concepts remain intentionally unnamed, but each requires its own stable ID, full visual system, map/art/icon treatment and accessibility validation; neither may replace an existing stored theme or collapse into Grand Touring's Racing Green accent.
- Public-release-integrity passes 11/11 with assertions locking the V3 additions and the no-speculation foldable boundary to the roadmap. No implementation, native configuration, OTA/build, staging, commit, push, TestFlight, App Store, preview, or production mutation was performed.

## Remove replay battery and defer Tessie to V3 — September 9, 2026 (source only)

- Removed the Battery tile from Journey Replay and rebalanced the telemetry row to two equal Speed/Journey cells without a trailing divider. Replaced the Tessie-adjacent `recorded vehicle telemetry` footnote with `recorded journey location and speed`; stored historical battery fields remain in the compatibility/data model but are no longer presented by replay.
- Updated the V2 roadmap, mobile handbook, release gate comment, and dormant Tessie error copy to make the product boundary explicit: Tessie connection, live vehicle data, charging intelligence, entitlements, onboarding, Settings and replay integration are deferred to JourneyDeck V3. `TESSIE_INTEGRATION_ENABLED` remains hard-disabled; dormant code was preserved only as compatibility/reference surface.
- Verification passed: TypeScript; tab-runtime 31/31; public-release-integrity 11/11; route-moments 7/7. No OTA/native build, staging, commit, push, TestFlight, App Store, CloudKit, preview, or production mutation was performed after this change. The latest preview OTA remains `01a086b5`, which predates this source-only adjustment.

## Build 11 replay/Soundtracks/theme-animation preview OTA — September 9, 2026

- Published the complete current JavaScript/style/asset bundle to the isolated iOS `v2-preview` channel with the explicit preview app variant and EAS `preview` environment. Runtime is `2.0.0-preview.8`; update group `2cac3e44-e275-46e8-8c9b-9a2fa39fc628`, iOS update `01a086b5-06ae-7871-89f2-7f68d85a1fe2`, message `Polish journey replay, Soundtracks, and theme animation`, dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/2cac3e44-e275-46e8-8c9b-9a2fa39fc628`.
- This OTA contains the latest stable-modal theme animation, the horizontal journey replay timeline/control polish and distinct themed endpoints, and the iPhone Soundtracks content-order swap. A stale delight assertion requiring the deliberately removed diagonal `RouteTraceMoment` was updated to require the horizontal timeline.
- Verification passed before publish: TypeScript; targeted tab-runtime 31/31 and premium-theme 4/4; complete mobile suite 475/475; preview-configured iOS Hermes export with 2,460 modules, 78 assets and a 6.8 MB bundle at `.cache/ota-preview-ui-20260909`. Independent EAS readback confirms the new group is the `v2-preview` head for iOS/runtime `2.0.0-preview.8`.
- Production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. No native/EAS build, TestFlight/App Store action, CloudKit change, Git staging, commit, push, or production OTA was performed. Build 11 may require up to two cold launches; Data Health should show short update ID `01a086b5`.

## Soundtracks content order — September 9, 2026 (source only)

- Swapped the iPhone Soundtracks dashboard order so `Today's soundtrack` now appears immediately after the music-source guidance and before the four summary metric cards. Top Artists and the remainder of the archive retain their existing order. The responsive iPad composition already placed Today's Soundtrack before/alongside its summary area and was left unchanged.
- Updated the structural layout assertion. Verification passed: TypeScript and tab-runtime 31/31. No OTA/native build, staging, commit, push, TestFlight, App Store, or production change was performed.

## Journey replay card layout and endpoint colors — September 9, 2026 (source only)

- Replaced the replay card's duplicate geographic `RouteTraceMoment` (which appeared as a diagonal route line) with a single labeled, horizontal, scrub-enabled Journey Progress timeline. The timeline shows start/end clocks, percentage complete, and fixed semantic start/end markers, keeping it visually distinct from the live 3D MapLibre replay above.
- Regrouped restart/play into one transport cluster and the 1×/4×/12× choices into a labeled Replay Speed cluster with aligned sizing, a divider, selected-state accessibility, and theme-aware action contrast.
- Fixed map endpoints and their legend swatches across all four themes by resolving start/end as separate semantic accent colors at render time instead of passing them through the generic surface-color translator, which had collapsed both colors in Rosewater and Grand Touring.
- Verification passed: TypeScript; tab-runtime 31/31; premium-theme 4/4; targeted `git diff --check` with only existing LF→CRLF notices. No physical-device visual acceptance, OTA/native build, staging, commit, push, CloudKit, TestFlight, App Store, or production change was performed.

## Build 11 SVG-modal water transition replacement — September 9, 2026

- Replaced the physically crashing `FullWindowOverlay` + Skia screenshot surface identified by DIAG-11. The active theme path now presents a standard transparent React Native `Modal` and renders the captured old screen through a `react-native-svg` luminance mask. UI-thread Reanimated circles erase the old screenshot from the pressed theme swatch outward, revealing the real new theme underneath; offset soft rings and a restrained accent crest create the water/glass edge. Reduce Motion still bypasses spatial animation, Reduce Transparency uses a sharp mask with a solid crest, and duplicate/background/stale/unmount paths remain contained.
- The temporary `captureScreen` file is retained only while the SVG image is mounted, released after overlay teardown, and also released immediately if an in-flight capture becomes stale. Removed the obsolete theme-only Skia shader module, shader test, and review-render script. Skia remains elsewhere for route moments and was not removed from the app.
- Added a mounted native-boundary integration test that drives modal show, SVG image load, theme commit, UI-thread completion, and unmount. Verification passed: TypeScript; focused transition/session/geometry/diagnostics tests **27/27**; complete current mobile suite **474/474**; `git diff --check` with existing CRLF notices only; and clean preview-profile production-mode iOS Hermes export (2,459 modules, 78 assets, 6.8 MB) at `.cache/theme-svg-modal-preview-export`.
- Published only to internal Build 11's iOS `v2-preview` branch with the explicit preview environment, runtime `2.0.0-preview.8`: group `fdae4226-c787-48d2-a324-a011f910671d`, iOS update `01a08652-c906-73fa-ad09-01d631552437`, message `Replace crashing theme overlay with SVG modal`, dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/fdae4226-c787-48d2-a324-a011f910671d`. Independent readback confirms this is the preview head and production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`.
- No EAS/native build, TestFlight upload, App Store mutation, production OTA, CloudKit change, Git staging, commit, or push was performed. Branch remains `codex/journeydeck-v2` at HEAD `9421e87`, with the authoritative dirty checkout preserved. Physical acceptance remains: cold-launch Build 11 up to twice, confirm Data Health short update ID `01a08652`, then switch themes. If it still closes or the effect fails, capture a fresh DIAG-11 report; the replacement emits `renderer=svg_modal` breadcrumbs.

## Build 11 local theme-animation diagnostics — September 9, 2026

- Physical Build 11 DIAG-11 report on update `01a08637` captured two reproductions: Sakura→Redline at `12:54:25Z` and Redline→Light at `12:54:32Z`. Both persisted the selection, allowed animation, completed `captureScreen` in about 140 ms, decoded a valid 1320×2868 Skia image, released the temporary file, and emitted `cover_requested`. Neither emitted `overlay_ready`, `theme_apply_start`, `theme_committed`, `theme_painted`, `water_started`, or `water_finished`; Expo logs show a fresh `AppController sharedInstance created` roughly two seconds after each `cover_requested`, with no local JavaScript fatal error. This proves the termination occurs while React Native commits/renders the `FullWindowOverlay` + Skia image surface, before theme application or shader animation. The capture/decode path itself is healthy. Do not ship this overlay architecture to production; replace the native overlay presentation path or add a still-narrower mount breadcrumb only if needed.
- At the user's request, added a small privacy-safe local breadcrumb recorder around the water-theme path. DIAG-11 records the ordered stages for request/persistence, animation eligibility, native full-window capture, Skia decode, temporary-file release, overlay request/readiness, live-theme commit/paint, shader start/finish, fallback and interruption. It records only allowlisted event names, theme IDs, booleans, integer dimensions/duration and sanitized error types; it never stores touch coordinates, screenshot paths/content or raw error messages. The bounded last-80-event cache expires after 24 hours, is not uploaded automatically, and is included only when the user presses Read update logs.
- Added `theme-animation-diagnostics-format.ts` and `theme-animation-diagnostics.ts`, instrumented `theme-water-transition.tsx`, and upgraded the Settings report from DIAG-10 to DIAG-11. Diagnostic writes are best-effort and contained; the screenshot temporary file is still released immediately. Verification passes: TypeScript, focused animation/diagnostics **30/30**, complete suite **477/477**, `git diff --check` with existing CRLF notices only, and preview iOS Hermes export (2,459 modules, 78 assets, 6.8 MB) at `.cache/theme-animation-diag11-preview-export`.
- Published the verified diagnostic source to iOS `v2-preview`, runtime `2.0.0-preview.8`: group `a45eba4d-1763-4a00-95d5-10ea8e163645`, update `01a08637-2379-7282-93ef-5f88347694fe`, message `Add local theme animation diagnostics`, dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/a45eba4d-1763-4a00-95d5-10ea8e163645`. Server readback confirms it is the newest preview update and compatible with Build 11.
- An immediately preceding publish omitted the local preview-variant environment and created group `a692c005-76a9-4208-825f-0976c85b12a0`, update `01a08636-0bd7-7761-89bc-1a5ac2462fb7`, on the `v2-preview` branch with runtime `2.0.0-watch.3`. Build 11 cannot receive that incompatible runtime, so it did not affect the installed preview app. Production itself remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. No native build, TestFlight/App Store action, production OTA, Git staging, commit or push was performed.

## Water theme transition crash repair — September 9, 2026

- The user confirmed that Build 11 closed whenever a theme was selected on preview update `01a08610`; reopening showed the newly persisted theme. Root cause was the first operation after persistence: Skia `makeImageFromView(rootRef)` resolves a legacy React view tag on iOS and calls `RCTFatal` when that tag is unavailable under Fabric/New Architecture. Aggregate EAS Update launch health did not expose this interaction crash.
- Removed the unsafe tagged-view capture path and the second snapshot. The repaired flow uses `react-native-view-shot`'s whole-window `captureScreen` before mounting `FullWindowOverlay`, normalizes its temporary path to a `file://` URI for Skia decoding, and releases the temporary PNG immediately. The old screen is the shader overlay while the live new theme is committed underneath; the expanding refracted wave makes the old layer transparent and reveals the real new UI. Capture/decode failure now falls back to a direct theme change instead of terminating the process. A regression test forbids `makeImageFromView` in this transition.
- Reduce Motion still applies directly; Reduce Transparency removes refraction/glass lighting. Backgrounding, viewport changes, timeout, duplicate presses, StrictMode replay, stale callbacks and unmount remain contained. No new dependency or native/runtime change was required.
- Verification passes: TypeScript; complete current mobile suite **476/476**, including 24 water-session/shader/hook tests; production-style and `v2-preview` iOS Hermes exports (2,457 modules, 78 assets, 6.8 MB); `git diff --check` with existing CRLF notices only. Exports are `.cache/theme-water-crashfix-production-export` and `.cache/theme-water-crashfix-preview-export`. No paid simulator was started, so physical animation acceptance remains with the user.
- Published the crash repair only to iOS `v2-preview`, runtime `2.0.0-preview.8`, message `Fix water theme reveal crash`: group `e807dca2-0927-4952-896b-dd045a59909f`, iOS update `01a08629-7a52-7708-8c12-e743a4a80591`, dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/e807dca2-0927-4952-896b-dd045a59909f`. Server readback confirms it is the preview head. Production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. No EAS/native build, TestFlight/App Store action, production OTA, Git staging, commit or push was performed.
- Branch remains `codex/journeydeck-v2`, HEAD `9421e87`; the large authoritative dirty checkout and unrelated work are preserved. Build 11 may need up to two cold launches to activate short update ID `01a08629`. Respect the user's cost control: do not create a full build or automatically start a paid simulator.

## EAS Simulator live animation/artwork review — September 8, 2026

- Follow-up live validation found the complementary status-bar assertion: with the required view-controller setting enabled, legacy `react-native`/`expo-status-bar` components attempted the incompatible application-level API. Removed all duplicate imperative status-bar components from `App.tsx`, `src/shell.tsx`, `src/first-run-onboarding-screen.tsx`, and `src/year-on-road.tsx`; the native navigator is now the single status-bar owner. This is JS-only: TypeScript and app-theme 8/8 pass, no legacy status-bar component references remain in `App.tsx`/`src`, and the live overlay was dismissed and verified absent without another build.
- At the user's explicit request, reused corrected build `b87c6a17-30ca-4489-9d53-b141c874d8b8` without submitting a build. Session `01a082f0-5ead-737a-9531-1b6e6b00b6ca` is capped at 15 minutes with a 5-minute idle timeout; Metro watch mode runs on port 8087. The live session receives the current consolidated working-tree JS/assets through Metro. Stop both after review if not already auto-ended.
- Fixed the recurring iOS development redbox assertion from `RNSScreenWindowTraits`: JourneyDeck dynamically sets native-stack/status-bar styles, so Expo Router requires `UIViewControllerBasedStatusBarAppearance = YES`. Added the value to the generated iOS Info.plist configuration and an app-theme regression assertion. Focused app-theme suite passes 8/8, resolved simulator config reports the value as `true`, and `git diff --check` has only existing line-ending warnings.
- Corrected simulator build `b87c6a17-30ca-4489-9d53-b141c874d8b8` finished successfully (fingerprint `95006c4fa3bda7b18d8105e2ab7710f17b84de02`; artifact `https://expo.dev/artifacts/eas/W0OPiFPseMpprex1pBuA66eYGKLA0ynFLF7pzlir0So.tar.gz`). Per the user's explicit cost-control instruction, do not start a simulator or submit another build automatically. The prior session and Metro were stopped before this build.
- Added a dedicated `development-simulator` EAS profile and allowed that profile through the app-config release-identity guard. It remains on the existing JourneyDeck production identity/runtime and enables a development client with Fast Refresh; `.env.eas-simulator` is ignored.
- Initial simulator build `684195f2-fd02-4199-8f9e-bc9732022201` failed before native compilation because the profile was not yet in the app-config allowlist. After the focused correction, native-capability tests pass 3/3 and simulator config resolves successfully. Simulator build `3244067a-3bf0-4306-9b81-6fbe95b4b23e` finished successfully (fingerprint `09eba0ee8ed364fa589ecb54b571c9f91bf3c1cd`).
- Metro is running with watch mode and an EAS tunnel on local port 8087. Remote iPhone 17 session `01a082d5-029f-7be0-b515-db2a6c863c08`, named `Animation and artwork review`, is live with a 30-minute maximum. JourneyDeck attached to the live bundle and is foregrounded on onboarding step 02/04. Stop the session and Metro after review if they have not auto-ended; do not expose the session token from `.env.eas-simulator`.

## Complete Grand Touring photography refresh — September 8, 2026 (production OTA published)

- Expanded the Grand Touring refresh from two to all seven routed artwork roles. Added Rainy Midnight to Home, The Night Journey to Journey/time-of-day fallbacks, the Racing Green Porsche detail to Memories/Memory fallback, Grand Tour at Night to Statistics, and Touring Blue Garage to the shared road/header fallback. The previously selected turntable and monochrome engine remain Soundtracks and Settings.
- All seven app assets preserve existing filenames and 1536×1024 PNG contracts. The built-in image editing workflow reframed the licensed photos and applied the shared Midnight Navy/Touring Blue/Champagne/Cool Chrome/British Racing Green treatment. Updated Pexels/Unsplash provenance and expanded regression checks to cover dimensions for the entire seven-image set. Premium theme tests pass 4/4, tab runtime passes 31/31, TypeScript passes, complete mobile suite passes 438/438, and `git diff --check` reports no whitespace errors (only the existing handoff line-ending warning). Production-style iOS Hermes export passed with 2,448 modules and 78 assets.
- User explicitly authorized OTA publication. Published the exact prebuilt export to iOS `production`, runtime `2.0.0-watch.3`: update group `7da52c3b-dade-4a3e-bb7f-52b86e2230c2`, iOS update `01a081bb-2a58-76bb-8f13-d8fb261ea4e9`, message `Refresh Grand Touring palette and photography`. EAS uploaded one app bundle and seven changed assets, reused 72, and server readback confirmed this group is the current production head. No native build, TestFlight action, Git staging, commit, or push was performed; native-only working-tree changes are not delivered by OTA.

## Grand Touring Soundtracks and Settings photography — September 8, 2026

- Replaced only the Grand Touring Soundtracks and Settings artwork, preserving their existing bundle names and routing. Soundtracks now uses Wilson Lee's moody turntable photograph (Pexels #10138317); Settings uses Jean Marc Bonnel's monochrome classic-engine photograph (Pexels #19227069). Both are 1536×1024 app-ready derivatives with a restrained navy/champagne/chrome grade; Settings includes a subtle British Racing Green body surface.
- Recorded both Pexels sources and creator credits in `assets/PHOTOGRAPHY-LICENSES.md` and added exact dimension regression checks. No other theme artwork was changed. Premium theme tests pass 4/4, TypeScript passes, and `git diff --check` reports no whitespace errors (only the existing handoff line-ending warning). No publication, build, staging, commit, or push was performed.

## Grand Touring sixth color — September 8, 2026

- Added British Racing Green (`#2f6b57`) as Grand Touring's sixth presentation swatch. The canonical order is now Midnight Navy, Touring Blue, Champagne, Warm Ivory, Cool Chrome, British Racing Green; the description now names racing green.
- Preserved the existing accessible semantic foreground colors because the exact racing green does not meet text contrast requirements on the navy surfaces. Added an exact-order regression assertion in `premium-themes.test.mts`.

## Cinematic active-route cleanup and Polaroid Memories — September 8, 2026 (production OTA published)

- Audited the actual Expo Router surface: five tabs plus Atlas, Journey/Memory detail, editors, Tools and Year on the Road. Live and Recorder are part of Home, and Timeline is no longer a route. Removed the dedicated Cinematic Live, standalone Recorder and Timeline photos plus their three orphaned light-theme counterparts. Dormant legacy component references now reuse existing Home/Statistics art, so no dead page artwork is bundled.
- Replaced both bright film-strip images with darker Pexels Polaroid photography: Yuqi Chen's tabletop instant-camera composition for the Memories header and Lindsey Garrett's scattered travel Polaroids for Memory fallbacks. Updated the central theme registry, phone/iPad/recap consumers, exact-source tests and `assets/PHOTOGRAPHY-LICENSES.md`.
- Artwork verification passed: current TypeScript; the two exact theme/active-route regression checks **2/2**; production-style iOS Hermes export (2,448 modules, **78 assets**, 6.8 MB bundle). The Journey-map hint contract was reconciled during the later 3D replay work, and the current full suite passes **438/438** with `tab-runtime` **31/31**. The prior export had 84 assets; the six obsolete dark/light page images are absent. Updated graded review sheet: `.cache/cinematic-artwork-audit/implemented-cinematic-contact-sheet.jpg`.
- Published together with the 3D Journey replay to iOS `production`, runtime `2.0.0-watch.3`: update group `8df688ad-d8da-431d-baf4-8573fd883e98`, iOS update `01a08167-c1f7-7bd8-8618-bed41072f9fe`, message `Polish Cinematic artwork and add 3D Journey replay`. EAS uploaded one app bundle and two changed assets, reused 77 assets, and server readback confirmed this exact group is the production head. No native build, TestFlight action, Git staging, commit or push was performed; branch/HEAD and unrelated changes remain preserved.

## Cinematic licensed-photography replacement — September 7, 2026 (production OTA published)

- Replaced the 16 generated Cinematic-theme road, header, fallback, statistics and membership images with bundled photography selected for each destination. Fifteen images use the Pexels License and the Earth membership image is NASA/StockSnap CC0; `mobile/recorder/assets/PHOTOGRAPHY-LICENSES.md` records every creator, source page and license. The superseded Cinematic assets were removed after confirming no source or test references remained. Other theme and onboarding artwork was not changed.
- Added a dark-only shared plum/black photography grade in `src/header-artwork.tsx`, with matching treatment on direct Home and Memory surfaces. Updated the central theme-image registry, phone/iPad screens, membership, recap and exact-source regression assertions. The new source set is 5.20 MiB versus 17.63 MiB for the retired set, reducing bundled artwork by about 12.43 MiB.
- Verification passed: TypeScript; focused theme/runtime/release suite **46/46**; full mobile suite **437/437**; production-style iOS Hermes export (2,454 modules, 84 assets, 6.8 MB bundle) containing all 16 new photos and none of the removed Cinematic files. A graded review sheet is in `.cache/cinematic-artwork-audit/implemented-cinematic-contact-sheet.jpg`.
- User explicitly authorized publication. EAS uploaded one app bundle and 16 new photo assets, reused 69 assets, and published to the iOS `production` branch on runtime `2.0.0-watch.3`: update group **`7da6dc66-0d54-4865-ab53-159313ec4321`**, iOS update **`01a07f3d-61f8-799f-a390-9304652acf1f`**, message `Replace Cinematic AI art with licensed photography`. Server readback confirms this exact update is the current production channel head. No native build, TestFlight action, Git staging, commit or push was performed. Branch remains `codex/journeydeck-v2`, HEAD `9421e87`, and unrelated pre-existing changes remain preserved. Next: review Cinematic on a device, adjust any specific crop/photo if requested, then move to Warm Ivory one theme at a time.

## Explicit SQLite startup gate — September 7, 2026 (production OTA published)

- Replaced import-time synchronous opening of `journeydeck-local.db` with one cached `openDatabaseAsync` owner and a single-flight startup coordinator shared by foreground UI and Expo background location tasks. `DatabaseStartupGate` now blocks the theme provider, screens, CloudKit-backed work and recorder services until connection hardening, transactional migrations, recorder initialization, identity initialization and SQLite `quick_check(1)` succeed. The only separate handle is the existing one-time read-only legacy-recorder import.
- Deferred Local Atlas, recorder storage and Journey Studio database access so static module evaluation cannot open the live archive. Synchronous repository APIs require the already-open controlled handle; schema changes and existing multi-row critical writes remain transactional. CloudKit code/schema were not changed and it remains the private sync layer.
- Added a non-destructive loading/recovery screen with `DB-LOCKED`, `DB-INTEGRITY`, `DB-NEWER-SCHEMA` and `DB-STARTUP` classifications. Retry reuses the same archive and never deletes/recreates data. Design and device acceptance checklist: `mobile/recorder/docs/sqlite-startup-architecture-2026-09-07.md`.
- Verification passed: TypeScript; focused startup/database-hardening 11/11; local store 17/17; Atlas 13/13; recorder/recovery 11/11; full mobile suite **437/437**; production-style iOS Hermes export (2,454 modules, 84 listed assets, 6.8 MB bundle); `git diff --check` with existing line-ending warnings only. User then explicitly authorized production OTA publication. EAS published and server readback verified production's newest iOS group **`5641758f-1235-4d2e-a183-1875ea589c96`**, update **`01a07ef8-a1db-7929-84c6-433ee6e0eb4c`**, runtime **`2.0.0-watch.3`**, message `Gate SQLite startup and add safe recovery`. Device tests remain for real lock/reload concurrency, historical/corrupt archives, background wake and two-device CloudKit. No native build, TestFlight submission, schema deployment, Git staging, commit or push was performed; branch/HEAD and the intentionally dirty tree remain preserved.

## DIAG-10 SQLite OTA restart recovery — September 7, 2026 (corrective OTA published)

- The device report for soundtrack OTA `01a07ebc-ef9a-7685-83f9-8fece3928b35` proved a startup database-lock crash in `initializeLocalStore`: `PRAGMA journal_mode = WAL` ran synchronously before any busy timeout, while the outgoing OTA runtime could still briefly hold the SQLite database during `reloadAsync`. Expo correctly marked that update's launch failed, removed it and fell back to embedded Build 22. All 85 update assets downloaded successfully; the older `KeyboardImpl` entries are historical and unrelated. The failure occurred during connection setup before an application-data mutation, so there is no evidence of data corruption or loss.
- Hardened startup in `src/database-hardening.ts` and `src/local-store.ts`: install a 15-second SQLite busy timeout first, read the existing journal mode without mutation, set WAL only when needed, then apply the remaining connection pragmas. Added regression coverage proving an already-WAL launch avoids a lock-taking WAL write and a fresh database configures the busy timeout before WAL.
- Verification passed: database-hardening 7/7, local-store 17/17, TypeScript, and the complete mobile suite **433/433** with zero failures/skips. The EAS iOS export also completed successfully (2,451 modules; 85 EAS assets).
- Published and server-verified the corrective iOS OTA on `production`, runtime `2.0.0-watch.3`: update group **`3e262654-1700-4950-b198-f8fa344ae40b`**, iOS update **`01a07ec6-330a-76cc-a010-fd3823434603`**, message `Prevent SQLite lock crash during OTA restart`. This is now the production channel head and supersedes the failed soundtrack OTA while retaining its Year recap soundtrack features. No native build, TestFlight submission, Git staging, commit or push was performed; the intentionally dirty tree remains preserved.

## Year recap soundtrack OTA — September 7, 2026 (published)

- User explicitly authorized the OTA. Published the tested Year on the Road touch-audio continuity fix, independent soundtrack picker, and four original theme scores to the iOS `production` branch for TestFlight Build 22 runtime **`2.0.0-watch.3`**.
- EAS update group **`8538f82e-2179-405d-9939-af37578ffeec`**, iOS update **`01a07ebc-ef9a-7685-83f9-8fece3928b35`**, message `Keep Year recap music playing and add theme soundtracks`. Upload contained one app bundle and five new audio assets, reusing 80 assets.
- Production channel server readback confirms its current head is that exact iOS update, runtime `2.0.0-watch.3`, environment/branch `production`, with all five expected WAV assets in the manifest. Pre-publish verification remains TypeScript, focused recap 23/23, full suite 431/431 and iOS Hermes export. No native build, TestFlight submission, Git staging, commit or push was performed; the intentionally dirty tree remains preserved.

## Year recap soundtrack update — September 7, 2026 (implemented, unpublished)

- Fixed the reported Year on the Road interruption: touch/scroll still holds the ten-second chapter timer, but no longer pauses or restarts the looping score. Explicit Pause, app backgrounding, recording/Shazam ownership and Sound off still stop audio as intended.
- Added a soundtrack chooser separate from the recap appearance chooser. Sound initially follows recap appearance; a manual score choice remains independent across theme changes until **Match recap appearance** is selected. Four original upbeat deterministic scores are bundled: **Midnight Velocity** (Cinematic Dark, 116 BPM), **Sunlit Coast** (Warm Ivory, 108 BPM), **Champagne Apex** (Grand Touring, 124 BPM), and **Petal Rush** (Rosewater, 120 BPM). Live switching starts the replacement loop before releasing the old one and preserves the chapter chime.
- Changed `src/year-on-road{,-audio,-score}.ts*`, added `src/year-on-road-music.ts`, four PCM WAV assets, focused component/audio/asset tests, and updated `docs/year-on-road-2026-09-07.md`. TypeScript passed; focused recap suite 23/23; full mobile suite **431/431**; local iOS Hermes export passed with all five required audio assets (2,451 modules, 6.7 MB bundle). The temporary export was removed. `git diff --check` has no whitespace errors (existing CRLF warnings only).
- Physical device testing still needs audible quality, seamless loops, live score changes, touch/scroll continuity, Bluetooth/headphones/interruptions, recorder/Shazam exclusion, VoiceOver/Reduce Motion and iPhone/iPad layouts. No OTA, build, TestFlight action, Git staging, commit or push was performed. Branch remains `codex/journeydeck-v2`, HEAD `9421e87`, with the pre-existing intentionally dirty working tree preserved.

## Stories native build / TestFlight — September 7, 2026 (available)

- User explicitly authorized the new native build, then TestFlight publication. Production EAS **Build22** `d2bec584-7978-41a0-93e2-c80deeda53a4` **FINISHED** successfully, runtime `2.0.0-watch.3`, iPhone/iPad plus paired Watch. Exact-build TestFlight submission `9f7555e7-b144-4613-9072-95e770e5b54e` **FINISHED**. Apple build `c62e8da5-2e66-48aa-8594-072475b11596` readback confirms **2.0.0 (22), VALID, IN_BETA_TESTING**, not expired. Same existing identity/signing credentials; no OTA or Git actions.
- Build20 `2571a253-f0dd-4b78-a3e2-f0e87003facc` failed during Swift compilation after380s: `PHPhotoLibrary` had no member `presentLimitedLibraryPicker` because the extension's PhotosUI import was omitted. Added `import PhotosUI` and the PhotosUI pod framework, plus regression assertions; checked against Apple's limited-library documentation. Combined suite still428/428. Build21 contains that correction and the additive CloudKit schema artifact; upload7s. Pass the Build21 ID explicitly to cached helpers (their default ID still points to the failed attempt).
- Build21 failed at the recorder's `withCheckedContinuation` generic inference (line814). Added explicit `CheckedContinuation<Void, Never>` to the existing mutation; focused recorder/recovery tests pass, and Build22 now passes the actual Swift/Xcode archive. Build22 upload8s, native job473s. Both failed attempts were not submitted.
- Evidence/helpers live in root `.cache/stories-native-release/`: `status.cjs`, `download.cjs`, `inspect-ipa.py`, and `submission-status.cjs` take explicit IDs. `ipa-verification-22.json` confirms signed data/keychain/iCloud identity equals Build19, runtimewatch.3, phone/tablet families, pairedWatch22, PhotoKit/Audio/icon/CloudKit native modules, preserved microphone purpose, no background audio or sensitive-content entitlement, all three alternate icons and seven exact artwork/audio assets. Archive comparison matched302 native/runtime/artwork/audio inputs exactly. Gitleaks found one false positive spanning two verified empty lines in `web.env.example`; no unresolved secret finding.
- User completed CloudKit Console sign-in. Added **only JourneyEdit** with eight application fields to Development, removed the UI's automatic `_icloud` public-create grant, and reviewed the deployment diff: one added type, zero indexes, only new-type `_creator`/`_world` grants matching existing types. Production deployment succeeded and production readback shows JourneyEdit14fields with every existing type preserved. No library records were queried, changed or deleted. Checked-in schema and contract check match. Physical two-device sync remains unverified.
- Initial submission with `--what-to-test` was rejected before scheduling because EAS gates its changelog upload to Enterprise; retry without that flag scheduled successfully. The existing saved production ASC key was then used in memory with Apple's BetaBuildLocalization API to save/read back the exact en-US `what-to-test.txt` notes. `apple-build.cjs 22 --set-notes` is idempotent and `apple-build22.json` records successful notes/status verification. No credentials were printed or written to disk.
- Release is complete for internal TestFlight; no public App Store or external beta review was submitted. Next: user installs **22 on both iPhone and iPad** and checks upgrade-over19 preservation, trim/split/smoke/save/restore, free full/limited Photos matching, Plus recap themes/sound, purchases and real two-device edit sync. Native compilation and schema deployment are now verified; physical-device acceptance remains explicitly pending in `mobile/recorder/docs/stories-studio-2026-09-07.md`.

## Stories & Studio — September 7, 2026 (implemented, unpublished)

- Implemented the user's three requested features in `mobile/recorder`: **Journey Studio** (Plus trim/split with live themed map/handles, smoke dissolve, review/save and free original restoration); **Automatic Photo Matching** (free, explicit Photos permission, time/location suggestions, review/import and duplicate-safe retries); **Your Year on the Road** (Plus, eight animated chapters, complete local archive, original opt-in music/chimes, independent recap theme choice). All four themes and responsive phone/tablet layouts are wired to actual routes: Journey detail → Trim & split, Memory detail → Find matching photos, Statistics → Your Year on the Road.
- Consolidated scope, evidence and device/release checklist: `mobile/recorder/docs/stories-studio-2026-09-07.md`; sibling `journey-editor-data-2026-09-07.md`, `automatic-photo-matching-2026-09-07.md`, and `year-on-road-2026-09-07.md` hold subsystem contracts. README links the consolidated report. Existing audit and visual/icon/Settings/map changes remain preserved; branch `codex/journeydeck-v2`, HEAD `9421e87`, intentionally dirty. No staging, commit, Git push, OTA, EAS native build, TestFlight submission or production CloudKit schema deployment was performed.
- New native requirements: local PhotoKit Expo module, `expo-audio ~57.0.4`, revised CloudKit transport/private-content capability 4. Source is isolated to public runtime **`2.0.0-watch.3`**, preview **`2.0.0-preview.8`**, with additive editor **schema 7**. This supersedes the prior audit's keep-schema-6 note only for the new runtime. Never publish this combined tree to Build19/watch.2 or offer a schema-6 bundle as its rollback. Existing installed/published releases remain unchanged.
- Editor immutable operations preserve exact originals, including cached boundary GPS fixes; atomic SQLite projection updates retain independent Memory changes and outside song history. Stale/profile/recording/paid guards, retired-ID protection, legacy-cache isolation, late-song remapping and explicit sync conflict resolution are implemented. `JourneyEdit` assets use a separate private CloudKit zone; production record schema and real two-device behavior still require acceptance. Old builds retain their previous ordinary journey views and cannot delete the new editor zone. Upgrade participating devices for consistent edit/account-deletion behavior.
- Photos: bounded scans, limited authorization, hidden/screenshot exclusion, no unsolicited iCloud image download, metadata-stripped selected JPEG copies, owner/deletion fences and review-only import. Optional Apple nudity detection is coded but **no sensitive-content entitlement was enabled**; normal fallback is time/location plus manual review. Recap audio is opt-in, guarded during recording, and avoids Expo's shared-session deactivation that could interrupt Shazam. No new background audio or microphone permission request.
- Final verification: **428/428 combined mobile tests**, no failures/skips; TypeScript passes. Editor/private-sync/schema/cloud focused suite **42/42**, photo **13/13**, recap **20/20**, archive loader **3/3**; required individual subsystem scripts pass. Local iOS Hermes export passes at `mobile/recorder/.cache/stories-ios-export`, bundle `index-bf35590ee8be6eab59b7a0c689e1f92c.hbc` (6.7MB). Logs `.cache/stories-{test,typecheck,export}.log`. Native config introspection confirms watch.3, intended Photos purpose, preserved Shazam microphone purpose, fetch/location only, no SCA entitlement. Autolinking discovers Expo Audio and JourneyDeckPhotoLibrary. `git diff --check` passes.
- Remaining before release: authorized native compile/build, production `JourneyEdit` schema verification/deployment, install-over19 data preservation, real StoreKit/PhotoKit/audio and two-device CloudKit acceptance, iPhone/iPad appearance/frame rate/rotation/VoiceOver/Reduce Motion, Watch/Shazam audio races and low-storage/cancellation tests. Swift source has not been compiled on this Windows host; mocked UI tests do not prove physical visuals or performance. All three feature agents finished; no additional implementation is delegated.

## Release reliability audit — September 7, 2026 (unpublished)

- User requested actual-code audit, reproductions, fixes and testing across startup/OTA, recording/Watch, local data/iCloud, purchases/access and UI lifecycle. **Do not publish an OTA or create a native build.** No EAS publish/build/submit, migration, staging, commit or Git push was performed. Existing dirty visual/icon/Settings/map work is preserved on `codex/journeydeck-v2`, HEAD `9421e87`.
- Consolidated evidence and physical acceptance checklist: `mobile/recorder/docs/release-reliability-audit-2026-09-07.md`; four sibling `reliability-{recording,data-sync,purchases,ui}-2026-09-07.md` reports contain subsystem detail. Root startup/Memory fixes were independently reviewed. Data/recorder cross-review caught two additional gaps, both reproduced and corrected: missing Journey dependencies now defer before conflict comparison, and an uncertain dispatched cloud deletion retains the persistent pause.
- JS fixes: safe optional update restart with fresh local/native idle checks; single-flight persisted recorder identity and foreground retry after Keychain failure; paused/reliable/expected-session recovery; Memory editor delta saves preserve hidden/concurrent journey links and reject tombstone resurrection; native inbox ordering/gap replay/exact acknowledgement; completion-job lease fencing; 150k-point archive maximum-speed stack fix; exact-content sync acknowledgements and dirty conflict preservation; serialized/profile-fenced iCloud sync and persistent deletion pause; purchase response ordering/verified unlock; late gesture callbacks and tray resize cancellation.
- Native source fixes: queue-atomic matching-session Pause/Resume and committed-state GPS reconciliation; priority export of an existing master session amid a large native backlog; CloudKit per-record failures retain cursor and photo/route assets use immutable content hashes. **Swift is uncompiled on Windows and these changes need a future authorized native build plus devices.** Existing binary wrappers remain additive/fallback-compatible; do not claim the old binary has atomic controls or new CloudKit behavior.
- Final verification after cross-review: combined suite **371/371**, zero failures/skips; TypeScript and `git diff --check` passed. All 14 required individual subsystem test scripts passed. Final local production iOS Hermes export passed (2,417 modules, `index-f6eb4a38f1e693c2388000f408e4fdf7.hbc`) at `mobile/recorder/.cache/reliability-audit-export`. This is local bundle validation, not a native build or deployment. Logs: `mobile/recorder/.cache/reliability-*.log`. Audit agents are finished; no audit test/export process remains after final polling.
- Remaining: music sync has no durable edit version (createdAt is immutable); safely retains/reports conflicting edits, but needs a next-runtime versioning design. Keep schema 6 until rollback compatibility is designed. The earlier 2,344-task hero is recorder points/music/completion jobs, not iCloud jobs; device composition remains unverified. Original OTA exception remains unavailable. Real StoreKit, Keychain lock, Watch/background/permission/low-space recording, iCloud fault injection/two-device restore/deletion and native gesture/icon acceptance remain device tests. Latest published visual OTA remains the prior section's update; audit changes are local only.

## Combined Grand Touring visual OTA — September 7, 2026

- Published the current combined JavaScript and artwork changes to the iOS production channel for TestFlight Build 19/runtime `2.0.0-watch.2`. EAS group `bcb9668e-80d6-4953-9b8f-0d6df965fd50`, update `01a07dd4-f5d2-7224-8293-04c0d502dea6`, message `Align Grand Touring maps, headers, spacing and artwork`; server-side `eas update:view` readback confirmed branch `production`, platform `ios`, and runtime `2.0.0-watch.2`.
- Included the Grand Touring navy/white/champagne Atlas and journey-map treatment, compact uniform non-Home headers, corrected Memories title/art treatment and lighter Grand Touring Memory placeholders, plus the Atlas place-details spacing fix, together with all other current Build 19-compatible working-tree changes. The publish exported 2,416 modules and 80 iOS assets, uploaded one bundle and five changed assets, and reused 75 assets.
- Verification before publication: complete mobile suite 315/315, TypeScript, focused theme/tab/responsive suites, and `git diff --check` passed. No new native build, TestFlight submission, Git commit, staging, or Git push was performed; the broader working tree remains intentionally dirty on `codex/journeydeck-v2`, HEAD `9421e87`.

## Compact destination headers — September 7, 2026

- Corrected the oversized Grand Touring Memories header shown by the user without publishing an OTA. The shared non-Home artwork frame is now a compact 2.65:1 banner, so Memories, Soundtracks, Statistics and Settings remain uniform; Grand Touring phone titles no longer use the fuzzy white glow.
- Changed `mobile/recorder/src/header-artwork.tsx`, `phone-tab-title.tsx`, and the focused header assertion. `npm run test:tab-runtime` passed 31/31; iPad Memories/Music/Statistics/Settings tests passed 17/17; `npm run typecheck` passed; `git diff --check` found no errors. No OTA, build, commit, staging, or push was performed.

## Grand Touring map palette aligned — September 7, 2026

- Grand Touring now passes its full theme ID into the shared OpenFreeMap transformer. Atlas and journey-detail MapLibre maps use a midnight-navy land/water treatment, white/chrome roads and labels, plus one champagne-yellow route with a yellow bloom and darker gold under-stroke. The cached journey route fallback uses the same route palette.
- Changed `mobile/recorder/src/journey-map-theme.ts`, `interactive-route-map.tsx`, `primary-mobility-map.tsx`, `shell.tsx`, and focused tests. Verified against the live OpenFreeMap dark layer IDs; `node --experimental-strip-types --test tests/app-theme.test.mts` passed 8/8, `npm run test:tab-runtime` passed 31/31, `npm run typecheck` passed, and `git diff --check` found no errors. No OTA, build, commit, staging, or push was performed.
- Follow-up visual fixes: all non-Home destination headers now use a compact uniform 2.65:1 banner and Grand Touring titles omit the fuzzy white glow. Atlas adds 14pt between the place selector and selected-place journey details. Grand Touring default Memory placeholders now reuse the approved lighter silver/champagne Memories artwork instead of Carbon Blue. Latest verification: premium themes 4/4, tab runtime 31/31, responsive header suites 17/17, TypeScript and diff check passed. Still no OTA/build/commit/staging/push.

## Themes/icons Build19 available in TestFlight — September 7, 2026

- **Apple acceptance verified directly:** App Store Connect reports version2.0.0/build19 `processingState=VALID`, `internalState=IN_BETA_TESTING`, `expired=false`, uploaded2026-09-07T13:24:15-07:00. Exact EAS build `e63cdf7f-7a54-4d1d-ade7-85be1359392b`, submission `04cd35ef-f819-45ee-b3d4-7f886ba53bda`, runtime `2.0.0-watch.2`, fingerprint `eace6e845937af23b019bfbc1abaec81d4d0c1d9`. Evidence `.cache/bundle2-release/apple-status-after.json`. External state remains `READY_FOR_BETA_SUBMISSION`; no external/public review submission performed. Native build took486s, passed first attempt. All five approved Grand Touring PNGs also match the signed IPA byte-for-byte.
- Release work completed through TestFlight delivery. Next physical checks: install19 over18, confirm existing journeys/memories/profile/theme remain, switch all four app icons independently of theme (and return to Original), review Grand Touring tab art/Settings on phone and iPad, test Journey tray drag and Watch Start/Stop. Windows tests/native compile do not substitute for those hardware checks. No OTA publication, staging, Git commit or Git push performed in this turn; all previous dirty work preserved. No build processes remain locally. Earlier in-progress lines below are the release audit trail.

- **Build19 FINISHED; submission queued:** native build `e63cdf7f-7a54-4d1d-ade7-85be1359392b` succeeded first attempt. Downloaded signed IPA127,417,043bytes to `.cache/bundle2-release/build19.ipa`. `inspect-ipa.py` verifies2.0.0(19), iPhone+iPad families, runtimewatch.2, all three alternate icon entries under both phone and iPad compiled plists, native icon module present, correct paired Watch19, signed production entitlements. Separate comparison against actual Build18 IPA proves unchanged app identifier, Keychain access groups, iCloud container/environment, ubiquity identifier and Apple sign-in entitlements. TestFlight submission `04cd35ef-f819-45ee-b3d4-7f886ba53bda` scheduled with existing API key, without public App Store review or extra group setup. `.cache/bundle2-release/submission-status.cjs` monitors upload; Apple processing and availability remain pending. `eas submit:status --platform ios --profile production --json --non-interactive` works and can confirm TestFlight state directly after upload.

- **Build19 active:** `e63cdf7f-7a54-4d1d-ade7-85be1359392b`, EAS production/store; `.cache/bundle2-release/status.cjs` reads current status and caches logs safely. Native icon pod installed; real Swift inactivity harness passed on EAS macOS; currently compiling/signing. Submission not requested yet (inspect successful IPA first). Archive secret scan passed with zero findings; an earlier overly broad local scan only found two old ignored fixture/example values under `mobile/recorder/.cache/watch/archive-verified`, outside the uploaded archive. Archive upload404MB completed in10s. EAS reused existing iPhone/Watch credentials; noninteractive Apple credential validation skipped for missing team prompt, compilation/signing remains the authoritative validation.

- User authorized the five release-readiness tasks, testing, a new native build and TestFlight submission. No public App Store release or Git commit/push requested. Working tree remains intentionally dirty on `codex/journeydeck-v2`, HEAD `9421e87`.
- Compared all runtime source/native inputs with device-proven `.cache/ota-build18-uniform-headers-release/mobile/recorder`: initial differences were only header routing, icon catalog/picker, diagnostics label, native icon module/plugin, Watch UI and app config. Reconciled conditional replacement-image requires while retaining five approved Grand Touring tab images; theme picker now previews the approved car. All other proven UI and PanResponder tray fixes are retained.
- Audited Watch diff: presentation spacing/wording only, native recorder and inactivity policy unchanged. Icon provider now serializes rapid taps, trusts applied iOS status despite a preference-write failure, and leaves mounted recorder content intact; native bridge validates names and avoids redundant calls. Four choices include Warm Ivory. Added behavioral tests.
- Added DIAG-10: first entrypoint import records the last redacted fatal JS error locally in cache before chaining the original handler, with update/runtime context, bounded output and 24-hour read expiry. No new automatic upload. Report remains readable if Expo log retrieval fails; credential filtering includes quoted values. Native crashes before JS initialization remain outside this capture. Updated stale Observe release label.
- New public runtime `2.0.0-watch.2`, preview `2.0.0-preview.7`; bundle IDs, production channel, iCloud container and local database unchanged. Older Build18 `.watch.1` OTA packages are isolated. Updated subsystem handbook's historical runtime entry.
- Verified: TypeScript; 314/314 full mobile tests; all 14 required individual subsystem scripts; generated opaque 1024px alternate icons and Watch icon; approved artwork inspection; exact archive bytes for src/modules/assets/watch/plugins/app; git diff check; iOS Hermes/source-map export 2,417 modules/80 assets, bundle `index-30e7c8d2d78240d0eab78c7ce84b0ae3.hbc`. Expo doctor 20/21; only seven available SDK patch bumps, retained known Build18 dependency lock instead of unrelated upgrades.
- Source snapshot manifest `.cache/bundle2-release/source-manifest.json`, 348 files, digest `c4cabdc03586b9b8af76dbae620c8599adbb71f892160d84cc7f42cfbfd83f1b`. Inspected EAS archive `.cache/bundle2-release-archive`. Build19 requested via `eas build --platform ios --profile production --non-interactive --no-wait`; remote increment18→19 confirmed, build ID pending. Must await native compile + Swift harness, inspect compiled IPA (identities, Watch, alternates, runtime, entitlements), then submit exact successful ID to TestFlight and verify upload outcome. Physical device icon/layout/upgrade acceptance remains for installation.

## Grand Touring tab artwork and Warm Ivory icon choice — September 7, 2026

- Added the user-approved brighter Grand Touring artwork as five separate 1672×941 project assets: `theme-grand-touring-{home|soundtracks|memories|statistics|settings}-v1.png`. `header-image-sources.ts` now maps those five registered primary-tab sources explicitly for persisted theme ID `redline`; Grand Touring Memory-card, journey-detail, secondary-screen, real-photo, and album-cover routing remains unchanged.
- Added `warm-ivory` as a fourth independent app icon choice, previewing the existing production light icon `icon-light-plum-v1.png`. The catalog maps it to native name `JourneyDeckWarmIvory`; the alternate-icon config plugin now generates that opaque 1024px iOS icon set alongside Rosewater and Grand Touring. iPad compact icon choices wrap into a 2×2 grid.
- Updated theme/icon tests, README, and generated-art provenance. Verification passed: TypeScript; focused theme/icon/Settings/tab tests 49/49; complete mobile suite 308/308; all five new files confirmed 1672×941; future native icon generation confirmed all three alternates are 1024px and opaque; local iOS Hermes export passed with 2,415 modules and 80 assets. Export: `C:\Users\patri\AppData\Local\Temp\journeydeck-grand-touring-art-1788811017142`. No OTA, native build, TestFlight submission, commit, or Git push was performed.

## Uniform themed tab headers — September 7, 2026

- Standardized the non-Home tab artwork treatment across Music, Memories, Statistics, and Settings. Phone headers now share a 16-point horizontal inset, `1672/941` aspect ratio, centered cover crop, subtle blurred-image overlay, and four-edge fade into the exact active theme page color. Statistics retains its subtitle and range controls inside the same-height frame; its previous 300-point compact hero and unique rounding were removed. Home remains intentionally unchanged.
- Added reusable `HeaderArtworkLayers` in `mobile/recorder/src/header-artwork.tsx`; routed phone Memories and both compact/regular `IpadPageHeader` paths through it; aligned Settings root padding in `shell.tsx`. Updated the affected iPad/header tests and added source invariants in `tab-runtime.test.mts`.
- Verification passed in the main intentionally dirty working tree: TypeScript, focused header/tab tests, complete mobile suite 308/308, `git diff --check`, and production iOS Expo Hermes export (2,410 modules, 75 assets; bundle `index-bfc31f2c69e3afdd13a6d9db12fa7817.hbc`). A Build 18-compatible release stage at `.cache/ota-build18-uniform-headers-release/mobile/recorder` differs from the current production baseline in exactly four runtime files plus five affected test files; staged TypeScript, focused header/tab tests 55/55, public Expo config, and iOS Hermes export (2,412 modules, 77 assets) passed. Config confirms production project/bundle identity, runtime `2.0.0-watch.1`, and exclusion of the future alternate-icon native plugin.
- Published and production-branch readback verified: group `a83ac6eb-f858-42d9-aece-8724853f162a`, iOS update `01a07d25-8150-715e-ba3d-a18bf8b3f694`, runtime `2.0.0-watch.1`, message `Standardize themed tab headers`. EAS reused all assets and uploaded one new bundle. No native build, TestFlight submission, commit, or Git push was performed. Branch remains `codex/journeydeck-v2`, HEAD `9421e87`; all prior dirty work is preserved.

## Responsive Settings category navigation — September 7, 2026

- Implemented the user-approved Settings redesign for both form factors. iPhone now opens to a short profile card plus six category rows; selecting one opens a focused Settings page with the existing back behavior and temporarily hides the bottom tab bar. Appearance keeps Theme and App Icon as separate controls so either can be chosen independently.
- iPad now uses a persistent Settings category rail beside one detail pane in landscape and portrait. Portrait narrows the rail instead of collapsing it. Appearance shows a compact 2x2 theme grid and three icon choices; Account/iCloud, Saved Places, music, membership, privacy/support, diagnostics, and the existing editors retain their original callbacks and busy/unavailable guards.
- Added `mobile/recorder/src/settings-categories.ts`; updated `shell.tsx`, `ipad-settings-screen.tsx`, `theme-picker.tsx`, `app-icon-picker.tsx`, and `tests/ipad-settings.test.mts`. The rest of the already-dirty theme/icon/Watch/POI work remains preserved.
- Verification passed in the main working tree: TypeScript; targeted iPad/iPhone Settings interactions 3/3; tab runtime 31/31; theme/icon 8/8; native navigation/interactions 11/11; complete mobile suite 308/308; `git diff --check`; production iOS Expo Hermes export. A Build 18-compatible stage at `.cache/ota-build18-settings-nav/mobile/recorder` was created from the device-proven app-icon UI OTA and differs from that baseline in exactly the five Settings source files plus `tests/ipad-settings.test.mts`; its typecheck, Settings tests 3/3, and iOS Hermes export (2,467 modules, 77 assets) passed. The stage-only complete suite is not valid because the isolated directory intentionally omits repository-level fixtures and newer unrelated baseline files; its failures were not used as release evidence.
- Published and production-channel readback verified: iOS runtime `2.0.0-watch.1`, group `4329fe94-1a17-4f89-9b96-a94c2c9ef4b7`, update `01a07cbb-f8f6-7677-a2c2-0254e77d1f5a`, message `Add responsive Settings category navigation`, fingerprint `ae03da6c60d95e450643b0a6499eb41381c98e50`. The manifest retains the Build 18 native config and excludes the future alternate-icon plugin. No native build, TestFlight submission, commit, or Git push was performed. Branch remains `codex/journeydeck-v2`, HEAD `9421e87`, with the broader working tree intentionally dirty.

## Draggable iPhone Journey library tray — September 7, 2026

- DIAG-8 (`83db83f5-0df6-4029-afba-e17af1bc3b60`, update `01a07c20-4c60-7a53-9c38-731317ae2571`) passed static tests/export but failed to launch on the user's iPhone after activation. Treat that Reanimated/Gesture Handler tray implementation as unsafe; it was removed from main source immediately.
- Republished the last working Grand Touring DIAG-7 update to iOS production at group `410a749a-39df-43fe-b52f-8f351760513c`, update `01a07c2c-71dd-7d56-9a12-e97a7743d238`, runtime `2.0.0-watch.1`; production branch and channel readback verified. The first iPhone recovery launch still crashed while downloading/activating the rollback; the following launch opened successfully. Existing tap-to-collapse behavior remains. A future drag implementation needs a different path and physical testing before another production OTA.
- Analyzed `testflight_feedback (3).zip` (`feedback id AJBzZOTupogBJmLvpZmCers`). It is definitively the DIAG-8 failure: crash time `2026-09-07T14:00:45Z`, 13 minutes after DIAG-8 publication and 37 seconds before the rollback was published. Build 18 on iPhone17,2/iOS 27 aborts on the main thread about 0.57 seconds after launch at Hermes `throwPendingError`; EAS reports one successful install and zero failed installs. A background ImageIO PNG decode is not the triggering thread. Apple omitted the JS exception text, so the exact error string is unavailable, but startup timing and the narrow diff make eager Reanimated gesture-worklet serialization the high-confidence cause. The handler captured React state/layout plus the React Native `Keyboard` host object and was registered while the tab mounted, before the user touched it.
- Reimplemented the requested tray without a new Reanimated worklet. The tray now uses React Native core `PanResponder` and `Animated.Value`: it follows the finger between clamped detents, uses vertical release velocity for flick expand/collapse, springs to the selected detent, retains tap/accessibility/reduced-motion behavior, and leaves the proven journey-card Reanimated gestures unchanged. Added pure clamp/settle policy functions and interaction coverage. Verification: Memories 5/5, tab runtime 31/31, TypeScript, `git diff --check`, and production iOS Expo exports pass. Published the controlled DIAG-9 update from the preserved Build 18 staging tree after verifying it differed from DIAG-7 in exactly the tray component, pure gesture policy, and diagnostics label. Production head: group `388eabdd-9dc8-4c74-b7a4-ffbf1e5800f7`, iOS update `01a07c42-6d92-7ed5-b171-a8d809028f94`, runtime `2.0.0-watch.1`, message `DIAG-9: Restore draggable Journey tray safely`; branch/update/channel readbacks all verified. Publish bundled 2,404 modules/75 assets, uploaded one new bundle plus source map, and reused all assets. User activated DIAG-9 on the physical iPhone and confirmed both direct finger-following drag and swipe expand/collapse work. Treat this implementation as device-proven.

## Grand Touring palette — September 6, 2026

- Replaced the Carbon Blue interface palette with the user-selected luxury palette and renamed its public theme label to Grand Touring. Persisted ID `redline` and legacy `theme-carbon-blue-*` asset filenames remain stable so existing selections and tested OTA artwork continue working.
- Palette now uses midnight navy `#081832`, navy `#203a63`, champagne `#d4b15a`, warm ivory `#f6f0e2`, and chrome `#b6bfcc`, with accessible steel/ice-blue chart derivatives. Updated dark custom-theme material lighting, picker expectations, README and theme notes.
- Focused premium-theme tests passed 4/4 and TypeScript passed. Published from the last iPad-tested conditional-artwork staging tree as DIAG-7; production readback verified runtime `2.0.0-watch.1`, group `333f7050-3178-4dfd-85b1-2d41d88e304f`, iOS update `01a079a0-1475-75e5-884f-d5860880514a`. No native build, commit, or Git push performed.

## iPad Home card taps — September 6, 2026

- User reported recent Memory/journey taps do nothing in new themes. Confirmed existing iPadHomeScreen cards were plain Views without handlers in every theme; artwork was not the cause. Converted both card types to accessible Pressables with pressed feedback and required ID callbacks; shell passes existing openMemory/openJourney router handlers. Main source ipad-home.tsx, shell.tsx and ipad-home.test.mts updated without losing other work.
- Focused Home7/7 including actual callbacks for four themes, working and staged typechecks and production Hermes export passed. Separate .cache/ota-build18-home-taps/mobile/recorder from DIAG-6 retains incremental full artwork; only two runtime files changed vs DIAG-6. Published and channel-readback verified iOS production2.0.0-watch.1 group8d1efa7b-f97a-4dad-8c20-2b101aeee263, update01a07960-ab29-7e4d-870d-d2eed2f36885. Native build/submission/commit/push not performed. User still needs to confirm journey detail artwork after taps are fixed.

## DIAG-6 journey artwork / full theme set — September 6, 2026

- User confirms DIAG-5 Memories artwork changed successfully in both themes and requested continue. Created separate .cache/ota-build18-diag6/mobile/recorder from DIAG-5, added only two theme-*-journey-v1.png assets and routed journey detail plus Home daypart placeholders to them. Memory and road images remain as tested. Diagnostics label DIAG-6.
- Typecheck, category routing assertions and comparison of140 asset/theme combinations against intended final source mapping passed; production Hermes/source-map export and Build18 production identity/runtime checks passed. Full intended artwork now restored through incremental conditional requires (original failed replacement used eager replacement object). This difference and incremental cache/download history mean successful device result will not prove exact original crash cause. Published and channel-readback verified production iOS2.0.0-watch.1 group18dcd3aa-5f7d-4f60-bb76-33e2278bf558, update01a0795b-c2d4-7be2-9c6a-5aa7ec37efae. Main worktree preserved, no native build/submission/commit/Git push. Next user test activation, Home journey placeholders and journey detail in both themes. If successful, retain validated conditional artwork implementation in main tree before future releases; do not silently return to original eager replacement object or claim root cause proven.

## DIAG-5 separate Memory artwork — September 6, 2026

- User confirmed both DIAG-4 themes/new header images work and authorized continuing. Stage .cache/ota-build18-diag5/mobile/recorder copies DIAG-4 and adds only the two theme-*-memory-v1.png assets. Memory default and Memories header now select those; road headers/picker retained, journey detail and Home daypart placeholders still use old working art. Diagnostic label DIAG-5.
- Typecheck, executed both-theme routing assertions (Memory defaults/header, retained road/journey routing, actual photo identity), Build18 config verification and production Hermes export/source maps passed. Published and channel-readback verified production iOS2.0.0-watch.1 group56301233-adf1-4e64-acd8-0dc3245b49cf, update01a07956-a7cf-72e0-8537-96e99ec5d441. Main working tree retained; no native build, submission, commit or Git push. Next user activate once and inspect Memories in both themes. If successful, remaining artwork test is two journey assets/Home daypart placeholders; source eager-vs-lazy routing difference also remains from failed original release, so do not prematurely claim cause.

## DIAG-4 headers-only artwork test — September 6, 2026

- User twice confirmed DIAG-3 works, then authorized continuing. Prepared separate stage .cache/ota-build18-diag4/mobile/recorder from DIAG-3. Added only theme-rosewater-road-v1.png and theme-carbon-blue-road-v1.png; routed general headers and picker previews to them. Memory default, journey detail, and Home daypart placeholder sources retain DIAG-3 artwork. This still leaves the original failure unproven; test success narrows remaining asset/routing work.
- Typecheck, executed routing assertions for both themes/retained placeholders/real-photo identity, production Hermes export/source maps and Build18 runtime/project/native-config verification pass. Published and channel-readback verified production iOS2.0.0-watch.1 group5f32e7bd-b32a-4be9-95f8-f0380b432532, update01a07943-8b05-7536-981b-0ad60339b063, DIAG-4: New theme headers with retained placeholders. Main tree preserved, no native build/submission/commit/push. Next user activate once, view headers in both themes, report success or updated diagnostics after crash; do not restore remaining four art assets before that result.

## DIAG-3 code/artwork split — September 6, 2026

- User confirmed DIAG-2 opens without crash and screenshot shows Sakura Chrome selected. Corrected prior six-file suspect claim: App.tsx Home portal also differs, so seven source files plus replacement assets. No specific exception reproduced locally. Earlier blanket claims that native/transport causes are ruled out are stronger than evidence: DIAG-1/2 establish successful activation of these packages, not all packages.
- User said keep going. Published DIAG-3 with ALL final replacement logic/palettes/Home/Statistics but working old artwork routing and picker image references. Compared all src files and App.tsx against failed replacement: only header-image-sources, theme-picker (old artwork requires), primary-sections (diagnostic integration) differ, plus added diagnostic files. Separate preserved stage .cache/ota-build18-diag3/mobile/recorder; main source work unchanged.
- Typecheck, Statistics+diagnostics10/10, production Hermes export/source maps, native project/runtime checks pass. Production iOS2.0.0-watch.1 group b7a89459-eeb8-4c5c-93a6-35957bd5ed79, update01a0793e-00f3-7167-b3bc-36e92784dc35; message DIAG-3: Rosewater Carbon Blue logic with proven artwork. No new native build/submission/commit/push.
- Next: user activate DIAG-3 once, inspect Home and Statistics in Rosewater/Carbon Blue (old pictures expected). If successful, focus on final artwork mapping/assets; if crash, return diagnostics from reopened working version. Do not claim exact cause or restore complete release until device result.

## DIAG-2 initial-theme bisect OTA — September 6, 2026

- DIAG-1 report proves update mechanism healthy: diagnostic baseline01a0792b downloaded all68 assets, restarted, and is running normally. Failed01a078a6 log shows all assets had loaded previously, then `markFailedLaunchForUpdate` and `UpdateFailedToLoad: ErrorRecovery could not recover...`; no underlying JS exception text. Therefore latest failure is new-bundle startup, not update download/storage/reload itself.
- Published controlled midpoint using preserved initial Sakura/Redline theme staging plus DIAG-1 log panel. Group a64298d2-b38e-4393-85b0-93d9e00b9921, update01a07932-7c68-7985-b39a-25cbebdcc078, production iOS runtime2.0.0-watch.1, message DIAG-2: Test initial theme framework with OTA reports. Channel readback verified. Typecheck, diagnostics4/4 and Hermes production export passed. No build/submission/commit/Git push.
- User should let DIAG-2 download and activate once. If it runs, failure is confined to the six replacement-delta source files between initial and final themes (`app-theme`, `header-image-sources`, `ipad-statistics-screen`, `theme-catalog`, `theme-material`, `theme-picker`) rather than framework. If it crashes, reopen DIAG-1 and share refreshed report; initial theme framework/broader pre-theme UI remains implicated. Main dirty tree and replacement art preserved.

## DIAG-1 OTA published — September 6, 2026

- User authorized diagnostic OTA. iPad screenshot confirms older running update01a076f7-61a6-7304-b07c-2c956c5cc04a, matching production2.0.0-watch.1, healthy DB, newer update pending. Exact morning staging source is gone (only node_modules remained); disclosed fallback to original Build18/HEAD9421e87 plus existing native-sheet fix. Also disclosed temporary earlier UI on both production Build18 iPhone/iPad. New themes and all dirty work preserved in main tree.
- Added Data Health UpdateDiagnostics panel and pure formatter: explicit read of last24h Expo update logs, running/downloaded IDs/runtime/channel/emergency reason, errors first, bounded output, basic private-value redaction, explicit OS Share action and selectable text. No automatic upload or reload change. Source modules update-diagnostics.tsx and update-diagnostics-format.ts, integration primary-sections.tsx, tests update-diagnostics.test.mts. Redaction is best effort; panel asks user to review before sharing.
- Verification:4/4 focused including rendered read/share/failure behavior; working and isolated typechecks; Hermes iOS export/source map; whitespace; staged source hashes; archive comparison only native-sheet and primary-sections differ among original baseline files. Native config/runtime/project asserted unchanged. Stage.cache/ota-build18-diagnostics/mobile/recorder. No native build/submission/commit/Git push.
- Published iOS production group d85a88a4-f049-4c39-9251-f85808b86dd3, update01a0792b-3d62-7e32-ad6f-6f1c3cb0fa20, message DIAG-1: Build18 baseline with on-device OTA error reports. One bundle, reused68 assets, no new art. Logs publish-diagnostics.log and channel-after.json in stage.
- Next user test: let new diagnostic update download, try activation once. If it loads, Settings > Advanced Support > Data Health > Read update logs > Share update report. If activation still crashes, stop retries and report; native reload vs baseline startup remains unresolved. This is diagnostic, not a verified crash fix. Restore newer UI only after isolating issue.

## iPad OTA activation crash investigation — September 6, 2026

- Build18 iPad15,8 / iPadOS27 beta report A880012B-6D81-4B1B-8EAC-2B4F6B25C033: SIGABRT / NSException on thread6 about4.3s after launch. Saved IPA UUID matches; relevant native symbols are stripped. Original exception message absent. User says app opens normally, crashes on Restart now, then prompts again after reopening. This does not yet distinguish reload failure from new-bundle startup failure.
- Expo insights for latest replacement group report1 install and1 failed install (small sample; device/cause unidentified). No rollback, new OTA or build performed.
- Diagnostics audit: Data Health shows current update UUID/runtime/channel and pending-update notice, but no expo-updates readLogEntriesAsync, emergency-launch reason, or update-log export. expo-observe configured with runtime/update attributes; release attribute stale N1.9-B13; custom events cover recording/music/cloud/database, not OTA activation. Shipped staging source confirms same reload path: single reloadAsync call, in-memory prompt dedupe, generic catch alert without persistence. No proven duplicate reload found.
- Next: obtain iPad Data Health Version & update screenshot to establish actual running OTA after crash; inspect Expo Observe errors if accessible. Adding an on-device update-log viewer/export would require delivering code to the device, so cannot assume it will diagnose this existing failing update immediately. Preserve all dirty work; no application changes made during audit.

## Rosewater / Carbon Blue replacement OTA — September 6, 2026

- User authorized replacing the two new themes and pushing OTA, explicitly including headers and default Memory/journey placeholders. Replaced Sakura Chrome with **Rosewater** (blush/raspberry/sage/cocoa/mulberry) and Redline Noir with **Carbon Blue** (navy/cobalt/azure/ice-white/chrome). Carbon Voltage and cognac are rejected. Existing `sakura`/`redline` stored IDs now display the replacements automatically. Cinematic Dark/Warm Ivory retained; all choices remain free for testing.
- Added six distinct generated1536×1024 assets: `mobile/recorder/assets/theme-{rosewater|carbon-blue}-{road|memory|journey}-v1.png`. Road art supplies general headers, Memory collage supplies Memory covers/headers, journey art supplies detail backgrounds and all time-of-day thumbnail fallbacks. Actual photos/album covers remain untouched. Updated picker previews/swatches, palettes, Home glass/core/glow, material gradients and Statistics pastel chart fills with readable small-label inks. Prompts/provenance and routing details in `mobile/recorder/docs/premium-themes.md`. Old theme images are no longer referenced/bundled.
- Verification: focused41/41, full299/299, working-tree and isolated-stage typechecks, all six assets visually inspected, source hashes checked, production iOS Hermes export and whitespace check pass. Physical device visual/recording-switch acceptance is still pending. No native configuration/dependency change introduced by replacements; existing uncommitted Watch/icon/UI work preserved.
- **Published and channel-readback verified:** iOS production / Build18 runtime `2.0.0-watch.1`; group `ed596482-a9db-4805-b28f-7ced8c59107b`, update `01a078a6-7df7-7d98-9c64-da8be97459ea`, message `Replace themes with Rosewater and Carbon Blue plus matching artwork`. Uploaded one bundle + six assets, reused68. Staging/logs `.cache/ota-build18-carbon-rose`, isolated from pending native Watch/icon changes. No native build, submission, commit or Git push; branch `codex/journeydeck-v2`, HEAD `9421e87`.
- Next: open Build18 to download, reopen and inspect Settings → Appearance, all tab headers, default Memory art and journey placeholders on iPhone/iPad.

## Themes OTA published — September 6, 2026

- User authorized “Push ota.” Published Sakura Chrome, Redline Noir and the free four-theme Settings picker to iOS `production`, Build18 runtime `2.0.0-watch.1`. Group `3dbc40c7-f561-4547-911d-bf4d3a54c4ba`, update `01a077f2-9965-7b57-88d0-f69df8f1c002`; message `Add Sakura Chrome and Redline Noir themes with Settings picker`. Expo production-channel readback confirms this exact active update/runtime.
- Isolated source package `.cache/ota-build18-themes` starts from HEAD native configuration and overlays the validated App/src/tsconfig plus two theme images. Source hashes match the working tree; isolated typecheck and production EAS bundle export passed, following full299/299 tests from implementation. Uploaded one bundle and two assets, reused68 assets. Preserves prior UI fixes while excluding pending Watch Swift/icon changes. No native build, submission, commit or Git push. Working tree preserved.
- Next: let Build18 download the update, reopen, then Settings → Appearance to try both themes. Physical iPhone/iPad visual and theme-switch-during-recording acceptance remains pending. Earlier “OTA pending” notes below are superseded by this entry.

## Sakura / Redline implementation — September 6, 2026

- Implemented **Sakura Chrome** (pearl/blossom/lacquer red) and **Redline Noir** (carbon/chrome/red with amber, teal, blue and magenta support) on iPhone/iPad. Settings has a visual four-theme picker including the existing Cinematic Dark and Warm Ivory. All themes are available without membership gating for testing. Selection persists in the existing SecureStore preference; legacy choices restore. Theme changes update presentation without keying/remounting app content.
- Added `theme-catalog.ts`, `theme-picker.tsx`, `theme-material.tsx`, shared palette/stylesheet/artwork resolution, custom Home treatments, native navigation colors, Statistics/Memory surfaces and detail/Settings colors. User photos and music covers remain unchanged. Added two bundled 1536×1024 generated road backgrounds (about 4.9 MB combined); one scene per new theme is reused across decorative headers. See `mobile/recorder/docs/premium-themes.md` for assets and acceptance notes.
- Verification: typecheck, focused 41/41, full mobile 299/299, iOS Hermes export `dist-premium-themes`, and whitespace check pass. Coverage includes persistence/failure behavior, content mount retention, palette contrast, free picker actions, artwork boundaries, actual Statistics theme changes preserving values/range and existing responsive interactions. Physical iPhone/iPad appearance, native tab refresh and recording-across-theme-switch acceptance remain pending.
- Branch `codex/journeydeck-v2`, HEAD `9421e87`; preserved existing uncommitted UI/icon/Watch/docs work. This task changes JS/TS/assets only; no dependency/runtime/native configuration additions for themes. Compatible in scope with Build18 runtime `2.0.0-watch.1`. No OTA publication, native build, submission, commit or push. If OTA is requested, retain prior isolation process to exclude pending native icon/Watch work. Riviera Porcelain and Aurora Passage remain planned.

## Approved premium themes — September 6, 2026

- User selected four premium visual directions from the generated Home mockups: light themes **Sakura Chrome** and **Riviera Porcelain**; dark themes **Redline Noir** and **Aurora Passage**. Preserve their distinct imagery, materials and full palettes during implementation, rather than treating them as simple accent swaps. Recorded in `docs/JOURNEYDECK-V2-ROADMAP.md`; no app, build, OTA, submission, commit or push action performed.

## Watch ready-screen fit — September 6, 2026

- Removed the `JourneyDeck` watermark from the Watch ready screen and tightened the stack, steering-wheel inset, status inset and Start button padding so the complete primary button appears higher without requiring the initial scroll. Changed the note to `Journey auto-stops after 10min without driving`. Source review and `git diff --check` completed on Windows; physical Watch acceptance and native Xcode compilation remain pending. No build, OTA, submission, commit or push performed.

## Paid membership scope decision — September 6, 2026

- User selected a focused non-Tessie paid set: cinematic journey playback and recaps, premium Home widgets and Watch complications, Atlas intelligence, plus premium themes and app icons as their own explicit benefit. Basic recording, route viewing, POI labels, Tessie import and ordinary iCloud backup remain core functionality. Recorded in `docs/JOURNEYDECK-V2-ROADMAP.md`; no app, release or Git action performed.

## App Store competitor research — September 5, 2026

- Read-only product/research task: reviewed handbook, current mobile README/roadmap, public release gates, Atlas source and current US App Store listings. Main comparison set: Arc Timeline 4, Geory, Polarsteps, Day One, FindPenguins and Relive; Rhythm Runner is a close route/song-memory concept analogue for runners. Apple Journal is a free substitute; Life Cycle overlaps Atlas; Tessie overlaps planned vehicle intelligence and is also an integration dependency.
- Positioning inference: private driving memories combining actual journey soundtracks, Memory Studio and Atlas. Privacy and route-linked music alone are not exclusive advantages. Keep public automatic recording, Spotify/Last.fm, Tessie and interactive web sharing distinct from implemented/release-pending iPad/Watch/POI work.
- Branch `codex/journeydeck-v2`, HEAD `fa16532`; working tree clean at start; git status/log/diff/stat inspected. No application code, tests, runtime, release state, external accounts or Git history changed. Only this research handoff note added. Existing release/device acceptance work remains pending as documented below; research does not authorize or verify release actions.

## Current V2 resume summary — September 5, 2026 (latest user decisions)

This summary supersedes stale status/next-step statements in the historical entries below. Preserve those entries for implementation details and release IDs; do not repeat completed work.

### Prepared clear/tinted Home Screen icon — September 6, 2026

- V2 scope decision: Last.fm/Spotify remains blocked with no further work until the Last.fm partners team responds. Interactive shared-journey web pages are removed as unrealistic/unnecessary. Automatic journey recording is removed because the Watch companion supplies intentional remote Start/Stop. Tessie remains the only substantial unfinished product feature from the original broad roadmap; current Build 18 still needs physical iPhone/iPad/Watch/POI/iCloud acceptance and eventual public App Store review authorization. Roadmap updated; no application, release, Git, or external-service action performed for this decision.
- Corrected the active iPhone Memories gallery after physical review showed it bypassed the legacy `PageHeader` path. `IpadMemoriesScreen` phone presentation now renders shared `PhoneTabTitle` above the 120pt artwork and removes its former 30pt overlay title. Typecheck, focused Memories/runtime36/36, full mobile295/295 and `git diff --check` pass. Published corrective OTA to iOS `production` for Build 18 runtime `2.0.0-watch.1`: group `bdb94b74-1996-4304-bd1a-3e4e191c10e2`, update `01a07773-d459-7ad6-8d9e-bf4c341b9de8`, message `Fix active Memories tab header`; Expo readback confirmed. No native build, submission, commit or Git push.
- Standardized all five iPhone tab headers on the Soundtracks treatment through shared `PhoneTabTitle`: centered uppercase system type, 24pt/900 weight, 5.2 letter spacing and a consistent safe-area baseline. Statistics now places its title above the artwork while retaining subtitle/range controls inside; Home retains side controls anchored independently of its centered title. Dark titles keep the subtle white glow; light titles use plum without glow. Typecheck, full mobile 295/295 and `git diff --check` pass. Published OTA to iOS `production` for Build 18 runtime `2.0.0-watch.1`: group `6768aedd-4050-44f7-a8c6-c9ce03da5813`, update `01a07764-d459-75a9-a346-eed9ed9c2752`, message `Standardize iPhone tab headers`; Expo readback confirmed. Isolated OTA included current UI source changes and excluded future icon/config. No native build, submission, commit or Git push.
- Fixed the physical iPhone Statistics header after the first shared-dashboard OTA showed the iPad horizontal header squeezing `STATISTICS` and its subtitle into a vertical letter column. `IpadPageHeader` now has an explicit compact mode: 300pt cinematic hero, full-width one-line title/copy, actions below, and a full-width 2×2 range grid. Only the phone Statistics branch enables compact mode; existing iPad headers/layouts remain unchanged. Focused header/Statistics/runtime43/43, typecheck, full mobile295/295 and `git diff --check` pass. Published to iOS `production` for Build18 runtime `2.0.0-watch.1`: group `e64550f3-5db7-4416-b24b-2276e9b5aed5`, update `01a07747-a5ae-78fd-8796-ec0175c08e0b`, message `Fix iPhone statistics header layout`; Expo readback confirmed. Isolated OTA retained the new phone dashboard and Memory-sheet fixes while excluding future icon/config. No native build, submission, commit or Git push.
- The new data-rich Statistics dashboard now powers the iPhone Statistics tab as well as iPad. The phone branch passes `compact` for explicit top safe-area ownership, 16pt outer spacing, two equal headline columns at standard phone widths, a compact calendar and vertically stacked chart/analysis/bottom panels. Range membership/paywall behavior, local calculations, native journey links, Atlas access, neon dark mode and pastel light mode are shared; iPad layout is unchanged. Removed the old `StatisticsScreen` import from the active shell path but left the legacy export in place to avoid unrelated cleanup. Focused Statistics/tab-runtime37/37, typecheck, full mobile294/294 and `git diff --check` pass.
- Published the iPhone Statistics wiring to iOS `production` for Build18 runtime `2.0.0-watch.1`: update group `89ee1949-4a9b-4efb-9be7-202bc43786e8`, update `01a07741-af85-7783-b99b-03673b424d5a`, message `Bring new statistics dashboard to iPhone`. Expo readback confirms the production branch/runtime. The isolated bundle includes `shell.tsx`, the latest shared Statistics screen and the prior Memory-sheet fixes; future tinted icon/config remained excluded. No native build, TestFlight/App Store submission, commit or Git push performed.
- Follow-up iPad Statistics refinement after physical review: dark mode now uses saturated neon coral/amber/teal/blue/rose/green plus iOS shadow halos on metric/panel borders, accent rails, selected controls, chart marks and statistic dots; light mode retains the muted pastel palette without glow. Calendar days in the displayed month remain fully legible even when outside the selected statistics window. The active range is shown with an amber tint and the selected day with a stronger coral glow; out-of-month filler cells remain subdued. Out-of-range days remain non-selectable because their data is not loaded. Focused Statistics6/6, typecheck, full mobile294/294 and `git diff --check` pass.
- Published this neon/calendar follow-up to iOS `production` for Build18 runtime `2.0.0-watch.1`: update group `a1a926a2-de63-435a-ae0e-a8c030908fc6`, update `01a07723-7c59-7ee8-affd-0238a853c362`, message `Add neon statistics and clarify calendar range`. Expo readback confirms the production branch and exact runtime. The isolated bundle also retains the prior Memory-sheet fixes; future tinted icon/config remained excluded. No native build, TestFlight/App Store submission, commit or Git push performed.
- Reworked the iPad Statistics tab after device review: six distinct cinematic metric colors now replace the uniform purple treatment in both dark and ivory modes; range controls, calendar selection, bars, scatter plot, music totals and panel edge accents use a coordinated coral/amber/teal/blue/rose/green palette. Headline widgets now have one fixed height, and the three analysis cards stretch evenly across their row. Recent Journeys now shares the bottom row with three raw-data panels: Journey averages, Record book and Activity split. No inferred Atlas-style claims were added. Responsive layouts stack at narrow or large-text widths. Focused Statistics6/6, typecheck, full mobile suite and `git diff --check` pass.
- Published the Statistics redesign together with the shared Memory-sheet Done removal/fast-scroll dismissal fix to the iOS `production` channel for Build18 runtime `2.0.0-watch.1`: update group `95f9c0a6-55c3-45fd-8e19-b1aba47ec9f4`, update `01a076f7-61a6-7304-b07c-2c956c5cc04a`, message `Recolor iPad statistics and stabilize memory editor`. Readback confirms the active production channel points to this exact iOS update/runtime. Published from an isolated checkout containing only `src/ipad-statistics-screen.tsx` and `src/native-sheet.tsx`; the future tinted icon/config and all tests/docs were excluded. Expo uploaded one app bundle and reused all existing assets. No native build, TestFlight/App Store submission, commit or Git push performed. Restart Build18 after it downloads the update to activate it.
- User requested a future clear-icon treatment with a white JourneyDeck emblem over the system Liquid Glass background and explicitly said no more builds. Added a clean 1024px monochrome foreground layer at `mobile/recorder/assets/icon-mono-foreground-v1.png` and an opaque grayscale asset-catalog input at `icon-tinted-clear-v1.png`, derived from the existing emblem geometry. `app.config.js` now supplies the latter as `ios.icon.tinted`; light/dark artwork is unchanged. Apple documents the tinted slot as grayscale and iOS supplies clear/tinted treatments. Native navigation/config coverage checks the configured variant, dimensions, grayscale channels and opacity; focused7/7 passes and Expo preview config resolves. This is source-only for a future native build: no build, OTA, submission, commit or push was performed, and Build18 remains unchanged.
- Removed the redundant header-level `Done` keyboard-dismiss action from the shared native sheet; the X remains the sole header close control and still applies dirty/busy protection. Interactive keyboard dismissal and form-level Save/Cancel actions remain. Focused coverage updated. Source-only; no OTA/build/commit/push performed yet.
- Fixed the iPad Memory editor's fast-scroll dismissal race: the shared page sheet no longer permits native swipe dismissal, and its content scroll disables boundary bounce. This prevents a fast fling from starting sheet dismissal, blanking the React content and then raising the unsaved-changes alert. The X remains the explicit protected close path; programmatic/Android request-close behavior remains. Typecheck, focused sheet4/4, tab runtime31/31 and full mobile294/294 pass. Source-only; no OTA/build/commit/push performed.

### Active combined TestFlight release — September 6, 2026

- **Apple upload accepted:** submission logs confirm “Successfully uploaded the new binary to App Store Connect” for app6806502526 and “The app has been submitted successfully.” Version2.0.0(18) awaits Apple processing; installation availability/physical device acceptance is NOT yet verified. No public App Store review submission, release, OTA or merge-to-main performed. Final user next step: install18 when TestFlight offers it; open iPhone app once, check Watch Start/Stop/paired-phone behavior, iPad layouts/Statistics/calendar, POI fallback and private sync. Source `a8a0e28` includes all combined changes and both native build fixes, pushed on codex/journeydeck-v2.
- **Build18 FINISHED successfully.** Downloaded IPA (91,094,941 bytes) and inspected compiled plists/executable: main app `com.journeydeck.recorder`2.0.0(18), UIDeviceFamily[1,2], original iCloud container; embedded Watch `com.journeydeck.recorder.watchkitapp`2.0.0(18), family4, correct companion ID, paired-only flag. Watch and iPhone native compilation/linking passed; Swift inactivity harness passed. Submission `8686e9ea-9a69-422c-9f92-3fa73bcde967` currently IN_PROGRESS; Apple processing/availability not yet confirmed. IPA and logs remain ignored in `.cache/master-release/`.
- Current retry: **Build18** `471f39fd-52d1-4336-b731-42b62b8763dc`, source `a8a0e28` committed/pushed, submission `8686e9ea-9a69-422c-9f92-3fa73bcde967` queued. Explicit Swift continuation fix verified by18 focused local tests; native compilation still running. EAS reported84% included credits used before this retry. Previous Build16/17 are failed, not delivered. Latest status helper `.cache/master-release/status.cjs` now targets18.
- Build17 resolved the Watch icon compile failure, then exposed one recorder Swift compile error at `startManual`'s deferred continuation completion: generic `T` could not be inferred. Added explicit `CheckedContinuation<Void, Never>` annotation; no behavior change. Build17 ERRORED and its queued submission canceled. Native policy harness passed again. Next retry must compile the iPhone recorder module before claiming success; no TestFlight delivery yet.
- Icon correction committed/pushed as `fa5cf1a`. Retry **Build17** `19e6a040-ae71-4c7f-9e31-38b075948413` is running with automatic submission `99d25442-af01-44d5-868c-5f73f329184e` AWAITING_BUILD. Same production app/version2.0.0/runtimewatch.1, existing Watch Store profile. All294 tests and targeted Watch4/4 with PNG dimension/opacity checks pass. EAS reported80% included build credits used before retry; avoid blind repeat builds. Latest verification/submission outcome still pending.
- Build16 failed before submission: actual icon PNG512x512 did not match declared1024x1024 Watch slot; queued submission canceled. Native Swift inactivity policy harness PASSED on EAS macOS. Replaced direct icon copy with awaited Expo image generation at1024px/opaque; tests inspect actual PNG dimensions and decoded opacity. Full294 tests passed after generation fix; retry will use same configured production signing, without Enterprise-only `--what-to-test`. Earlier group-path fix is effective: resources now resolve correctly. No TestFlight build delivered yet.
- Combined source committed/pushed as `58a88b3` on `codex/journeydeck-v2`; working tree clean afterward. Staged secret scan passed with zero leaks; whitespace check passed. Original public app2.0.0 **Build16** is running: EAS build `464605d0-edf9-4817-91a6-ab60f523eb96`. Production Watch bundle/profile registered using existing Apple team/certificate. Build15 number was consumed by signing preflight, without creating a build. Automatic submit with `--what-to-test` hit an Enterprise-only changelog restriction; no duplicate build created. Rescheduled same build without that flag: submission `6ef9a51c-a4bd-45fd-b8ef-3f2f31c97473` currently AWAITING_BUILD. Apple native compilation/submission not yet complete. Optional CLI TestFlight group setup returned an app-resource lookup warning; actual submission queued with existing API key. Verify actual submission result before changing known App Store ID6806502526. Status helper/logs are ignored under `.cache/master-release/`.
- User explicitly resumed release work: “go for master bundled build into test flight,” then “continue” after identifying the production POI gap. Authorized combined iPhone/iPad/Watch build, commit/push and TestFlight submission; earlier build holds are superseded for this release. Preserve original public app identity/container and existing V2 preview installation/data. No App Store public submission/merge-to-main requested.
- Production POI enabled/deployed under this authorization: Worker `journeydeck-edge`, version `64d62730-8651-4859-8058-f84a96b3d6d7`, national bucket/release2026-08-19.0/namespace national-v1. Worker typecheck, production dry-run and live six-business/cache/empty/invalid-input smoke passed. Preview remains national. Native physical stop acceptance remains for TestFlight.
- Investigated prior Watch Build10 failure: Xcode used `ios/undefined/JourneyDeckWatch/Assets.xcassets`. Fixed config plugin group to explicit empty path and SOURCE_ROOT; added regression assertions. Watch structural tests4/4 pass. EAS macOS post-install retains real Swift policy harness; full native compilation must pass on upcoming build.
- Resolved production app:2.0.0/runtime2.0.0-watch.1, bundle com.journeydeck.recorder, iCloud.com.journeydeck.recorder, tablet=true, Watch com.journeydeck.recorder.watchkitapp, production edge. Release label V2-BUNDLE1. Typecheck/full294 tests/all14 required individual checks pass; iOS export dist-master-bundle2390 modules/67 assets passed. Dependency patch suggestions from prior Build10 doctor are known; no unrelated SDK upgrade performed. Commit/build/submission IDs to follow.

### Latest POI milestone — national preview activated and live-tested, September 6, 2026

- User explicitly authorized switching preview to national package and live lookups. Updated ONLY `journeydeck-edge-preview` settings through Cloudflare PATCH settings: `PUBLIC_PLACES` -> `journeydeck-public-places`, `OVERTURE_CACHE_NAMESPACE` -> `national-v1`. Existing enabled=true/release2026-08-19.0, Worker code and all other bindings (including secrets) inherited. Matching two preview values updated in `cloudflare/wrangler.jsonc`. Production Worker was only read; its deployed settings still have no Overture bindings. No app build/OTA/submission/push.
- Live six-business smoke passed: real ranged gzip reads, mobile parser, repeat cached payload equality, no-store response headers, invalid requests400 and empty tile200. First Rate/Cinemark/Olive Garden matched; Chili's and both Whataburger samples were ambiguous and correctly retained native fallback under existing conservative selector. This is not physical parking-stop acceptance.
- Added/reran `tools/overture-us/smoke_national.mjs`: a live middle-index tile from EACH of52 latitude bands exactly matches verified package bytes, including Alaska/Hawaii bands. Oversized tile6537_5300 returns empty/native fallback. All53 nationwide checks passed. Existing Cloudflare Worker tests passed; git diff check passed. Thus prior pending live-national-range verification is now completed.
- Next: physical device POI acceptance with the correctly configured preview app, plus remaining iPad/Watch readiness. Production activation and combined app release still need user authorization. Preview rollback if needed: restore canary bucket `journeydeck-public-places-preview` and namespace `canary-v3` while preserving other bindings. Local national package and107 uploaded objects unchanged.

### Latest POI milestone — uploaded package verified read-only, September 6, 2026

- User uploaded the prepared release themselves via Wrangler, with completion screenshot, then authorized verifying uploaded files/tile reads. All107 remote objects in `journeydeck-public-places/us/v1/2026-08-19.0/` were read back and matched upload-plan SHA-256/size exactly:981,259,927 bytes. All528,153 gzip members/ranges validated from readback; app parser smoke passed6 known public businesses, all52 bands and the one native-fallback tile.
- Added read-only `tools/overture-us/verify_uploaded.py`. Evidence and remote copies: `C:\Users\patri\Downloads\Overture-US-Upload-2026-08-19\remote-verification\verification-report.json`. No uploads/remote writes/deployments/activation by this verification task. Original package/extract preserved.
- Read deployed preview settings: still `PUBLIC_PLACES=journeydeck-public-places-preview`, enabled=true, release2026-08-19.0, cache namespace `canary-v3`. Thus live preview still serves tiny canary; national end-to-end Worker remote-binding range smoke is pending separately authorized preview activation. Direct authenticated REST GET ignored a Range probe (HTTP200/full object); this does not test Worker R2 binding range support. Current passed tile tests use actual downloaded R2 bytes, not the live national Worker path.
- Cloudflare setup also completed earlier:14 official global skills and5 Codex MCPs with OAuth where required. User subsequently signed Wrangler in and performed upload. Release hold for combined iPad/Watch/POI still active; no app builds/OTA/submission/push. Next: switch preview binding/cache namespace only when user authorizes, then live smoke and device acceptance.

### Latest POI milestone — local national upload package prepared, September 6, 2026

- User authorized file validation/extraction/package preparation only, explicitly **no upload**. Completed using bundled Python3.12 and existing cached DuckDB/PyArrow. All16 downloaded shard filenames/sizes matched official release `2026-08-19.0` S3 inventory (metadata request only). Decoded every Parquet column/page and recorded local SHA-256: 73,631,092 source rows / 10,480,684,059 bytes. No source data download repeated; originals preserved.
- Completed local extraction: **10,071,579** explicit-US/open/confidence>=0.7 places under the existing geographic/name filters. Output and completion checksum are under `C:\Users\patri\Downloads\Overture-US-Upload-2026-08-19`. The earlier partial extract in repo `.cache` remains untouched.
- **Ready upload directory:** `C:\Users\patri\Downloads\Overture-US-Upload-2026-08-19\2026-08-19.0-ready`. Exactly **107 objects / 981,259,927 bytes**: 52 binary band packs +52 indexes +manifest +licenses +NOTICE; 528,153 served tiles. Parent `upload-plan.json` lists exact object keys/sizes/SHA-256, `source-validation.json` records validation, README explains manifest-last publication. Raw Parquet/reports/failed preparation are outside ready directory and are NOT upload objects.
- One dense tile `6537_5300` has31,323 candidates (3,896,666 decoded bytes), exceeding mobile20,000-place limit. First strict pack attempt failed safely without manifest. Revised preparation omits that tile entirely and records it in `nativeFallbackTiles`; existing Worker empty-tile response invokes native MapKit. No candidate truncation or client/Worker limit changes. Initial failed directory/packing.sqlite preserved. `placeCount` is extracted source count, not a promise that every point is served in every tile.
- Added `tools/overture-us/prepare_local.py` (no upload code path), `smoke_local.mjs`; extended builder for local shards/explicit overflow fallback, guaranteed SQLite close on packing errors, and4 focused tests. Strict low-level pack default retained. Resume verifies completed extract hash/count and creates a fresh ready directory. Documentation updated.
- Verification passed:4 Python tests; all528,153 gzip members/index ranges/counts verified; local app-parser smoke covers6 known public businesses, all52 bands, and omitted-tile fallback. **No upload, Worker deployment, activation, app build, OTA, submission, staging/commit/push.** Branch `codex/journeydeck-v2`, HEAD `63ee33d`, prior dirty work preserved. Next: user review of package/fallback exception; upload and activation require separate authorization. Release hold still applies.

### Latest milestone — iPad Statistics implemented, September 5, 2026

- User approved implementing concept07 (calendar immediately under six widgets); their “settings” wording referred to the Statistics mockup in context. Added `mobile/recorder/src/ipad-statistics-model.ts`, `ipad-statistics-screen.tsx`, `tests/ipad-statistics.test.mts`; wired only the iPad Statistics branch of `shell.tsx`. README/roadmap updated. Includes range/previous-period cards and sparklines, calendar/month navigation/day detail, daily distance, journey distance bands, hourly departures, distance/duration scatter, distinct music counts and paged native journey links. Both themes and narrow/large-text stacking; actual layout on iPad still unverified.
- Uses existing local-first profile archive/details; no new storage/network/dependencies. Membership cutoff enforced in model; inaccessible 90D/All invoke existing paywall, incomplete previous periods have no comparison. Music attributed to journey start local date; listening sums known song durations (not observed playback), missing details/durations explicitly marked partial. Invalid/future/duplicate journeys excluded; nonfinite/negative metrics sanitized. Atlas retains inferred insights. iPhone Statistics untouched.
- Verification: focused 6/6 tests, typecheck, full mobile 294/294, all14 individual subsystem test commands, git diff check passed. Covers totals, membership bounds, missing music, local calendar dates, range gating, paging, native link callbacks, themes, large text, loading/error/empty. Existing deprecation/module-type/line-ending warnings remain. Expo export deliberately not run under user build hold. No native build, OTA, submission, push, staging, commit or download/process check.
- Branch remains `codex/journeydeck-v2`, HEAD `63ee33d`; extensive prior dirty work preserved. Next: physical iPad/VoiceOver and bundler acceptance when authorized; Home card navigation is still separate pending work, then combined Watch/POI readiness. No repeated Overture polling. Older blank-Statistics/pending-selection entries below are superseded by this milestone.

### Release hold and working agreement

- **Post-POI/Statistics tooling research:** User requested free/mostly-free skills, SDK capabilities and MCP recommendations. Findings/sources saved in `docs/POST-V2-DEVELOPER-TOOLS-RESEARCH.md`: prioritize existing analytics/security/Cloudflare skills, official Expo skills/MCP, Callstack performance/testing and SwiftUI guidance; audit installed Observe (stale N1.9-B13 release label and preview environment distinction) before adding telemetry. Native iOS automation still needs a Mac/authorized runner. Widgets/Live Activities are a future native feature. Research only: no installs, external account changes, monitoring, app edits, tests or releases. Statistics mockup selection remains pending.

- **User: "No more builds until we are all ready with iPad, apple watch, and POI."** Finish and assess all three together before one combined release. Existing Watch hold also forbids EAS builds, OTA, TestFlight submission and push. Do not restart an earlier build authorization from history. Build10 was submitted before this hold; its outcome has not been checked here. No new build/publication was performed for this handoff.
- Keep the public iPhone/iPad/Watch product under one purchase and normal App Store update path. V2 preview bundle/CloudKit isolation remains deliberate; preserve production identity and existing data.
- User explicitly stopped routine Astra model recommendations. User is concerned about Codex tokens: keep updates/tools concise, do not repeatedly poll downloads, and do not launch background monitors or agents without authorization.
- Reconciled repository: branch `codex/journeydeck-v2`, HEAD `63ee33d` (1.9 release candidate), extensive unstaged/untracked V2, Watch and POI work. Inspected status, diff/stat, recent history and relevant source/config. Preserve all existing work; no staging/commit/push/reset or cleanup. This handoff turn edits documentation only and does not rerun application tests.

### V2 work already implemented

- **Statistics mockup correction:** User asked to move calendar under widgets. Latest `.ai/ipad-statistics-concepts/07-calendar-under-widgets.png` orders six summary cards -> calendar/selected day -> charts -> Recent journeys; supersedes concept06's placement. Built-in image edit only, prompt saved beside it; no app code/release changes.

- **Combined Statistics mockup:** User requested option 1 overview with option 2 calendar below. Generated `.ai/ipad-statistics-concepts/06-overview-calendar.png` as one dark full-scroll page with summary cards/charts/recent journeys above calendar and selected-day detail. Prompt saved beside it. Illustrative data only; no app implementation or release. This is the current design direction, awaiting user feedback.

- **iPad Statistics concepts:** User requested five dark-theme, raw-metric-rich mockups, reserving inferred intelligence for Atlas. Generated and saved five alternatives in `.ai/ipad-statistics-concepts/` (01 overview, 02 calendar, 03 ledger, 04 music, 05 observatory), with exact prompts in `PROMPTS.md`. Images use fictional sample data and are visual proposals, not validated data outputs. Selection pending; Statistics app implementation remains blank. No app code/build/OTA changes.

- **iPad tab source audit, September 5 resume:** Statistics is still explicitly `IpadBlankScreen` in `src/shell.tsx`. Home, Music/Soundtracks, Memory Studio and Settings have tablet implementations. Home's recent memories/journeys/song widgets are display-only `View` elements with no detail/action callbacks, so navigation wiring remains. Next tab work: tablet Statistics using existing local statistics/timeline and membership/Atlas actions, then Home card navigation and shared detail/device acceptance. Roadmap M7/Home-only and older README blank-Memories statements are historical and lag current source. Audit only; no app edits/tests/builds.

- iPhone warm ivory/purple light theme plus original dark theme, Settings switch, matching light header/fallback artwork, purple Start Journey treatment, and light app icon assets. User confirmed installed Build6 included light icon and native features.
- Native five-tab navigation (Music, Memories, Home, Statistics, Settings), always-orange Home, preserved screen state, native detail navigation, sheets/menus, long-press card actions, and card-to-detail zoom. Prior fixes address tab label spacing, sheet close encoding, filter/card text alignment, menu placement and delayed detail-frame jumps. Historical sections retain exact fixes/OTAs.
- iPad adaptive Home dashboard, Music/Soundtracks gallery and Settings grid implemented in both themes, with shared artwork-backed titles and native navigation. Portrait label is Stats; landscape Statistics (verified current source). Sidebar/content adaptation exists. iPad-specific Statistics completion remains a readiness item; do not assume every tab is finished merely because all five navigation entries exist.
- Memory Studio implemented for both devices with Reanimated/Gesture Handler drag/drop: combine journeys into a Memory, add journeys to an existing Memory, animated lift/hover/drop, scrolling and tap alternatives. iPad gallery/library and iPhone expandable tray use shared model/data/actions. Latest documented V2 OTA is MEM2 `01a07337-e19e-7dd2-bb49-641749e81d36`, Build6/runtime `2.0.0-preview.5`; full physical drag/drop/keyboard/rotation acceptance remains to be recorded.
- Private iCloud sync repairs include canonical places before journey dependencies, routes/music/memories/photos/preferences, dependency retry/cursor handling, missing-photo isolation/diagnostics, and rebasing recognized private photo paths after container relocation. Foreground/open sync already exists with a 15-minute successful-sync cooldown; incomplete work bypasses cooldown and manual Sync forces a check. User confirmed iPad success and later iPhone Synced/0 pending; this does not independently prove every photo appears on both devices. Never delete app/local data to repair sync.
- Watch paired manual Start/Stop bridge, native manual recording and ten-minute credible-GPS inactivity policy implemented; no independent Watch GPS. Cinematic SwiftUI screen/artwork and purple Stop were subsequently saved. Detailed Watch section/README contains tests, provisioning and acceptance requirements. SwiftUI/native compilation and hardware validation remain outstanding for the newest source. Earlier Build10 job `d1d1a09d-dba7-4932-9020-21f79caf4bb5` status is unknown here; do not create a duplicate or claim Watch installability.
- Current `app.config.js` runtime is `2.0.0-preview.6` / public `2.0.0-watch.1`. The combined dirty tree is NOT a compatible OTA for installed Build6/preview.5; POI alone requiring no new native module does not remove this Watch/native constraint.

### POI implementation and validation

- Accepted architecture: saved/user-corrected places and cache first; confirmed U.S. stop -> Overture public places -> native MapKit fallback -> Apple address/city. Outside U.S./unknown country -> native fallback. Maps remain MapLibre + OpenFreeMap/OpenStreetMap. Foursquare paid API/Movement SDK are not integrated. Places Lab combined 20 ratings favored Overture: 14 correct/6 partial/0 missing (historical comparison details below).
- Mobile code: `overture-place-model.ts`, `overture-places.ts`, `journey-place-enrichment.ts`, bounded network response support, Settings `place-data-credits.tsx` and bundled complete license/notice asset. Coarse public tiles only leave device; precise matching is local. Privacy fences, profile/recording/foreground races, ambiguous matches, bounded caches and fallback paths covered. Chosen place identity uses existing private CloudKit envelope, no new schema or bulk relabel.
- Worker/pipeline: `cloudflare/workers/overture-places.ts`, route/config/types and `tools/overture-us/`. R2 sparse indexed gzip packs, range reads, explicit cache namespace, manifest-last immutable publishing, license notices. Stored gzip is decompressed before caching/response; outgoing POST uses `Cache-Control: no-store` while explicit tile-keyed caches retain safe reuse.
- Last verified deployment: preview `https://journeydeck-edge-preview.patrickbstewart.workers.dev`, Worker **`c8112415-e343-4732-8eaa-696ec684c333`**, enabled against `journeydeck-public-places-preview`, namespace `canary-v3`. Only 227 public places/11 tiles/six test destinations; NOT nationwide. Main `journeydeck-public-places` bucket was created but national upload/production activation not done. Current config confirms production flag false / namespace `national-v1`; no live deployment query made for this handoff.
- Last completed POI verification: full mobile **288/288**, all15 required mobile commands,14 focused POI tests,2 Python pack tests, Worker TypeScript, iOS export `dist-overture-verified` (2388 modules/67 assets), diff check and live preview gzip/cache/input/six-business smoke. These are prior results, not reruns after every subsequent Watch edit. Physical end-to-end POI acceptance still pending.

### Downloads paused from agent supervision — do not poll until asked

- **Latest user-requested one-time check after Statistics implementation:** All 16 expected parts (00000–00015) are now present and nonempty in `C:\Users\patri\Downloads\Overture-Places`; final part last written September 5 at 21:30:12 local. Download completion appears likely, but upstream sizes/Parquet integrity have not yet been validated. Filtered extract remains 549,783,225 bytes, last written 20:24:29; no final manifest/packed output or matching downloader/extractor process found in this snapshot. Recommended next: validate all local shards, then use them for U.S. extraction/packing. No restart, repeated polling, release or process changes.

- **One-time resume check, September 5, 2026 at 21:00 CDT:** branch `codex/journeydeck-v2`, HEAD `63ee33d`; existing extensive unstaged/untracked work preserved. Local worldwide download folder contains 11 files: parts 00000–00009 are nonempty (6,658,006,415 bytes total), part 00010 is zero bytes; expected set remains 16. Sizes/integrity have NOT been validated against upstream. Filtered raw extract is 549,783,225 bytes, last written 20:24 CDT; no packed output/final manifest found beneath `.cache/overture-us-filtered`. One process snapshot found no matching Overture extraction/download command; interactive PowerShell activity cannot be established from this snapshot. Neither completion nor download liveness is confirmed. No restart, repeated polling, process changes, builds, OTA, submission, or application edits/tests. Recommended next: let the user's download command finish, then validate all 16 originals and add local-shard U.S. extraction support; meanwhile finish iPad Statistics and Watch readiness review under the release hold. This observation supersedes the older unverified sizes below.

- User asked to leave the extraction downloading and stop checking to conserve tokens. Only the polling `functions.exec` cell464 was terminated; independent extraction exec session **61351** was left running. Last observation was ~270MB raw output, extracting; CURRENT completion/process state is deliberately unverified. No download or process check performed for this handoff.
- Existing command: bundled Python `tools/overture-us/build.py --release 2026-08-19.0 --output .cache/overture-us-filtered/2026-08-19.0`. Raw input sibling `.cache/overture-us-filtered/us-2026-08-19.0.parquet`; successful run auto-packs output. Earlier stopped session39355/PID54208 output under `.cache/overture-us/` is incomplete and must not be reused.
- The running extractor predates the added `*.parquet.complete.json` completion/hash marker and progress changes. Do not mistake absence of that marker alone for failure; verify successful exit/final manifest and row count before accepting data. Never accept a partially written Parquet simply because it opens.
- User separately started a native PowerShell sequential raw download to **`C:/Users/patri/Downloads/Overture-Places`**, without AWS CLI. This is **16 worldwide Places Parquet files, approximately 10.48GB**, release2026-08-19.0, not a U.S.-only download. Last USER SCREENSHOT showed first3 completed and fourth at369,084,976 bytes; current progress/start time unknown. Do not restart/overwrite/parallelize their command without asking or being instructed. User prefers one-line commands. No promised ETA: message timestamps were unavailable.
- Preserve Places Lab server `http://127.0.0.1:8768/` (last known PID52348) and in-memory Foursquare token; do not restart it or inspect/expose the token. Process liveness unverified here.

### Exact next steps when user resumes implementation

1. On request, check existing extraction or the user's16 raw files once. For raw files validate expected count/remote sizes/Parquet integrity; adapt extraction to local originals (existing `--source` expects the normalized completed U.S. extract, not arbitrary worldwide shards). Avoid repeating remote downloads. Retain originals.
2. Finish U.S. filtering/packing (explicit US country/open/confidence, CONUS/Alaska/Hawaii); validate full manifest, gzip/index ranges, row counts/coverage/actual storage with `tools/overture-us/publish.py` before uploading. Bundled Python is `C:/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`; Wrangler is `C:/Users/patri/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js`.
3. Upload validated national directory via publisher to main R2 bucket (manifest last). Switch preview to main bucket plus `national-v1`, verify live known/sparse/Alaska/Hawaii/invalid/cache behavior, then activate production public endpoint under existing implementation authorization. Record exact counts and deployment IDs; allow propagation before interpreting a smoke failure. Do not distribute app builds/OTAs during the hold.
4. Complete remaining iPad scope (especially Statistics) and cross-device acceptance, reconcile latest Watch native/provisioning/build outcome and physical test plan, then review readiness of all three together. Only resume combined EAS/distribution after user lifts the hold; protect installed runtime/data and inspect Watch profile/TestFlight requirements first.
5. Keep `docs/JOURNEYDECK-V2-ROADMAP.md` and detailed historical entries as scope/reference; do not infer that their older pending build instructions override this summary.

## Watch consolidated handoff — BUILD HOLD September 5, 2026

Latest read-only EAS history check (user requested count since Aug26): Build10 `d1d1a09d-dba7-4932-9020-21f79caf4bb5` now reports **ERRORED**. This supersedes the unchecked/IN_PROGRESS statements below; failure logs have not been inspected. No new build started. JourneyDeck history since Aug26 Chicago midnight:22 submitted jobs,15 FINISHED/7 ERRORED; excludes local pre-upload failures and OTAs.

This is the current Watch resume point. Historical build/authentication entries below describe earlier attempts, not current instructions. Documentation-only reconciliation against status, diff/stat and HEAD63ee33d; no test reruns, remote build checks, download polling or process changes for this handoff.

- User approved cinematic concept and JourneyDeck purple Stop button, explicitly requested implementation saved for later. **Do not start any EAS build, OTA, TestFlight submission, or push.** User wants POI completed in the other task before one combined iPhone/iPad/Watch build; Expo credit is limited. This supersedes earlier Watch build authorization below.
- Product/architecture: one public JourneyDeck purchase includes the universal iPhone/iPad app plus embedded watchOS10+ companion. Effective `app.config.js` has supportsTablet:true. Watch is a one-button remote; iPhone owns GPS, recording, private SQLite persistence and existing iCloud sync. No independent Watch GPS, server, HealthKit or separately sold Watch/iPad app.
- Recording implementation: `modules/journeydeck-recorder/ios/JourneyDeckWatchBridge.swift`, `ManualJourneyInactivity.swift`, recorder module/AppDelegate/podspec, TS native wrappers/types, `App.tsx`, `src/{location-task,storage,native-recorder-inbox-model,manual-recording-failsafe,tracking,account-lifecycle}.ts` and shell profile-transition cleanup. Phone and Watch new manual starts use native_recording_manual_ IDs in the native inbox, never the Expo master DB. Existing Expo sessions/older binaries keep their fallback. Stop fences exact session identity; duplicate/expired commands and profile transitions are guarded. Only opaque IDs/control tokens and state cross the paired connection; no coordinates/profile identity. Zero-point manual completion and auxiliary music sampling are handled without duplicate GPS writes.
- Failsafe: ten minutes of credible non-driving GPS evidence, including ordinary walking; 2.2m/s displacement threshold, >=15s baseline, <=50m horizontal uncertainty. Poor/ambiguous fixes or >120s observation gaps interrupt the countdown; absent GPS does not mean parking. Native observation state persists, resume restarts interval, existing24h ceiling remains. Completion depends on qualifying iOS callbacks, not an exact wall-clock alarm. Hardware checks for locked phone, signal loss, reconnect/relaunch, pause, simultaneous taps and profile races remain required.
- Implemented native SwiftUI screen in `mobile/recorder/watch/JourneyDeckWatchApp.swift`: bundled dusk-road art, cream serif text, amber medallion, copper/amber Start and purple #963CFF Stop gradient, existing connection/busy/paused/error labels. Scroll/Dynamic Type, decorative VoiceOver exclusions, solid background under Reduce Transparency/dimmed display. No decorative animation. Recorder class verified byte-equivalent (normalized newlines) to pre-theme archived source; GPS and failsafe unchanged.
- Added `watch/Assets.xcassets/CinematicRoad.imageset/{Contents.json,cinematic-road.png}` (1.44MB generated fictional scenery); plugin copies source asset catalog into Watch target. Approved illustration saved `.ai/watch-cinematic/approved-purple-stop.png`; it is a concept, NOT a real device screenshot. Watch README documents styling/assets and release hold.
- Packaging: `plugins/with-journeydeck-watch.js` generates/embeds the Watch target, copies Swift/assets and declares separate signing credentials. `package.json` post-install hook calls `scripts/test-watch-native-policy.mjs` with `tests/swift/ManualJourneyInactivityTests.swift` on a Swift-equipped builder. Root `.easignore` fixes oversized archives by excluding old mobile exports/generated outputs/design/cache data; source retained. Verified archive294MB contents/287MB compressed instead of failed2.3GB; no files deleted. Preserve these exclusions for the combined build.
- Release state: Build10 `d1d1a09d-dba7-4932-9020-21f79caf4bb5` was submitted before the hold, last seen IN_PROGRESS; final outcome remains unchecked. It predates the cinematic UI and uses ad hoc signing. User completed Apple login and Watch bundle/profile setup; profile lists only phone/tablet and lacks Watch UDID. User is Windows-only. Recommended future TestFlight distribution to avoid device registration; no TestFlight-signed build or submission has occurred. Current profiles/config only allow v2-preview and production; a future isolated V2 TestFlight path must be configured deliberately, preserving `com.journeydeck.recorder.v2`/private .v2 CloudKit instead of accidentally using production. Validate host/Watch build-number parity (preview config still hardcodes6 while EAS remote counter reached10).
- Verification history: initial Watch implementation TypeScript/full274 tests/iOS JS export passed, then focused Watch/failsafe16 passed with post-install hook. The separate POI task later recorded full288/15checks. Latest cinematic-only change ran Watch packaging tests4/4 (includes actual generated Xcode objects, target idempotence and copied asset bytes); these results do NOT prove SwiftUI/native compilation. Native policy harness has not been locally executed on Windows. Source runtimes preview.6/public watch.1 are incompatible with installed Build6/preview.5 OTA.
- Verification: existing Watch build tests4/4 pass, extended generated-files check confirms copied artwork bytes/manifest; git diff --check passes (CRLF warnings only). No cloud/native build run; native SwiftUI compilation and physical layout/VoiceOver remain unverified on Windows. Branch `codex/journeydeck-v2` at63ee33d, unrelated dirty POI/V2 changes preserved. Changes left unstaged/uncommitted. Next: when user resumes release, reconcile POI and inspect earlier Build10 outcome before one planned TestFlight build, then validate small/large Watch, Dynamic Type, busy/errors and background contrast on hardware.

## US Overture POI integration — in progress September 5, 2026

- User authorized planned US Overture first / MapKit fallback; elsewhere MapKit only, map display unchanged. Implemented `src/overture-place-model.ts`, `overture-places.ts`, and updated foreground `journey-place-enrichment.ts`. Apple geocoder country routing; local ranking rejects ambiguous/distant candidates. Saved names, 300m Home/Work fences, active profile and recording checks win before/after awaits. Public .02-degree halo tiles cached seven days, max24/4MB each; chosen labels/GERS-based IDs use existing private place/CloudKit envelope. No bulk relabel of existing 30-day cached places.
- Added read-only `/api/places/us-tile` Worker, bounded tile-only input, R2 ranged gzip packs and edge cache; new public bucket `journeydeck-public-places` created after user activated R2. Preview deployed with Overture DISABLED, version `3162f92b-dbe4-4d47-b4db-b53f84a8afd3`; production has NOT been deployed. Historical initial state only: production remains false; preview was subsequently enabled for the isolated canary as described above. No private library data enters R2.
- Pipeline `tools/overture-us/{build,publish,fetch_licenses,test_build}.py` + README/requirements/NOTICE. Bundled full CDLA/Apache/CC0 licenses and Foursquare notice in `assets/overture-licenses.json`; new Settings credits sheet on both devices. Publisher validates all gzip/index ranges, uses existing Wrangler sign-in, uploads manifest last and refuses published-release overwrite.
- Live canary validation completed using a separate tiny `journeydeck-public-places-preview` R2 bucket:227 public places/11tiles, same source release, marked partial coverage in manifest. `make_canary.py`, `smoke.mjs` added. Preview is now ENABLED against that test bucket, cache namespace `canary-v3`, Worker version **c8112415-e343-4732-8eaa-696ec684c333** (latest verified after no-store response fix). All six expected businesses present, repeat cached responses identical, invalid/precise/extra-field inputs rejected, empty area works. First requests160–536ms, repeat54–73ms. Conservative matcher accepts First Rate/Cinemark/Olive Garden and defers3 co-located cases to native. Do not call this national coverage.
- A live gzip/cache integration bug was found and fixed: R2 range members now pass through native DecompressionStream before the edge cache, letting Cloudflare handle outgoing compression normally. Returning stored gzip through cache had resulted in double-encoded bytes. Namespace separates environments and test/national contents; change preview to `national-v1` when switching to full bucket. Production is still NOT deployed/enabled. Publisher refuses partial canary manifests in a non-preview bucket.
- National extraction last observed running; supervision PAUSED at user request, current status unknown: exec session **61351**, output `.cache/overture-us-filtered/2026-08-19.0`, raw sibling `us-2026-08-19.0.parquet`. Command: bundled Python `tools/overture-us/build.py --release 2026-08-19.0 --output .cache/overture-us-filtered/2026-08-19.0`. Initial slow worldwide scan session39355/PID54208 was deliberately stopped after verifying process identity; its incomplete `.cache/overture-us/us-2026-08-19.0.parquet` is NOT reusable. New query prefilters CONUS/Alaska/Hawaii bbox blocks AND requires explicit US country, open status, >=.7 confidence. Preserve the running Places Lab server/token (PID52348).
- Verification: required15 mobile commands all passed; final full mobile suite288/288 passed, including four cache/CloudKit-roundtrip tests (14 focused POI tests total). Two Python pack tests passed. Worker TypeScript passed using `node mobile/recorder/node_modules/typescript/bin/tsc --noEmit -p cloudflare/tsconfig.json`. Expo iOS export `dist-overture-verified` passed2388 modules/67assets. Diff check passed (CRLF notices only). Existing iPad settings test harness now stubs credits component.
- NEXT: finish extraction/packing; validate and upload via `publish.py .cache/overture-us-filtered/2026-08-19.0 --upload --wrangler-cli C:/Users/patri/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js`; enable/deploy preview only after complete manifest. Live range/JSON/known business/empty/bad-request/cache tests, then enable production public edge route. Record actual rows/storage and active Worker versions. Documentation currently uses generic `.cache/overture-us` example; actual ongoing run is `-filtered`.
- Shared Watch changes are preserved; `app.config.js` now targets preview.6/public watch.1. No POI OTA or signed phone build published. Do NOT mislabel this working tree as compatible with installed Build6/preview.5. No commit/push/staging. Branch remains `codex/journeydeck-v2` at63ee33d.

## Apple Watch manual journey companion — September 5, 2026

- Product requirement confirmed by user: one JourneyDeck purchase must include iPhone, iPad, and Apple Watch. Verified effective app.config.js already sets supportsTablet:true for both variants, and Watch plugin embeds the paired companion in that same universal iPhone/iPad build. Keep a single public app record/purchase, preserve existing production bundle and products; no separately sold iPad/Watch app. Device entitlement is shared for the purchasing Apple Account; automatic installation remains the user's device setting. No pricing/store listing changes performed.
- Build10 submitted successfully: EAS job `d1d1a09d-dba7-4932-9020-21f79caf4bb5`, https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/d1d1a09d-dba7-4932-9020-21f79caf4bb5 . Session68851 exited0 after fingerprint. Native build outcome pending; no TestFlight/App Store submission.
- Archive fix: user's Build9 attempt failed BEFORE upload (2.3GB archive exceeds2GB limit). Added root `.easignore`, retaining root privacy/cache rules and explicitly excluding mobile dist/dist-* exports, generated native outputs, local design artifacts and Wrangler caches. No POI source/data/process changes or file deletion. EAS `build:inspect --stage archive` passed:294MB contents, required Watch sources/plugin/Swift tests/hook/lockfile/icon present; excluded directories may remain empty. Retry Build10 session68851 uploaded287MB successfully, computing fingerprint at latest check. User is Windows-only; Watch About has serial/IMEI rather than developer UDID. Recommended TestFlight to avoid Watch device registration, but no TestFlight submission/profile conversion has occurred. Existing ad hoc Watch profile still lacks Watch UDID. Next inspect new EAS job/native compilation; preserve V2 identity and seek concrete TestFlight distribution decision before submission.
- SIGN-IN RESOLVED by user in app terminal. Verified terminal: existing Patrick Stewart team/provider selected, host V2 profile reused, existing distribution certificate reused for Watch, Watch bundle registered and new ad hoc profile generated. EAS reports both targets' credentials ready and is compressing the source archive; latest build-list query still contains only Build6 and earlier (no new cloud job yet). Watch profile's displayed device list contains only iPhone and iPad, no Apple Watch: physical Watch device registration/profile inclusion remains required before claiming installability. Do not start a duplicate build or interrupt the user's terminal command. No code edits/tests this status check.
- Resume check: EAS build list still ends at completed Build6 (`4f678d8b-3db1-4ece-bac1-d6c78212f1db`); no Watch build submitted. Retried Apple authentication through `eas credentials --platform ios` / `v2-preview` (no build number increment). Saved session remains expired and prompts for password; canceled session2759 without reading/entering credentials. User must sign in directly before signing/build can continue. No implementation changes or repeated tests this check.
- Expo follow-up: user requested `Use expo`, authorizing the V2 preview EAS build. Added `eas-build-post-install` npm hook to run the standalone Swift policy tests on Expo's Mac builder. Focused Watch/failsafe tests16/16 and TypeScript pass. EAS authenticated as existing account and recognized both host and Watch targets; Watch needs a new provisioning profile. Noninteractive attempt could not generate credentials; interactive attempt found the saved Apple login expired and requested a password. Canceled terminal session83342 without entering credentials. No source upload or cloud build job was created; remote build numbers7 and8 were allocated during these attempts. User must authenticate directly in their terminal (never chat), using `npx eas-cli build --platform ios --profile v2-preview --no-wait` from `mobile/recorder`; then inspect actual build result/logs and resolve native errors. Expo terminal-open requests returned queued, so user terminal visibility is unconfirmed. No production submission/OTA/commit/push occurred. Preserve concurrent Overture work and processes.
- User approved an iPhone-paired Watch Start/Stop app in this repository and a ten-minute GPS inactivity stop. Implemented SwiftUI `mobile/recorder/watch/JourneyDeckWatchApp.swift`, native `JourneyDeckWatchBridge.swift`, and prebuild plugin `with-journeydeck-watch.js`. One primary button, confirmed state, connection/error handling, no independent Watch GPS/server/HealthKit. Commands expire after30s, are deduplicated, and Stop targets the exact native session; paired messages contain no coordinates/profile identity.
- New manual starts on iPhone and Watch share the existing isolated Swift inbox under `native_recording_manual_` IDs. Native `ManualJourneyInactivity.swift` persists its observation state, stops after10min of credible non-driving displacement, handles walking/drift/dense fixes, and resets on GPS gaps/poor or ambiguous evidence. No-GPS is not parking. Resume resets the interval;24h ceiling is checked on callbacks/status/recovery. Native stationary callbacks are enabled. Older Expo-owned sessions finish on iPhone; the old-binary fallback remains. JS legacy failsafe also now uses10min with observed GPS coverage.
- Updated recorder bridge/types/App controls, background music sampling/native sequence isolation, manual zero-point completion import, and account lifecycle fences (including shell cleanup) to prevent duplicate/cross-profile sessions. Added Watch build/config tests, inactivity/inbox regressions, and a standalone Swift policy test harness. See `mobile/recorder/watch/README.md` for exact architecture/build/physical acceptance steps.
- Source runtimes now `2.0.0-preview.6` / public `2.0.0-watch.1`; preview bundle and private CloudKit remain isolated. Installed Build6/preview.5 is unchanged. Watch target is `JourneyDeckWatch`, bundle suffix `.watchkitapp`, registered in EAS appExtensions config. No OTA, signed build, provisioning change, commit/push, or distribution occurred. Existing unrelated dirty V2/Places work preserved on `codex/journeydeck-v2` at63ee33d.
- Verification: TypeScript passed; full mobile suite274/274 passed; iOS export `dist-watch-verified` passed (2384 modules,67 assets); `git diff --check` passed apart from normal CRLF notices. Xcode-project object generation, embedding/dependency, versions, identity and idempotence tested for both variants. Log: ignored `mobile/recorder/.cache/watch/mobile-tests.log`. Expo iOS prebuild explicitly declines Windows; `node scripts/test-watch-native-policy.mjs` reports missing Swift compiler. Swift policy tests/native compilation are NOT verified.
- Next: on macOS run the native policy harness, generate/install pods/compile the iPhone+Watch targets, then make an authorized V2 preview build with separate Watch provisioning. Validate locked-phone Watch Start/Stop, simultaneous taps,10min parking/walking, resumed driving, poor/lost GPS, disconnects/relaunch, pause/resume, early stop without a fix, and profile-switch races. Check signed Watch/host version parity. No actual Watch UI or physical GPS behavior has been claimed verified.

## Combined Places Lab ratings — September 5, 2026

- Combined user Downloads/journeydeck-place-ratings.json (14 manual cases) with six assistant address tests. Preserved all ratings and assessor provenance; deduplicated by ID, zero duplicates. Repeated Best Buy/Walmart labels retained because export has no location to prove duplication. Twenty test runs, not verified twenty distinct destinations.
- Totals correct/partial/missing/error: Overture14/6/0/0; Foursquare11/9/0/0; OSM13/1/4/2. OSM errors at Target and later Walmart excluded from accuracy denominator. Matched18 complete tests: Overture14/18, OSM13/18, Foursquare10/18. Narrow Overture lead, mixed user/assistant assessment methods; no decisive winner claim.
- Outputs: artifacts/places-lab/journeydeck-place-ratings-combined.json and combined-results-2026-09-05.md. Original imports unchanged, no browser scorecard mutation or app/provider changes.

## Six supplied public-destination comparisons — September 5, 2026

- Ran all 18 real source lookups for the six addresses supplied by user; all succeeded. Used independent ArcGIS PointAddress pins and identical300m radius, common nearest-first ranking. Address pins, not actual parking positions. Nominatim fallback returned street-only/incomplete locations for some addresses and was not used for final pins.
- Overture6/6 exact businesses allrank1; OSM5/6 allrank1 but missed First Rate; Foursquare5 exact plus First Rate Plaza partial. Foursquare exact ranks: Cinemark6, Chilis1, SaginawWhataburger1, BlueMoundWhataburger2, OliveGarden2. Chilis has unresolvedclosedflag (not confirmed closure). OSM Chilis/OliveGarden lack address field, matched by name/location. Do not claim production visit-detection superiority based on this six-address sample.
- Report `artifacts/places-lab/six-destinations-2026-09-05.md`; machine-readable ratings beside it. Query outputs in ignored `.cache/places-lab-six-results.json`; contains public-business records only. No browser scorecard mutation, app code change, paid API, deployment, or token exposure. Local lab server/token remain active; batch process98048 completed0.

## Places Lab browser comparison tool — September 5, 2026

- Built isolated `tools/places-lab/` local browser app comparing actual Overture Places, original Foursquare Open Places, and OpenStreetMap named POIs. Public-place search, movable pin/manual coordinates, common radius/distance ranking, source-colored map pins, shared result text filter, source details/provenance/closure flags, manual Correct/Close/Missing ratings, local scorecard/export, dark/Warm Ivory themes, responsive layouts. Errors/disconnected sources excluded from scores. Map limits to 15 matching candidates/source; lists retain all candidates and selecting one reveals its pin.
- User signed into Places Portal and generated/pasted token directly into app password field. Verified Foursquare live Iceberg access (596 results in manual downtown Fort Worth 300m test, 16.6 seconds), Overture Aug19 release (272 results), OSM (53 results). Counts describe directory coverage, not accuracy; Overture includes Foursquare contributions. No paid Places API/SDK calls or account billing changes. Source inputs are selected public test locations; no app library/route/home/work access.
- Local Python server runs hidden PID52348 at http://127.0.0.1:8768/; opened in Codex browser tab5. Token exists only in server memory and isolated DuckDB query processes; restarting requires user reconnect. Do not dump token/process memory. Source subprocesses read inputs via stdin, no input logging, timeout100s; lookup cache memory-only, capped50/30min. Loopback Host/Origin/CSRF enforced. Ratings/theme persist in browser localStorage; exported ratings exclude coordinates, source records and credentials.
- Installed isolated pinned Python readers in ignored `.cache/places-lab-python`; no root/mobile dependency changes. Leaflet1.9.4 vendored with license. Eight focused Python behavioral/security tests pass; JS syntax passes; browser verified all three queries, scoring/storage/export payload exclusions, filtering/marker selection and dark/light rendering. Viewports1440 and390 verified no horizontal overflow. Browser QA used separate DevTools page2; temporary QA rating removed. Code/source files and handoff are uncommitted; existing dirty V2 work preserved on codex/journeydeck-v2/63ee33d. No mobile edits, OTA, native build, cloud deployment, commit/push.
- Movement SDK application is confirmed submitted and `SDK Application In Review`; user completed submission. Await Foursquare response; no SDK implementation. The comparison tool does not change the app's MapKit fallback. Next: user tests 20–30 known public destinations and exports ratings to choose the provider/matching strategy. See tool README for startup, scope and licensing.

## Foursquare-first POI investigation — September 5, 2026

- Account verified after user signed in: Developer Console organization shows Pay-As-You-Go, existing project DriveOS, SDK Disabled. Billing shows500 free Places Pro calls remaining, $0 credit balance, Automatic Payment Off; no recurring$9.95 subscription shown on this page. No keys generated/read, payments changed, or API calls made. Login requirement resolved; Chrome browser2/tab409407395 remains handoff-marked at developers/home; billing tab409407403 is read-only/intermediate. Future DOM snapshots must redact authenticated documentation-link query tokens before output.
- Current decision pending: async question offers (1) Foursquare Open Source dataset with a hosting/cost plan first, or (2) retain MapKit while user confirms permanent-storage permission with Foursquare. Open-data access is Iceberg/token plus own query/index infrastructure, not a documented drop-in radius-search URL; existing edge could remain stateless for user data but needs public POI storage/import. Standard current Places API PAYG guidelines still restrict non-ID caching; don't infer retention permission from API access/payment. No provider implementation or release yet; MEM2 remains current.

- Follow-up: user reports a paid Foursquare developer account at $9.95/month. Price does not identify verified plan/rights; current official published pricing is usage-based, and research reconfirmed restrictive usage-guidelines.md applies to current new Places API, not only legacy Personalization. Need actual account plan/agreement.
- Opened Developer Console through official Foursquare login links in Chrome. Login required; async question asks user to sign in directly in Chrome and report done, never credentials in chat. Handoff-marked Chrome tab409407395 on auth.studio.foursquare.com (Developer Console login), browser2/Chrome; landing tab409407391 is intermediate/ephemeral. CUA bindings this session: fsqChrome, fsqLogin. Next turn inspect fresh browser state and reuse/claim matching retained tab; no login/account mutations performed. App code/publication unchanged; no tests this follow-up.

- User requested replacing MapKit POI, then clarified Foursquare primary with MapKit POI backup. Intended order: local user-named places/valid cache, Foursquare, native MapKit POI, Apple reverse geocoder. No implementation, OTA, native build, deployment, account change, or secret mutation this turn.
- Audited actual flow: `mobile/recorder/src/journey-place-enrichment.ts` called nonblocking after primary archive data load; four sequential foreground endpoint lookups, MapKit160m acceptance, 30-day local cache, per-user in-flight dedup. Native fallback already installed. Existing `LocalPlace.foursquareId` and private place envelope support provider IDs/canonical aliases/iCloud; no schema change indicated. Edge root is `cloudflare/`, contrary to stale subsystem handbook path. Existing `/api/places/reverse` is coarse city-only Nominatim; preserve it for Music city summaries.
- Primary unresolved input: asked user asynchronously whether a Foursquare account/data license already exists, and its plan/access type (never key in chat). Read-only Wrangler secret-name lists found no Foursquare binding (preview contains LASTFM_API_KEY and SPOTIFY_CLIENT_ID; default returned empty). No credential values read. Sessions9735/1083 completed0; no task processes remain.
- Official paid API: places-api.foursquare.com/places/search, Bearer service key, X-Places-Api-Version2025-06-17; results fsq_place_id plus top-level latitude/longitude, categories[].fsq_category_id, radius is bias so locally enforce match distance/ambiguity. Standard usage guidelines prohibit persistent names/coordinates/categories for PAYG; enterprise defaults only24h local caching. IDs exception alone cannot support permanent journey labels/iCloud. Do not silently persist API attributes under those default terms. Sources: https://docs.foursquare.com/fsq-developers-places/reference/place-search and https://docs.foursquare.com/fsq-developers-places/reference/usage-guidelines.md (HTML omits policy body; Markdown contains it).
- Foursquare Open Source Places Apache2.0 license supports durable data with full LICENSE/NOTICE preservation and modification notice: https://opensource.foursquare.com/places-notice-txt/ . Current access https://docs.foursquare.com/data-products/docs/access-fsq-os-places requires Places Portal account/token and Iceberg catalog. Official Hugging Face alternative is gated. Documented public S3 PMTiles URL returned404 to HEAD/127-byte range; release/vector-tiles prefix empty, bucket onlyLICENSE/NOTICE. Do not build a live lookup against that missing file. No large data downloads performed.
- Next: obtain account/access answer, choose licensed API or authenticated open-data ingestion/hosting. Preserve exact endpoint matching on device: edge currently accepts only two-decimal grid, never expose exact route points/profile/history; skip sensitive Home/Work/School via getSensitivePlaces/findSensitivePlace before request (existing saved-name250m skip misses Home/Work300m boundary). Recheck AppState, active recording, saved names/privacy after awaits. Keep raw fetch solely network-request.ts; use requestPrivacyEdgeJson with short timeout and generic operation, no coordinate logs. Isolate provider failures so MapKit always runs when primary is unavailable/empty/ambiguous; retain final geocoder and local save independence.
- Verification this turn was read-only source/official-doc/access probing. No code edits or tests needed. Existing dirty V2 work preserved on codex/journeydeck-v2/63ee33d; MEM2 update01a07337-e19e-7dd2-bb49-641749e81d36 remains current. No commit/push. Prior memory-studio physical acceptance remains per notes below.

## iPhone Memory Studio implementation — September 5, 2026

- User approved phone mockup and explicitly requested replacing the iPhone Memories tab with animated drag/drop matching iPad. Added iphone presentation to existing `ipad-memories-screen.tsx` (name retained for compatibility): same gestures/drop hit testing/cancellation/edge scroll/local save callbacks; compact header artwork, two-column photographic Memory gallery, independently scrolling spring-expandable Journey tray with handle above native tabs, compact journey cards, native journey Edit/Share menu, keyboard avoidance, tap multi-select/add/create, loading/error/empty/history gates. `phoneStudioLayout` in model adapts columns/card/tray sizing for narrow screens and larger text. Tray body stays mounted when collapsed, inaccessible/no touches until expanded; gallery remains available. Real data only (mockup travel photos are illustrative).
- Shell phone journeys tab now uses studio with filtered accessible journeys, shared existing editor/photo/share/detail flow; other phone tabs/native bar/iPad layout unchanged. No new packages/native changes/schema/persistence edits in this turn. Existing full-record drop append/iCloud queue path retained. Release MEM2 / native Build6 / runtime2.0.0-preview.5, V2-only identity.
- TypeScript, full266/266, all14 individual mobile checks pass. Expanded actual rendered/gesture tests cover phone tray collapse/search/selection, phone/landscape/large text layout, theme header, native Edit/Share callbacks, drag create/add/new/cancellation, and disabled collapse during drag; iPad tests still pass. No native simulator on Windows: physical iPhone layout/keyboard/tab clearance and smoothness unverified.
- PUBLISHED and independently read back MEM2: update `01a07337-e19e-7dd2-bb49-641749e81d36`, group `b3307d5e-1efc-468a-8025-cacac6e5c4f8`, active v2-preview/runtime preview.5/V2 bundle/Build6. Final export `dist-phone-mem2` used explicit APP_VARIANT=v2-preview/INTERNAL_TESTING=0 then --skip-bundler. Export8708 and publish72577 completed0; no task processes remain. NativeTabs code confirms per-screen SafeAreaProvider owns native bar insets; phone SafeAreaView consumes all edges and adds only8pt visual gutter (avoids redundant bar padding). Focused phone/iPad tests pass after gutter correction; full266/266, TypeScript,14checks and export pass. Physical acceptance pending: restart V2 OTA and test phone tray/drag/drop/keyboard, native detail return and iCloud visibility. No commits/push/production changes; dirty branch codex/journeydeck-v2/63ee33d preserved.

## iPhone Memory Studio mockup — September 5, 2026

- User requested a phone adaptation mockup. Built-in image generation with approved iPad option2 as visual reference produced one Warm Ivory iPhone concept: two photo Memory cards, expandable Journey library tray below, lifted journey/drop highlight, existing five-tab bottom nav with orange Home. Inspected and saved `.ai/iphone-memory-studio/iphone-memory-studio-v1.png`, exact prompt in PROMPT.md. Illustrative images/data; no phone implementation, build or OTA changes. MEM1 iPad OTA remains current; awaiting concept feedback.

## iPad Memory Studio implementation — September 5, 2026

- User selected mockup 2, approved Reanimated/Gesture Handler animation approach, then requested creation. Implemented `ipad-memories-screen.tsx` and `memory-studio-model.ts`; iPad journeys tab now uses shared MemoriesScreen with studio flag, retaining existing native editor/photo/share/detail actions. Responsive 62/38 gallery/library, theme-matched shared cinematic header, search, bounded Show More, empty/loading/error/history states, tap multiselect/create/add, UI-thread drag lift/hover/drop/spring return, viewport-clipped drop targeting and edge autoscroll. Cancels on blur/background/resize/editor opening/source removal; frame loops run only during active drag. Reduce Motion respected. iPhone layout/native tabs/Statistics unchanged.
- New `appDataClient.addJourneysToMemory` reads full latest profile-owned SQLite Memory at drop time; preserves hidden memberships, notes/artwork/cover, deduplicates, rejects missing/deleted/foreign data and marks new sync revision. Studio edit loads full catalog record before opening shared editor and preserves its artwork key. No new packages/native modules/schema changes. Existing dirty V2 work preserved on codex/journeydeck-v2/63ee33d, no commit/push or production change.
- TypeScript, full264/264, all14 individual mobile checks pass. New rendered gesture/controller tests cover actual drag handlers, create/add/cancellation, width/theme/search/selection retention, busy/failure recovery; real SQLite/sync test verifies append/revision/isolation/deletion/idempotency. iOS export `dist-ipad-mem1` passed (first attempt corrected nonexistent v2 header filename to existing v1 mapped artwork). MEM1 release uses Build6/runtime2.0.0-preview.5. Physical iPad motion/visual/portrait/sidebar acceptance remains unverified on Windows.
- PUBLISHED MEM1 final: update `01a07323-3300-7db6-a943-f82aa7a2e101`, group `0638fe20-d2cb-4171-80db-95e43ca58c13`, v2-preview/runtime preview.5. Final export `dist-ipad-mem1-final` used explicit APP_VARIANT=v2-preview/INTERNAL_TESTING=0 then --skip-bundler; publish88353 completed0. Channel readback saved there. Final adds whole-page UI-thread edge scrolling when narrow panels stack and legible dark-theme filled-button text; gesture test verifies outer scrolling and frame-loop cleanup. Final focused tests/typecheck/full264 pass, no running processes. Supersedes first MEM1 update01a07320 (group704d47b2). Physical iPad acceptance pending: restart OTA, drag onto Memory/another journey, test portrait/sidebar and source-to-other-panel scrolling; newly saved changes queue existing iCloud sync. Four mockup files remain under `.ai/ipad-memories-concepts/`.

## iPad Memories mockups — September 5, 2026

- User wants to finish tabs, starting with a spacious card-centric Memories tab: drag journeys together to create a Memory and onto existing Memories to add, polished smooth animation. Requested FOUR image mockups, allowed additional libraries if later needed. Created four separate Warm Ivory landscape iPad images with built-in image generation, inspected them, saved under `.ai/ipad-memories-concepts/`: 01-gallery-tray.png, 02-memory-studio.png, 03-story-gallery.png, 04-scrapbook-canvas.png. Full prompts in PROMPTS.md. Existing five native-style tabs, orange Home, cinematic artwork/title and plum/lilac styling guide concepts.
- Design-only: no app code, dependency, build or OTA change. Sample photos/data/ancillary controls are illustrative; stills depict proposed drag states, not implemented animation. Option2 provides practical persistent journey-library pane beside large memory cards; recommend it as implementation basis, pending user choice. S7 remains current published OTA; pending physical iPad photo visibility acceptance noted below.

## Missing photo path recovery (S7) — September 5, 2026

- Physical follow-up confirmed: user reports S7 seems to have worked; iPhone screenshot shows “Private iCloud sync finished”, 0 uploaded/0 downloaded, Settings Synced, and no remaining-item/error message. The previously pending photo no longer blocks the current sync status. This particular screenshot does not show the earlier upload or prove the photo is visible on iPad; final cross-device photo visibility remains unverified.

- User S6 screenshot identifies Photo1 in Test memory, ref e6ce8d77: file missing at stored URI. This confirms the item, not actual byte deletion. Inspected app-data save: absolute FileSystem.documentDirectory + journeydeck-private-photos/{encoded local user}/{local_UUID}.{ext} persists forever; display/upload formerly never rebased. Implemented private-photo-file.ts shared resolver in display and sync preflight. Existing valid URI wins; otherwise check exact profile/photo-ID/type suffix under current Documents, only for recognized local app photo IDs and matching original file URI. No directory search, cross-profile fallback, file writes/deletes, or replacing missing photo with other content.
- local-store repairPhotoLocalUri updates only URI via user/id/old-URI/deleted_at-null compare-and-set. Revision/ack/time unchanged; native downloaded Application Support paths intentionally not handled by this focused app-authored Documents fix. Actual missing files still report S6 details. Three added real SQLite/filesystem fixture tests cover relocated synced/pending photo, identity/traversal/missing rejection, concurrent removal; full260/260, TypeScript, targeted11/11, all14 individual checks, iOS export and diff check pass. Existing dirty V2 branch codex/journeydeck-v2/63ee33d preserved; no commit/push, native or production change.
- PUBLISHED and independently verified S7: update `01a072da-e246-7a63-99f0-fd6535ada944`, group `9e976dc4-ae62-4887-8407-ac001e25363a`, active v2-preview/preview.5/V2 bundle/S7 release label. Export dist-icloud-s7 then --skip-bundler after explicit preview/INTERNAL_TESTING0 export; publish session56585 exited0, no task process remains. Physical recovery remains unverified; ask user to restart OTA and Sync iPhone, report whether pending photo clears. If the exact file is actually gone, user must re-add/recover the original; never silently delete the pending record.

## Remaining iPhone sync item diagnostics (S6) — September 5, 2026

- User asks how to identify the remaining item after S5 iPad success/iPhone 1 pending. Implemented local UI issue details in cloudkit-sync.ts/icloud-sync.ts: missing/empty/uncheckable photos, missing dependencies, native per-record failure code descriptions. Photo labels include Memory title/position and stable hashed record reference; music uses track title. Bound visible details to five plus remaining count. Never include asset paths/raw metadata or send diagnostic content to telemetry. Shell shows details in existing Settings status and manual alert; partial title is needs attention/incomplete, pluralization fixed, no repeated Sync advice for missing assets. No deletions/acks/repair or auto-sync schedule changes.
- TypeScript, targeted11/11, full257/257, all14 required individual checks, diff check and iOS export passed. Expanded real coordinator tests cover native quota rejection propagation and dependency detail reset on successful retry; missing-file privacy/bounded detail and actual Settings alert checks pass. Existing dirty V2 branch codex/journeydeck-v2/63ee33d preserved; no commit/push, native or production change.
- PUBLISHED and independently verified S6: update `01a072d0-6089-7d38-8cad-ed577a087c35`, group `0c0b8d94-5272-4d29-a358-3918471da431`, active v2-preview/runtime2.0.0-preview.5/V2 bundle. Export `dist-icloud-s6` with explicit APP_VARIANT=v2-preview/INTERNAL_TESTING=0 then --skip-bundler publication session16039 exited0. No task process remains. Device cause remains unknown until user restarts S6, taps Settings iCloud Sync, and shares the detailed result. No data removed or remaining item marked synced.

## Complete private library restoration (S5) — September 5, 2026

- Physical follow-up: user says iPad seemed fine; iPhone screenshot shows 0 uploaded/0 downloaded, 1 will retry, 1 item pending. Exact record/cause is not identified by this summary (earlier missing photo is a hypothesis). User asks whether both apps auto-sync on opening: verified shared shell mounts sync and retries on AppState active, with 15-minute successful-sync cooldown; manual Sync forces a check. No implementation or publication this follow-up. A remaining-item diagnostic would be the next investigation if requested; do not claim the last item is fixed or all physical data verified.

- User confirmed S4 iPhone sync works; iPad failed with SQLite19 unknown canonical place. User explicitly rejected clearing foreign place references: all library content needed for iPad exploration must sync. Implemented canonical place transfer via existing private `PrivatePreference` envelope (`library.place.v1.*`), so no native/schema build is required. New `private-place-record.ts` validates bounded place values; `local-store.ts` backfills existing places, queues edits/tombstones, preserves cloud identity and profile-owned aliases, maps saved slots across local profile IDs. Journey import resolves canonical IDs before SQLite insert; never bypasses constraints or silently strips unresolved references. Route restore now fills summary endpoint coordinates from private GPS assets.
- `cloudkit-sync.ts` restores private places before journeys/routes/music/photos. Deferred dependencies retain the old pull cursor in `icloud-sync.ts`; independent records and uploads still proceed. Journey conflict time uses the application updatedAt, matching native conflict handling. Missing photo files remain pending and cannot starve later valid photos. Settings shows remaining upload work; incomplete queues bypass the normal successful-sync cooldown. Existing 5-batch bound retained: repeat Sync when Settings reports remaining work.
- Added 7 behavioral tests executing real local store migrations/constraints, sync engine/coordinator and Atlas with separate Node SQLite device databases and mocked native transport/filesystem: complete reverse-order restoration; dependency retry/cursor commit; profile isolation; edits/deletes; saved Home recreation; missing-photo pagination. Updated Settings fixture/remaining-work assertion. Full256/256, TypeScript, all14 required individual checks, git diff check and iOS export `dist-icloud-s5` pass. Existing dirty V2 work preserved; branch codex/journeydeck-v2 at63ee33d. No commit/push or V1/production changes.
- PUBLISHED and independently verified S5: group `928fb84a-2312-4751-9108-8b4f81fc9f49`, update `01a072c6-8207-7405-9218-d270b7159b5d`, created2026-09-05T18:13:27.175Z, active v2-preview/runtime2.0.0-preview.5. Readback confirms V2 bundle/container, Build6 and S5 label. Exported with APP_VARIANT=v2-preview and INTERNAL_TESTING=0, uploaded --skip-bundler because remote preview env sets INTERNAL_TESTING=1. Readback files live under ignored `dist-icloud-s5/`; publication complete, no task build process pending. Both devices must receive S5; sync source iPhone first to upload backfilled places, then iPad. Physical acceptance pending. iPad Memories/Statistics UI tabs remain blank from earlier scope; this task fixes underlying library sync, not those layouts. Never delete app/data as sync repair.

## V2 iPhone OTA delivery investigation — September 5, 2026

- User supplied physical iPhone Data Health screenshot confirming APP2.0.0 native Build5, RUNTIME2.0.0-preview.4, v2-preview channel, update short ID01a06f6e (Card Context Menus). Root cause confirmed: current OTAs target preview.5 and are correctly incompatible with installed preview.4. Repair is to install Build6 `4f678d8b-3db1-4ece-bac1-d6c78212f1db` over the existing V2 app without deleting it, then launch/relaunch to receive latest T2. Do not publish preview.5 content to preview.4.
- User reports V2 iPhone no longer receives OTAs. Read-only EAS inspection confirms channel `v2-preview` is active and points to latest T2 update `01a07247-85e1-7454-ba3b-4c1e4a1c7720`, runtime `2.0.0-preview.5`. Latest universal internal Build6 `4f678d8b-3db1-4ece-bac1-d6c78212f1db` has bundle `com.journeydeck.recorder.v2`, channel `v2-preview`, runtime preview.5. Server-side routing is correct.
- Most likely iPhone still has Build5/runtime preview.4 or another older V2 binary; such a build correctly rejects preview.5 OTAs. Alternative is iOS never fully terminated/relaunched, so the normal on-launch check has not run. Need physical device Data Health values (APP/native build, RUNTIME/channel, UPDATE ID) to distinguish. Do not delete the app because local V2 data may be removed; an over-install of Build6 is the likely repair if runtime is old. No code/config/EAS mutation this investigation turn.

## iPhone Statistics widget spacing — September 5, 2026

- User reported T1 did not resolve the visible spacing. Replaced flex+gap with deterministic three `33.333333%` slots and symmetric 5pt horizontal padding; parent -5 margin keeps outside edges aligned and yields exact 10pt internal gutters. Added structural regression assertions requiring three slots and banning row gap. This is T2; T1 is superseded.
- PUBLISHED and independently read back T2: group `ae43faaa-c72f-477a-ba4e-de2c1d3c2dac`, iOS update `01a07247-85e1-7454-ba3b-4c1e4a1c7720`, v2-preview / same Build6 runtime2.0.0-preview.5. Full249/249, TypeScript, focused38/38 and iOS export `dist-statistics-t2` passed. Publication session75306 exited0; no processes remain. Open V2 and Restart now; physical acceptance pending.
- User supplied iPhone screenshot with uneven gaps between Longest drive / Most-played / Favorite time. Added identical flex1/minWidth0 outer cells around each feature in primary-sections.tsx, 8pt row gap, cards fill their cells. This isolates the native Link/menu host from sibling gap sizing; native tap zoom/context menu retained. No theme/content/iPad changes.
- TypeScript, focused38/38 card-detail/tab checks, all required individual subsystem checks, diff check pass. No new tests for this small style correction. Physical spacing acceptance pending. Prior dirty work preserved on codex/journeydeck-v2/63ee33d; no commit/push/production changes.
- PUBLISHED and independently read back: group `f9ea2e9c-ff4a-4f11-849f-350e446e619c`, iOS update `01a0723e-3f15-773b-bb8f-45ba1f353ee1`, v2-preview / V2-P5-T1 / same Build6 runtime2.0.0-preview.5. Export dist-statistics-t1 passed with INTERNAL_TESTING=0, --skip-bundler publication session69584 exited0. No processes remain. Open V2 and Restart now; physical spacing acceptance pending.

## Soundtracks gallery and matching iPad headers — September 5, 2026

- User approved new Soundtracks option 2 and requested all already implemented iPad tabs use artwork behind titles with matching font/size. Implemented responsive six-cover gallery (+Show more), side column with 2×2 metrics, artists and compact seven-day chart, and full-width existing searchable/paged history. Real data/source link rules/refresh retained. Narrow gallery adapts 3/2/1 columns; summary stacks below under960pt. No streaming controls or mock data added.
- Added shared `ipad-page-header.tsx` for Home, Soundtracks and Settings, each using its existing theme-mapped artwork as the background with readable gradients. Shared system title font weight600/spacing2, 36pt or28pt below600pt actual usable canvas. Home recorder remains mounted inside header; phone/native tabs and blank iPad Memories/Statistics unchanged. Both themes supported.
- Updated actual rendered Home/Music/Settings tests for shared typography, gallery sizing/paging, resize/search/recorder persistence, theme artwork, source links and existing settings callbacks. Focused11/11, full249/249, TypeScript and all required individual mobile checks passed; diff check passed. Physical layout acceptance pending (Windows, no native simulator). Existing dirty branch codex/journeydeck-v2/63ee33d preserved; no commit/push or production changes.
- PUBLISHED and independently read back: group `4bc3731f-66ce-40b1-83cf-161ab9e2866d`, iOS update `01a071ea-e408-7aa1-9e31-912189e3bc76`, v2-preview / V2-P5-M2 / Build6 / runtime2.0.0-preview.5. Export `dist-ipad-m2` passed with INTERNAL_TESTING=0; --skip-bundler publication session95553 exited0. README updated; no processes remain. Open V2 and Restart now. M2 supersedes S2; physical gallery/header acceptance pending.

## Soundtracks mockups — September 5, 2026

- Created three new iPad Warm Ivory Soundtracks concepts: dashboard, album gallery, archive workspace. Built-in imagegen; saved all images and exact prompts in `.ai/ipad-soundtracks-concepts/`. Illustrative data and native navigation rendering; no new feature commitment. No application edits, tests, builds or OTA this turn; S2 remains current. Await layout selection.

## iPad Settings option 3 grid — September 5, 2026

- User selected option 3 with aligned top buttons, identical three-column rows for preferences and saved places, and a slim three-column Advanced Support / Privacy Policy / Support Page footer. Implemented `ipad-settings-screen.tsx` in both themes, connected from existing ConnectionsScreen. Profile and Apple sections share account panel; iCloud is adjacent, all top action slots use matching height and vertical position. Actual native sidebar-adjusted canvas and font scale determine three-column vs narrow stacked layout. Existing console artwork, theme switch, real account/cloud/membership/provider/place state and callbacks; native tabs and phone layout unchanged. Shared internal music controls retain their internal-build/expanded gates.
- Existing profile/place editors, destructive-action confirmations, Apple authentication, sync engine and data isolation preserved. Support Page opens existing public `/support` (HTTP200 verified). No new account state or fabricated data. Rendered tests cover matching row widths at 1100/720/460/restored widths, both themes and expanded-state persistence, Apple/sync busy guards, provider/membership/diagnostics callbacks, place/profile editors and footer URLs.
- TypeScript, focused Settings tests, full249/249, all required individual mobile checks, diff check and iOS export passed. Physical iPad visual/sign-in/cloud acceptance remains pending; no simulator on Windows. Branch codex/journeydeck-v2 /63ee33d; existing dirty V2 work preserved. No commit/push or production release.
- PUBLISHED and independently read back: group `3cc8f1d0-e80b-4721-85f0-e4108db59e63`, iOS update `01a071bb-593b-7b45-b819-900828c9ca40`, v2-preview / V2-P5-S2 / same Build6 and runtime2.0.0-preview.5. Export `dist-ipad-settings-s2` with INTERNAL_TESTING=0 then --skip-bundler; session66557 exited0. Open V2 and accept Restart now. No processes remain. S2 supersedes S1; physical layout acceptance pending.

## iPad Settings design concepts — September 5, 2026

- Created three Warm Ivory landscape Settings mockups with built-in image generation: two-column dashboard, category-sidebar workspace, and compact overview grid. Saved under `.ai/ipad-settings-concepts/` with exact prompts in `PROMPTS.md`.
- Design-only turn; no application edits, tests, builds or OTA publications. Existing S1 preview remains current. Await user layout choice. Generated account states are illustrative; implementation must show sign-in/sign-out conditionally.

## iPad Settings and iCloud activation — September 5, 2026

- PUBLISHED and independently read back: group `59feed4c-78fd-477c-8e3b-a58e63d232b3`, iOS update `01a07175-1ee9-781a-b890-36d6f888e0de`, v2-preview / preview.5 / S1. Session31428 exited0; no processes remain. Open V2 and Restart now. Supersedes publishing note below. Physical sign-in/sync acceptance remains pending.

- User accepted Music and requested full Settings to sign in and sync iPhone data. Replaced iPad theme-only route with the SAME ConnectionsScreen factory/handlers as iPhone: native Apple profile sign-in, iCloud Sync, account actions, membership, saved places, music selection and support. Added SettingsScrollView for overview/editors: native sidebar horizontal insets, automatic vertical insets, centered max760pt content on iPad; phone passes original ScrollView props unchanged. Theme switch retained. Added same-account/profile/source-device-first guidance on iPad; no credentials collected.
- Corrected post-sync refresh to reload shared primary sections (Home/Music library snapshot), rather than only legacy independent slices. Sync failure copy uses correct device; unavailable button says Update app. Existing auth/CloudKit engines, confirmation flows, profile isolation, recording guard, native modules and container entitlements unchanged. Preview remains separate from V1: use SAME iCloud account plus SAME Apple-linked driver profile in BOTH JourneyDeck V2 apps; sync iPhone first then iPad. User informed V1 data won't automatically appear in V2 container.
- TypeScript, 3 new Settings tests and full249/249 pass; diff check and iOS export pass. New tests render actual ConnectionsScreen callbacks/busy guards, viewport persistence and phone contract, and execute actual sync callback for success/no-account refresh behavior. Native Apple sheet, real private cloud transfer and iPad layout acceptance pending; no physical-device proof yet.
- V2-P5-S1 / Build6 / runtime2.0.0-preview.5. Final export dist-ipad-settings-s1 with EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=0; publishing --skip-bundler to v2-preview in session31428. Verify read-back before delivery. No native build, production change, commit/push or data migration. Existing dirty work preserved; README updated. Previous unused IpadSettingsScreen helper remains but is no longer routed; no cleanup scope added.

## iPad Music option 1 implementation — September 5, 2026

- PUBLISHED and independently read back: group `2e03a568-ddbc-43d2-9e59-20c5fa337c50`, iOS update `01a0716b-cb68-7c3b-85b6-ced47fefa344`, v2-preview / preview.5 / M1. Session20173 exited0, no processes remain. Open V2 and accept Restart now. Supersedes publishing-in-progress note below; physical iPad Music acceptance remains pending.

- User selected option 1. Implemented ipad-music-screen.tsx in both themes with existing panoramic header assets, 4 responsive metrics, horizontal album artwork, top 5 artists, searchable/paged song/artist/journey/time archive and seven-day duration chart. Native left/right safe area + automatic vertical scroll insets; actual canvas onLayout selects side-by-side panels at 960pt, stacked narrower, compact history under 640pt. Search/history expansion survive resizing; source links and Journey actions reuse MusicScreen controller. iPad shell now exposes Music, filters history by membership, preserves other blank tabs and Settings theme switch. iPhone rendering, Home, recorder, native tabs and accepted rotation labels unchanged.
- Existing dashboard daily arrays were empty. Added ipad-music-data.ts: aggregates seven LOCAL calendar days from the unfiltered accessible loaded archive's saved durations/timestamps, excludes future/invalid times and unknown/invalid durations, labels duration basis. Search does not change chart. No invented records, connection status or playback controls. Album taps use existing provider destinations; Shazam remains non-linking. Loading/errors/zero/empty states supported.
- TypeScript, 3 new rendered/data tests, full 246/246 tests, diff check and iOS export passed. Tests exercise actual MusicScreen search, paging, links, refresh, manual-source disabling, both themes, narrow/wide/narrow host identity and calendar data. No iOS simulator on Windows; physical Music appearance, artwork crop, sidebar/portrait/touch acceptance pending.
- Release V2-P5-M1 / existing Build 6 / runtime 2.0.0-preview.5; verified .v2 identity. Final export dist-ipad-m1-release with EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=0; publishing pre-export --skip-bundler to v2-preview in session20173. Verify publication/read-back before delivery. No native build, production changes, commit or push; prior dirty work preserved. README now marks older build/runtime references historical.

## iPad Music layout concepts — September 5, 2026

- User confirmed I4 rotation label correction: "Perfect." Requested three image mockups for Music making full use of iPad space. Built-in imagegen produced Warm Ivory landscape dashboard, album gallery and history-centered library variants, saved under .ai/ipad-music-concepts with exact prompts in PROMPTS.md. Images shown inline. Design only; no app implementation or release. Records/charts are illustrative, native bar depiction approximate; generated ancillary descriptions/units are not new feature commitments.
- Recommend option 1 for balance and consistency with existing Home. Selection pending. Existing Music sections inspected to ground concepts; app source untouched this turn. I4 accepted; previous pending device-verification note superseded for orientation labeling.

## Devpost Shipaton draft — September 5, 2026

- Filled and saved JourneyDeck v2 in external Chrome: https://devpost.com/software/journeydeck-v2 (submission 1171743, RevenueCat Shipaton 2026). Saved pitch, story, eight verified stack tags, website, iOS platform, Design/HAMM descriptions and judge draft notes. Uploaded existing 1024px master app icon to gallery and thumbnail; confirmed icon requirement. Preview read-back verified saved content; entry remains INCOMPLETE/DRAFT. Final terms not accepted; entry not submitted.
- User confirmed no demo video exists. Remaining: public demo video, required 1179x2556 unframed screenshot, eligible live App Store URL, RevenueCat integration/project ID, and premium judge access. Source uses StoreKit 2 directly; no RevenueCat SDK references found in mobile source/modules/package. Story distinguishes current V2 preview from roadmap. Rules require first public store release during event; verify eligibility before submission.
- Branch codex/journeydeck-v2 / 63ee33d; existing dirty work preserved. No app changes or tests; browser save/read-back verification only. Chrome tab 409406602 left on project preview. No commit, push, deployment or app release.

## iPad orientation label correction — September 5, 2026

- User reports I3 labels are reversed on device. Comparison was correct; global Dimensions timing is suspected, not proven. Replaced useWindowDimensions with useSafeAreaFrame in native-navigation.tsx so labels follow native provider layout measurements. Still height > width => Stats on iPad, otherwise Statistics; no flipped inequality, remount, native change or iPhone label change.
- Native source confirms safe-area provider updates frame from layoutSubviews; global DeviceInfo also samples dimensions on device-orientation notifications. Tests now mock native frame and reject use of global window hook; existing portrait-landscape-portrait and host identity assertions pass. TypeScript, full 243/243 tests, diff check and iOS export dist-ipad-i4 passed. Real iPad correction/overflow acceptance remains pending.
- Published V2-P5-I4 to v2-preview / runtime 2.0.0-preview.5 / Build 6: group 245f35bd-98ea-4a58-a1e3-2deb92584fe9, update 01a07158-fb43-7565-9afd-3dab81982550. Publish session31733 exited0. Explicit EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=0 during pre-export, then --skip-bundler. No production change, native build, commit or push. Existing dirty V2 work preserved. Supersedes I3; user should restart V2 and verify both rotations.

## Adaptive iPad Stats label — September 5, 2026

- Implemented user-approved label change in native-navigation.tsx: useWindowDimensions selects Stats for iPad windows taller than wide, Statistics otherwise; iPhone remains Statistics. Same native host/routes, sidebar, colors and state. Rotation/window resizing updates the label without a host remount. No explicit native bar width override.
- TypeScript, native-navigation 7/7 (portrait-landscape-portrait and host identity), full mobile 243/243, git diff --check and iOS export dist-ipad-i3 passed. Physical iPad fit/glass behavior remains unverified; do not promise shorter label eliminates overflow.
- Published and independently read back v2-preview OTA group 3fe7781e-903a-4084-a226-9eef088c0d53, iOS update 01a07153-0d89-7c0f-a645-ef6dd0a9aee2, runtime 2.0.0-preview.5 / existing Build 6, release V2-P5-I3. Pre-export then --skip-bundler; publishing session16977 exited0. Open V2 and accept Restart now. No native build, production mutation, commit or push; existing dirty work preserved. Supersedes investigation-only status below.

## iPad portrait native tab width investigation — September 5, 2026

- User requested widening the native top bar so all five existing tab names fit in portrait. No app changes or release performed: installed Expo Router 57.0.19 exposes no native bar width property; Apple's documented UITabBarController API has no preferred floating-bar width. Do not claim a width fix is implemented or deploy a speculative private-view/frame override.
- Recording in attachment 060E3390-2318-4CBB-A3FE-010367DCD584 shows overflow chevrons and horizontal label scrolling in portrait; landscape fits all tabs and displays the moving glass selection lens. Glass background remains in portrait. Overflow is the leading explanation, not an Apple-confirmed intentional loss of the lens. Existing equal-spacing plugin explicitly excludes iPad; native-navigation.tsx has no portrait glass toggle.
- Checked Expo versioned native-tabs docs and installed native bridge, Apple UITabBarController/UITabBar documentation. Next viable experiment needs user direction: compact labels/type to fit within system width, or a separately scoped custom bar. User specifically requested a longer bar, so neither substitute was applied. Preserve native sidebar, existing names, themes and iPhone behavior. Branch codex/journeydeck-v2 / 63ee33d, existing dirty V2 work preserved; no tests needed for research-only handoff.

## iPad sidebar overlap and orange accent correction — September 5, 2026

- OTA PUBLISHED and independently read back: group `cedc896b-1186-41d1-8c38-1edffbf08a17`, iOS update `01a07132-c364-7e2a-9535-52c816053d4e`, v2-preview / runtime preview.5 / release V2-P5-I2. Session29699 exited0. Open V2 on iPad and accept Restart now; no new native build. Physical check pending: sidebar open/closed, narrow windows, Settings switch clearance, neutral non-Home sidebar/topbar colors in both themes. Supersedes publishing-in-progress note below.

- User confirmed Build 6 installs/runs and looks great, then supplied screenshot showing native sidebar occluding left side of Home. Agreed to correction; clarified only Home should carry orange navigation accent. Astra High recommended.
- `ipad-home.tsx` wraps Home and theme-only Settings in native SafeAreaView with left/right edges, so the sidebar-reported safe-area width reduces the actual ScrollView viewport and canvas onLayout drives existing responsive columns. Retains automatic vertical scroll insets. No fixed sidebar width, custom navigation or recorder remount.
- `native-navigation.tsx` uses neutral iPad host tint and default/selected labels/icons in both themes; Home retains original orange image and orange selected label. iPhone palette/order unchanged. Existing Expo APIs only; no binary/dependency/runtime change. Release V2-P5-I2, runtime preview.5 / Build 6.
- TypeScript, required individual mobile checks, focused 12/12, full 243/243 tests, iOS export dist-ipad-i2 and git diff --check pass. Resizing regression covers wide/narrow/restored viewport with one recorder mount; native iPad safe-area delivery and sidebar appearance still require device verification. Publishing pre-export INTERNAL_TESTING=0 with --skip-bundler to v2-preview in session29699; verify read-back before delivery. No production/website/commit/push changes; prior dirty V2 and website work preserved.

## Homepage accent refinement — September 5, 2026

- COMPLETE: PR142 merged as 7aa4756ce2f603b6f8d19b377eaa6b56f13a6810; CI33961635736 all checks passed. Render dep-dadv9anavr4c73aoke10 LIVE on exact merge at 10:54:30 UTC. Live HTML/CSS/JS normalized content and asset bytes match release, public/health/legal/login routes200 and app redirects to login. Browser confirms cinematic-2 stylesheet, dark rounded control, unrotated dark caption, two route marks/zero starbursts; console and Render error logs empty. Live tab6 retained at homepage. Local fixture preview stopped. No remaining task.

- User flagged bright round discovery arrow, orange circular sticker and purple starbursts as unlike the app. Replaced with dark rounded-square SVG arrow control, compact plum glass caption (same text, no rotation), and two thin decorative coral route marks. Reused app raised surfaces, subtle border and inset accent conventions. All copy, navigation/motion, branding, X and V2 behavior retained.
- Production worktree C:/Users/patri/.codex/tmp/journeydeck-cinematic-release now branch deploy/20260905-website-accents from origin/main16a88c2. Commit261fac7, PR142 https://github.com/drumpat01/DriveOS/pull/142 merged. Only web/landing.html, web/landing.css and existing API asset URL assertion; CSS cache key cinematic-2. Selected local mockup HTML/CSS also synced. No mobile/dependency/auth/data changes.
- Focused API12/12, Deploy-DriveOS.ps1 -PreflightOnly output confirms release preflight passed (existing SQLite-runtime skips), diff check pass. Browser desktop and 390px phone screenshots checked; zero horizontal overflow/clipped caption, phone arrow46x46, discovery anchor navigates, two route marks/zero starbursts, console error/warnings empty. Viewport reset. Publication complete; unrelated dirty V2 work preserved.

## Website published and verified — September 5, 2026

- COMPLETE: PR141 merged as 16a88c226d34728d537a7e997bd3206cd620a96a at 04:27:40 UTC. Full CI run 33944384496 SUCCESS (application, browser, security, preflight, characterization and frontend checks). Render production deployment dep-dadpkfmq1p3s73cg89d0 reports LIVE at 04:28:55 UTC on that exact merge commit. https://journeydeck.me serves the approved design.
- Live verification: homepage/CSS/JS content matches release (line-ending normalized); coast and real icon bytes match exactly. Root, readyz, privacy, support, login all 200; anonymous app redirects to login. Render error log empty since deployment start. Browser confirms real icon loaded without filters, white/coral wordmark, visible X navigation, only system sans-serif fonts, no desktop overflow, V2 section and working theme toggle. Final opening screenshot visually correct after navigation; initial browser capture had stale missing text layers despite correct computed styles. Live tab6 marked deliverable. Local phone layout was verified before publication.

- User authorized publishing selected cinematic option 2, prominent X navigation and exact app logo/wordmark. Mockup now uses identical mobile dark icon, white Journey/coral Deck wordmark, responsive X button; all type remains sans serif and approved copy/motion retained.
- Isolated production worktree C:/Users/patri/.codex/tmp/journeydeck-cinematic-release, branch deploy/20260905-website-cinematic from main 56e7cee, head ba5148f. PR https://github.com/drumpat01/DriveOS/pull/141 merged. Homepage HTML/CSS/JS/coast image, API assertions, deterministic Assistant test clock, exact historical EAS UUID scan fingerprint, and lockfile-only fast-uri security patches 3.1.7/4.1.4 (CI found existing advisories). No mobile/data/auth/config changes. Updated dependency passes 34 server tests and fresh Trivy zero high/critical findings.
- Server 34/34, typecheck/lint, JS syntax, actual public asset/auth checks, desktop/mobile layout/toggle/branding/CSP and complete release preflight pass. CI initially found historical EAS submission UUID false positive; .gitleaksignore excludes only exact fingerprint and full history scan passes. Assistant test first-days-of-month baseline failure fixed with explicit fixture clock.
- IMPORTANT existing Deploy-DriveOS.ps1 defect: nested preflight failed but wrapper continued to commit/exit 0. Caught; independent tools/Test-ReleasePreflight.ps1 passed after test fixture fix. Wrapper defect left out of website scope. PS SQLite runtime-unavailable cases skip locally as before; Node SQLite tests pass.
- Publication complete, no remaining website task. Render CLI C:/Users/patri/bin/render.exe authenticated in correct existing workspace. Original mockup port4318/session46198 retained; production fixture preview port4320 stopped (process exit verified). Preserve unrelated dirty V2 source tree; root branch remains codex/journeydeck-v2/63ee33d and was not used for production publishing.

## Option 2 selected — app-matched cinematic reskin — September 4, 2026

- User loves option 2's behavior and copy; requested only colors/fonts matching the actual app. Updated only editorial-specific CSS skin and theme-color metadata in docs/design/website-v2-mockups. Near-black/plum surfaces, coral/pink/violet accents sourced from primary-sections.tsx/neon-widget-outline.tsx; system UI sans-serif throughout; user explicitly corrected all fonts to sans serif, including accent headlines, captions and V2 preview. V2 toggle retains both modes using app ivory/dark colors. Original option 1 untouched.
- Verified HTML unchanged byte-for-byte after normalizing the one theme-color value; motion.js/shared.css hashes unchanged. Desktop and 390px phone have no horizontal overflow/broken images. Both toggle states and reduced-motion reveal visibility checked. Saved concept-02-cinematic.png and concept-02-cinematic-mobile.png; prior screenshots retained. Full-page screenshot capture unavailable this turn; opening and mobile screenshots succeeded.
- Local preview remains http://127.0.0.1:4318/editorial.html (server session 46198). Normal motion and viewport restored. Branch codex/journeydeck-v2 at 63ee33d; no production homepage/mobile edit, dependency change, commit, push or deployment. Existing unrelated V2 work preserved. Next: user reviews this reskin; production adaptation still requires current main/live reconciliation and authorized publish workflow.

## Website redesign comparison — September 4, 2026

- User requested two less-generic website mockups with scroll effects, App Store submission/coming-soon copy, and V2 light mode, iPad, Tessie for Tesla owners, and more. Created isolated `docs/design/website-v2-mockups/`: cinematic The Long Way and editorial Field Notes; complete responsive HTML/CSS, scroll parallax/reveals, illustrated route draw / moving keepsakes, working theme preview buttons, original generated coast asset, desktop/mobile/full-page screenshots, and README with exact artwork prompt.
- Both include user-provided “Submitted to the App Store” / “Coming soon for iPhone”; V2 clearly planned, device art explicitly conceptual. Public privacy/support/sign-in/X links preserved. Current live site inspected: live has X and corrected contact email; this checkout's landing source is older. Do not deploy that stale source wholesale.
- Verified browser desktop and 390×844 layouts, no horizontal page overflow or broken images, both theme button transitions, reduced-motion content visibility and scrollable editorial sequence; no browser errors/warnings. JS syntax and git diff --check passed (pre-existing CRLF warnings only). Viewport/media overrides reset. Local preview server session 46198 remains at http://127.0.0.1:4318/cinematic.html; links switch both concepts. Preview tab kept for the user.
- Branch codex/journeydeck-v2 on 63ee33d. Existing mobile work preserved; only new mockup directory and this handoff entry added. No production homepage change, deployment, commit, push, or mobile release. Next: user selects a direction, then adapt selected concept against current main/live homepage for production. Full artifact details and verification in mockup README.

## iPad Home-only universal preview — September 4, 2026

- RELEASE VERIFIED: Build 6 `4f678d8b-3db1-4ece-bac1-d6c78212f1db` FINISHED at 2026-09-05 03:53 UTC. Install https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/4f678d8b-3db1-4ece-bac1-d6c78212f1db . Downloaded 76,012,568-byte IPA; CRCs, iPhone/iPad family [1,2], both exact registered devices in ad-hoc profile, all four iPad orientations, non-fullscreen window support, unchanged iPhone orientations (compared with Build 5), preview.5 runtime, v2-preview channel/updates enabled, and matching isolated .v2 CloudKit/signing entitlements verified. No running process remains. Physical iPad acceptance pending; no additional build or OTA needed to install this slice. Supersedes in-progress notes below.

- User approved Option 2 widget dashboard and explicitly requested only Home in both themes, five tabs, blank Music/Memories/Statistics, and Settings with only a Light Mode switch. Astra High recommended. Preserve existing iPhone screens/order/accepted native interactions. User confirmed native card menus with "Gorgeous"; prior C1 physical-menu acceptance is no longer pending.
- Added `src/device-layout.ts` (stable iPad identity, responsive columns) and `src/ipad-home.tsx` (coastal header, existing recorder controls, real music metrics, recent memories/journeys, soundtrack, honest empty/loading states). `shell.tsx` selects tablet-only tab content; `App.tsx` reuses the single recorder lifecycle via ipad-home presentation. Home widgets are read-only in this limited slice. Themes persist through existing app-theme storage. No new dependencies or changes to data/privacy/recording algorithms.
- NativeTabs enables sidebarAdaptable on iPad and puts orange Home first; iPhone retains Music/Memories/Home/Statistics/Settings. Native iPad system chrome adapts to window size. Preview config enables universal family, non-fullscreen windows, all four iPad orientations while preserving iPhone portrait. Runtime preview.5, Build 6, release V2-P5-I1. Existing automatic light/dark Home Screen icons and isolated .v2 bundle/CloudKit retained.
- TypeScript, required individual mobile checks, 11 focused tests, full 242/242 tests, iOS export and git diff --check passed. Browser rendering of actual Home component (native symbols/images adapted for web) checked both themes at 1180pt and light at 820/360pt, no horizontal overflow. This does NOT verify UIKit sidebar/safe-area/rotation or physical device recording; these require iPad acceptance.
- iPad registered through Expo URL ending `964e8abd-bcb3-4cd1-984d-56499c0360b0`; user confirmed finished. Apple saved session valid. Both iPad and iPhone selected in regenerated ad-hoc profile. EAS v2-preview Build 6 `4f678d8b-3db1-4ece-bac1-d6c78212f1db` submitted, IN_QUEUE at handoff; submission session 36195 exited 0. Do not submit another. Poll this build, then verify signed IPA using ignored dist-native-preview/verify-build6.py plus ipad-devices.json and deliver its install link. Build profile INTERNAL_TESTING=0 overrides preview environment's existing 1. No production/App Store release, commit/push or V1 mutation.
- Branch codex/journeydeck-v2 / 63ee33d retains extensive prior dirty V2 work. Logs and previews under ignored mobile/recorder/dist-native-preview, export dist-ipad-home. Next: verify Build 6 IPA family [1,2], iPad orientations, preview.5 OTA channel, both provisioned devices, icons and private CloudKit. Physical acceptance: Home light/dark, all five destinations, rotation/window resize, start/end and theme persistence. Other iPad pages remain intentionally blank.

## Native card context menus — September 4, 2026

- User requested press-and-hold native card menus. Astra High recommended. Added Expo Router Link.Menu/Link.MenuAction with Link.Trigger around existing AppleZoom adapter, no Link.Preview or new native dependency. Installed Router 57.0.19 native context interaction cancels RN touches when opening; menus do not mount a destination preview or change screen presentation. Preserve user-accepted Z3 detail frame and card padding.
- Memory carousel cards: Edit Memory / Create share card bind the exact held Memory and use existing local editor/share callbacks. Journey card links (Home, library, Memory detail, Statistics and Atlas): Edit locations / Create share card. Each Journey action pushes its exact ID with a unique action request; existing local detail load and membership gate precede execution. New useJourneyCardAction waits for native transitionEnd plus local readiness/focus and consumes once, avoiding repeat sheets after refresh/back. Existing detail buttons share the same callbacks; original privacy-safe share-route payload and editor safeguards retained. Reduce Motion/older-iOS keep menus and original non-zoom tap callbacks; empty/disabled cards and other platforms retain fallback behavior.
- Verified TypeScript, all required individual mobile checks, focused 22/22, full 237/237 tests and git diff --check. Regression covers held IDs, menu vs tap separation, Slot style preservation, source identity, accessibility fallback, action requests/timing/readiness/blur/repetition and stable Z3 header layout. Actual iPhone hold/release/menu presentation and tap/zoom acceptance remain pending.
- C1 iOS export passed; OTA published and independently verified as latest active v2-preview group `ba0c6a0b-266a-42ce-8c8c-9c19f6a80ddc`, iOS update `01a06f6e-ae2f-79b3-9985-f31784ad39b5`. Used pre-export INTERNAL_TESTING=0 and EAS --skip-bundler. No processes remain. Open V2 and accept Restart now; physical context-menu acceptance pending. Runtime 2.0.0-preview.4 / Build 5 preserved; release V2-P4-C1. Branch codex/journeydeck-v2 on 63ee33d; no commit/push/native build/V1/production mutation. Logs/exports in ignored dist-native-preview and dist-context-c1. Next: user tests hold/release, both actions, dismissal, normal tap/zoom, and scroll on iPhone.


## Delayed post-zoom drop / stable detail frame — September 4, 2026

- PHONE ACCEPTANCE: User replied "Perfect" after Z3 delivery. Mark the reported delayed post-zoom drop resolved on the user's iPhone. This supersedes pending acceptance notes below for this specific issue. Preserve this layout; documentation-only follow-up, no app change or new release.
- User's 2.43s recording confirms Z2 did not fix the delayed downward shift: Memory content is clipped behind the header at 0.5–1.0s, then moves down at 1.5s. Frames/contact sheet inspected locally in ignored mobile/recorder/dist-zoom-video; analysis-only imageio-ffmpeg installed in ignored dist-video-tools (no app dependency). Astra High recommended.
- Expo explicitly documents native navigation bars as incompatible with reliable zoom geometry: https://docs.expo.dev/router/advanced/zoom-transition/#known-limitations . Replaced UIKit headers only on Memory/Journey with DetailScreenFrame: fixed 52pt in-content title/back/menu row, 44pt action slots, window safe-area context captured ABOVE native stack. Destination safe-area changes cannot alter top spacing; genuine root window changes still propagate. Native stack, Apple zoom, edge-back gestures, Reduce Motion fallback and Z2 Pressable padding adapter preserved. Memory menu remains native via existing NativeActionMenu, beside title; Journey membership gate retains a Back control.
- TypeScript, all required individual mobile checks, focused 13/13 and full 232/232 tests pass. Regression simulates destination insets changing after zoom, late menu presence, real root inset change, dark theme, back/edit/share actions and headerless native routes. iOS export dist-zoom-z3 passed with INTERNAL_TESTING=0. Actual UIKit visual acceptance remains pending; do not claim jump resolved on phone yet.
- Z3 published and independently verified as latest active v2-preview group `0df797f3-59f9-4fa5-a816-7a6cfb9d3f53`, iOS update `01a06f5a-9a84-7a87-be84-7ce693ba6e13`, release V2-P4-Z3. No processes remain. Open V2 and accept Restart now; physical zoom acceptance pending. Runtime 2.0.0-preview.4 / Build 5 unchanged. Branch codex/journeydeck-v2 on 63ee33d; existing dirty V2 work preserved, no commit/push/native build/V1/production mutation.


## Zoom layout / Memory header corrections — September 4, 2026

- User supplied iPhone screenshots of transient clipped detail headers, late ellipsis row and Journey text flush against borders. Astra High recommended; correcting via V2 OTA.
- CONFIRMED padding cause: Expo's asChild Slot uses Radix object-spread to merge style props, turning a Pressable style callback into an empty object. Reproduced failure using installed Radix Slot in card-detail-link tests. Added ref-forwarding ZoomCardPressable adapter so styles/callbacks remain on actual native Pressable behind Slot; exact original card styles, pressed appearance and single navigation preserved. Regression now passes.
- Memory detail ellipsis moved from a standalone SwiftUI Host row into Stack.Toolbar.Menu in native header with existing Edit/Share callbacks. Removed legacy rounded modal frame/header row from Memory route. Content has fixed 16pt top padding, bottom-only safe padding. Journey ScrollView now explicitly disables automatic content/indicator inset adjustments. Both native detail headers explicitly nontransparent/non-large to keep inset ownership consistent during zoom. Zoom remains enabled.
- TypeScript, required individual checks, full 230/230 tests pass. Added rendered Memory detail test for toolbar placement/actions and stable cover-load spacing; native iPhone transition validation still pending. iOS export passed; OTA published and independently verified as latest active v2-preview group `affb8feb-c27d-44d9-bf75-673c3afa0a02`, iOS update `01a06f4f-8a05-7fe1-b38d-e508fb93a650`, preview.4 / Build 5 / Z2. No processes remain. Open V2 and accept Restart now; physical transition acceptance pending.
- Preserve Build 5/runtime 2.0.0-preview.4; release V2-P4-Z2, APP_VARIANT=v2-preview, INTERNAL_TESTING=0 pre-export then EAS --skip-bundler. No native binary, production/V1 changes, commit or push. Existing dirty branch codex/journeydeck-v2/63ee33d retained.


## Native card-to-detail zoom — September 4, 2026

- User explicitly chose card-to-detail animation ahead of haptics/context menus and authorized implementation. Astra High recommended. Uses installed Expo Router 57.0.19 Link.AppleZoom (Apple native iOS 18+ zoom, upstream alpha API); no new native module/build/runtime.
- Added card-detail-link.tsx with one root CardMotionProvider accessibility listener, conservative Reduce Motion fallback and iOS 18+ guard. Card links preserve original Pressable layout, disable view flattening, replace imperative navigation only when zooming, and keep one Link source identity per mounted card for return. Carousel selection updates without moving the source during zoom; fallback keeps old behavior.
- Wired Home latest journey, Memory carousel, Journey cards in library/Memory details, Atlas journey rows, Statistics timeline cards and longest-drive card. Detail routes constrain interactive zoom dismissal to 32pt left edge through Expo's supported hook to leave map/content pans alone. Native tabs, orange Home, theme, sheets/menus, membership gates and recorder lifecycle unchanged.
- TypeScript, all required individual mobile checks, new 4 card-transition tests and full 228/228 suite pass. Updated theme structure assertion for static provider wrapper. iOS export passed; OTA published and independently verified as latest active v2-preview group `72b01029-f5dc-4028-a481-64d049e78229`, iOS update `01a06f3b-c8ac-7df3-9ee6-b8186676ace0`, runtime preview.4 / Build 5 / Z1. No running processes remain. Open V2 and accept Restart now. Windows cannot validate UIKit visuals; real iPhone zoom/return, edge back, map gestures and both themes remain pending.
- Branch codex/journeydeck-v2 on 63ee33d; prior uncommitted work retained, no commit/push/V1/production mutation. Build 5/runtime 2.0.0-preview.4 retained; release V2-P4-Z1. Export with INTERNAL_TESTING=0 and publish pre-export --skip-bundler to v2-preview.


## Native filter alignment and sheet close correction — September 4, 2026

- User screenshots show uneven Filter/Sort button widths and mojibake beside Done. Astra Medium recommended; user authorized correction and OTA.
- NativeActionMenu now gives stretched filters equal flex columns and explicit measured host/trigger widths; native chevrons align separately from single-line shrinking labels. Library row aligns to the existing 20pt content inset. Compact menus use an ellipsis symbol. NativeSheet close uses SF Symbol xmark instead of the corrupted text. Existing save/discard behavior, tabs, data/filter semantics and themes preserved.
- Verified TypeScript, four native interaction tests, all required individual mobile checks, git diff --check, and iOS export dist-native-alignment. Phone visual acceptance pending. Build 5/runtime 2.0.0-preview.4 unchanged; release V2-P4-S2. Publish uses INTERNAL_TESTING=0 pre-export and --skip-bundler. OTA published and independently verified as latest active v2-preview: group `a3a465f3-5acb-44be-8478-174557c0cbd6`, iOS update `01a06f1e-4042-7002-beb7-35d69a90e24a`, runtime preview.4, release S2. No processes remain; open V2 and accept Restart now.
- Branch codex/journeydeck-v2, baseline 63ee33d; prior uncommitted work preserved. No new native build, V1/production mutation, commit or push.


## Native sheets and menus — September 4, 2026

- RELEASE VERIFIED: iOS export passed; OTA group `980753bc-f3c3-46f6-b234-53a22888f7de`, update `01a06f0f-e624-798f-8c4b-97f731c729a7` published and independently verified as latest active v2-preview update for runtime preview.4, build 5, isolated .v2 identity/CloudKit, release V2-P4-S1. No processes remain. Open V2 and accept Restart now. Physical iPhone acceptance pending.

- User approved native sheets and menus; recommended Astra High. Implemented NativeSheet (UIKit pageSheet) and NativeActionMenu (existing Expo UI SwiftUI Menu), wired Memory create/edit/organize, Journey place-name editing, Memory actions and library filter/sort selectors.
- Dirty drafts prompt before discard; busy saves/photo changes block dismissal/interactions. Organize-to-create and delete-to-back defer until native onDismiss; Android gets a fallback. Location editing keeps drafts through refresh and resets discarded drafts on next opening. Existing native tab bar, Music label, orange Home, icons, themes, local-first/privacy/recording unchanged.
- Verification: TypeScript, new 4 interaction behavior tests, all required individual mobile checks and full 224/224 suite passed. iOS export and OTA publication/read-back passed. No iOS simulator on Windows; physical animation, keyboard, menu positioning and swipe acceptance remain pending.
- Branch codex/journeydeck-v2 remains uncommitted over 63ee33d. Existing extensive V2 changes preserved. Runtime 2.0.0-preview.4 / build 5 unchanged; OTA release label V2-P4-S1. No new binary, production release, V1 mutation, commit or push. Export with APP_VARIANT=v2-preview and INTERNAL_TESTING=0, then EAS --skip-bundler because preview environment still contains INTERNAL_TESTING=1.


## Native spacing appearance override follow-up — September 4, 2026

- PHONE ACCEPTANCE: User confirmed "Ok that works" after Build 5 and the Music-label OTA. Mark the reported spacing issue and Music tab label resolved on the user's iPhone. Keep native glass bar, orange Home and Soundtracks page title. This supersedes spacing-pending notes below; it does not establish broader recording/gesture/theme acceptance. Documentation-only follow-up; no app change or release.
- User's Build 4 screenshot still shows uneven spacing; keep native glass bar and orange Home. Astra High recommended. No visual success claim for Build 4.
- Found concrete gap: RNS assigns standard/scrollEdge UITabBarAppearance to every UITabBarItem. Apple documents selected-item appearances override UITabBar appearance; first patch only changed legacy bar properties. Replaced patch with copied equal-width stacked appearance settings on the bar AND all five items, including scroll-edge variants. Uses public APIs, a positive 0.01pt spacing (zero requests system default), geometry-derived equal widths, and no reassignment when unchanged. Preserves material, colors, selection, gestures and nil appearance fallback. Handles upgrading a previously prebuilt controller idempotently.
- User replied "Yes make it music" while Build 5 was compiling. Changed only native-navigation.tsx's first tab label to Music; page title remains Soundtracks. Native build source was already uploaded, so deliver this label change as a compatible preview.4 OTA after the build succeeds. User informed of the OTA plan. TypeScript and native-navigation tests pass after rename; dist-build5-music export running/completing. No second native build needed for the label.
- app.config preview runtime now 2.0.0-preview.4, build 5, release V2-P4. Existing automatic icon variants retained. Focused tests 9/9, full suite 220/220, TypeScript and all required individual mobile checks passed. iOS export in progress/completing; next submit one corrective v2-preview native build, verify IPA and deliver link. Actual iPhone spacing still needs visual validation; Windows cannot run UIKit.
- iOS export passed. Corrective Build 5 `600df751-9b24-49e1-b889-fbdd692bdf6d` is IN_PROGRESS, native prebuild passed. Poll this existing build; do not submit another. Use ignored dist-native-preview/build5-progress.cjs and verify-build5.py after downloading finished IPA. Source archive upload grew to 746MB across recent builds; review EAS archive exclusions separately before future builds, without deleting unrelated artwork/source.
- Build 5 FINISHED September 5 at 00:21 UTC. Install: https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/600df751-9b24-49e1-b889-fbdd692bdf6d . Downloaded 73,643,795-byte signed IPA; archive CRCs, .v2 identity/private CloudKit, matching ad-hoc profile/entitlements, build 5, runtime preview.4, v2-preview OTA channel and updates enabled verified. No build process remains running.
- Music tab-label OTA published and independently read back: group `145d93b7-561a-4a8d-ac54-a1de038f228c`, iOS update `01a06ef1-e1c9-7cc1-959b-b6d7cd72789b`, branch v2-preview, runtime 2.0.0-preview.4. Used explicitly INTERNAL_TESTING=0 pre-export with --skip-bundler; final typecheck/navigation checks and Music export passed. Install Build 5 then accept Restart now when prompted. Page title still Soundtracks. Actual iPhone spacing remains unverified; native bar and orange Home preserved. No production changes, commit, push or V1 mutation.

## Combined native spacing and automatic icons build — September 4, 2026

- User was alerted about the omitted automatic icons and explicitly approved BOTH tab spacing and selected option 2 light/dark icons in the next native preview build. Astra High recommended. Reminder fulfilled; mobile/recorder/AGENTS.md updated. No further approval needed.
- Added version-guarded, idempotent Expo prebuild plugin for React Native Screens 4.26.2: five iPhone tabs receive equal public UIKit item widths with centered positioning and zero spacing, preserving native selection/gestures. Actual iPhone spacing remains pending validation.
- app.config.js now uses ios.icon light=icon-light-plum-v1.png and dark=icon.png, runtime 2.0.0-preview.3, release V2-P3. Native icon appearance follows iOS, independent of saved in-app theme. Original production identity and isolated preview identity retained.
- Verification: TypeScript, all required individual subsystem tests, focused navigation/spacing 7/7, full mobile suite 218/218 and iOS export passed. Expo's actual icon generator produced distinct 1024px base/light and dark assets with the correct luminosity metadata. Full local iOS prebuild is unsupported on Windows; EAS will generate/compile on macOS. Build submission is next; no new native artifact delivered yet.
- Build 3 `86a83c5a-0314-49d8-80af-1f947b14db31` failed in prebuild: plugin incorrectly guarded 4.26.0 while both lockfile and installed RNS are 4.26.2. Corrected guard after inspecting controller; added regression check against installed AND locked version. Reinstalled exact dependencies with npm ci --ignore-scripts; focused checks 8/8 pass. Retrying as native Build 4 (same preview.3 runtime); signed artifact and installation-link delivery remain pending. Helpers/logs in ignored mobile/recorder/dist-native-preview.
- Replacement Build 4 `bf18fdc5-9e2b-4c22-85c6-c45566fe63b6` FINISHED September 4 at 23:54 UTC. Install: https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/bf18fdc5-9e2b-4c22-85c6-c45566fe63b6 . Final checks: TypeScript, focused 8/8, full suite 219/219 and iOS export passed. Cloud prebuild logged spacing patch applied and native controller compiled successfully.
- Downloaded signed IPA (73,642,395 bytes) and verified archive CRCs, version 2.0.0 build 4, runtime preview.3, OTA enabled/channel v2-preview, .v2 identity/private CloudKit, matching ad-hoc profile and signed entitlements. Compiled Assets.car contains BOTH App-Icon-dark and App-Icon-1024 source entries; primary icon remains AppIcon. Native icon generation also verified distinct 1024px light/dark files and appearance metadata.
- Next: user installs over existing V2 app and checks actual five-tab spacing and Home Screen Auto icon appearance in both system themes. Physical visual behavior remains unverified here. Original App Store update path preserved; no production OTA, App Store submission, commit, push or V1 workspace mutation. README and roadmap point to Build 4; no build process remains running.

## V2 Phase 1 native navigation implementation — September 4, 2026

- User selected native-tab concept 2 (Coral Home), permanently orange Home, native detail navigation and preserved screen state, then said Begin. Astra Extra High recommended for this implementation. Current source supersedes the earlier concepts-pending note. Existing theme/artwork and other-task handoff notes preserved.
- Installed Expo Router 57.0.19 plus SDK-compatible Linking/Constants; entrypoint registers location/automatic tasks before Router. Root App keeps theme and a profile-keyed shared shell around the native stack. Five stable native tab routes replace PagerView/custom dock, keep one Home recorder mounted, and disable reselect scroll/reset. Original orange PNG icon at 1x/2x/3x bypasses tint in both tab states. Native chrome follows the saved app theme.
- Journey/Memory details now use native push/back gestures. Atlas and Tools are stack routes so details opened there remain visible and back returns correctly. Memory edits/shares keep their existing privacy/local-first paths; timed detail-close handoffs removed. Route-local Journey requests cancel stale responses, retain data on refresh, and apply membership gating. Provider editing hides rather than unmounts the established navigator. Native insets replace custom-dock bottom spacing.
- Preview runtime advanced to `2.0.0-preview.2`, preview profile auto-increments native builds, keeps `.v2` bundle/CloudKit/channel and INTERNAL_TESTING=0. Public bundle/App Store path unchanged. Do not publish this migration to preview.1 by OTA. No production update, commit, push or App Store submission authorized/performed.
- Verification: TypeScript, all required individual subsystem checks, tab runtime 31/31, new native navigation 5/5, full mobile suite 216/216, and iOS export passed. Tests cover permanent icon configuration, stable context/state/recorder lifecycle, real Expo tab/stack route keys and back behavior, stale Journey loads and preview isolation. Physical iOS performance/layout/gesture verification remains pending. React test renderer is dev-only and emits its expected deprecation notice.
- EAS iOS build **b7e04c69-6bb9-4f12-895b-ebd61ffbe1f8** FINISHED September 4 at 23:13 UTC: **2.0.0 (2)**, profile/channel v2-preview, runtime preview.2, isolated `.v2` identity. Install: https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/b7e04c69-6bb9-4f12-895b-ebd61ffbe1f8 . Downloaded the signed 72,530,624-byte IPA, verified all archive CRCs, Info.plist, Expo.plist, executable code-sign entitlements and provisioning consistency: correct `.v2` app/CloudKit, build 2, runtime preview.2, v2-preview channel, updates enabled. Existing distribution certificate and registered-device profile reused. This replaces the installed V2 preview and keeps its library; V1 remains separate.
- Environment: `codex/journeydeck-v2` at `63ee33d`, extensive prior uncommitted work preserved. Export (2,322 modules), downloaded IPA and verification helper/metadata are in ignored `mobile/recorder/dist-native-preview`; logs in ignored `.ai/*.log`. Temporary migration helper removed. EAS Doctor 20/21: seven pre-existing package patch updates available, native build still succeeded. Next: user installs build 2 without deleting V2, then verifies actual native feel/layout, both themes, back paths, editors and recording continuity. Compatible future OTAs target preview.2 only; no OTA published in this task.

## GitHub Expo feature research — September 4, 2026

- Researched GitHub candidates against current mobile dependencies: Expo Widgets (Live Activities/Home Screen), Victory Native (interactive charts), Reanimated Carousel (Memories deck), Galeria (photo viewing), Rive Nitro (interactive artwork), Gorhom Bottom Sheet, and Skia animation examples. Recommendations only; no dependencies installed or application changes/tests/builds/OTAs in this turn.
- Existing Skia, Reanimated, MapLibre, mesh/glass effects and route replay support several visual enhancements without another rendering engine. Exact third-party compatibility with SDK 57/RN 0.86/Reanimated 4.5 still requires integration validation; Widgets requires a native build.
- Inspected status, diff stat, dependency/entrypoint diffs and recent history: branch codex/journeydeck-v2 at 63ee33d with existing uncommitted work preserved. Native navigation files and Router entrypoint now exist in working tree, so earlier concept note's migration-pending description is not a complete account of current source. No navigation verification performed here.
- Next: user selects concepts to prototype; strongest candidates are a Memories card deck, interactive Statistics charts, and active-journey Live Activity. Research does not add approved V2 scope.

## Native tab design concepts — September 4, 2026

- User wants Expo native tabs and requested three nav mockups to preserve Home emphasis. Created Plum Circle (recommended for recognition), Coral Home, Brand Signature concepts in `.ai/native-tab-concepts/`; README records exact prompts and built-in generation method. Five equal native tab slots with Home centered; no raised custom button. iOS controls actual glass/spacing/selection treatment. Mockups retain historical screenshot content, not current native rendering.
- No application changes, build or OTA in this design turn. Native-tabs migration and concept selection remain pending. Astra Medium recommended for mockups, High for migration. Existing uncommitted work preserved.

## Missed light fallback artwork — September 4, 2026

- User screenshots identified two app-owned fallback assets missed by the header-only pass: Home's night city thumbnail and the default floating Memory collage. Created warm ivory/daylight counterparts `home-city-light-v1.png` and `memory-default-floating-timeline-light-v1.png`; prompts and method are in `.ai/LIGHT-FALLBACK-ARTWORK.md`. Both were visually reviewed.
- Added pairs to the existing artwork resolver. Home latest thumbnail now resolves its selected source by theme; shared MemoryArtwork resolves the default image by theme while preserving the early return for user photos. Dark originals and layout unchanged.
- TypeScript, tab runtime 31/31, full suite 211/211, required individual subsystem tests and whitespace checks pass. iOS export 1,850 modules / 41 assets. Published and independently verified live v2-preview OTA group `d03debcf-ffc3-4e7b-86fd-1cc392556e85`, iOS update `01a06e81-2b9d-762c-85ac-f325e9d13f34`, runtime `2.0.0-preview.1`, using INTERNAL_TESTING=0 prebuilt bundle. No native, production, commit or push changes. Branch codex/journeydeck-v2 at 63ee33d, existing work preserved. Next: user restarts V2 to apply and review both light fallbacks on the phone.

## Plum Ivory in-app branding — September 4, 2026

- User selected icon option 2 and explicitly chose the in-app OTA scope. Copied the approved concept unchanged to `mobile/recorder/assets/icon-light-plum-v1.png`. Light Mode now selects it in shell's shared JourneyDeckLogo, paid Settings membership icon, and onboarding ProgressHeader. Original dark icon, exported share-card artwork, native Home Screen icon and app configuration remain unchanged. The in-app icon follows JourneyDeck's saved Light Mode switch.
- TypeScript, focused tab tests 31/31, full mobile suite, all required individual subsystem tests and whitespace checks pass. iOS export includes 1,848 modules / 39 assets. Published and independently verified live v2-preview OTA group `d14b347d-2e0e-4887-85b0-60fd288c72c1`, iOS update `01a06e79-1c0e-74f7-84ab-8ce1d87a9a62`, runtime `2.0.0-preview.1`, message `Use Plum Ivory branding in Light Mode`, using explicit variant/internal-testing=0 export and --skip-bundler.
- Existing work preserved on codex/journeydeck-v2 at 63ee33d; no commit/push, production OTA or native build. Next: reopen V2, apply the downloaded update, and review in-app branding in Light Mode on the phone.

## Light app icon examples — September 4, 2026

- Generated and visually reviewed Coral Ivory, Plum Ivory (recommended), and Lavender Dawn using built-in referenced image edits. PNGs and exact prompts are in `.ai/icon-concepts/`. Existing icon/configuration unchanged; no build or OTA, no runtime tests for these concept files.
- User wants system-controlled icon appearance. Apple supports appearance variants governed by the Home Screen appearance setting; selection and production icon configuration remain pending. Installing appearance variants needs a native build.
- Existing uncommitted theme work preserved on codex/journeydeck-v2 at 63ee33d.

## V2 switch alignment and purple Start Journey card — September 4, 2026

- User supplied phone screenshots requesting a centered Light Mode switch and clearer Start Journey card with purple haze/glow and a darker border. Astra Medium recommended.
- In `src/shell.tsx`, explicitly set the Switch's alignSelf to center: React Native's iOS Switch otherwise overrides its centered parent row with flex-start. In `App.tsx`, light mode's Start Journey card now has a translucent pale lavender backing, purple radial haze/pulse, dark purple outline, and deeper plum text/arrow without the blurred text shadow. Existing dark appearance, geometry, typography and recorder behavior are preserved.
- Updated the two existing source assertions for the conditional light/dark gradient and outline. TypeScript, focused tab tests 31/31, full mobile tests 211/211, all mandated individual subsystem checks, iOS export 1,847 modules / 38 assets, and whitespace checks pass. Native visual acceptance remains pending.
- Published and independently verified live v2-preview OTA group `fdf7b141-cdcc-4fd7-b15d-da875ab58393`, iOS update `01a06e5f-8960-727e-8523-002015bb0cf1`, runtime `2.0.0-preview.1`, message `Center theme switch and clarify purple Start Journey card`. Used the explicitly configured INTERNAL_TESTING=0 export and --skip-bundler. No new images/native build, V1 update, commit or push. Branch codex/journeydeck-v2 at 63ee33d; all current work remains uncommitted.
- OTA downloads support cellular and Wi-Fi; earlier Wi-Fi advice was a suggestion, not an app restriction. Reopen V2 to download, then reopen after download to apply.

## V2 warm ivory header artwork — September 4, 2026

- Created eleven light header/hero images with referenced image edits, preserving the original dark assets. Source/output paths and exact prompts are recorded in `.ai/LIGHT-HEADER-ARTWORK.md`. Covers Home, Settings, Memories, Soundtracks, Live, Recorder, Timeline, Atlas, Statistics, Journey Detail and the Atlas globe shared by membership/Statistics.
- Added `src/header-image-sources.ts` with static asset pairs; the existing theme switch selects the light images through shared HeaderArtwork and the custom hero consumers in shell, primary sections and membership paywall. Adjusted only Home's light image overlay and paywall image fade/text colors. No layout, navigation, recording, data, pricing or native changes in this task.
- Verification passes: TypeScript, full mobile suite 211/211, all required subsystem test commands individually, iOS export 1,847 modules / 38 assets, and whitespace checks (existing CRLF notices only). Generated images were visually reviewed; final native appearance still requires phone review.
- Published preview OTA group `89e75d55-6dbc-4e07-aa96-7e26ccc61e9e`, iOS update `01a06e55-7056-7e5e-86f3-4f381e4d9013`, message `Add warm ivory header artwork`. Independently verified the live v2-preview manifest serves this exact update with runtime `2.0.0-preview.1`, all 38 assets, JourneyDeck V2 and bundle `com.journeydeck.recorder.v2`. The verified export was produced with explicit APP_VARIANT=v2-preview and EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=0. EAS's shared preview environment still has INTERNAL_TESTING=1; used the already-verified export with --skip-bundler so that remote setting could not enable internal features. Do not change the shared remote environment for this isolated app.
- Next: close/reopen the installed V2 app on Wi-Fi, allow the asset download, then reopen to apply and review Light Mode on the phone. No replacement installation is needed for this asset/JavaScript update.
- User confirmed the earlier preview installation succeeded ("I finally got it"); the installation investigation below is historical and resolved. Branch codex/journeydeck-v2 at 63ee33d; work remains unstaged/uncommitted. No V1 production OTA, commit, push, native build or App Store submission.

## V2 preview installation investigation — September 4, 2026

- User reports the preview says “Waiting” on the iPhone; confirmed Wi-Fi. Astra Medium recommended for diagnosis. No application changes or rebuild made.
- EAS build `6df44875-9aa2-4dd7-a73e-7e4634d143e1` remains FINISHED/internal and its Install control is available. Downloaded the complete 46,404,103-byte IPA over HTTPS: HTTP 200, 175.75 seconds, approximately 264 KB/s. Slow delivery is reproduced locally, but the phone's exact blocker remains unconfirmed.
- All archive CRC checks pass. Parsed the executable's signed entitlements and embedded provisioning profile: app/team identities match, registered iPhone is included, get-task-allow is false, profile expires August 21, 2027, minimum iOS 16.4. This checks metadata consistency, not Apple's live on-device signature validation. No evidence yet that rebuilding or changing certificates would help.
- Requested a brief cellular retry and Prioritize Download on the waiting V2 icon, if offered; preserve the original JourneyDeck installation. Await whether it begins loading or displays a specific error. Next: use that result to narrow network/download versus iOS install state; if needed restart the phone and retry only the uninstalled V2 placeholder. Do not claim resolved before phone confirmation.

## V2 iPad roadmap addition — September 4, 2026

- Added V2-07: iPad app availability with a dedicated tablet layout to the canonical V2 roadmap. Seven features are now in scope; iPad is proposed M7 and release acceptance moves to M8. Detailed design remains pending.
- User clarified this is a list addition only. No application code or configuration changed in this task. Existing theme/preview work remains intact and uncommitted on codex/journeydeck-v2 at 63ee33d.
- Verification: documentation reviewed and whitespace checked; no runtime tests needed. Next: plan the iPad experience when implementation is requested; continue existing preview validation work.


## V2 warm ivory theme and isolated preview — September 4, 2026

- User preference: recommend an Astra reasoning level before performing each task. High was recommended for this app-wide theme/build task.
- Scope: option-two warm ivory palette across the iPhone app; preserve layouts, existing artwork, navigation, recording/data/provider/membership behavior, and exported share-card designs. Added only the Settings **Light Mode** switch. Theme is saved synchronously in SecureStore, defaults to dark, updates system UI/maps, and does not remount the recorder. App-wide color translation lives in `src/theme-palette.ts` and `src/app-theme.tsx`; all presentation modules consume it.
- Public V2 MUST remain a normal App Store update: original `com.journeydeck.recorder`, App Store ID `6806502526`, existing CloudKit container and StoreKit products. Only the internal test app is named JourneyDeck V2 with bundle `com.journeydeck.recorder.v2`, scheme `journeydeck-v2`, CloudKit `iCloud.com.journeydeck.recorder.v2`, EAS channel `v2-preview`, and runtime `2.0.0-preview.1`. The native CloudKit module reads its configured container with the original as fallback. `app.config.js` selects these identities; `app.json` and production submit configuration are unchanged.
- Preview signing succeeded using the existing Apple team and distribution certificate; separate ad hoc profile `5LGR4P6YTY` includes the registered iPhone. No credential revocation. Credentials stay in EAS/local keychain. Always set `APP_VARIANT=v2-preview` explicitly for preview EAS commands, including credentials and OTA commands, because the CLI does not consistently apply profile environment values to every config evaluation.
- EAS internal iOS build **6df44875-9aa2-4dd7-a73e-7e4634d143e1** completed successfully: version **2.0.0 (1)**, profile/channel `v2-preview`, runtime `2.0.0-preview.1`. Build page: https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/6df44875-9aa2-4dd7-a73e-7e4634d143e1 . The archive includes the uncommitted theme code even though EAS shows baseline commit `63ee33d`. Preview build explicitly retains `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=0`. Independently read the signed IPA metadata and provisioning profile: confirmed JourneyDeck V2, bundle `.v2`, version 2.0.0/build 1, isolated CloudKit container, runtime `2.0.0-preview.1`, channel `v2-preview`, and `EXUpdatesEnabled=true`. Physical iCloud schema/sync and membership availability remain unverified in this separate app.
- Verification: TypeScript; full mobile tests **211/211** including seven new theme/config tests; all required subsystem test commands individually; iOS Expo export **1,835 modules / 27 assets**; `git diff --check` (only CRLF notices). An AST comparison also confirms all 15 original stylesheet declarations across 12 presentation modules are unchanged. EAS Expo Doctor reports only eight available package patch updates (20/21 checks); dependencies deliberately remain on the verified V1 versions for this theme-only change. Temporary browser approximation of actual Home/Soundtracks/Settings/paywall structures was reviewed for colors; it is not native iOS visual acceptance. Physical validation remains required, including theme persistence, active recording, maps, large text, overlays, and dark appearance.
- Branch `codex/journeydeck-v2`, HEAD `63ee33d`; source changes remain unstaged/uncommitted. V1 `C:\Users\patri\DriveOS-agy` is clean and untouched. No commit, push, production OTA, App Store submission, or production schema mutation. Existing historical V1 OTA preferences do not authorize production V2 publishing. EAS OTA remains available on the isolated preview channel for compatible JavaScript/assets; native changes require a new build.
- Installation: open the EAS build page above in Safari on the registered iPhone and choose Install. Next: physical-device acceptance. Preview has a separate local library/iCloud container; do not promise the original subscription works under its different bundle ID. Confirm actual device appearance before closing M1. Compatible preview OTA updates remain possible using the explicit variant and channel documented in `mobile/recorder/README.md`. Provider feasibility and all remaining roadmap features remain pending.

## V2 product roadmap established — September 4, 2026

- User confirmed six V2 features: interactive journey web sharing, Foursquare place enrichment, Tessie/vehicle intelligence, automatic recording, Spotify listening through Last.fm, and a light mode color theme.
- Created the canonical product plan at `docs/JOURNEYDECK-V2-ROADMAP.md`, separate from the completed desktop migration roadmap. It records proposed milestones M0–M7, per-feature scope and acceptance criteria, external dependencies, open product decisions, and release gates. The feature list is confirmed; sequencing, pricing/eligibility, and detailed design choices remain proposals.
- Next: isolate V2 distribution and assess provider/dormant-code feasibility, then prepare the light-theme design. All six features remain in V2 scope; no silent deferrals. Existing EAS profiles still share preview/production channels, so branch isolation alone is insufficient for publishing.
- Documentation-only work; no application configuration, commit, push, provider contact, or deployment. Prior baseline verification remains 204/204 mobile tests, TypeScript, and iOS export; roadmap changes checked for whitespace and local link targets.

## V2 baseline reconciled — September 4, 2026

- At the user's direction, fast-forwarded `codex/journeydeck-v2` from `ed96d38` to `63ee33d` (`release: lock JourneyDeck 1.9.0 candidate`). V2 now contains the complete locked V1 Build 14 source, assets, tests, and release notes. No new commit, push, or deployment was made; the source worktree was not modified.
- Preserved both local V2 handoff sections and incoming V1 notes, resolved the handoff-only stash conflict, and removed the temporary stash after checking preservation. Only this handoff remains modified and unstaged.
- Installed mobile dependencies with `npm ci --no-audit --no-fund`. Verification passed: focused new behavior tests 18/18, complete mobile suite 204/204 (including the subsystem test suites), TypeScript, iOS Expo export (1,831 modules / 27 assets), and whitespace checks. Export output is in ignored `mobile/recorder/dist`; no development server remains running.
- Next: define the first V2 feature. The user's V2 development scope is separate from the frozen V1 release; historical production OTA publishing preferences below do not authorize publishing V2 work to V1 production. Separate V2 runtime/channel configuration remains to be established before any V2 distribution.

## V2 readiness review — September 4, 2026

- Verified v2 remains on `codex/journeydeck-v2` at `ed96d38`; only this handoff is modified. Read root handbook and inspected status, diff, history, and worktrees. No application changes or tests performed.
- The source worktree is now clean at `63ee33d` (`release: lock JourneyDeck 1.9.0 candidate`), one commit ahead of the v2 baseline. This supersedes the earlier note about source uncommitted changes. That commit includes mobile implementation and tests, not only release documentation.
- Next: establish the first v2 feature scope and reconcile the newer V1 release candidate into the development baseline before implementation. No merge, commit, push, or deployment performed during readiness review.

## JourneyDeck v2 workspace created — September 4, 2026

- Created the dedicated worktree `C:\Users\patri\JourneyDeckv2` on new branch `codex/journeydeck-v2`, starting from commit `ed96d38`.
- The source worktree `C:\Users\patri\DriveOS-agy` remains on `codex/native-runtime-prep` with all of its existing tracked and untracked changes untouched. Those uncommitted changes are not present in the v2 worktree.
- No application code, commit, push, deployment, or release state was changed. Begin v2 work in this folder and review whether any uncommitted v1 work should later be migrated deliberately.

## App Store 1.9.0 release freeze — September 4, 2026

- JourneyDeck **1.9.0 (Build 14)** is the locked V1 App Store release candidate. Until Apple completes review and the release is stable, do not add features, redesign approved screens, change navigation, alter the product model, or broaden integrations unless the user explicitly reopens the scope.
- Allowed changes are limited to minor, targeted bug fixes and fixes required by App Review. Preserve StoreKit product IDs, the five-item navigation, approved Home/Journey Details/sharing experiences, the Journey → Memory hierarchy, V1-disabled Tessie behavior, the 45-day free-history boundary, and paid Atlas/full-history entitlement.
- The seven final App Store screenshot masters are preserved under `.ai/submission-screenshots/`. Do not reorder or replace them without explicit user direction.

## App Store production Build 14 — September 4, 2026

- Created production iOS **Build 14** from the current working tree so the approved Build 13-compatible OTA source and all 27 current assets are embedded for first launch. The production channel and runtime compatibility remain `1.9.0-build13`; EAS remotely incremented the App Store build number from 13 to 14.
- Verification passed before building: TypeScript, complete mobile suite **204/204**, public-release preflight with the live `journeydeck.me/privacy` and `journeydeck.me/support` pages, iOS Expo export (**1,831 modules / 27 assets**), and `git diff --check` apart from existing CRLF notices.
- EAS build `aaf7caeb-a355-4aa2-a37b-69cf45dc1b32` completed successfully. Submission `453d9dba-cc48-47a0-84e5-f520e030158e` was accepted and fully processed by Apple. App Store version **1.9.0 (14)** remains selected with the user's seven-screen order unchanged. The initial app-only review submission `c38c6405-5ad0-4071-9e8c-a5debcd70076` was withdrawn after discovering that Apple's required first-subscription bundle had not been included. Review-only paywall screenshots were added to both products, and the corrected submission `3f78922b-b582-4e5a-b3fd-52aba70c1890` was sent on September 4 at 2:44 PM. App Store Connect confirms **4 Items Submitted** and **Waiting for Review**: iOS app **1.9.0 (14)**, **JourneyDeck Membership** subscription group, **JourneyDeck Annual**, and **JourneyDeck Monthly**. Release remains manual after approval.
- This source snapshot is the locked **1.9.0 (Build 14)** release candidate. No new OTA, replacement native build, destructive data change, or navigation redesign was performed during App Store submission.

## Atlas Route DNA population repair — September 4, 2026

- Fixed the paid Atlas **Route DNA** widget appearing empty despite valid journey history. It now displays an accurate first-journey signal immediately, uses truthful generic endpoint labels while automatic place naming is still pending, and upgrades to timing comparison once the same corridor has been traveled twice.
- Route DNA now treats opposite directions between the same two places as one corridor, so Home → Work and Work → Home build the same insight while the UI marks it with a bidirectional arrow. The approved Atlas layout and five-item navigation are unchanged.
- Verification passes: focused Atlas insights **6/6**, tab runtime **31/31**, complete mobile suite **204/204**, TypeScript, iOS Expo export (**1,831 modules / 27 assets**), and `git diff --check` aside from existing CRLF notices.
- Published and independently verified the Build 13-compatible iOS production OTA: update group `d2950321-29a6-4c03-bc52-e6d138144621`, iOS update `01a06d92-e220-7b6d-8fa4-2363a9a695b8`, runtime `1.9.0-build13`, message `Populate Atlas Route DNA`. Source remains uncommitted and unpushed; no native build, TestFlight upload, App Store Connect mutation, destructive data change, or navigation redesign was performed.

## Same-anchor Home/Work journey visibility rule — September 4, 2026

- Applied the user's clarified rule: **Home → Home** and **Work → Work** journeys are excluded from the visible JourneyDeck story. Home/Work remain valid whenever only one endpoint uses that anchor, including Home ↔ Work, Home ↔ another place, and Work ↔ another place. Other same-name routes such as School → School are unchanged.
- The rule is presentation-only and does not delete or mutate a stored recording. It is enforced before the Home dashboard, journey library, Memory journey counts, Statistics/timeline/search, local place totals, and Atlas insights are built, so ignored loops cannot appear as cards or inflate those calculations. Atlas also applies the rule defensively when its pure insight builder is used directly.
- Added behavioral and integration coverage for both excluded loops, every valid anchor direction, exact-label matching, input preservation, and all affected presentation surfaces. Verification passes: focused visibility/Atlas **7/7**, complete mobile suite **202/202**, TypeScript, iOS Expo export (**1,831 modules / 27 assets**), and `git diff --check` aside from existing CRLF notices.
- Published and independently verified the Build 13-compatible iOS production OTA: update group `cf483790-d297-42b0-9cd9-ade422a54c5e`, iOS update `01a06d76-b599-7360-8948-8f762ae8ca6d`, runtime `1.9.0-build13`, message `Ignore same-place Home and Work loops`. Source remains uncommitted and unpushed; no native build, TestFlight upload, App Store Connect mutation, destructive data change, or navigation redesign was performed.

## Atlas premium intelligence command center — September 4, 2026

- Rebuilt the paid Atlas overlay around the approved Option 4 command-center composition without changing the five-item bottom navigation. The top of Atlas now has a private/on-device badge, live 30-day, 90-day, and all-time windows, a glowing Atlas Pulse summary, a deterministic 2×2 intelligence grid, and a full-width Soundtrack Intelligence card. The existing interactive Atlas map, place deep dive, route review controls, and recent mapped journeys remain available below in the scroll view.
- Added five on-device, archive-backed insights in `mobile/recorder/src/atlas-insights.ts`: **Route DNA** (most-repeated named route with measured duration/mileage spread), **Driving Rhythms** (real weekday and time-of-day distribution), **Exploration Score** (share of GPS grid areas seen on only one journey, with GPS-drift-tolerant cells), **Place Relationships** (strongest named start-to-destination links), and **Soundtrack Intelligence** (matched road plays, unique songs, top artist, music-bearing journeys, and time-of-day pattern). Sparse archives show explicit learning states instead of invented conclusions.
- Added deterministic calculation coverage and structural coverage for all five widgets, live window controls, privacy copy, and the unchanged navigation. Verification passes: Atlas calculations **3/3**, tab runtime **31/31**, complete mobile suite **198/198**, TypeScript, iOS Expo export (**1,830 modules / 27 assets**), and `git diff --check` aside from existing CRLF notices.
- Published and independently verified the Build 13-compatible iOS production OTA: update group `44185b2d-4444-4f05-b494-c8624e094626`, iOS update `01a06d6b-7084-7360-85e1-ad219a33e82b`, runtime `1.9.0-build13`, message `Launch premium Atlas intelligence`. Source remains uncommitted and unpushed; no native build, TestFlight upload, App Store Connect mutation, or user data change was performed.

## Atlas intelligence membership paywall — September 4, 2026

- Replaced the temporary compact paywall with the approved full-screen globe composition. It sells Atlas as private drive intelligence through four concise panels—Pattern Intelligence, Favorite Places, Repeated Routes, and Music Moments—plus one separate line for complete history beyond the latest 45 days. The new raster hero is `mobile/recorder/assets/atlas-globe-membership-v1.jpg` and contains no price or UI text.
- Monthly and annual choices are visible together in the normal iPhone viewport, annual is selected by exact product ID when available, and both the plan cards and purchase CTA render Apple's localized `product.displayPrice` verbatim. Products are cleared and refreshed from StoreKit every time the screen opens; failed/stale responses cannot leave an old price purchasable, selection survives a valid refresh, and synchronous guards reject rapid duplicate purchase taps. Small phones and accessibility text retain a scroll fallback.
- Verification passes: TypeScript, public-release integrity **11/11**, complete mobile suite **194/194**, iOS Expo export (**1,828 modules / 26 assets**, including the new globe), and `git diff --check` aside from existing CRLF notices. Published and independently verified on the iOS production branch for runtime `1.9.0-build13`: update group `bde9c57f-982b-477d-bd15-47db57c2cd45`, iOS update `01a06cfe-0ad5-727e-9632-ba2539c562c1`, message `Showcase Atlas with live App Store pricing`. Source remains uncommitted and unpushed; no native build, TestFlight upload, or App Store Connect mutation was performed.
- After reviewing the physical-device screenshot, added a safe-area-aware spacious layout for tall iPhones. Between 790 and 850 usable points it continuously expands the globe, four intelligence cards, history row, both plans, CTA, and footer to consume roughly 120 extra points; compact phones retain the prior fit. Narrow or large-text layouts stack cards and keep scrolling as an accessibility fallback. TypeScript, public-release integrity **11/11**, full suite **194/194**, and iOS export pass. Published and independently verified on the iOS production branch for runtime `1.9.0-build13`: update group `a1e9c596-9e92-4e25-bd2b-51e390948567`, iOS update `01a06d08-546d-73d6-b5d7-335891cc2061`, message `Expand Atlas paywall for tall iPhones`.
- Physical testing exposed a sub-point Yoga wrap regression in that OTA: two `48.8%` cards plus the expanded 10-point gap exceeded the row, placing all four cards down the left side. Replaced percentage wrapping with two explicit equal-width rows, so the benefits are deterministically 2×2 at normal width; narrow/large-text stacking remains intentional. Added structural coverage against reintroducing wrapping. TypeScript, public-release integrity **11/11**, full suite **194/194**, iOS export, and `git diff --check` pass. Published and independently verified on iOS production runtime `1.9.0-build13`: update group `f3c8250c-8e53-4234-baa8-c695580b46f2`, iOS update `01a06d0e-8ef8-7dab-b366-0bcaff2307e4`, message `Keep Atlas benefits in two columns`.
- Added a 9-point visual gap between the live StoreKit plan cards and the coral **Unlock Atlas** button, without changing the rest of the approved paywall. TypeScript, public-release integrity **11/11**, full suite **194/194**, and the EAS production export pass. Published and independently verified on iOS production runtime `1.9.0-build13`: update group `b21ba655-efef-4263-bc0e-920458f473d0`, iOS update `01a06d17-665b-7ae4-a032-05d729a7b633`, message `Separate Atlas plans from purchase button`.
- Replaced the hard-edged top-right purple circle with `mobile/recorder/assets/atlas-header-orbit-v1.png`, a generated transparent coral-magenta orbital-route haze. The display box and placement remain exactly **320×320**, `top: -175`, `right: -100`; only the artwork changed. Added release-integrity coverage for the asset, unchanged dimensions, and removal of the old solid fill. TypeScript, public-release integrity **11/11**, full suite **194/194**, iOS export (**1,829 modules / 27 assets**), and `git diff --check` pass. Published and independently verified on iOS production runtime `1.9.0-build13`: update group `8a9c5125-7def-4218-81b3-4767e727f017`, iOS update `01a06d22-fbfd-7dc9-87b5-1e70bfbcb487`, message `Replace Atlas header accent`.
- Paid Settings now uses the real JourneyDeck `assets/icon.png` in place of the temporary infinity membership glyph. Paid Atlas access now appears as a prominent cinematic gateway at the top of **Statistics**, using the existing Atlas globe artwork and opening the full Atlas overlay; the old buried duplicate inside the complete-history card was removed. The five-item navigation remains unchanged. TypeScript, tab-runtime **30/30**, full suite **194/194**, iOS export (**1,829 modules / 27 assets**), and `git diff --check` pass. Published and independently verified on iOS production runtime `1.9.0-build13`: update group `e054d4ef-e850-4dfb-994e-9b74bf9f1043`, iOS update `01a06d4d-9488-76dc-93c7-fb93fad6a575`, message `Surface paid Atlas access`.
- User preference for the active physical-testing phase: automatically publish completed OTA-compatible app changes after verification unless the user explicitly says not to. Native-only changes still require a new build rather than an OTA.

## Manual recording abandonment failsafe — September 4, 2026

- Added a V1 manual-recorder safety layer that finishes an active journey after **15 minutes without vehicle-speed movement** and imposes a **24-hour absolute ceiling**. Movement must exceed roughly 5 mph using accurate GPS displacement, so ordinary walking after parking does not restart the timer; poor-accuracy fixes cannot fake movement. Paused journeys use only the 24-hour ceiling, and native/legacy automatic sessions are explicitly excluded.
- The same rule runs inside the background location task and during app foreground/startup recovery. Finishing is protected by an atomic SQLite compare-and-set so a simultaneous user tap on **End Journey** cannot duplicate or reopen a completed session. Local archival happens before optional enrichment/sync, and a foreground-triggered finish displays a concise explanation.
- Added 9 focused behavior/structure regressions, including ordinary walking after parking. Verification passes: failsafe **9/9**, recovery **10/10**, server-independence **14/14**, TypeScript, complete mobile suite **194/194**, production iOS Expo export (**1,827 modules / 25 assets**, before the timeout-only adjustment), and `git diff --check` (only repository LF-to-CRLF notices). These changes are source-only: no commit, push, OTA, native build, TestFlight upload, App Store Connect mutation, or data change was performed. Preserve the pre-existing uncommitted iCloud/Atlas/Soundtracks files described below when staging later.

## iCloud mark and Atlas membership presentation — September 4, 2026

- Replaced the purple Settings placeholder treatment with the native `icloud.fill` symbol presented as Apple's familiar blue cloud on a light tile, plus a restrained blue card outline/glow. iCloud behavior and status controls are unchanged.
- Reworked the membership presentation around Atlas without changing StoreKit: a cinematic existing Atlas landscape now previews the product, with concrete benefits for favorite places, repeated routes, travel patterns, complete Journey/Memory/soundtrack history, and private on-device analysis. Purchase loading, verified product pricing, purchase, restore, legal links, and the free 45-day boundary are preserved.
- Added coverage for the native iCloud treatment and concrete Atlas preview. Together with the Soundtracks refresh repair below, TypeScript, focused tab runtime **30/30**, public release integrity **11/11**, complete V1 suite **185/185**, production iOS Expo export (**1,825 modules / 25 assets**), and `git diff --check` pass. Published and independently verified the combined Build 13-compatible iOS production OTA: group `f6070c96-f07a-4436-9e62-091cb87300e1`, update `01a06c08-0479-7ebb-baca-9fcd85e3f49c`, runtime `1.9.0-build13`, message `Stabilize Soundtracks and showcase Atlas`. Source remains uncommitted and unpushed; no native build, TestFlight upload, App Store Connect mutation, or user data change was performed.

## Soundtracks artwork/data replacement repair — September 4, 2026

- Diagnosed the on-device flash where **Today's soundtrack** briefly showed album artwork and then changed to **Waiting for music** even though Listening History still contained journey plays. The Soundtracks tab's delayed refresh rebuilt free-history music with its default empty detail list, replacing the complete music result that `loadPrimarySectionsData` had already produced.
- Soundtracks refreshes now reuse the already-loaded, membership-filtered journey details whenever a caller does not supply details. A generation guard prevents an older asynchronous music request from overwriting a newer result, and loading the complete primary sections explicitly invalidates any music-only request already in flight.
- Added a named regression for complete-detail reuse and stale-result rejection. TypeScript, focused Soundtracks/tab runtime **30/30**, complete V1 suite **185/185** after the Atlas presentation coverage was added, and production iOS Expo export (**1,825 modules / 25 assets**) pass. Included in verified production OTA update `01a06c08-0479-7ebb-baca-9fcd85e3f49c`. Source remains uncommitted and unpushed.

## One-line transient iCloud status — September 3, 2026

- Shortened the temporary Settings iCloud check message to **“Checking iCloud zone…”** and constrained only that brief syncing state to one line. Stable iCloud status and explanatory copy can still wrap normally, while the momentary check can no longer resize the card and resemble a visual glitch.
- Added a regression covering the exact copy and conditional one-line behavior. TypeScript, focused tab runtime **29/29**, complete V1 suite **183/183**, production iOS Expo export (**1,825 modules / 25 assets**), and `git diff --check` pass.
- Implementation commit `42d6df8` (`fix: stabilize transient iCloud status`) is pushed to `origin/codex/native-runtime-prep`. Published and independently verified the Build 13-compatible iOS production OTA: group `86549ee4-4eb5-413b-9409-f5d23ba77c91`, update `01a06a6a-459f-7415-bc10-ec7744db5da9`, runtime `1.9.0-build13`, message `Shorten iCloud status`. No native build, TestFlight upload, App Store Connect mutation, or user data change was performed.

## Settings inertial-scroll sawtooth correction — September 3, 2026

- Reviewed the tester's 14.89-second, 1320x2868/59.93fps recording of architecture OTA `01a06932-07c7-743b-8c65-fbe30dc89515` frame by frame. The rebuilt Saved Place editor is pixel-stable through keyboard presentation and every recorded keypress. The Settings overview, however, visibly reverses direction every few frames during inertial scrolling, producing extreme sawtooth judder.
- Root cause is the scroll-restoration addition in the rebuild: Settings supplied a ref-backed `contentOffset` prop while also updating that ref from `onScroll`. Frequent parent commits caused React Native/Fabric to reapply a slightly stale position while iOS momentum scrolling was advancing. Removed `contentOffset`, the scroll callback/throttle, and the offset ref entirely. Settings now leaves its `ScrollView` fully native and intentionally returns to the top after closing an editor rather than attempting live position restoration.
- Added a regression that forbids Settings from supplying `contentOffset`, `onScroll`, `scrollEventThrottle`, or a stored scroll offset. TypeScript, focused Settings **6/6**, tab runtime **29/29**, complete V1 suite **183/183**, and production iOS Expo export (**1,825 modules / 25 assets**) pass.
- Correction commit `7c18546` (`fix: release Settings scroll ownership`) is pushed to `origin/codex/native-runtime-prep`. Published and independently verified the replacement Build 13-compatible iOS production OTA: group `f74ab156-7b25-4777-9752-e27ee30cb21c`, update `01a06940-ff0a-7a43-a2db-1355daebbcaa`, runtime `1.9.0-build13`, message `Fix Settings scrolling`. No persistence, editor, recording, Home, navigation appearance, Journey Details, sharing behavior, native build, TestFlight upload, App Store Connect state, or user data changed.

## Settings rendering architecture rebuild — September 3, 2026

- Replaced the repeated Settings workarounds with a structural isolation. The native pager now owns only Soundtracks, Memories, Home, and Statistics; Settings has one canonical opaque screen instance outside the pager, outside `CinematicTabPage`, and outside all page transforms. The circular Settings/music sentinel copies and the duplicate Settings entry under Tools were removed.
- Rebuilt Primary Driver and Saved Place editing as ordinary opaque full-screen Settings destinations instead of transparent native modals over the Settings `ScrollView`. Editors have their own draft/busy state, do not observe or resize from keyboard-frame events, hide the bottom navigation while active, expose a keyboard-safe top Save action for the profile, and disable Back while native photo/location work is pending. Stale asynchronous place lookups are invalidated on unmount and cannot save after cancellation.
- Settings intentionally returns to the top after editor round-trips; the attempted scroll restoration was removed by the correction above. Leaving Settings dismisses any focused keyboard. Approved Home, bottom-navigation appearance, Journey Details, sharing, recording, persistence, membership, and music behavior were not redesigned; only the transition into/out of Settings is now immediate instead of using the circular pager animation.
- Verification passed: required subsystem commands, TypeScript, focused Settings/tab/navigation checks, complete V1 mobile suite **183/183**, production iOS Expo export (**1,825 modules / 25 assets**), and `git diff --check` aside from repository LF-to-CRLF notices. The optional dormant Tessie suite remains **4/5** because its already-stale UI assertion expects `VehicleIntelligenceScreen`, which is absent from both this tree and the prior published commit after Tessie was deferred to V2.
- Implementation commit `5d0ec23` (`fix: rebuild Settings rendering architecture`) is pushed to `origin/codex/native-runtime-prep`. Published and independently verified the Build 13-compatible iOS production OTA: group `c52b458a-fe20-478c-8b96-8a616eb43fbb`, update `01a06932-07c7-743b-8c65-fbe30dc89515`, runtime `1.9.0-build13`, message `Rebuild Settings rendering architecture`.
- Physical acceptance should repeatedly tap Settings rows, edit every character of the Primary Driver name, open each Saved Place editor, use Back/Save, and switch into/out of Settings while watching for any page displacement. No native build, TestFlight upload, App Store Connect mutation, or data reset was performed.

## Settings Saved Place keyboard stabilization — September 3, 2026

- Reviewed the tester's follow-up 19.15-second, 1320x2868/58.77fps recording after OTA `01a06906-4638-7b8f-b721-11981516e1f3`. The Primary Driver editor and its background remain stable. The Saved Place sheet still exposed one roughly 12-pixel background displacement lasting four 60fps frames immediately around a key-preview interaction.
- Isolated the remaining difference to the shared bottom-sheet keyboard container. Replaced its continuously managed native keyboard-avoidance wrapper with a settled `keyboardDidShow`/`keyboardDidHide` height spacer. The sheet still moves above the keyboard and retains its Done control, scrolling, layout, and styling, but ordinary keypresses can no longer change the container geometry.
- Added structural regressions for the settled keyboard height and continued Memory-editor keyboard usability. Verification passed: TypeScript, focused Settings/navigation checks **42/42**, complete mobile suite **184/184**, production iOS Expo export (**1,825 modules / 25 assets**), and `git diff --check` (only repository LF-to-CRLF notices).
- Implementation commit `3123eee` (`fix: stabilize editor keyboard layout`) is pushed to `origin/codex/native-runtime-prep`. Published and independently verified the Build 13-compatible iOS production OTA: group `eaa06198-08c2-4409-bb54-684ca9c5391e`, update `01a06917-bc5c-7111-97eb-1ba279389d9a`, runtime `1.9.0-build13`, message `Stabilize Settings editor keyboard`. No native build, TestFlight upload, App Store Connect mutation, or data reset was performed.

## Settings touch-redraw bounce correction — September 3, 2026

- Re-reviewed the tester's 7.8-second recording at individual keypress frames after the prior transition and modal-animation changes did not resolve the problem. The editor/modal remains stationary, but the underlying Settings `ScrollView` drops roughly 12 pixels for a frame whenever editor state changes, including each typed letter. This supersedes the earlier cross-fade-only diagnosis below.
- Cached the visible Settings scroll page separately from the Saved Place and Primary Driver editor state. Opening an editor and changing its draft now reconcile only the editor layer, preventing iOS from briefly reapplying the background scroll content offset. No Settings layout, approved Home/navigation/Journey Details/sharing UI, or persistence behavior changed.
- Added a regression requiring editor draft/busy state to remain outside the cached Settings page. Verification passed: TypeScript, focused Settings/navigation checks **41/41**, complete mobile suite **183/183**, production iOS Expo export (**1,825 modules / 25 assets**), and `git diff --check` (only repository LF-to-CRLF notices).
- Implementation commit `3614bd9` (`fix: freeze Settings behind editors`) is pushed to `origin/codex/native-runtime-prep`. Published and independently verified the Build 13-compatible iOS production OTA: group `7dcf52f3-6dd6-41ce-9093-62b1317ddf83`, update `01a06906-4638-7b8f-b721-11981516e1f3`, runtime `1.9.0-build13`, message `Stop Settings touch redraw bounce`. No native build, TestFlight upload, App Store Connect mutation, or data reset was performed.

## Settings modal cross-fade glitch — September 3, 2026

- Reviewed the tester's 7.8-second, 1320x2868/60fps screen recording frame by frame. The Settings page itself and its scroll offset remain stable; the visible glitch occurs during the native modal fade, when the partially transparent Saved Place sheet briefly overlaps the still-visible Settings labels and controls beneath it.
- Added an explicit animation choice to the shared overlay while retaining `fade` as the default for approved experiences. Settings Saved Place and Primary Driver profile editors now use an immediate opaque presentation, preventing ghosted/doubled text and the apparent jiggle without changing their layout, keyboard avoidance, or other screens' transitions.
- Verification passed: TypeScript, focused Settings/navigation/tab checks **40/40**, full mobile suite **182/182**, and production iOS Expo export (**1,825 modules / 25 assets**). Implementation commit `a575b47` (`fix: remove Settings modal cross-fade`) is pushed to `origin/codex/native-runtime-prep`.
- Published and independently verified the Build 13-compatible iOS production OTA: group `12460a72-5d06-41bb-8819-589f04c90ca7`, update `01a068f9-d846-7af9-9e47-020a3d71d84f`, runtime `1.9.0-build13`, message `Fix Settings modal presentation glitch`. No native build, TestFlight upload, App Store Connect mutation, or data reset was performed.

## Settings Primary Driver profile editor — September 3, 2026

- Made the full **Primary Driver** account card in Settings actionable. Tapping it opens the existing private profile-editing experience for changing the display name, choosing/replacing a profile photo, or returning to initials.
- The Settings card now displays the saved profile name and photo/initials immediately after saving. Profile appearance continues to use the existing private, profile-scoped preference and photo-size safeguards; the approved Home, navigation, Journey Details, and sharing layouts were not changed.
- Removed the vertical departure jiggle from Settings and other tall tabs. The shared transition retains its subtle fade and horizontal depth compression but no longer scales vertically around the screen center, so the page's top edge remains fixed while navigating away.
- Verification passed: TypeScript, focused Settings/navigation/tab checks **40/40**, full mobile suite **182/182**, production iOS Expo export (**1,825 modules / 25 assets**), and `git diff --check` (only repository LF-to-CRLF notices). Implementation commit `c54df5b` (`fix: connect profile editor and stabilize tab motion`) is pushed to `origin/codex/native-runtime-prep`.
- Published and independently verified the Build 13-compatible iOS production OTA: group `56df5710-6a20-4586-a7ff-48146a9a4215`, update `01a068d6-a63f-7b70-a2a6-2f8dc61a429c`, runtime `1.9.0-build13`, message `Add profile editing and stabilize tab transitions`. No native build, TestFlight upload, App Store Connect mutation, or data reset was performed.

## Saved Places and simplified Settings — September 3, 2026

- Replaced the passive **Home & Work Safe Zones** card with a compact **Saved Places** editor for **Home, Work, and School**. Each place can be set from a street address or the iPhone's current location, changed, or removed.
- Saved Places remain local-first and privately synchronize as profile preferences. They materialize into the canonical places table so one saved name automatically propagates to matching Journey start/end labels.
- Home, Work, and School now receive the same share-card endpoint protection. Share copy refers to a saved place rather than exposing which sensitive category was trimmed.
- Removed the redundant visible **Manual Recording** section from Settings because JourneyDeck V1 is manual-only. Tightened the Settings header, membership, iCloud, and account copy without changing the approved Home, navigation, Journey Details, or sharing layouts.
- Verification passed: TypeScript, focused Saved Places/privacy/storage/Settings checks **38/38**, full mobile suite **181/181**, production iOS Expo export (**1,825 modules / 25 assets**), and `git diff --check` (only repository LF-to-CRLF notices). Implementation commit `9160ca3` (`feat: simplify settings with saved places`) is pushed to `origin/codex/native-runtime-prep`.
- Published and independently verified the Build 13-compatible iOS production OTA: group `1bb59ed4-24a4-4d22-8f8f-4387c8f8234b`, update `01a068af-7e22-73c9-b24c-d03ebbb88b1d`, runtime `1.9.0-build13`, message `Add Saved Places and simplify Settings`. No native build, TestFlight upload, App Store Connect mutation, or data reset was performed.

## V1 product simplification: Journeys and Memories — September 3, 2026

- Simplified the public information model to two levels: a **Journey** is one recorded drive, and a **Memory** is a user-created group of one or more Journeys. Collections and their public data/API/search/sync paths are retired. The user explicitly confirmed that previous grouping data does not need to be preserved because they are the only user; existing recorded Journeys remain intact.
- New direct-group Memories use a `memory_v1_` identity and store Journey IDs directly. Pre-V1 Memory/Collection rows and their photos are quarantined from display and CloudKit synchronization so disposable legacy grouping data cannot reappear from iCloud. The physical legacy SQLite column/record-type declarations remain inert for additive-schema and deployed-CloudKit compatibility.
- Simplified Settings to one selected soundtrack method with one **Change** button, one **iCloud Backup** status, Apple identity under **Account**, manual recording only, and **Data Health** nested under collapsed **Advanced Support**. Drive Intelligence and Tessie are absent from the V1 public experience; automatic recording and Tessie network behavior remain fail-closed behind disabled release gates. Paid membership now unlocks only Atlas and complete history; free history remains the latest 45 days.
- Updated first-run instructions, paywall language, App Store metadata/review notes, privacy documents, release documentation, retention language, and tests. The approved Home, primary navigation, Journey Details, and sharing compositions were not redesigned by this simplification.
- Verification passed: TypeScript, full mobile suite **178/178**, production iOS Expo export (**1,824 modules / 25 assets**), and `git diff --check` (only repository LF-to-CRLF notices). Implementation commit `b432add` (`feat: simplify JourneyDeck version 1`) is pushed to `origin/codex/native-runtime-prep`.
- Published and independently verified the Build 13-compatible iOS production OTA: group `c3f85461-c212-4890-bae4-2d6910b3fe1f`, update `01a06882-383e-719b-a3cd-f3013b93a147`, runtime `1.9.0-build13`, message `Simplify JourneyDeck V1 journeys and memories`. No native build, TestFlight upload, App Store Connect mutation, or destructive data reset was performed.

## Production OTA: merged Home recorder and centered five-tab dock — September 2, 2026

- Replaced the primary Live destination with the approved merged Home experience. Home now owns the single mounted recorder UI and immediately presents **Start Journey**; while recording it presents **End Journey** and conditionally presents **Identify Song** only when Apple Music is not authorized. Location permission setup, recording duration, route-point count, song count, pause/resume recovery, confirmation before finish, local persistence, Apple Music capture, and manual recognition continue to use the existing recorder controller rather than a second implementation.
- Reordered the fixed primary navigation to **Soundtracks · Memories · Home · Statistics · Settings**. Home is page/index 2 at startup and has the approved option-3 raised glass pedestal plus a persistent coral shimmer. The old Live page is no longer mounted or exposed in primary navigation.
- Promoted Settings to a real rightmost primary tab and added a one-tap Data Health row inside it. Statistics is now always the fourth tab for both tiers; verified paid members retain Atlas through **Open Your Atlas** inside Statistics, while free members retain the existing upgrade action.
- Verification passed: TypeScript; focused tab runtime **29/29**; every subsystem command required by `mobile/recorder/AGENTS.md`; full mobile suite **176/176**; Expo Doctor **21/21**; production iOS export **1,825 modules / 26 assets**; `git diff --check` with only existing LF-to-CRLF notices.
- Published the final Build 13-compatible iOS production OTA: group `5ca5437f-af35-4bd9-b226-f0fd7d849775`, update `01a064ec-b12f-7634-8f2a-b4acfec6838e`, runtime `1.9.0-build13`, message `Merge recorder into Home and center the primary navigation`. It supersedes the immediately prior group from the same task with the corrected Apple-Music-selection check for the conditional **Identify Song** control. No native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed.

## Production OTA: manual-first V1 with paid Tesla/Tessie automation — September 2, 2026

- Changed the public V1 recording model to Manual Start/Finish by default. New first-run users are no longer offered Automatic; Live keeps the Start control visible in Manual mode, and the existing background route task continues sampling authorized Apple Music playback while a manual journey is active.
- Re-enabled the preserved Tessie integration as a paid capability. Automatic Drive Detection now fails closed unless StoreKit reports an active membership, Tessie has verified at least one active Tesla for the current local profile, the user explicitly chooses Automatic, and iOS foreground/background location permissions are granted. The iPhone remains the GPS route recorder; Tessie is the eligibility and optional vehicle/media layer.
- Tessie tokens remain profile-scoped in iPhone Keychain. A successful connection stores a separate verified-vehicle marker; disconnect, membership loss, or invalid eligibility returns an idle app to Manual and prevents new automatic journeys. An already active automatic journey may finish safely before the downgrade is applied.
- Updated paywall/Settings/Live wording plus App Review, metadata, subscription, release, privacy-policy, and privacy-label source documents. The public `web/privacy.html` source now discloses Tessie, but the website deployment was not performed in this OTA task and must be published before public distribution of this behavior.
- Verification passed: TypeScript; full mobile suite **176/176**; focused drive detection **14/14**, dormant Tessie **5/5**, Phase-3 native release **3/3**, and Cloudflare worker checks; Expo Doctor **21/21**; production iOS export **1,825 modules / 26 assets**; `git diff --check` with only existing LF-to-CRLF notices. The production edge health endpoint reported `status=healthy`, `environment=production`, and `features.tessie=true`.
- Published and independently verified the Build 13-compatible iOS production OTA: group `4029c1d4-66a6-422a-8556-e9accde36dea`, update `01a06499-e914-73fe-baa9-906f25f5df5c`, runtime `1.9.0-build13`, message `Default to manual recording and gate automation with Tessie`. No native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed.
- Physical acceptance: open Build 13, wait briefly, fully close/reopen once, confirm Settings shows Manual Recording and the paid Tessie tile, complete a manual journey with the phone locked, and verify its Apple Music soundtrack. Then restore/purchase membership, connect a real Tessie token with a Tesla, choose Automatic, confirm Data Health reports Armed, and complete one automatic start/finish test.

## Build 13 implementation and release — September 2, 2026

- Build 13 now embeds the latest production OTA work: bounded automatic-departure pre-roll, synchronized/reduced-motion-aware tab transitions, and the approved `Floating Memory Timeline` fallback artwork.
- Installed `expo-observe` and enabled production source-map upload. JourneyDeck uses a fixed, sanitized event vocabulary for recorder milestones, artwork caching, CloudKit failures, and database recovery; diagnostic failures are caught outside recorder transactions and no coordinates, addresses, labels, journey/music names, Apple identity, account identifiers, or record payloads are attached. The app/privacy-policy source and App Store privacy worksheet now disclose anonymous diagnostics.
- Corrected the dormant native Swift automatic-recorder wake path: a significant-location wake immediately begins a 90-second precise confirmation burst, unknown/slow first samples no longer terminate that burst, and native pre-roll is bounded. `NATIVE_AUTOMATIC_RECORDER_ENABLED` remains `false`, so the physically proven Expo detector continues to own automatic recording until the native path receives a controlled physical-drive test.
- Runtime compatibility is explicitly isolated as `1.9.0-build13`, preventing Build 12 from receiving future Build 13-only OTAs that import the new native Observe module. Marketing version remains `1.9.0`; EAS remote build-number auto-increment should produce iOS Build 13.
- Verification before commit/build: TypeScript passed, full suite **174/174**, Expo Doctor **21/21**, production iOS Expo export passed (**1,825 modules, 26 assets**), and iOS autolinking includes `expo-observe`. `npm audit --omit=dev` still reports 14 moderate transitive Expo-tooling advisories; no breaking `--force` dependency rewrite was applied.
- Git implementation commit `61c9557` and dependency-lock correction `50f3368` are pushed to `origin/codex/native-runtime-prep`. The first EAS attempt (`494429d7-5ea4-4548-ae48-dcde58f1bce6`) failed before compilation because Expo's patch normalization left `package-lock.json` stale; local `npm ci --include=dev` now proves the corrected lockfile used by EAS.
- The successful signed iOS Build 13 is EAS build `465977ab-089e-4013-bdde-a2ea93b63d59`, produced from Git `50f3368`, app `1.9.0` / build `13` / runtime `1.9.0-build13`. Native Swift compilation, archive, signing, and source-map upload succeeded.
- EAS submission `2c206467-7253-44d6-851c-a8bdfc06ced8` was accepted by App Store Connect. Apple is processing the binary for TestFlight; no manual Apple action was required during upload. Confirm processing availability in TestFlight before the physical-drive test.
- Build 13/version 1 exclusion: Foursquare integration remains explicitly deferred to JourneyDeck 2.0. Version 1 continues using native MapKit POI search, Apple's reverse geocoder fallback, and user-named canonical places; do not add Foursquare SDKs, API calls, credentials, disclosures, or UI before the user begins 2.0 work.

## Production OTA: earlier automatic starts and synchronized tab motion — September 2, 2026

- Published the bounded automatic departure pre-roll described below. JourneyDeck keeps its conservative three-sample drive confirmation, then backfills the saved journey to the last accurate stationary anchor and continuous departure points, correcting late starting location, route, duration, and mileage without increasing false starts.
- Reworked primary-tab motion around one shared pager progress value. The native page glide, restrained 8% fade/1.5% scale, and orange navigation indicator now move from the same live progress; screens remain mounted and iOS Reduce Motion switches to an immediate, unscaled transition.
- Included the already-approved `Floating Memory Timeline` fallback artwork in the same production bundle. User-selected Memory cover photos still take priority.
- Verification passed: TypeScript, focused navigation **6/6**, drive detection **14/14**, tab runtime **29/29**, full mobile suite **172/172**, production iOS Expo export (**1,786 modules, 26 assets**), and `git diff --check` aside from existing LF-to-CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `7e232a1d-485e-41c4-8a4b-1c68a90ac955`, iOS update `01a062ef-7885-7d87-b69b-7cf7d07bdd8a`, message `Improve automatic starts and tab transitions`. No native build, TestFlight upload, commit, git push, App Store Connect mutation, or data reset was performed.

## Automatic journey departure pre-roll — September 2, 2026

- Physical testing found that automatic routes can begin one to two miles after the real departure even though the journey eventually starts and completes. Repository history confirmed the original 15 mph / three samples / 20-second confirmation threshold was unchanged; the active Build 12 Expo safety fallback discarded all locations received before confirmation and created the session at only the final trigger point.
- Added a bounded, local-only automatic pre-roll in `src/automatic-drive-preroll.ts`. While armed, JourneyDeck retains at most 32 accurate locations from the last four minutes. It still requires the existing conservative drive confirmation, then selects the continuous movement leading into confirmation plus the last accurate stationary anchor and rejects stale/inaccurate samples.
- Automatic sessions can now be backdated to the selected departure anchor, and every selected pre-roll point is inserted before BestForNavigation live tracking continues. This restores the correct starting place, initial route segment, duration, and mileage without lowering the threshold or increasing false automatic starts. Existing stored automatic state remains backward compatible.
- Added functional regressions for departure-anchor recovery, bounded retention, and inaccurate-point rejection plus structural coverage for session backdating and route insertion. Verification passed: focused recording/release tests **36/36**, TypeScript, full mobile suite **170/170**, and production iOS Expo export (**1,786 modules, 26 assets**).
- This correction shipped in production OTA group `7e232a1d-485e-41c4-8a4b-1c68a90ac955`. No native build, TestFlight upload, commit, push, App Store Connect mutation, or data reset was performed.

## Approved default Memory artwork option 1 — September 2, 2026

- The tester selected generated option 1, `Floating Memory Timeline`, to replace the generic neon-road fallback used when a Memory has no chosen cover photo.
- Added an optimized 1248x936 (4:3), 84 KB asset at `mobile/recorder/assets/memory-default-floating-timeline-v1.jpg`. It shows three cinematic photographic memory prints linked by a coral light thread, with dark plum edges and no road, map, text, logo, or UI baked into the image.
- `MemoryArtwork` now renders the approved static asset with `expo-image` for both Memories carousel cards and Memory Detail. A user-selected cover photo remains the highest-priority artwork and all existing title-safe gradients remain unchanged.
- Added a structural regression that requires the new asset and rejects the retired `memoryArtRoad` SVG. Verification passed: TypeScript, focused tab-runtime **29/29**, full mobile suite **167/167**, and production iOS Expo export (**1,785 modules, 26 assets**).
- This artwork shipped in production OTA group `7e232a1d-485e-41c4-8a4b-1c68a90ac955`. No native build, TestFlight upload, commit, push, App Store Connect mutation, or data reset was performed.

## Continuous Apple Music playback deduplication — September 1, 2026

- Physical Build 12/OTA screenshots showed identical consecutive soundtrack moments: `Lady Marmalade` twice, `Hakuna Matata` twice, and `Nobody Like U` three times. The native Apple Music sampler polls every 20 seconds, and iOS can temporarily return a zero or stale playback position; the old fixed 45-second database window therefore treated later samples of the same still-playing song as new moments.
- Added shared duration-aware playback matching in `src/music-playback-dedupe.ts`. Recorder-inbox writes and unified archive writes now collapse repeated samples for one continuous playback, merge richer album/artwork/catalog metadata into the retained row, and still preserve a legitimate same-song replay when another track occurred between plays.
- Added a rollback-safe, one-time local repair (`repair.music-playback-dedupe.v1`) that removes existing continuous-playback duplicates from both unified journey music and pending recorder observations, repairs affected journey song counts, and leaves the archive usable if malformed legacy data prevents cleanup. Journey Details also derives its displayed count from the cleaned soundtrack list.
- Added regressions for repeated zero-position polls, post-journey history enrichment, and a real replay after an intervening song. Verification passed: targeted music/storage checks **16/16**, TypeScript, full mobile suite **167/167**, and production iOS Expo export (**1,784 modules, 25 assets**).
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `7d525561-daf6-4bce-8808-e84e101c66d6`, iOS update `01a06048-4415-73d5-b108-33f0a3ff725f`, message `Fix duplicate journey soundtrack songs`. No native build, TestFlight upload, commit, push, App Store Connect mutation, or data reset was performed.

## Journey Details memory-and-music hero — September 1, 2026

- The tester rejected the cropped abstract route artwork at the top of Journey Details and selected mockup option 3: floating photographic/album-like memory tiles connected by a coral soundwave, with no additional road motif.
- Added the chosen generated artwork as `mobile/recorder/assets/journey-detail-memory-hero-v1.jpg`, center-cropped and optimized to the hero's exact 1248x400 (3.12:1) display ratio at 48 KB.
- Replaced only `JourneyHeroAtmosphere` in `src/shell.tsx`; live journey date/title, metrics, soundtrack, map, and all behavior remain unchanged. Directional dark gradients preserve title contrast over the left side.
- Updated the Journey Details structural regression. Verification: TypeScript passed, targeted tab-runtime tests 29/29, full default suite 163/163, and `git diff --check` passed aside from existing line-ending warnings.
- Published the hero change to the production iOS OTA channel for runtime `1.9.0`. Update group: `e82b90c1-e296-429c-9336-d8a716decbe9`; iOS update: `01a06019-1d38-73b3-a62e-f26fb0db3373`; message: `Replace Journey Details hero with memories and music`. The export included 1,783 modules and the new 48 KB asset; a separate `eas update:list` check confirmed this is the production branch head.
- Physical inspection of that first OTA showed the old SVG was gone but the new bitmap was blank on-device. The live copy and dark overlay rendered, isolating the issue to the React Native static image presentation. Switched the hero bitmap to the already-proven `expo-image` renderer with disk/memory caching and reduced the directional overlay opacity so the artwork is clearly visible.
- Published the renderer correction to production: update group `87b34de9-b6ce-4dfd-8e09-a570cd260133`, iOS update `01a06022-cb39-7943-a057-e8d2ca86259b`, message `Restore visible Journey Details artwork`. Verified as production head. TypeScript, targeted 29/29, and full default suite 163/163 passed. Physical confirmation is still required.

## Intermittent pulled-down tab correction — September 1, 2026

- A physical screenshot showed Statistics occasionally opening with a purple refresh spinner and a large blank top inset; the tester reports it can occur on multiple tabs and that a tap immediately restores the layout.
- Root cause: the shared `ScreenScaffold` bound native `RefreshControl.refreshing` to the global `PrimaryDataState.status === 'loading'`. Automatic local archive reloads could therefore activate iOS's pull-to-refresh inset even when the user had not pulled.
- Corrected the shared scaffold so only a real pull gesture owns `manualRefreshing`; background reloads update data without shifting the scroll view. Primary refresh callbacks now return their promise so genuine gesture refreshes remain visible until completion. Soundtracks already used gesture-only state, while Home and Memories do not attach this refresh control.
- Added a regression assertion in `tests/tab-runtime.test.mts`. Verification: TypeScript passed, targeted tab-runtime tests 29/29, full default suite 163/163, and `git diff --check` passed aside from existing line-ending warnings.
- Published the correction to the production iOS OTA channel for runtime `1.9.0`. Update group: `60faeff5-c3f3-4cc8-abaa-68be211a60a3`; iOS update: `01a05fff-3f10-71dc-9cdf-74b0e20fe011`; message: `Prevent tabs from opening pulled down`. A separate `eas update:list` check confirmed it is the production branch head.

## Physical automatic-recording confirmation — September 1, 2026

- The sole TestFlight tester installed the production OTA fallback (`178ef63d-28ec-49c7-82e6-f2f886d7db9d`) and confirmed that a real drive was detected automatically again.
- The same physical test also finished automatically after parking and the journey persisted successfully.
- This verifies the complete restored Expo/background-location lifecycle on the Build 12 binary: background wake, automatic start, route capture, automatic finish, and persistence.

## App Store Connect listing, distribution, and privacy setup — September 1, 2026

- Completed App Information for JourneyDeck: subtitle `Your private driving journal`, Lifestyle primary category, Travel secondary category, confirmed necessary rights for third-party content, and completed Apple's current age-rating questionnaire with a calculated **4+** rating. The app is not marked Made for Kids and has no higher-rating override.
- Completed the iOS 1.9.0 version text metadata, selected processed TestFlight **Build 12 (1.9.0)**, marked reviewer sign-in as not required, added the monitored App Review contact and review notes, and changed release control to **manual release**. No Add for Review or Submit for Review action was taken. Required iPhone screenshots are still missing (`0 of 10`) and remain a release blocker.
- Configured the app download price as **free** with the United States as the base country, limited launch availability to **United States only** (1 available / 174 unavailable), retained public App Store distribution, and disabled Apple Silicon Mac, Apple Vision Pro, and Apple School Manager reduced-price availability. The native binary is already iPhone-only.
- Added `https://journeydeck.me/privacy` and published the App Privacy responses. The public preview reports five non-linked, non-tracking technical data types: Coarse Location for map functionality; Device ID, Product Interaction, Performance Data, and Other Diagnostic Data for Expo update functionality/analytics. Journey routes, precise location, places, photos, music history, artwork, microphone audio, memories, purchases, and contact details are not declared as developer-collected because they remain on-device or in the user's private Apple services.
- Configured the `JourneyDeck Membership` subscription group localization for English (U.S.). Monthly (`$2.99`) and annual (`$24.99`) retain their approved prices and product localization, are now United States-only, and have matching App Review instructions. Annual Family Sharing is enabled to match monthly. Billing Grace Period is enabled for 16 days, all renewals, in production and sandbox; Streamlined Purchasing remains on.
- Subscription service levels still need one manual App Store Connect drag: move `JourneyDeck Annual` onto the `JourneyDeck Monthly` row so both identical-entitlement durations share Level 1, then save. The automated browser could not operate Apple's custom drag control reliably. Do not add either product for review yet. Each product also still needs the real Build 12 paywall screenshot from Statistics > Unlock Atlas + Complete History.
- Remaining App Store preparation: create and upload final iPhone screenshots; add both subscription review screenshots and finish the Level 1 drag above; verify Agreements/Tax/Banking; resolve any required U.S. trader/contact declarations; then perform a final submission audit before any Add for Review action.

## TestFlight Build 12 uploaded — September 1, 2026

- **Release blocker discovered and OTA correction published:** two automatic drives (approximately one hour and seven minutes) were not detected. Repository inspection found a launch-order race in `App.tsx`: multiple unsequenced effects could call `configureNativeAutomaticRecorder(false/true)` concurrently as device id and permissions settled, allowing a stale disable call to finish after the enable call. The correction serializes and coalesces native configuration so the newest desired state is applied last, removes the irrelevant `taskAvailable` rerun, re-arms when JourneyDeck returns to the foreground, and exposes the actual native state/error in Data Health. Physical acceptance is still required; Data Health must say `Automatic drive detector — Armed` before another foreground/background/locked-phone drive.
- Created JourneyDeck **1.9.0 (12)** from the complete current working tree, including the approved production OTA head (`57e4bb05-5f92-445c-9860-6ff8632d110c`), the Build 11 SQLite crash correction, and native MapKit POI arrival enrichment. Successful EAS build ID: `d1fc53dc-5c72-4c5e-bf01-d61f5a6ec998`; fingerprint: `b2b76f798baf38d66f9b2c56964f747e1dc3aa90`; IPA: `https://expo.dev/artifacts/eas/zj-KZcngpSnOEaD-ZpxR7Uf5F_67wnG-RRhyZSFNSkE.ipa`.
- Corrected the confirmed Build 11 crash boundary: Swift now exclusively owns a small rollback-journal `journeydeck-native-inbox.db`, while Expo's bundled SQLite exclusively owns `journeydeck-local.db`. Native automatic recording exports typed incremental sessions and route points; Expo imports them transactionally and acknowledges a completed native session only after the full route and completion jobs are safely present. Swift no longer opens or writes the Expo database or its WAL.
- Added native MapKit POI search around journey endpoints. JourneyDeck prefers the closest relevant Apple Maps point of interest within the bounded arrival radius, falls back to Apple's reverse geocoder when no suitable POI is found, and preserves user-saved canonical place names as the highest-priority source. No Apple Developer capability or portal change is required for this native MapKit use.
- Verification passed: TypeScript, full mobile suite **166/166**, Phase-3 native-release checks, production iOS Expo export (**1,782 modules, 24 assets**), native module autolinking, `git diff --check`, and the signed EAS/Xcode compile. Expo Doctor passed 20/21 checks; its only warning is a nonblocking patch-version alignment suggestion across 12 Expo SDK 57 packages, intentionally deferred rather than widening the release scope.
- Submitted that exact binary to App Store Connect. EAS submission ID: `b346471a-9c38-4d49-bb0b-44c65831155e`. Apple accepted and processed the upload; App Store Connect now reports Build 12 as **internal: in beta testing** at `https://appstoreconnect.apple.com/apps/6806502526/testflight/ios`.
- Release source commit `f56370b` (`feat: ship Build 12 reliability release`) was pushed to `origin/codex/native-runtime-prep`. Next physical acceptance: install Build 12, complete automatic drives with the app foregrounded, backgrounded, and the phone locked, verify completed routes and artwork, confirm POI/place naming and canonical rename propagation, and monitor TestFlight crash feedback. No device-data reset was performed.

## Production OTA: restore proven automatic detector — September 1, 2026

- Physical testing proved the Build 12 native significant-location start trigger remained unreliable after its configuration-race repair. Published a reversible OTA that explicitly disables native automatic startup (`NATIVE_AUTOMATIC_RECORDER_ENABLED=false`) and restores the previously proven Expo high-accuracy automatic detector as the sole idle/start/park owner.
- The crash-safe database boundary is unchanged: Expo automatic sessions write only through the Expo-owned master database, while the small Swift inbox remains isolated for importing any already-active native journey. Reconciliation disables future native starts before arming Expo; if a native journey is already recording, Expo stays off until that journey finishes so duplicate sessions cannot be created.
- Restored exactly one full Expo automatic task registration and removed the competing no-op registration from the active bundle. Data Health now polls both engines and reports the fallback's real `Armed` state with the detail `Build 12 safety fallback is watching regular GPS samples for driving.`
- Verification passed: focused recording/release tests **71/71**, all three configuration-race tests, default mobile suite **162/162**, dormant Tessie suite **5/5**, Phase-3 native-release **3/3**, TypeScript, production iOS Expo export (**1,782 modules, 24 assets**), and `git diff --check` with only existing LF-to-CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `178ef63d-28ec-49c7-82e6-f2f886d7db9d`, iOS update `01a05f90-372d-7a0e-951a-c75d44fd0b09`, message `Restore reliable automatic drive detection`.
- Acceptance: open JourneyDeck long enough to download the OTA, fully close/reopen it, switch Settings back to Automatic, and confirm Data Health says `Automatic drive detector — Armed` with the Build 12 fallback detail. Complete a drive with at least 20 seconds of sustained vehicle speed, then remain parked for approximately five stationary minutes before checking that the journey completed. No native build, TestFlight upload, App Store Connect mutation, commit, push, or data reset was performed.

## Mobile test-suite audit — September 1, 2026

- Kept all three native automatic-recorder configuration race tests separate and unchanged. They continue to cover stale-disable ordering, queued-state coalescing, and recovery after a stale failure.
- Reduced the default mobile release suite from **169 to 162** checks. Five dormant Tessie behavior checks moved into the explicit `npm run test:dormant-tessie` suite; one duplicate Tessie transport check and one duplicate Build-10 migration fixture were removed. The active default suite still proves that every Tessie runtime/background/UI entry point is disabled for version 1, and the deployed Cloudflare Tessie boundary tests remain because that code is still an exposed security surface.
- Replaced checks against the retired JavaScript automatic detector with checks against the native Swift recorder, native inbox completion path, and the intentionally retained no-op task used to unregister old Expo background work. Removed the retired full JavaScript automatic detector from `index.ts`, so it is no longer bundled or registered alongside the native recorder.
- Kept the focused unified legacy-recorder migration test and profile-handoff/unregistration test. Those are not duplicates: the former validates the still-shipped migration implementation and source preservation, while the latter prevents old background work from surviving a profile transition.
- Verification passed: recorder activation **3/3**, changed focused tests **36/36**, default mobile suite **162/162** in about 0.81 seconds, dormant Tessie suite **5/5**, Phase-3 native-release **3/3**, TypeScript, production iOS Expo export (**1,782 modules, 24 assets**), and `git diff --check` with only existing LF-to-CRLF notices. No OTA, native build, TestFlight upload, commit, push, App Store Connect mutation, or data reset was performed.

## Automatic recording still fails physical detection — September 1, 2026

- After installing the activation-race OTA, the user completed another approximately five-minute trip and reported no automatic detection; switching to Manual recorded successfully. This isolates the remaining failure to native automatic start detection rather than database persistence, manual Core Location, or route completion.
- Native inspection found a likely second root cause in `JourneyDeckRecorderModule.swift`: idle mode uses significant-location monitoring, but precise tracking starts only after that low-power callback already yields a speed at or above 6.7 m/s. iOS may supply unknown/stale speed on the first callback, and any nonqualifying sample currently resets the candidate and stops precise tracking immediately. Short drives can therefore remain `Armed` without ever reaching `Recording`.
- A journey that did start still requires about five continuously stationary minutes after parking before it appears completed. Confirm whether the user waited that interval and capture the Data Health `Automatic drive detector` row, but do not treat the wait as an explanation if the detector never showed `Recording`.
- Recovery completed through the production OTA documented above. The permanent native confirmation-burst/grace-window correction remains deferred; no native build, commit, or push has been performed.

## Production OTA: automatic recorder activation — September 1, 2026

- Fixed the Build 12 startup race that could leave the native recorder disabled while Automatic remained selected. Native configuration requests are now serialized, queued intermediate states are coalesced, and the newest requested state always applies last. Returning JourneyDeck to the foreground explicitly reconciles the desired native state again.
- Data Health now reads the native iOS recorder every five seconds and reports `Armed`, `Recording`, or the safe native error/permission state. This makes the real Core Location state observable instead of inferring it from the selected UI preference.
- Added launch-order regression tests covering stale disable completion, coalesced intermediate requests, and a failed stale request followed by a successful enable. Verification passed: TypeScript, targeted activation **3/3**, Phase-3 **4/4**, full mobile suite **169/169**, production iOS Expo export (**1,783 modules, 24 assets**), and `git diff --check` with only existing LF-to-CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `93bc511d-994e-490c-8b5d-ee0e9ea6032b`, iOS update `01a05f42-3ab4-7eab-8fb8-7bde8788cc94`, message `Fix automatic recorder activation`.
- Acceptance: open JourneyDeck long enough to download the OTA, fully close/reopen it, confirm Data Health shows `Automatic drive detector — Armed`, then complete automatic drives with the app foregrounded, backgrounded, and the phone locked. No native build, TestFlight upload, App Store Connect submission, commit, push, or user-data reset was performed.

## Production OTA: cyan icon-only share privacy marker — September 1, 2026

- Removed the `PRIVATE AREA HIDDEN` map callout and suppressed the matching private endpoint caption beneath journey share-card maps. Protected endpoints are now represented visually by the shield alone.
- Restyled the shield with a dark-teal center, electric-cyan `#36defa` outline/halo, and pale-cyan keyhole so it stands apart from the coral-orange route and purple numbered song markers.
- Verification passed: TypeScript; focused tab-runtime **28/28** and privacy-route **5/5** tests; full mobile suite **164/164**; production iOS Expo export (**1,780 modules, 24 assets**); and `git diff --check` with only existing LF-to-CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `57e4bb05-5f92-445c-9860-6ff8632d110c`, iOS update `01a05e73-4a14-7d79-b5d1-9bc391d30151`, message `Refine share route privacy marker`.
- Build 12 remains paused pending the user's physical approval. No build number change, native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed.

## Production OTA: tighter share-card route framing — September 1, 2026

- Replaced the share-card map's coarse whole-number zoom selection with a fractional fitted viewport. The visible, already privacy-trimmed route now targets approximately 84% of the map width or 76% of its height instead of sometimes occupying barely one-third after a 2x zoom jump.
- Raster OpenStreetMap tiles, the highlighted route, Home/Work fade marker, and numbered soundtrack pins all use the same fractional projection and remain centered/aligned. Short routes may now reach zoom 18 while retaining a safety margin for annotations.
- Verification passed: TypeScript; focused tab-runtime **28/28** and privacy-route **5/5** tests; full mobile suite **164/164**; production iOS Expo export (**1,780 modules, 24 assets**); and `git diff --check` with only existing LF-to-CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `a51e0dbe-4263-478a-b087-2c2e7e9b6dbc`, iOS update `01a05e6c-8104-7519-806c-8277a0662ef2`, message `Tighten share card route framing`.
- Build 12 remains paused pending the user's physical approval. No build number change, native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed.

## Production OTA: Home/Work share-route privacy filter — September 1, 2026

- Journey share cards now physically remove recorded route coordinates near an endpoint labeled exactly `HOME` or `WORK` (case-insensitive). The deterministic cutoff is whichever hides more: the one-mile boundary from the private endpoint or the outermost soundtrack moment (first song for a private start, last song for a private destination). No randomized cutoff is used because repeated exports could otherwise reveal the private center.
- Song pins inside the removed route segment never enter the share payload. The visible route ends with a soft opacity fade, shield, and `PRIVATE AREA HIDDEN` label; the footer states that the Home/Work segment was trimmed. A short journey with no safely visible segment exports no route geometry.
- Ordinary journeys remain complete, while the existing generic private-place coordinate masking still applies after this special Home/Work trim. OpenStreetMap tile bounds are calculated only from the already-trimmed route.
- Verification passed: TypeScript; focused privacy-route tests **5/5**; privacy masker; tab-runtime tests **28/28**; full mobile suite **164/164**; production iOS Expo export (**1,780 modules, 24 assets**); and `git diff --check` with only the repository's existing LF-to-CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `dce0fe5b-ce1f-4d65-a351-9dbb026cb90e`, iOS update `01a05e66-30a0-74ff-9233-3ddb0a3ffab0`, message `Protect Home and Work share routes`.
- The user explicitly paused Build 12 so this filter can be tested first. No build number change, native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed. Do not resume Build 12 until the user approves the on-device share-card behavior.

## Production OTA: share-card and Live route polish — September 1, 2026

- Removed the Tessie-dependent **Efficiency** selector and metric from journey share cards. Share-card route snapshots now render privacy-masked, numbered song-location pins using the same saved route-moment calculation as journey details; marker labels contain only the song sequence number.
- Live now hides the complete idle **Ready for your next drive / Start a journey** card while Automatic recording is selected. It remains visible in Manual mode and returns for either mode whenever a session is active.
- Added numbered soundtrack pins to the Live map. Tapping a pin presents compact cached album artwork plus track and artist; saved journey maps now use the same artwork-and-track popup. Automatic idle Live shows the most recently completed route and its soundtrack markers until a new route starts.
- Raised centered destination titles above the exterior header-image feather/bleed layer on Memories and every shared destination header so the title cannot fade beneath a later-rendered image edge.
- Verification passed: `npm run typecheck`; focused tab-runtime 28/28 and route-moment 6/6 tests; full mobile suite **159/159**; production iOS Expo export (**1,779 modules, 24 assets**); and `git diff --check` with only the repository's existing LF-to-CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0`: update group `b92ada56-e15f-4f3f-92af-00af7a2b316d`, iOS update `01a05e45-7bcd-7c59-84e2-438884797a19`, message `Polish share cards and Live route music`.
- This OTA targets installed TestFlight Build 11. It does not include or alter the pending native Build 12 SQLite crash correction or MapKit POI work. No native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed.

## Phase 3 native reliability shipped as TestFlight Build 11 — September 1, 2026

- TestFlight rollout constraint confirmed by the user: Patrick is the only Build 11/TestFlight user and there are no other testers until he explicitly says otherwise. Existing TestFlight user data does **not** need to be preserved unless Patrick later says otherwise. Build 12 remediation may reset or replace the current on-device databases when that materially simplifies or strengthens the correction; do not add external-cohort compatibility or preservation complexity. This is authorization for the Build 12 implementation/testing strategy, not an instruction to delete data immediately outside that work.
- Build 11 TestFlight crash root cause is confirmed by two symbolicated reports. Feedback `AM69SXe_tRsOKoQOwNs4ORo` occurred after lock/unlock and crashed Expo SQLite during commit in `walIndexAppend`; feedback `AIABftGR_F4Yqmx4tmF2tIE` occurred while the app had been backgrounded and crashed Expo SQLite during `walIndexRecover`. Both are `EXC_BAD_ACCESS (SIGBUS)`, `FS pagein error: 22`, with APFS `cluster_pagein past EOF`. The second report proves simultaneous access by two SQLite implementations: native thread 3 is inside Apple's `libsqlite3.dylib` (`NativeRecorderDatabase.init` -> `activeSession` -> `status`) acquiring the WAL shared-memory lock while crashed thread 4 is inside Expo's separately bundled `sqlite3.c` recovering that same WAL index. Build 11 therefore has a reproducible cross-SQLite-library WAL/shared-memory race on `journeydeck-local.db`; this is not React rendering, migration corruption, low storage, or two unrelated crashes. A corrective native release must prevent Apple system SQLite and Expo bundled SQLite from sharing one WAL file. No fix has been implemented yet.
- Physical upgrade/data-preservation acceptance passed on September 1: the user installed TestFlight Build 11 over the existing app and verified that the migrated data is present and looks correct. The app subsequently crashed twice; both TestFlight reports are now analyzed and confirm the cross-library SQLite WAL race above. Treat only Build-10-to-Build-11 data preservation as accepted. Remaining checks include the corrective native release and crash stability, automatic/background completion, post-journey Apple Music artwork, canonical place-name propagation, CloudKit recovery, and StoreKit free/paid behavior.
- Implemented the repository portion of the user-approved Phase 3 on `codex/native-runtime-prep`. App/runtime version is now `1.9.0` (`N1.9-RC1`) so the native boundary will ship as Build 11 rather than an incompatible OTA to Build 10.
- Added the auto-linked `JourneyDeckRecorder` Swift module and app-delegate subscriber. Automatic mode now uses significant-change monitoring while idle, high-accuracy Core Location only while confirming/recording, native start/park decisions, and direct transactional writes into the verified schema-6 `journeydeck-local.db`. It completes a drive and enqueues the four durable completion jobs without React Native being alive. Native session ids are fenced from manual/Build-10 sessions.
- Build 10's persisted Expo automatic task is explicitly stopped on upgrade and its task definition remains registered as a no-op only so old installations can unregister it safely. Manual recording continues through the Expo task. Profile handoff now shuts down manual, legacy automatic, and native automatic location before changing identity.
- Hardened private CloudKit transport with bounded transient retries, server retry-delay support, per-record partial-failure metadata, correct server-winner handling, atomic downloaded-asset replacement, staged change tokens, and expired-token full recovery. Partial failures remain queued and do not enter the successful-sync cooldown.
- Added a Build 10 upgrade fixture that starts with a schema-5 archive plus split legacy recorder database and proves preservation of the profile, journey, Collection, Memory, active session, GPS points, database integrity, and untouched legacy source after the production Phase-2/Build-11 migration.
- Verification passed: TypeScript, all **159/159** mobile tests, Phase-3 native-release checks **3/3**, Expo Doctor **21/21**, iOS Expo export (**1,779 modules, 24 assets**), native autolinking discovery, and `git diff --check` (existing LF-to-CRLF notices only).
- The first signed Build 11 compile (`cd55e2d6-3a35-433c-94c0-c79332d6f24f`) caught one Expo Swift bridge error: an async function had a synchronous `runOnQueue` modifier. Removed that invalid modifier (the implementation already marshals Core Location work through `MainActor`), added a regression contract, reran TypeScript/Phase-3 tests, and reset the failed remote counter from 11 to 10 so the corrected retry remains Build 11.
- Corrected production build `b6dd702e-13a1-4a51-81fb-44fa791f49d2` finished successfully as JourneyDeck **1.9.0 (11)** from commit `e6a01bee0b8f522418d2f5f68312b16f10331908`; IPA artifact: `https://expo.dev/artifacts/eas/_A8RnBNhtk7qVTM3uQDZFA0KDlKQZT_Oz0nbxxIZz4I.ipa`.
- Expo's Sep-1 API/website partial outage caused EAS Submit jobs to report retryable false failures after scheduling. The user then received Apple's notification that Build 11 is available in TestFlight, which is authoritative confirmation that Apple received and processed the binary. Further submission retries were stopped.
- Remaining physical acceptance: install TestFlight Build 11 **over Build 10 without deleting the app**, confirm all existing journeys/places/music/memories remain, complete automatic drives with the UI backgrounded and phone locked, test a manual drive, force an offline/partial CloudKit retry, and confirm sync recovery. No Apple Developer Portal action is currently required.

## Phase 2 unified data system — September 1, 2026

- Implemented the user-approved Phase 2 in the working tree on `codex/native-runtime-prep`. `journeydeck-local.db` advances to additive schema version 6 and is now the only normal runtime database/Expo SQLite handle for active recording, completion jobs, completed journeys, places, music, artwork, memories, and statistics.
- Added canonical `local_places` aliases plus endpoint relinking. User-named places beat geocoder cache rows, an explicit rename updates the one shared row used by every nearby journey, and legacy per-journey preferences can no longer overwrite canonical names merely by opening a list. Geocoder cache ids are now profile-scoped.
- Added shared `local_songs`, `local_albums`, and `local_artworks` records. Playback facts link through `song_id`; all music queries resolve canonical metadata/artwork with legacy columns as preservation fallbacks. Successful compact Apple Music disk prefetches mark the shared artwork row cached.
- Added a one-time legacy import from the former `journeydeck-recorder.db`. The source application id/schema/required tables/`quick_check` are validated, every source category copies in one transaction, source/destination counts must match before the marker commits, running leases recover as retry jobs, and the source file is never updated, renamed, or deleted. Fresh installs never create it.
- Data Health now presents one unified database while still auditing recorder tables and durable completion jobs. Expanded integrity checks cover canonical graph ownership, missing song links, artwork URLs/cache state, and normalized music values. Replaced the database architecture guide with the version-6 unified map and preservation procedure.
- Added an executable Node SQLite preservation test that uses the runtime import SQL, verifies all copied legacy categories, and reopens the source read-only to prove its contents/status remain unchanged. Canonical tests prove two journeys resolve a renamed shared place and two playbacks reference one song.
- Final verification passed: `npm run typecheck`; all **156/156** mobile tests; production iOS Expo export (**1,776 modules, 24 assets**); and `git diff --check` with only the repository's existing LF-to-CRLF notices. The verification export remains at `C:\Users\patri\AppData\Local\Temp\journeydeck-phase2-1580bed1-4249-43db-ad16-cbea80333535` because the sandbox rejected automated recursive cleanup.
- Phase 2 is now published through the production OTA documented below. No commit, git push, TestFlight upload, App Store Connect mutation, or user-data reset was performed. Next: verify the migration plus a real drive/place rename/artwork recall on the phone, then review/commit/push when requested.

## Production OTA: Phase 2 unified data system — September 1, 2026

- Published the completed Phase 2 working tree to the iOS `production` branch for runtime `1.8.0`; message: `Unify JourneyDeck local data`.
- Current production update group: `5868d8f0-833b-45e9-a531-b2872939d815`; iOS update: `01a05d9a-aaf3-7b2f-832a-6e11231f20a0`.
- A separate `eas update:list` check confirmed this group as the production head, immediately ahead of `Harden journey completion recovery`.
- The update should download when Build 10 opens and apply after a full close/reopen. Its first database initialization performs the validated, transactional legacy-recorder import while retaining the old source database unchanged.
- No native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed.

## Git milestone synchronization — September 1, 2026

- Consolidated the complete approved Build 10 milestone into commit `eab40a3` (`feat: complete JourneyDeck Build 10 milestone`): 171 files covering the production mobile UI/onboarding assets, StoreKit membership, 45-day history gating, Apple Music artwork recovery, place propagation, SQLite hardening and completion jobs, website/legal pages, tests, and design-source documentation.
- Excluded the accidental root `app.json` Expo stub and added `/dist-*/` to the recorder ignore rules so generated Expo export directories are not committed. A credential-pattern scan found no likely embedded private keys or provider tokens.
- Verification immediately before the commit: mobile TypeScript passed; all **154/154** mobile tests passed; server TypeScript and ESLint passed; all **34/34** server tests passed; Cloudflare type generation, TypeScript, and preview deployment dry-run passed; staged `git diff --check` passed.
- Pushed `codex/native-runtime-prep` to `origin` and verified a clean, non-divergent tracking state. The initial synchronized head was `622d9a4b4537072eb30227851826b4294b980f31`; the small follow-up commit containing this final push verification supersedes it.

## Production OTA: Phase 1 journey-completion reliability — September 1, 2026

- Published and verified the completed Phase 1 database/recovery implementation to the iOS `production` branch for runtime `1.8.0`.
- Current production update group: `0ddc8464-4209-4197-a77e-f781bee1ed41`; iOS update: `01a05cd3-2eb6-7f42-a967-e1298424e4d9`; message: `Harden journey completion recovery`.
- EAS reported a platform availability warning during export, but the bundle and asset map uploaded, publishing returned success, and a separate `eas update:list` check confirmed this group as the production head.
- No native build, TestFlight upload, App Store Connect mutation, commit, git push, or data reset was performed. The update should download on app launch and apply after a full close/reopen; on-device automatic-drive completion remains the next validation step.

## Phase 1 backend reliability foundation — September 1, 2026

- Began and completed the repository implementation portion of the approved Phase 1 reliability milestone. The user explicitly said current tester data is disposable; no database or source data was actually deleted because an additive schema change remained safer and simpler.
- Added `mobile/recorder/src/database-owner.ts` as the sole Expo SQLite open point. The master archive, Atlas analytics, and recorder now share one intentional JavaScript handle per database file, preventing connection-wide PRAGMAs from leaking across separately opened wrappers.
- Advanced `journeydeck-recorder.db` to schema version 2 with durable `recording_jobs`. Local completion now uses one recorder transaction to mark the session completed and enqueue deterministic archive-mirror, Apple Music/artwork, private-iCloud, and optional legacy-remote jobs. Jobs are profile-owned, dependency ordered, bounded by leases, recovered after expired leases, and retried with exponential backoff and privacy-safe error codes.
- Added `completion-jobs.ts` and wired it into manual completion, automatic completion, app launch/foreground, a 30-second foreground retry cadence, and network-policy recovery. The archive mirror is still attempted immediately for responsive UI, but a failure no longer reopens the drive or loses the handoff intent.
- Corrected the completion artwork path to use the actual archived journey id (`local_<session-id>`). Exact-match fallback and Expo disk prefetch had previously queried the raw recorder session id, which could make the completion cache path silently find no master music rows.
- Corrected automatic completion's terminal GPS write. The task previously changed the session to `finishing` and then called the normal `recordLocations`, which rejects non-recording sessions; a dedicated finishing-point write now preserves the terminal fix while fencing concurrent route batches.
- Failed automatic start attempts now abandon their invalid recorder session instead of creating an empty completed journey. Data Health includes pending completion-job counts and recorder integrity checks include malformed jobs and expired leases.
- Updated `docs/JOURNEYDECK-IOS-DATABASE.md`, the mobile README, executable schema tests, completion tests, CloudKit tests, and server-independence tests for the new model.
- Verification passed: `npm run typecheck`; focused database hardening, journey completion, recovery, drive detection, local-store, and server-independence tests; full mobile suite **154/154**; production iOS Expo export (**1,774 modules, 24 assets**); and `git diff --check` with only the repository's existing LF-to-CRLF notices.
- Phase 1 is now published through the production OTA documented above and still needs an on-device drive/relaunch validation. No native build, TestFlight upload, App Store Connect change, commit, push, or destructive data reset was performed. The broader working tree remains heavily dirty with prior approved Build 10 work; preserve it.

## Production OTA: restore SQLite writes after hardening — September 1, 2026

- The first database-hardening OTA exposed `SQLiteErrorException: attempt to write a readonly database` on the Live screen. Root cause: `src/local-atlas.ts` set `PRAGMA query_only=ON` on its analytics handle, but Expo SQLite can reuse the same native connection for multiple JavaScript handles to the same database file, so the connection-wide flag also blocked normal master-archive writes. Existing user data was not deleted.
- Removed the connection-wide flag. The Atlas code remains read-only by construction through `SELECT` queries, while normal archive and snapshot writes remain enabled. Added a regression assertion forbidding `PRAGMA query_only` in the Expo SQLite analytics path and corrected the database architecture documentation.
- Verification passed: TypeScript plus 6 focused database/Atlas/recovery test groups. Published and verified the corrected iOS production OTA for runtime `1.8.0`: update group `2133124b-338f-48f0-87f5-15db7fd01916`, iOS update `01a05cb1-b310-750b-8b7a-0749f29d6dac`, message `Restore SQLite writes after database hardening`. It is the current production head for TestFlight Build 10 after download and restart.
- No native build, TestFlight upload, App Store Connect mutation, commit, git push, or website deployment was performed.

## iOS SQLite review and additive hardening — August 31, 2026

- Audited JourneyDeck's complete on-device persistence system. iOS uses two SQLite files: `journeydeck-local.db` is the durable multi-profile master archive and `journeydeck-recorder.db` is the active recorder/retry/cache queue. Documented the table map, ownership boundaries, CloudKit behavior, cross-database completion handoff, deletion behavior, privacy model, and remaining compatibility tradeoffs in `docs/JOURNEYDECK-IOS-DATABASE.md`.
- Added additive-only master schema migration 5 and formal recorder schema migration 1 in `mobile/recorder/src/database-hardening.ts`. Both files now use distinct SQLite `application_id` values, future-version/downgrade guards, WAL + foreign keys, a five-second busy timeout, bounded WAL growth, `secure_delete=FAST`, and startup `quick_check`. No table, column, route, journey, song, place, photo, memory, Collection, or preference row is dropped or rewritten by the hardening migrations.
- Added SQLite triggers and indexes that enforce profile ownership and data shape for journey/place links, music/journey links, Collection/Memory JSON membership, photo ownership, exact coordinates, sync flags/revisions, timestamps, one active recorder session per profile, valid cache/private-preference JSON, and queue ranges. Hardened old-queue recovery by filtering corrupt legacy point/music rows before the idempotent completed-session mirror. Corrected recorder inserted-row counts and the polar-longitude place-cache bound.
- Added read-only integrity reports for both databases and surfaced them in Data Health. The device now reports schema version, SQLite `quick_check`, foreign-key violations, cross-profile links, invalid values, and duplicate active recorder sessions without uploading row contents or identifiers. The analytics connection is initialized after the master migration; its code path stays read-only without using connection-wide `PRAGMA query_only`, because Expo may share native handles for the same SQLite file.
- Added executable Node SQLite migration tests in `mobile/recorder/tests/database-hardening.test.mts`; they run the production hardening SQL and prove that invalid GPS, malformed JSON, cross-profile links, bad cache data, and duplicate active recordings are rejected while valid transitions work.
- Verification passed: TypeScript, 152/152 mobile tests, Expo Doctor 21/21, production iOS Expo export (1,772 modules, 24 assets), and `git diff --check`. Public-release preflight reached only the expected environment gates for unset Privacy Policy and Support URL variables. `npm audit --omit=dev` reports a moderate transitive `uuid` advisory through Expo/Xcode build tooling; the offered automatic fix is a breaking Expo package downgrade and was not applied.
- Published the original iOS production OTA for runtime `1.8.0`: update group `8fb23615-e0bf-4915-a5ac-6c73d953d951`, iOS update `01a05c5e-b358-71d9-8172-edcff05a484a`, message `Harden on-device databases`. It was superseded by the September 1 SQLite-write correction above.

## Production OTA: reliable automatic parking and clean navigation — August 31, 2026

- Fixed automatic journeys that could remain technically open after parking. The detector stream no longer defers its low-volume stationary fixes; the active app now coalesces a fresh parking check every 15 seconds while an automatically started session is recording; and accurate stationary displacement overrides the stale positive speed Core Location can briefly retain after a stop. The five-continuous-parked-minutes safety threshold remains unchanged, and movement still resets it.
- Corrected the exposed first-run branch marker from `04A / 04` / `04B / 04` to the user-facing `04 / 04`. Removed the bottom-nav pressed-state background fill that could remain as translucent squares after switching tabs, while preserving the single animated orange selection indicator.
- Build 10 has `isIosBackgroundLocationEnabled: true` and the screenshot showed Location set to Always. Low Power Mode automatically disables Background App Refresh and can reduce background execution, but the newly added foreground watchdog does not depend on a later stationary background callback while the app is open.
- Verification passed: TypeScript, drive detection 12/12, server-independence 15/15, tab runtime 28/28, full mobile suite 146/146, iOS Expo export (1,770 modules and 24 assets), and whitespace validation (existing LF-to-CRLF notices only).
- Published and verified the iOS production OTA for runtime `1.8.0`: update group `214464bf-7764-491f-be35-221f5b99aa95`, iOS update `01a05ad7-6fee-7899-86a0-a450d964c744`, message `Fix automatic parking and navigation feedback`. It applies to TestFlight Build 10 after download and restart.
- No new native build, TestFlight upload, App Store Connect mutation, commit, git push, or website deployment was performed.

## Production OTA: responsive first-run screens — August 31, 2026

- Corrected the Build 10 first-run screens 2–4 after the approved `480 × 1040` mockup PNGs had incorrectly been installed as the live UI with `resizeMode="cover"`. That caused pixelated type, horizontal cropping, Dynamic Island overlap, and unreachable bottom actions on real iPhones.
- Rebuilt the GPS choice, Apple Music connection, and automatic/manual instruction screens as sharp native React Native layouts over the same high-resolution cinematic road background. The approved copy, coral-pink gradient, visual hierarchy, and conditional 4A/4B sequence remain; layouts now use iOS safe-area insets, bounded content width, scrollable bodies, and fixed reachable primary actions. The approved 2.5-second opening animation itself was not altered.
- Added focused regression coverage forbidding the old fixed-design raster scaling and requiring safe-area handling, scrolling, and native actions. Verification passed: TypeScript, focused first-run/tab tests 28/28, full mobile suite 145/145, iOS Expo export (1,770 modules and 24 assets), and whitespace validation (existing LF-to-CRLF notices only).
- Published the iOS production OTA for runtime `1.8.0`: update group `cea543f2-6851-4325-b353-4f3f978f3c55`, iOS update `01a05a0d-7e5b-7a3d-a596-93ba743c7e3f`, message `Fix responsive first-run onboarding screens`. It applies to TestFlight Build 10 after the update downloads and the app restarts.
- No new native build, TestFlight upload, App Store Connect mutation, commit, git push, or website deployment was performed.

## Production OTA: first-run welcome advances once — August 31, 2026

- Fixed the Build 10 first-run welcome screen getting trapped in the looping 2.5-second WebP. The timer effect depended on the parent-created `onComplete` callback, so unrelated parent renders repeatedly canceled and restarted it. The component now keeps the latest callback in a ref while the one-shot timer depends only on the loaded asset.
- The approved animation and all follow-up artwork remain byte-for-byte unchanged. Added regression assertions requiring the callback ref and forbidding the unstable `[loaded, onComplete]` timer dependency.
- Verification passed: targeted first-run/tab runtime tests 28/28, TypeScript, full mobile suite 145/145, iOS Expo export (1,774 modules and 28 assets), and whitespace validation (existing LF-to-CRLF notices only).
- Published and verified the iOS production OTA for runtime `1.8.0`: update group `adcd124e-f463-4b62-bb2c-c9587fe27149`, iOS update `01a059ff-b38b-7977-8725-486df8cf68f6`, message `Fix first-run welcome timer`. It is the current `production` branch head and applies to TestFlight Build 10 after the update downloads and the app restarts.
- No new native build, TestFlight upload, App Store Connect mutation, commit, git push, or website deployment was performed.

## TestFlight Build 10 uploaded — August 31, 2026

- Created the native iOS production build for JourneyDeck `1.8.0` with build number `10`, including the approved first-run onboarding and the StoreKit 2 membership module/paywall. Successful EAS build ID: `1a7ee233-0d9a-43b0-80d2-d364dee66d60`; artifact: `https://expo.dev/artifacts/eas/KOttyYlwT1JENjw0CTxEWY4fusmnG0oCq1tG6FRx0wY.ipa`.
- Submitted that exact binary to App Store Connect with the stored API key. EAS submission ID: `408363e3-5fe2-4afd-b5d8-9434c2a10f0f`. Apple accepted the upload and is processing it for TestFlight at `https://appstoreconnect.apple.com/apps/6806502526/testflight/ios`.
- The first Build 10 attempt (`4a6a7fca-990f-4550-a8c8-5c507e69c6c6`) failed during Xcode compilation because Swift resolved `Transaction` ambiguously. Qualified all membership-module references as `StoreKit.Transaction`, reran TypeScript and native-capability tests successfully, reset the EAS remote counter from 10 to 9, and rebuilt so the successful retry remained Build 10.
- Preflight/verification passed: TypeScript, full mobile suite 145/145, Expo Doctor 21/21, native membership-module autolinking, production credentials/provisioning, and whitespace validation (only existing LF-to-CRLF notices). No App Store Connect action was required during build or upload, and no OTA, commit, git push, or website deployment was performed.
- Next: wait for Apple's TestFlight processing email, install Build 10, exercise purchase/restore and both free/paid navigation/history states, then capture the in-app paywall screenshot for the monthly and annual subscription review metadata. Do not click **Add for Review** until the intended App Store submission package is ready.

## Authoritative App Store v1 core scope — August 31, 2026

The user defined the following as the authoritative scope for the first App Store submission. Use this list when reconciling implementation, testing, metadata, screenshots, App Review notes, and the release schedule:

1. Follow the user with GPS and plot the recorded route.
2. Connect to the user's Apple Music account. Place songs heard during a drive onto the route at the time they occurred. Download album artwork immediately or shortly after the route finishes.
3. Create Memories and Collections, with photos and notes.
4. Let the user name places, persist those names on-device, and automatically apply saved names to later journeys.
5. Show a pleasant, concise introduction walkthrough on first launch. It must explain GPS permission, Apple Music connection, how JourneyDeck works, and the benefits/tradeoffs of manual versus automatic recording without becoming complex or wordy.
6. Free users retain the core recording, Apple Music, Memories, Soundtracks, and Statistics experience, limited to the most recent 45 days of history.
7. Paid subscribers unlock Atlas and their complete locally stored history across the app.
8. Hide or remove all Last.fm, Spotify, and Tessie mentions, integrations, and corresponding widgets from the App Store submission.
9. The Settings gear must open Settings directly, with no Tools screen or other intermediate destination.

This scope supersedes older handoff or App Store documentation that says the public build has no paid tier, exposes Tessie, substitutes Statistics for another function based on membership, or routes Settings through Tools. The user requested scope capture only; do not infer authorization to implement, build, upload, submit, commit, push, or change App Store Connect from this note.

### Explicit version-2 deferral — September 1, 2026

- Interactive shared-journey web pages are an approved-interest **version 2.0 concept only**. The concept may later include a privacy-masked interactive route, song/artwork pins, timeline playback, selected photos/notes, Apple Music handoff, optional Look Around, expiring or revocable links, and MapKit JS on the web.
- Do not implement MapKit JS, public/private shared-journey hosting, share-link infrastructure, or related server work for Build 12 or the first App Store release. Native iOS MapKit POI enrichment remains in the Build 12 scope and is separate from this deferral.

## StoreKit subscriptions and membership gates prepared for Build 10 — August 31, 2026

- Added a local Expo/Swift StoreKit 2 module for the exact products `com.journeydeck.recorder.pro.monthly` and `com.journeydeck.recorder.pro.annual`. Access is fail-closed and derives only from verified current transactions; purchasing uses StoreKit's localized product display price, transaction updates refresh access, and `AppStore.sync()` is used only for the user-triggered Restore Purchases action.
- Added the JourneyDeck membership paywall, purchase/restore UI, Settings membership card, and Apple subscription-management link. Free users see Statistics in the fifth dock position and a rolling 45-day archive across Home, Journeys, Memories/Collections, Statistics/timeline, and Soundtracks. Paid users see Atlas in the fifth position and can paginate through the complete locally stored archive. Expiry hides older data without deleting it.
- Added the App Store Connect checklist in `mobile/recorder/SUBSCRIPTION_SETUP.md` and updated release/review metadata. Apple-side work remains: create one subscription group, create the two exact product IDs, set prices/localizations/review metadata, ensure Agreements/Tax/Banking is active, and attach the subscriptions to the Build 10 submission.
- Verification passed: TypeScript, 145/145 mobile tests, native-module autolinking discovery, iOS Expo export (1,774 modules and 28 assets), and whitespace validation. Swift could not be compiled on Windows; Build 10 must be a new native EAS/TestFlight build to validate the StoreKit module and cannot be delivered as an OTA. No OTA, native build, upload, App Store Connect mutation, commit, or push was performed.

## Production OTA: Soundtracks corners and Memories control alignment — August 30, 2026

- Reduced the Soundtracks header's outer clipping radius from 24 to 10 points so the source artwork's integrated neon corner frame remains visible instead of being masked a second time.
- Aligned the Memories Journeys/Memories/Collections selector, search field, and Journey filter/sort rows to the same 20-point horizontal content column used by Collection and Journey cards.
- Added focused regression coverage for both layout fixes. Verification passed: mobile TypeScript, focused tab-runtime tests 24/24, full mobile tests 131/131, iOS Expo export (1,759 modules), and whitespace validation (existing CRLF notices only).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `337d1c49-0908-4e56-ae75-2441349b1d43`, iOS update `01a055a6-e73c-715e-a714-3d5fee11539f`, message `JourneyDeck 1.8: fix header corners and Memories alignment`. EAS channel verification confirms it is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Production OTA: selected Memories Keepsake Constellation header — August 30, 2026

- Replaced `mobile/recorder/assets/memories-header-hero.png` with the user-selected option 2, `Keepsake Constellation`. The installed PNG is exactly `1672 × 941`, matching the shared app-header frame and showing a coral route connecting three original keepsake scenes over a deep-purple map.
- Preserved all three concepts under `docs/design/memories-header-options/`. Verification passed: mobile TypeScript, focused tab-runtime tests 23/23, and iOS Expo export (1,759 modules).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `0933a58b-9429-4e42-a5ff-3192ee0984f1`, iOS update `01a0559e-885f-7c64-85f1-3e60bdc959c1`, message `JourneyDeck 1.8: new Memories keepsake header`. EAS channel verification confirms it is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Memories header artwork options — August 30, 2026

- Generated three project-ready Memories header concepts in the standardized `1672 × 941` app-header dimensions: `The Road Remembers`, `Keepsake Constellation`, and `Rearview of a Life`.
- Saved the PNGs under `docs/design/memories-header-options/` as `option-1-the-road-remembers.png`, `option-2-keepsake-constellation.png`, and `option-3-rearview-of-a-life.png`. Each uses the established near-black/deep-purple JourneyDeck palette, coral route light, cyan/magenta accents, integrated neon frame, and exact `MEMORIES` label.
- These are selection options only. The existing `mobile/recorder/assets/memories-header-hero.png` was not replaced, and no app code, OTA, native build, TestFlight upload, commit, push, or website deployment was performed.

## Production OTA: unified artwork headers and centered Soundtracks vinyl — August 30, 2026

- Standardized every destination artwork header on one shared `1672 / 941` display frame. Live, Memories, Soundtracks, Atlas, Recorder, Settings, Timeline, and Statistics now render at the same on-screen width and height; wrappers that live inside 20 px page padding expand to the same 16 px header inset used by Memories and Soundtracks.
- Soundtracks now preserves its full source artwork with `contentFit="contain"`. The rotating vinyl overlay was re-centered from measured artwork coordinates by moving it to `left: 37.4%` and `top: -5.9%` while retaining its existing 59% width and 0.52 vertical perspective scale.
- Added regression coverage for the shared frame, consistent wrapper geometry, full Soundtracks artwork, and measured vinyl alignment. Verification passed: mobile TypeScript, focused tab-runtime tests 23/23, full mobile tests 130/130, iOS Expo export (1,759 modules), and whitespace validation (existing CRLF notices only).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `ba5ff972-7536-4187-aecf-00441035e7de`, iOS update `01a05582-7344-74f0-9de9-be98a06ace66`, message `JourneyDeck 1.8: unify artwork headers`. EAS channel verification confirms it is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Production OTA: show the full Soundtracks header — August 30, 2026

- Corrected the Soundtracks hero container to use the source artwork's true `1679 × 939` aspect ratio instead of the wider `1270 / 674` ratio that made `resizeMode="cover"` crop the neon frame along the top and bottom. Re-centered the animated vinyl overlay for the restored full-frame layout.
- Added focused regression coverage locking the hero to the source aspect ratio. Verification passed: mobile TypeScript, focused tab-runtime tests 22/22, full mobile tests 129/129, iOS Expo export (1,759 modules), and whitespace validation (existing CRLF notices only).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `ccad48b4-ea12-441e-bb99-76a8560a4de0`, iOS update `01a05572-00ae-7867-aec7-1e2cc6bd1ed6`, message `JourneyDeck 1.8: show full Soundtracks header`. EAS channel verification confirms it is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Production OTA: draft-first Memory and Collection editors — August 30, 2026

- Collection creation no longer requires an existing saved ID before journeys can be selected. After entering a Collection title, tapping a journey adds/removes it in the local draft; the whole title/description/membership draft persists together only when `SAVE` is pressed.
- Memory creation now follows the same interaction while preserving the Journey → Collection → Memory hierarchy: after entering a Memory title, Collections can be selected before the first save. Both editors remain open after persistence, show a green `SAVED` action, and return to `SAVE` whenever a persisted field or membership changes. Existing editors open in the `SAVED` state.
- Added normalized saved-state signatures so semantically unchanged membership sets do not appear dirty, retained the saved-ID requirement only for photo upload/removal operations, and added focused regression coverage for both draft flows.
- Verification passed: mobile TypeScript, focused tab-runtime tests 22/22, full mobile tests 129/129, iOS Expo export (1,759 modules), and whitespace validation (existing CRLF notices only).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `963dfa10-0889-4e67-89ce-460e1d344a33`, iOS update `01a05569-65d2-71bf-b0b5-bbd254ef7745`, message `JourneyDeck 1.8: draft-first Memory and Collection editing`. EAS channel verification confirms it is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Production OTA: one Soundtracks hero with an animated vinyl — August 30, 2026

- Removed the redundant `YOUR LIFE HAS A SOUNDTRACK` spinning-record promo card from the Soundtracks dashboard. The approved `SOUNDTRACKS` map/vinyl header remains, the Apple Music guidance follows it, and the four real archive metrics now appear immediately afterward.
- Preserved motion by placing a restrained rotating sheen/groove layer directly over the vinyl in the surviving header image. The title, map, route pins, and tonearm remain static. Removed the obsolete standalone vinyl component and its styling, and added focused regression coverage requiring the metrics-first layout and absence of the duplicate promo.
- Verification passed: mobile TypeScript, focused tab-runtime tests 21/21, full mobile tests 128/128, iOS Expo export (1,759 modules), and whitespace validation (existing CRLF notices only).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `32fe3867-2d4b-4d14-a36c-efbfb6df360c`, iOS update `01a0554b-f2bf-71b8-a57f-b5571da77abe`, message `JourneyDeck 1.8: simplify Soundtracks hero`. EAS channel verification confirms it is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Website X follow controls published — August 30, 2026

- Added the selected X placements to the public homepage: an outlined `@JourneyDeck` pill between Support and Sign in, plus a branded `The road is already moving.` panel immediately after Drive/Listen/Remember. Both controls point exactly to `https://x.com/JourneyDeck`, open safely in a new tab, and use the corrected handle rather than `JourneyDeckApp`.
- The nav pill collapses to an accessible X-only icon on small phones; the full-width panel stacks its copy and button responsively. Added hosted-root regression coverage requiring exactly two corrected X links, the new panel copy, and absence of the incorrect handle.
- Verification passed before publication: server TypeScript, ESLint, all 34 server tests, whitespace validation, visual inspection at 1440×950 and 390×844, and automated href/target/rel checks at 1440/1050/820/540/390 widths. Published scoped commit `f909d3a` (`feat(web): add JourneyDeck X follow links`) through GitHub PR [#140](https://github.com/drumpat01/DriveOS/pull/140), merge commit `56e7cee0d79bc5d4c2dd6ce46bc0af27a7306675`, and Render deploy `dep-daac9qmk1f9s73d1f8f0` (`live`).
- Production checks returned HTTP 200 for `/` and `/readyz`, found exactly two `https://x.com/JourneyDeck` links and the new follow section, found no `JourneyDeckApp` handle, and found no Render error logs after deployment. No mobile code, Expo OTA, native build, TestFlight, App Store Connect, or Render environment change was performed.

## X follow-link website mockups — August 30, 2026

- Created three high-fidelity JourneyDeck homepage mockups for promoting the new X Premium account `@JourneyDeckApp`: (1) a persistent outlined handle pill in the desktop navigation, (2) a secondary `Follow the journey on X` link below the hero actions, and (3) a dedicated `The road is already moving.` community panel immediately after the Drive/Listen/Remember section.
- Saved the built-in image-generation outputs under `docs/design/twitter-follow-mockups/` as `option-1-navigation.png`, `option-2-hero.png`, and `option-3-community-section.png`. The current live homepage screenshots were used as edit targets so the mockups preserve the established site design.
- These are comparison mockups only. No website source, mobile code, OTA, deployment, commit, or push was performed.

## JourneyDeck X/Twitter header artwork — August 30, 2026

- Generated a new JourneyDeck social header using the production app icon as the brand reference: near-black/deep-purple map grid, coral route, music-location pins, `JOURNEYDECK`, and the exact tagline `EVERY ROAD HAS A SOUNDTRACK.`
- Exported the ready-to-upload PNG at X/Twitter's native `1500 × 500` dimensions to `docs/design/journeydeck-twitter-header-1500x500.png` and visually verified the final raster. This was created with the built-in image-generation workflow, then proportionally downsampled from its exact 3:1 generated source.
- No mobile code, OTA, native build, TestFlight upload, website deployment, commit, or push was performed.

## Production OTA: align Soundtracks album captions — August 30, 2026

- Corrected the `Today's soundtrack` album-card layout after artwork backfill exposed cramped captions. Every card now reserves a fixed 46 px caption area beneath its square cover, uses consistent title/artist line heights and left alignment, and includes enough bottom space to keep the artist label clear of the neon card border.
- Added structural regression coverage for the caption wrapper and fixed card/caption dimensions. Verification passed: mobile TypeScript, focused tab-runtime tests 21/21, full mobile tests 128/128, whitespace validation (existing CRLF notices only), and the EAS iOS export (1,759 modules).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `9546291c-314a-4e79-8dc3-c9b8910738af`, iOS update `01a054f9-6473-78d0-a016-f1fd4c221d07`, message `JourneyDeck 1.8: align soundtrack captions`. EAS channel verification confirms it is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Production OTA: restore Apple Music album artwork — August 30, 2026

- Fixed the shared artwork pipeline behind the Home now-playing card, Live soundtrack, Soundtracks album strip/history, and top-artist list. Lightweight live/Tessie samples no longer cause richer MusicKit history rows to be rejected as duplicates; the existing playback row is enriched with album, duration, artwork, and Apple Music URL while preserving one play.
- Added a bounded recent-history refresh when Soundtracks opens or is pulled to refresh, allowing recent artwork-less plays already stored on the phone to be backfilled. After MusicKit still omitted covers, added a direct Apple-only fallback against `https://itunes.apple.com/search`: at most 15 missing unique title+artist pairs per refresh, exact normalized title-and-artist matching only, HTTPS artwork/link requirements, 24-hour no-match retry cache, and local SQLite enrichment. Existing `expo-image` memory/disk caching then retains rendered covers. The forced per-profile launch refresh now runs this fallback automatically; future pull-to-refreshes also resolve newly missing covers. The request boundary allowlists only Apple's search endpoint, records aggregate status/bytes without retaining queries, and Data Health explains the direct Apple lookup.
- Verified the live Apple endpoint against Patrick's actual missing `Tied Up` / `Khalid & LAUV` entry; it returned the exact track, single artwork, and Apple Music URL. Verification passed: mobile TypeScript, focused artwork/network/local-store/tab-runtime tests, full mobile tests 128/128, iOS Expo export (1,759 modules), and whitespace validation (existing CRLF notices only).
- Published the final iOS-only production OTA for runtime `1.8.0`: update group `20764917-4e77-487d-b60f-e4c540a13843`, iOS update `01a054e2-d482-7409-b59b-040ee69c0b6f`, message `JourneyDeck 1.8: Apple catalog artwork fallback`. It supersedes the earlier artwork groups; EAS channel verification confirms the Apple-catalog fallback is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Production OTA: keyboard-safe Memory and Collection editors — August 30, 2026

- Fixed the Create/Edit Memory and Collection overlays so the iOS keyboard no longer blocks the editor. Overlay sheets now resize above the keyboard, remain scrollable, support interactive drag-to-dismiss, and show a clearly labeled `Done` action beside the close button while the keyboard is visible. Closing the modal also dismisses the keyboard.
- Added a focused structural regression test. Verification passed: mobile TypeScript, focused tab-runtime tests 21/21, full mobile tests 124/124, iOS Expo export (1,757 modules), and whitespace validation (existing CRLF notices only).
- Published an iOS-only production OTA for runtime `1.8.0`: update group `f79d4523-1e10-4a06-9882-9542b6a73d68`, iOS update `01a054b3-bfdb-7522-b36e-1cc8ad69bd7b`, message `JourneyDeck 1.8: keep Memory editor above keyboard`. EAS channel verification confirms this is the current `production` head.
- No native build, TestFlight upload, build-number change, commit, push, App Store Connect mutation, or website deployment was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted with the prior authorized mobile work.

## Website favicon corrected to the JourneyDeck app icon — August 30, 2026

- Replaced the obsolete teal route-box website favicon with the exact current JourneyDeck neon app icon and added a cache-busted favicon declaration to the public homepage, `/login`, `/support`, and `/privacy`. Added regression checks that require those pages to reference the corrected asset and require the favicon bytes to match `journeydeck-cinematic-192.png`.
- Verification passed: server typecheck, ESLint, all 34 server tests, and whitespace validation. Published commit `6df939a` (`fix(web): use JourneyDeck app icon as favicon`) through GitHub PR [#139](https://github.com/drumpat01/DriveOS/pull/139), merge commit `0ad03a951db1f9b494cba42e7961896d19193070`, and Render deploy `dep-daaa2ueq1p3s7393umeg` (`live`). Production checks returned HTTP 200 with the corrected favicon link on all four pages; the live favicon SHA-256 exactly matches the app-icon asset. No iOS/mobile, Expo OTA, TestFlight, App Store Connect, or Render environment change was performed.

## Website support-email correction — August 30, 2026

- Corrected the public JourneyDeck website contact address from `journeydeckme@gmail.com` to `journeydeckapp@gmail.com` on the homepage TestFlight CTA, Support page, and Privacy page. Updated the associated server regression assertions; no mobile/iOS, Expo OTA, TestFlight, Apple Connect, or Render environment configuration was changed.
- Verification passed: server typecheck, ESLint, all 34 server tests, and whitespace validation. Published commit `cf875f7` (`fix(web): correct JourneyDeck support email`) through GitHub PR [#138](https://github.com/drumpat01/DriveOS/pull/138), merge commit `75e0cf3007b8595748b635e01ce6fbbb846a63ca`, and Render deploy `dep-daa9qv3ncjis739tgr3g` (`live`). Production checks returned HTTP 200 for `/`, `/support`, and `/privacy`; each contains `journeydeckapp@gmail.com` and none contains the old address.

## Landing-page Remember artwork centering — August 30, 2026

- Corrected the desktop optical imbalance in the `How JourneyDeck works` Remember card by explicitly centering all three stacked outlines and distributing the rear/front offsets equally around the card midpoint. The surrounding card grid, text, mobile app, and product behavior were unchanged.
- Verified a measured `0 px` stack-to-card center delta at both 1920 px desktop and 390 px mobile widths, visually inspected the desktop section, and passed server typecheck, ESLint, all 34 server tests, and whitespace validation.
- Published the one-file website CSS patch in commit `832d633` (`fix(web): center Remember artwork`), GitHub PR [#137](https://github.com/drumpat01/DriveOS/pull/137), merge commit `027f0226f137844ceeb37f5fce232334ed317a7d`, and Render deploy `dep-daa9ks3ncjis739tccd0` (`live`). Live-domain Playwright verification returned HTTP 200 and measured the Remember stack and card at the same `1448 px` center coordinate. No iOS, Expo OTA, TestFlight, native build, App Store, or Render environment change was performed.

## Landing-page route and album-art polish — August 30, 2026

- In the clean release worktree `C:\Users\patri\.codex\tmp\journeydeck-public-homepage-release` on local branch `codex/landing-graphic-polish`, moved the hero route and its four song pins into one shared responsive coordinate layer. All dots now land exactly on the orange route at desktop and 390 px phone widths; the Apple Music curve's second marker was also corrected to its true path coordinate. Mobile Ann Arbor/Detroit labels were moved clear of the covers and now-playing card.
- Generated one original 2×2 fictional album-cover sprite with four distinct designs (desert road, rain-lit city, plum moon landscape, cosmic waveform), compressed it from the 3.47 MB source PNG to a 260 KB WebP, and integrated it as `web/assets/fictional-album-covers-v1.webp`. The exact built-in image-generation prompt requested four fictional text-free JourneyDeck-neon covers with no real artists, logos, or copyrighted artwork.
- Visual checks passed for the full page plus isolated hero and Apple Music graphics at 1440×900 and 390×844. Server typecheck, ESLint, full server tests 34/34, focused API tests 12/12, asset HTTP delivery, and `git diff --check` passed. Published the three scoped website files in commit `c30222a` (`fix(web): align route pins and refresh album art`), GitHub PR [#136](https://github.com/drumpat01/DriveOS/pull/136), merge commit `f4e408caa673806dbe8ab03427ed604218f14d7e`, and Render deploy `dep-daa9a76q1p3s73939l40` (`live`). Production verification confirmed the shared map layer, corrected music marker, WebP CSS reference, 200 `image/webp` asset, and anonymous `/app` redirect. No OTA, iOS/mobile source, native build, TestFlight upload, App Store mutation, or Render environment change was performed.

## Public JourneyDeck homepage and `/login` split — August 30, 2026

- Added a responsive public marketing homepage at the hosted `/` route using the approved Living Map direction: dark purple cartography, coral route and song pins, Journey → Memory → Collection storytelling, Drive/Listen/Remember explanation, privacy positioning, Apple Music launch copy, and TestFlight email CTA. No app screenshots or private journey data appear on the page.
- Added `web/landing.html`, `web/landing.css`, and `web/assets/journeydeck-social-preview.png` with complete Open Graph/X metadata. The social card uses only branded conceptual map/route artwork.
- Hosted mode now serves the public homepage at `/`; the private owner dashboard is available at authenticated `/app`; `/login` remains the public sign-in route. Password/passkey success, PWA start URL, offline retry, Wife-to-Full mode, and loading-preview return links now target `/app`. Desktop mode preserves its authenticated `/` dashboard behavior.
- Added server regression coverage for public hosted root, public login, authenticated `/app`, private desktop root, redirect targets, PWA start URL, and social metadata. Verification passed: server typecheck, ESLint, full server tests 34/34, focused API tests 12/12, local HTTP checks for `/`, `/login`, `/app`, CSS, and social artwork, plus `git diff --check` (only existing line-ending notices).
- Published from a clean `origin/main` worktree so the unrelated dirty mobile/Tessie changes were not included. Scoped release commit: `7c3da30` (`feat(web): publish JourneyDeck homepage`); GitHub PR: [#135](https://github.com/drumpat01/DriveOS/pull/135); merge commit: `e138976a0a8143eb0c32a96c05080adeee45c23a`; Render deploy: `dep-daa8pu3l550s73ahn8tg` (`live`).
- Production verification passed at `https://journeydeck.me/`: homepage headline and `The roads become the stories` section are live, `/login` returns the sign-in page, anonymous `/app` redirects to `/login`, the Open Graph PNG returns `image/png`, and `/privacy` plus `/support` remain available. No mobile OTA, native build, TestFlight upload, App Store mutation, or Render environment-variable change was performed.

## Share-card map and JourneyDeck watermark refresh — August 29, 2026

- Replaced the temporary `J` badge on journey, collection, and memory share cards with the bundled production JourneyDeck neon logo and a proper `JOURNEYDECK` watermark; journey cards add a smaller `JOURNEY MEMORY` context label.
- Reworked journey share-card maps to match the current JourneyDeck map schema: near-black `#010104` base, deep-purple `#3a1737` roads, and an orange `#ff684f` recorded-route core with a restrained glow. Standard OSM raster tiles are transformed on-device with the already-installed Skia color-matrix pipeline; attribution remains in the card.
- Corrected the static map viewport from a stretched square 3×3 tile grid to an aspect-matched 7×3 viewport, keeping real projected route turns aligned with the basemap. Removed the generic private-city arc. Share cards now use the journey's real recorded GPS path after `prepareShareCardCoords` masks configured privacy geofences; label-only Home/Work endpoints receive a defensive 300 m on-device geofence before rendering.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 19/19; full mobile tests passed 117/117; iOS Expo export completed with 1,756 modules and the production logo asset; whitespace validation found no errors, only existing CRLF conversion warnings. Files changed for this milestone: `mobile/recorder/src/share-card-modal.tsx`, `mobile/recorder/src/shell.tsx`, and `mobile/recorder/tests/tab-runtime.test.mts`.
- Published the verified working tree as an iOS-only production OTA for runtime `1.8.0`. Update group: `a9fe0c28-959b-459a-b803-7abbfdeab67e`; iOS update: `01a0509b-e2a8-7a67-b7af-6b02d58c379f`; message: `JourneyDeck 1.8: real-route branded share cards`. EAS channel verification confirms it is the current `production` head. No commit, push, native build, TestFlight upload, build 10, or App Store mutation was performed; EAS records base commit `ff75d37` with a dirty-tree marker.

## Production OTA: Apple Music automatic / Shazam manual — August 29, 2026

- Published the verified Apple Music-first/manual-Shazam working tree as an iOS-only production OTA for runtime `1.8.0`, used by TestFlight build 9. Update group: `4fb2a475-9358-4064-8034-0c54da0d6221`; iOS update: `01a0506d-7486-7e18-a485-b59b00ac9721`; message: `JourneyDeck 1.8: Apple Music automatic, Shazam manual`.
- EAS channel verification confirms this update is the current head of `production`. No native build, TestFlight upload, build 10, commit, or push was created. EAS records base commit `ff75d37` with a dirty-working-tree marker; package the intended mobile changes into a reproducible release commit before the next native build.
- The OTA changes Shazam's actual behavior and all JavaScript UI/copy immediately. The TestFlight binary's embedded microphone permission sentence cannot change through OTA; the corrected user-initiated wording in `app.json` will take effect in the next native build.

## Apple Music-first launch / manual Shazam capture — August 29, 2026

- Reworked the public mobile product around Apple Music as JourneyDeck's recommended and only automatic streaming source at launch. Onboarding, Settings, Live, Soundtracks, journey empty states, and release documentation now say that Apple Music builds soundtracks automatically while ShazamKit is **Manual Song Recognition**.
- Removed every automatic Shazam invocation from automatic-drive startup, background location batches, recorder start/resume, and interrupted-session recovery. Deleted the automatic one-minute Shazam sampler. GPS recording and Apple Music sampling remain unchanged.
- Added an active-journey **Identify Song** control to the recorder. Each tap explicitly requests/uses microphone permission, listens for about ten seconds, stores only the match and timestamp, turns the microphone off, and reports matched/duplicate/no-match status. Manual recognition can be used as an ad-hoc supplement even when Apple Music is the selected source. The UI includes a stopped/passenger safety note.
- Updated the microphone purpose string for the next native build and added release-integrity coverage proving background tasks cannot start Shazam. The currently installed TestFlight build retains its bundled older purpose-string wording until a future native build; the JavaScript behavior was subsequently published in the production OTA recorded above.
- Updated the public privacy-policy source/live-page working copy and App Review notes to describe user-initiated per-song recognition. The already deployed website is unchanged until a separately authorized web deployment.
- Verification before publication: `npm run typecheck` passed; focused tab-runtime suite passed 19/19; full mobile suite passed 117/117; `npx expo export --platform ios` completed (1,755 modules); `git diff --check` found no whitespace errors, only existing CRLF conversion warnings. Active branch remains `codex/native-runtime-prep`; working tree remains intentionally dirty with prior user-owned mobile, server, design, and legal-page work. No commit, push, TestFlight build, or App Store mutation was performed.

## TestFlight finding: background Auto Recognition can miss an entire auto-started journey — August 29, 2026

- Patrick reported that automatic driving detection and Auto Recognition worked on an outbound errand, while the return journey auto-started successfully but captured zero music despite loud playback.
- Read-only diagnosis found the route and Shazam pipelines are independent. Each background location callback attempts to create a fresh 10-second `AVAudioEngine`/Shazam session; `music-capture.ts` catches every native failure and returns only `unavailable`, with no persisted diagnostic or user-facing warning. The app declares iOS background location but not background audio. Apple documents that continued background recording needs the audio background mode, and a fully backgrounded app cannot reliably initiate a new recording session. This explains why GPS can succeed while a later drive captures no music.
- No code was changed. Confirm whether Patrick selected Auto Recognition or Apple Music. A useful OTA-only follow-up can persist/display per-journey recognition health and force a Shazam retry whenever the app becomes active, but it cannot make microphone recognition reliable for a journey that begins and remains fully backgrounded. A true background-recognition redesign affects native audio lifecycle/capabilities and requires a new build plus App Review/privacy scrutiny. Apple Music playback should prefer its authorized recent-history path rather than microphone recognition.
- Product exploration: a Live Activity is a promising user-consent surface but does not itself bypass the initial background limitations. ActivityKit normally permits local activity creation only in the foreground; background starts require a user-invoked `LiveActivityIntent` or APNs push-to-start. Recommended local-first flow is: GPS detects driving -> immediate local notification -> user taps -> JourneyDeck foregrounds, starts Shazam and a journey Live Activity -> Live Activity shows recognition/route status and stops at parking. A direct `AudioRecordingIntent` button without foregrounding merits a native device spike but should not be promised until proven. This requires a widget extension/ActivityKit/App Intents and therefore a new native build, not OTA.
- Patrick rejected any design that keeps the microphone active for the duration of a drive. Preserve that product/privacy decision. The acceptable Shazam model is a short, explicitly triggered capture: GPS detects driving -> local notification says `Journey detected — tap to capture what's playing` -> tap deep-links into Live, foregrounds JourneyDeck, runs an 8–10 second Shazam sample, stores only the match, and immediately releases the microphone. Once the app backgrounds and releases audio, it cannot promise automatic minute-by-minute Shazam sampling; additional captures require another explicit tap. Apple Music remains the hands-free complete-history path.
- A viable foreground-only refinement is `Drive Listening Mode`: while JourneyDeck remains visibly active and a journey is recording, run one 8–10 second Shazam sample at entry and approximately once per minute, fully stop/release the microphone between samples, deduplicate matches, and cancel immediately when AppState leaves `active`. Route recording continues in the background, but Shazam pauses if the screen locks or the user switches apps and resumes when JourneyDeck becomes active again. The existing native Shazam module can support the core timer/status behavior through JavaScript/OTA; keeping the display awake should be evaluated separately and must remain an explicit user choice.
- Android feasibility: modern Android also blocks a dormant/background app from creating a new microphone foreground service solely because an activity-recognition/location event fired. Android can get closer with a one-time foreground opt-in: while JourneyDeck is visible, the user starts an `Automatic Soundtrack` foreground service declared for location+microphone; it retains while-in-use capability and a persistent system notification, keeps the microphone off while idle, and takes short samples after drive detection. This can be hands-free for later drives while the service survives, but OEM/OS termination requires re-arming and Play policy/permission review applies. A notification interaction is the more reliable way to start/restart it. JourneyDeck is presently iOS-only, so this would be a separate native Android product effort.
- Last.fm is the strongest microphone-free automatic path for Spotify users. Spotify can scrobble listening from mobile, desktop, web, and Spotify Connect devices to the user's Last.fm profile; after a journey, JourneyDeck can query `user.getRecentTracks` for the journey's bounded UTC time window and attach the timestamped tracks locally. The internal implementation already queues/retries this exact flow through the privacy edge, sends only username plus start/end time (never route geometry), and is release-gated by `isInternalTestingBuild()`. Apple Music users should keep the direct MusicKit history path because Last.fm's official iOS Apple Music workflow is manual scan/submit. Last.fm API terms restrict default API use to non-commercial purposes and require contacting `partners@last.fm` before commercial use; do not enable this in public/TestFlight production without written permission. Short/skipped tracks may be absent because Last.fm scrobbles only after half the track or four minutes, whichever comes first.

## Production OTA: Vinyl Route Soundtracks header — August 29, 2026

- Patrick selected Soundtracks mockup 2 (`Vinyl Route`). Replaced the tracked app asset `mobile/recorder/assets/music-header-hero.png` with the selected neon vinyl/map artwork labeled exactly `SOUNDTRACKS`.
- Published an iOS-only production OTA for runtime `1.8.0` to the `production` channel used by TestFlight build 9. Update group: `2c631c52-00a6-46f0-8809-607a88f37f2a`; iOS update: `01a04f53-e96c-75cb-bfcc-ef5eeca9a72c`; message: `JourneyDeck 1.8: install Vinyl Route Soundtracks header`.
- TypeScript and the focused tab-runtime suite (19/19) passed. EAS channel verification confirmed this exact update is production head. No native build, TestFlight upload, or build 10 was created. The asset/source changes remain uncommitted and EAS records base commit `ff75d37` with a dirty-tree marker.

## Soundtracks header mockups — August 29, 2026

- Generated three 16:9 JourneyDeck-style neon header concepts labeled exactly `SOUNDTRACKS`, using the current Music, Atlas, and Live artwork as visual references.
- Saved the selectable previews as `docs/design/soundtracks-header-option-1.png`, `soundtracks-header-option-2.png`, and `soundtracks-header-option-3.png`. Patrick selected option 2; the other two remain design alternatives only.

## Production TestFlight OTA: Soundtracks promoted to the dock — August 29, 2026

- Published an iOS-only production OTA for runtime `1.8.0` to the `production` channel used by TestFlight build 9. Update group: `af0feec4-b446-4fc6-9720-b57d6f1ad0bd`; iOS update: `01a04ee1-2c1f-714e-af30-eadcda996b36`; message: `JourneyDeck 1.8: promote Soundtracks to primary navigation`.
- The five primary dock destinations are now exactly `Home`, `Live`, `Memories`, `Soundtracks`, and `Atlas`; Soundtracks renders the existing full music dashboard directly and refreshes when selected. Home’s soundtrack card routes to the new primary tab. Live uses the clearer filled-location symbol.
- Removed More from the pager/dock. Its non-primary destinations are preserved in a separate `Tools` overlay opened by the new gear beside the Home profile photo or existing Home analysis shortcuts. Tools contains Search, Timeline, Statistics, Data Health, and Settings, with explicit Close/Back-to-Tools controls. Selecting any dock item dismisses Tools.
- Recorder ownership remains under Live. Settings continues to contain recording-mode preferences only. Verification passed before publication: TypeScript, focused tab-runtime tests (19/19), full mobile tests (116/116), and whitespace validation. EAS confirmed this update is the production channel head at runtime `1.8.0`; no native build, TestFlight upload, or build 10 was created.
- Current OTA source changes remain uncommitted in `mobile/recorder/App.tsx`, `mobile/recorder/src/shell.tsx`, `mobile/recorder/src/primary-sections.tsx`, `mobile/recorder/tests/tab-runtime.test.mts`, and `mobile/recorder/tests/network-boundary.test.mts`. EAS records base commit `ff75d37` with a dirty-tree marker. Package these files explicitly in the next authorized release commit.

## Production TestFlight OTA: Live owns the recorder — August 29, 2026

- Published an iOS-only production OTA for runtime `1.8.0` to the `production` channel used by TestFlight build 9. Update group: `bf07f84e-1118-42f7-aa68-24ac5bd118f4`; iOS update: `01a04ec9-1189-7a19-ad4a-8db3980bbac1`; message: `JourneyDeck 1.8: make Live the single recorder home`.
- Live is now the single recorder destination. Its Start/Open action and Home’s recorder shortcut open the persistent recorder controls within the Live tab. The recorder includes an explicit `Back to Live` control, and tapping the selected Live dock item also returns to the Live overview.
- Removed the duplicate Record tile, route, and hidden recorder overlay from More. Settings retains only the appropriate Automatic/Manual recording preference. Updated onboarding and internal test-lab language to direct users to Live rather than a separate Recorder destination.
- Verification passed before publication: TypeScript, focused tab-runtime tests (18/18), full mobile tests (115/115), and whitespace validation. EAS confirmed this update is the production channel head at runtime `1.8.0`; no native build, TestFlight upload, or build 10 was created.
- Current OTA source changes remain uncommitted in `mobile/recorder/App.tsx`, `mobile/recorder/src/shell.tsx`, `mobile/recorder/src/primary-sections.tsx`, and `mobile/recorder/tests/tab-runtime.test.mts`. EAS records base commit `ff75d37` with a dirty-tree marker. Package these files explicitly in the next authorized release commit.

## Production TestFlight OTA: iPhone-first Live tab — August 29, 2026

- Published an iOS-only production OTA for runtime `1.8.0` to the `production` channel used by TestFlight build 9. Update group: `ba242c32-9708-4c5d-81a7-476be58c9e9e`; iOS update: `01a04ebe-5f9f-7453-8764-4bcd9060278e`; message: `JourneyDeck 1.8: make Live iPhone-first and Tessie optional`.
- Live now leads with the on-device recorder: an automatic/manual ready state when idle and live speed, distance, elapsed time, route, recorder action, soundtrack, and queue confidence during a journey. It no longer displays empty battery/range placeholders or Tessie connection instructions to users who have not connected Tessie.
- Connected Tessie users receive a separate optional vehicle panel with vehicle status, battery, and range. Tessie refresh failures explicitly leave the iPhone recorder unaffected. The OTA also includes base commit `ff75d37`'s honest first-launch music empty state.
- Verification passed before publication: TypeScript, focused tab-runtime tests (17/17), full mobile tests (114/114), and whitespace validation. EAS confirmed the production channel points to this update at runtime `1.8.0`; no native build, TestFlight upload, or build 10 was created.
- The two Live implementation/test files remain uncommitted in the working tree because this OTA request did not authorize a Git commit. EAS therefore records base commit `ff75d37` with a dirty-tree marker. Before the next binary/release package, commit `mobile/recorder/src/primary-sections.tsx` and `mobile/recorder/tests/tab-runtime.test.mts` explicitly so the OTA source is reproducible.

## TestFlight build 6 processing fix — August 29, 2026

- Apple received version 1.8.0 build 6 but rejected it during processing with ITMS-90683 because `expo-image-picker` set `microphonePermission: false`, removing the otherwise-declared `NSMicrophoneUsageDescription` from the generated native plist.
- Corrected both the explicit iOS plist value and plugin permission value to the same truthful Auto Recognition explanation, added a regression assertion, and committed only those two mobile files as `0a507e4` (`fix(mobile): preserve microphone privacy purpose`).
- Verified the generated Expo introspection contains the purpose string; `npm run typecheck`, 113/113 mobile tests, Expo Doctor 21/21, and the iOS export passed.
- External setup is complete for the next internal TestFlight build: Expo is connected to App Store Connect, the App Store Connect API key is stored in EAS, MusicKit and ShazamKit App Services are enabled, and the production CloudKit schema matches the seven checked-in JourneyDeck record types. Build 7 still needs to be created and submitted.

## Internal TestFlight readiness audit — August 28, 2026

- The current mobile working tree is technically ready to produce a first signed **internal TestFlight** build: `npm run typecheck`, the full mobile suite (112/112), `npx expo-doctor` (21/21), `npx expo export --platform ios`, the live privacy/support preflight, and `git diff --check` all passed.
- Production configuration is coherent for a build: bundle ID `com.journeydeck.recorder`, runtime/app version `1.8.0`, production EAS channel/environment, automatic remote build-number increments, internal-testing UI disabled, Apple Sign In, background location, and private CloudKit entitlements are declared. EAS authentication is active and has owner access to the JourneyDeck account.
- This is **not yet the final subscription-enabled candidate**. The production UI intentionally contains no StoreKit subscription/paywall or 45-day/Atlas entitlement implementation. A first TestFlight build can validate the signed production runtime, recording, permissions, onboarding, maps, and CloudKit before that feature lands.
- Remaining TestFlight acceptance work is intentionally performed on the signed build: physically verify the latest automatic-finish fix, background/lock-screen and offline completion, first-run permission denial/recovery, production CloudKit sync/deletion (ideally on two devices), and install/update behavior. App Store submission still also needs the App Review phone, final privacy-label answers, production screenshots/metadata, and the subscription implementation/configuration if Pro is part of version 1.0.
- Packaged the intended mobile release candidate as commit `b7d4671` (`feat(mobile): prepare internal TestFlight candidate`) on `codex/native-runtime-prep`. The 41-file commit includes only active mobile implementation/assets/tests, the public release preflight, and App Store preparation documents; it excludes server/web changes, design mockups, obsolete image variants, and this handoff file. Post-commit verification passed: typecheck, 112/112 tests, Expo Doctor 21/21, iOS export, public legal-page preflight, staged whitespace validation, and the repository secret scan. No push, EAS build/upload, or App Store Connect mutation was performed.

## Preview OTA published — August 28, 2026

- Published the current iOS JavaScript/assets working tree to Expo's private `preview` channel so normal UI review no longer requires Metro or the Tailscale bridge. This is an OTA update only: it does not create a TestFlight build, submit anything to App Store Connect, change the native runtime, or affect the public production channel.
- Update group: `3a78d418-e883-4153-ae61-44ed38b365ee`; iOS update: `01a04b46-7954-715d-a7b3-ecbdaa2790be`; runtime: `1.8.0`; message: `JourneyDeck 1.8 preview: cinematic UI refinements and welcome experience`.
- Verification immediately before publish passed: `npm run typecheck` and full `npm test` (111/111). `git diff --check` contains only pre-existing Windows line-ending notices. Working tree remains uncommitted and contains many user-owned changes; no commit or push occurred.
- Device path: open the JourneyDeck development build, dismiss any stale Metro-server error, then use the bottom `Updates` tab to download/launch this preview revision. Future UI/JavaScript preview publishes should use this channel; only native dependency/configuration changes require a new development or TestFlight build.

## Welcome-flow correction OTA published — August 28, 2026

- Corrected the welcome eligibility rule: an unacknowledged welcome now appears before any *unfinished* setup, including a profile that has retained a driving mode but has not yet chosen its music capability. It stays out of Settings edit flows and still cannot recur after `Set up JourneyDeck` marks the private preference complete.
- Published the follow-up private preview update: group `66637f88-e867-4b56-9fe8-163e48830639`, iOS update `01a04b4d-63dc-72d3-8ab9-25561280a60e`, runtime `1.8.0`, message `JourneyDeck 1.8 preview: show welcome before unfinished setup`.
- Verification passed: `npm run typecheck` and `npm run test:tab-runtime` (16/16). No commit, push, native build, TestFlight submission, or production publication occurred.

## Preview Profile Test Lab flag restored — August 28, 2026

- Root cause of the missing Profile Test Lab: EAS Update uses the selected EAS environment, not the `build.preview.env` block in `eas.json`; the `preview` environment had no `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING` variable. Consequently the OTA bundle correctly treated itself as public and hid the internal surface.
- Created the project-scoped, plaintext `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=1` EAS variable for **preview only**. The production environment remains without it, so public builds and updates retain the compile-time gate.
- Published update group `ea6af2b0-2842-4f74-94ec-f1f480c07662`, iOS update `01a04b57-e80b-7759-b767-b5e3fe8f0f8d`, runtime `1.8.0`, message `JourneyDeck 1.8 preview: restore Profile Test Lab`. Expo confirmed the preview variable was loaded during export.

## Shared JourneyDeck onboarding branding — August 28, 2026

- Replaced the generic orange `J` onboarding tile with the real `assets/icon.png` JourneyDeck app logo. Both the onboarding provider header and the animated welcome use it now.
- Replaced spaced/all-caps pseudo-wordmarks in the same onboarding surfaces and Home header with the shared `JourneyDeck` lockup: `Journey` uses the high-contrast brand white and `Deck` uses the warm coral from the actual app mark. The supporting line remains `Your drive, remembered.`
- Verification passed: `npm run typecheck` and `npm run test:tab-runtime` (16/16). Published private preview update group `6c5281d5-f3be-45f9-934f-eed684b4a7e1`, iOS update `01a04b71-7b61-7a59-9256-aae9ac308298`, message `JourneyDeck 1.8 preview: unify authentic onboarding branding`. No native build, TestFlight submission, or production publication occurred.

## Cinematic welcome journey hero — August 28, 2026

- Replaced the welcome screen's flat hand-built SVG route with a dedicated `mobile/recorder/assets/welcome-journey-hero-v1.png` artwork: a dark aerial night landscape, subtle topographic texture, distant lights, and a coral-to-violet-to-cyan illuminated journey road with waypoint beacons. The route/image entrance continues to respect Reduce Motion.
- Created with the built-in image-generation workflow, then copied into the project and referenced directly from the welcome scene. It contains no text, logos, UI controls, or watermark; JourneyDeck branding and the private-by-design badge remain native overlays.
- Verification passed: `npm run typecheck` and `npm run test:tab-runtime` (16/16). Published private preview update group `5368bf83-1f52-4b60-8456-b98c39571890`, iOS update `01a04b84-6cef-7dfb-83ff-9630018d5f94`, message `JourneyDeck 1.8 preview: cinematic welcome journey hero`. No native build, TestFlight submission, or production publication occurred.

## Automatic journey completion reliability — August 28, 2026

- Root cause: after an automatic start, only the separate automatic-detection Location task evaluated the five-minute parked clock. The active high-fidelity route task saved GPS points but did not participate in end detection. iOS can suspend a stationary background update stream, so a journey could remain `recording` indefinitely even though its route task remained the best available source.
- The route task now also sends its saved location batches to `processAutomaticDriveLocations`, without double-writing the final point. Finish marks the session as `finishing` before awaiting native task shutdown, so a concurrent location delivery cannot complete it twice. Both location registrations now set the 30-second deferred update timeout, and foreground/resume runs one fresh balanced-accuracy location reconciliation for an already-parked automatic session.
- The automatic detector remains additive: any detector failure is contained so the core route-recording task continues to retain points. Manual sessions remain manual; only a session known to have begun automatically can auto-finish.
- Verified with `npm run typecheck`, `npm run test:drive-detection` (11/11), and `npm run test:server-independence` (13/13). Published private preview update group `d5f4eee2-de92-4547-81de-93270ab5014e`, iOS update `01a04b8e-8854-7d8e-9595-c5bff83bd489`, message `JourneyDeck 1.8 preview: reliable automatic journey finish`. No native build, TestFlight submission, or production publication occurred. Physical drive/park acceptance is the next required test.

## First-launch welcome scene — August 28, 2026

- Added a new, one-time per-profile welcome scene before the existing recording-mode and music-provider setup. It introduces the JourneyDeck promise with a neon animated route, `The road remembers.` messaging, clear private-iCloud reassurance, and a single `Set up JourneyDeck` action.
- The route animation respects the iPhone Reduce Motion setting. Existing configured users do not see the scene; a newly created profile sees it once before the established functional onboarding flow. Its completion state is kept as a private preference so a normal private-iCloud restore does not repeat the welcome.
- Added the focused runtime regression assertion in `mobile/recorder/tests/tab-runtime.test.mts` and new `mobile/recorder/src/welcome-intro.ts` persistence helper.
- Verification passed: `npm run typecheck`, full `npm test` (111/111), and `git diff --check` (only existing Windows line-ending notices). No Metro/Tailscale change, commit, push, OTA, TestFlight build, or deployment was performed. Physical iPhone visual review remains the next check before publishing this as an OTA update.

## iOS navigation fade and Atlas label cleanup — August 28, 2026

- Removed the duplicate static border from Atlas frequent-place selector chips; each chip now relies on its single shared neon gradient outline.
- Recurring-pattern routes now remove country and ZIP code, and omit the state when both endpoints are in the same state. Cross-state routes retain the state on each endpoint, so a state transition remains visible.
- Added one app-shell content fade behind the floating navigation dock. Content dims while passing beneath/behind the dock on every primary tab, while the dock itself remains above the fade and unchanged.
- Verification passed: `npm run typecheck`, `npm run test:tab-runtime` (15/15), and `git diff --check` (only existing Windows line-ending notices). No Metro/Tailscale change, commit, push, OTA, build, or deployment was performed.

## Live map camera framing — August 28, 2026

- The Live tab's shared mobility map now opens with a 45° camera pitch and a minimum single-location camera span of roughly seven miles, for a deliberately farther tilted road-view perspective. Atlas, timeline, and collection maps retain their existing overhead framing.
- Verification passed: `npm run typecheck`, `npm run test:tab-runtime` (15/15), and `git diff --check` (only existing Windows line-ending notices). No Metro/Tailscale change, commit, push, OTA, build, or deployment was performed.

## Memories library chip states — August 28, 2026

- Replaced the main neon widget outline on the Journey Library filter and sort chips with a single muted satin rim. The selected choice now uses a warm orange rim, fill, and soft glow rather than a double outline.
- The same orange active-state treatment now marks the selected Memories workspace section, Timeline day, Atlas place, and gliding bottom-navigation tab, replacing competing purple-only selection styles.
- Verification passed: `npm run typecheck`, `npm run test:tab-runtime` (15/15), and `git diff --check` (only existing Windows line-ending notices). No Metro/Tailscale change, commit, push, OTA, build, or deployment was performed.

## More secondary navigation — August 28, 2026

- Removed the More sub-screen return affordance entirely after physical review showed it overlapping native headers.
- Every tap of the persistent More dock tab now returns directly to the More root, including when entering More from another tab. Internal shortcuts still open a specific More sub-screen directly.
- Verification passed: `npm run typecheck`, `npm run test:tab-runtime` (15/15), and `git diff --check` (only existing Windows line-ending notices). No Metro/Tailscale change, commit, push, OTA, build, or deployment was performed.

## Visual hierarchy pass — August 28, 2026

- Added standard and hero outline tones. Routine cards, rows, tiles, metrics, and controls now receive a quieter satin-neon perimeter, reducing visual noise. Maps, the Live vehicle card, and the driving score retain the full cinematic glow.
- Kept the orange halo as the shared selection language already applied to navigation and choice controls; this separates selection from general card decoration.
- Verification passed: `npm run typecheck`, `npm run test:tab-runtime` (15/15), and `git diff --check` (only existing Windows line-ending notices). No Metro/Tailscale change, commit, push, OTA, build, or deployment was performed.

## iOS Home Dashboard Cinematic Reskin — implemented and locally verified — August 27, 2026

- Reskinned the iOS application dashboard (`HomeScreen` in `mobile/recorder/src/shell.tsx`) to match the cinematic dark editorial mockup and unlocked Expo SDK capabilities.
- Integrated high-fidelity visual elements:
  - Header: Spaced `J O U R N E Y D E C K` wordmark with Georgia serif `The road\nremembers.` headline and glowing multi-color gradient profile avatar with live initials/photo support and modal editor.
  - Hero Card (`Friday night in Fort Worth` / `Home → Downtown` / `12.4 mi · 28 min · 7 songs`): Frosted `▶ Relive` pill button, multi-layer glowing route curve with numbered waypoint markers (`1`, `2`, `3` with radial glow halos and crisp badges), and bottom frosted action pills (`[ ⌸ ] View route` and `[ ··· ]`).
  - Stories Rail: Three story cards (`Night Drives · 28 memories`, `Coffee Runs · 16 memories`, `Summer Roads · 34 memories`) with photo covers, dark bottom vignette, and glass borders.
  - "Now playing on your road" Soundtrack Card: Header with waveform icon and `🟢 Watching · On device 🛡️` status pill; body with album artwork, track title (`Midnight City`), artist (`M83`), multi-colored audio equalizer waveform with timestamps (`1:48` and `4:03`), and circular play button with glowing gradient ring.
  - Floating Bottom Navigation Dock: Dark glass pill with active coral indicator and SF Symbols (`house.fill`, `antenna.radiowaves.left.and.right`, `rectangle.stack`, `map`, `ellipsis`).
- Verified: `npm run typecheck` passed (0 errors), full test suite `npm test` passed 104/104 tests, and `git diff --check` passed cleanly.

## Native runtime 1.8 preparation — implemented, locally verified, not built — August 27, 2026

- Active branch is `codex/native-runtime-prep`, based on clean `main` at `38c4ac4`. The working tree contains this uncommitted milestone; nothing was staged, committed, pushed, published as an OTA, deployed, or sent to EAS. App/runtime version is now `1.8.0`, release identity `N1.8-RC1 — Native Runtime 1.8 — private continuity`.
- Completed private CloudKit v3 transport. Photos and private preferences remain versioned assets/records; equal-revision tombstones now beat live edits in both JavaScript and Swift; server-record-changed failures return the server winner for immediate local resolution; physical record deletion remains quarantined; preference tombstones clear their former JSON value. The native bridge persists downloaded Photo/RouteArchive assets in profile/record-type-isolated Application Support directories and deletes those caches with the private zone. Its inbound boundary now rejects unknown record types, disallowed asset-bearing records, missing live assets, and empty/oversized Photo or RouteArchive downloads before persistence or change-token commit.
- Added exact GPS backup as checksummed, compact `RouteArchive` CKAssets. SQLite migration 4 tracks a separate route revision/dirty flag; every inserted breadcrumb requeues the route once per insert batch; upload acknowledgements are revision-conditional; downloads verify SHA-256, format, journey identity, count, order, timestamps, coordinates, and telemetry before one transactional replacement. Raw routes use only the user’s private CloudKit database and never the JourneyDeck server/privacy edge. Staging paths are stable and isolated under a per-profile cache directory; explicit account deletion removes that entire directory before the profile is finalized, so temporary raw-route payloads are not orphaned.
- Added explicit account lifecycle controls in Settings. Sign-out stops manual and automatic Core Location tasks, resets detector state, preserves the linked profile and private backup, and enters a fresh empty local profile. Account deletion requires the recorder to be idle, deletes the private CloudKit zone first, then private photo files and profile-owned Keychain secrets/recorder cache, and only then hard-deletes the local profile. It uses two destructive confirmations and fails closed if private iCloud is unavailable. Apple sign-in is treated as a possible profile switch and performs the same background-task shutdown before changing identity, followed by a complete keyed remount.
- Permission/background audit now provides an iPhone Settings recovery action when foreground or Always location permission can no longer be requested. Both background task definitions remain registered at module entry; interrupted recording recovery pauses rather than fabricating continuity; profile handoffs serialize both task stops. The Profile Test Lab is compile-time gated by `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING`: enabled for development/preview and disabled for production, with a second guard inside profile creation.
- Added the additive `RouteArchive` schema to `mobile/recorder/cloudkit/journeydeck-development.ckdb`. Before cross-device route testing, import this checked-in schema into CloudKit Development and deploy the additive Production change. Existing Photo/PrivatePreference/Collection/Memory fields are retained; no schema deletion is intended.
- Verification passed: TypeScript; complete mobile suite 103/103; Expo Doctor 21/21; production-style iOS export (1,462 modules, 11 assets, 4.3 MB Hermes bundle); and `git diff --check` aside from normal Windows line-ending notices. Apple’s current CKDatabase documentation confirms the async zone-delete result shape used by the Swift bridge. A focused security diff review found and fixed the inbound CloudKit asset-validation gap; no unresolved reportable finding remains. Windows cannot compile the Swift module, so the first 1.8 native build remains the Swift compile/signing gate. Do not publish these changes to runtime 1.7 and do not start a build without explicit user approval.
- Next: final review, then commit/push if requested. Import/deploy the additive schema before device acceptance. Use one development/preview 1.8 build to compile the bridge, then test exact-route restore, Photo/Preference/tombstone conflict across the two iPhones, denied-permission recovery, sign-out/return, and account deletion using a disposable profile. Keep Profile Test Lab enabled only on preview/internal distributions.

## Temporary Profile Test Lab — implemented, awaiting device acceptance — August 27, 2026

- Added a non-destructive Profile Test Lab to Data Health. It creates a separate timestamped local test profile, reloads the app into it, reports exact aggregate counts for journeys, GPS points, songs, Memories, Collections, and recorder queue, and provides a direct return button to each normal profile. Switching is blocked unless the recorder is ready; the original profile and all of its data remain untouched.
- Synthetic test profiles deliberately pause private iCloud sync so existing records from the same Apple account cannot contaminate the clean-user baseline. Last.fm state, music preferences, owner Spotify token/PKCE state, and Tessie token are now profile-scoped in the iOS Keychain. Existing legacy device-wide values can be claimed once by a normal profile, but never by an isolation-test profile.
- Verification passed: mobile TypeScript, complete mobile suite 96/96, focused Profile Test Lab tests 6/6, iOS Expo export (1,459 modules, 11 assets, 4.2 MB Hermes bundle), and `git diff --check` aside from normal Windows line-ending notices. No Expo/EAS build, OTA publication, commit, or push was performed.
- Device acceptance: while running Live Metro, open More > Data Health > Profile Test Lab and choose `Create clean test profile`. After reload, confirm the card says `CLEAN` and all six values are zero; browse Home, Memories, Atlas, Search, Recorder, Music/Connections, and Settings to confirm no prior content or provider connection leaks through. Then use `Return to <original profile>` and confirm the original archive and connections return. A second iPhone is not needed for this local isolation check; reserve it for the later TestFlight/private-iCloud cross-device test.
- First physical attempt exposed a black screen after confirmation because profile switching called Expo Updates' native reload API inside a Metro development session. Replaced that path with a keyed in-app remount of the complete shell/recorder tree; no native restart or update reload is used for profile switching. The corrected path passes all 96 tests, TypeScript, and a fresh iOS export. The test profile created during the failed reload is preserved and is now the selected profile, so reopening/reloading should enter it directly rather than creating another one.
- Corrected physical acceptance passed: reopening entered the isolated profile, displayed first-run recording-mode onboarding instead of inheriting the owner's preference, and Data Health reported `CLEAN` with all six isolation counters at zero. Remaining acceptance is a brief visual sweep of the primary sections for inherited content, then returning to the original profile and confirming its archive/provider connections reappear.
- Full Profile Test Lab physical acceptance passed. The test profile was completely empty throughout the primary-section sweep. `Return to <owner name>` switched back successfully, and the user's original archive/data reappeared intact. This validates local content, first-run preferences, provider credentials, screen caches, recorder queues, and return-path isolation on the real iPhone. The temporary lab implementation is ready to commit; do not ship the lab publicly without removing it or placing it behind an explicit internal-testing gate.
- Working tree contains the implementation in `mobile/recorder/src/auth.ts`, `profile-secure-store.ts`, `music-preferences.ts`, `spotify-direct.ts`, `tessie-direct.ts`, `primary-sections.tsx`, `shell.tsx`, and related tests. Next action is physical acceptance, then remove or permanently gate the temporary lab before public release.

## Phase 3 Closure Bundle D — implemented and manually accepted — August 27, 2026

- Removed the JourneyDeck credential gate from manual and automatic recording. A stable on-device recorder identifier is created independently in iOS Keychain; both modes start, pause, resume, finish, mirror into the active profile's SQLite master, run local music matching, and attempt private iCloud summary sync without a JourneyDeck server connection. Legacy JourneyDeck upload is queued only for a profile that explicitly configured the optional owner backup.
- Added recorder-database profile ownership. Existing unowned sessions are claimed once by the currently active saved profile; every active/completed session, queue, Last.fm retry, local mirror, and count lookup is filtered through the active user. Screen caches are namespaced per profile and legacy global caches are claimed by only the first existing profile, preventing a new profile from inheriting another user's archive. Legacy server credentials are likewise migrated into a profile-scoped Keychain slot and cannot be inherited by another profile.
- Ordinary dashboard/journey/Memory refresh, provider preference reads/writes, and Journey Detail place naming now remain local/private even when the user pulls to refresh. Place aliases use a profile-scoped private preference keyed by a non-reversible local location hash. The retained server bridge is exposed only as `Owner legacy tools` / `Import legacy archive`; existing server photo fallback and optional recorder backup remain legacy owner actions.
- Recorder UI now says `No server required`, shows locally captured items as saved when no owner backup exists, and labels the former connection gate as optional owner backup. The dashboard treats the on-device recorder as ready regardless of server state.
- Verification passed: mobile TypeScript, complete mobile suite 90/90, focused server-independence 12/12, iOS Expo export (4.2 MB Hermes bundle), and `git diff --check` aside from normal Windows line-ending notices. Real-device manual acceptance passed with local-only mode enabled: the completed journey appeared immediately while JourneyDeck and Blocked both remained zero. Automatic-drive acceptance was deliberately deferred because the user did not have time to drive. Clean-profile UI acceptance still needs the planned temporary Profile Test Lab. Release identity is `P3.D — Closure Bundle D — server-independent core`, runtime `1.7.0`. Exact raw-route private backup remains deliberately deferred to the consolidated native-build phase.
- Committed and pushed as `343710d` (`feat(mobile): close phase 3 server independence`). Published the exact commit to the iOS `preview` branch for runtime `1.7.0`: update group `21d5735e-65c6-4511-b1b5-ee2af091c678`, iOS update `01a044f3-e053-7da7-981a-3f975a12acaf`, message `P3.D Closure Bundle D server-independent core`. No native build or build credit was used.

## Read-only legacy retention preview — August 27, 2026

- The user selected and explicitly approved the 30-day policy. Applied it to the canonical legacy Turso archive on August 27 after an immediate preview confirmed the original 2,025-journey/3,812-song target had not drifted. The transaction removed exactly 2,025 unprotected Google Timeline journeys, 3,812 old unmatched direct-Spotify history rows, and 1,061 derived soundtrack rows belonging to the removed journeys. It also invalidated derived Atlas snapshots/pattern candidates and durable rollups so retained views can be rebuilt without stale legacy content.
- Before deletion, created and immediately decrypted/checksummed a Windows-user-encrypted recovery package at ignored path `data/retention-backups/journeydeck-retention-20260827-200559.jdrb` (1,232,761 bytes; plaintext SHA-256 `0cdb6f3493e62f21b7c9e4abfccd1fe218bde50c5c19b473c494d644562606c4`). It contains every removed canonical journey, soundtrack, and listening-history row and is recoverable only under the same Windows user context unless deliberately migrated.
- Independent post-cleanup preview: the 30-day policy now has zero candidates; retained archive totals are 178 journeys, 2,558 raw recorder GPS points, 2,158 song plays, 2 Memories, and 13 Collections. All point/content/link preservation checks passed and `PRAGMA integrity_check` returned `ok`. A hypothetical 7-day policy would still remove 40 journeys and 1,059 songs, but it was not applied.
- Added guarded cleanup tool `tools/Invoke-JourneyDeckThirtyDayRetention.ps1`. Its apply mode requires explicit confirmation and expected counts, creates/verifies the encrypted recovery package before mutation, deletes exact backed-up IDs in one Turso transaction, and performs post-delete preservation/integrity checks. No iPhone-local master row was deleted by this server-archive operation; the Data Health card remains the exact device-side visibility boundary.
- Implemented a read-only retention preview for 30-day and 7-day policies. Data Health now calculates exact kept/removable counts from the active profile's on-device SQLite master after navigation settles; it exposes no deletion action. It protects all native recordings, recent history, Collection-linked journeys, Memories, and Collections, and fails closed if legacy Collection metadata cannot be parsed.
- Conservative candidate policy: only Google Timeline journeys older than the selected cutoff and not linked by a Collection qualify; their attached route points/song rows qualify with them. Old unmatched direct-Spotify history can qualify independently. Unknown provenance, invalid dates, native recordings, current Last.fm/Apple Music/Shazam activity, and all private content stay.
- Added `tools/Get-JourneyDeckRetentionPreview.ps1`, which uses aggregate-only output and SELECT-only Turso reads to preview the legacy archive without printing titles, places, coordinates, tokens, or row contents. Current exact legacy-archive result: 30 days keeps/removes journeys 178/2,025, route points 2,558/0, songs 2,158/3,812, Memories 2/0, Collections 13/0. Seven days keeps/removes journeys 138/2,065, route points 2,558/0, songs 1,099/4,871, Memories 2/0, Collections 13/0.
- Verification passed: complete mobile suite 87/87, focused retention/release tests 4/4, mobile TypeScript, PowerShell parsing, the live read-only Turso preview, and `git diff --check` aside from Windows line-ending notices. The stale P3.4 release-identity test was corrected to the already-shipped P3.5 metadata. The preview path itself remains SELECT-only; the separately approved cleanup and its verified outcome are recorded above. No build or OTA was used.
- Milestone files: `mobile/recorder/src/retention-preview.ts`, `mobile/recorder/src/local-store.ts`, `mobile/recorder/src/primary-sections.tsx`, `mobile/recorder/tests/retention-preview.test.mts`, `mobile/recorder/tests/release-identity.test.mts`, `tools/Get-JourneyDeckRetentionPreview.ps1`, `tools/Invoke-JourneyDeckThirtyDayRetention.ps1`, plus this handoff. Next: refresh the app once so stale server-derived screen caches rebuild from the retained archive. The iPhone Data Health preview now reports zero locally removable items; do not apply the 7-day policy.

## Phase 3 JourneyDeck server-dependency audit — August 27, 2026

- Audit result: Phase 3 is not yet closed. All JavaScript fetches cross the shared measured boundary, and ordinary startup/tab navigation uses local SQLite/cache data, but a clean public user still cannot record without JourneyDeck server credentials. Manual recording renders the server connection gate and calls `beginLocalSession(connection.deviceId)`; automatic detection also requires `loadConnection()` before it can start.
- Complete JourneyDeck endpoint inventory: connection status; recorder session create, GPS batch, music batch, and complete; dashboard; journey list/detail; place alias; Memories catalog; legacy photo read/delete; and provider preference read/write. Last.fm, owner Spotify, Tessie, city labels, maps, Expo Updates, Apple Music/Shazam, and private CloudKit do not use the JourneyDeck application server.
- Release blockers: (1) decouple the local device identifier and both recording modes from server credentials; (2) decide and implement private raw-route backup because CloudKit currently syncs journey summaries/music but not GPS breadcrumbs, leaving JourneyDeck backup as the only off-device exact-route copy; (3) replace the server-only Journey Detail place-alias action with user-scoped local/private data; (4) scope legacy dashboard/journey/Memory/photo caches and recorder sessions to the active local user so one profile cannot inherit another profile's cached remote data or active recording.
- Avoidable cost/latency: completed journeys automatically attempt JourneyDeck backup on finish, launch/resume, and when local-only mode is disabled; provider preference changes still mirror to JourneyDeck and then force a remote dashboard reload; pull-to-refresh can request the dashboard, as many as 20 weekly-history pages, eight archive pages, and the Memories catalog (up to 30 JourneyDeck reads in one refresh). These paths are explicit/optional and fall back locally, but should become owner-only migration/backup controls rather than normal public behavior.
- Legacy compatibility still depends on JourneyDeck for uncached remote journey details and old server-only photo read/delete. Preserve this only as a bounded one-time owner migration until the existing archive and photos are durably local/private-iCloud.
- Verification: mobile TypeScript passed. The full suite passed 83/84; the only failure is stale `tests/release-identity.test.mts` metadata expecting P3.4/vehicle edge while `app.json` correctly reports P3.5/private content. Existing server-independence tests cover local-first completion, navigation, Last.fm, Spotify, and Tessie, but do not yet assert that a brand-new user can record with no JourneyDeck connection or that normal public refresh/preferences/place naming emit zero JourneyDeck requests.
- Recommended closure bundle before UI polish or the consolidated native build: local device identity + connection-free recorder; zero-server public refresh/preferences/place naming; user-scoped recorder/cache migration; an explicit owner-only legacy import/backup surface; raw-route private-backup design; and regression tests for a clean no-server profile. Fix the stale release-identity expectation in the same bundle.

## Server Independence Bundle C — private content 3.5 — August 27, 2026

- Implemented, committed as `5aa859f` (`feat(mobile): add private content independence`), and pushed to `agy/journeydeck-1.6`; release identity is `P3.5 — Bundle C — private content` and runtime remains `1.7.0`.
- Memories and Collections now use the active profile's SQLite master exclusively for writes; normal edits no longer mirror to the JourneyDeck server. Added explicit delete controls. Deletion is recoverable and revisioned: rows remain as tombstones, Collection deletion tombstones its owned photos and removes Collection references from Memories, Memory deletion tombstones its owned photos, and photo deletion clears affected covers without removing the underlying file.
- Added additive SQLite migration 3 with user-scoped private photos, user-scoped private preferences, per-record sync revisions, tombstones, and a quarantine for unversioned physical CloudKit deletions. Upload acknowledgements clear only the exact revision that was sent, so an edit made while the upload is in flight stays pending. Conflict ordering uses revision first, deletion on an equal-revision edit/delete tie, and timestamp only as the final deterministic tie-break.
- New photos are compressed by the existing picker, written to the app's private Documents directory before their metadata is accepted, read locally in the UI, retained after logical deletion for recovery, and no longer require a JourneyDeck server upload. Local catalogs reconcile cached legacy photos while filtering every local photo/Memory/Collection tombstone so stale server cache cannot resurrect deleted content.
- Safe preferences for music capture, recording mode, provider choice, and vehicle intelligence now have user-scoped local-master rows and join private sync. Last.fm usernames, Spotify/Tessie tokens, Apple credentials, exact coordinates, and device-local photo paths remain outside CloudKit fields.
- Extended the next native CloudKit bridge with `Photo` CKAsset and `PrivatePreference` records, a 10 MB native asset ceiling, profile-isolated persistent asset downloads, revision-aware remote comparison, and two-phase change-token acknowledgement. The JS engine capability-gates these additions: the installed 1.7 bridge continues syncing the original live summary fields, retains P3.5 tombstones/photos/preferences locally, and reports how many private items are waiting rather than sending unsupported payloads. A future native build is required before photo assets, tombstones, and private preferences can sync across devices.
- Updated the checked-in CloudKit schema additively for Collection/Memory revision and deletion fields plus `Photo` and `PrivatePreference`. The complete schema was imported into Development and deployed successfully to Production on August 27, 2026. Apple's reviewed Production diff contained only additions: `Collection.deletedAt`, `Collection.syncRevision`, `Memory.coverPhotoId`, `Memory.deletedAt`, `Memory.syncRevision`, and the new `Photo` and `PrivatePreference` record types; no fields or types were removed.
- Verification passed: TypeScript, complete mobile suite 84/84 including new conflict/deletion/photo/preference tests, Expo Doctor 21/21, iOS Expo export (1,457 modules, 11 assets, 4.2 MB bundle), and `git diff --check` aside from Windows line-ending notices. Windows cannot compile the Swift bridge; its first build remains the native compile/asset transport gate.
- First live-Metro acceptance found that newly saved Collections and Memories remained invisible even though the local save completed. The editor was coupling its post-save refresh to the whole primary dashboard and optional remote refresh path; an unrelated section failure could leave the visible catalog stale. Post-save now refreshes the narrow local Memories catalog independently and also refreshes the aggregate local summary. Existing test rows are preserved and should appear after the hot reload/tab refresh. TypeScript, the private-content regression test, tab-runtime tests, Metro rebundle, and `git diff --check` pass after the fix.
- Physical local-only persistence acceptance passed: with `Test without JourneyDeck server` enabled, the user created a Collection and Memory; both survived a force-close and appeared after reopening. The test switch correctly reset on the new app session, but the save paths contain no JourneyDeck write and the records came from the on-device SQLite catalog. This confirms the P3.5 text-content local-master path and the visibility fix.
- Physical local photo persistence acceptance passed: a photo added through the P3.5 local path remained visible after force-closing and reopening the app, confirming the private file and user-scoped SQLite metadata both survive restart without a server photo upload.
- Physical photo-deletion acceptance passed: after removing the test photo and force-closing/reopening JourneyDeck, it remained absent. This confirms the photo tombstone is durable and stale catalog/cache data does not resurrect it; the underlying private file remains retained for recovery.
- Physical Memory/Collection deletion acceptance passed: after deleting the test Memory and Collection and force-closing/reopening JourneyDeck, neither returned in cards or search. Together with the earlier create/edit/photo checks, the complete P3.5 local-only private-content path is accepted on the real iPhone. Cross-device CloudKit asset, preference, conflict, and tombstone tests remain gated on the additive schema deployment and next consolidated native build.
- Published the iOS-only runtime `1.7.0` P3.5 preview OTA: update group `9327fe4f-f631-43e8-9954-58a93f7c5888`, iOS update `01a044aa-4c95-76f3-871e-b294b3093e9f`, message `P3.5: Private content independence`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/9327fe4f-f631-43e8-9954-58a93f7c5888`. EAS confirmed it is the current head of the `preview` branch and carries commit `5aa859f09366031bb189cd855955ec516f278acf`; no native build credit was used.
- Next isolated acceptance order: (1) include the bridge in the next deliberately consolidated native build; (2) run two-device edit/delete, interrupted-pull replay, photo round-trip, and restore tests before advancing to Phase 4.

## Bundle B physical acceptance — August 27, 2026

- With JourneyDeck local-only mode enabled, Tessie connected successfully and verified one vehicle; 16 recent charging sessions and 61 route patterns were cached on-device. Data Health showed `JourneyDeck 0`, `Private Edge 2`, `Blocked 0`, `Imports 2`, and both Tessie operations completed. The data remained visible after an app restart without tapping sync, completing P3.4 physical acceptance.

## Server Independence Bundle B — Vehicle edge 3.4 + shared 3.7 controls — August 27, 2026

- Implemented and committed as `0ee5615` (`feat(mobile): add independent Tessie vehicle edge`), then pushed to `agy/journeydeck-1.6`. Release identity is `P3.4 — Bundle B — vehicle edge`; runtime remains `1.7.0` and no native build was required.
- Replaced server-managed Tessie reads/preferences with an optional direct connection owned by the iPhone. The Tessie token is verified through the stateless privacy edge and then stored with SecureStore `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; vehicle snapshots, recent charges, route-efficiency summaries, user electricity rate, favorite chargers, and place overrides are cached locally. Ordinary dashboard refreshes do not spend Tessie requests; sync is explicit in Settings. Disconnect removes the token while preserving local summaries.
- Added read-only Worker endpoints for Tessie verification and a bounded 30-day history import. The Worker accepts at most four active vehicles and 200 charges/drives per vehicle, exposes no command route, bounds request/upstream bodies and time, never returns VINs or precise coordinates, and emits only fixed-path request logs. The user token is used transiently as Tessie's bearer header and is never logged, returned, or stored at the edge.
- Added shared Worker controls: global and provider kill switches, a clamped shared upstream timeout, a global IP-hash rate limiter, provider-specific opaque-key rate limiters, no-store failures, and shared helpers now used by Last.fm, Spotify, Tessie, and places. Existing Last.fm/Spotify shared credentials remain Wrangler secrets; no Tessie shared secret was added and no secret value is present in configuration or source.
- Verification passed: complete mobile suite 83/83, mobile TypeScript, Expo Doctor 21/21, iOS Expo export (1,451 modules, 11 assets, 4.1 MB bundle), generated Worker types, Worker TypeScript, preview dry-run (26.61 KiB / 7.08 KiB gzip with four rate-limit bindings), gitleaks across 398 commits, and `git diff --check` aside from Windows line-ending notices. Temporary dependency-inspection files were removed.
- Deployed only `journeydeck-edge-preview`, version `17e07498-d844-4d49-bc9f-6b3801c5bbef`. Live health reports preview with Last.fm, Spotify, Tessie, and places enabled; both existing shared secrets remain bound, and the Tessie verification route rejects an empty request with 400. Production Worker remains untouched.
- Published the iOS-only runtime `1.7.0` preview OTA: update group `93b8e519-2be3-4dc8-801f-c3276aece794`, iOS update `01a04447-3735-7dca-ae5d-82fd096aa018`, message `P3.4: Vehicle independence and shared edge controls`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/93b8e519-2be3-4dc8-801f-c3276aece794`. EAS confirmed it is the current head of the `preview` branch and carries commit `0ee561585b27126a14093386bd68e666bf564e1d`; no native build credit was used.
- Next step: load P3.4 on the iPhone, connect Tessie from Settings with a user-generated developer token, and physically verify vehicle/charge/route sync with JourneyDeck local-only mode enabled.

## Server Independence Bundle A — Music independence 3.2 + 3.3 — August 27, 2026

- Implemented and committed as `1cc7e6c` (`feat(mobile): add independent music imports`), then pushed to `agy/journeydeck-1.6`. Release identity is `P3.3 — Bundle A — music independence`.
- Public Spotify history no longer calls the JourneyDeck server. The runtime queues completed sessions, sends only the saved public Last.fm username plus bounded start/end times to `POST /api/music/lastfm/recent`, then performs exact time matching, stable deduplication, local SQLite persistence, song-count refresh, Atlas rebuild, and later private CloudKit sync on the iPhone. Last.fm artwork is deliberately excluded; visible Last.fm credit/linking is included. Successful edge verification is persisted locally rather than relying on server connection state.
- Added an owner-only direct Spotify path using Authorization Code PKCE, the existing `journeydeck-recorder://spotify-callback` scheme, SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, direct on-device `/v1/me/player/recently-played` reads, local journey matching, and no JourneyDeck server token transport or storage. The public provider carousel remains three choices; the fourth owner choice is visible only on the existing legacy-connected Patrick device. Replace this migration eligibility with a durable explicit owner entitlement before public distribution if direct Spotify is retained.
- Hardened the stateless preview Worker with bounded streaming request/upstream bodies, fixed-path structured logs, separate Last.fm and Spotify rate-limit bindings, generic upstream errors, strict Last.fm username/session-window validation, now-playing exclusion, Spotify redirect allowlisting, and no durable provider state. Cloudflare preview secrets `LASTFM_API_KEY` and `SPOTIFY_CLIENT_ID` were transferred directly from 1Password/encrypted local storage; no secret was printed, written to the repo, or added to production.
- Deployed only `journeydeck-edge-preview`, version `3e57995a-bc39-478c-bf7a-b0e4bc5f21ff`. Live smoke tests passed for health, Spotify public configuration and exact callback URI, and a real Last.fm history request with required attribution. Production Worker remains untouched.
- Verification passed: mobile TypeScript, complete mobile suite 82/82, Expo Doctor 21/21, generated Worker types, Worker TypeScript, preview dry-run, live edge smoke tests, and `git diff --check` (Windows line-ending notices only). Physical server-independence acceptance also passed on the iPhone: Last.fm matched 23 songs with local-only mode enabled (`JourneyDeck 0`, `Private Edge 9`, `Imports 5`); owner Spotify returned through the registered custom callback, matched four new songs, and repeated with local-only mode enabled (`JourneyDeck 0`, `Private Edge 5`, `Imports 5`). Last.fm public/commercial release remains blocked on written permission.
- Corrected an iOS OAuth-resume race found during owner Spotify acceptance. The callback now waits for the app and URLSession networking to resume, prevents duplicate callback processing, and retains pending PKCE state until token storage succeeds. The corrected code passes TypeScript and all 82 mobile tests.
- Published the iOS-only runtime `1.7.0` preview OTA: update group `4d0e0440-9fb0-4f2f-a4d6-66c121eb9221`, iOS update `01a04403-bc02-7431-a712-682bc4464d81`, message `P3.3: Music independence via Last.fm edge and owner Spotify`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/4d0e0440-9fb0-4f2f-a4d6-66c121eb9221`. It carries commit `1cc7e6ca475ac352d64dedf26749fe555145967d`; no native build credit was used.
- Published the corrected iOS-only runtime `1.7.0` P3.3 preview OTA after physical OAuth acceptance: update group `fe582065-5942-4119-8c26-3eb19fef8ed8`, iOS update `01a04428-455c-7fe7-aeca-d8539bd4ce53`, message `P3.3 corrected: Stabilize owner Spotify callback`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/fe582065-5942-4119-8c26-3eb19fef8ed8`. It carries commit `dc63c27734fc209bfd8c814890fa8dd3e9f1d8db`; no native build credit was used.

## Clean-room TestFlight gate — August 27, 2026

- Before external TestFlight testing, perform a true first-user acceptance run after Phase 4 is feature-complete. First rehearse onboarding in the development client with no JourneyDeck connection or prior local profile. Then use the first internal TestFlight build on a separate iPhone/iCloud account so the install exercises Production CloudKit exactly like an App Store user; reinstalling under Patrick's existing iCloud account is not a clean test because its private CloudKit records persist independently of the app installation.
- The gate must cover fresh install, Sign in with Apple, provider selection (public Spotify through Last.fm rather than owner-only direct Spotify), permissions, first recording and local finish, map/music/city results, private iCloud sync and restore, offline/server-disabled behavior, restart/update recovery, sign-out, and complete account/data deletion. Do not invite external TestFlight testers until this clean account passes without developer intervention.

## Music-provider constraint for Phase 3.2 — August 27, 2026

- Direct Spotify Web API access is owner-only for Patrick and must not be treated as the public JourneyDeck path. Ordinary Spotify users will connect Spotify scrobbling to their own Last.fm account and JourneyDeck will import their timestamped history through the Last.fm username workflow. Keep provider provenance explicit (`spotify_direct` owner capability versus `lastfm` public import), retain Apple Music and on-device recognition as independent options, and never show public users a direct-Spotify setup they cannot successfully complete.
- Phase 3.2 should move the public Last.fm import to a bounded stateless edge broker holding the shared API key, with no Last.fm password/session, server database, raw coordinates, or durable edge history. The iPhone remains the archive owner and performs time matching, deduplication, caching, retries, and deletion locally. Direct Spotify remains behind an owner-only capability flag and must not be required for artwork, navigation, summaries, or journey completion.
- Before a commercial/public release, obtain Last.fm's written commercial/public-use permission and confirm the required attribution/approved presentation. Its published API terms cover non-commercial use by default, require Last.fm credit/linking, impose caching/rate/storage conditions, and say public API-backed pages require written approval. JourneyDeck must preserve a useful Apple Music/on-device recognition mode if Last.fm approval or availability changes.

## Server Independence Phase 3.1 — privacy-safe edge city summaries — August 27, 2026

- Began Phase 3 by replacing Music's JourneyDeck-server dashboard refresh with an on-device dashboard plus a stateless city-label enrichment path. Each saved song is matched locally to its nearest timestamped GPS breadcrumb. Only a two-decimal city grid (approximately one kilometer) is sent, only after a deliberate Music pull-to-refresh; startup and global section refreshes perform zero city lookups. Returned labels and the resulting city/song summary are cached on-device for 30 days, with at most four sequential cache misses per deliberate refresh.
- Extended Data Health with a separate `PRIVATE EDGE` count and city-lookup reason. Its in-memory diagnostics retain no URL, coordinate, body, token, or identifier. The fixed `/api/places/reverse` path now accepts a bounded POST body so even reduced coordinates are absent from request URLs and JourneyDeck structured logs; the response contains labels and OpenStreetMap attribution but no coordinates.
- Hardened the existing Worker: current `2026-08-27` compatibility, generated binding/runtime types, JSONC preview/production environments, observability with fixed-path structured logs, top-level error isolation, bounded JSON bodies, Spotify PKCE plus redirect allowlisting and no client-secret dependency, and minimal Tessie verification that returns only validity and vehicle count. Production was not changed and no provider secret is configured in preview yet.
- Deployed only `journeydeck-edge-preview` at `https://journeydeck-edge-preview.patrickbstewart.workers.dev`, version `f884bbda-76b2-41c0-93a5-fafd6f9cd55c`. Live checks passed: preview health 200, city POST returned `Fort Worth, Texas` without coordinates, over-precise input returned 400, and coordinate query URLs returned 405. The prior production Worker remains untouched.
- Verification passed: mobile TypeScript; complete mobile suite 80/80; Expo Doctor 21/21; iOS export (1,447 modules, 11 assets, 4.1 MB bundle); generated Cloudflare types; Worker TypeScript; preview dry-run; live preview behavior; and `git diff --check` with Windows line-ending notices only. Tailscale Metro remains reachable locally and remotely.
- The first physical Music check loaded the correct Phase 3 build but left `Cities & sound` empty. Root cause: the initial matcher only read the newer SQLite music/GPS tables, while most existing song-filled journeys were available through cached Journey details. Music pull-to-refresh now also supplies those cached details, preferring saved song coordinates, then timestamped route points, then a time-proportional position on the exact ordered route. Duplicate plays are removed before city grouping. Corrective verification passed: mobile TypeScript and the complete mobile suite 80/80.
- Physical acceptance passed through live Tailscale Metro: after reloading and deliberately refreshing Music, `Cities & sound` populated from the historical cached journey archive. This confirms the on-device matching, privacy-reduced edge lookup, local cache, and Music rendering path work together on the iPhone.
- Committed the accepted implementation as `03d6b38` (`feat(mobile): add privacy-safe city sound summaries`) and pushed `agy/journeydeck-1.6`. Published the iOS-only runtime `1.7.0` preview OTA: update group `75e01efe-a06c-43c8-9752-6e8c3d3b6499`, iOS update `01a043c7-705a-7131-bbf2-4a49da77baae`, message `Phase 3.1: Add privacy-safe Cities and sound summaries`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/75e01efe-a06c-43c8-9752-6e8c3d3b6499`. The OTA carries commit `03d6b38217374b7b0f79f0c421539cccd6065883`; no native build credit was used. Later Phase 3 work remains for direct/stateless provider setup (Spotify/Tessie) and retirement of additional legacy server calls.

## CloudKit production schema — August 27, 2026

- Real-device private iCloud testing reached CloudKit successfully but returned `0 uploaded · 0 downloaded · 4 will retry`; all four per-record saves were rejected because the JourneyDeck record types had never been deployed beyond the default `Users` development schema.
- Imported the checked-in `mobile/recorder/cloudkit/journeydeck-development.ckdb` schema into `iCloud.com.journeydeck.recorder` Development after Apple validation passed, then deployed it successfully to Production. The deployment created `Journey`, `MusicEntry`, `Collection`, and `Memory`, added their exact privacy-safe fields, preserved `Users`, and changed only the `_creator`/`_world` grants required for the new types; there were no deletions or indexes.
- Added schema-drift assertions to the CloudKit sync test. Physical acceptance passed: after deployment, app launch completed its automatic private sync and the explicit retry reported `0 uploaded · 4 downloaded` with no remaining retry failures, confirming the four records exist in the private Production zone and can be read back on-device. No native build or OTA was required for the server-side schema change.

## Visible preview/OTA identity — August 27, 2026

- Added a prominent `Version & update` panel to Data Health so a tester can identify the exact code currently running. It reports the human release sequence/label, `Live Metro` vs. `Published OTA` vs. `Embedded build`, native app version and build number, runtime version, channel when Expo can truthfully provide one, short and full OTA UUID, publication time, and whether a newer update is downloaded and waiting for restart.
- Added the OTA-carried release label `P2.1 — Phase 2.1 — visible update identity` to Expo config. Future preview publications should update both `extra.release.sequence` and `extra.release.label` so screenshots remain human-readable while the immutable OTA UUID provides exact identification.
- Verification passed: TypeScript; complete mobile suite 77/77; Expo Doctor 21/21; production iOS export (11 assets, 4.1 MB bundle); and live Tailscale Metro bundle. Committed as `aaabbf2` (`feat(mobile): show exact preview update identity`) and pushed `agy/journeydeck-1.6`. Published the iOS-only runtime `1.7.0` preview OTA: update group `237b7d63-87aa-4125-b336-79325a89776d`, iOS update `01a0438b-6284-7a53-9f77-c13725c702ae`, message `P2.1: Show exact preview update identity`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/237b7d63-87aa-4125-b336-79325a89776d`. No native build credit was used.

## Server Independence Phase 2 — on-device finish and quiet local reads — August 27, 2026

- Reversed recorder ownership so manual and automatic journeys finish into the active user's SQLite archive before any server work. Completion immediately writes the journey summary, exact GPS route, captured music, and rebuilt Atlas snapshot; the UI now presents `Saved on this iPhone` instead of waiting for JourneyDeck.
- Added an OTA-safe `remote_completed` migration and persistent completed-session queue. Optional JourneyDeck backup sends one completed journey in bounded GPS batches, marks it remotely complete only after acknowledgment, serializes concurrent retry triggers, and stops the whole retry pass after the first connectivity failure. Turning off `Local-only test` emits one retry signal so queued backups recover without a restart.
- Removed automatic GPS and music mirroring from active manual and automatic drives. The former five-second flush loop, remote start/pause/resume state calls, launch-time music flushing, and background-resume music flushing are gone; `Sync saved data` remains as an explicit user action while recording.
- Made dashboard, journey library/detail, Memories, Music, vehicle intelligence, and the combined primary-section model read SQLite/cache by default even when server credentials exist. Remote archive refresh is now explicit through pull-to-refresh, Data Health refresh, connection-setting actions, or detail retry. Local and cached journey metadata are reconciled so offline exact routes retain cached place labels, soundtrack previews, photos, provider state, and server enrichment.
- Coalesced automatic private-iCloud checks for 15 minutes while preserving forced user-requested sync and a forced post-completion sync. Data Health now counts queued GPS across completed local journeys until optional server backup acknowledges them.
- Real-device testing found that a locally completed journey was written to SQLite but remained invisible because the shell retained its pre-finish combined archive snapshot. Added an in-process local-archive change signal: every completed-session mirror now causes the shell to rebuild Home, Memories, Atlas, Timeline, Statistics, Search, and Music from local storage without contacting JourneyDeck. This also fixes the case where Memories preferred stale combined data over its separately refreshed journey list.
- Added Phase 2 structural/behavioral regression coverage for local-first finish ordering, immediate visible-archive invalidation, absence of active-drive mirroring, persistent remote completion, retry-storm prevention, explicit remote reads, iCloud coalescing, and local-only policy notifications. Verification passed: TypeScript; complete mobile suite 76/76; Expo Doctor 21/21; production iOS Metro export (1,445 modules, 11 assets); live Metro iOS bundle; and `git diff --check` with Windows line-ending notices only.
- Physical iPhone verification passed over Tailscale Metro: with Local-only enabled, a journey finished into the on-device archive and became visible without server access; after disabling Local-only, the deferred backup completed automatically and Recorder `GPS queued` returned to zero.
- Committed the implementation as `24a3a52` (`feat(mobile): finish journeys on device`) and pushed `agy/journeydeck-1.6`. Published the iOS-only runtime `1.7.0` preview OTA: update group `cae02fdf-9456-4ece-b538-2a7c3f946a51`, iOS update `01a0437c-ca19-74c4-82bf-e9eab3b33c37`, message `Phase 2: Finish journeys on device and defer server backup`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/cae02fdf-9456-4ece-b538-2a7c3f946a51`. No EAS native build credit, Render deployment, or production change was used.

## Server Independence Phase 1 — network boundary and measurement — August 27, 2026

- Centralized all mobile JavaScript requests to the JourneyDeck API behind one privacy-safe measured boundary. The in-memory session ledger records only static operation category/reason, method, timing, status, and byte totals; it never retains URLs, query values, tokens, request/response contents, coordinates, or personal identifiers.
- Added separate private-iCloud activity accounting and a Data Health `Network boundary` panel with JourneyDeck request count, iCloud attempts, upload/download totals, request reasons, recent outcomes, and counter reset. Native map tiles, artwork, Apple Music, Shazam, and Expo Update traffic are explicitly identified as direct provider traffic outside JourneyDeck totals.
- Added a non-persistent `Local-only test` switch in Data Health. It blocks future JourneyDeck API requests before `fetch` while leaving private iCloud and external map/media services available; existing local/offline fallbacks remain authoritative, and restarting the app clears the block.
- Added structural and behavioral coverage enforcing that `network-request.ts` is the only raw JavaScript `fetch` location, request classification redacts dynamic IDs/query data, counters remain exact beyond the bounded recent-event window, local-only mode blocks before fetch, and normal navigation models contain no direct network access.
- Verification passed: focused network-boundary tests 6/6; complete mobile suite 68/68; TypeScript; Expo Doctor 21/21; iOS production-style Metro export (1,444 modules, 11 assets); and `git diff --check` with only Windows line-ending notices.
- Published the iOS-only runtime `1.7.0` preview OTA: update group `3e506acd-d7fe-444d-88dc-3a8b6a99c008`, iOS update `01a04303-ea45-78cd-8050-049996a186ce`, message `Phase 1 server independence network boundary and measurement`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/3e506acd-d7fe-444d-88dc-3a8b6a99c008`. No native build credit was used. Nothing was committed, pushed, or deployed to Render/production. Physical follow-up: exercise normal launch/tab/detail/refresh/recording flows on the iPhone with counters reset, capture the traffic baseline, repeat with `Test without JourneyDeck server` enabled, and record the results for Phase 2.
- Physical testing exposed significant tap/navigation lag and a delayed Home return after Data Health initiated a full refresh. Root cause was Phase 1 rescanning every response body character-by-character on the JavaScript thread plus the hidden Data Health screen redrawing for every request start/finish. Restored native `response.json()` parsing, measure downloads from the server-reported `content-length`, added a fast ASCII upload-size path, batch visible diagnostics to at most five redraws per second, and unsubscribe Data Health whenever More is not active.
- Corrective verification passed: network-boundary tests 7/7; complete mobile suite 69/69; TypeScript; Expo Doctor 21/21; and iOS Metro export (1,444 modules, 11 assets). Published the corrective iOS-only runtime `1.7.0` preview OTA: update group `b9545f4b-fd05-4c4a-b24d-50f7396aa5c0`, iOS update `01a04313-e574-7df5-90ca-14e9d7ea8355`, message `Fix Phase 1 navigation lag and dashboard stalls`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/b9545f4b-fd05-4c4a-b24d-50f7396aa5c0`. No native build credit was used. Physical follow-up: verify tab responsiveness and Home return before repeating the connected/local-only baselines.
- A second physical test with Metro's monitor showed roughly 920 MB RAM while Atlas displayed 2,209 discovered places. The primary cause was Atlas mounting one React Native `Marker` view (including text and glow/shadow styling) per place, compounded by retaining all five pager pages. Replaced the markers with one clustered GeoJSON source and five native MapLibre circle/symbol layers, memoized Atlas geometry inputs, and bounded the native pager offscreen limit to one neighboring page. The recorder component remains persistently mounted in More.
- Performance verification passed: complete mobile suite 69/69; TypeScript; Expo Doctor 21/21; `git diff --check` with line-ending notices only; and iOS Metro export (1,444 modules, 11 assets). Published the iOS-only runtime `1.7.0` preview OTA: update group `d0af0ccf-feca-42db-bd33-ae4fe4c8c77f`, iOS update `01a0431b-7c41-7636-8251-d1f9406fc382`, message `Fix Atlas memory pressure and global navigation lag`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/d0af0ccf-feca-42db-bd33-ae4fe4c8c77f`. No native build credit was used. Physical follow-up: fully restart, open Atlas, wait for clusters, then compare stabilized RAM and tab/Home responsiveness against the prior ~920 MB reading before resuming baseline work.
- Real-device verification passed over private Tailscale HTTPS on 5G: the Atlas/global navigation lag was no longer apparent. With `Local-only test` enabled, an 11m16s recorder session retained all 477 GPS points on-device while 0 JourneyDeck requests escaped; diagnostics recorded 204 blocked operations (152 recorder mirror, 51 archive refresh, and one other request), 7 permitted private-iCloud attempts, and 22 KB uploaded outside JourneyDeck. The pending journey finished and synchronized automatically when local-only mode was disabled. Phase 2 should make journey finalization fully local, batch or remove high-frequency recorder mirroring, suppress redundant archive refreshes, and reduce private-iCloud sync frequency.
- Development access is available privately through Tailscale Serve at `https://superredux.tail1babbd.ts.net:8081`, proxying local Metro on port 8081. The iOS runtime `1.7.0` manifest and JavaScript bundle both returned HTTP 200 over TLS. This is tailnet-only, consumes no Expo build, and requires the Windows host, Tailscale, and Metro to remain running.

## JourneyDeck 1.7 Git consolidation — August 26, 2026

- Consolidated all intended Phase 1–7, Apple Sign-In, private CloudKit, exact-route mapping/replay, local-first archive, vehicle intelligence, and server-enrichment changes in feature commit `ec4edc6` (`feat(mobile): complete JourneyDeck 1.7 local-first experience`). No generated validation output or credentials were included.
- Synchronized the branch with current `origin/main` in merge commit `46f050f`. The four Tessie-route conflicts were duplicate cherry-picks of the same earlier fix; resolution preserved the JourneyDeck 1.7 versions, which are strict supersets carrying timestamp, speed, heading, battery, and complete route-point data.
- Pushed `agy/journeydeck-1.6` and opened PR [#132](https://github.com/drumpat01/DriveOS/pull/132) targeting `main`. Use the PR as the authoritative final merge/check status.
- Post-merge-resolution verification passed: mobile TypeScript and 62/62 tests; server TypeScript, lint, and 31/31 tests. The immediately preceding complete validation also passed Expo Doctor 21/21, iOS export, Atlas benchmark, Playwright 9/9, PowerShell analysis, gitleaks, and Trivy with zero HIGH/CRITICAL findings. No Expo/EAS native build was started.

## Phase 6 — Home overview — August 26, 2026

- Upgraded the cinematic native Home screen from the older dashboard-only payload to the completed per-user Phase 2 cache. Home now summarizes Journey, Memory, Collection, Place, Music, Atlas, Timeline, Statistics, vehicle, charging, recorder, and Data Health state without adding a network endpoint or background request.
- Added on-device archive counters; latest Memory spotlight; locally ranked road soundtrack; favorite recurring route/top-place pattern; road score and 30-day charging snapshot; and an Explore section linking directly to Timeline, Atlas, Statistics, Search, Music, Memories, Collections/Journeys, Live, recorder, and Settings. The hero status pill now opens Live.
- Added `home-summary.ts`, a pure local aggregation layer with no server or connection imports, plus focused aggregation and structural navigation regression coverage.
- Verification passed: mobile TypeScript; 62/62 mobile tests; Expo Doctor 21/21; iOS Metro export (1,442 modules, 11 assets); full root validation including 31/31 server tests, Atlas benchmark, Playwright 9/9, PowerShell analysis, gitleaks, and Trivy with zero HIGH/CRITICAL findings; `git diff --check` had only Windows line-ending notices.
- Published the iOS-only runtime `1.7.0` preview OTA: update group `e7ac8488-ff84-4dcd-a60b-b4e150242437`, iOS update `01a0415a-60b3-753d-aa30-42a6f48ff3cb`, message `Phase 6: Add complete local-first Home overview`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/e7ac8488-ff84-4dcd-a60b-b4e150242437`. No native build credit was used. No Render/production deployment, staging, commit, push, revert, or discard was performed. Physical follow-up: review Home card spacing, the four archive counters, both spotlights, road pattern/intelligence, Explore links, and Live status navigation.

## Phases 3, 4, and 7 — Journey Library, Memories, and Music — August 26, 2026

- Added a three-section native Memories workspace: Journey Library, Memories, and Collections. Journey Library searches the cached archive across routes, vehicles, providers, and soundtrack metadata; filters by music, distance, and easy pace; sorts by date/distance/time; derives recurring favorite routes on-device; opens details; and assigns a journey to a Collection with an on-device-first quick picker.
- Preserved the existing native Memory/Collection editors, photos, covers, story/detail views, share cards, and two-Collection Memory rule. Added independent Memory/Collection search and Collection overview maps assembled from cached recorded routes, plus locally calculated miles and soundtrack totals.
- Expanded Music with a searchable listening history tied to each Journey and location pair, direct Journey navigation, existing Apple Music/Spotify deep links, and on-device top-track rankings. All archive indexing and ranking runs locally from the Phase 2 cache.
- Made Collection and Memory saves genuinely local-first: edits write to the active user's SQLite store and cache immediately, work without a server connection, and opportunistically mirror to the legacy server. Catalog reconciliation chooses the newest per-record version while preserving cached photos. SQLite dirty flags remain available to private CloudKit sync.
- Added pure model tests for library search/filter/sort, recurring routes, journey-linked music search, and play ranking. Verification passed: mobile TypeScript; 60/60 mobile tests; Expo Doctor 21/21; iOS Metro export (1,441 modules, 11 assets); full root validation including 31/31 server tests, Atlas benchmark, Playwright 9/9, PowerShell analysis, gitleaks, and Trivy with zero HIGH/CRITICAL findings; `git diff --check` had only Windows line-ending notices.
- Published the iOS-only `preview` OTA for runtime `1.7.0`: update group `cda03b0e-cc8d-4b6f-9529-0d0e374e8982`, iOS update `01a04151-201b-71ab-a05a-c728d677fdcc`, message `Phases 3 4 7: Add journey library memories and music archive`; dashboard `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/cda03b0e-cc8d-4b6f-9529-0d0e374e8982`. No native build credit was used. No Render/production deployment, staging, commit, push, revert, or discard was performed. Physical follow-up: verify all three section tabs, offline Collection/Memory edits, quick assignment, Collection maps, listening search, track deep links, and Journey navigation.

## Phase 2 primary iOS sections — August 26, 2026

- Replaced the five-tab iOS shell with `Home`, `Live`, `Memories`, `Atlas`, and `More`. `More` contains global Search, Timeline, Statistics, Music, Record, Data Health, and Settings; Record remains directly reachable from Home and Live. The recorder stays mounted while navigating so an active capture is not interrupted.
- Added Live from on-device SQLite: current recorder/driving state, speed, active route, distance/time/GPS counts, live-captured soundtrack, upload queue, last archived battery, and an honest unavailable state for live range/current provider battery. It polls only the local database while visible.
- Added Atlas with the shared JourneyDeck dark-violet OpenFreeMap theme, cached recorded routes, frequently visited places, place details and related drives, representative routes, recurring-route cards, and user-scoped on-device confirm/dismiss decisions.
- Added a combined Timeline for journeys, soundtrack plays, charging sessions, and vehicle/battery summaries, with a real recorded-route map for each selected day. Added Statistics with an explicitly non-safety driving score, current/prior 30-day comparisons, miles/energy/efficiency, trend chart, streaks, highlights, and monthly archive. Added global local search across journeys, songs, artists, places, Collections, and Memories.
- Added Data Health with local recorder status, queued GPS/music counts, connection freshness, Apple identity, private iCloud state, provider statuses, and non-destructive refresh/iCloud retry actions. Raw route coordinates and sensitive place data remain on-device.
- Added a per-user Phase 2 SQLite cache. Normal launches rebuild the views from the saved cache and current local recorder state; only a first load or explicit pull-to-refresh performs the broader archive refresh. Recent Journey detail caches seed route/energy/song enrichment, keeping routine server traffic low.
- Verification passed: mobile TypeScript; 57/57 mobile tests (including Phase 2 navigation, surface, map, and local-first assertions); Expo Doctor 21/21; iOS Metro export (1,440 modules, 11 assets); root server typecheck/lint; 31/31 server tests; Atlas benchmark; Playwright 9/9; PSScriptAnalyzer; gitleaks; Trivy with zero HIGH/CRITICAL findings; and `git diff --check` with only Windows line-ending notices.
- Published the corrected final iOS-only preview OTA for runtime `1.7.0`: update group `fcbef705-82d9-4e1a-b909-6bad26c82d2e`, iOS update `01a04142-782a-7fdd-8eb6-e64c6394a65b`, message `Fix Phase 2 route glyph rendering`. It supersedes the earlier Phase 2 previews and includes parked last-location mapping, fully local recurring-route derivation, and the React Native fix that renders the representative-route glyph inside `<Text>` instead of directly inside `<View>`. TypeScript, all 57 mobile tests, and an AST scan for raw Phase 2 JSX text passed before publication. EAS dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/fcbef705-82d9-4e1a-b909-6bad26c82d2e`. No EAS build credit was used.
- Environment remains branch `agy/journeydeck-1.6` at HEAD `69f2c61` with the preserved dirty Phase 1/Phase 5/Apple/CloudKit work plus these Phase 2 mobile changes. Nothing was staged, committed, pushed, reverted, or deployed to Render/production.
- Physical follow-up: restart the installed 1.7 development client after it checks for updates, then verify all five tabs, open each More section, start/finish a short recorder session from Live/More, confirm the live route and soundtrack update, inspect a Timeline day and Atlas route, run a search, and exercise the safe Data Health retries. Live range and truly current vehicle-provider battery remain unavailable until a future authenticated live vehicle transport is added; the UI labels the last archived battery rather than fabricating live data.

## Phase 5 vehicle, charging, and place intelligence — August 26, 2026

- Added a Settings-launched native `Drive intelligence` screen without changing the five primary tabs. Its Overview, Charging, Places, and Routes sections cover charging history, 30-day energy/battery/time/cost totals, editable electricity rates, favorite charging locations, complete saved places, Home/Work/School/Favorite/Custom categories, duplicate merge suggestions, cached Foursquare naming suggestions, visit/arrival/departure counts, related journeys, place soundtracks, time-of-day patterns, and route-level Wh/mi/energy/cost comparisons.
- Added user-scoped SQLite app caching with offline saved-place fallback and a durable dirty-preference retry. The iPhone keeps the most recent intelligence view and local edits; no new paid service or native dependency was added. The private bearer endpoint reads existing canonical Tessie charging, journey energy, soundtrack, place alias, and Foursquare cache data and stores only bounded household preferences—rate, favorites, place overrides, and merge mappings.
- Verification passed: mobile TypeScript, 55/55 mobile tests, Expo Doctor 21/21, iOS Metro export (1,437 modules, 11 assets), server typecheck/lint, 31/31 server tests, Atlas benchmark, Playwright 9/9, PSScriptAnalyzer, gitleaks, Trivy with zero HIGH/CRITICAL findings, and `git diff --check` with only Windows line-ending notices.
- Published iOS preview OTA for runtime `1.7.0`: update group `d8809207-741a-4ff5-abf7-41a9ad46a7dd`, iOS update `01a04121-59b4-7c7e-a58c-71b5aa1d569b`, message `Phase 5: Add charging places and route intelligence`. EAS confirms it is the current `preview` branch head: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/d8809207-741a-4ff5-abf7-41a9ad46a7dd`. No EAS build was used.
- Backend status: the new authenticated vehicle-intelligence endpoint and its tests are implemented in the dirty working tree but were not deployed to Render or committed/pushed. The published client therefore opens with its on-device saved-place fallback against the current live server; complete Tessie charging/energy/Foursquare enrichment becomes available after the server changes are separately reviewed and deployed.

## Phase 1 web-parity journey map and replay — August 26, 2026

- Added a dedicated `Route + song locations` experience to iOS Journey detail. The MapLibre map now uses the same OpenFreeMap dark-violet layer palette and exact coral route glow values as the web app, plus numbered song markers, start/end markers, popups, located-song status, legend, attribution, recenter/zoom controls, and a cached static-map fallback.
- Linked the map and soundtrack list bidirectionally: tapping a numbered marker selects its soundtrack row, and tapping a soundtrack row highlights/focuses the matching marker.
- Added on-device nearby-music search for a tapped coordinate with 0.5/1/2/5-mile radii. The distance calculation and matching run locally; map privacy copy explains that only OpenFreeMap basemap tiles are supplied externally.
- Added Journey Replay with a moving directional marker, draggable scrubber, play/pause/restart, 1x/4x/12x speeds, current-song artwork/details, speed, battery, and progress. Older coordinate-only journeys receive explicit geometry-based estimates; exact recorder/Tessie telemetry is preferred when available.
- Preserved recorder GPS timestamps, speed, and heading in local Journey detail. Extended the existing private server Journey response and Tessie historical-state normalization to carry timestamps, speed, heading, and battery without changing the old route-coordinate contract. This server enrichment is implemented and tested locally but is not live until the server is deployed.
- Verification: mobile TypeScript passed; all 52 mobile tests passed; iOS Metro export passed (1,436 modules, 11 assets); server typecheck/lint passed; all 31 server tests passed; and `git diff --check` passed with only Windows line-ending notices. No EAS build, server deploy, commit, or push was performed.
- Published the iOS preview OTA for runtime `1.7.0`: update group `48167547-310d-4f7c-b84e-60948c251a83`, iOS update `01a04106-c344-7a8c-abd4-6c090876c277`, message `Phase 1: Theme journey maps and add replay`. EAS confirms it is the current `preview` branch head: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/48167547-310d-4f7c-b84e-60948c251a83`.
- Current state: Phase 1 is live for the installed 1.7 development client after its next update check/restart. Deploying the server afterward enables exact Tessie battery/speed/heading replay data; until then, replay uses the saved route and Journey summary estimates.

## Exact Journey routes and soundtrack map markers — August 26, 2026

- Fixed the 1.7 interactive journey map so MapLibre receives every available recorded GPS coordinate instead of the 96-point SVG fallback sample. The fallback remains sampled for rendering efficiency.
- Added pink soundtrack markers. Newly recorded/local journeys match each song timestamp to the closest actual on-device GPS breadcrumb; older server-only journeys fall back to time-proportional placement along the ordered route.
- Completed the previously missing local Journey detail wiring: route breadcrumbs and soundtrack entries now load from the on-device SQLite master store, and a server-loaded journey merges with its matching local copy by remote drive ID so the exact local route remains authoritative.
- Added server enrichment for both sources: recorder journeys attach the nearest timestamped recorder coordinate to each soundtrack track, while historical Tessie journeys privately fetch the vehicle's one-second historical states for the drive window, return the real route, and match each song to its nearest actual vehicle state. The Tessie token remains server-only.
- Verification: mobile TypeScript passed; all 47 mobile tests passed; iOS production Metro export passed (1,435 modules, 11 assets). Full root validation passed: server typecheck/lint, 31/31 server tests (including Tessie route normalization and mobile integration), Atlas benchmark, Playwright 9/9, PSScriptAnalyzer, gitleaks, and Trivy with zero HIGH/CRITICAL findings. `git diff --check` reported only existing Windows line-ending notices. The running 1.7 development-client Metro session hot-reloaded the mobile fix successfully with no runtime error. No EAS build and no OTA publish were used.
- Production deployment completed through PR [#131](https://github.com/drumpat01/DriveOS/pull/131), merged as `9f9d6fd`, and Render deploy `dep-da7omrflk1mc738aq4sg` is live on `driveos`. GitHub validation passed, Render reports no post-startup error logs, and `https://journeydeck.me/readyz` returned HTTP 200 with Atlas and legacy compatibility ready.
- Deployment initially encountered the intended 45-minute Tessie cursor freshness gate because GitHub's scheduled history sync had been delayed. Manual workflow run `33028629632` refreshed the Turso cursors successfully; its optional soundtrack call received a transient 502 during Render handover. Dedicated Spotify/soundtrack workflow run `33028686681` was then dispatched after production became healthy and passed.
- Physical finding from screenshots: existing Tessie journeys previously received exactly two endpoint coordinates from the live server, producing a diagonal and evenly spaced fallback markers. Reopen the same journeys in the installed 1.7 app and confirm the line now follows the driven streets and song dots match actual playback locations. Local iPhone-recorded journeys are already exact.

## Real Sign in with Apple + private CloudKit transport — August 26, 2026

- Implemented native Sign in with Apple through `expo-apple-authentication`, including Apple's official button, request-state validation, credential-state/revocation checks, and on-device linking to the active local profile. Apple identity/authorization credentials are never sent to JourneyDeck's server; a missing repeat-return name does not overwrite the existing local display name.
- Added the auto-linked `JourneyDeckCloudKit` Expo Swift module for `iCloud.com.journeydeck.recorder`. It checks iCloud account availability, creates a custom private record zone, uploads with change-tag race protection, downloads incrementally with persisted CloudKit change tokens, and recovers from expired tokens.
- Added the production transport orchestration and UI: automatic sync at app start/foreground and after completed journey/music capture, plus a manual Settings action. Apple-linked devices derive the same zone from a SHA-256 hash of the stable Apple subject; anonymous local profiles remain isolated. Journey summaries, music entries, collections, and memories sync bidirectionally with LWW handling and bounded batches.
- Privacy boundary: raw GPS breadcrumbs, exact journey endpoints, Home/Work coordinates, local user IDs, Apple tokens/codes, and device-local photo paths never enter CloudKit payloads. The Settings copy distinguishes Apple identity from the separate device iCloud account and does not claim end-to-end encryption.
- Version/native boundary remains `1.7.0`. Added `expo-apple-authentication`, `usesAppleSignIn`, and the config plugin; the existing CloudKit/Apple entitlements remain enabled. No EAS build and no OTA were started.
- Verification: `npm test` 44/44, TypeScript clean, Expo Doctor 21/21, effective Expo config clean, Expo autolinking finds `journeydeck-cloudkit` and `expo-apple-authentication`, iOS Metro export passed (1,434 modules, 11 assets), and `git diff --check` has only Windows line-ending notices. Windows cannot compile Swift; the first carefully conserved 1.7 iOS build must verify Swift/CocoaPods, Apple capability signing, real Apple sign-in, iCloud account states, two-device sync, and then create/deploy the CloudKit production schema before public distribution.

### JourneyDeck 1.7 development build — successful

- The initial EAS attempt `4d74cd30-682b-463c-bfd7-082f4aa5a26d` fast-failed in under three minutes because the existing Ad Hoc profile predated the Apple Sign-In/iCloud entitlements. Apple authentication regenerated that profile with Developer Portal ID `9735474KU8` for the registered iPhone; Expo's fast-failure policy should waive this attempt (subject to the account's monthly waiver limit).
- The repaired consolidated development build **finished successfully**: build ID `f2ba64c5-061e-457b-a922-d7c690b93071`, JourneyDeck/runtime `1.7.0`, build number `3`, profile `development`, channel `preview`, fingerprint `8d2b498dc9cafd7cb82b50def2fc75d1353477b2`.
- Installable IPA: `https://expo.dev/artifacts/eas/ADv_Jxvp-qmofHFUjUx58kUlNkOmgoJh9RsMIOhoYIM.ipa`; dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/f2ba64c5-061e-457b-a922-d7c690b93071`. Next: install over 1.6 without deleting the app, then physically verify launch/local-data preservation, interactive mapping, Apple sign-in, iCloud unavailable/available states, manual sync, and CloudKit round-trip before publishing any 1.7 OTA.

## Interactive mapping native-foundation work — August 26, 2026

- Added MapLibre React Native 11.3.7 and its Expo config plugin, using the no-key OpenFreeMap Liberty vector style. Journey detail routes now open as interactive pan/zoom maps by default, with the existing cached OpenStreetMap snapshot retained as the load/error fallback.
- Advanced the app/runtime version from 1.6.0 to 1.7.0 so MapLibre JavaScript cannot be delivered to older binaries that do not contain the native module. Aligned Expo SDK 57 packages to Expo Doctor's current compatible patch versions.
- Verification passed without spending an EAS build: mobile TypeScript, all 14 mobile test scripts, Expo Doctor 21/21, Expo prebuild config resolution (including MapLibre 11.3.7), and production iOS Metro export (1,424 modules, 11 assets). Windows cannot generate the iOS Podfile, so the plugin's CocoaPods hook remains a first-build verification item.
- No OTA was published and no EAS build was started. The working tree contains the mapping/native-foundation changes and should remain on runtime 1.7.0 for the next native build.

## Codex validation and architecture hardening — August 26, 2026

- **Objective:** Run the complete JourneyDeck validation stack and fix failures plus the privacy, sync, isolation, and runtime-wiring defects found during review of `2515a44`.
- **Changes:**
  - CloudKit journey summaries no longer include exact endpoint coordinates or local profile IDs. Remote ingestion now scopes records to the active profile, applies LWW conflict resolution, preserves local-only coordinates, and leaves downloaded winners acknowledged.
  - Local-store ID upserts and sync acknowledgements enforce `user_id` ownership. Active profile selection is persisted with additive SQLite migration 2.
  - Completed recorder sessions now mirror journey summaries, raw GPS breadcrumbs, and soundtrack observations into the master local SQLite store. Offline dashboard, journeys, detail, Memories, and Music reads now use `localAtlasClient` before legacy caches.
  - Cloudflare credential routes now reject unapproved browser origins and return an exact allowlisted CORS origin; production origins are declared in `wrangler.toml`.
  - Added regression assertions covering coordinate exclusion, LWW use, profile ownership, recorder-to-master-store ingest, live offline fallback, profile persistence, and CORS fail-closed behavior.
- **Verification:**
  - All 15 mobile checks passed, including TypeScript, tab runtime, local store/Atlas/privacy/CloudKit/Cloudflare/auth, recovery, sync status, music, drive detection, navigation motion, and native capabilities.
  - Expo Doctor passed 21/21; production iOS Metro export passed with 1,349 modules and 8 assets.
  - Root `npm test` passed after creating the documented Atlas development seed fixture: server typecheck/lint, 29 server tests, Atlas benchmark, 9 Playwright tests, PSScriptAnalyzer (136 files), gitleaks, and Trivy (0 HIGH/CRITICAL findings).
  - `tools/Test-DriveOS.ps1` and `tools/Test-ReleasePreflight.ps1` passed. Their SQLite-provider/migration/durable-round-trip checks were explicitly skipped because the desktop SQLite runtime is unavailable in this environment; all other available checks passed.
  - `git diff --check` passed with only Windows LF-to-CRLF notices.
- **Published Preview OTA:**
  - Source commit: `8792596` (`fix(mobile): harden local-first sync and offline data`), pushed to `origin/agy/journeydeck-1.6`.
  - Update group ID: **`c1b8422c-bbfa-4eff-a368-4bafe18528a1`**
  - iOS update ID: **`01a03f9d-0570-7e68-a7d0-66ff4436c463`**
  - Message: `Harden local-first privacy sync and offline data`
  - Runtime/channel: `1.6.0` / `preview`; Expo reports a clean Git working tree for the published update.
  - Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/c1b8422c-bbfa-4eff-a368-4bafe18528a1`
- **Environment:** Branch `agy/journeydeck-1.6`; Cloudflare worker source changes are committed but were not deployed as part of the iOS OTA.
- **Next steps:** Review the working-tree diff and physically verify a completed offline recording appears in Home/Memories/Music after relaunch and profile switching. A real CloudKit transport adapter is still required before remote synchronization can run on-device; `CloudKitSyncEngine` currently provides safe payload/conflict logic only.

- **Active Branch**: `agy/journeydeck-1.6` (Synced to remote `origin/agy/journeydeck-1.6`)
- **Authoritative Commit**: [`2515a44`](https://github.com/drumpat01/DriveOS/commit/2515a44) (`feat(arch): implement zero-cost local-first multi-user architecture with SQLite, CloudKit sync, and Cloudflare edge`)
- **Live Cloudflare Edge**: `https://journeydeck-edge.patrickbstewart.workers.dev` (Deployed on Free Tier)
- **Live Mobile Preview OTA**: Update Group `289d6cbb-2191-43a3-83a5-187cd319c218` (Runtime `1.6.0`)
- **Apple Developer Setup**: CloudKit container `iCloud.com.journeydeck.recorder` and Sign in with Apple enabled on App ID `com.journeydeck.recorder`.
- **Validation**: All 14 test suites passing (`100%`), `tsc --noEmit` 0 errors, Metro export clean.

## Phase 4 & 5: Driver Profile, Private iCloud Badge, Pro Membership & Entitlements — August 26, 2026

- **Objective:** Finalize user-facing settings for Apple ID driver profile, private iCloud sync status badge, JourneyDeck Pro $4.99/mo membership card, home/work safe zones, and Apple Sign-In / CloudKit iOS entitlements.
- **Branch:** `agy/journeydeck-1.6` (working tree)
- **Changes Implemented:**
  - `mobile/recorder/app.json` — Configured iOS capabilities (`com.apple.developer.applesignin`, `com.apple.developer.icloud-container-identifiers`, `com.apple.developer.icloud-services`).
  - `mobile/recorder/src/shell.tsx` — Added Driver Profile tile, Private iCloud encryption badge, JourneyDeck Pro membership tile, and Home/Work Safe Zone indicator to Settings screen.
  - `mobile/recorder/src/auth.ts` — Multi-user profile management with `listLocalUsers` export.
- **Verification Results:**
  - `npm run typecheck`: ✅ 0 errors
  - `npm run test:tab-runtime`: ✅ 9/9 passed
  - All 14 unit test suites: ✅ 100% passed
  - `npx expo export --platform ios`: ✅ 1349 modules bundled
  - `git diff --check`: ✅ clean
- **Published Preview OTA:**
  - Update group ID: **`289d6cbb-2191-43a3-83a5-187cd319c218`**
  - iOS update ID: **`01a03f5d-1bd4-7792-997c-3083566f253e`**
  - Message: `Phase 4+5: Driver profile, private iCloud badge, Pro membership card, iOS entitlements`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/289d6cbb-2191-43a3-83a5-187cd319c218`

## Phase 2, 3 & 4: CloudKit Sync, Cloudflare Serverless Edge, Multi-User Auth — August 26, 2026

- **Objective:** Implement the remaining serverless edge infrastructure (Cloudflare Workers), CloudKit sync engine, and multi-user Apple Sign-In identity management.
- **Branch:** `agy/journeydeck-1.6` (working tree)
- **New Files Created:**
  - `cloudflare/workers/oauth-spotify.ts` — Stateless PKCE Spotify OAuth token exchange & refresh broker. Zero server state.
  - `cloudflare/workers/oauth-tessie.ts` — Stateless Tessie token verification broker.
  - `cloudflare/workers/places-lookup.ts` — Privacy-preserving Nominatim reverse geocoding proxy with 3-decimal fuzzed coordinates (~110m grid) and 24-hour edge caching.
  - `cloudflare/workers/index.ts` — Unified Cloudflare edge router with full CORS and healthcheck endpoints.
  - `cloudflare/wrangler.toml` — Deployed live to Cloudflare Workers free tier: `https://journeydeck-edge.patrickbstewart.workers.dev`
    - `/readyz` → Healthy (200 OK)
    - `/api/places/reverse` → Privacy geocoding verified (3-decimal fuzzed grid + edge cached)
    - `/api/auth/spotify/token` → Stateless PKCE broker ready
    - `/api/auth/tessie/verify` → Tessie validator ready
  - `mobile/recorder/src/cloudkit-sync.ts` — CloudKit synchronization engine with CKRecord serialization, queue management, and deterministic Last-Write-Wins (LWW) conflict resolution.
  - `mobile/recorder/src/auth.ts` — Multi-user profile management, Sign in with Apple credential handler, and local user switching.
  - `mobile/recorder/tests/cloudflare-workers.test.mts` — 100% passed.
  - `mobile/recorder/tests/cloudkit-sync.test.mts` — 100% passed.
  - `mobile/recorder/tests/auth.test.mts` — 100% passed.
- **Verification Results:**
  - `npm run typecheck`: ✅ 0 errors
  - `npm run test:cloudflare-workers`: ✅ passed
  - `npm run test:cloudkit-sync`: ✅ passed
  - `npm run test:auth`: ✅ passed
  - All 11 other unit tests: ✅ 100% passed
- **Published Preview OTA:**
  - Update group ID: **`2dbc7032-f84e-4a9a-b7be-15d21f8fe157`**
  - iOS update ID: **`01a03f55-c5ab-7013-a263-cfdecc0f6eb3`**
  - Message: `Phase 2+3+4: CloudKit sync engine, Cloudflare serverless edge, Apple multi-user auth`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/2dbc7032-f84e-4a9a-b7be-15d21f8fe157`

## Phase 1: On-Device Master SQLite Store, Privacy Masker & Atlas Engine — August 26, 2026

- **Objective:** Build the complete Local-First SQLite foundation and privacy layer for the zero-cost multi-user architecture. All journey history, music, places, collections, memories, coordinate masking, and analytics live on-device in `journeydeck-local.db`.
- **Branch:** `agy/journeydeck-1.6` (working tree changes ready)
- **New Files Created:**
  - `mobile/recorder/src/local-store.ts` — On-device master SQLite store (8 tables, multi-user isolation, additive `user_version` migration system, CloudKit sync queue).
  - `mobile/recorder/src/local-atlas.ts` — On-device Atlas Analytics Engine (weekly tour, rolling 7-day, driving streak, top artists, 5-bucket mood breakdown, `rebuildAtlasSnapshot()`).
  - `mobile/recorder/src/privacy-masker.ts` — On-device coordinate scrubbing and geofence masking (≥300m safe buffer for home/work, Haversine spherical math, deterministic route & label sanitization for share cards).
  - `mobile/recorder/tests/local-store.test.mts` — 15/15 structural assertions passed.
  - `mobile/recorder/tests/local-atlas.test.mts` — 12/12 structural assertions passed.
  - `mobile/recorder/tests/privacy-masker.test.mts` — Structural and mathematical assertions passed.
  - `mobile/recorder/tests/local-atlas-client.test.mts` — 10/10 check groups passed.
- **Modified Files:**
  - `mobile/recorder/src/app-data.ts` — Added `localAtlasClient` export for 100% offline-first synchronous dashboard and catalog reads from on-device SQLite.
  - `mobile/recorder/package.json` — Added all 4 new test scripts.
- **Verification Results:**
  - `npm run typecheck`: ✅ 0 errors
  - `npm run test:local-store`: ✅ 15/15 passed
  - `npm run test:local-atlas`: ✅ 12/12 passed
  - `npm run test:privacy-masker`: ✅ passed
  - `npm run test:local-atlas-client`: ✅ 10/10 passed
  - All 7 existing test suites: ✅ 100% pass
  - `npx expo export --platform ios`: ✅ 8 assets, 1348 modules bundled cleanly
  - `git diff --check`: ✅ clean
- **Published Preview OTA:**
  - Update group ID: **`d7c4d618-bfd5-444d-a1ab-c39b83fa0b17`**
  - iOS update ID: **`01a03f50-8d6e-7f88-b7e6-a1bff348a788`**
  - Message: `Phase 1.2+1.4: On-device privacy masker, local Atlas client (full offline dashboard)`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/d7c4d618-bfd5-444d-a1ab-c39b83fa0b17`

## Next Steps (Phase 1 Remaining + Phase 2)

1. **Phase 1.2 — Privacy Masker** (`src/privacy-masker.ts`): On-device coordinate fuzzing function that accepts a coordinate and a set of sensitive places, returns a scrubbed safe point if within a place's `radius_meters`. Used before any export, share card, or CloudKit sync.
2. **Phase 1.4 — Local Atlas Client in app-data.ts**: Add `localAtlasClient` that reads from `local-store.ts` for the dashboard when offline or when the user has no server connection configured.
3. **Phase 2 — CloudKit Sync** (`src/cloudkit-sync.ts`): Implement bidirectional CloudKit sync using `journeysPendingSync()` + `markJourneysSynced()` from local-store. Only lightweight journey summaries sync to iCloud; raw GPS breadcrumbs and sensitive home/work coordinates stay local.
4. **Phase 3 — Cloudflare Workers**: Stateless OAuth broker for Spotify + Tesla, static SPA hosting, Nominatim geocoding proxy.

## Zero-Cost Multi-User Local-First Architecture Plan — August 26, 2026


- **Objective:** Plan and architect the multi-user transition for JourneyDeck using a zero-cost local-first foundation with on-device SQLite, Apple CloudKit sync, and Cloudflare Workers/Pages edge brokers.
- **Architectural Deliverables:**
  - Designed [`implementation_plan.md`](file:///C:/Users/patri/.gemini/antigravity/brain/d4a22efe-2dc2-4ccc-8e37-49476481f16d/implementation_plan.md) with complete system diagrams, key invariants, and 5 execution phases:
    1. *Phase 1: Local-First Core & On-Device Storage Engine* (elevating SQLite on iOS as primary master store).
    2. *Phase 2: Apple CloudKit Sync & iCloud Backup* (private E2EE sync at $0 developer cost).
    3. *Phase 3: Cloudflare Serverless Edge* (stateless OAuth brokers for Spotify/Tesla + static SPA on Pages).
    4. *Phase 4: Multi-User Onboarding Flow* (Sign in with Apple, vehicle/music selection, privacy geofences).
    5. *Phase 5: App Store Readiness & Release* (privacy disclosures, StoreKit subscriptions, TestFlight beta).
- **Cost Scaling Analysis:**
  - 0 to 1,000 active users: **$0.00 / month** running costs (100% free-tier serverless/CloudKit).
  - 1,000+ active users: ~$29/mo (EAS update threshold, easily funded by subscription revenue).

## Full-Bleed Music & Memories Header Artwork Assets — August 26, 2026

- **Objective:** Implement full-bleed cropped artwork headers for both Music and Memories tabs in the exact same cohesive cinematic style, removing all old paragraph/eyebrow text overlays.
- **Changes Implemented:**
  - **Music Header Artwork (`mobile/recorder/assets/music-header-hero.png`):**
    - High-resolution cropped image asset (1270x674) featuring the bold white "MUSIC" title, glowing multi-lane neon soundwaves (magenta, cyan, coral), vinyl echo grooves, and floating acoustic bokeh particles.
    - Rendered inside `musicHeaderStyles.heroCardHeader` (`aspectRatio: 1270 / 674`, `borderRadius: 24`, `overflow: 'hidden'`, outer neon glow shadow `#ff4594`).
  - **Memories Header Artwork (`mobile/recorder/assets/memories-header-hero.png`):**
    - High-resolution cropped image asset (673x331) featuring the bold white "MEMORIES" title, multi-lane neon highway ribbons, moon, stars, and waypoint beacons.
    - Rendered inside `styles.memoryHeroCardHeader` (`aspectRatio: 673 / 331`, `borderRadius: 24`, `overflow: 'hidden'`, outer neon glow shadow `#9b61ff`).
  - **Animated Spinning Vinyl Record (`VinylHeroRecord` in `mobile/recorder/src/music-screen.tsx`):**
    - Smooth continuous 22s slow rotation on native Core Animation thread with 14 micro-grooves, 4-quadrant specular sheens, and rotating album label.
- **Verification Results on `agy/journeydeck-1.6`:**
  - `npm run typecheck`: passed (0 errors)
  - `npm run test:tab-runtime`: 9/9 passed
  - `npm run test:navigation-motion`: 4/4 passed
  - `npm run test:recovery`: 10/10 passed
  - `npm run test:sync-status`: 4/4 passed
  - `npm run test:music-observations`: 7/7 passed
  - `npm run test:drive-detection`: 9/9 passed
  - `npm run test:native-capabilities`: 2/2 passed
  - `npx expo-doctor`: 21/21 checks passed
  - `npx expo export --platform ios`: passed (8 assets bundled including `music-header-hero.png` and `memories-header-hero.png`, 1 iOS JS bundle, React Compiler active)
  - `git diff --check`: passed cleanly
- **Published Preview OTA:**
  - Update group ID: **`3e8ae4e1-5a09-401c-943e-620d410b06d4`**
  - iOS update ID: **`01a03edf-9ec5-7e73-95f4-cd5a06f5a6af`**
  - Message: `Add full-bleed cropped Music header artwork`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/3e8ae4e1-5a09-401c-943e-620d410b06d4`

## Cropped Edge-to-Edge Memories Header Image & Spinning Vinyl Record — August 26, 2026

- **Objective:** Crop out the exterior margin behind the neon rounded rectangle and size the Memories header card to fill the screen width edge-to-edge.
- **Changes Implemented:**
  - **Cropped High-Res Asset (`mobile/recorder/assets/memories-header-hero.png`):**
    - Updated image asset to the exact cropped artwork (673x331, aspect ratio 2.033) where the glowing neon rounded border extends right to the edges of the file.
  - **Layout & Container Sizing (`mobile/recorder/src/shell.tsx`):**
    - Updated `styles.memoryPageHeader` to `marginHorizontal: 16` and `memoryHeroCardHeader` to `aspectRatio: 673 / 331`, `borderRadius: 24`, `overflow: 'hidden'`, and enhanced outer glow shadow (`shadowColor: '#9b61ff'`, `shadowOpacity: 0.45`, `shadowRadius: 24`).
- **Verification Results on `agy/journeydeck-1.6`:**
  - `npm run typecheck`: passed (0 errors)
  - `npm run test:tab-runtime`: 9/9 passed
  - `npm run test:navigation-motion`: 4/4 passed
  - `npm run test:recovery`: 10/10 passed
  - `npm run test:sync-status`: 4/4 passed
  - `npm run test:music-observations`: 7/7 passed
  - `npm run test:drive-detection`: 9/9 passed
  - `npm run test:native-capabilities`: 2/2 passed
  - `npx expo-doctor`: 21/21 checks passed
  - `npx expo export --platform ios`: passed (7 assets bundled, 1 iOS JS bundle, React Compiler active)
  - `git diff --check`: passed cleanly
- **Published Preview OTA:**
  - Update group ID: **`94554d20-a9e3-491a-b06e-0dc25fb193be`**
  - iOS update ID: **`01a03ec6-6400-7aaa-8282-658ff6942fd0`**
  - Message: `Update Memories header with cropped edge-to-edge neon artwork`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/94554d20-a9e3-491a-b06e-0dc25fb193be`

## Full-Bleed Memories Header Image Asset & Spinning Vinyl Record — August 26, 2026

- **Objective:** Replace the entire red-circled Memories header card with the high-resolution image asset (`assets/memories-header-hero.png`), removing all standard text overlays so the header is 100% the clean, high-res artwork image.
- **Changes Implemented:**
  - **Bundled Image Asset (`mobile/recorder/assets/memories-header-hero.png`):**
    - Saved the high-resolution Memories header artwork featuring the clean modern "MEMORIES" title, glowing multi-lane neon highway ribbon (cyan, magenta, coral), starlit twilight sky with moon, topographic contours, and glowing waypoint pin markers.
  - **Memories Header Integration (`PageHeader` in `mobile/recorder/src/shell.tsx`):**
    - Updated `PageHeader` for `variant="memories"` to render `<Image source={require('../assets/memories-header-hero.png')} style={styles.memoryHeroHeaderImage} resizeMode="cover" />` inside `styles.memoryHeroCardHeader` (16:9 aspect ratio, `borderRadius: 24`, glowing border and shadow).
    - Removed old paragraph and eyebrow text from the card so the artwork displays clean and unobstructed.
  - **Animated Spinning Vinyl Record (`VinylHeroRecord` in `mobile/recorder/src/music-screen.tsx`):**
    - Smooth continuous 22s slow rotation on native Core Animation thread with 14 micro-grooves, 4-quadrant specular sheens, and rotating album label.
- **Verification Results on `agy/journeydeck-1.6`:**
  - `npm run typecheck`: passed (0 errors)
  - `npm run test:tab-runtime`: 9/9 passed
  - `npm run test:navigation-motion`: 4/4 passed
  - `npm run test:recovery`: 10/10 passed
  - `npm run test:sync-status`: 4/4 passed
  - `npm run test:music-observations`: 7/7 passed
  - `npm run test:drive-detection`: 9/9 passed
  - `npm run test:native-capabilities`: 2/2 passed
  - `npx expo-doctor`: 21/21 checks passed
  - `npx expo export --platform ios`: passed (7 assets bundled including `memories-header-hero.png`, 1 iOS JS bundle, React Compiler active)
  - `git diff --check`: passed cleanly
- **Published Preview OTA:**
  - Update group ID: **`1e20695a-2775-4763-b37f-eec8f2096164`**
  - iOS update ID: **`01a03ec0-9aa1-7cf1-b26b-61ca29b568e5`**
  - Message: `Set full-bleed Memories header artwork image`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/1e20695a-2775-4763-b37f-eec8f2096164`

## Refined Memories Header & Spinning Vinyl Record — August 26, 2026

- **Objective:** Recreate and implement the refined Memories header inspired by Mockup 1 (clean "Memories" label, multi-lane neon highway with cyan, magenta, and coral trails, moonlit mountain pass with topographic contour lines, and glowing waypoint pin markers without cluttering text labels or statistics).
- **Changes Implemented:**
  - **Refined Memories Header Scene (`PageHeaderScene variant='memories'` in `mobile/recorder/src/shell.tsx`):**
    - Multi-lane sweeping neon highway ribbon (cyan/mint `#38bdf8`, magenta/pink `#ff3f82`, coral/amber `#ff8c6d`) with wide soft underglow.
    - Luminous twilight moon (`#eaf2ff`) with lunar aura and starlit sky.
    - Topographic mountain elevation contour ribbons (`url(#topoLines)`).
    - Glowing waypoint GPS pin beacons positioned at curve apexes without text clutter.
    - Distant horizon city shimmer effect.
  - **Animated Spinning Vinyl Record (`VinylHeroRecord` in `mobile/recorder/src/music-screen.tsx`):**
    - Smooth continuous 22s slow rotation on native Core Animation thread.
    - 148pt disc body with 14 prominent micro-grooves, 4-quadrant specular sheens, and rotating album label.
- **Verification Results on `agy/journeydeck-1.6`:**
  - `npm run typecheck`: passed (0 errors)
  - `npm run test:tab-runtime`: 9/9 passed
  - `npm run test:navigation-motion`: 4/4 passed
  - `npm run test:recovery`: 10/10 passed
  - `npm run test:sync-status`: 4/4 passed
  - `npm run test:music-observations`: 7/7 passed
  - `npm run test:drive-detection`: 9/9 passed
  - `npm run test:native-capabilities`: 2/2 passed
  - `npx expo-doctor`: 21/21 checks passed
  - `npx expo export --platform ios`: passed (6 assets bundled, 1 iOS JS bundle, React Compiler active)
  - `git diff --check`: passed cleanly
- **Published Preview OTA:**
  - Update group ID: **`7ff7f820-fdb1-4a85-98a9-8c21287a147c`**
  - iOS update ID: **`01a03eb3-6d33-7f7f-a140-dac24aa99a03`**
  - Message: `Implement refined Memories header with multi-lane neon highway`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/7ff7f820-fdb1-4a85-98a9-8c21287a147c`

## Spinning Vinyl Record & Brand-New Cinematic Header Heroes — August 26, 2026

- **Objective:** Create brand-new, visually striking header hero scenes for Music, Memories, and Settings tabs, and animate the vinyl record with prominent micro-grooves and continuous slow rotation.
- **Changes Implemented:**
  - **Animated Spinning Vinyl Record (`VinylHeroRecord` in `mobile/recorder/src/music-screen.tsx`):**
    - Smooth continuous slow rotation using `Animated.loop` with `Easing.linear` (22 seconds per 360° rotation) running on the native Core Animation thread.
    - Expanded vinyl diameter to 148pt with 60pt center label and chrome-core spindle hole.
    - Enhanced groove contrast with 14 prominent concentric micro-grooves, spiral run-out track, and quad specular reflection cones at 45°, 135°, 225°, and 315° that realistically catch light as the record spins.
    - Album artwork and spindle hole rotate in exact lockstep inside the animated container.
    - Refined right-hand hero copy layout (`heroEyebrow`, `heroTitle`, `heroAccent`, `heroService`) with ample breathing room.
  - **Music Holographic Soundscape Header (`MusicHeaderScene` in `mobile/recorder/src/music-screen.tsx`):**
    - Multi-frequency neon sine waves, harmonic wave interference patterns, floating audio particle nodes, and dual-tone gradient spectrum bars.
  - **Memories Cosmic Route Odyssey Header (`PageHeaderScene variant='memories'` in `mobile/recorder/src/shell.tsx`):**
    - Sweeping perspective ribbon highway traversing a cosmic twilight horizon, topographic contour elevation ribbons, glowing waypoint milestone portal nodes with pulsing radar rings, and floating luminous constellation coordinates.
  - **Settings Orbital Telemetry Hub Header (`PageHeaderScene variant='settings'` in `mobile/recorder/src/shell.tsx`):**
    - Multi-axis gyro orbital sensor rings (`#43e6ae`, `#9b7cff`, `#ff795b`), cybernetic node interlinks, glowing telemetry target nodes with concentric halo rings, and precision HUD brackets.
- **Verification Results on `agy/journeydeck-1.6`:**
  - `npm run typecheck`: passed (0 errors)
  - `npm run test:tab-runtime`: 9/9 passed
  - `npm run test:navigation-motion`: 4/4 passed
  - `npm run test:recovery`: 10/10 passed
  - `npm run test:sync-status`: 4/4 passed
  - `npm run test:music-observations`: 7/7 passed
  - `npm run test:drive-detection`: 9/9 passed
  - `npm run test:native-capabilities`: 2/2 passed
  - `npx expo-doctor`: 21/21 checks passed
  - `npx expo export --platform ios`: passed (6 assets bundled, 1 iOS JS bundle, React Compiler active)
  - `git diff --check`: passed cleanly
- **Published Preview OTA:**
  - Update group ID: **`434f59b5-0fb2-460d-bd63-7d05a25ebcce`**
  - iOS update ID: **`01a03e86-a0cc-7f56-8036-3887f51f60c1`**
  - Message: `Add spinning vinyl record and new cinematic header heroes`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/434f59b5-0fb2-460d-bd63-7d05a25ebcce`

## Mobile Graphics Redesign & Vinyl Record Hero — August 26, 2026

- **Objective:** Redesign generic placeholder shapes/blobs across the iOS app and replace the Music hero with an authentic vinyl record disc.
- **Changes Implemented:**
  - **Vinyl Record Hero (`VinylHeroRecord` in `mobile/recorder/src/music-screen.tsx`):**
    - Built a realistic vinyl record component with an onyx vinyl disc body (`#1c0f2b` to `#050308`), 10 concentric micro-groove tracks, dashed run-out groove track, dual 45°/225° specular sheen reflection cones, a 56px center label with clipped album artwork, and central spindle hole.
  - **Dynamic Listening Time Area Chart (`IntensityChart` in `mobile/recorder/src/music-screen.tsx`):**
    - Removed the artificial rounded dome rectangle (`borderTopLeftRadius: 120`) and replaced it with a dynamic data-driven SVG gradient area fill (`#ff6c50` → `#ff3f82` → transparent) + line stroke + dashed guide lines + point dots.
  - **Acoustic Wave Visualizer (`MusicHeaderScene` in `mobile/recorder/src/music-screen.tsx`):**
    - Replaced concentric circle halos with an acoustic soundstage visualizer wave and spectrum bars.
  - **Memories Header Scene (`PageHeaderScene variant='memories'` in `mobile/recorder/src/shell.tsx`):**
    - Replaced rotated boxes and background glow blobs with a journey waypoint route SVG featuring glowing destination nodes.
  - **Settings Header Scene (`PageHeaderScene variant='settings'` in `mobile/recorder/src/shell.tsx`):**
    - Replaced primitive thick-bordered circle blobs with a sleek telemetry constellation network.
  - **Collection & Memory Vector Placeholders (`shell.tsx`):**
    - Replaced `CollectionPlaceholderArtwork`, `JourneyMomentArtwork`, `MemoryArtwork`, and `CollectionCard` fallback CSS shapes with bespoke vector road and perspective route illustrations.
  - **Open Road Vector Artwork (`OpenRoadArtwork` in `shell.tsx`):**
    - Replaced CSS rectangle/star/horizon shapes with a full SVG vector sunset road scene.
  - **Mini Route Thumb (`CompactJourneyRow` in `shell.tsx`):**
    - Replaced 3 rotated box views with a clean mini SVG vector path.
- **Verification Results on `agy/journeydeck-1.6`:**
  - `npm run typecheck`: passed (0 errors)
  - `npm run test:tab-runtime`: 9/9 passed
  - `npm run test:navigation-motion`: 4/4 passed
  - `npm run test:recovery`: 10/10 passed
  - `npm run test:sync-status`: 4/4 passed
  - `npm run test:music-observations`: 7/7 passed
  - `npm run test:drive-detection`: 9/9 passed
  - `npm run test:native-capabilities`: 2/2 passed
  - `npx expo-doctor`: 21/21 checks passed
  - `npx expo export --platform ios`: passed (6 assets bundled, 1 iOS JS bundle, React Compiler active)
- **Published Preview OTA:**
  - Update group ID: **`16c7b717-3926-4875-b0aa-a38e4d6c1eaf`**
  - iOS update ID: **`01a03e7a-9cac-75f1-be22-77aedcda7c1d`**
  - Message: `Redesign placeholder graphics and add authentic vinyl record hero`
  - Runtime version: `1.6.0` (channel `preview`, platform `ios`)
  - EAS Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/16c7b717-3926-4875-b0aa-a38e4d6c1eaf`

## Agy takeover and 1.6 OTA recovery checkpoint — August 26, 2026

- **CURRENT MOBILE VERSION:** JourneyDeck is app/runtime **`1.6.0`** on Expo SDK 57. Current native preview build is **`62afd5b5-9977-48e7-a580-eda5c25ca38b`** (iOS build 3, fingerprint `4cc3b8f0bfc1787280000c4661c1df9d1f357db6`).
- **Merged to main:** PR #129 merged to `main` as `d30925f` (feature commit `61b8615`). Authoritative remote tip is now `origin/main` at `d30925f`.
- **Latest Verified Preview OTA:** Update group **`ae3c5daf-5d94-42ab-a600-202df1b1d981`** (`Center Home icons with measured flex layout`) on runtime `1.6.0`.
- **Recovered 1.6 OTA Files (Merged in #129):**
  - `mobile/recorder/assets/tessie-logo-white.png` (authorized official logo asset)
  - `mobile/recorder/assets/tessie-logo-black.png` (authorized official logo asset)
  - `mobile/recorder/App.tsx` (recorder atmosphere & static card lighting)
  - `mobile/recorder/src/music-screen.tsx` (music atmosphere, circular vinyl artwork, tour mileage SVG route glow)
  - `mobile/recorder/src/shell.tsx` (TessieMark, radial glow backdrops, 118pt flex-centered Home action tiles with SF Symbols, lower widget readability)
  - `mobile/recorder/tests/tab-runtime.test.mts` (full 9/9 regression coverage for recovered features)
- **Full Verification Passed on `agy/journeydeck-1.6`:**
  - Mobile Typecheck: `tsc --noEmit` passed (0 errors)
  - Tab Runtime Tests: 9/9 passed (`npm run test:tab-runtime`)
  - Navigation Motion Tests: 4/4 passed (`npm run test:navigation-motion`)
  - Recovery Tests: 10 passed (`npm run test:recovery`)
  - Sync Status Tests: 4 passed (`npm run test:sync-status`)
  - Music Observations Tests: 7/7 passed (`npm run test:music-observations`)
  - Drive Detection Tests: 9/9 passed (`npm run test:drive-detection`)
  - Native Capability Tests: 2/2 passed (`npm run test:native-capabilities`)
  - Expo Doctor: 21/21 checks passed (`npx expo-doctor`)
  - Production iOS Metro Export: passed (`npx expo export --platform ios` — 6 assets bundled, 1 iOS JS bundle, React Compiler active)
  - Git Diff Check: `git diff --check` passed cleanly

## Summary

- Feature branch: `codex/journeydeck-mobile-shell`; implementation merged to `main` in PR #111 as `6eeac09`.
- Expanded the single-purpose Recorder into JourneyDeck 1.1.0 while keeping the existing bundle identity and local recording database.
- Added Home, Journeys, Record, and Connections tabs; first-run provider selection; offline dashboard/history caches; journey details with real route geometry; pagination; and Tessie/Last.fm capability status.
- Added Apple Music, ShazamKit, and Last.fm choices with explicit benefits, limitations, and privacy copy.
- Added a local Expo iOS module for Apple Music authorization/current and recent tracks plus bounded ShazamKit recognition. Raw microphone audio is never stored or uploaded.
- Added a separate local-first SQLite music queue. GPS safety and Finish never wait for music sync.
- Added authenticated server APIs for dashboard, journey history/detail, provider preferences, music observations, connection capabilities, and bounded Last.fm session reconciliation.
- Added `LASTFM_API_KEY` to the Render Blueprint as a server-only secret.

## Build and Verification

- Final traceable EAS internal iOS build succeeded: `09f10cad-0b10-4dca-b49e-d4f8d2a20539` from commit `da6518d`.
- App version/build: JourneyDeck `1.1.0 (2)`; internal preview; expires September 6, 2026.
- Build/install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/09f10cad-0b10-4dca-b49e-d4f8d2a20539`.
- Direct IPA: `https://expo.dev/artifacts/eas/Cw6jypBkPmRgQKLNqh8c8-jTXUVuK7qV1cZ0HUkIzGg.ipa`.
- Build `48505346-f059-4d40-89d4-4d744b5732b0` (`1.1.0 (1)`) is superseded because its ad-hoc profile was invalidated when Apple App Services changed.
- Mobile typecheck passed.
- Recorder recovery: 10 passed; sync presentation: 4 passed; music normalization: 6 passed.
- Expo Doctor: 21/21; iOS Metro export passed; EAS native Swift build passed.
- Full repository suite passed: 29 server tests, 9 browser tests, PowerShell analysis, secret scan, and HIGH/CRITICAL dependency scan.
- `git diff --check` passed (Windows line-ending warnings only).

### Onboarding authorization follow-up

- Fixed Apple Music onboarding so choosing Apple Music immediately invokes native authorization and persists the connected state. Commit `898b119` (`fix(mobile): authorize Apple Music during onboarding`) pushed to `origin/codex/journeydeck-mobile-shell`.
- Verification: `npm run typecheck`, `npm run test:music-observations` (6/6), and `git diff --check` passed.
- EAS build 3 completed successfully: `8e9d6be9-4ef8-485a-a6cd-2162539b9c7e`, version `1.1.0 (3)`. Install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/8e9d6be9-4ef8-485a-a6cd-2162539b9c7e`.

### EAS Update configuration

- Added `expo-updates` to the mobile app and configured the existing Expo project update URL with `runtimeVersion` policy `appVersion`.
- Added EAS channels/environments: `preview` for the preview/development profiles and `production` for the production profile. No update was published; the corresponding branches will appear after the first publish.

### Mobile dashboard preview

- Expanded the native Home dashboard with today/all-time cards, recorder status, quick actions, latest vehicle context, road soundtrack, two recent journeys, and data-health rows using the existing local-first dashboard response.
- Removed the temporary EAS preview marker; retained the automatic Shazam overlap guard and manual-button removal.
- Added an in-app downloaded-update alert with a safe `Restart now` action; the user verified the OTA prompt and immediate reload on the physical iPhone.
- Added the cinematic neon dashboard and published preview update group `2b395cc2-aa64-4c91-9935-7f903b6c021d` for runtime `1.1.0`.
- Fixed the seven-day pulse chart to page through the complete current seven-calendar-day journey window instead of using only the five-item dashboard preview. Weekly journeys are cached for offline display.
- Replaced the small route doodle with a larger car-agnostic neon open-road hero built from native views, so it remains OTA-compatible and suitable for public users. Published preview update group `b6a3c06d-3f3c-449b-a6d5-e4d4fa003b7e` for runtime `1.1.0`.
- Current verification: mobile typecheck, recovery (10), sync status (4), music observations (6), iOS Metro export, and `git diff --check` passed. Dashboard/Shazam/update-alert source changes remain uncommitted for review.

### Native Memories page (delivered to preview)

- Replaced the native Journeys tab with a three-level Memories page: animated Memory carousel, selected Memory Collections, then the Journey list.
- Added native creation/editing for Memories and Collections. Memory membership adds/removes Collections; Collection membership adds/removes Journeys with immediate durable saves.
- Added narrowly authenticated Recorder mobile endpoints for the shared `memories`, `memory_collections`, `journey_collections`, and `journey_collection_drives` tables. The phone receives no broader web-session authority.
- Added server coverage for unauthorized access, Collection creation/update, Memory creation, catalog reads, and membership removal.
- Verification: `npm run check:server`, `npm run lint:server`, `npm run test:server` (29/29), mobile `npm run typecheck`, recovery (10), sync status (4), music observations (6), iOS Metro export, and `git diff --check` passed.
- Delivered through PR #113, merged to `main` as `a40cd1f`. Render deploy `dep-da5q4r0u01pc7384a930` is live, and preview OTA group `f1f28552-ad9f-4a18-a19f-111915c12568` was published for runtime `1.1.0`.

### Automatic drive detection (pending review and physical-device validation)

- Added a first-run recording-mode picker before music onboarding with Automatic and Manual cards, honest benefits/drawbacks/privacy copy, and no duplicate JourneyDeck brand header.
- The choice is durable and editable under Connections. Automatic mode hides idle manual-start controls but still lets the user open/finish an active journey; Manual mode retains Start/Finish and unregisters the detection task.
- Automatic mode registers a separate background GPS watcher. It starts only after three accurate readings at or above 6.7 m/s (about 15 mph) spanning at least 20 seconds and inside a two-minute window. It finishes only after five continuous minutes at or below 2.2 m/s (about 5 mph). Missing or worse-than-100-meter accuracy is ignored.
- Automatically detected journeys remain local-first, use the established route task and recovery flow, sync best-effort, and keep retryable finishing data on-device when offline.
- When Shazam is the selected soundtrack method, recognition is attempted at journey start and no more than once per minute while recording. Audio is never stored.
- Added deterministic drive-policy tests: 9/9 passed. Mobile typecheck, recovery (10), sync status (4), music observations (6), Expo Doctor (21/21), iOS Metro export, and `git diff --check` passed.
- Rebuilt the native Home dashboard around the web reference dashboard: a full-bleed car-agnostic neon-road hero, live detector overlay, soundtrack waveform, hourly driving graph, glowing action dock, compact journey/health grid, weekly activity, and all-time rail. The project-bound generated asset is `mobile/recorder/assets/dashboard-neon-road-v2.png` (built-in image generation; prompt requested a premium vehicle-free midnight highway with coral, violet, and cyan glow). Preview OTA group `b41c17b0-1637-4497-a2eb-bd746343185c` was published for iOS runtime `1.1.0`.
- Branch/worktree: `codex/automatic-drive-detection` at `C:\Users\patri\DriveOS-auto-detection`. Feature commit `3f1c621` (`feat(recorder): add automatic drives and cinematic dashboard`) is pushed to `origin/codex/automatic-drive-detection`; it has not been merged. Earlier preview OTA groups `f7900733-bc9d-4ebb-995c-1c27321be567` (automatic detection) and `5aefeacc-8a39-4ca6-88de-1114f91b22ec` (hide manual start controls in Automatic mode) were published for iOS runtime `1.1.0`.
- Required physical test: choose Automatic, confirm Always location and Shazam microphone permission when applicable, lock the phone, drive above 15 mph for at least 30 seconds, confirm automatic start, then park for at least five minutes and confirm automatic finish/sync. Also verify traffic stops, passenger trips, manual override, offline finish, and force-quit recovery.

## Release State and Next Steps

### Mobile journey location names (released and verified)

- Added an **Edit locations** action beside **Create share card** in the native Journey overview modal. Users can name the start and destination (for example Home, Work, or School), cancel edits, or clear a name to restore the original location.
- Location names use the existing shared `place_aliases` store, so a name is reused when the same place appears in other journeys. Generic phone-recorder locations receive coordinate-derived keys so unrelated `Recorder location` endpoints are not accidentally renamed together.
- Added a narrowly authenticated Recorder mobile alias endpoint; responses preserve raw locations and return resolved display names plus stable alias keys. Existing cached mobile journey records remain backward compatible.
- Verification passed: server typecheck/lint and 29/29 server tests; mobile typecheck; recovery 10/10; sync status 4/4; music observations 6/6; drive detection 9/9; iOS Metro export; and `git diff --check` (line-ending warnings only).
- Delivered through PR #117 and merged to `main` as `3ecc062`. Render deploy `dep-da69a83ncjis73d1n360` succeeded, and preview OTA group `c88499be-6e64-432d-be3b-9cafc769bcae` was published for runtime `1.3.0`.
- Physical iPhone verification is complete: the user confirmed location-name saving, persistence, and reuse. The MacinCloud workflow has been retired; use a local Apple Silicon Mac Simulator when available or the established physical-iPhone preview/OTA flow.

### Compact Memories journey list (released to preview)

- The Memories page now renders journeys as compact rows so substantially more recent drives fit on one screen. The compact presentation keeps the route, distance, duration, artwork, song/artist, and song count while removing the vehicle label and tightening typography, spacing, and dividers.
- The compact style is scoped only to the Memories journey list; Home and other Journey cards retain their richer presentation.
- Verification passed: mobile typecheck; recovery 10/10; sync status 4/4; music observations 6/6; drive detection 9/9; iOS Metro export; and `git diff --check` (line-ending warning only).
- Delivered through PR #118 and merged to `main` as `a722f52`. Preview OTA group `5b633082-b04c-4815-8371-111b4ab43b25` was published for iOS runtime `1.3.0`; no new native build is required.
- Physical follow-up: open the installed preview app online, accept the downloaded-update restart prompt, and verify the compact Journey rows on Memories at normal and long route-name lengths.

### Native Liquid Glass navigation pill (released; physical test pending)

- Replaced the full-width native bottom navigation bar with a floating four-tab pill modeled on the mobile web navigation: violet glass rim, compact icon/label grid, and a coral/orange active capsule with outline, glow, and underline.
- Added Expo SDK 57 `expo-glass-effect` (`~57.0.1`). On iOS 26 with the required native API, the pill uses the real `UIVisualEffectView` Liquid Glass surface; unsupported iOS versions receive a deliberate dark translucent fallback without changing navigation behavior.
- The pill floats above screen content. Home, Memories, Connections, and Recorder layouts reserve enough bottom space for safe scrolling and controls.
- App/runtime is now `1.4.0` because this introduces a native dependency. EAS preview build `6541348a-c16b-4c0e-9070-1a9f87e4fcac` completed successfully from merged commit `3d2a1c1`; install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/6541348a-c16b-4c0e-9070-1a9f87e4fcac`.
- Verification passed: mobile typecheck; recovery 10/10; sync status 4/4; music observations 6/6; drive detection 9/9; iOS Metro export; public Expo config; and `git diff --check`. Expo Doctor remains 20/21 only because of the six pre-existing SDK 57 patch mismatches.
- Delivered through PR #120 and merged to `main` as `3d2a1c1`. Next step: install the 1.4.0 preview build over the existing app without deleting it, then physically verify native glass rendering, safe-area placement, scroll clearance, active orange glow, and all four tab hit targets.

### Liquid Glass clarity and drag navigation (released; physical test pending)

- Changed the installed 1.4.0 navigation pill from a heavily dark-tinted `regular` glass surface to native `clear` Liquid Glass with a light violet tint, brighter rim, and subtle top sheen so refraction is easier to perceive against JourneyDeck's dark screens.
- Added horizontal drag selection with React Native `PanResponder`. After a short horizontal movement, the active orange capsule and selected screen follow the finger across Home, Memories, Record, and Connect; ordinary taps and accessibility tab semantics remain intact.
- This was delivered as a JavaScript/style-only OTA to the installed JourneyDeck 1.4.0 preview build; no additional native build was required.
- Verification passed: mobile typecheck; recovery 10/10; sync status 4/4; music observations 6/6; drive detection 9/9; iOS Metro export; and `git diff --check`.
- Delivered through PR #122 and merged to `main` as `875c6eb`. Preview OTA group `dba59599-a4c4-4f1d-9865-769cad487e4c` was published for iOS runtime `1.4.0`; dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/dba59599-a4c4-4f1d-9865-769cad487e4c`. Next step: accept the in-app restart prompt, then physically verify clearer refraction and drag-through selection across all four tabs.

### Native Music dashboard and balanced Liquid Glass (released to preview)

- Added a fifth Music destination to the draggable native navigation pill and changed the iOS surface from overly transparent `clear` glass at 20% tint to `regular` Liquid Glass at a midpoint 46% violet tint.
- Added a cinematic native Music page modeled directly on the web Music dashboard: album-led soundtrack hero (without the excluded Now Playing widget), four archive metrics, recent selections, top artists, tour mileage, listening-time mood, cities, seven-day intensity, and weekly play bars.
- Added narrowly recorder-authenticated `GET /api/recorder/music-dashboard`, which aggregates live listening history and journey soundtracks on the server using the phone's timezone offset. The response contains only bounded display metadata and aggregates; no credentials or raw audio are exposed. Mobile caches the last successful summary for offline viewing.
- Track taps are provider-conditional and tested: Apple Music opens only Apple Music links/search, Last.fm opens only Spotify links/search, and Shazam/recognition-only mode has no tap action.
- Verification passed: server typecheck/lint and 29/29 server tests; mobile typecheck; recovery 10/10; sync status 4/4; music observations/destination policy 7/7; drive detection 9/9; iOS Metro export; and `git diff --check` (line-ending warnings only).
- Delivered through PR #124 and merged to `main` as `b35b626`. Render deployment `dep-da6bfccs728c73f713ug` is live on that commit, `/readyz` returns 200, and the deployment produced no error logs. Preview OTA group `fb35a19c-7013-4ec4-ba7c-3444bf4a07e0` was published for iOS runtime `1.4.0`; dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/fb35a19c-7013-4ec4-ba7c-3444bf4a07e0`. Physical verification is still pending for the live Music page, all five drag destinations, the balanced tint, and Apple Music/Spotify handoffs.

### Continuously gliding navigation highlight (released to preview)

- Replaced the per-tab orange background—which visibly jumped between selected items—with one animated orange glass overlay that tracks the finger's horizontal position continuously across the five-tab navigation pill.
- The icon, label, underline, and screen still select at each tab midpoint. When the gesture ends, the overlay springs into exact alignment with the selected tab; ordinary taps and accessibility tab semantics remain unchanged.
- Added pure, deterministic geometry helpers and four tests covering equal layout, continuous indicator motion, midpoint selection, and tab snap positions.
- Verification passed: mobile typecheck; navigation motion 4/4; recovery 10/10; sync status 4/4; music observations 7/7; drive detection 9/9; iOS Metro export; and `git diff --check` (line-ending warnings only).
- Delivered through PR #126 and merged to `main` as `3392dcc`. Render deployment `dep-da6c1e6gekts739b3dk0` is live and healthy. Preview OTA group `4c63be7a-71d3-4c47-8c17-0387d8c2a93b` was published for iOS runtime `1.4.0`; dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/4c63be7a-71d3-4c47-8c17-0387d8c2a93b`. Physical verification is still pending for continuous finger tracking, midpoint tab changes, and the release snap.

### Cinematic iOS navigation recreation (implemented; build pending)

- Recreated the native five-item dock from the supplied Memories-page video: nearly edge-to-edge dark wine/plum surface, restrained mauve rim and shadow, warmer active tile, orange outline/glow/underline, larger readable labels, and proper native line icons.
- Kept the single continuously gliding selector. It still follows the finger, changes destinations at lane midpoints, and springs to the selected lane on release; taps and accessibility tab semantics remain intact.
- Changed Liquid Glass into a passive `clear` background layer with a strong 78% dark cinematic wash, leaving only modest color bleed from content beneath. The layer cannot intercept gestures. Reduce Transparency and unsupported runtimes receive an opaque fallback.
- Added Expo SDK 57 `expo-symbols` (`~57.0.2`) and its required `expo-font` peer (`~57.0.1`) for SF Symbols. App/runtime is now `1.5.0`; a new EAS preview build is required and the change must not be published to installed `1.4.0` clients by OTA.
- Verification passed: mobile typecheck; navigation motion 4/4; recovery 10/10; sync status 4/4; music observations 7/7; drive detection 9/9; Expo Doctor 21/21; iOS Metro export; public Expo config; and `git diff --check`.
- Local branch/worktree: `codex/mobile-cinematic-nav` in the current Codex workspace. Changes are intentionally uncommitted and unpushed pending authorization. Next steps: review the diff, commit/push and open a PR, then produce/install a JourneyDeck 1.5.0 preview build and physically verify glass transmission, SF Symbols, safe-area placement, all five hit targets, continuous drag, midpoint changes, and release snap.

### Native modal overviews and share cards (implemented; release pending)

- Memories, Collections, and Journeys now open as cinematic native overlay modals above the existing Memories screen instead of replacing or expanding the page.
- Memory and Collection editors also use scrollable overlays. Collection journey membership moved inside the Collection editor, so managing a Collection no longer stretches the main screen.
- Added summary/overview cards for all three content levels with photos, descriptive copy, aggregate metrics, nested-item navigation, and direct edit/manage actions.
- Added privacy-safe 4:5 image share cards for Memories, Collections, and Journeys. Journey exports deliberately omit precise routes, coordinates, and start/end labels. Sharing uses `react-native-view-shot` plus `expo-sharing` and the native iOS share sheet.
- Mobile app/runtime is now `1.3.0` because sharing and view capture add native dependencies. A fresh EAS preview build is required; this cannot be sent to the installed 1.2.0 binary by OTA.
- Verification passed: mobile typecheck; recovery 10/10; sync 4/4; music 6/6; drive detection 9/9; iOS Metro export; public Expo config; and `git diff --check`. Expo Doctor remains 20/21 only because of the six known pre-existing SDK 57 patch mismatches.
- Branch/worktree: `codex/mobile-modal-overviews` at `C:\Users\patri\DriveOS-auto-detection`. Next steps: commit/push, merge after CI, then create and install a JourneyDeck 1.3.0 iOS preview build and physically test modal transitions plus image sharing.

### Memories and Collections photos (released; physical iPhone test pending)

- Added iPhone photo-library uploads to both Collection and Memory editors. Images are resized/compressed on-device, bounded to 1.5 MB, signature-validated on the server, and stored in the existing Collection/Memory attachment tables.
- A Memory catalog now automatically includes images from every selected Collection without copying them. The Memory editor displays direct and inherited photos and persists an explicit card-cover selection; deleting a selected image safely clears affected covers.
- Added migration `0009_memory_cover_photo.sql`, narrow authenticated upload/read/delete routes, mobile image caching, real Collection thumbnails, and Memory hero cover rendering.
- App/runtime version is now `1.2.0`; `expo-image-picker` and `expo-image-manipulator` are new native dependencies. The new native preview build is ready for installation over the existing app.
- Verification passed: server typecheck/lint, all 29 server tests (including upload/inheritance/cover/delete/auth coverage), mobile typecheck, recovery 10/10, sync 4/4, music 6/6, drive detection 9/9, iOS Metro export, and `git diff --check`.
- Expo Doctor reports only six pre-existing SDK 57 patch-version mismatches (`expo`, crypto, dev-client, location, task-manager, updates); the two newly added photo packages match SDK 57.
- Feature commit `28c939d` and migration-test update `cb60cae` were merged through PR #114 to `main` as `d7b0d34244bef2be83bede98844e56f8f25cdd51`. GitHub validation passed.
- Render deploy `dep-da63cc2d0e5s73c46cmg` is live. `https://driveos.onrender.com/readyz` returned HTTP 200 and the release produced no new error logs.
- EAS iOS preview build `c6e30728-6689-4f0e-88e3-cda81982d27f` succeeded for JourneyDeck 1.2.0. Install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/c6e30728-6689-4f0e-88e3-cda81982d27f`.
- Next step: install the 1.2.0 preview over the current app, then physically test Collection upload, inherited Memory visibility, direct Memory upload, cover selection, deletion/cover clearing, and preserved Recorder data.

- Automatic-drive detection, the cinematic dashboard, and Memories photos are merged to `main` through PR #114. Latest native device build is JourneyDeck 1.2.0 build `c6e30728-6689-4f0e-88e3-cda81982d27f`.
- PR #113 is merged. Render deploy `dep-da5q4r0u01pc7384a930` is live with the Memories API.
- Render already contains nonempty server-only Last.fm and Tessie secrets; neither secret is stored in or returned to the iPhone app.
- Apple Developer App Services MusicKit and ShazamKit are enabled for `com.journeydeck.recorder`.
- The Apple ad-hoc provisioning profile was regenerated, then uploaded to Expo as valid profile UUID `52f18699-e3d3-446e-804a-742026badb7c`; the final build was signed afterward.
- Install build `09f10cad` over the current Recorder app; do not delete the old app first. Test preserved connection/data, onboarding, dashboard/history, recording/recovery/finish, Apple Music permission and track capture, Shazam recognition, Last.fm sync, and Tessie status.
- Internal-preview security debt: the current single-phone recorder token now authorizes history and exact route reads. Before a public beta, replace it with revocable per-device credentials and separate ingest/read scopes.

### 1.5 navigation recovery and music dashboard follow-up (published)

- An incorrect 1.5 OTA was briefly published from the older 1.4 navigation source. It was immediately superseded by group `5ba6271d-c26c-4438-a2e4-5ca0a77db5b5`, restoring the cinematic 1.5 navigation dock from build commit `287e5c0`.
- The final 1.5 OTA group is `53d67c05-1e2b-4d8e-8bf2-fc762b273cba`: it retains that newer dock and adds the requested larger Top artists card, the Settings gear/label/header, and a Listening time chart distinct from daily play bars.
- Mobile `npm run typecheck` and `git diff --check` passed. Server changes for daily listening-minute payloads remain uncommitted in `C:\Users\patri\DriveOS-nav-build`; until deployed, the updated client safely renders the line chart with its fallback.

### Cinematic iOS visual-system alignment (published)

- Kept the restored five-item 1.5 cinematic dock intact, then aligned the remaining native surfaces with it: framed/atmospheric page headers, coral section rails, stronger primary actions, and clearer elevated Settings connection rows with service-color edges.
- The Music page now uses the same header and card treatment. Top artists remain enlarged for readability, and Listening time remains a minute-based metric distinct from the daily-play bars.
- This is JavaScript/style-only and was published as iOS runtime `1.5.0` preview OTA group `c5d08f6b-346e-4f3d-8e3f-c068ca060501` (update `01a038e3-8883-73e8-a4c1-6344c912e33b`), sourced exclusively from the 1.5 worktree/build commit `287e5c0` with its intentional local edits.
- Verification: mobile `npm run typecheck`, EAS iOS bundle/export during update, and `git diff --check` passed (line-ending notices only). Physical iPhone review remains the next useful check.

### Retained tab transitions (published)

- Replaced abrupt tab screen unmount/remount behavior with retained Home, Memories, Music, Settings, and Recorder layers. Their scroll positions now survive tab changes instead of starting each newly selected screen at its top.
- The active tab uses the selected dissolve-and-settle treatment: the outgoing page fades and rises 4 points while the incoming page fades in from 10 points below over 260 ms. The existing cinematic dock and its continuously gliding indicator were preserved.
- Published as iOS runtime `1.5.0` preview OTA group `c203f683-0f33-480b-9106-95654b33dd1d` (update `01a03921-c864-74d4-ade3-a74f06f29d5f`), sourced exclusively from 1.5 build commit `287e5c0` with intentional local edits.
- Verification: mobile `npm run typecheck`, navigation-motion tests 4/4, EAS iOS export/bundle during update, and `git diff --check` passed (line-ending notices only). Physical iPhone test is needed for touch/scroll feel across all five tabs.

### Tab transition stability follow-up (published)

- Fixed a visual regression in the retained-tab implementation: inactive screens are now kept laid out but transparent, instead of using `display: none` and being laid out only when they appear. This prevents the long Music scroll view from visibly repositioning during reveal.
- Reduced the settle distance from 10 to 4 points (and the outgoing lift from 4 to 2) so the intended dissolve cannot read as a page scroll. A horizontal dock drag now chooses its final tab only on release; the indicator still glides continuously, but a single gesture no longer starts multiple full-page transitions while crossing lanes.
- Published as iOS runtime `1.5.0` preview OTA group `f8e0b617-3ffd-423f-9103-bad88a068252` (update `01a0393d-eff1-79ae-9a89-a2ea9cdf33ff`) from the verified 1.5 worktree/build commit `287e5c0` with intentional local edits.
- Verification: mobile `npm run typecheck`, navigation-motion tests 4/4, EAS iOS export/bundle during update, and `git diff --check` passed (line-ending notices only). Physical iPhone validation of Music, Memories, Home, Settings, and Record remains required.

### Music tab no-scroll correction (published)

- Removed all vertical translation from the tab transition. The selected treatment is now a pure opacity dissolve, so no app content can be perceived as scrolling during entry or exit.
- Added a Music scroll-view reset keyed to each Music tab selection. It resets to `y: 0` without animation while the page is still transparent, then the page fades in; Music can no longer restore or reveal an old offset during a tab switch.
- Published as iOS runtime `1.5.0` preview OTA group `f9d2e0ab-cf89-41d2-a6f4-7ee654a24468` (update `01a03941-ea2c-7765-900c-6aa3094baffd`) from the verified 1.5 worktree/build commit `287e5c0` with intentional local edits.
- Verification: mobile `npm run typecheck`, navigation-motion tests 4/4, EAS iOS export/bundle during update, and `git diff --check` passed (line-ending notices only). Verify Music starts at its top and fades without vertical movement on the physical preview app.

### Two-layer tab transition correction (published)

- Removed the Music-tab `scrollTo({ y: 0 })` effect that ran after every Music selection and visibly moved the content.
- Replaced the always-mounted hidden page stack with a two-layer dissolve: only the entering and leaving page trees are mounted during the 260 ms opacity transition. The Recorder remains mounted for recording continuity but uses `display: none` when it is neither transition layer.
- Published as iOS runtime `1.5.0` preview OTA group `8f7f1f76-0f06-4a30-8f56-0149d8278fd6` with message `Fix Music tab scroll and transition layout` from the verified `C:\Users\patri\DriveOS-nav-build` source.
- Verification: mobile `npm run typecheck`, navigation-motion tests 4/4, `git diff --check`, and EAS iOS export/upload completed. Physical check: enter Music by tap and dock drag, then switch through all five tabs to confirm no automatic movement or dropped-frame feel.

### Luminous transition-engine rebuild (published)

- Frame-stepped the physical iPhone recording `ScreenRecording_08-25-2026 09-25-49_1.mp4`. It exposed a near-black frame during each crossfade: the shared opacity value hid the current page before React committed and laid out its replacement.
- Removed page-opacity crossfading and overlapping page trees. The selected dock item now responds immediately and starts its data refresh while the current page stays fully opaque. A native-driven plum/coral light veil covers the screen in 120 ms, the destination page mounts behind the opaque veil, two render frames are allowed for layout, then the veil reveals the complete page over 190 ms.
- Only the visible page is rendered; the Recorder engine remains mounted but `display: none` outside its tab so recording continuity is preserved without layout work. Rapid selections queue the latest destination instead of interrupting an in-flight reveal.
- Published for iOS runtime `1.5.0` preview as OTA group `55bd3424-8bba-4f66-b0b7-e077e5915c07` with message `Rebuild tab switching with luminous transition veil`.
- Verification passed: mobile typecheck; navigation motion 4/4; recovery 10/10; sync presentation 4/4; music observations 7/7; drive detection 9/9; `git diff --check`; and EAS iOS export/upload. Physical verification remains required for tap and dock-drag switching across all five pages.

### JourneyDeck 1.6 native design foundation (built successfully; physical test pending)

- Work is in the detached `C:\Users\patri\DriveOS-nav-build` worktree at base commit `287e5c0`; all existing 1.5 visual and listening-time edits remain intentionally uncommitted. Do not replace this source with the older `C:\Users\patri\DriveOS` checkout.
- App/runtime is now `1.6.0`. Added the Expo 57-compatible native design foundation: Reanimated + Worklets, Gesture Handler, PagerView, Expo Image, Haptics, FlashList, MeshGradient, Skia, Safe Area Context, Screens, Blur, Linear Gradient, SVG, Splash Screen, System UI, Expo UI, Keyboard Controller, and React Compiler. Skia's install script is explicitly approved so its Apple libraries are present. No unrelated camera, maps, contacts, payment, or other permission-heavy modules were added.
- Replaced the blackout/remount tab engine with one persistent native PagerView containing Home, Memories, Music, Record, and Settings. Pages and the recorder remain mounted, page/scroll state survives switching, the dock drives the native iOS transition, and successful selections receive light haptics.
- Fixed Music's confirmed automatic-scroll cause: background dashboard loading no longer controls `RefreshControl.refreshing`; only an actual pull gesture does. Music disables automatic content-inset adjustment, applies explicit safe-area padding, and uses Expo Image disk/memory caching for artwork.
- Added regression checks `test:tab-runtime` and `test:native-capabilities`. Verification passed: mobile typecheck; native capability 2/2; tab runtime 2/2; navigation motion 4/4; recovery 10/10; sync status 4/4; music observations 7/7; drive detection 9/9; Expo Doctor 21/21; Expo config public + introspection; production iOS Metro export with React Compiler; Expo/React Native Apple autolinking (including Skia/Reanimated/Worklets/PagerView); server typecheck/lint; and all 29 server tests. Windows cannot generate an Xcode project, so `expo prebuild --platform ios` correctly reported its macOS/Linux requirement and made no files.
- The single authorized EAS iOS preview build completed successfully: build `62afd5b5-9977-48e7-a580-eda5c25ca38b`, app/runtime `1.6.0`, iOS build `3`, fingerprint `4cc3b8f0bfc1787280000c4661c1df9d1f357db6`. Install page: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/62afd5b5-9977-48e7-a580-eda5c25ca38b`. Install 1.6 over 1.5 without deleting the app so local recorder data is preserved, and physically verify rapid tab taps/drag release, Music entry at the exact top, pull-to-refresh, recording continuity, native glass, cached artwork, and all existing connections.

### 1.6 safe-area alignment (published)

- Home, Memories, Recorder, Settings, and the unused Journeys list now use the same explicit `useSafeAreaInsets()` layout as Music instead of relying on React Native's legacy `SafeAreaView` inside PagerView. Each scroll surface begins at `insets.top + 14`, disables automatic iOS content/indicator inset adjustment, and clears below the floating dock with `insets.bottom + 132`.
- Added tab-runtime regression coverage for the four visible affected screens. Mobile typecheck and `test:tab-runtime` (3/3) passed; `git diff --check` passed with only Windows line-ending notices.
- Published iOS preview OTA group `9f799a37-b053-465f-b667-0e07066ac46c` for runtime `1.6.0`, message `Keep every native page below the Dynamic Island`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/9f799a37-b053-465f-b667-0e07066ac46c`. No native build was used.

### 1.6 cinematic Memory Detail (published)

- Replaced the plain Memory Overview list with the approved Collection Atlas plus Chaptered Road detail surface. It makes the hierarchy explicit—Memory → Collections → individual journeys—using collection chapter cards with their own photo, count, and the first three nested journey rows. Every chapter and journey remains directly actionable.
- Added the selected cinematic entrance: a blurred dark backdrop and sheet settle, followed by a warm coral/violet light sweep. Memory identity arrives first, then the breadcrumb, road thread, and staggered Collection chapters. It uses only the native 1.6 stack: Reanimated/Worklets, Expo Blur, and Expo Linear Gradient; no new native dependency or build is needed.
- Verification passed: mobile typecheck; tab runtime 4/4 (including the new hierarchy/light-sweep regression); navigation motion 4/4; iOS Metro export; and `git diff --check` with only Windows line-ending notices.
- Published iOS preview OTA group `19bbfa40-f606-438c-91c8-e1c509aa0549` for runtime `1.6.0`, message `Open Memory details with cinematic collection chapters`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/19bbfa40-f606-438c-91c8-e1c509aa0549`. No native build was used.

### Memory Detail visual restoration (pending OTA)

- Restored the original cinematic composition requested after the first Memory Detail release: a large photo-led Memory hero, large Collection image chapters, and photo-rich journey moments instead of a compact text-first outline.
- The atlas road is now a real curved SVG path with a warm/violet glow and prominent luminous chapter dots. Collection headers open the existing Collection detail modal; each journey moment opens the existing Journey detail modal.
- Collections without uploaded photos now receive deliberate native cinematic placeholder artwork, and their nested journey moments receive matching stills, so the story remains visual without inventing or uploading user data.
- Updated `mobile/recorder/src/shell.tsx` and untracked `mobile/recorder/tests/tab-runtime.test.mts`. Verification: mobile typecheck; tab-runtime 4/4; navigation-motion 4/4; iOS Expo export; and `git diff --check` (only existing Windows line-ending notices).
- Published as iOS preview OTA group `4622a610-21c4-436f-a586-d8560043bb59` for runtime `1.6.0`, message `Restore cinematic Memory Atlas visuals`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/4622a610-21c4-436f-a586-d8560043bb59`. No native build was used.

### Memory Detail stability hotfix (published)

- User screenshots exposed a malformed nested journey thumbnail in `Working at First Rate`: a percentage-height photo inside a flexible row could make the Collection card expand to the bottom of the page. Nested journey moments now use fixed 65-point native illustrated tiles; uploaded Collection photos remain prominent in each Collection header, but no high-resolution source is decoded repeatedly in the nested list.
- Memory actions now close the native Memory modal, wait 260 ms for dismissal, then open Collection detail, Journey detail, sharing, or editing. This prevents two modal layers from being torn down/presented in the same iOS frame, which was the likely cause of the unresponsive/crashing interaction.
- Verification passed: `npm run typecheck`, `npm run test:tab-runtime` (4/4, including tile sizing and safe modal transition assertions), iOS Expo export, and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `6e4ecd98-e651-4cbc-8d38-bb2c5d171df2` for runtime `1.6.0`, message `Fix Memory modal stability and journey tiles`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/6e4ecd98-e651-4cbc-8d38-bb2c5d171df2`. No native build was used.

### Memory Detail native-modal removal (published)

- The first stability hotfix corrected the malformed image but did not stop the lockup after all Memory-detail actions. The shared fault was confirmed to be the full-screen native `Modal` handoff: every action had to dismiss that modal and then present another native modal (Collection, Journey, share, or editor).
- Replaced only the Memory Detail `Modal` with a z-indexed full-screen in-page overlay. The cinematic hero, blur, sweep, chapters, road, and all tap behavior remain unchanged, but actions now leave a normal React Native view before another modal presents. This removes the native presentation/dismissal race that froze the Memories page.
- Verification passed: mobile typecheck; tab-runtime 4/4, now asserting that Memory Detail is not a native modal; navigation-motion 4/4; iOS Expo export; and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `5ec69aef-e860-4681-b6fd-bd89dc895172` for runtime `1.6.0`, message `Replace fragile Memory modal with stable overlay`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/5ec69aef-e860-4681-b6fd-bd89dc895172`. No native build was used.

### Cinematic Journey routes (published)

- Replaced the basic line-segment route doodle in Journey details with a GPS-led cinematic route canvas. It uses the actual recorded route geometry in a luminous mint-violet-coral SVG path, layered route glow, start/end beacons, endpoint labels, terrain/aurora atmosphere, and a clear offline-safe pending state when route sync has not completed.
- No real map tiles or map-native dependency were introduced; this remains OTA-compatible for the installed 1.6 binary. MapLibre Native remains the deliberate next-build requirement for interactive maps/Atlas.
- Verification passed: mobile typecheck; tab-runtime 5/5 (new route canvas coverage); navigation-motion 4/4; iOS Expo export; and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `aa1149e7-b2ef-4dc3-8c23-355d96c6fa37` for runtime `1.6.0`, message `Make Journey routes cinematic and GPS-led`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/aa1149e7-b2ef-4dc3-8c23-355d96c6fa37`. No native build was used.

### Real-map Journey snapshots (published)

- Journey detail now composes a small cached 3x3 OpenStreetMap tile snapshot beneath the existing cinematic GPS route. The recorded coordinates are projected to Web Mercator, so the luminous route and its start/end beacons align with the real surrounding streets.
- This is intentionally non-interactive and OTA-safe: Expo Image caches the tiles in memory and on disk; the existing atmospheric route treatment and offline-safe pending state remain. MapLibre Native remains the next-build path for a pannable/zoomable Atlas.
- Verification passed: mobile `npm run typecheck`; `npm run test:tab-runtime` (5/5); `npm run test:navigation-motion` (4/4); iOS Expo export; and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `7538ab79-4e0d-4909-9310-741b189e0fda` for runtime `1.6.0`, message `Show real map snapshots on Journey routes`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/7538ab79-4e0d-4909-9310-741b189e0fda`. No native build was used.

### Cinematic Journey hero (published)

- Replaced the disjointed Journey detail header, standalone map, metrics strip, and lead soundtrack row with one cohesive cinematic trip card. It leads with the cached route snapshot, overlays the full date and route title, then carries distance, drive time, average speed, cover art, lead song/artist, and the total song count into one visual story.
- The detailed track list remains below under `Soundtrack moments`; routes with no music or no synced GPS still retain deliberate fallback content rather than an empty hero.
- Verification passed: mobile `npm run typecheck`; `npm run test:tab-runtime` (5/5); `npm run test:navigation-motion` (4/4); iOS Expo export; and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `323060d9-ed14-4b44-bd68-50a7ae9f122c` for runtime `1.6.0`, message `Create cinematic Journey detail hero`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/323060d9-ed14-4b44-bd68-50a7ae9f122c`. No native build was used.

### Customizable Journey share cards (published)

- Rebuilt the iOS Journey share-card preview after the web implementation: Cinematic/Electric/Sunset themes; Street/Dimmed/Route-only map treatment; Featured album/Album backdrop/No artwork; independently selectable Distance, Duration, Efficiency, Song count, and Top artist facts.
- The exported Journey card now contains a compact real basemap snapshot with the luminous route, privacy-safe location labels, featured album artwork, soundtrack summary, and map attribution. It is captured as a standard PNG through the existing native sharing flow.
- Privacy is enforced before drawing: a Home or Work endpoint triggers a synthetic city-level Saginaw route and labels, so no raw Home/Work geometry or address can be included in the exported image. Other labels are reduced to city/region-level text.
- Verification passed: mobile `npm run typecheck`; `npm run test:tab-runtime` (6/6, including custom options and Home/Work route substitution); `npm run test:navigation-motion` (4/4); iOS Expo export; and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `caac007c-5c52-474a-91a7-740959fef33f` for runtime `1.6.0`, message `Build customizable privacy-safe Journey share cards`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/caac007c-5c52-474a-91a7-740959fef33f`. No native build was used.

### Journey share-card height correction (published)

- The initial customizable Journey card had a fixed 405-point preview/output height, so five selected fact cards could push the soundtrack panel below the crop. The Journey card is now 465 points tall and captured at the matching 1080×1550 resolution; non-Journey cards retain their 1080×1350 format.
- Verification passed: mobile typecheck, tab-runtime 6/6, iOS Expo export, and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `b3ae3115-8a70-482c-9002-f358cbba06ba` for runtime `1.6.0`, message `Fit full soundtrack in Journey share card`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/b3ae3115-8a70-482c-9002-f358cbba06ba`. No native build was used.

### Distinct cinematic page headers (published)

- Replaced the repeated flat purple header treatment with three page-specific native scenes: a winding, glowing Memory Atlas road with chapter cards; a Music scene built around a luminous vinyl disc and spectrum bars; and a Settings constellation with connected data nodes.
- The existing safe-area positioning and header copy are retained, while each scene reserves visual space for the page title and uses only the installed 1.6 native stack.
- Verification passed: mobile `npm run typecheck`; `npm run test:tab-runtime` (7/7); `npm run test:navigation-motion` (4/4); iOS Expo export; and `git diff --check` (only existing Windows line-ending notices).
- Published iOS preview OTA group `3e334596-da8c-4f95-b929-b3a591c9a7e9` for runtime `1.6.0`, message `Give Memories Music and Settings distinct cinematic headers`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/3e334596-da8c-4f95-b929-b3a591c9a7e9`. No native build was used.

### Approved music-service branding and complete 1.6 Git handoff

- The music-method chooser and Settings now use Apple's official Apple Music and Shazam icon artwork. Spotify history uses Spotify's official white monochrome icon on black and is explicitly labeled `Spotify history` / `Imported via Last.fm`; no Last.fm logo is used because its published API terms require written mark approval.
- The same `ProviderMark` presentation is used in the chooser tabs, chooser detail cards, selected soundtrack-method card, and Settings connection rows. Last.fm remains the implementation/provider ID for compatibility, while the user-facing wording accurately describes the Spotify-via-Last.fm workflow.
- Published iOS preview OTA group `d030d582-1815-40c7-a1d4-44e594956603` for runtime `1.6.0`, message `Use approved music service branding`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/d030d582-1815-40c7-a1d4-44e594956603`. No native build was used.
- Current branch/worktree: `codex/journeydeck-1-6-cinematic` at `C:\Users\patri\DriveOS-nav-build`, based on `287e5c0`. This branch consolidates the complete uncommitted JourneyDeck 1.6 native foundation and subsequent OTA-delivered cinematic work; use this worktree as the authoritative source when switching agents.
- Verification passed before Git handoff: mobile typecheck; recovery 10/10; sync status 4/4; music observations 7/7; drive detection 9/9; native capabilities 2/2; tab runtime 8/8; navigation motion 4/4; iOS Expo export; server typecheck/lint; server tests 29/29; gitleaks with no findings; and `git diff --check` with only existing Windows line-ending notices.

### Tessie connection branding (published; recovered into agy/journeydeck-1.6)

- Tessie Support authorized official written permission to reference Tessie, use official logos, and link to Tessie. The supplied `logo-white.png` and `logo-black.png` are preserved as `mobile/recorder/assets/tessie-logo-white.png` and `mobile/recorder/assets/tessie-logo-black.png`.
- Settings and Home Data Health display the official white Tessie mark, `Connected through Tessie`, `Better with Tesla + Tessie` copy, and `Visit Tessie` link (`https://www.tessie.com/`).
- Published iOS preview OTA group `6127e087-e8a0-452a-b050-3f8f2ec654eb` for runtime `1.6.0`, message `Use Tessie-approved branding and service link`.

### Static cinematic widget-lighting pass (published; recovered into agy/journeydeck-1.6)

- Music's lead album artwork is a circular label centered inside the vinyl record treatment. The Tour mileage widget uses a purposeful static winding-road SVG with luminous route, dashed center line (`strokeDasharray="5 7"`), and start/end beacons.
- Added restrained edge lighting, colored borders, and text highlights across Home, Memories, Music, Record, and Settings cards.
- Published iOS preview OTA group `c5eb97a2-eb86-4bbc-a4dd-4914bd7cac62` for runtime `1.6.0`, message `Add static cinematic lighting and Music polish`.

### Web-inspired atmospheric depth and exact web-style radial glow (published; recovered into agy/journeydeck-1.6)

- Added page-specific soft radial glow fields (`AtmosphericBackdrop`, `MusicAtmosphere`, `RecorderAtmosphere` with `SvgRadialGradient`) that feather to transparent over the dark page background.
- Home, Memories, Journeys, Music, Record, and Settings each use page-specific radial bloom fields and edge bloom around cards, eliminating angled gradient lines.
- Published iOS preview OTA groups `0023ce5c-9aa1-4a07-8d01-7cb6633c1709` and `1563119d-3c29-497e-ad69-0ef6de9b9711` for runtime `1.6.0`, message `Recreate exact web radial glow atmosphere`.

### Web-parity Home action tiles and readable lower widgets (published; recovered into agy/journeydeck-1.6)

- Rebuilt the four Home action tiles around `beta-theme-v2.css`: 118-point row, 19-point radii, per-tile color depth, 42-point circular outlined icon wells, and shadow bloom.
- Increased Recent Journeys readability (9pt raw origin with 2-line wrap, 12pt destination, 8.5pt metadata, 91pt rows). Increased Data Health names (10pt) and details (8.5pt) with larger icons/status badges and taller rows.
- Published iOS preview OTA group `cbf73ded-6e6f-4570-be32-f4597f317c4c` for runtime `1.6.0`, message `Match Home widgets to web sizing and glow`.

### Optically centered native action symbols & flex-centered action wells (published; recovered into agy/journeydeck-1.6)

- Replaced Unicode text glyphs with native SF Symbols (`arrow.clockwise`, `play.fill`, `map`, and `link`) in fixed 25×25 frames inside centered 42×42 wells.
- Removed absolute positioning; icon wells participate in normal vertical flex layout with `alignItems: 'center'` and a flexible spacer, making measured tile width the centering authority.
- Published iOS preview OTA groups `0798ba82-566c-4aa6-87c6-995b97d41e61` and `ae3c5daf-5d94-42ab-a600-202df1b1d981` for runtime `1.6.0`, message `Center Home icons with measured flex layout`.

### Local worktree cleanup (2026-08-26)

- Removed 20 obsolete or otherwise preserved registered worktrees after fetching/pruning remotes and checking merge ancestry, patch equivalence, branch preservation, and dirty diffs. The unique Siri/commute history was first backed up to `origin/feat/siri-shortcuts-4.4.1`.
- Ported the unique GPS/Haversine fallback and parked-state handling from `DriveOS-auto-detection` into the authoritative local-first mobile code, including persisted position state and two regression tests. Ported the approved Tessie logos and web dashboard branding from `DriveOS` while discarding its redundant merged patch/bundle and root Expo stub.
- Archived the non-merged concepts before cleanup: cinematic Memories as `0172397` on `origin/codex/cinematic-memories`, and the superseded companion API prototype as `356e862` on `origin/codex/ios-companion-screens`. The Siri/commute history remains backed up on `origin/feat/siri-shortcuts-4.4.1`.
- Verification passed after the ports: mobile typecheck; the complete mobile unit suite (including drive detection 11/11 and tab runtime 9/9); frontend module characterization; Playwright E2E 9/9; gitleaks with no findings; and `git diff --check` with only Windows line-ending notices.
- `agy/journeydeck-1.6` correctly tracks `origin/agy/journeydeck-1.6` and is the sole active development worktree. `C:\Users\patri\DriveOS` remains registered and clean because it is Git's main worktree and owns the shared `.git` database; converting/removing that anchor is a separate repository-migration operation. The stale AO process chain was terminated and its unregistered orchestrator directory was deleted.

### Automatic-drive fallback preview OTA (published)

- Published the fully consolidated iOS JavaScript/assets bundle from source commit `021a16b` to the `preview` branch for runtime `1.6.0`; no native build was used.
- Update group `c3ac8acd-4d78-41d5-9260-2f5bb3697bd3`, iOS update `01a03fd7-c8fe-72aa-a79c-734c4c81b728`, message `Improve automatic drive detection for unknown GPS speed`.
- Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/c3ac8acd-4d78-41d5-9260-2f5bb3697bd3`. EAS verified this group is the current head of the `preview` branch.

### Native runtime 1.8 build (2026-08-27)

- Runtime 1.8 native preparation is committed and pushed on `codex/native-runtime-prep` as `75b3ea2` (`feat(mobile): prepare native runtime 1.8`). The source worktree was clean before the build.
- The additive CloudKit development schema was imported and deployed to Production for `iCloud.com.journeydeck.recorder`; it adds the `RouteArchive` transport needed for exact private GPS-route backup.
- EAS iOS development build `52293c70-e47a-4a66-bfca-105324a267c5` finished successfully for app/runtime `1.8.0`, build number `3`, preview channel, physical registered iPhone, and exact commit `75b3ea2`: `https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/52293c70-e47a-4a66-bfca-105324a267c5`.
- Verification already passed before building: mobile typecheck, full mobile tests 103/103, Expo Doctor 21/21, iOS JS export, and `git diff --check`. EAS then passed the native Swift/Xcode compile and signing gate.
- Next: install the 1.8 development build on the registered iPhone, connect it to Metro, and run acceptance checks for private CloudKit route/photo/preference/tombstone sync, permission recovery, background recording, sign-out/profile switching, and disposable-account deletion. Do not test deletion with the primary account.
- Tailscale Serve remains active at `https://superredux.tail1babbd.ts.net:8081`, and a hidden Metro dev-client process was started from `mobile/recorder` with LAN/IPv4 binding. Both `http://127.0.0.1:8081/status` and the private Tailscale `/status` endpoint returned HTTP 200. Metro logs are under `C:\Users\patri\AppData\Local\Temp\journeydeck-metro-18`.

### Runtime 1.8 Home visual concepts (2026-08-27)

- Generated five high-fidelity Home-screen directions under `docs/design/home-mockups/`: Aurora Road, Liquid Glass Dashboard, Cinematic Memory, Living Atlas, and Road Radio Editorial.
- The shared visual direction uses the existing JourneyDeck coral/violet identity with consistent iOS typography, mesh-gradient haze, liquid-glass depth, SF Symbols, rich imagery, and Skia-style route/data artwork. No application code was changed for this design exercise.
- Recommended implementation starting point: Aurora Road's hierarchy with Liquid Glass Dashboard's component system; reuse the strongest memory, atlas, and soundtrack modules from concepts 3–5 in their corresponding sections.

### Runtime 1.8 cinematic Home trial (2026-08-27)

- Rebuilt only the mobile Home dashboard around concept 3 (`Cinematic Memory`); the other tabs are unchanged. The new hierarchy is a profile-led editorial header, photographic latest-memory hero, real recorded route/song overlay, recorder status glass card, story rail, road soundtrack card, compact weekly summary, and four existing section links.
- Added one native MeshGradient atmosphere, bounded native Liquid Glass surfaces with BlurView fallback, staggered Reanimated entrances, Expo Image transitions, hierarchical SF Symbols, and direct SVG route rendering. The Home hero does not mount a map or request map tiles.
- Added an editable Home profile photo and greeting. The resized image and name are stored as the active user's versioned private preference and therefore follow the existing private CloudKit preference transport; no JourneyDeck server is involved.
- Verification passed: mobile TypeScript, focused Home/tab runtime 15/15, complete mobile suite 104/104, iOS Expo export (1,465 modules, 4.2 MB Hermes bundle), and `git diff --check` aside from Windows line-ending notices. Metro remains reachable locally on port 8081. No commit, push, OTA, or native build was performed.

### Runtime 1.8 cinematic Home visual correction (2026-08-27)

- Compared the first implementation against three real-device screenshots and the selected concept. The device build was too uniformly purple, its glass was milky and flat, its outlines were simple strokes, the hero used an unrelated portrait, and its typography/placeholder cards did not match the editorial concept.
- Reworked Home to a near-black optical canvas with localized coral/violet smoke fields, clear native glass over a dark optical material, separate aura/specular/inner-rim layers, warm hero edge light, Georgia editorial display type, a tighter story rail, and a simplified hierarchy without the extra recorder card between the hero and Stories.
- Generated and bundled four project-specific photographic assets: a rainy downtown highway hero plus Night Drives, Coffee Runs, and Summer Roads story art. The hero now always uses the road image and overlays the user's real route/song data; the selected journey prefers a meaningful nonzero route instead of a malformed zero-mile latest item.
- Verification passed after the correction: mobile TypeScript, focused Home/tab runtime 15/15, complete mobile suite 104/104, iOS Expo export (1,468 modules, 4.3 MB Hermes bundle with all four new assets), and `git diff --check` aside from Windows line-ending notices. No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home hero context correction (2026-08-28)

- Removed the decorative numbered route, its fallback/Dallas-area geometry, the redundant ellipsis action, and the oversized purple circle/bloom from the Home hero. The route remains available in the journey detail, where it has useful map context.
- Home now selects the newest locally stored journey rather than substituting an older drive merely because it has a complete route. The title is time-aware (`Tuesday evening drive`), while the secondary line uses only the stored start/end labels; all invented Fort Worth, Downtown, distance, duration, and song-count fallbacks are gone. Empty/syncing states use explicit neutral copy.
- Updated the focused Home runtime characterization test. Verification: `npm run typecheck`, `npm run test:tab-runtime` (15/15), and `git diff --check` (only pre-existing Windows line-ending warnings). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home time-of-day hero scenes (2026-08-28)

- Added generated morning, afternoon, and evening cinematic freeway images alongside the existing night hero. Home selects a scene from the newest drive's local start time: 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–20:59 evening, otherwise night; missing or invalid timestamps deliberately use night.
- Images are saved at `mobile/recorder/assets/home-cinematic-hero-{morning,afternoon,evening}-v1.png`; `home-cinematic-hero-v2.png` remains the night scene. Generated via the built-in image-generation workflow and visually inspected before use.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home clear-sky pass (2026-08-28)

- Replaced every time-of-day hero scene after visual review: morning now uses open blue sky with small peach clouds, afternoon is clear and sunlit, evening has a restrained blue-hour/coral sky, and night is clear indigo with a subtle star field. The skyline/freeway visual language and upper-left copy-safe area remain.
- The app now consumes `home-cinematic-hero-morning-v2.png`, `-afternoon-v2.png`, `-evening-v2.png`, and `-night-v1.png`. Prior v1 day assets and the former night asset remain unreferenced; no existing generated asset was overwritten.
- Generated via the built-in image-generation workflow and visually inspected. Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home Memories rail (2026-08-28)

- Replaced the generic `Your stories` rail with `Memories`. It now draws only genuine Memory records from the same private catalog used by the Memories page, sorted newest-updated first, capped at five. Placeholder story/collection cards and invented counts are removed.
- Added a final `See more` card after the actual memories; its accessible action opens the existing Memories tab. Individual Home memory cards also open that tab. Each card shows its genuine cover (or the shared Memory artwork fallback) and actual collection count.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home liquid-glass edge pass (2026-08-28)

- Added reusable `LiquidGlassEdges` optical treatment: top specular sweep, left/right refraction, bottom reflection, and a translucent continuous outline. It now wraps the Home hero, every memory card including `See more`, all `CinematicGlass` surfaces (soundtrack/profile sheet), and the floating navigation dock.
- Removed the former single warm hero edge and flat card rims so the glass reads consistently around every edge without a decorative circle or one-sided stroke.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home 3D glass-pane correction (2026-08-28)

- Reworked `LiquidGlassEdges` after feedback that the first pass read as a flat highlight. Each Home widget edge now uses a physically thicker rounded pane treatment: three-point outer bevel with separately lit top/left and shaded right/bottom, deep specular edge ramps, plus a five-point inset rim. This replaces the visual impression of a simple outline with a raised rounded glass surface.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home glass-stripe correction (2026-08-28)

- Removed the visually intrusive white edge stripes from every liquid-glass pane. The outer/inset borders and top/side ramps now use restrained transparent violet/coral tones; bevel widths and highlights were reduced so the pane depth remains without a bright outlined frame. The glass material's original pale border was changed to a muted violet as well.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home profile-avatar alignment and Skia glow (2026-08-28)

- Aligned the Home profile photo through a dedicated 76-point header anchor so its 68-point touch target and 64-point visual ring line up cleanly with the wordmark rather than drifting via an internal margin. The edit badge remains attached to the avatar.
- Used the installed `@shopify/react-native-skia` runtime for two blurred coral/violet circles directly behind the ring, giving the profile edge a soft, contained glow. This is an implementation use of Skia; no separately named `skira` skill is available in the workspace.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home profile-avatar header centering (2026-08-28)

- Moved the avatar anchor down 26 points, vertically centering the photo against the full Home header copy block rather than its upper wordmark edge. The Skia glow and edit badge move with it.
- Verification: `npm run typecheck` passed. No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home shared Skia widget outlines (2026-08-28)

- Added `SkiaWidgetOutline` inside the shared liquid-glass edge layer. It measures each rounded widget and draws a blurred coral perimeter plus crisp violet rounded-rectangle stroke using the same Skia color family as the profile avatar. Consequently the hero, Memory cards, See more card, soundtrack/profile panes, and floating dock share the avatar's glowing-outline language without white stripes.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Home neon-gradient outline correction (2026-08-28)

- Replaced the uniform Skia widget outline with the profile-photo ring's intended neon language: a thin coral → hot pink → violet → blue → coral rounded-rectangle perimeter plus a blurred duplicate beneath it for the halo. All Home widgets using the shared edge layer now receive this color-changing outline.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 shared cross-page neon widgets (2026-08-28)

- Extracted the Home Skia neon perimeter into `src/neon-widget-outline.tsx`, with both an overlay primitive and a rounded widget wrapper. It preserves the shared coral → pink → violet → blue gradient plus halo.
- Applied it to the Recorder cards/status/metrics, Music metrics/panels/albums, primary Statistics widgets/empty states and the main Live/Atlas score/pattern/track cards, plus vehicle intelligence metrics, charging, place, and empty cards. Home continues using the same shared primitive, so the neon outline now has one source of truth across these mobile page widgets.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 missed-widget and Tessie Live correction (2026-08-28)

- Applied the shared coral → pink → violet → blue Skia perimeter to the previously missed More search/tile/local-first widgets, Data Health release/health/network/profile/retention/row widgets, and all Atlas/Live map states and frames.
- Live now checks the profile-scoped Tessie connection when its tab becomes active and requests the existing Tessie snapshot. Returned live battery and range replace archived placeholders, and the centered status line now explains whether Tessie is refreshing, unavailable, or temporarily failing rather than silently showing dashes.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15); `git diff --check` has no whitespace errors (only existing CRLF conversion warnings). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Memories neon-widget completion (2026-08-28)

- Added the shared neon perimeter to the Memories hero/header, tab control, search field, filters/sorts, favorite route widgets, Journey Library rows, collection cards, empty/error states, and quick Collection action.
- Corrected the shared outline stacking so it is always painted above card artwork and text, without capturing touch input. This fixes image-led widgets such as the Memories header and carousel that previously hid their outline beneath the artwork.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Runtime 1.8 Atlas neon-widget completion (2026-08-28)

- Added the shared neon perimeter to Atlas frequent-place selectors, the selected place-detail widget and its route actions, recurring-pattern action buttons, and representative-route rows. The map/pattern card perimeter from the preceding pass remains in place.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Metro through Tailscale recovery (2026-08-28)

- Diagnosed the lost development connection as Metro being stopped while Tailscale Serve still held the tailnet-facing `:8081` port. Restarting Metro on the same port initially collided with that listener.
- Metro is now running in `--dev-client --host lan` mode on local port `8081`, and Tailscale Serve proxies the tailnet-only endpoint `https://superredux.tail1babbd.ts.net:8082/` to `http://127.0.0.1:8081`. Both the local Metro status endpoint and the Tailscale HTTPS endpoint returned HTTP 200 at recovery time.
- No source code, dependencies, commits, OTA, or native build changes were made for this recovery. The development client must use the new `:8082` endpoint rather than the former tailnet `:8081` URL.

### Metro through Tailscale compatibility restoration (2026-08-28)

- The installed iOS development client was still configured for the original `https://superredux.tail1babbd.ts.net:8081/` bundle endpoint. Reconfigured Metro to run locally on `127.0.0.1:8082` and moved the tailnet-only Tailscale proxy back to external `:8081` → local `:8082`.
- Verified the exact iOS `index.ts.bundle` request shown in the red error screen returns HTTP 200 (10.6 MB) through the original external `:8081` URL. The iPhone can recover by tapping Reload JS; no reconfiguration of its dev-server URL is needed.

### Metro black-screen follow-up (2026-08-28)

- After the client briefly loaded then showed a black screen, rechecked the full path: Metro remains running on local `:8082`; the tailnet `:8081` proxy serves the exact iOS bundle URL with HTTP 200; the iPhone responded to a direct Tailscale ping; and `npx expo export --platform ios` completed successfully (1,728 modules).
- The original connection outage was Metro being stopped. The later black screen is a separate on-device runtime symptom; the compiler/export cannot expose a native/runtime exception without an iPhone error report or device logs. No source changes were made during this diagnosis.

### Metro dual-endpoint Tailscale recovery (2026-08-28)

- The subsequent iPhone error showed this development client is saved to the `:8082` URL, whereas an earlier client used `:8081`. Metro now runs locally on port `8083`; both tailnet-only HTTPS endpoints, `:8081` and `:8082`, proxy to that local Metro listener.
- Verified both HTTPS status endpoints return HTTP 200, and the exact iOS bundle request at the screenshot’s `:8082` URL returns HTTP 200 (10.6 MB). No source, dependency, commit, OTA, or native build changes were made.

### Metro stable advertised-origin correction (2026-08-28)

- The iPhone then showed Metro had advertised its internal port (`:8083`) after a proxied load, causing a port-chasing failure. Restarted Metro locally on `:8084` with Expo’s `EXPO_PACKAGER_PROXY_URL` pinned to `https://superredux.tail1babbd.ts.net:8081` so future client URLs use the stable tailnet origin.
- Added temporary tailnet-only compatibility proxies on external `:8081`, `:8082`, and `:8083`, all targeting local Metro `:8084`. The exact iOS bundle request returns HTTP 200 (10.6 MB) through each port; a client currently saved to `:8083` can now recover and should subsequently be directed to `:8081`.

### Metro/Tailscale clean reconfiguration (2026-08-28)

- Removed the temporary Tailscale Serve proxies on `:8082` and `:8083` and stopped the prior Metro instance. There is now exactly one Metro bridge: local Metro on `127.0.0.1:8085`, proxied through the tailnet-only canonical endpoint `https://superredux.tail1babbd.ts.net:8081/`.
- Restarted Expo with `EXPO_PACKAGER_PROXY_URL` correctly set before process launch. The generated iOS bundle’s `sourceMappingURL` now explicitly uses the canonical external `:8081` address, confirming Metro will no longer advertise its private local port to the dev client. The canonical bundle endpoint returned HTTP 200.
- The iPhone dev client has a stale `:8084` URL stored. In the development launcher, use **Enter URL manually** once with `https://superredux.tail1babbd.ts.net:8081`; it should persist that canonical URL afterward. No source, dependency, commit, OTA, or native build changes were made.

### Atlas route-thread inner controls (2026-08-28)

- Implemented the selected Atlas mockup direction in `src/primary-sections.tsx`: Place Details related routes now use an unboxed vertical coral → violet route thread with glowing nodes and understated separators, rather than nested neon rectangles.
- Replaced Recurring patterns’ outlined Confirm/Dismiss mini-cards with compact icon-led glass controls. The confirmed state uses a restrained teal indicator; dismiss stays neutral. Main outer card neon perimeters are unchanged.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Metric inset-frame and compact Atlas labels (2026-08-28)

- Replaced the small Live/current-journey neon-outline metric boxes with quiet inset frames: muted structural rim, contained coral → violet → blue top accent, centered tabular values, and separate label padding. This eliminates the perimeter stroke crossing the small-card text.
- Ensured recurring-pattern copy renders above its outer neon perimeter. Pattern route labels now remove the trailing country and ZIP/postal code before rendering, leaving the useful street/city/state context without the long address overflow.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15). No commit, push, OTA, or native build was performed.

### Header artwork replacement (2026-08-28)

- Added the supplied Recorder, Timeline, Statistics, and Settings header artwork to `mobile/recorder/assets/` and wired each corresponding page to display its artwork in place of the former generated title header. The frame is clipped and slightly enlarged at render time so the neon border fills the header cleanly.
- Verification: `npm run typecheck` passed after the implementation. No commit, push, OTA, or native build was performed.

### Metro/Tailscale IPv4 listener recovery (2026-08-28)

- Metro had stopped again. Restarted it as a detached process on local `127.0.0.1:8085`, with `NODE_OPTIONS=--dns-result-order=ipv4first` so Expo's localhost mode does not bind only to IPv6. The persistent canonical tailnet bridge remains exactly `https://superredux.tail1babbd.ts.net:8081/` -> `http://127.0.0.1:8085`.
- Verified both the local and external HTTPS `/status` endpoints return Metro's `packager-status:running`. Metro no longer depends on the Codex desktop session, but this PC must remain awake, online, and signed into Tailscale.

### Header artwork uncropping (2026-08-28)

- Removed the 1.08 image scale from the Recorder, Timeline, Statistics, and Settings artwork headers. Their containers now use the source 1376:768 aspect ratio, preserving the complete top and bottom of each neon border.
- Verification: `npm run typecheck` passed. No commit, push, OTA, or native build was performed.

### Header artwork edge blending (2026-08-28)

- Added a shared `HeaderArtwork` renderer for the Recorder, Timeline, Statistics, and Settings artwork. It feathers each image's black canvas into the surrounding page color on all four sides, preserving the full neon frame while removing the visible black rectangle.
- Verification: `npm run typecheck` passed. No commit, push, OTA, or native build was performed.

### Header artwork canvas removal (2026-08-28)

- Replaced the attempted in-app edge feather with four cropped `*-header-hero-v2.jpg` assets. Each crop is calculated around its neon border with a four-pixel glow safety margin, removing the black canvas rather than disguising it.
- `HeaderArtwork` now uses each cropped asset's actual aspect ratio, so the individual crop dimensions render without stretching or additional clipping. Verified the Settings crop visually and ran `npm run typecheck` successfully. No commit, push, OTA, or native build was performed.

### Circular profile glow cleanup (2026-08-28)

- The square behind the Home profile photo was a rectangular Skia glow/shadow canvas, not the already-circle-clipped photo. Replaced it with a circular React Native glow and gave the pressable shadow a matching circular radius, preserving the neon ring while removing the square backdrop.
- Verification: `npm run typecheck` passed. No commit, push, OTA, or native build was performed.

### App-wide visual hierarchy polish (2026-08-28)

- Reworked the shared widget language into three purposeful layers: restrained gradient rims for ordinary cards, brighter neon only for major hero panels, and a dedicated warm-orange selected state. `NeonWidget` no longer stacks a native border beneath its shared Skia perimeter, eliminating the double-outline effect.
- Added a reusable quiet inset surface for dense metrics and small controls. Recorder now presents its operational figures in a legible 2-by-2 grid; Music and vehicle metrics use the same low-noise treatment. Atlas frequent-place selection uses the orange selected perimeter without competing purple rings.
- Softened liquid-glass bevels, background blooms, panel shadows, and dock selection treatment. Memories tabs/filters now communicate selection with a restrained orange fill and glow instead of a second hard border. The global content veil now starts closer to the dock, so scrolling content stays clear until it genuinely passes behind navigation.
- Updated the runtime regression checks for the intentional circular avatar glow and the shared quiet inset implementation.
- Verification: `npm run typecheck` and `npm run test:tab-runtime` (15/15) passed; `git diff --check` found no whitespace errors (only existing CRLF conversion warnings). No commit, push, OTA, or native build was performed.

### Live and Atlas header artwork selection (2026-08-28)

- Generated two header directions each for Live and Atlas, then installed the user-selected Live telemetry image and Atlas globe/navigation image as `assets/live-header-hero-v2.png` and `assets/atlas-header-hero-v2.png`.
- Cropped each selected high-resolution source tightly around its full neon frame with a small glow safety margin. The resulting assets have no surrounding black canvas and preserve the complete border.
- Wired both destination scaffolds to use the new artwork, replacing their former text-only page headers. The header regression test now covers the two asset references.
- Verification: visually inspected both cropped PNGs; `npm run typecheck` and `npm run test:tab-runtime` (15/15) passed. No commit, push, OTA, or native build was performed.

### Public-release honesty phase (2026-08-28)

- Removed the preview-only `JourneyDeck Pro · $4.99 / month` membership card. The public product now makes no subscription or paid-tier claim.
- Public builds now expose Apple Music and ShazamKit Auto Recognition only. Last.fm and direct Spotify are gated to `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=1` at the preferences, queue/sync, OAuth, and Settings UI boundaries; production keeps that flag at `0`. Existing local preview credentials are preserved for an internal build but cannot activate these paths in a public build.
- Changed `mobile/recorder/app.json` from the preview privacy-edge origin to the documented production origin, `https://journeydeck-edge.patrickbstewart.workers.dev`.
- Added `mobile/recorder/APP_STORE_RELEASE.md` and updated its README with the actual public scope and the remaining external gates: hosted privacy/support URLs, production CloudKit deployment and device deletion/sync validation, public integration permissions, App Store privacy labels, review notes, metadata, and TestFlight verification.
- Added `tests/public-release-integrity.test.mts`; updated the Last.fm test wording to reflect its internal-only status. Updated Expo patch versions to `expo ~57.0.18`, `expo-font ~57.0.2`, and `expo-updates ~57.0.19` to clear Expo Doctor.
- Verification after the changes: `npm run typecheck` passed; `npm test` passed 108/108; `npx expo-doctor` passed 21/21; `npx expo export --platform ios` completed (1,735 modules); `git diff --check` passed apart from existing CRLF conversion notices. No commit, push, OTA, EAS build, App Store submission, or production deployment was performed.
- `npm audit --omit=dev --json` currently reports 13 moderate advisories, largely through Expo config/CLI tooling; its offered "fix" is an incompatible downgrade to Expo 46 / MapLibre 11.3.2. Do not run `npm audit fix --force`; triage with a compatible Expo SDK update before the final submission release.

### App Store preflight artifacts (2026-08-28)

- Audited the public website endpoints from the release checklist. `https://journeydeck.me/privacy` and `https://journeydeck.me/support` currently return HTTP 302 to the private `/login` page, so neither URL is usable for App Review yet. No website or production deployment was changed.
- Added local App Store materials under `docs/app-store/`: App Store Connect metadata and screenshot plan, ready-to-paste review notes, a privacy-label worksheet, and a publication-ready privacy-policy draft with explicit legal-owner/contact placeholders. These drafts deliberately do not invent a support email or legal entity.
- Added `scripts/public-release-preflight.mjs` and the `npm run preflight:public-release` command. It verifies production configuration and requires public HTTPS privacy/support pages that return a 2xx HTML response, do not redirect to login, contain meaningful content, and expose a support contact method. The release-integrity test statically covers this gate.
- Verification: `npm run typecheck` passed; `npm test` passed 109/109; `npx expo-doctor` passed 21/21. Running the new preflight against the current production URLs correctly fails only for the two HTTP 302 login redirects. No commit, push, OTA, EAS build, website publish, CloudKit deployment, or App Store submission was performed.
- Next external-release gate: obtain the legal owner name and a monitored privacy/support contact, then create public `/privacy` and `/support` pages (and an in-app Privacy Policy link), deploy them with explicit authorization, rerun the preflight, complete App Store Connect privacy answers from the worksheet, and validate a production CloudKit/TestFlight build on physical devices.

### App Store public legal-page implementation (2026-08-28)

- Received the public legal owner name, Patrick Benjamin Stewart, and support/privacy contact, `Journeydeckme@gmail.com`. Used them only in the public legal/support materials and App Store drafts; no secret or private journey data was added.
- Added `web/privacy.html`, `web/support.html`, and `web/public-page.css`. The pages provide a static, accessible Privacy Policy and support email link without a backend form, trackers, or private data. Updated `server/src/app.ts` so `/privacy`, `/privacy.html`, `/support`, and `/support.html` bypass authentication and are served as static public pages.
- Added a public Privacy Policy link to the native Settings privacy/iCloud card. Updated the App Store metadata, review-note, and privacy-policy source drafts with the supplied name and email; App Review phone remains explicitly required before submission rather than guessed.
- Added server coverage proving the legal pages return public HTML without a JourneyDeck session and mobile coverage proving Settings retains the public policy link.
- Verification: `npm run test:server` passed 32/32; `npm run check:server` passed; `npm run typecheck` passed; mobile `npm test` passed 110/110; `npx expo export --platform ios` passed (1,735 modules). The production `npm run preflight:public-release` correctly still fails because the live site has not been deployed and returns HTTP 302 login redirects for both URLs.
- Next step: review the public legal language and App Review phone number; then, with explicit deployment authorization, deploy the website/server changes, verify the live URLs return public 2xx HTML, rerun `npm run preflight:public-release`, and continue CloudKit/TestFlight/App Store Connect completion. No commit, push, production deployment, OTA, EAS build, or App Store submission was performed.

### Public legal-page production deployment (2026-08-29)

- With explicit user authorization, created and merged PR [#134](https://github.com/drumpat01/DriveOS/pull/134), producing `main` commit `dffe2c7a157ca843879674c9515961a7518f52bc` (`Publish JourneyDeck legal and support pages`). The deployment contained only `server/src/app.ts`, its route regression test, and the three public web assets; no ongoing mobile redesign files were included.
- GitHub’s full JourneyDeck CI passed. Local release preflight, server typecheck, and server tests also passed before push.
- The first Render deployment of that commit failed because an existing Tessie database-read rollout guard rejected a stale `tessie/drives` cursor; logs showed a compatibility-process crash loop and the site returned 502. Applied the documented reversible production rollback, `JOURNEYDECK_TESSIE_DB_READ_ENABLED=false`, preserving provider-backed Tessie history. Render deployment `dep-da92lq49v7es73d1q5n0` is now `live` on the same commit. The repository `render.yaml` still declares the prior `true` rollout value; reconcile it with a fresh parity/readiness review before a later infrastructure/Blueprint sync.
- Verified `https://journeydeck.me/privacy` and `https://journeydeck.me/support` return public HTTP 200 HTML with the expected policy/support text and support email. `mobile/recorder`'s `npm run preflight:public-release` now passes against the live URLs.
- No TestFlight build, OTA update, CloudKit production migration, or App Store submission was performed. The in-app Privacy Policy link remains in the uncommitted mobile App Store-prep work and must be included in the eventual production/TestFlight build. Remaining App Store work: privacy-label answers, App Review phone number, production CloudKit/device verification, TestFlight build, and App Review submission.

### TestFlight build 8 upload (2026-08-29)

- Apple rejected build 6 during processing with `ITMS-90683` because `expo-image-picker` removed `NSMicrophoneUsageDescription` when configured with `microphonePermission: false`. Commit `0a507e4` (`fix(mobile): preserve microphone privacy purpose`) gives the plugin and explicit Info.plist key the same accurate Auto Recognition purpose string and adds a regression check. Typecheck, 113/113 tests, Expo Doctor 21/21, iOS config introspection, and iOS export passed.
- EAS build 7 (`7f79f6d6-5168-41f3-826e-37f80575d7bc`) failed before compilation with Expo error `CREDENTIALS_TEMPORARY_NETWORK_ERROR`; it produced no artifact. A fresh build 8 (`749e9852-89c5-4323-ac12-5facb3e56476`) from exact commit `0a507e4` completed successfully.
- Added the non-secret App Store Connect app ID `6806502526` to `mobile/recorder/eas.json` under `submit.production.ios.ascAppId`; this configuration change is currently uncommitted. EAS submission `172e2133-5d04-4eb4-a1c9-571f58f24543` successfully uploaded JourneyDeck 1.8.0 (8) to App Store Connect using API key ID `3S6UPKF5SP`. Apple is processing the binary; next step is to open the TestFlight iOS page after processing, attach build 8 to the internal group, answer any export-compliance prompt, and install through TestFlight.

### TestFlight account-deletion fix / build 9 (2026-08-29)

- Build 8 installed successfully through TestFlight, preserved the existing local profile, reported version 1.8 (8), and showed the signed-in driver/iCloud state as synced. Attempting the in-app full account deletion then failed on a private photo with Expo `FileNotWritableException`; the SDK 57 legacy delete implementation checked a path ending in `photo.jpg/..` and stopped before Keychain/local cleanup. The app correctly retained the local profile instead of falsely reporting success. The private CloudKit zone deletion runs before photo cleanup and is idempotent, so retrying is safe.
- Replaced only the legacy per-photo delete call with Expo's current `File` API (`exists` then `delete`) while retaining fail-closed behavior for real removal failures. Added a regression assertion and committed the exact release patch plus the App Store submission ID configuration as `0c40416` (`fix(mobile): complete private account deletion`). Verification: typecheck passed, targeted lifecycle tests passed 4/4, full mobile tests passed 113/113, and `git diff --check` reported only existing line-ending warnings.
- Clean detached worktree `C:\Users\patri\.codex\tmp\journeydeck-testflight-0c40416` reproduced commit `0c40416`. EAS build 9 ID `db03df08-d8be-4e41-8690-990424720a7c` finished successfully. EAS submission `839e5d6e-9323-450e-86c2-c0011b74ff8e` uploaded JourneyDeck 1.8.0 (9) successfully to App Store Connect. Next: wait for Apple processing, install/update build 9 in TestFlight, retry **Delete JourneyDeck account**, and only after successful completion delete/reinstall the app to validate a clean new-user experience.

### Honest empty soundtrack state (2026-08-29)

- Clean reinstall testing exposed that Home's empty music widget rendered hard-coded demo content (`Midnight City`, `M83`, mock album artwork, waveform, and play icon) before any journey or detected music existed. Replaced it with an explicit clean state: `Music will appear here`, `After your first drive`, a neutral music-note treatment, setup hint, and navigation arrow. Genuine soundtrack data retains the existing artwork/waveform/play presentation.
- Committed as `ff75d37` (`fix(mobile): show an honest empty soundtrack`). Verification: `npm run typecheck` passed, `npm run test:tab-runtime` passed 16/16, and diff check reported only existing line-ending warnings. This correction is **not** in TestFlight build 9; include it in the next bundled TestFlight build (or explicitly authorized OTA) before final first-launch validation.

### App icon portal JPEG (2026-08-29)

- Exported the existing production `mobile/recorder/assets/icon.png` non-destructively as `docs/app-store/assets/JourneyDeck-App-Icon-Master-1024.jpg`. The source artwork was preserved exactly; the JPEG is a 1024×1024, 24-bit RGB, maximum-quality portal/marketing master with an opaque dark background. The source PNG is 512×512. No AI regeneration or logo redesign was used, and no build, submission, or OTA was triggered.
- Also created `docs/app-store/assets/JourneyDeck-App-Icon-Master-Transparent-1024.png`: a tightly framed 1024×1024 ARGB PNG. The dark canvas outside the neon squircle is transparent, the colored outer glow uses partial alpha, and the black icon interior remains opaque. This is a deterministic mask/crop of the production artwork, not a generated or redesigned logo.

### Journey-detail map and saved-place correction (2026-08-29)

- Removed the duplicate light route map from the journey-detail summary hero. The summary now uses a compact dark gradient treatment, while the existing dark interactive `ROUTE + SONG LOCATIONS` map remains the single journey map.
- Fixed saved start/destination names for GPS-only local journeys. Local endpoints now receive stable, coarse coordinate identities (with journey-specific fallbacks), the identity and raw label survive local/cached merges, and aliases are reapplied to details, history, and dashboard fallbacks after reopening. Saving a name also refreshes the complete primary-section model so Memories, Home, Timeline, Search, and Atlas do not retain stale labels.
- Brightened the exported share-card basemap while preserving the JourneyDeck palette: near-black land, substantially clearer violet street/label detail, a lighter Street overlay, and the existing coral-orange real route.
- Verification before publication: `npm run typecheck` passed; focused journey/location/share tests passed 34/34; full mobile tests passed 118/118; `npx expo export --platform ios` completed successfully (1,756 modules). The temporary export folder was removed.
- With explicit user authorization, published the verified dirty working tree as an iOS-only production OTA for runtime `1.8.0`. Update group: `bba2ff27-b229-4498-a34d-efd001d5ba03`; iOS update: `01a050bb-6375-71d7-836a-3f8e134cce94`; message: `JourneyDeck 1.8: one journey map and persistent place names`. EAS channel verification confirms this is the current `production` head.
- No commit, push, native EAS build, TestFlight upload, build 10, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source fixes remain uncommitted and must be included in the next reproducible release commit.

### Dynamic journey identity and hero redesign (2026-08-30)

- Removed the repetitive `Journey overview / Journey / Recorded journey` hierarchy. The detail modal now reads `Road memory / Drive details`, while its summary card receives a distinct drive title.
- Added deterministic title priority: saved endpoints (`Home → Work`) first, then a privacy-safe city title (`Saginaw drive`) using the existing coarse two-decimal reverse-geocode cache, then an offline time-aware fallback (`Saturday evening drive`). The same fallback replaces `Recorded journey` in journey lists.
- Replaced the summary card's flat gradient blobs with a map-free neon road-light SVG treatment. The interactive dark route map remains the only map in the detail.
- Added focused title tests and expanded the journey-detail structural regression test. Verification: `npm run typecheck`, `npm run test:tab-runtime` (20/20), `npm run test:network-boundary` (8/8), and full `npm test` (121/121) passed. `git diff --check` found no whitespace errors beyond existing CRLF notices.
- With explicit user authorization, published the verified dirty working tree as an iOS-only production OTA for runtime `1.8.0`. Update group: `d86a21e3-a97a-49b4-8e52-ab696e490d2b`; iOS update: `01a052b2-dd11-7db2-996d-e9b45af974f8`; message: `JourneyDeck 1.8: dynamic journey titles and neon drive header`.
- No commit, push, native build, TestFlight upload, build-number change, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source changes remain uncommitted.

### Tesla built-in media capture through Tessie (2026-08-30)

- Added a stateless `POST /api/vehicle/tessie/media` privacy-edge route. It uses the existing profile-scoped Tessie token, requests Tesla Fleet API `media_info`, and returns only bounded title, artist, album, source, station, playback status, duration, elapsed time, and sample time. VINs, coordinates, and unrelated vehicle state are stripped and never returned or logged.
- During an active journey with Apple Music selected, the location task now samples Tessie at most once every 30 seconds. Playback position is used to estimate the song start time, and the resulting local `apple_music` observation attaches to the nearest recorded route point. Tessie/network failure remains additive and cannot fail route recording or automatic finishing.
- Settings now includes **Test Tesla now playing** under the connected Tessie tile so a tester can play music through the Tesla's built-in player and verify the live metadata without starting a drive. This is the required physical-car validation step; mocked edge and timestamp tests pass, but a real Tesla response has not yet been observed by the development environment.
- Cloudflare production Worker version `244ff66f-91ee-4822-a79e-3170b09a0143` is deployed and healthy at `journeydeck-edge.patrickbstewart.workers.dev`. The missing-token media request fails closed with HTTP 400. Wrangler 4.127.0 types were regenerated and checked; Worker TypeScript and dry-run deployment checks passed.
- Verification: mobile typecheck passed; full mobile suite passed 123/123; focused music and edge privacy tests passed; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published an iOS-only production OTA for runtime `1.8.0`. Update group: `d4dd588e-3698-4035-ae7e-8903c77037b9`; iOS update: `01a053eb-8215-7bf7-912d-ee3d8080e639`; message: `Capture Tesla built-in media through Tessie`.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted. Next: fully close/reopen JourneyDeck twice to load the OTA, play a track in the Tesla's built-in Apple Music player, run **Settings → Tessie → Test Tesla now playing**, then complete a short drive and confirm its song and route pin.

### Tessie media response-path correction (2026-08-30)

- Physical-car testing returned `No Tesla media found` while the vehicle was awake, driving, and playing media. Root cause: Tesla nests the media block at `response.vehicle_state.media_info`; the initial edge parser checked only `response.media_info`.
- Updated the privacy-edge parser to accept the live nested shape plus bounded compatibility envelopes, and changed the regression fixture to match Tesla's actual response nesting while retaining the VIN/location non-disclosure assertion.
- Verification: `npm run test:cloudflare-workers`, mobile typecheck, Worker TypeScript, production health, and `git diff --check` all passed (only existing CRLF notices).
- Deployed corrected production Worker version `beb75ddd-735b-434b-ba86-4a47885577e1`. No OTA was necessary because the installed runtime already calls the same edge route; no mobile bundle changed after OTA group `d4dd588e-3698-4035-ae7e-8903c77037b9`.
- Next: with Tesla built-in media playing, retry **Settings → Tessie → Test Tesla now playing**. If it still reports no media, capture the displayed result and investigate whether this vehicle/firmware exposes media only through Tessie Fleet Telemetry rather than `vehicle_data`.

### Tessie vehicle-state selector and fallback OTA (2026-08-30)

- A second physical-car test still returned no media. Found the remaining REST flaw: `media_info` is nested within the top-level `vehicle_state` endpoint, so the Fleet API selector must be `endpoints=vehicle_state`; requesting `endpoints=media_info` produced a valid but empty response and never triggered the previous error-only fallback.
- Corrected the Fleet selector and added a second bounded read through Tessie's native `/{vin}/state` endpoint when Fleet vehicle state has no title/artist. Both response paths strip VIN, coordinates, and unrelated vehicle state before returning.
- The Settings test alert now distinguishes `no_active_vehicle` from `no_track_metadata`, making any further physical-car failure actionable rather than generic.
- Verification: mobile typecheck passed; full mobile suite passed 123/123; Worker TypeScript and production deployment dry run passed; production health is green; `git diff --check` found only existing CRLF notices.
- Deployed production Worker version `91196bdb-32b7-491c-a34d-30bdbb9d8086`.
- Published iOS-only production OTA for runtime `1.8.0`: update group `daa43d40-62db-466b-98e9-06ff589b4923`, iOS update `01a05415-4585-77a8-b6af-380b7cdf671f`, message `Fix Tesla built-in media state lookup`.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. Next: fully close/reopen JourneyDeck twice, then safely parked with Tesla built-in media playing, retry **Settings → Tessie → Test Tesla now playing** and report either the found track or the new specific alert title.

### Home latest-heard soundtrack correction (2026-08-30)

- Fixed the Home soundtrack card so it selects the newest timestamped song across the active recorder session and the local music archive. It no longer falls back to the first song in the latest journey or the all-time top track.
- The card now labels completed playback honestly as **Last heard on your road**. Title, artist, and artwork all come from the same selected song; a cached cover is reused only when normalized title and artist both match exactly.
- New or metadata-enriched recorder music observations now invalidate the visible local archive immediately. Artwork rendering uses Expo Image's memory-and-disk cache, so a newly resolved cover can replace the note placeholder without an app restart.
- Verification: `npm run typecheck` passed; focused Home and runtime tests passed; full mobile suite passed 131/131; `npx expo export --platform ios` completed successfully (1,759 modules); `git diff --check` reported no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `8cb64898-6fea-44c6-967c-44b622f842c9`, iOS update `01a055b0-fbda-704d-8b05-00c1ab669511`, message `JourneyDeck 1.8: keep Home on the latest heard song and artwork`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Persistent iOS location-indicator correction (2026-08-30)

- Diagnosed the always-visible blue Dynamic Island location arrow as an explicit app opt-in: both JourneyDeck background tasks set Expo Location's `showsBackgroundLocationIndicator: true`, even though the iOS/Expo default is false.
- Changed both automatic drive detection and active route recording to `showsBackgroundLocationIndicator: false`. Location permission, automatic drive detection, background execution, and exact route recording remain enabled. iOS can still show its ordinary small location arrow while GPS is actually accessed.
- Automatic detection now re-registers its native task options even when already running, allowing the OTA to replace the prior indicator presentation without disabling detection or waiting for a new native build.
- Verification: focused server-independence tests passed 14/14; TypeScript passed; full mobile suite passed 132/132; `npx expo export --platform ios` completed successfully (1,759 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `18412540-bfda-45a9-a009-7b4f08291446`, iOS update `01a055ba-cebe-723e-a208-bf87c405d533`, message `JourneyDeck 1.8: remove the persistent blue location indicator`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Tilted vinyl animation and album-caption correction (2026-08-30)

- Replaced the Soundtracks header's two rotating translucent triangular sheen wedges with one complete animated vinyl surface. The rendered disc now rotates as a unit—outer edge, grooves, asymmetric colored reflections, center label, and spindle—inside a circular clip whose parent is tilted with 3D perspective (`rotateX`). This keeps every moving detail on the platter throughout the rotation.
- Moved Today’s Soundtrack album captions five pixels farther inward (`paddingLeft: 7`) so titles and artists no longer collide with the card's left neon outline.
- Verification: `npm run typecheck` passed; `npm run test:tab-runtime` passed 24/24; full mobile suite passed 131/131; `npx expo export --platform ios` completed successfully (1,759 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `356e4a79-36d4-45e4-b680-fb782687ca6d`, iOS update `01a055b6-0927-7c52-8999-0d95879dcf5d`, message `JourneyDeck 1.8: rebuild the tilted vinyl animation and caption spacing`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Complete utility-header artwork correction (2026-08-30)

- Diagnosed Statistics, Timeline, and Settings side cropping as two combined layout issues: the source JPEGs are wider than the shared 1672:941 frame while `HeaderArtwork` used `contentFit="cover"`, and the utility header wrappers added a negative four-pixel horizontal bleed beyond the cards below.
- Changed the shared utility artwork renderer to `contentFit="contain"`, preserving every source-image edge within the common header size. Removed the negative horizontal bleed from primary utility and Settings header wrappers so their sides align with the standard 20-pixel content inset and surrounding cards.
- Verification: `npm run typecheck` passed; `npm run test:tab-runtime` passed 24/24; full mobile suite passed 132/132; `npx expo export --platform ios` completed successfully (1,759 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `aeef86ae-9e90-405b-84f5-e8b9ceaacbbd`, iOS update `01a055ca-5864-7b96-bcb3-3f8efa652f15`, message `JourneyDeck 1.8: show complete utility header artwork`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Memory cover-photo overlay correction (2026-08-31)

- Removed the generic `MEMORY 01` sequence label from populated Memory cards. Empty-state guidance remains unchanged.
- Replaced the tall grey lower overlay with a compact 92-pixel bottom gradient so substantially more of each cover photo remains visible. Tightened the title/metadata spacing to two pixels and retained subtle text shadows for legibility.
- Added a focused structural regression test. Verification: `npm run test:tab-runtime` passed 25/25; `npm run typecheck` passed; full `npm test` passed 133/133; `npx expo export --platform ios` completed successfully (1,759 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `964c50e0-698d-45e7-87b0-4df4c9d46722`, iOS update `01a0579e-c668-7a2b-b8f4-e0e2e694a268`, message `JourneyDeck 1.8: reveal more of Memory cover photos`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Memory collection-route alignment correction (2026-08-31)

- Rebuilt the decorative route beside a Memory's Collection chapters around one shared 16-pixel centerline. The route now has only a subtle organic bend and begins at the Collection list rather than bleeding upward across the `COLLECTIONS` heading.
- Replaced the disconnected circular chapter dots with coral map-pin SVG markers. Each pin tip is mathematically aligned to the route centerline, including as Collection card heights vary.
- Updated the focused structural regression coverage. Verification: `npm run test:tab-runtime` passed 25/25; `npm run typecheck` passed; full `npm test` passed 133/133; `npx expo export --platform ios` completed successfully (1,759 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `c49a8b7c-4749-48ba-82e6-2b48bd64d56b`, iOS update `01a057b4-9887-71bc-a107-97b718db7475`, message `JourneyDeck 1.8: align Memory route pins and timeline`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Version-1 Tessie shutdown (2026-08-31)

- Added one version-1 release gate, `TESSIE_INTEGRATION_ENABLED = false`, while preserving the Tessie implementation, edge routes, profile-scoped token, and cleanup code for a future release.
- Removed Tessie from both background-location promise batches used by automatic journey startup and active route recording. The dormant Tessie sampling function also fails closed before session, preference, Keychain, or network work.
- Tessie now reports unavailable through the app data boundary; cached Tessie vehicle data is excluded in favor of local journey-derived data. Hidden surfaces include the Settings Tessie connection flow, Tesla media test, Drive Intelligence entry point, Live connected-vehicle card, legacy Home health row, and Data Health provider row/copy. Existing stored credentials were not erased.
- Verification: `npm run typecheck` passed; `npm run test:drive-detection` passed 11/11; `npm run test:server-independence` passed 15/15; `npm run test:tab-runtime` passed 25/25; full `npm test` passed 134/134; `npx expo export --platform ios` completed successfully (1,760 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `ccbe5626-57ef-4812-997b-a771e6d36841`, iOS update `01a057fc-637a-7494-b680-c3b383ec965c`, message `JourneyDeck 1.8: disable Tessie for version 1`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted and must be included in the next reproducible release commit.

### Data Health Apple Music artwork refresh diagnostic (2026-08-31)

- Added **Refresh artwork now** to **Tools → Data Health → Apple Music artwork**. The control displays running, completed, and error states and reports how many local covers were updated, how many remain missing, and how many lookups failed.
- The diagnostic fetches fresh authorized Apple Music history, applies catalog artwork only to existing local songs with an exact normalized title-and-artist match, and then forces the bounded online artwork lookup for remaining gaps. It does not create listening plays or change journey history.
- Added an explicit forced-retry path that bypasses the normal 24-hour per-track artwork cooldown only for this user-triggered diagnostic. Routine background lookup behavior and its retry protection remain unchanged.
- Verification: `npm run typecheck` passed; `npm run test:tab-runtime` passed 26/26; `npm run test:network-boundary` passed 9/9; `npm run test:local-store` passed all 17 checks; full `npm test` passed 135/135; `npx expo export --platform ios` completed successfully (1,760 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `02a86b1c-4064-4fb6-b839-37cea563ea3d`, iOS update `01a0580f-4f77-7b02-aaf1-1f4aa65a0f92`, message `JourneyDeck 1.8: add Data Health artwork refresh test`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted and must be included in the next reproducible release commit.

### Non-blocking MusicKit artwork warning (2026-08-31)

- Physical testing showed album covers appearing even though Data Health displayed `Apple Music history could not refresh artwork yet`. The first implementation discarded MusicKit's original error and aborted before the independent iTunes catalog fallback, making the message both non-diagnostic and too severe.
- Split the native recent-history request from local enrichment. A MusicKit failure is now categorized as authorization, network/service, Media & Purchases account, or temporary/unknown; it is retained as an amber warning, and the forced online catalog lookup always continues.
- Data Health now reports recovered-cover counts, remaining missing covers, catalog retry counts, and any MusicKit warning together. Local database failures still escape as real errors rather than being mislabeled as an Apple history problem.
- The exact cause of the already-observed failure cannot be recovered because the prior code discarded the native exception. Since Data Health showed Apple Music connected, the authorization guard had passed and the failure was within `MusicRecentlyPlayedRequest.response()`, most plausibly a transient Apple service/network response or current Media & Purchases library availability issue. Future attempts will show the categorized reason.
- Verification: `npm run typecheck` passed; `npm run test:tab-runtime` passed 26/26; `npm run test:network-boundary` passed 9/9; `npm run test:local-store` passed all 17 checks; full `npm test` passed 135/135; `npx expo export --platform ios` completed successfully (1,760 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published iOS-only production OTA for runtime `1.8.0`: update group `6c4a4241-942f-452f-98b4-78b2f7154515`, iOS update `01a0581c-2c1b-7cc8-9403-fc0022981ab1`, message `JourneyDeck 1.8: continue artwork refresh after MusicKit warning`. Production-channel verification confirms this is the current head.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted and must be included in the next reproducible release commit.

### Membership-aware Statistics tab and 45-day story timeline (2026-08-31)

- Added a single membership-entitlement boundary. Free users now receive **Statistics** as the fifth primary tab; verified paid access is designed to replace it with the existing **Atlas** tab. Because StoreKit receipt verification is not implemented yet, version 1 deliberately fails closed to the free tier instead of trusting an editable local flag.
- Rebuilt Statistics as the selected story-led design. Its hero displays live rolling 45-day mileage and song totals, followed by longest-drive, top-artist, favorite-driving-time, and 45-day rhythm cards calculated from the local archive.
- Merged recent Timeline content into Statistics. It begins with 10 events and appends 10 per tap until the free 45-day cutoff; the paid entitlement branch permits all available history. Song events use their matching cached artwork and journey events render their actual recorded route geometry as scaled, map-free thumbnails.
- Expanded journey-detail loading to cover the member's visible timeline window so route lines and soundtrack artwork are available to the merged view.
- Verification: `npm run typecheck` passed; focused tab and membership tests passed; full `npm test` passed 139/139; `npx expo export --platform ios` completed successfully (1,760 modules); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified an iOS-only production OTA for runtime `1.8.0`: update group `9e7a17ce-72d1-4167-989f-ca3753056700`, iOS update `01a0584b-ef48-7544-a65d-9cd0af0d8798`, message `Free Statistics tab with 45-day story timeline`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted. Next subscription step: replace `currentMembershipEntitlements()` with verified StoreKit state before enabling paid Atlas access.

### Statistics option-3 visual fidelity correction (2026-08-31)

- Located and preserved the selected option-3 mockup at `docs/design/statistics-tab-option-3-reference.png`. The prior OTA had reproduced the data model but omitted the mockup's artwork and hierarchy.
- Generated a text-free cinematic coastal-night-road hero from the selected reference using the built-in image-generation tool and saved it as `mobile/recorder/assets/statistics-story-hero-v1.png`. The prompt required a dark Pacific coastline, coral long-exposure highway, left-side text-safe space, and no text/UI/logos.
- Rebuilt Statistics to match option 3: centered title on black, live mileage/song copy over the coastal artwork, one row of three compact insight cards, the thin 45-day history strip, a connected timeline rail, album artwork for songs, real scaled route geometry for journeys, and the filled coral **SHOW 10 MORE** control. Only archive-derived values and event content vary from the mockup.
- Added focused structural coverage for the option-3 composition. Verification: `npm run typecheck` passed; `npm run test:tab-runtime` passed 28/28; full `npm test` passed 140/140; `npx expo export --platform ios` completed successfully (1,761 modules, 22 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS-only production OTA runtime `1.8.0`: update group `498a0f84-0940-4ff5-922c-56feb0b55694`, iOS update `01a0586f-4904-7c91-bbdf-f91d3e20b887`, message `Match Statistics tab to selected cinematic mockup`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Cinematic-realism tab header system (2026-08-31)

- Standardized the main destination headers around one visual language: centered native tab titles above uniformly sized, text-free 16:9 artwork. Home remains the intentional exception. Live, Memories, Soundtracks, Atlas, and Settings now match the grounded cinematic realism introduced by Statistics rather than mixing illustrated and photorealistic treatments.
- Generated and visually inspected five production assets with the built-in image-generation tool, using the Statistics coastal-road hero as the style reference: `live-header-cinematic-v1.png` (windshield road), `memories-header-cinematic-v1.png` (physical road-trip prints), `soundtracks-header-cinematic-v1.png` (real turntable), `atlas-header-cinematic-v1.png` (aerial connected highways), and `settings-header-cinematic-v1.png` (restrained dashboard controls). Prompts required no baked-in title, text, UI, logos, watermarks, or decorative borders.
- Preserved the Soundtracks vinyl animation and moved its 3D motion frame to the center of the new photographed record. Fixed the deferred Statistics `Favorite time` clipping by allowing a compact fitted three-line value.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 28/28; full `npm test` passed 140/140; `npx expo export --platform ios` completed successfully (1,761 modules, 22 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS-only production OTA runtime `1.8.0`: update group `c8d1fcec-5d8b-417a-a273-275002053c0d`, iOS update `01a05894-b442-797e-b7a1-35eb85feeb48`, message `Unify tab headers with cinematic realism`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Frameless header blending and static Soundtracks artwork (2026-08-31)

- Removed the Soundtracks vinyl animation completely, including its timing state, animated overlay, tilted motion frame, and generated SVG record. Soundtracks now uses one static photographic header.
- Generated and visually inspected `mobile/recorder/assets/soundtracks-header-cinematic-v2.png` with the built-in image-generation tool. The final prompt used the Live, Memories, and Statistics artwork as style references and specified a realistic static turntable beside a coastal night road, edge-to-near-black vignetting, and no text, UI, animation cues, rounded mask, border, logo, or watermark.
- Reworked the shared header renderer to use edge-to-page feathering instead of a visible framed rectangle. Removed the rounded/background wrappers from primary, Memories/Settings, and Soundtracks artwork containers.
- Corrected Statistics to the shared centered 1672:941 header geometry, removed its explicit border, added edge feathering, and made the centered title width explicit. Added artwork-derived ambient washes for Live, Atlas, and Statistics; adjusted Settings ambient colors to the new photograph. Existing Home, Memories, and Soundtracks ambient treatments remain in place.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 28/28; full `npm test` passed 140/140; `npx expo export --platform ios` completed successfully (1,761 modules, 22 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS-only production OTA runtime `1.8.0`: update group `504fb425-4b9a-4007-964e-ae80f4b8299a`, iOS update `01a058a9-3d0d-76a5-8b72-f1978fda8d67`, message `Blend cinematic headers and remove Soundtracks motion`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Complete header-edge seam dissolve (2026-08-31)

- Replaced the partial in-bounds header vignette with a two-stage seam treatment. Each shared image now reaches the exact `#05030b` page color before the bitmap boundary, and four 30-pixel exterior gradients carry that color outside the bitmap before dissolving into the destination's ambient wash.
- Applied the same external bleed explicitly to the Statistics live-data hero, which does not use the shared `HeaderArtwork` wrapper. This preserves the artwork-matched color spill while preventing a rectangular hard line at any edge.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 28/28; full `npm test` passed 140/140; `npx expo export --platform ios` completed successfully (1,761 modules, 22 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS-only production OTA runtime `1.8.0`: update group `a7033805-ebe8-4450-85d0-c9e876b02567`, iOS update `01a058b1-5eaa-728e-b95b-8e1be16f40fe`, message `Dissolve header seams into ambient color`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Two-destination gear menu (2026-08-31)

- Simplified the Home settings-gear overlay to exactly two choices: **Data Health** and **Settings**. Both continue to open their existing corresponding pages and return to the two-choice Tools menu.
- Narrowed the live utility destination type to `menu | health | settings` and removed the old Search, standalone Timeline, and standalone Statistics branches and tiles from the overlay. The new membership-aware Statistics primary tab and its embedded 10-at-a-time timeline remain unchanged. Dormant standalone screen components and local data builders were preserved because the merged experience still shares their underlying timeline/statistics model.
- Updated structural regression coverage to enforce that the gear menu cannot regain Search, Timeline, or Statistics entries. Verification: `npm run typecheck` passed; focused tab-runtime tests passed 28/28; full `npm test` passed 140/140; `npx expo export --platform ios` completed successfully (1,761 modules, 22 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS-only production OTA runtime `1.8.0`: update group `a0b2a68a-2b29-4a07-9949-555854138d02`, iOS update `01a058d9-3a7c-75a4-b6ab-71ac68d0b2d9`, message `Simplify Tools to Data Health and Settings`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### Build-10 artwork completion and saved-place propagation hardening (2026-08-31)

- Audited every manual, recovered, and automatic journey-completion path. Completion now imports recent Apple Music history, runs the exact title-and-artist public Apple catalog fallback only for missing covers on that journey, and prefetches all resolved cover URLs into Expo Image's persistent disk cache before the automatic background task exits. Artwork URLs remain in the local SQLite record so an evicted OS cache can be repopulated later.
- Added `memory-disk` caching consistently to the remaining native artwork renderers. Reduced the native MusicKit recent-history artwork request from 512×512 to 256×256 for Build 10; the iTunes fallback remains 100×100. The 256 px Swift change requires the new native TestFlight build, while the completion fallback and disk-prefetch logic are OTA-compatible.
- Replaced fragile rounded-coordinate-only place propagation with a private on-device named-place record and a 125-meter haversine match. Saving an endpoint passes its exact recorded route coordinate, all journey lists resolve nearby named endpoints, and legacy exact aliases are promoted into nearby-place records during loading. Clearing a custom alias also removes its nearby record. Place IDs are profile-scoped.
- Added functional GPS-drift and structural completion-path regression coverage. Verification: `npm run typecheck` passed; focused completion, tab-runtime, local-store, local-atlas-client, network-boundary, and server-independence tests passed; full `npm test` passed 142/142; `npx expo export --platform ios` completed successfully (1,762 modules, 22 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified the OTA-compatible portion to iOS production runtime `1.8.0`: update group `f9042d61-675f-4dd5-9f66-c1eba55d49a5`, iOS update `01a058f0-1346-7014-80a4-8ab1addf7e45`, message `Cache journey artwork and propagate saved places`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. Build 10 still needs to be created to embed the 256×256 MusicKit native change. EAS records base commit `ff75d37` with a dirty-working-tree marker; the source remains uncommitted.

### First-launch animation concept gallery (2026-08-31)

- Created three selectable, full-screen portrait first-launch motion prototypes under `docs/design/opening-animation-options/`: **The Road Awakens**, **Miles Become Memories**, and **Road Meets Soundtrack**.
- Each animated WebP is rendered at 480×1040 with 50 source frames at 50 ms each, yielding an exact 2.5-second loop. Each uses the exact production app icon and the shared `Your drive, remembered.` lockup; the generated images contain no baked-in text or imitation logo.
- Used the built-in image-generation tool for three cinematic photographic foundations, referencing the current JourneyDeck welcome and Statistics artwork. The final prompt set is recorded in `PROMPTS.md`. Motion, branding, timing, grain, vignette, route reveal, glass shimmer, and vinyl groove highlights are reproducibly generated by `build_previews.py` using the bundled Pillow runtime.
- Added `index.html` as a responsive comparison gallery with replay and near-full-screen viewing. A local preview server is running at `http://127.0.0.1:8794/` in process `33892`; it can be stopped after selection.
- These are design prototypes only. Nothing was wired into the mobile onboarding flow, and no OTA, native build, TestFlight upload, commit, push, website deployment, or App Store mutation was performed.
- After the user selected Option 2, corrected its animated shimmer geometry from upright rectangles to four-point perspective frames aligned with the underlying sunset, city-light, and starry-night photo panes. Added `--option 1|2|3|all` to the preview builder so a single concept can be rerendered without recompressing all three. The Option 2 WebP and poster were regenerated in place; the photographic foundation and brand lockup were preserved.
- The user formally approved corrected **Option 2 — Miles Become Memories**. Preserved the exact chosen animation and resting frame as `selected-option-2-final.webp` and `selected-option-2-final-poster.png`, with SHA-256 hashes and implementation invariants in `docs/design/opening-animation-options/SELECTED.md`. Treat that file as the authoritative first-launch animation choice. It remains a design artifact only and is not yet implemented or published.

### GPS-method onboarding screen concepts (2026-08-31)

- Created three full-screen portrait mockups for first-launch screen 2 under `docs/design/gps-method-screen-options/`: **Quiet Glass**, **Expanded Choices**, and **Two Roads**. All show Automatic selected so benefits and limitations can be compared directly.
- Used the built-in image-generation tool for three text-free cinematic foundations, referencing the approved Option 2 opening poster and the current Live header photography. Exact sans-serif typography, truthful Automatic/Manual copy, privacy notes, vector selection marks, controls, and layout were added deterministically by `build_mockups.py`; prompt summaries are saved in `PROMPTS.md`.
- The concepts are design artifacts only. No onboarding code, app asset, OTA, native build, TestFlight upload, commit, push, website deployment, or App Store mutation was performed. Await the user's visual selection before implementation.
- Added `index.html` after the generated text-free foundations were mistaken for the finished mockups. The completed UI comparison gallery is served at `http://127.0.0.1:8795/` by local process `46152`, with tap-to-open full-screen previews of all three composed screens.
- The user formally approved **Option 2 — Expanded Choices** and explicitly requested removal of Options 1 and 3. Deleted both rejected mockups and their unused generated foundations, reduced `build_mockups.py` to the selected render, and converted the gallery to one approved screen. Preserved the exact selected image as `selected-option-2-expanded-choices.png`; `SELECTED.md` records its SHA-256 hash, 250–300 ms in-place card expansion, Continue-only advancement, and the exact expanded Manual copy. The screen remains unimplemented and unpublished.

### Apple Music onboarding screen concept (2026-08-31)

- Created the single requested first-run screen 3 mockup under `docs/design/apple-music-onboarding-screen/`. It reuses the exact approved GPS-method road background and presents a restrained slide-in glass overlay with the existing official Apple Music icon, a native-style **Connect Apple Music** action, soundtrack benefits, and a short privacy statement.
- The proposed primary action maps to `MusicAuthorization.request()`, which lets iOS present its standard MusicKit consent dialog. A subdued **Continue without Apple Music** action keeps the optional music provider from blocking journey recording.
- Added `build_mockup.py` for deterministic Pillow rendering, `apple-music-connect-screen.png`, `index.html`, and `README.md`. This remains a design artifact only; no mobile implementation, OTA, native build, TestFlight upload, commit, push, website deployment, or App Store mutation was performed.
- Revised the selected mockup after review: replaced the white authorization control with JourneyDeck's coral-to-pink gradient, extended the glass sheet so the complete button and glow remain inside its outline, and separated the explanatory permission note from the sheet edge.
- The user approved the revised screen as perfect. `docs/design/apple-music-onboarding-screen/SELECTED.md` records the final PNG SHA-256 and implementation invariants. Treat the gradient-button version as the authoritative screen 3 design.

### Adaptive final onboarding instruction screens (2026-08-31)

- Created two full-screen final onboarding mockups under `docs/design/onboarding-instructions-screens/`, using the same approved cinematic road background and the established first-run visual system.
- **4a Automatic** explains that the user takes their iPhone, starts driving, plays Apple Music through the iPhone or CarPlay, and lets JourneyDeck finish after parking. **4b Manual** shows a visual **Start Your Journey** control on Home and prominently reminds the user to open JourneyDeck and finish the journey after arriving.
- Both variants end with the coral-to-pink **Let the Journey Begin** action, intended to complete onboarding and open Home. Added deterministic `build_mockups.py`, a two-screen preview gallery, and README. These remain design artifacts only; no mobile implementation, OTA, native build, TestFlight upload, commit, push, website deployment, or App Store mutation was performed.

### Exact approved first-run onboarding implementation and OTA (2026-08-31)

- Implemented the approved first-run sequence without redrawing the selected visuals. The exact approved animation WebP, reduced-motion poster, Automatic screen, Apple Music screen, and both final instruction screens were copied byte-for-byte into `mobile/recorder/assets/`. Screen 2's Manual companion state was rendered from the approved layout and exact copy in `docs/design/gps-method-screen-options/SELECTED.md`.
- Added `first-run-onboarding-screen.tsx`, which renders the locked 480×1040 assets full-screen with cover-aware, accessibility-labeled transparent hit targets. The animation advances only after the asset loads and remains visible for exactly 2.5 seconds; Reduce Motion receives the approved poster. Automatic/Manual selection crossfades over 280 ms, only Continue advances, Apple Music uses the real MusicKit authorization path with an optional skip, and **Let the Journey Begin** opens Home.
- Added profile-private persisted flow state in `first-run-onboarding.ts` for `welcome → recording → music → instructions → complete`. A resumed first-run returns to its last stage; 4a/4b follows the chosen mode. Existing profiles that already completed recording and music setup are not forced through onboarding again.
- Added SHA-256 regression assertions for every locked asset in `tab-runtime.test.mts`; future byte changes now fail tests. Documented 4a/4b approval and updated the selected-design notes to record implementation.
- Verification: `npm run typecheck` passed; focused tab-runtime, local-store, native-capabilities, and drive-detection tests passed; full `npm test` passed 142/142; final `npx expo export --platform ios` completed with all seven onboarding assets in the 1.8.0 bundle; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS production OTA runtime `1.8.0`: update group `fd1412c1-e380-43c1-8a86-d7714c52c7cc`, iOS update `01a0597f-0aff-7db5-a48b-9bdf1044f324`, message `Implement exact approved first-run onboarding`. The initial CLI invocation was rejected before upload because `--environment` was required; the successful invocation explicitly used the production environment.
- No native build, TestFlight upload, build-number change, commit, push, website deployment, or App Store mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; all source remains uncommitted.

### Correct approved Home and navigation implementation (2026-09-02)

- Rebuilt the merged Home/recorder surface to match the user's approved Option 1 reference: full-screen twilight Pacific-coast artwork, minimal HOME header controls, a large glass recording status card with live timer/distance/GPS metrics, separate Identify Song and coral-pink End Journey controls, and a live latest-memory card. Idle, permission, recording, and paused states retain the same composition.
- Rebuilt the five-item dock to match approved nav Option 3: Soundtracks, Memories, Home, Statistics, Settings; a 104-point raised circular Home medallion with house icon and permanent coral glow; lavender secondary controls; and no visible sliding rectangular selection background.
- Generated the text-free photographic foundation with the image-generation tool using the approved Home mockup as the layout/style reference and saved it as `mobile/recorder/assets/home-recorder-coast-v1.png`; all UI, text, metrics, and controls remain native and live.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 29/29; full `npm test` passed 176/176; `npx expo-doctor` passed 21/21; `npx expo export --platform ios` completed with the new asset; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS-only production OTA runtime `1.9.0-build13`: update group `b8749d29-8605-467a-80a0-eb32ed39fb75`, iOS update `01a064fd-1c40-788e-af52-63647ba36e43`, message `Match approved Home and navigation designs`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed. EAS records base commit `e55accf` with a dirty-working-tree marker; source remains uncommitted.

### Home control alignment and active-recorder reachability follow-up (2026-09-02)

- Replaced the two separately positioned Home circles with one 104-point, item-owned medallion so the gradient, rings, glow, house glyph, label, and touch target share one mathematical center.
- Added recorder activity reporting to the Home shell. The scenic spacer remains 310 points while idle but collapses to 135 points while recording or paused, keeping Identify Song and End Journey above the dock. Home also scrolls to the top when recorder activity changes so the header cannot inherit an awkward prior offset.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 29/29; full `npm test` passed 176/176; `npx expo export --platform ios` completed successfully; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS-only production OTA runtime `1.9.0-build13`: update group `fd4a1a28-71c5-40cb-9719-d85c821ef5fc`, iOS update `01a06506-3ed1-7a11-8ff2-0f9e6ffeeadd`, message `Center Home control and surface recording actions`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Approved integrated navigation geometry correction (2026-09-02)

- Replaced the oversized floating Home disc and ordinary rounded bar with one continuous SVG dock silhouette measured from the approved Option 3 reference: a 64-point body, shallow 21-point center rise, 66-point Home ring, and proportionally wider center slot. Removed the straight outline through the Home control and limited the center treatment to the integrated contour plus two restrained inset rings.
- Matched the reference icon treatment with medium-weight outline symbols (`music.note`, `photo.on.rectangle`, `house`, `chart.xyaxis.line`, and `gearshape`), lavender secondary labels, and a coral-centered violet edge gradient. The Home symbol and label now share the same mathematical center inside the raised contour.
- Reduced the idle Home scenic spacer from 310 to 190 points and the active spacer from 135 to 85 points. Recorder activity still resets Home to scroll position zero, so recording controls remain reachable above the dock.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 29/29; the prior full `npm test` run passed 176/176; EAS export/publish completed successfully; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Final corrective iOS production OTA for runtime `1.9.0-build13`: update group `6d40486b-2e4c-482d-8c46-57c81a0f6cf7`, iOS update `01a0651d-7062-7ede-9043-62cdba1520fb`, message `Finalize approved integrated navigation`. This supersedes the intermediate geometry update group `e32b8ae0-eff8-4c65-8108-8cad5f58ae96`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Home dock text, latest-song rail, and circular edge navigation (2026-09-02)

- Added a compact live **Latest song played** card beneath Home's latest-memory card. It reads the newest shared soundtrack record, renders its disk-cached album artwork (or a truthful empty state), shows the real track, artist, and played time, and opens Soundtracks when tapped.
- Cleared the Home label from the concentric navigation lines with a small medallion-colored label plate, preserving the approved raised-center silhouette while preventing the circle strokes from running through the text.
- Made the five-tab pager circular at its endpoints with inert accessibility-hidden sentinels. Soundtracks → Settings now animates one page left; Settings → Soundtracks animates one page right. The invisible reset to each canonical screen occurs only after PagerView reports `idle`, preserving the canonical screen instances and avoiding a mid-transition snap. Reduce Motion uses an immediate canonical jump.
- Added pure circular-pager transition, sentinel mapping, and progress tests, plus structural coverage for the Home song card and label treatment. Verification: `npm run typecheck` passed; focused tab-runtime tests passed 29/29; navigation-motion tests passed 8/8; full `npm test` passed 178/178; EAS export/publish succeeded; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified iOS production OTA runtime `1.9.0-build13`: update group `94f1dfa9-de57-4c43-9c37-da3c1d4827eb`, iOS update `01a06544-98bc-7452-a75d-a10c71f43715`, message `Polish Home dock and circular tab edges`.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Unlabeled Home nav control and combined-start concepts (2026-09-02)

- Removed the Home text label from the raised center navigation control and increased the house symbol from 27 to 31 points inside a 32-point symbol frame. The continuous approved Option 3 dock silhouette, circular endpoint navigation, and other four labels remain unchanged.
- Created four full-screen design-only concepts for combining the READY status frame and Start Journey action into one control: `docs/design/home-combined-start-options/option-1-beacon-card.png`, `option-2-coral-launch.png`, `option-3-split-horizon.png`, and `option-4-journey-portal.png`. The combined control has not been implemented; user selection is pending.
- Revised Option 4 at the user's direction by changing only its green beacon/status accents to JourneyDeck orange-coral. The preserved revised mockup is `docs/design/home-combined-start-options/option-4-journey-portal-coral.png`; it remains design-only and is not implemented in the app.
- Verification: `npm run typecheck` passed; focused tab-runtime tests passed 29/29; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the nav-only iOS production OTA for runtime `1.9.0-build13`: update group `04c0837e-287a-450f-8c2e-729a5a4f80fa`, iOS update `01a0655b-2686-7d9b-8f09-429707a3e440`, message `Remove Home label and enlarge nav icon`.
- No combined READY/Start implementation, native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Approved coral Journey Portal implementation and OTA (2026-09-03)

- Implemented the approved coral revision of **Option 4 — Journey Portal** for Home's idle manual-recording state. The READY beacon, explanatory copy, Start Journey label, arrow, translucent dark glass, coral/pink outline, and illuminated lower bloom now form one continuous control.
- The complete rounded portal is a single accessible `Pressable`; tapping anywhere inside it starts the existing recorder. Decorative gradients and beacon layers ignore touches, VoiceOver receives one Start Journey button, and a synchronous busy guard rejects ultra-fast duplicate taps before a second local session can be queued.
- Preparing, permission-required, paid Tessie automatic, recording, finishing, and paused states retain their existing behavior. Active recording still exposes live metrics, Identify Song when applicable, Resume, and End Journey separately.
- Moved only the idle Home composition upward by reducing its scenic spacer from 190 to 70 points, matching the approved reference while retaining the 85-point active spacer that keeps recording controls reachable.
- Recorded the approved reference and interaction invariants in `docs/design/home-combined-start-options/SELECTED.md`.
- Verification: TypeScript passed; tab-runtime 29/29; navigation-motion 8/8; drive-detection 14/14; full mobile suite 178/178; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and independently verified the iOS production OTA for runtime `1.9.0-build13`: update group `b3ff352b-b95c-455f-bac1-e2bf86d140fe`, iOS update `01a06724-39a2-786a-9c45-db504929263a`, message `Combine ready state and Start Journey portal`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Diffused Home portal correction and OTA (2026-09-03)

- Corrected the physical-device rendering reported after the first portal OTA. Removed the opaque gradient border wrapper, 80%-opaque rounded glass fill, hard-edged circular bloom view, parent rectangular shadow, and press-state opacity change that made the control appear transparent only while touched.
- The portal now uses one continuously transparent Pressable plus a pointer-disabled SVG atmosphere. Dark glass, coral action light, and the beacon halo are radial gradients sized so they reach zero opacity before every canvas boundary; there is no outline stroke, filled card shape, bloom boundary, or rectangular clipping edge. Touch feedback is scale-only, so transparency is stable from first render through press and busy states.
- Updated the selected-design invariants to require fully feathered edges without a visible rounded outline while retaining the entire 360-point portal footprint as one Start Journey target.
- Verification: TypeScript passed; tab-runtime 29/29; navigation-motion 8/8; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices. The immediately preceding full suite remained 178/178.
- Published the corrected iOS production OTA for runtime `1.9.0-build13`: update group `69e7607d-70f8-45ff-944c-16514f1f7a11`, iOS update `01a0672e-be0c-7d89-8194-7f91be8d8faa`, message `Diffuse Home start portal into background`. This supersedes portal group `b3ff352b-b95c-455f-bac1-e2bf86d140fe`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Home portal outline and header-dot cleanup OTA (2026-09-03)

- Made only the two user-requested visual edits: added a one-point coral-orange rounded neon outline as an absolute, noninteractive overlay around the existing diffused Start Journey portal, and removed the orange notification dot from Home's top-right Soundtracks button.
- The portal's transparency, radial atmosphere, glow, size, spacing, copy, one-button touch target, and recording behavior are unchanged. Removing the music dot did not alter the button, symbol, Soundtracks navigation, or latest-song card.
- Verification: TypeScript passed; tab-runtime 29/29; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the iOS production OTA for runtime `1.9.0-build13`: update group `2844a4ab-6520-45da-8f37-ea66afb8e6c9`, iOS update `01a06771-050d-71c9-8fe7-df0ed1444304`, message `Outline Home recorder and remove music dot`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Expanded Home portal action glow OTA (2026-09-03)

- Expanded only the coral/pink radial haze behind `Start Journey`. Its visible field now fills approximately 90% of the portal width and 75% of its height—most, but not all, of the outlined area—and still reaches zero opacity before the one-point neon border.
- Border, transparency, beacon, copy, layout, spacing, portal size, one-button touch behavior, header controls, memory/song cards, and navigation were not changed.
- Verification: TypeScript passed; tab-runtime 29/29; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the iOS production OTA for runtime `1.9.0-build13`: update group `f000e6ba-8f55-42e6-b976-ad535b6fa6bf`, iOS update `01a06779-06cc-7df1-a9db-a63beb4a33a1`, message `Expand Home Start Journey glow`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Markup-matched Home haze boundary OTA (2026-09-03)

- Enlarged only the Start Journey coral haze to match the user's red physical-device markup. The feathered field now reaches approximately 95% of the outlined width and 92% of its height, while its focal point remains shifted behind the Start Journey label.
- The haze still reaches zero opacity at the neon border. Outline, glass transparency, beacon, text, layout, cards, navigation, and recorder interaction were not changed.
- Verification: TypeScript passed; tab-runtime 29/29; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the iOS production OTA for runtime `1.9.0-build13`: update group `c8c4e7b8-5876-4d17-ad23-cc937bb27511`, iOS update `01a0677e-6fe8-7151-bd0e-a9bff38b68ac`, message `Match Home glow to approved boundary`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Full-interior Home portal haze OTA (2026-09-03)

- At the user's final direction, extended the translucent coral/pink action haze across the complete interior of the rounded neon outline. A low-opacity coral wash now reaches every edge while the brighter focal glow remains behind `Start Journey`; the road photograph remains visible through the portal.
- Clipped only the SVG atmosphere to the existing 30-point rounded shape so no color can escape the corners. The outline remains a separate sibling, preserving its neon glow. Border, beacon, text, layout, cards, navigation, full-portal touch target, and recorder behavior were not changed.
- Verification: TypeScript passed; tab-runtime passed 29/29; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the iOS production OTA for runtime `1.9.0-build13`: update group `d0b565c8-e02d-4f6d-a8af-cb089362af0c`, iOS update `01a06783-a49d-7354-b4dd-7f5919472f6d`, message `Fill Home portal with coral haze`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Build 13 full-haze OTA startup crash diagnosis (2026-09-03)

- Inspected the user-supplied `testflight_feedback (2).zip`. It contains a Build 13 crash at 2026-09-03 08:51:59 CDT, about seven minutes after full-haze update `01a06783-a49d-7354-b4dd-7f5919472f6d` was published and roughly four seconds after launch.
- The crash is `EXC_CRASH (SIGABRT)` in Expo Updates `StartupProcedure.throwException` → `ErrorRecovery.crash` while waiting for the remote loader. This signature means update activation encountered an early fatal application error and Expo Updates re-threw it after recovery; it is not the earlier Build 11 SQLite/WAL `SIGBUS` crash. MapLibre worker threads shown in the report are idle and are not the triggering thread.
- Apple's TestFlight crash package omits the original JavaScript/native-view exception message. The runtime delta is isolated to the enlarged SVG coral gradient and the newly-added `borderRadius`/`overflow: 'hidden'` clipping style on the top-level SVG. The SVG clipping style is the strongest suspect but is not proven without an attached Xcode/macOS Console reproduction.
- No repair, rollback, new OTA, native build, TestFlight upload, commit, or push was performed during this diagnostic step. Safest fix-forward is to remove top-level SVG clipping and constrain the gradient with rounded SVG rectangles (or first republish the preceding known-good update).

### Build 13 portal OTA startup repair (2026-09-03)

- Removed `borderRadius` and `overflow: hidden` from the top-level `Svg`. The same full coral/pink haze is now bounded by its own native SVG `Rect` using `rx="30" ry="30"`, preserving the approved full-interior treatment without clipping the SVG host view.
- Verification: TypeScript passed; focused tab-runtime passed 29/29; the complete mobile suite passed 178/178; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the repair to iOS production runtime `1.9.0-build13`: update group `29e6e64c-0c34-40a4-9ff3-98672832f0e5`, iOS update `01a06797-65c5-77a1-88e6-b8a1fe0f72f7`, message `Repair Home portal OTA startup`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

### Silent Home recorder initialization OTA (2026-09-03)

- Removed the visible transient Home startup state captured on-device: the old compact READY card plus `Preparing your private recorder…` appeared while the Keychain device ID and recorder/permission state were still loading.
- Home now renders the complete approved Start Journey portal from the first visible React frame. During the brief bootstrap it is silently disabled but remains visually identical, including its normal arrow; when initialization completes it becomes tappable in place without a spinner, message, card swap, or layout jump. A genuinely missing location permission still reveals the real Enable Location action after checks settle.
- Added structural coverage for the silent bootstrap portal and removed the obsolete preparing styles/copy. Verification: TypeScript passed; focused tab-runtime passed 29/29; complete mobile suite passed 178/178; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the iOS production OTA for runtime `1.9.0-build13`: update group `f1cab5f8-bad1-40ac-b507-6fbed6f46b95`, iOS update `01a067a6-e1a9-73ef-919e-6e2d7cf622d5`, message `Show final Home portal from first frame`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.

## Automatic endpoint naming and saved-place propagation repair — August 31, 2026

- Compared the native location pipeline with the older web behavior. The native regression had three causes: the saved-place radius was only 125 meters despite rounded endpoint identities and normal parking/GPS drift; detail records with journey-specific keys did not fall back to their recorded route endpoints; and iOS had only a city-summary lookup rather than an endpoint address/name cache.
- Increased user-named place matching to a bounded 250-meter haversine radius and made every detailed journey resolve its first/last route coordinate when its place key is not coordinate-based. User-entered names are persisted as private local places, override automatic labels, and now emit the shared archive-change event so Home, Statistics, Memories, journey lists, and reopened details refresh together.
- Added foreground-only endpoint enrichment through the iOS location geocoder. It resolves at most four uncached endpoints sequentially per pass, stores only the useful place/address label in the profile-private `local_places` table for 30 days, retries failures no more than hourly, and never performs geocoding while the app is backgrounded. Cached automatic labels use a narrower 150-meter radius; manual names always win.
- Added behavioral tests for realistic property/parking drift, separation from a different neighborhood, and geocoder-label selection. Verification: `npm run typecheck` passed; focused place/journey/tab tests passed 33/33; full `npm test` passed 149/149; `npx expo export --platform ios` completed successfully (1,771 modules, 24 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified the iOS production OTA for runtime `1.8.0`: update group `8e464530-87c8-45c0-9bc9-423067a31edc`, iOS update `01a05af4-d8c8-7ae6-adcf-d99963f6bb81`, message `Restore automatic journey place naming`. It applies to TestFlight Build 10 after download and restart.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store Connect mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; all source remains uncommitted.

### Apple Music manual-control visibility correction OTA (2026-09-03)

- Fixed the Home recorder showing `Identify Song` during a journey even though Apple Music was selected, authorized, and already capturing tracks automatically. The shell's native music-capability state began as unknown and previously refreshed only through the retired utility-overlay path, so the old conditional incorrectly treated startup as disconnected.
- The shell now refreshes native music capabilities at launch. Until that result arrives, it uses the persisted Apple Music connection status so the control is correct on the first rendered recording frame; once loaded, the native authorization result is authoritative.
- `Identify Song` remains available when manual song recognition is selected or Apple Music is not connected/authorized. No recording, Apple Music capture, navigation, or visual styling behavior was changed.
- Verification: TypeScript passed; focused tab-runtime passed 29/29; complete mobile suite passed 178/178; iOS Expo export passed with 1,826 modules and 27 assets; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published the iOS production OTA for runtime `1.9.0-build13`: update group `8cba8498-ec8a-4c5e-8af1-204827a9369b`, iOS update `01a067af-0c47-7bd8-82f4-0e76b3cb2fa7`, message `Hide manual song button for Apple Music`.
- No native build, TestFlight upload, build-number change, commit, git push, Worker deployment, or App Store mutation was performed; source remains uncommitted.
### V2 Build 6 device verification (2026-09-05)

- User confirmed JourneyDeck V2 Build 6 installed successfully on the iPhone.
- Verified on-device: V2 OTA delivery resumed, the light-mode app icon is present, and the native navigation/sheet/menu changes are active.
- The prior Build 5 / runtime `2.0.0-preview.4` mismatch is resolved. Next recommended milestone is validating iCloud sync from the iPhone to the cellular iPad before expanding the remaining iPad tabs.
### V2 private iCloud first-sync diagnosis (2026-09-05)

- User reported that tapping Sync showed `Private iCloud will retry`. The UI currently discards the underlying thrown CloudKit error and displays generic safe-retry copy.
- Build 6 IPA was rechecked: executable and provisioning entitlements correctly target `iCloud.com.journeydeck.recorder.v2`, CloudKit service is enabled, the executable uses CloudKit Production, and the configured Info.plist container matches. This is not a missing native capability or stale-build issue.
- Repository/handoff history records Production-schema deployment only for the original `iCloud.com.journeydeck.recorder`; the isolated `.v2` container was explicitly left physically unverified. The most likely cause is that its Production schema was never initialized/deployed, matching the original container's previously documented first-sync failure.
- Apple CloudKit Console is open at its fresh Apple sign-in page in a visible in-app browser tab and marked for handoff. User must authenticate there because computer-use rules prohibit automating authentication dialogs. After sign-in, inspect the `.v2` container and import/deploy the existing additive seven-record-type schema; do not alter the original production container.
### V2 preview CloudKit Production schema deployed (2026-09-05)

- Confirmed `iCloud.com.journeydeck.recorder.v2` had no usable schema for signed Build 6, whose executable correctly targets the CloudKit Production environment. This caused the generic `Private iCloud will retry` first-sync failure.
- Imported the checked-in additive `mobile/recorder/cloudkit/journeydeck-development.ckdb` into the isolated V2 container's Development environment. Apple validation passed.
- Reviewed and deployed the schema to the isolated V2 container's Production environment. Apple confirmed `Changes Deployed` / `The schema is deployed to Production.` Deployment created exactly seven record types (`Collection`, `Journey`, `Memory`, `MusicEntry`, `Photo`, `PrivatePreference`, `RouteArchive`), zero indexes, and the checked-in `_world` / `_creator` role changes.
- The original `iCloud.com.journeydeck.recorder` container was not modified. No source code, native build, OTA, commit, push, App Store action, or user data mutation was performed. Physical acceptance remains: tap Sync now on the V2 iPhone first, then on the V2 iPad using the same iCloud account and Apple-linked JourneyDeck profile.
### V2 iCloud exact-error OTA (2026-09-05)

- After `.v2` Production schema deployment, the user's immediate iPhone retry still showed the old generic `Private iCloud will retry` alert. The generic catch discarded the underlying CloudKit exception, preventing a precise second-stage diagnosis.
- Updated only the failure copy to display the native/JS error message followed by the existing local-data-safety statement. Observability still records only the existing privacy-safe `sync_exception` stage and does not transmit the raw error.
- TypeScript and tab-runtime 31/31 passed; iOS export `dist-icloud-s3` passed. Published and independently read back V2-P5-S3 to `v2-preview` / Build 6 runtime `2.0.0-preview.5`: group `bf16a404-0932-4225-ae4a-eee22f403b49`, update `01a0729a-55b3-72e8-8a44-7259df878bd7`.
- Next: restart V2 on the iPhone to activate S3, tap Sync, and use the exact alert text to repair the remaining CloudKit failure. No native build, original CloudKit container change, production App Store action, commit, or push occurred.
### Missing private-photo isolation repair OTA (2026-09-05)

- S3 exposed the exact physical-device failure: `UnexpectedException: A private photo file is missing from this device.` One pending Memory photo row references an app-private file that no longer exists; native validation previously threw for that asset and aborted the whole CloudKit batch.
- Updated the JS sync preparation layer to verify each non-deleted Memory photo URI before calling the native transport. Missing/empty files are excluded from the payload, counted once as failed/retry items, and left untouched locally. Valid journeys, routes, music, Memories, preferences and photos continue uploading. No record/file deletion or rewrite occurs.
- Added structural CloudKit regression coverage. TypeScript, CloudKit test, and tab-runtime 31/31 passed; iOS export `dist-icloud-s4` passed.
- Published and independently read back V2-P5-S4 to `v2-preview` / Build 6 runtime `2.0.0-preview.5`: group `d16e0da6-c617-4b53-b747-bfe742f409df`, update `01a072ad-db1e-71b3-a16b-ebf759022f0f`, message `Continue iCloud sync past missing photos`.
- Next physical acceptance: restart V2 on iPhone, tap Sync; expected success alert may report one item will retry while all valid content uploads. Then sync V2 iPad using the same iCloud and Apple-linked profile and compare counts. The absent photo cannot be recovered from this iPhone; reselecting it later can create a valid new asset.

## V2 App Store first-screenshot concepts — September 7, 2026
- Generated and visually reviewed six illustrative mockups: three iPhone portraits and three iPad landscapes (Cinematic, Warm Ivory, Grand Touring). Saved PNGs and full built-in image-generation prompts in docs/design/app-store-v2-first-screen/. Headlines verified. UI is illustrative and requires actual V2 captures, correct brand assets and accepted export dimensions before App Store use.
- Branch codex/journeydeck-v2, HEAD9421e87; pre-existing dirty application work preserved. No application changes, builds, tests, publishing, staging, commit or push. Next: user select concepts for refinement.

## Independent alternate app icons — September 7, 2026
- Added a separate iPhone/iPad Settings picker for Original, Rosewater and Grand Touring icons. The selected icon uses `journeydeck.app-icon.v1`; it does not read or write the theme preference.
- Added approved source artwork at `assets/icon-rosewater-v1.png` and `assets/icon-grand-touring-v1.png`, a config plugin that generates opaque 1024px iOS app-icon sets and declares both alternate asset names, and a local Expo/UIKit module that reads and changes the icon iOS actually applied.
- Verification: TypeScript passed; alternate-icon tests passed 4/4; Settings tests passed 3/3; complete mobile suite passed 308/308; iOS Expo export passed with 2,409 modules and 75 assets; Expo config resolved the plugin; Expo autolinking found `JourneyDeckAppIcon`. Native iOS prebuild cannot run on Windows, and no native build was requested or run.
- Branch `codex/journeydeck-v2`, HEAD `9421e87`; all pre-existing dirty work was preserved. No OTA, EAS build, TestFlight upload, staging, commit or push was performed. The switcher becomes functional only in a new binary containing the native module and icon assets.

## App icon picker preview OTA — September 7, 2026

- Published the OTA-compatible app-icon picker UI from isolated staging `.cache/ota-build18-app-icon-ui/mobile/recorder`, based on the device-proven DIAG-9 Build 18 source. The OTA keeps Original, Rosewater, and Grand Touring independent from theme selection, but disables icon changes with the next-build explanation because Build 18 does not contain the new UIKit module or alternate icon sets.
- Staged TypeScript passed. Production iOS Hermes export passed with 2,411 modules and 77 assets: the proven 75-asset bundle plus exactly the two icon previews. The main working-tree mobile suite had already passed 308/308 for this implementation. Old staging structural tests are stale and were not used as a release gate.
- Production channel readback verified runtime `2.0.0-watch.1`, group `0c0a1e9f-d3ee-495e-bbaa-fac82672748a`, iOS update `01a07c71-10ac-772a-9522-11412ccfafc1`, message `Add independent app icon picker previews`. No native build, TestFlight upload, commit, or Git push was performed.

## 3D Journey replay camera — September 8, 2026 (production OTA published)

- Upgraded the existing native MapLibre Journey replay into a pitched, heading-aware chase camera. Pinch zoom is retained during playback instead of being reset by each camera update; the full-route control switches to overview and back to follow mode.
- Added a bright travelled-route trace through the interpolated vehicle position while preserving the complete route, existing soundtrack moments, telemetry, local-first data, theme-specific map palette, and static fallback.
- Added interpolation coverage for the travelled route and structural coverage for pitch, bearing, persistent gesture zoom, and the travelled layer.
- Verification: TypeScript passed; route-moments passed 7/7; tab-runtime passed 31/31; complete mobile suite passed 438/438; iOS Expo export passed with 2,448 modules and 78 assets. The ignored export output remains at `mobile/recorder/.cache/replay-export` because automated cleanup was blocked.
- Published with the Cinematic artwork cleanup to iOS `production`, runtime `2.0.0-watch.3`: update group `8df688ad-d8da-431d-baf4-8573fd883e98`, iOS update `01a08167-c1f7-7bd8-8618-bed41072f9fe`, message `Polish Cinematic artwork and add 3D Journey replay`. Server readback confirmed this exact group is the production head. Branch `codex/journeydeck-v2`, HEAD `9421e87`; all pre-existing dirty work was preserved. No native build, TestFlight upload, staging, commit, push, CloudKit, or App Store mutation was performed. Physical iPhone acceptance should verify camera smoothness and pinch behavior on a real recorded route.

## Grand Touring Racing Green emphasis — September 8, 2026

- Promoted British Racing Green `#2f6b57` from the sixth picker swatch to Grand Touring's semantic green token. Settings now uses it for panel outlines, icon tiles, selected-category treatment, and primary actions, with warm ivory retained for legible text.
- Statistics now leads Grand Touring charts with green, uses it for the Total Journeys metric, range/chart series, Daily Distance and Hourly Departures panels, and Record Book/Activity accents. Grand Touring material lighting also shifts from predominantly Chrome/Champagne to green and Touring Blue.
- Verification: TypeScript passed; focused premium-theme, Settings, and Statistics tests passed 13/13; `git diff --check` found no whitespace errors beyond existing CRLF notices; production iOS export passed with 2,448 modules and 78 project assets.
- Published and verified the iOS production OTA for runtime `2.0.0-watch.3`: update group `00335845-4bb2-45ba-9b2c-5704b3b3cace`, iOS update `01a081c5-6e7e-71d1-84b9-be5780768dfd`, message `Emphasize Grand Touring racing green`. EAS server readback confirmed this group is the production head. No native build, staging, commit, or Git push was performed.
- Device screenshots then showed Touring Blue and the two pale blue/chrome chart series collapsing visually. Updated compact Grand Touring chart sequences to Racing Green → Champagne → a more saturated Touring Blue (`#6fa5f0`) → Chrome, eliminating adjacent near-identical blues in Distance Breakdown and Hourly Departures. TypeScript and focused Statistics/theme tests passed 10/10.
- Published and verified this refinement to iOS `production`, runtime `2.0.0-watch.3`: update group `880f20d3-c0ee-4435-b887-b725515536ac`, iOS update `01a081cc-29fb-7a69-a431-949b77a06efa`, message `Separate Grand Touring chart colors`. EAS readback confirmed it is the production head. No native build, staging, commit, or Git push was performed.

## Motion Phases 1–3 consolidated in V2 — September 8, 2026

- Consolidated the three isolated motion worktrees sequentially into the authoritative `codex/journeydeck-v2` checkout, adapting them to the current V2 architecture instead of copying their older base wholesale.
- Phase 1 adds shared motion timing/springs, one Reduce Motion/AppState store, background settling, and throttled semantic haptics. Phase 2 applies it to the existing Home recorder portal, confirmed recording lifecycle, real live metrics, journey-card entry/press motion, and the existing Apple Zoom detail navigation. Phase 3 adds once-per-snapshot statistics reveals, subtle reduced-motion-safe photographic depth, a sampled local-coordinate Skia route moment, and selective Liquid Glass with blur/opaque fallbacks and Reduce Transparency support.
- Verification passed: TypeScript; focused phase tests; complete mobile suite 452/452; public-release preflight using `https://journeydeck.me/privacy` and `https://journeydeck.me/support`; production-mode iOS Expo export (2,456 modules, 78 assets, 6.8 MB Hermes bundle) at `mobile/recorder/artifacts/phase123-production-export-20260908`.
- EAS confirmed `v2-preview` is isolated from production. Because existing preview binaries stopped at runtime `2.0.0-preview.5`, created internal ad-hoc Build 11 (`c5b8a78c-9b5a-4a49-ad24-17288f3b06dc`) for registered iPhone/iPad on channel `v2-preview`, runtime `2.0.0-preview.8`. It finished successfully and is not TestFlight or App Store distribution: `https://expo.dev/artifacts/eas/KFap8waMo8navImkdjqLcEwL6gQSp0nLJlZMVweFQ70.ipa`.
- Published the tested bundle only to `v2-preview` runtime `2.0.0-preview.8`: group `618ba2ec-bd5a-482e-a195-f72f364d0ee3`, iOS update `01a082b8-0b97-7763-81a9-4fdc06cab76f`, message `Test V2 Phases 1-3 on preview runtime 2.0.0-preview.8`. Server readback confirmed it as the preview head and independently confirmed production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. Physical acceptance remains: install Build 11, launch/restart, verify Data Health shows the preview runtime/update, then exercise Home→record→save→journey detail, Statistics, route replay, Memories, Reduce Motion, Reduce Transparency, and background/resume before any production OTA.
- Branch remains `codex/journeydeck-v2` at HEAD `9421e87`; existing dirty V2 work was preserved. No staging, commit, push, production OTA, TestFlight submission, App Store mutation, or CloudKit change was performed.

## High-impact motion pass — September 8, 2026 (source only)

- Made the active V2 Home photograph drift and push in cinematically, with all ambient motion tied to the shared Reduce Motion/AppState policy. The idle Start Journey portal now has breathing route rings and a bounded light sweep, while its start state morphs into the live recorder through a spring layout transition.
- Live metrics now roll the outgoing speed/distance/elapsed values away and bring the real replacement values in. The active MapLibre route grows from its prior endpoint as GPS snapshots change, and the live heading marker glides to its next real coordinate; backgrounding or Reduce Motion removes these animations.
- Manual completion now captures the final local route snapshot before archival, plays a longer Skia trace finish, lifts in saved distance/time/GPS metrics, and relies on the existing single success haptic. The confirmation is dismissible and auto-dismisses only while the app is active.
- Verification: TypeScript passed; focused motion/delight/native-release tests passed 14/14; the updated tab-runtime suite passed 31/31; complete mobile suite passed 452/452; production-style iOS Expo export passed with 2,454 modules, 78 assets, and a 6.8 MB Hermes bundle at `C:\Users\patri\AppData\Local\Temp\journeydeck-motion-export-01a081f6-final`. `git diff --check` found no whitespace errors beyond existing CRLF notices.
- No simulator session, OTA publish, EAS/native build, TestFlight upload, App Store mutation, staging, commit, or push was performed. Physical acceptance on the existing V2 preview runtime remains pending.

## Build 11 high-impact motion preview OTA — September 8, 2026

- Published the current dirty authoritative V2 source checkout only to the isolated iOS `v2-preview` channel used by internal Build 11. The update targets runtime `2.0.0-preview.8` and carries message `Build 11 preview - high-impact Journey motion`.
- EAS update group: `5e512d29-31e2-44f4-9ac3-4ecd6b43fc1b`; iOS update: `01a0838c-70cd-748e-add7-306899fe86f5`; manifest: `https://u.expo.dev/update/01a0838c-70cd-748e-add7-306899fe86f5`.
- Independent server readback confirmed this group is the current `v2-preview` head on runtime `2.0.0-preview.8`. A separate production readback confirmed production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`.
- No EAS/native build, TestFlight upload, App Store mutation, CloudKit change, staging, commit, or Git push was performed. Build 11 users should allow up to two cold launches to download and activate the OTA, then verify Data Health shows short update ID `01a0838c` and exercise Home → Start Journey → live route/metrics → completion.

## Theme ripple reveal — September 8, 2026 (source only)

- Theme selection now captures the current screen once, applies the selected live theme beneath it, and uses a UI-thread Skia clear circle to reveal the new theme outward from the exact pressed swatch. A thin new-theme accent ring marks the moving edge.
- Reduce Motion replaces the spatial reveal with a short opacity dissolve. The transition settles immediately if JourneyDeck backgrounds, blocks duplicate selections while active, falls back to a direct theme change if capture/decode fails, and releases every temporary screenshot.
- Added focused structural coverage and updated theme-picker/provider tests. Verification passed: TypeScript; focused theme tests 15/15; complete mobile suite 455/455; preview-mode iOS Expo export with 2,455 modules, 78 assets, and a 6.8 MB Hermes bundle at `mobile/recorder/.cache/theme-ripple-export`; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- This change is source-only. It has not been published to Build 11 or any OTA channel, and no native build, TestFlight/App Store mutation, staging, commit, Git push, or CloudKit change was performed. Real-device feel-check remains required before production use.

## Build 11 theme-ripple preview OTA — September 8, 2026

- Published the verified current source only to the isolated iOS `v2-preview` channel for internal Build 11, runtime `2.0.0-preview.8`, with message `Add theme ripple reveal`.
- EAS update group: `dc11cd93-1493-4b29-8a8f-3a6abe292455`; iOS update: `01a0839e-ae72-72c3-a816-61900a53010b`; manifest: `https://u.expo.dev/update/01a0839e-ae72-72c3-a816-61900a53010b`.
- Independent server readback confirmed this group is the current `v2-preview` head. A separate production readback confirmed production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`.
- No EAS/native build, TestFlight upload, App Store mutation, CloudKit change, staging, commit, or Git push was performed. Build 11 may need up to two cold launches; Data Health should then show short update ID `01a0839e`. Real-device acceptance should switch among all four themes, try rapid repeat taps, background during a transition, and verify the Reduce Motion dissolve.

## Build 11 always-visible theme-wave repair OTA — September 8, 2026

- The user confirmed update `01a0839e` activated but no theme animation was visible on the physical device. Replaced the screenshot-capture/clear-circle implementation and its silent direct-change fallback with an always-rendered Skia transition that does not depend on `react-native-view-shot` or image decoding.
- Theme changes now apply immediately while an accent-color wash and two concentric route-like rings expand from the exact tapped swatch on the UI thread. Reduce Motion uses a brief full-screen color fade, backgrounding settles the transition, and duplicate theme changes remain blocked while the wave is active.
- Verification passed: TypeScript; focused theme tests 15/15; complete mobile suite 455/455; preview-mode iOS Expo export with 2,455 modules, 78 assets, and a 6.8 MB Hermes bundle at `mobile/recorder/.cache/theme-wave-repair-export`; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published only to internal Build 11's isolated iOS `v2-preview` channel, runtime `2.0.0-preview.8`, with message `Make theme ripple always visible`: group `1d39c35e-6539-4b81-9cab-690a39dfae97`, iOS update `01a083ab-5715-7fe9-a54f-8e90cd65c9b9`, manifest `https://u.expo.dev/update/01a083ab-5715-7fe9-a54f-8e90cd65c9b9`.
- Independent readback confirmed the new group is the `v2-preview` head and production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. No native build, TestFlight upload, App Store mutation, CloudKit change, staging, commit, or Git push was performed. Physical acceptance: cold-launch Build 11 up to twice, confirm Data Health short update ID `01a083ab`, then switch among all themes with iOS Reduce Motion off.

## Build 11 full-screen theme ripple OTA — September 8, 2026

- Reworked the theme transition around the full-screen provider pattern supplied by the user. The previous accent wash was only 22% opaque over an already-switched theme and could be visually imperceptible. The replacement expands an opaque circle in the next theme's page color from the exact `pageX`/`pageY` tap position, edged with that theme's accent color.
- The live theme is committed only after the circle covers the farthest screen corner. The opaque cover briefly holds while React applies all dynamic theme content, then fades away, preventing the end-of-transition text/component flash in the supplied sample. Existing Reanimated 4, Gesture Handler, and root `GestureHandlerRootView` support were sufficient; no dependency or native change was required. Reduce Motion uses a full-viewport color fade, application backgrounding settles safely, and duplicate selections remain blocked.
- Verification passed: TypeScript; focused theme tests 15/15; complete mobile suite 455/455; preview-mode iOS Hermes export with 2,455 modules, 78 assets, and a 6.8 MB bundle at `mobile/recorder/.cache/theme-fullscreen-ripple-export`; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published only to internal Build 11's iOS `v2-preview` channel, runtime `2.0.0-preview.8`, with message `Use full-screen theme ripple transition`: group `206b6f6e-7eac-49d3-98ef-69fe486862a9`, iOS update `01a083c7-079c-73cf-8279-a885504bd780`, manifest `https://u.expo.dev/update/01a083c7-079c-73cf-8279-a885504bd780`.
- Server readback confirmed this group is the `v2-preview` head and production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. No native build, TestFlight upload, App Store mutation, CloudKit change, staging, commit, or Git push was performed. Physical acceptance: cold-launch Build 11 up to twice, verify Data Health short update ID `01a083c7`, and switch between light/dark pairs with iOS Reduce Motion off.

## Build 11 recovered glass-water shader OTA — September 9, 2026

- Removed the SVG-circle approximation from `src/theme-water-transition.tsx`. The transition now keeps the proven standard React Native `Modal`, renders the recovered SkSL displacement/highlight math in its Skia `Canvas`, and refracts/fades the captured old screen to transparency so the committed live destination theme remains underneath. The approved duration is restored to 1,180 ms; Reduce Transparency disables refraction and Reduce Motion still takes the direct safe path.
- Added `src/theme-water-shader.ts` and locked the recovered constants/timing plus all eight cached 390x844 golden checkpoint hashes into `tests/theme-water-transition.test.mts`. The temporary screenshot stays retained until the modal/Canvas unmount lifecycle completes.
- Verification passed: TypeScript; focused transition tests 8/8; complete mobile suite 475/475; preview-configured iOS Hermes export; exported bundle contains the recovered shader and app config resolves `com.journeydeck.recorder.v2` / runtime `2.0.0-preview.8`. `git diff --check` found no whitespace errors beyond existing CRLF notices.
- EAS Simulator used existing dev-simulator build `b87c6a17-30ca-4489-9d53-b141c874d8b8` (no new build). After a real Appearance theme tap, JourneyDeck remained open and the UI tree showed Grand Touring committed. The EAS recording daemon timed out downloading video on two bounded sessions, so no simulator MP4 is claimed; both paid sessions and both Metro tunnels were stopped and `.env.eas-simulator` was cleared.
- Published exactly one iOS OTA to Build 11's isolated `v2-preview` branch/channel, runtime `2.0.0-preview.8`: group `09c92033-5376-4dd3-be4c-b57d942dfc99`, update `01a0867e-6d17-7aed-9c27-690ed1c64880`, message `Restore glass-water theme transition in stable modal`.
- Independent readback confirmed that exact update is the `v2-preview` head. Production remains unchanged at group `880f20d3-c0ee-4435-b887-b725515536ac`, runtime `2.0.0-watch.3`. Fresh insights are zero before activation. No native/TestFlight build, App Store action, staging, commit, push, CloudKit change, or production OTA occurred.
- Required next gate: cold-launch Build 11 up to twice, verify Data Health shows short update ID `01a0867e`, make a new physical-device screen recording switching themes, and compare the wave against the eight golden checkpoints. Do not consider or publish to production until that recording is reviewed.

## Start Journey shine clipping — September 9, 2026 (source only)

- Fixed the Home Start Journey portal's diagonal light sweep escaping above and below the rounded portal. The oversized rotated beam now renders inside a dedicated absolute rounded clipping layer, while the portal atmosphere, content, and exterior outline glow remain unchanged.
- Added structural regression coverage in `tests/tab-runtime.test.mts`. Verification passed: targeted tab-runtime suite 31/31; TypeScript; complete mobile suite 475/475; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- This fix is source-only. No OTA, native/TestFlight build, App Store action, staging, commit, push, CloudKit change, or production mutation was performed.

## Native iPad sidebar translucency — September 10, 2026 (source only)

- Kept JourneyDeck's native adaptive iPad tab sidebar and its system-managed width. On iPad only, the Native Tabs host no longer disables UIKit's transparent scroll-edge appearance, allowing Apple to use its native translucent sidebar material where supported. iPhone keeps the existing stable opaque-edge behavior.
- Added navigation coverage for both platform policies. Verification passed: TypeScript; native-navigation tests 8/8; complete mobile suite 538/538; iOS Expo export with 2,500 modules and 76 assets at `mobile/recorder/.cache/ipad-sidebar-translucency-export`; `git diff --check` found no whitespace errors beyond existing CRLF notices.
- UIKit still controls the exact sidebar material and opacity, so physical iPad review is required in landscape, including sidebar leading/trailing placement, scrolling at and away from the edge, light/dark themes, Split View, and Duo-style layouts. This change and the preceding landscape Settings title fix remain source-only. No OTA, native/TestFlight build, staging, commit, or push was performed.

## Plus theme and Atlas gates — September 11, 2026 (source only)

- Cinematic Dark (`dark`) and Rosewater (`sakura`) now require a verified JourneyDeck Plus membership. Grand Touring (`redline`) and Warm Ivory (`light`) remain free. The existing TypeScript catalog remains the single source of truth, and invalid/new theme state now falls back to Grand Touring.
- Free users see a Plus badge and an explicit VoiceOver requirement on locked cards. Direct taps, settled swipes, and VoiceOver adjustable actions open the existing membership paywall without invoking the water transition or persisting the locked theme. A previously selected paid theme normalizes securely to Grand Touring when the free user opens Appearance; paid selection still uses the existing secure persistence and water transition.
- Removed the internal-preview Atlas entitlement bypass. Atlas now requires a verified paid entitlement in every V2 build identity; its Statistics hero and direct route continue through the existing paywall guard for free users.
- Verification passed: focused access/theme/Settings/Statistics tests 78/78; complete mobile suite 542/542; TypeScript; iOS Expo export with 2,501 modules and 77 assets at `mobile/recorder/.cache/plus-theme-paywall-export`; `git diff --check` found no whitespace errors beyond CRLF notices.
- Pending device review: verify free and paid RevenueCat accounts on iPhone and iPad, locked-card tap and swipe behavior, purchase/restore returning to Appearance, Atlas hero/direct-route gating, VoiceOver, and the paid-theme water ripple. No OTA, native/TestFlight build, staging, commit, or Git push was performed.
- Published the verified source to the iOS `production` channel for the current TestFlight runtime `2.0.0-watch.4`: group `6722e042-aba5-4f5c-84b1-e6c4d9f7c36e`, update `01a090bd-ed61-704a-a8db-ddf163c6bcf8`, message `Gate Plus themes and Atlas`. Server readback confirmed the branch, runtime, platform, and update IDs. No native build, staging, commit, or Git push was performed.

## Cinematic default Memory artwork refresh — September 11, 2026 (source only)

- The bundled default Memory artwork now receives a theme-specific React key and Expo Image recycling key. Switching back to Cinematic Dark therefore creates the correct bundled-photo image identity instead of allowing a mounted/recycled image to retain another theme's fallback bitmap.
- Applied the same source identity policy to the iPad Home Memory preview. User-selected photos retain photo-specific identities and are otherwise unchanged.
- Verification passed: focused Memory/theme tests 15/15; TypeScript; complete mobile suite 543/543. Native check remains switching repeatedly among all four themes on Memories and iPad Home. No OTA, native build, staging, commit, or Git push was performed.
- Published and verified the artwork refresh on the iOS `production` channel for runtime `2.0.0-watch.4`: group `4be71a39-11b3-4f08-925d-ec2b79968589`, update `01a090d1-9288-79ce-a68b-a74edda70ab6`, message `Refresh Cinematic Memory artwork`. No native build, staging, commit, or Git push was performed.

## Grand Touring Home artwork V2 — September 11, 2026 (source only)

- The Grand Touring Home artwork was too dark and kept the car on the right beneath the Start Journey control. Added `assets/theme-grand-touring-home-v2.png`, a brighter 1536×1024 rainy-night composition with the touring car larger and centered.
- Updated the shared theme artwork resolver, theme carousel, and first-run welcome to use the same V2 asset. Retained the original V1 licensed source and documented the AI-assisted derivative in `assets/PHOTOGRAPHY-LICENSES.md`.
- Verification passed: focused Home/theme/welcome/runtime tests 56/56; TypeScript; complete mobile suite 543/543; iOS Expo export with 2,501 modules and 77 assets at `mobile/recorder/.cache/grand-touring-home-v2-export`. Physical iPhone/iPad crop review remains. No OTA, native build, staging, commit, or Git push was performed.
- Published and verified the centered/brighter artwork on the iOS `production` channel for runtime `2.0.0-watch.4`: group `0ad46de2-9a5a-40ce-8351-2a9f14083a3a`, update `01a09138-f1ed-74dc-a653-213c1b8d252e`, message `Center Grand Touring Home artwork`. No native build, staging, commit, or Git push was performed.

## Grand Touring website beta — September 11, 2026 (live)

- User requested the existing website in Grand Touring at `journeydeck.me/beta`. Added isolated `web/beta.html`, `beta.css`, `beta.js`, four optimized approved-photo WebPs and a recolored pulse mark under `web/assets/beta/`. Preserved the latest editorial homepage layout and accents from production main; `/` is unchanged.
- Hosted-only `/beta` serves the public preview with noindex headers; `/beta/` redirects to it. App/login/desktop authentication remains unchanged. Added route/asset regression assertions.
- Main mobile workspace remains on `codex/journeydeck-v2`; existing mobile changes preserved. Release isolated at `.cache/grand-touring-web-beta-release`, branch `codex/grand-touring-web-beta`, based on `7aa4756`; commit `7e6168d`, PR https://github.com/drumpat01/DriveOS/pull/143. Merged as `807ae29227d0bba66149828c061672469377a4f2`; Render deploy `dep-dai4tvoae00c73bbejp0` is live.
- Verification: isolated 34/34 server tests, TypeScript, ESLint and diff check passed. Desktop/tablet/phone browser checks passed with no overflow or failed assets; theme toggle and reduced motion passed. Local fixture preview on port 4318 (process 53880) was stopped. Root dependencies restored using npm ci.
- Production verified: `/beta` 200 with noindex, `/` 200 with original editorial content, `/app` redirects to `/login`, `/beta/` redirects to `/beta`, new WebP assets return image/webp. Live desktop and mobile browser checks passed: no overflow, no missing assets/console errors, working theme toggle. No post-startup Render error logs returned.
- CI run `34636057041` failed in the untouched private-dashboard Statistics smoke test: `#statisticsScore` remained `--`; 8/9 E2E checks passed and all 34 server tests/typecheck/lint passed. Remaining pipeline stages were skipped. GitHub auto-merge merged immediately because CI was not a required branch gate. Investigate the Statistics fixture separately; no dashboard source was changed.
- Root working tree retains source copies of the deployed website additions alongside the pre-existing mobile edits; release worktree is clean and retained. No mobile OTA/native build or environment-variable changes occurred.

## Memory editor scroll-boundary repair — September 11, 2026 (OTA published)

- Fixed the native Memory editor sheet so Cancel/Save remain pinned beneath the header and outside the scrolling form. Only the photo and journey form content now scrolls, preventing an extra trailing range from moving every control offscreen.
- The pinned editor uses one keyboard-aware bounded container on iOS; the inner scroll view disables bounce/overscroll and does not add a second keyboard inset. Other native sheets retain their automatic keyboard inset behavior.
- Verification passed: focused Memory/native sheet tests 43/43; TypeScript; complete mobile suite 555/555; iOS Expo export with 2,503 modules, 77 assets, and an 8.5 MB Hermes bundle; `git diff --check` reported only existing CRLF notices.
- Published to the iOS `production` channel using the production environment for runtime `2.0.0-watch.4`: group `622fdd0e-a070-476d-8ad7-c513f5982aea`, update `01a09208-ae58-7412-9b49-c4fb1a1815ac`, message `Keep Memory editor controls visible`. Server readback confirmed it is the production head.
- Pending device review: edit a Memory on iPhone and iPad in portrait, iPad landscape, and narrow Split View; focus both text fields, interactively dismiss the keyboard, scroll to both ends, and confirm the pinned controls never disappear at larger Dynamic Type sizes. No native build, staging, commit, or Git push was performed.

## Memory editor action hierarchy — September 11, 2026 (OTA published)

- Corrected the Memory editor’s action hierarchy across all four themes. Save now uses the active theme’s true primary accent, readable foreground, selected neon rim and accent shadow; the saved state uses a semantic success pair. Delete Memory now uses a dedicated palette-matched red surface and readable foreground instead of receiving generic surface color conversion.
- Added semantic success/danger pairs to the existing TypeScript theme palette and contrast coverage for every theme. The pinned Save/Cancel layout and confirmation behavior remain unchanged.
- Verification passed: TypeScript; focused action/theme/Memory tests 44/44; complete mobile suite 555/555; iOS Expo export with 2,503 modules and 77 assets; `git diff --check` reported only existing CRLF notices.
- Published to the iOS `production` channel with the production environment for runtime `2.0.0-watch.4`: group `7417bb07-8566-4058-befb-993d562b1949`, update `01a09216-415b-7a22-82e2-f245fb9d7f93`, message `Restyle Memory save and delete actions`. Server readback confirmed it is the production head. No native build, staging, commit, or Git push was performed.

## iPad landscape Memory detail grid — September 11, 2026 (OTA published)

- Rebalanced Memory details on full-width iPad landscape using the shared six-column layout. The artwork hero and a new `Memory at a glance` summary each occupy exactly three columns; the photo-matching action and journey list form a second three-plus-three row. Removed the inherited journey-list side margin that caused the prior third width.
- The summary uses the available half for the Memory date span, notes or a friendly fallback, distance, road time, song and photo totals, plus a bounded four-photo moments strip. Phone, portrait iPad, narrow Split View, and large Dynamic Type retain the existing stacked layout.
- Verification passed: TypeScript; focused Memory detail/tab tests 34/34; complete mobile suite 557/557; iOS Expo export with 2,503 modules, 77 assets, and an 8.5 MB Hermes bundle at `mobile/recorder/.cache/memory-detail-ipad-grid-export`.
- Published to the iOS `production` channel with the production environment for runtime `2.0.0-watch.4`: group `df618cda-6eb3-42f3-bb80-e57fa327c8e2`, update `01a09229-083e-7d07-a7da-6d55a8bd0bd2`, message `Balance iPad Memory detail layout`. Server readback confirmed it is the production head.
- Pending device review: confirm the three-plus-three balance on 11-inch and 13-inch iPad landscape, long Memory notes, empty Memories, several journeys, photo overflow, both sidebar positions, Split View, all four themes, and larger Dynamic Type. No native build, staging, commit, or Git push was performed.

## Token-handful continuation handoff — September 11, 2026

- User requested continuity planning because of token limits and is asking that work continue with a different model. Continue in the existing `JourneyDeckv2` workspace and keep all current V2 work in this branch.
- Current V2 status is stable on iPad-landscape memory-detail and editor polish, with additional source changes still present in the worktree: shared image-loading, watermark/welcome, theme paywall gating, six-column iPad layout work, sidebar translucency behavior, Home artwork refresh for Grand Touring, and other prior iPad release fixes.
- Operational preference remains: after verified JS/TS/styling changes, publish an OTA update by default to the current TestFlight app (`2.0.0-watch.4`) unless the user explicitly says not to, or a native build is required.
- Ongoing v2 goal is still iPad/landscape release polish and final stability, with no unrelated refactors.
- Immediate priorities for handoff: keep validating all iPad variants (landscape, portrait, native sidebar left/right, Split View, large Dynamic Type), theme transition resilience on long sessions, and paywall/access flow behavior without introducing dependency changes or non-V2 work.
- Existing next review items to keep on top: repeat physical checks of the memory details layout and Home artwork visibility across all four themes, and continue to avoid native sidebar width changes.

## iPhone Home post-load spacing stability — September 11, 2026 (OTA published)

- Diagnosed the apparent downward movement of the latest-song widget after Home data loaded. The song artwork already had fixed 58pt geometry; the actual reflow came from the preceding latest-Memory card gaining an ID and therefore mounting `CardDetailLink`'s compound native journey context-menu host. That host contributed extra native layout space below the card only in the loaded state.
- Kept the latest-Memory card's direct tap and Apple zoom detail transition, but passed an empty action list on this Home preview so the compound long-press menu host is not mounted there. Journey edit/share actions remain available from the full journey surfaces. The unloaded and loaded Home stacks now use the same layout geometry.
- Added a focused structural regression assertion in `tests/tab-runtime.test.mts`. Verification passed: `npm run test:tab-runtime` 31/31, TypeScript, iOS Expo export with 2,503 modules and 77 assets at `mobile/recorder/.cache/home-spacing-stable-export`, and `git diff --check` with only existing CRLF notices. The complete mobile suite ran 555 tests; 554 passed and one unrelated ripple-diagnostics expectation failed because the runtime now emits `temporary_file_released` after `overlay_cleared` while the existing test still expects the older event list.
- Published and verified on the iOS `production` branch with the production environment for runtime `2.0.0-watch.4`: group `2fc40a91-2e82-40fc-bc9d-a77515e90322`, update `01a09372-4fce-7c69-ab94-7c802bac2428`, message `Keep Home spacing stable after data loads`. Server readback confirmed it is the production head. No native build, staging, commit, or Git push was performed.
- Pending device review: cold-launch the iPhone up to twice, confirm Data Health shows short update ID `01a09372`, then watch the Home screen through journey/music loading and confirm the gaps above and below Latest Memory remain equal.

### Claude Code pickup checkpoint

- Continue in `C:\Users\patri\JourneyDeckv2` on branch `codex/journeydeck-v2`. Read root `GEMINI.md`, `mobile/recorder/AGENTS.md`, and this file before acting. The working tree intentionally contains a large set of uncommitted V2 changes from multiple completed polish passes; preserve them and do not reset, revert, stage, commit, or push unless the user explicitly requests it.
- The Home post-load spacing correction is already implemented in `mobile/recorder/src/shell.tsx`, covered in `mobile/recorder/tests/tab-runtime.test.mts`, and published in OTA `01a09372-4fce-7c69-ab94-7c802bac2428`. Do not reimplement or republish it unless physical-device testing still reproduces the shift.
- First continuation action: verify the installed TestFlight app reports short update ID `01a09372`. On iPhone Home, observe the transition from placeholder content to the loaded latest Memory and song. The vertical space from Start Journey to Latest Memory is intentionally exceptional; the gap from Latest Memory to Latest Song should remain at the shared 16pt panel gap before and after data arrives.
- If the shift remains, capture both states and inspect native layout measurements around the latest-Memory `CardDetailLink` before changing numeric gaps. The album artwork and fallback are both fixed at 58pt, so changing artwork dimensions or adding conditional margins would treat the symptom rather than the known reflow source.

## Claude Code spacing handoff OTA — September 12, 2026 (published)

- Claude Code completed additional JavaScript/TypeScript-only layout work but its session could not reach npm or Expo because all outbound hosts were rejected by its egress proxy. Codex independently inspected the resulting working tree and performed the release from `C:\Users\patri\JourneyDeckv2\mobile\recorder`.
- The newest source edits align phone Soundtracks with the shared 16pt page rhythm and bottom inset, migrate its remaining artist/archive thumbnails to `JourneyImage`, and apply whole-column six-track sizing plus 12pt gutters throughout the shared Statistics landscape layout. No new dependency, native module, permission, bundle identity, runtime, or persistence change was introduced.
- Independent verification passed: TypeScript; focused Soundtracks, Statistics, and tab-runtime tests 41/41; complete mobile suite 555/555; `git diff --check` with only existing CRLF notices; local iOS Expo export at `mobile/recorder/.cache/claude-spacing-handoff-export` with 2,503 modules and 77 assets.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `d69ccc5a-74b2-411c-8cbd-208183f2935f`, update `01a0954a-96eb-7cc8-8de2-0943330c6701`, message `Align Soundtracks and Statistics spacing`. `eas update:list` and `eas update:view` confirmed this exact update is the production head.
- Physical review: cold-launch the TestFlight app up to twice and confirm Data Health shows short update ID `01a0954a`. Check phone Soundtracks spacing and bottom resting inset, then iPad Statistics in landscape with the native sidebar on either side, portrait, Split View, and larger Dynamic Type. No native build, staging, commit, or Git push was performed.
## Statistics range controls below header — September 12, 2026 (production OTA published)

- Updated `mobile/recorder/src/ipad-statistics-screen.tsx` so the Statistics range selector renders directly below the artwork header instead of inside it.
- On iPhone at standard text sizes, `7D`, `30D`, `90D · Plus`, and `All · Plus` now share one equal-width row. At accessibility font scales above 1.2, the selector returns to the existing two-row layout to prevent clipping. The sliding selection highlight, Plus gating, haptics, and range state remain unchanged.
- Expanded `mobile/recorder/tests/ipad-statistics.test.mts` to verify the controls are outside the header, all four filters share one compact row, narrow labels can contract, and larger Dynamic Type wraps safely.
- Verification passed: `npm run typecheck`; focused Statistics and motion tests (12/12); complete mobile suite (555/555); `npx expo export --platform ios --output-dir dist-statistics-filters`; and `git diff --check` (only existing line-ending warnings).
- Published and verified on the iOS `production` branch with the production environment for runtime `2.0.0-watch.4`: group `652ce96f-4062-4092-b024-4f60f2e60fe9`, update `01a095ee-1bf8-7b92-a9fd-f3efc907cc6a`, message `Place Statistics filters below header`. Server readback confirms it is the production head.
- Physical review: cold-launch the TestFlight app up to twice and confirm Data Health shows short update ID `01a095ee`. Check the Statistics header/filter order and four-button row on a normal iPhone text size, then confirm larger Dynamic Type wraps without clipping. No native build, staging, commit, or Git push was performed.

## Unpublished Statistics filter color polish — September 12, 2026

- Updated the Statistics range selector so `7D` uses the same theme-resolved accent and selected-highlight color as `30D`. Chart and distance-band colors remain unchanged.
- Added a focused assertion that selecting `7D` produces the same border accent as the default selected `30D` filter.
- Verification passed: focused Statistics tests 7/7, TypeScript, and `git diff --check` with only existing line-ending warnings.
- Per the user's instruction, this change has **not** been published as an OTA. Bundle it with the next small polish changes before publishing.

## Unpublished repeatable custom Safe Places — September 12, 2026

- Added repeatable custom Safe Places beneath Home, Work, and School on both iPhone and iPad Settings. The always-present `Custom` row opens an editor requiring a name and street address; after saving, the named place appears in the list and the row changes to `Add another safe place`.
- Existing custom entries can be reopened, updated with a newly entered address, or removed. Custom places use distinct stable IDs, the existing local place table, endpoint naming/linking, private iCloud preference records, archive-change notifications, and the same 300-meter protection radius as the fixed Saved Places.
- Expanded the sensitive-place query so only user-created custom Safe Places (the `saved-custom-place-v1-` identity) join Home, Work, and School in share-route masking. Temporary geocoder cache entries and unrelated custom aliases remain excluded.
- Changed files for this feature: `mobile/recorder/src/local-store.ts`, `mobile/recorder/src/saved-places.ts`, `mobile/recorder/src/shell.tsx`, `mobile/recorder/src/ipad-settings-screen.tsx`, `mobile/recorder/tests/saved-places.test.mts`, `mobile/recorder/tests/ipad-settings.test.mts`, and `mobile/recorder/tests/private-library-sync.test.mts`.
- Verification passed: TypeScript; 47 focused Settings, persistence, iCloud, place-matching, and sharing tests; complete mobile suite 556/556; `git diff --check` with only existing CRLF notices; and iOS Expo export at `mobile/recorder/.cache/custom-safe-places-export` with 2,503 modules and 77 assets.
- Per the user's instruction, this feature and the preceding Statistics color change have **not** been published as an OTA. No native build, staging, commit, or Git push was performed.
## Unpublished Soundtracks metric icon polish — September 12, 2026

- Replaced the four thin text glyphs in the iPhone Soundtracks metric cards with filled SF Symbols: `car.fill`, `headphones.circle.fill`, `waveform.circle.fill`, and `flame.fill`.
- Enlarged each badge from 43pt to 48pt and added a layered theme-resolved gradient, stronger border, bold hierarchical symbol rendering, and brighter centered glow. Card dimensions, values, labels, and screen-reader text remain intact.
- Changed `mobile/recorder/src/music-screen.tsx` and added focused structural coverage in `mobile/recorder/tests/tab-runtime.test.mts`.
- Verification passed: TypeScript, tab-runtime tests 32/32, and `git diff --check` with only existing CRLF notices. The complete 556-test suite passed immediately before this isolated visual change.
- Per the user's instruction, this change remains unpublished with the Statistics color and repeatable custom Safe Places work. No OTA, native build, staging, commit, or Git push was performed.

## Combined small-polish production OTA — September 12, 2026 (published)

- Published the previously batched Statistics filter color, repeatable custom Safe Places, and Soundtracks metric icon changes together. `7D` now shares the selected yellow/accent treatment with `30D`; Settings supports any number of named custom Safe Places with private persistence, iCloud sync, endpoint naming, and share-route masking; phone Soundtracks KPI cards use larger filled SF Symbols with theme-resolved layered halos.
- Added the missing `expo-symbols` mock to `mobile/recorder/tests/ipad-music.test.mts` so the iPad Music VM fixture covers the new Soundtracks icon import without loading Expo's native implementation in Node.
- Final verification passed: TypeScript; complete mobile suite 557/557; iOS Expo export with 2,503 modules and 77 assets at `mobile/recorder/.cache/all-small-polish-export`; and `git diff --check` with only existing CRLF notices.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `d2243e75-b1f7-4631-9249-aba3a2681746`, update `01a09616-7d38-7b69-8853-6142ccd36dd1`, message `Add custom Safe Places and polish Statistics and Soundtracks`. Both `eas update:list` and `eas update:view` confirmed it is the production head.
- Physical review: cold-launch the TestFlight app up to twice and confirm Data Health shows short update ID `01a09616`. Check both `7D` and `30D` selection colors, add/edit/remove several custom Safe Places and confirm they survive relaunch/iCloud sync, and review the four Soundtracks KPI icons in all themes. No native build, staging, commit, or Git push was performed.

## Memory action, Soundtracks icon, and Settings order polish — September 12, 2026 (published)

- Centered the phone Memories refresh control beneath the New Memory plus button by giving both action rows the same 5pt horizontal inset.
- Changed the `Songs on the road` waveform KPI from the blue token to the same theme-resolved gold/coral accent path used by the other Soundtracks metrics in Grand Touring.
- Reordered the shared `settingsCategories` catalog alphabetically by displayed title: Account & iCloud, Appearance, Membership & Support, Music & Connections, Recording & Location, Saved Places. Both phone and iPad consume this single order; the prominent driver-profile card remains separate.
- Made the ripple lifecycle regression deterministic by waiting for the deferred screenshot release and asserting `temporary_file_released`, matching the intended cleanup behavior already present in source.
- Verification passed: focused Memories 7/7, Settings 3/3, tab-runtime 32/32, ripple transition 9/9; TypeScript; complete mobile suite 557/557; iOS Expo export with 2,503 modules and 77 assets at `mobile/recorder/.cache/alignment-icon-settings-export`; and `git diff --check` with only existing CRLF notices.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `4db1cf1f-c9c2-4ccb-934a-1b730eee01d9`, update `01a0961f-38e2-7642-a75a-5642ae451d4a`, message `Align Memory actions and polish Soundtracks and Settings`. `eas update:list` and `eas update:view` confirmed it is the production head.
- Physical review: cold-launch the TestFlight app up to twice and confirm Data Health shows short update ID `01a0961f`; inspect the plus/refresh vertical alignment on phone Memories, the gold waveform KPI in Grand Touring Soundtracks, and alphabetical category order on both phone and iPad Settings. No native build, staging, commit, or Git push was performed.

## Statistics artwork visibility and Appearance interaction repair — September 12, 2026 (published)

- Removed `Every mile. Every journey. Your numbers.` from the Statistics header. Added a Statistics-only `bright` artwork treatment that reduces the page-color wash over the center and delays the bottom fade, while retaining `HeaderArtworkLayers` and its existing blurred edge feather. Other tab headers retain the standard treatment.
- Hardened Appearance input inside Settings scroll containers on iPhone and iPad. The parent scroll views now preserve taps and direction-lock nested gestures; the theme carousel explicitly participates in nested scrolling and retains taps; app-icon choices use a larger press-retention area. Theme commits remain deliberate: direct taps commit immediately, while swipes commit only after snapping settles.
- Verification passed: TypeScript; focused Statistics, Settings, theme-carousel, app-icon, Saved Places, and tab-runtime tests; complete mobile suite 557/557; iOS Expo export with 2,503 modules and 77 assets at `mobile/recorder/.cache/statistics-appearance-interaction-export`; and `git diff --check` with only existing CRLF notices.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `d49db63b-67e9-45e3-b8f7-84aa8937b5ca`, update `01a0962a-d718-7daf-b9d1-12ef4b9d197f`, message `Brighten Statistics header and restore Appearance interactions`. `eas update:list` and `eas update:view` confirmed it is the production head.
- Physical review: cold-launch up to twice and confirm Data Health shows short update ID `01a0962a`. In Appearance, swipe the carousel, tap both free themes, verify Plus themes open the paywall when appropriate, and select each app icon. Then confirm the Statistics photo is more visible in all four themes while its edges still fade into the page. No native build, staging, commit, or Git push was performed.

## Appearance touch responder repair — September 12, 2026 (published)

- Physical testing showed the preceding nested-scroll adjustment was insufficient: Appearance cards displayed their pressed indentation but iOS cancelled the release before `onPress`, and the horizontal theme carousel could not claim its drag gesture.
- Updated the phone Settings editor and iPad Settings detail scrollers to set `canCancelContentTouches={false}` and `disableScrollViewPanResponder`, while retaining nested scrolling and `keyboardShouldPersistTaps="always"`. This lets the horizontal theme list and app-icon radio cards own touches that begin inside them.
- Added a 650ms ripple preparation fail-safe. If the captured Skia image or modal readiness stalls, the transparent ripple layer clears and the already-persisted theme is applied instead of leaving Appearance blocked behind a modal.
- Verification passed: TypeScript; 36 focused Settings, theme carousel, app-icon, ripple lifecycle, and interruption tests; complete mobile suite 558/558; iOS Expo export with 2,503 modules and 77 assets at `mobile/recorder/.cache/appearance-touch-responder-export`; and `git diff --check` with only existing CRLF notices.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `5bdd61ae-a434-4c1b-84eb-96a6fbff728e`, update `01a09633-d843-7ba5-a05a-e3fa5776bc9b`, message `Restore Appearance touch handling`. `eas update:list` and `eas update:view` confirmed it is the production head.
- Physical review: cold-launch up to twice and confirm Data Health shows short update ID `01a09633`. On both phone and iPad where available, drag the theme carousel, tap a theme card, and tap an app-icon card. Confirm vertical Settings scrolling still works when dragging outside those controls. No native build, staging, commit, or Git push was performed.

## Theme carousel native scroller replacement — September 12, 2026 (published)

- Reviewed the user's 7.5-second iPhone screen recording frame by frame. It confirmed that Settings and native app-icon selection respond normally, including the iOS icon confirmation, while the theme cards and indicator remain fixed through the attempted carousel interaction. The remaining defect was isolated to the carousel control rather than the parent Settings responder or icon provider.
- Replaced the four-item virtualized `Animated.FlatList` in `mobile/recorder/src/theme-picker.tsx` with a native horizontal `Animated.ScrollView`. All four cards are now mounted continuously; snapping, centered-card depth, direct taps, settled-swipe commits, interruption handling, Reduce Motion, VoiceOver adjustment, theme persistence, Plus gating, and the existing water transition are preserved. Updated both carousel fixtures (`tests/theme-picker-carousel.test.mts` and `tests/premium-themes.test.mts`) to exercise the actual ScrollView interface.
- Verification passed: TypeScript; focused Appearance/ripple/icon tests 36/36; complete mobile suite 558/558; iOS Expo export with 2,503 modules and 77 assets at `mobile/recorder/.cache/appearance-native-scroll-export`; and `git diff --check` with only existing CRLF notices.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `da71e98b-779a-4481-b917-e66856e2a353`, update `01a0963e-9315-78fa-82d6-5624f90512b0`, message `Replace stalled theme carousel scroller`. `eas update:list` and `eas update:view` confirmed it is the production head.
- Physical review: cold-launch up to twice, confirm Data Health shows short update ID `01a0963e`, then drag across the center card in both directions and tap the visible neighboring cards. Confirm the selected card centers, the indicator advances, and the theme applies after settling. No native build, staging, commit, or Git push was performed.

## Appearance carousel rollback to proven implementation — September 12, 2026 (published)

- A second physical iPhone recording showed the replacement carousel receiving only a few points of horizontal movement before snapping back to Grand Touring. The app-icon picker continued to work, confirming the remaining failure was isolated to the theme carousel gesture path.
- Git history could not supply the working carousel because its original source was published from an uncommitted temporary worktree. The exact implementation and final pre-release adjustment were recovered from the September 9 Codex session history and checked against the retained original iOS OTA export for group `799af2c3-187e-4187-9c7c-1201e37b185d` / update `01a08d13-ce7f-7a52-99e7-9a102b07f66b` (`Add card-based theme carousel`). That release used `Animated.FlatList`, `scrollToOffset`, and native parent-scroll gesture arbitration.
- Restored that proven `Animated.FlatList` structure in `mobile/recorder/src/theme-picker.tsx`, including all four items mounted, native interval snapping, `disableIntervalMomentum`, centered-card transforms, tap selection, settled-swipe selection, interruption handling, Reduce Motion, and VoiceOver adjustment. Removed the later speculative carousel `nestedScrollEnabled` / tap-retention props and removed the parent Settings `disableScrollViewPanResponder` / `canCancelContentTouches={false}` overrides from `mobile/recorder/src/shell.tsx` and `mobile/recorder/src/ipad-settings-screen.tsx`.
- Preserved all newer product behavior around the proven scroller: the four TypeScript theme definitions, Grand Touring V2 artwork, Plus locks and upgrade routing, secure persistence, stable selection semantics, and the existing water transition. The independent 650ms ripple-preparation fail-safe remains because it does not participate in pre-selection dragging. Also restored the missing phone `membershipTier` and `onUpgrade` props so Cinematic Dark and Rosewater cannot bypass the paywall on iPhone.
- Updated the FlatList-based carousel, premium-theme, Settings, and Saved Places regression fixtures. Verification passed: TypeScript; focused Appearance/Settings/ripple/app-icon tests 41/41; complete mobile suite 558/558; iOS Expo export with 2,503 modules, 77 assets, and an 8.5 MB Hermes bundle at `mobile/recorder/.cache/appearance-carousel-rollback-export`; and `git diff --check` with only existing CRLF notices.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `3194444b-6d74-4ee9-90f7-70a699b9cfa3`, update `01a09708-00a1-77c8-9375-fc87f91b590a`, message `Restore proven Appearance carousel gestures`. Both `eas update:list` and `eas update:view` confirmed it is the production head.
- Physical review: cold-launch the TestFlight app up to twice and confirm Data Health shows short update ID `01a09708`. In phone Appearance, drag from the center of Grand Touring far enough to reach Warm Ivory and back to Cinematic Dark, tap both visible neighbors, and verify the indicator and centered card move together. On a free account, Cinematic Dark/Rosewater should open Plus; on a paid account, every selection should persist and invoke one ripple after the card settles. Repeat on iPad Appearance and confirm vertical Settings scrolling still works outside the carousel. No native build, staging, commit, or Git push was performed.

## Direct Appearance selection grids — September 12, 2026 (published)

- At the user's direction, abandoned the carousel interaction entirely and rebuilt the Appearance controls as direct 2x2 radio-card grids. There is no horizontal theme list, snapping, momentum state, page indicator, adjustable carousel, or nested gesture arbitration in Appearance.
- Theme order is explicit and catalog-backed: the top `FREE` row is Grand Touring (`redline`) and Warm Ivory (`light`); the bottom `JOURNEYDECK PLUS` row is Cinematic Dark (`dark`) and Rosewater (`sakura`). Each card shows the existing artwork, name, light/dark appearance, description, palette swatches, selected check, and Plus badge where applicable. Free taps commit immediately through the existing secure `transitionTheme` water-ripple flow; locked taps open the existing membership paywall. A free account with a restored locked theme retains the prior normalization to Grand Touring.
- App icons now use the same 2x2 tier presentation. The top free row is Grand Touring and Warm Ivory; the bottom Plus row is Original/Cinematic and Rosewater. Direct free taps still use the existing native icon provider and secure icon preference. Locked icon taps open the same membership paywall. An already active native icon is displayed honestly and is not changed automatically when the page opens.
- Added `FREE_THEME_IDS` / `THEME_GRID_ORDER` to `src/theme-catalog.ts` and `FREE_APP_ICON_IDS` / `PLUS_APP_ICON_IDS` / `APP_ICON_GRID_ORDER` plus `appIconRequiresPlus` to `src/app-icon-catalog.ts`. Phone and iPad Settings now pass the verified membership tier and existing upgrade action to both pickers. Removed the obsolete untracked `src/theme-picker-model.ts` carousel model and replaced its carousel fixture with focused direct-grid coverage in `tests/theme-picker-grid.test.mts`; added `tests/app-icon-picker-grid.test.mts`.
- Accessibility: all eight choices are individually activatable radio controls with name, position, description, tier, selected state, and a direct paywall hint when locked. Important card text is not line-clamped and can grow for Dynamic Type. The two fixed rows retain two equal-width cards on phone, iPad, and Split View.
- Verification passed: TypeScript; focused theme/icon/Settings/ripple tests 33/33; complete mobile suite 560/560; iOS Expo export with 2,502 modules, 77 assets, and an 8.5 MB Hermes bundle at `mobile/recorder/.cache/appearance-grid-export`; and `git diff --check` with only existing CRLF notices.
- Published with the EAS `production` environment to the iOS `production` branch for runtime `2.0.0-watch.4`: group `4a0af5d1-266b-4972-b2bc-c8dc18202498`, update `01a0971b-5f48-7506-9c4f-4ba768f893e8`, message `Replace Appearance carousel with direct 2x2 grids`. Both `eas update:list` and `eas update:view` confirmed it is the production head.
- Physical review: cold-launch the TestFlight app up to twice and confirm Data Health shows short update ID `01a0971b`. Check the two-by-two rows on a narrow iPhone, iPad portrait, iPad landscape, Split View, and larger Dynamic Type. Tap both free themes, both Plus themes on free and paid accounts, both free icons, and both Plus icons; verify one ripple per successful theme tap, the paywall for locked cards, and native icon confirmation for allowed icon changes. No native build, staging, commit, or Git push was performed.

## Cinematic app-icon label — September 12, 2026 (published)

- Renamed the user-facing `Original` app-icon choice to `Cinematic`. Its stable persisted ID remains `original`, its native name remains `null`, and the underlying icon asset and Plus placement are unchanged.
- Verification passed: TypeScript; focused icon/Settings tests 12/12; complete mobile suite 560/560; EAS iOS export/publish; and `git diff --check` with only existing CRLF notices.
- Published and read back on the iOS `production` branch for runtime `2.0.0-watch.4`: group `d674ef52-3b5c-47fa-8ee0-98fb8d84abba`, update `01a0975d-6686-7b1b-90f4-d3e7cf4e6963`, message `Rename Original app icon to Cinematic`. No native build, staging, commit, or Git push was performed.
## Minted first-journey keepsake — September 12, 2026 (TestFlight Build 27)

- The user selected keepsake concept 1 and asked to run it through Minted, with music remaining the app's key differentiator. The source artwork is a cream-and-coral road medallion whose rising sun is a gold vinyl record and whose highway markings form a musical staff.
- Added a local Expo module at `mobile/recorder/modules/journeydeck-keepsakes` that pins `haplollc/Minted` to exact version `1.1.1`, converts the bundled flat artwork into `ArtworkCoin`, and presents `SpinningArtworkCoinView` with idle rotation and drag interaction. A static React Native image remains as the non-native fallback.
- Added `The First Track` earned card to phone and iPad Memories when at least one journey exists. Production runtime is isolated at `2.0.0-watch.6`; preview is `2.0.0-preview.11`.
- Verification passed: focused keepsake/runtime/Memory tests 25/25, TypeScript, complete mobile suite 642/642, Expo autolinking, and iOS Hermes export with 2,515 modules and 78 assets. Build attempts 25 and 26 exposed and resolved Minted's iOS 17 floor and Expo Fabric's optional `AppContext` initializer requirement.
- Production EAS Build 27 `f3cf1d44-e1d6-4200-9ceb-b52d9da210e5` finished successfully. Signed IPA inspection confirmed JourneyDeck 2.0.0 (27), iPhone+iPad, iOS 17.0, paired Watch app, runtime `2.0.0-watch.6`, `JourneyDeckKeepsakes.bundle`, identical bundled artwork, and compiled Minted symbols. IPA SHA-256: `EF502E16FF561128B4F9E1997DA71E2C50E75A7DE74ECA24EA1EDB63C60F4A72`.
- Exact-build submission `e9b06d03-7d3f-477a-834e-a2dae356ea2f` completed. App Store Connect reports Build 27 `VALID`, `IN_BETA_TESTING`, `READY_FOR_BETA_SUBMISSION`, and not expired. Physical review remains: install Build 27, open Memories after a journey, inspect relief and gold-vinyl detail in every theme, drag and release the coin, wait for idle rotation, and repeat on iPad/VoiceOver. No Git staging, commit, push, or OTA was performed.

## First-journey medallion face correction — September 12, 2026 (published OTA)

- Physical review of Build 27 showed Minted's generated reverse/edge treatment at rest instead of the intended gold-vinyl road artwork. To avoid consuming another paid native build, the JavaScript bridge now presents the already-bundled artwork as a circular, updateable React Native face with a horizontal drag/3D turn and spring return. The compiled Minted module remains available for a later planned native release.
- Verification passed: TypeScript; complete mobile suite 642/642; focused keepsake tests 3/3; and iOS Expo export with 2,515 modules and 78 assets at `mobile/recorder/.cache/keepsake-ota-export`.
- Published with the EAS `production` environment to the iOS `production` branch for Build 27 runtime `2.0.0-watch.6`: group `6d107750-257d-4bf9-be16-0b1e7e52151d`, update `01a098f1-ebc6-70ef-bd5c-c3d29a58e662`, message `Fix first journey medallion artwork face`. No native build, staging, commit, or Git push was performed.
- Physical review: cold-launch the TestFlight app up to twice, confirm Data Health shows short update ID `01a098f1`, open Memories, and verify the medallion shows the gold vinyl sunrise above the road/music staff and returns face-forward after a horizontal drag.
- The first physical check of that OTA showed a blank white oval: the React Native `Image` did not paint reliably inside an absolutely filled, non-square animated container. Replaced it with the already-shipping `expo-image` renderer, explicit 100% dimensions, zero transition, and a centered 1:1 coin so the face cannot stretch into an oval.
- TypeScript and focused keepsake tests 3/3 passed; the EAS export completed with 2,515 modules and 78 assets. Replacement production OTA for runtime `2.0.0-watch.6`: group `e5da178e-de80-4414-a574-8d44ecc62466`, update `01a098f5-8977-76bf-b4ba-f5e75994f063`, message `Render first journey medallion artwork reliably`. No native build was started.

## Title-only non-Home tab headers — September 12, 2026 (published OTA)

- At the user's direction, removed decorative header artwork from the Soundtracks, Memories, Statistics, and Settings tabs on both iPhone and iPad. Each tab retains its title at the top. Home retains its cinematic artwork on both form factors; content imagery inside Memory cards, Statistics storytelling cards, and secondary experiences remains intact.
- Updated `IpadPageHeader` so artwork is optional and title-only tabs use a compact plain header rather than reserving an empty hero area. Removed obsolete phone header wrappers and updated the structural and rendered layout coverage.
- Verification passed: TypeScript; focused phone/iPad tab layout tests 62/62; complete mobile suite 642/642; and EAS iOS export with 2,515 modules and 78 assets.
- Published with the EAS `production` environment to the iOS `production` branch for Build 27 runtime `2.0.0-watch.6`: group `ef5883e2-e434-4f63-aaa6-7cfdd7406f25`, update `01a09916-8282-712e-99d1-5f3aa2498bdb`, message `Keep Home artwork and simplify other tab headers`. No native build, staging, commit, or Git push was performed.

## Public-site launch readiness — September 13, 2026 (live)

- Added the five agreed launch items: an above-fold `Follow the launch` CTA on the public and `/beta` landing pages, a branded custom 404 page, `robots.txt`, `sitemap.xml`, and tailored JourneyDeck Terms of Use. Privacy and Support now link to Terms.
- Preserved access boundaries: `/beta` remains `noindex, nofollow`; `/app` still redirects to login; API routes remain protected; the sitemap lists only `/`, `/privacy`, `/support`, and `/terms`.
- Merged PR #144 (`https://github.com/drumpat01/DriveOS/pull/144`) as commit `653d0394dc231a76ea29635af118f316f7bb1e41`. Render deploy `dep-dajbnb8jo6nc73c88je0` is live at `https://journeydeck.me`.
- Verification passed: server typecheck and lint, server tests 34/34, focused public-route tests 12/12, diff checks, live HTTP route checks, and live Playwright checks at 1440x1000 and 390x844 with no overflow, broken images, asset failures, or page errors. Render reported no error logs after deployment.
- The complete local E2E suite passed 8/9. Its only failure is the pre-existing Statistics fixture assertion (`#statisticsScore` remains `--` with August 2026 fixture dates), which is unrelated to these web changes. GitHub validation run `34764534829` was still running at handoff time.
- Work was isolated on `codex/site-launch-readiness`; the existing dirty mobile working tree was preserved. No mobile source, native build, or OTA release was changed.

## Medallion review site and fixed-gold reverse — September 13, 2026 (live)

- Created the private JourneyDeck medallion review site at https://journeydeck-medallion-review.drumpat01.chatgpt.site from the nested repository at `medallion-demo-site`. It previews The First Track in Grand Touring, Rosewater, Cinematic Dark, and Warm Ivory with drag, momentum, idle rotation, a modeled edge/reverse, and placeholders for the remaining nine medallions.
- Corrected the modeled coin so theme selection changes only the front artwork and surrounding demo palette. The reverse and edge now remain regular gold across every theme, with a subtle orange-peel surface matching Minted's default die-struck back.
- Site version 3 is deployed privately from commit `09441f747133aeddcefb89ff4aa6df4a39934240` (deployment `appgdep_6aa74703e34481918fc796e6e75cc87a`). Static JavaScript syntax and Git diff checks passed.
- No mobile source, Expo/EAS update, or native build was made. Continue adding approved medallion artwork to this demo, then integrate the complete set into the app for one later build.

## Road Regular medallion approved — September 13, 2026 (live demo)

- The user approved Road Regular option 6: a sculpted numeral 10 formed from parallel road bands, with the road rising through the zero.
- Saved the gold master and four transparent theme fronts under `mobile/recorder/assets/medallion-concepts/road-regular`. The theme treatments are Grand Touring, Rosewater, Cinematic Dark, and Warm Ivory; the structural rim remains gold.
- Added Road Regular as the second selectable achievement on the private review site. Site version 4 is live from nested-site commit `5d7d339402621ff343e1c91402f148ff61e4d1b7`, deployment `appgdep_6aa74d80311c8191a67dd5243fd704e3`.
- Updated `docs/medallions.md` with the approved choices. No app source integration, Expo/EAS update, or native build was made.

## Century Road medallion approved — September 13, 2026 (live demo)

- The user approved fresh-set option 1 for Century Road: a bold Art Deco 100 with streamlined road wings, a central approach road, and an MI plaque.
- Warm Ivory was corrected at the user's direction to exclude blue, cyan, and teal; it uses ivory, antique gold, muted plum, terracotta, and warm brown.
- Saved the gold master and four transparent theme fronts under `mobile/recorder/assets/medallion-concepts/century-road`.
- Added Century Road as the third selectable achievement on the private review site. Site version 5 is live from nested-site commit `79e47859650f4a8e1fcaeeaa3e9485711e7d305c`, deployment `appgdep_6aa75699d4f481918d7513b593bd8e43`.
- No app source integration, Expo/EAS update, or native build was made.

## Soundtrack 100 medallion approved — September 14, 2026 (live demo)

- The user approved option 1 for Soundtrack 100: a large vinyl record with 100 on its center label and a single highway flowing into the record groove.
- Saved the gold master, four-theme comparison sheet, and four transparent theme fronts under `mobile/recorder/assets/medallion-concepts/soundtrack-100`. Warm Ivory contains no blue, cyan, or teal.
- Added Soundtrack 100 as the fourth selectable achievement on the private review site. Site version 6 is live from nested-site commit `ae321d8d624c83f2d2bac4ee63512da7bb5c271b`, deployment `appgdep_6aa7fe1f504481919f182deb51307461`.
- No app source integration, Expo/EAS update, or native build was made.

## Soundtrack 100 Cinematic Dark palette revision — September 14, 2026 (live demo)

- At the user's direction, replaced the pink-dominant Soundtrack 100 Cinematic Dark front with a deep eggplant/royal-purple treatment using burnt-orange and amber record reflections, lane markings, and landscape highlights.
- Saved the revised four-theme sheet as `soundtrack-100-option-01-four-themes-v2.png` and replaced the canonical transparent Cinematic Dark front used by the demo.
- Site version 7 is live from nested-site commit `f486d3486b2b5b14714925435d8ce049e3e68ac8`, deployment `appgdep_6aa8042921f881919584ddfeb20ca761`.
- No app source integration, Expo/EAS update, or native build was made.

## Medallion review workflow change — September 14, 2026

- The user asked to stop using the medallion demo site. Do not update or publish it during the remaining medallion design work.
- Continue presenting concept boards and four-theme comparison images directly in the Codex conversation and save approved assets under `mobile/recorder/assets/medallion-concepts`.
- Leave the existing private demo site unchanged unless the user explicitly asks to update, archive, or remove it. Continue avoiding app/native builds until the complete medallion set is ready.

## Memory Maker medallion approved — September 14, 2026

- The user approved option 8 for Memory Maker: two embossed hands holding an instant-photo memory of an open road, mountains, and sunrise, with a small heart on the photo border.
- Saved the gold master, four-theme comparison sheet, and four transparent theme fronts under `mobile/recorder/assets/medallion-concepts/memory-maker`.
- Cinematic Dark uses deep purple and burnt-orange/amber highlights rather than pink dominance. Warm Ivory excludes blue, cyan, and teal.
- Per the current workflow, the demo site was not updated. No app source integration, Expo/EAS update, or native build was made yet.

## Memory Maker Cinematic Dark palette revision — September 14, 2026

- Replaced the muted Memory Maker Cinematic Dark front with a stronger neon treatment: black-purple field, saturated ultraviolet, orange/amber sun and lane glow, selective cyan road-edge light, luminous photo-frame edge, and a glowing orange heart.
- Saved the revised comparison sheet as `memory-maker-option-08-four-themes-v2.png` and replaced the canonical transparent Cinematic Dark front in `memory-maker/option-08-theme-variants`.
- Per the user's workflow, the demo site was not updated. No app source integration, Expo/EAS update, or native build was made.

## Approved medallion app integration — September 14, 2026

- Integrated the five approved medallions into Achievements: The First Track option 1, Road Regular option 6, Century Road option 1, Soundtrack 100 option 1, and Memory Maker option 8. Each front switches with the active Grand Touring (`redline`), Rosewater (`sakura`), Cinematic Dark (`dark`), or Warm Ivory (`light`) theme.
- Added all 20 approved theme fronts to the JourneyDeckKeepsakes iOS resource bundle. The Expo native view now accepts achievement/theme/name props, mints the selected front with Minted 1.1.1, starts face-forward, and uses one fixed regular-gold body, edge, and orange-peel reverse for every theme.
- Added a native catalog version gate. Existing binaries continue to use the two-sided React Native fallback, so they never render the old first-journey native asset for a different achievement; the Minted catalog activates after the later native build includes version 2.
- Expanded the achievement catalog to all 10 planned medallions. Memory Maker unlocks from the earliest valid Memory creation date, Grand Tourer unlocks at 100 journeys, and the five designs still awaiting approval retain symbol placeholders.
- Verification passed: TypeScript, focused achievement/Minted tests 5/5, full mobile suite 644/644, and `git diff --check` (line-ending warnings only). No Expo/EAS update, native build, demo-site update, staging, commit, or push was performed.

## OTA-delivered Minted artwork bridge — September 14, 2026

- Reworked the planned Minted integration so medallion fronts are Expo assets delivered by the JavaScript/OTA bundle. The bridge downloads the selected theme asset, passes its local file URI to native code, and keeps the React Native two-sided coin visible while that file becomes available.
- Raised the native catalog capability to version 3. Native Minted now accepts any local artwork URI rather than hardcoding achievement IDs, themes, or resource names. New medallion artwork, names, theme mappings, and achievement rules can therefore be added in a later OTA after one native build ships this generic engine.
- Removed the CocoaPods resource-bundle declaration, so the native target does not compile the current 20 fronts into the app. Minted itself, its fixed gold material, SceneKit behavior, and the URI bridge remain native and require a new build only when those parts change.
- Added the pinned Expo Asset JavaScript dependency (`expo-asset` 57.0.16). Verification passed: TypeScript, focused achievement/Minted tests 5/5, full mobile suite 644/644, and `git diff --check` (line-ending warnings only). No Expo/EAS update, native build, demo-site update, staging, commit, or push was performed.

## Repository checkpoint authorization — September 14, 2026

- The user explicitly authorized committing and pushing all accumulated JourneyDeck changes, while keeping native/EAS builds on hold.
- The app repository checkpoint includes the complete mobile source/test/documentation work and canonical medallion concepts. The separate clean `medallion-demo-site` workspace remains outside the app repository, and generated duplicate native medallion resources remain ignored because Minted now consumes OTA assets.
- Pre-commit verification passed: TypeScript, focused achievement/Minted tests 5/5, full mobile suite 644/644, staged `git diff --check`, and a staged-path credential filename audit. No native/EAS build or OTA was started.

## JourneyDeck 2.0 release-candidate audit — September 14, 2026

- Reconciled `codex/journeydeck-v2` with `origin/main`, including the live public-site launch work. Preserved the production-accurate manual-only privacy language, added Terms/final support contact links, and added a regression check excluding Automatic Drive Detection and Tessie from the public policy.
- Prepared the next native source candidate on production runtime `2.0.0-watch.7` and preview runtime `2.0.0-preview.12`. Added the exempt-encryption declaration and documented NB-009, the generic Minted OTA-artwork bridge. The remote production build counter remains 27, so the next auto-incremented build is expected to be 28.
- Aligned Expo SDK 57 patch packages, removed high dependency findings, upgraded Wrangler to 4.131.2, regenerated Cloudflare types, and excluded ignored generated caches from the repository vulnerability scan.
- Verification passed: Expo Doctor 21/21, TypeScript, focused release tests 20/20, mobile 644/644, production iOS JS export with 97 assets and all 20 approved theme fronts, public release preflight, server typecheck/lint/34 tests, Atlas benchmark, Cloudflare dry run, secret scan, and high/critical vulnerability scan. Live home/privacy/support/terms/robots/sitemap endpoints returned 200.
- Desktop E2E remains 8/9 because the known Statistics fixture leaves `#statisticsScore` as `--`; this is unchanged from the public-site handoff and unrelated to the mobile candidate.
- Remaining release gates are recorded in `docs/app-store/RELEASE_CANDIDATE_STATUS.md`: finish five medallion designs, capture real upload-ready iPhone/iPad screenshots, deploy the corrected public privacy page, confirm App Store Connect/privacy/subscription/account state, build and inspect the signed IPA, then complete iPhone/iPad/Watch TestFlight acceptance.
- No native/EAS build, OTA, upload, public-site deploy, or App Review submission was started. The build hold remains active.
