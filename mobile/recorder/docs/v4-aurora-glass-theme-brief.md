# V4 Aurora Glass theme brief

Status: favored visual direction, not implemented. The owner liked the revised [Aurora Glass home mockup](mockups/v4-theme-aurora-glass-liquid-v2.png). This brief is a design and implementation handoff, not approval to publish, build, or deploy.

## Intended result

Create a selectable V4 theme that feels consistently like liquid glass across the existing iOS app. Use a continuous midnight road and aurora atmosphere behind root screens; float adaptive clear glass controls above it; use darker frosted glass for dense information. Keep real journey photos, album covers, maps, and charts crisp. Mint is the sole interactive accent. Violet and other aurora colors may appear in scenery, not as competing control colors.

The mockup communicates material and mood. Its invented dates, numbers, journey title, wording, and tab labels are not product requirements. Preserve the real five-tab navigation (Home, Music, Memories, Statistics, Settings), recording states, data, and accessibility labels.

## Research basis

Appllama screens inspected September 26, 2026 (durable `app_id/screen_id` references; media links expire):

| App and screen | Observed pattern | JourneyDeck use |
| --- | --- | --- |
| Weather Live `749083919/oth_v7oqr` | Atmospheric imagery fills the screen beneath a translucent central information surface. | Give root screens scenery and place a few legible glass surfaces over it. |
| Mercury Weather `1621800675/oth_5rhf1` | Floating glass navigation coexists with readable, calmer metric cards. | Let navigation be clearer than data-dense content. |
| CARROT Weather `961390574/oth_20q0r` | Glass navigation sits over a vivid changing scene. | Ensure controls remain legible as artwork or media changes. |
| MyRadar `322439990/onb_vu4df` | Map stays immersive while controls collect at the edge. | Float map actions without veiling the route. |

Apple's [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials) and [Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass) emphasize the topmost navigation/control layer, adaptive legibility, and restraint with repeated custom glass. The theme can be glass-heavy in feel while retaining clearer surfaces for content.

## Material rules

- **Scene:** deep midnight blue/near-black base with restrained aurora mint and violet in artwork. Scenery should flow behind root content and scroll edges without covering text or depending on network access. Create separate text-free app artwork; do not crop the composed mockup into production UI.
- **Clear glass:** native tab/navigation controls, compact header actions, recording action, and short floating map controls. Refract or blur the live backdrop where native support permits; use a subtle edge highlight. Keep controls visibly interactive.
- **Frosted glass:** metric, list, settings, and sheet surfaces. Use more opacity and quieter imagery behind small labels, charts, and long text. Avoid stacking multiple transparent cards so their borders and content compete.
- **Content:** preserve natural colors in user photos, album artwork, map tiles, and exports. Avoid applying a global color filter to user data. Theme-owned artwork and fallback images may change.
- **Hierarchy:** one mint primary action per screen; neutral secondary controls. Avoid multiple accent hues, strong glows on every card, and a border around every nested element.
- **Adaptation:** handle Reduce Transparency with sufficiently opaque surfaces, Increase Contrast with stronger text/edges, and Reduce Motion with reduced decorative transitions. Verify light-on-dark legibility over both bright aurora and dark road sections.

## Existing code to inspect

- `src/theme-catalog.ts`: persisted theme IDs, palette, free/Plus lists, parsing, and custom-theme classification. Add a new ID; do not repurpose an existing persisted ID without a deliberate migration. The owner placed this theme in Plus. It is not the default; Grand Touring stays default and Aurora is opt-in.
- `src/app-theme.tsx`, `src/theme-palette.ts`: persistence, palette resolution, appearance class, transition, and stylesheet cache.
- `src/theme-picker.tsx`: preview registration, membership gate, selection, and accessibility description.
- `src/theme-material.tsx`: currently decorative gradients with no live blur. It is not a complete glass material.
- `src/delight-ui.tsx`: existing `AdaptiveGlassSurface` chooses `expo-glass-effect`, blur, or opaque fallback and accepts Reduce Transparency. Reuse or extend its material policy where appropriate.
- `src/native-navigation.tsx`: native tabs and iPad sidebar. Preserve system ownership and tab semantics; do not replace them with a drawn mockup tab bar.
- `src/header-artwork.tsx`, `src/shell.tsx`, iPad screen components, and theme-specific tests: artwork routing and screen surfaces. Inspect actual components before changing their styles.

## Matched screen mockups (step 1 draft, September 26, 2026)

`mockups/v4-aurora-glass-screens.mjs` renders `v4-aurora-glass-{home,journey,memories,settings}.png`, a Reduce Transparency Home variant, and `v4-aurora-glass-board.png`. The scene is procedural and text-free, with no licensing dependency. Every glass surface blurs the actual pixels beneath it. Photos, album art and the map are composited unfiltered. Titles, numbers and names are placeholders.

- **Home:** clear header buttons, a clear status pill and the mint "Start a journey" capsule float over open scenery; the four road-summary tiles are frosted, and Memories photo cards use a frosted caption band.
- **Journey detail:** a full-bleed dark map with a mint route and crisp album-art song pins; clear back, share/more and map controls; a mint "Relive" capsule; one frosted sheet holding metrics, the start and end points, and the soundtrack, separated by hairlines rather than nested cards. Gaia GPS Trail Stats (`1201979492/oth_q3d60`) uses the same map-over-stat-sheet pattern.
- **Memories:** crisp memory covers with inset frosted captions, frosted favorite-route tiles, and a single frosted Journey Library container.
- **Settings:** the scene is blurred and dimmed further; there is a frosted profile card, one grouped frosted list of the seven real categories with neutral icons, and no mint button. Mint appears only on the selected tab and the sync-status dot. The Appllama search found no glass-heavy settings precedent worth following.
- The tab bar stands in for the system Liquid Glass tab bar (real five tabs). It is not a custom tab bar to build.

Owner decisions (September 26, 2026). The owner approved the revised matched-screen board as the step 1 design baseline:

- Home scenery brightness behind the lower tiles is acceptable as is.
- Memories and Settings use a calm, heavily blurred (about 14pt), dimmed version of the scene. Only soft aurora colour washes remain. Full scenery is reserved for Home.
- The recording status stays, but not as a standalone pill. It is now a clear-glass **recorder dock** that groups the recording state ("Automatic recording on · Watching for your next drive · last drive 2h ago", tappable to change mode) with the mint "Start a journey" action inside it. This is a draft treatment and may still change.
- The map gets a dark Aurora style. Land is midnight `#0a1124`; water is deep teal `#05202c`→`#041520` with a teal coastline; roads are slate-blue `#34466b`/`#26365a`; parks are `#0c2330`; labels are `#9fb2d4`. The mint route stays the only mint on the map. At implementation this becomes an Aurora palette in `src/journey-map-theme.ts`, which already recolors the OpenFreeMap vector style per theme (see the Autumn and Redline palettes).

## Step 2 implementation (September 26, 2026, uncommitted)

- **Theme:** `aurora-glass` in `src/theme-catalog.ts`. It is a dark custom theme with mint accent `#5ff2c4` on `#03261c`, cool muted chart inks, and neutral black shadows via `theme-palette`. It belongs to Plus (`V4_PLUS_THEME_IDS`; `themeRequiresPlus` covers it). It is not the default.
- **V4 gating:** `app.config.js` sets `features.auroraGlass` only for the V4 variant, which drives `V4_AURORA_GLASS_ENABLED` in `src/release-features.ts`. The picker shows Aurora as the third Plus card only when that flag is on. The existing downgrade rule returns a lapsed member to Grand Touring.
- **Artwork:** `assets/theme-aurora-glass-scene-v1.jpg` covers Home, the picker preview and first-run. `…-soft-v1.jpg` (14pt blur, dimmed) covers every other app-owned header and fallback. Both are generated by `scripts/generate-aurora-glass-artwork.mjs` from `scripts/aurora-glass-scene.mjs`, the same scene the mockups use. User photos and album art are never replaced.
- **Material roles:** `src/glass-material-policy.ts` (pure, tested) defines `clear`, `frosted`, `sheet` and `primary`. `src/glass-material.tsx` renders them with `GlassMaterial` and provides `useIncreaseContrast`: Liquid Glass where available, blur plus tint otherwise, and opaque for Reduce Transparency. `ThemeMaterial` gives Aurora cards a neutral sheen.
- **Map:** the Aurora palette and mint route live in `src/journey-map-theme.ts`.
- **Shared artwork:** Aurora borrows Grand Touring's medallions, navigator avatar and Year on the Road score, via `artworkThemeId` and a derived `medallionArtwork` entry.
- **Tests:** added `tests/glass-material-policy.test.mts`, plus Aurora cases in `premium-themes`, `theme-picker-grid`, `journey-map-theme`, `fifty-states-medallion` and `v4-connector-config`.

## Step 3 implementation (September 26, 2026, uncommitted, not yet seen on device)

Most screens get glass through shared chokepoints; Home adds explicit live glass.

- **Surfaces everywhere:** in Aurora, `themedColor` turns legacy card surfaces into frosted tints (`card` at 62%, controls at white 10%). Pages stay solid, neutral borders become white-alpha glass edges, and shadows are neutral. `AppThemeProvider` subscribes once to Reduce Transparency and Increase Contrast (`useSurfacePreferences`). With Reduce Transparency on, it swaps in an opaque Aurora variant, so every `useThemedStyles` and `theme.color` surface becomes solid (the style cache is keyed by `theme.styleKey`).
- **Backdrops:** Home keeps the full scene, with a lighter scrim so the scenery continues behind the tiles. `AtmosphericBackdrop` (Memories, Journeys, Settings) shows the soft scene via `glassSoftSceneSource`.
- **Card edges:** `NeonWidgetOutline` draws a quiet white glass edge in Aurora, with no neon or glow. Selection still uses mint.
- **Home live glass:** `GlassBackdrop` and `useGlassCardStyle` in `src/glass-material.tsx` apply to the latest memory, latest song, Road Summary, share prompt (frosted) and the header button (clear). In `App.tsx`, the iPhone start state becomes the approved **recorder dock**: clear glass with the Ready state, plus the mint primary "Record Journey" (same test ID and accessibility label). The live recording card is clear glass, and End Journey is the mint primary material.
- **Journey detail:** the map uses the Aurora palette. Map controls already use `AdaptiveGlassSurface`, and its content surfaces get the frosted tints.
- **iPad:** themed headers (full/soft scene) and frosted-tint cards through the same chokepoints. There is no iPad-specific scenic backdrop or dock yet.

Open for device review: semantic `accent` still colours Home kickers and icons mint (for example "Latest memory", "ROAD SUMMARY"), and `themedGradient` still maps vivid legacy gradients to mint. Both may break the one-mint-action rule. Also check blur cost while scrolling Home, legibility of translucent cards on the full scene outside Home-specific glass, the iPad scenic backdrop, and Memories caption treatment (the mockup's frosted band vs the existing gradient shade).

## Delivery sequence and acceptance

1. Make matched Home, map/journey, Memories, and Settings mockups that use the same material levels and the app's real content structure. Confirm the design across data-dense and image-led screens before broad implementation.
2. Add the selectable theme and its own artwork/palette without changing other themes or user data. Build reusable material roles rather than scattering one-off `GlassView` wrappers.
3. Apply the roles to all five tabs, detail screens, sheets, picker, empty/loading/error states, and iPad layouts. Preserve recording and local-first behavior.
4. Verify switching and persistence, native tab/sidebar behavior, Reduce Transparency/Contrast/Motion, Dynamic Type, VoiceOver, safe areas, iPhone and iPad portrait/landscape and narrow Split View. Check contrast over changing photos/maps and performance while scrolling on a device.
5. Run focused theme/navigation tests, TypeScript typecheck, `git diff --check`, and a macOS native/device visual pass. No release action is implied.

The design is accepted as a direction only. Exact material opacity, final artwork and screen-specific placement still need visual iteration and owner review. The access tier (Plus) is decided.
