# Grand Touring flat icon concept

## Rosewater proportion correction — September 15, 2026

The user requested matching Grand Touring's central symbol size and circle/bar
thickness to Rosewater. This supersedes the earlier enlarged-symbol direction.
The blue gradient, champagne symbol, flat styling and champagne perimeter remain.

`grand-touring-rosewater-proportions-v7.png` is the selected built-in imagegen edit
using `../icon-rosewater-v1.png` as the geometry reference. Expo image-utils
packages it as the opaque 1024x1024 `../icon-grand-touring-v2.png`, retaining the
existing shared references for Settings, primary light/dark, the Grand Touring
alternate and Watch. No icon IDs, native selection logic or runtime changed.

Final built-in prompt:

> Recolor this exact app icon to blue and champagne. STRICTLY retain the original central symbol outline pixel-for-pixel: same size, exact circle thickness, exact narrower horizontal pulse bar thickness, exact waveform position. Do not redesign the symbol or recenter it. Its outside horizontal span is16.5%-83.5% of square canvas and its vertical span15.3%-85.3%. Its side ring thickness is8.5% of canvas width, its TOP ring thickness is9% of canvas height. The horizontal pulse bars are5.3% of canvas height. Fill the current rose central symbol with a single uniform flat champagne gold #D4B15A; remove its 3D shadows, bevels and highlights but KEEP the exact outline geometry of the solid object. Replace the pink glass background with a smooth blue gradient from vivid navy-blue upper-left #0b4ca0 to deep midnight-blue lower-right #06245d. Replace glass perimeter with flat champagne gold perimeter: inner blue rounded square inset2% from edges, champagne continues outward to canvas edge. No gloss, bevels, shadows, pink, words or mockup. Single square opaque icon. The point of this edit is exact preservation of the reference central symbol size and stroke weights while only changing its palette and removing 3D effects.

The prompt describes the target; the generated result was visually checked,
not verified as a pixel-identical silhouette. Side-by-side browser previews at
60px and the Settings 88/104px sizes are in the ignored
`../../.cache/icon-proportions/review.html` and `review.png`. Thirteen existing
icon catalog/build/preference/picker tests pass, including generated opaque
alternate catalogs. Actual Home Screen delivery requires a new native build;
physical iOS/Watch masking remains an acceptance check (NB-013).

## Approved production integration

The user selected the bold blue-gradient/champagne-trim design as the new default
Grand Touring app icon and requested it on Welcome. The approved perimeter must
end in champagne, with no blue beyond it.

`grand-touring-production-master-v6.png` is the built-in image tool's final edit
of v5. Prompt: preserve logo and gradient; fill outside the inner blue squircle
with matching champagne to the square edges; increase corner curvature so the
champagne remains at the masked perimeter. No chrome, bevels, shadows or text.
Expo image-utils resized the master to opaque 1024x1024
`../icon-grand-touring-v2.png` for the app. Welcome and Settings preview this file;
the primary light/dark icons, retained Grand Touring alternate, and Watch source
use it too. Cinematic now has its own alternate asset name. The existing iOS
tinted/clear mask remains available. Exact Apple masking still needs real-device
acceptance; the browser preview is an approximation.

## Champagne perimeter trim

`grand-touring-champagne-trim-v5.png`: user requested matching champagne trim
around the entire icon. Built-in image edit from v4. Prompt: add a thin continuous
rounded-square outline inset about 3%, matching the champagne symbol; preserve
large circle/pulse and blue gradient. Flat line, no bevel, chrome, shine, shadow,
glow or text. Review candidate; verify trim under the actual iOS corner mask
when preparing production artwork.

## Larger, heavier symbol

`grand-touring-blue-gradient-bold-v4.png`: user approved v3's color direction
and requested a larger circle and wider champagne bars. Built-in image edit
from v3. Prompt: enlarge centered symbol to roughly 86% of canvas with even
margins and thicken ring/pulse strokes; retain one flat champagne color, blue
gradient, recognizable waveform, and rounded joins. No chrome, bevel, shine,
glow, extra shapes or text. Review candidate, not yet a shipping asset.

## Blue gradient refinement

`grand-touring-blue-gradient-v3.png` supersedes the multicolor v2 direction at
the user's request. Built-in image edit from v1; prompt: keep the circle and
pulse one flat champagne #D4B15A color, preserving geometry and margins. Change
only the background to a smooth diagonal blue gradient from #264C7D at upper
left through #142F54 to #081832 at lower right. No metallic effects, bevel,
glow, texture, border, or text. Shown for review; not yet a shipping asset.

## Color refinement

`grand-touring-flat-color-v2.png` adds color at the user's request. Generated
with the built-in image tool from v1. Prompt: preserve symbol geometry and navy
background; retain champagne ring, use warm ivory for the pulse, and add muted
racing green only on the downward slope. Flat colors, no metallic effects,
bevels, chrome, shadows, glow, borders, text, or new elements. Review candidate;
not yet integrated into shipping assets.

September 14, 2026: user requested redesigning both the Welcome mark and iOS Home
Screen icon to remove the chrome/shiny appearance. `grand-touring-flat-v1.png`
is a built-in image-generation design candidate, referenced from the existing
Grand Touring icon. It is not wired into native icon configuration.

Prompt: Preserve the circular ring and central pulse/mountain waveform; simplify
to solid champagne #D4B15A on opaque midnight navy #081832, softly rounded joins,
generous margins. No chrome, shine, bevel, shadow, glow, gradients, carbon fiber,
texture, border, rounded-square frame, text, or watermark. Square iOS icon canvas.

Review the visual direction before final production sizing, flat color cleanup,
transparent Welcome mark, and native appearance/alternate-icon integration.
