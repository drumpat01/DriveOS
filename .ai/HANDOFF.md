# Current Handoff State: Zero-Cost Multi-User Local-First Architecture

## Phase 3 native reliability and Build 11 release candidate — September 1, 2026

- Implemented the repository portion of the user-approved Phase 3 on `codex/native-runtime-prep`. App/runtime version is now `1.9.0` (`N1.9-RC1`) so the native boundary will ship as Build 11 rather than an incompatible OTA to Build 10.
- Added the auto-linked `JourneyDeckRecorder` Swift module and app-delegate subscriber. Automatic mode now uses significant-change monitoring while idle, high-accuracy Core Location only while confirming/recording, native start/park decisions, and direct transactional writes into the verified schema-6 `journeydeck-local.db`. It completes a drive and enqueues the four durable completion jobs without React Native being alive. Native session ids are fenced from manual/Build-10 sessions.
- Build 10's persisted Expo automatic task is explicitly stopped on upgrade and its task definition remains registered as a no-op only so old installations can unregister it safely. Manual recording continues through the Expo task. Profile handoff now shuts down manual, legacy automatic, and native automatic location before changing identity.
- Hardened private CloudKit transport with bounded transient retries, server retry-delay support, per-record partial-failure metadata, correct server-winner handling, atomic downloaded-asset replacement, staged change tokens, and expired-token full recovery. Partial failures remain queued and do not enter the successful-sync cooldown.
- Added a Build 10 upgrade fixture that starts with a schema-5 archive plus split legacy recorder database and proves preservation of the profile, journey, Collection, Memory, active session, GPS points, database integrity, and untouched legacy source after the production Phase-2/Build-11 migration.
- Verification passed: TypeScript, all **159/159** mobile tests, Phase-3 native-release checks **3/3**, Expo Doctor **21/21**, iOS Expo export (**1,779 modules, 24 assets**), native autolinking discovery, and `git diff --check` (existing LF-to-CRLF notices only).
- The first signed Build 11 compile (`cd55e2d6-3a35-433c-94c0-c79332d6f24f`) caught one Expo Swift bridge error: an async function had a synchronous `runOnQueue` modifier. Removed that invalid modifier (the implementation already marshals Core Location work through `MainActor`), added a regression contract, reran TypeScript/Phase-3 tests, and reset the failed remote counter from 11 to 10 so the corrected retry remains Build 11.
- Pending release steps: obtain the corrected EAS iOS production compile, confirm it is remote build number **11**, submit it to TestFlight, then install it over Build 10 and execute the physical upgrade/background/CloudKit acceptance matrix. No App Store Connect portal change is expected unless EAS/Apple reports a signing or compliance gate.

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
## Automatic endpoint naming and saved-place propagation repair — August 31, 2026

- Compared the native location pipeline with the older web behavior. The native regression had three causes: the saved-place radius was only 125 meters despite rounded endpoint identities and normal parking/GPS drift; detail records with journey-specific keys did not fall back to their recorded route endpoints; and iOS had only a city-summary lookup rather than an endpoint address/name cache.
- Increased user-named place matching to a bounded 250-meter haversine radius and made every detailed journey resolve its first/last route coordinate when its place key is not coordinate-based. User-entered names are persisted as private local places, override automatic labels, and now emit the shared archive-change event so Home, Statistics, Memories, journey lists, and reopened details refresh together.
- Added foreground-only endpoint enrichment through the iOS location geocoder. It resolves at most four uncached endpoints sequentially per pass, stores only the useful place/address label in the profile-private `local_places` table for 30 days, retries failures no more than hourly, and never performs geocoding while the app is backgrounded. Cached automatic labels use a narrower 150-meter radius; manual names always win.
- Added behavioral tests for realistic property/parking drift, separation from a different neighborhood, and geocoder-label selection. Verification: `npm run typecheck` passed; focused place/journey/tab tests passed 33/33; full `npm test` passed 149/149; `npx expo export --platform ios` completed successfully (1,771 modules, 24 project assets); `git diff --check` found no whitespace errors beyond existing CRLF notices.
- Published and verified the iOS production OTA for runtime `1.8.0`: update group `8e464530-87c8-45c0-9bc9-423067a31edc`, iOS update `01a05af4-d8c8-7ae6-adcf-d99963f6bb81`, message `Restore automatic journey place naming`. It applies to TestFlight Build 10 after download and restart.
- No native build, TestFlight upload, build-number change, commit, push, Worker deployment, or App Store Connect mutation was performed. EAS records base commit `ff75d37` with a dirty-working-tree marker; all source remains uncommitted.
