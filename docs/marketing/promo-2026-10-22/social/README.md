# Pinterest and TikTok cuts, Oct 22, 2026 (issue #337)

| File | Format | Length |
| --- | --- | --- |
| `JourneyDeck-promo-pin-2x3.mp4` | 1000x1500 (2:3) pin video | 11.6s |
| `JourneyDeck-promo-pin-2x3-cover.png` | 1000x1500 static cover | |
| `JourneyDeck-promo-tiktok-9x16.mp4` | 1080x1920 (9:16) | 17.1s |

Both end on the bundle link text: "All Trips Bundle", "4 packs for $25", "Save $17 at studio.journeydeck.me". The pin title, description and link, and the TikTok caption, are in the matching `.txt` files.

## TikTok safe zones

Text stays out of the top 150px, the bottom 390px, the right 140px and the left 60px. Captions are capped at 760px wide and pack art at 800px. `tiktok-safe-zone-check.png` shows frames from the cut with those zones shaded red; no text falls inside them. Only the bottom edge of the phone mockup reaches into the bottom zone.

## Rendering

`source/tiktok.json` and `source/pin-2x3.json`, rendered with `source/render.py`:

```sh
CAP_MAX_W=760 CARD_MAX_W=800 CAPTION_CY=360 python3 render.py tiktok.json tiktok.mp4 --music <track.mp3>
RENDER_W=1000 RENDER_H=1500 CAPTION_CY=240 PHONE_CY=800 PHONE_MAX_H=880 CARD_MAX_W=940 CARD_MAX_H=700 CTA_Y=360 CAP_MAX_W=860 TEXT_Y=0.45 LOGO_MAX=240 python3 render.py pin-2x3.json pin.mp4 --music <track.mp3>
```

Music is the same Pixabay track by moodmode used for the #336 variants.
