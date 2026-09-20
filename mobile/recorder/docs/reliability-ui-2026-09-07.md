# Interaction reliability audit — September 7, 2026

Reviewed `app-theme.tsx`, `app-icon-preference.tsx`, `app-icon-picker.tsx`, `ipad-memories-screen.tsx`, `ipad-settings-screen.tsx`, `settings-scroll-view.tsx`, and `native-navigation.tsx` in the existing dirty working tree. No native module, dependency, runtime, artwork or build changes.

## Confirmed and fixed

1. **A delayed Memory drop could save after its workspace unmounted.** The card's fade animation queues `finish` back on JavaScript. Cleanup previously removed listeners but left the shared drag source intact, so a queued finish still called `onAdd` or `onCreate` through the old component. Added a deferred-animation harness that unmounts before running completion; it reproduced an unintended append and create. Cleanup now invalidates all drag state; begin/finish/add also check the mounted workspace. An already-started save remains the persistence layer's responsibility; late UI alerts/state updates are suppressed. This prevents a delayed gesture from starting new work after profile/workspace replacement.
2. **A stale tray responder could overwrite the current measured layout.** Holding the grabber, resizing the root, then delivering the old responder's move/release restored a 244.8pt old detent over the new 130pt detent in the handler harness. Tray interaction now cancels and settles on root/window/focus/busy changes and backgrounding; obsolete move/release callbacks are ignored. The same test passes, including a queued release after backgrounding. Production iPhone is portrait-locked: this demonstrates the resize/keyboard geometry defect in actual handlers, not an observed physical iPhone landscape failure.

Runtime edits are confined to `src/ipad-memories-screen.tsx`. The device-proven React Native `PanResponder` tray and existing card Reanimated gestures remain in use. No new worklet architecture was introduced. `tests/ipad-memories.test.mts` now defers animation callbacks for lifecycle coverage and checks selection/search retention through all four themes on phone and tablet presentations.

## Verified behavior

- The theme provider saves before switching, retains the old selection after a failed SecureStore write, restores persisted IDs, and does not key/remount children. Existing executable test changes all four themes with a live child state intact.
- The independent icon provider reconciles iOS's current icon, serializes repeated taps, rejects unapplied native choices, and retains the applied selection if only the preference write fails. Its existing executable test retains child mounts. No membership or theme switch implicitly changes the app icon.
- Memory selection/search and both scroll hosts survive resizing, tray collapse/expand, and all four theme presentations. Busy writes are guarded; failed saves retain the selected journeys for retry. Frame loops stop on cleanup. Existing drop tests exercise append/create, self-drop rejection, background/focus cancellation and narrow-window autoscroll.
- Settings phone category actions and iPad split-panel actions remain wired. The viewport test keeps an unsaved child draft across appearance updates. Native tab/stack tests retain route keys and one Home recorder lifecycle, preserve drafts during tab changes, and use native safe-area measurements for portrait/landscape iPad labels. These are React/Router handler tests, not UIKit rendering tests.

## Verification

- Before Memory lifecycle fixes: focused Memories suite **5 passed / 2 failed**, with both new reproductions failing against the pre-fix code.
- After fixes: `node --experimental-strip-types --test tests/ipad-memories.test.mts tests/app-icon-preference.test.mts tests/premium-themes.test.mts tests/ipad-settings.test.mts tests/native-navigation.test.mts` — **22 passed, 0 failed**.
- Root audit owns aggregate TypeScript and full-suite results. No Expo export, OTA or build was run for this work.

## Device acceptance still required

- iPhone grabber follows the finger and settles smoothly with Reduce Motion on/off; open/close the keyboard and background/foreground midway through a pull.
- iPad portrait/landscape, Split View/Stage Manager resizing, sidebar changes and larger text retain active searches and selections; card hit testing/autoscroll matches what is visible.
- Start a card drop, then immediately leave the workspace or change the active local profile; verify no late editor or unintended Memory update.
- During recording, change every theme and select an independent icon; verify recording remains active, the OS icon is correct, and iOS confirmation/relaunch behavior is acceptable.
- Navigate Settings categories and profile/place editors with the keyboard, VoiceOver and large text. Pixel layout, scroll offsets, native focus and gesture smoothness require actual iPhone/iPad acceptance.

No physical-device gesture or OS icon operation was performed in this audit, and the passing mocks do not certify frame rate or UIKit behavior.
