# JourneyDeck V3 — iPhone Duo validation matrix

Use this checklist when the iOS 27.1 SDK and an iPhone Duo simulator or DeviceHub target are available. Runtime layout decisions must continue to use the reported window, size classes, safe areas, and reserved display regions; do not add model-name checks or hard-coded hinge coordinates.

## Build gate

- Build the V3 iOS app with the iOS 27.1 SDK.
- Confirm the native display observer compiles and returns live size classes, division regions, and occlusion regions.
- Run the automated test suite and an iOS export before device validation.
- Test with an existing local archive and a new empty profile while offline.

## Core configurations

| Configuration | Expected presentation | Primary checks |
| --- | --- | --- |
| Closed, outer display | Compact, one screen | Native five-tab rail on the trailing/right edge, single-column content, no stale inner-display spacing |
| Open book, landscape | Regular, two physical panes | Native five-tab rail remains on the trailing/right edge, no content beneath the center division, logical leading/trailing order |
| Open book, portrait | Continuous vertical experience | Tab bar unless the live environment supports a useful sidebar, no forced left/right split across a horizontal division |
| Partially open or resized | Derived from current geometry | No model-specific assumptions, clipping, duplicate navigation, or blank pane |

Repeat each configuration in light, dark, Sakura, and Redline appearances where practical.

## Transition continuity

Start each action while closed, open the device without leaving the screen, interact while open, then close it again.

| Surface | State that must survive | Open-book layout check |
| --- | --- | --- |
| Home | Active recording, recorder draft/state, vertical scroll position | Recorder controls remain in one pane; metrics, Memories, and Soundtracks do not cross the division |
| Soundtracks | Current selection and scroll position | Library and intelligence columns remain inside their physical panes |
| Statistics | Selected range, selected day, calendar month, scroll position | Calendar/detail and analysis cards use the two panes; large text reflows within each pane |
| Atlas | Selected time window, selected place, map camera/gesture state, scroll position | Intelligence and map/library remain separate; the map does not remount |
| Memory Studio | Search/filter/selection state and any in-progress editor draft | Library and builder remain separate; the editor is not dismissed |
| Settings | Current destination and unsaved editor fields | Sidebar and editor remain separate; focus and keyboard state remain usable |
| Memory detail | Open Memory, scroll position, photo action state | Story/media and related journeys remain in separate panes |
| Journey detail | Open journey, selected soundtrack item, map camera, scroll position | Hero/map and story/actions remain in separate panes |

Any navigation reset, duplicate screen, stopped recording, discarded draft, map reset, or jump to the top is a failure.

## Accessibility and localization

- Test default text plus the largest Accessibility text sizes. Labels must wrap or reduce columns without clipping, truncating essential values, or entering a reserved region.
- Test VoiceOver reading order, headings, tabs, selected states, buttons, map alternatives, and focus continuity during a pose change.
- Test Reduce Motion and Reduce Transparency.
- Test a right-to-left language. Logical leading content should move to the right pane, trailing content to the left pane, while maps, media, numbers, and route direction remain semantically correct.
- Test hardware and software keyboards in Settings and Memory editors. Opening or closing must not dismiss the draft or strand focus behind the keyboard.

## Safe-area and display-region audit

For every major screen and presented sheet:

- No text, button, map control, refresh indicator, sheet control, or important artwork may sit beneath a hinge, camera opening, sensor region, rounded corner, or home indicator.
- Decorative backgrounds may span the full window, but interactive and essential content must avoid reported occlusions.
- A vertical division creates two physical content columns. A horizontal division must not accidentally invoke the vertical-column layout.
- Navigation must remain singular. On iPhone Duo, UIKit owns the trailing/right-edge vertical tab rail on the outer display and open landscape; inner portrait uses the standard horizontal placement. `sidebarAdaptable` remains reserved for iPad's separate leading-edge sidebar.

## Evidence to capture

For each failure, record the configuration, appearance, text size, language direction, screen, transition direction, screenshot or short recording, and the reported window/safe-area/division/occlusion geometry. Re-run the exact row after a fix and keep the before/after evidence with the V3 release notes.

## Exit criteria

Duo support is ready only when the build gate passes, every major screen clears the closed/open/closed continuity checks, the accessibility and RTL passes have no blocking issues, and no runtime branch depends on the device marketing name.
