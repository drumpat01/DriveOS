# Sakura Chrome and Redline Noir

## Grand Touring primary-tab artwork — September 7, 2026

The user approved a brighter, more photographic Grand Touring set. Each primary tab now has a dedicated 1672 × 941 PNG using chrome silver and warm ivory as the dominant colors, deep navy as structure, and champagne as a restrained accent. The five explicit replacements are `theme-grand-touring-{home|soundtracks|memories|statistics|settings}-v1.png`. Their registered base-image mappings apply only to Grand Touring; existing Memory-card, journey-detail, secondary-screen, real-photo, and album-cover behavior remains intact.

- **Home:** silver production-derived GT coupe in a bright circuit pit lane.
- **Soundtracks:** silver GT coupe moving through repeating warm-ivory tunnel lights.
- **Memories:** three believable Grand Touring photo prints on a warm-ivory and chrome surface.
- **Statistics:** high-oblique daylight circuit geometry with a silver GT car at the apex.
- **Settings:** brushed-silver cockpit controls with navy upholstery and champagne trim.

Generated with the built-in image tool without text, logos, sponsor marks, or user data. The selected originals are retained in the local Codex generated-images directory as `exec-f3506636-da6d-4da1-9acc-6b1ef8cdcf10.png`, `exec-1b308fcd-cf7a-45d1-918e-1458a23a40da.png`, `exec-132dbd33-ba23-4db2-9175-fdb85114a861.png`, `exec-50d74f45-7a72-4309-addd-bc20a2b5c4b6.png`, and `exec-4bdfa7c8-cbc6-4023-a02d-bff05087c69b.png`. No OTA or native build was performed for this source milestone.

## Replacements: Rosewater and Grand Touring — September 6, 2026

Published and active production-channel readback verified: iOS Build18 runtime `2.0.0-watch.1`, group `ed596482-a9db-4805-b28f-7ced8c59107b`, update `01a078a6-7df7-7d98-9c64-da8be97459ea`. Export uploaded six new assets and reused68; superseded theme images are absent from the export. Physical visual acceptance remains pending.

User approved replacing both new themes and publishing via OTA. Original Cinematic Dark and Warm Ivory remain. `sakura` and `redline` are deliberately retained as persisted IDs, now displaying Rosewater and Grand Touring, so existing selections update automatically.

- Rosewater: page `#fff4f7`, blush cards `#f5dfe7`, raspberry `#b52b59`, dusty rose `#d895ab`, sage `#68816a`, cocoa `#986c50`, mulberry `#79566f`. Small labels use deeper accessible variants of the pastel chart colors.
- Grand Touring: midnight page `#081832`, navy cards `#203a63`, champagne `#d4b15a`, warm ivory `#f6f0e2`, and chrome `#b6bfcc`. Supporting chart accents use accessible steel and ice-blue derivatives. Home has navy glass, chrome edges and a champagne core/glow.
- Each theme now has three distinct bundled images: `assets/theme-{rosewater|carbon-blue}-{road|memory|journey}-v1.png`. Road art supplies general headers; the Memory collage supplies Memory covers/headers; journey art supplies journey details and time-of-day thumbnail fallbacks. Real photos and album covers are preserved. All six originals were visually inspected, 1536×1024 PNGs, approximately14.1 MB combined.
- Typecheck and full299/299 tests pass, including persisted-ID replacement, names, contrast, separate artwork routing and preservation of original-theme/user artwork. Production staging is `.cache/ota-build18-carbon-rose` with HEAD native configuration and tested JS/TS/assets only. Native icon/Watch changes remain excluded.

### New artwork prompts

Built-in image generation, six independent new assets. Shared instruction: finished production background for JourneyDeck, not UI; photorealistic cinematic quality; full artwork without text, logos, watermarks, UI or device frames; app-owned decoration with no user data.

- **Rosewater road:** Landscape3:2 photograph of a graceful coastal road in soft blush dawn light, flowering pink cherry trees and soft sage coastal vegetation, misty rose sky, pearl-pink reflections and muted cocoa rocks. Calm sophisticated cinematic light theme, deliberately pink-toned rather than ivory or lavender. Wide quiet left portion for app overlays, road curved in right portion.
- **Carbon Blue road:** Landscape3:2 photograph of a sweeping coastal road after dark, luminous ice-white and electric cobalt long-exposure light trails following an S bend, deep navy ocean, dramatic blue clouds, blue-black cliffs. Carbon Blue luxury cinematic dark theme. Exclusively navy, cobalt, azure and ice-white light, no warm lights or sunset hues. Wide quiet left portion for app overlays.
- **Rosewater memory:** Landscape3:2 conceptual photograph of a small elegant arrangement of three floating frameless travel photo prints on a soft pearl-blush backdrop. Photos show blossom-lined road, pale pink coastal dawn, quiet sage hills. Layered glass edges and subtle pink shadows. A refined default Memory cover, center-weighted so square crops work. Dusty rose and raspberry touches, no purple cast, no words.
- **Carbon Blue memory:** Landscape3:2 conceptual photograph of three floating frameless travel photo prints with fine chrome and ice-white illuminated edges in blue-black space. Photos show cobalt coastal road, navy ocean and azure mountain pass. Sophisticated subtle blue carbon fibre reflections underneath, elegant not sci-fi. Default Memory cover, center-weighted safe for square crop. Only blue black navy cobalt cyan silver and ice white; no brown orange yellow red violet or green.
- **Rosewater journey:** Landscape3:2 cinematic photograph of an empty winding road across rosewater coastal hills at soft pink dawn. Foreground gentle road curve, sage grasses, dusty pink horizon, pearl haze. Distinct close-up road journey composition, no floating prints, no city. Refined light palette of blush pink, raspberry highlights, sage and cocoa stone. Center-weighted subject safe for square thumbnail and wide banner.
- **Carbon Blue journey:** Landscape3:2 cinematic photograph of a winding mountain road meeting a navy sea at midnight, low viewpoint, an elegant ice-white and cobalt light trail along the road, brushed-silver guardrail, cold azure atmosphere, near-black blue terrain. Distinct from a wide hero: closer to the road curve, center-weighted safe for square thumbnails and wide banner. Luxury Blue Carbon visual mood. No warm hues, no purple or red, no logos.

The earlier implementation/provenance notes below are historical and superseded by these replacements.

Published September 6 to iOS production, Build18 runtime `2.0.0-watch.1`, group `3dbc40c7-f561-4547-911d-bf4d3a54c4ba`. Active channel readback verified. This supersedes the source-only release status below; physical acceptance remains pending.

Implemented September 6, 2026. Both themes and the existing dark/ivory choices are available free in Settings for testing. Theme identity is separate from light/dark appearance so native maps, status bars and sheets retain the correct appearance class. Preference key `journeydeck.appearance.v2` accepts old and new IDs; failed saves keep the current selection.

## Visual system

- **Sakura Chrome:** pearl white and blush surfaces, dark plum text, lacquer red actions, periwinkle/teal/amber secondary data. Static pearl gradients and chrome hairlines provide material detail without blur or animation overhead.
- **Redline Noir:** black/graphite surfaces, silver text/edges, red actions, amber/teal/blue/magenta secondary metrics and restrained neon lighting. Photography and album art retain their natural colors.
- Palettes live in `src/theme-catalog.ts`; `app-theme.tsx` resolves identity, persistence and stylesheet caches. Tablet/shared Statistics and Memories use explicit palettes. Existing shared styles resolve colors by presentation role. New custom primary actions specify contrasting text directly.
- Decorative artwork is changed only for registered app-owned assets. User photos, remote covers, cached maps and exported share artwork are not passed through a visual filter. Both new themes reuse one landscape scene across headers, using the existing screen crop/layout.

## Generated asset provenance

Created with the built-in image generation tool, September 6, 2026, as text-free backgrounds. No added fonts, libraries or native plugins.

| Bundled asset | Dimensions | Art direction |
| --- | --- | --- |
| `assets/theme-sakura-road-v1.png` | 1536 × 1024 | Photoreal cinematic spring expressway with cherry blossoms, silver city architecture, pearl gray/blush daylight, and quiet composition for UI overlays. |
| `assets/theme-redline-road-v1.png` | 1536 × 1024 | Photoreal night coastal tunnel with racing-red light trails, stormy graphite landscape, subtle blue/teal reflections and amber lamps; quiet space for UI overlays. |

These are presentation assets; no user journey data was used. Original tool outputs are retained in the local Codex generated-images directory as `exec-55d5ce33-fb32-4496-b376-41c203bc9719.png` and `exec-1c0bb5ee-a3dc-4c25-b4be-dfc74081e4bd.png` respectively.

## Verification and device acceptance

Typecheck, focused41/41, full mobile299/299 and local iOS Hermes export pass. The new tests cover saved choices/restoration, failed writes, provider child state retention, palette contrast, all free picker actions, artwork boundaries and actual Statistics values/range retention across theme changes. Existing suites cover responsive layouts and interactions.

Physical review is still required on iPhone/iPad: switch each theme from Settings, reopen the app, inspect all five tabs and Memory/journey editors, verify light/dark keyboard and navigation colors, try large text/narrow iPad layouts, and switch while a journey is recording to confirm device behavior. No release has been performed. Theme code/assets can use the existing Build18 runtime; the separately pending Watch/icon native changes cannot be delivered by OTA.
