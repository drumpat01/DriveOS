# JourneyDeck V2 product roadmap

Updated: September 4, 2026

September 5 implementation update: iPad Statistics now implements the approved six-widget overview with the calendar immediately below, selected-day detail, raw journey/music charts and paged native journey links in both themes. Home, Soundtracks, Memory Studio, Statistics and Settings have tablet source implementations; older Home-only/blank-tab milestone descriptions below are historical. Remaining tablet work includes Home card navigation and physical device acceptance. Statistics typecheck and 294 mobile tests pass; no build/OTA/submission is authorized until iPad, Watch and POI are ready and the user approves release.

## Purpose and scope

Build on JourneyDeck 1.9.0 (Build 14) with more personal presentation, richer place and vehicle intelligence, automatic recording, broader music support, and interactive sharing. The user confirmed all seven features below for the V2 roadmap on September 4, 2026.

Later on September 4, the user also approved the native-navigation Phase 1 described below. It is an additional foundation milestone; the original seven features remain in scope.

This is the product roadmap for the iOS app and its required supporting services. It is separate from the completed desktop modular-monolith migration roadmap. Desktop redesign, Android, and unrelated architecture rewrites are outside this scope.

The feature list is confirmed. Delivery order, individual feature boundaries, and unresolved product choices below are proposed planning defaults, not previously approved designs or release dates. All seven features remain in V2 scope; an external blocker does not silently remove a feature or move it to another release.

## Starting point

- V2 workspace: `C:\Users\patri\JourneyDeckv2`, branch `codex/journeydeck-v2`.
- Baseline: `63ee33d`, the locked V1 release candidate, reconciled into V2 without application-code conflicts.
- Baseline verification: 204/204 mobile tests, TypeScript, and iOS Expo export passed on September 4, 2026.
- Already included: manual GPS recording, Apple Music soundtracks, Memories and Collections, saved places, private iCloud sync, Statistics, paid Atlas intelligence, full-history membership, and the manual-recording abandonment failsafe. These are existing capabilities to preserve, not new V2 deliverables.
- V1 production remains frozen separately. The `v2-preview` EAS profile uses a separate app identity, OTA channel, runtime, and private iCloud container. Public V2 retains the original app identity and App Store listing so customers receive a normal update.

## Delivery sequence

| Milestone | Deliverable | Current state | Exit condition |
| --- | --- | --- | --- |
| M0 — Safe V2 foundation | Isolated V2 distribution, feature inventory, provider feasibility | Baseline reconciled; isolated signed preview delivered; provider assessment pending | V2 test updates cannot reach V1 installs; dormant code and external dependencies have been assessed |
| M1 — Light mode | Complete light theme with theme selection | Implemented; 211/211 tests and iOS export pass; signed preview built; physical review pending | All primary screens and important flows work in both themes |
| M1a — Native navigation, Phase 1 | Expo native tabs, native detail navigation, preserved screen state | Implemented; 220/220 tests and iOS export pass; Build 5 spacing and Music-label OTA confirmed working by user on iPhone; broader Phase 1 acceptance pending | Fast tab changes, even spacing, correct back gestures, retained state, and uninterrupted recording pass on iPhone in both themes |
| M2 — Place intelligence | Foursquare enrichment | Deferred concept; assess reusable implementation | Real place matches improve labels while saved names and offline behavior remain reliable |
| M3 — Vehicle intelligence | Tessie connection and useful vehicle/charging insights | Dormant implementation; requires review | A real connected vehicle supplies correctly scoped, useful data without affecting manual recording |
| M4 — Automatic recording | Dependable automatic start and finish | Dormant implementation; requires physical validation | Agreed real-drive acceptance matrix passes, including false-start and recovery cases |
| M5 — Broader soundtracks | Spotify listening matched through Last.fm | Internal implementation; public-release gate unresolved | Authorized public flow matches real listening to journeys and handles missing data honestly |
| M6 — Interactive sharing | Revocable, privacy-safe journey web pages | Concept only | A recipient can explore an intentionally published journey and the owner can revoke access |
| M7 — iPad support | App availability on iPad with a dedicated tablet layout | Option 2 widget Home implemented in both themes; signed universal Build 6 delivered; physical review pending; remaining pages deferred | Primary flows work in an iPad-specific layout, with physical iPad validation |
| M8 — V2 release candidate | Integrated verification, upgrade acceptance, release material | Not started | All seven features and native-navigation Phase 1 meet their criteria and the release gates below pass |

Start provider permission, pricing, coverage, and hosting feasibility checks during M0 so external dependencies are understood before implementation reaches them. M3 precedes M4 because the earlier automatic-recording design depended on Tessie; that dependency must be explicitly retained or removed. The sequence is not a calendar estimate.

### Native interaction polish — Phase 2 (approved September 4)

- Native iOS page sheets for creating/editing Memories, adding journeys to Memories, and editing journey location names.
- Native SwiftUI menus for Memory actions and Journey library filters/sorting, retaining the current selection.
- Unsaved changes require discard confirmation; saving/photo operations block dismissal. Chained sheets wait for native dismissal before presenting the next screen.
- Uses the native components already in V2 Build 5; delivery targets its `2.0.0-preview.4` OTA runtime. No additional native dependency or binary required.
- Implemented with 224/224 tests and iOS export passing; published and verified OTA `980753bc-f3c3-46f6-b234-53a22888f7de` on v2-preview. Physical iPhone acceptance remains pending. Profile/Saved Place settings editors and privacy-safe share-card preview retain their existing presentation. Native zoom transitions were subsequently approved as the next visual milestone (below).

### Card-to-detail transitions (approved September 4)

- Use Apple native zoom from Memory and Journey cards into their existing detail screens and back to the mounted source card. Includes Home latest journey and Statistics/Atlas journey cards.
- Preserve native back navigation, map interaction, tab state and recorder lifecycle. Respect Reduce Motion; unsupported platforms retain existing navigation.
- Implemented using Expo Router already in Build 5; 228/228 tests passed. OTA published and verified on preview.4, release V2-P4-Z1, group `72b01029-f5dc-4028-a481-64d049e78229`. Physical iPhone animation and gesture acceptance pending.

## Feature definitions and completion criteria

### Native navigation — Phase 1 (approved September 4)

- Replace the sideways tab carousel and custom dock with Expo Native Tabs. Keep five tabs in order: Soundtracks, Memories, Home, Statistics, Settings.
- Use selected concept 2, Coral Home: the Home icon stays orange whether selected or unselected. iOS controls the native glass bar, spacing and selection treatment.
- Use native pushes and swipe-back for Memory and Journey details. Atlas and Tools also participate in the stack so their detail routes return correctly.
- Keep tab scroll positions, search/filter choices, and screen state while navigating. Preserve the single recorder, local-first data, saved theme, and privacy/membership checks.
- Deliver a new isolated preview native build with runtime `2.0.0-preview.2`; compatible later JavaScript/asset updates continue through EAS OTA. Public V2 remains an update to the original App Store app.

**Done when:** Physical iPhone testing confirms rapid tab changes without the sideways carousel, correct Memory → Journey → back behavior, retained scroll/search/filter state, orange Home in both themes, usable editor keyboards and large text, and active recording across tabs/background/lock. Automated checks pass; physical acceptance is pending.

### V2-01 — Light mode color theme

**Outcome:** JourneyDeck feels intentionally designed for daylight as well as night while retaining its cinematic identity.

Approved scope (September 4):
- A Settings **Light Mode** switch between warm ivory and cinematic dark, saved across restarts. Default to dark until the user selects light. The user chose option two's warm ivory, plum, coral/pink, and lilac palette; only colors and this switch may change.
- Shared semantic colors for backgrounds, surfaces, text, borders, accents, and status indicators; retain the existing dark theme.
- Cover Home, Soundtracks, Memories, Statistics, Atlas, Settings, onboarding, Journey Details, editors, paywall, dialogs, navigation, charts, maps, and empty/error/loading states.
- Adapt artwork contrast and map presentation deliberately; keep existing photos, layouts, navigation, and exported share-card styling unchanged.

**Done when:** No unreadable labels, dark-only sheets, or theme flashes remain in the covered flows; small screens and large text are usable; the Light/Dark choice persists and responds correctly; both themes receive visual review on a physical iPhone. Shared web pages also receive an intentional readable theme treatment in V2-06.

### V2-02 — Foursquare place enrichment

**Outcome:** Journeys identify useful venues and destinations with less manual naming.

Proposed scope:
- Assess the existing provider adapter/cache work and define the mobile integration against the current local-first architecture.
- Add bounded, cached venue suggestions with clear fallback to existing Apple lookup and locally saved names.
- User-named places always take precedence. Ambiguous results must not silently overwrite a canonical place.
- Keep enrichment outside active-recording and local-save critical paths; use only the location detail necessary for the selected lookup.

**Done when:** Representative real destinations resolve usefully; ambiguous/no-result/provider-failure cases remain usable; saved names survive refreshes; offline journeys still finish immediately; required provider access, cost limits, attribution, and privacy disclosures have been verified before release.

### V2-03 — Tessie and vehicle intelligence

**Outcome:** A connected Tesla adds useful vehicle context to JourneyDeck.

Proposed scope:
- Restore a deliberate connection/disconnection experience, reviewing preserved code instead of simply enabling the old gate.
- Select a useful first vehicle view from the recorded backlog: vehicle status, charging history, energy use, costs, and journey-linked efficiency insights.
- Preserve profile-scoped Keychain credentials and local cached views. Label unavailable or stale data honestly; distinguish measured values from estimates.
- Review the older server-backed intelligence design against today's on-device model before reuse.

**Done when:** A real vehicle connection, refresh, token expiry, disconnect, and profile change work safely; vehicle/charging data is attributed correctly; cost calculations explain their inputs; missing Tessie access cannot block ordinary JourneyDeck use. Free/paid access and multi-vehicle scope are explicitly settled.

### V2-04 — Automatic journey recording

**Outcome:** Eligible users can capture real drives without remembering to tap Start or End.

Proposed scope:
- Review both dormant native and Expo recording paths and choose one owner of each active journey.
- Automatic departure detection, bounded pre-roll, parked/arrival completion, and clear controls to enable or disable automation.
- Preserve manual recording, offline completion, local recovery, and duplicate-session prevention.
- Decide whether automation requires Tessie, an active membership, both, or neither. The earlier Tessie-paid design is historical context, not a settled V2 requirement.

**Done when:** Physical tests cover ordinary drives, short drives, traffic lights, walking, parking, poor GPS, locked/background operation, denied/revoked permissions, offline completion, restart recovery, and switching modes. Measure departure/arrival accuracy and battery impact against agreed acceptance targets. Unsupported force-quit or platform behavior must be explained honestly. Test entitlement/vehicle loss if those gates are retained.

### V2-05 — Spotify soundtracks through Last.fm

**Outcome:** Spotify listeners can attach their listening history to journeys through the planned Last.fm path.

Proposed scope:
- Promote the existing internal bounded-history matching flow only after its public-use gate is resolved.
- Explain setup, account connection, expected matching delay, and why some plays may be missing.
- Match, deduplicate, persist, and privately sync results on-device. Handle retries, timezone boundaries, delayed history, and listening from other devices.
- Keep Apple Music working unchanged. Direct Spotify API access remains a separate owner-only capability, not the promised public solution.

**Done when:** Real Spotify-to-Last.fm history produces correctly timed journey songs; retries do not duplicate plays; empty/late/unavailable history has clear states; route geometry and JourneyDeck records are not sent to the privacy edge. Obtain the written permission and presentation clearance required by the recorded release gate, and verify current provider terms before public distribution. Do not contact providers automatically from this roadmap.

### V2-06 — Interactive shared-journey web pages

**Outcome:** A recipient can explore a selected journey through a link without installing JourneyDeck.

Proposed first delivery:
- An interactive privacy-masked route, song/artwork pins, timeline playback, and owner-selected photos and notes.
- A preview of exactly what will be shared, followed by an explicit publish action.
- Owner-controlled revocation and configurable expiry; clear handling for expired/deleted links.
- Apple Music handoff where a valid link exists, and mobile/desktop browser support.

Design candidates within this feature: MapKit JS as the map renderer and optional Look Around. Evaluate coverage, access requirements, cost, and privacy before committing to either; these are not separately promised launch capabilities.

**Done when:** Sensitive endpoints, photo metadata, and unselected content cannot leak through the published payload; a recipient can explore the page; revocation and expiry stop subsequent access with a defined cache policy. Explain that previously downloaded or captured content cannot be recalled. Verify account deletion, share deletion, accessibility, readable themes, and hosting limits. Hosted sharing stays optional and never becomes a dependency for local recording or viewing.

### V2-07 — iPad app support and new layout

**Outcome:** JourneyDeck is available on iPad with a new layout designed for the larger screen.

Confirmed first implementation (September 4): Option 2 widget dashboard, using current iPhone colors, artwork, recording logic and local library. Build only Home in dark and warm ivory. Native sidebar-adaptable navigation contains Home, Music, Memories, Statistics and Settings; Music, Memories and Statistics are blank, and Settings contains only the saved Light Mode switch. Widgets rearrange for portrait, landscape and narrow iPad windows. iPhone screens and tab order remain intact.

This is a universal iPhone/iPad V2 preview in the existing EAS project, with tablet support, iPad rotation/windowing and runtime `2.0.0-preview.5`. The registered iPad and iPhone are included in the signed preview profile. Home implementation passed TypeScript, required mobile checks, 242 tests, iOS export and browser component layout checks; native sidebar/inset behavior and physical iPad acceptance remain pending. Full iPad feature pages and detail navigation are later work, not part of this Home-only delivery.

Build 6 completed and signed IPA verified: [install universal V2 preview](https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/4f678d8b-3db1-4ece-bac1-d6c78212f1db). Both registered devices, iPad device support/rotation, unchanged iPhone orientations, isolated CloudKit and EAS OTA configuration verified in the downloaded app.

**Done when:** The app installs and runs on supported iPads; primary screens and flows use the new tablet layout; Light/Dark themes and accessibility are validated on a physical iPad; existing iPhone behavior is preserved.

## Decisions to settle before the relevant implementation

| Decision | Proposed approach / question | Needed by |
| --- | --- | --- |
| V2 distribution | Confirmed: separate side-by-side preview with isolated EAS OTA delivery; public V2 updates the existing App Store app. Shared edge changes still require explicit control | M0 |
| Theme behavior | Confirmed: saved Light Mode switch, dark by default, option-two warm ivory palette, original exported cards | M1 |
| Provider access and operating cost | Check current Foursquare/Tessie/Last.fm access and hosting needs; no paid provisioning implied | M0 feasibility, relevant feature release |
| Vehicle and automation entitlement | Keep existing V1 benefits; explicitly choose pricing/access for the new features and whether Tessie is required | M3/M4 |
| Automatic-recording acceptance | Agree measurable timing, false-start, and battery targets from physical baseline tests | M4 |
| Sharing privacy and retention | Choose link-only versus additional access controls, default expiry, retention, and map provider | M6 |
| iPad experience | Define tablet navigation, screen layouts, supported orientations, and device-specific capabilities | M7 |
| Release packaging | All seven remain planned for V2; any staged public release or deferral requires an explicit roadmap update with the user | M8 |

## Release gates

- Preserve existing Journeys, Memories, Collections, saved names, artwork, entitlements, and recoverable recording state when upgrading from V1; use additive migrations and validate with copies of representative data.
- Keep manual recording and local browsing functional without network, provider accounts, or hosted sharing.
- Run targeted feature tests first, then the required mobile checks, complete suite, TypeScript, iOS export, and signed-device acceptance appropriate to changed native behavior.
- Validate Light and Dark across existing and new features, plus accessibility, permissions, background operation, account boundaries, deletion, and restore.
- Verify provider permissions/disclosures and update App Store material to the actual final product. Do not claim external approvals based solely on passing tests.
- Confirm V2 distribution isolation before any test publication. A native change needs a compatible native build; neither this roadmap nor historical V1 OTA preferences authorize production publishing.
- Record evidence and remaining issues here or in linked feature plans before marking a milestone complete. No dates or completion claims without verification.

## Source record

- User confirmation in this task: include interactive sharing, Foursquare, Tessie, automatic recording, Spotify through Last.fm, and a light mode color theme.
- Additional user confirmation: include iPad app availability with a new tablet layout; roadmap addition only, with implementation deferred.
- [Shared handoff](../.ai/HANDOFF.md): explicit version-2 sharing deferral, Foursquare 2.0 exclusion, Tessie deferral, and earlier recording/music implementation history.
- [Mobile release checklist](../mobile/recorder/APP_STORE_RELEASE.md): current V1 boundaries and music release gates.
- [Mobile handbook](../mobile/recorder/AGENTS.md) and [repository handbook](../GEMINI.md): persistence, privacy, environment, testing, and Git rules.

Signed preview: [JourneyDeck V2 2.0.0 (1)](https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/6df44875-9aa2-4dd7-a73e-7e4634d143e1). Next action: validate Light/Dark on the physical iPhone, including restart persistence, recording continuity, maps, overlays, and larger text. Continue M0 provider feasibility before starting the next feature. No production OTA or App Store release is authorized by the preview request.
