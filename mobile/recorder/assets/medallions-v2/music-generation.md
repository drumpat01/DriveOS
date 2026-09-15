# Music medallion artwork generation

Generated September 14, 2026 with the built-in image_gen tool. Original approved assets are preserved under medallion-concepts. These are individually generated production texture candidates; no CLI/API fallback was used.

## Verification

- All 12 outputs visually inspected: readable exact lettering, centered frontal circular artwork, no visible oblique sidewall or directional dark right-side crescent.
- Four theme palettes: Grand Touring (redline), Rosewater (sakura), Cinematic Dark (dark), Warm Ivory (light).
- Cinematic Dark Soundtrack 100 uses black-purple, amber and selective cyan rather than a pink-dominant treatment.
- Warm Ivory outputs contain ivory, plum, terracotta and gold, with no blue or teal.
- The generator painted a checkerboard outside the circle despite explicit transparency requests. The renderer/asset integration must crop to the circular face and supply real transparency; these source outputs are preserved unmodified.
- All 12 saved outputs are 1254x1254 pixels; decoded corner alpha is 255 (opaque). Production Three.js lighting adds the physical coin body, restrained shallow relief and moving reflections.

## Master prompt

Use case: stylized-concept. Asset type: high-resolution circular front-face texture for a real spinning Three.js coin in a mobile app. Recreate this coin art from scratch using the attached reference only for its motif and palette. Output square 1536x1536 or larger, at least1024px. CRITICAL GEOMETRY: perfectly straight-on orthographic disc face, exact centered perfect circle occupying96% of canvas width AND height with2% identical margin on all sides. Face plane normal points directly at camera. Do not show any physical thickness, sidewall, ellipse, tilted perspective, shifted rim, second ring behind it, drop shadow, dark right-side crescent or dark underside. One slender concentric gold perimeter, of uniform thickness at all angles. Everything is entirely INSIDE that perimeter. Background outside circle is genuinely transparent PNG alpha, no checkerboard drawn. Interior is premium smooth vitreous enamel separated by crisp thin gold engraving, very fine clean details, shallow intaglio detailing rather than sculpted mountainous emboss. Neutral even diffuse front illumination; same brightness left/right. The engine adds metallic reflection and depth dynamically, so do not bake directional highlights, heavy black shadows, rough grain, pebbling, or large raised bevels into this texture. Readable elegant engraved lettering, no extra text or watermarks.

### soundtrack-100 — redline

Reference: `../medallion-concepts/soundtrack-100/option-01-theme-variants/soundtrack-100-grand-touring.png`.

Additional prompt:

SUBJECT: a large precise vinyl record filling the circle, concentric fine record grooves, center label reads exactly "100" in bold serif numerals. A winding highway sweeps from bottom foreground into the center groove with delicate lane markers; small mountain ridges and evergreen trees at lower sides. Color palette grand touring: rich midnight navy enamel record and road, forest-green trees and mountains, champagne gold grooves, center label and dividers. Natural consistent enamel colors, not bleached or overshiny. ONLY TEXT "100".

Output: `soundtrack-100-redline.png`

Generated source: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-2b71440d-52c5-49fa-8a67-5f8945f8b895.png`

### first-note — redline

Reference: `../medallion-concepts/first-note/option-01-theme-variants/first-note-grand-touring.png`.

Additional prompt:

SUBJECT: one prominent single eighth musical note centered above a straight mountain road leading toward a sunrise; refined radiating fine gold sun rays, small forest green mountain ridges on both sides. Across upper arc the exact words "FIRST NOTE", across lower arc exactly "FIRST SONG". Elegant uppercase serif letters aligned concentrically. Color palette grand touring: midnight navy sky and road, forest-green mountain accents, champagne gold note, ray lines and text. Single note only; no extra signs.

Output: `first-note-redline.png`

Generated source: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-d718e20e-9025-4cef-8536-ade0457586f7.png`

### long-play — redline

Reference: `../medallion-concepts/long-play/option-04-theme-variants/long-play-grand-touring.png`.

Additional prompt:

SUBJECT: vintage audio cassette precisely centered in upper-middle, two clearly defined tape spools. Cassette rectangular label reads exactly "10 SONGS". A straight road below it recedes to mountain horizon and sunrise; tiny forest-green fir trees. Top arc exactly "LONG PLAY". Color palette grand touring: rich midnight navy enamel cassette field, sky and road, forest-green mountain accents, champagne gold cassette frame, road lines and text. Even sharp craftsmanship.

Output: `long-play-redline.png`

Generated source: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-40135508-0b13-4e93-beb7-e8e65d2aaf40.png`

## Theme-edit prompt

Use case: precise-object-edit. Asset type: high-resolution orthographic enamel coin FACE texture, at least 1536x1536 square. Change ONLY the color palette of this attached newly recreated master for the specified app theme. Keep EXACT composition, framing, perfectly centered circular outline, lettering, spacing, shapes, and very fine detail. Circle occupies 96% of width AND height with uniform2% margins. Keep it a frontal plane with NO perspective, NO coin thickness visible, NO shifted sidewall, NO dark right or bottom crescents, NO baked drop shadows. The live renderer adds gold edge thickness and reflections. Keep the face smooth crisp vitreous enamel and fine gold engraving, no rough pebbling, no inflated bevels. Lighting remains neutral diffuse and even left/right, avoid strong highlights or directional shadows. Outside circle must be actual transparent alpha, NOT a printed checkerboard. Retain all text verbatim.

### sakura palette

Rosewater / Sakura theme: pale blush pink sky or enamel field, muted raspberry/burgundy road or vinyl grooves, sage green trees/foliage, champagne gold outlines and metal. Gentle warm rose gold luxury rather than neon pink. Make it distinctly pale blush and raspberry.

### dark palette

Cinematic Dark theme: near-black purple enamel fields and road, ultraviolet purple mountain or groove accents, glowing warm amber/burnt orange sun and fine highlights, very selective subtle cyan accents in landscape. Gold metal stays regular gold. Not pink-dominant; no rosewater colors. Nighttime premium aesthetic, but preserve readable detail in shadows and symmetrical illumination.

### light palette

Warm Ivory theme: warm ivory/cream enamel field, plum and terracotta road/landscape accents, champagne gold fine dividers, rim and metal. Mountains in brown/terracotta/plum and ivory. The vinyl record if present is warm champagne with fine brown groove lines. NO blue, cyan or teal anywhere. Clear soft ivory and warm earth palette; keep typography dark and legible.

## Theme variant sources

Each variant call combined the theme-edit prompt above with `PALETTE: ` followed by its palette paragraph. Each used the newly generated redline master for that achievement as its only reference and edit target.

- `soundtrack-100-sakura.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-aef0e8c5-6b36-4a58-b8a2-318672a42eef.png`
- `soundtrack-100-dark.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-bee4479b-9390-4a2d-863d-bb2d8c5e811d.png`
- `soundtrack-100-light.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-6e345323-ee0a-4611-b501-35170e8cc66e.png`
- `first-note-sakura.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-14051a5f-743e-4a6b-afe8-ca91d8804ec8.png`
- `first-note-dark.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-685dc265-9310-48ed-9f2b-7bad38b29bd2.png`
- `first-note-light.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-64b7070a-1952-41cb-af2f-c14ab1094c1d.png`
- `long-play-sakura.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-7fc44b9e-5eaa-46f6-8c39-822cd29d4d9a.png`
- `long-play-dark.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-2c6a100c-99d5-4401-9aca-f2fc6da93938.png`
- `long-play-light.png`: `C:\Users\patri\.codex\generated_images\01a0a27a-37f8-7231-8890-da9dcc474074\exec-5da03e4e-ca27-46e2-9dd1-ede368e08226.png`
