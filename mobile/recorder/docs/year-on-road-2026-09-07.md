# Your Year on the Road

Implemented as a standalone, local-first JourneyDeck Plus story viewer. This work does not publish an OTA or create a native build.

## Product behavior

- Eight chapters: introduction; total miles/time; monthly and daypart rhythm; longest journey; top artists; most-played songs; Memories containing that year's journeys; closing overview.
- Full-screen iPhone presentation and iPad side-by-side chapter compositions, with vertical scrolling when content or larger text needs more room. Safe-area controls include Close, year, recap appearance, soundtrack, sound, chapter progress, Previous, Play/Pause and Next/Replay.
- Playback is opt-in. Each chapter lasts ten seconds during playback; touching/scrolling the story holds its place while the soundtrack continues without interruption. Explicit navigation also works without autoplay. Entering the background pauses the story and audio; foregrounding does not unexpectedly restart them.
- The story initially follows app appearance. The viewer's four-theme chooser and “Match app appearance” operate only on local component state. Closing discards this recap-only choice and never writes the app theme preference.
- The original soundtrack initially follows the recap appearance. Its separate four-score picker can override that pairing, and “Match recap appearance” restores automatic pairing. Closing discards this recap-only music choice.
- Grand Touring uses the approved existing sporty artwork; Rosewater, Warm Ivory and Cinematic Dark use their existing theme artwork. User album artwork and available local Memory cover photos add personal compositions. Missing images fall back to theme artwork/music symbols.
- Free access shows a Plus introduction and an Unlock callback. Empty years show an honest empty state and year chooser.

## Data contract and meanings

`YearOnRoadViewer` is exported from `src/year-on-road.tsx`. Props are `visible`, `data: YearOnRoadData`, `appTheme`, `premium`, `onClose`, `onUnlock`, optional `initialYear`, `soundAllowed` and `soundUnavailableReason`.

The caller supplies the complete local visible archive, full journey-linked song observations and Memory memberships with optional resolved local cover-photo URIs. The viewer does not fetch a provider feed, mutate SQLite, sync, upload or export. The root integration owns this read path and the Statistics entry point.

`buildYearOnRoadRecap` is a pure model. A calendar year uses local journey-start time, including journeys crossing midnight/New Year. Current year is labeled “so far”; future or invalid starts are excluded. Repeated journey IDs are counted once, while distinct IDs at the same time remain distinct. Journeys with invalid/missing distance or duration add no fabricated measurement. Duration coverage is disclosed.

Song totals include only observations associated with a selected journey. Durable IDs and timestamp/title/artist identity remove repeated pages and matching cross-provider observations. Untimed observations require an ID. Unlinked provider history and future plays are excluded. Track-duration totals explicitly describe **known track durations, not measured listening time**. Missing duration metadata is disclosed rather than imputed. Music stays associated with its journey-start year.

Memory totals count unique Memories containing at least one selected-year journey; per-Memory counts show only those journeys. The route drawing is a bounded, private on-screen silhouette of actual available points, with antimeridian handling. If geometry is missing, a labeled decorative road is shown. No public share/export is implemented, so no raw route is transmitted by this feature.

## Motion and sound

The implementation uses installed React Native `Animated` and `react-native-svg`, without introducing worklets or eager Reanimated/Skia runtime initialization. Ambient shapes, artwork drift, chapter entry, record rotation, album/photo fans and chart transforms use native-driven opacity/transforms. The bounded route reveal and chapter-progress width use scoped JS animation. Counter timers run only during a short reveal. Pause/hold/background settles short reveals to their final values and stops their timers; ambient loops and progress stop. Component cleanup stops loops/timers.

Reduce Motion is respected from the first frame (static until the platform answers). It disables ambient movement and replaces reveal/counter animation with immediate values. Screen-reader users start paused, and a screen-reader activation pauses the story. Controls remain explicitly labeled and usable with manual navigation.

The four bundled theme scores are **“Midnight Velocity”** (Cinematic Dark, 116 BPM), **“Sunlit Coast”** (Warm Ivory, 108 BPM), **“Champagne Apex”** (Grand Touring, 124 BPM), and **“Petal Rush”** (Rosewater, 120 BPM). The scores and chapter chime are original oscillator synthesis, with no third-party recording or sampled music. Source is retained in `src/year-on-road-score.ts`. Each looping score is about 23–27 seconds, mono 22,050 Hz, 16-bit PCM; the accent is 0.65 seconds. All five assets are deterministic and checked byte-for-byte against the renderer. This is separate from the user's Apple Music/Last.fm listening history; no provider music is copied or played.

`expo-audio` is lazily required only after the user enables Sound. A binary without its native module keeps the recap readable and reports sound unavailable. Player creation, live score replacement, pending setup cancellation, pause/mute, chapter cues and release are covered by behavioral hook tests. Replacing a score preserves the chapter-chime player and starts the new loop before releasing the old loop. The audio session mixes with other playback and does not request recording/background playback. Root owns SDK-compatible package/plugin changes.

The `soundAllowed` integration gate disables recap audio while recording/Shazam owns the audio session. Both players explicitly use `keepAudioSessionActive: true`: Expo Audio 57's default pause/completion path otherwise deactivates the shared iOS session after 100 ms, without knowing about JourneyDeck's native Shazam engine. Installed `AudioModule.swift`, `AudioPlayer.sharedObjectWillRelease`, and `AudioComponentRegistry` were traced: the selected option suppresses that deactivation, while `.release()` tears down each player/observer and removes it from the registry without shutting down Shazam's session. Pause errors do not skip release. Real device checks must still cover simultaneous Watch Start and media interruptions.

Official references consulted: [Expo SDK 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/), [Expo SDK 57 Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), [React Native Animated](https://reactnative.dev/docs/animated). Installed Expo Audio 57 source was checked for `createAudioPlayer`, audio mode and shared-object release semantics.

## Verification and remaining checks

- `tests/year-on-road.test.mts`: 11 executable tests covering year/leap-day boundaries, duplicate pages, invalid measurements, music deduplication/duration gaps, New Year song association, Memory membership, large routes and original PCM assets.
- `tests/year-on-road-audio.test.mts`: 6 tests for opt-in-only loading, Shazam-safe player options, pause/mute/release, old-native fallback, cancellation during asynchronous setup, release after a failed native pause and live score replacement.
- `tests/year-on-road-viewer.test.mts`: 6 mounted React tests covering the premium gate, invisible lifecycle, independent theme/reopen, independent soundtrack selection, uninterrupted touch/scroll audio, playback navigation/background pause, sound guard and all eight chapters at phone/tablet widths.
- `npm run typecheck` passed after initial source integration. Root owns the combined final suite and local JS/Hermes export.
- All thirteen assigned subsystem scripts passed individually after final recap changes: `test:tab-runtime`, `test:local-store`, `test:local-atlas`, `test:privacy-masker`, `test:local-atlas-client`, `test:cloudflare-workers`, `test:auth`, `test:recovery`, `test:sync-status`, `test:music-observations`, `test:drive-detection`, `test:navigation-motion`, and `test:native-capabilities`.

These tests run real model/hook/component code with mocked native UI/audio boundaries; they do **not** prove physical layout, frame rate, audible quality or UIKit presentation. Still check iPhone small/large text, iPad portrait/landscape and rotation, all four themes, local/missing Memory covers, long titles, VoiceOver, Reduce Motion, sound levels and seamless looping, Bluetooth/headphone disconnect, phone calls, background/close, rapid Watch recording start and the premium purchase/restore return path. Audio needs a future authorized native build containing Expo Audio; no such build is performed here.
