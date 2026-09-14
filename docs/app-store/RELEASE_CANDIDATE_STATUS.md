# JourneyDeck 2.0 release-candidate status

Last audited: September 14, 2026.

## Source candidate

- Public app version: `2.0.0`
- Bundle identifier: `com.journeydeck.recorder`
- App Store Connect app ID: `6806502526`
- Minimum iOS version: 17.0
- Production runtime: `2.0.0-watch.7`
- Preview runtime: `2.0.0-preview.12`
- Next EAS production build number: 28 (`autoIncrement` from remote 27)
- Production update channel: `production`
- Minted: exact `1.1.1`, generic native renderer with OTA-delivered artwork
- Production RevenueCat Apple SDK key: configured in the EAS production environment
- Export compliance: app config declares only exempt encryption with `usesNonExemptEncryption: false`

The source candidate intentionally has its own runtime. It must not publish to
Build 27's `2.0.0-watch.6` runtime because Build 27 does not contain the generic
Minted artwork bridge.

## Verified without creating a build

- Expo Doctor: 21/21 checks pass after the SDK 57 patch alignment.
- TypeScript passes.
- Complete mobile test suite: 644/644 passes.
- Focused release/Minted/runtime tests: 20/20 passes.
- Production iOS JavaScript export succeeds with 2,640 modules, a Hermes bundle,
  97 assets, and all 20 approved theme fronts for the first five medallions.
- Server typecheck, lint, 34/34 tests, and Atlas performance benchmark pass after
  merging the current public-site launch work from `main`.
- Production dependency audit has no high or critical findings. Sixteen moderate
  transitive Expo toolchain findings remain; npm's proposed forced fix would
  downgrade SDK-compatible Expo packages and is not suitable for this candidate.
- The public home, Privacy, Support, Terms, robots, and sitemap URLs all return 200.
- EAS reports Build 27 and its exact-build submission as finished. The remote
  production build counter is 27.

## Required before this becomes the submitted release candidate

1. Finish and approve the remaining five medallion fronts: After Dark, Explorer,
   Open Road, Thousand Mile Club, and Grand Tourer. Their achievement rules exist,
   but their final four-theme artwork does not.
2. Capture upload-ready iPhone and iPad App Store screenshots from the final
   production-configured build. The six files under
   `docs/design/app-store-v2-first-screen` are concepts and have deliberately
   non-upload-ready dimensions.
3. Confirm App Store Connect metadata, age rating, privacy answers, reviewer
   contact details, subscription products/offering, purchase screenshots,
   pricing/availability, agreements, tax, and banking. These are account state
   and cannot be proven from the repository.
4. Create the production archive after the build hold is lifted. Inspect the
   signed IPA for version/build/runtime, opaque default icon, iPhone/iPad support,
   Watch embedding, privacy manifests, CloudKit entitlements, RevenueCat, and
   Minted symbols before uploading that exact build.
5. Install that build from TestFlight and complete the iPhone, iPad, and paired
   Watch device matrix in `mobile/recorder/docs/next-native-build-checklist.md`.
   Minted must be checked in all four themes, online and from cached artwork,
   with a fixed gold reverse/edge, Reduce Motion, VoiceOver, and fallback behavior.

No native build, EAS Update, upload, or App Review submission was started during
this audit.
