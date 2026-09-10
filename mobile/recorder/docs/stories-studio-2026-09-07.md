# Stories & Studio — implementation and release acceptance

Implemented in the existing mobile working tree on September 7, 2026. Prior release-reliability, theme, icon, Settings and map changes are preserved. **Native Build 22 is available in internal TestFlight**, version 2.0.0/runtime `2.0.0-watch.3`, with iPhone/iPad and paired Watch support. No OTA or public App Store release was published.

## Native release evidence

- EAS build `d2bec584-7978-41a0-93e2-c80deeda53a4` and submission `9f7555e7-b144-4613-9072-95e770e5b54e` both finished. Apple build `c62e8da5-2e66-48aa-8594-072475b11596` reports `VALID` and `IN_BETA_TESTING`; testing notes were saved and read back from App Store Connect.
- Native compile failures in attempts 20/21 were corrected: PhotoKit's limited-library picker needs `PhotosUI` imported/linked; the recorder mutation continuation needs an explicit `CheckedContinuation<Void, Never>` type. Build22 passed the actual Swift/Xcode archive. Full mobile suite remains428/428; focused recorder/recovery checks also passed after the final type annotation.
- The signed IPA preserves Build19's app, keychain, iCloud and Sign in with Apple identities. It contains the PhotoKit/Audio/icon/CloudKit modules, all three alternate icons for phone/tablet, paired Watch22, exact five Grand Touring artwork files and both original recap audio files. Photos purpose is present; the microphone purpose is unchanged; no background-audio mode or sensitive-content entitlement was added.
- Production CloudKit deployment added only JourneyEdit with eight application fields (14 including system fields), zero indexes, and new-type role entries matching existing types. Removed the UI's automatic public-create grant before deployment. Existing types/records were not modified. The console confirmed deployment and production readback lists JourneyEdit.
- Release evidence is cached in root `.cache/stories-native-release/`, including `ipa-verification-22.json`, `apple-build22.json`, native logs and the source manifest. Hardware behavior remains unverified until the physical acceptance checks below are performed.

## What is connected

| Feature | Entry point | Access | Behavior |
| --- | --- | --- | --- |
| Journey Studio | Journey detail → Trim & split | JourneyDeck Plus | Drag either trim edge or a split handle, preview the actual route and totals, then explicitly save. Removed route sections dissolve into soft smoke. Original recordings remain recoverable. |
| Automatic Photo Matching | Memory detail → Find matching photos | Everyone | Scan permitted Photos metadata for that Memory's journeys, review timestamp/location suggestions, select photos, then import private copies. |
| Your Year on the Road | Statistics → Your Year on the Road | JourneyDeck Plus | Eight animated chapters drawn from the local archive, year selection, optional original music/chimes, and a separate recap appearance chooser. |

Each feature uses the active Cinematic Dark, Warm Ivory, Rosewater or Grand Touring palette and supports phone/tablet layouts. The recap initially matches the app; choosing another recap appearance does not change the app's saved theme. Native verified StoreKit membership remains the entitlement source. Restoring an original edited journey stays available after membership expiry.

## Interaction and implementation choices

The editor uses core React Native gesture/animation APIs, the existing MapLibre map, and the installed Skia renderer for bounded blurred particles. Drag feedback uses sampled geometry; exact original GPS data is used for review/save. This avoids adding another gesture framework or a new module-level Reanimated worklet. The route can be previewed without map tiles through a local silhouette fallback. Motion effects stop on background/close and respect Reduce Motion; handles also have accessible ten-second adjustment controls.

The recap adds Expo SDK 57's `expo-audio` and two original synthesized audio assets. Sound is explicitly opt-in, pauses on background/close, and is unavailable while the recorder owns the audio session. Existing provider song history supplies recap facts/artwork; the feature does not copy or play commercial provider recordings. Audio player options also avoid Expo deactivating the shared session behind the native Shazam engine.

Official APIs reviewed: [Skia path trimming](https://shopify.github.io/react-native-skia/docs/shapes/path/), [Skia blur masks](https://shopify.github.io/react-native-skia/docs/mask-filters/), [React Native Animated](https://reactnative.dev/docs/animated), and [Expo SDK 57 Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/). Installed package/native source was checked alongside these references.

## Photos permissions and limits

Matching requires Photos read access, requested only after the user chooses Find matching photos. Full and limited-library authorization are supported. Reading an allowed photo's saved GPS metadata does not require a new live Location permission. The app's existing manual song-recognition microphone purpose remains intact; recap playback adds no microphone request or background-audio capability.

A local Expo PhotoKit module performs bounded scans and revalidates permission and asset visibility after asynchronous work. Matching uses the latest 30 journeys in the Memory, at most 400 photo candidates, time padding of 30 minutes and a 600-meter route tolerance. Photos with missing GPS may be suggested as time-only matches; GPS that disagrees with the route is rejected. Review/import is limited to 24 selected photos per batch. iCloud-only image files must first be downloaded in Photos. Limits and unavailable images are disclosed in the UI.

Sensitive-content support is conditional: the bridge can use Apple's on-device nudity detector when its capability and system policy permit it. No entitlement/provisioning change was made here, so **the normal fallback is time/location matching with manual review**, not a guarantee that sensitive content has been removed. Flagged images cannot be previewed/imported when detection is enabled. See the [Photo Matching acceptance report](automatic-photo-matching-2026-09-07.md) for permissions, privacy and device cases.

Selected photos are rendered into bounded JPEG copies without original EXIF/GPS or source filenames. Imports use owner/Memory-scoped deduplication, reject stale profile or deleted Memory writes, and preserve successful imports during a partial retry. Selected copies use the existing private Memory/iCloud storage path. Matching itself does not upload library metadata or photos to a recommendation service.

## Original data and release compatibility

Editing is additive schema 7. An immutable operation retains the original summary, GPS and music; one SQLite transaction updates visible journey parts, song associations and Memory links. Competing edits remain recoverable, and the UI offers an explicit conflict choice. A stale preview, active recording, wrong profile or failed transaction cannot silently replace the archive. Trimmed songs remain in listening history. Editor-managed projections take precedence over old cached originals and ordinary sync records.

The source targets public runtime `2.0.0-watch.3` and preview `2.0.0-preview.8`. **Native Build22 contains this combined feature set.** Do not publish it to Build19's `2.0.0-watch.2` or roll schema7 back to a schema-6 bundle. PhotoKit/audio code and the revised CloudKit transport are compiled into Build22.

Editor operations use a separate private CloudKit zone so older clients do not receive an unknown record type. The new `JourneyEdit` production schema is deployed and verified. Old builds display their previous ordinary journey views and cannot delete the new editor zone; upgrade participating devices for consistent edit and account-deletion behavior. Full data contracts and acceptance requirements are in the [editor persistence report](journey-editor-data-2026-09-07.md).

## Verification

- The combined mobile suite passes **428/428** with no failures/skips; TypeScript passes. The focused editor/private-sync/schema/cloud suite passes **42/42**. Final export evidence is recorded in `.ai/HANDOFF.md`.
- Editor tests execute production persistence against SQLite, including rollback injection, stale/paid/recording/profile guards, split/restore, later songs, private sync conflicts and async upload races. Mounted UI tests exercise drag deltas, theme changes, explicit review and duplicate-save prevention.
- Photo tests exercise actual matching/review code, permission rejection, limited capability fallback, partial retries and background/identity cancellation. Integration tests cover private import cleanup and legacy-cache isolation.
- Recap tests exercise year boundaries, complete-archive counts, coherent SQLite snapshots, bounded route reads, mounted phone/tablet chapters, theme selection, accessibility/lifecycle and audio release. Bundled PCM assets are checked against their deterministic source.
- Local production iOS Hermes export passes. Native config introspection verifies runtime/Photos/microphone/background configuration. Autolinking discovers both Expo Audio and the local PhotoKit module.

Native compilation and signed-package inspection passed in Build22. Appearance, frame rate, PhotoKit behavior, audio quality and real two-device CloudKit/purchase behavior still require physical-device acceptance; automated tests and Apple processing do not prove those behaviors.

## Physical acceptance before release

1. Install the new build over Build 19 with an existing library. Confirm all original journeys, photos, themes, profiles, purchases and prior fixes remain intact.
2. On iPhone and iPad portrait/landscape/Split View, test all four themes, large text, VoiceOver and Reduce Motion. Drag both trim edges in both directions, split repeatedly, review/save/restore, and inspect smoke/frame rate on long routes.
3. Exercise free/Plus/purchase/restore/expiry paths. Confirm only editor changes and recap access are paywalled; Photo Matching and original restoration remain available.
4. Test Photos full/limited/denied/revoked access, hidden/screenshots, HEIC/orientation, missing GPS, iCloud-only photos, partial import failures and repeat scans. Optional sensitive-content capability requires its own provisioning and Apple test-content acceptance.
5. Test recap sound levels, looping, headphones/Bluetooth, calls, background/close and simultaneous Watch recording. Confirm recorder/Shazam ownership is preserved.
6. Test two-device offline/concurrent edits, conflict resolution, iCloud quota/network failures, complete account deletion and old/new-client compatibility. Production `JourneyEdit` schema is verified; end-to-end sync remains a device test.

The [Year on the Road report](year-on-road-2026-09-07.md) contains chapter, calculation and audio details. Prior unresolved release checks remain in the [reliability audit](release-reliability-audit-2026-09-07.md).
