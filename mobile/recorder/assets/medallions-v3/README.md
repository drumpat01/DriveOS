# All 50 generated medallion faces

Generated September 18, 2026 with built-in image_gen, one call per theme. Replaces the initial procedural SVG designs at the user's request to use the approved medallion method.

Grand Touring uses ../medallions-v2/first-track-redline.png as a style reference. Each other theme uses the generated Grand Touring face as its edit reference. All five outputs were visually inspected for lettering, motif, front-only circular composition and palette. The map is decorative generated illustration, not geographic data. Three.js supplies the coin body and moving reflections.

## Runtime preparation

Run `node --experimental-strip-types scripts/prepare-medallion-assets.cjs medallions-v3` from mobile/recorder. This uses the existing collection's gold-perimeter detector with its 2.5% inset and lossless WebP conversion. All visible decoded pixels and alpha are verified against source. No resizing or synthetic detail. Always display through the shared circular frame/clip; generated outer-edge artifacts must not appear on the coin. Source PNGs are provenance; runtime WebPs are app assets.

## Prompts and provenance

### redline

- Saved source: all-fifty-redline.png
- Generated source: C:/Users/patri/.codex/generated_images/01a0b451-ea83-7bf3-b2f4-2526abe6e49f/exec-45fa9012-39e3-4298-a5bc-e2b901ab1f6c.png
- Tool: built-in image_gen.imagegen (reference-image mode).

```text
Use case: style-transfer. Create a NEW All 50 achievement medallion FACE matching the premium engraved enamel illustration style of the reference JourneyDeck medallion. Reference is STYLE and PALETTE only, replace its subject. Square high-resolution 1254x1254 or larger. Perfect orthographic centered circular face, diameter 96% of square, equal margins. Artwork only, no photographed coin body, perspective, sidewall, cast shadow or chunky relief. One thin gold outer perimeter. Smooth midnight navy enamel, warm polished gold lettering and fine outlines, natural deep green scenic accents. SUBJECT: triumphant beautifully detailed United States collection emblem, recognizable contiguous USA silhouette with delicate state boundaries and separate Alaska/Hawaii silhouettes below, large elegant gold 50 prominently centered over map; refined laurel branches framing lower sides and small star ornaments. Inscription at top exactly ALL FIFTY; small bottom inscription JOURNEYDECK. No other lettering. Restrained shallow engraved detail like reference, smooth enamel, neutral even diffuse lighting; renderer supplies real depth/reflections. All details and lettering comfortably inside circle. Outside circle REAL TRANSPARENCY, never painted checkerboards; if unavailable plain white. No watermark.
```

### sakura

- Saved source: all-fifty-sakura.png
- Generated source: C:/Users/patri/.codex/generated_images/01a0b451-ea83-7bf3-b2f4-2526abe6e49f/exec-4e61e78d-72cf-46f9-8bd3-8458274da06c.png
- Tool: built-in image_gen.imagegen (reference-image mode).

```text
Use case: precise-object-edit. Recolor this exact All Fifty medallion face for JourneyDeck Rosewater. Preserve its exact map, 50, laurel, mountains, stars, ALL FIFTY and JOURNEYDECK lettering, circular geometry and front-only composition. Change only palette: smooth blush-pink and raspberry enamel, pale cream scenic accents, warm rose-gold and gold fine outlines/lettering. Clearly pink theme, no navy or green fields. Keep refined engraved enamel style, shallow relief, neutral even lighting; no coin sidewall, perspective, cast shadow or thick rim. Square at least 1254x1254, circle 96% width with equal margins. Outside circle actual transparency, never drawn checkerboard, otherwise plain white.
```

### dark

- Saved source: all-fifty-dark.png
- Generated source: C:/Users/patri/.codex/generated_images/01a0b451-ea83-7bf3-b2f4-2526abe6e49f/exec-f958a703-ce51-4e1e-921e-e4e56b846f69.png
- Tool: built-in image_gen.imagegen (reference-image mode).

```text
Use case: precise-object-edit. Recolor this exact All Fifty medallion face for JourneyDeck Cinematic Dark. Preserve exact map, 50, laurel, mountains, stars, ALL FIFTY and JOURNEYDECK lettering, circular geometry and front-only composition. Change only palette: smooth near-black charcoal enamel with restrained deep slate scenic accents and warm polished gold fine outlines/lettering. No navy blue or green fields. Keep refined engraved enamel style, shallow relief, neutral even lighting; no coin sidewall, perspective, cast shadow or thick rim. Square at least 1254x1254, circle 96% width with equal margins. Outside circle actual transparency, never drawn checkerboard, otherwise plain white.
```

### light

- Saved source: all-fifty-light.png
- Generated source: C:/Users/patri/.codex/generated_images/01a0b451-ea83-7bf3-b2f4-2526abe6e49f/exec-1ab2ff86-3d14-4a12-a867-634ea9397855.png
- Tool: built-in image_gen.imagegen (reference-image mode).

```text
Use case: precise-object-edit. Recolor this exact All Fifty medallion face for JourneyDeck Warm Ivory. Preserve exact map, 50, laurel, mountains, stars, ALL FIFTY and JOURNEYDECK lettering, circular geometry and front-only composition. Change only palette: smooth warm ivory and cream enamel with taupe/champagne scenic accents, rich antique gold outlines and lettering readable against pale ivory. No navy or saturated green fields. Keep refined engraved enamel style, shallow relief, neutral even lighting; no coin sidewall, perspective, cast shadow or thick rim. Square at least 1254x1254, circle 96% width with equal margins. Outside circle actual transparency, never drawn checkerboard, otherwise plain white.
```

### midnight-canopy

- Saved source: all-fifty-midnight-canopy.png
- Generated source: C:/Users/patri/.codex/generated_images/01a0b451-ea83-7bf3-b2f4-2526abe6e49f/exec-59127ac3-1b82-404a-aac9-56b086f207ed.png
- Tool: built-in image_gen.imagegen (reference-image mode).

```text
Use case: precise-object-edit. Recolor this exact All Fifty medallion face for JourneyDeck Autumn Drive. Preserve exact map, 50, laurel, mountains, stars, ALL FIFTY and JOURNEYDECK lettering, circular geometry and front-only composition. Change only palette: smooth deep forest green enamel (#162F13), brighter forest green scenery (#206722), autumn orange and burnished warm gold metal outlines and lettering, restrained burgundy scenic accents. Clearly forest green and orange autumn theme, no navy fields. Keep refined engraved enamel style, shallow relief, neutral even lighting; no coin sidewall, perspective, cast shadow or thick rim. Square at least 1254x1254, circle 96% width with equal margins. Outside circle actual transparency, never drawn checkerboard, otherwise plain white.
```

