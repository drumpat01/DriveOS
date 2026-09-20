# JourneyDeck Medallions

Collection motifs approved September 14, 2026. The set uses a 4 Journey, 3 Music, and 3 Memory balance. The user subsequently requested recreated artwork and coin rendering; milestone rules remain unchanged.

## Theme and color palette

Each medallion can use any of the app's four current themes and its corresponding color palette. Use the existing app themes and palettes as design references when creating the artwork.

The theme chooser selects the matching front immediately: Grand Touring (`redline`, navy/green/gold), Rosewater (`sakura`, blush/raspberry/sage/gold), Cinematic Dark (`dark`, purple/amber with selective cyan), or Warm Ivory (`light`, ivory/plum/terracotta/gold). The body, edge, and reverse remain ordinary gold in every theme.

## Medallions

### Journeys

1. **The First Track** — First journey
2. **Long Way Home** — First journey over 25 miles
3. **Thousand Mile Club** — 1,000 total miles
4. **Grand Tourer** — 100 journeys

### Music

5. **First Note** — First song play saved with a journey
6. **Long Play** — 10 songs played during one journey
7. **Soundtrack 100** — 100 total song plays

### Memories

8. **Memory Maker** — First Memory created
9. **Picture This** — First photo added to a Memory
10. **Story Collector** — Five Memories created

## Approved designs

- **The First Track** — Option 1, centered vinyl sunrise and musical-staff road. The face reads `FIRST JOURNEY` once across the top and has no lower inscription.
- **Long Way Home** — Option 7, a vintage highway shield above a straight mountain road. Grand Touring uses a blank red shield cap, blue shield field, and white 25 MI; the other front treatments use Rosewater, Cinematic Dark, and Warm Ivory palettes.
- **Thousand Mile Club** — Option 2, bold Art Deco 1000 with a straight road passing through the zeros and a `1,000 MI` plaque.
- **Grand Tourer** — Option 7, a shield-shaped mountain-road touring crest with `100 JOURNEYS` and laurel branches.
- **First Note** — Option 1, one musical note rising over a straight mountain road and sunrise.
- **Long Play** — Option 4, a `10 SONGS` cassette above a straight road and mountain horizon.
- **Soundtrack 100** — Option 1, a large vinyl record with 100 on its center label and a highway flowing into the record groove. Cinematic Dark is deep purple with burnt-orange and amber highlights rather than pink-dominant. Warm Ivory excludes blue and teal.
- **Memory Maker** — Option 8, two hands holding an instant-photo memory of an open road, mountains, and sunrise, with a small heart on the photo border. Cinematic Dark uses a high-glow neon treatment with black-purple, ultraviolet, orange, amber, and selective cyan; Warm Ivory excludes blue and teal.
- **Picture This** — Recreated-set Option 8, concentric shutter blades opening onto a centered road and sunrise.
- **Story Collector** — Option 1, five overlapping instant photos above a winding road with `5 MEMORIES`.

## Recreated faces and shared framing

The rebuilt set contains 40 orthographic **1254×1254** fronts, one per design/theme. They depict the front face only, with centered artwork and a thin gold perimeter. Original 520×520 concept files remain as historical references; they are no longer the runtime artwork. Their photographed sidewalls and baked dark crescents must not be carried into replacement fronts.

Authored PNGs live in [`mobile/recorder/assets/medallions-v2/`](../mobile/recorder/assets/medallions-v2/). Generation provenance is recorded in [journey-generation.md](../mobile/recorder/assets/medallions-v2/journey-generation.md), [music-generation.md](../mobile/recorder/assets/medallions-v2/music-generation.md), and [memory-generation.md](../mobile/recorder/assets/medallions-v2/memory-generation.md). Preserve those source files and prompt/reference records when preparing assets.

Run `node --experimental-strip-types scripts/prepare-medallion-assets.cjs` from `mobile/recorder` to prepare the collection. The [preparation script](../mobile/recorder/scripts/prepare-medallion-assets.cjs) requires all 40 fronts, detects each gold perimeter, writes normalized bounds to `frames.json`, and produces lossless WebP files in `assets/medallions-v2/runtime/`. It verifies every visible decoded pixel and the alpha channel against its PNG source. Compression does not resize or repaint the artwork.

Some generated PNG backgrounds contain opaque checkerboards, so alpha bounds are not the framing authority. [`medallion-artwork.ts`](../mobile/recorder/src/medallion-artwork.ts) supplies the same exact per-front `frames.json` bounds to both native thumbnails/fallbacks and WebGL. Native images offset/scale that frame inside a circular clip; WebGL crops it into the circular face's UV space. This keeps the front, physical backing, and theme variants concentric while excluding the generated backdrop. Source files are not assumed to have transparent corners.

## Physical coin and surface lighting

Three.js renders the coin through an Expo DOM component. [`medallion-geometry.ts`](../mobile/recorder/src/medallion-geometry.ts) defines a closed, lathed gold body with radius `1`, total thickness `0.132`, integral beveled lips, and a common center for the front and reverse. The face radius is `0.958`; its smooth authored profile spans Z `0.054–0.060`, below the lip at `0.066`. The entire variation is `0.006`—equivalent to 0.12 mm on a 40 mm coin.

Artwork color and brightness **never displace the mesh**. Restrained material normals supply shallow engraved detail; metallic/roughness maps distinguish warm metal from enamel. CPU smoothing produces the same maps across browser engines. The former `0.10` image-derived extrusion and directional self-shadow maps are retired: they produced oversized bumps, warped highlights, and dark lines.

The ordinary-gold body has a fine reeded edge. Its gold reverse carries a restrained JourneyDeck/mountain-road engraving and the medallion name. [`medallion-studio.ts`](../mobile/recorder/src/medallion-studio.ts) supplies broad studio-light reflections through a generated environment map, with neutral light in every direction. Polished gold, enamel, and shallow normal detail respond as the coin turns. Texture rendering supports up to 3× device density and 8× anisotropic filtering.

## Interaction and presentation

The orthographic camera opens directly face-on with **no automatic starting tilt or rotation**. Horizontal dragging turns the whole coin through 360 degrees; release allows short, decaying inertia. Arrow keys turn it in 30-degree steps; Home or a double-click returns to the front. Reduce Motion disables inertia while preserving deliberate turning. Inactivity or a hidden document stops animation and releases any held pointer.

The detail sheet opens fully in the selected theme's page color (dark navy in Grand Touring). Measured sheet space controls medallion size up to 380pt. Content scrolls only when needed for its height, longer text, or accessibility sizing. Every native thumbnail uses the same ordinary-gold outer rim and bright perimeter line, independent of how much painted border exists in a particular front.

The iPhone entrance waits for WebGL readiness, then drops the coin 440pt with the existing 400ms spring (damping ratio 0.8, starting scale 0.97); its layer handoff remains 80ms. The first iPad fix made the coin appear, but device feedback confirmed that the flat artwork visibly changed to 3D and the drop was not seen. iPad now uses a stationary, full-opacity WebView behind an opaque page-colored loading cover with a small activity indicator and "Preparing medallion…" text. No flat artwork is mounted during normal preparation. The cover fades away in 180ms only after a nonzero canvas has rendered and had a browser paint opportunity. Resizing or rotating does not replay the reveal; theme changes mount a fresh opaque cover.

Reduce Motion hides the iPad spinner and uses a 100ms cover fade; iPhone retains its existing timing path. Accessibility exposes only the current layer, and the renderer accepts touches only when ready. If iPad preparation errors or exceeds 12 seconds while active, it settles on static artwork and ignores late readiness rather than visibly switching to 3D. Backgrounding pauses the timeout and spinner; dismissal clears pending work. Component tests cover preparation, paint readiness, late callbacks, errors, theme changes, rotation-sized layouts and Reduce Motion. Native WKWebView scheduling remains a suspected cause of the original offscreen-host stall, not a reproduced diagnosis. Verify the new covered reveal and dragging on physical iPad after delivery.

Build 28 already contains `ExpoDomWebViewModule`; this implementation keeps its `.watch.7` runtime (internal preview `.preview.12`). DOM code and artwork are bundled OTA assets. Native asset bytes reach the WebView inline, so rendering needs no CDN. The retained native Minted module is not invoked by the medallion UI. Release verification and device acceptance are tracked in the current handoff/release notes.
