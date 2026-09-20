# JourneyDeck 2.0 release-candidate status

## V2 COMPLETE — FROZEN

On September 15, 2026, the user confirmed App Review submission of version 2.0,
build 31. V2 development is complete; Apple approval and public release remain
unconfirmed. Manual release is configured.

No V2 changes are allowed except urgent bugs reported by customers. New features,
cosmetic improvements, refactors, and other non-urgent work belong to V3 on a
separate development branch. Root `GEMINI.md` records this maintenance policy.
The submission preparation notes below are historical and do not reopen V2 work.

Last audited: September 15, 2026.

## App Store Connect preparation completed

Final recheck at 3:11 PM: Apple's Add for Review validation passed and the draft
shows **Item Ready to Submit**, iOS App 2.0 / 2.0.0 (31). Watch screenshot order
was corrected and verified saved as Start then Stop before the final draft was
added. **Submit for Review was not clicked**; the external browser is left at
that final step for the user. This supersedes the earlier no-validation note.

Approved assets are uploaded: eight iPhone 1320×2868 graphics, eight iPad
2752×2064 graphics from `Finished iPad`, and two native Watch 368×448 captures.
Both marketing sets were verified in 01–08 order; Watch Start precedes Stop.
A new Description (2,850 characters) and What's New (823 characters) are saved
and survived reload. Reviewer notes now include Siri and replay steps.
Build 31 remains selected; manual release and keeping the existing rating remain
selected. Lifestyle/Travel, existing 4+ age rating, published privacy declarations,
and approved monthly/annual subscriptions were reviewed. The Watch size advisory
does not prevent uploading the accepted Series 6 screenshots.

App Review phone and email were visually verified to match version 1.9.0.
The earlier blank-field report was incorrect: browser text output omitted their
values, while screenshots confirmed both were already populated.
No Add for Review or final submission action has been taken. The user will perform
final submission. Earlier screenshot-pending notes below are historical and
superseded by this section.

Eight user-designed iPhone App Store panels have been split from a stitched
reference image and exported as opaque 1320×2868 PNGs. The user corrected
panel 3 to “See Every Track and Turn Again” and placed the final eight files
in `OneDrive/Desktop/iPhone screenshots/`. They supersede the earlier five
local layouts. Their source panels were only about 180 pixels wide, so fine
app details remain soft after scaling. Build 31 is selected and saved for
version 2.0 in App Store Connect. Eight real Build 31 iPad captures now have
matching navy/gold marketing panels showing the true screens on slightly
tilted iPads. Eight opaque 2752×2064 PNGs, review sheet, and ZIP are in
`OneDrive/Desktop/iPad Screenshots/App Store graphics/`, pending user review
and App Store Connect upload. Watch screenshots and the user's final submission
interaction also remain pending.

## Final icon Build 31 TestFlight result — September 15, 2026

EAS production Build 31 (`e81cad23-f011-49be-afb3-b4a1ac1ec6cf`) bundles all
current mobile source changes since Build 30, including the four approved
no-border icons in the Settings chooser and iOS alternate catalog, navy Grand
Touring primary/Watch artwork, Siri controls, and medallion/replay polish. Exact
submission `990fddc2-1100-428b-b584-196bf0318a54` finished. Apple reports
version `2.0.0` build 31 `VALID` and `IN_BETA_TESTING` for internal TestFlight.
The new production runtime is `2.0.0-watch.9`; no separate OTA was published.

The signed IPA confirms iPhone/iPad support, iOS 17 minimum, Watch build 31,
four registered alternate icons and matching bundled Settings previews, and
Siri symbols. Mobile tests 681/681, focused release checks 30/30, TypeScript,
and iOS export passed. Verify the actual system icon masks, icon selection,
Siri commands, and bundled visual polish on devices before App Review.
Replacement iPhone and new iPad/Watch App Store Connect screenshots remain
pending. Watch Home Screen icons cannot follow iPhone alternate selections;
the Watch bundles Grand Touring navy.

## RC2 Build 30 TestFlight result — September 15, 2026

EAS production Build 30 (`31052a3a-ae42-4105-8890-d8dda77d2682`) compiled
and signed the corrected Grand Touring artwork and native Siri Start/Stop App
Intents. Exact-build submission `da871dc2-7cb2-4a2b-99a6-6b0fceda6e17`
finished; App Store Connect reports version `2.0.0` build 30 `VALID` and
`IN_BETA_TESTING` on isolated runtime `2.0.0-watch.8`. Build 29 failed native
compilation at an app-target import declaration and was never submitted.

Before upload, 681 mobile tests, TypeScript, iOS export, Expo Doctor, public
URL preflight, and the EAS Swift policy harness passed. The signed IPA verifies
the paired Watch, iPhone/iPad support, production iCloud entitlements, four
alternate icons, and extracted Siri action/shortcut metadata. Physical Siri
behavior and actual icon masking await Build 30 installation. Replacement
iPhone and new iPad/Watch App Store Connect screenshots await accepted RC2
device captures; no App Review submission has occurred.

## Build 28 device checks closed — September 15, 2026

User confirms all three remaining Build 28 checks from the RC2 audit work:
recording with a locked/backgrounded phone and paired Watch controls including
the saved journey; offline reopening with local archive/iCloud recovery; and
selected-song/Relive spacing on iPhone plus large-text/iPad rotation. The iPad
medallion and iPhone/iPad replay visual checks were already confirmed. No
specific Build 28 retest remains from that audit. This user acceptance does not
assert coverage of every recorder failure injection or accessibility edge case.

## RC2 decision and device confirmations — September 15, 2026

User confirms the iPad medallions work after the latest OTA and replay looks good
on both iPhone and iPad. These visual checks are accepted. Broader recorder,
offline, layout, and accessibility acceptance is not established by those
confirmations.

Release candidate 2 will include the corrected Grand Touring Home Screen,
Settings, and Watch artwork (NB-013) and Siri Start/Stop controls (NB-012).
The artwork is prepared locally; Siri is planned but not implemented. Both need
a new native build/runtime and physical acceptance. App Store Connect needs
replacement iPhone screenshots plus new iPad and Watch screenshots from the
accepted RC2. Build selection and submission remain pending.

## Latest OTA publication — September 15, 2026

User accepted the iPad loading-cover reveal with "Good that'll work" after the
follow-up below. This closes the reported visible 2D-to-3D loading presentation
issue; it does not establish completion of all broader V2 device checks.

Follow-up group `89559132-ece4-486e-85bb-dd9758a5da60`, iOS update
`01a0a553-0182-70fa-828c-f9e7ed5f1576`, replaces the iPad's visible 2D-to-3D
handoff reported after the polish batch. An opaque themed loading cover now hides
preparation until a sized 3D frame is rendered, then fades away. iPhone retains its
drop. All 30 focused medallion/achievement tests, TypeScript and production export
pass. Published on the same production `.watch.7` runtime; export retained at
`mobile/recorder/.cache/ipad-medallion-cover/export`. New physical iPad visual/drag
acceptance remains pending. The earlier batch below is included in this update.

Published the verified polish batch to production iOS on Build 28 runtime
`2.0.0-watch.7`: iPad medallion entrance, Relive/song spacing, and replay marker
smoothing. Group `75b3b497-fb72-4518-ad21-bfe7d8747e8d`, iOS update
`01a0a544-9953-7d22-90ed-1376bf48b694`. Publication and runtime were independently
confirmed with `eas update:view`. Fresh production export is retained at
`mobile/recorder/.cache/ota-polish-sep15/export`; production environment and
internal-testing flag 0 were used. This supersedes the unpublished status in the
implementation notes below. Physical iPhone/iPad acceptance remains pending.
The Settings icon asset is included; native Home Screen artwork and Siri remain
on the next-native-build list. No App Review submission or native build occurred.

## Current release scope — September 15, 2026

The user states that the only remaining V2 app work before submission is a few
iPad visual tweaks for OTA. Keep this pass limited to those specific corrections
on Build 28's existing `2.0.0-watch.7` runtime, preserving portrait, landscape,
native sidebar, Split View and Dynamic Type behavior. Await the specific iPad
screenshots or descriptions before choosing changes.

Siri controls (NB-012) and delivery of the corrected native Grand Touring icon
(NB-013) remain on the separate next-native-build list. This scope update does
not start a build, publish an OTA or submit to App Review. Historical acceptance
and App Store Connect notes below have not been re-audited in this update.

### iPad medallion drop correction (local, September 15)

The reported portrait/landscape stall is addressed in the iPad startup path:
native artwork enters after the first positive layout, without waiting for a
hidden WebView to become ready. The WebView prepares behind an opaque artwork
cover, then fades into view. iPhone retains its existing entrance. All 28 focused
medallion/achievement tests, TypeScript and the iOS export pass. Native files and
the Build 28 runtime are unchanged. No OTA has been published for this fix;
physical iPad drop/drag acceptance in both orientations remains pending.

### iPhone selected-song/Relive overlap correction (local, September 15)

The map's selected song/start/end card and Relive CTA now share a vertical stack
with a 10pt gap instead of competing absolute bottom positions. Existing replay
behavior remains. All 37 replay/tab-runtime tests and TypeScript pass, plus 12
browser width/text-scale layout checks. Queued with the OTA polish work; no
publication yet. The replay-smoothing export below includes this correction.

### Replay movement smoothing (local, September 15)

The moving marker now uses UI-thread interpolation between 100ms replay updates,
with matching linear camera timing. Sampling the recorded timeline on each frame
preserves route corners and stops; the stored route is unchanged. All 47 focused
route/replay/tab-runtime tests, TypeScript and iOS export pass. Export at
`mobile/recorder/.cache/replay-smoothing/export` includes the current working tree,
including the medallion and Relive fixes. Build 28 native runtime is unchanged.
No OTA publication; physical iPhone/iPad smoothness and controls acceptance remain
pending before treating the improvement as device-verified.

## Source candidate

- Public app version: `2.0.0`
- Bundle identifier: `com.journeydeck.recorder`
- App Store Connect app ID: `6806502526`
- Minimum iOS version: 17.0
- Production runtime: `2.0.0-watch.7`
- Preview runtime: `2.0.0-preview.12`
- Release-candidate build: 28
- Next EAS production build number: 29 (`autoIncrement` from remote 28)
- Production update channel: `production`
- Minted: exact `1.1.1` remains in Build 28; medallion UI now uses Three.js/Expo DOM
- Production RevenueCat Apple SDK key: configured in the EAS production environment
- Export compliance: app config declares only exempt encryption with `usesNonExemptEncryption: false`

Build 28 failed initial medallion visual acceptance: square outlines/reverses
and corrupted face shading. The correction replaces the JS medal view with
Three.js in Build 28's existing Expo DOM WebView. Native code is unchanged, so
this fix targets `.watch.7` through production iOS OTA. The abandoned native
`.watch.8` candidate was not built. All 659 mobile tests, TypeScript and the
production export pass; all 40 artwork variants and front/edge/reverse were
checked in a browser. Physical iPhone/iPad acceptance remains pending.

Production iOS OTA published September 14 at 23:50 UTC: group
`003a024c-c275-4342-a597-eba2963dff1b`, update
`01a0a254-2ab1-7995-be8e-a48e5cf73605`, runtime `2.0.0-watch.7`.
Publication and runtime were confirmed with EAS update:view.

Follow-up OTA at 23:58 UTC: `c71ed92d-bd13-4948-b113-c4da35488b6e` on the
same runtime fixes the achievement sheet's navy background, full opening
height and RN layout boundary. User approved the Three.js rendering on iPhone;
updated sheet presentation still needs device acceptance. Focused tests,
TypeScript and production export passed.

Larger embossed medallions OTA at September 15 00:13 UTC (September 14 CDT):
`4d564b09-18eb-4dd5-b2e8-1af103ffd682`, same Build 28 runtime. Adds larger
responsive medals, conventional 1040px renderer textures, 3x screen density,
raised face geometry and live shadows. Full 659/659 tests, TypeScript,
production export and all 40 browser variants passed. Device acceptance pending.

The user rejected that embossed pass on physical iPhone. Its image-driven .10
displacement and photographed source sidewalls are superseded by 40 recreated
1254px frontal faces, shared circular crops, .006 protected face curvature,
normal engraving, studio reflections and a concentric gold body/reverse.
The rebuilt production export includes all40 lossless WebP variants and passes
671 mobile tests, TypeScript and browser visual checks. Controlled actual-renderer
motion checks pass6/6. Published production iOS OTA at September15 01:04:18 UTC
(September14 8:04pm CDT), group `90bac26f-7d91-4e3a-a3a2-d033695f4cf0`, update
`01a0a297-e2e0-7274-b802-9b1df9cf9da6`, same `.watch.7` runtime. EAS publication
verified; physical-device visual and interaction acceptance remains open.

Grid/loading polish OTA published September15 02:18:00 UTC (September14 9:18pm
CDT): group `67a9e9e7-bbdd-4cbe-acae-25c1c2bcd662`, update
`01a0a2db-5d16-7abb-a847-517f86245621`, same `.watch.7` runtime. Every native
thumbnail now receives a consistent gold outer rim. Detail sheets show a
shadowed, gold-rimmed coin with a moving reflection during WebGL preparation,
then crossfade into the interactive coin; Reduce Motion uses a static opacity
transition. The simpler 768px reverse work map also shortens preparation.
Focused10/10, full671/671, TypeScript, production export, visual review and the
exported DOM onReady/render check passed. EAS publication verified. Physical
device acceptance of the grid rims and loading transition remains open.

Durable cross-device revision metadata for later music enrichment is explicitly
deferred to JourneyDeck V3 roadmap item V3-07. V2 keeps ambiguous local edits
pending and reports the conflict rather than overwriting them; this is not a V2
release gate.

## Verified release candidate

- Expo Doctor: 21/21 checks pass after the SDK 57 patch alignment.
- TypeScript passes.
- Complete mobile test suite passes after the onboarding, icon, and public
  Data Health gating work.
- Focused release/Minted/runtime tests: 20/20 passes.
- Production iOS JavaScript export succeeds with 2,661 modules, an 8.7 MB Hermes
  bundle, and 117 assets, including all 40 approved theme fronts for the complete
  ten-medallion collection.
- Server typecheck, lint, 34/34 tests, and Atlas performance benchmark pass after
  merging the current public-site launch work from `main`.
- Production dependency audit has no high or critical findings. Sixteen moderate
  transitive Expo toolchain findings remain; npm's proposed forced fix would
  downgrade SDK-compatible Expo packages and is not suitable for this candidate.
- The public home, Privacy, Support, Terms, robots, and sitemap URLs all return 200.
- EAS production Build 28 (`ec98f55b-ce23-4716-b526-7d0366611358`) finished,
  and exact-build submission `4f95b46b-d18a-46ff-80cc-d92671ffd1eb` finished.
  App Store Connect reports version `2.0.0` build 28 as `VALID` and
  `IN_BETA_TESTING`; runtime is `2.0.0-watch.7` and fingerprint is
  `279c62998193ef39c454ce3262c157784b094349`.
- The public-release URL preflight passes against `https://journeydeck.me/privacy`
  and `https://journeydeck.me/support`; the production EAS environment contains
  the RevenueCat Apple SDK key, and the Grand Touring source icon is an opaque
  1024x1024 RGB PNG. Gitleaks reports no secrets.
- The standalone Swift policy harness cannot run on this Windows host because no
  Swift compiler is installed. Build 28's EAS Xcode archive compiled the Swift
  app, Watch target, Minted bridge, and native modules successfully.
- The downloaded signed IPA verifies bundle `com.journeydeck.recorder`, version
  `2.0.0` (28), production runtime/channel, iPhone and iPad device families,
  iOS 17 minimum, embedded Watch version/build 2.0.0 (28), production iCloud
  container, beta provisioning, Minted symbols, privacy manifests, and all four
  alternate icon registrations.

## Required before this becomes the submitted release candidate

September 14 onboarding follow-up: the approved Grand Touring icon is now the
primary light/dark icon, with matching Watch artwork. Onboarding has five screens
with content-only transitions over one stationary background. The approved ocean
photo by Walter Coppola replaces the unlicensed Maloja candidate. It is available
under the Unsplash License, allowing commercial use and distribution; provenance
is in `mobile/recorder/assets/onboarding-grand-touring-blue-hour.md`.
Native archive inspection is complete; physical-device acceptance remains pending.



1. The `2.0` draft (Prepare for Submission) now has saved iPhone/iPad/Watch
   review instructions, a refreshed description covering 2.0 features and
   private iCloud sync, and completed What's New text. All three were verified
   after reloading App Store Connect. Promotional Text remains blank and
   optional. The inherited seven iPhone screenshots are old;
   iPad and Apple Watch sections have no screenshots. Reviewer contact, support
   and marketing URLs, keywords, and copyright copied successfully. Manual
   release and keeping the existing rating remain selected; no build is selected.
2. Completed September 14: production Build 28 was compiled, its signed IPA was
   inspected, and that exact build was uploaded to App Store Connect/TestFlight.
3. Install that build from TestFlight and complete the iPhone, iPad, and paired
   Watch device matrix in `mobile/recorder/docs/next-native-build-checklist.md`.
   Minted must be checked in all four themes, online and from cached artwork,
   with a fixed gold reverse/edge, Reduce Motion, VoiceOver, and fallback behavior.
4. After device acceptance, capture upload-ready iPhone, iPad, and Apple Watch
   screenshots from that exact build. The files under
   `docs/design/app-store-v2-first-screen` are concepts and have deliberately
   non-upload-ready dimensions.
5. Upload the screenshots, select the accepted build for version `2.0`, resolve
   any build-specific export-compliance prompt, complete the final metadata
   preflight, and submit the version to App Review.

Completed September 14, 2026: the corrected JourneyDeck 2.0 privacy policy is
live; Purchase History is published as anonymous, non-tracking data used for App
Functionality and Analytics; the App Review phone and email are saved; and App
Store Connect confirms age rating 4+, free public pricing, 148-region
availability, active agreements, banking, U.S. tax and DSA records, and Approved
monthly/annual subscriptions. RevenueCat has both products on the `pro`
entitlement and in the default offering. Reconfirm account state if submission
occurs materially later.

Production Build 28 was built and uploaded to TestFlight. No EAS Update, Git
commit/push, public App Review submission, screenshot replacement, or release was
performed.

September 15 RC2 update: Build 30 (`31052a3a-ae42-4105-8890-d8dda77d2682`)
was uploaded and entered TestFlight beta testing. Physical review rejected the
Grand Touring icon's gold outer border. The border-free replacement is prepared
locally in `mobile/recorder/assets/icon-grand-touring-v2.png`; it is not in Build
30. Do not select Build 30 for App Review. The user explicitly requested no OTA
push. A new native build is required to change the installed Home Screen and
Watch icons, after visual acceptance of this replacement. iPhone/iPad/Watch
screenshots still need capture and upload from the accepted build.

September 15 icon follow-up: the user approved all four matching no-border icon
designs. The source now includes the new Warm Ivory, Rosewater, and Cinematic
alternate iOS/iPadOS icon assets, with the same images in the Settings icon picker.
The primary and Watch icon sources use the navy Grand Touring image. These source
changes are local and are not in TestFlight Build 30. Apple Watch's system Home
Screen icon remains its single bundled primary icon; it cannot change when an
iPhone/iPad alternate icon is selected. Verify all four Settings choices and
iPhone/iPad Home Screen results on the next build, plus the Watch primary icon.
No OTA, native build, Apple upload, screenshot update, or App Review submission
was started for these icon changes.
