# JourneyDeck 2.0 release-candidate status

Last audited: September 14, 2026.

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
- Minted: exact `1.1.1`, generic native renderer with OTA-delivered artwork
- Production RevenueCat Apple SDK key: configured in the EAS production environment
- Export compliance: app config declares only exempt encryption with `usesNonExemptEncryption: false`

The source candidate intentionally has its own runtime. It must not publish to
Build 27's `2.0.0-watch.6` runtime because Build 27 does not contain the generic
Minted artwork bridge.

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
