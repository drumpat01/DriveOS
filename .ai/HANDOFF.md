# Current Handoff State: Zero-Cost Multi-User Local-First Architecture

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
