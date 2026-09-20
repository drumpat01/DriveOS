# Autumn Drive — JourneyDeck V3

## Current palette: Theme Creator "test 4" — September 17, 2026

The user selected the saved **test 4** preset for Autumn Drive. These exact values supersede every earlier palette below. Stored theme ID remains `midnight-canopy`.

| Editor role | Hex | Native palette mapping |
| --- | --- | --- |
| Base background | `#162F13` | page / green |
| Card surfaces | `#206722` | card / success |
| Controls & navigation | `#590000` | inset / chrome / coral |
| Borders & dividers | `#FFD000` | line |
| Primary text & icons | `#FFFFFF` | text |
| Secondary text & icons | `#FFFFFF` | muted |
| Highlights & actions | `#FFA600` | accent / amber / teal |
| Text on action buttons | `#000000` | onAccent |
| Active & recording | `#590000` | rose / blue / danger |
| Atmosphere & glow | `#FF7600` | glow |

White remains on success/danger surfaces. Red is for controls, badges and active state, not page/card surfaces. Shared legacy card/control styles are assigned explicit semantic colors; decorative material and shadows use the orange glow. The Theme Creator built-in Autumn preset matches test 4. User photos, album artwork, the native Home photograph, icon assets, saved selections and layouts are preserved. Source implementation is complete; native device visual acceptance and an authorized OTA are separate steps.

## Historical references (superseded)

## Current approved six-color palette plus white text — September 16, 2026

Latest device revision: bright yellow `#FFD84D` replaces sage for widget outlines; sage remains in the palette for supporting accents. The active recording beacon uses burnt orange/red `#C43C00` for its core and rings; paused uses yellow. This supersedes the sage-border guidance below, without changing page/card backgrounds.

Element-level application: no palette stripe in tab headers. Home/Soundtracks use burnt-orange small metric badges with white icons and yellow values; Memories uses a burnt-orange Collections badge and yellow Collections label; Settings uses burnt-orange category badges and yellow emphasis; Statistics uses burnt-orange section markers and yellow totals. Gold stays on primary actions, sage on separators, and the two greens on page/card surfaces. Never apply burnt orange to a page or card surface.

Latest warm-accent refinement: golden orange is now `#FFA800` (previously `#FF9000`), and bright yellow is `#FFD84D` (previously `#FCC159`). The three greens, burnt-orange highlight-only rule, and white text are unchanged. This supersedes older warm-accent hex values below.

Latest user revision: add white `#FFFFFF` for main/secondary text and labels on green surfaces. Orange actions retain dark-green labels for contrast. White supplements the six approved theme colors; it does not replace the green backgrounds or warm accents. This supersedes the amber-body-text rule below.

Home refinement: the user selected option 5, Ahmet Yüksek's Unsplash photo `FxVAyJSZgKc`, bundled as `theme-autumn-home-road-v1.jpg` with source/license notes beside it. Only Autumn Home artwork changes; iPad uses a lower crop to retain the road. Primary actions, icons, and progress use orange `#FF9000` again rather than amber; ordinary text remains amber. The green-only shared background rule remains in effect.

Use only `#214223`, `#3A583E`, `#5C735F`, `#C43C00`, `#FF9000`, and `#FCC159` for Autumn theme tokens. The approved balance reference is 28/25/18/7/13/9 percent respectively, a visual guide rather than fixed screen coverage. Reduce heavy dark coverage: page green is `#214223`, card green is `#3A583E`. Amber carries readable text; sage is for borders and graphic details. Burnt orange/red (`#C43C00`) is restricted to highlights or action buttons, never page, card, panel, or decorative gradient backgrounds. This supersedes the older ivory-text and near-black background notes below. Photos and existing artwork are not palette tokens.

User-approved visual direction, September 15, 2026. The approved autumn revision is now implemented source-side as the V3-only `midnight-canopy` theme and alternate icon; these files remain the visual provenance and comparison references.

Latest September 16 revision: after rejecting Fern as too lime and seeing the Jade comparison, the user approved the attached **forest-green / burnt-orange / amber palette** shown in the [autumn Statistics comparison](statistics-autumn-v3.png). See its [palette and generation notes](autumn-palette-trial.md). This approves the visual palette direction, not runtime implementation. The original Fern and Jade images remain comparison references.

## Earlier six-color palette (Jade comparison)

| Name | Hex | Role |
| --- | --- | --- |
| Forest Shadow | `#07110D` | Main background |
| Pine | `#1B3B2B` | Cards and panels |
| Canopy | `#356B4A` | Raised surfaces and selected areas |
| Jade (proposed) | `#8FC2A3` | Primary actions, chart bars, active states; replaces rejected Fern `#A8D96B` |
| Warm Ivory | `#F1F0E4` | Main text |
| Amber Bark | `#D7AD63` | Small secondary highlights |

Forest Shadow, Pine, and Canopy must read as three clearly distinct depth layers. Avoid collapsing them into near-identical dark greens. Use Jade sparingly so primary actions and chart emphasis remain clear. Calculated sRGB contrast for the proposed solid Jade token is 9.51:1 on Forest Shadow, 6.10:1 on Pine, and 3.11:1 on Canopy. Retain Warm Ivory for ordinary text on Canopy; a generated mockup does not establish runtime accessibility compliance.

## Saved concepts

- [Autumn Statistics comparison](statistics-autumn-v3.png): approved palette reference using the user's forest/woodland greens, burnt orange, orange and amber; existing ivory text is retained. Its palette now drives the V3-only runtime theme, while layout/data remain illustrative.
- [Borderless autumn icon preview](app-icon-autumn-borderless-v2.png): source concept for the new 1024px opaque V3 alternate icon. It has a deep-green full-bleed background, the established JourneyDeck mark in warm yellow with a narrow amber outline, and no perimeter rim/frame.
- [Jade Statistics comparison](statistics-jade-v2.png): earlier proposed color replacement, removing the lime cast from charts, progress bars, active navigation, and other Fern accents while preserving the original composition.
- [Original Statistics page concept](statistics-concept-v1.png): original now-rejected Fern accent, retained for comparison. Values, logo details, tab labels, and some chart categories are illustrative and are **not** an exact product specification; preserve the actual Statistics data model and navigation when implementing.
- [Smooth app icon concept](app-icon-smooth-v1.png): existing JourneyDeck circular peaked-line mark in the original Fern against a smooth dark-green background. Accent now needs revision after the replacement is confirmed. **No textured background, forest pattern, grain, or foliage.** This supersedes the earlier textured green icon exploration. It is not yet a production-ready icon export or app asset.

The original overhead forest stock photograph inspired the mood only. Do not bundle or reproduce the watermarked photo as an app asset. Any forest imagery used elsewhere should be original or properly licensed. The icon background should remain smooth regardless.

Before implementation, validate text/chart contrast, Light/Reduce Transparency behavior, Dynamic Type, accessibility, all primary surfaces, and native icon export requirements. Give the theme a new stable ID; do not repurpose Grand Touring or a saved theme selection.

## Jade comparison generation

Used the built-in image-generation tool in edit mode, with `statistics-concept-v1.png` as the sole edit target. Output: `statistics-jade-v2.png`. Final prompt:

> Use case: precise-object-edit. Asset type: high-fidelity JourneyDeck Midnight Canopy Statistics screen color revision. Input image 1 is the exact edit target. Change ONLY the bright lime/yellow-green Fern accent (original #A8D96B) to a muted, cooler Jade with target color #8FC2A3. Apply this consistently to chart bars, progress bars, the active Statistics tab icon and label, and any other formerly lime highlights. The replacement must read as calm jade/eucalyptus green, without yellow, lime, acid-green or neon glow. Keep the original deep forest background, pine-green panels, canopy-green selected segments, warm ivory typography, amber percentage indicators, forest-and-moon header artwork, all text, all data, all icons, layout, spacing, proportions and portrait framing unchanged. No new UI elements, no new labels, no added borders or swatches, no redesign. Preserve every existing word and number exactly. Produce one faithful edited Statistics mockup.

## Borderless autumn icon generation

Used the built-in image-generation tool in edit mode. Input 1 was `app-icon-smooth-v1.png` as the established JourneyDeck mark/composition reference; input 2 was the approved autumn Statistics mockup as a palette reference. Output: `app-icon-autumn-borderless-v2.png`. Final prompt:

> Use case: precise-object-edit. Asset type: square JourneyDeck iOS app icon preview. Input image 1: exact composition and JourneyDeck central-mark reference. Preserve the established centered circular mark with its peaked road/pulse strokes and its strong, simple silhouette. Input image 2: color-palette reference only; do not reproduce the app screen, text, charts, or forest scene. Primary request: Create a new icon preview with a smooth, full-bleed deep woodland-green background based on #101A12 and #214223. Recolor the thick central JourneyDeck mark/strokes (“bars”) to warm golden yellow #FCC159. Give only those central yellow strokes a crisp, narrow amber outline using #FF9000, with restrained #C43C00 in the deepest edge/shadow if useful. Critical perimeter constraint: remove the metallic/bright outline, rim, border, bevel, stroke, halo, or frame around the outer edges of the entire icon. The deep-green background must continue uninterrupted all the way to every canvas edge. No inset rounded-square container, no border around the canvas, no luminous edge trim. Keep generous safe-area spacing around the central mark so iOS can apply its own corner mask. Style: premium, polished, smooth, dimensional but restrained; subtle depth and soft internal lighting, not neon. The yellow mark must read clearly at small icon sizes. Constraints: square composition; one centered JourneyDeck mark only; no letters, words, chart, trees, texture, watermark, additional symbols, outer frame, or transparent border. Do not make the mark lime green.
