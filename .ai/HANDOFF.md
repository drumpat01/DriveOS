# Current AI Handoff

Last updated: September 19, 2026

## Current objective

The Home, Memories/Journey, Music, Statistics, and Settings redesigns for the new "Cinematic Roadbook" language are implemented alongside Journey Marker acceptance on Expo SDK 58 beta/iOS 27. The Appllama skills and authenticated MCP are installed; September 19 research leaves 1,417/1,500 monthly credits, resetting October 1, 2026 UTC. See `mobile/recorder/docs/ui-redesign-audit.md` and `research/ui-redesign/`.

## Home pilot implementation

- `src/journeydeck-design-tokens.ts` defines locked spacing, continuous radii, typography, elevation, and semantic colors. Grand Touring uses champagne actions; Warm Ivory uses coral actions while plum remains decorative.
- iPhone Home now renders Record Journey, Latest Memory, one contextual feature, and one consolidated road-summary surface. The default context is the compact 50 States preview; hiding/reordering can promote Ask JourneyDeck or Latest Soundtrack.
- The permanent Customize row is removed. The Home header menu and one-second long presses open `HomeLayoutEditorSheet`, a UIKit page sheet built on the existing `NativeSheet` abstraction.
- The existing 12-column gesture editor remains inside the sheet, including drag reorder, edge resize, hide/show, reset, VoiceOver actions, and SecureStore persistence. iPad uses the same editor sheet and keeps its recorder mounted.
- Untouched legacy default layouts migrate to the new story-first order. Customized order, spans, and hidden states are normalized without being discarded.
- `FiftyStatesHomeWidget` has a dense mini-map preview. The V3 Record Journey action consumes the new semantic accent in both phone and iPad presentations.
- The tested Home pilot was published to the EAS `v3-preview` branch/channel for iOS runtime `3.0.0-preview.4` on September 19. Update group `918a5d9a-9d0a-43f6-9ab4-4eea8d5ccfa7`, update `01a0b964-456e-775e-8cb8-5423ef3e01b7`, message `Home Cinematic Roadbook pilot`. Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/918a5d9a-9d0a-43f6-9ab4-4eea8d5ccfa7`.

## Memories and Journey flow implementation

- Memories now leads with personal Memory cards; the compact 50 States collection follows them. Journey Library starts collapsed, rows open on tap, explicit check controls selection, and the create drop target appears only during a drag.
- Memory detail has direct Story, Photos, and Journeys sections, compact photo management, and no simulated breadcrumb. The edit flow uses the native sheet footer for Cancel/Save, checkmark membership rows, search for long journey lists, and dismisses only after a successful local save.
- Journey detail moves share/location/trim actions to the header menu, places replay controls immediately beneath the map, condenses map help, presents Markers as a compact Moments strip, and previews five soundtrack tracks with View all/Show less. Selecting a track returns to and focuses the map.
- Verification: TypeScript passes; focused Memories/Journey suite passes 25/25; tab runtime passes 34/34; navigation motion passes 6/6; native capabilities passes 4/4. `git diff --check` reports line-ending warnings only. iOS visual/motion acceptance still requires the signed device because this Windows host cannot run the iOS simulator.
- Published the follow-on redesign as an iOS OTA to the `v3-preview` channel/branch with the EAS `preview` environment for runtime `3.0.0-preview.4`. Group `4aad6dbd-c0dc-4656-945d-bce376c813aa`, update `01a0b9c3-44e7-7809-8342-b1f02d3518d7`, message `Redesign Memories and Journey flows`. `eas update:view` and `eas update:list` confirm it is the branch head immediately after the preserved Home pilot group. Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/4aad6dbd-c0dc-4656-945d-bce376c813aa`. No commit, source push, or native build was made.

## Music flow implementation

- A 60-screen Appllama search, the complete 30-screen must.fm walk, and 11 downloaded visual references informed the phone hierarchy. Durable notes and source IDs are under `research/ui-redesign/music/appllama/`.
- Phone Music now leads with one artwork-led latest road soundtrack, a compact horizontal metric rail, a five-row searchable listening-history preview, one Artists/Tracks segmented ranking, and consolidated Road insights. Data-empty mood, city, and listening charts no longer reserve large blank panels.
- Track deep links, journey navigation, refresh, local-first archive behavior, provider honesty, themes, and the existing regular-width/iPad presentation remain intact. Bottom scroll clearance now protects rows from the floating tab bar.
- TypeScript passes; focused phone/iPad Music and tab contracts pass 44/44; navigation motion passes 6/6; native capabilities pass 4/4. The full 813-test suite passes 809 and has four unrelated dirty-tree harness failures: one missing `useRef` in Journey Detail Duo evaluation and three Expo Symbols ESM-resolution failures in Memory Edit motion tests.
- Published as an iOS OTA to `v3-preview`, runtime `3.0.0-preview.4`: group `678cc436-5e94-4d1d-ad1c-05854904949d`, update `01a0b9d2-2ed4-759b-b1a0-e3a4d05995c8`, message `Redesign Soundtracks with Appllama review`. `update:view` and `update:list` confirm it is branch head. Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/678cc436-5e94-4d1d-ad1c-05854904949d`.

## Statistics flow implementation

- A 60-screen Appllama search, complete Sleep Cycle Statistics flow, and 10 saved references informed the redesign. Notes and source images are under `research/ui-redesign/statistics/appllama/`.
- iPhone Statistics now has Overview, Days, and Insights modes. Overview leads with the period trend and compact KPIs; Days owns calendar/day drill-down; Insights contains distributions, deeper charts, averages, records, and activity. Atlas follows primary data, chart taps open the selected day, and the floating tab bar has protected clearance. iPad retains its dense dashboard.
- TypeScript, 14 focused Statistics tests, 53 adjacent navigation/theme/runtime tests, iOS Expo export, and relevant diff checks pass.
- Published to `v3-preview`, iOS runtime `3.0.0-preview.4`: group `b75247fd-db02-4eda-9b4c-5ee31df4f4bb`, update `01a0b9e1-9a1b-7966-8242-47427ece2192`, message `Redesign Statistics with Appllama review`. `update:view` and `update:list` confirm it is branch head. Dashboard: `https://expo.dev/accounts/journeydeck/projects/journeydeck/updates/b75247fd-db02-4eda-9b4c-5ee31df4f4bb`.

## Settings flow implementation

- Appllama research covered 60 search results and eight full references; notes/images are under `research/ui-redesign/settings/appllama/`.
- Phone Settings now groups Your Journey, Preferences, and Account & Support; uses compact status/value rows; isolates destructive actions; protects bottom-tab clearance; and drills Appearance into separate Theme and App Icon galleries. Existing persistence and iPad split Settings remain intact.
- TypeScript, 87 focused Settings/theme/navigation/privacy tests, iOS Expo export, and diff checks pass. Full suite remains 809/813 with the same four unrelated dirty-tree harness failures documented under Music.
- Published to `v3-preview`, runtime `3.0.0-preview.4`: group `6bff2a4f-3ae9-4522-b74f-8f87809983a0`, update `01a0ba00-78d7-7156-95fa-80f0fec004b0`, message `Redesign Settings with Appllama review`; `update:view` confirms publication.

Siri AI work remains paused by user decision. Preserve the revision 3 implementation and test evidence, but do not start more Siri AI builds or device-test cycles. Resume only after the user's Apple Small Business Program status is approved and Apple confirms the Private Cloud Compute entitlement path; then benchmark Apple's cloud model against the same suite before choosing the production architecture.

## Expo SDK 58 migration

- The V3 branch now uses `expo@58.0.0-preview.3`, React Native `0.88.0-rc.0`, and the SDK 58-aligned Expo/native dependency set. The frozen submitted V2 baseline remains Expo 57 at commit `dee86fa`; do not rebuild V2 from this branch.
- `InteractionManager` was replaced with `requestIdleCallback`; Expo Router/native-tab invariant tests were adapted to SDK 58's lazy router state, and the equal-tab-spacing patch is guarded and verified against React Native Screens 4.27.0.
- `.npmrc` temporarily enables legacy peer resolution because npm prerelease ranges reject Expo's tested React Native 0.88 RC/Reanimated pair. `tsconfig.json` temporarily enables Expo's documented `react-native-legacy-deep-imports` condition. Remove both bridges once SDK 58/RN 0.88 and dependencies are stable.
- Windows cannot generate the iOS prebuild. The next macOS/Xcode 27 GitHub build must prove CNG/config-plugin generation and native compilation. Expo's EAS Xcode 27 image was still pending at migration time.
- `npm audit --omit=dev` reports 15 moderate transitive advisories in Expo Router/config tooling. Do not use the proposed forced fix: it replaces SDK 58 packages with older breaking versions. Recheck after beta updates.

## Active free device build

- Public isolated snapshot: `C:/Users/patri/JourneyDeck-native-sim-trial`, GitHub `drumpat01/journeydeck-native-sim-trial`.
- Fresh Expo 58/Marker Phase 2 snapshot checkout: `C:/Users/patri/JourneyDeck-v3-preview4-xcode27-20260918`. Content commit `93fd284` and guarded Xcode 27 archive fix `51dca0b` are pushed to `codex/native-sim-trial`; primary repository remains uncommitted.
- Run `35392906571` failed twice after successful tests/signing because GitHub's Xcode 27.0 runner emitted false `exit code 0` Swift diagnostics and returned archive status 65 despite linking/bundling the app. Commit `51dca0b` fails closed unless the app and Watch archive exist with exact V3 bundle IDs and pass strict deep signature verification; IPA export still independently validates both bundle IDs/build numbers.
- Free GitHub Actions run https://github.com/drumpat01/journeydeck-native-sim-trial/actions/runs/35397418441 completed successfully from `51dca0b` in 23 minutes. GitHub's `xcode-27` inventory supplied Xcode 27.0 build `27A266a`, not 27.1.
- Preview.4 artifact hash, decryption and IPA metadata are verified: app/Watch build `100008`, bundles `com.journeydeck.recorder.v3` and `.watchkitapp`, runtime `3.0.0-preview.4`, channel `v3-preview`, valid ZIP. Private files are under `C:/Users/patri/.codex/private/journeydeck-ios-install-35397418441`; canonical IPA SHA-256 is `A9DC1DB80C757335072D2FD7C8A687C8A959A19FA1A76BC17FC63BC9DD9FAFBA`.
- Temporary Marker installer is active at `https://place-genes-bradford-knowledge.trycloudflare.com/192df766a3795bcd0cc05fbd69515f92fd4b8e78291fdf50`. HTTPS page, manifest and 217,463,923-byte IPA HEAD were verified. Process ids/state are recorded in the private run directory; stop them after the user confirms installation.
- Snapshot revision 3 commits `b0378c6` and compile fix `338a1c9` are pushed to remote default branch `codex/native-sim-trial`. No commit/push in the primary repository.
- Initial run 35371434759 failed early in standalone Swift typecheck because `previous` was referenced before its local declaration. The declaration was moved above model normalization and the fix committed.
- Free GitHub Actions run https://github.com/drumpat01/journeydeck-native-sim-trial/actions/runs/35371773040 completed successfully from `338a1c9` in about 27 minutes. It used public GitHub-hosted `macos-26`; no EAS Build charge.
- Check only at 10-minute intervals after build start. Previous successful device build took about 22 minutes.
- Six GitHub signing/artifact secrets remain configured. Never print values or put them in source. DPAPI-protected recovery material is outside the repository at `C:/Users/patri/.codex/private/journeydeck-v3-signing.clixml`.
- Revision 2 installer has been stopped. Its build run was 35366593179, app/Watch build 100004, and its phone test is complete.
- Revision 3 artifact hash, decryption, and IPA metadata were verified: app/Watch build 100006, V3 bundle, runtime `3.0.0-preview.3`, channel `v3-preview`, Siri testing enabled.
- Revision 3 was installed successfully. Its temporary installer and Cloudflare tunnel were stopped after verifying their recorded executable paths. Private artifact/metadata remain under `C:/Users/patri/.codex/private/journeydeck-ios-install-35371773040`.

## Revision 3 Siri fix

- Correct revision 2 phone diagnostics showed the Foundation Model usually selected the right domain, operation, metric and filters, but emitted `decision: unsupported` plus irrelevant filler in unused fields.
- `AskResources/ask-query-engine.js` now treats the generated plan as a proposal and normalizes only fields whose applicability is determined by selected fields. It clears inapplicable days/dates/comparison/grouping values, maps music `songPlays` to `count`, and forces single-result ranking for top/number-one wording.
- A deterministic question boundary independently checks whether the request is supported before accepting the proposal. It blocks writes and unimplemented private-content/vehicle/route/exclusion queries, clarifies ambiguous subjective superlatives, and allows only supported domain/operation/metric combinations.
- `JourneyDeckAskService.swift` normalizes the raw Foundation Models proposal through the shipped JS engine before strict validation and execution. Planner revision is 3.
- Evaluation keeps both the raw proposal and validated query. Failed test cards label the post-boundary plan as `Validated query`.
- `docs/siri-ai-v3.md` records the revision 2 result and revision 3 design.

## Journey Markers scope

- Marker capture, route/replay pins, notes, and multiple photos remain the active V3 feature scope.
- Voice memos were explicitly removed from the feature on September 18. The recorder/player UI, Marker-facing copy, microphone permission wording, and Ask support were removed. Legacy storage parsing and explicit Ask refusals remain only so preview data and older model proposals fail safely.
- Private iCloud backup phases 1 and 2 are implemented locally. Master schema 9 supplies revision-safe Marker/photo queues, tombstones and immutable identity. CloudKit capability 5 adds versioned `JourneyMarker` and `MarkerPhoto` records, photo asset restore into app-owned storage, revision-safe acknowledgements, conflict/dependency handling, and physical-deletion requeue behavior.
- Marker records use a separate profile-scoped CloudKit zone so older binaries never receive unknown types. Account deletion removes the base, Journey Editing and Marker zones.
- On September 18, the checked-in schema validated and imported successfully in Development for the isolated `iCloud.com.journeydeck.recorder.v3` container. The additive V3 schema was then deployed to Production and Production visibly lists `JourneyMarker` (19 fields) and `MarkerPhoto` (16 fields). The V2 and original containers were not changed.
- Windows verification: Marker/CloudKit targeted suites pass, TypeScript passes, Expo Doctor is 20/20, iOS Expo/Hermes export succeeds, `git diff --check` has no whitespace errors, and the complete mobile suite passes 805/805.
- Physical-device acceptance remains: tap/Siri capture during a real journey, truthful GPS/session failures, route/replay accuracy, notes/photos persistence, trim/split/restore, profile deletion/isolation, and iPhone/iPad accessibility/layout checks.

## Validation

- `node --experimental-strip-types --test tests/siri-ai-engine.test.mts tests/siri-testing-ui.test.mts tests/siri-native-build.test.mts`: 17/17 passed.
- `npm run typecheck`: passed.
- September 19 Home pilot: `npm run typecheck` passed; the complete `npm test` suite passed with exit code 0; targeted Home/layout/gesture/iPad/token/tab-runtime suites passed 71/71. `git diff --check` passed apart from expected CRLF conversion warnings across the pre-existing dirty tree.
- All 13 exact/representative revision 2 phone proposals normalize to expected plans.
- All 100 synthetic questions pass with deliberately injected wrong decisions and irrelevant model filler; unsupported and ambiguous requests remain refused.
- Relevant `git diff --check` passed. Snapshot staged secret scan passed.
- Fresh `93fd284` snapshot validation: TypeScript passed, Expo Doctor 20/20, the public-snapshot suite passed 787/787, `git diff --cached --check` passed, and Gitleaks found no staged leaks.
- Xcode 27 archive recovery policy tests pass 3/3; commit `51dca0b` passed the complete macOS workflow, strict archive signature/identity checks, export validation, encryption and artifact upload.
- Physical-device sample verified: 13 passed, 0 failed, 0 incomplete, 5.0-second average. Supported calculations and both deliberate capability refusals matched expected plans and facts.
- The full 100-question physical-device suite completed with 83 passed, 17 failed, 0 incomplete, and a 7.9-second average. The remaining failures were reviewed as interpretation/schema and grading issues rather than evidence that the iPhone 16 Pro Max is unsuitable.
- The 17 failures are concentrated in temporal interpretation, intent/domain selection, and one semantically equivalent grading mismatch. No revision 4 fix or follow-up build was made.

## Build/install procedure after success

- Download the encrypted artifact into a new private run-specific directory, verify SHA-256, decrypt with DPAPI recovery material, and inspect IPA metadata before serving.
- Expected Marker build runtime is V3 `3.0.0-preview.4`, channel `v3-preview`, app/Watch build `100008`. Siri AI work remains paused.
- Use `scripts/serve-ios-install.cjs` and official cloudflared with hidden processes and a temporary token URL. Verify HTTPS page, manifest, and IPA endpoint before sharing.
- Ask the user to install over the existing V3 app without deleting it and keep the PC online. Stop installer processes after confirmed installation.
- First phone test: confirm planner revision 3 and run the 13-question sample. Run all 100 only if the sample materially improves.

## Preserved architecture and limits

- Foundation Models receives only the question, safe prior query context, and current local date. Archive rows, generated SQL, notes, images, audio, coordinates, and private Memory titles are not sent to the model.
- The native engine owns all factual calculations against a read-only, profile-scoped SQLite snapshot. Lock/profile/epoch/StoreKit history fences remain.
- Existing Start/Stop/Create Marker intents remain explicit. AI archive queries do not perform writes.
- Notes/transcripts/photo-content search, Spotlight donation, App Entities, and iOS 27 search/open schemas remain later work.
- Revision 2 test failures were model-plan validation failures, not incorrect archive calculations.

## Primary repository state

- `C:/Users/patri/JourneyDeckv3-current`, branch `codex/journeydeck-v3-current-v2`, baseline `b0bb466`.
- Large pre-existing V3 migration/theme/marker/medallion work is preserved. No primary staging/commit/push.
- V2 is frozen. Default V3 native runtime is `3.0.0-preview.4`, bundle `com.journeydeck.recorder.v3`; the branch package runtime is now Expo SDK 58 beta. Installed revision 3 remains runtime preview.3 and cannot receive SDK 58 OTA bundles.
- Autumn Drive medallions and compatible marker UI remain published on the latest preview.2 OTA. This Siri change includes native Swift and a bundled JS resource, so it requires the current signed native build rather than OTA.

## Other preserved project facts

- A private Three.js Duo Layout Lab is published at `https://journeydeck-duo-layout-lab.drumpat01.chatgpt.site`. Its isolated source checkout is `tools/duo-layout-lab` (site commit `feb3b5d`); it supports orbit/zoom, continuous fold angles, closed/book/flat-landscape/flat-portrait/flex/tent presets, safe-area and hinge overlays, layout metrics, and responsive desktop/phone controls. The fold geometry points both app displays inward; the exterior has one display and a separate dual-camera back. Flat landscape uses one continuous JourneyDeck iPad Home canvas, Flat Portrait uses a custom hinge-aware overview/detail layout, and Tent rotates the model into landscape with an upright glanceable driving-and-soundtrack dashboard. Model tests pass 8/8, static verification passes, browser logs are clean, and the adaptive Portrait/Tent views passed visual checks. It is a visual approximation, not an iOS runtime simulator. The local preview server was stopped after publication.
- Journey Markers use native inbox schema 4 and master schema 9. Notes and photos are local-first and included in private iCloud backup by the new capability-5 native build; voice memos are not a feature. Map pins appear on active and completed routes.
- Autumn Drive theme ID remains `midnight-canopy` with the approved green/gold/orange palette and native Home photo.
- A privacy-safe copy of the standalone Theme Creator was published as a private GPT Site at `https://journeydeck-theme-creator.drumpat01.chatgpt.site`. Its independent checkout is `C:/Users/patri/JourneyDeck-theme-creator-site`; private screenshots and route imagery were excluded and replaced with synthetic preview artwork. The source JourneyDeck tool was not changed.
- Existing unresolved iCloud error 12: do not clear local data.
- Do not restart the abandoned browser-streamed simulator experiment. The signed GitHub Actions device workflow is the active test route.

## Next steps

1. Fully terminate and cold-launch Preview.4/build 100008 up to twice to activate OTA group `6bff2a4f-3ae9-4522-b74f-8f87809983a0`; validate the grouped Settings index, Account/iCloud, Appearance drill-downs, Achievements, Membership, Music, Recording, Saved Places, Dynamic Type, VoiceOver, and bottom-tab clearance in Grand Touring and Warm Ivory.
2. Validate the new Memories, Memory edit, and Journey detail flows in both themes, including reduced motion, keyboard behavior, library drag/drop, soundtrack expansion, and track-to-map focus.
3. Complete Marker physical-device and two-device acceptance against app/Watch build `100008`; do not restore voice memos.
4. Track SDK 58 beta updates; remove the npm/TypeScript compatibility bridges and recheck transitive advisories once the stable toolchain supports it.
5. Keep Siri AI and its native build loop on the backburner while Apple Small Business Program approval is pending; after approval, verify the Private Cloud Compute entitlement and benchmark Apple's cloud model.
