# Tessie V3 Phase 7 review and release plan

Reviewed September 22, 2026 in `C:\Users\patri\JourneyDeckv3-origin-main-20260922`,
branch `codex/start-origin-main-20260922`, HEAD `df39413`.
Phases 1–6 were already unstaged/uncommitted and were preserved. No worktree,
branch, staging, commit, push, deployment, OTA, native archive, or submission
was performed. Read-only EAS metadata and the existing Build 35 IPA were inspected.

**Disposition: source review and automated checks completed; native acceptance
and release remain blocked. Do not publish this tree to Build 35.**

## Evidence and native compatibility

EAS Build 35: `dd07903d-29dc-44e7-be78-4f0f2ba361c6`, profile `v3-testflight`,
version 3.0.0, SDK 58, source `ca464d11738e8be462dbf179bef08000eeee8fb3`.
The downloaded IPA, not just current configuration, reports:

- `com.journeydeck.recorder`, build 35, production update channel,
  runtime `3.0.0-preview.4`, private container `iCloud.com.journeydeck.recorder`.
- iPhone and iPad device families, minimum iOS 17, background modes `location`
  and `fetch`, location and Apple Music purpose strings.
- Recorder, Music, Membership, CloudKit, SecureStore, SQLite, MapLibre and
  Ask service symbols, plus both Ask query resource packs.
- IPA SHA-256: `16d081d47bc5c61d2d5402ebe9734f23c041a629ef54c8b1dfa36bf9ddcc109f`.

The installed build's recorded source accepts **only SQLite schema 9** in
`JourneyDeckAskService.swift`. Tessie adds schema 10 metadata and schema 11
energy-observation flags. An OTA containing those migrations would make
Build 35's native Ask reader reject the archive. Rolling back to old JavaScript
would also encounter a newer schema; it is not a safe database rollback.

The native reader now accepts the explicitly reviewed additive versions 9–11,
still checks the application ID, and rejects unknown future schemas. V3 targets
`3.0.0-preview.5`; the old marker-runtime override fails closed. The iOS build
helper, fingerprint script, baseline runtime and release guides agree. The
fingerprint baseline remains **null** until a real matching native archive exists.
No native Swift compilation or installed execution was possible on this host.

Native modules/plugins/dependencies/EAS settings were compared with `ca464d1`.
The Ask reader is the only new native implementation delta. The intervening
`df39413` package change adds build diagnostics, not a native dependency.
Tessie otherwise uses capabilities already present in Build 35; it needs no
new permission, entitlement, native library, or background mode.

## Changes reviewed and shipping classification

Paths below are under `mobile/recorder` unless stated otherwise. Classification
describes the complete current change set, including inherited Phases 1–6.

| Change / implementation paths | Build 35 capability and release requirement |
| --- | --- |
| `App.tsx`, `src/shell.tsx`, `home-widget-grid.tsx`, `home-widget-layout.ts`, `ipad-home.tsx`, `tessie-home-widgets.tsx` | Existing React Native, recorder and navigation modules. UI and foreground scheduling are JavaScript; no new OS background task. Ship with the schema-11 native release. |
| `tessie-direct.ts`, `tessie-capture.ts`, `tessie-contract.ts`, `tessie-window-sync.ts`, `tessie-local-data.ts`, `tessie-journey-plan.ts`, `storage.ts`, `profile-secure-store.ts`, `network-request.ts` | Existing Keychain, SQLite and HTTPS modules. JavaScript import/cancellation/cache changes, dependent on the updated Worker route contract. |
| `local-store.ts`, `database-hardening.ts`, `tessie-journey-schema.ts`, `app-data.ts` | Additive schema 10–11 and local archive mapping. Technically JavaScript/SQL, but **not compatible with Build 35's native Ask contract**. New runtime/binary required for this package. |
| `membership-entitlements.ts`, `release-features.ts`, `tessie-connection-card.tsx`, `ipad-settings-screen.tsx` | Existing verified StoreKit access and Keychain; JavaScript gates/settings. V2 Tessie and Last.fm feature flags stay off. Expired membership does not prevent removing credentials. |
| `automatic-drive-task.ts`, `location-task.ts`, `music-capture.ts`, `music-observations.ts` | Remove Tessie live-media polling from phone recording; existing local Apple Music/manual recording behavior remains. No new background capability. |
| `music-preferences.ts`, `lastfm-sync.ts`, `first-run-onboarding-screen.tsx`, provider controls in `shell.tsx` | Restore the already-approved Last.fm flow recorded for Build 35 OTA group `27ed041b-36e8-41b5-ab8a-133697795d2e`. Username/setup links and one selected provider use installed modules. Direct Spotify remains internal. Original V2 onboarding is retained. |
| `interactive-route-map.tsx`, `route-moments.ts`, `journey-markers.tsx` | Existing MapLibre and native sheets. JavaScript route/song/charge presentation; timestamps must support mapped positions. |
| `tessie-statistics-model.ts`, `ipad-statistics-screen.tsx` | Local statistics, common phone/tablet periods, route comparisons and drilldowns. JavaScript using existing layout/motion capabilities. |
| `atlas-travel-stories.ts`, `primary-sections-data.ts`, `primary-sections.tsx` | Local Atlas stories and explicit Memory composer. Existing SQLite/navigation; no new network or background job. |
| `modules/journeydeck-recorder/ios/JourneyDeckAskService.swift` | **New native build**, to read schemas 9–11. Cannot be delivered by OTA. |
| `app.config.js`, `scripts/configure-ios-device-build.cjs`, `scripts/ios-fingerprint-delta.mjs`, `native-fingerprint.ios.json` | Native release compatibility boundary now preview.5. No matching installed binary is claimed. |
| `cloudflare/workers/index.ts`, `cloudflare/workers/oauth-tessie.ts` | **Worker deployment** for `/api/vehicle/tessie/route`, observed-energy flags and saturated-history errors. Neither OTA nor an IPA deploys these changes. |
| Tests, handoff and phase/release documentation | Validation and release guidance only. |

Small independent copy/layout fixes could be separately reviewed for a preview.4
OTA using only Build 35's schema and native APIs. **The current full tree cannot.**
After the new preview.5 binary is installed, subsequent compatible JavaScript,
styles and assets can ship by preview.5 OTA. Expo's runtime compatibility rule:
[Expo runtime compatibility documentation](https://docs.expo.dev/eas-update/runtime-versions/).

## Confirmed issues fixed in Phase 7

- Concurrent refreshes share an import. Profile changes, reconnects and
  disconnects invalidate late responses before cache or archive writes.
  Credential writes/deletes serialize so disconnect cannot leave a late token
  behind; owned legacy secrets are removed too. Legacy Keychain migration
  cannot move a secret into a profile selected during an asynchronous read.
- Partial/replayed drive IDs resolve to the existing same-vehicle journey.
  Fuller intervals and routes enrich that durable ID; shorter replays cannot
  replace better data. Manual overlaps and editor-managed journeys are preserved.
  Route repair also dirties the summary for private CloudKit upload.
- Route retries rotate through older missing/partial drives; Last.fm's bounded
  batch rotates too. A one-point cache no longer prevents route recovery.
- Apple Music and Last.fm accept explicit-timezone plays only in `[start,end)`.
  A boundary play belongs to one adjacent drive. Provider changes during a
  history request stop that provider's import. Last.fm IDs preserve exact play
  time instead of collapsing distinct plays into a 30-second bucket.
- Tessie song map positions require a timestamped GPS sample within two minutes.
  Sparse GPS omits the position instead of estimating progress; merging an older
  cached journey cannot restore a rejected position. A charge map position
  likewise requires a saved GPS endpoint within two minutes of arrival.
- Unknown charge energy displays as unknown; observed zero remains zero.
  Disconnect stays available after membership/token expiry. Privacy copy now
  explains transient Tessie routing through the edge and private iCloud backup.
- Memory save errors are visible and Reduce Motion disables the composer slide.
- Reconciled the deployed Last.fm setup from the previous Build 35 task so the
  next release does not remove an installed feature. Updated stale test mocks
  and source assertions for the reviewed interfaces and runtime.

## Privacy, timing and background conclusions

Provider payloads are validated and field-filtered. Tokens remain in this
device's profile-scoped Keychain; the Worker receives them transiently for
authenticated Tessie reads, resolves opaque drive IDs against the same account,
and returns no token or VIN. Reviewed responses use `no-store`; no new Worker
storage or body logging was added. Route responses are bounded to 2,500 ordered
points with the endpoint retained. Share/export still uses the existing 300 m
Home/Work masker; new Atlas rows themselves do not add a sharing path.

Imported journeys/routes can sync through the existing private CloudKit archive.
Tessie-specific energy metadata, charge markers and caches remain device-only;
restoring to another device can therefore show journeys without Tessie statistics
until reconnection/reimport. Disconnect preserves imported journeys intentionally.

Tessie history import runs on foreground open/resume (15-minute throttle) and
explicit refresh. It does not promise immediate import while suspended or
terminated. The Journey in progress widget reflects the **local phone recorder**;
Your car reflects cached Tessie observations, not a new live Tesla recorder.
Four route fetches/eight Last.fm windows per import limit work; repeated refreshes
may be needed to fill older history. Apple Music recent history is limited to 50
items and provider timestamps describe reported history, not independently
measured playback. Missing music never proves silence.

## Appllama comparison and actual UI limit

Read completed Phase 3/5 task results and Phase 1/2/4/6 documents. Phase 5
reviewed MileIQ, Ride with GPS, Transit, OBD and must.fm; it found no strong
EV-charging reference. Phase 6's durable references remain in its report.
Phase 7 downloaded and visually inspected six actual reference screenshots:

| Reference screen | Comparison with JourneyDeck implementation |
| --- | --- |
| MileIQ `578830929/oth_lrcfg` Monthly Summary | A clear period and dominant summary before compact totals. Tessie Statistics has shared periods, coverage-aware energy totals and local drilldowns. |
| Ride with GPS `893687399/oth_1mg4g` Career Stats | Readable grouped totals. JourneyDeck retains its six-column tablet panels, adaptive collapse and native sidebar. |
| must.fm `6444621447/oth_nc4at` Genre Stats | One primary metric with subordinate comparison. Tessie adds energy coverage rather than implying all drives have measured energy. |
| Strava `426826309/oth_067nr` Saved Routes Grid | Small route preview plus context. Atlas uses existing route thumbnails and Journey push/back instead of adding route discovery. |
| must.fm `6444621447/oth_qoeww` Track Details | One song identity followed by related history. Atlas selects one song and lists timestamp-verified journeys. |
| Day One `1044867788/oth_47e7h` Reflection Prompt Pack | Discrete invitation before writing. Atlas uses an optional inline prompt, explicit Save and persistent dismissal. |

Source and rendered-component fixtures support those structural comparisons.
JourneyDeck's own colors, typography, cards, motion and navigation take priority
over reference-app appearance. No reference app's social, route-planning or
paywall features were copied into this scope.

**No actual JourneyDeck native UI was inspected in Phase 7.** The device skill's
verification delegate found no available DeviceInteraction surface, connected
iPhone/iPad, iOS simulator or Xcode tooling on this Windows host. Component tests
and reference screenshots do not establish native visual acceptance.

## Verification

- Full mobile `npm test`: **891 passed, 0 failed, 1 skipped** (892 tests).
  The existing skip requires eight absent private shader golden frames.
- After the final cached-song-position fix: **28/28** focused route, data-boundary
  and Phase 7 regressions passed. The full suite preceded that small final fix.
- Dormant Tessie boundary/Settings checks: **4/4** passed after refreshing the
  privacy-copy assertion to require the actual edge disclosure.
- Mobile `npm run typecheck` and Worker `npx tsc -p cloudflare/tsconfig.json
  --noEmit` passed. The Worker was not deployed.
- V3 store iOS `expo export`, internal testing disabled, passed. This validates
  bundling, not Swift compilation, device rendering or live provider behavior.
- `git diff --check` passed. All changes remain unstaged and uncommitted.
- Tests cover Worker contract/privacy, SQL migration and profile isolation,
  duplicate/partial imports, cloud dirtiness, UTC intervals, cancellation,
  background/manual capture boundaries, statistics, Atlas, Home and iPad layouts.

Temporary local evidence: `%TEMP%\journeydeck-phase7\` contains build capability
inventory, IPA, six reference screenshots, mobile test logs and exported bundles.
Do not treat temporary files as committed release evidence.

## Remaining acceptance and concrete release sequence

1. **Before release:** inspect the real app on iPhone and iPad. Test portrait,
   landscape/native sidebar, rotation, narrow Split View, keyboard, Dynamic Type
   XL, VoiceOver and Reduce Motion. Capture actual screens for Settings/Tessie,
   Home widgets, Statistics periods/route drilldowns, journey charge/song details,
   Atlas stories and Memory save/dismiss. Confirm no clipping or lost back state.
2. Use a real verified membership and Tessie account: validate invalid/expired
   credentials, offline launch, foreground catch-up after lock/termination,
   repeated refresh, partial GPS, late Last.fm history, Apple Music permission
   denial, provider switch, multiple vehicles, profile switch, reconnect and
   disconnect. Include an outward/return route and matched Supercharger.
   Provider access/rate limits and Last.fm commercial-release approval remain
   release checks; this review made no live authenticated provider calls.
3. When separately authorized, deploy the Worker to **preview**, verify actual
   account-scoped routes, timestamp/energy semantics, saturation behavior and
   absence of sensitive logging; then deploy the compatible Worker to production.
   Existing Build 35 endpoints must remain backward compatible. Keep rollback of
   the Worker separate from mobile migration rollback.
4. Run the TestFlight gate and create a new native **preview.5** build using
   `v3-testflight`, `APP_VARIANT=v3-store`, production environment/channel,
   live bundle/container and ASC app `6806502526`. Use a new build number assigned
   by EAS. Record a fingerprint for the actual variant and archive. Do not use the
   isolated `.v3` identity for this stream and do not submit it to App Review.
5. Install that candidate and specifically test upgrade from Build 35's schema 9,
   retained Last.fm settings/history, Ask/Siri before and after migration, existing
   private CloudKit journeys/photos/markers, new Tessie capture and account cleanup.
   Native compilation, that upgrade and physical acceptance are still required.
6. Only after acceptance and separate authorization, distribute the TestFlight
   candidate. Any later OTA must match preview.5 and its installed capabilities.
   Do not publish this full package as preview.4, downgrade its migrated database,
   delete the archive to recover, or resume the frozen V2 release stream.

Source fixes resolve the confirmed code blockers; they do not remove these
device, provider, native-build and deployment gates.
