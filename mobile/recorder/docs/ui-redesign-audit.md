# JourneyDeck V3 UI audit and Home pilot

Status: design direction approved for exploration; no runtime UI changes yet.

This audit applies the Appllama mobile-design method to the current V3 implementation. It is based on the September 18, 2026 iPhone captures supplied by the owner, the checked-in runtime captures under `web/assets/beta/screens/`, and the current Expo/React Native implementation. Concept mockups and marketing compositions were not treated as evidence of the shipped UI.

## Decision

Use **Home** as the representative redesign surface and establish a shared visual language called **Cinematic Roadbook**.

Home is the correct pilot because one screen exercises every important part of JourneyDeck's UI system:

- the native five-tab shell;
- the primary recording action and its active states;
- scenic photography and theme treatment;
- editorial content, metrics, and collection progress;
- compact, medium, and wide widgets;
- light and dark premium themes;
- personalization and reorder behavior;
- empty, loading, error, and real-data states.

The redesign should be an evolution of the current product, not a new visual identity. Grand Touring already has a distinctive navy-and-gold voice, and Warm Ivory already provides a convincing light counterpart. The work is to make those systems calmer, more consistent, and more native.

## Shared system audit

### What is already strong

- The native tab bar is recognizable, legible, and stable across the five primary destinations.
- Real journey photography gives the product an emotional identity that generic dashboards do not have.
- Grand Touring's navy, warm gold, and cool secondary text form the clearest existing theme.
- SF Symbols and native navigation infrastructure are already present.
- Core actions are generally large enough to tap and have meaningful labels.
- Loading, error, empty, privacy, and membership states exist in the implementation instead of being deferred.
- iPad has dedicated layouts and a measured six-column grid rather than a stretched phone UI.
- The app communicates its local-first and private behavior in understandable product language.

### System-level findings

1. **Too many elements ask for equal attention.** Borders, glows, uppercase kickers, large radii, and accent-colored icons recur on nearly every card. The result is visually polished but insufficiently ranked.
2. **The token vocabulary is not constrained.** Across the audited primary-screen files there are 46 numeric radius values, 43 font sizes, more than 1,200 literal hex values, and 471 legacy `shadow*` declarations. Those counts include preserved legacy styles and chart primitives, but they still show that the system is being composed screen by screen rather than from a small shared vocabulary.
3. **Themes sometimes change more than color.** Grand Touring is cohesive; Warm Ivory mixes plum, purple, coral, and black as competing interactive accents. Theme selection should change atmosphere while preserving hierarchy and component meaning.
4. **Outlines are doing too much structural work.** Nearly every surface is framed. Hairlines should separate adjacent content; a border should not be the default way to make every component feel finished.
5. **Typography is expressive but over-specified.** Wide all-caps titles work as a JourneyDeck signature once per screen. Repeating all-caps kickers and many bespoke sizes inside every module weakens that signature.
6. **The visual system has several card dialects.** Neon widgets, quiet insets, glass cards, editorial heroes, settings rows, and theme-specific exceptions overlap. Four durable recipes are enough: action, story, metric, and list.
7. **The bottom bar can obscure the last visible module.** Current Home, Soundtracks, and Statistics captures show content sitting beneath the floating native bar. Scroll content should always have a final safe resting position fully above it.
8. **Phone root screens hand-roll titles and insets.** This supports the current photographic treatment, but it should remain a deliberate brand exception. Detail screens and ordinary utilities should continue using native navigation titles.

## Five-tab audit

### Home

Strengths:

- Recording is fixed above the reorderable content, so customization cannot hide the core job.
- The road photograph, theme palette, and native tab bar make the screen immediately recognizable.
- Wide, half-width, and story modules demonstrate a useful modular system.
- Grand Touring has strong contrast and a disciplined emotional tone.

Findings:

- The 50 States module can occupy most of the first viewport and outrank both the latest memory and the everyday recording task.
- The Customize control is visible at all times and competes with the primary action.
- Small metrics have the same framed-card emphasis as richer content.
- A half-width metric can be left alone in a row, creating a visibly unfinished grid.
- Warm Ivory uses a purple primary action and coral selected tab, splitting the interaction hierarchy.
- The latest memory can rest partially behind the tab bar in the current startup scroll position.

Direction:

- Keep the recorder fixed and keep widget customization.
- Give the first viewport one dominant action, one dominant story, and at most one supporting module.
- Move Customize into a header menu or a quiet edit affordance that appears after long-pressing the grid.
- Treat collection widgets such as 50 States as editorial modules, but cap their default height on phone and allow an expanded destination to carry the full map.
- Auto-pack the grid so a lone half-width metric becomes full-width or pairs with the next compatible metric.

### Memories

Strengths:

- The current Memory detail has the strongest narrative hierarchy in the app: image, title, context, helpful action, then related journeys.
- Real photos and route titles make saved data feel personal rather than analytical.
- The distinction between a Journey and a Memory is explained in the product.

Findings:

- The main tab combines gallery, search, filters, drag-and-drop studio behavior, creation, and journey browsing. That is a powerful tool but a heavy first encounter.
- Decorative outlines inside outlined containers can create double framing.
- Edit/studio behavior needs a clear mode boundary so browsing never feels draggable by accident.

Direction:

- Preserve the image-led narrative treatment as the model for JourneyDeck story surfaces.
- Default to browsing; make Studio an explicit mode with a native Done action.
- Use a native search presentation and one segmented choice for Memories versus Journeys.

### Soundtracks

Strengths:

- Album artwork gives the tab an immediate content focus.
- Today's soundtrack is correctly more prominent than aggregate metrics.
- The screen already includes real loading, error, empty, and provider-specific states.

Findings:

- The provider explanation precedes the content and consumes premium first-viewport space on every visit.
- Metric cards, panels, and charts repeat the same outlined/glowing treatment.
- The archive uses a controlled text input and a non-virtualized scroll hierarchy for content that can grow.
- The bottom tab bar overlaps the next panel in the current capture.

Direction:

- Move provider guidance to a one-time notice or an information sheet.
- Keep Today's soundtrack as the hero, then show a concise listening summary before the archive.
- Use integrated native search and virtualize growable history.

### Statistics

Strengths:

- The date scope, membership boundary, and metric meaning are explicit.
- Charts use real JourneyDeck data and visually relate to the corresponding metric.
- Atlas is discoverable from the primary analytics surface.

Findings:

- Four large outlined range buttons should be one native segmented control.
- The Atlas promotion and every metric card compete at nearly the same visual weight.
- Colored glows around each metric make the dashboard noisier without encoding additional state.
- Two-column cards become dense on a narrow phone and are vulnerable to larger Dynamic Type.

Direction:

- Lead with one plain-language summary, then the four core metrics.
- Reserve gold for selection and action; use chart colors only inside the charts.
- Allow metric cards to become a single column under larger text or narrow effective width.

### Settings

Strengths:

- The screen is structurally the most native of the five: clear rows, concise summaries, large targets, and predictable drill-in behavior.
- Account, Markers, and category navigation are understandable without explanation.
- Grand Touring is especially cohesive here.

Findings:

- Profile, Markers, and the category list use three related but different card treatments.
- Every row has both an outlined icon tile and an outer outlined group, adding visual weight without adding hierarchy.
- Markers is visually emphasized more than some higher-frequency settings categories.
- The selected tab, row arrows, icons, and borders all spend the gold accent simultaneously.

Direction:

- Use Settings as the native-behavior reference, not the visual-style reference.
- Consolidate the page into native-style sections: profile, featured capability, preferences, and account/support.
- Use the accent for the selected tab and primary/featured action; keep ordinary chevrons and icons neutral.

## Cinematic Roadbook visual language

### Product principle

**The road is the atmosphere; the user's history is the content; controls stay native.**

Photography may be immersive, but data and controls should sit on quiet, readable surfaces. A screen receives one signature title, one primary action, and one dominant content story. Everything else supports those three.

### Theme contract

Each theme supplies semantic roles rather than remapping arbitrary source colors:

- `page`
- `photoScrim`
- `surface`
- `surfaceRaised`
- `surfaceSelected`
- `text`
- `textSecondary`
- `separator`
- `accent`
- `onAccent`
- `success`, `warning`, and `destructive`

Grand Touring uses warm gold as its accent. Warm Ivory should choose one interaction accent—coral is recommended because it already marks Home—while plum remains typography/decorative ink rather than a second CTA color.

### Shape contract

- Controls: 12 pt continuous corners.
- Standard cards: 20 pt continuous corners.
- Editorial/hero modules: 28 pt continuous corners.
- Pills and circular controls: fully rounded.
- Nested containers step down one level; a card inside a card does not repeat the parent's radius and border weight.

### Type contract

- One wide-tracked all-caps JourneyDeck title per root screen.
- Platform body, headline, caption, and metric styles for everything else.
- Editorial serif is allowed only for story/collection titles such as 50 States—not for controls or metrics.
- Counts, durations, mileage, and dates use tabular numerals.
- Minimum production size for ordinary supporting copy: 12 pt, with Dynamic Type rather than fixed miniature labels.

### Surface and elevation contract

- Default surface: no shadow; optional hairline separator.
- Raised interactive card: one quiet elevation treatment.
- Hero/photo card: readability scrim and edge definition, not a colored glow.
- Selected state: accent fill, tint, or leading indicator—not glow plus border plus accent icon simultaneously.

### Motion contract

- Native tab and stack transitions remain untouched.
- Press feedback is immediate and restrained.
- Reordering follows the finger and springs only when released.
- Ambient photo drift remains optional and must stop under Reduce Motion.
- No metric or text movement for decoration.

## Home pilot specification

### Fixed shell

1. Native status and tab bars remain.
2. The photographic header remains the atmosphere layer.
3. Statistics and Soundtracks stay available from the header, but their circular treatments use the shared control recipe.
4. The recorder remains fixed above the customizable widget grid.

### Default hierarchy

1. **Record Journey** — the only full-emphasis action.
2. **Latest memory** — the dominant story card and first saved-content module.
3. **One contextual module** — 50 States, Ask JourneyDeck, or latest soundtrack, based on the user's layout.
4. **Supporting widgets** — metrics, library count, and remaining modules.

Customization may change order and visibility but not promote a metric to the same visual weight as the recorder or story card.

### Module recipes

- `Action`: full-width accent fill, concise state, 52–60 pt minimum height.
- `Story`: image-led, full-width, title plus no more than two metadata rows.
- `Editorial`: collection title, one visual, one progress statement; compact and expanded sizes.
- `Metric`: quiet surface, symbol, label, tabular value; no glow.
- `List`: artwork/icon, primary text, one metadata line, neutral chevron.

### State cycle required before approval

- ready, recording, paused, finishing, and failure recorder states;
- no journeys, first journey, and populated library;
- no music and populated latest soundtrack;
- no states and partially completed 50 States;
- Ask JourneyDeck available and unavailable;
- layout edit, reorder, resize, reset, and hidden-widget recovery;
- Grand Touring and Warm Ivory;
- Dynamic Type XL and Reduce Motion;
- iPhone Pro, SE-class width, iPad portrait, iPad landscape/sidebar, and narrow Split View.

### Paid Appllama benchmark validation

On September 19, 2026, the Home direction was checked against 60 current Appllama catalog results from complementary keyword and semantic searches. Twelve references were downloaded and visually inspected, including Ride with GPS, Retro, OS Maps, 5 Minute Journal, Day One, Visited, Slopes, Mult.dev, AllTrails, komoot, Abide, and Gaia GPS. The durable research notes and captures live under `research/ui-redesign/home/appllama/`.

The comparison validates the **Action → story → context → summary** hierarchy and changes the pilot in three concrete ways:

- related road metrics become one coherent summary region rather than several equal-weight cards;
- Home customization moves into an intentional edit mode with native sheet/modal presentation;
- compact 50 States becomes a progress-led editorial preview that opens the full map destination.

No reference is a pixel template. JourneyDeck keeps its native shell, road photography, real data, Grand Touring and Warm Ivory themes, and existing interaction model. The benchmark contributes proven hierarchy and presentation grammar only.

## Implementation sequence

1. Add semantic design tokens and shared type/shape/elevation constants without changing rendering.
2. Convert only Home's fixed shell and module recipes to the new tokens.
3. Preserve the existing widget data, persistence, gestures, and feature flags.
4. Verify the complete Home state cycle on device and iPad before touching another tab.
5. Roll the proven recipes into Memories, Soundtracks, Statistics, and Settings in that order.

The Home implementation is not complete until current and redesigned device captures can be compared at identical scroll positions in both Grand Touring and Warm Ivory.
