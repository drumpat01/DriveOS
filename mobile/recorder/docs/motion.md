# JourneyDeck motion foundation

## Replay stage and Memory editing

September 15 overlap correction: the overview song/start/end card and Relive
button share one bottom-anchored vertical stack with a 10pt gap. Each keeps its
intrinsic height so larger text or a wrapped button cannot cover the card.
The transparent stack passes map touches through its empty space. Starting
replay replaces the whole stack with the existing replay stage.

The September 10 replay revision presents a prominent Relive this journey action and a one-minute story rate alongside 1x/4x/12x. `JourneyReplayStage` keeps the active media/stop/arrival card, transport and accessible progress rail directly over the map. The position puck pulses only during active animated playback; the upcoming route dims. Camera padding follows stage measurement so large text does not hide the moving marker; Reduce Motion uses the overview. State is still driven by saved timestamps, and earlier untimed photos are not assigned fake timestamps.

`MemoryJourneyEditor` divides draft membership into an ordered selected collection and remaining choices, using 260-ms entry/layout and 150-ms exit. Native persistence remains in the shell. `MemorySaveLabel` shows a check for 1.2 seconds only after a successful save; pending and failed saves never show success. Shared motion/background preferences disable animation. Accepted Memory/Atlas opening transitions remain untouched. Full 524 tests, TypeScript and iOS export pass; native feel remains a device acceptance check.


## Journey replay reveals

September 15 smoothing: `JourneyReplayMarker` uses Reanimated animated native
MapLibre props to interpolate the displayed replay timestamp on the UI thread.
The marker follows each saved segment, including corners within a single replay
tick; the snapshot lookup uses a binary search for long journeys. React's media,
telemetry and route-trace updates remain at 100ms. The marker and linear native
chase-camera transitions share that 100ms window (one tick of presentation lag),
instead of the marker jumping to each tick while the camera trails it by 110ms.
Pause, seek and Reduce Motion set an immediate position and cancel the tween;
blur/background still stop the replay. Recorded geometry/timestamps are unchanged.
Tests and iOS export pass; physical iPhone/iPad smoothness remains to be checked
at 1x/4x/12x/Story, around turns/stops, and after gestures, pause/resume and seeks.

`interactive-route-map.tsx` retains its recorded-route tracing and moving marker. Starting playback or scrubbing activates chronological marker reveals; overview still exposes the full soundtrack. Stops use stationary recorded breadcrumbs (60 seconds within 30 m; gaps above 90 seconds break a stop). Song and photo cards enter over 260 ms; Reduce Motion removes those entrances and automatic chase-camera movement. Scrubbing/restarting recomputes reached moments and pauses playback; route blur/background also pause. VoiceOver can adjust progress in five-percent increments.

Selected Photo Matching imports retain capture timing in device-only, profile-scoped cache. Replay displays only associated local photos with valid capture timestamps inside the journey; unknown import dates are not treated as capture dates. Re-matching an existing photo backfills its timing. Native rendering acceptance is pending; 515 full tests, TypeScript and iOS export pass.


## Shared touch feedback — September 9, 2026

- `src/touch-feedback.tsx` provides `TouchPressable`, `SlidingSelection`, and `ExpandingSection`. TouchPressable forwards the native ref, accessibility, disabled state and press handlers; its existing visual styles compress to .97 and release over the shared 120-ms feedback duration. Native cancellation never schedules an action. Shared Reduce Motion/background preferences settle transforms immediately.
- Applied to phone Home actions and Settings, iPad Home/Settings, both Soundtracks layouts, shared Statistics, and vehicle/place controls. Existing JourneyCard spring feedback, AlbumCarousel depth/press, Memory Flip, Atlas Flip, native menus and route transitions retain their own established paths.
- Statistics ranges, iPad Settings categories, and vehicle tabs use one measured background that changes position and dimensions over 260 ms. Measurement supports wrapping, unequal widths and text size changes; interrupted changes retarget the current frame. Phone range sizing now belongs to the measured item wrapper.
- Advanced Support on phone/iPad and expanded place details animate measured content height over 260 ms, moving following controls continuously. Collapsed contents are clipped, noninteractive and excluded from accessibility. Content stays mounted for measurement; use only for lightweight detail content without mount-triggered work.
- Four mounted shared-control tests cover cancellation/disabled behavior, Reduce Motion/background settling, wrapped selection geometry/rapid retargeting, and expansion reversal/content remeasurement. Existing screen tests preserve actions, range gating and layout behavior. Full 510 tests, TypeScript and preview iOS export pass; native feel, VoiceOver and large text acceptance remain pending. Source only; no OTA published for this change.


JourneyDeck motion clarifies state and hierarchy without competing with journey content. Use `src/motion.ts` and `src/haptics.ts` instead of adding screen-local timing values, accessibility listeners, AppState listeners, or direct haptic calls.

- Use the shared duration, delay, easing, and spring tokens for new motion.
- `useMotionPreferences()` is the shared live source for Reduce Motion and app activity. It fails closed until the OS preference resolves.
- `useAmbientSharedValueLoop()` cancels and settles indefinite Reanimated work when Reduce Motion turns on, the app backgrounds, the caller disables it, or the component unmounts.
- `useSettleWhenAppInactive()` is for timer- or handle-based motion that must stop when JourneyDeck backgrounds.
- Use semantic haptics (`selection`, `softImpact`, `primaryAction`, `success`, `warning`, `error`). Haptics reinforce visible state and are never the only feedback.
- Do not animate recording or safety state as decorative ambient motion. Do not run off-screen loops, per-frame React state updates, or expensive canvases in virtualized rows.

## Statistics data transitions — source implemented, device check pending

`src/statistics-motion.tsx` supplies the shared phone/iPad Statistics screen with rolling formatted totals, bottom-anchored daily/hourly bars, left-anchored distance bands, morphing metric sparklines, and selected-day journey reveals/reflow. It borrows Atlas Flip's `Easing.bezier(0.77, 0, 0.175, 1)` for on-screen geometry and uses the shared everyday `standard` duration (260 ms). It does not modify the accepted flips or use their longer opening/closing timings for data changes.

- Keep existing chart instances and date keys. Shared values retarget their current displayed positions when a range changes mid-animation. Initial data appears immediately; returning to the tab does not replay it.
- Sparkline targets contain the exact latest 90 daily vertices, padded with repeated endpoints to maintain the same 180-number vector topology across ranges. Do not resample away peaks/zeros or animate incompatible point counts. Geometry helpers live in `src/statistics-motion-model.ts`.
- Rolling digits use measured native text heights and tabular numerals; localized formatting and units remain in React. Only transforms/SVG props run per frame on the UI runtime. VoiceOver receives the final formatted value once, with the decorative digit strips hidden from accessibility.
- Selected-day content uses native layout transitions and a short 8-point entrance. Old links are removed immediately; no delayed/stale navigation callbacks or fixed journey-panel height. Range/day selections use one shared semantic haptic when the selection actually changes.
- Shared values cancel and settle on Reduce Motion, backgrounding, tab blur, and unmount. Layout/entrance builders are disabled while motion is unavailable. Existing history entitlements, data calculations, themes, refresh and navigation remain in place.
- Verification: `tests/statistics-motion.test.mts` exercises geometry, interruption, measured digits, accessibility, preference/focus changes, empty-day/return reveals and real screen actions; `tests/ipad-statistics.test.mts` retains all-theme and responsive layout checks. TypeScript, 500/500 mobile tests and the local preview iOS Hermes export passed September 9, 2026.
- Published to iOS V2 preview September 9, 2026: group `6f28d092-2114-4245-9e8a-0fffa7ac0328`, update `01a088e7-3bd6-7008-8ed5-b43a7e7b7688`, runtime `2.0.0-preview.8`. Native acceptance is pending: try rapid 7D/30D/90D/All changes, calendar and daily-bar selection, empty/dense days, More journeys, large text, rotation, Reduce Motion and background/return on iPhone/iPad.

## Soundtracks album depth — source implemented, device check pending

`src/album-carousel.tsx` replaces the phone album strip and iPad recent-song grid with a shared horizontal virtualized carousel. Each item snaps to the viewport center, including the first and last. Cover size uses the measured panel width (62%, capped at 220 points) with a 16-point item gap; no fixed caption height.

- A UI-thread scroll value drives bounded depth directly: centered cover scale 1/lift -8, immediate neighbors scale .93/lift 0/7-degree inward turn; farther covers stop at scale .86/lift 8/14 degrees. No automatic playback, timer or ambient loop. Stable native scrolling supplies momentum and snapping.
- A separate inner transform compresses the card to .97 over the shared 120-ms feedback duration on press-in and returns on press-out. Native Pressable handles cancellation; only a committed enabled press opens the existing track destination, without a delayed callback. Captions, theme colors, cached artwork and a failed/missing-art fallback stay attached to the cover.
- Shared motion preferences and route focus disable depth and press transitions for Reduce Motion/background/blur. Rotation and refreshed entries preserve the centered track by stable identity, clamping when it disappears. All recent entries are available through virtualization instead of iPad gallery paging; listening-history paging is unchanged.
- `tests/album-carousel.test.mts` checks actual mounted scroll/press handling, first/last geometry, interruption/cancellation, rotation/refresh, themes, missing art and disabled sources. Existing iPad tests cover music-opening and journey callbacks. Published to iOS V2 preview September 9, 2026: group `9747587c-fb37-46cc-9160-3879963c9c6c`, update `01a088fd-c0db-7f85-b32e-bc0e6b402602`, runtime `2.0.0-preview.8`. Native feel/large text/VoiceOver/swipe-versus-vertical-scroll checks remain pending.

## Atlas Flip — approved reusable card expansion

The user approved the Driving Rhythms animation on their iPhone on September 9, 2026 ("yes finally!") and explicitly requested preserving it for repeated reuse. Refer to this pattern as **Atlas Flip** or **the Driving Rhythms flip**. This is the canonical baseline when the user requests the same widget-to-expanded-details interaction. Apply it to additional widgets when requested; this approval is not a blanket rollout.

The card lifts from its exact position, grows and flips to reveal its complete expanded reverse face. Closing smoothly reverses the same path to the original widget. The chart and details travel with the card. There is no white tap flash, rectangular haze, late content fade, or end-of-animation jump in the user-approved result.

### Reference and provenance

- Implementation: `src/primary-sections.tsx`, functions `DrivingRhythmsCard`, `DrivingRhythmsCompactFace`, and `DrivingRhythmsExpanded`, plus `ATLAS_RHYTHM_MORPH_EASING` and the `atlasRhythm*` styles.
- Regression coverage: `tests/atlas-rhythm-transition.test.mts` (mounted lifecycle, layer boundary, geometry, all four themes, and Reduce Motion).
- Accepted iOS OTA: `01a08811-7731-7aab-9890-35e8a61968f2`, group `4d0924ae-eb06-40c3-b25f-1ec1e0f87550`, `v2-preview`, runtime `2.0.0-preview.8`, message `Restore Rhythm flip and isolate backdrop`.
- Rejected predecessor: `01a08802-1003-79fe-b979-81a0d0134c02`. Do not use that version as the reference.

### Preserve these mechanics

1. Measure the actual source with `measureInWindow`; retain a native measurable source (`collapsable={false}`). Validate finite, positive dimensions and guard duplicate taps.
2. Present a transparent, non-animating React Native `Modal`. Keep the original widget visible until `Modal.onShow` confirms that its replacement is presented. Start the Reanimated progress and one `haptics.softImpact()` there, once. Starting on component mount or hiding the source immediately at tap exposed the page beneath it and caused a white flash.
3. Keep the backdrop outside a separate, untransformed native foreground `View`. That foreground MUST have `collapsable={false}`, absolute-fill bounds, and `zIndex: 1`. Both rotating faces belong inside it. The native boundary keeps the backdrop from intersecting the receding half of the rotated card; a layout-only wrapper can be removed by Fabric and reintroduce the rectangular haze.
4. Use one shared UI-thread progress value from 0 to 1. Both faces share the same interpolated center and displayed width/height throughout. The front starts at the measured source bounds and scales toward the target; the reverse starts at target layout bounds with inverse source/target scales. Preserve transform order: perspective, translation X/Y, rotation Y, scale X/Y.
5. Preserve the full compact appearance (gradient, bars, typography, SF Symbol) and full expanded contents. The moving compact duplicate suppresses only its extra `NeonWidgetOutline`; the resting widget keeps its normal outline. Keep the expanded chart inside the rotating reverse face.
6. Close by driving that same progress back to 0. Guard duplicate dismissal, restore the source with modal teardown after completion via `scheduleOnRN`, and cancel on unmount. Do not restart or replace the motion at its endpoints.

### Exact approved values

| Parameter | Value |
| --- | --- |
| Open / close | 650 ms / 520 ms |
| Curve, both directions | `Easing.bezier(0.77, 0, 0.175, 1)` |
| Perspective | 900 |
| Front Y rotation | 0 to 180 degrees |
| Reverse Y rotation | -180 to 0 degrees |
| Front opacity | progress `[0, 0.46, 0.54]` → `[1, 1, 0]`, clamped |
| Reverse opacity | progress `[0, 0.46, 0.54, 1]` → `[0, 0, 1, 1]`, clamped |
| Back faces | `backfaceVisibility: 'hidden'` |
| Backdrop opacity | progress `[0, 0.35, 1]` → `[0, 0.7, 0.78]` |
| Backdrop base color | themed `#08050dcc`, isolated behind the foreground |
| Reduce Motion | 180 ms open / 150 ms close; no rotating front, reverse opacity with gentle 0.96–1 scale |

These explicitly approved timings are an exception to generic shorter-duration guidance. Keep them when reusing this interaction. The Driving Rhythms target is centered within safe areas, up to 620 wide and 720 high, with 24 total horizontal margin. Content layout and target dimensions may be adapted for another widget without changing the shared trajectory or handoff rules. Use the active theme for each card; do not swap colors at tap.

### Reuse without repeating the failed attempts

When implementing the next requested widget, reuse or carefully extract the existing transition and provide its compact and expanded content. Preserve Driving Rhythms behavior during any extraction. Do not invent a new flip from scratch, introduce a placeholder rotating shell with detached details, switch `display` halfway through, remove gradients/icons, or add speculative rasterization to fix a layer-order issue. Earlier Skia/SVG tile diagnoses in historical handoff notes were unproven and are superseded by this approved implementation.

Run the transition regression tests and TypeScript checks after code changes. Verify source/target alignment, quick taps, opening/closing, theme appearance, and Reduce Motion for each new widget. The original widget has user device acceptance; a new widget or a refactor still needs its own device check. Saving this pattern does not itself require an OTA or native build.

### Memory full-screen adaptation — user accepted

The user confirmed the preview result on September 9, 2026: "Oh it worked!!! Everything looks so good" after group `003eaa50-29fd-48f5-a34d-aca2d5192a0c`. This accepts their tested Memory opening and resized Atlas experience; it does not certify every device/theme combination.

`src/memory-flip.tsx` adapts Atlas Flip for the user-requested Memory-card trial. It retains the same 650/520-ms curve, two-face geometry, isolated native foreground, and presentation/source handoff. The target is the entire current window, not the floating Driving Rhythms panel. Driving Rhythms' transition itself is not replaced.

- The front is a temporary **card-only** local snapshot so already-loaded user photos and typography do not disappear while a duplicate mounts. Nothing is uploaded or added to Photos; the capture is released after use, cancellation, failure, or a late abandoned result. This is source-image fidelity, not a workaround for the fixed backdrop-layer issue.
- The full existing Memory details travel inside the reverse face. Start waits for modal presentation and both images, then hides the original and fires one haptic. Press whitening and competing AppleZoom are disabled for Memory cards only; native context-menu actions remain.
- Once fully open, the native Memory route mounts underneath with no second entrance animation. The completed face stays until the actual route has laid out and displayed its hero. The temporary modal then dismisses; native edit/share/photo matching, nested journey navigation, and the normal edge-back interaction remain. The trial changes **opening**; it does not replace normal full-screen Memory back navigation with a reverse flip.
- Fixed window safe areas come from `DetailViewportProvider`. Rotation/backgrounding cancels obsolete geometry; capture/readiness timeouts prevent a stuck overlay. Reduce Motion uses the short fade/scale path.
- Tests: `tests/memory-flip.test.mts`, `tests/native-navigation.test.mts`, and existing Memory-detail/context-menu coverage. Phone/tablet dimensions and all four theme palettes are covered by code tests; additional devices and future changes still need native rendering/handoff checks.

Atlas's four insight cards now use identical unpadded grid cells and a shared height based on their tallest intrinsic content. The compact Driving Rhythms footer is pinned to the card bottom. Content measurements may grow or shrink with available width/text size; the moving duplicate cannot feed measurements back into the grid. The flip still measures the actual resized source on every tap.

### Public standalone reference

At the user's request, a separate MIT-licensed code/docs reference was published at https://github.com/drumpat01/Atlas-Flip (local `C:\Users\patri\Atlas-Flip`). It preserves the core trajectory and presentation/layer invariants with generic render props, a fictional Expo demo, regression tests, a GIF and a browser-playable recording. It is not imported by JourneyDeck and does not replace this app's accepted implementation. Its full-screen mode stays in a modal; Memory's snapshot/native-route handoff remains app-specific. Verify a standalone integration on a device before treating it as accepted.
