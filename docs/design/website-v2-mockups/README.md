# JourneyDeck website redesign — two working concepts

## App-style accents — September 5, 2026

Refined the user-flagged circle arrow, orange sticker and purple starbursts: dark rounded-square arrow, compact plum glass caption retaining its wording, and thin coral route marks. Uses the app's raised surfaces, muted borders and restrained accents. Selected mockup stays synchronized with production PR142 (https://github.com/drumpat01/DriveOS/pull/142). Desktop/390px phone layout, caption fit, anchor interaction and browser logs checked; full CI passed. Prior screenshots show earlier stages.

## Approved branding and publication — September 5, 2026

User approved the dark cinematic option 2 with sans-serif fonts throughout, then requested a prominent X navigation link and the exact app logo/wordmark before publishing. The selected mockup now uses the real dark app icon (assets/app-icon.png, byte-identical to mobile/recorder/assets/icon.png), white Journey/coral Deck wordmark and responsive Follow @JourneyDeck button. Earlier screenshot files predate this final branding change.

Published at https://journeydeck.me on September 5, 2026, 04:28 UTC. Production adaptation is isolated at C:/Users/patri/.codex/tmp/journeydeck-cinematic-release, PR https://github.com/drumpat01/DriveOS/pull/141, merge 16a88c226d34728d537a7e997bd3206cd620a96a. Render deployment dep-dadpkfmq1p3s73cg89d0 is live. Full CI passed; live content/assets match the release, health/legal/login routes pass, private app still requires login, and live browser branding/fonts/navigation/V2 toggle were checked. It preserves production metadata/legal/auth destinations, strips comparison-preview UI, reuses the existing identical production icon and ships the approved motion script and coast JPEG. The original mockup history below describes earlier design stages.

## Selected direction: option 2, app-matched cinematic skin

The user selected option 2's layout and interactions and requested only app-matched colors and fonts. `editorial.html` now uses an editorial-only skin at the end of `editorial.css`, sourced from the mobile app's dark surfaces (`#030105`, `#0c0710`, `#100816`), coral/pink/violet neon stops (`#ff795b`, `#ff4d87`, `#a66cff`), native system sans-serif text and headlines throughout (user explicitly requested all fonts sans serif). The V2 light preview uses the app's actual ivory palette. The page's theme-color metadata also matches the dark background.

All wording, markup, images, links, section order, motion code, and shared styles are preserved. Verified the HTML SHA-256 exactly matches the prior version after normalizing only the theme-color metadata; motion.js and shared.css hashes remain identical. Desktop and 390px phone layouts have no horizontal overflow or broken images; both theme button states and reduced-motion visibility remain functional. Updated opening screenshots: `concept-02-cinematic.png` and `concept-02-cinematic-mobile.png`. Original `concept-02*.png` screenshots without the cinematic suffix retain the first light/cobalt concept for comparison. No production or mobile changes.

Requested September 4, 2026. These are comparison mockups, isolated from the public site and mobile application. No production deployment, Git commit, push, dependency installation, or app release was performed.

- **01 — The Long Way:** `cinematic.html`. Deep coastal colors, full-screen landscape, large serif accents, scroll parallax, a drawn journey route, sticky storytelling, warm closing section.
- **02 — Field Notes:** `editorial.html`. Magazine composition, cobalt and chartreuse, mixed typography, photo captioning, a moving keepsake sequence, oversized V2 identity.

Both contain the user-provided status “Submitted to the App Store” / “Coming soon for iPhone.” Both include planned V2 light mode, a dedicated iPad app, Tessie integration for Tesla owners, and more. The illustrated V2 device is explicitly a concept, not a screenshot of the released app. No availability date or App Store approval is claimed. Theme buttons work. Public privacy, support, sign-in, and X destinations are retained. Public Spotify functionality is not advertised.

## Preview

Run `node docs/design/website-v2-mockups/preview.mjs` from the repository root. The server binds only to `127.0.0.1:4318` and only serves this mockup directory and approved static file types. Visit `/cinematic.html` or `/editorial.html`; the top strip switches concepts. The HTML pages also open directly from disk with their relative assets.

`concept-01.png` and `concept-02.png` show desktop openings. The `-mobile.png` files show phone openings. The `-full.png` images show full pages with reduced-motion enabled so all reveal text is captured. They cannot demonstrate live motion; use the HTML previews for that.

## Verification

- Both pages delivered successfully; JavaScript syntax passed.
- Browser inspection at desktop and 390 × 844: no page horizontal overflow, images loaded, V2 buttons switch state in both directions across the two concepts.
- Reduced-motion emulation: all reveal text visible, parallax disabled, editorial sequence horizontally scrollable. Emulation and viewport override restored after checking.
- Browser error/warning log empty. Full-page screenshots inspected. Repository whitespace check passed with pre-existing mobile line-ending warnings.
- Fixed crowded phone navigation during visual verification.

## Artwork

The original coast asset was created with the built-in image-generation tool, then copied into `assets/coast.png`; `assets/coast.jpg` is the browser delivery conversion. Logo and favicon are existing repository assets. There is no real user location or journey data in either concept.

Final generation prompt:

> Use case: editorial-photo. Create a single breathtaking but believable photographic landscape asset for JourneyDeck, a premium personal road trip and music memory app website. Wide landscape 3:2, high resolution. An aerial film photograph of a winding two-lane asphalt road following a rugged Northern California coast. Road begins large at bottom right and snakes up toward upper middle, dark cypress vegetation in foreground, deep petrol blue Pacific ocean on LEFT two thirds, soft pale horizon with distant marine mist. Late afternoon sunlight brushes golden dry grass beside road; the sea stays deep blue teal. One tiny anonymous dark car on the road provides scale. Shot on medium format film, natural color grading, fine grain, crisp photographic detail, observational travel photography for an independent magazine. Uneven organic coastline, candid actual geology, tactile real world. Composition leaves very large dark ocean expanse on left for separate HTML text overlay. No text, no letters, no UI, no logos, no watermarks, no glowing lines, no purple, no neon, no oversaturated sunset, no fantastical scenery.

## Next step

Use the user's chosen concept as the starting point for the production homepage. Compare against current production/main first: this V2 checkout's `web/landing.html` is older than the live homepage (live includes X and the corrected contact email). Preserve existing release, auth, legal, social metadata, and environment isolation. Follow the repository's normal explicitly authorized publishing workflow when publishing is requested.
