# JourneyDeck promo cuts, Oct 22, 2026

Video assets for the All Trips Bundle and the JourneyDeck app. No code changes.

## Variants (issue #336)

| File | Hook | Length |
| --- | --- | --- |
| `variants/JourneyDeck-promo-v1-bundle.mp4` | 4 trip packs. $25. Save $17 with the All Trips Bundle | 17.1s |
| `variants/JourneyDeck-promo-v2-ev.mp4` | EV road trip this fall? | 15.9s |
| `variants/JourneyDeck-promo-v3-camping.mp4` | Camping trip coming up? | 15.8s |

Each is 1080x1920 (9:16) H.264 with AAC audio at about -14 LUFS, with a matching post caption in the `.txt` next to it. All on-screen text is burned in. Every cut ends on the All Trips Bundle card: "4 packs for $25", "Save $17 at studio.journeydeck.me".

## Sources

- App screens: `web/assets/v4` (sample data: Pacifica to Half Moon Bay). The Atlas screen is left out because it shows a Tessie tab.
- Pack art: the banner images from the journeydeck-site-rework repo (`assets/*-templates-banner-16x9.png`, `assets/all-trips-bundle-banner-16x9.png`).
- Prices and pack contents: the Studio home page (Road Trip $12, EV $11, Camping $10, Holiday $9, bundle $25).
- Music: Pixabay track 201745 by moodmode (Pixabay Content License: commercial use in video allowed, no attribution required). The opening seconds of the track, faded out at the end. The Pixabay page was not checked for a Content ID mark.
- `source/` has the storyboards and the renderer (a copy of the app-promo-video renderer that takes the frame size and safe-zone widths from environment variables). Render with `python3 render.py v1-bundle.json out.mp4 --music <track.mp3>`.
