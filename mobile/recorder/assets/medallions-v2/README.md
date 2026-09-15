# Recreated medallion faces

These 40 front-facing designs replace the photographed, angled source medals.
All source PNGs are 1254 x 1254. Journey, music and memory generation notes record
their prompts, theme palettes and generated source paths.

Memory Maker Redline was the root session's front-only reference, generated at:
`C:\Users\patri\.codex\generated_images\01a0a215-90c2-7340-a356-be5a86bb8b9d\exec-ad7a482d-b656-4eeb-97cd-6b38ba2b14f8.png`.
It shows hands holding a road photograph with a heart, on navy enamel and gold.

## Runtime preparation

From `mobile/recorder`, run `node scripts/prepare-medallion-assets.cjs` using
Node24 and installed development dependencies. It creates lossless WebP files
under `runtime/` and detects each gold perimeter into `frames.json`, with a 2.5%
inset to remain inside irregular painted boundaries. Visible pixels are checked
against the originals; no resizing or invented detail occurs in this step.

Most generated images have an opaque checkerboard outside the circle. Always
apply the shared frame and circular clip through `MedallionArtworkImage` or the
3D renderer. The raw PNGs are provenance, not directly displayed app assets.
