# JourneyDeck V2 product roadmap

Updated: September 9, 2026

September 6 implementation update: the approved data-rich Statistics dashboard now powers both iPhone and iPad, with six widgets, the calendar immediately below, selected-day detail, raw journey/music charts, paged native journey links, averages, record highs and activity split in both themes. iPhone uses compact safe-area spacing, two equal metric columns and stacked panels; iPad retains wide dashboard rows. Home, Soundtracks, Memory Studio, Statistics and Settings have tablet source implementations; older Home-only/blank-tab milestone descriptions below are historical. Statistics typecheck and all 294 mobile tests pass; physical layout/VoiceOver acceptance remains pending for the newest source.

## Purpose and scope

Build on JourneyDeck 1.9.0 (Build 14) with more personal presentation, richer place intelligence, vehicle intelligence, broader music support, native Apple Watch control, and dedicated iPad layouts. The original feature list was approved September 4, 2026 and revised by the user September 6.

Later on September 4, the user also approved the native-navigation Phase 1 described below. It is an additional foundation milestone.

This is the product roadmap for the iOS app and its required supporting services. It is separate from the completed desktop modular-monolith migration roadmap. Desktop redesign, Android, and unrelated architecture rewrites are outside this scope.

September 15 scope decision: V2.5 will not ship as a separate release. All future work, including iPhone Duo compatibility, belongs to JourneyDeck V3. V2 has no Tessie integration or Tessie-derived UI; the preserved implementation remains hard-disabled compatibility/reference code only. Live Activities with explicit Dynamic Island support, a safety-constrained CarPlay companion, one new red theme, and one new green theme are confirmed for V3. Automatic journey recording and interactive shared-journey web pages remain outside V2. Spotify through Last.fm remains blocked and must not advance until the Last.fm partners team responds.

September 6 paid-membership direction: keep the focused Atlas value set to cinematic journey playback and recaps, premium Home widgets and Watch complications, Atlas intelligence, and premium themes and app icons. Themes and icons are a distinct benefit rather than being buried under widgets. Basic recording, route viewing, POI labels, and ordinary iCloud backup remain core functionality. Tessie access is no longer part of the V2 membership or core-feature scope.

Approved premium theme directions (September 6): **Sakura Chrome** and **Riviera Porcelain** are the new light themes; **Redline Noir** and **Aurora Passage** are the new dark themes. Preserve each concept's distinct palette and atmosphere during implementation rather than reducing them to accent-color swaps.

Latest September 6 decision supersedes the names above: **Rosewater** replaces Sakura Chrome, and **Carbon Blue** with ice-white accents replaces Redline Noir. Carbon Voltage/cognac were rejected. Both replacements now include separate matching headers, Memory covers and journey placeholders. Existing stored selections are retained, original Cinematic Dark/Warm Ivory stay available, and testing remains free. User authorized OTA publication; see the latest handoff for the verified release ID.

September 6 implementation: Sakura Chrome and the revised multicolor Redline Noir are prepared in the mobile working tree with bundled artwork/materials and a persistent four-theme Settings picker on iPhone/iPad. **No paywall during testing.** Full mobile299/299, typecheck and iOS export pass; physical visual acceptance and OTA publication remain pending. Riviera Porcelain and Aurora Passage remain planned; Home Screen icon changes remain separate native work.

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
| M2 — Place intelligence | U.S. Overture POI with MapKit fallback | Implemented and deployed; physical destination acceptance pending | Real place matches improve labels while saved names and offline behavior remain reliable |
| M3 — Vehicle intelligence | Moved to JourneyDeck V3 | Tessie remains hard-disabled compatibility/reference code in V2 | No V2 runtime, entitlement, onboarding step, setting, replay, or screen exposes Tessie |
| M4 — Automatic recording | Removed from V2 | Superseded by intentional Apple Watch Start/Stop | No V2 implementation required |
| M5 — Broader soundtracks | Spotify listening matched through Last.fm | Blocked pending a response from the Last.fm partners team | Resume only after written partner clearance |
| M6 — Interactive sharing | Removed from V2 | Hosted journey website is no longer needed | No V2 implementation required |
| M7 — iPad support | App availability on iPad with a dedicated tablet layout | All five tablet tabs implemented in Build 18; physical acceptance pending | Primary flows work in an iPad-specific layout, with physical iPad validation |
| M8 — V2 release candidate | Integrated verification, upgrade acceptance, release material | Build 18 delivered to TestFlight; physical acceptance and public review remain | Active in-scope features and release gates pass |

Provider permission, pricing, and coverage checks remain required before any V3 Tessie work and before resuming Last.fm. Last.fm work is paused pending its partners team. The sequence is not a calendar estimate.

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

**Done when:** No unreadable labels, dark-only sheets, or theme flashes remain in the covered flows; small screens and large text are usable; the Light/Dark choice persists and responds correctly; both themes receive visual review on a physical iPhone.

### V2-02 — Foursquare place enrichment

**Outcome:** Journeys identify useful venues and destinations with less manual naming.

Proposed scope:
- Assess the existing provider adapter/cache work and define the mobile integration against the current local-first architecture.
- Add bounded, cached venue suggestions with clear fallback to existing Apple lookup and locally saved names.
- User-named places always take precedence. Ambiguous results must not silently overwrite a canonical place.
- Keep enrichment outside active-recording and local-save critical paths; use only the location detail necessary for the selected lookup.

**Done when:** Representative real destinations resolve usefully; ambiguous/no-result/provider-failure cases remain usable; saved names survive refreshes; offline journeys still finish immediately; required provider access, cost limits, attribution, and privacy disclosures have been verified before release.

### V2-03 — Tessie and vehicle intelligence — moved to V3

**September 9 decision:** Do not implement or release Tessie in JourneyDeck V2. Replay, Settings, onboarding, entitlements, and ordinary V2 dashboards must not imply that live vehicle data is available. Preserve the gated code only to inform a fresh V3 design review; do not enable it by changing the release flag.

<details><summary>V3 backlog context</summary>

**Outcome:** A connected Tesla adds useful vehicle context to JourneyDeck.

Proposed scope:
- Restore a deliberate connection/disconnection experience, reviewing preserved code instead of simply enabling the old gate.
- Select a useful first vehicle view from the recorded backlog: vehicle status, charging history, energy use, costs, and journey-linked efficiency insights.
- Preserve profile-scoped Keychain credentials and local cached views. Label unavailable or stale data honestly; distinguish measured values from estimates.
- Review the older server-backed intelligence design against today's on-device model before reuse.

**Done when:** A real vehicle connection, refresh, token expiry, disconnect, and profile change work safely; vehicle/charging data is attributed correctly; cost calculations explain their inputs; missing Tessie access cannot block ordinary JourneyDeck use. Free/paid access and multi-vehicle scope are explicitly settled.

</details>

### V2-04 — Automatic journey recording — removed from V2

**September 6 decision:** Do not implement or release automatic journey recording in V2. The Apple Watch companion now provides convenient, intentional Start/Stop control and removes the product need for this feature. Dormant automatic-recording code remains disabled and is not a release requirement.

<details><summary>Historical proposal</summary>

**Outcome:** Eligible users can capture real drives without remembering to tap Start or End.

Proposed scope:
- Review both dormant native and Expo recording paths and choose one owner of each active journey.
- Automatic departure detection, bounded pre-roll, parked/arrival completion, and clear controls to enable or disable automation.
- Preserve manual recording, offline completion, local recovery, and duplicate-session prevention.
- Decide whether automation requires Tessie, an active membership, both, or neither. The earlier Tessie-paid design is historical context, not a settled V2 requirement.

**Done when:** Physical tests cover ordinary drives, short drives, traffic lights, walking, parking, poor GPS, locked/background operation, denied/revoked permissions, offline completion, restart recovery, and switching modes. Measure departure/arrival accuracy and battery impact against agreed acceptance targets. Unsupported force-quit or platform behavior must be explained honestly. Test entitlement/vehicle loss if those gates are retained.

</details>

### V2-05 — Spotify soundtracks through Last.fm

**Status:** Blocked. Do not advance public implementation or release work until the Last.fm partners team responds and provides the necessary clearance.

**Outcome:** Spotify listeners can attach their listening history to journeys through the planned Last.fm path.

Proposed scope:
- Promote the existing internal bounded-history matching flow only after its public-use gate is resolved.
- Explain setup, account connection, expected matching delay, and why some plays may be missing.
- Match, deduplicate, persist, and privately sync results on-device. Handle retries, timezone boundaries, delayed history, and listening from other devices.
- Keep Apple Music working unchanged. Direct Spotify API access remains a separate owner-only capability, not the promised public solution.

**Done when:** Real Spotify-to-Last.fm history produces correctly timed journey songs; retries do not duplicate plays; empty/late/unavailable history has clear states; route geometry and JourneyDeck records are not sent to the privacy edge. Obtain the written permission and presentation clearance required by the recorded release gate, and verify current provider terms before public distribution. Do not contact providers automatically from this roadmap.

### V2-06 — Interactive shared-journey web pages — removed from V2

**September 6 decision:** Do not build the hosted interactive journey website. It is no longer considered realistic or necessary for V2. Existing local sharing and privacy-safe share cards remain.

<details><summary>Historical proposal</summary>

**Outcome:** A recipient can explore a selected journey through a link without installing JourneyDeck.

Proposed first delivery:
- An interactive privacy-masked route, song/artwork pins, timeline playback, and owner-selected photos and notes.
- A preview of exactly what will be shared, followed by an explicit publish action.
- Owner-controlled revocation and configurable expiry; clear handling for expired/deleted links.
- Apple Music handoff where a valid link exists, and mobile/desktop browser support.

Design candidates within this feature: MapKit JS as the map renderer and optional Look Around. Evaluate coverage, access requirements, cost, and privacy before committing to either; these are not separately promised launch capabilities.

**Done when:** Sensitive endpoints, photo metadata, and unselected content cannot leak through the published payload; a recipient can explore the page; revocation and expiry stop subsequent access with a defined cache policy. Explain that previously downloaded or captured content cannot be recalled. Verify account deletion, share deletion, accessibility, readable themes, and hosting limits. Hosted sharing stays optional and never becomes a dependency for local recording or viewing.

</details>

### V2-07 — iPad app support and new layout

**Outcome:** JourneyDeck is available on iPad with a new layout designed for the larger screen.

Confirmed first implementation (September 4): Option 2 widget dashboard, using current iPhone colors, artwork, recording logic and local library. Build only Home in dark and warm ivory. Native sidebar-adaptable navigation contains Home, Music, Memories, Statistics and Settings; Music, Memories and Statistics are blank, and Settings contains only the saved Light Mode switch. Widgets rearrange for portrait, landscape and narrow iPad windows. iPhone screens and tab order remain intact.

This is a universal iPhone/iPad V2 preview in the existing EAS project, with tablet support, iPad rotation/windowing and runtime `2.0.0-preview.5`. The registered iPad and iPhone are included in the signed preview profile. Home implementation passed TypeScript, required mobile checks, 242 tests, iOS export and browser component layout checks; native sidebar/inset behavior and physical iPad acceptance remain pending. Full iPad feature pages and detail navigation are later work, not part of this Home-only delivery.

Build 6 completed and signed IPA verified: [install universal V2 preview](https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/4f678d8b-3db1-4ece-bac1-d6c78212f1db). Both registered devices, iPad device support/rotation, unchanged iPhone orientations, isolated CloudKit and EAS OTA configuration verified in the downloaded app.

**Done when:** The app installs and runs on supported iPads; primary screens and flows use the new tablet layout; Light/Dark themes and accessibility are validated on a physical iPad; existing iPhone behavior is preserved.

## Confirmed JourneyDeck V3 scope

These items are approved for V3 planning and are not V2 release requirements. Their implementation details, native baselines, entitlements, pricing, and acceptance plans remain to be designed before work begins. September additions confirm iOS widgets, a user-initiated ShazamKit Listen action on Apple Watch and the journey Live Activity, conversational Siri/Apple Intelligence access to JourneyDeck data, hands-free Journey Markers, a U.S.-customer-only 50 States checklist game, and Adventure Roulette; Tessie activation, Live Activities, the green theme, and adaptive Duo support were reaffirmed.

For the first isolated V3 preview, Atlas and all implemented themes must be directly testable without a paid membership. Atlas preview access grants only `atlasAccess`: it must not fabricate a paid tier, unlock complete history, or enable Tessie/other paid capabilities. Production remains StoreKit-gated for Atlas. The existing Theme Picker is already membership-free; newly implemented V3 themes must remain available there for preview acceptance.

### V3-01 — Tessie and vehicle intelligence

- Deliberate Tessie connection and disconnection, live vehicle context, charging history, energy use, cost, and journey-linked efficiency.
- Turn on Tessie integration in V3, including the user-facing connection and vehicle-intelligence experience. Review V2's dormant code against the V3 architecture and current provider, credential, privacy, cost, entitlement, and lifecycle requirements before removing its hard-disable gate; do not activate it in V2.

### V3-02 — Live Activities and Dynamic Island

- Present glanceable active-journey status such as recording state, elapsed time, distance, and GPS health on the Lock Screen and Dynamic Island.
- Design the Dynamic Island's compact, minimal, and expanded presentations deliberately instead of treating it as an incidental Live Activity surface.
- Limit controls to safe recording actions, integrate them with the single recorder owner, and require a compatible native extension/build plus physical lifecycle testing.
- Include a user-initiated ShazamKit Listen action in the active-journey Live Activity, subject to supported iOS interaction, microphone permissions, and distraction-safe behavior; never start ambient recognition automatically.

### V3-03 — CarPlay companion

- Provide a deliberately limited, driver-safe companion for journey status and essential recording controls rather than reproducing the full JourneyDeck dashboard.
- Treat Apple entitlement, supported template, distraction, background lifecycle, and real-vehicle validation as gates before implementation or release.

### V3-04 — New red theme

- Add a distinct red-led visual system with its own palette, materials, map treatment, artwork, icon option, accessibility contrast, and Reduce Transparency behavior.
- Assign a new stable theme ID; do not repurpose an existing stored theme selection or reduce the concept to an accent-color swap.

### V3-05 — New green theme

- Add a distinct green-led visual system with its own palette, materials, map treatment, artwork, icon option, accessibility contrast, and Reduce Transparency behavior.
- Assign a new stable theme ID; do not repurpose an existing stored theme selection or collapse it into Grand Touring's current Racing Green accent.
- Implemented source-side as **Autumn Drive** for the isolated V3 preview under stable internal ID `midnight-canopy`: [approved palette, Statistics reference, and borderless icon provenance](design/midnight-canopy/README.md). The theme and chooser wiring are complete; native icon switching and full accessibility/visual acceptance still require a user-authorized V3 device build.

### V3-07 — iPhone Duo support

- Adapt navigation, dashboards, maps, replay, editors, Memories, media and recording controls for iPhone Duo while preserving ordinary iPhone and iPad layouts.
- Base the implementation on shipping hardware and public Apple SDK capabilities. Do not hardcode speculative screen dimensions, hinge geometry, safe areas, multitasking behavior or continuity rules.
- Preserve active recording, local state, map camera state, unsaved edits and media playback through supported fold/unfold and size-class transitions.
- Treat all themes, accessibility sizes, orientations, background recording, battery use and physical-device acceptance as V3 release gates.
- The former V2.5 compatibility release is canceled; Duo work already underway in the isolated V3 branch remains source-only until native and device acceptance.
- Use the shared adaptive interface driven by live window, size-class, safe-area and fold-region measurements rather than device-name checks; maintain continuity across compact/regular presentations and Duo postures.

### V3-08 — iOS widgets

- Add native iOS Home Screen and Lock Screen widgets for glanceable JourneyDeck journey, vehicle, and/or reflection information, with exact widget families and content to be selected during design.
- Share only minimum, privacy-safe local snapshots with WidgetKit; keep widgets useful without network access and avoid exposing precise routes, home/work locations, credentials, or stale recording/vehicle state.
- Define timeline freshness, refresh budget, empty/offline states, accessibility, theme treatment, and tap destinations; require a compatible native extension/build and physical-device validation.

### V3-09 — ShazamKit Listen on Apple Watch and Live Activity

- Add an explicit Listen button to the Watch app and the active-journey Live Activity, both routing through a single user-initiated ShazamKit recognition flow where the platform supports it.
- Require microphone permission and clear listening/recognition feedback; prevent duplicate sessions and preserve journey/recorder continuity. Do not turn this into continuous, background, or automatic song capture.
- Validate Watch connectivity/standalone behavior and Live Activity interaction on supported devices, including failure, cancellation, and inactive-journey states.

### V3-10 — Conversational Siri and JourneyDeck intelligence

- **September 16 focused prototype (source only):** implemented the optional phone/iPad Home `Ask JourneyDeck` widget and native free-text sheet, app-target question App Intent, shared offline deterministic native archive reader, spoken-response contract, interactive supporting-details snippet/route, and profile/lock/redaction boundaries. See [implementation contract and physical-device acceptance](../mobile/recorder/docs/ask-journeydeck-prototype.md). Three questions and one follow-up are covered by local engine/SQLite tests, **not yet tested on a physical device**. No build was requested or run; broader entities, semantic/onscreen context and model-backed analysis below remain future work.
- Model authorized journeys, memories, music, and connected vehicle context as App Entities and expose useful App Intents. Adopt only genuinely matching App Schemas, then validate Siri's natural-language questions and follow-up conversations on iOS 27 devices. Keep an explicit “Ask JourneyDeck” question action as a fallback where an entity or schema cannot cover a request.
- Let Siri find relevant records through privacy-reviewed Spotlight indexing where appropriate, or an app-provided entity query for sensitive, large, or fast-changing data. Annotate JourneyDeck detail screens with the entity currently visible so requests such as “Tell me more about this journey” have reliable onscreen context; offer an in-app path to inspect supporting records.
- Build an optional in-app AI analyst for richer comparisons and explanations. Use JourneyDeck's authorized data queries for exact dates, distances, counts, and totals; never accept a model-generated number as the source of truth. Evaluate Apple's on-device Foundation Models first for private/offline analysis, then consider eligible Private Cloud Compute only for more complex questions with clear disclosure, minimal data transfer, availability/quota handling, and a local fallback.
- Ground answers in the user's authorized data, identify missing or stale information, enforce owner/Duo data isolation, and keep spoken responses concise and distraction-safe. Never index raw routes, sensitive home/work locations, or credentials. Do not send private archive records to an external model without a separately designed, explicit opt-in and strict data minimization.
- Prototype three representative questions and one follow-up on a native iOS 27 build before locking the architecture. Siri's entity understanding and follow-up behavior depend on the schemas and platform capabilities JourneyDeck can legitimately adopt; do not claim arbitrary Siri questions are automatically routed to the app or that JourneyDeck replaces Siri.

### V3-11 — Journey Markers

- Let a person say “Hey Siri, create a marker in JourneyDeck” during an active journey without looking at or touching the phone. Siri creates only a timestamped Marker attached to that active Journey; it does not prompt for text or media while the person is driving.
- Show each Marker as its own small polaroid-pin icon on the Journey route, visually distinct from numbered song pins. Tapping the pin opens that Marker rather than a general journey editor.
- After the drive, let the person enrich the Marker with text and photos. A Marker is a tiny memory inside its Journey; use “Marker” and “Markers” throughout the UI. Voice memos are not part of the feature.
- Markers do not resurface on a future date, send reminders, or use automatic location triggers. Preserve local-first storage and recovery, bind every Marker to the correct profile, journey, and capture time, and never expose its precise coordinate outside the private Journey experience.
- The current source-only interaction lab is available only in the isolated V3 preview from Settings. It demonstrates the Siri phrase, distinct route icon, and later enrichment flow beneath JourneyDeck's standard themed native header. Its controls remain in-memory demonstrations pending the native App Intent, durable marker storage, and private media implementation.

### V3-12 — U.S. 50 States checklist game

- For U.S. customers only, provide a simple checklist where people manually mark which of the 50 U.S. states they have seen represented on license plates, view completed and remaining states, and resume their progress over time.
- The game does not take or import pictures, use camera/OCR or automatic recognition, record plate numbers or vehicle identities, or attach precise sighting locations. A checked state is the complete saved observation.
- Keep checklist interaction passenger-only or available while parked; do not reward extra driving or unsafe behavior. The V3 preview now includes accessible manual toggles, a recoverable reset confirmation, and user-scoped local-first persistence. U.S. storefront/customer eligibility remains a release-distribution gate rather than an inferred location or background-location check.
- Give eligible U.S. customers an optional customizable `50 States` Home widget showing compact progress and opening the dedicated checklist screen. The Home surface scrolls to accommodate it and other chosen widgets while keeping the V3 `Record Journey` action/live recording outside the grid. Memories → Collections provides the secondary entry; there is no permanent tab or Settings entry.
- Grand Touring visual exploration: [six map, grid, checklist, dashboard, roadbook, and combined concepts](design/us-50-states-grand-touring/README.md). The selected map → statistics → state-picker direction is implemented in the isolated V3 preview with a stylized tile map; the concepts are visual references, not authoritative geography assets.

### V3-13 — Adventure Roulette

- Offer an opt-in destination picker for spontaneous trips: choose constraints such as available time, distance, mood, and destination type, then reveal a suggested adventure that the person can accept, reroll, or dismiss before departure.
- Hand accepted destinations to a supported navigation app rather than silently starting a drive. Tessie-connected range/charging context may improve suggestions, but the feature must also work without Tessie and must not present an unverified range estimate as a safety guarantee.
- Design place-source quality, opening hours/freshness, offline behavior, exclusions for sensitive places, cost, and driver-safe interaction before implementation; never encourage interacting with the roulette while driving.

### V3-07 — Durable cross-device music revisioning

- Add a durable edit timestamp and monotonic sync revision to each music observation so metadata repairs can converge reliably across devices.
- Increment the revision for every synced metadata change, carry it through private CloudKit records, and acknowledge uploads only when the local revision still matches the uploaded payload.
- Define deterministic handling for concurrent edits and compatible metadata merges, then validate offline edits, delayed acknowledgements, stale replay, artwork enrichment, upgrades, and two-device recovery.
- Preserve V2's conservative behavior until this migration ships: keep a conflicting local edit pending and report it instead of allowing an older cloud copy to overwrite it.

## Decisions to settle before the relevant implementation

| Decision | Proposed approach / question | Needed by |
| --- | --- | --- |
| V2 distribution | Confirmed: separate side-by-side preview with isolated EAS OTA delivery; public V2 updates the existing App Store app. Shared edge changes still require explicit control | M0 |
| Theme behavior | Confirmed: saved Light Mode switch, dark by default, option-two warm ivory palette, original exported cards | M1 |
| Provider access and operating cost | Keep Last.fm blocked pending partner clearance; reassess Tessie access and cost only during V3 planning | M5/V3 |
| Vehicle entitlement | Deferred: define Tessie pricing/access from first principles in JourneyDeck V3 | V3 |
| Live Activities and Dynamic Island | Define the native extension, shared recorder state, update budget, stale-state recovery, and compact/minimal/expanded Dynamic Island presentations | V3 |
| iOS widgets | Choose WidgetKit families, privacy-safe local data contract, timeline budget, offline/empty states, and tap destinations | V3 |
| ShazamKit Listen actions | Validate supported Watch and Live Activity interaction paths, microphone permissions, shared recognition ownership, and driver-distraction limits | V3 |
| Conversational Siri / AI analyst | Choose genuinely matching App Schemas, entity/index/query/onscreen contracts, and question fallback; validate multi-turn Siri behavior on device and deterministic statistics plus on-device/PCC model availability, disclosure, grounding, quotas, privacy, and offline fallback | V3 |
| Journey Markers | Implement the hands-free App Intent, durable journey binding, polaroid route pins, private text/photo attachments, deletion, and stopped-vs-moving interaction rules | V3 |
| U.S. 50 States checklist game | Define U.S.-customer eligibility, the 50-state catalog, manual checklist/progress UX, optional customizable Home widget and scrolling behavior, Memories → Collections entry, passenger/parked gating, reset behavior, accessibility, and local-first persistence; exclude photos, OCR, plate details, vehicles, and sighting locations | V3 |
| Adventure Roulette | Define suggestion/place source, user constraints, reroll and navigation handoff, offline fallback, Tessie-independent behavior, sensitive-place exclusions, and safety checks | V3 |
| CarPlay | Confirm entitlement eligibility and select only Apple-approved, driver-safe templates and controls | V3 |
| V3 red and green themes | Name and art-direct both as independent systems; allocate new stable IDs and validate contrast across every primary surface | V3 |
| iPhone Duo emergency compatibility | Confirm shipping hardware and public SDK behavior, then define adaptive layouts, posture continuity, safe areas and physical-device acceptance without expanding V2.5 scope | V2.5 |
| Badges | Define the initial badge catalog, progress rules, retroactive awards, presentation surfaces, accessibility and private backup behavior | V3 |
| Cross-device music revisioning | Design an additive music schema migration, CloudKit revision contract, deterministic conflict handling and two-device acceptance matrix | V3 |
| iPad experience | Define tablet navigation, screen layouts, supported orientations, and device-specific capabilities | M7 |
| Release packaging | Ship only the active V2 scope; automatic recording and hosted interactive sharing are explicitly removed, while Last.fm remains blocked | M8 |

## Release gates

- Preserve existing Journeys, Memories, Collections, saved names, artwork, entitlements, and recoverable recording state when upgrading from V1; use additive migrations and validate with copies of representative data.
- Keep manual recording and local browsing functional without network, provider accounts, or hosted sharing.
- Run targeted feature tests first, then the required mobile checks, complete suite, TypeScript, iOS export, and signed-device acceptance appropriate to changed native behavior.
- Validate Light and Dark across existing and new features, plus accessibility, permissions, background operation, account boundaries, deletion, and restore.
- Verify provider permissions/disclosures and update App Store material to the actual final product. Do not claim external approvals based solely on passing tests.
- Confirm V2 distribution isolation before any test publication. A native change needs a compatible native build; neither this roadmap nor historical V1 OTA preferences authorize production publishing.
- Record evidence and remaining issues here or in linked feature plans before marking a milestone complete. No dates or completion claims without verification.

## Source record

- Original September 4 scope included interactive sharing, Foursquare, Tessie, automatic recording, Spotify through Last.fm, and a light mode color theme.
- September 6 user revision: remove automatic recording because the Watch companion covers intentional Start/Stop; remove the interactive sharing website; keep Last.fm blocked pending a partners-team response.
- September 9 user revision: remove Tessie and all Tessie-derived replay UI from V2; reconsider the integration in JourneyDeck V3.
- September 9 V3 additions: Live Activities with explicit Dynamic Island support, a limited CarPlay companion, a new red theme, a separate new green theme, and private data-backed badges (the separate badges milestone was removed September 15 after becoming medallions).
- September 15 decision: medallions supersede badges; do not carry badges as a separate V3 feature. V3-06 is retired rather than reusing its identifier.
- September 9 emergency addition (superseded September 15): foldable-device compatibility was initially planned as a focused JourneyDeck V2.5 release.
- September 15 decision: cancel a separate V2.5 release and move iPhone Duo support and all future work into V3.
- September 15 V3 brainstorming briefly described a Time Capsule, but that was a misunderstanding rather than a feature. September 17 device review defined Journey Markers: timestamped hands-free Siri moments inside an active Journey, using a distinct polaroid route pin and accepting text and photos afterward. Voice memos, future reveal, reminders, and resurfacing are out of scope. September 16 clarification narrows V3-12 to a U.S.-customer-only manual 50-state checklist with no picture capture/import, OCR, plate details, vehicle identity, or sighting-location storage. Its primary entry is an optional customizable Home widget on the existing scrollable Home surface, with Memories → Collections as a secondary entry and no permanent navigation tab.
- September 14 V3 addition: defer durable cross-device music revision metadata and convergence to V3; retain V2's conflict-safe, non-destructive fallback.
- Additional user confirmation: include iPad app availability with a new tablet layout; roadmap addition only, with implementation deferred.
- [Shared handoff](../.ai/HANDOFF.md): explicit version-2 sharing deferral, Foursquare 2.0 exclusion, Tessie deferral, and earlier recording/music implementation history.
- [Mobile release checklist](../mobile/recorder/APP_STORE_RELEASE.md): current V1 boundaries and music release gates.
- [Mobile handbook](../mobile/recorder/AGENTS.md) and [repository handbook](../GEMINI.md): persistence, privacy, environment, testing, and Git rules.

Signed preview: [JourneyDeck V2 2.0.0 (1)](https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/6df44875-9aa2-4dd7-a73e-7e4634d143e1). Next action: validate Light/Dark on the physical iPhone, including restart persistence, recording continuity, maps, overlays, and larger text. Continue M0 provider feasibility before starting the next feature. No production OTA or App Store release is authorized by the preview request.
